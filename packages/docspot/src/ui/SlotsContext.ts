import { createContext } from 'react';

import type { DocspotSlots } from '@/types';

/**
 * The slots the shared interface parts read, such as icons and tooltips,
 * provided by `<Docspot.Root>`. Kept apart from Docspot's state, so these
 * parts load nothing else with them.
 */
export const SlotsContext = /* @__PURE__ */ createContext<
  Pick<DocspotSlots, 'icons' | 'pageIcon' | 'tooltip'> | undefined
>(undefined);
