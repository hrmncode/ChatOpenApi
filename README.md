# ChatOpenApi

A private, mobile-friendly ChatGPT-style web interface for any OpenAI-compatible
API. Chats and settings live entirely in your browser — no backend, no account,
nothing leaves your device except the requests you make to the endpoint you
configured.

## Features

- **Private by design.** Chats, messages and settings are stored in IndexedDB;
  nothing is persisted server-side.
- **Bring your own provider.** Add any OpenAI-compatible endpoint (OpenAI,
  OpenRouter, Groq, Together, Ollama, LM Studio, your own gateway, ...).
- **Streaming responses** with a Stop button that truly cancels the request.
- **Multiple chats** with date-grouped sidebar, rename, delete.
- **Markdown rendering** (tables, code blocks, GFM) with syntax highlighting.
- **Mobile-friendly** responsive layout with safe-area insets and a drawer
  sidebar.
- **Export / import** backup of all chats (API keys are stripped from
  exports).
- **Theme**: light / dark / system.

## Quick start

```bash
docker compose up -d
# Open http://localhost:8080
```

Open Settings on first visit, pick a preset (or write your own), paste an API
key, and start chatting.

### Build locally without Docker

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

## Configuration

In Settings, a provider needs:

| Field      | Example                          |
|------------|----------------------------------|
| Name       | `My OpenAI`                      |
| Base URL   | `https://api.openai.com/v1`      |
| API key    | `sk-…`                           |
| Model      | `gpt-4o-mini`                    |

The Base URL must include the version path (`/v1`). The "Test connection" button
queries `/models` to verify the URL, key and CORS.

### Supported endpoints

Anything that speaks the OpenAI Chat Completions API:

- OpenAI
- OpenRouter, Groq, Together, Mistral, DeepInfra, Fireworks, OpenPipe, ...
- Ollama (`http://localhost:11434/v1`, model `llama3` or similar)
- LM Studio (`http://localhost:1234/v1`, model `local-model`)
- Any reverse proxy in front of the above

The app makes requests **directly from your browser** to the endpoint you
configure. CORS must be allowed on the endpoint — most public APIs handle this;
local servers like Ollama allow it by default.

## Project structure

```
src/
├── App.tsx                  # Layout + routing state
├── main.tsx                 # Entry point
├── index.css                # Tailwind + markdown + scrollbar styling
├── types.ts                 # Shared TypeScript types
├── lib/
│   ├── api.ts               # OpenAI-compatible client (SSE streaming, abort)
│   ├── db.ts                # IndexedDB layer (chats/messages/settings)
│   └── utils.ts             # uid, title derivation, date grouping
├── store/
│   ├── useChats.ts          # Chat + message state, streaming pipeline
│   └── useSettings.ts       # Provider + preferences state
└── components/
    ├── ChatView.tsx         # Message list + empty state
    ├── Composer.tsx         # Auto-resizing textarea + Stop button
    ├── Icons.tsx            # Inline SVG icons (no icon dependency)
    ├── MessageBubble.tsx    # Markdown bubble + copy button
    ├── SettingsModal.tsx    # Provider / generation / theme / data
    └── Sidebar.tsx          # Date-grouped chat list, drawer on mobile
```

## Development

```bash
npm run dev      # Vite dev server with HMR
npm run build    # Type-check + production build
npm run preview  # Preview the production build locally
```

## Notes on privacy

- API keys never leave your browser except as the `Authorization` header on
  requests to the endpoint you configured.
- Backups are exported as JSON. Keys are stripped from exports so a backup is
  safe to share or commit.
- "Delete all data" wipes IndexedDB.
- The server only serves static assets; it has no application logic and cannot
  read what is stored in your browser.

## License

MIT.
