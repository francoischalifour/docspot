import { defineConfig } from 'tsdown';

const REACT_MODULE = /^react(-dom)?($|\/)/;

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    chat: 'src/chat/index.ts',
    algolia: 'src/algolia/index.ts',
    'algolia-chat': 'src/algolia-chat/index.ts',
    minisearch: 'src/minisearch/index.ts',
    handoffs: 'src/handoffs/index.ts',
    locale: 'src/locale/index.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  inputOptions: { preserveEntrySignatures: 'allow-extension' },
  copy: [{ from: 'src/styles.css', to: 'dist' }],
  outputOptions: {
    codeSplitting: {
      // Groups hold only the modules they name, not everything those import.
      includeDependenciesRecursively: false,
      // URL helpers stay apart from hooks, so `createDocspotUrl` alone
      // never brings React code along.
      groups: [
        { name: 'url', test: /src[\\/]core[\\/]url\.ts$/ },
        // Root, its hooks, and the public parts would otherwise share the
        // entry chunk, which must stay free of React (see banner).
        {
          name: 'client',
          test: /src[\\/]core[\\/](Docspot|Root|chatLifecycle|use[A-Z]\w*|SearchTrigger|ChatTrigger|Trigger|SearchDialog|ChatPanel|ChatLauncher)\.tsx?$|src[\\/]ui[\\/]renderElement\.tsx$/,
        },
      ],
    },
    // Chunks that use React are client modules for React Server Components.
    // The entry chunks hold only re-exports and React-free helpers, so a
    // server component can render <Docspot> and call createDocspotUrl.
    banner: chunk =>
      chunk.imports.some(id => REACT_MODULE.test(id)) ? "'use client';" : '',
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
