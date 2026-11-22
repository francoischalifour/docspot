import { createContext, use } from 'react';

import type { ConversationApi } from '@/chat/useConversation';

export const ConversationContext =
  /* @__PURE__ */ createContext<ConversationApi | null>(null);

/** The conversation a part belongs to. */
export function useConversationContext(part: string): ConversationApi {
  const conversation = use(ConversationContext);
  if (!conversation)
    throw new Error(`Docspot: <${part}> must be inside a conversation.`);
  return conversation;
}
