import { useId, useState } from 'react';

import type { DocspotMessages } from '@/messages';
import type { DocspotFeedback, DocspotFeedbackReason } from '@/types';
import { CloseIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { IconButton } from '@/ui/IconButton';

type AnswerFeedbackFormProps = {
  /** Thanks the reader instead of asking. */
  sent: boolean;
  messages: DocspotMessages['chat'];
  onSend: (details: Omit<DocspotFeedback, 'value'>) => void;
  onClose: () => void;
};

const COMMENT_LIMIT = 500;

/**
 * Asks why an answer was not helpful: a reason to choose, a few words, or
 * both, all optional. Escape or its close button leaves the rating as is.
 */
export function AnswerFeedbackForm({
  sent,
  messages,
  onSend,
  onClose,
}: AnswerFeedbackFormProps) {
  const name = useId();
  const [reason, setReason] = useState<DocspotFeedbackReason>();
  const [comment, setComment] = useState('');
  const reasons: Array<[DocspotFeedbackReason, string]> = [
    ['incorrect', messages.reasonIncorrect],
    ['incomplete', messages.reasonIncomplete],
    ['unrelated', messages.reasonUnrelated],
  ];
  return (
    <div className="docspot-feedback">
      {!sent && (
        <form
          className="docspot-feedback-form"
          onSubmit={event => {
            event.preventDefault();
            const text = comment.trim();
            onSend({
              ...(reason && { reason }),
              ...(text && { comment: text }),
            });
          }}
          onKeyDown={event => {
            if (event.key !== 'Escape') return;
            // Closes the form, not the chat panel around it.
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
        >
          <fieldset className="docspot-feedback-fields">
            <legend className="docspot-feedback-title">
              {messages.feedbackReason}
            </legend>
            <div className="docspot-feedback-reasons">
              {reasons.map(([value, label]) => (
                <label key={value} className="docspot-feedback-reason">
                  <input
                    type="radio"
                    name={name}
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="docspot-feedback-comment">
              <span>{messages.feedbackComment}</span>
              <input
                type="text"
                value={comment}
                maxLength={COMMENT_LIMIT}
                autoComplete="off"
                onChange={event => setComment(event.target.value)}
              />
            </label>
            <button type="submit" className="docspot-button">
              {messages.sendFeedback}
            </button>
          </fieldset>
          <IconButton
            label={messages.closeFeedback}
            side="top"
            className="docspot-feedback-close"
            onClick={onClose}
          >
            <SlotIcon name="close" icon={CloseIcon} size={14} />
          </IconButton>
        </form>
      )}
      {/* Present while asking, so the thanks is announced once sent. */}
      <p role="status" className="docspot-feedback-status">
        {sent ? messages.feedbackSent : ''}
      </p>
    </div>
  );
}
