import { useState } from 'react';

import { isElementVisible } from '@/core/platform';

/**
 * The triggers on the page, so focus can return to a visible one when
 * search or chat closes and the element that opened it is gone.
 */
export function useTriggerRegistry() {
  const [registry] = useState(() => {
    const triggers = new Set<HTMLElement>();
    return {
      register: (button: HTMLElement | null) => {
        if (!button) return;
        triggers.add(button);
        return () => {
          triggers.delete(button);
        };
      },
      findVisible: () => [...triggers].find(isElementVisible) ?? null,
    };
  });
  return registry;
}

export type TriggerRegistry = ReturnType<typeof useTriggerRegistry>;
