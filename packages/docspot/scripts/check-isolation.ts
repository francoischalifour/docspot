// Verifies that each entry point loads only what it needs on import. Static
// imports load eagerly; dynamic imports load on use, so they are allowed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dir, '..', 'dist');

const forbidden: Record<string, string[]> = {
  // Search-only and chat-only consumers share the core.
  'index.js': [
    'ai',
    '@ai-sdk/react',
    'react-markdown',
    'remark-gfm',
    '@algolia/autocomplete-core',
    'minisearch',
  ],
  'chat.js': [
    'ai',
    '@ai-sdk/react',
    'react-markdown',
    '@algolia/autocomplete-core',
    'minisearch',
  ],
  'algolia.js': [
    'ai',
    '@ai-sdk/react',
    'react',
    'react-markdown',
    '@algolia/autocomplete-core',
  ],
  'algolia-chat.js': [
    'ai',
    '@ai-sdk/react',
    'react-markdown',
    '@algolia/autocomplete-core',
    'minisearch',
  ],
  'minisearch.js': [
    'ai',
    '@ai-sdk/react',
    'react',
    'react-markdown',
    '@algolia/autocomplete-core',
    'minisearch',
  ],
  // Icons only: the core renders them.
  'handoffs.js': [
    'ai',
    '@ai-sdk/react',
    'react-markdown',
    '@algolia/autocomplete-core',
    'minisearch',
  ],
};

const staticImport =
  /(?:^|;|\n)\s*(?:import|export)\s*(?:[\w*{}\s,$]+from\s*)?["']([^"']+)["']/g;

function collect(
  file: string,
  seen = new Set<string>(),
  packages = new Set<string>()
) {
  if (seen.has(file)) return packages;
  seen.add(file);
  const source = readFileSync(join(dist, file), 'utf8');
  for (const [, specifier] of source.matchAll(staticImport)) {
    if (specifier!.startsWith('./'))
      collect(specifier!.slice(2), seen, packages);
    else packages.add(specifier!);
  }
  return packages;
}

let failed = false;
for (const [entry, packages] of Object.entries(forbidden)) {
  const loaded = collect(entry);
  const leaked = [...loaded].filter(name =>
    packages.some(
      forbiddenName =>
        name === forbiddenName || name.startsWith(`${forbiddenName}/`)
    )
  );
  if (leaked.length) {
    failed = true;
    console.error(`✗ ${entry} statically loads ${leaked.join(', ')}`);
  } else
    console.log(
      `✓ ${entry} loads ${[...loaded].sort().join(', ') || 'no packages'}`
    );
}
if (failed) process.exit(1);
