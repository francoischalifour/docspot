import type { ComponentType } from 'react';

/**
 * Where a tool call is, as the AI SDK reports it. Versions 6 and later add
 * the approval states.
 */
export type DocspotToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-denied';

/** What a tool's renderer receives for one call. */
export type DocspotToolProps<Input = unknown, Output = unknown> = {
  /** The tool's name, as the agent declares it. */
  name: string;
  toolCallId: string;
  state: DocspotToolState;
  /** Partial while `state` is `input-streaming`. */
  input: Input | undefined;
  /** Set once `state` is `output-available`. */
  output: Output | undefined;
  /** Set when `state` is `output-error`. */
  errorText: string | undefined;
  /**
   * Gives the output of a tool that runs in the browser, such as the
   * reader's answer to a confirmation. The conversation then continues.
   */
  addOutput: (output: Output) => void;
};

/**
 * Renderers for tool calls, by tool name. Answers show them in order before
 * their text; tools without one show only as progress.
 */
// The props are typed per tool by each renderer.
// oxlint-disable-next-line typescript/no-explicit-any
export type DocspotTools = Record<
  string,
  ComponentType<DocspotToolProps<any, any>>
>;

/** A tool call in a message, in the shape the AI SDK gives it. */
export type ToolCallPart = {
  type: string;
  toolCallId: string;
  toolName?: string;
  state: DocspotToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

/** The tool a part calls, or undefined when the part is not a tool call. */
export function getToolName(part: { type: string; toolName?: unknown }) {
  if (part.type === 'dynamic-tool')
    return typeof part.toolName === 'string' ? part.toolName : undefined;
  return part.type.startsWith('tool-') ? part.type.slice(5) : undefined;
}

/** The tool calls in a message that have a renderer, in order. */
export function getRenderedToolCalls(
  parts: ReadonlyArray<{ type: string }>,
  tools: DocspotTools
): Array<ToolCallPart & { name: string }> {
  return parts.flatMap(part => {
    const name = getToolName(part);
    return name && Object.hasOwn(tools, name)
      ? [{ ...(part as ToolCallPart), name }]
      : [];
  });
}
