import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { hasModifierKey } from '@/core/platform';
import type { StoredConversation } from '@/core/storage';
import { isSamePage } from '@/core/url';
import type { DocspotMessages } from '@/messages';
import type { DocspotPage } from '@/types';
import {
  ArrowUpRightIcon,
  ChatIcon,
  ChevronDownIcon,
  CloseIcon,
  CollapseIcon,
  DeleteIcon,
  ExternalIcon,
  NewChatIcon,
  PageIcon,
  RetryIcon,
  SendIcon,
  StopIcon,
} from '@/ui/icons';
import { CopyButton, IconButton, Menu, Shimmer } from '@/ui/primitives';
import { Suggestions, Welcome, getPrompts } from '@/ui/Suggestions';
import type { ChatPanelProps } from '@/chat/contract';
import {
  completeStreamingMarkdown,
  getAnswerProgress,
  getMessageText,
  getMetadataTime,
  hasMessageContent,
} from '@/chat/messages';
import { ReadingAnchor, Scroller } from '@/chat/Scroller';
import {
  type Session,
  ask as askSession,
  discard,
  getQuestionPage,
  retry,
  stop,
  toConversation,
} from '@/chat/session';

export function ChatPanel({
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
}: ChatPanelProps & { holdFirstStep: boolean }) {
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
              <Suggestions
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

function ConversationSwitcher({
  current,
  conversations,
  messages,
  onSelect,
  onDeleteCurrent,
}: {
  current: StoredConversation | null;
  conversations: ChatPanelProps['conversations'];
  messages: DocspotMessages['chat'];
  onSelect: (conversation: StoredConversation) => void;
  onDeleteCurrent: () => void;
}) {
  const saved = useSyncExternalStore(
    conversations.subscribe,
    conversations.list
  );
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const list =
    current && !saved.some(item => item.id === current.id)
      ? [current, ...saved]
      : saved;
  const title = current?.title ?? messages.newChat;

  return (
    <Menu
      className="docspot-switcher"
      onOpenChange={open => {
        if (!open) setIsConfirmingClear(false);
      }}
      trigger={props => (
        <button
          {...props}
          aria-label={messages.switchChat(title)}
          className="docspot-switcher-button"
        >
          <span className="docspot-truncate">{title}</span>
          <ChevronDownIcon size={12} className="docspot-muted" />
        </button>
      )}
      items={
        list.length
          ? [
              { kind: 'label', key: 'label', label: messages.recentChats },
              ...list.map(conversation => {
                const isCurrent = conversation.id === current?.id;
                return {
                  key: conversation.id,
                  label: conversation.title,
                  icon: <ChatIcon size={14} />,
                  current: isCurrent,
                  onSelect: () => {
                    if (!isCurrent) onSelect(conversation);
                  },
                  secondary: {
                    label: messages.deleteChat(conversation.title),
                    icon: <DeleteIcon size={12} />,
                    onSelect: () => {
                      conversations.remove(conversation.id);
                      if (isCurrent) onDeleteCurrent();
                    },
                  },
                };
              }),
              { kind: 'separator', key: 'separator' },
              {
                key: 'clear',
                label: isConfirmingClear
                  ? messages.confirmClearHistory
                  : messages.clearHistory,
                icon: <DeleteIcon size={14} />,
                danger: isConfirmingClear,
                keepOpen: !isConfirmingClear,
                onSelect: () => {
                  if (!isConfirmingClear) {
                    setIsConfirmingClear(true);
                    return;
                  }
                  conversations.clear();
                  if (current) onDeleteCurrent();
                },
              },
            ]
          : [{ kind: 'text', key: 'empty', label: messages.noRecentChats }]
      }
    />
  );
}

function Timestamp({ time }: { time: string | undefined }) {
  if (!time) return null;
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  const isToday = date.toDateString() === new Date().toDateString();
  const label = new Intl.DateTimeFormat(undefined, {
    ...(isToday ? {} : { month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return (
    <time
      dateTime={time}
      title={new Intl.DateTimeFormat(undefined, {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(date)}
      className="docspot-timestamp"
    >
      {label}
    </time>
  );
}

const ChatMessage = memo(function ChatMessage({
  message,
  streaming,
  holdFirstStep,
  messages,
  onNavigate,
  toInternalUrl,
  onRetry,
}: {
  message: UIMessage;
  streaming: boolean;
  holdFirstStep: boolean;
  messages: DocspotMessages['chat'];
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
  /** Offered on the latest answer once it is complete. */
  onRetry?: () => void;
}) {
  const text = getMessageText(message, { streaming, holdFirstStep });
  const sources = message.parts.filter(part => part.type === 'source-url');
  if (!hasMessageContent(message, { streaming, holdFirstStep })) return null;
  if (message.role === 'user')
    return (
      <div className="docspot-message" data-role="user">
        <div className="docspot-question">{text}</div>
        <div className="docspot-message-actions" data-align="end">
          <Timestamp time={getMetadataTime(message, 'askedAt')} />
          <CopyButton
            text={text}
            label={messages.copyQuestion}
            copiedLabel={messages.questionCopied}
          />
        </div>
      </div>
    );
  return (
    <ReadingAnchor
      active={streaming && Boolean(text.trim())}
      className="docspot-reading-anchor"
    >
      <article
        aria-label={messages.answer}
        className="docspot-message"
        data-role="assistant"
      >
        <Markdown
          text={text}
          streaming={streaming}
          onNavigate={onNavigate}
          toInternalUrl={toInternalUrl}
        />
        {sources.length > 0 && (
          <div className="docspot-sources">
            <h3>{messages.sources}</h3>
            <ul>
              {sources.map(source => (
                <li key={source.sourceId}>
                  <DocsLink
                    href={source.url}
                    onNavigate={onNavigate}
                    toInternalUrl={toInternalUrl}
                    externalIcon={null}
                  >
                    {source.title ?? messages.sourceFallback}
                    <ArrowUpRightIcon size={12} />
                  </DocsLink>
                </li>
              ))}
            </ul>
          </div>
        )}
        {text && !streaming && (
          <div className="docspot-message-actions" data-align="start">
            <CopyButton
              text={text}
              label={messages.copyAnswer}
              copiedLabel={messages.answerCopied}
            />
            {onRetry && (
              <IconButton
                label={messages.retryAnswer}
                tooltip={messages.retryShort}
                side="top"
                className="docspot-message-action"
                onClick={onRetry}
              >
                <RetryIcon size={14} />
              </IconButton>
            )}
            <Timestamp time={getMetadataTime(message, 'answeredAt')} />
          </div>
        )}
      </article>
    </ReadingAnchor>
  );
});

function Markdown({
  text,
  streaming,
  onNavigate,
  toInternalUrl,
}: {
  text: string;
  streaming: boolean;
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
}) {
  const components: Components = {
    a: ({ href, children }) => (
      <DocsLink
        href={href}
        onNavigate={onNavigate}
        toInternalUrl={toInternalUrl}
        externalIcon={
          <ExternalIcon size={12} className="docspot-external-icon" />
        }
      >
        {children}
      </DocsLink>
    ),
  };
  return (
    <div className="docspot-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {streaming ? completeStreamingMarkdown(text) : text}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Links to this site open in place, like links in the docs themselves;
 * links elsewhere open in a new tab.
 */
function DocsLink({
  href,
  onNavigate,
  toInternalUrl,
  externalIcon,
  children,
}: {
  href: string | undefined;
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
  externalIcon: ReactNode;
  children: ReactNode;
}) {
  const internal = href ? toInternalUrl(href) : null;
  return internal ? (
    <a
      href={internal}
      onClick={event => {
        if (event.button !== 0 || hasModifierKey(event)) return;
        onNavigate(internal, event);
      }}
    >
      {children}
    </a>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      {externalIcon}
    </a>
  );
}

function Composer({
  inputRef,
  draft,
  onChange,
  onSubmit,
  busy,
  onStop,
  contextPage,
  onRemoveContext,
  messages,
  label,
  placeholder,
}: {
  inputRef: Ref<HTMLTextAreaElement>;
  draft: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  onStop: () => void;
  contextPage: DocspotPage | undefined;
  onRemoveContext: () => void;
  messages: DocspotMessages['chat'];
  label: string;
  placeholder: string;
}) {
  const disabled = !busy && !draft.trim();
  return (
    <form
      className="docspot-composer"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        ref={inputRef}
        enterKeyHint="send"
        aria-label={label}
        aria-keyshortcuts="Enter"
        aria-description={messages.composerDescription}
        placeholder={placeholder}
        value={draft}
        rows={1}
        className="docspot-composer-input"
        onChange={event => onChange(event.currentTarget.value)}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) {
            event.stopPropagation();
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="docspot-composer-bar">
        <PageContextChip
          page={contextPage}
          onRemove={onRemoveContext}
          messages={messages}
        />
        <IconButton
          type={busy ? 'button' : 'submit'}
          label={busy ? messages.stop : messages.send}
          tooltip={disabled ? messages.enterQuestion : undefined}
          side="top"
          aria-disabled={disabled || undefined}
          data-variant={busy ? 'outline' : 'primary'}
          className="docspot-send"
          onClick={event => {
            if (busy) onStop();
            else if (disabled) event.preventDefault();
          }}
        >
          {busy ? <StopIcon size={14} /> : <SendIcon size={14} />}
        </IconButton>
      </div>
    </form>
  );
}

/** The page attached to a question; questions without one use all the docs. */
function PageContextChip({
  page,
  onRemove,
  messages,
}: {
  page: DocspotPage | undefined;
  onRemove: () => void;
  messages: DocspotMessages['chat'];
}) {
  if (!page) return null;
  const title = page.title ?? page.url;
  return (
    <span className="docspot-context-chip">
      <span className="docspot-tooltip-anchor" data-side="top">
        <span className="docspot-context-chip-label">
          <PageIcon size={12} className="docspot-muted" />
          <span className="docspot-truncate">
            <span className="docspot-sr-only">{messages.pageContext}</span>
            {title}
          </span>
        </span>
        <span className="docspot-tooltip" aria-hidden="true">
          {messages.pageContextHint}
        </span>
      </span>
      <button
        type="button"
        className="docspot-context-chip-remove"
        aria-label={messages.removePageContext}
        onClick={onRemove}
      >
        <CloseIcon size={12} />
      </button>
    </span>
  );
}

/**
 * Measures the footer floating over the conversation. A conversation read to
 * its end stays there as the footer grows or shrinks, for example when page
 * suggestions appear.
 */
function useFloatingFooter() {
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const pinnedToEndRef = useRef(true);
  const viewportRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!footer) return;
    const viewport = footer.parentElement?.querySelector<HTMLElement>(
      '.docspot-scroller-viewport'
    );
    viewportRef.current = viewport ?? null;
    function updatePinned() {
      if (viewport)
        pinnedToEndRef.current =
          viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <=
          8;
    }
    viewport?.addEventListener('scroll', updatePinned, { passive: true });
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFooterHeight(entry.borderBoxSize[0]?.blockSize ?? 0);
    });
    observer.observe(footer);
    return () => {
      observer.disconnect();
      viewport?.removeEventListener('scroll', updatePinned);
    };
  }, [footer]);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && pinnedToEndRef.current)
      viewport.scrollTop = viewport.scrollHeight;
  }, [footerHeight]);
  return { setFooter, footerHeight };
}
