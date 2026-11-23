import type { DocspotPage } from '@/types';

/** The questions to offer for a page: its own, or the defaults. */
export function getSuggestions(
  page: DocspotPage | undefined,
  suggestions: string[]
) {
  return page?.suggestions?.length ? page.suggestions : suggestions;
}
