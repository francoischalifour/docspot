import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.tsx',
    chat: 'src/chat/index.ts',
    algolia: 'src/algolia/search.ts',
    'algolia-chat': 'src/algolia/chat.ts',
    minisearch: 'src/minisearch/index.ts',
    handoffs: 'src/handoffs/index.tsx',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  copy: [{ from: 'src/styles.css', to: 'dist' }],
  outputOptions: {
    codeSplitting: {
      // URL helpers stay apart from hooks, so `createDocspotUrl` alone
      // never brings React code along.
      groups: [{ name: 'url', test: /src[\\/]core[\\/]url\.ts$/ }],
    },
  },
  deps: {
    neverBundle: [
      /^react($|\/)/,
      /^react-dom($|\/)/,
      'ai',
      '@ai-sdk/react',
      'minisearch',
    ],
  },
});
