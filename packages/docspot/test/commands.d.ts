// Browser commands defined in vitest.config.ts, for tests to call.
import 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** Switches media features, as Playwright's page.emulateMedia does. */
    emulateMedia: (options: {
      colorScheme?: 'light' | 'dark' | null;
      forcedColors?: 'active' | 'none' | null;
      contrast?: 'more' | 'no-preference' | null;
      media?: 'print' | 'screen' | null;
    }) => Promise<void>;
  }
}
