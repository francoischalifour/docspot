// The `docspot` entry point.
export { Docspot } from '@/core/Docspot';
export type { DocspotProps } from '@/core/Docspot';
export { useDocspot } from '@/core/useDocspot';
export type { DocspotApi } from '@/core/useDocspot';
export type { ChatPanelProps } from '@/core/ChatPanel';
export type { ChatTriggerProps } from '@/core/ChatTrigger';
export type { SearchTriggerProps } from '@/core/SearchTrigger';
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
export { defaultMessages } from '@/messages';
export type { DocspotMessages, DocspotMessagesInput } from '@/messages';
export { highlightTerms, parseHighlightedString } from '@/search/model';
export { defineItem, recentItems } from '@/search/items';
export { createSearch } from '@/search/createSearch';
export type { CreateSearchOptions } from '@/search/createSearch';
export type * from '@/types';
export { isQuestion, shouldPrioritizeChat } from '@/search/intent';
