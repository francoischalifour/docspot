# Docspot

Documentation search and AI chat for React. See the [package README](packages/docspot/README.md).

| Path                                       | Contents                                               |
| ------------------------------------------ | ------------------------------------------------------ |
| [`packages/docspot`](packages/docspot)     | The `docspot` package                                  |
| [`examples/chat-only`](examples/chat-only) | Chat without search, with a scripted streaming backend |

## Develop

```sh
bun install
bun run build      # Builds the package
bun run --cwd packages/docspot playwright install chromium
bun run test       # Browser tests (Playwright Chromium)
bun run check      # Formatting, lint, build, types, tests, and package checks
bun run --cwd examples/chat-only dev
```

### Loading labels

Use the shared `Shimmer` component for visible text that describes work in progress. Write a short label such as “Opening chat” or “Searching” without a trailing ellipsis. Wrap only the label so hints, errors, and retry actions stay still. Keep live-region semantics on the surrounding status. Screen-reader-only announcements need plain text.

`Shimmer` displays static text when reduced motion or forced colors are active.

## Release

[release-please](https://github.com/googleapis/release-please) opens a release pull request from the [Conventional Commits](https://www.conventionalcommits.org) that touch `packages/docspot`. Merging it tags the release, reruns the checks, and publishes to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers), with no token.
