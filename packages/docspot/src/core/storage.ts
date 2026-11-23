import type { DocspotPage } from '@/types';

const VERSION = 1;
const RECENT_PAGE_LIMIT = 5;
const CONVERSATION_LIMIT = 20;

export type StoredPage = {
  url: string;
  title: string;
  pageTitle?: string;
  breadcrumb?: string[];
  group?: string;
  type?: 'page' | 'section';
};

/** A message in the AI SDK's UI message format. */
export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: string; [key: string]: unknown }>;
  metadata?: unknown;
};

export type StoredConversation = {
  id: string;
  title: string;
  page?: DocspotPage;
  messages: StoredMessage[];
};

export type PanelState = {
  open: boolean;
  conversationId: string | null;
  draft: string;
  width?: number;
};

export const defaultPanelState: PanelState = {
  open: false,
  conversationId: null,
  draft: '',
};

type Store<T> = {
  get: () => T;
  set: (update: T | ((current: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
};

type StoreOptions<T> = {
  /** Persists under this localStorage key; null keeps state in memory. */
  key: string | null;
  fallback: T;
  parse: (value: unknown) => T | null;
  /** Makes a smaller value when storage is full, or null to give up. */
  shrink?: (value: T) => T | null;
};

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Access throws where site data is blocked.
    return null;
  }
}

function createStore<T>({
  key,
  fallback,
  parse,
  shrink,
}: StoreOptions<T>): Store<T> & { onStorage: (event: StorageEvent) => void } {
  const listeners = new Set<() => void>();
  let value = fallback;
  let loaded = false;

  function read(): T {
    const storage = key ? getStorage() : null;
    if (!storage || !key) return fallback;
    try {
      const raw = storage.getItem(key);
      if (raw === null) return fallback;
      const record: unknown = JSON.parse(raw);
      if (
        !record ||
        typeof record !== 'object' ||
        !('version' in record) ||
        record.version !== VERSION ||
        !('value' in record)
      )
        return fallback;
      return parse(record.value) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(next: T) {
    const storage = key ? getStorage() : null;
    if (!storage || !key) return;
    let candidate: T | null = next;
    while (candidate !== null) {
      try {
        storage.setItem(
          key,
          JSON.stringify({ version: VERSION, value: candidate })
        );
        return;
      } catch {
        // Quota exceeded: keep the newest records that fit.
        candidate = shrink ? shrink(candidate) : null;
      }
    }
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function onStorage(event: StorageEvent) {
    if (event.storageArea && event.storageArea !== getStorage()) return;
    if (event.key !== key && event.key !== null) return;
    value = read();
    notify();
  }

  function get() {
    if (!loaded && typeof window !== 'undefined') {
      loaded = true;
      value = read();
    }
    return value;
  }

  return {
    get,
    onStorage,
    set(update) {
      const current = get();
      const next =
        typeof update === 'function'
          ? (update as (current: T) => T)(current)
          : update;
      if (Object.is(next, current)) return;
      value = next;
      write(next);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function getNamespace(id: string | undefined) {
  return id ? `docspot:${id}` : 'docspot';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parsePage(value: unknown): DocspotPage | undefined {
  if (!isRecord(value) || !isString(value.url)) return undefined;
  return {
    url: value.url,
    title: isString(value.title) ? value.title : undefined,
    suggestions: isStringArray(value.suggestions)
      ? value.suggestions
      : undefined,
  };
}

function parseRecentPages(value: unknown): StoredPage[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .flatMap((entry): StoredPage[] => {
      if (!isRecord(entry) || !isString(entry.url) || !isString(entry.title))
        return [];
      return [
        {
          url: entry.url,
          title: entry.title,
          pageTitle: isString(entry.pageTitle) ? entry.pageTitle : undefined,
          breadcrumb: isStringArray(entry.breadcrumb)
            ? entry.breadcrumb
            : undefined,
          group: isString(entry.group) ? entry.group : undefined,
          type:
            entry.type === 'page' || entry.type === 'section'
              ? entry.type
              : undefined,
        },
      ];
    })
    .slice(0, RECENT_PAGE_LIMIT);
}

function isMessage(value: unknown): value is StoredMessage {
  return (
    isRecord(value) &&
    isString(value.id) &&
    (value.role === 'user' || value.role === 'assistant') &&
    Array.isArray(value.parts) &&
    value.parts.every(
      part =>
        isRecord(part) &&
        isString(part.type) &&
        (part.type !== 'text' || isString(part.text)) &&
        (part.type !== 'source-url' ||
          (isString(part.url) &&
            isString(part.sourceId) &&
            (part.title === undefined || isString(part.title))))
    )
  );
}

function parseConversations(value: unknown): StoredConversation[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .flatMap((entry): StoredConversation[] =>
      isRecord(entry) &&
      isString(entry.id) &&
      isString(entry.title) &&
      Array.isArray(entry.messages) &&
      entry.messages.every(isMessage)
        ? [
            {
              id: entry.id,
              title: entry.title,
              page: parsePage(entry.page),
              messages: entry.messages,
            },
          ]
        : []
    )
    .slice(0, CONVERSATION_LIMIT);
}

function parsePanel(value: unknown): PanelState | null {
  if (!isRecord(value)) return null;
  return {
    open: value.open === true,
    conversationId: isString(value.conversationId)
      ? value.conversationId
      : null,
    draft: isString(value.draft) ? value.draft : '',
    width:
      typeof value.width === 'number' && Number.isFinite(value.width)
        ? value.width
        : undefined,
  };
}

export type DocspotStores = {
  sync: () => (() => void) | undefined;
  recentPages: Store<StoredPage[]>;
  conversations: Store<StoredConversation[]>;
  panel: Store<PanelState>;
};

export function createStores({
  id,
  persist,
}: {
  id: string | undefined;
  persist: boolean;
}): DocspotStores {
  const namespace = getNamespace(id);
  const key = (name: string) => (persist ? `${namespace}:${name}` : null);
  const stores = {
    recentPages: createStore({
      key: key('recent-pages'),
      fallback: [],
      parse: parseRecentPages,
    }),
    conversations: createStore({
      key: key('conversations'),
      fallback: [],
      parse: parseConversations,
      shrink: conversations =>
        conversations.length > 1 ? conversations.slice(0, -1) : null,
    }),
    panel: createStore({
      key: key('panel'),
      fallback: defaultPanelState,
      parse: parsePanel,
    }),
  };
  return {
    ...stores,
    sync() {
      if (!persist) return;
      function onStorage(event: StorageEvent) {
        for (const store of Object.values(stores)) store.onStorage(event);
      }
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
}

/** Adds a page to the front of recent pages, without duplicates. */
export function addRecentPage(pages: StoredPage[], page: StoredPage) {
  return [page, ...pages.filter(item => item.url !== page.url)].slice(
    0,
    RECENT_PAGE_LIMIT
  );
}

/** Saves a conversation at the front, replacing earlier copies of it. */
export function addConversation(
  conversations: StoredConversation[],
  conversation: StoredConversation
) {
  return [
    conversation,
    ...conversations.filter(item => item.id !== conversation.id),
  ].slice(0, CONVERSATION_LIMIT);
}

export type DocspotHistoryImport = {
  /** Matches the `id` prop of the Docspot instance to import into. */
  id?: string;
  recentPages?: StoredPage[];
  conversations?: StoredConversation[];
  panel?: Partial<PanelState>;
};

/**
 * Seeds persisted history, for example from a previous implementation. Only
 * fills records that do not exist yet, so it is safe to run on every load.
 * Returns whether anything was written.
 */
export function importDocspotHistory({
  id,
  recentPages,
  conversations,
  panel,
}: DocspotHistoryImport): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const namespace = getNamespace(id);
  let imported = false;
  function seed(name: string, value: unknown) {
    const key = `${namespace}:${name}`;
    try {
      if (storage!.getItem(key) !== null) return;
      storage!.setItem(key, JSON.stringify({ version: VERSION, value }));
      imported = true;
    } catch {
      // Unavailable or full storage leaves history empty.
    }
  }
  if (recentPages?.length)
    seed('recent-pages', parseRecentPages(recentPages) ?? []);
  if (conversations?.length)
    seed('conversations', parseConversations(conversations) ?? []);
  if (panel) seed('panel', parsePanel({ ...defaultPanelState, ...panel }));
  return imported;
}
