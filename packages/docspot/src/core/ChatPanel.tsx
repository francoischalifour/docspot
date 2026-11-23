import { Suspense, lazy } from 'react';

import {
  type ChatController,
  chatFrameLoader,
  useDocspotInternal,
} from '@/core/context';
import { useTypedText } from '@/core/platform';

const LazyChatPanelFrame = /* @__PURE__ */ lazy(() =>
  chatFrameLoader.load().then(module => ({ default: module.ChatPanelFrame }))
);

export type ChatPanelProps = {
  /**
   * `fixed` (default) pins the docked panel to the right edge of the window.
   * `inline` docks it as a flex item where it is rendered, beside the page.
   */
  dock?: 'fixed' | 'inline';
  className?: string;
};

/**
 * The chat panel. Renders nothing without `chat`. Add `Docspot.ChatTrigger`
 * or `Docspot.ChatLauncher` to open it.
 */
export function ChatPanel(props: ChatPanelProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatPanel');
  if (!config.canChat) return null;
  // The frame loads with chat, so pages without chat never load it. Once
  // loaded, it renders in the same frame; lazy would wait one.
  const Frame = chatFrameLoader.get()?.ChatPanelFrame ?? LazyChatPanelFrame;
  return (
    <>
      {chat.keepsTyping && <TypedDraft chat={chat} />}
      <Suspense>
        <Frame {...props} />
      </Suspense>
    </>
  );
}

/** Keeps what is typed while chat starts, for the composer it opens with. */
function TypedDraft({ chat }: { chat: ChatController }) {
  useTypedText(chat.draft, chat.setDraft, chat.close);
  return null;
}
