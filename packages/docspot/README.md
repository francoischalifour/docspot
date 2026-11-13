# Docspot

Documentation search and AI chat for React. Use search, chat, or both: Docspot provides the dialog, the chat panel, history, URL links, and keyboard and mobile behavior, and you provide the search function, the chat transport, and your site's routing and content.

- **Search** with grouped results, highlights, previews, recent pages, and default results, from any backend: Algolia, MiniSearch in the browser, or your own function.
- **Chat** over any [AI SDK](https://ai-sdk.dev) transport, with suggested questions, page context, streamed Markdown, sources, tool progress, stop, retry, and saved conversations.
- **Both**, with handoff from a search query to chat.

## Install

```sh
npm install docspot
```

Docspot requires React 19.2 or later. Chat also requires the AI SDK (`ai` 5 and `@ai-sdk/react` 2), and the MiniSearch integration requires `minisearch` 7:

```sh
npm install ai@5 @ai-sdk/react@2   # for chat
npm install minisearch             # for docspot/minisearch
```

Import the stylesheet once:

```ts
import 'docspot/styles.css';
```

With Tailwind CSS or other cascade layers, import it into a layer so your utility classes override it:

```css
@import 'docspot/styles.css' layer(components);
```

## Usage

### Search only

```tsx
import { Docspot, type DocspotSearch } from 'docspot';

const search: DocspotSearch = async ({ query, signal }) => {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal,
  });
  return response.json(); // DocspotSearchResult[]
};

export function Header() {
  return <Docspot search={search} history syncUrl />;
}
```

`<Docspot>` renders a trigger button where you place it, and the search dialog. <kbd>⌘K</kbd> or <kbd>Ctrl K</kbd> and <kbd>/</kbd> open search.

### Chat only

```tsx
import { DefaultChatTransport } from 'ai';
import { Docspot } from 'docspot';
import { createChat } from 'docspot/chat';

const chat = createChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});

<Docspot
  chat={chat}
  history
  context={{
    page: {
      url: '/docs/install',
      title: 'Install',
      prompts: ['How do I upgrade?'],
    },
    prompts: ['What can I build?'],
  }}
  loadPage={async ({ url }) => (await fetch(`${url}.md`)).text()}
/>;
```

The trigger opens the chat panel. <kbd>⌘J</kbd> or <kbd>Ctrl J</kbd> toggles it.

Each request body includes the question's context in `docspot`, which your endpoint can use:

```ts
type Body = {
  messages: UIMessage[];
  docspot?: {
    page?: { url: string; title?: string; content?: string };
  };
};
```

`page.url` is absolute, and `page.content` is what `loadPage` returned for it. The [chat-only example](../../examples/chat-only) includes a streaming endpoint.

### Search and chat

```tsx
<Docspot search={search} chat={chat} history syncUrl />
```

Search offers to ask about the query: press <kbd>Tab</kbd>, choose the **Ask AI** row, or press <kbd>⌘J</kbd>. When the search response sets `prioritizeChat`, asking comes first.

The default trigger opens search, which is the way into chat, so `<Docspot>` renders no floating chat button. For a separate chat button, add one as a child:

```tsx
<Docspot search={search} chat={chat}>
  <Docspot.ChatTrigger />
</Docspot>
```

Docspot requires at least one of `search` or `chat`. TypeScript reports a missing capability, and rendering throws.

### Composition

Place each surface yourself, and control them with `useDocspot()`:

```tsx
<Docspot.Root search={search} chat={chat}>
  <Docspot.SearchTrigger />
  <Docspot.ChatTrigger />
  <Docspot.SearchDialog />
  <Docspot.ChatPanel dock="inline" />
  <AskAboutThisPage />
</Docspot.Root>;

function AskAboutThisPage() {
  const docspot = useDocspot();
  return (
    <button onClick={() => docspot.setDraft('Summarize this page')}>
      Ask about this page
    </button>
  );
}
```

| Component               | Renders                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `Docspot.Trigger`       | The search trigger when search is configured, otherwise the chat trigger |
| `Docspot.SearchTrigger` | A button that opens search, or nothing without `search`                  |
| `Docspot.ChatTrigger`   | A button that toggles chat, or nothing without `chat`                    |
| `Docspot.SearchDialog`  | The search dialog while it is open                                       |
| `Docspot.ChatPanel`     | The chat panel and, with `launcher`, a floating button that opens it     |

Triggers accept button props. Their `onClick` runs first, and calling `event.preventDefault()` keeps the surface closed. Pass `children` to replace their content.

`useDocspot()` returns:

| Member                                      | Description                                                       |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `capabilities`                              | `{ search, chat }`: which capabilities are configured             |
| `isSearchOpen`, `isChatOpen`                | Whether each surface is open                                      |
| `openSearch(query?)`, `closeSearch()`       | Opens search, optionally with a query, or closes it               |
| `openChat()`, `closeChat()`, `toggleChat()` | Opens chat on its last conversation, closes it, or toggles it     |
| `setDraft(text, { page? })`                 | Opens chat with text to edit                                      |
| `submitQuestion(text, { page? })`           | Opens chat and sends a question, replacing any answer in progress |
| `startConversation()`                       | Opens chat on a new conversation                                  |
| `close()`                                   | Closes search and chat                                            |

`page` attaches a page to the question; `null` attaches none. Without it, the current page stays attached.

## Props

| Prop             | Description                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `search`         | `({ query, signal }) => DocspotSearchResponse \| Promise<…>`                                                                         |
| `chat`           | From `createChat()` or a provider integration                                                                                        |
| `context`        | `{ page, prompts, resolvePage }`: the page being read, default suggested questions, and how to describe pages named by URL           |
| `loadPage`       | `(page, { signal }) => Promise<string \| { content, title? } \| null>`: page content for chat, loaded once per page and conversation |
| `defaultResults` | Results shown before typing. Recently visited pages are left out                                                                     |
| `handoffs`       | Places to send a query besides these docs, such as a general assistant. See [Handoffs](#handoffs)                                    |
| `navigate`       | `(url, { event }) => void`. Defaults to `window.location.assign`                                                                     |
| `siteUrl`        | The canonical origin, such as `https://example.com`, for copied links, chat page context, and answer links                           |
| `history`        | Persists history. Without it, history lasts until the page reloads                                                                   |
| `id`             | Scopes persisted history, for several instances on one origin                                                                        |
| `syncUrl`        | `true` for the browser history, or an adapter for routers that own it                                                                |
| `slots`          | Components that replace parts of the interface                                                                                       |
| `messages`       | Interface text overrides                                                                                                             |
| `onEvent`        | Receives interaction events, for analytics                                                                                           |

### Search results

A search function returns results, or `{ results, prioritizeChat }`:

```ts
type DocspotSearchResult = {
  url: string;
  title: string; // A page title, or a section heading
  pageTitle?: string; // The page a section belongs to
  breadcrumb?: string[]; // From the top level down, without the title
  excerpt?: string;
  group?: string; // Results with the same group are listed together
  type?: 'page' | 'section';
  highlights?: {
    title?: HighlightedText;
    breadcrumb?: HighlightedText[];
    excerpt?: HighlightedText;
  };
  id?: string; // Defaults to the URL
  data?: unknown; // Passed through to slots
};

type HighlightedText = Array<{ text: string; highlighted: boolean }>;
```

`parseHighlightedString(value, preTag, postTag)` and `highlightTerms(text, terms)` build highlights. `isQuestion(query)` and `shouldPrioritizeChat(…)` help decide `prioritizeChat`.

Docspot cancels a request when the query changes (through `signal`), ignores outdated responses, and never opens a result that belongs to an older query. Search functions can return results synchronously.

Results on other sites open in a new tab and are not added to recent pages.

### Handoffs

Handoffs send the query somewhere else, such as a general assistant. They follow the results once a query is typed, show the query in quotes, open in a new tab, and stay out of recent pages. `docspot/handoffs` provides ChatGPT and Claude, with their icons:

```tsx
import { chatGptHandoff, claudeHandoff } from 'docspot/handoffs';

// The assistant reads the best result to answer.
const prompt = (query, { results }) =>
  results[0]
    ? `${query}\n\nRead ${new URL(results[0].url, location.href)} and answer`
    : query;

<Docspot
  search={search}
  handoffs={[chatGptHandoff({ prompt }), claudeHandoff({ prompt })]}
/>;
```

Any other destination is a `DocspotHandoff`: `{ id, title, icon?, description?, getUrl(query, { results }) }`.

## Providers

### Algolia search

```ts
import { createAlgoliaSearch } from 'docspot/algolia';

const search = createAlgoliaSearch({
  appId: 'APP_ID',
  apiKey: 'SEARCH_ONLY_KEY',
  indices: ['docs'],
  // Optional: map record URLs to site URLs, or drop them with null.
  mapUrl: url => url.replace('https://example.com', ''),
  // Optional: describe pages to title and group their results.
  getPage: url => ({ title, hierarchy: ['Guides', title] }),
});
```

It reads DocSearch-style records (`hierarchy.lvl0`…`lvl6`, `content`, `type`, `url`), groups results by their top-level section, keeps highlights and snippets, and lets chat lead when a question has no complete match. Requests go to the API over `fetch` as simple requests, without a CORS preflight, retrying other hosts on network and server errors. `preload` opens the connection.

### Algolia chat

```ts
import { createAlgoliaChat } from 'docspot/algolia-chat';

const chat = createAlgoliaChat({
  appId: 'APP_ID',
  apiKey: 'SEARCH_ONLY_KEY',
  agentId: 'AGENT_ID',
  indices: ['docs_markdown'],
});
```

It configures an AI SDK transport for an Agent Studio agent and adds the attached page's content to the latest question when it is sent, without storing it in the conversation.

### MiniSearch

```ts
import MiniSearch from 'minisearch';
import { createMiniSearchSearch } from 'docspot/minisearch';

const search = createMiniSearchSearch({
  // An index, or a function that loads one on preload or the first search.
  index: () => import('./search-index').then(module => module.index),
  getDocument: hit => ({
    url: hit.id,
    title: hit.title,
    breadcrumb: [hit.section],
    group: hit.section,
    content: hit.text, // The excerpt comes from here
  }),
  // Optional: your own query, ranking, and boosting.
  search: (index, query) => index.search(query, { prefix: true, fuzzy: 0.2 }),
});
```

Matched terms are highlighted in titles, breadcrumbs, and excerpts.

### Your own chat backend

`createChat` accepts any AI SDK `ChatTransport`, or a function that loads one when chat is first used. Set `holdFirstStep` for agents that narrate before they search, so only the answer streams.

## Customization

### Slots

```tsx
<Docspot
  search={search}
  slots={{
    preview: PagePreview,
    pageActions: PageActions,
    branding: () => <a href="https://www.algolia.com">Search by Algolia</a>,
    resultIcon: ResultIcon,
  }}
/>
```

| Slot          | Props                                                                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preview`     | `{ result, query, navigate, notify }`. Renders the active result beside the results, and may suspend. It opens at the element whose `data-docspot-anchor` or `id` matches the result URL's hash. Without it, search has no preview pane and shows results in one column with two-line excerpts |
| `pageActions` | `{ result, query, close, notify }`. Actions beside **Open page**                                                                                                                                                                                                                               |
| `branding`    | None. Shown in the search footer                                                                                                                                                                                                                                                               |
| `resultIcon`  | `{ result, recent }`. Replaces the page, section, and recent icons                                                                                                                                                                                                                             |

Search is a modal dialog in the browser's top layer. Popups that slots open must render inside it, and feedback goes through `notify(message)` rather than toasts elsewhere on the page.

### Theme

Override CSS variables on `:root` or any ancestor:

```css
:root {
  --docspot-font: 'Inter', sans-serif;
  --docspot-background: #fff;
  --docspot-foreground: #111;
  --docspot-muted: #666;
  --docspot-border: #e5e5e5;
  --docspot-accent: #f4f4f5; /* Hover and selection */
  --docspot-primary: #111; /* Send button */
  --docspot-radius-floating: 12px;
  --docspot-tracking: -0.01em;
  --docspot-text-md: 0.9375rem; /* Type scale, from --docspot-text-2xs to 2xl */
  --docspot-mark: transparent; /* Matched text */
  --docspot-mark-weight: 500;
  --docspot-mark-decoration: underline;
  --docspot-chat-top: 64px; /* Space above the docked chat panel */
}
```

Docspot's defaults have no specificity, so any rule overrides them. Dark values apply under `prefers-color-scheme: dark`, `[data-theme='dark']`, or `.dark` on the root element. See [`styles.css`](src/styles.css) for every variable.

These optional variables go further, and fall back to the ones above when unset:

| Variable                                                                       | Styles                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `--docspot-selected`, `--docspot-selected-border`, `--docspot-selected-shadow` | The selected result: its background, border color, and shadow  |
| `--docspot-results-background`                                                 | Behind the results. Accepts any background, gradients included |
| `--docspot-kbd-background`, `--docspot-kbd-border`, `--docspot-kbd-shadow`     | Key hints                                                      |
| `--docspot-scrollbar-color`                                                    | `scrollbar-color` of the chat transcript                       |

### Styling hooks

Variables are the styling API. For layout around Docspot, these class names and attributes are stable too:

| Selector           | Element                                                     |
| ------------------ | ----------------------------------------------------------- |
| `.docspot-trigger` | Search and chat triggers                                    |
| `.docspot-search`  | The search dialog                                           |
| `.docspot-chat`    | The chat panel, with `data-open` while open and `data-dock` |

Every other class name is internal and may change in any release.

### Messages

```tsx
<Docspot
  search={search}
  messages={{
    trigger: { search: 'Find in docs' },
    search: { noResults: query => `Nothing for “${query}”` },
  }}
/>
```

`defaultMessages` lists the English defaults; any part can be overridden. Keys ending in `WithAsk`, such as `search.placeholderWithAsk`, replace their base key when chat is available.

### Chat panel layout

The panel fills the screen on phones, floats over the page from 768 px, and docks beside the page from 1280 px. Its width is resizable there and persists with `history`.

- `dock="fixed"` (default) pins the docked panel to the window's right edge and sets `--docspot-chat-inset` on the root element while it is open, for the page to pad by.
- The root element carries `--docspot-chat-width`, the panel's resized width, for layouts that make room for it.
- `dock="inline"` docks it as a flex item where it is rendered, so the page beside it shrinks.

## History

With `history`, Docspot stores versioned, bounded records in `localStorage` under `docspot:` (or `docspot:<id>:` with `id`):

| Record          | Contents                                                                        |
| --------------- | ------------------------------------------------------------------------------- |
| `recent-pages`  | The 5 most recently opened results                                              |
| `conversations` | The 20 most recent conversations                                                |
| `panel`         | Whether chat was open, its active conversation, the unsent draft, and its width |

Invalid or outdated records are ignored. When storage is full, the oldest conversations are dropped; when it is unavailable, history lasts until the page reloads. Changes in other tabs apply immediately. Recent pages and conversations are cleared separately, and conversations can be deleted one by one.

A reload reopens chat where it docks beside the page; on phones it starts closed.

`importDocspotHistory({ id, recentPages, conversations, panel })` seeds history from a previous implementation. It writes only records that do not exist yet.

## URLs

With `syncUrl`, the URL reflects search and accepts chat links:

| Parameter | Effect                                                         |
| --------- | -------------------------------------------------------------- |
| `q`       | Opens search with the query, and follows typing once it pauses |
| `prompt`  | Opens chat and sends the question                              |
| `draft`   | Opens chat with the question in the composer                   |
| `askPage` | Attaches a page to `prompt` or `draft`                         |

Other parameters and the hash are kept. Back and Forward close and reopen search; after following a result, Back returns to search with its query. Chat parameters leave the URL once applied. Only configured capabilities read their parameters.

```ts
import { createDocspotUrl } from 'docspot';

createDocspotUrl('/docs/install', { prompt: 'How do I upgrade?' });
// "/docs/install?prompt=How+do+I+upgrade%3F"
```

For routers that own history, pass an adapter:

```ts
syncUrl={{
  read: () => location.search,
  write: (search, { replace }) => router.navigate({ search }, { replace }),
  subscribe: listener => router.subscribe(listener),
}}
```

## Events

`onEvent` receives `search.open`, `search.close`, `search.results`, `search.select`, `search.error`, `search.handoff`, `history.clear`, `chat.open`, `chat.close`, `chat.submit`, `chat.answer`, `chat.error`, `chat.stop`, `chat.retry`, `conversation.new`, `conversation.resume`, `conversation.delete`, and `conversation.clear`.

## Loading and server rendering

`docspot` loads React and the triggers only. The search dialog and its dependencies load when search opens, and chat, the AI SDK, and the Markdown renderer load when chat opens. Search-only pages never load chat code, and chat-only pages never load search code. Every entry point is tree-shakeable and free of import side effects.

Docspot gets ready before it's needed, so the first open and the first query don't wait:

- Once the page is idle, and when a trigger is hovered or focused, the search dialog and chat load, and the search function's `preload` runs. Opening search runs it too.
- Once loaded, the dialog opens in the same frame.
- `createMiniSearchSearch` loads and builds its index on `preload`, and `createAlgoliaSearch` opens its connection. Algolia requests skip the CORS preflight.

Give your own search function a `preload` to do the same:

```ts
async function search({ query }: DocspotSearchParams) {
  return runSearch(await loadIndex(), query);
}
search.preload = () => void loadIndex();
```

Load your own index, data, and slot components lazily too, so the page doesn't pay for search before it's used. A lazy slot can start loading with the index:

```ts
const loadPreview = () => import('./SearchPreview');

const search = createMiniSearchSearch({
  index: () => {
    void loadPreview();
    return import('./search-index').then(module => module.default);
  },
  getDocument,
});

<Docspot search={search} slots={{ preview: lazy(loadPreview) }} />;
```

Docspot renders on the server and reads browser state only after hydration.

## Keyboard

| Keys                                            | Action                          |
| ----------------------------------------------- | ------------------------------- |
| <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd>, <kbd>/</kbd> | Open search                     |
| <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Enter</kbd>     | Choose and open a result        |
| <kbd>Tab</kbd>, <kbd>⌘J</kbd>                   | Ask about the query             |
| <kbd>⌘C</kbd>                                   | Copy the selected result's link |
| <kbd>Esc</kbd>                                  | Clear the query, then close     |
| <kbd>⌘J</kbd> / <kbd>Ctrl J</kbd>               | Toggle chat                     |
| <kbd>Enter</kbd>, <kbd>Shift Enter</kbd>        | Send a question, or add a line  |

## License

MIT
