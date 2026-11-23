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
      'axe-core',
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
        /**
         * Switches media features the way a reader's system or browser
         * does: color scheme, forced colors, contrast, or print.
         */
        emulateMedia: async (
          context: BrowserCommandContext,
          options: Parameters<BrowserCommandContext['page']['emulateMedia']>[0]
        ) => {
          await context.page.emulateMedia(options);
        },
        /** Turns the real mouse wheel over an element by its role and name. */
        wheel: async (
          context: BrowserCommandContext,
          role: 'log',
          name: string,
          deltaY: number
        ) => {
          const box = await context.iframe
            .getByRole(role, { name })
            .boundingBox();
          if (!box) throw new Error(`No ${role} named “${name}”`);
          await context.page.mouse.move(
            box.x + box.width / 2,
            box.y + Math.min(box.height / 2, 100)
          );
          await context.page.mouse.wheel(0, deltaY);
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
