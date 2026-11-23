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

| Import                 | Provides                                                                               | Peer dependencies     |
| ---------------------- | -------------------------------------------------------------------------------------- | --------------------- |
| `docspot`              | `<Docspot>`, its parts, `createSearch()`, `useDocspot()`, and helpers                  | `react`, `react-dom`  |
| `docspot/chat`         | `createChat()` for any AI SDK transport                                                | `ai`, `@ai-sdk/react` |
| `docspot/algolia`      | `createAlgoliaSearch()` for DocSearch-style indices                                    | None                  |
| `docspot/algolia-chat` | `createAlgoliaChat()` for Algolia Agent Studio                                         | `ai`, `@ai-sdk/react` |
| `docspot/minisearch`   | `createMiniSearchSearch()` for an index in the browser                                 | `minisearch`          |
| `docspot/handoffs`     | `chatGptHandoff()` and `claudeHandoff()`, to continue a search elsewhere               | `react`               |
| `docspot/locale`       | Interface languages: `en`, `fr`, `de`, `es`, `ja`, `zhCN`, and `ar`, and `pluralize()` | None                  |
| `docspot/styles.css`   | The stylesheet                                                                         | None                  |

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
    loadPage: async ({ url }) => (await fetch(`${url}.md`)).text(),
  }}
/>;
```

The trigger opens the chat panel. <kbd>⌘J</kbd> or <kbd>Ctrl J</kbd> toggles it.

Each request body includes the question's context in `docspot`, typed as `DocspotRequestContext` from `docspot/chat`, which your endpoint can use:

```ts
import type { DocspotRequestContext } from 'docspot/chat';

type Body = {
  messages: UIMessage[];
  docspot?: DocspotRequestContext; // { page?: { url, title?, content? } }
};
```

`page.url` is absolute, and `page.content` is what `context.loadPage` returned for it. The [chat-only example](https://github.com/francoischalifour/docspot/tree/main/examples/chat-only) includes a streaming endpoint, and the [docs example](https://github.com/francoischalifour/docspot/tree/main/examples/docs) combines search and chat.

### Search and chat

```tsx
<Docspot search={search} chat={chat} history syncUrl />
```

Search offers to ask about the query: press <kbd>Tab</kbd>, choose the **Ask AI** row, or press <kbd>⌘J</kbd>. When the search response sets `prioritizeChat`, asking comes first.

The default trigger opens search, which is the way into chat, so `<Docspot>` renders no separate chat button. For one, add a trigger where you place it, or a launcher that floats where the panel opens:

```tsx
<Docspot search={search} chat={chat}>
  <Docspot.ChatTrigger /> {/* or <Docspot.ChatLauncher /> */}
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
| `Docspot.ChatLauncher`  | A floating button where the panel opens, shown while chat is hidden      |
| `Docspot.SearchDialog`  | The search dialog while it is open                                       |
| `Docspot.ChatPanel`     | The chat panel                                                           |

Every part accepts the props of the element it renders, including `ref`: triggers and the launcher take `<button>` props, `Docspot.SearchDialog` takes `<dialog>` props, and `Docspot.ChatPanel` takes `<aside>` props, typed as `SearchTriggerProps`, `ChatTriggerProps`, `TriggerProps`, `ChatLauncherProps`, `SearchDialogProps`, and `ChatPanelProps`. They merge with Docspot's own the same way everywhere:

- Classes join, styles merge, and refs both receive the element. Other props replace Docspot's, such as `aria-label`.
- Your handlers run before Docspot's. Calling `event.preventDefault()` skips Docspot's: in a trigger's `onClick`, it keeps the surface closed, and in the dialog's or the panel's `onKeyDown`, it keeps <kbd>Esc</kbd> from closing them.
- Pass `children` to replace a trigger's or the launcher's content. The dialog's and the panel's content, `open`, `hidden`, and the panel's `id` are Docspot's.

`render` replaces the `<button>` a trigger renders, for example with your design system's button. An element receives the trigger's props merged into its own: both handlers run, yours first, classes join, and refs both receive the element. A function receives the props and the trigger's state, `{ open }`, and returns what to render:

```tsx
<Docspot.SearchTrigger render={<Button variant="ghost" />} />

<Docspot.ChatTrigger
  render={(props, { open }) => (
    <Button {...props}>{open ? 'Hide AI' : 'Ask AI'}</Button>
  )}
/>
```

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
| `preloadSearch()`, `preloadChat()`          | Loads search or chat ahead of opening it, such as on hover        |

`page` attaches a page to the question; `null` attaches none. Without it, the current page stays attached.

The methods keep their identity across renders, so they are safe in effect dependencies.

## Props

| Prop           | Description                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`       | From `createSearch()` or a provider integration                                                                                                                                                 |
| `chat`         | From `createChat()` or a provider integration                                                                                                                                                   |
| `context`      | `{ page, prompts, resolvePage, loadPage }`: the page being read, default suggested questions, and how chat describes pages named by URL and loads their content, once per page and conversation |
| `defaultItems` | What search lists before typing, in this order. See [Before typing](#before-typing)                                                                                                             |
| `items`        | Items found by typing their title or keywords, such as switching the theme. See [Results and items](#results-and-items)                                                                         |
| `handoffs`     | Places to send a query besides these docs, such as a general assistant. See [Handoffs](#handoffs)                                                                                               |
| `navigate`     | `(url, { event }) => void \| Promise`. Search closes once a returned promise resolves; rejection keeps it open. Defaults to `window.location.assign`                                            |
| `siteUrl`      | The canonical origin, such as `https://example.com`, for copied links, chat page context, and answer links                                                                                      |
| `history`      | Persists history. Without it, history lasts until the page reloads                                                                                                                              |
| `id`           | Scopes persisted history, for several instances on one origin                                                                                                                                   |
| `owner`        | Element ref that scopes keyboard shortcuts and docked layout. Defaults to the document.                                                                                                         |
| `syncUrl`      | `true` for the browser history, or an adapter for routers that own it                                                                                                                           |
| `preload`      | `false` loads search and chat only on open, or with `preloadSearch()` and `preloadChat()`                                                                                                       |
| `searchOpen`   | Controls whether search is open, with `onSearchOpenChange`. See [Controlled state](#controlled-state)                                                                                           |
| `query`        | Controls the search query, with `onQueryChange`                                                                                                                                                 |
| `chatOpen`     | Controls whether chat is open, with `onChatOpenChange`                                                                                                                                          |
| `slots`        | Components that replace parts of the interface                                                                                                                                                  |
| `locale`       | The interface's language, from `docspot/locale` or your own. See [Languages and text](#languages-and-text)                                                                                      |
| `messages`     | Text that replaces the locale's, such as `assistant`, the name of who answers                                                                                                                   |
| `onEvent`      | Receives interaction events, for analytics                                                                                                                                                      |

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

`createSearch(fn, { preload })` makes search from a function that receives `{ query, signal, locale }` and returns results, or `{ results, prioritizeChat }`. `locale` is the interface's language: its `code`, such as `fr`, and its question words. A plain function works too. `parseHighlightedString(value, preTag, postTag)` and `highlightTerms(text, terms)` build highlights. `isQuestion(query, locale)` and `shouldPrioritizeChat({ …, locale })` help decide `prioritizeChat`: they recognize questions in the locale's language, and in English whatever the language, since readers often search in English.

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

The ChatGPT and Claude logos are trademarks of OpenAI and Anthropic, shown to identify where a query opens. Pass `icon` to use other artwork.

## Providers

### Algolia search

```ts
import { createAlgoliaSearch } from 'docspot/algolia';

const search = createAlgoliaSearch({
  appId: 'APP_ID',
  apiKey: 'SEARCH_ONLY_KEY',
  indices: ['docs'],
  // Optional: adjust each result, or drop it with null.
  transformResult: result => (result.url.includes('/archive/') ? null : result),
});
```

Records can keep absolute URLs: results on `siteUrl` or the current origin open in place, and `navigate` receives their path, so preview deploys work too.

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

### Tool calls

Answers can show what your agent's tools return, such as a card or a chart, by giving `createChat` a renderer for each tool by name. A renderer receives the call's `state`, its `input`, and its `output` or `errorText`:

```tsx
import { createChat, type DocspotToolProps } from 'docspot/chat';

function OptionCard({
  state,
  input,
  output,
}: DocspotToolProps<{ name: string }, Option>) {
  if (state !== 'output-available') return <p>Looking up {input?.name}</p>;
  return <OptionDetails option={output!} />;
}

const chat = createChat({ transport, tools: { showOption: OptionCard } });
```

Tool calls show in the order the agent made them, before the answer's text. Tools without a renderer show only as progress, such as “Searching for …”.

For a tool that runs in the browser, such as a confirmation, call `addOutput` with the reader's answer: the conversation continues with it, as with the AI SDK's `addToolOutput`. Your endpoint should continue the same answer, for example with `toUIMessageStreamResponse({ originalMessages })`.

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
| `resultIcon`  | `{ result, recent, size, className, 'aria-hidden', focusable }`. Draws a result's icon, such as its section's                                                                                                                                                                                                                            |
| `icons`       | Icons by what they mean. See [Icons](#icons)                                                                                                                                                                                                                                                                                             |
| `pageIcon`    | `{ page, size, className, 'aria-hidden', focusable }`. Draws the icon of the page a question uses, such as its section's                                                                                                                                                                                                                 |
| `tooltip`     | `{ label, shortcut, side, children }`. Replaces Docspot's tooltips. See [Tooltips](#tooltips)                                                                                                                                                                                                                                            |
| `shortcut`    | `{ shortcut }`. Draws an item's shortcut, given as `aria-keyshortcuts` writes it                                                                                                                                                                                                                                                         |

Search is a modal dialog in the browser's top layer. Popups that slots open must render inside it, and feedback goes through `notify(message)` rather than toasts elsewhere on the page.

#### Tooltips

Docspot's tooltips show on hover and keyboard focus, in the top layer so no panel cuts them off, beside their button inside the viewport. `slots.tooltip` replaces them with your site's own. It receives the trigger as `children`, to render as is, the `label` to show, which the trigger already has as its accessible name, the preferred `side`, and Docspot's key hint as `shortcut`, such as <kbd>Esc</kbd>, which takes the tooltip's text color. With Base UI:

```tsx
import { Tooltip } from '@base-ui/react/tooltip';
import type { DocspotTooltipProps } from 'docspot';

function SiteTooltip({ label, shortcut, side, children }: DocspotTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner
          side={side}
          sideOffset={6}
          className="tooltip-positioner"
        >
          <Tooltip.Popup className="tooltip">
            {label}
            {shortcut}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

<Docspot slots={{ tooltip: SiteTooltip }} />;
```

Tooltips show in chat, which sits above the page at `--docspot-z-index`, so place the portaled tooltip above it:

```css
.tooltip-positioner {
  z-index: calc(var(--docspot-z-index) + 1);
}
```

#### Icons

`slots.icons` replaces Docspot's icons, such as with your site's icon set. Give any of them; the rest stay Docspot's own. Each receives `{ size, className, 'aria-hidden', focusable }` for its `<svg>`, as icon sets such as Lucide take them, and takes its color from the text around it:

```tsx
import { ArrowUp, Search, Square } from 'lucide-react';

<Docspot slots={{ icons: { search: Search, send: ArrowUp, stop: Square } }} />;
```

| Key              | Icon                                                     |
| ---------------- | -------------------------------------------------------- |
| `search`         | The search field and trigger                             |
| `loading`        | Search while results are slow; Docspot spins it          |
| `page`           | A page result, link item, or page attached to a question |
| `section`        | A section result                                         |
| `recent`         | A recent page                                            |
| `ask`            | Asking AI, and suggested questions                       |
| `action`         | An item whose `action` is a function                     |
| `conversation`   | A conversation in the chat switcher                      |
| `expand`         | Opens the chat switcher                                  |
| `send`, `stop`   | Send a question, and stop an answer                      |
| `newChat`        | Starts a new chat                                        |
| `collapse`       | Hides the docked chat panel                              |
| `close`          | Closes chat over the page, or removes an attached page   |
| `delete`         | Deletes a conversation, or clears history                |
| `copy`, `copied` | Copy, and once copied                                    |
| `retry`          | Retries an answer                                        |
| `helpful`        | Rates an answer helpful                                  |
| `unhelpful`      | Rates an answer not helpful                              |
| `jump`           | Jumps to the end of an answer                            |
| `source`         | An answer's source                                       |
| `external`       | A link that opens in a new tab                           |
| `enter`          | The key that opens the selected result                   |

`resultIcon` takes precedence over `page`, `section`, and `recent` for results. Docspot's own icons draw at one weight, which [`--docspot-icon-stroke`](#icon-stroke) sets.

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

Set variables on `:root` or any ancestor. Docspot's defaults have no specificity, so any rule overrides them, cascade layers included.

#### Light and dark

Docspot follows the reader's system setting, and the way most sites switch themes, with no configuration:

- **System:** the dark palette applies under `prefers-color-scheme: dark`.
- **Site switch:** `[data-theme='dark']` or `.dark` applies it, and `[data-theme='light']` or `.light` keeps the light palette whatever the system says. On `<html>`, they theme the whole page; on any element, they theme the Docspot parts inside it, such as a dark section of a light page.

Native parts, such as scrollbars, follow the palette through `--docspot-color-scheme`, even when the page itself doesn't set `color-scheme`.

To change dark colors, override them under the same selectors your site uses for dark mode:

```css
:root {
  --docspot-accent: #eef2ff;
}

:root.dark {
  --docspot-accent: #1e1b4b;
}

/* For sites that follow the system setting. */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --docspot-accent: #1e1b4b;
  }
}
```

A palette of your own that is dark also sets `--docspot-color-scheme: dark`.

#### Color

| Variable                       | Default         | Used for                                                 |
| ------------------------------ | --------------- | -------------------------------------------------------- |
| `--docspot-background`         | `#ffffff`       | Surfaces: the dialog, the chat panel, and menus          |
| `--docspot-foreground`         | `#18181b`       | Text and icons                                           |
| `--docspot-muted`              | `#6b6b76`       | Secondary text, such as breadcrumbs and hints            |
| `--docspot-subtle`             | `#8a8a94`       | Decorative icons and disabled controls                   |
| `--docspot-border`             | `#e7e7ea`       | Dividers and control borders                             |
| `--docspot-border-strong`      | `#d4d4d8`       | Borders that stand out, such as buttons and the composer |
| `--docspot-surface`            | `#f7f7f8`       | Recessed areas, such as the results list and code        |
| `--docspot-surface-elevated`   | `#ffffff`       | Raised areas, such as the selected result                |
| `--docspot-accent`             | `#f0f0f2`       | Hover and selection backgrounds                          |
| `--docspot-accent-active`      | `#e6e6ea`       | Pressed and current backgrounds                          |
| `--docspot-primary`            | `#18181b`       | The send button and other primary actions                |
| `--docspot-primary-foreground` | `#ffffff`       | Text and icons on `--docspot-primary`                    |
| `--docspot-danger`             | `#c8291c`       | Destructive actions                                      |
| `--docspot-focus`              | Blue, 60%       | Focus outlines                                           |
| `--docspot-overlay`            | Black, 40%      | Behind the search dialog                                 |
| `--docspot-color-scheme`       | `light`, `dark` | The `color-scheme` of native parts, such as scrollbars   |
| `--docspot-mark`               | Text tint       | Background of matched text                               |
| `--docspot-mark-weight`        | `600`           | Weight of matched text                                   |
| `--docspot-mark-decoration`    | `none`          | Decoration of matched text, such as `underline`          |

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

#### Icon stroke

| Variable                | Default | Used for                                                        |
| ----------------------- | ------- | --------------------------------------------------------------- |
| `--docspot-icon-stroke` | `1.3`   | The stroke of every icon, in pixels as drawn, whatever its size |

Match it to your icon set's weight, or replace the icons themselves with [`slots.icons`](#icons).

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

### Languages and text

Docspot's interface is in English unless you pass a `locale`. `docspot/locale` provides English (`en`), French (`fr`), German (`de`), Spanish (`es`), Japanese (`ja`), simplified Chinese (`zhCN`), and Arabic (`ar`). Import only the ones you use:

```tsx
import { fr } from 'docspot/locale';

<Docspot search={search} chat={chat} locale={fr} />;
```

`messages` replaces any of the locale's text, and keeps the rest. `assistant` names who answers questions: other text writes it where it says `{assistant}`, so one key renames every label that shows it, such as **Ask AI**, the panel's title, and **Hide Ask AI**:

```tsx
<Docspot
  search={search}
  chat={chat}
  locale={fr}
  messages={{
    assistant: 'Acme', // "Demander à Acme"
    search: { noResults: query => `Rien pour « ${query} »` },
  }}
/>
```

Strings can use `{assistant}` too. Text that depends on a value, such as a query or a count, is a function that returns it, so each language places and pluralizes it. `pluralize(count, forms, language)` from `docspot/locale` picks a word's form with `Intl.PluralRules`, falling back to `other` for a category without its own:

```ts
import { pluralize } from 'docspot/locale';

const resultCount = (count: number) =>
  `${count} ${pluralize(count, { one: 'wynik', few: 'wyniki', many: 'wyników', other: 'wyniku' }, 'pl')}`;
// 1 wynik, 3 wyniki, 5 wyników
```

Keys ending in `WithAsk`, such as `search.placeholderWithAsk` and `trigger.searchWithAsk`, replace their base key when chat is available. Overriding only the base key overrides both.

For another language, write a `DocspotLocale`: its BCP 47 `code`, which formats dates, and every message, which TypeScript checks against `en`:

```ts
import type { DocspotLocale } from 'docspot';
import { en } from 'docspot/locale';

export const nl: DocspotLocale = {
  code: 'nl',
  messages: {
    assistant: 'AI',
    trigger: {
      search: 'Docs doorzoeken',
      searchWithAsk: 'Zoeken of vragen',
      chat: '{assistant} vragen',
    },
    search: { ...en.messages.search /* , … */ },
    chat: { ...en.messages.chat /* , … */ },
  },
};
```

The locale also follows the language beyond its text:

- **Keys** show as its keyboards label them, through `keys`, such as **Strg** in German and **Échap** in French.
- **Numbers and dates** use its formats. Dates prefer the reader's regional variant when their browser asks for one, such as `en-GB` for `en`.
- **Words** split as the language splits them, so items match a word inside a Japanese or Chinese title, written without spaces.
- **Questions** are recognized in the language through `questions`, the words it asks with, as `isQuestion` does. A locale of your own can give them: `{ starts: ['come', 'perche'], requests, markers, stop }`, lowercase and without accents.

Set `lang` on your page to match, so screen readers pronounce the text in its language, and `dir="rtl"` for Arabic and other right-to-left languages.

### Controlled state

Search's open state and query, and chat's open state, can be controlled. Docspot asks for a change through the `on…Change` callback and follows the prop, so a parent can allow, delay, or refuse it:

```tsx
const [searchOpen, setSearchOpen] = useState(false);
const [query, setQuery] = useState('');

<Docspot
  search={search}
  searchOpen={searchOpen}
  onSearchOpenChange={setSearchOpen}
  query={query}
  onQueryChange={setQuery}
/>;
```

Changing the props opens, closes, or fills search as Docspot's own controls do: focus returns to where it was, `onEvent` reports the change, and the URL follows with `syncUrl`. A question asked while a parent keeps chat closed is sent once `chatOpen` turns true.

### Chat panel layout

The panel fills the screen on phones, floats over the page from 768 px, and docks beside the page from 1280 px. Its width is resizable there and persists with `history`.

- `dock="fixed"` (default) pins the docked panel to the window's edge, right or left in right-to-left pages, and sets `--docspot-chat-inset` on the owner element (the document root by default) while it is open, for the page to pad by with `margin-inline-end: var(--docspot-chat-inset, 0px)`.
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
createDocspotUrl('/docs', { query: 'install' });
// "/docs?q=install"
```

`syncUrl` follows Back and Forward and, where the browser has the Navigation API, links a client router opens, such as a `<Link>` to a `createDocspotUrl` URL. For a router whose own state must see Docspot's changes, pass an adapter. Docspot always uses the latest one, so it can be written inline. With React Router's data router:

```ts
syncUrl={{
  read: () => location.search,
  write: (search, { replace }) => router.navigate({ search }, { replace }),
  subscribe: listener => router.subscribe(listener),
}}
```

## Events

`onEvent` receives `search.open`, `search.close`, `search.results`, `search.select` (with the chosen `result` or `item`), `search.error`, `history.clear`, `chat.open`, `chat.close`, `chat.submit`, `chat.answer`, `chat.error`, `chat.stop`, `chat.retry`, `chat.feedback`, `conversation.new`, `conversation.resume`, `conversation.delete`, and `conversation.clear`.

### Answer feedback

Readers can rate each complete answer helpful or not helpful. Answers still streaming, stopped, or failed can't be rated, before or after a reload. After rating one down, the reader can choose a reason and add a few words, both optional. Choosing the same rating again clears it. Each change sends a `chat.feedback` event:

```ts
type ChatFeedbackEvent = {
  type: 'chat.feedback';
  conversationId: string;
  messageId: string; // The answer's AI SDK message ID
  question: string; // The question it answers, as asked
  answer: string; // The answer's text, as shown
  value: 'up' | 'down' | null; // null when the reader clears it
  reason?: 'incorrect' | 'incomplete' | 'unrelated';
  comment?: string;
};
```

A rating down is sent once when given, and again with its reason or comment if the reader sends one, so keep the latest event for each `messageId`:

```tsx
<Docspot
  chat={chat}
  onEvent={event => {
    if (event.type === 'chat.feedback')
      void fetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(event),
      });
  }}
/>
```

`messageId` is the ID your endpoint gives the answer, such as with `generateMessageId` in `toUIMessageStreamResponse`, or one the browser generated otherwise. With `history`, the rating is kept in the answer's `metadata.feedback` and shows again after a reload. Rating an answer leaves its conversation where it is among recent chats.

## Loading and server rendering

`docspot` loads React and the triggers only. The search dialog, chat runtime, and their dependencies load on demand or during preloading. Search-only pages never load chat code, and chat-only pages never load search code. Every entry point is tree-shakeable and free of import side effects.

Docspot gets ready before it's needed, so the first open and the first query don't wait:

- Once the page has loaded and the browser is idle, the search dialog and chat load, and the search function's `preload` runs. A reader saving data or on a slow connection skips this.
- They also load when a trigger is hovered, pressed, or focused, and when ⌘ or Ctrl is pressed before a shortcut. Opening search runs `preload` too.
- Once loaded, the dialog opens in the same frame. Opened sooner, it keeps what is typed while it loads.
- A query search opens with, from `?q=` or `openSearch(query)`, is searched while the dialog loads.
- `createMiniSearchSearch` loads and builds its index on `preload`, and `createAlgoliaSearch` opens its connection. Algolia requests skip the CORS preflight.

`preload={false}` turns this off, so search and chat load only when opened or when you call `preloadSearch()` and `preloadChat()` from `useDocspot()`, such as from your own trigger or a router's prefetch:

```tsx
function SearchButton() {
  const { openSearch, preloadSearch } = useDocspot();
  return (
    <button onPointerEnter={preloadSearch} onClick={() => openSearch()}>
      Search
    </button>
  );
}

<Docspot.Root search={search} preload={false}>
  <SearchButton />
  <Docspot.SearchDialog />
</Docspot.Root>;
```

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

With React Server Components, Docspot's components and hooks are client components: their modules start with `'use client'`. Server code can import helpers such as `createDocspotUrl`, `highlightTerms`, and `isQuestion`, for example in a search endpoint. Search, chat, and `navigate` are functions, which can't pass from a server component to a client component, so render `<Docspot>` inside a client component of your own.

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
- The chat panel is a labeled landmark. Answers are announced when they start and finish rather than word by word, a streamed answer stays anchored at its start, and stop, retry, copy, and ratings are buttons with names. Ratings are toggle buttons, and the optional reason after rating an answer down is a labeled group of radio buttons and a text field, which <kbd>Esc</kbd> leaves.
- Every action has a keyboard path, and shortcuts are exposed with `aria-keyshortcuts`. Shortcuts that type a character, such as <kbd>/</kbd>, never fire while typing in a field.
- Animations stop under `prefers-reduced-motion`, loading text stays still in forced colors mode, and on-screen keyboards never cover the search input or the composer.

Slots render inside these surfaces, so give their controls accessible names too.

## Languages and reader settings

Docspot adapts to these with no configuration:

- **Right-to-left pages** (`dir="rtl"`): layouts mirror, the chat panel docks on the left, and resizing follows. Key combinations still read left to right.
- **Keyboard layouts:** shortcuts work on non-Latin layouts, such as Russian or Greek, by the key's position, and on remapped Latin layouts, such as Dvorak, by the letter typed.
- **Light and dark:** see [Light and dark](#light-and-dark).
- **High contrast** (`forced-colors`): system colors apply, and the selected result is marked in the system highlight color.
- **More contrast** (`prefers-contrast: more`): secondary text and borders get stronger.
- **Reduced motion:** animations stop.
- **Zoom and text size:** sizes are in `rem`, so they follow the reader's font size.
- **Notched screens:** full-screen search and chat keep clear of safe areas.
- **Print:** search, chat, and the room kept for the docked panel are left out.

## Browser support

Docspot supports current browsers: the latest two major versions of Chrome, Edge, Firefox, and Safari. It ships modern JavaScript (ES2022) and CSS, untranspiled, so sites that target only these browsers send no fallback code.

It needs these, which every current browser has:

- The `<dialog>` element and the Popover API, for the search dialog, menus, and tooltips in the top layer.
- `Intl.Segmenter` and `Intl.PluralRules`, for words and plurals in each language.
- CSS `color-mix()`, `:has()`, logical properties such as `inset-inline`, and dynamic viewport units.

These improve Docspot where a browser has them, and are skipped where it doesn't:

- The Navigation API follows links a client router opens with `syncUrl`; without it, Back and Forward still work.
- `requestIdleCallback` preloads search and chat once the browser is idle; without it, they preload right after the page loads.
- CSS `field-sizing` grows the composer with its text; without it, the composer scrolls.
- `@starting-style` and `text-wrap` animate surfaces in and balance headings.

### Older browsers

To support older browsers, lower Docspot to their level in your build, as you do your own code:

- **JavaScript:** include Docspot in what your bundler transpiles for your targets. Vite and esbuild lower dependencies to `build.target` already. With Next.js, add `transpilePackages: ['docspot']`. With Babel or SWC, stop excluding `node_modules/docspot`.
- **APIs:** load polyfills before Docspot, such as [`@oddbird/popover-polyfill`](https://github.com/oddbird/popover-polyfill) for popovers and [`@formatjs/intl-segmenter`](https://formatjs.github.io/docs/polyfills/intl-segmenter/) for `Intl.Segmenter`. Your build's polyfill service, such as `core-js` with `useBuiltIns`, covers the rest of the JavaScript.
- **CSS:** run `docspot/styles.css` through your CSS pipeline, such as Lightning CSS or `postcss-preset-env` with your targets. Some theme colors mix CSS variables with `color-mix()`, which no build can compute ahead of time. In browsers without it, those colors, such as match highlights, the focus ring, and dark-mode secondary text, fall back to inherited ones, so set them to plain colors for those browsers if they matter.

## License

MIT
