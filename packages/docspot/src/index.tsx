import type { ReactNode } from 'react';

import { DocspotRoot } from './core/Root';
import {
  ChatPanel,
  ChatTrigger,
  SearchDialog,
  SearchTrigger,
  Trigger,
} from './core/surfaces';
import type { DocspotRootProps } from './types';

export type DocspotProps = DocspotRootProps & {
  /** Rendered after the default trigger, inside the Docspot context. */
  children?: ReactNode;
};

/**
 * Documentation search and chat with a default trigger. For custom
 * placement, compose `Docspot.Root` with the individual surfaces instead.
 */
function DocspotComponent({ children, ...props }: DocspotProps) {
  return (
    <DocspotRoot {...(props as DocspotRootProps)}>
      <Trigger />
      {children}
      <SearchDialog />
      {/* The trigger opens search, which asks AI; add `Docspot.ChatTrigger`
          as a child for a separate way into chat. */}
      <ChatPanel launcher={false} />
    </DocspotRoot>
  );
}

export const Docspot = /* @__PURE__ */ Object.assign(DocspotComponent, {
  Root: DocspotRoot,
  Trigger,
  SearchTrigger,
  ChatTrigger,
  SearchDialog,
  ChatPanel,
});

export { useDocspot } from './core/Root';
export type { DocspotApi } from './core/Root';
export type { ChatPanelProps } from './core/surfaces';
export { createDocspotUrl } from './core/url';
export type { DocspotLinkOptions } from './core/url';
export { importDocspotHistory } from './core/storage';
export type {
  DocspotHistoryImport,
  StoredConversation as DocspotStoredConversation,
  StoredMessage as DocspotStoredMessage,
  StoredPage as DocspotStoredPage,
} from './core/storage';
export { defaultMessages } from './messages';
export type { DocspotMessages, DocspotMessagesInput } from './messages';
export { highlightTerms, parseHighlightedString } from './search/model';
export { defineItem, recentItems } from './search/items';
export type * from './types';
export { isQuestion, shouldPrioritizeChat } from './search/intent';
