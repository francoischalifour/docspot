import type { ChatTransport, UIMessage } from 'ai';

import { Conversation } from '@/chat/Conversation';
import type { ConversationProps, ChatRuntime } from '@/chat/contract';
import type { DocspotTools } from '@/chat/tools';
import {
  type Session,
  ask,
  createSession,
  discard,
  stop,
  toConversation,
} from '@/chat/session';

export type RuntimeOptions = { holdFirstStep: boolean; tools: DocspotTools };

export function createRuntime(
  transport: ChatTransport<UIMessage>,
  { holdFirstStep, tools }: RuntimeOptions
): ChatRuntime {
  function RuntimeConversation(
    props: Omit<ConversationProps, 'holdFirstStep' | 'tools'>
  ) {
    return (
      <Conversation {...props} holdFirstStep={holdFirstStep} tools={tools} />
    );
  }
  return {
    createSession: (saved, options) => createSession(transport, saved, options),
    ask: (session, question, page, source) =>
      ask(session as Session, question, page, source),
    stop: session => stop(session as Session),
    discard: session => discard(session as Session),
    toConversation: session =>
      toConversation(session.id, (session as Session).messages),
    Conversation: RuntimeConversation,
  };
}
