import type {
  DocspotSearch,
  DocspotSearchParams,
  DocspotSearchResponse,
} from '@/types';

export type CreateSearchOptions = {
  /**
   * Gets ready for the first query, for example by loading an index or
   * opening a connection. Docspot calls it once the page is idle, when a
   * trigger is hovered or focused, and when search opens.
   */
  preload?: () => void;
};

/**
 * Configures search from a function that returns results for a query, or
 * `{ results, prioritizeChat }`. It receives an `AbortSignal` that aborts
 * when the query changes, and may return synchronously.
 */
export function createSearch(
  search: (
    params: DocspotSearchParams
  ) => DocspotSearchResponse | Promise<DocspotSearchResponse>,
  { preload }: CreateSearchOptions = {}
): DocspotSearch {
  const created: DocspotSearch = params => search(params);
  if (preload) created.preload = preload;
  return created;
}
