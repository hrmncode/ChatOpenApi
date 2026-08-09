import { useMemo, useState } from 'react';
import { useChats } from '../store/useChats';
import type { Chat } from '../types';
import { cn, groupByDate } from '../lib/utils';
import { IconChat, IconClose, IconEdit, IconLock, IconPlus, IconSettings, IconTrash } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar({ open, onClose, onOpenSettings }: Props) {
  const chats = useChats((s) => s.chats);
  const activeChatId = useChats((s) => s.activeChatId);
  const selectChat = useChats((s) => s.selectChat);
  const newChat = useChats((s) => s.newChat);
  const removeChat = useChats((s) => s.removeChat);
  const renameChat = useChats((s) => s.renameChat);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const groups = useMemo(() => {
    const map = new Map<string, Chat[]>();
    for (const chat of chats) {
      const key = groupByDate(chat.updatedAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(chat);
      else map.set(key, [chat]);
    }
    return [...map.entries()];
  }, [chats]);

  const commitRename = async (id: string) => {
    const title = draft.trim();
    if (title) await renameChat(id, title);
    setEditingId(null);
  };

  const handleSelect = async (id: string) => {
    await selectChat(id);
    onClose();
  };

  return (
    <>
      {/* Scrim: mobile only, closes the drawer on tap. */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          'fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-surface-900 text-surface-100',
          'transition-transform duration-200 md:static md:z-auto md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="safe-top flex items-center gap-2 p-3">
          <button
            onClick={() => {
              newChat();
              onClose();
            }}
            className="flex flex-1 items-center gap-2 rounded-lg border border-white/20 px-3 py-2.5
                       text-sm font-medium transition-colors hover:bg-white/10"
          >
            <IconPlus className="h-4 w-4" />
            New chat
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2.5 transition-colors hover:bg-white/10 md:hidden"
            aria-label="Close sidebar"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-2 pb-2">
          {chats.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-surface-200/40">
              No chats yet.
              <br />
              Start a conversation.
            </p>
          )}

          {groups.map(([label, items]) => (
            <section key={label}>
              <h2 className="px-3 pb-1.5 pt-2 text-xs font-medium uppercase tracking-wide text-surface-200/40">
                {label}
              </h2>
              <ul className="space-y-0.5">
                {items.map((chat) => (
                  <li key={chat.id}>
                    {editingId === chat.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => void commitRename(chat.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename(chat.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        aria-label="Chat title"
                        className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none
                                   ring-1 ring-accent"
                      />
                    ) : (
                      <div
                        className={cn(
                          'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                          activeChatId === chat.id ? 'bg-white/15' : 'hover:bg-white/8',
                        )}
                      >
                        <button
                          onClick={() => void handleSelect(chat.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <IconChat className="h-4 w-4 shrink-0 opacity-50" />
                          <span className="truncate">{chat.title}</span>
                        </button>

                        <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingId(chat.id);
                              setDraft(chat.title);
                            }}
                            className="rounded p-1 hover:bg-white/15"
                            title="Rename"
                            aria-label="Rename chat"
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => void removeChat(chat.id)}
                            className="rounded p-1 hover:bg-white/15 hover:text-red-400"
                            title="Delete"
                            aria-label="Delete chat"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="safe-bottom border-t border-white/10 p-2">
          <button
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm
                       transition-colors hover:bg-white/10"
          >
            <IconSettings className="h-4 w-4" />
            Settings
          </button>
          <p className="flex items-center gap-1.5 px-3 py-2 text-xs text-surface-200/30">
            <IconLock className="h-3 w-3" />
            Stored locally in your browser
          </p>
        </div>
      </aside>
    </>
  );
}
