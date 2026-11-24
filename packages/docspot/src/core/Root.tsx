import { useMemo } from 'react';

import type { DocspotProps } from '@/types';
import { DocspotInternalContext, type SearchController } from '@/core/context';
import { useChatController } from '@/core/useChatController';
import { useDocspotConfig } from '@/core/useDocspotConfig';
import { useSearchController } from '@/core/useSearchController';
import { useShortcuts } from '@/core/useShortcuts';
import { useTriggerRegistry } from '@/core/useTriggerRegistry';
import { useUrlSync } from '@/core/useUrlSync';
import { LocaleContext } from '@/ui/LocaleContext';
import { SlotsContext } from '@/ui/SlotsContext';

/**
 * Holds Docspot's state and shares it with the parts inside: triggers, the
 * search dialog, the chat panel, and `useDocspot()`.
 */
export function DocspotRoot(props: DocspotProps) {
  const { config, url, chatLoader } = useDocspotConfig(props);
  const triggers = useTriggerRegistry();
  const search = useSearchController(props, config, url, triggers);
  const chat = useChatController(props, config, url, chatLoader, triggers);

  const { language, messages } = config;
  const locale = useMemo(
    () => ({ language, keys: messages.keys }),
    [language, messages.keys]
  );

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
    shortcuts: config.shortcuts,
    preload: config.preload,
  });

  return (
    <DocspotInternalContext
      value={{ config, search: searchController, chat: chat.controller }}
    >
      <LocaleContext value={locale}>
        <SlotsContext value={config.slots}>{props.children}</SlotsContext>
      </LocaleContext>
    </DocspotInternalContext>
  );
}
