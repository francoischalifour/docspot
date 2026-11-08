// Bundles single named imports from the built package, as an application
// would, and verifies that unused code is dropped.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'rolldown';

const packageRoot = join(import.meta.dir, '..');

const cases = [
  {
    name: 'link helper alone',
    source: `import { createDocspotUrl } from 'docspot'; console.log(createDocspotUrl('/', { search: 'a' }));`,
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
const directory = join(packageRoot, '.tree-shaking');
mkdirSync(directory, { recursive: true });
let failed = false;
try {
  for (const { name, source, excludes } of cases) {
    const input = join(directory, 'entry.js');
    writeFileSync(input, source);
    const { output } = await build({
      input,
      write: false,
      cwd: packageRoot,
      // Peer dependencies stay external, as an app's own copies would be.
      external: [
        /^react/,
        'ai',
        '@ai-sdk/react',
        '@algolia/autocomplete-core',
        'react-markdown',
        'remark-gfm',
      ],
      output: { format: 'esm', codeSplitting: true },
    });
    const entry = output.find(chunk => chunk.type === 'chunk' && chunk.isEntry);
    const code = entry && 'code' in entry ? entry.code : '';
    const leaked = excludes.filter(text => code.includes(text));
    if (leaked.length) {
      failed = true;
      if (process.env.DEBUG) console.log(code);
      console.error(`✗ ${name}: entry chunk includes ${leaked.join(', ')}`);
    } else
      console.log(
        `✓ ${name}: ${(code.length / 1024).toFixed(1)} kB entry chunk`
      );
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
if (failed) process.exit(1);
