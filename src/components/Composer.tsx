import { useEffect, useRef, useState } from 'react';
import { useChats } from '../store/useChats';
import { useSettings } from '../store/useSettings';
import { IconSend, IconStop } from './Icons';

const MAX_HEIGHT = 200;

export default function Composer() {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = useChats((s) => s.send);
  const stop = useChats((s) => s.stop);
  const streaming = useChats((s) => s.streaming);
  const activeChatId = useChats((s) => s.activeChatId);
  const sendOnEnter = useSettings((s) => s.settings.sendOnEnter);
  const hasProvider = useSettings((s) => s.settings.activeProviderId !== null);

  // Grow with content up to a cap, then scroll internally.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  // Refocus when switching chats, but not on touch devices where it would
  // pop the on-screen keyboard open unprompted.
  useEffect(() => {
    if (window.matchMedia('(hover: hover)').matches) ref.current?.focus();
  }, [activeChatId]);

  const submit = () => {
    const value = text.trim();
    if (!value || streaming) return;
    setText('');
    void send(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    // IME composition must not be interrupted mid-word.
    if (e.nativeEvent.isComposing) return;

    const wantsSend = sendOnEnter ? !e.shiftKey : e.ctrlKey || e.metaKey;
    if (wantsSend) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="safe-bottom bg-gradient-to-t from-surface-0 via-surface-0 to-transparent
                    px-3 pb-3 pt-2 dark:from-surface-950 dark:via-surface-950 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-3xl">
        <div
          className="flex items-end gap-2 rounded-[26px] border border-surface-200 bg-surface-0 p-2 pl-4
                     shadow-sm transition-colors focus-within:border-surface-400
                     dark:border-surface-700 dark:bg-surface-900 dark:focus-within:border-surface-500"
        >
          <textarea
            ref={ref}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={hasProvider ? 'Send a message…' : 'Add a provider in Settings to start'}
            disabled={!hasProvider}
            aria-label="Message input"
            className="scrollbar-thin max-h-[200px] flex-1 resize-none bg-transparent px-1 py-1.5
                       text-[16px] leading-6 outline-none placeholder:text-surface-400
                       disabled:cursor-not-allowed dark:placeholder:text-surface-600"
          />

          {streaming ? (
            <button onClick={stop} className="shrink-0 rounded-full bg-surface-900 p-2 text-white
                                           transition-opacity hover:opacity-80 dark:bg-surface-100
                                           dark:text-surface-900" title="Stop generating" aria-label="Stop generating">
              <IconStop className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim() || !hasProvider}
              className="shrink-0 rounded-full bg-surface-900 p-2 text-white transition-opacity
                         hover:opacity-80 disabled:opacity-30 dark:bg-surface-100 dark:text-surface-900"
              title="Send"
              aria-label="Send message"
            >
              <IconSend className="h-5 w-5" />
            </button>
          )}
        </div>

        <p className="mt-2 hidden text-center text-xs text-surface-700/50 dark:text-surface-200/40 sm:block">
          {sendOnEnter ? 'Enter to send · Shift+Enter for newline' : 'Ctrl+Enter to send'}
        </p>
      </div>
    </div>
  );
}
