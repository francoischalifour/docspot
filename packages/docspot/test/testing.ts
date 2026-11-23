// A chat backend for tests: the only external dependency the tests replace.
// It speaks the AI SDK UI message stream protocol through a real transport,
// so everything above the network runs as it does in production.
//
// Answers are scripted, or driven by the test step by step, so tests wait on
// what the reader sees, never on time.
import {
  DefaultChatTransport,
  type UIMessage,
  type UIMessageChunk,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';

import { type CreateChatOptions, createChat } from '@/chat';
import type { DocspotChat } from '@/types';

/** A question as the backend receives it. */
export type TestRequest = {
  /** The position of the request, from 0. */
  index: number;
  /** The text of the latest question. */
  question: string;
  /** The page attached to it, with the content `loadPage` gave. */
  page: { url: string; title?: string; content?: string } | undefined;
  messages: UIMessage[];
  signal: AbortSignal | undefined;
};

export type TestSource = { url: string; title: string };

/** A tool call, answered when it has an `output` or an `error`. */
export type TestTool = {
  name: string;
  input: unknown;
  output?: unknown;
  error?: string;
};

/**
 * A scripted answer: its text, or the tools it calls first, each in its own
 * step, then its text, streamed in pieces when given several, and sources.
 * A tool without an output ends the answer until the browser gives one.
 * `{ status }` fails the request.
 */
export type TestAnswer =
  | string
  | { status: number }
  | { tools?: TestTool[]; text?: string | string[]; sources?: TestSource[] };

/** A tool call the test answers later. */
export type TestToolCall = {
  output: (output: unknown) => void;
  error: (errorText: string) => void;
};

/** Writes one answer, step by step, as the backend streams it. */
export type TestReply = {
  request: TestRequest;
  /** Streams more of the answer's text. */
  text: (delta: string) => void;
  /** Calls a tool, which ends the current step once answered. */
  tool: (name: string, input: unknown) => TestToolCall;
  source: (source: TestSource) => void;
  /** Ends the answer. */
  end: () => void;
  /** Fails the request with an HTTP status, before anything streams. */
  fail: (status?: number) => void;
};

export type TestChatOptions = Omit<CreateChatOptions, 'transport'> & {
  /**
   * Answers a request. Returning undefined leaves it for the test, through
   * `nextRequest()`. Without it, the test drives every request.
   */
  answer?: (request: TestRequest) => TestAnswer | undefined;
};

export type TestChat = {
  chat: DocspotChat;
  /** Every request, in order. */
  requests: TestRequest[];
  /** The next request no script answered, once it arrives. */
  nextRequest: () => Promise<TestReply>;
  transport: DefaultChatTransport<UIMessage>;
};

function getQuestion(messages: UIMessage[]) {
  return (
    messages
      .findLast(message => message.role === 'user')
      ?.parts.flatMap(part => (part.type === 'text' ? [part.text] : []))
      .join('\n') ?? ''
  );
}

function createReply(request: TestRequest) {
  let resolveResponse!: (response: Response) => void;
  let rejectResponse!: (error: unknown) => void;
  const response = new Promise<Response>((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });
  let status: 'waiting' | 'streaming' | 'done' = 'waiting';
  const pending: UIMessageChunk[] = [];
  let write = (chunk: UIMessageChunk) => void pending.push(chunk);
  let finish = () => {};
  let inStep = false;
  let textId: string | undefined;
  let parts = 0;

  function stop() {
    status = 'done';
    finish();
  }
  // As `fetch` does: aborting before the server answers rejects it, and a
  // signal already aborted rejects at once.
  const abort = () => {
    if (status === 'waiting')
      rejectResponse(new DOMException('Aborted', 'AbortError'));
    stop();
  };
  if (request.signal?.aborted) abort();
  else request.signal?.addEventListener('abort', abort);

  /** Whether the answer can still be written; starts it on first use. */
  function open() {
    if (status === 'done') return false;
    if (status === 'waiting') {
      status = 'streaming';
      const stream = createUIMessageStream({
        // Continues the last answer, as after a tool the browser answered.
        originalMessages: request.messages,
        execute({ writer }) {
          write = chunk => {
            writer.write(chunk);
          };
          for (const chunk of pending.splice(0)) write(chunk);
          return new Promise<void>(resolve => {
            finish = resolve;
            if (status === 'done') resolve();
          });
        },
      });
      write({ type: 'start' });
      resolveResponse(createUIMessageStreamResponse({ stream }));
    }
    return true;
  }
  function startStep() {
    if (inStep) return;
    write({ type: 'start-step' });
    inStep = true;
  }
  function endText() {
    if (textId === undefined) return;
    write({ type: 'text-end', id: textId });
    textId = undefined;
  }
  function endStep() {
    endText();
    if (inStep) write({ type: 'finish-step' });
    inStep = false;
  }

  const reply: TestReply = {
    request,
    text(delta) {
      if (!open()) return;
      startStep();
      if (textId === undefined) {
        textId = `text-${parts++}`;
        write({ type: 'text-start', id: textId });
      }
      write({ type: 'text-delta', id: textId, delta });
    },
    tool(name, input) {
      const toolCallId = `${name}-${parts++}`;
      if (open()) {
        endText();
        startStep();
        write({
          type: 'tool-input-available',
          toolCallId,
          toolName: name,
          input,
        });
      }
      return {
        output(output) {
          if (!open()) return;
          write({ type: 'tool-output-available', toolCallId, output });
          endStep();
        },
        error(errorText) {
          if (!open()) return;
          write({ type: 'tool-output-error', toolCallId, errorText });
          endStep();
        },
      };
    },
    source({ url, title }) {
      if (!open()) return;
      startStep();
      write({
        type: 'source-url',
        sourceId: `source-${parts++}`,
        url,
        title,
      });
    },
    end() {
      if (!open()) return;
      endStep();
      write({ type: 'finish' });
      stop();
    },
    fail(failure = 500) {
      if (status !== 'waiting')
        throw new Error('A reply fails before it streams anything.');
      status = 'done';
      resolveResponse(new Response('Unavailable', { status: failure }));
    },
  };
  return { reply, response };
}

/** Plays a scripted answer, yielding between pieces so each renders. */
async function play(reply: TestReply, answer: TestAnswer) {
  if (typeof answer === 'string') {
    reply.text(answer);
    return reply.end();
  }
  if ('status' in answer) return reply.fail(answer.status);
  for (const { name, input, output, error } of answer.tools ?? []) {
    const call = reply.tool(name, input);
    if (error !== undefined) call.error(error);
    else if (output !== undefined) call.output(output);
    // The browser gives this tool's output, in a later request.
    else return reply.end();
  }
  const pieces =
    typeof answer.text === 'string' ? [answer.text] : (answer.text ?? []);
  for (const [index, piece] of pieces.entries()) {
    if (index > 0) await new Promise(resolve => setTimeout(resolve));
    reply.text(piece);
  }
  for (const source of answer.sources ?? []) reply.source(source);
  reply.end();
}

/**
 * A chat backend for tests, behind a real AI SDK transport. Each request is
 * answered by `answer`, or waits for the test to drive it.
 */
export function createTestChat({
  answer,
  ...options
}: TestChatOptions = {}): TestChat {
  const requests: TestRequest[] = [];
  const unclaimed: TestReply[] = [];
  const waiting: Array<(reply: TestReply) => void> = [];

  const fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as {
      messages: UIMessage[];
      docspot?: { page?: TestRequest['page'] };
    };
    const request: TestRequest = {
      index: requests.length,
      question: getQuestion(body.messages),
      page: body.docspot?.page,
      messages: body.messages,
      signal: init?.signal ?? undefined,
    };
    requests.push(request);
    const { reply, response } = createReply(request);
    const scripted = answer?.(request);
    if (scripted !== undefined) void play(reply, scripted);
    else {
      const next = waiting.shift();
      if (next) next(reply);
      else unclaimed.push(reply);
    }
    return response;
  };

  const transport = new DefaultChatTransport({ api: '/api/chat', fetch });
  return {
    chat: createChat({ ...options, transport }),
    requests,
    nextRequest() {
      const reply = unclaimed.shift();
      if (reply) return Promise.resolve(reply);
      return new Promise(resolve => waiting.push(resolve));
    },
    transport,
  };
}
