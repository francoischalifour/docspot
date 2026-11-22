import type { DocspotRootProps } from '@/types';
import { DocspotInternalContext, type SearchController } from '@/core/context';
import { useChatController } from '@/core/useChatController';
import { useDocspotConfig } from '@/core/useDocspotConfig';
import { useSearchController } from '@/core/useSearchController';
import { useShortcuts } from '@/core/useShortcuts';
import { useTriggerRegistry } from '@/core/useTriggerRegistry';
import { useUrlSync } from '@/core/useUrlSync';

/**
 * Holds Docspot's state and shares it with the parts inside: triggers, the
 * search dialog, the chat panel, and `useDocspot()`.
 */
export function DocspotRoot(props: DocspotRootProps) {
  const { config, url, chatLoader } = useDocspotConfig(props);
  const triggers = useTriggerRegistry();
  const search = useSearchController(config, url, triggers);
  const chat = useChatController(props, config, url, chatLoader, triggers);

  const searchController: SearchController = {
    ...search.controller,
    // Search hands a question to chat, which then owns the focus.
    openChat(request) {
      search.closeForChat();
      chat.requestChat(request);
    },
  };

  useUrlSync(
    url,
    {
      syncQueryFromUrl: config.canSearch ? search.syncQueryFromUrl : null,
      syncLinkFromUrl: chat.syncLinkFromUrl,
    },
    [config.canSearch, chatLoader]
  );
  useShortcuts(config.owner, {
    search: config.canSearch ? searchController : null,
    chat: config.canChat ? chat.controller : null,
  });

  return (
    <DocspotInternalContext
      value={{ config, search: searchController, chat: chat.controller }}
    >
      {props.children}
    </DocspotInternalContext>
  );
}
