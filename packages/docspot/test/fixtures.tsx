import {
  type UIMessageChunk,
  DefaultChatTransport,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';

import { createChat } from '@/chat';
import type { DocspotResult } from '@/index';

export const results: DocspotResult[] = [
  {
    url: '/docs/query/sql-explorer#example',
    title: 'Example',
    pageTitle: 'SQL Explorer',
    breadcrumb: ['Lakehouse', 'SQL Explorer'],
    group: 'Lakehouse',
    type: 'section',
    excerpt: 'Join product usage to account data.',
    highlights: {
      title: [{ text: 'Example', highlighted: false }],
      breadcrumb: [
        [{ text: 'Lakehouse', highlighted: true }],
        [{ text: 'SQL Explorer', highlighted: false }],
      ],
      excerpt: [
        { text: 'Join ', highlighted: false },
        { text: 'product', highlighted: true },
        { text: ' usage to account data.', highlighted: false },
      ],
    },
  },
  {
    url: '/docs/query/http-api',
    title: 'HTTP API',
    breadcrumb: ['Lakehouse'],
    group: 'Lakehouse',
    type: 'page',
    excerpt: 'Run a SQL query over HTTP.',
  },
  {
    url: '/docs/agents/setup',
    title: 'Connect your agent',
    breadcrumb: ['Agents'],
    group: 'Agents',
    type: 'page',
  },
];

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type Answer = {
  text?: string;
  /** Text arrives in these pieces, with a pause between them. */
  chunks?: string[];
  chunkDelayMs?: number;
  sources?: Array<{ url: string; title: string }>;
  /** A tool call with a query, before the answer text. */
  toolQuery?: string;
  /** Text the agent says before calling its tool. */
  preamble?: string;
  /** Fails the request with this HTTP status. */
  status?: number;
};

export type ChatRequestRecord = {
  body: {
    messages: Array<{
      role: string;
      parts: Array<{ type: string; text?: string }>;
    }>;
    docspot?: { page?: { url: string; title?: string; content?: string } };
  };
  signal: AbortSignal | null | undefined;
};

/**
 * A chat backend speaking the AI SDK UI message stream protocol: the only
 * external dependency the chat tests replace.
 */
export function createChatServer(
  answer: (question: string, index: number) => Answer,
  { holdFirstStep = false } = {}
) {
  const requests: ChatRequestRecord[] = [];
  const fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as ChatRequestRecord['body'];
    requests.push({ body, signal: init?.signal });
    const question =
      body.messages
        .findLast(message => message.role === 'user')
        ?.parts.filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n') ?? '';
    const reply = answer(question, requests.length - 1);
    if (reply.status)
      return new Response('Unavailable', { status: reply.status });
    const stream = createUIMessageStream({
      async execute({ writer }) {
        const write = (chunk: UIMessageChunk) => writer.write(chunk);
        write({ type: 'start' });
        if (reply.toolQuery) {
          write({ type: 'start-step' });
          if (reply.preamble) {
            write({ type: 'text-start', id: 'preamble' });
            write({
              type: 'text-delta',
              id: 'preamble',
              delta: reply.preamble,
            });
            write({ type: 'text-end', id: 'preamble' });
          }
          write({
            type: 'tool-input-available',
            toolCallId: 'search-1',
            toolName: 'searchDocs',
            input: { query: reply.toolQuery },
          });
          await wait(reply.chunkDelayMs ?? 0);
          write({
            type: 'tool-output-available',
            toolCallId: 'search-1',
            output: { hits: 3 },
          });
          write({ type: 'finish-step' });
        }
        write({ type: 'start-step' });
        write({ type: 'text-start', id: 'text' });
        for (const delta of reply.chunks ?? [reply.text ?? '']) {
          if (init?.signal?.aborted) return;
          write({ type: 'text-delta', id: 'text', delta });
          if (reply.chunkDelayMs) await wait(reply.chunkDelayMs);
        }
        write({ type: 'text-end', id: 'text' });
        for (const [index, source] of (reply.sources ?? []).entries())
          write({
            type: 'source-url',
            sourceId: `source-${index}`,
            url: source.url,
            title: source.title,
          });
        write({ type: 'finish-step' });
        write({ type: 'finish' });
      },
    });
    return createUIMessageStreamResponse({ stream });
  };
  const transport = new DefaultChatTransport({ api: '/api/chat', fetch });
  const chat = createChat({ transport, holdFirstStep });
  return { chat, requests, transport };
}

export function lastQuestion(request: ChatRequestRecord | undefined) {
  return request?.body.messages
    .findLast(message => message.role === 'user')
    ?.parts.filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}
