import type { DocspotItem, DocspotLinkItem } from '../types';

/**
 * Marks where the reader's recent pages go in `defaultItems`. Without it,
 * they come first.
 */
export const recentItems: unique symbol = /* @__PURE__ */ Symbol.for(
  'docspot.recentItems'
);

/**
 * Declares an item for `items`, `defaultItems`, or search results, checking
 * its shape. Declare an item once to list it both before and after typing.
 */
export function defineItem<const T extends DocspotItem>(item: T): T {
  return item;
}

export function isLinkItem(item: DocspotItem): item is DocspotLinkItem {
  return typeof item.action === 'string';
}

export function getItemId(item: DocspotItem) {
  return item.id ?? (item.action as string);
}
