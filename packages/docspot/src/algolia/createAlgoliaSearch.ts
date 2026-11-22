import { createSearch } from '@/search/createSearch';
import { parseHighlightedString, plain } from '@/search/model';
import {
  countContentWords,
  getWords,
  isQuestion,
  shouldPrioritizeChat,
} from '@/search/intent';
import type { DocspotResult, DocspotSearch, HighlightedText } from '@/types';

const HIGHLIGHT_START = '__docspot_highlight__';
const HIGHLIGHT_END = '__/docspot_highlight__';

/** A DocSearch-style record, as the Algolia Crawler produces. */
export type AlgoliaHit = {
  objectID: string;
  url: string;
  content?: string | null;
  type: string;
  hierarchy: Record<string, string | null>;
  _highlightResult?: { hierarchy?: Record<string, { value: string }> };
  _snippetResult?: { content?: { value: string } };
  _rankingInfo?: { words?: number; nbTypos: number };
};

type AlgoliaResponse = { results: Array<{ hits: AlgoliaHit[] }> };

export type AlgoliaSearchOptions = {
  appId: string;
  /** A search-only API key. */
  apiKey: string;
  /** Index names, or index names with extra search parameters. */
  indices: Array<
    string | { indexName: string; params?: Record<string, unknown> }
  >;
  /** Results per index. Defaults to 7. */
  hitsPerPage?: number;
  /** Results per group. Defaults to 7. */
  maxPerGroup?: number;
  /**
   * Adjusts a result made from a record, for example to make its URL
   * relative or to title and place it from the site's own pages. Returning
   * null drops it. Highlights follow the returned text.
   */
  transformResult?: (
    result: DocspotResult,
    context: { hit: AlgoliaHit }
  ) => DocspotResult | null;
};

/** Numbering before a heading, such as "2. ". */
const SECTION_NUMBER = /^\d+\.\s+/;

function stripNumbering(title: string) {
  return title.replace(SECTION_NUMBER, '');
}

function highlight(
  value: string | undefined,
  fallback: string
): HighlightedText {
  return value
    ? parseHighlightedString(value, HIGHLIGHT_START, HIGHLIGHT_END)
    : plain(fallback);
}

function unmark(value: string) {
  return parseHighlightedString(value, HIGHLIGHT_START, HIGHLIGHT_END)
    .map(segment => segment.text)
    .join('');
}

function isCompleteMatch(hit: AlgoliaHit, contentWordCount: number) {
  const ranking = hit._rankingInfo;
  if (ranking?.words === undefined) return false;
  return ranking.nbTypos === 0 && ranking.words >= contentWordCount;
}

const hierarchyLevels = [
  'lvl0',
  'lvl1',
  'lvl2',
  'lvl3',
  'lvl4',
  'lvl5',
  'lvl6',
];

/**
 * Opens a connection to `origin` ahead of a request. Browsers drop unused
 * connections after a few seconds, so each call renews the hint.
 */
function preconnect(origin: string) {
  if (typeof document === 'undefined') return;
  document.head
    .querySelector(`link[rel="preconnect"][href="${origin}"]`)
    ?.remove();
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  // Matches the anonymous CORS requests, which use their own connections.
  link.crossOrigin = 'anonymous';
  document.head.append(link);
}

async function queryAlgolia(
  appId: string,
  apiKey: string,
  body: unknown,
  signal: AbortSignal
): Promise<AlgoliaResponse> {
  const hosts = [
    `${appId}-dsn.algolia.net`,
    `${appId}-1.algolianet.com`,
    `${appId}-2.algolianet.com`,
    `${appId}-3.algolianet.com`,
  ];
  // Credentials in the URL and a form content type make a simple request,
  // which skips the CORS preflight and its round trip.
  const credentials = new URLSearchParams({
    'x-algolia-application-id': appId,
    'x-algolia-api-key': apiKey,
  });
  let lastError: unknown;
  for (const host of hosts) {
    // Network errors and server errors try the next host.
    const response = await fetch(
      `https://${host}/1/indexes/*/queries?${credentials}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: JSON.stringify(body),
        signal,
      }
    ).catch((error: unknown) => {
      if (signal.aborted) throw error;
      lastError = error;
      return null;
    });
    if (!response) continue;
    if (response.ok) return (await response.json()) as AlgoliaResponse;
    lastError = new Error(
      `Algolia search failed with status ${response.status}`
    );
    // Client errors, such as an invalid key, fail the same on every host.
    if (response.status < 500) break;
  }
  throw lastError;
}

/**
 * Searches DocSearch-style Algolia indices: results group by top-level
 * section, keep highlights, and let chat lead for questions they don't
 * answer.
 */
export function createAlgoliaSearch({
  appId,
  apiKey,
  indices,
  hitsPerPage = 7,
  maxPerGroup = 7,
  transformResult = result => result,
}: AlgoliaSearchOptions): DocspotSearch {
  return createSearch(
    async ({ query, signal }) => {
      const question = isQuestion(query);
      const isLongQuery = getWords(query).length >= 3;
      const { results } = await queryAlgolia(
        appId,
        apiKey,
        {
          requests: indices.map(index => ({
            ...(typeof index === 'string'
              ? { indexName: index }
              : {
                  indexName: index.indexName,
                  ...index.params,
                }),
            query,
            ...(question && {
              removeStopWords: ['en'],
              attributeCriteriaComputedByMinProximity: false,
            }),
            ...(isLongQuery && { removeWordsIfNoResults: 'allOptional' }),
            hitsPerPage,
            getRankingInfo: true,
            highlightPreTag: HIGHLIGHT_START,
            highlightPostTag: HIGHLIGHT_END,
            attributesToSnippet: ['content:24'],
            snippetEllipsisText: '…',
          })),
        },
        signal
      );
      const hits = results.flatMap(result => result.hits);
      const counts = new Map<string | undefined, number>();
      const seen = new Set<string>();
      const normalized: DocspotResult[] = [];
      let topHit: AlgoliaHit | undefined;
      for (const hit of hits) {
        const hierarchy = hierarchyLevels.flatMap(level => {
          const title = hit.hierarchy[level];
          return title ? [[level, title] as const] : [];
        });
        const level = hit.type === 'content' ? hierarchy.at(-1)?.[0] : hit.type;
        const title = (level && hit.hierarchy[level]) || hierarchy.at(-1)?.[1];
        if (!title) continue;
        // Marked text by its plain text, to highlight whatever a result shows.
        const highlighted = new Map<string, string>();
        for (const [key, text] of hierarchy) {
          const value = hit._highlightResult?.hierarchy?.[key]?.value;
          if (value)
            highlighted.set(stripNumbering(text), stripNumbering(value));
        }
        const snippet = hit._snippetResult?.content?.value;
        const snippetText = snippet && unmark(snippet);
        if (snippet && snippetText) highlighted.set(snippetText, snippet);
        const result = transformResult(
          {
            url: hit.url,
            title: stripNumbering(title),
            pageTitle: hit.hierarchy.lvl1 ?? title,
            breadcrumb: hierarchy.slice(0, 2).map(([, value]) => value),
            excerpt: snippetText || (hit.content ?? undefined),
            group: hierarchy[0]?.[1],
            type:
              hit.type === 'lvl0' || hit.type === 'lvl1' ? 'page' : 'section',
            data: hit,
          },
          { hit }
        );
        if (!result || seen.has(result.url)) continue;
        const count = counts.get(result.group) ?? 0;
        if (count >= maxPerGroup) continue;
        counts.set(result.group, count + 1);
        seen.add(result.url);
        const mark = (text: string) => highlight(highlighted.get(text), text);
        const excerpt = result.excerpt && highlighted.get(result.excerpt);
        normalized.push({
          ...result,
          highlights: {
            title: mark(result.title),
            breadcrumb: result.breadcrumb?.map(mark),
            excerpt: excerpt ? highlight(excerpt, '') : undefined,
          },
        });
        topHit ??= hit;
      }
      return {
        results: normalized,
        prioritizeChat: shouldPrioritizeChat({
          query,
          pageTitles: normalized.map(
            result => result.pageTitle ?? result.title
          ),
          hasResults: topHit !== undefined,
          hasCompleteMatch:
            topHit !== undefined &&
            isCompleteMatch(topHit, countContentWords(query)),
        }),
      };
    },
    // Opens the connection before the first query needs it.
    { preload: () => preconnect(`https://${appId}-dsn.algolia.net`) }
  );
}
