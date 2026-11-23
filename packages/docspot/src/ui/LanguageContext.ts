import { createContext } from 'react';

/**
 * The locale's BCP 47 code, provided by `<Docspot.Root>`, for parts that
 * format dates and numbers.
 */
export const LanguageContext = /* @__PURE__ */ createContext('en');

/**
 * The reader's own regional variant of a language, such as `en-GB` for
 * `en`, so dates read as they expect. Other languages keep the code.
 */
export function getFormatLanguage(code: string) {
  const language = code.split('-')[0]?.toLowerCase();
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages;
  return (
    preferred.find(tag => tag.split('-')[0]?.toLowerCase() === language) ?? code
  );
}
