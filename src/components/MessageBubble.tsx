import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message } from '../types';
import { cn } from '../lib/utils';
import { IconCheck, IconCopy } from './Icons';

interface Props {
  message: Message;
  isStreaming: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs a secure context; fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      title={copied ? 'Copied' : 'Copy message'}
      aria-label={copied ? 'Copied' : 'Copy message'}
      className="rounded-md p-1.5 text-surface-700/60 transition-colors hover:bg-surface-100
                 hover:text-surface-900 dark:text-surface-200/50 dark:hover:bg-surface-700
                 dark:hover:text-surface-100"
    >
      {copied ? <IconCheck className="h-4 w-4 text-accent" /> : <IconCopy className="h-4 w-4" />}
    </button>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    // Extract text from the <code> element inside the <pre>.
    const el = (children as { props?: { children?: React.ReactNode } })?.props?.children;
    const text = extractText(el);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group/code relative my-3">
      <button
        onClick={copy}
        title={copied ? 'Copied' : 'Copy code'}
        aria-label={copied ? 'Copied' : 'Copy code'}
        className="absolute right-2 top-2 z-10 rounded-md bg-surface-800/80 p-1.5 text-surface-200
                   opacity-0 backdrop-blur transition-opacity hover:bg-surface-800
                   group-hover/code:opacity-100 dark:bg-surface-700/80 dark:hover:bg-surface-700"
      >
        {copied ? <IconCheck className="h-4 w-4 text-accent" /> : <IconCopy className="h-4 w-4" />}
      </button>
      <pre className="overflow-x-auto rounded-lg bg-surface-900 p-4 text-sm leading-6
                     dark:bg-surface-950 [&_code]:bg-transparent [&_code]:p-0">
        {children}
      </pre>
    </div>
  );
}

/** Recursively extracts text content from a React node (string | element | array). */
function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}

function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="group w-full animate-fade-in">
        <div className="mx-auto flex max-w-3xl justify-end px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-col items-end gap-1">
            <div className="whitespace-pre-wrap break-words rounded-3xl rounded-tr-md
                            bg-surface-100 px-4 py-2.5 text-[15px] leading-7
                            dark:bg-surface-800">
              {message.content}
            </div>
            {!isStreaming && message.content && (
              <div className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <CopyButton text={message.content} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group w-full animate-fade-in px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl gap-3 sm:gap-4">
        <div
          className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full
                     border border-surface-300 text-xs font-semibold text-surface-600
                     dark:border-surface-600 dark:text-surface-300"
          aria-hidden
        >
          AI
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold">Assistant</span>
            {message.model && (
              <span className="truncate text-xs text-surface-700/50 dark:text-surface-200/40">
                {message.model}
              </span>
            )}
          </div>

          <div className={cn('prose-chat', isStreaming && !message.content && 'caret')}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
                pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && message.content && (
              <span className="ml-0.5 inline-block animate-blink text-accent">▍</span>
            )}
          </div>

          {message.error && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm
                         text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {message.error}
            </div>
          )}

          {!isStreaming && message.content && (
            <div className="mt-2 flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <CopyButton text={message.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Streaming re-renders the active message on every token; memoising keeps the
// rest of the transcript from re-rendering with it.
export default memo(MessageBubble);
