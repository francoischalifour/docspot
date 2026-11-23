import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { DocspotPage } from '@/types';
import { type DocspotInternalState, useDocspotInternal } from '@/core/context';

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
  /** Loads search ahead of opening it, such as when a custom trigger is hovered. */
  preloadSearch: () => void;
  /** Loads chat ahead of opening it. */
  preloadChat: () => void;
};

type DocspotActions = Omit<
  DocspotApi,
  'capabilities' | 'isSearchOpen' | 'isChatOpen'
>;

/**
 * Methods that keep their identity for the instance's lifetime and always
 * act on its latest state, so they are safe in effect dependencies.
 */
function useStableActions(state: DocspotInternalState): DocspotActions {
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  });
  const [actions] = useState((): DocspotActions => ({
    openSearch: query => latest.current.search.open(undefined, query),
    closeSearch: () => latest.current.search.close(),
    openChat: () => latest.current.chat.open(),
    closeChat: () => latest.current.chat.close(),
    toggleChat: () => latest.current.chat.toggle(),
    setDraft: (text, options) =>
      latest.current.chat.open({
        action: 'draft',
        text,
        page: options?.page,
        source: 'api',
      }),
    submitQuestion: (question, options) =>
      latest.current.chat.open({
        action: 'submit',
        text: question,
        page: options?.page,
        source: 'api',
      }),
    startConversation: () => latest.current.chat.open({ action: 'reset' }),
    preloadSearch: () => latest.current.search.preload(),
    preloadChat: () => latest.current.chat.preload(),
  }));
  return actions;
}

/**
 * Reads and controls Docspot from anywhere inside `<Docspot>` or
 * `<Docspot.Root>`. Its methods keep their identity across renders.
 */
export function useDocspot(): DocspotApi {
  const state = useDocspotInternal('useDocspot');
  const actions = useStableActions(state);
  const { canSearch, canChat } = state.config;
  const isSearchOpen = state.search.isOpen;
  const isChatOpen = state.chat.isOpen;
  return useMemo(
    () => ({
      capabilities: { search: canSearch, chat: canChat },
      isSearchOpen,
      isChatOpen,
      ...actions,
    }),
    [actions, canSearch, canChat, isSearchOpen, isChatOpen]
  );
}
