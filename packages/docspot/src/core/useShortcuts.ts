import { useEffect, useEffectEvent } from 'react';

import type { ChatController, SearchController } from '@/core/context';
import { isTypingTarget } from '@/core/platform';
import {
  type ResolvedShortcuts,
  matchesAny,
  startsShortcut,
} from '@/core/shortcuts';

/**
 * The `shortcuts` keys open search and toggle chat, while focus is inside
 * the owner element. By default, ⌘K or Ctrl K and / open search, and ⌘J or
 * Ctrl J toggles chat.
 */
export function useShortcuts(
  owner: HTMLElement | Document | null,
  {
    search,
    chat,
    shortcuts,
    preload,
  }: {
    search: Pick<SearchController, 'isOpen' | 'open' | 'preload'> | null;
    chat: Pick<ChatController, 'toggle' | 'preload'> | null;
    shortcuts: ResolvedShortcuts;
    /** Whether pressing a shortcut's modifier loads search and chat. */
    preload: boolean;
  }
) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    // A modifier comes before its key: load what it may open meanwhile,
    // unless it more likely copies or edits text.
    if (
      event.key === 'Meta' ||
      event.key === 'Control' ||
      event.key === 'Alt'
    ) {
      if (
        preload &&
        !event.repeat &&
        !isTypingTarget(event.target) &&
        !document.getSelection()?.toString()
      ) {
        if (
          search &&
          !search.isOpen &&
          startsShortcut(event.key, shortcuts.search)
        )
          search.preload();
        if (chat && startsShortcut(event.key, shortcuts.chat)) chat.preload();
      }
      return;
    }
    if (search && !search.isOpen && matchesAny(event, shortcuts.search)) {
      event.preventDefault();
      // A held shortcut repeats keydown; only the first press opens search.
      if (!event.repeat) search.open();
      return;
    }
    if (chat && matchesAny(event, shortcuts.chat)) {
      event.preventDefault();
      if (!event.repeat) chat.toggle();
    }
  });
  useEffect(() => {
    if (!owner) return;
    const listener = (event: Event) => onKeyDown(event as KeyboardEvent);
    owner.addEventListener('keydown', listener);
    return () => owner.removeEventListener('keydown', listener);
  }, [owner]);
}
