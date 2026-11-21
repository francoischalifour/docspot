import type { StoredConversation, StoredPage } from '@/core/storage';
import type {
  DocspotItem,
  DocspotResult,
  DocspotSearchResponse,
  HighlightedText,
} from '@/types';
import { isResult, recentItems } from '@/search/items';

export type SearchItem = {
  id: string;
  /** The query the item answers; items for older queries are stale. */
  query: string;
  sourceLabel: string;
} & (
  | {
      kind: 'result';
      result: DocspotResult;
      /** The title as drawn, with the query's matches marked. */
      title: HighlightedText;
      recent: boolean;
    }
  | {
      kind: 'item';
      item: DocspotItem;
      /** The title as drawn, with the query's matches marked. */
      title: HighlightedText;
    }
  | {
      kind: 'ask';
      title: string;
      conversation?: StoredConversation;
      /** A suggested question, offered before anything is typed. */
      prompt?: string;
    }
);

export type ItemEntry = Extract<SearchItem, { kind: 'item' }>;
export type AskEntry = Extract<SearchItem, { kind: 'ask' }>;

/** The URL an entry opens, if it opens one. */
export function getEntryUrl(entry: SearchItem) {
  if (entry.kind === 'result') return entry.result.url;
  if (entry.kind === 'item' && typeof entry.item.action === 'string')
    return entry.item.action;
  return undefined;
}

/** A group of results and items, or the place of the reader's recent pages. */
export type ItemSection =
  | {
      kind: 'group';
      label: string;
      entries: Array<DocspotResult | DocspotItem>;
    }
  | { kind: 'recent' };

export function normalizeResponse(response: DocspotSearchResponse) {
  return Array.isArray(response)
    ? { results: response, prioritizeChat: false }
    : {
        results: response.results,
        prioritizeChat: response.prioritizeChat ?? false,
      };
}

/**
 * Groups results and items in first-appearance order, dropping repeated
 * URLs and repeated item ids. Those without a group fall back to
 * `labels.result` or `labels.item`. `recentItems` keeps its place among the
 * groups.
 */
export function groupEntries(
  entries: ReadonlyArray<DocspotResult | DocspotItem | typeof recentItems>,
  labels: { result: string; item: string }
): ItemSection[] {
  const sections: ItemSection[] = [];
  const groups = new Map<string, Array<DocspotResult | DocspotItem>>();
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry === recentItems) {
      if (!sections.some(section => section.kind === 'recent'))
        sections.push({ kind: 'recent' });
      continue;
    }
    // A URL is listed once, whether a result or an item opens it.
    const key = isResult(entry)
      ? `url:${entry.url}`
      : typeof entry.action === 'string'
        ? `url:${entry.action}`
        : `id:${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label =
      entry.group ?? (isResult(entry) ? labels.result : labels.item);
    let group = groups.get(label);
    if (!group) {
      group = [];
      groups.set(label, group);
      sections.push({ kind: 'group', label, entries: group });
    }
    group.push(entry);
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

export function toStoredPage({
  url,
  title,
  pageTitle,
  breadcrumb,
  group,
  type,
}: DocspotResult): StoredPage {
  return { url, title, pageTitle, breadcrumb, group, type };
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
