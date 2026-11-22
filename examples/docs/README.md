# Docs example

Search and chat for a small documentation site:

- Search runs in the browser with [MiniSearch](https://lucaong.github.io/minisearch/), through `docspot/minisearch`. The index and the preview load once the page is idle, or when a trigger is hovered.
- The `preview` slot shows the result's page beside the results, scrolled to its section. `pageActions` copies its Markdown.
- A theme item is found by typing “dark” or “appearance”, and is listed before typing too.
- Handoffs send the query to ChatGPT or Claude, with a link to the best result.
- Chat answers from a scripted backend in [`chat-server.ts`](chat-server.ts), with the page being read attached. Tab or ⌘J in search asks about the query.
- `useDocspot()` powers the “Summarize this page” button.

```sh
bun install
bun run build
bun run --cwd examples/docs dev
```

Replace the scripted backend with a model, for example `streamText(…).toUIMessageStreamResponse()` from the AI SDK.
