import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getChatInternals } from '@/chat/contract';
import { resolveMessages } from '@/messages';
import type {
  DocspotEvent,
  DocspotNavigate,
  DocspotProps,
  DocspotSlots,
  DocspotUrlAdapter,
} from '@/types';
import type { DocspotConfig } from '@/core/context';
import { createModuleLoader } from '@/core/platform';
import { resolveShortcuts } from '@/core/shortcuts';
import { createStores } from '@/core/storage';
import { browserUrlAdapter, stripHash } from '@/core/url';

// Defaults keep their identity, so memoized parts skip rendering.
const noSlots: DocspotSlots = {};
const noEntries: never[] = [];

const defaultNavigate: DocspotNavigate = url => {
  const target = new URL(url, window.location.href);
  const scrolls =
    target.hash !== '' &&
    stripHash(target.href) === stripHash(window.location.href);
  window.location.assign(target);
  // A new document replaces this one, so search stays open until it does.
  if (!scrolls) return new Promise(() => {});
};

/**
 * Turns `<Docspot.Root>` props into what its parts share: the configuration,
 * the history stores, the URL adapter, and the chat runtime's loader.
 */
export function useDocspotConfig(props: DocspotProps) {
  const {
    search,
    chat,
    id,
    owner: ownerRef,
    context,
    defaultItems,
    handoffs,
    items,
    navigate,
    siteUrl,
    history = false,
    syncUrl = false,
    preload = true,
    shortcuts,
    slots,
    locale,
    messages: messageOverrides,
    onEvent,
  } = props;
  // Types require one; this guards callers without them.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (!search && !chat)
    throw new Error('Docspot: configure `search`, `chat`, or both.');
  if (siteUrl !== undefined && !isOrigin(siteUrl))
    throw new Error(
      `Docspot: \`siteUrl\` must be an absolute URL, such as https://example.com.`
    );

  // Stores change only with the instance identity, never on rerender.
  const stores = useMemo(
    () => createStores({ id, persist: history }),
    [id, history]
  );
  useEffect(stores.sync, [stores]);
  const messages = useMemo(
    () => resolveMessages(locale, messageOverrides),
    [locale, messageOverrides]
  );
  const language = locale?.code ?? 'en';
  const questions = locale?.questions;
  const searchLocale = useMemo(
    () => ({ code: language, questions }),
    [language, questions]
  );
  // A new transport or history namespace starts chat over.
  const chatLoader = useMemo(
    () => (chat ? createModuleLoader(getChatInternals(chat).load) : null),
    [chat, stores]
  );
  // Keyed by content, so an inline object keeps the same keys.
  const shortcutsKey = JSON.stringify(shortcuts ?? null);
  const resolvedShortcuts = useMemo(
    () => resolveShortcuts(shortcuts),
    [shortcutsKey]
  );
  const url: DocspotUrlAdapter | null =
    syncUrl === true ? browserUrlAdapter : syncUrl || null;

  // Stable for the instance's lifetime and always calls the latest
  // `onEvent`, so sessions and handlers can keep it.
  const onEventRef = useRef(onEvent);
  useLayoutEffect(() => {
    onEventRef.current = onEvent;
  });
  const [emit] = useState(
    () => (event: DocspotEvent) => onEventRef.current?.(event)
  );

  // Read refs after the whole tree commits, including an enclosing owner.
  const [owner, setOwner] = useState<HTMLElement | Document | null>(null);
  useEffect(() => {
    const next = ownerRef ? ownerRef.current : document;
    if (next !== owner) setOwner(next);
  });

  const config: DocspotConfig = {
    chatPanelId: useId(),
    owner,
    search,
    canSearch: Boolean(search),
    canChat: Boolean(chat),
    currentPage: context?.page,
    prompts: context?.prompts ?? [],
    defaultItems: defaultItems ?? noEntries,
    handoffs: handoffs ?? noEntries,
    items: items ?? noEntries,
    navigate: navigate ?? defaultNavigate,
    preload,
    shortcuts: resolvedShortcuts,
    toSiteUrl: target => new URL(target, siteUrl ?? window.location.href).href,
    toInternalUrl(target) {
      try {
        const resolved = new URL(target, window.location.href);
        const origins = [
          window.location.origin,
          siteUrl && new URL(siteUrl).origin,
        ];
        return origins.includes(resolved.origin)
          ? `${resolved.pathname}${resolved.search}${resolved.hash}`
          : null;
      } catch {
        return null;
      }
    },
    slots: slots ?? noSlots,
    language,
    searchLocale,
    messages,
    emit,
    stores,
  };
  return { config, url, chatLoader };
}

function isOrigin(url: string) {
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch {
    return false;
  }
}
