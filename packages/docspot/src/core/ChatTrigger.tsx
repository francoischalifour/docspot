import type { ComponentProps } from 'react';

import { Kbd } from '@/ui/Kbd';
import { toAriaKeyShortcuts, toKbdKeys } from '@/core/shortcuts';
import { type RenderProp, mergeProps, renderElement } from '@/ui/renderElement';
import { useDocspotInternal } from '@/core/context';

export type ChatTriggerState = {
  /** Whether the chat panel is open. */
  open: boolean;
};

/** Button props, as for `SearchTriggerProps`. */
export type ChatTriggerProps = Omit<
  ComponentProps<'button'>,
  'type' | 'aria-expanded' | 'aria-controls'
> & {
  /** Replaces the `<button>`, as for `SearchTriggerProps`. */
  render?: RenderProp<ComponentProps<'button'>, ChatTriggerState>;
};

/** Opens or hides chat. Renders nothing without `chat`. */
export function ChatTrigger({ render, ...props }: ChatTriggerProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatTrigger');
  if (!config.canChat) return null;
  const preload = () => {
    if (config.preload) chat.preload();
  };
  const keys = toKbdKeys(config.shortcuts.chat);
  const own: ComponentProps<'button'> = {
    type: 'button',
    'aria-keyshortcuts': toAriaKeyShortcuts(config.shortcuts.chat),
    className: 'docspot-trigger docspot-chat-trigger',
    onPointerEnter: preload,
    // Touch has no hover; a press comes before its click.
    onPointerDown: preload,
    onFocus: preload,
    onClick: () => chat.toggle(),
    children: (
      <>
        <span className="docspot-trigger-text">
          {config.messages.trigger.chat}
        </span>
        {keys && (
          <Kbd aria-hidden="true" keys={keys} className="docspot-trigger-kbd" />
        )}
      </>
    ),
  };
  return renderElement(
    render,
    {
      ...mergeProps(own, props),
      // They describe the panel, so they follow its state.
      'aria-expanded': chat.isOpen,
      'aria-controls': config.chatPanelId,
    },
    { open: chat.isOpen },
    buttonProps => <button {...buttonProps} />
  );
}
