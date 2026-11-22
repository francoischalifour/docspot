import type { ComponentProps } from 'react';

import { SearchIcon } from '@/ui/icons';
import { Kbd } from '@/ui/Kbd';
import { composeHandlers } from '@/ui/composeHandlers';
import { cx } from '@/ui/cx';
import { mergeRefs } from '@/ui/mergeRefs';
import { useDocspotInternal } from '@/core/context';

/**
 * Button props, including `ref`. Handlers run before Docspot's; calling
 * `preventDefault` in `onClick` keeps the surface closed.
 */
export type SearchTriggerProps = Omit<ComponentProps<'button'>, 'type'>;

/** Opens search. Renders nothing without `search`. */
export function SearchTrigger({
  ref,
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
  return (
    <button
      type="button"
      aria-keyshortcuts="Meta+K Control+K /"
      aria-haspopup="dialog"
      {...props}
      // Focus returns to a visible trigger when search closes.
      ref={mergeRefs(ref, search.registerTrigger)}
      className={cx('docspot-trigger', className)}
      onPointerEnter={composeHandlers(search.preload, onPointerEnter)}
      onFocus={composeHandlers(search.preload, onFocus)}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) search.open(event.currentTarget);
      }}
    >
      {children ?? (
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
      )}
    </button>
  );
}
