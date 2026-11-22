import type { UIMessage } from 'ai';

import type { DocspotMessages } from '@/messages';
import { RetryIcon } from '@/ui/icons';
import { CopyButton } from '@/ui/CopyButton';
import { IconButton } from '@/ui/IconButton';
import { getMetadataTime } from '@/chat/messages';
import { Timestamp } from '@/chat/Timestamp';

type AnswerActionsProps = {
  message: UIMessage;
  text: string;
  messages: DocspotMessages['chat'];
  /** Offered on the latest answer once it is complete. */
  onRetry?: () => void;
};

/** Copies or retries a complete answer, with when it was answered. */
export function AnswerActions({
  message,
  text,
  messages,
  onRetry,
}: AnswerActionsProps) {
  return (
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
  );
}
