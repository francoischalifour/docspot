import type { ComponentProps } from 'react';

import { Kbd } from '@/ui/Kbd';
import { toAriaKeyShortcuts, toKbdKeys } from '@/core/shortcuts';
import { mergeProps } from '@/ui/renderElement';
import { useDocspotInternal } from '@/core/context';

/**
 * Button props, including `ref`. Handlers run before Docspot's; calling
 * `preventDefault` skips Docspot's, so in `onClick` it keeps chat closed.
 */
export type ChatLauncherProps = Omit<
  ComponentProps<'button'>,
  'type' | 'hidden' | 'aria-expanded' | 'aria-controls'
>;

/**
 * A floating button where the panel opens, shown while chat is hidden, so
 * the chat's place on screen is clear. Renders nothing without `chat`.
 */
export function ChatLauncher(props: ChatLauncherProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatLauncher');
  if (!config.canChat) return null;
  const preload = () => {
    if (config.preload) chat.preload();
  };
  const keys = toKbdKeys(config.shortcuts.chat);
  const own: ComponentProps<'button'> = {
    type: 'button',
    'aria-keyshortcuts': toAriaKeyShortcuts(config.shortcuts.chat),
    ref: chat.registerLauncher,
    className: 'docspot-launcher',
    onPointerEnter: preload,
    onFocus: preload,
    onClick: () => chat.open(),
    children: (
      <>
        {config.messages.chat.launcher}
        {keys && (
          <Kbd aria-hidden="true" keys={keys} className="docspot-trigger-kbd" />
        )}
      </>
    ),
  };
  return (
    <span
      className="docspot-tooltip-anchor docspot-launcher-anchor"
      data-side="left"
      hidden={chat.isOpen}
    >
      <button
        {...mergeProps(own, props)}
        aria-expanded={false}
        aria-controls={config.chatPanelId}
        // Stays mounted while hidden, so focus can return to it.
        hidden={chat.isOpen}
      />
    </span>
  );
}
