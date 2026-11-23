// Bundles single named imports from the built package, as an application
// would, and verifies that unused code is dropped.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'rolldown';

const packageRoot = join(import.meta.dir, '..');

const cases = [
  {
    name: 'link helper alone',
    source: `import { createDocspotUrl } from 'docspot'; console.log(createDocspotUrl('/', { query: 'a' }));`,
    // No components, hooks, or search heuristics. Bare `import 'react'`
    // statements may remain: bundlers keep them because React's package
    // does not declare itself free of side effects.
    excludes: [
      'createContext',
      'useState',
      'docspot-search',
      'QUESTION_START',
      'autocomplete',
    ],
  },
  {
    name: 'Algolia search adapter',
    source: `import { createAlgoliaSearch } from 'docspot/algolia'; console.log(createAlgoliaSearch);`,
    excludes: ['from "react', 'useState', 'DefaultChatTransport'],
  },
  {
    name: 'MiniSearch adapter',
    source: `import { createMiniSearchSearch } from 'docspot/minisearch'; console.log(createMiniSearchSearch);`,
    excludes: ['from "react', 'useState', 'algolia'],
  },
  {
    name: 'chat handoffs',
    source: `import { chatGptHandoff } from 'docspot/handoffs'; console.log(chatGptHandoff);`,
    excludes: ['claude.ai', 'useState', 'autocomplete'],
  },
  {
    name: 'one locale',
    source: `import { fr } from 'docspot/locale'; console.log(fr);`,
    // Other locales, and anything that renders.
    excludes: ['Doku durchsuchen', 'ドキュメント', 'Search docs', 'useState'],
  },
  {
    name: 'search-only component',
    source: `import { Docspot } from 'docspot'; console.log(Docspot);`,
    excludes: [
      '@ai-sdk/react',
      'DefaultChatTransport',
      'react-markdown',
      'algolia.net',
    ],
  },
];

// Inside the package, so `docspot` resolves to itself through its exports.
const directory = mkdtempSync(
  join(packageRoot, 'node_modules', '.tree-shaking-')
);
let failed = false;
try {
  for (const { name, source, excludes } of cases) {
    const input = join(directory, 'entry.js');
    writeFileSync(input, source);
    const { output } = await build({
      input,
      write: false,
      cwd: packageRoot,
      // Installed packages stay external, as an app's bundler resolves them.
      external: [
        /^react/,
        'ai',
        '@ai-sdk/react',
        '@algolia/autocomplete-core',
        'react-markdown',
        'remark-gfm',
      ],
      output: { format: 'esm', codeSplitting: true },
      // Docspot's chunks start with 'use client' for React Server Components,
      // which plain bundles drop on purpose.
      onLog(level, log, handler) {
        if (log.code !== 'MODULE_LEVEL_DIRECTIVE') handler(level, log);
      },
    });
    const entry = output.find(chunk => chunk.type === 'chunk' && chunk.isEntry);
    if (entry?.type !== 'chunk')
      throw new Error(`Missing entry chunk for ${name}`);
    // A dependency in a shared static chunk still loads with the entry.
    const chunks = new Map(
      output.flatMap(chunk =>
        chunk.type === 'chunk' ? [[chunk.fileName, chunk] as const] : []
      )
    );
    const loaded = new Set([entry]);
    for (const chunk of loaded) {
      for (const specifier of chunk.imports) {
        const dependency = chunks.get(specifier);
        if (dependency) loaded.add(dependency);
      }
    }
    const code = [...loaded].map(chunk => chunk.code).join('\n');
    const leaked = excludes.filter(text => code.includes(text));
    if (leaked.length) {
      failed = true;
      if (process.env.DEBUG) console.log(code);
      console.error(`✗ ${name}: statically includes ${leaked.join(', ')}`);
    } else
      console.log(
        `✓ ${name}: ${(code.length / 1024).toFixed(1)} kB eagerly loaded`
      );
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
if (failed) process.exit(1);
