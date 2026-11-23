import { useChat } from '@ai-sdk/react';
import {
  type MouseEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { isSamePage } from '@/core/url';
import { mergeRefs } from '@/ui/mergeRefs';
import type { DocspotFeedback } from '@/types';
import type { ConversationProps } from '@/chat/contract';
import { getAnswerProgress, getMessageText } from '@/chat/messages';
import { isRenderedToolRunning } from '@/chat/tools';
import {
  type Session,
  ask as askSession,
  discard,
  getQuestionPage,
  rate,
  retry,
  stop,
  toConversation,
} from '@/chat/session';

type AddToolOutput = (options: {
  tool: string;
  toolCallId: string;
  output: unknown;
}) => Promise<void>;

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
  const lastQuestion = chatMessages.findLast(
    message => message.role === 'user'
  );
  const question = lastQuestion ? getMessageText(lastQuestion) : '';
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

  const composerElement = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useMemo(
    () => mergeRefs(props.composerRef, composerElement),
    [props.composerRef]
  );

  function ask(question: string, source: 'composer' | 'prompt') {
    if (!question.trim() || busy) return;
    void askSession(chat, question, contextPage, source);
    // A chosen suggestion leaves with its list; typing goes on in the
    // composer.
    if (source === 'prompt')
      composerElement.current?.focus({ preventScroll: true });
  }

  const retryAnswer = useCallback(() => void retry(chat), [chat]);
  const rateAnswer = useCallback(
    (messageId: string, feedback: DocspotFeedback | null) =>
      rate(chat, messageId, feedback),
    [chat]
  );
  // Older AI SDK 5 releases only have addToolResult, which later ones
  // deprecate.
  const addToolOutput = useCallback(
    (tool: string, toolCallId: string, output: unknown) => {
      const session = chat as unknown as {
        addToolOutput?: AddToolOutput;
        addToolResult?: AddToolOutput;
      };
      const add = session.addToolOutput ?? session.addToolResult;
      void add?.call(session, { tool, toolCallId, output });
    },
    [chat]
  );

  return {
    ...props,
    messages,
    chatMessages,
    lastMessage,
    busy,
    error,
    hasVisibleAnswer,
    /** What the agent is doing before its answer text arrives. */
    progress: getAnswerProgress(lastMessage, messages, question),
    /**
     * Whether to show progress: while an answer has no text yet, unless a
     * tool's renderer shows its own.
     */
    showsProgress:
      busy &&
      !hasVisibleAnswer &&
      !(
        lastMessage?.role === 'assistant' &&
        isRenderedToolRunning(lastMessage.parts, props.tools)
      ),
    pageSuggestions,
    composerRef,
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
    rateAnswer,
    addToolOutput,
    stop: () => stop(chat),
    /** Deletes the open conversation and starts a new one. */
    deleteCurrent: () => {
      discard(chat);
      onNewConversation();
    },
  };
}

export type ConversationApi = ReturnType<typeof useConversation>;
