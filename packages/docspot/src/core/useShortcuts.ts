import { useEffect, useEffectEvent } from 'react';

import type { ChatController, SearchController } from '@/core/context';
import { isCommandKey, isTypingTarget } from '@/core/platform';

/**
 * ⌘K or Ctrl K and / open search, and ⌘J or Ctrl J toggles chat, while
 * focus is inside the owner element.
 */
export function useShortcuts(
  owner: HTMLElement | Document | null,
  {
    search,
    chat,
  }: {
    search: Pick<SearchController, 'isOpen' | 'open'> | null;
    chat: Pick<ChatController, 'toggle'> | null;
  }
) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (search && !search.isOpen) {
      // A held shortcut repeats keydown; only the first press opens search.
      if (isCommandKey(event, 'k')) {
        event.preventDefault();
        if (!event.repeat) search.open();
        return;
      }
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        search.open();
        return;
      }
    }
    if (chat && isCommandKey(event, 'j')) {
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
