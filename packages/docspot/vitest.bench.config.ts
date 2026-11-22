import { defineConfig } from 'vitest/config';

import base from './vitest.config';

/**
 * Render benchmark, compared with `baselines/bench.json`. See
 * `bench/render.bench.tsx`.
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['bench/**/*.bench.tsx'],
    // The counting hook must be in place before React loads.
    setupFiles: ['bench/setup.ts', 'test/setup.ts'],
    provide: { updateBaseline: process.env.DOCSPOT_BENCH_UPDATE === '1' },
  },
});
