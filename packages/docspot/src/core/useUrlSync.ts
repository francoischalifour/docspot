import { useEffect, useEffectEvent } from 'react';

import type { DocspotUrlAdapter } from '@/types';
import { readSearchQuery } from '@/core/url';

/**
 * Follows the URL as it changes, including back and forward: `?q=` drives
 * search, and chat links such as `?prompt=` open chat.
 */
export function useUrlSync(
  url: DocspotUrlAdapter | null,
  {
    syncQueryFromUrl,
    syncLinkFromUrl,
  }: {
    syncQueryFromUrl: ((query: string | null) => void) | null;
    syncLinkFromUrl: (search: string) => void;
  },
  /** Resubscribes when these change, such as a new chat transport. */
  dependencies: unknown[]
) {
  const sync = useEffectEvent(() => {
    if (!url) return;
    const search = url.read();
    syncQueryFromUrl?.(readSearchQuery(search));
    syncLinkFromUrl(search);
  });
  useEffect(() => {
    if (!url) return;
    sync();
    return url.subscribe(() => sync());
  }, [url, ...dependencies]);
}
