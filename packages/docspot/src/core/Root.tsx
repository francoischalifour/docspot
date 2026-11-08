import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { ChatRuntime, ChatSession } from '../chat/contract';
import { getChatInternals } from '../chat/contract';
import { type DocspotMessages, resolveMessages } from '../messages';
import type {
  DocspotEvent,
  DocspotHandoff,
  DocspotNavigate,
  DocspotPage,
  DocspotQuestionSource,
  DocspotRootProps,
  DocspotSearch,
  DocspotSearchResult,
  DocspotSlots,
  DocspotUrlAdapter,
} from '../types';
import {
  createModuleLoader,
  isChatBesidePage,
  isCommandKey,
  isElementVisible,
  isTypingTarget,
  useIdlePreload,
} from './platform';
import {
  type DocspotStores,
  type StoredConversation,
  addConversation,
  createStores,
} from './storage';
import {
  browserUrlAdapter,
  readChatLink,
  readSearchQuery,
  removeChatLink,
  writeSearchQuery,
} from './url';

// The URL follows the typed query once typing pauses.
const QUERY_URL_DELAY_MS = 300;

export const searchDialogLoader = /* @__PURE__ */ createModuleLoader(
  () => import('../search/SearchDialog')
);

/** What another surface, such as search, hands to chat. */
export type ChatRequest =
  | {
      action: 'draft' | 'submit';
      text: string;
      /** Attaches this page; null attaches none; omitted keeps the current one. */
      page?: DocspotPage | null;
      source?: DocspotQuestionSource;
    }
  | { action: 'resume'; conversation: StoredConversation; draft?: string }
  | { action: 'reset' };

/** Follows the page being read unless a request pins another page or none. */
type PageContext = { follow: true } | { page: DocspotPage | undefined };

export type DocspotConfig = {
  search: DocspotSearch | undefined;
  canSearch: boolean;
  canChat: boolean;
  currentPage: DocspotPage | undefined;
  prompts: string[];
  defaultResults: DocspotSearchResult[];
  handoffs: DocspotHandoff[];
  navigate: DocspotNavigate;
  /** Resolves a URL against the canonical origin. */
  toSiteUrl: (url: string) => string;
  /** The in-app path for a URL on this site, or null for other sites. */
  toInternalUrl: (url: string) => string | null;
  slots: DocspotSlots;
  messages: DocspotMessages;
  emit: (event: DocspotEvent) => void;
  stores: DocspotStores;
};

export type SearchController = {
  isOpen: boolean;
  query: string;
  /** Changes when the query comes from the URL rather than from typing. */
  queryVersion: number;
  setQuery: (query: string) => void;
  open: (opener?: HTMLElement, query?: string) => void;
  close: () => void;
  /**
   * Closes search to follow a result. The current history entry keeps the
   * query, so going back reopens search where it was left.
   */
  leave: () => void;
  /** Hands off to chat; without a request it only opens chat. */
  ask: (request?: ChatRequest) => void;
  registerTrigger: (button: HTMLElement | null) => (() => void) | undefined;
  preload: () => void;
};

export type ChatController = {
  isOpen: boolean;
  runtime: ChatRuntime | undefined;
  session: ChatSession | null;
  draft: string;
  setDraft: (draft: string) => void;
  contextPage: DocspotPage | undefined;
  removeContext: () => void;
  composerRef: (composer: HTMLTextAreaElement | null) => void;
  width: number | undefined;
  setWidth: (width: number | undefined) => void;
  ask: (request?: ChatRequest, options?: { focus?: boolean }) => void;
  close: () => void;
  toggle: () => void;
  getActiveConversation: () => StoredConversation | null;
  registerLauncher: (button: HTMLElement | null) => void;
  preload: () => void;
};

type DocspotInternalState = {
  config: DocspotConfig;
  search: SearchController;
  chat: ChatController;
};

export const DocspotInternalContext =
  /* @__PURE__ */ createContext<DocspotInternalState | null>(null);

export function useDocspotInternal(component: string) {
  const state = use(DocspotInternalContext);
  if (!state)
    throw new Error(`Docspot: <${component}> must be inside <Docspot.Root>.`);
  return state;
}

function stripHash(url: string) {
  return url.split('#')[0] ?? url;
}

function samePage(a: DocspotPage | undefined, b: DocspotPage | undefined) {
  return Boolean(a && b && stripHash(a.url) === stripHash(b.url));
}

const defaultNavigate: DocspotNavigate = url => window.location.assign(url);

function warnMissing(capability: string, method: string) {
  console.warn(
    `Docspot: ${method}() needs \`${capability}\`, which this instance does not configure.`
  );
}

export function DocspotRoot(props: DocspotRootProps) {
  const {
    search,
    chat,
    id,
    context,
    loadPage,
    defaultResults,
    handoffs,
    navigate,
    siteUrl,
    history = false,
    syncUrl = false,
    slots,
    messages: messageOverrides,
    onEvent,
    children,
  } = props;
  if (!search && !chat)
    throw new Error('Docspot: configure `search`, `chat`, or both.');
  const canSearch = Boolean(search);
  const canChat = Boolean(chat);

  // Stores change only with the instance identity, never on rerender.
  const stores = useMemo(
    () => createStores({ id, persist: history }),
    [id, history]
  );
  const messages = useMemo(
    () => resolveMessages(messageOverrides),
    [messageOverrides]
  );
  const chatLoader = useMemo(
    () => (chat ? createModuleLoader(getChatInternals(chat).load) : null),
    [chat]
  );
  const url: DocspotUrlAdapter | null =
    syncUrl === true ? browserUrlAdapter : syncUrl || null;
  const currentPage = context?.page;
  const resolvePage = context?.resolvePage;

  const emit = useEffectEvent((event: DocspotEvent) => onEvent?.(event));
  const config: DocspotConfig = {
    search,
    canSearch,
    canChat,
    currentPage,
    prompts: context?.prompts ?? [],
    defaultResults: defaultResults ?? [],
    handoffs: handoffs ?? [],
    navigate: navigate ?? defaultNavigate,
    toSiteUrl: url => new URL(url, siteUrl ?? window.location.href).href,
    toInternalUrl(url) {
      try {
        const target = new URL(url, window.location.href);
        const origins = [
          window.location.origin,
          siteUrl && new URL(siteUrl).origin,
        ];
        return origins.includes(target.origin)
          ? `${target.pathname}${target.search}${target.hash}`
          : null;
      } catch {
        return null;
      }
    },
    slots: slots ?? {},
    messages,
    emit,
    stores,
  };

  // ── Search ────────────────────────────────────────────────────────────
  const [searchState, setSearchState] = useState({
    isOpen: false,
    query: '',
    version: 0,
  });
  const searchOpenRef = useRef(false);
  searchOpenRef.current = searchState.isOpen;
  const searchQueryRef = useRef('');
  searchQueryRef.current = searchState.query;
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const triggersRef = useRef(new Set<HTMLElement>());
  const queryWriteRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The query this instance last wrote, so its own URL writes are ignored.
  const writtenQueryRef = useRef<string | null>(null);

  function writeQuery(query: string | null, replace: boolean) {
    if (!url || !canSearch) return;
    writtenQueryRef.current = query;
    url.write(writeSearchQuery(url.read(), query), { replace });
  }

  function findVisibleTrigger() {
    return [...triggersRef.current].find(isElementVisible) ?? null;
  }

  function openSearch(opener?: HTMLElement, query = '') {
    if (!canSearch) return warnMissing('search', 'openSearch');
    search?.preload?.();
    const focused = document.activeElement;
    // Closing search returns to the chat composer it was opened from.
    restoreFocusRef.current =
      opener ??
      (focused instanceof HTMLElement && focused.closest('[data-docspot-chat]')
        ? focused
        : findVisibleTrigger());
    clearTimeout(queryWriteRef.current);
    setSearchState(state => ({
      isOpen: true,
      query,
      version: query ? state.version + 1 : state.version,
    }));
    if (!searchOpenRef.current) emit({ type: 'search.open' });
    writeQuery(query, searchOpenRef.current);
  }

  function closeSearch({ writeUrl = true } = {}) {
    // A pending write would reopen search if it ran after the close.
    clearTimeout(queryWriteRef.current);
    if (searchOpenRef.current) emit({ type: 'search.close' });
    setSearchState(state => ({ ...state, isOpen: false }));
    if (writeUrl) writeQuery(null, true);
  }

  function leaveSearch() {
    clearTimeout(queryWriteRef.current);
    if (searchOpenRef.current) writeQuery(searchQueryRef.current, true);
    closeSearch({ writeUrl: false });
  }

  function setSearchQuery(query: string) {
    setSearchState(state => ({ ...state, query }));
    clearTimeout(queryWriteRef.current);
    queryWriteRef.current = setTimeout(() => {
      if (searchOpenRef.current) writeQuery(query, true);
    }, QUERY_URL_DELAY_MS);
  }

  useEffect(() => () => clearTimeout(queryWriteRef.current), []);

  const restoreSearchFocus = useEffectEvent(() => {
    const target = restoreFocusRef.current;
    if (target === null) return;
    // The reader stays where they were in the page.
    if (isElementVisible(target)) target.focus({ preventScroll: true });
    else findVisibleTrigger()?.focus({ preventScroll: true });
  });
  const wasSearchOpen = useRef(false);
  useEffect(() => {
    if (wasSearchOpen.current && !searchState.isOpen) restoreSearchFocus();
    wasSearchOpen.current = searchState.isOpen;
  }, [searchState.isOpen]);

  // ── Chat ──────────────────────────────────────────────────────────────
  const panel = useSyncExternalStore(
    stores.panel.subscribe,
    stores.panel.get,
    () => stores.panel.get()
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [runtime, setRuntime] = useState<ChatRuntime | undefined>(() =>
    chatLoader?.get()
  );
  const [session, setSession] = useState<ChatSession | null>(null);
  const [pageContext, setPageContext] = useState<PageContext>({
    follow: true,
  });
  const [focusRequest, setFocusRequest] = useState(0);
  // Async requests read the latest conversation, not the one they started with.
  const sessionRef = useRef<ChatSession | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const focusPendingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLElement | null>(null);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = isChatOpen;

  function getContextPage(context: PageContext) {
    return 'follow' in context ? currentPage : context.page;
  }

  function resolve(page: DocspotPage): DocspotPage {
    if (samePage(page, currentPage)) return { ...currentPage, ...page };
    const known = resolvePage?.(page.url);
    return known ? { ...page, ...known } : page;
  }

  /** A page named by a link; one the site does not know attaches nothing. */
  function resolveLinkPage(url: string): DocspotPage | null {
    if (!resolvePage) return { url };
    if (samePage({ url }, currentPage)) return currentPage ?? null;
    return resolvePage(url) ?? null;
  }

  function contextFor(page: DocspotPage | null): PageContext {
    if (!page) return { page: undefined };
    return samePage(page, currentPage)
      ? { follow: true }
      : { page: resolve(page) };
  }

  function setDraft(draft: string) {
    stores.panel.set(state => ({ ...state, draft }));
  }

  function setChatOpen(open: boolean) {
    if (open !== chatOpenRef.current)
      emit({ type: open ? 'chat.open' : 'chat.close' });
    setIsChatOpen(open);
    // A full-screen panel would cover the page on the next visit.
    stores.panel.set(state => ({ ...state, open: open && isChatBesidePage() }));
  }

  function loadRuntime() {
    if (!chatLoader) return Promise.reject(new Error('Chat is not configured'));
    return chatLoader.load().then(loaded => {
      setRuntime(() => loaded);
      return loaded;
    });
  }

  function saveConversation(conversation: StoredConversation) {
    stores.conversations.set(list => addConversation(list, conversation));
  }

  function createSession(
    loaded: ChatRuntime,
    saved?: StoredConversation
  ): ChatSession {
    return loaded.createSession(saved, {
      loadPage,
      siteUrl,
      onSave: saveConversation,
      onEvent: emit,
    });
  }

  function replaceSession(loaded: ChatRuntime, next: ChatSession) {
    if (sessionRef.current) loaded.stop(sessionRef.current);
    sessionRef.current = next;
    setSession(next);
    stores.panel.set(state => ({ ...state, conversationId: next.id }));
    return next;
  }

  function findLastConversation() {
    const id = stores.panel.get().conversationId;
    return stores.conversations.get().find(item => item.id === id);
  }

  function showChat() {
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      focused !== document.body &&
      !focused.closest('[data-docspot-chat], [data-docspot-search]')
    )
      returnFocusRef.current = focused;
    setChatOpen(true);
  }

  function applyRequest(loaded: ChatRuntime, request: ChatRequest | undefined) {
    const current = sessionRef.current;
    // Opening without a request shows the last active conversation.
    if (!request) {
      if (!current)
        replaceSession(loaded, createSession(loaded, findLastConversation()));
      return;
    }
    if (request.action === 'reset') {
      replaceSession(loaded, createSession(loaded));
      setPageContext({ follow: true });
      setDraft('');
      emit({ type: 'conversation.new' });
      return;
    }
    if (request.action === 'resume') {
      // The attached page stays the one being read, not the chat's old page.
      if (current?.id !== request.conversation.id) {
        replaceSession(loaded, createSession(loaded, request.conversation));
        setPageContext({ follow: true });
        setDraft(request.draft ?? '');
        emit({
          type: 'conversation.resume',
          conversationId: request.conversation.id,
        });
      } else if (request.draft !== undefined) setDraft(request.draft);
      return;
    }
    const nextContext =
      request.page === undefined ? pageContext : contextFor(request.page);
    setPageContext(nextContext);
    const target = current ?? replaceSession(loaded, createSession(loaded));
    if (request.action === 'draft') {
      setDraft(request.text);
      return;
    }
    setDraft('');
    void loaded.ask(
      target,
      request.text,
      getContextPage(nextContext),
      request.source ?? 'api'
    );
  }

  function askChat(request?: ChatRequest, { focus = true } = {}) {
    if (!chatLoader) return warnMissing('chat', 'ask');
    showChat();
    function settle(loaded: ChatRuntime) {
      applyRequest(loaded, request);
      // After the request, so a replaced conversation's composer gets focus.
      if (focus) setFocusRequest(count => count + 1);
    }
    // Usually preloaded, so the panel opens with its conversation at once.
    const loaded = chatLoader.get();
    if (loaded) settle(loaded);
    else void loadRuntime().then(settle);
  }

  function closeChat() {
    if (!chatOpenRef.current) return;
    setChatOpen(false);
    // After the launcher reappears, so focus can return to it.
    requestAnimationFrame(() => {
      const target = returnFocusRef.current;
      if (isElementVisible(target)) target!.focus({ preventScroll: true });
      else if (isElementVisible(launcherRef.current))
        launcherRef.current!.focus({ preventScroll: true });
      else findVisibleTrigger()?.focus({ preventScroll: true });
    });
  }

  function toggleChat() {
    if (chatOpenRef.current) closeChat();
    else askChat();
  }

  function attachComposer(composer: HTMLTextAreaElement | null) {
    composerRef.current = composer;
    if (composer && focusPendingRef.current) {
      focusPendingRef.current = false;
      composer.focus({ preventScroll: true });
    }
  }

  // The composer may still be loading; it takes focus once it mounts.
  useEffect(() => {
    if (!focusRequest) return;
    if (composerRef.current) composerRef.current.focus({ preventScroll: true });
    else focusPendingRef.current = true;
  }, [focusRequest]);

  // A reload reopens the panel where it sits beside the page.
  const restorePanel = useEffectEvent(() => {
    const link = url && canChat ? readChatLink(url.read()) : null;
    if (!link && stores.panel.get().open && isChatBesidePage())
      askChat(undefined, { focus: false });
  });
  useEffect(() => {
    if (canChat) restorePanel();
  }, [canChat]);

  useEffect(
    () => () => {
      const current = sessionRef.current;
      if (current) chatLoader?.get()?.stop(current);
    },
    [chatLoader]
  );

  // ── URL ───────────────────────────────────────────────────────────────
  const pendingLinkRef = useRef<string | null>(null);
  const syncFromUrl = useEffectEvent(() => {
    if (!url) return;
    const search = url.read();
    if (canSearch) {
      const query = readSearchQuery(search);
      if (query === null) {
        if (searchOpenRef.current) closeSearch({ writeUrl: false });
      } else if (!searchOpenRef.current) {
        restoreFocusRef.current = findVisibleTrigger();
        writtenQueryRef.current = query;
        setSearchState(state => ({
          isOpen: true,
          query,
          version: state.version + 1,
        }));
        emit({ type: 'search.open' });
      } else if (query !== writtenQueryRef.current) {
        // A query from history or a link replaces what was typed.
        writtenQueryRef.current = query;
        setSearchState(state => ({
          ...state,
          query,
          version: state.version + 1,
        }));
      }
    }
    // Links such as ?prompt= open chat, then leave the URL. Routers may
    // report the same location again before the removal lands.
    const link = canChat ? readChatLink(search) : null;
    const linkKey = link && JSON.stringify(link);
    if (linkKey === pendingLinkRef.current) return;
    pendingLinkRef.current = linkKey;
    if (link) {
      void loadRuntime().then(() => {
        url.write(removeChatLink(url.read()), { replace: true });
        askChat({
          action: link.action,
          text: link.text,
          page: link.pageUrl ? resolveLinkPage(link.pageUrl) : undefined,
          source: 'url',
        });
      });
    }
  });
  useEffect(() => {
    if (!url) return;
    syncFromUrl();
    return url.subscribe(syncFromUrl);
  }, [url]);

  // ── Shortcuts and preloading ──────────────────────────────────────────
  const onGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (canSearch && !searchOpenRef.current) {
      // A held shortcut repeats keydown; only the first press opens search.
      if (isCommandKey(event, 'k')) {
        event.preventDefault();
        if (!event.repeat) openSearch();
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
        openSearch();
        return;
      }
    }
    if (canChat && isCommandKey(event, 'j')) {
      event.preventDefault();
      if (!event.repeat) toggleChat();
    }
  });
  useEffect(() => {
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const preloadSearch = useMemo(
    () =>
      search
        ? () => {
            void searchDialogLoader.load().catch(() => {});
            search.preload?.();
          }
        : undefined,
    [search]
  );
  const preloadChat = useMemo(
    () =>
      chatLoader
        ? () =>
            void chatLoader.load().then(
              loaded => setRuntime(() => loaded),
              () => {}
            )
        : undefined,
    [chatLoader]
  );
  useIdlePreload(preloadSearch);
  useIdlePreload(preloadChat);

  const searchController: SearchController = {
    isOpen: searchState.isOpen,
    query: searchState.query,
    queryVersion: searchState.version,
    setQuery: setSearchQuery,
    open: (opener, query) => openSearch(opener, query),
    close: () => closeSearch(),
    leave: leaveSearch,
    ask(request) {
      restoreFocusRef.current = null;
      closeSearch();
      askChat(request);
    },
    registerTrigger(button) {
      if (!button) return;
      triggersRef.current.add(button);
      return () => {
        triggersRef.current.delete(button);
      };
    },
    preload: () => preloadSearch?.(),
  };

  const chatController: ChatController = {
    isOpen: isChatOpen,
    runtime,
    session,
    draft: panel.draft,
    setDraft,
    contextPage: getContextPage(pageContext),
    removeContext: () => setPageContext({ page: undefined }),
    composerRef: attachComposer,
    width: panel.width,
    setWidth: width => stores.panel.set(state => ({ ...state, width })),
    ask: askChat,
    close: closeChat,
    toggle: toggleChat,
    getActiveConversation: () =>
      sessionRef.current && runtime
        ? runtime.toConversation(sessionRef.current)
        : null,
    registerLauncher(button) {
      launcherRef.current = button;
    },
    preload: () => preloadChat?.(),
  };

  return (
    <DocspotInternalContext
      value={{ config, search: searchController, chat: chatController }}
    >
      {children}
    </DocspotInternalContext>
  );
}

export type DocspotApi = {
  capabilities: { search: boolean; chat: boolean };
  isSearchOpen: boolean;
  isChatOpen: boolean;
  /** Opens search, optionally with a query. */
  openSearch: (query?: string) => void;
  closeSearch: () => void;
  /** Opens chat on its last conversation. */
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  /** Opens chat with text in the composer, ready to edit. */
  setDraft: (text: string, options?: { page?: DocspotPage | null }) => void;
  /** Opens chat and sends a question, replacing any answer in progress. */
  submitQuestion: (
    question: string,
    options?: { page?: DocspotPage | null }
  ) => void;
  /** Opens chat on a new, empty conversation. */
  startConversation: () => void;
  /** Closes search and chat. */
  close: () => void;
};

/** Controls Docspot from anywhere inside `<Docspot.Root>`. */
export function useDocspot(): DocspotApi {
  const { config, search, chat } = useDocspotInternal('useDocspot');
  return {
    capabilities: { search: config.canSearch, chat: config.canChat },
    isSearchOpen: search.isOpen,
    isChatOpen: chat.isOpen,
    openSearch(query) {
      if (!config.canSearch) return warnMissing('search', 'openSearch');
      search.open(undefined, query);
    },
    closeSearch: search.close,
    openChat: () => chat.ask(),
    closeChat: chat.close,
    toggleChat: chat.toggle,
    setDraft: (text, options) =>
      chat.ask({ action: 'draft', text, page: options?.page, source: 'api' }),
    submitQuestion: (question, options) =>
      chat.ask({
        action: 'submit',
        text: question,
        page: options?.page,
        source: 'api',
      }),
    startConversation: () => chat.ask({ action: 'reset' }),
    close() {
      if (search.isOpen) search.close();
      if (chat.isOpen) chat.close();
    },
  };
}
