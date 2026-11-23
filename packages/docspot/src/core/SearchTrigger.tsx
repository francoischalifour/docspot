import type { ComponentProps } from 'react';

import { SearchIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { Kbd } from '@/ui/Kbd';
import { toAriaKeyShortcuts, toKbdKeys } from '@/core/shortcuts';
import { type RenderProp, mergeProps, renderElement } from '@/ui/renderElement';
import { useDocspotInternal } from '@/core/context';

export type SearchTriggerState = {
  /** Whether search is open. */
  open: boolean;
};

/**
 * Button props, including `ref`. Handlers run before Docspot's; calling
 * `preventDefault` skips Docspot's, so in `onClick` it keeps search closed.
 */
export type SearchTriggerProps = Omit<ComponentProps<'button'>, 'type'> & {
  /**
   * Replaces the `<button>`: an element receives the trigger's props, such
   * as `render={<Button variant="ghost" />}`, and a function receives the
   * props and the trigger's state.
   */
  render?: RenderProp<ComponentProps<'button'>, SearchTriggerState>;
};

/** Opens search. Renders nothing without `search`. */
export function SearchTrigger({ render, ...props }: SearchTriggerProps) {
  const { config, search } = useDocspotInternal('Docspot.SearchTrigger');
  if (!config.canSearch) return null;
  const preload = () => {
    if (config.preload) search.preload();
  };
  const label = config.canChat
    ? config.messages.trigger.searchWithAsk
    : config.messages.trigger.search;
  const keys = toKbdKeys(config.shortcuts.search);
  const own: ComponentProps<'button'> = {
    type: 'button',
    'aria-keyshortcuts': toAriaKeyShortcuts(config.shortcuts.search),
    'aria-haspopup': 'dialog',
    // Focus returns to a visible trigger when search closes.
    ref: search.registerTrigger,
    className: 'docspot-trigger',
    onPointerEnter: preload,
    // Touch has no hover; a press comes before its click.
    onPointerDown: preload,
    onFocus: preload,
    onClick: event => search.open(event.currentTarget),
    children: (
      <>
        <span className="docspot-trigger-label">
          <SlotIcon name="search" icon={SearchIcon} className="docspot-muted" />
          <span className="docspot-trigger-text">{label}</span>
        </span>
        {keys && (
          <Kbd aria-hidden="true" keys={keys} className="docspot-trigger-kbd" />
        )}
      </>
    ),
  };
  return renderElement(
    render,
    mergeProps(own, props),
    { open: search.isOpen },
    buttonProps => <button {...buttonProps} />
  );
}
