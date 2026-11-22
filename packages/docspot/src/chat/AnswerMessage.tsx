import type { UIMessage } from 'ai';
import type { MouseEvent } from 'react';

import type { DocspotMessages } from '@/messages';
import { AnswerActions } from '@/chat/AnswerActions';
import { AnswerSources } from '@/chat/AnswerSources';
import { Markdown } from '@/chat/Markdown';
import { ReadingAnchor } from '@/chat/ReadingAnchor';

type AnswerMessageProps = {
  message: UIMessage;
  /** The answer's latest step as Markdown. */
  text: string;
  streaming: boolean;
  messages: DocspotMessages['chat'];
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
  onRetry?: () => void;
};

/**
 * An answer: its Markdown, the sources it cites, and actions once it is
 * complete. While it streams, its start stays where the reader begins.
 */
export function AnswerMessage({
  message,
  text,
  streaming,
  messages,
  onNavigate,
  toInternalUrl,
  onRetry,
}: AnswerMessageProps) {
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
        <AnswerSources
          sources={message.parts.filter(part => part.type === 'source-url')}
          messages={messages}
          onNavigate={onNavigate}
          toInternalUrl={toInternalUrl}
        />
        {text && !streaming && (
          <AnswerActions
            message={message}
            text={text}
            messages={messages}
            onRetry={onRetry}
          />
        )}
      </article>
    </ReadingAnchor>
  );
}
