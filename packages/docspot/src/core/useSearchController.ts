import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import type {
  DocspotRootProps,
  DocspotSearchResponse,
  DocspotUrlAdapter,
} from '@/types';
import {
  type DocspotConfig,
  type SearchController,
  type SearchLeave,
  searchDialogFrameLoader,
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
  /** Changes when the query comes from outside typing, such as the URL. */
  version: number;
};

/** How the next open or close applies to the URL and focus. */
type Transition = {
  /** `push` adds a history entry with the query; `replace` doesn't. */
  url: 'push' | 'replace' | 'none';
  /** Where focus returns on close; null leaves it to whatever opens next. */
  restoreFocus?: HTMLElement | null;
};

/** A search sent on open, while the dialog may still be loading. */
type EarlySearch = {
  query: string;
  response: Promise<DocspotSearchResponse>;
  controller: AbortController;
};

type SearchStateProps = Pick<
  DocspotRootProps,
  'searchOpen' | 'onSearchOpenChange' | 'query' | 'onQueryChange'
>;

/**
 * Search's open state and query, kept in step with the URL. Both can be
 * controlled: requests go through `onSearchOpenChange` and
 * `onQueryChange`, and what happens follows the props.
 */
export function useSearchController(
  props: SearchStateProps,
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
  const isOpen = props.searchOpen ?? state.isOpen;
  const query = props.query ?? state.query;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const queryRef = useRef(query);
  queryRef.current = query;
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const queryWriteRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The query this instance last wrote, so its own URL writes are ignored.
  const writtenQueryRef = useRef<string | null>(null);
  // The query last typed, so a query from anywhere else updates the input.
  const typedQueryRef = useRef(query);
  const transitionRef = useRef<Transition | null>(null);
  // The navigation search waits for before it closes, if any.
  const leavingRef = useRef<object | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const earlySearchRef = useRef<EarlySearch | null>(null);
  // Focus outside search, for a parent opening it through `searchOpen`: by
  // the time that takes effect, the search input has focus.
  const outsideFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (props.searchOpen === undefined) return;
    function track(event: FocusEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        !target.closest('[data-docspot-search]')
      )
        outsideFocusRef.current = target;
    }
    document.addEventListener('focusin', track);
    return () => document.removeEventListener('focusin', track);
  }, [props.searchOpen === undefined]);

  function writeQuery(next: string | null, replace: boolean) {
    if (!url || !canSearch) return;
    writtenQueryRef.current = next;
    url.write(writeSearchQuery(url.read(), next), { replace });
  }

  /** Where focus returns when search closes. */
  function getReturnFocus(opener?: HTMLElement) {
    const focused = document.activeElement;
    // Closing search returns to the chat composer it was opened from.
    return (
      opener ??
      (focused instanceof HTMLElement && focused.closest('[data-docspot-chat]')
        ? focused
        : triggers.findVisible())
    );
  }

  function requestOpen(open: boolean, transition: Transition) {
    if (open === isOpenRef.current) return;
    // Opening or closing otherwise ends the wait for a navigation.
    stopLeaving();
    if (!open) sendEarlySearch('');
    transitionRef.current = transition;
    if (props.searchOpen === undefined)
      setState(current => ({ ...current, isOpen: open }));
    props.onSearchOpenChange?.(open);
  }

  /**
   * Searches for a query search opens with, alongside loading the dialog,
   * whose first search then reads it.
   */
  function sendEarlySearch(next: string) {
    earlySearchRef.current?.controller.abort();
    earlySearchRef.current = null;
    const trimmed = next.trim();
    if (!search || !trimmed) return;
    const controller = new AbortController();
    const response = new Promise<DocspotSearchResponse>(resolve =>
      resolve(search({ query: trimmed, signal: controller.signal }))
    );
    // The dialog reports a failure once it reads the response.
    response.catch(() => {});
    earlySearchRef.current = { query: trimmed, response, controller };
  }

  const takeEarlySearch: SearchController['takeEarlySearch'] = (
    trimmed,
    signal
  ) => {
    const early = earlySearchRef.current;
    earlySearchRef.current = null;
    if (!early) return null;
    if (early.query !== trimmed) {
      early.controller.abort();
      return null;
    }
    signal.addEventListener('abort', () => early.controller.abort(), {
      once: true,
    });
    return early.response;
  };

  /** Sets the query from outside typing, so the input shows it. */
  function replaceQuery(next: string) {
    if (props.query === undefined)
      setState(current => ({ ...current, query: next }));
    if (next !== queryRef.current) props.onQueryChange?.(next);
  }

  function open(opener?: HTMLElement, initialQuery = '') {
    if (!canSearch) {
      warnMissing('search');
      return;
    }
    search?.preload?.();
    clearTimeout(queryWriteRef.current);
    replaceQuery(initialQuery);
    // An external change is applied by the effect below; bump it here too
    // for the same query, which a reopened dialog reads again.
    setState(current => ({ ...current, version: current.version + 1 }));
    if (isOpenRef.current) {
      writeQuery(initialQuery, true);
      return;
    }
    restoreFocusRef.current = getReturnFocus(opener);
    sendEarlySearch(initialQuery);
    requestOpen(true, { url: 'push', restoreFocus: restoreFocusRef.current });
  }

  function close({ writeUrl = true } = {}) {
    // A pending write would reopen search if it ran after the close.
    clearTimeout(queryWriteRef.current);
    requestOpen(false, { url: writeUrl ? 'replace' : 'none' });
  }

  function stopLeaving() {
    if (!leavingRef.current) return;
    leavingRef.current = null;
    setIsLeaving(false);
  }

  const leave: SearchLeave = (target, options) => {
    clearTimeout(queryWriteRef.current);
    if (isOpenRef.current) writeQuery(queryRef.current, true);
    const navigation = config.navigate(target, options);
    if (!navigation || !isOpenRef.current) {
      close({ writeUrl: false });
      return;
    }
    // Search stays over the page until the next one shows, without a
    // flash of the page being left.
    const leaving = {};
    leavingRef.current = leaving;
    setIsLeaving(true);
    void navigation.then(
      () => {
        if (leavingRef.current === leaving) close({ writeUrl: false });
      },
      () => {
        if (leavingRef.current === leaving) stopLeaving();
      }
    );
  };

  // Back from a page kept in memory, search is as it was left, ready again.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) stopLeaving();
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  function setQuery(next: string) {
    typedQueryRef.current = next;
    if (props.query === undefined)
      setState(current => ({ ...current, query: next }));
    props.onQueryChange?.(next);
    clearTimeout(queryWriteRef.current);
    queryWriteRef.current = setTimeout(() => {
      if (isOpenRef.current) writeQuery(next, true);
    }, QUERY_URL_DELAY_MS);
  }

  useEffect(
    () => () => {
      clearTimeout(queryWriteRef.current);
      earlySearchRef.current?.controller.abort();
    },
    []
  );

  // A query that changes other than by typing replaces what the input shows.
  useEffect(() => {
    if (query === typedQueryRef.current) return;
    typedQueryRef.current = query;
    setState(current => ({ ...current, version: current.version + 1 }));
  }, [query]);

  // Opening and closing take effect here, whoever asked: Docspot, or a
  // parent controlling `searchOpen`.
  const applyOpenChange = useEffectEvent((open: boolean) => {
    const requested = transitionRef.current;
    transitionRef.current = null;
    const transition: Transition = requested ?? {
      url: open ? 'push' : 'replace',
    };
    if (open) {
      // Docspot's own requests preloaded already; a parent's didn't.
      if (!requested) search?.preload?.();
      const outside = outsideFocusRef.current;
      restoreFocusRef.current =
        transition.restoreFocus === undefined
          ? outside && isElementVisible(outside)
            ? outside
            : getReturnFocus()
          : transition.restoreFocus;
      emit({ type: 'search.open' });
      if (transition.url !== 'none')
        writeQuery(queryRef.current, transition.url === 'replace');
      return;
    }
    emit({ type: 'search.close' });
    if (transition.url !== 'none') writeQuery(null, true);
    const target =
      transition.restoreFocus === undefined
        ? restoreFocusRef.current
        : transition.restoreFocus;
    if (target === null) return;
    // The reader stays where they were in the page.
    if (isElementVisible(target)) target.focus({ preventScroll: true });
    else triggers.findVisible()?.focus({ preventScroll: true });
  });
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (wasOpenRef.current === isOpen) return;
    wasOpenRef.current = isOpen;
    applyOpenChange(isOpen);
  }, [isOpen]);

  /** Follows `?q=` from history or a link: opens, updates, or closes. */
  function syncQueryFromUrl(next: string | null) {
    if (next === null) {
      if (isOpenRef.current) close({ writeUrl: false });
      return;
    }
    if (isOpenRef.current && next === writtenQueryRef.current) return;
    // A query from history or a link replaces what was typed.
    clearTimeout(queryWriteRef.current);
    writtenQueryRef.current = next;
    replaceQuery(next);
    if (!isOpenRef.current) {
      sendEarlySearch(next);
      requestOpen(true, { url: 'none', restoreFocus: triggers.findVisible() });
    }
  }

  /** Closes search for chat, which then owns the focus. */
  function closeForChat() {
    clearTimeout(queryWriteRef.current);
    requestOpen(false, { url: 'replace', restoreFocus: null });
  }

  const preload = useMemo(
    () =>
      search
        ? () => {
            void searchDialogFrameLoader.load().catch(() => {});
            search.preload?.();
          }
        : undefined,
    [search]
  );
  useIdlePreload(config.preload ? preload : undefined);

  const controller: Omit<SearchController, 'openChat'> = {
    isOpen,
    query,
    queryVersion: state.version,
    setQuery,
    open,
    close: () => close(),
    isLeaving,
    leave,
    takeEarlySearch,
    registerTrigger: triggers.register,
    preload: () => preload?.(),
  };
  return { controller, closeForChat, syncQueryFromUrl };
}
