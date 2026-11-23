import type { StoredConversation, StoredPage } from '@/core/storage';
import type {
  DocspotItem,
  DocspotResult,
  DocspotSearchResponse,
  HighlightedText,
} from '@/types';
import { isResult, recentItems } from '@/search/items';
import {
  COMBINING_MARKS,
  segmentWords,
  cachedRegExp,
  escapeRegExp,
} from '@/search/text';

/** Text whose characters fold to themselves, so offsets need no mapping. */
const ASCII_ONLY = /^\p{ASCII}*$/u;

export type SearchOption = {
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

export type ItemOption = Extract<SearchOption, { kind: 'item' }>;
export type AskOption = Extract<SearchOption, { kind: 'ask' }>;

/** The URL an entry opens, if it opens one. */
export function getOptionUrl(entry: SearchOption) {
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

type EntryDedupe = {
  urls: Set<string>;
  itemIds: Set<string>;
};

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
  labels: { result: string; item: string },
  seen: EntryDedupe,
  /** This site's URLs as paths, so they open in place with `navigate`. */
  toLocalUrl: (url: string) => string
): ItemSection[] {
  const sections: ItemSection[] = [];
  const groups = new Map<string, Array<DocspotResult | DocspotItem>>();
  for (const listed of entries) {
    if (listed === recentItems) {
      if (!sections.some(section => section.kind === 'recent'))
        sections.push({ kind: 'recent' });
      continue;
    }
    const entry = localize(listed, toLocalUrl);
    // A URL is listed once, whether a result or an item opens it.
    if (isResult(entry)) {
      if (seen.urls.has(entry.url)) continue;
      seen.urls.add(entry.url);
    } else {
      if (seen.itemIds.has(entry.id)) continue;
      if (typeof entry.action === 'string') {
        if (seen.urls.has(entry.action)) continue;
        seen.urls.add(entry.action);
      }
      seen.itemIds.add(entry.id);
    }
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
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** Words, folded, split where the language splits them. */
const words = (text: string, language: string) =>
  segmentWords(fold(text), language);

/**
 * The items every word of the query starts a word of, in their title or
 * keywords, in the order given; none for an empty query.
 */
export function matchItems(
  items: DocspotItem[],
  query: string,
  language: string
): DocspotItem[] {
  const terms = words(query, language);
  if (!terms.length) return [];
  return items.filter(item => {
    const known = [item.title, ...(item.keywords ?? [])].flatMap(text =>
      words(text, language)
    );
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

/**
 * Folds text for matching and maps every folded code unit to the original
 * text. This lets highlights retain the spelling the reader sees.
 */
function foldWithOffsets(text: string) {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const character of text) {
    const end = offset + character.length;
    const normalized = fold(character);
    if (normalized) {
      folded += normalized;
      for (let index = 0; index < normalized.length; index++) {
        starts.push(offset);
        ends.push(end);
      }
    } else if (ends.length) {
      // Keep a decomposed accent with the base character it modifies.
      ends[ends.length - 1] = end;
    }
    offset = end;
  }
  return { folded, starts, ends };
}

/** Marks every occurrence of the given terms, ignoring case and accents. */
export function highlightTerms(text: string, terms: string[]): HighlightedText {
  const words = [...new Set(terms.map(fold).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  if (!words.length || !text) return plain(text);
  // Terms match at word starts, so "zoo" marks "zoom" but "a" skips "image".
  const pattern = cachedRegExp(
    `(?<![\\p{L}\\p{N}])(?:${words.map(escapeRegExp).join('|')})`,
    'giu'
  );
  const offsets = ASCII_ONLY.test(text) ? undefined : foldWithOffsets(text);
  const segments: HighlightedText = [];
  let cursor = 0;
  for (const match of (offsets?.folded ?? text).matchAll(pattern)) {
    const from = match.index;
    const to = from + match[0].length;
    const start = offsets ? offsets.starts[from]! : from;
    const end = offsets ? offsets.ends[to - 1]! : to;
    if (cursor < start)
      segments.push({ text: text.slice(cursor, start), highlighted: false });
    segments.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), highlighted: false });
  return segments;
}

function localize(
  entry: DocspotResult | DocspotItem,
  toLocalUrl: (url: string) => string
): DocspotResult | DocspotItem {
  if (isResult(entry)) {
    const url = toLocalUrl(entry.url);
    return url === entry.url ? entry : { ...entry, url };
  }
  if (typeof entry.action !== 'string') return entry;
  const action = toLocalUrl(entry.action);
  return action === entry.action ? entry : { ...entry, action };
}

/**
 * How an option is chosen. With ⌘ or Ctrl, an action runs and search stays
 * open with its query, as a link opens in a new tab.
 */
export type SelectOptions = { keepOpen?: boolean };

/** Whether a click or Enter asks to stay, with ⌘ or Ctrl. */
export function keepsOpen(event: { metaKey: boolean; ctrlKey: boolean }) {
  return event.metaKey || event.ctrlKey;
}
