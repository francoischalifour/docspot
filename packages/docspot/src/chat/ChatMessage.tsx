import type { UIMessage } from 'ai';
import { type MouseEvent, memo } from 'react';

import type { DocspotMessages } from '@/messages';
import { getMessageText, hasMessageContent } from '@/chat/messages';
import { AnswerMessage } from '@/chat/AnswerMessage';
import { QuestionMessage } from '@/chat/QuestionMessage';

type ChatMessageProps = {
  message: UIMessage;
  streaming: boolean;
  holdFirstStep: boolean;
  messages: DocspotMessages['chat'];
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
  /** Offered on the latest answer once it is complete. */
  onRetry?: () => void;
};

/**
 * A question or an answer. Memoized: typing and streaming re-render only
 * the messages that change.
 */
export const ChatMessage = memo(function ChatMessage({
  message,
  streaming,
  holdFirstStep,
  messages,
  onNavigate,
  toInternalUrl,
  onRetry,
}: ChatMessageProps) {
  if (!hasMessageContent(message, { streaming, holdFirstStep })) return null;
  const text = getMessageText(message, { streaming, holdFirstStep });
  return message.role === 'user' ? (
    <QuestionMessage message={message} text={text} messages={messages} />
  ) : (
    <AnswerMessage
      message={message}
      text={text}
      streaming={streaming}
      messages={messages}
      onNavigate={onNavigate}
      toInternalUrl={toInternalUrl}
      onRetry={onRetry}
    />
  );
});
