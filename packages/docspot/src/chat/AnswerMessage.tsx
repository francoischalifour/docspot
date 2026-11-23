import type { UIMessage } from 'ai';
import type { MouseEvent } from 'react';

import type { DocspotMessages } from '@/messages';
import type { DocspotFeedback } from '@/types';
import { AnswerActions } from '@/chat/AnswerActions';
import { AnswerSources } from '@/chat/AnswerSources';
import { AnswerTools } from '@/chat/AnswerTools';
import { isStopped } from '@/chat/messages';
import type { DocspotTools } from '@/chat/tools';
import { Markdown } from '@/chat/Markdown';
import { ReadingAnchor } from '@/chat/ReadingAnchor';

type AnswerMessageProps = {
  message: UIMessage;
  /** The answer's latest step as Markdown. */
  text: string;
  streaming: boolean;
  tools: DocspotTools;
  onToolOutput: (tool: string, toolCallId: string, output: unknown) => void;
  messages: DocspotMessages['chat'];
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
  onRetry?: () => void;
  onFeedback?: (messageId: string, feedback: DocspotFeedback | null) => void;
};

/**
 * An answer: its tool calls that have a renderer, its Markdown, the sources
 * it cites, and actions once it is complete. While it streams, its start
 * stays where the reader begins.
 */
export function AnswerMessage({
  message,
  text,
  streaming,
  tools,
  onToolOutput,
  messages,
  onNavigate,
  toInternalUrl,
  onRetry,
  onFeedback,
}: AnswerMessageProps) {
  const stopped = isStopped(message);
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
        <AnswerTools
          message={message}
          tools={tools}
          onToolOutput={onToolOutput}
        />
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
        {text && !streaming && stopped && (
          <p className="docspot-answer-stopped">{messages.stopped}</p>
        )}
        {text && !streaming && (
          <AnswerActions
            message={message}
            text={text}
            messages={messages}
            onRetry={onRetry}
            // A stopped answer is incomplete, so not one to rate.
            onFeedback={stopped ? undefined : onFeedback}
          />
        )}
      </article>
    </ReadingAnchor>
  );
}
