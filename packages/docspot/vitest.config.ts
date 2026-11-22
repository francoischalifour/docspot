import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import type { BrowserCommandContext } from 'vitest/node';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/': new URL('src/', import.meta.url).pathname,
      '@test/': new URL('test/', import.meta.url).pathname,
    },
  },
  // Prebundled up front, so a lazily imported module never reloads a test
  // with a second copy of React.
  optimizeDeps: {
    include: [
      'ai',
      '@ai-sdk/react',
      'react-markdown',
      'remark-gfm',
      'minisearch',
      '@algolia/autocomplete-core',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'vitest-browser-react',
    ],
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
      viewport: { width: 1440, height: 900 },
      commands: {
        /** Switches the color scheme the way a reader's system setting does. */
        emulateColorScheme: async (
          context: BrowserCommandContext,
          colorScheme: 'light' | 'dark' | null
        ) => {
          await context.page.emulateMedia({ colorScheme });
        },
        /** Drags an element by its role and name with the real mouse. */
        dragBy: async (
          context: BrowserCommandContext,
          role: 'separator',
          name: string,
          deltaX: number,
          { steps = 10 }: { steps?: number } = {}
        ) => {
          const element = context.iframe.getByRole(role, { name });
          const box = await element.boundingBox();
          if (!box) throw new Error(`No ${role} named “${name}”`);
          // The test frame may be scaled to fit; deltas are CSS pixels.
          const cssWidth = await element.evaluate(
            node => node.getBoundingClientRect().width
          );
          const scale = box.width / cssWidth;
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          await context.page.mouse.move(x, y);
          await context.page.mouse.down();
          await context.page.mouse.move(x + deltaX * scale, y, { steps });
          await context.page.mouse.up();
        },
      },
    },
  },
});
