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
  'locale.js': providerDependencies,
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

// React Server Components: bundlers treat a module that starts with
// 'use client' as a client boundary. Every chunk that uses React must be
// one, and entry chunks must not use React themselves, so server
// components can import helpers such as createDocspotUrl.
const REACT_MODULE = /^react(-dom)?($|\/)/;
const USE_CLIENT = /^\s*['"]use client['"];/;
const usesReact = (source: string) =>
  transpiler.scanImports(source).some(({ path }) => REACT_MODULE.test(path));
const isClientModule = (source: string) => USE_CLIENT.test(source);
const reactEntries = new Set(['handoffs.js']);
for (const file of new Bun.Glob('*.js').scanSync(dist)) {
  const source = readFileSync(join(dist, file), 'utf8');
  if (usesReact(source) && !isClientModule(source)) {
    failed = true;
    console.error(`✗ ${file} uses React without 'use client'`);
  }
  if (file in forbidden && !reactEntries.has(file) && usesReact(source)) {
    failed = true;
    console.error(`✗ ${file} is an entry and uses React directly`);
  }
}
if (!failed) console.log("✓ chunks that use React are marked 'use client'");
if (failed) process.exit(1);
