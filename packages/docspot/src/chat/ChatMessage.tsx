import type { UIMessage } from 'ai';
import { type MouseEvent, memo } from 'react';

import type { DocspotMessages } from '@/messages';
import { ArrowUpRightIcon, RetryIcon } from '@/ui/icons';
import { CopyButton } from '@/ui/CopyButton';
import { IconButton } from '@/ui/IconButton';
import {
  getMessageText,
  getMetadataTime,
  hasMessageContent,
} from '@/chat/messages';
import { ReadingAnchor } from '@/chat/ReadingAnchor';
import { Timestamp } from '@/chat/Timestamp';
import { Markdown } from '@/chat/Markdown';
import { AnswerLink } from '@/chat/AnswerLink';

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

export const ChatMessage = memo(function ChatMessage({
  message,
  streaming,
  holdFirstStep,
  messages,
  onNavigate,
  toInternalUrl,
  onRetry,
}: ChatMessageProps) {
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
                  <AnswerLink
                    href={source.url}
                    onNavigate={onNavigate}
                    toInternalUrl={toInternalUrl}
                    externalIcon={null}
                  >
                    {source.title ?? messages.sourceFallback}
                    <ArrowUpRightIcon size={12} />
                  </AnswerLink>
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
