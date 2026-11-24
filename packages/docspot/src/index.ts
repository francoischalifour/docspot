// The `docspot` entry point.
export { Docspot } from '@/core/Docspot';
export { useDocspot } from '@/core/useDocspot';
export type { DocspotApi } from '@/core/useDocspot';
export type { ChatPanelProps } from '@/core/ChatPanel';
export type { SearchDialogProps } from '@/core/SearchDialog';
export type { ChatLauncherProps } from '@/core/ChatLauncher';
export type { ChatTriggerProps, ChatTriggerState } from '@/core/ChatTrigger';
export type {
  SearchTriggerProps,
  SearchTriggerState,
} from '@/core/SearchTrigger';
export type { TriggerProps } from '@/core/Trigger';
export { createDocspotUrl } from '@/core/url';
export type { DocspotLinkOptions } from '@/core/url';
export { importDocspotHistory } from '@/core/storage';
export type {
  DocspotHistoryImport,
  StoredConversation as DocspotStoredConversation,
  StoredMessage as DocspotStoredMessage,
  StoredPage as DocspotStoredPage,
} from '@/core/storage';
export type {
  DocspotLocale,
  DocspotMessages,
  DocspotMessagesInput,
} from '@/messages';
export { highlightTerms, parseHighlightedString } from '@/search/model';
export { recentItems } from '@/search/items';
export { createSearch } from '@/search/createSearch';
export type { CreateSearchOptions } from '@/search/createSearch';
export type * from '@/types';
export { isQuestion } from '@/search/intent';
