import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import type { DocspotUrlAdapter } from '@/types';
import {
  type DocspotConfig,
  type SearchController,
  searchDialogLoader,
  warnMissing,
} from '@/core/context';
import { isElementVisible, useIdlePreload } from '@/core/platform';
import type { TriggerRegistry } from '@/core/useTriggerRegistry';
import { writeSearchQuery } from '@/core/url';

// The URL follows the typed query once typing pauses.
const QUERY_URL_DELAY_MS = 300;

type SearchState = {
  isOpen: boolean;
  query: string;
  /** Changes when the query comes from the URL rather than from typing. */
  version: number;
};

/** Search's open state and query, kept in step with the URL. */
export function useSearchController(
  config: DocspotConfig,
  url: DocspotUrlAdapter | null,
  triggers: TriggerRegistry
) {
  const { search, canSearch, emit } = config;
  const [state, setState] = useState<SearchState>({
    isOpen: false,
    query: '',
    version: 0,
  });
  const isOpenRef = useRef(false);
  isOpenRef.current = state.isOpen;
  const queryRef = useRef('');
  queryRef.current = state.query;
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const queryWriteRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The query this instance last wrote, so its own URL writes are ignored.
  const writtenQueryRef = useRef<string | null>(null);

  function writeQuery(query: string | null, replace: boolean) {
    if (!url || !canSearch) return;
    writtenQueryRef.current = query;
    url.write(writeSearchQuery(url.read(), query), { replace });
  }

  function open(opener?: HTMLElement, query = '') {
    if (!canSearch) {
      warnMissing('search');
      return;
    }
    search?.preload?.();
    const focused = document.activeElement;
    // Closing search returns to the chat composer it was opened from.
    restoreFocusRef.current =
      opener ??
      (focused instanceof HTMLElement && focused.closest('[data-docspot-chat]')
        ? focused
        : triggers.findVisible());
    clearTimeout(queryWriteRef.current);
    setState(current => ({
      isOpen: true,
      query,
      version: current.version + 1,
    }));
    if (!isOpenRef.current) emit({ type: 'search.open' });
    writeQuery(query, isOpenRef.current);
  }

  function close({ writeUrl = true } = {}) {
    // A pending write would reopen search if it ran after the close.
    clearTimeout(queryWriteRef.current);
    if (isOpenRef.current) emit({ type: 'search.close' });
    setState(current => ({ ...current, isOpen: false }));
    if (writeUrl) writeQuery(null, true);
  }

  function leave() {
    clearTimeout(queryWriteRef.current);
    if (isOpenRef.current) writeQuery(queryRef.current, true);
    close({ writeUrl: false });
  }

  function setQuery(query: string) {
    setState(current => ({ ...current, query }));
    clearTimeout(queryWriteRef.current);
    queryWriteRef.current = setTimeout(() => {
      if (isOpenRef.current) writeQuery(query, true);
    }, QUERY_URL_DELAY_MS);
  }

  useEffect(() => () => clearTimeout(queryWriteRef.current), []);

  const restoreFocus = useEffectEvent(() => {
    const target = restoreFocusRef.current;
    if (target === null) return;
    // The reader stays where they were in the page.
    if (isElementVisible(target)) target.focus({ preventScroll: true });
    else triggers.findVisible()?.focus({ preventScroll: true });
  });
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !state.isOpen) restoreFocus();
    wasOpenRef.current = state.isOpen;
  }, [state.isOpen]);

  /** Follows `?q=` from history or a link: opens, updates, or closes. */
  function syncQueryFromUrl(query: string | null) {
    if (query === null) {
      if (isOpenRef.current) close({ writeUrl: false });
    } else if (!isOpenRef.current) {
      restoreFocusRef.current = triggers.findVisible();
      writtenQueryRef.current = query;
      setState(current => ({
        isOpen: true,
        query,
        version: current.version + 1,
      }));
      emit({ type: 'search.open' });
    } else if (query !== writtenQueryRef.current) {
      // A query from history or a link replaces what was typed.
      clearTimeout(queryWriteRef.current);
      writtenQueryRef.current = query;
      setState(current => ({
        ...current,
        query,
        version: current.version + 1,
      }));
    }
  }

  /** Closes search for chat, which then owns the focus. */
  function closeForChat() {
    restoreFocusRef.current = null;
    close();
  }

  const preload = useMemo(
    () =>
      search
        ? () => {
            void searchDialogLoader.load().catch(() => {});
            search.preload?.();
          }
        : undefined,
    [search]
  );
  useIdlePreload(preload);

  const controller: Omit<SearchController, 'openChat'> = {
    isOpen: state.isOpen,
    query: state.query,
    queryVersion: state.version,
    setQuery,
    open,
    close: () => close(),
    leave,
    registerTrigger: triggers.register,
    preload: () => preload?.(),
  };
  return { controller, closeForChat, syncQueryFromUrl };
}
