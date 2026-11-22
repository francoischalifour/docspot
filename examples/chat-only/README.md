# Chat-only example

Chat without search. The trigger opens the chat panel, ⌘J toggles it, and the page being read is attached to questions. A link built with `createDocspotUrl` asks for a summary of the page.

The backend in [`chat-server.ts`](chat-server.ts) is scripted, so the example runs without a model provider. Questions mentioning “flaky” fail once, to show retrying.

```sh
bun install
bun run build
bun run --cwd examples/chat-only dev
```
