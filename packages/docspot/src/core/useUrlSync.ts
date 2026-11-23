import { useEffect, useEffectEvent, useRef } from 'react';

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
  // An adapter written inline is new on every render; the latest one is
  // read, without subscribing again and re-reading a URL mid-write.
  const urlRef = useRef(url);
  urlRef.current = url;
  const sync = useEffectEvent(() => {
    if (!url) return;
    const search = url.read();
    syncQueryFromUrl?.(readSearchQuery(search));
    syncLinkFromUrl(search);
  });
  const isSynced = url !== null;
  useEffect(() => {
    if (!urlRef.current) return;
    sync();
    return urlRef.current.subscribe(() => sync());
  }, [isSynced, ...dependencies]);
}
