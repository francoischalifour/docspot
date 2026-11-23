import type { DocspotQuestionWords, DocspotSearchLocale } from '@/types';
import { COMBINING_MARKS, NON_WORD, segmentWords } from '@/search/text';

// English applies in every language: readers often search in English.
// Other languages bring their words with their locale.
const ENGLISH: Required<Omit<DocspotQuestionWords, 'markers'>> = {
  starts:
    'how what why where when which who whose can could should would will do does did is are was were has have'.split(
      ' '
    ),
  requests: 'show explain tell help teach walk compare describe'.split(' '),
  stop: 'a an and are can could did do does for from has have how i in is it my of on or our should the there to was we were what when where which who why will with would you your'.split(
    ' '
  ),
};

type Intent = {
  starts: Set<string>;
  requests: Set<string>;
  markers: Set<string>;
  stop: Set<string>;
};

const english: Intent = {
  starts: new Set(ENGLISH.starts),
  requests: new Set(ENGLISH.requests),
  markers: new Set(),
  stop: new Set(ENGLISH.stop),
};
const intents = new WeakMap<DocspotQuestionWords, Intent>();

/** A language's question words, with English's. */
function getIntent(locale: DocspotSearchLocale | undefined): Intent {
  const words = locale?.questions;
  if (!words) return english;
  let intent = intents.get(words);
  if (!intent) {
    intent = {
      starts: new Set([...ENGLISH.starts, ...words.starts]),
      requests: new Set([...ENGLISH.requests, ...(words.requests ?? [])]),
      markers: new Set(words.markers),
      stop: new Set([...ENGLISH.stop, ...(words.stop ?? [])]),
    };
    intents.set(words, intent);
  }
  return intent;
}

const COMPARISON = /\b(difference between|best way|vs\.?|versus)\b/i;
const PERSONAL = /\b(i|my|we|our|you|your)\b/i;
const FIRST_PERSON_REQUEST = /^i('m|'ve| am| want| need| have)\b/i;
const CODE_LIKE = /[_(){}=<>`]|[a-z][A-Z]|\w\.\w/;
/** Question marks in Latin, Arabic, and full-width scripts. */
const QUESTION_MARK = /[?？؟]$/;
const INVERTED_QUESTION_MARK = /^¿/;

/** Lowercase, without accents, as the word lists are written. */
function fold(word: string) {
  return word.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/** The query's words, lowercase and without accents. */
export function getWords(query: string, locale?: DocspotSearchLocale) {
  return segmentWords(query, locale?.code ?? 'en').map(fold);
}

/** Words that carry meaning, without question words and stop words. */
export function countContentWords(query: string, locale?: DocspotSearchLocale) {
  const { stop } = getIntent(locale);
  return getWords(query, locale).filter(word => !stop.has(word)).length;
}

function getQuestionScore(query: string, locale?: DocspotSearchLocale) {
  const text = query.trim();
  const words = getWords(text, locale);
  if (words.length < 2 || CODE_LIKE.test(text)) return 0;
  const intent = getIntent(locale);
  const first = words[0]!;
  let score = 0;
  if (QUESTION_MARK.test(text) || INVERTED_QUESTION_MARK.test(text)) score += 3;
  if (intent.starts.has(first)) score += words.length >= 3 ? 2 : 1;
  if (intent.requests.has(first) || FIRST_PERSON_REQUEST.test(text)) score += 2;
  if (words.some(word => intent.markers.has(word))) score += 2;
  if (COMPARISON.test(text)) score += 2;
  if (PERSONAL.test(text)) score += 1;
  if (words.length >= 5) score += 1;
  return score;
}

/**
 * Whether a query reads as a natural-language question, not keywords: in
 * English, or in the locale's language, such as `DocspotSearchParams`'s.
 */
export function isQuestion(query: string, locale?: DocspotSearchLocale) {
  return getQuestionScore(query, locale) >= 2;
}

function normalize(text: string) {
  return text.toLowerCase().replace(NON_WORD, ' ').trim();
}

/** Whether the query names a result's page, like "SQL Explorer". */
export function namesPage(query: string, pageTitles: string[]) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 3) return false;
  return pageTitles.some(pageTitle => {
    const title = normalize(pageTitle);
    return (
      Boolean(title) &&
      (normalizedQuery.includes(title) || title.includes(normalizedQuery))
    );
  });
}

/**
 * Whether chat should lead: the query reads as a question, or is long, and
 * no result clearly answers it.
 */
export function shouldPrioritizeChat({
  query,
  pageTitles,
  hasResults,
  hasCompleteMatch,
  locale,
}: {
  query: string;
  /** Titles of the pages the results belong to. */
  pageTitles: string[];
  hasResults: boolean;
  /** Whether the top result matches every content word without typos. */
  hasCompleteMatch: boolean;
  /** The interface's language, as `DocspotSearchParams` gives it. */
  locale?: DocspotSearchLocale;
}) {
  if (namesPage(query, pageTitles) || hasCompleteMatch) return false;
  const isLongQuery = getWords(query, locale).length >= 3;
  return (
    isQuestion(query, locale) ||
    (!hasResults && isLongQuery) ||
    countContentWords(query, locale) >= 4
  );
}
