import type { DocspotItem, DocspotResult } from '@/types';

/**
 * Marks where the reader's recent pages go in `defaultItems`. Without it,
 * they come first.
 */
export const recentItems: unique symbol = /* @__PURE__ */ Symbol.for(
  'docspot.recentItems'
);

export function isResult(
  entry: DocspotResult | DocspotItem
): entry is DocspotResult {
  return 'url' in entry;
}
