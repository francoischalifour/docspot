import { createContext, use } from 'react';

import type { SearchApi } from '@/search/useSearch';

export const SearchContext = /* @__PURE__ */ createContext<SearchApi | null>(
  null
);

/** The search a part belongs to. */
export function useSearchContext(part: string): SearchApi {
  const search = use(SearchContext);
  if (!search) throw new Error(`Docspot: <${part}> must be inside search.`);
  return search;
}
