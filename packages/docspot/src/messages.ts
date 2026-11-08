/**
 * English interface text. Override any part through the `messages` prop.
 * Keys ending in `WithAsk` replace their base key when chat is available.
 */
export const defaultMessages = {
  trigger: {
    search: 'Search docs',
    searchAndAsk: 'Search or ask docs',
    chat: 'Ask AI',
  },
  search: {
    title: 'Search documentation',
    description:
      'Use the up and down arrow keys to explore results and Enter to open a page.',
    descriptionWithAsk:
      'Use the up and down arrow keys to explore results and Enter to open a page. Press Tab to ask AI.',
    placeholder: 'Search docs…',
    placeholderWithAsk: 'Search or ask docs…',
    close: 'Close',
    askAi: 'Ask AI',
    recent: 'Recent',
    suggested: 'Suggested pages',
    documentation: 'Documentation',
    clearHistory: 'Clear history',
    loading: 'Searching documentation',
    loadingHint: 'Results will appear here.',
    error: 'Search is unavailable',
    errorHint: 'Check your connection and try again.',
    retry: 'Try again',
    noResults: (query: string): string => `No results for “${query}”`,
    noResultsHint: 'Try a different term.',
    noResultsHintWithAsk: 'Try a different term, or ask the docs a question.',
    emptyTitle: 'Find your next step',
    emptyHint: 'Search for a feature, integration, or API method.',
    toClear: 'to clear',
    toClose: 'to close',
    toNavigate: 'to navigate',
    toOpen: 'to open',
    resultCount: (count: number): string =>
      `${count} ${count === 1 ? 'result' : 'results'}`,
    searching: 'Searching',
    unavailable: 'Search unavailable',
    askAbout: (query: string): string => `Ask about “${query}”`,
    quotedQuery: (query: string): string => `“${query}”`,
    askQuestion: 'Ask a question',
    askDescription: 'Get an answer from the docs',
    continueConversation: 'Ask AI · Continue conversation',
    preview: 'Result preview',
    loadingPreview: 'Loading preview',
    openPage: 'Open page',
    openLink: 'Open in new tab',
    previewFallback: 'Open the page to read the full documentation.',
    linkCopied: (title: string): string => `Link to “${title}” copied`,
    handoffs: 'Open in chat',
    handoffDescription: 'Opens a new tab with your question.',
    askPreview: 'Ask AI',
    askDocs: 'Ask docs',
    continueChat: 'Continue chat',
    openChat: 'Open Ask AI',
  },
  chat: {
    title: 'Ask AI',
    launcher: 'Ask AI',
    welcome: 'Ask the docs',
    newChat: 'New chat',
    newConversation: 'New conversation',
    hide: 'Hide Ask AI',
    switchChat: (title: string): string => `Switch chat, ${title}`,
    recentChats: 'Recent chats',
    noRecentChats: 'No recent chats',
    deleteChat: (title: string): string => `Delete chat, ${title}`,
    clearHistory: 'Clear history…',
    confirmClearHistory: 'Confirm clear history',
    conversation: 'Docs conversation',
    answer: 'Docs answer',
    thinking: 'Thinking',
    searchingFor: (query: string): string => `Searching for “${query}”`,
    answerInProgress: 'Answer in progress',
    answerReady: 'Answer ready',
    error: "Couldn't finish the answer. Try again.",
    retry: 'Try again',
    retryAnswer: 'Retry answer',
    retryShort: 'Retry',
    copyQuestion: 'Copy question',
    questionCopied: 'Question copied',
    copyAnswer: 'Copy answer',
    answerCopied: 'Answer copied',
    sources: 'Sources',
    sourceFallback: 'Documentation',
    jumpToLatest: 'Jump to latest answer',
    askLabel: 'Ask documentation',
    followUpLabel: 'Ask a follow-up question',
    placeholder: 'What would you like to know?',
    followUpPlaceholder: 'Ask a follow-up question…',
    composerDescription:
      'Enter sends your question. Shift plus Enter starts a new line.',
    send: 'Send question',
    stop: 'Stop response',
    enterQuestion: 'Enter a question',
    pageContext: 'Page context: ',
    pageContextHint: 'Answers use this page as context',
    removePageContext: 'Remove page context',
    suggestionsAbout: (title: string): string =>
      `Suggested questions about ${title}`,
    resize: 'Resize Ask AI',
    resizeHint: 'Drag to resize. Double click to reset width.',
    pixels: (width: number): string => `${width} pixels`,
  },
};

export type DocspotMessages = typeof defaultMessages;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type DocspotMessagesInput = DeepPartial<DocspotMessages>;

export function resolveMessages(
  overrides: DocspotMessagesInput | undefined
): DocspotMessages {
  if (!overrides) return defaultMessages;
  return {
    trigger: { ...defaultMessages.trigger, ...overrides.trigger },
    search: { ...defaultMessages.search, ...overrides.search },
    chat: { ...defaultMessages.chat, ...overrides.chat },
  };
}
