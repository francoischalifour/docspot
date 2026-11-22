# Contributing to Docspot

## Principles

- **Boundaries stay clear.** Each entry point in [`package.json`](packages/docspot/package.json) loads only its own code and peer dependencies. Search-only pages never load chat, and chat-only pages never load search. `check:package` enforces this.
- **Primitives compose.** `<Docspot>` is `<Docspot.Root>` with default surfaces. Everything it does is possible with the parts, `useDocspot()`, slots, and props. Parts accept the props of the element they render and pass consumer refs and handlers through.
- **The interface is the contract.** Variables, the stable selectors listed in the README, and the public types are the API. Other class names are internal.
- **Accessible by default.** Every surface works with the keyboard and a screen reader, respects reduced motion and forced colors, and fits a phone. Tests query by role and accessible name.
- **Tests wait on behavior, not time.** Wait for what the reader would see with `expect.element` or `vi.waitFor`, not for a fixed delay.

## Set up

```sh
bun install --frozen-lockfile
bun run --cwd packages/docspot playwright install chromium
```

Use the versions in `.node-version` and `.bun-version`. Run commands from the repository root.

## Develop

- `bun run --cwd packages/docspot dev`: watch the library build.
- `bun run --cwd examples/docs dev`: serve search and chat on the local build.
- `bun run --cwd examples/chat-only dev`: serve chat without search.

Examples import the built package, so keep the watcher running while you work on them.

## Check

```sh
bun run check
```

It runs every step CI runs: formatting, lint, build, types, browser tests, and package checks. To run one step:

- `bun run format`: format files.
- `bun run lint`: lint with oxlint.
- `bun run test`: run the browser tests in Chromium. Add a file or `-t <name>` after `bun run --cwd packages/docspot test` to run some.
- `bun run --filter docspot check:package`: check the published package, entry point isolation, tree shaking, eager sizes, and server rendering.

## Write

- Interface text lives in `packages/docspot/src/messages.ts`. Keep it short, in sentence case, with typographic quotes and apostrophes.
- Use the shared `Shimmer` component for visible text that describes work in progress. Write a short label such as “Opening chat” or “Searching” without a trailing ellipsis. Wrap only the label, so hints, errors, and retry actions stay still. Keep live-region semantics on the surrounding status. Screen-reader-only announcements use plain text. `Shimmer` shows static text when reduced motion or forced colors are active.
- Change the public API, its README section, and its examples together.

## Submit

Use [Conventional Commits](https://www.conventionalcommits.org) and follow the pull request template. Mark breaking changes with `!`. Name any check you could not run.

## Release

[release-please](https://github.com/googleapis/release-please) opens a release pull request from the Conventional Commits that touch `packages/docspot`. Merging it tags the release, reruns the checks, and publishes to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers), with no token.
