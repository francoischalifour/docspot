import { Kbd } from '@/ui/Kbd';
import { useDocspotInternal } from '@/core/context';

type ChatLauncherProps = { hidden: boolean };

/** Sits where the panel opens, so the chat's place on screen is clear. */
export function ChatLauncher({ hidden }: ChatLauncherProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatPanel');
  const preload = () => {
    if (config.preload) chat.preload();
  };
  return (
    <span
      className="docspot-tooltip-anchor docspot-launcher-anchor"
      data-side="left"
      hidden={hidden}
    >
      <button
        ref={chat.registerLauncher}
        type="button"
        aria-expanded={false}
        aria-controls={config.chatPanelId}
        aria-keyshortcuts="Meta+J Control+J"
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => chat.open()}
        // Stays mounted while hidden, so focus can return to it.
        hidden={hidden}
        className="docspot-launcher"
      >
        {config.messages.chat.launcher}
        <Kbd
          aria-hidden="true"
          keys={['mod', 'j']}
          className="docspot-trigger-kbd"
        />
      </button>
    </span>
  );
}
