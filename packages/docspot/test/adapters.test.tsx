import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import MiniSearch from 'minisearch';
import { afterEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, createDocspotUrl } from '@/index';
import { createAlgoliaSearch } from '@/algolia';
import { createAlgoliaChat } from '@/algolia-chat';
import { type MiniSearchHit, createMiniSearchSearch } from '@/minisearch';

afterEach(() => vi.unstubAllGlobals());

const H = (text: string) =>
  `__docspot_highlight__${text}__/docspot_highlight__`;

const hits = [
  {
    objectID: 'sql',
    url: 'https://altertable.ai/docs/lakehouse/query/sql-explorer#example',
    type: 'lvl2',
    hierarchy: { lvl0: 'Lakehouse', lvl1: 'SQL Explorer', lvl2: '1. Example' },
    content: 'Join product usage to account data.',
    _highlightResult: {
      hierarchy: {
        lvl0: { value: H('Lakehouse') },
        lvl2: { value: `1. ${H('Example')}` },
      },
    },
    _snippetResult: { content: { value: `Join ${H('product')} usage…` } },
    _rankingInfo: { words: 1, nbTypos: 0 },
  },
  {
    objectID: 'sql-duplicate',
    url: 'https://altertable.ai/docs/lakehouse/query/sql-explorer#example',
    type: 'content',
    hierarchy: { lvl0: 'Lakehouse', lvl1: 'SQL Explorer', lvl2: 'Example' },
    content: 'Duplicate',
  },
  {
    objectID: 'api',
    url: 'https://altertable.ai/docs/lakehouse/query/http-api',
    type: 'lvl1',
    hierarchy: { lvl0: 'Lakehouse', lvl1: 'HTTP API' },
    content: 'Run a SQL query over HTTP.',
  },
  {
    objectID: 'external',
    url: 'https://example.com/elsewhere',
    type: 'lvl1',
    hierarchy: { lvl0: 'Elsewhere', lvl1: 'Elsewhere' },
  },
];

function stubAlgolia(responses: Array<Response | Error>) {
  const requests: Array<{
    url: string;
    headers: Headers;
    body: { requests: Array<Record<string, unknown>> };
  }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({
        url,
        headers: new Headers(init.headers),
        body: JSON.parse(init.body as string),
      });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next ?? Response.json({ results: [{ hits }] });
    })
  );
  return requests;
}

const algolia = createAlgoliaSearch({
  appId: 'APP',
  apiKey: 'KEY',
  indices: ['Docs'],
  transformResult: result => {
    if (!result.url.startsWith('https://altertable.ai/')) return null;
    const url = result.url.slice('https://altertable.ai'.length);
    return url.startsWith('/docs/lakehouse/query/sql-explorer')
      ? { ...result, url, breadcrumb: ['Lakehouse', 'Query', 'SQL Explorer'] }
      : { ...result, url };
  },
});

async function searchAlgolia(query: string) {
  const response = await algolia({
    query,
    signal: new AbortController().signal,
  });
  if (Array.isArray(response)) throw new Error('Expected a response object');
  return response;
}

it('normalizes Algolia records into grouped, highlighted, deduplicated results', async () => {
  const requests = stubAlgolia([]);
  const { results, prioritizeChat } = await searchAlgolia('example');
  expect(requests[0]?.url).toBe(
    'https://APP-dsn.algolia.net/1/indexes/*/queries?x-algolia-application-id=APP&x-algolia-api-key=KEY'
  );
  // A simple request: no custom headers, so no CORS preflight.
  expect([...requests[0]!.headers]).toEqual([
    ['content-type', 'application/x-www-form-urlencoded'],
  ]);
  expect(requests[0]?.body.requests[0]).toMatchObject({
    indexName: 'Docs',
    query: 'example',
    hitsPerPage: 7,
  });
  expect(results.map(result => result.url)).toEqual([
    '/docs/lakehouse/query/sql-explorer#example',
    '/docs/lakehouse/query/http-api',
  ]);
  expect(results[0]).toMatchObject({
    title: 'Example',
    pageTitle: 'SQL Explorer',
    breadcrumb: ['Lakehouse', 'Query', 'SQL Explorer'],
    group: 'Lakehouse',
    type: 'section',
    excerpt: 'Join product usage…',
  });
  expect(results[0]?.highlights?.title).toEqual([
    { text: 'Example', highlighted: true },
  ]);
  expect(results[0]?.highlights?.breadcrumb?.[0]).toEqual([
    { text: 'Lakehouse', highlighted: true },
  ]);
  expect(results[0]?.highlights?.excerpt).toEqual([
    { text: 'Join ', highlighted: false },
    { text: 'product', highlighted: true },
    { text: ' usage…', highlighted: false },
  ]);
  expect(results[1]).toMatchObject({
    title: 'HTTP API',
    type: 'page',
    group: 'Lakehouse',
  });
  expect(prioritizeChat).toBe(false);
});

it('prioritizes chat for questions the results do not answer', async () => {
  const requests = stubAlgolia([Response.json({ results: [{ hits: [] }] })]);
  expect(
    (await searchAlgolia('how do I join product usage with accounts?'))
      .prioritizeChat
  ).toBe(true);
  expect(requests[0]?.body.requests[0]).toMatchObject({
    removeStopWords: ['en'],
    removeWordsIfNoResults: 'allOptional',
  });
  stubAlgolia([]);
  // Naming a page is a navigation, not a question.
  expect((await searchAlgolia('what is the sql explorer')).prioritizeChat).toBe(
    false
  );
});

it('uses the returned result order for chat priority and hierarchy', async () => {
  const search = createAlgoliaSearch({
    appId: 'APP',
    apiKey: 'KEY',
    indices: ['Docs'],
    transformResult: (result, { hit }) =>
      hit.objectID === 'filtered' ? null : { ...result, url: '/guide' },
  });
  stubAlgolia([
    Response.json({
      results: [
        {
          hits: [
            {
              objectID: 'filtered',
              url: 'https://example.com/filtered',
              type: 'lvl1',
              hierarchy: { lvl0: 'Guides', lvl1: 'Complete answer' },
              _rankingInfo: { words: 2, nbTypos: 0 },
            },
            {
              objectID: 'shown',
              url: 'https://example.com/guide',
              type: 'content',
              hierarchy: {
                lvl2: 'Details',
                lvl0: 'Guides',
                lvl1: 'Setup',
              },
              _rankingInfo: { words: 1, nbTypos: 0 },
            },
          ],
        },
      ],
    }),
  ]);
  const response = await search({
    query: 'how do I configure agents?',
    signal: new AbortController().signal,
  });
  if (Array.isArray(response)) throw new Error('Expected a response object');
  expect(response.results[0]).toMatchObject({
    title: 'Details',
    group: 'Guides',
    breadcrumb: ['Guides', 'Setup'],
  });
  expect(response.prioritizeChat).toBe(true);
});

it('opens the Algolia connection when preloaded', () => {
  algolia.preload?.();
  algolia.preload?.();
  const links = document.head.querySelectorAll('link[rel="preconnect"]');
  expect(links).toHaveLength(1);
  expect(links[0]).toMatchObject({
    href: 'https://app-dsn.algolia.net/',
    crossOrigin: 'anonymous',
  });
});

it('retries other hosts on server errors but not on client errors', async () => {
  const requests = stubAlgolia([
    new TypeError('network'),
    new Response('', { status: 503 }),
  ]);
  expect((await searchAlgolia('example')).results).toHaveLength(2);
  expect(requests.map(request => new URL(request.url).host)).toEqual([
    'app-dsn.algolia.net',
    'app-1.algolianet.com',
    'app-2.algolianet.com',
  ]);
  const failing = stubAlgolia([new Response('', { status: 403 })]);
  await expect(searchAlgolia('example')).rejects.toThrow('status 403');
  expect(failing).toHaveLength(1);
});

it('maps attached page content into the Algolia agent request', async () => {
  const requests: Array<{ url: string; headers: Headers; body: any }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({
        url,
        headers: new Headers(init.headers),
        body: JSON.parse(init.body as string),
      });
      const stream = createUIMessageStream({
        execute({ writer }) {
          writer.write({ type: 'start' });
          writer.write({ type: 'start-step' });
          writer.write({ type: 'text-start', id: 't' });
          writer.write({
            type: 'text-delta',
            id: 't',
            delta: 'Use the margin option.',
          });
          writer.write({ type: 'text-end', id: 't' });
          writer.write({ type: 'finish-step' });
          writer.write({ type: 'finish' });
        },
      });
      return createUIMessageStreamResponse({ stream });
    })
  );
  const chat = createAlgoliaChat({
    appId: 'APP',
    apiKey: 'KEY',
    agentId: 'agent',
    indices: ['Docs_markdown'],
  });
  await render(
    <Docspot
      chat={chat}
      context={{ page: { url: '/docs/options', title: 'Options' } }}
      loadPage={async () => '# Options\nmargin: number'}
    />
  );
  await page.getByRole('button', { name: 'Ask AI' }).first().click();
  const panel = page.getByRole('complementary', { name: 'Ask AI' });
  await expect.element(panel.getByRole('textbox')).toHaveFocus();
  await userEvent.keyboard('How do I add space?{Enter}');
  await expect.element(panel.getByText('Use the margin option.')).toBeVisible();

  const request = requests[0]!;
  expect(request.url).toBe(
    'https://APP.algolia.net/agent-studio/1/agents/agent/completions?compatibilityMode=ai-sdk-5&stream=true'
  );
  expect(request.headers.get('X-Algolia-API-Key')).toBe('KEY');
  expect(request.body.algolia).toEqual({ indices: ['Docs_markdown'] });
  expect(request.body.docspot).toBeUndefined();
  const sent = request.body.messages.at(-1).parts[0].text as string;
  expect(sent).toContain('How do I add space?\n\nDocumentation context');
  expect(sent).toContain(`URL: ${location.origin}/docs/options`);
  expect(sent).toContain(
    '<documentation>\n# Options\nmargin: number\n</documentation>'
  );
  // The conversation shows the question as typed.
  await expect
    .element(panel.getByText('How do I add space?', { exact: true }).last())
    .toBeVisible();
});

type Doc = { id: string; title: string; section: string; content: string };
const docs: Doc[] = [
  {
    id: '/docs/options#margin',
    title: 'margin',
    section: 'Options',
    content: 'The space outside the zoomed image. Defaults to 0.',
  },
  {
    id: '/docs/options#background',
    title: 'background',
    section: 'Options',
    content: 'The color of the overlay.',
  },
  {
    id: '/docs/methods#open',
    title: 'open()',
    section: 'Methods',
    content: 'Opens the zoom.',
  },
];

function createIndex() {
  const index = new MiniSearch<Doc>({
    fields: ['title', 'content'],
    storeFields: ['title', 'section', 'content'],
  });
  index.addAll(docs);
  return index;
}

const getDocument = (hit: MiniSearchHit<Doc>) => ({
  url: hit.id,
  title: hit.title,
  breadcrumb: [hit.section],
  group: hit.section,
  content: hit.content,
});

it('searches a MiniSearch index synchronously with highlights and excerpts', () => {
  const search = createMiniSearchSearch({ index: createIndex(), getDocument });
  // Hits are typed as the index's documents.
  createMiniSearchSearch({
    index: createIndex(),
    getDocument: hit => ({
      url: hit.id,
      // @ts-expect-error Doc has no `heading`.
      title: hit.heading,
    }),
  });
  const results = search({
    query: 'zoomed space',
    signal: new AbortController().signal,
  });
  if (!Array.isArray(results)) throw new Error('Expected synchronous results');
  expect(results[0]).toMatchObject({
    url: '/docs/options#margin',
    group: 'Options',
    excerpt: 'The space outside the zoomed image.',
  });
  expect(results[0]?.highlights?.excerpt).toEqual([
    { text: 'The ', highlighted: false },
    { text: 'space', highlighted: true },
    { text: ' outside the ', highlighted: false },
    { text: 'zoomed', highlighted: true },
    { text: ' image.', highlighted: false },
  ]);
});

it('loads a MiniSearch index on the first search', async () => {
  const load = vi.fn(async () => createIndex());
  const search = createMiniSearchSearch({
    index: load,
    getDocument,
    search: ({ index, query }) => index.search(query, { prefix: true }),
  });
  const signal = new AbortController().signal;
  const first = await search({ query: 'backgr', signal });
  // The matched document term is marked, not only the typed prefix.
  expect(Array.isArray(first) && first[0]?.highlights?.title).toEqual([
    { text: 'background', highlighted: true },
  ]);
  await search({ query: 'open', signal });
  expect(load).toHaveBeenCalledTimes(1);
});

it('skips a superseded query while the MiniSearch index loads', async () => {
  const index = createIndex();
  const runQuery = vi.spyOn(index, 'search');
  const search = createMiniSearchSearch({
    index: async () => index,
    getDocument,
  });
  const first = new AbortController();
  const stale = search({ query: 'old', signal: first.signal });
  first.abort();
  const latest = search({
    query: 'zoom',
    signal: new AbortController().signal,
  });
  await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
  await latest;
  expect(runQuery.mock.calls.map(([query]) => query)).toEqual(['zoom']);
});

it('loads a MiniSearch index ahead of the first search when preloaded', async () => {
  let index: ReturnType<typeof createIndex> | undefined;
  const search = createMiniSearchSearch({
    index: async () => (index = createIndex()),
    getDocument,
  });
  search.preload?.();
  await vi.waitFor(() => expect(index).toBeDefined());
  // The first search no longer waits for the index.
  const results = search({
    query: 'margin',
    signal: new AbortController().signal,
  });
  expect(Array.isArray(results) && results[0]?.url).toBe(
    '/docs/options#margin'
  );
});

it('builds links that open search or chat, keeping other parameters', () => {
  expect(createDocspotUrl('/docs?tab=react', { search: 'zoom' })).toBe(
    '/docs?tab=react&q=zoom'
  );
  expect(
    createDocspotUrl('https://example.com/docs#top', {
      prompt: 'How?',
      askPage: '/docs/options',
    })
  ).toBe(
    'https://example.com/docs?prompt=How%3F&askPage=%2Fdocs%2Foptions#top'
  );
  expect(createDocspotUrl('?q=old', { draft: 'Edit me' })).toBe(
    '?draft=Edit+me'
  );
  expect(
    createDocspotUrl('../guide?lang=en#topic?q=old', { search: 'x' })
  ).toBe('../guide?lang=en&q=x#topic?q=old');
  expect(createDocspotUrl('//docs.example/guide', { search: 'x' })).toBe(
    '//docs.example/guide?q=x'
  );
  expect(createDocspotUrl('guide', { search: 'x' })).toBe('guide?q=x');
});
