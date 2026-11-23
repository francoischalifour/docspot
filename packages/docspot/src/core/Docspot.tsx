import { DocspotRoot } from '@/core/Root';
import { ChatLauncher } from '@/core/ChatLauncher';
import { ChatPanel } from '@/core/ChatPanel';
import { ChatTrigger } from '@/core/ChatTrigger';
import { SearchDialog } from '@/core/SearchDialog';
import { SearchTrigger } from '@/core/SearchTrigger';
import { Trigger } from '@/core/Trigger';
import type { DocspotRootProps } from '@/types';

export type DocspotProps = DocspotRootProps;

/**
 * Documentation search and chat with a default trigger. For custom
 * placement, compose `Docspot.Root` with the individual surfaces instead.
 */
function DocspotComponent(props: DocspotProps) {
  return (
    <DocspotRoot {...props}>
      <Trigger />
      {props.children}
      <SearchDialog />
      {/* The trigger opens search, which asks AI; add `Docspot.ChatTrigger`
          or `Docspot.ChatLauncher` as a child for a separate way into chat. */}
      <ChatPanel />
    </DocspotRoot>
  );
}

export const Docspot = /* @__PURE__ */ Object.assign(DocspotComponent, {
  Root: DocspotRoot,
  Trigger,
  SearchTrigger,
  ChatTrigger,
  ChatLauncher,
  SearchDialog,
  ChatPanel,
});
