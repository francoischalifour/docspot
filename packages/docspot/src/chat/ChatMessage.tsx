import type { UIMessage } from 'ai';
import { type MouseEvent, memo } from 'react';

import type { DocspotMessages } from '@/messages';
import type { DocspotFeedback } from '@/types';
import { getMessageText, hasMessageContent } from '@/chat/messages';
import { AnswerMessage } from '@/chat/AnswerMessage';
import { QuestionMessage } from '@/chat/QuestionMessage';
import type { DocspotTools } from '@/chat/tools';

type ChatMessageProps = {
  message: UIMessage;
  streaming: boolean;
  holdFirstStep: boolean;
  tools: DocspotTools;
  onToolOutput: (tool: string, toolCallId: string, output: unknown) => void;
  messages: DocspotMessages['chat'];
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
  /** Offered on the latest answer once it is complete. */
  onRetry?: () => void;
  /** Rates an answer; not offered on one that failed. */
  onFeedback?: (messageId: string, feedback: DocspotFeedback | null) => void;
};

/**
 * A question or an answer. Memoized: typing and streaming re-render only
 * the messages that change.
 */
export const ChatMessage = memo(function ChatMessage({
  message,
  streaming,
  holdFirstStep,
  tools,
  onToolOutput,
  messages,
  onNavigate,
  toInternalUrl,
  onRetry,
  onFeedback,
}: ChatMessageProps) {
  if (!hasMessageContent(message, { streaming, holdFirstStep, tools }))
    return null;
  const text = getMessageText(message, { streaming, holdFirstStep });
  return message.role === 'user' ? (
    <QuestionMessage message={message} text={text} messages={messages} />
  ) : (
    <AnswerMessage
      message={message}
      text={text}
      streaming={streaming}
      tools={tools}
      onToolOutput={onToolOutput}
      messages={messages}
      onNavigate={onNavigate}
      toInternalUrl={toInternalUrl}
      onRetry={onRetry}
      onFeedback={onFeedback}
    />
  );
});
