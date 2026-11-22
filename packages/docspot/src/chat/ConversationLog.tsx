import { Shimmer } from '@/ui/Shimmer';
import { hasMessageContent } from '@/chat/messages';
import { ChatMessage } from '@/chat/ChatMessage';
import { Scroller } from '@/chat/Scroller';
import { useConversationContext } from '@/chat/ConversationContext';

/**
 * The transcript: questions and answers, progress while an answer starts,
 * and a way to retry one that failed. Screen readers hear when an answer
 * starts and finishes, not every word.
 */
export function ConversationLog() {
  const conversation = useConversationContext('ConversationLog');
  const {
    messages,
    chatMessages,
    lastMessage,
    busy,
    error,
    holdFirstStep,
    tools,
  } = conversation;
  return (
    <Scroller
      follow={busy}
      followKey={chatMessages.findLast(message => message.role === 'user')?.id}
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
                !hasMessageContent(message, { streaming, holdFirstStep, tools })
              }
            >
              <ChatMessage
                message={message}
                streaming={streaming}
                holdFirstStep={holdFirstStep}
                tools={tools}
                onToolOutput={conversation.addToolOutput}
                messages={messages}
                onNavigate={conversation.navigate}
                toInternalUrl={conversation.toInternal}
                onRetry={
                  !busy &&
                  message === lastMessage &&
                  message.role === 'assistant'
                    ? conversation.retryAnswer
                    : undefined
                }
              />
            </div>
          );
        })}
        {conversation.showsProgress && (
          <div role="status" className="docspot-chat-progress">
            <Shimmer>{conversation.progress}</Shimmer>
          </div>
        )}
        {error && (
          <div role="alert" className="docspot-chat-error">
            <p>{messages.error}</p>
            <button
              type="button"
              className="docspot-button"
              onClick={conversation.retryAnswer}
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
  );
}
