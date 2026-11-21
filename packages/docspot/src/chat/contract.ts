// Shared between the core and the lazily loaded chat runtime. It must not
// import the AI SDK, so search-only consumers never resolve it.
import type { ComponentType, MouseEvent, Ref } from 'react';

import type { DocspotMessages } from '@/messages';
import type { StoredConversation } from '@/core/storage';
import type {
  DocspotChat,
  DocspotEvent,
  DocspotLoadPage,
  DocspotPage,
  DocspotQuestionSource,
} from '@/types';

const CHAT_INTERNALS = Symbol.for('docspot.chat');

/** Request body field holding the structured context of a question. */
export const CONTEXT_FIELD = 'docspot';

/** What a question carries; integrations map it into their request. */
export type DocspotRequestContext = {
  page?: DocspotPage & { content?: string };
};

/** An AI SDK conversation; opaque to the core. */
export type ChatSession = { readonly id: string };

export type ChatSessionOptions = {
  loadPage: DocspotLoadPage | undefined;
  /** Makes attached page URLs absolute for the request. */
  siteUrl: string | undefined;
  /** Saves the conversation once an answer completes. */
  onSave: (conversation: StoredConversation) => void;
  onEvent: (event: DocspotEvent) => void;
};

export type ChatPanelProps = {
  session: ChatSession;
  composerRef: Ref<HTMLTextAreaElement>;
  draft: string;
  onDraftChange: (draft: string) => void;
  /** The page attached to the next question. */
  contextPage: DocspotPage | undefined;
  onRemoveContext: () => void;
  /** Questions to offer when the attached page has none. */
  prompts: string[];
  conversations: {
    list: () => StoredConversation[];
    remove: (id: string) => void;
    clear: () => void;
  };
  onSelectConversation: (conversation: StoredConversation) => void;
  onNewConversation: () => void;
  onClose: () => void;
  /** Opens an internal link from an answer. */
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  /** The in-app path for a URL on this site, or null for other sites. */
  toInternalUrl: (url: string) => string | null;
  messages: DocspotMessages;
  onEvent: (event: DocspotEvent) => void;
};

export type ChatRuntime = {
  createSession: (
    saved: StoredConversation | undefined,
    options: ChatSessionOptions
  ) => ChatSession;
  /** Sends a question, replacing any answer still in progress. */
  ask: (
    session: ChatSession,
    question: string,
    page: DocspotPage | undefined,
    source: DocspotQuestionSource
  ) => Promise<void>;
  stop: (session: ChatSession) => void;
  /** Stops a removed conversation without saving it again. */
  discard: (session: ChatSession) => void;
  toConversation: (session: ChatSession) => StoredConversation | null;
  Panel: ComponentType<ChatPanelProps>;
};

export type ChatInternals = { load: () => Promise<ChatRuntime> };

export function createChatHandle(internals: ChatInternals): DocspotChat {
  return { [CHAT_INTERNALS]: internals } as unknown as DocspotChat;
}

export function getChatInternals(chat: DocspotChat): ChatInternals {
  const internals = (chat as unknown as Record<symbol, ChatInternals>)[
    CHAT_INTERNALS
  ];
  if (!internals)
    throw new Error(
      'Docspot: `chat` must come from createChat() in docspot/chat or a provider integration.'
    );
  return internals;
}
