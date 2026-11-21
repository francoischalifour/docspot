import type { ChatTransport, UIMessage } from 'ai';

import type { DocspotChat } from '@/types';
import { createChatHandle } from '@/chat/contract';

type Transport = ChatTransport<UIMessage>;

export type CreateChatOptions = {
  /**
   * An AI SDK transport, such as `new DefaultChatTransport({ api })`, or a
   * function that loads one when chat is first used. Request bodies carry
   * `docspot.page` when a page is attached, with the content `loadPage`
   * returned for it.
   */
  transport: Transport | (() => Promise<Transport>);
  /**
   * Shows nothing of an answer's first step until it completes, for agents
   * that narrate before searching. Progress shows meanwhile.
   */
  holdFirstStep?: boolean;
};

/**
 * Configures chat. The chat interface and the AI SDK load only when chat is
 * first used, or once the page is idle.
 */
export function createChat({
  transport,
  holdFirstStep = false,
}: CreateChatOptions): DocspotChat {
  return createChatHandle({
    async load() {
      const [{ createRuntime }, resolved] = await Promise.all([
        import('@/chat/runtime'),
        typeof transport === 'function' ? transport() : transport,
      ]);
      return createRuntime(resolved, { holdFirstStep });
    },
  });
}

export { CONTEXT_FIELD } from '@/chat/contract';
export type { DocspotRequestContext } from '@/chat/contract';
export type { DocspotQuestionMetadata } from '@/chat/session';
