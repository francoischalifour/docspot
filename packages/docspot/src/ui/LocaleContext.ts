import { createContext } from 'react';

import type { DocspotMessages } from '@/messages';

/**
 * What parts outside a surface's messages need of the locale, provided by
 * `<Docspot.Root>`: its BCP 47 code, to format dates, and key labels.
 */
export type LocaleContextValue = {
  language: string;
  keys: DocspotMessages['keys'];
};

// Written out rather than read from `en`, so parts that load apart from the
// root, such as chat's, don't bring every English message with them.
export const LocaleContext = /* @__PURE__ */ createContext<LocaleContextValue>({
  language: 'en',
  keys: { control: 'Ctrl', escape: 'Esc' },
});

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
