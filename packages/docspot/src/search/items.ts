import type { DocspotItem, DocspotResult } from '@/types';

/**
 * Marks where the reader's recent pages go in `defaultItems`. Without it,
 * they come first.
 */
export const recentItems: unique symbol = /* @__PURE__ */ Symbol.for(
  'docspot.recentItems'
);

/**
 * Declares an item for `items` or `defaultItems`, checking its shape.
 * Declare an item once to list it both before and after typing.
 */
export function defineItem<const T extends DocspotItem>(item: T): T {
  return item;
}

export function isResult(
  entry: DocspotResult | DocspotItem
): entry is DocspotResult {
  return 'url' in entry;
}
