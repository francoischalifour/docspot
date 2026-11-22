import type { CSSProperties } from 'react';

import type { ConversationProps } from '@/chat/contract';
import { ConversationComposer } from '@/chat/ConversationComposer';
import { ConversationContext } from '@/chat/ConversationContext';
import { ConversationHeader } from '@/chat/ConversationHeader';
import { ConversationLog } from '@/chat/ConversationLog';
import { ConversationSuggestions } from '@/chat/ConversationSuggestions';
import { useConversation } from '@/chat/useConversation';
import { useFloatingFooter } from '@/chat/useFloatingFooter';

/** A conversation in the chat panel: `useConversation` and its parts. */
export function Conversation(props: ConversationProps) {
  const conversation = useConversation(props);
  const { setFooter, footerHeight } = useFloatingFooter();
  return (
    <ConversationContext value={conversation}>
      <div className="docspot-chat-body">
        <ConversationHeader />
        {/* The composer floats over the conversation, so it scrolls full height. */}
        <div
          className="docspot-chat-main"
          style={
            {
              '--docspot-chat-footer-height': `${footerHeight}px`,
            } as CSSProperties
          }
        >
          <ConversationLog />
          <div ref={setFooter} className="docspot-chat-footer">
            <ConversationSuggestions />
            <ConversationComposer />
          </div>
        </div>
      </div>
    </ConversationContext>
  );
}
