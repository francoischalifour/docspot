import type { ChatTransport, UIMessage } from 'ai';

import type { DocspotChat } from '@/types';
import { createChatHandle } from '@/chat/contract';
import type { DocspotTools } from '@/chat/tools';

type Transport = ChatTransport<UIMessage>;

export type CreateChatOptions = {
  /**
   * An AI SDK transport, such as `new DefaultChatTransport({ api })`, or a
   * function that loads one when chat is first used. Request bodies carry
   * `docspot.page` when a page is attached, with the content
   * `context.loadPage` returned for it.
   */
  transport: Transport | (() => Promise<Transport>);
  /**
   * Shows nothing of an answer's first step until it completes, for agents
   * that narrate before searching. Progress shows meanwhile.
   */
  holdFirstStep?: boolean;
  /**
   * Renders tool calls in answers, by tool name, such as a card for a
   * tool's output or a form for a tool the reader answers. Tools without
   * a renderer show only as progress. Renderers may be lazy.
   */
  tools?: DocspotTools;
};

const noTools: DocspotTools = {};

/**
 * Configures chat. The chat interface and the AI SDK load only when chat is
 * first used, or once the page is idle.
 */
export function createChat({
  transport,
  holdFirstStep = false,
  tools = noTools,
}: CreateChatOptions): DocspotChat {
  return createChatHandle({
    async load() {
      const [{ createRuntime }, resolved] = await Promise.all([
        import('@/chat/runtime'),
        typeof transport === 'function' ? transport() : transport,
      ]);
      return createRuntime(resolved, { holdFirstStep, tools });
    },
  });
}
