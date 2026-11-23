/**
 * Render benchmark: the React work fixed interactions cost, compared with
 * `baselines/bench.json`.
 *
 *   bun run bench           Print every workload and fail when a count grows.
 *   bun run bench --update  Record the current counts as the baseline.
 *
 * Commits and component renders follow from what the code does, so they are
 * compared. Durations follow from the machine, so they are only printed.
 * Each workload runs several times in a fresh render; the median counts.
 */
import { Profiler, type ReactNode } from 'react';
import { afterAll, expect, inject, it, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-react';

import { Docspot, type DocspotResult, createSearch, useDocspot } from '@/index';
import { createChatServer } from '@test/fixtures';

type Counts = { commits: number; renders: number };
type Measure = Counts & { ms: number };

declare global {
  interface Window {
    docspotBench: { reset: () => void; read: () => Counts };
  }
}
declare module 'vitest' {
  interface ProvidedContext {
    updateBaseline: boolean;
  }
}

const RUNS = 3;
// Relative to the package root.
const BASELINE = 'baselines/bench.json';
const REPORT = 'node_modules/.bench/report.txt';
/** Counts may grow this much before the benchmark fails. */
const tolerance = (count: number) => Math.max(2, Math.ceil(count * 0.1));

const results: Record<string, Measure> = {};
let duration = 0;

function Measured({ children }: { children: ReactNode }) {
  return (
    <Profiler
      id="bench"
      onRender={(_id, _phase, actual) => {
        duration += actual;
      }}
    >
      {children}
    </Profiler>
  );
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

/** Runs `setup`, then measures only `interact`. */
async function workload(
  name: string,
  setup: () => Promise<void>,
  interact: () => Promise<void>
) {
  const runs: Measure[] = [];
  for (let run = 0; run < RUNS; run++) {
    await setup();
    window.docspotBench.reset();
    duration = 0;
    await interact();
    runs.push({ ...window.docspotBench.read(), ms: duration });
    await cleanup();
    localStorage.clear();
  }
  results[name] = {
    commits: median(runs.map(run => run.commits)),
    renders: median(runs.map(run => run.renders)),
    ms: median(runs.map(run => run.ms)),
  };
}

const manyResults: DocspotResult[] = Array.from({ length: 30 }, (_, index) => ({
  url: `/docs/page-${index}#section`,
  title: `Result ${index} about search`,
  group: `Group ${index % 4}`,
  breadcrumb: ['Docs', `Section ${index}`],
  excerpt: `An excerpt about search and more words ${index}.`,
  type: 'section',
}));
const longAnswer = `# Answer\n\n${Array.from(
  { length: 30 },
  (_, index) =>
    `- **Item ${index}** with \`code\` and [a link](/docs/${index}).`
).join('\n')}`;

const searchInput = () => page.getByRole('combobox');
const panel = () => page.getByRole('complementary', { name: 'Ask AI' });

async function openSearch() {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  await render(
    <Measured>
      <Docspot search={createSearch(() => manyResults)} chat={chat} />
    </Measured>
  );
  await page.getByRole('button', { name: 'Search or ask docs' }).click();
  await expect.element(searchInput()).toHaveFocus();
}

async function chatWithAnswers(count: number) {
  const { chat } = createChatServer(() => ({ text: longAnswer }));
  await render(
    <Measured>
      <Docspot chat={chat} />
    </Measured>
  );
  await page.getByRole('button', { name: 'Ask AI' }).first().click();
  await expect.element(panel().getByRole('textbox')).toHaveFocus();
  for (let index = 0; index < count; index++) {
    await userEvent.keyboard(`Question ${index}{Enter}`);
    await expect
      .element(panel().getByRole('button', { name: 'Copy answer' }).nth(index))
      .toBeInTheDocument();
  }
  // Settled once every answer shows when it finished.
  await vi.waitFor(() =>
    expect(panel().element().querySelectorAll('time')).toHaveLength(count * 2)
  );
  await new Promise(requestAnimationFrame);
}

it('search: open', async () => {
  await workload(
    'search: open',
    async () => {
      await render(
        <Measured>
          <Docspot search={createSearch(() => manyResults)} />
        </Measured>
      );
    },
    async () => {
      await page.getByRole('button', { name: 'Search docs' }).click();
      await expect.element(searchInput()).toHaveFocus();
    }
  );
});

it('search: open with a query over 30 results', async () => {
  function OpenWithQuery() {
    const { openSearch } = useDocspot();
    return (
      <button type="button" onClick={() => openSearch('search words')}>
        Open with a query
      </button>
    );
  }
  await workload(
    'search: open with a query over 30 results',
    async () => {
      await render(
        <Measured>
          <Docspot.Root search={createSearch(() => manyResults)}>
            <OpenWithQuery />
            <Docspot.SearchDialog />
          </Docspot.Root>
        </Measured>
      );
    },
    async () => {
      await page.getByRole('button', { name: 'Open with a query' }).click();
      await expect
        .element(page.getByRole('option').nth(20))
        .toBeInTheDocument();
    }
  );
});

it('search: type a query over 30 results', async () => {
  await workload(
    'search: type a query over 30 results',
    openSearch,
    async () => {
      await userEvent.keyboard('search words');
      await expect
        .element(page.getByRole('option').nth(20))
        .toBeInTheDocument();
    }
  );
});

it('search: arrow through 20 results', async () => {
  await workload(
    'search: arrow through 20 results',
    async () => {
      await openSearch();
      await userEvent.keyboard('search');
      await expect
        .element(page.getByRole('option').nth(20))
        .toBeInTheDocument();
    },
    async () => {
      await userEvent.keyboard('{ArrowDown>20/}');
    }
  );
});

it('chat: type 20 characters after 8 answers', async () => {
  await workload(
    'chat: type 20 characters after 8 answers',
    () => chatWithAnswers(8),
    async () => {
      await userEvent.keyboard('abcdefghijklmnopqrst');
    }
  );
});

afterAll(async () => {
  const update = inject('updateBaseline');
  const baseline: Record<string, Counts> = update
    ? {}
    : JSON.parse(await commands.readFile(BASELINE));
  const failures: string[] = [];
  const lines: string[] = [];
  for (const [name, measure] of Object.entries(results)) {
    const previous = baseline[name];
    const notes: string[] = [];
    for (const key of ['commits', 'renders'] as const) {
      const before = previous?.[key];
      if (before === undefined)
        failures.push(`${name}: missing ${key} baseline`);
      else if (measure[key] > before + tolerance(before))
        failures.push(`${name}: ${key} ${measure[key]}, baseline ${before}`);
      if (before !== undefined && measure[key] !== before)
        notes.push(`${key} ${before} → ${measure[key]}`);
    }
    lines.push(
      `${name}: ${measure.commits} commits, ${measure.renders} renders, ${measure.ms.toFixed(1)} ms${notes.length ? ` (${notes.join(', ')})` : ''}`
    );
  }
  // Browser consoles don't reach the terminal; scripts/bench.ts prints this.
  await commands.writeFile(REPORT, `${lines.join('\n')}\n`);
  if (update) {
    const recorded = Object.fromEntries(
      Object.entries(results).map(([name, { commits, renders }]) => [
        name,
        { commits, renders },
      ])
    );
    await commands.writeFile(
      BASELINE,
      `${JSON.stringify(recorded, null, 2)}\n`
    );
    return;
  }
  if (failures.length)
    throw new Error(
      `Render benchmark failed:\n${failures.join('\n')}\n\nIf the change is intended, run \`bun run bench --update\` and explain it in the pull request.`
    );
});
