const QUESTION_START =
  /^(how|what|why|where|when|which|who|whose|can|could|should|would|will|do|does|did|is|are|was|were|has|have)\b/i;
const REQUEST_START =
  /^(show|explain|tell|help|teach|walk|compare|describe)\b|^i('m|'ve| am| want| need| have)\b/i;
const COMPARISON = /\b(difference between|best way|vs\.?|versus)\b/i;
const PERSONAL = /\b(i|my|we|our|you|your)\b/i;
const CODE_LIKE = /[_(){}=<>`]|[a-z][A-Z]|\w\.\w/;
const STOP_WORDS = new Set(
  'a an and are can could did do does for from has have how i in is it my of on or our should the there to was we were what when where which who why will with would you your'.split(
    ' '
  )
);

export function getWords(query: string) {
  return query.toLowerCase().match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? [];
}

/** Words that carry meaning, without question words and stop words. */
export function countContentWords(query: string) {
  return getWords(query).filter(word => !STOP_WORDS.has(word)).length;
}

function getQuestionScore(query: string) {
  const text = query.trim();
  const wordCount = getWords(text).length;
  if (wordCount < 2 || CODE_LIKE.test(text)) return 0;
  let score = 0;
  if (text.endsWith('?')) score += 3;
  if (QUESTION_START.test(text)) score += wordCount >= 3 ? 2 : 1;
  if (REQUEST_START.test(text)) score += 2;
  if (COMPARISON.test(text)) score += 2;
  if (PERSONAL.test(text)) score += 1;
  if (wordCount >= 5) score += 1;
  return score;
}

/** Whether a query reads as a natural-language question, not keywords. */
export function isQuestion(query: string) {
  return getQuestionScore(query) >= 2;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
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
}: {
  query: string;
  /** Titles of the pages the results belong to. */
  pageTitles: string[];
  hasResults: boolean;
  /** Whether the top result matches every content word without typos. */
  hasCompleteMatch: boolean;
}) {
  if (namesPage(query, pageTitles) || hasCompleteMatch) return false;
  const isLongQuery = getWords(query).length >= 3;
  return (
    isQuestion(query) ||
    (!hasResults && isLongQuery) ||
    countContentWords(query) >= 4
  );
}
