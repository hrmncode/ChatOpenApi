import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../store/useSettings';
import { useChats } from '../store/useChats';
import { exportData, importData } from '../lib/db';
import { ApiError, fetchModels } from '../lib/api';
import type { Provider } from '../types';
import { IconClose, IconPlus, IconSpinner, IconTrash } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESETS = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { name: 'Together', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3-70b-chat-hf' },
  { name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
  { name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
];

const EMPTY: Omit<Provider, 'id'> = { name: '', baseUrl: '', apiKey: '', model: '' };

export default function SettingsModal({ open, onClose }: Props) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const addProvider = useSettings((s) => s.addProvider);
  const updateProvider = useSettings((s) => s.updateProvider);
  const removeProvider = useSettings((s) => s.removeProvider);
  const setActiveProvider = useSettings((s) => s.setActiveProvider);
  const wipe = useSettings((s) => s.wipe);
  const hydrateChats = useChats((s) => s.hydrate);
  const selectChat = useChats((s) => s.selectChat);

  const [draft, setDraft] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Escape closes the modal from anywhere inside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setDraft(EMPTY);
      setTestResult(null);
      setModels([]);
    }
  }, [open]);

  if (!open) return null;

  const active = settings.providers.find((p) => p.id === settings.activeProviderId) ?? null;

  const testConnection = async (provider: Provider | Omit<Provider, 'id'>) => {
    setTesting(true);
    setTestResult(null);
    try {
      const list = await fetchModels({ id: 'probe', ...provider } as Provider);
      const ids = list.map((m) => m.id).sort();
      setModels(ids);
      setTestResult({ ok: true, msg: `Connected — ${ids.length} model${ids.length === 1 ? '' : 's'} available` });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof TypeError
            ? 'Network error — check the URL and that the endpoint allows CORS from this origin.'
            : err instanceof Error
              ? err.message
              : 'Connection failed';
      setTestResult({ ok: false, msg });
    } finally {
      setTesting(false);
    }
  };

  const saveDraft = async () => {
    if (!draft.baseUrl.trim() || !draft.model.trim()) return;
    await addProvider({
      ...draft,
      name: draft.name.trim() || (() => {
        try { return new URL(draft.baseUrl).hostname; }
        catch { return draft.baseUrl; }
      })(),
    });
    setDraft(EMPTY);
    setAdding(false);
    setTestResult(null);
  };

  const doExport = async () => {
    const json = await exportData();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatopenapi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      await importData(await file.text());
      await hydrateChats();
      setTestResult({ ok: true, msg: 'Backup imported' });
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Import failed' });
    }
  };

  const doWipe = async () => {
    if (!confirm('Delete all chats, messages and settings? This cannot be undone.')) return;
    await wipe();
    await hydrateChats();
    await selectChat(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white
                   shadow-xl dark:bg-surface-800 sm:max-h-[85vh] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-surface-100 px-5 py-4 dark:border-surface-700">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="btn-ghost !px-2" aria-label="Close settings">
            <IconClose />
          </button>
        </header>

        <div className="scrollbar-thin flex-1 space-y-8 overflow-y-auto px-5 py-5">
          {/* ── Providers ── */}
          <section>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-surface-700/60 dark:text-surface-200/50">
              Providers
            </h3>
            <p className="mb-3 text-xs text-surface-700/60 dark:text-surface-200/40">
              Any OpenAI-compatible endpoint. Your key is stored only in this browser and is sent
              directly to the endpoint you configure.
            </p>

            <div className="space-y-2">
              {settings.providers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700"
                >
                  <input
                    type="radio"
                    name="active-provider"
                    checked={settings.activeProviderId === p.id}
                    onChange={() => void setActiveProvider(p.id)}
                    className="h-4 w-4 shrink-0 accent-surface-900 dark:accent-surface-100"
                    aria-label={`Use ${p.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-surface-700/60 dark:text-surface-200/40">
                      {p.baseUrl} · {p.model}
                    </p>
                  </div>
                  <button
                    onClick={() => void removeProvider(p.id)}
                    className="btn-ghost shrink-0 !px-2 hover:text-red-600"
                    aria-label={`Remove ${p.name}`}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {settings.providers.length === 0 && !adding && (
                <p className="rounded-lg border border-dashed border-surface-200 px-3 py-6 text-center text-sm text-surface-700/50 dark:border-surface-700 dark:text-surface-200/40">
                  No providers yet.
                </p>
              )}
            </div>

            {adding ? (
              <div className="mt-3 space-y-3 rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setDraft({ ...draft, ...preset })}
                      className="rounded-full border border-surface-200 px-2.5 py-1 text-xs
                                 transition-colors hover:border-accent hover:text-accent
                                 dark:border-surface-700"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="label" htmlFor="p-name">Name</label>
                  <input
                    id="p-name"
                    className="input"
                    placeholder="My provider"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="p-url">Base URL</label>
                  <input
                    id="p-url"
                    className="input"
                    placeholder="https://api.openai.com/v1"
                    value={draft.baseUrl}
                    onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                  />
                  <p className="hint">Include the version path, e.g. /v1</p>
                </div>

                <div>
                  <label className="label" htmlFor="p-key">API key</label>
                  <input
                    id="p-key"
                    type="password"
                    className="input"
                    placeholder="sk-…"
                    autoComplete="off"
                    value={draft.apiKey}
                    onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="p-model">Model</label>
                  <input
                    id="p-model"
                    className="input"
                    placeholder="gpt-4o-mini"
                    list="model-options"
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                  />
                  <datalist id="model-options">
                    {models.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  {models.length > 0 && <p className="hint">{models.length} models loaded — type to filter</p>}
                </div>

                {testResult && (
                  <p
                    className={
                      testResult.ok
                        ? 'text-xs text-accent'
                        : 'text-xs text-red-600 dark:text-red-400'
                    }
                  >
                    {testResult.msg}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void testConnection(draft)}
                    disabled={!draft.baseUrl.trim() || testing}
                    className="btn-ghost border border-surface-200 dark:border-surface-700"
                  >
                    {testing ? <IconSpinner className="h-4 w-4" /> : null}
                    Test connection
                  </button>
                  <button
                    onClick={() => void saveDraft()}
                    disabled={!draft.baseUrl.trim() || !draft.model.trim()}
                    className="btn-primary"
                  >
                    Save provider
                  </button>
                  <button
                    onClick={() => {
                      setAdding(false);
                      setDraft(EMPTY);
                      setTestResult(null);
                    }}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} className="btn-ghost mt-3 border border-surface-200 dark:border-surface-700">
                <IconPlus className="h-4 w-4" />
                Add provider
              </button>
            )}

            {active && !adding && (
              <div className="mt-3">
                <label className="label" htmlFor="active-model">Model for {active.name}</label>
                <input
                  id="active-model"
                  className="input"
                  value={active.model}
                  list="active-model-options"
                  onChange={(e) => void updateProvider(active.id, { model: e.target.value })}
                />
                <datalist id="active-model-options">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <button
                  onClick={() => void testConnection(active)}
                  disabled={testing}
                  className="btn-ghost mt-2 border border-surface-200 dark:border-surface-700"
                >
                  {testing ? <IconSpinner className="h-4 w-4" /> : null}
                  Load models
                </button>
                {testResult && (
                  <p className={testResult.ok ? 'mt-2 text-xs text-accent' : 'mt-2 text-xs text-red-600 dark:text-red-400'}>
                    {testResult.msg}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── Generation ── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-surface-700/60 dark:text-surface-200/50">
              Generation
            </h3>

            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="sys">System prompt</label>
                <textarea
                  id="sys"
                  rows={3}
                  className="input resize-y"
                  placeholder="You are a helpful assistant."
                  value={settings.systemPrompt}
                  onChange={(e) => void update({ systemPrompt: e.target.value })}
                />
              </div>

              <div>
                <label className="label" htmlFor="temp">
                  Temperature: {settings.temperature.toFixed(2)}
                </label>
                <input
                  id="temp"
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={settings.temperature}
                  onChange={(e) => void update({ temperature: Number(e.target.value) })}
                  className="w-full accent-surface-900 dark:accent-surface-100"
                />
              </div>

              <div>
                <label className="label" htmlFor="maxtok">Max tokens</label>
                <input
                  id="maxtok"
                  type="number"
                  min={1}
                  className="input"
                  placeholder="Provider default"
                  value={settings.maxTokens ?? ''}
                  onChange={(e) =>
                    void update({ maxTokens: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={settings.streaming}
                  onChange={(e) => void update({ streaming: e.target.checked })}
                  className="h-4 w-4 accent-surface-900 dark:accent-surface-100"
                />
                Stream responses
              </label>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={settings.sendOnEnter}
                  onChange={(e) => void update({ sendOnEnter: e.target.checked })}
                  className="h-4 w-4 accent-surface-900 dark:accent-surface-100"
                />
                Enter sends message
              </label>
            </div>
          </section>

          {/* ── Appearance ── */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-surface-700/60 dark:text-surface-200/50">
              Appearance
            </h3>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => void update({ theme })}
                  className={
                    settings.theme === theme
                      ? 'btn-primary flex-1 capitalize'
                      : 'btn-ghost flex-1 border border-surface-200 capitalize dark:border-surface-700'
                  }
                >
                  {theme}
                </button>
              ))}
            </div>
          </section>

          {/* ── Data ── */}
          <section>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-surface-700/60 dark:text-surface-200/50">
              Data
            </h3>
            <p className="mb-3 text-xs text-surface-700/60 dark:text-surface-200/40">
              Everything lives in this browser's IndexedDB. Exports omit API keys.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void doExport()} className="btn-ghost border border-surface-200 dark:border-surface-700">
                Export backup
              </button>
              <button onClick={() => fileRef.current?.click()} className="btn-ghost border border-surface-200 dark:border-surface-700">
                Import backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void doImport(file);
                  e.target.value = '';
                }}
              />
              <button onClick={() => void doWipe()} className="btn-danger">
                Delete all data
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
