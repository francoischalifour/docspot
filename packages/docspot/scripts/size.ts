/**
 * Bundle size, compared with `baselines/size.json`.
 *
 *   bun run size             Print sizes and fail when one grows past the baseline.
 *   bun run size --markdown  Print the sizes that changed, as a table for a pull request.
 *   bun run size --update    Record the current sizes as the baseline.
 *
 * Each consumer is a set of imports bundled and minified as an application
 * would, with peer and installed dependencies left out, so only Docspot's own
 * code counts. Eager code loads with the page; lazy code loads when search or
 * chat is first used, or once the page is idle. Sizes are gzipped bytes. Run
 * `bun run build` first.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { build } from 'rolldown';

const packageRoot = join(import.meta.dir, '..');
const baselinePath = join(packageRoot, 'baselines', 'size.json');
const updating = process.argv.includes('--update');
const markdown = process.argv.includes('--markdown');

/** Growth allowed before the check fails: 1%, at least 32 bytes. */
const tolerance = (bytes: number) => Math.max(32, Math.ceil(bytes * 0.01));

const consumers: Record<string, string> = {
  createDocspotUrl: `import { createDocspotUrl } from 'docspot'; export { createDocspotUrl };`,
  search: `import { Docspot, createSearch } from 'docspot'; export { Docspot, createSearch };`,
  chat: `import { Docspot } from 'docspot'; import { createChat } from 'docspot/chat'; export { Docspot, createChat };`,
  'search and chat': `import { Docspot, createSearch, useDocspot } from 'docspot'; import { createChat } from 'docspot/chat'; export { Docspot, createSearch, useDocspot, createChat };`,
  'docspot/algolia': `export { createAlgoliaSearch } from 'docspot/algolia';`,
  'docspot/algolia-chat': `export { createAlgoliaChat } from 'docspot/algolia-chat';`,
  'docspot/minisearch': `export { createMiniSearchSearch } from 'docspot/minisearch';`,
  'docspot/handoffs': `export { chatGptHandoff, claudeHandoff } from 'docspot/handoffs';`,
  'docspot/locale, one locale': `export { fr } from 'docspot/locale';`,
};

type Size = { eager: number; lazy: number };
type Baseline = { consumers: Record<string, Size>; css: number };

const gzip = (code: string | Uint8Array) => gzipSync(code, { level: 9 }).length;

async function measure(source: string, directory: string): Promise<Size> {
  const input = join(directory, 'entry.js');
  writeFileSync(input, source);
  const { output } = await build({
    input,
    write: false,
    cwd: packageRoot,
    external: [
      /^react($|\/)/,
      /^react-dom($|\/)/,
      'ai',
      '@ai-sdk/react',
      '@algolia/autocomplete-core',
      'minisearch',
      'react-markdown',
      'remark-gfm',
    ],
    output: { format: 'esm', codeSplitting: true, minify: true },
    // Docspot's chunks start with 'use client' for React Server Components,
    // which plain bundles drop on purpose.
    onLog(level, log, handler) {
      if (log.code !== 'MODULE_LEVEL_DIRECTIVE') handler(level, log);
    },
  });
  const chunks = output.flatMap(chunk =>
    chunk.type === 'chunk' ? [chunk] : []
  );
  const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
  const eager = new Set(chunks.filter(chunk => chunk.isEntry));
  for (const chunk of eager)
    for (const name of chunk.imports) {
      const dependency = byName.get(name);
      if (dependency) eager.add(dependency);
    }
  // Bundlers emit chunks for every import() they see, even unused ones;
  // only chunks the eager code can import count.
  const lazy = new Set<(typeof chunks)[number]>();
  for (const chunk of eager)
    for (const name of chunk.dynamicImports) {
      const dependency = byName.get(name);
      if (dependency && !eager.has(dependency)) lazy.add(dependency);
    }
  for (const chunk of lazy)
    for (const name of [...chunk.imports, ...chunk.dynamicImports]) {
      const dependency = byName.get(name);
      if (dependency && !eager.has(dependency)) lazy.add(dependency);
    }
  const code = (list: Iterable<(typeof chunks)[number]>) =>
    [...list].map(chunk => chunk.code).join('\n');
  return {
    eager: gzip(code(eager)),
    lazy: lazy.size ? gzip(code(lazy)) : 0,
  };
}

const kB = (bytes: number) => `${(bytes / 1000).toFixed(2)} kB`;
function change(current: number, previous: number | undefined) {
  if (previous === undefined) return 'new';
  const delta = current - previous;
  if (!delta) return '';
  const percent = previous
    ? ` (${((delta / previous) * 100).toFixed(1)}%)`
    : '';
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} B${percent}`;
}

const baseline: Baseline = updating
  ? { consumers: {}, css: 0 }
  : (JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline);

// Inside the package, so `docspot` resolves to the build through its exports.
const directory = mkdtempSync(join(packageRoot, 'node_modules', '.size-'));
const current: Baseline = { consumers: {}, css: 0 };
try {
  for (const [name, source] of Object.entries(consumers))
    current.consumers[name] = await measure(source, directory);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
current.css = gzip(readFileSync(join(packageRoot, 'dist', 'styles.css')));

const rows: string[][] = [];
const failures: string[] = [];
function compare(label: string, size: number, previous: number | undefined) {
  rows.push([label, kB(size), change(size, previous)]);
  if (previous === undefined) failures.push(`${label}: missing baseline`);
  else if (size > previous + tolerance(previous))
    failures.push(`${label}: ${kB(size)}, baseline ${kB(previous)}`);
}
for (const [name, size] of Object.entries(current.consumers)) {
  const previous = baseline.consumers[name];
  compare(`${name}, eager`, size.eager, previous?.eager);
  if (size.lazy || previous?.lazy || previous?.lazy === undefined)
    compare(`${name}, lazy`, size.lazy, previous?.lazy);
}
compare('styles.css', current.css, baseline.css);

if (updating) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Recorded ${baselinePath}`);
} else if (markdown) {
  const changed = rows.filter(([, , delta]) => delta);
  console.log(
    changed.length
      ? [
          '| Bundle | Size (gzip) | Change |',
          '| --- | --: | --: |',
          ...changed.map(row => `| ${row.join(' | ')} |`),
        ].join('\n')
      : 'No size changes.'
  );
} else {
  const width = Math.max(...rows.map(([label]) => label!.length));
  for (const [label, size, delta] of rows)
    console.log(`${label!.padEnd(width)}  ${size!.padStart(9)}  ${delta}`);
}

if (failures.length && !updating) {
  console.error(
    `\nBundle size check failed:\n${failures.map(line => `  ${line}`).join('\n')}\n\nIf the change is intended, run \`bun run size --update\` and explain it in the pull request.`
  );
  process.exit(1);
}
