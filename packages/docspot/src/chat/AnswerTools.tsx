import type { UIMessage } from 'ai';

import { type DocspotTools, getRenderedToolCalls } from '@/chat/tools';

type AnswerToolsProps = {
  message: UIMessage;
  tools: DocspotTools;
  /** Gives a tool call's output, for tools that run in the browser. */
  onToolOutput: (tool: string, toolCallId: string, output: unknown) => void;
};

/** The answer's tool calls that have a renderer, in the order they ran. */
export function AnswerTools({
  message,
  tools,
  onToolOutput,
}: AnswerToolsProps) {
  const calls = getRenderedToolCalls(message.parts, tools);
  if (!calls.length) return null;
  return calls.map(call => {
    const Tool = tools[call.name]!;
    return (
      <div
        key={call.toolCallId}
        className="docspot-tool"
        data-tool={call.name}
        data-state={call.state}
      >
        <Tool
          name={call.name}
          toolCallId={call.toolCallId}
          state={call.state}
          input={call.input}
          output={call.output}
          errorText={call.errorText}
          addOutput={output => onToolOutput(call.name, call.toolCallId, output)}
        />
      </div>
    );
  });
}
