import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Chat, Message, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const DB_NAME = 'chatopenapi';
const DB_VERSION = 1;
const SETTINGS_KEY = 'app';

interface ChatDB extends DBSchema {
  chats: {
    key: string;
    value: Chat;
    indexes: { 'by-updated': number };
  };
  messages: {
    key: string;
    value: Message;
    indexes: { 'by-chat': string };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ChatDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('chats')) {
          const chats = db.createObjectStore('chats', { keyPath: 'id' });
          chats.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('messages')) {
          const messages = db.createObjectStore('messages', { keyPath: 'id' });
          messages.createIndex('by-chat', 'chatId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

export async function listChats(): Promise<Chat[]> {
  const db = await getDB();
  const chats = await db.getAllFromIndex('chats', 'by-updated');
  return chats.reverse();
}

export async function saveChat(chat: Chat): Promise<void> {
  const db = await getDB();
  await db.put('chats', chat);
}

export async function deleteChat(chatId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['chats', 'messages'], 'readwrite');
  await tx.objectStore('chats').delete(chatId);
  const msgStore = tx.objectStore('messages');
  const keys = await msgStore.index('by-chat').getAllKeys(chatId);
  await Promise.all(keys.map((key) => msgStore.delete(key)));
  await tx.done;
}

export async function listMessages(chatId: string): Promise<Message[]> {
  const db = await getDB();
  const messages = await db.getAllFromIndex('messages', 'by-chat', chatId);
  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveMessage(message: Message): Promise<void> {
  const db = await getDB();
  await db.put('messages', message);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const db = await getDB();
  await db.delete('messages', messageId);
}

/** Removes a message and every message created after it in the same chat. */
export async function deleteMessagesFrom(chatId: string, createdAt: number): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  const all = await store.index('by-chat').getAll(chatId);
  await Promise.all(
    all.filter((m) => m.createdAt >= createdAt).map((m) => store.delete(m.id)),
  );
  await tx.done;
}

export async function loadSettings(): Promise<Settings> {
  const db = await getDB();
  const stored = await db.get('settings', SETTINGS_KEY);
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings, SETTINGS_KEY);
}

/** Wipes every store. Used by the "delete all data" action in settings. */
export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['chats', 'messages', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('chats').clear(),
    tx.objectStore('messages').clear(),
    tx.objectStore('settings').clear(),
  ]);
  await tx.done;
}

export async function exportData(): Promise<string> {
  const db = await getDB();
  const [chats, messages, settings] = await Promise.all([
    db.getAll('chats'),
    db.getAll('messages'),
    db.get('settings', SETTINGS_KEY),
  ]);
  // Strip API keys so an exported file is safe to share.
  const safeSettings = settings
    ? { ...settings, providers: settings.providers.map((p) => ({ ...p, apiKey: '' })) }
    : null;
  return JSON.stringify({ version: 1, chats, messages, settings: safeSettings }, null, 2);
}

export async function importData(json: string): Promise<void> {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid backup file');
  const data = parsed as { chats?: Chat[]; messages?: Message[] };
  const db = await getDB();
  const tx = db.transaction(['chats', 'messages'], 'readwrite');
  for (const chat of data.chats ?? []) await tx.objectStore('chats').put(chat);
  for (const msg of data.messages ?? []) await tx.objectStore('messages').put(msg);
  await tx.done;
}
