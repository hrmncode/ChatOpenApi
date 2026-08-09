import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // highlight.js and the markdown pipeline dominate the bundle; splitting them
    // out keeps the app shell small and lets them cache independently.
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'highlight', test: /node_modules\/(highlight\.js|lowlight)\// },
            { name: 'markdown', test: /node_modules\/(react-markdown|remark|rehype|mdast|micromark|unist|vfile|hast|unified|devlop|property-information|space-separated-tokens|comma-separated-tokens|html-url-attributes|zwitch|trim-lines|estree|character-entities|decode-named-character-reference|ccount|escape-string-regexp|markdown-table|longest-streak|bail|is-plain-obj|extend|stringify-entities)/ },
            { name: 'vendor', test: /node_modules\/(react|react-dom|scheduler|zustand|idb)\// },
          ],
        },
      },
    },
  },
});
