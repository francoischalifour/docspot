import type { DynamicToolUIPart, ToolUIPart, UIMessage } from 'ai';

import type { DocspotMessages } from '@/messages';
import { type DocspotTools, getRenderedToolCalls } from '@/chat/tools';

export function isToolPart(
  part: UIMessage['parts'][number]
): part is ToolUIPart | DynamicToolUIPart {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool';
}

/**
 * The text to show for a message: a question as it was typed, or the
 * answer's latest step. Tool steps show nothing. With `holdFirstStep`, a
 * first step still streaming shows nothing either, for agents that narrate
 * before they search.
 */
export function getMessageText(
  message: UIMessage,
  {
    streaming = false,
    holdFirstStep = false,
  }: { streaming?: boolean; holdFirstStep?: boolean } = {}
): string {
  const metadata = message.metadata as { question?: unknown } | undefined;
  if (message.role === 'user' && typeof metadata?.question === 'string')
    return metadata.question;
  const lastStepIndex = message.parts.findLastIndex(
    part => part.type === 'step-start'
  );
  const currentStepParts = message.parts.slice(lastStepIndex + 1);
  if (message.role === 'assistant') {
    const isToolStep = currentStepParts.some(isToolPart);
    const isHeldStep = holdFirstStep && streaming && lastStepIndex === 0;
    if (isToolStep || isHeldStep) return '';
  }
  return currentStepParts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

const TRAILING_PUNCTUATION = /[\s?!.]+$/;
const WHITESPACE = /\s+/g;

/** Text compared for meaning: case, spacing, and final punctuation aside. */
function normalizeQuery(text: string) {
  return text
    .toLowerCase()
    .replace(TRAILING_PUNCTUATION, '')
    .replace(WHITESPACE, ' ');
}

/**
 * What the agent is doing before its answer text arrives. A search for the
 * question as asked says nothing new, so it shows as thinking.
 */
export function getAnswerProgress(
  message: UIMessage | undefined,
  messages: DocspotMessages['chat'],
  question: string
): string {
  const tool =
    message?.role === 'assistant'
      ? message.parts.findLast(isToolPart)
      : undefined;
  const input = tool?.input;
  const query =
    input && typeof input === 'object' && 'query' in input
      ? input.query
      : undefined;
  return typeof query === 'string' &&
    query.trim() &&
    normalizeQuery(query) !== normalizeQuery(question)
    ? messages.searchingFor(query.trim())
    : messages.thinking;
}

/** Answers render once they have text or sources, so empty ones take no space. */
export function hasMessageContent(
  message: UIMessage,
  options: { streaming: boolean; holdFirstStep: boolean; tools: DocspotTools }
) {
  if (message.role === 'user') return true;
  return (
    Boolean(getMessageText(message, options)) ||
    getRenderedToolCalls(message.parts, options.tools).length > 0 ||
    (!options.streaming &&
      message.parts.some(part => part.type === 'source-url'))
  );
}

export function getMetadataTime(
  message: UIMessage,
  key: 'askedAt' | 'answeredAt'
): string | undefined {
  const value = (message.metadata as Record<string, unknown> | undefined)?.[
    key
  ];
  return typeof value === 'string' ? value : undefined;
}

/** Inline code spans on one line, such as `code`. */
const INLINE_CODE = /`[^`\n]*`/g;
/** Lines opening or closing a fenced code block. */
const CODE_FENCE = /(?:^|\n)```/g;

/**
 * Closes inline markdown that is still being written, so a streamed answer
 * shows formatted text instead of flashing raw backticks or `**`. Open code
 * fences need nothing: CommonMark already runs them to the end of the text.
 */
export function completeStreamingMarkdown(markdown: string): string {
  if (isInsideCodeFence(markdown)) return markdown;
  const lastParagraph = markdown.slice(markdown.lastIndexOf('\n\n') + 1);
  const outsideInlineCode = lastParagraph.replace(INLINE_CODE, '');
  if (countOf(outsideInlineCode, '`') % 2 === 1) return `${markdown}\``;
  if (countOf(outsideInlineCode, '**') % 2 === 1) return `${markdown}**`;
  return markdown;
}

function isInsideCodeFence(markdown: string) {
  return (markdown.match(CODE_FENCE)?.length ?? 0) % 2 === 1;
}

function countOf(text: string, token: string) {
  return text.split(token).length - 1;
}
