import { useEffect, useRef } from 'react';
import { useChats } from '../store/useChats';
import MessageBubble from './MessageBubble';
import { IconLock, IconRefresh } from './Icons';

export default function ChatView() {
  const messages = useChats((s) => s.messages);
  const streaming = useChats((s) => s.streaming);
  const streamingId = useChats((s) => s.streamingId);
  const regenerate = useChats((s) => s.regenerate);
  const activeChatId = useChats((s) => s.activeChatId);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Only auto-scroll while the user is already at the bottom, so scrolling up
  // to read history is not fought by incoming tokens.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    if (pinned.current) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(() => {
    pinned.current = true;
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [activeChatId]);

  const canRegenerate =
    !streaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant';

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="mb-3 text-2xl font-semibold text-surface-800 dark:text-surface-100">What can I help with?</h1>
          <p className="mb-6 text-sm text-surface-500 dark:text-surface-400">
            A ChatGPT-style interface for any OpenAI-compatible API.
          </p>
          <p className="inline-flex items-center gap-2 rounded-full bg-surface-100 px-3 py-1.5 text-xs text-surface-500 dark:bg-surface-800 dark:text-surface-400">
            <IconLock className="h-3.5 w-3.5" />
            Chats never leave your browser
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin flex-1 overflow-y-auto">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} isStreaming={streaming && m.id === streamingId} />
      ))}

      {canRegenerate && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => void regenerate()}
            className="btn-ghost border border-surface-200 dark:border-surface-700"
          >
            <IconRefresh className="h-4 w-4" />
            Regenerate
          </button>
        </div>
      )}

      <div ref={endRef} className="h-4" />
    </div>
  );
}
