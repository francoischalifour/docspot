import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { DocspotShortcut, DocspotShortcuts } from '@/types';
import { isTypingTarget } from '@/core/platform';

/** A shortcut such as `Mod+K`, split into its modifiers and key. */
export type Shortcut = {
  /** Lowercase: `mod`, `meta`, `control`, `alt`, or `shift`. */
  modifiers: string[];
  /** Lowercase, to match: a character such as `k` or `/`, or a name such as `f2`. */
  key: string;
  /** The key as written, a letter in capitals: `K`, `/`, `F2`. */
  label: string;
};

export type ResolvedShortcuts = { search: Shortcut[]; chat: Shortcut[] };

type KeyEvent = KeyboardEvent | ReactKeyboardEvent;

const MODIFIERS = ['mod', 'meta', 'control', 'alt', 'shift'];
const LATIN_LETTER = /^[a-z]$/;

function parse(text: string): Shortcut {
  const parts = text.split('+');
  const label = parts.pop()!;
  const modifiers = parts.map(part => part.toLowerCase());
  if (!label || !modifiers.every(modifier => MODIFIERS.includes(modifier)))
    throw new Error(`Docspot: \`shortcuts\` can't read "${text}".`);
  return {
    modifiers,
    key: label.toLowerCase(),
    label: label.length === 1 ? label.toUpperCase() : label,
  };
}

function resolve(value: DocspotShortcut | undefined, fallback: string[]) {
  return value === false ? [] : [value ?? fallback].flat().map(parse);
}

/** Reads the `shortcuts` prop, filling in each surface's defaults. */
export function resolveShortcuts(
  shortcuts: DocspotShortcuts | undefined
): ResolvedShortcuts {
  return {
    search: resolve(shortcuts?.search, ['Mod+K', '/']),
    chat: resolve(shortcuts?.chat, ['Mod+J']),
  };
}

/** Whether it holds ⌘ or Ctrl, so it never types text. */
export function isCommandShortcut({ modifiers }: Shortcut) {
  return modifiers.some(modifier => modifier !== 'alt' && modifier !== 'shift');
}

/**
 * Whether a key press is the shortcut. A letter matches as typed on Latin
 * layouts, including remapped ones such as Dvorak, and by its position on
 * a QWERTY keyboard on others, such as Russian or Greek. Shift is part of
 * other characters, such as `?`, so they match with or without it.
 */
function matches(event: KeyEvent, shortcut: Shortcut) {
  const { modifiers, key } = shortcut;
  const has = (modifier: string) => modifiers.includes(modifier);
  const typed = event.key.toLowerCase();
  const isLetter = LATIN_LETTER.test(key);
  // Without ⌘ or Ctrl, a shortcut types a character in a field.
  if (!isCommandShortcut(shortcut) && isTypingTarget(event.target))
    return false;
  return (
    (isLetter && !LATIN_LETTER.test(typed)
      ? event.code === `Key${shortcut.label}`
      : typed === key) &&
    (has('mod')
      ? event.metaKey || event.ctrlKey
      : event.metaKey === has('meta') && event.ctrlKey === has('control')) &&
    event.altKey === has('alt') &&
    ((key.length === 1 && !isLetter) || event.shiftKey === has('shift'))
  );
}

export function matchesAny(event: KeyEvent, shortcuts: Shortcut[]) {
  return shortcuts.some(shortcut => matches(event, shortcut));
}

/** Whether pressing a modifier key, such as `Meta`, starts a shortcut. */
export function startsShortcut(key: string, shortcuts: Shortcut[]) {
  const modifier = key.toLowerCase();
  return shortcuts.some(
    ({ modifiers }) =>
      modifiers.includes(modifier) ||
      (modifier !== 'alt' && modifiers.includes('mod'))
  );
}

/** `aria-keyshortcuts` for the shortcuts: `Mod+K` is `Meta+K Control+K`. */
export function toAriaKeyShortcuts(shortcuts: Shortcut[]) {
  const capitalize = (name: string) => name[0]!.toUpperCase() + name.slice(1);
  return (
    shortcuts
      .flatMap(({ modifiers, label }) =>
        (modifiers.includes('mod') ? ['meta', 'control'] : ['']).map(mod =>
          [
            ...modifiers.map(modifier =>
              capitalize(modifier === 'mod' ? mod : modifier)
            ),
            label,
          ].join('+')
        )
      )
      .join(' ') || undefined
  );
}

/** The first shortcut's keys for `Kbd`, or none when it is turned off. */
export function toKbdKeys([first]: Shortcut[]) {
  return first && [...first.modifiers, first.label];
}
