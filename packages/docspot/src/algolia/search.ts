import { parseHighlightedString, plain } from '../search/model';
import {
  countContentWords,
  getWords,
  isQuestion,
  shouldPrioritizeChat,
} from '../search/intent';
import type { DocspotSearch, DocspotLinkItem, HighlightedText } from '../types';

const HIGHLIGHT_START = '__docspot_highlight__';
const HIGHLIGHT_END = '__/docspot_highlight__';

/** A DocSearch-style record, as the Algolia Crawler produces. */
type AlgoliaHit = {
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

/** What the site knows about a page, to title and place its results. */
export type AlgoliaPageInfo = {
  title: string;
  /** Titles from the top level down, ending with the page's own title. */
  hierarchy: string[];
  description?: string;
};

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
   * Turns a record's URL into the site's URL, for example to make it
   * relative or to follow redirects. Returning null drops the record.
   */
  mapUrl?: (url: string) => string | null;
  /** Describes the page at a mapped URL, when the site knows it. */
  getPage?: (url: string) => AlgoliaPageInfo | undefined;
  /** Groups results without page information. Defaults to "Documentation". */
  fallbackGroup?: string;
};

function stripNumbering(title: string) {
  return title.replace(/^\d+\.\s+/, '');
}

function highlight(
  value: string | undefined,
  fallback: string
): HighlightedText {
  return value
    ? parseHighlightedString(value, HIGHLIGHT_START, HIGHLIGHT_END)
    : plain(fallback);
}

function isCompleteMatch(hit: AlgoliaHit, contentWordCount: number) {
  const ranking = hit._rankingInfo;
  if (ranking?.words === undefined) return false;
  return ranking.nbTypos === 0 && ranking.words >= contentWordCount;
}

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
    ).catch(error => {
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
  mapUrl = url => url,
  getPage,
  fallbackGroup = 'Documentation',
}: AlgoliaSearchOptions): DocspotSearch {
  const search: DocspotSearch = async ({ query, signal }) => {
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
    const counts = new Map<string, number>();
    const seen = new Set<string>();
    const normalized: DocspotLinkItem[] = [];
    for (const hit of hits) {
      const url = mapUrl(hit.url);
      if (!url || seen.has(url)) continue;
      const page = getPage?.(url);
      const hierarchy = Object.entries(hit.hierarchy).filter(
        (entry): entry is [string, string] => Boolean(entry[1])
      );
      const level = hit.type === 'content' ? hierarchy.at(-1)?.[0] : hit.type;
      const title =
        (level && hit.hierarchy[level]) || page?.title || hierarchy.at(-1)?.[1];
      if (!title) continue;
      const parts =
        page?.hierarchy ?? hierarchy.slice(0, 2).map(([, value]) => value);
      const highlightedByText = new Map(
        hierarchy.map(([key, text]) => [
          text,
          hit._highlightResult?.hierarchy?.[key]?.value,
        ])
      );
      const breadcrumb = [
        ...parts,
        ...(title !== page?.title ? [title] : []),
      ].slice(0, -1);
      const group = parts[0] ?? fallbackGroup;
      const count = counts.get(group) ?? 0;
      if (count >= maxPerGroup) continue;
      counts.set(group, count + 1);
      seen.add(url);
      const snippet = hit._snippetResult?.content?.value;
      normalized.push({
        id: hit.objectID,
        action: url,
        title: stripNumbering(title),
        pageTitle: page?.title ?? hit.hierarchy.lvl1 ?? title,
        breadcrumb,
        excerpt: snippet
          ? parseHighlightedString(snippet, HIGHLIGHT_START, HIGHLIGHT_END)
              .map(segment => segment.text)
              .join('')
          : (hit.content ?? page?.description ?? undefined),
        group,
        type: hit.type === 'lvl0' || hit.type === 'lvl1' ? 'page' : 'section',
        highlights: {
          title: highlight(
            level && hit._highlightResult?.hierarchy?.[level]?.value
              ? stripNumbering(hit._highlightResult.hierarchy[level].value)
              : undefined,
            stripNumbering(title)
          ),
          breadcrumb: breadcrumb.map(part =>
            highlight(highlightedByText.get(part), part)
          ),
          excerpt: snippet
            ? parseHighlightedString(snippet, HIGHLIGHT_START, HIGHLIGHT_END)
            : undefined,
        },
        data: hit,
      });
    }
    const topHit = hits[0];
    return {
      items: normalized,
      prioritizeChat: shouldPrioritizeChat({
        query,
        pageTitles: normalized.map(item => item.pageTitle ?? item.title),
        hasResults: topHit !== undefined,
        hasCompleteMatch:
          topHit !== undefined &&
          isCompleteMatch(topHit, countContentWords(query)),
      }),
    };
  };
  search.preload = () => preconnect(`https://${appId}-dsn.algolia.net`);
  return search;
}
