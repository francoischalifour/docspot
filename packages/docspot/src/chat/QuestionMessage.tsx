import type { UIMessage } from 'ai';

import type { DocspotMessages } from '@/messages';
import { CopyButton } from '@/ui/CopyButton';
import { getMetadataTime } from '@/chat/messages';
import { Timestamp } from '@/chat/Timestamp';

type QuestionMessageProps = {
  message: UIMessage;
  text: string;
  messages: DocspotMessages['chat'];
};

/** A question as asked, with when and a way to copy it. */
export function QuestionMessage({
  message,
  text,
  messages,
}: QuestionMessageProps) {
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
}
