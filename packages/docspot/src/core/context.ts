// What Docspot's parts share: the configuration, the search and chat
// controllers, and the modules that load on demand.
import { createContext, use } from 'react';

import type { ChatRuntime, ChatSession } from '@/chat/contract';
import type { DocspotMessages } from '@/messages';
import type { recentItems } from '@/search/items';
import type {
  DocspotEvent,
  DocspotHandoff,
  DocspotItem,
  DocspotNavigate,
  DocspotPage,
  DocspotQuestionSource,
  DocspotResult,
  DocspotSearch,
  DocspotSearchResponse,
  DocspotSlots,
} from '@/types';
import { createModuleLoader } from '@/core/platform';
import type { DocspotStores, StoredConversation } from '@/core/storage';

export const searchDialogFrameLoader = /* @__PURE__ */ createModuleLoader(
  () => import('@/search/SearchDialogFrame')
);

export const chatFrameLoader = /* @__PURE__ */ createModuleLoader(
  () => import('@/core/ChatPanelFrame')
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

export type DocspotConfig = {
  chatPanelId: string;
  owner: HTMLElement | Document | null;
  search: DocspotSearch | undefined;
  canSearch: boolean;
  canChat: boolean;
  currentPage: DocspotPage | undefined;
  prompts: string[];
  defaultItems: Array<DocspotResult | DocspotItem | typeof recentItems>;
  handoffs: DocspotHandoff[];
  items: DocspotItem[];
  navigate: DocspotNavigate;
  /** Whether search and chat load ahead of use. */
  preload: boolean;
  /** Resolves a URL against the canonical origin. */
  toSiteUrl: (url: string) => string;
  /** The in-app path for a URL on this site, or null for other sites. */
  toInternalUrl: (url: string) => string | null;
  slots: DocspotSlots;
  messages: DocspotMessages;
  emit: (event: DocspotEvent) => void;
  stores: DocspotStores;
};

/** Opens a URL with `navigate`, then closes search once it settles. */
export type SearchLeave = (...args: Parameters<DocspotNavigate>) => void;

export type SearchController = {
  isOpen: boolean;
  query: string;
  /** Changes when the query comes from the URL rather than from typing. */
  queryVersion: number;
  setQuery: (query: string) => void;
  open: (opener?: HTMLElement, query?: string) => void;
  close: () => void;
  /**
   * Opens a URL with `navigate` and closes search once it settles. The
   * current history entry keeps the query, so going back reopens search
   * where it was left.
   */
  leave: SearchLeave;
  /** Whether search waits for a navigation before closing. */
  isLeaving: boolean;
  /**
   * The response to the query search opened with, once, if it matches:
   * sent while the dialog loaded. Aborting `signal` aborts it.
   */
  takeEarlySearch: (
    query: string,
    signal: AbortSignal
  ) => Promise<DocspotSearchResponse> | null;
  /** Closes search and opens chat, with a request such as a question. */
  openChat: (request?: ChatRequest) => void;
  registerTrigger: (button: HTMLElement | null) => (() => void) | undefined;
  preload: () => void;
};

export type ChatController = {
  isOpen: boolean;
  retryStartup?: () => void;
  focusStartup: boolean;
  /**
   * Whether what is typed while chat starts goes to the draft: chat opens
   * for the reader to type, without a request that would replace it.
   */
  keepsTyping: boolean;
  runtime: ChatRuntime | undefined;
  session: ChatSession | null;
  draft: string;
  setDraft: (draft: string) => void;
  contextPage: DocspotPage | undefined;
  removeContext: () => void;
  composerRef: (composer: HTMLTextAreaElement | null) => void;
  width: number | undefined;
  setWidth: (width: number | undefined) => void;
  /** Opens chat on its last conversation, or applies a request. */
  open: (request?: ChatRequest, options?: { focus?: boolean }) => void;
  close: () => void;
  toggle: () => void;
  getActiveConversation: () => StoredConversation | null;
  registerLauncher: (button: HTMLElement | null) => void;
  preload: () => void;
};

export type DocspotInternalState = {
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

/** Explains a call that needs a capability this instance does not set. */
export function warnMissing(capability: 'search' | 'chat') {
  console.warn(
    `Docspot: opening ${capability} needs the \`${capability}\` prop, which this instance does not set.`
  );
}
