import type { ComponentProps } from 'react';

import { SearchIcon } from '@/ui/icons';
import { Kbd } from '@/ui/Kbd';
import { composeHandlers } from '@/ui/composeHandlers';
import { cx } from '@/ui/cx';
import { mergeRefs } from '@/ui/mergeRefs';
import { type RenderProp, renderElement } from '@/ui/renderElement';
import { useDocspotInternal } from '@/core/context';

export type SearchTriggerState = {
  /** Whether search is open. */
  open: boolean;
};

/**
 * Button props, including `ref`. Handlers run before Docspot's; calling
 * `preventDefault` in `onClick` keeps the surface closed.
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
export function SearchTrigger({
  ref,
  render,
  className,
  children,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: SearchTriggerProps) {
  const { config, search } = useDocspotInternal('Docspot.SearchTrigger');
  if (!config.canSearch) return null;
  const label = config.canChat
    ? config.messages.trigger.searchAndAsk
    : config.messages.trigger.search;
  return renderElement(
    render,
    {
      type: 'button',
      'aria-keyshortcuts': 'Meta+K Control+K /',
      'aria-haspopup': 'dialog',
      ...props,
      // Focus returns to a visible trigger when search closes.
      ref: mergeRefs(ref, search.registerTrigger),
      className: cx('docspot-trigger', className),
      onPointerEnter: composeHandlers(search.preload, onPointerEnter),
      onFocus: composeHandlers(search.preload, onFocus),
      onClick: event => {
        onClick?.(event);
        if (!event.defaultPrevented) search.open(event.currentTarget);
      },
      children: children ?? (
        <>
          <span className="docspot-trigger-label">
            <SearchIcon className="docspot-muted" />
            <span className="docspot-trigger-text">{label}</span>
          </span>
          <Kbd
            aria-hidden="true"
            keys={['mod', 'k']}
            className="docspot-trigger-kbd"
          />
        </>
      ),
    },
    { open: search.isOpen },
    buttonProps => <button {...buttonProps} />
  );
}
