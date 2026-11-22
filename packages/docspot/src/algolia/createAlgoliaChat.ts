import type { UIMessage } from 'ai';

import { createChat } from '@/chat/createChat';
import { CONTEXT_FIELD, type DocspotRequestContext } from '@/chat/contract';
import type { DocspotChat } from '@/types';

export type AlgoliaChatOptions = {
  appId: string;
  /** A search-only API key with access to the agent. */
  apiKey: string;
  /** The Agent Studio agent ID. */
  agentId: string;
  /** Indices the agent searches. */
  indices: string[];
  /** Characters of page content sent as context. Defaults to 24,000. */
  contextLimit?: number;
};

/** A Markdown page's top-level heading. */
const FIRST_HEADING = /^#\s+(.+)$/m;

/**
 * Formats an attached page as text the agent reads with the question. The
 * page guides relevance without overriding what the user asks.
 */
function formatPageContext(
  page: NonNullable<DocspotRequestContext['page']>,
  contextLimit: number
) {
  const markdown = (page.content ?? '').slice(0, contextLimit);
  const title = markdown.match(FIRST_HEADING)?.[1] ?? page.title ?? page.url;
  // Docspot sends the page URL already resolved against `siteUrl`.
  return `Documentation context (a relevance hint; follow the user's explicit question even when it concerns another page):\nTitle: ${title}\nURL: ${page.url}\n<documentation>\n${markdown}\n</documentation>`;
}

function appendToLastQuestion(messages: UIMessage[], text: string) {
  const question = messages.findLast(message => message.role === 'user');
  return messages.map(message =>
    message === question
      ? {
          ...message,
          parts: message.parts.map(part =>
            part.type === 'text'
              ? { ...part, text: `${part.text}\n\n${text}` }
              : part
          ),
        }
      : message
  );
}

/**
 * Chat with an Algolia Agent Studio agent. The attached page's content is
 * added to the latest question when it is sent, not stored with it.
 */
export function createAlgoliaChat({
  appId,
  apiKey,
  agentId,
  indices,
  contextLimit = 24_000,
}: AlgoliaChatOptions): DocspotChat {
  return createChat({
    // The agent narrates its search before answering.
    holdFirstStep: true,
    transport: () =>
      import('ai').then(
        ({ DefaultChatTransport }) =>
          new DefaultChatTransport<UIMessage>({
            api: `https://${appId}.algolia.net/agent-studio/1/agents/${agentId}/completions?compatibilityMode=ai-sdk-5&stream=true`,
            headers: {
              'X-Algolia-Application-Id': appId,
              'X-Algolia-API-Key': apiKey,
            },
            prepareSendMessagesRequest({
              id,
              messages,
              body,
              trigger,
              messageId,
            }) {
              const { [CONTEXT_FIELD]: context, ...rest } = (body ?? {}) as {
                [CONTEXT_FIELD]?: DocspotRequestContext;
              };
              const page = context?.page;
              return {
                body: {
                  ...rest,
                  id,
                  trigger,
                  messageId,
                  messages:
                    page?.content !== undefined
                      ? appendToLastQuestion(
                          messages,
                          formatPageContext(page, contextLimit)
                        )
                      : messages,
                  algolia: { indices },
                },
              };
            },
          })
      ),
  });
}
