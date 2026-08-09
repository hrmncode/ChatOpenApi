import { create } from 'zustand';
import type { Chat, ChatCompletionMessage, Message } from '../types';
import * as db from '../lib/db';
import { ApiError, fetchCompletion, streamCompletion } from '../lib/api';
import { deriveTitle, uid } from '../lib/utils';
import { useSettings } from './useSettings';

interface ChatState {
  chats: Chat[];
  messages: Message[];
  activeChatId: string | null;
  streaming: boolean;
  /** Id of the assistant message currently being written to. */
  streamingId: string | null;
  error: string | null;

  hydrate: () => Promise<void>;
  selectChat: (chatId: string | null) => Promise<void>;
  newChat: () => void;
  removeChat: (chatId: string) => Promise<void>;
  renameChat: (chatId: string, title: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  regenerate: () => Promise<void>;
  stop: () => void;
  clearError: () => void;
}

let controller: AbortController | null = null;

export const useChats = create<ChatState>((set, get) => ({
  chats: [],
  messages: [],
  activeChatId: null,
  streaming: false,
  streamingId: null,
  error: null,

  hydrate: async () => {
    const chats = await db.listChats();
    set({ chats });
  },

  selectChat: async (chatId) => {
    if (!chatId) {
      set({ activeChatId: null, messages: [], error: null });
      return;
    }
    const messages = await db.listMessages(chatId);
    set({ activeChatId: chatId, messages, error: null });
  },

  newChat: () => {
    // The chat row is only persisted once the first message is sent, so an
    // abandoned "New chat" never pollutes the sidebar.
    set({ activeChatId: null, messages: [], error: null });
  },

  removeChat: async (chatId) => {
    await db.deleteChat(chatId);
    const chats = get().chats.filter((c) => c.id !== chatId);
    const isActive = get().activeChatId === chatId;
    set({ chats, ...(isActive ? { activeChatId: null, messages: [] } : {}) });
  },

  renameChat: async (chatId, title) => {
    const chat = get().chats.find((c) => c.id === chatId);
    if (!chat) return;
    const updated = { ...chat, title, updatedAt: Date.now() };
    await db.saveChat(updated);
    set({ chats: get().chats.map((c) => (c.id === chatId ? updated : c)) });
  },

  send: async (text) => {
    const content = text.trim();
    if (!content || get().streaming) return;

    const provider = useSettings.getState().activeProvider();
    if (!provider) {
      set({ error: 'No provider configured. Open Settings to add one.' });
      return;
    }

    const now = Date.now();
    let chatId = get().activeChatId;

    // Materialise the chat lazily on first send.
    if (!chatId) {
      chatId = uid();
      const chat: Chat = {
        id: chatId,
        title: deriveTitle(content),
        createdAt: now,
        updatedAt: now,
      };
      await db.saveChat(chat);
      set({ chats: [chat, ...get().chats], activeChatId: chatId });
    }

    const userMsg: Message = { id: uid(), chatId, role: 'user', content, createdAt: now };
    await db.saveMessage(userMsg);
    set({ messages: [...get().messages, userMsg], error: null });

    await runCompletion(set, get, chatId, provider.model);
  },

  regenerate: async () => {
    const { messages, activeChatId, streaming } = get();
    if (!activeChatId || streaming) return;

    const provider = useSettings.getState().activeProvider();
    if (!provider) {
      set({ error: 'No provider configured. Open Settings to add one.' });
      return;
    }

    // Drop the trailing assistant turn (and anything after it) before retrying.
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) {
      await db.deleteMessagesFrom(activeChatId, lastAssistant.createdAt);
      set({ messages: messages.filter((m) => m.createdAt < lastAssistant.createdAt) });
    }

    await runCompletion(set, get, activeChatId, provider.model);
  },

  stop: () => {
    controller?.abort();
    controller = null;
    set({ streaming: false, streamingId: null });
  },

  clearError: () => set({ error: null }),
}));

type Setter = (partial: Partial<ChatState>) => void;
type Getter = () => ChatState;

/** Shared streaming pipeline used by both send() and regenerate(). */
async function runCompletion(set: Setter, get: Getter, chatId: string, model: string) {
  const settings = useSettings.getState().settings;
  const provider = useSettings.getState().activeProvider();
  if (!provider) return;

  const assistantId = uid();
  const assistantMsg: Message = {
    id: assistantId,
    chatId,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    model,
  };

  set({
    messages: [...get().messages, assistantMsg],
    streaming: true,
    streamingId: assistantId,
    error: null,
  });

  const history: ChatCompletionMessage[] = [];
  if (settings.systemPrompt.trim()) {
    history.push({ role: 'system', content: settings.systemPrompt.trim() });
  }
  for (const m of get().messages) {
    if (m.id === assistantId || m.error) continue;
    history.push({ role: m.role, content: m.content });
  }

  controller = new AbortController();
  let accumulated = '';

  const flush = (content: string, error?: string) => {
    set({
      messages: get().messages.map((m) =>
        m.id === assistantId ? { ...m, content, ...(error ? { error } : {}) } : m,
      ),
    });
  };

  try {
    if (settings.streaming) {
      accumulated = await streamCompletion({
        provider,
        model,
        messages: history,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: controller.signal,
        onToken: (token) => {
          accumulated += token;
          flush(accumulated);
        },
      });
    } else {
      accumulated = await fetchCompletion({
        provider,
        model,
        messages: history,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        signal: controller.signal,
      });
      flush(accumulated);
    }

    const final: Message = { ...assistantMsg, content: accumulated };
    await db.saveMessage(final);
    await touchChat(set, get, chatId);
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';

    if (aborted) {
      // Keep whatever streamed in before the user hit stop.
      if (accumulated) {
        const partial: Message = { ...assistantMsg, content: accumulated };
        await db.saveMessage(partial);
        await touchChat(set, get, chatId);
      } else {
        set({ messages: get().messages.filter((m) => m.id !== assistantId) });
      }
    } else {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof TypeError
            ? 'Network error — check the Base URL and that the endpoint allows CORS.'
            : err instanceof Error
              ? err.message
              : 'Unknown error';

      const failed: Message = { ...assistantMsg, content: accumulated, error: message };
      await db.saveMessage(failed);
      flush(accumulated, message);
      set({ error: message });
    }
  } finally {
    controller = null;
    set({ streaming: false, streamingId: null });
  }
}

async function touchChat(set: Setter, get: Getter, chatId: string) {
  const chat = get().chats.find((c) => c.id === chatId);
  if (!chat) return;
  const updated = { ...chat, updatedAt: Date.now() };
  await db.saveChat(updated);
  // Re-sort so the most recently used chat floats to the top.
  set({
    chats: [updated, ...get().chats.filter((c) => c.id !== chatId)],
  });
}
