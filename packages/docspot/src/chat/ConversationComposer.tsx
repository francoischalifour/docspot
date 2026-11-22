import { Composer } from '@/chat/Composer';
import { useConversationContext } from '@/chat/ConversationContext';

/** The composer for the next question, with the page it attaches. */
export function ConversationComposer() {
  const conversation = useConversationContext('ConversationComposer');
  const { messages } = conversation;
  const hasMessages = conversation.chatMessages.length > 0;
  return (
    <Composer
      inputRef={conversation.composerRef}
      draft={conversation.draft}
      onChange={conversation.onDraftChange}
      onSubmit={conversation.submitDraft}
      busy={conversation.busy}
      onStop={conversation.stop}
      contextPage={conversation.contextPage}
      onRemoveContext={conversation.onRemoveContext}
      messages={messages}
      label={hasMessages ? messages.followUpLabel : messages.askLabel}
      placeholder={
        hasMessages ? messages.followUpPlaceholder : messages.placeholder
      }
    />
  );
}
