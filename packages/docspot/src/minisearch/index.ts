import type MiniSearch from 'minisearch';
import type { SearchResult } from 'minisearch';

import { highlightTerms } from '../search/model';
import type {
  DocspotSearch,
  DocspotSearchParams,
  DocspotSearchResult,
} from '../types';

/** What a MiniSearch document becomes in results. */
export type MiniSearchDocument = Omit<
  DocspotSearchResult,
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
  search?: (index: MiniSearch<T>, query: string) => SearchResult[];
  /** Maximum results. Defaults to 10. */
  limit?: number;
  /** Maximum excerpt length in characters. Defaults to 180. */
  excerptLength?: number;
};

function getTermsIn(text: string) {
  return (
    text
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

/** The sentence matching the most terms, trimmed around the first match. */
function createExcerpt(text: string, terms: string[], maxLength = 180) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return '';
  const best = sentences
    .map(sentence => ({
      sentence,
      score: getTermsIn(sentence).filter(term => terms.includes(term)).length,
    }))
    .sort((a, b) => b.score - a.score)[0]!.sentence;
  if (best.length <= maxLength) return best;
  const position = terms.length
    ? best
        .toLowerCase()
        .search(
          new RegExp(
            terms
              .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
              .join('|')
          )
        )
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
  search = (miniSearch, query) => miniSearch.search(query),
  limit = 10,
  excerptLength = 180,
}: MiniSearchSearchOptions<T>): DocspotSearch {
  let loaded: MiniSearch<T> | undefined;
  let loading: Promise<MiniSearch<T>> | undefined;

  function run(
    miniSearch: MiniSearch<T>,
    query: string
  ): DocspotSearchResult[] {
    return search(miniSearch, query)
      .slice(0, limit)
      .map(hit => {
        const { content, ...document } = getDocument(hit);
        // Matched document terms, plus the typed words for prefix matches.
        const terms = [...new Set([...hit.terms, ...getTermsIn(query)])];
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
    return (loading ??= Promise.resolve(index()).then(
      miniSearch => (loaded = miniSearch),
      error => {
        loading = undefined;
        throw error;
      }
    ));
  }

  return Object.assign(
    ({ query }: DocspotSearchParams) => {
      const miniSearch = load();
      return miniSearch instanceof Promise
        ? miniSearch.then(loadedIndex => run(loadedIndex, query))
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
