import type { StoredConversation, StoredPage } from '../core/storage';
import type {
  DocspotCommand,
  DocspotHandoff,
  DocspotSearchResponse,
  DocspotSearchResult,
  HighlightedText,
} from '../types';

export type SearchItem = {
  id: string;
  /** The query the item answers; items for older queries are stale. */
  query: string;
  sourceLabel: string;
} & (
  | { kind: 'page'; result: DocspotSearchResult; recent: boolean }
  | {
      kind: 'ask';
      title: string;
      conversation?: StoredConversation;
      /** A suggested question, offered before anything is typed. */
      prompt?: string;
    }
  | { kind: 'handoff'; handoff: DocspotHandoff; url: string }
  | { kind: 'command'; command: DocspotCommand; title: HighlightedText }
);

export type PageItem = Extract<SearchItem, { kind: 'page' }>;
export type AskItem = Extract<SearchItem, { kind: 'ask' }>;
export type HandoffItem = Extract<SearchItem, { kind: 'handoff' }>;
export type CommandItem = Extract<SearchItem, { kind: 'command' }>;

/** The URL an item opens, if it opens one. */
export function getItemUrl(item: SearchItem) {
  if (item.kind === 'page') return item.result.url;
  if (item.kind === 'handoff') return item.url;
  return undefined;
}

export type ResultGroup = { label: string; results: DocspotSearchResult[] };

export function normalizeResponse(response: DocspotSearchResponse) {
  return Array.isArray(response)
    ? { results: response, prioritizeChat: false }
    : {
        results: response.results,
        prioritizeChat: response.prioritizeChat ?? false,
      };
}

/** Groups results in first-appearance order, dropping repeated URLs. */
export function groupResults(
  results: DocspotSearchResult[],
  fallbackLabel: string
): ResultGroup[] {
  const groups = new Map<string, DocspotSearchResult[]>();
  const seen = new Set<string>();
  for (const result of results) {
    if (seen.has(result.url)) continue;
    seen.add(result.url);
    const label = result.group ?? fallbackLabel;
    groups.set(label, [...(groups.get(label) ?? []), result]);
  }
  return [...groups].map(([label, items]) => ({ label, results: items }));
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
 * The commands every word of the query starts a word of, in their title or
 * keywords, in the order given; none for an empty query.
 */
export function matchCommands(
  commands: DocspotCommand[],
  query: string
): DocspotCommand[] {
  const terms = words(query);
  if (!terms.length) return [];
  return commands.filter(command => {
    const known = [command.title, ...(command.keywords ?? [])].flatMap(words);
    return terms.every(term => known.some(word => word.startsWith(term)));
  });
}

/** Groups commands in first-appearance order. */
export function groupCommands(
  commands: DocspotCommand[],
  fallbackLabel: string
): Array<{ label: string; commands: DocspotCommand[] }> {
  const groups = new Map<string, DocspotCommand[]>();
  for (const command of commands) {
    const label = command.group ?? fallbackLabel;
    groups.set(label, [...(groups.get(label) ?? []), command]);
  }
  return [...groups].map(([label, items]) => ({ label, commands: items }));
}

export function toStoredPage(result: DocspotSearchResult): StoredPage {
  return {
    url: result.url,
    title: result.title,
    pageTitle: result.pageTitle,
    breadcrumb: result.breadcrumb,
    group: result.group,
    type: result.type,
  };
}

export function getResultId(result: DocspotSearchResult) {
  return result.id ?? result.url;
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
