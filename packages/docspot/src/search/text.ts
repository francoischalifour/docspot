// Text matching shared by search and its adapters. Free of React, so
// adapters such as docspot/minisearch stay light.

/** Combining marks, such as accents once text is decomposed. */
export const COMBINING_MARKS = /\p{M}/gu;

/** Runs of letters and digits, in any script. */
export const WORD = /[\p{L}\p{N}]+/gu;

/** Runs of anything but letters and digits, in any script. */
export const NON_WORD = /[^\p{L}\p{N}]+/gu;

const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

/** Escapes text to match it literally inside a regular expression. */
export function escapeRegExp(text: string) {
  return text.replace(REGEXP_SPECIAL_CHARACTERS, '\\$&');
}

const PATTERN_CACHE_LIMIT = 32;
const patterns = new Map<string, RegExp>();

/**
 * Compiles a pattern once per source and flags. Callers build patterns from
 * the query's terms, which stay the same for every result of a query.
 * `matchAll` and `search` don't depend on `lastIndex`, so a cached global
 * pattern is safe to share with them.
 */
export function cachedRegExp(source: string, flags: string) {
  const key = `${flags}/${source}`;
  let pattern = patterns.get(key);
  if (!pattern) {
    if (patterns.size >= PATTERN_CACHE_LIMIT) patterns.clear();
    pattern = new RegExp(source, flags);
    patterns.set(key, pattern);
  }
  return pattern;
}

const segmenters = new Map<string, Intl.Segmenter>();

/**
 * The words of a text in a language, with the browser's word boundaries, so
 * languages written without spaces, such as Japanese or Chinese, split too.
 */
export function segmentWords(text: string, language: string): string[] {
  let segmenter = segmenters.get(language);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(language, { granularity: 'word' });
    segmenters.set(language, segmenter);
  }
  const words: string[] = [];
  for (const { segment, isWordLike } of segmenter.segment(text))
    if (isWordLike) words.push(segment);
  return words;
}
