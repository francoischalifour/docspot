import { useChat } from '@ai-sdk/react';
import { type MouseEvent, useCallback, useLayoutEffect, useRef } from 'react';

import { isSamePage } from '@/core/url';
import type { ConversationProps } from '@/chat/contract';
import { getAnswerProgress, getMessageText } from '@/chat/messages';
import {
  type Session,
  ask as askSession,
  discard,
  getQuestionPage,
  retry,
  stop,
  toConversation,
} from '@/chat/session';

/**
 * A conversation's state and behavior, without its markup: its messages,
 * whether an answer is in progress, and how to ask, retry, and stop.
 */
export function useConversation(props: ConversationProps) {
  const {
    session,
    draft,
    onDraftChange,
    contextPage,
    onNavigate,
    toInternalUrl,
    onNewConversation,
    holdFirstStep,
  } = props;
  const chat = session as Session;
  const messages = props.messages.chat;
  // Answers are memoized, so typing or streaming re-renders only what
  // changed; these keep their identity while reading the latest props.
  const latest = useRef({ onNavigate, toInternalUrl });
  useLayoutEffect(() => {
    latest.current = { onNavigate, toInternalUrl };
  });
  const navigate = useCallback(
    (url: string, event: MouseEvent<HTMLAnchorElement>) =>
      latest.current.onNavigate(url, event),
    []
  );
  const toInternal = useCallback(
    (url: string) => latest.current.toInternalUrl(url),
    []
  );
  const {
    messages: chatMessages,
    status,
    error,
  } = useChat({ chat, experimental_throttle: 40 });
  const busy = status === 'submitted' || status === 'streaming';
  const lastMessage = chatMessages.at(-1);
  const hasVisibleAnswer =
    lastMessage?.role === 'assistant' &&
    Boolean(
      getMessageText(lastMessage, { streaming: busy, holdFirstStep }).trim()
    );

  // Moving to another page mid-conversation offers that page's questions,
  // until one is asked with it attached.
  const pageSuggestions =
    chatMessages.length &&
    !busy &&
    !isSamePage(contextPage, getQuestionPage(chatMessages))
      ? (contextPage?.prompts ?? [])
      : [];

  function ask(question: string, source: 'composer' | 'prompt') {
    if (!question.trim() || busy) return;
    void askSession(chat, question, contextPage, source);
  }

  const retryAnswer = useCallback(() => void retry(chat), [chat]);

  return {
    ...props,
    messages,
    chatMessages,
    lastMessage,
    busy,
    error,
    hasVisibleAnswer,
    /** What the agent is doing before its answer text arrives. */
    progress: getAnswerProgress(lastMessage, messages),
    pageSuggestions,
    current: toConversation(chat.id, chatMessages),
    navigate,
    toInternal,
    ask,
    submitDraft: () => {
      if (!draft.trim() || busy) return;
      onDraftChange('');
      ask(draft, 'composer');
    },
    retryAnswer,
    stop: () => stop(chat),
    /** Deletes the open conversation and starts a new one. */
    deleteCurrent: () => {
      discard(chat);
      onNewConversation();
    },
  };
}

export type ConversationApi = ReturnType<typeof useConversation>;
