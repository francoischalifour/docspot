import type MiniSearch from 'minisearch';
import type { SearchResult } from 'minisearch';

import { createSearch } from '@/search/createSearch';
import { highlightTerms } from '@/search/model';
import {
  COMBINING_MARKS,
  WORD,
  cachedRegExp,
  escapeRegExp,
} from '@/search/text';
import type { DocspotResult, DocspotSearch } from '@/types';

/** What a MiniSearch document becomes in results: a page. */
export type MiniSearchDocument = Omit<
  DocspotResult,
  'highlights' | 'excerpt'
> & {
  /** Text to take the excerpt from: the passage that best matches. */
  content?: string;
};

export type MiniSearchSearchOptions<T> = {
  /** The index, or a function that loads it on the first search. */
  index: MiniSearch<T> | (() => MiniSearch<T> | Promise<MiniSearch<T>>);
  /** Maps a hit, with its stored fields, to a result. */
  getDocument: (hit: SearchResult) => MiniSearchDocument;
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
  const position = terms.length
    ? best
        .toLowerCase()
        .search(cachedRegExp(terms.map(escapeRegExp).join('|'), 'u'))
    : 0;
  const offset = Math.max(0, position - Math.floor(maxLength / 3));
  const start = offset ? best.lastIndexOf(' ', offset) + 1 : 0;
  const end = best.lastIndexOf(' ', start + maxLength - 3);
  return `${start ? '…' : ''}${best.slice(start, end > start ? end : start + maxLength - 3)}…`;
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
  let loaded: MiniSearch<T> | undefined;
  let loading: Promise<MiniSearch<T>> | undefined;

  function run(miniSearch: MiniSearch<T>, query: string): DocspotResult[] {
    const queryTerms = getTermsIn(query);
    return search({ index: miniSearch, query })
      .slice(0, limit)
      .map(hit => {
        const { content, ...document } = getDocument(hit);
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
    if (loaded) return loaded;
    if (typeof index !== 'function') return (loaded = index);
    return (loading ??= Promise.resolve()
      .then(index)
      .then(
        miniSearch => (loaded = miniSearch),
        (error: unknown) => {
          loading = undefined;
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
