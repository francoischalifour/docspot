# Agent instructions

Follow [CONTRIBUTING.md](CONTRIBUTING.md). Run `bun run check` before you finish, and name any step you could not run.

- The package is `packages/docspot`. Its source imports with `@/` and its tests with `@test/`, never relative paths.
- Tests are browser tests in `packages/docspot/test`, run in Chromium through Vitest. Test through public APIs, assert observable behavior, simulate realistic interactions, and mock only unavoidable external dependencies.
- Examples import the built package: run `bun run build` before checking them.
- To use Docspot in another project, read [`packages/docspot/README.md`](packages/docspot/README.md).
