import type { DocspotPage, DocspotUrlAdapter } from '@/types';

export const SEARCH_PARAM = 'q';
const CHAT_PARAMS = ['prompt', 'draft', 'askPage'] as const;

/** A URL without its hash: the page, whichever section it points to. */
export function stripHash(url: string) {
  return url.split('#')[0] ?? url;
}

/** Whether both pages are given and are the same page, ignoring sections. */
export function isSamePage(
  a: DocspotPage | undefined,
  b: DocspotPage | undefined
) {
  return Boolean(a && b && stripHash(a.url) === stripHash(b.url));
}

export type ChatLink = {
  text: string;
  action: 'draft' | 'submit';
  /** The page to attach, when the link names one. */
  pageUrl: string | undefined;
};

export function readSearchQuery(search: string): string | null {
  return new URLSearchParams(search).get(SEARCH_PARAM);
}

/** Sets the search query, or removes it along with every chat parameter. */
export function writeSearchQuery(search: string, query: string | null) {
  const params = new URLSearchParams(search);
  for (const name of [SEARCH_PARAM, ...CHAT_PARAMS]) params.delete(name);
  if (query !== null) params.set(SEARCH_PARAM, query);
  return params.toString();
}

export function readChatLink(search: string): ChatLink | null {
  const params = new URLSearchParams(search);
  const prompt = params.get('prompt');
  const text = prompt ?? params.get('draft');
  if (text === null) return null;
  return {
    text,
    action: prompt === null ? 'draft' : 'submit',
    pageUrl: params.get('askPage') ?? undefined,
  };
}

export function removeChatLink(search: string) {
  const params = new URLSearchParams(search);
  for (const name of CHAT_PARAMS) params.delete(name);
  return params.toString();
}

export type DocspotLinkOptions =
  | { search: string }
  | { prompt: string; askPage?: string }
  | { draft: string; askPage?: string };

/**
 * Builds a link that opens search with a query, or chat with a question to
 * send (`prompt`) or to edit first (`draft`). Other parameters are kept.
 * The page must render Docspot with `syncUrl`.
 */
export function createDocspotUrl(url: string, options: DocspotLinkOptions) {
  // Only the query changes. Resolving against a base would lose relative
  // segments such as "../" before the caller knows the destination page.
  const hashStart = url.indexOf('#');
  const hash = hashStart < 0 ? '' : url.slice(hashStart);
  const beforeHash = hashStart < 0 ? url : url.slice(0, hashStart);
  const queryStart = beforeHash.indexOf('?');
  const path = queryStart < 0 ? beforeHash : beforeHash.slice(0, queryStart);
  const params = new URLSearchParams(
    queryStart < 0 ? '' : beforeHash.slice(queryStart + 1)
  );
  for (const name of [SEARCH_PARAM, ...CHAT_PARAMS]) params.delete(name);
  if ('search' in options) params.set(SEARCH_PARAM, options.search);
  else {
    if ('prompt' in options) params.set('prompt', options.prompt);
    else params.set('draft', options.draft);
    if (options.askPage) params.set('askPage', options.askPage);
  }
  return `${path}?${params}${hash}`;
}

const LEADING_QUESTION_MARK = /^\?/;

type NavigationTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

/**
 * The default adapter: the browser history. It follows back and forward,
 * and, where the Navigation API exists, links a client router opens.
 */
export const browserUrlAdapter: DocspotUrlAdapter = {
  read: () => window.location.search,
  write(search, { replace }) {
    const query = search.replace(LEADING_QUESTION_MARK, '');
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (replace) window.history.replaceState(window.history.state, '', url);
    else window.history.pushState(window.history.state, '', url);
  },
  subscribe(listener) {
    // Routers push history entries, which fire no popstate.
    const navigation = (window as { navigation?: NavigationTarget }).navigation;
    const target: NavigationTarget = navigation ?? window;
    const type = navigation ? 'currententrychange' : 'popstate';
    target.addEventListener(type, listener);
    return () => target.removeEventListener(type, listener);
  },
};
