import type MiniSearch from 'minisearch';
import type { SearchResult } from 'minisearch';

import { createSearch } from '@/search/createSearch';
import { highlightTerms } from '@/search/model';
import { COMBINING_MARKS, WORD } from '@/search/text';
import type { DocspotResult, DocspotSearch } from '@/types';

/** What a MiniSearch document becomes in results: a page. */
export type MiniSearchDocument = Omit<
  DocspotResult,
  'highlights' | 'excerpt'
> & {
  /** Text to take the excerpt from: the passage that best matches. */
  content?: string;
};

/**
 * A hit: how it matched, and the document's stored fields, typed as the
 * index's documents. Store the fields `getDocument` reads.
 */
export type MiniSearchHit<T> = Pick<
  SearchResult,
  'terms' | 'queryTerms' | 'score' | 'match'
> & { id: unknown } & T;

export type MiniSearchSearchOptions<T> = {
  /** The index, or a function that loads it on the first search. */
  index: MiniSearch<T> | (() => MiniSearch<T> | Promise<MiniSearch<T>>);
  /** Maps a hit, with its stored fields, to a result. */
  getDocument: (hit: MiniSearchHit<T>) => MiniSearchDocument;
  /** Runs the query. Defaults to `index.search(query)`. */
  search?: (params: { index: MiniSearch<T>; query: string }) => SearchResult[];
  /** Maximum results. Defaults to 10. */
  limit?: number;
  /** Maximum excerpt length in characters. Defaults to 180. */
  excerptLength?: number;
};

/** Where one sentence ends and the next begins. */
const SENTENCE_BREAK = /(?<=[.!?])\s+/;

function getTermsIn(text: string) {
  return (
    text
      .normalize('NFKD')
      .replace(COMBINING_MARKS, '')
      .toLowerCase()
      .match(WORD) ?? []
  );
}

/** The sentence matching the most terms, trimmed around the first match. */
function createExcerpt(text: string, terms: string[], maxLength = 180) {
  if (maxLength <= 0) return '';
  const termSet = new Set(terms);
  let best = '';
  let bestScore = -1;
  for (const sentence of text.split(SENTENCE_BREAK)) {
    const score = getTermsIn(sentence).filter(term => termSet.has(term)).length;
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  }
  if (best.length <= maxLength) return best;
  let position = 0;
  for (const segment of highlightTerms(best, terms)) {
    if (segment.highlighted) break;
    position += segment.text.length;
  }
  if (position === best.length) position = 0;
  const offset = Math.max(0, position - Math.floor(maxLength / 3));
  const wordStart = best.lastIndexOf(' ', offset) + 1;
  const start = position - wordStart < maxLength - 2 ? wordStart : offset;
  const prefix = start ? '…' : '';
  const limit = start + maxLength - prefix.length;
  if (limit >= best.length) return prefix + best.slice(start);
  const end = best.lastIndexOf(' ', limit - 1);
  if (maxLength === 1) return '…';
  return prefix + best.slice(start, end > position ? end : limit - 1) + '…';
}

/**
 * Searches a MiniSearch index in the browser, without a backend. Matched
 * terms are highlighted in titles, breadcrumbs, and excerpts.
 */
export function createMiniSearchSearch<T>({
  index,
  getDocument,
  search = ({ index, query }) => index.search(query),
  limit = 10,
  excerptLength = 180,
}: MiniSearchSearchOptions<T>): DocspotSearch {
  let cached: MiniSearch<T> | Promise<MiniSearch<T>> | undefined;

  function run(miniSearch: MiniSearch<T>, query: string): DocspotResult[] {
    const queryTerms = getTermsIn(query);
    return search({ index: miniSearch, query })
      .slice(0, limit)
      .map(hit => {
        // MiniSearch types stored fields loosely; they are the documents'.
        const { content, ...document } = getDocument(hit as MiniSearchHit<T>);
        // Matched document terms, plus the typed words for prefix matches.
        const terms = [...new Set([...hit.terms, ...queryTerms])];
        const excerpt = content
          ? createExcerpt(content, terms, excerptLength)
          : undefined;
        return {
          ...document,
          excerpt,
          highlights: {
            title: highlightTerms(document.title, terms),
            breadcrumb: document.breadcrumb?.map(part =>
              highlightTerms(part, terms)
            ),
            excerpt: excerpt ? highlightTerms(excerpt, terms) : undefined,
          },
        };
      });
  }

  function load(): MiniSearch<T> | Promise<MiniSearch<T>> {
    if (typeof index !== 'function') return index;
    return (cached ??= Promise.resolve()
      .then(index)
      .then(
        miniSearch => (cached = miniSearch),
        (error: unknown) => {
          cached = undefined;
          throw error;
        }
      ));
  }

  return createSearch(
    ({ query, signal }) => {
      signal.throwIfAborted();
      const miniSearch = load();
      return miniSearch instanceof Promise
        ? miniSearch.then(loadedIndex => {
            signal.throwIfAborted();
            return run(loadedIndex, query);
          })
        : run(miniSearch, query);
    },
    {
      // Loads and builds the index before the first query needs it.
      preload() {
        const miniSearch = load();
        if (miniSearch instanceof Promise) miniSearch.catch(() => {});
      },
    }
  );
}
