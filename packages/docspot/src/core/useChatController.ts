import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { ChatRuntime, ChatSession } from '@/chat/contract';
import type { DocspotPage, DocspotRootProps, DocspotUrlAdapter } from '@/types';
import {
  type ChatIntent,
  type ChatLifecycle,
  type ChatLifecycleEvent,
  chatLifecycle,
  closedChat,
  pendingIntent,
} from '@/core/chatLifecycle';
import {
  type ChatController,
  type ChatRequest,
  type DocspotConfig,
  chatFrameLoader,
  warnMissing,
} from '@/core/context';
import {
  createModuleLoader,
  isChatBesidePage,
  isElementVisible,
  useIdlePreload,
} from '@/core/platform';
import {
  type StoredConversation,
  addConversation,
  defaultPanelState,
} from '@/core/storage';
import type { TriggerRegistry } from '@/core/useTriggerRegistry';
import { isSamePage, readChatLink, removeChatLink } from '@/core/url';

/** Follows the page being read unless a request pins another page or none. */
type PageContext = { follow: true } | { page: DocspotPage | undefined };

type ChatLoader = ReturnType<typeof createModuleLoader<ChatRuntime>>;

/** Wait before retrying a failed runtime load once. */
const STARTUP_RETRY_DELAY_MS = 350;

/**
 * Chat's lifecycle, conversation, draft, and attached page. The lifecycle
 * is an explicit state machine in `chatLifecycle`; this hook runs the side
 * effects of its transitions.
 */
export function useChatController(
  props: DocspotRootProps,
  config: DocspotConfig,
  url: DocspotUrlAdapter | null,
  chatLoader: ChatLoader | null,
  triggers: TriggerRegistry
) {
  const { loadPage, siteUrl, context } = props;
  const { canChat, emit, stores, currentPage } = config;
  const resolvePage = context?.resolvePage;

  const panel = useSyncExternalStore(
    stores.panel.subscribe,
    stores.panel.get,
    () => defaultPanelState
  );
  const runtime = chatLoader?.get();
  const [lifecycle, setLifecycle] = useState<ChatLifecycle>(closedChat);
  // Async results check the latest state, not the one they started with.
  const lifecycleRef = useRef(lifecycle);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [pageContext, setPageContext] = useState<PageContext>({
    follow: true,
  });
  const [focusRequest, setFocusRequest] = useState(0);
  const sessionRef = useRef<ChatSession | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const focusPendingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLElement | null>(null);
  // The chat link being applied, so a router reporting it again is ignored.
  const pendingLinkRef = useRef<string | null>(null);

  /**
   * Applies a lifecycle event and returns whether it changed the state, so
   * callers run a transition's effects once, and never for a stale intent.
   */
  function dispatch(event: ChatLifecycleEvent) {
    const previous = lifecycleRef.current;
    const next = chatLifecycle(previous, event);
    if (next === previous) return false;
    lifecycleRef.current = next;
    setLifecycle(next);
    const wasShown = previous.status !== 'closed';
    const isShown = next.status !== 'closed';
    if (wasShown !== isShown && event.type !== 'reset') {
      emit({ type: isShown ? 'chat.open' : 'chat.close' });
      // A full-screen panel would cover the page on the next visit.
      stores.panel.set(state => ({
        ...state,
        open: isShown && isChatBesidePage(),
      }));
    }
    return true;
  }

  function getContextPage(context: PageContext) {
    return 'follow' in context ? currentPage : context.page;
  }

  function resolve(page: DocspotPage): DocspotPage {
    if (isSamePage(page, currentPage)) return { ...currentPage, ...page };
    const known = resolvePage?.(page.url);
    return known ? { ...page, ...known } : page;
  }

  /** A page named by a link; one the site does not know attaches nothing. */
  function resolveLinkPage(url: string): DocspotPage | null {
    if (!resolvePage) return { url };
    if (isSamePage({ url }, currentPage)) return currentPage ?? null;
    return resolvePage(url) ?? null;
  }

  function contextFor(page: DocspotPage | null): PageContext {
    if (!page) return { page: undefined };
    return isSamePage(page, currentPage)
      ? { follow: true }
      : { page: resolve(page) };
  }

  function setDraft(draft: string) {
    stores.panel.set(state => ({ ...state, draft }));
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

  /** Remembers where focus was, to return there when chat closes. */
  function captureReturnFocus() {
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      focused !== document.body &&
      !focused.closest('[data-docspot-chat], [data-docspot-search]')
    )
      returnFocusRef.current = focused;
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

  function consumeLink(key?: string) {
    if (!key || !url || JSON.stringify(readChatLink(url.read())) !== key)
      return;
    url.write(removeChatLink(url.read()), { replace: true });
    if (!readChatLink(url.read())) pendingLinkRef.current = null;
  }

  /** Opens chat and applies the request once the runtime has loaded. */
  function openNow(
    request?: ChatRequest,
    { focus = true, linkKey }: { focus?: boolean; linkKey?: string } = {}
  ) {
    if (!chatLoader) {
      warnMissing('chat');
      return;
    }
    const previous = pendingIntent(lifecycleRef.current);
    const intent: ChatIntent = { request, focus, linkKey };
    if (previous?.linkKey !== linkKey) consumeLink(previous?.linkKey);
    captureReturnFocus();
    dispatch({ type: 'open', intent });

    const loaded = chatLoader.get();
    if (loaded) return settle(intent, loaded);
    const loader = chatLoader;
    async function loadWithRetry() {
      try {
        return await loader.load();
      } catch {
        await new Promise(resolve =>
          setTimeout(resolve, STARTUP_RETRY_DELAY_MS)
        );
        if (pendingIntent(lifecycleRef.current) === intent)
          return loader.load();
      }
    }
    void loadWithRetry().then(
      loaded => {
        if (loaded) settle(intent, loaded);
      },
      () => dispatch({ type: 'loadFailed', intent })
    );
  }

  function settle(intent: ChatIntent, loaded: ChatRuntime) {
    if (!dispatch({ type: 'loaded', intent })) return;
    consumeLink(intent.linkKey);
    applyRequest(loaded, intent.request);
    if (intent.focus) setFocusRequest(count => count + 1);
  }

  function closeNow() {
    const pending = pendingIntent(lifecycleRef.current);
    if (!dispatch({ type: 'close' })) return;
    consumeLink(pending?.linkKey);
    // After the launcher reappears, so focus can return to it.
    requestAnimationFrame(() => {
      const target = returnFocusRef.current;
      if (target && isElementVisible(target))
        target.focus({ preventScroll: true });
      else if (launcherRef.current && isElementVisible(launcherRef.current))
        launcherRef.current.focus({ preventScroll: true });
      else triggers.findVisible()?.focus({ preventScroll: true });
    });
  }

  // ── Controlled open state ───────────────────────────────────────────
  const isControlled = props.chatOpen !== undefined;
  const chatOpenRef = useRef(props.chatOpen);
  chatOpenRef.current = props.chatOpen;
  // A request made while a parent keeps chat closed, applied once it opens.
  const deferredRef = useRef<{
    request?: ChatRequest;
    options: { focus?: boolean; linkKey?: string };
  } | null>(null);

  /**
   * Asks to open chat with a request. A parent controlling `chatOpen`
   * decides; the request waits until it opens chat.
   */
  function requestChat(
    request?: ChatRequest,
    options: { focus?: boolean; linkKey?: string } = {}
  ) {
    if (isControlled && !chatOpenRef.current) {
      if (!chatLoader) return openNow(request, options);
      deferredRef.current = { request, options };
      props.onChatOpenChange?.(true);
      return;
    }
    if (lifecycleRef.current.status === 'closed')
      props.onChatOpenChange?.(true);
    openNow(request, options);
  }

  /** Asks to close chat; a parent controlling `chatOpen` decides. */
  function close() {
    deferredRef.current = null;
    if (isControlled) {
      if (chatOpenRef.current) props.onChatOpenChange?.(false);
      return;
    }
    if (lifecycleRef.current.status !== 'closed')
      props.onChatOpenChange?.(false);
    closeNow();
  }

  // A parent controlling `chatOpen` opens and closes chat by changing it.
  const followChatOpen = useEffectEvent((open: boolean) => {
    if (open) {
      if (lifecycleRef.current.status !== 'closed') return;
      const deferred = deferredRef.current;
      deferredRef.current = null;
      openNow(deferred?.request, deferred?.options);
    } else if (lifecycleRef.current.status !== 'closed') closeNow();
  });
  useEffect(() => {
    if (props.chatOpen !== undefined) followChatOpen(props.chatOpen);
  }, [props.chatOpen]);

  function toggle() {
    if (lifecycleRef.current.status === 'closed') requestChat();
    else close();
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
      requestChat(undefined, { focus: false });
  });
  useEffect(() => {
    if (canChat) restorePanel();
  }, [canChat, stores]);

  // A pending load and its session belong to the same transport and history namespace.
  useLayoutEffect(() => {
    dispatch({ type: 'reset' });
    setSession(null);
    setPageContext({ follow: true });
    return () => {
      const current = sessionRef.current;
      if (current) chatLoader?.get()?.stop(current);
      sessionRef.current = null;
      focusPendingRef.current = false;
      pendingLinkRef.current = null;
    };
  }, [chatLoader]);

  /**
   * Follows chat links such as `?prompt=`: opens chat with them, then
   * removes them. Routers may report the same location again before the
   * removal lands.
   */
  function syncLinkFromUrl(search: string) {
    const link = canChat ? readChatLink(search) : null;
    const linkKey = link && JSON.stringify(link);
    if (linkKey === pendingLinkRef.current) return;
    pendingLinkRef.current = linkKey;
    if (link && linkKey) {
      requestChat(
        {
          action: link.action,
          text: link.text,
          page: link.pageUrl ? resolveLinkPage(link.pageUrl) : undefined,
          source: 'url',
        },
        { linkKey }
      );
    } else if (pendingIntent(lifecycleRef.current)?.linkKey) close();
  }

  const preload = useMemo(
    () =>
      chatLoader
        ? () => {
            void chatFrameLoader.load().catch(() => {});
            if (!pendingIntent(lifecycleRef.current))
              void chatLoader.load().catch(() => {});
          }
        : undefined,
    [chatLoader]
  );
  useIdlePreload(config.preload ? preload : undefined);

  const pending = pendingIntent(lifecycle);
  const controller: ChatController = {
    isOpen: lifecycle.status !== 'closed',
    focusStartup: pending?.focus ?? false,
    retryStartup:
      lifecycle.status === 'failed'
        ? () => openNow(lifecycle.intent.request, lifecycle.intent)
        : undefined,
    runtime,
    session,
    draft: panel.draft,
    setDraft,
    contextPage: getContextPage(pageContext),
    removeContext: () => setPageContext({ page: undefined }),
    composerRef: attachComposer,
    width: panel.width,
    setWidth: width => stores.panel.set(state => ({ ...state, width })),
    open(request, options) {
      if (!request && pendingIntent(lifecycleRef.current)) return;
      requestChat(request, options);
    },
    close,
    toggle,
    getActiveConversation: () =>
      sessionRef.current && runtime
        ? runtime.toConversation(sessionRef.current)
        : null,
    registerLauncher(button) {
      launcherRef.current = button;
    },
    preload: () => preload?.(),
  };
  return { controller, requestChat, syncLinkFromUrl };
}
