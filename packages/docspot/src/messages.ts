import { en, type EnglishMessages } from '@/locale/en';
import type { DocspotQuestionWords } from '@/types';

/**
 * Interface text. Strings may contain `{assistant}`, which is replaced by
 * `assistant`. Functions receive what they describe and return the text.
 */
export type DocspotMessages = EnglishMessages;

/**
 * A language for Docspot's interface: its BCP 47 code, used to format dates,
 * and every message. `docspot/locale` provides several.
 */
export type DocspotLocale = {
  code: string;
  messages: DocspotMessages;
  /** How the language asks, to recognize questions besides English ones. */
  questions?: DocspotQuestionWords;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type DocspotMessagesInput = DeepPartial<DocspotMessages>;

/**
 * A `WithAsk` key replaces its base key when chat is available. Overriding
 * only the base key overrides both, so a custom text never disappears when
 * chat is added.
 */
function withAskFallbacks<T extends object>(
  defaults: T,
  overrides: Partial<T> | undefined
): T {
  if (!overrides) return defaults;
  const resolved: Record<string, unknown> = { ...defaults, ...overrides };
  for (const key of Object.keys(overrides)) {
    const variant = `${key}WithAsk`;
    if (variant in defaults && !(variant in overrides))
      resolved[variant] = resolved[key];
  }
  return resolved as T;
}

const ASSISTANT = /\{assistant\}/g;

/** Writes the assistant's name into a group's strings. */
function fillAssistant<T extends object>(group: T, assistant: string): T {
  const filled: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(group))
    filled[key] =
      typeof value === 'string' ? value.replace(ASSISTANT, assistant) : value;
  return filled as T;
}

let english: DocspotMessages | undefined;

/** The text Docspot shows: a locale's messages with the site's overrides. */
export function resolveMessages(
  locale: DocspotLocale | undefined,
  overrides: DocspotMessagesInput | undefined
): DocspotMessages {
  const isEnglish = !locale && !overrides;
  if (isEnglish && english) return english;
  const base = (locale ?? en).messages;
  const assistant = overrides?.assistant ?? base.assistant;
  const resolved: DocspotMessages = {
    assistant,
    keys: { ...base.keys, ...overrides?.keys },
    trigger: fillAssistant(
      withAskFallbacks(base.trigger, overrides?.trigger),
      assistant
    ),
    search: fillAssistant(
      withAskFallbacks(base.search, overrides?.search),
      assistant
    ),
    chat: fillAssistant(
      withAskFallbacks(base.chat, overrides?.chat),
      assistant
    ),
  };
  if (isEnglish) english = resolved;
  return resolved;
}
