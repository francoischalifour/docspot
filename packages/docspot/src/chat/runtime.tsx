import type { ChatTransport, UIMessage } from 'ai';

import { ChatPanel } from '@/chat/ChatPanel';
import type { ChatPanelProps, ChatRuntime } from '@/chat/contract';
import {
  type Session,
  ask,
  createSession,
  discard,
  stop,
  toConversation,
} from '@/chat/session';

export type RuntimeOptions = { holdFirstStep: boolean };

export function createRuntime(
  transport: ChatTransport<UIMessage>,
  { holdFirstStep }: RuntimeOptions
): ChatRuntime {
  function Panel(props: ChatPanelProps) {
    return <ChatPanel {...props} holdFirstStep={holdFirstStep} />;
  }
  return {
    createSession: (saved, options) => createSession(transport, saved, options),
    ask: (session, question, page, source) =>
      ask(session as Session, question, page, source),
    stop: session => stop(session as Session),
    discard: session => discard(session as Session),
    toConversation: session =>
      toConversation(session.id, (session as Session).messages),
    Panel,
  };
}
