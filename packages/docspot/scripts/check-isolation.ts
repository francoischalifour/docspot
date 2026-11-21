// Verifies that each entry point loads only what it needs on import. Static
// imports load eagerly; dynamic imports load on use, so they are allowed.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const dist = join(import.meta.dir, '..', 'dist');

const optionalFeatures = [
  'ai',
  '@ai-sdk/react',
  'react-markdown',
  'remark-gfm',
  '@algolia/autocomplete-core',
  'minisearch',
];
const providerDependencies = [...optionalFeatures, 'react', 'react-dom'];

const forbidden = {
  'index.js': optionalFeatures,
  'chat.js': optionalFeatures,
  'algolia.js': providerDependencies,
  'algolia-chat.js': providerDependencies,
  'minisearch.js': providerDependencies,
  'handoffs.js': optionalFeatures,
};

const transpiler = new Bun.Transpiler({ loader: 'js' });

function collect(
  file: string,
  seen = new Set<string>(),
  packages = new Set<string>()
) {
  if (seen.has(file)) return packages;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  for (const { kind, path } of transpiler.scanImports(source)) {
    if (kind !== 'import-statement') continue;
    if (path.startsWith('.'))
      collect(resolve(dirname(file), path), seen, packages);
    else packages.add(path);
  }
  return packages;
}

let failed = false;
for (const [entry, packages] of Object.entries(forbidden)) {
  const loaded = collect(join(dist, entry));
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
