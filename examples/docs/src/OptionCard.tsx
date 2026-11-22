import type { DocspotToolProps } from 'docspot/chat';

export type Option = {
  name: string;
  type: string;
  defaultValue: string;
  environment: string;
  description: string;
};

/**
 * Renders the agent's `showOption` tool calls: a card for the option,
 * with a placeholder while the tool runs.
 */
export function OptionCard({
  state,
  input,
  output,
}: DocspotToolProps<{ name: string }, Option>) {
  if (state === 'output-error')
    return <p className="option-card">Couldn’t look up this option.</p>;
  if (state !== 'output-available' || !output)
    return (
      <div className="option-card" aria-busy="true">
        <code>{input?.name ?? '…'}</code>
        <span className="option-card-loading">Looking up the option</span>
      </div>
    );
  return (
    <div className="option-card">
      <div className="option-card-header">
        <code>{output.name}</code>
        <span className="option-card-type">{output.type}</span>
      </div>
      <p>{output.description}</p>
      <dl>
        <dt>Default</dt>
        <dd>{output.defaultValue}</dd>
        <dt>Environment</dt>
        <dd>
          <code>{output.environment}</code>
        </dd>
      </dl>
    </div>
  );
}
