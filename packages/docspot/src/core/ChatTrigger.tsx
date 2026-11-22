import type { ComponentProps } from 'react';

import { Kbd } from '@/ui/Kbd';
import { composeHandlers } from '@/ui/composeHandlers';
import { cx } from '@/ui/cx';
import { useDocspotInternal } from '@/core/context';

/** Button props, as for `SearchTriggerProps`. */
export type ChatTriggerProps = Omit<ComponentProps<'button'>, 'type'>;

/** Opens or hides chat. Renders nothing without `chat`. */
export function ChatTrigger({
  className,
  children,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: ChatTriggerProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatTrigger');
  if (!config.canChat) return null;
  return (
    <button
      type="button"
      aria-keyshortcuts="Meta+J Control+J"
      {...props}
      aria-expanded={chat.isOpen}
      aria-controls={config.chatPanelId}
      className={cx('docspot-trigger docspot-chat-trigger', className)}
      onPointerEnter={composeHandlers(chat.preload, onPointerEnter)}
      onFocus={composeHandlers(chat.preload, onFocus)}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) chat.toggle();
      }}
    >
      {children ?? (
        <>
          <span className="docspot-trigger-text">
            {config.messages.trigger.chat}
          </span>
          <Kbd
            aria-hidden="true"
            keys={['mod', 'j']}
            className="docspot-trigger-kbd"
          />
        </>
      )}
    </button>
  );
}
