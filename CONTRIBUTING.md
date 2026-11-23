# Contributing to Docspot

## Principles

- **Boundaries stay clear.** Each entry point in [`package.json`](packages/docspot/package.json) loads only its own code and peer dependencies. Search-only pages never load chat, and chat-only pages never load search. `check:package` enforces this.
- **Primitives compose.** `<Docspot>` is `<Docspot.Root>` with default surfaces. Everything it does is possible with the parts, `useDocspot()`, slots, and props. Parts accept the props of the element they render and merge them with `mergeProps`: classes join, styles merge, refs both receive the element, and consumer handlers run first, skipping Docspot's after `preventDefault()`. `test/parts.test.tsx` lists every part and checks this, so a new part fails to type-check until it is added there.
- **The interface is the contract.** Variables, the stable selectors listed in the README, and the public types are the API. Other class names are internal.
- **Accessible by default.** Every surface works with the keyboard and a screen reader, respects reduced motion and forced colors, and fits a phone. Tests query by role and accessible name. `test/accessibility.test.tsx` runs axe-core on every surface and state in both palettes and a long-text locale, with no violations allowed; add a step there for a new surface or state.
- **Every change reports its cost.** Bundle sizes and render counts are measured against recorded baselines. Raising one is a decision, not a fix.
- **Tests use what people use.** Test exclusively through public APIs, assert observable behavior, simulate realistic interactions, and mock only unavoidable external dependencies, such as a chat backend. Query by role and accessible name, not by class or internal attribute.
- **Tests wait on behavior, not time.** Wait for what the reader would see with `expect.element` or `vi.waitFor`, not for a fixed delay.
- **Chat tests use `createTestChat`** from `@test/testing`, a backend behind a real AI SDK transport. Script an answer with `answer`, or return `undefined` and drive it with `nextRequest()`: write text, call tools, and end or fail it where the test needs the answer to be, instead of slowing it down with delays.

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

It runs every step CI runs: formatting, build, lint, types, browser tests, and package checks. To run one step:

- `bun run format`: format files.
- `bun run lint`: lint with oxlint, using type information, after `bun run build` since the examples import the build. Its config is `oxlint.json`.
- `bun run test`: run the browser tests in Chromium. Add a file or `-t <name>` after `bun run --cwd packages/docspot test` to run some.
- `bun run --filter docspot check:package`: check the published package, entry point isolation, tree shaking, eager sizes, and server rendering.

## Measure

| Command         | Compares with                           |
| --------------- | --------------------------------------- |
| `bun run size`  | `packages/docspot/baselines/size.json`  |
| `bun run bench` | `packages/docspot/baselines/bench.json` |

`size` bundles common import sets as an application would, minified and gzipped, without peer dependencies, and reports the code each loads up front and on demand. `bench` runs fixed interactions in Chromium and counts React commits and component renders, which follow from the code; durations are printed but not compared. Both fail when a number grows past its baseline: 1% for sizes, 10% for counts. Run `bun run build` before `size`.

To record an intended change, run `bun run --filter docspot size --update` or `bun run --filter docspot bench --update`, and include the change in the pull request. `size --markdown` prints a table to paste.

## Write

- Interface text lives in `packages/docspot/src/locale`, written first in `en.ts`. Keep it short, in sentence case, with typographic quotes and apostrophes. Add a key to every locale: their types require it. Write the assistant's name as `{assistant}` wherever the text shows it. Choose a counted word's form with `pluralize`, never by comparing the count, since languages split plurals differently. Format numbers with the locale's code, give a new locale the `questions` words its language asks with, and keep `test/locale.test.tsx`'s list of text that may match English short.
- Use the shared `Shimmer` component for visible text that describes work in progress. Write a short label such as “Opening chat” or “Searching” without a trailing ellipsis. Wrap only the label, so hints, errors, and retry actions stay still. Keep live-region semantics on the surrounding status. Screen-reader-only announcements use plain text. `Shimmer` shows static text when reduced motion or forced colors are active.
- Change the public API, its README section, and its examples together.

## Submit

Use [Conventional Commits](https://www.conventionalcommits.org) and follow the pull request template. Mark breaking changes with `!`. Name any check you could not run.

## Release

[release-please](https://github.com/googleapis/release-please) opens a release pull request from the Conventional Commits that touch `packages/docspot`. Merging it tags the release, reruns the checks, and publishes to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers), with no token.
