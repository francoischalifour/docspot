import { Suspense, lazy } from 'react';

import { chatFrameLoader, useDocspotInternal } from '@/core/context';
import { ChatLauncher } from '@/core/ChatLauncher';

const LazyChatPanelFrame = /* @__PURE__ */ lazy(() =>
  chatFrameLoader.load().then(module => ({ default: module.ChatPanelFrame }))
);

export type ChatPanelProps = {
  /**
   * `fixed` (default) pins the docked panel to the right edge of the window.
   * `inline` docks it as a flex item where it is rendered, beside the page.
   */
  dock?: 'fixed' | 'inline';
  /** Shows a floating button that opens chat while the panel is hidden. */
  launcher?: boolean;
  className?: string;
};

/** The chat panel. Renders nothing without `chat`. */
export function ChatPanel({ launcher = true, ...props }: ChatPanelProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatPanel');
  if (!config.canChat) return null;
  // The frame loads with chat, so pages without chat never load it. Once
  // loaded, it renders in the same frame; lazy would wait one.
  const Frame = chatFrameLoader.get()?.ChatPanelFrame ?? LazyChatPanelFrame;
  return (
    <>
      {launcher && <ChatLauncher hidden={chat.isOpen} />}
      <Suspense>
        <Frame {...props} />
      </Suspense>
    </>
  );
}
