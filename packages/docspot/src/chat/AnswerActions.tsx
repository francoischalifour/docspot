import type { UIMessage } from 'ai';
import { useRef, useState } from 'react';

import type { DocspotMessages } from '@/messages';
import type { DocspotFeedback } from '@/types';
import { RetryIcon, ThumbDownIcon, ThumbUpIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { CopyButton } from '@/ui/CopyButton';
import { IconButton } from '@/ui/IconButton';
import { AnswerFeedbackForm } from '@/chat/AnswerFeedbackForm';
import { getFeedback, getMetadataTime } from '@/chat/messages';
import { Timestamp } from '@/chat/Timestamp';

type AnswerActionsProps = {
  message: UIMessage;
  text: string;
  messages: DocspotMessages['chat'];
  /** Offered on the latest answer once it is complete. */
  onRetry?: () => void;
  /** Rates the answer; offered once it is complete, unless it stopped or failed. */
  onFeedback?: (messageId: string, feedback: DocspotFeedback | null) => void;
};

/**
 * Copies, retries, or rates a complete answer, with when it was answered.
 * Rating it down asks why, optionally; choosing a rating again clears it.
 */
export function AnswerActions({
  message,
  text,
  messages,
  onRetry,
  onFeedback,
}: AnswerActionsProps) {
  const feedback = onFeedback && getFeedback(message);
  // Asking why only follows a rating given here, never a restored one.
  const [asking, setAsking] = useState<'reason' | 'sent' | null>(null);
  const downRef = useRef<HTMLButtonElement>(null);

  function rate(value: DocspotFeedback['value']) {
    const next = feedback?.value === value ? null : { value };
    onFeedback?.(message.id, next);
    setAsking(next?.value === 'down' ? 'reason' : null);
  }

  return (
    <>
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
            <SlotIcon name="retry" icon={RetryIcon} size={14} />
          </IconButton>
        )}
        {onFeedback && (
          <>
            <IconButton
              label={messages.rateHelpful}
              side="top"
              className="docspot-message-action"
              aria-pressed={feedback?.value === 'up'}
              onClick={() => rate('up')}
            >
              <SlotIcon name="helpful" icon={ThumbUpIcon} size={14} />
            </IconButton>
            <IconButton
              ref={downRef}
              label={messages.rateUnhelpful}
              side="top"
              className="docspot-message-action"
              aria-pressed={feedback?.value === 'down'}
              onClick={() => rate('down')}
            >
              <SlotIcon name="unhelpful" icon={ThumbDownIcon} size={14} />
            </IconButton>
          </>
        )}
        <Timestamp time={getMetadataTime(message, 'answeredAt')} />
      </div>
      {onFeedback && asking && feedback?.value === 'down' && (
        <AnswerFeedbackForm
          sent={asking === 'sent'}
          messages={messages}
          onSend={details => {
            if (details.reason || details.comment)
              onFeedback(message.id, { value: 'down', ...details });
            setAsking('sent');
            downRef.current?.focus();
          }}
          onClose={() => {
            setAsking(null);
            downRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
