// English, the default locale. Interface text is written here first; the
// other locales follow its keys, which their types require.

import { pluralize } from '@/locale/plural';

const messages = {
  /**
   * Who answers questions, written in place of `{assistant}` in other
   * text, so renaming it renames every label that shows it.
   */
  assistant: 'AI',
  trigger: {
    search: 'Search docs',
    searchWithAsk: 'Search or ask docs',
    chat: 'Ask {assistant}',
  },
  search: {
    title: 'Search documentation',
    description:
      'Use the up and down arrow keys to explore results and Enter to open a page.',
    descriptionWithAsk:
      'Use the up and down arrow keys to explore results and Enter to open a page. Press Tab to ask {assistant}.',
    placeholder: 'Search docs…',
    placeholderWithAsk: 'Search or ask docs…',
    close: 'Close',
    askAi: 'Ask {assistant}',
    recent: 'Recent',
    suggested: 'Suggested pages',
    documentation: 'Documentation',
    clearHistory: 'Clear history',
    loading: 'Searching',
    loadingHint: '',
    error: 'Search is unavailable',
    errorHint: 'Check your connection and try again.',
    retry: 'Try again',
    noResults: (query: string): string => `No results for “${query}”`,
    noResultsHint: 'Try a different term.',
    noResultsHintWithAsk: 'Try a different term, or ask {assistant}.',
    emptyTitle: 'Type to search the docs.',
    toClear: 'to clear',
    toClose: 'to close',
    toNavigate: 'to navigate',
    toOpen: 'to open',
    resultCount: (count: number): string =>
      `${count} ${pluralize(count, { one: 'result', other: 'results' }, 'en')}`,
    searching: 'Searching',
    opening: 'Opening page',
    unavailable: 'Search unavailable',
    askAbout: (query: string): string => `Ask about “${query}”`,
    quotedQuery: (query: string): string => `“${query}”`,
    askQuestion: 'Ask a question',
    askDescription: 'Answer from the docs',
    preview: 'Result preview',
    loadingPreview: 'Loading preview',
    openPage: 'Open page',
    openLink: 'Open in new tab',
    linkCopied: (title: string): string => `Link to “${title}” copied`,
    handoffs: 'Open in chat',
    actions: 'Actions',
    run: 'Run',
    handoffDescription: 'Opens a new tab with your question.',
    askPreview: 'Ask {assistant}',
    askPreviewDescription:
      'Send this question to chat, where you can ask follow-ups.',
    askContextLabel: 'Current page',
    askContextHint: 'Included with your question',
    enterToAsk: 'Enter to ask',
    continueChat: 'Continue chat',
  },
  chat: {
    title: 'Ask {assistant}',
    launcher: 'Ask {assistant}',
    opening: 'Opening chat',
    startupFailed: 'Couldn’t open chat.',
    welcome: 'Ask {assistant} about these docs',
    newChat: 'New chat',
    hide: 'Hide Ask {assistant}',
    switchChat: (title: string): string => `Switch chat, ${title}`,
    recentChats: 'Recent chats',
    noRecentChats: 'No recent chats',
    deleteChat: (title: string): string => `Delete chat, ${title}`,
    clearHistory: 'Clear history…',
    confirmClearHistory: 'Confirm clear history',
    conversation: 'Chat',
    answer: 'Docs answer',
    thinking: 'Thinking',
    searchingFor: (query: string): string => `Searching for “${query}”`,
    answerInProgress: 'Answer in progress',
    answerReady: 'Answer ready',
    answerFailed: 'Answer failed',
    answerStopped: 'Answer stopped',
    stopped: 'Stopped',
    error: 'Couldn’t get an answer.',
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
    askLabel: 'Ask {assistant}',
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
    resize: 'Resize Ask {assistant}',
    resizeHint: 'Drag to resize. Double click to reset width.',
    pixels: (width: number): string => `${width} pixels`,
  },
};

/** English. Docspot's default. */
export const en = { code: 'en', messages };

export type EnglishMessages = typeof messages;
