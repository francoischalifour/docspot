# Docspot

[![npm version](https://img.shields.io/npm/v/docspot.svg)](https://www.npmjs.com/package/docspot) [![MIT license](https://img.shields.io/npm/l/docspot.svg)](https://github.com/francoischalifour/docspot/blob/main/LICENSE)

Docs search and Ask AI for React. Use search, chat, or both: Docspot provides the dialog, the chat panel, history, URL links, and keyboard, screen reader, and mobile behavior, and you provide the search function, the [AI SDK](https://ai-sdk.dev) chat transport, and your site's routing and content.

- **Search** with grouped results, highlights, previews, recent pages, and default results, from any backend: Algolia, MiniSearch in the browser, or your own function.
- **Chat** over any [AI SDK](https://ai-sdk.dev) transport, with suggested questions, page context, streamed Markdown, sources, tool progress, stop, retry, and saved conversations.
- **Both**, with handoff from a search query to chat.

## Install

```sh
npm install docspot
```

Docspot requires React 19.2 or later within React 19. Chat also requires the AI SDK (`ai` 5 to 7, with the matching `@ai-sdk/react` 2 to 4), and the MiniSearch integration requires `minisearch` 6 or 7:

```sh
npm install ai @ai-sdk/react       # for chat
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

### Entry points

Each entry point loads only what it needs, and none has import side effects.

| Import                 | Provides                                                                 | Peer dependencies     |
| ---------------------- | ------------------------------------------------------------------------ | --------------------- |
| `docspot`              | `<Docspot>`, its parts, `createSearch()`, `useDocspot()`, and helpers    | `react`, `react-dom`  |
| `docspot/chat`         | `createChat()` for any AI SDK transport                                  | `ai`, `@ai-sdk/react` |
| `docspot/algolia`      | `createAlgoliaSearch()` for DocSearch-style indices                      | None                  |
| `docspot/algolia-chat` | `createAlgoliaChat()` for Algolia Agent Studio                           | `ai`, `@ai-sdk/react` |
| `docspot/minisearch`   | `createMiniSearchSearch()` for an index in the browser                   | `minisearch`          |
| `docspot/handoffs`     | `chatGptHandoff()` and `claudeHandoff()`, to continue a search elsewhere | `react`               |
| `docspot/styles.css`   | The stylesheet                                                           | None                  |

## Usage

### Search only

```tsx
import { Docspot, createSearch } from 'docspot';

const search = createSearch(async ({ query, signal }) => {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal,
  });
  return response.json(); // DocspotResult[]
});

export function Header() {
  return <Docspot search={search} history syncUrl />;
}
```

`<Docspot>` renders a trigger button where you place it, and the search dialog. <kbd>⌘K</kbd> or <kbd>Ctrl K</kbd> and <kbd>/</kbd> open search.

Create `search` and `chat` once, outside components or in `useMemo`. A new `chat` starts a new chat session, and a new `search` schedules its preload again.

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

`page.url` is absolute, and `page.content` is what `loadPage` returned for it. The [chat-only example](https://github.com/francoischalifour/docspot/tree/main/examples/chat-only) includes a streaming endpoint, and the [docs example](https://github.com/francoischalifour/docspot/tree/main/examples/docs) combines search and chat.

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

For several Docspot instances, use `owner` to scope shortcuts and the fixed
chat panel's layout variables to a section. The default owner is the document.
An instance responds while focus is inside its owner, so nested owners let the
closest instance handle the shortcut.

```tsx
import { useRef } from 'react';

function SupportPane() {
  const owner = useRef<HTMLElement>(null);
  return (
    <section ref={owner}>
      <Docspot.Root owner={owner} chat={chat}>
        <Docspot.ChatTrigger />
        <Docspot.ChatPanel />
      </Docspot.Root>
    </section>
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

Triggers accept button props, including `ref`. Your handlers run before Docspot's: calling `event.preventDefault()` in `onClick` keeps the surface closed. Pass `children` to replace their content.

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

The methods keep their identity across renders, so they are safe in effect dependencies.

## Props

| Prop           | Description                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `search`       | From `createSearch()` or a provider integration                                                                                      |
| `chat`         | From `createChat()` or a provider integration                                                                                        |
| `context`      | `{ page, prompts, resolvePage }`: the page being read, default suggested questions, and how to describe pages named by URL           |
| `loadPage`     | `(page, { signal }) => Promise<string \| { content, title? } \| null>`: page content for chat, loaded once per page and conversation |
| `defaultItems` | What search lists before typing, in this order. See [Before typing](#before-typing)                                                  |
| `items`        | Items found by typing their title or keywords, such as switching the theme. See [Results and items](#results-and-items)              |
| `handoffs`     | Places to send a query besides these docs, such as a general assistant. See [Handoffs](#handoffs)                                    |
| `navigate`     | `(url, { event }) => void`. Defaults to `window.location.assign`                                                                     |
| `siteUrl`      | The canonical origin, such as `https://example.com`, for copied links, chat page context, and answer links                           |
| `history`      | Persists history. Without it, history lasts until the page reloads                                                                   |
| `id`           | Scopes persisted history, for several instances on one origin                                                                        |
| `owner`        | Element ref that scopes keyboard shortcuts and docked layout. Defaults to the document.                                              |
| `syncUrl`      | `true` for the browser history, or an adapter for routers that own it                                                                |
| `slots`        | Components that replace parts of the interface                                                                                       |
| `messages`     | Interface text overrides                                                                                                             |
| `onEvent`      | Receives interaction events, for analytics                                                                                           |

### Results and items

Search lists two things, kept apart:

- **Results** are pages and sections of these docs, as a search provider returns them: plain data, drawn by slots. They join recent pages, and can be previewed, copied, or opened in a new tab.
- **Items** are what the site offers besides its pages: something to do, such as switching the theme, or somewhere to go, such as another site. `action` says which: a URL opens, in a new tab when on another site; a function runs and closes search. Items stay out of recent pages.

```ts
type DocspotResult = {
  url: string;
  title: string; // A page title or a section heading
  group?: string; // Results with the same group are listed together
  pageTitle?: string; // The page a section belongs to
  breadcrumb?: string[]; // From the top level down, without the title
  excerpt?: string;
  type?: 'page' | 'section';
  highlights?: {
    title?: HighlightedText;
    breadcrumb?: HighlightedText[];
    excerpt?: HighlightedText;
  };
  data?: unknown; // Passed through to slots
};

type DocspotItem = {
  id: string;
  title: string; // What it does or where it goes
  action: string | ((context: { query: string }) => void);
  group?: string; // Items with the same group are listed together
  icon?: ReactNode;
  description?: string; // Says what it does in the preview
  keywords?: string[]; // Other words that find it among `items`
  shortcut?: string; // As aria-keyshortcuts writes it, such as "Meta+S"
  preview?: ComponentType<{ item: DocspotItem; query: string }>; // Replaces the preview's title and description
};

type HighlightedText = Array<{ text: string; highlighted: boolean }>;
```

A URL is listed once, whether a result or an item opens it. The preview pane, where results and items are previewed, needs the [`preview` slot](#slots).

#### Search results

`createSearch(fn, { preload })` makes search from a function that receives `{ query, signal }` and returns results, or `{ results, prioritizeChat }`. A plain function works too. `parseHighlightedString(value, preTag, postTag)` and `highlightTerms(text, terms)` build highlights. `isQuestion(query)` and `shouldPrioritizeChat(…)` help decide `prioritizeChat`.

Docspot cancels a request when the query changes (through `signal`), ignores outdated responses, and never opens a result that belongs to an older query. Search functions can return results synchronously.

#### Found by typing

`items` are listed when their title or keywords start with every word typed, ignoring case and accents, before the search results. Items without a group are listed under "Actions". `defineItem(item)` checks an item's shape where it is declared, so one item can be listed both before and after typing.

```tsx
import { defineItem } from 'docspot';

const darkTheme = defineItem({
  id: 'theme-dark',
  title: 'Dark theme',
  keywords: ['appearance', 'night'],
  shortcut: 'Shift+Meta+L',
  action: () => setTheme('dark'),
});

<Docspot search={search} items={[darkTheme]} />;
```

#### Before typing

`defaultItems` is what search lists before typing, results and items in the order given: groups appear in the order of their first entry. Place `recentItems` where the reader's recent pages go; without it, they come first. Recent pages are left out of the other groups.

```tsx
import { recentItems } from 'docspot';

<Docspot
  search={search}
  items={[darkTheme]}
  defaultItems={[
    { url: '/docs/', title: 'Introduction', group: 'Get started' },
    darkTheme, // Listed under "Actions"
    recentItems,
    { url: '/docs/api/', title: 'API', group: 'Popular' },
  ]}
/>;
```

### Handoffs

Handoffs send the query somewhere else, such as a general assistant. A handoff is a function that builds an item from the query and its results, `({ query, results }) => DocspotItem`, listed after the results once a query is typed. `docspot/handoffs` provides ChatGPT and Claude, with their icons and a preview of what they send:

```tsx
import { chatGptHandoff, claudeHandoff } from 'docspot/handoffs';

// The assistant reads the best result to answer.
const prompt = ({ query, results }) =>
  results[0]
    ? `${query}\n\nRead ${new URL(results[0].url, location.href)} and answer`
    : query;

<Docspot
  search={search}
  handoffs={[chatGptHandoff({ prompt }), claudeHandoff({ prompt })]}
/>;
```

## Providers

### Algolia search

```ts
import { createAlgoliaSearch } from 'docspot/algolia';

const search = createAlgoliaSearch({
  appId: 'APP_ID',
  apiKey: 'SEARCH_ONLY_KEY',
  indices: ['docs'],
  // Optional: adjust each result, or drop it with null.
  transformResult: result => ({
    ...result,
    url: result.url.replace('https://example.com', ''),
  }),
});
```

It reads DocSearch-style records (`hierarchy.lvl0`…`lvl6`, `content`, `type`, `url`), groups results by their top-level section, keeps highlights and snippets (marked on whatever text `transformResult` returns), and lets chat lead when a question has no complete match. Requests go to the API over `fetch` as simple requests, without a CORS preflight, retrying other hosts on network and server errors. `preload` opens the connection.

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
  search: ({ index, query }) =>
    index.search(query, { prefix: true, fuzzy: 0.2 }),
});
```

Matched terms are highlighted in titles, breadcrumbs, and excerpts.

### Your own chat backend

`createChat` accepts any AI SDK `ChatTransport`, or a function that loads one when chat is first used. Set `holdFirstStep` for agents that narrate before they search, so only the answer streams.

When chat opens, a failed runtime or transport load retries once after a short delay. If that attempt also fails, the panel offers **Try again**. A question waiting to be sent, including one from a `?prompt=` link, is sent once startup succeeds. Closing the panel cancels that pending question.

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

| Slot          | Props                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preview`     | `{ result, query, navigate, notify }`. Renders the active page beside the results, and may suspend. It opens at the element whose `data-docspot-anchor` or `id` matches the URL's hash. The two panes stay visible while searching. Without a preview, results use one column with two-line excerpts and a 640 px maximum floating width |
| `pageActions` | `{ result, query, close, notify }`. Actions beside **Open page**                                                                                                                                                                                                                                                                         |
| `branding`    | None. Shown in the search footer                                                                                                                                                                                                                                                                                                         |
| `resultIcon`  | `{ result, recent }`. Replaces the icons of results                                                                                                                                                                                                                                                                                      |
| `shortcut`    | `{ shortcut }`. Draws an item's shortcut, given as `aria-keyshortcuts` writes it                                                                                                                                                                                                                                                         |

Search is a modal dialog in the browser's top layer. Popups that slots open must render inside it, and feedback goes through `notify(message)` rather than toasts elsewhere on the page.

### Theme

Docspot is themed with CSS variables. Most sites only set a few colors and the font:

```css
:root {
  --docspot-font: 'Inter', sans-serif;
  --docspot-background: #fff;
  --docspot-foreground: #111;
  --docspot-muted: #666;
  --docspot-border: #e5e5e5;
  --docspot-accent: #f4f4f5;
  --docspot-primary: #111;
}
```

Set variables on `:root` or any ancestor. Docspot's defaults have no specificity, so any rule overrides them, cascade layers included. The dark palette applies under `prefers-color-scheme: dark`, `[data-theme='dark']`, or `.dark` on the root element; `[data-theme='light']` or `.light` keeps the light palette.

#### Color

| Variable                       | Default    | Used for                                                 |
| ------------------------------ | ---------- | -------------------------------------------------------- |
| `--docspot-background`         | `#ffffff`  | Surfaces: the dialog, the chat panel, and menus          |
| `--docspot-foreground`         | `#18181b`  | Text and icons                                           |
| `--docspot-muted`              | `#6b6b76`  | Secondary text, such as breadcrumbs and hints            |
| `--docspot-subtle`             | `#8a8a94`  | Decorative icons and disabled controls                   |
| `--docspot-border`             | `#e7e7ea`  | Dividers and control borders                             |
| `--docspot-border-strong`      | `#d4d4d8`  | Borders that stand out, such as buttons and the composer |
| `--docspot-surface`            | `#f7f7f8`  | Recessed areas, such as the results list and code        |
| `--docspot-surface-elevated`   | `#ffffff`  | Raised areas, such as the selected result                |
| `--docspot-accent`             | `#f0f0f2`  | Hover and selection backgrounds                          |
| `--docspot-accent-active`      | `#e6e6ea`  | Pressed and current backgrounds                          |
| `--docspot-primary`            | `#18181b`  | The send button and other primary actions                |
| `--docspot-primary-foreground` | `#ffffff`  | Text and icons on `--docspot-primary`                    |
| `--docspot-danger`             | `#c8291c`  | Destructive actions                                      |
| `--docspot-focus`              | Blue, 60%  | Focus outlines                                           |
| `--docspot-overlay`            | Black, 40% | Behind the search dialog                                 |
| `--docspot-mark`               | Text tint  | Background of matched text                               |
| `--docspot-mark-weight`        | `600`      | Weight of matched text                                   |
| `--docspot-mark-decoration`    | `none`     | Decoration of matched text, such as `underline`          |

In both palettes, text colors meet WCAG AA (4.5:1) on every Docspot background, and `--docspot-subtle` meets 3:1 for icons. Keep these ratios when you change them.

#### Type

| Variable                                    | Default                | Used for                                                           |
| ------------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `--docspot-font`                            | `system-ui` stack      | All text                                                           |
| `--docspot-font-mono`                       | `ui-monospace` stack   | Code in answers                                                    |
| `--docspot-tracking`                        | `normal`               | Letter spacing; tighten it for wide fonts                          |
| `--docspot-text-2xs` … `--docspot-text-2xl` | `0.6875rem` … `1.5rem` | The type scale: `2xs`, `xs`, `sm`, `md`, `base`, `lg`, `xl`, `2xl` |

Map the type scale to your site's own sizes to match its text.

#### Shape and elevation

| Variable                    | Default    | Used for                                   |
| --------------------------- | ---------- | ------------------------------------------ |
| `--docspot-radius-control`  | `0.375rem` | Buttons, inputs, keys, and tooltips        |
| `--docspot-radius-item`     | `0.375rem` | Results and menu items                     |
| `--docspot-radius-surface`  | `0.75rem`  | Cards inside surfaces, such as code blocks |
| `--docspot-radius-floating` | `0.75rem`  | The floating search dialog and chat panel  |
| `--docspot-shadow-raised`   | Soft       | The composer and raised cards              |
| `--docspot-shadow-floating` | Deep       | The floating search dialog and chat panel  |

#### Layout

| Variable             | Default | Used for                                                  |
| -------------------- | ------- | --------------------------------------------------------- |
| `--docspot-chat-top` | `0px`   | Space above the docked chat panel, such as a fixed header |
| `--docspot-z-index`  | `50`    | Stacking of the chat panel and its launcher               |

The search dialog renders in the browser's top layer, above every `z-index`.

#### Optional

These have no default. Unset, they fall back to the tokens above, so a theme that only sets those still applies.

| Variable                                                                       | Styles                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `--docspot-selected`, `--docspot-selected-border`, `--docspot-selected-shadow` | The selected result: its background, border color, and shadow  |
| `--docspot-results-background`                                                 | Behind the results. Accepts any background, gradients included |
| `--docspot-kbd-background`, `--docspot-kbd-border`, `--docspot-kbd-shadow`     | Key hints                                                      |
| `--docspot-scrollbar-color`                                                    | `scrollbar-color` of the chat transcript                       |

#### Set by Docspot

Docspot sets these on the owner element (the document root by default) for your layout to read. Don't set them yourself.

| Variable               | Value                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `--docspot-chat-inset` | The panel's width while it is docked beside the page (1280 px and wider) with `dock="fixed"` |
| `--docspot-chat-width` | The panel's resized width, once the reader resizes it                                        |

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

`defaultMessages` lists the English defaults; any part can be overridden. Keys ending in `WithAsk`, such as `search.placeholderWithAsk`, and `trigger.searchAndAsk` replace their base key when chat is available. Overriding only the base key overrides both.

### Chat panel layout

The panel fills the screen on phones, floats over the page from 768 px, and docks beside the page from 1280 px. Its width is resizable there and persists with `history`.

- `dock="fixed"` (default) pins the docked panel to the window's right edge and sets `--docspot-chat-inset` on the owner element (the document root by default) while it is open, for the page to pad by.
- The owner element carries `--docspot-chat-width`, the panel's resized width, for layouts that make room for it.
- `dock="inline"` docks it as a flex item where it is rendered, so the page beside it shrinks.

## History

With `history`, Docspot stores versioned, bounded records in `localStorage` under `docspot:` (or `docspot:<id>:` with `id`):

| Record          | Contents                                                                        |
| --------------- | ------------------------------------------------------------------------------- |
| `recent-pages`  | The 5 most recently opened results                                              |
| `conversations` | The 20 most recent conversations                                                |
| `panel`         | Whether chat was open, its active conversation, the unsent draft, and its width |

Invalid or outdated records are ignored. When storage is full, the oldest conversations are dropped; when it is unavailable, history lasts until the page reloads. Recent pages, saved conversation lists, draft text, and panel width update across tabs. Each tab keeps its active conversation and controls when its panel opens. Recent pages and conversations are cleared separately, and conversations can be deleted one by one.

A reload restores an open panel on screens at least 768 px wide. On smaller screens it starts closed.

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

`onEvent` receives `search.open`, `search.close`, `search.results`, `search.select` (with the chosen `result` or `item`), `search.error`, `history.clear`, `chat.open`, `chat.close`, `chat.submit`, `chat.answer`, `chat.error`, `chat.stop`, `chat.retry`, `conversation.new`, `conversation.resume`, `conversation.delete`, and `conversation.clear`.

## Loading and server rendering

`docspot` loads React and the triggers only. The search dialog, chat runtime, and their dependencies load on demand or during preloading. Search-only pages never load chat code, and chat-only pages never load search code. Every entry point is tree-shakeable and free of import side effects.

Docspot gets ready before it's needed, so the first open and the first query don't wait:

- Once the page is idle, and when a trigger is hovered or focused, the search dialog and chat load, and the search function's `preload` runs. Opening search runs it too.
- Once loaded, the dialog opens in the same frame.
- `createMiniSearchSearch` loads and builds its index on `preload`, and `createAlgoliaSearch` opens its connection. Algolia requests skip the CORS preflight.

Give your own search a `preload` to do the same:

```ts
const search = createSearch(
  async ({ query }) => runSearch(await loadIndex(), query),
  { preload: () => void loadIndex() }
);
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

## Accessibility

- Search is a modal `<dialog>` with an ARIA combobox and listbox. Results are announced as they arrive, focus returns to where it was when search closes, and the reader's place on the page is kept.
- The chat panel is a labeled landmark. Answers are announced when they start and finish rather than word by word, a streamed answer stays anchored at its start, and stop, retry, and copy are buttons with names.
- Every action has a keyboard path, and shortcuts are exposed with `aria-keyshortcuts`. Shortcuts that type a character, such as <kbd>/</kbd>, never fire while typing in a field.
- Animations stop under `prefers-reduced-motion`, loading text stays still in forced colors mode, and on-screen keyboards never cover the search input or the composer.

Slots render inside these surfaces, so give their controls accessible names too.

## Browser support

Docspot supports browsers with the Popover API and the `<dialog>` top layer: Chrome and Edge 114, Firefox 125, and Safari 17, and later versions.

## License

MIT
