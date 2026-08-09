import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import Composer from './components/Composer';
import SettingsModal from './components/SettingsModal';
import { useChats } from './store/useChats';
import { useSettings } from './store/useSettings';
import { applyTheme } from './store/useSettings';
import { IconMenu, IconSettings } from './components/Icons';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hydrateSettings = useSettings((s) => s.hydrate);
  const settingsLoaded = useSettings((s) => s.loaded);
  const theme = useSettings((s) => s.settings.theme);
  const hasProvider = useSettings((s) => s.settings.activeProviderId !== null);

  const hydrateChats = useChats((s) => s.hydrate);
  const error = useChats((s) => s.error);
  const clearError = useChats((s) => s.clearError);
  const activeChatId = useChats((s) => s.activeChatId);
  const chats = useChats((s) => s.chats);

  useEffect(() => {
    void hydrateSettings();
    void hydrateChats();
  }, [hydrateSettings, hydrateChats]);

  // Prompt for configuration on a first visit, once state is known.
  useEffect(() => {
    if (settingsLoaded && !hasProvider) setSettingsOpen(true);
  }, [settingsLoaded, hasProvider]);

  // Follow the OS theme live while set to "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const title = chats.find((c) => c.id === activeChatId)?.title ?? 'New chat';

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top flex shrink-0 items-center gap-2 border-b border-surface-200 px-3 py-2.5 dark:border-surface-800 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn-ghost !px-2"
            aria-label="Open sidebar"
          >
            <IconMenu />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-medium">{title}</h1>
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-ghost !px-2"
            aria-label="Open settings"
          >
            <IconSettings />
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm
                       text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          >
            <span className="min-w-0 flex-1">{error}</span>
            <button onClick={clearError} className="shrink-0 font-medium underline">
              Dismiss
            </button>
          </div>
        )}

        <ChatView />
        <Composer />
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
