// A scripted documentation assistant speaking the AI SDK UI message stream
// protocol, so the example runs without a model provider. Swap it for a real
// endpoint (for example `streamText(...).toUIMessageStreamResponse()`).
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  type UIMessage,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
} from 'ai';
import type { DocspotRequestContext } from 'docspot/chat';
import type { Plugin } from 'vite';

import { findPage, pages } from './src/pages';

type Body = {
  trigger: 'submit-message' | 'regenerate-message';
  messages: UIMessage[];
  docspot?: DocspotRequestContext;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getQuestion(body: Body) {
  return (
    body.messages
      .findLast(message => message.role === 'user')
      ?.parts.flatMap(part => (part.type === 'text' ? [part.text] : []))
      .join('\n') ?? ''
  );
}

/** Ranks pages by shared words, preferring the attached page. */
function findRelevantPages(question: string, attachedUrl: string | undefined) {
  const words = new Set(question.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  // Docspot sends the attached page's absolute URL.
  const attached = attachedUrl && findPage(attachedUrl);
  return pages
    .map(page => ({
      page,
      score:
        (page.markdown.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(word =>
          words.has(word)
        ).length + (page === attached ? 2 : 0),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.page);
}

function answer(body: Body) {
  const question = getQuestion(body);
  const attached = body.docspot?.page;
  const sources = findRelevantPages(question, attached?.url).slice(0, 2);
  const best = sources[0];
  const lines = best
    ? best.markdown
        .split('\n\n')
        .slice(1)
        .map(paragraph => paragraph.trim())
    : [
        "I couldn't find that in these docs. Try asking about installation, configuration, or deployment.",
      ];
  const intro = attached?.content
    ? `Based on **${attached.title ?? attached.url}**, and the rest of the docs:`
    : 'From the docs:';
  return {
    text: [
      intro,
      ...lines,
      best ? `See [${best.title}](${best.url}) for details.` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    sources,
  };
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  request.setEncoding('utf8');
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw) as Body;
  const question = getQuestion(body);
  // Questions mentioning "flaky" fail once, to demonstrate retrying.
  if (/flaky/i.test(question) && body.trigger !== 'regenerate-message') {
    response.statusCode = 503;
    response.end('The assistant is busy. Try again.');
    return;
  }
  const { text, sources } = answer(body);
  // Stops writing once the client stops the answer.
  let closed = false;
  response.on('close', () => (closed = true));
  const stream = createUIMessageStream({
    async execute({ writer }) {
      writer.write({ type: 'start' });
      writer.write({ type: 'start-step' });
      writer.write({
        type: 'tool-input-available',
        toolCallId: 'search',
        toolName: 'searchDocs',
        input: { query: question.slice(0, 60) },
      });
      await wait(700);
      writer.write({
        type: 'tool-output-available',
        toolCallId: 'search',
        output: { pages: sources.length },
      });
      writer.write({ type: 'finish-step' });
      writer.write({ type: 'start-step' });
      writer.write({ type: 'text-start', id: 'answer' });
      for (const token of text.match(/\S+\s*/g) ?? []) {
        if (closed) return;
        writer.write({ type: 'text-delta', id: 'answer', delta: token });
        await wait(35);
      }
      writer.write({ type: 'text-end', id: 'answer' });
      for (const page of sources)
        writer.write({
          type: 'source-url',
          sourceId: page.url,
          url: page.url,
          title: page.title,
        });
      writer.write({ type: 'finish-step' });
      writer.write({ type: 'finish' });
    },
  });
  void pipeUIMessageStreamToResponse({ response, stream });
}

export function chatServer(): Plugin {
  const middleware = (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) => {
    if (request.url !== '/api/chat' || request.method !== 'POST') return next();
    void handle(request, response).catch((error: unknown) => {
      response.statusCode = 500;
      response.end(String(error));
    });
  };
  return {
    name: 'docspot-example-chat',
    configureServer: server => void server.middlewares.use(middleware),
    configurePreviewServer: server => void server.middlewares.use(middleware),
  };
}
