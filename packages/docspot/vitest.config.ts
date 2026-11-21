import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

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
    },
  },
});
