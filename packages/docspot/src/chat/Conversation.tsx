import { useChat } from '@ai-sdk/react';
import {
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';

import { isSamePage } from '@/core/url';
import { CloseIcon, CollapseIcon, NewChatIcon } from '@/ui/icons';
import { IconButton } from '@/ui/IconButton';
import { Shimmer } from '@/ui/Shimmer';
import { SuggestedQuestions } from '@/ui/SuggestedQuestions';
import { Welcome } from '@/ui/Welcome';
import { getPrompts } from '@/ui/getPrompts';
import type { ConversationProps } from '@/chat/contract';
import {
  getAnswerProgress,
  getMessageText,
  hasMessageContent,
} from '@/chat/messages';
import { Scroller } from '@/chat/Scroller';
import {
  type Session,
  ask as askSession,
  discard,
  getQuestionPage,
  retry,
  stop,
  toConversation,
} from '@/chat/session';
import { ConversationSwitcher } from '@/chat/ConversationSwitcher';
import { ChatMessage } from '@/chat/ChatMessage';
import { Composer } from '@/chat/Composer';
import { useFloatingFooter } from '@/chat/useFloatingFooter';

export function Conversation({
  session,
  composerRef,
  draft,
  onDraftChange,
  contextPage,
  onRemoveContext,
  prompts,
  conversations,
  onSelectConversation,
  onNewConversation,
  onClose,
  onNavigate,
  toInternalUrl,
  messages: allMessages,
  holdFirstStep,
}: ConversationProps) {
  const chat = session as Session;
  const messages = allMessages.chat;
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
  const { setFooter, footerHeight } = useFloatingFooter();
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

  function submitDraft() {
    if (!draft.trim() || busy) return;
    onDraftChange('');
    ask(draft, 'composer');
  }

  const retryAnswer = useCallback(() => void retry(chat), [chat]);

  return (
    <div className="docspot-chat-body">
      <div className="docspot-chat-header">
        <ConversationSwitcher
          current={toConversation(chat.id, chatMessages)}
          conversations={conversations}
          messages={messages}
          onSelect={onSelectConversation}
          onDeleteCurrent={() => {
            discard(chat);
            onNewConversation();
          }}
        />
        {chatMessages.length > 0 && (
          <IconButton label={messages.newChat} onClick={onNewConversation}>
            <NewChatIcon size={16} />
          </IconButton>
        )}
        <IconButton label={messages.hide} shortcut={['esc']} onClick={onClose}>
          {/* Slides away beside the page; closes when it covers the screen. */}
          <CollapseIcon size={16} className="docspot-when-docked" />
          <CloseIcon size={16} className="docspot-when-covering" />
        </IconButton>
      </div>
      {/* The composer floats over the conversation, so it scrolls full height. */}
      <div
        className="docspot-chat-main"
        style={
          {
            '--docspot-chat-footer-height': `${footerHeight}px`,
          } as CSSProperties
        }
      >
        <Scroller
          follow={busy}
          followKey={
            chatMessages.findLast(message => message.role === 'user')?.id
          }
          jumpLabel={messages.jumpToLatest}
        >
          <div
            role="log"
            aria-label={messages.conversation}
            aria-live="off"
            className="docspot-chat-log"
          >
            {chatMessages.map(message => {
              const streaming = busy && message === lastMessage;
              return (
                // Hidden rather than removed, so an answer that has not
                // started adds no gap while keeping its scroll position.
                <div
                  key={message.id}
                  className="docspot-chat-item"
                  hidden={
                    !hasMessageContent(message, { streaming, holdFirstStep })
                  }
                >
                  <ChatMessage
                    message={message}
                    streaming={streaming}
                    holdFirstStep={holdFirstStep}
                    messages={messages}
                    onNavigate={navigate}
                    toInternalUrl={toInternal}
                    onRetry={
                      !busy &&
                      message === lastMessage &&
                      message.role === 'assistant'
                        ? retryAnswer
                        : undefined
                    }
                  />
                </div>
              );
            })}
            {busy && !hasVisibleAnswer && (
              <div role="status" className="docspot-chat-progress">
                <Shimmer>{getAnswerProgress(lastMessage, messages)}</Shimmer>
              </div>
            )}
            {error && (
              <div role="alert" className="docspot-chat-error">
                <p>{messages.error}</p>
                <button
                  type="button"
                  className="docspot-button"
                  onClick={retryAnswer}
                >
                  {messages.retry}
                </button>
              </div>
            )}
            <span className="docspot-sr-only" role="status" aria-live="polite">
              {busy
                ? messages.answerInProgress
                : error
                  ? messages.answerFailed
                  : chatMessages.length
                    ? messages.answerReady
                    : ''}
            </span>
          </div>
        </Scroller>
        <div ref={setFooter} className="docspot-chat-footer">
          {/* Empty chats and page changes share this spot above the composer. */}
          {!chatMessages.length ? (
            <Welcome
              className="docspot-chat-welcome"
              title={messages.welcome}
              questions={getPrompts(contextPage, prompts)}
              onChoose={question => ask(question, 'prompt')}
            />
          ) : (
            pageSuggestions.length > 0 && (
              <SuggestedQuestions
                aria-label={messages.suggestionsAbout(
                  contextPage?.title ?? contextPage?.url ?? ''
                )}
                className="docspot-chat-welcome"
                questions={pageSuggestions}
                onChoose={question => ask(question, 'prompt')}
              />
            )
          )}
          <Composer
            inputRef={composerRef}
            draft={draft}
            onChange={onDraftChange}
            onSubmit={submitDraft}
            busy={busy}
            onStop={() => stop(chat)}
            contextPage={contextPage}
            onRemoveContext={onRemoveContext}
            messages={messages}
            label={
              chatMessages.length ? messages.followUpLabel : messages.askLabel
            }
            placeholder={
              chatMessages.length
                ? messages.followUpPlaceholder
                : messages.placeholder
            }
          />
        </div>
      </div>
    </div>
  );
}
