import type { StoredConversation, StoredPage } from '../core/storage';
import type {
  DocspotHandoff,
  DocspotItem,
  DocspotLinkItem,
  DocspotSearchResponse,
  HighlightedText,
} from '../types';
import { isLinkItem, recentItems } from './items';

export type SearchItem = {
  id: string;
  /** The query the item answers; items for older queries are stale. */
  query: string;
  sourceLabel: string;
} & (
  | {
      kind: 'item';
      item: DocspotItem;
      /** The title as drawn, with the query's matches marked. */
      title: HighlightedText;
      recent: boolean;
    }
  | {
      kind: 'ask';
      title: string;
      conversation?: StoredConversation;
      /** A suggested question, offered before anything is typed. */
      prompt?: string;
    }
  | { kind: 'handoff'; handoff: DocspotHandoff; url: string }
);

export type ListItem = Extract<SearchItem, { kind: 'item' }>;
export type AskItem = Extract<SearchItem, { kind: 'ask' }>;
export type HandoffItem = Extract<SearchItem, { kind: 'handoff' }>;

/** The URL an item opens, if it opens one. */
export function getItemUrl(item: SearchItem) {
  if (item.kind === 'item')
    return isLinkItem(item.item) ? item.item.action : undefined;
  if (item.kind === 'handoff') return item.url;
  return undefined;
}

/** A group of items, or the place of the reader's recent pages. */
export type ItemSection =
  | { kind: 'group'; label: string; items: DocspotItem[] }
  | { kind: 'recent' };

export function normalizeResponse(response: DocspotSearchResponse) {
  return Array.isArray(response)
    ? { items: response, prioritizeChat: false }
    : {
        items: response.items,
        prioritizeChat: response.prioritizeChat ?? false,
      };
}

/**
 * Groups items in first-appearance order, dropping repeated pages (by URL,
 * whatever their id) and repeated actions (by id). Items
 * without a group fall back by action: pages to `pageLabel`, the rest to
 * `actionLabel`. `recentItems` keeps its place among the groups.
 */
export function groupItems(
  items: ReadonlyArray<DocspotItem | typeof recentItems>,
  labels: { page: string; action: string }
): ItemSection[] {
  const sections: ItemSection[] = [];
  const groups = new Map<string, DocspotItem[]>();
  const seen = new Set<string>();
  for (const item of items) {
    if (item === recentItems) {
      if (!sections.some(section => section.kind === 'recent'))
        sections.push({ kind: 'recent' });
      continue;
    }
    const key = isLinkItem(item) ? `url:${item.action}` : `id:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label =
      item.group ?? (isLinkItem(item) ? labels.page : labels.action);
    let group = groups.get(label);
    if (!group) {
      group = [];
      groups.set(label, group);
      sections.push({ kind: 'group', label, items: group });
    }
    group.push(item);
  }
  return sections;
}

/** Lowercase, without accents, so "Theme" finds "Thème" and the other way around. */
function fold(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const words = (text: string) =>
  fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * The items every word of the query starts a word of, in their title or
 * keywords, in the order given; none for an empty query.
 */
export function matchItems(items: DocspotItem[], query: string): DocspotItem[] {
  const terms = words(query);
  if (!terms.length) return [];
  return items.filter(item => {
    const known = [item.title, ...(item.keywords ?? [])].flatMap(words);
    return terms.every(term => known.some(word => word.startsWith(term)));
  });
}

export function toStoredPage(item: DocspotLinkItem): StoredPage {
  return {
    url: item.action,
    title: item.title,
    pageTitle: item.pageTitle,
    breadcrumb: item.breadcrumb,
    group: item.group,
    type: item.type,
  };
}

export function fromStoredPage({ url, ...page }: StoredPage): DocspotLinkItem {
  return { ...page, action: url };
}

export function plain(text: string | undefined): HighlightedText {
  return text ? [{ text, highlighted: false }] : [];
}

/**
 * Splits a string marked with highlight tags into segments, for providers
 * that return highlights as tagged text.
 */
export function parseHighlightedString(
  value: string,
  preTag: string,
  postTag: string
): HighlightedText {
  const segments: HighlightedText = [];
  for (const [index, part] of value.split(preTag).entries()) {
    const end = part.indexOf(postTag);
    if (index === 0 || end < 0) {
      if (part) segments.push({ text: part, highlighted: false });
      continue;
    }
    const match = part.slice(0, end);
    const rest = part.slice(end + postTag.length);
    if (match) segments.push({ text: match, highlighted: true });
    if (rest) segments.push({ text: rest, highlighted: false });
  }
  return segments;
}

/** Marks every occurrence of the given terms, ignoring case and accents. */
export function highlightTerms(text: string, terms: string[]): HighlightedText {
  const words = [...new Set(terms.filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  if (!words.length || !text) return plain(text);
  const escaped = words.map(word =>
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  // Terms match at word starts, so "zoo" marks "zoom" but "a" skips "image".
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${escaped.join('|')})`,
    'giu'
  );
  // Splitting on one capture group alternates text and matches.
  return text
    .split(pattern)
    .map((part, index) => ({ text: part, highlighted: index % 2 === 1 }))
    .filter(segment => segment.text);
}
