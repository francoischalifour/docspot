import { Chat } from '@ai-sdk/react';
import {
  type ChatTransport,
  type UIMessage,
  generateId,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';

import {
  parsePage,
  type StoredConversation,
  type StoredMessage,
} from '@/core/storage';
import { stripHash } from '@/core/url';
import type {
  DocspotEvent,
  DocspotLoadPage,
  DocspotPage,
  DocspotPageContent,
  DocspotQuestionSource,
} from '@/types';
import {
  CONTEXT_FIELD,
  type ChatSessionOptions,
  type DocspotRequestContext,
} from '@/chat/contract';
import { getMessageText } from '@/chat/messages';

export type DocspotQuestionMetadata = {
  question: string;
  page?: DocspotPage;
  askedAt: string;
};

export type Session = Chat<UIMessage>;

const pendingResponses = new WeakMap<Session, Promise<void>>();
const queuedQuestions = new WeakMap<Session, symbol>();
const discardedSessions = new WeakSet<Session>();
const sessionEvents = new WeakMap<Session, (event: DocspotEvent) => void>();

/** The page attached to the latest question, if any. */
export function getQuestionPage(messages: UIMessage[]) {
  const metadata = messages.findLast(
    message => message.role === 'user'
  )?.metadata;
  return metadata && typeof metadata === 'object' && 'page' in metadata
    ? parsePage(metadata.page)
    : undefined;
}

export function toConversation(
  id: string,
  messages: UIMessage[]
): StoredConversation | null {
  const firstQuestion = messages.find(message => message.role === 'user');
  if (!firstQuestion) return null;
  return {
    id,
    title: getMessageText(firstQuestion),
    page: getQuestionPage(messages),
    messages: messages as StoredMessage[],
  };
}

/**
 * Loads attached page content once per page and conversation, then sends it
 * as structured context for the integration to map into its request.
 */
function withPageContent(
  transport: ChatTransport<UIMessage>,
  loadPage: DocspotLoadPage | undefined,
  siteUrl: string | undefined
): ChatTransport<UIMessage> {
  const contents = new Map<string, Promise<DocspotPageContent | null>>();
  function load(page: DocspotPage, signal: AbortSignal | undefined) {
    if (!loadPage) return Promise.resolve(null);
    const key = stripHash(page.url);
    let content = contents.get(key);
    if (!content) {
      content = loadPage(page, {
        signal: signal ?? new AbortController().signal,
      }).then(result =>
        typeof result === 'string' ? { content: result } : result
      );
      contents.set(key, content);
      // A failed load is retried with the next question.
      content.catch(() => contents.delete(key));
    }
    return content;
  }
  return {
    async sendMessages(options) {
      const body = { ...(options.body as Record<string, unknown>) };
      const context = body[CONTEXT_FIELD] as DocspotRequestContext | undefined;
      if (context?.page) {
        const loaded = await load(context.page, options.abortSignal);
        options.abortSignal?.throwIfAborted();
        body[CONTEXT_FIELD] = {
          ...context,
          page: {
            ...context.page,
            url: new URL(
              context.page.url,
              siteUrl ?? globalThis.location?.href ?? 'http://localhost'
            ).href,
            title: loaded?.title ?? context.page.title,
            content: loaded?.content,
          },
        } satisfies DocspotRequestContext;
      }
      return transport.sendMessages({ ...options, body });
    },
    reconnectToStream: options => transport.reconnectToStream(options),
  };
}

export function createSession(
  transport: ChatTransport<UIMessage>,
  saved: StoredConversation | undefined,
  { loadPage, siteUrl, onSave, onEvent }: ChatSessionOptions
): Session {
  const id = saved?.id ?? generateId();
  const chat = new Chat<UIMessage>({
    id,
    messages: saved?.messages as UIMessage[] | undefined,
    transport: withPageContent(transport, loadPage, siteUrl),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: error =>
      onEvent({ type: 'chat.error', conversationId: id, error }),
    onFinish: options => {
      if (discardedSessions.has(chat)) return;
      // Older AI SDK 5 releases only report the message.
      const { message, isAbort, isError } = options as typeof options & {
        isAbort?: boolean;
        isError?: boolean;
      };
      const answeredAt = new Date().toISOString();
      chat.messages = chat.messages.map(candidate =>
        candidate.id === message.id
          ? {
              ...candidate,
              metadata: { ...(candidate.metadata as object), answeredAt },
            }
          : candidate
      );
      const conversation = toConversation(id, chat.messages);
      if (conversation) onSave(conversation);
      if (isAbort) onEvent({ type: 'chat.stop', conversationId: id });
      else if (!isError) onEvent({ type: 'chat.answer', conversationId: id });
    },
  });
  sessionEvents.set(chat, onEvent);
  return chat;
}

function track(chat: Session, response: Promise<void>) {
  pendingResponses.set(chat, response);
  function clear() {
    if (pendingResponses.get(chat) === response) pendingResponses.delete(chat);
  }
  void response.then(clear, clear);
  return response;
}

/** Sends a question, replacing any answer still in progress. */
export async function ask(
  chat: Session,
  question: string,
  page: DocspotPage | undefined,
  source: DocspotQuestionSource
) {
  queuedQuestions.delete(chat);
  const pending = pendingResponses.get(chat);
  if (pending) {
    // Only the newest replacement may start after the current answer stops.
    const questionId = Symbol();
    queuedQuestions.set(chat, questionId);
    await chat.stop();
    await pending.catch(() => {});
    if (queuedQuestions.get(chat) !== questionId) return;
    queuedQuestions.delete(chat);
  }
  const text = question.trim();
  const attached = page && { url: page.url, title: page.title };
  const metadata: DocspotQuestionMetadata = {
    question: text,
    page: attached,
    askedAt: new Date().toISOString(),
  };
  sessionEvents.get(chat)?.({
    type: 'chat.submit',
    conversationId: chat.id,
    question: text,
    page: attached?.url,
    source,
  });
  return track(
    chat,
    chat.sendMessage(
      { parts: [{ type: 'text', text }], metadata },
      { body: { [CONTEXT_FIELD]: { page: attached } } }
    )
  );
}

/** Retries the latest answer in place, with the page its question used. */
export function retry(chat: Session) {
  sessionEvents.get(chat)?.({ type: 'chat.retry', conversationId: chat.id });
  chat.clearError();
  return track(
    chat,
    chat.regenerate({
      body: { [CONTEXT_FIELD]: { page: getQuestionPage(chat.messages) } },
    })
  );
}

export function stop(chat: Session) {
  queuedQuestions.delete(chat);
  void chat.stop();
}

/** Stops a removed conversation without saving it again. */
export function discard(chat: Session) {
  discardedSessions.add(chat);
  stop(chat);
}
