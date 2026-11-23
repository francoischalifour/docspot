import type {
  ComponentType,
  MouseEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from 'react';

import type { DocspotMessagesInput } from '@/messages';
import type { recentItems } from '@/search/items';

/** A run of text, marked when it matched the query. */
export type HighlightSegment = { text: string; highlighted: boolean };
export type HighlightedText = HighlightSegment[];

/**
 * A page or section of these docs, as a search provider returns it. Plain
 * data: how it looks comes from slots.
 */
export type DocspotResult = {
  url: string;
  /** A page title or a section heading. */
  title: string;
  /** Results sharing a group are listed together, in first-appearance order. */
  group?: string;
  /** The page a section belongs to. Defaults to the title. */
  pageTitle?: string;
  /** Where the result sits, from the top level down, excluding the title. */
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
  /** Provider-specific data, passed through to slots. */
  data?: unknown;
};

export type DocspotActionContext = {
  /** The query the item was chosen for; empty before typing. */
  query: string;
};

export type DocspotItemPreviewProps = {
  item: DocspotItem;
  query: string;
};

/**
 * Something the site offers besides its pages: something to do, such as
 * switching the theme, or somewhere to go, such as another site. Choosing an
 * item closes search. Items stay out of recent pages.
 */
export type DocspotItem = {
  /** Unique among items. */
  id: string;
  /** What it does or where it goes. */
  title: string;
  /** A URL opens, in a new tab when on another site; a function runs. */
  action: string | ((context: DocspotActionContext) => void);
  /** Items sharing a group are listed together, in first-appearance order. */
  group?: string;
  icon?: ReactNode;
  /** Says what it does in the preview. */
  description?: string;
  /** Other words that find it among `items`, such as synonyms. */
  keywords?: string[];
  /**
   * The keys that run it outside search, as `aria-keyshortcuts` writes them,
   * such as `Meta+S` or `Shift+Meta+Z`. Shown beside its title.
   */
  shortcut?: string;
  /** Replaces the preview's title and description. May suspend. */
  preview?: ComponentType<DocspotItemPreviewProps>;
};

export type DocspotSearchResponse =
  | DocspotResult[]
  | {
      results: DocspotResult[];
      /** Offers the question to chat before the results. */
      prioritizeChat?: boolean;
    };

export type DocspotSearchParams = { query: string; signal: AbortSignal };

/**
 * Search from `createSearch()` or a provider integration. A plain function
 * that returns results works too.
 */
export type DocspotSearch = ((
  params: DocspotSearchParams
) => DocspotSearchResponse | Promise<DocspotSearchResponse>) & {
  /** Gets ready for the first query. See `createSearch`. */
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
) => void | Promise<unknown>;

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
  result: DocspotResult;
  query: string;
  /** Opens a URL and closes search. */
  navigate: (url: string) => void;
  /** Shows a short status message inside search. */
  notify: (message: string) => void;
};

export type DocspotPageActionsProps = {
  result: DocspotResult;
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
  result: DocspotResult;
  recent: boolean;
};

/**
 * What a tooltip receives. Render `children`, the trigger, as it is, and
 * show `label` beside it on hover and keyboard focus. The trigger already
 * has `label` as its accessible name, so the tooltip should be hidden from
 * screen readers.
 */
export type DocspotTooltipProps = {
  label: string;
  /** Docspot's key hint for the trigger's shortcut, when it has one. */
  shortcut?: ReactNode;
  /** The side Docspot places it on, flipping when there is no room. */
  side: 'top' | 'bottom' | 'left';
  children: ReactElement;
};

/** What an icon receives. Spread it onto the `<svg>`. */
export type DocspotIconProps = {
  /** Width and height in pixels. */
  size: number;
  className?: string;
  'aria-hidden': true;
  focusable: 'false';
};

/**
 * Docspot's icons, by what they mean, for `slots.icons`. Each one not given
 * keeps Docspot's own.
 */
export type DocspotIcons = {
  /** The search field and trigger. */
  search: ComponentType<DocspotIconProps>;
  /** Search while results are slow. Docspot spins it. */
  loading: ComponentType<DocspotIconProps>;
  /** A page result, link item, or page attached to a question. */
  page: ComponentType<DocspotIconProps>;
  /** A section result. */
  section: ComponentType<DocspotIconProps>;
  /** A recent page. */
  recent: ComponentType<DocspotIconProps>;
  /** Asking AI, and suggested questions. */
  ask: ComponentType<DocspotIconProps>;
  /** An item whose `action` is a function. */
  action: ComponentType<DocspotIconProps>;
  /** A conversation in the chat switcher. */
  conversation: ComponentType<DocspotIconProps>;
  /** Opens the chat switcher. */
  expand: ComponentType<DocspotIconProps>;
  /** Sends a question. */
  send: ComponentType<DocspotIconProps>;
  /** Stops an answer. */
  stop: ComponentType<DocspotIconProps>;
  /** Starts a new chat. */
  newChat: ComponentType<DocspotIconProps>;
  /** Hides the docked chat panel. */
  collapse: ComponentType<DocspotIconProps>;
  /** Closes chat over the page, or removes an attached page. */
  close: ComponentType<DocspotIconProps>;
  /** Deletes a conversation, or clears history. */
  delete: ComponentType<DocspotIconProps>;
  copy: ComponentType<DocspotIconProps>;
  /** Shown once something is copied. */
  copied: ComponentType<DocspotIconProps>;
  /** Retries an answer. */
  retry: ComponentType<DocspotIconProps>;
  /** Jumps to the end of an answer. */
  jump: ComponentType<DocspotIconProps>;
  /** An answer's source. */
  source: ComponentType<DocspotIconProps>;
  /** A link that opens in a new tab. */
  external: ComponentType<DocspotIconProps>;
  /** The key that opens the selected result. */
  enter: ComponentType<DocspotIconProps>;
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
  /** Replaces the default icons of results. */
  resultIcon?: ComponentType<DocspotResultIconProps>;
  /** Replaces how an item's shortcut is drawn. */
  shortcut?: ComponentType<DocspotShortcutProps>;
  /** Replaces Docspot's icons, such as with a site's own icon set. */
  icons?: Partial<DocspotIcons>;
  /**
   * Draws a page's icon where chat shows the page a question uses, such as
   * its section's icon. Receives the page and `DocspotIconProps`.
   */
  pageIcon?: ComponentType<DocspotIconProps & { page: DocspotPage }>;
  /** Replaces Docspot's tooltips, such as with a site's own component. */
  tooltip?: ComponentType<DocspotTooltipProps>;
};

export type DocspotQuestionSource =
  'composer' | 'prompt' | 'search' | 'url' | 'api';

export type DocspotEvent =
  | { type: 'search.open' }
  | { type: 'search.close' }
  | { type: 'search.results'; query: string; count: number }
  | ({ type: 'search.select'; query: string; position: number } & (
      { result: DocspotResult } | { item: DocspotItem }
    ))
  | { type: 'search.error'; query: string; error: unknown }
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

/** What a handoff builds its item from. */
export type DocspotHandoffContext = {
  query: string;
  /** The query's search results, best first. Empty when search failed. */
  results: DocspotResult[];
};

/**
 * Sends the query somewhere else, such as a general assistant, as an item
 * listed after the results once a query is typed.
 */
export type DocspotHandoff = (context: DocspotHandoffContext) => DocspotItem;

/** Chat created by `createChat` from `docspot/chat` or a provider integration. */
export type DocspotChat = { readonly [chatBrand]: true };

/** Props only search reads, so they need `search`. */
type DocspotSearchProps = {
  /**
   * The pages and items search lists before typing, in this order. Place
   * `recentItems` to position the reader's recent pages; they come first
   * otherwise.
   */
  defaultItems?: Array<DocspotResult | DocspotItem | typeof recentItems>;
  /** Places to send a query besides these docs, such as `docspot/handoffs`. */
  handoffs?: DocspotHandoff[];
  /**
   * Items found by typing their title or keywords, listed before the search
   * results, such as switching the theme.
   */
  items?: DocspotItem[];
  /**
   * Controls whether search is open. Docspot asks to change it through
   * `onSearchOpenChange`, and follows this prop.
   */
  searchOpen?: boolean;
  /** Called when Docspot asks to open or close search. */
  onSearchOpenChange?: (open: boolean) => void;
  /** Controls the search query, with `onQueryChange`. */
  query?: string;
  /** Called when the query changes, by typing or otherwise. */
  onQueryChange?: (query: string) => void;
};

type DocspotSharedProps = {
  /** Scopes persisted history, for several Docspot instances on one origin. */
  id?: string;
  /**
   * Limits keyboard shortcuts and the docked chat inset to this element.
   * Defaults to the document. Focus an element inside the owner before using
   * a shortcut.
   */
  owner?: RefObject<HTMLElement | null>;
  context?: DocspotContextInput;
  /** Loads a page's content when a question uses it as context. */
  loadPage?: DocspotLoadPage;
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
  /**
   * Loads search and chat ahead of use: once the page is idle, and when a
   * trigger or shortcut is about to open them. `false` loads them only on
   * open or through `useDocspot()`'s `preloadSearch` and `preloadChat`.
   */
  preload?: boolean;
  /**
   * Controls whether chat is open. Docspot asks to change it through
   * `onChatOpenChange`; a question asked meanwhile is sent once it opens.
   */
  chatOpen?: boolean;
  /** Called when Docspot asks to open or close chat. */
  onChatOpenChange?: (open: boolean) => void;
  slots?: DocspotSlots;
  messages?: DocspotMessagesInput;
  onEvent?: (event: DocspotEvent) => void;
  children?: ReactNode;
};

/**
 * At least one of `search` or `chat` is required. Search's own props need
 * `search`, even if it may be undefined, so chat alone can't take them.
 */
export type DocspotRootProps = DocspotSharedProps &
  (
    | ({ search: DocspotSearch; chat?: DocspotChat } & DocspotSearchProps)
    | ({
        search: DocspotSearch | undefined;
        chat: DocspotChat;
      } & DocspotSearchProps)
    | ({ search?: undefined; chat: DocspotChat } & {
        [Key in keyof DocspotSearchProps]?: never;
      })
  );
