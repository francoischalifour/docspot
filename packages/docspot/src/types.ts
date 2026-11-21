import type { ComponentType, MouseEvent, ReactNode } from 'react';

import type { DocspotMessagesInput } from './messages';
import type { recentItems } from './search/items';

/** A run of text, marked when it matched the query. */
export type HighlightSegment = { text: string; highlighted: boolean };
export type HighlightedText = HighlightSegment[];

/** What choosing an item does: a URL opens that page, a function runs. */
export type DocspotAction = string | ((context: DocspotActionContext) => void);

export type DocspotActionContext = {
  /** The query the item was chosen for; empty before typing. */
  query: string;
};

type DocspotItemFields = {
  /** The item's own title: a page title, a section heading, or what it does. */
  title: string;
  /** Items sharing a group are listed together, in first-appearance order. */
  group?: string;
  /** Replaces the default icon, and the `resultIcon` slot. */
  icon?: ReactNode;
  /** Explains an action, or a link to another site, in the preview. */
  description?: string;
  /** Other words that find it among `items`, such as synonyms. */
  keywords?: string[];
  /**
   * The keys that run it outside search, as `aria-keyshortcuts` writes them,
   * such as `Meta+S` or `Shift+Meta+Z`. Shown beside its title.
   */
  shortcut?: string;
  /** The page a section belongs to. Defaults to the title. */
  pageTitle?: string;
  /** Where the item sits, from the top level down, excluding the title. */
  breadcrumb?: string[];
  /** A short passage around the match. */
  excerpt?: string;
  /** Sections are parts of a page; pages are whole pages. */
  type?: 'page' | 'section';
  /** Matched text, when the provider reports it. */
  highlights?: {
    title?: HighlightedText;
    breadcrumb?: HighlightedText[];
    excerpt?: HighlightedText;
  };
  /** Provider- or site-specific data, passed through to slots. */
  data?: unknown;
};

/**
 * Something search lists: a page to open, or something to do, such as
 * switching the theme. Choosing an item closes search. Only URL items are
 * pages: they join recent pages and can be copied or opened in a tab.
 */
export type DocspotItem = DocspotItemFields &
  (
    | {
        action: string;
        /** Unique within a list. Defaults to the URL. */
        id?: string;
      }
    | {
        action: (context: DocspotActionContext) => void;
        /** Unique within a list. */
        id: string;
      }
  );

/** An item whose action is a URL. */
export type DocspotLinkItem = Extract<DocspotItem, { action: string }>;

export type DocspotSearchResponse =
  | DocspotItem[]
  | {
      items: DocspotItem[];
      /** Offers the question to chat before the results. */
      prioritizeChat?: boolean;
    };

export type DocspotSearchParams = { query: string; signal: AbortSignal };

export type DocspotSearch = ((
  params: DocspotSearchParams
) => DocspotSearchResponse | Promise<DocspotSearchResponse>) & {
  /**
   * Gets ready for the first query, for example by loading an index or
   * opening a connection. Docspot calls it once the page is idle, when a
   * trigger is hovered or focused, and when search opens.
   */
  preload?: () => void;
};

/** A documentation page that chat can use as context. */
export type DocspotPage = {
  url: string;
  title?: string;
  /** Questions to suggest while this page is attached. */
  prompts?: string[];
};

export type DocspotPageContent = {
  /** Usually Markdown. */
  content: string;
  title?: string;
};

export type DocspotLoadPage = (
  page: DocspotPage,
  options: { signal: AbortSignal }
) => Promise<DocspotPageContent | string | null>;

export type DocspotContextInput = {
  /** The page being read. Chat attaches it to questions until removed. */
  page?: DocspotPage;
  /** Questions suggested when the attached page has none. */
  prompts?: string[];
  /**
   * Describes pages referenced by URL, such as `askPage` links, normalizing
   * their URL. Returning undefined ignores a page the site does not know.
   */
  resolvePage?: (url: string) => DocspotPage | undefined;
};

export type DocspotNavigate = (
  url: string,
  options: { event?: MouseEvent<HTMLElement> }
) => void;

/** Reads and writes the URL's query string, for routers that own history. */
export type DocspotUrlAdapter = {
  /** The current query string, with or without the leading `?`. */
  read: () => string;
  write: (search: string, options: { replace: boolean }) => void;
  /** Called on every location change, including back and forward. */
  subscribe: (listener: () => void) => () => void;
};

/**
 * Search is a modal dialog in the browser's top layer, so slots render
 * popups inside it and report feedback with `notify` rather than toasts
 * elsewhere on the page.
 */
export type DocspotPreviewProps = {
  item: DocspotLinkItem;
  query: string;
  /** Opens a URL and closes search. */
  navigate: (url: string) => void;
  /** Shows a short status message inside search. */
  notify: (message: string) => void;
};

export type DocspotPageActionsProps = {
  item: DocspotLinkItem;
  query: string;
  close: () => void;
  /** Shows a short status message inside search. */
  notify: (message: string) => void;
};

export type DocspotShortcutProps = {
  /** As `aria-keyshortcuts` writes it, such as `Meta+S`. */
  shortcut: string;
};

export type DocspotResultIconProps = {
  item: DocspotItem;
  recent: boolean;
};

export type DocspotSlots = {
  /**
   * Renders the active result's content beside the results. May suspend.
   * The preview opens at the element whose `data-docspot-anchor` or `id`
   * matches the result URL's hash.
   */
  preview?: ComponentType<DocspotPreviewProps>;
  /** Credits the search provider in the dialog footer. */
  branding?: ComponentType;
  /** Extra actions for the previewed result, such as copying Markdown. */
  pageActions?: ComponentType<DocspotPageActionsProps>;
  /** Replaces the default icons of items without their own `icon`. */
  resultIcon?: ComponentType<DocspotResultIconProps>;
  /** Replaces how an item's shortcut is drawn. */
  shortcut?: ComponentType<DocspotShortcutProps>;
};

export type DocspotQuestionSource =
  | 'composer'
  | 'prompt'
  | 'search'
  | 'url'
  | 'api';

export type DocspotEvent =
  | { type: 'search.open' }
  | { type: 'search.close' }
  | { type: 'search.results'; query: string; count: number }
  | {
      type: 'search.select';
      query: string;
      item: DocspotItem;
      position: number;
    }
  | { type: 'search.error'; query: string; error: unknown }
  | { type: 'search.handoff'; query: string; handoff: string; url: string }
  | { type: 'history.clear' }
  | { type: 'chat.open' }
  | { type: 'chat.close' }
  | {
      type: 'chat.submit';
      conversationId: string;
      question: string;
      page?: string;
      source: DocspotQuestionSource;
    }
  | { type: 'chat.answer'; conversationId: string }
  | { type: 'chat.error'; conversationId: string; error: unknown }
  | { type: 'chat.stop'; conversationId: string }
  | { type: 'chat.retry'; conversationId: string }
  | { type: 'conversation.new' }
  | { type: 'conversation.resume'; conversationId: string }
  | { type: 'conversation.delete'; conversationId: string }
  | { type: 'conversation.clear' };

declare const chatBrand: unique symbol;

/** What a handoff can use to build its URL. */
export type DocspotHandoffContext = {
  /** The query's search results, best first. Empty when search failed. */
  items: DocspotItem[];
};

/**
 * Sends the query to another site, such as a general assistant. Handoffs
 * follow the results once a query is typed, open in a new tab, and stay out
 * of recent pages.
 */
export type DocspotHandoff = {
  id: string;
  /** Such as "Ask ChatGPT". */
  title: string;
  icon?: ReactNode;
  /** Explains the handoff in the preview. */
  description?: string;
  getUrl: (query: string, context: DocspotHandoffContext) => string;
};

/** Chat created by `createChat` from `docspot/chat` or a provider integration. */
export type DocspotChat = { readonly [chatBrand]: true };

type DocspotSharedProps = {
  /** Scopes persisted history, for several Docspot instances on one origin. */
  id?: string;
  context?: DocspotContextInput;
  /** Loads a page's content when a question uses it as context. */
  loadPage?: DocspotLoadPage;
  /**
   * What search lists before typing, in this order. Place `recentItems` to
   * position the reader's recent pages; they come first otherwise.
   */
  defaultItems?: Array<DocspotItem | typeof recentItems>;
  /** Places to send a query besides these docs, such as `docspot/handoffs`. */
  handoffs?: DocspotHandoff[];
  /**
   * Items found by typing their title or keywords, listed before the search
   * results, such as switching the theme. Needs `search`.
   */
  items?: DocspotItem[];
  /** Defaults to `window.location.assign`. */
  navigate?: DocspotNavigate;
  /**
   * The documentation's canonical origin, such as `https://example.com`.
   * Copied links and chat page context use it, and answer links to it open
   * in place. Defaults to the current origin.
   */
  siteUrl?: string;
  /** Persists recent pages, conversations, drafts, and panel state. */
  history?: boolean;
  /** Mirrors search and chat requests in the URL. */
  syncUrl?: boolean | DocspotUrlAdapter;
  slots?: DocspotSlots;
  messages?: DocspotMessagesInput;
  onEvent?: (event: DocspotEvent) => void;
  children?: ReactNode;
};

/** At least one of `search` or `chat` is required. */
export type DocspotRootProps = DocspotSharedProps &
  (
    | { search: DocspotSearch; chat?: DocspotChat }
    | { search?: DocspotSearch; chat: DocspotChat }
  );
