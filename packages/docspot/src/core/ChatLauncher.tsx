import type { ComponentProps } from 'react';

import { Kbd } from '@/ui/Kbd';
import { composeHandlers } from '@/ui/composeHandlers';
import { cx } from '@/ui/cx';
import { mergeRefs } from '@/ui/mergeRefs';
import { useDocspotInternal } from '@/core/context';

/**
 * Button props, including `ref`. Handlers run before Docspot's; calling
 * `preventDefault` in `onClick` keeps chat closed.
 */
export type ChatLauncherProps = Omit<
  ComponentProps<'button'>,
  'type' | 'hidden'
>;

/**
 * A floating button where the panel opens, shown while chat is hidden, so
 * the chat's place on screen is clear. Renders nothing without `chat`.
 */
export function ChatLauncher({
  ref,
  className,
  children,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: ChatLauncherProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatLauncher');
  if (!config.canChat) return null;
  const preload = () => {
    if (config.preload) chat.preload();
  };
  return (
    <span
      className="docspot-tooltip-anchor docspot-launcher-anchor"
      data-side="left"
      hidden={chat.isOpen}
    >
      <button
        type="button"
        aria-keyshortcuts="Meta+J Control+J"
        {...props}
        ref={mergeRefs(ref, chat.registerLauncher)}
        aria-expanded={false}
        aria-controls={config.chatPanelId}
        onPointerEnter={composeHandlers(preload, onPointerEnter)}
        onFocus={composeHandlers(preload, onFocus)}
        onClick={event => {
          onClick?.(event);
          if (!event.defaultPrevented) chat.open();
        }}
        // Stays mounted while hidden, so focus can return to it.
        hidden={chat.isOpen}
        className={cx('docspot-launcher', className)}
      >
        {children ?? (
          <>
            {config.messages.chat.launcher}
            <Kbd
              aria-hidden="true"
              keys={['mod', 'j']}
              className="docspot-trigger-kbd"
            />
          </>
        )}
      </button>
    </span>
  );
}
