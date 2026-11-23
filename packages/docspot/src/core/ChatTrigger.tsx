import type { ComponentProps } from 'react';

import { Kbd } from '@/ui/Kbd';
import { composeHandlers } from '@/ui/composeHandlers';
import { cx } from '@/ui/cx';
import { type RenderProp, renderElement } from '@/ui/renderElement';
import { useDocspotInternal } from '@/core/context';

export type ChatTriggerState = {
  /** Whether the chat panel is open. */
  open: boolean;
};

/** Button props, as for `SearchTriggerProps`. */
export type ChatTriggerProps = Omit<ComponentProps<'button'>, 'type'> & {
  /** Replaces the `<button>`, as for `SearchTriggerProps`. */
  render?: RenderProp<ComponentProps<'button'>, ChatTriggerState>;
};

/** Opens or hides chat. Renders nothing without `chat`. */
export function ChatTrigger({
  render,
  className,
  children,
  onClick,
  onFocus,
  onPointerEnter,
  onPointerDown,
  ...props
}: ChatTriggerProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatTrigger');
  if (!config.canChat) return null;
  const preload = () => {
    if (config.preload) chat.preload();
  };
  return renderElement(
    render,
    {
      type: 'button',
      'aria-keyshortcuts': 'Meta+J Control+J',
      ...props,
      'aria-expanded': chat.isOpen,
      'aria-controls': config.chatPanelId,
      className: cx('docspot-trigger docspot-chat-trigger', className),
      onPointerEnter: composeHandlers(preload, onPointerEnter),
      // Touch has no hover; a press comes before its click.
      onPointerDown: composeHandlers(preload, onPointerDown),
      onFocus: composeHandlers(preload, onFocus),
      onClick: event => {
        onClick?.(event);
        if (!event.defaultPrevented) chat.toggle();
      },
      children: children ?? (
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
      ),
    },
    { open: chat.isOpen },
    buttonProps => <button {...buttonProps} />
  );
}
