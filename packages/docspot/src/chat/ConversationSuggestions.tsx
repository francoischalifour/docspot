import { SuggestedQuestions } from '@/ui/SuggestedQuestions';
import { Welcome } from '@/ui/Welcome';
import { getPrompts } from '@/ui/getPrompts';
import { useConversationContext } from '@/chat/ConversationContext';

/**
 * Above the composer: a welcome with suggested questions in an empty chat,
 * or the current page's questions after moving to another page.
 */
export function ConversationSuggestions() {
  const conversation = useConversationContext('ConversationSuggestions');
  const { messages, contextPage, pageSuggestions } = conversation;
  if (!conversation.chatMessages.length)
    return (
      <Welcome
        className="docspot-chat-welcome"
        title={messages.welcome}
        questions={getPrompts(contextPage, conversation.prompts)}
        onChoose={question => conversation.ask(question, 'prompt')}
      />
    );
  if (!pageSuggestions.length) return null;
  return (
    <SuggestedQuestions
      aria-label={messages.suggestionsAbout(
        contextPage?.title ?? contextPage?.url ?? ''
      )}
      className="docspot-chat-welcome"
      questions={pageSuggestions}
      onChoose={question => conversation.ask(question, 'prompt')}
    />
  );
}
