/**
 * Runs the render benchmark in `bench/` and prints its report.
 *
 *   bun run bench           Fail when a count grows past `baselines/bench.json`.
 *   bun run bench --update  Record the current counts as the baseline.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const packageRoot = join(import.meta.dir, '..');
const report = join(packageRoot, 'node_modules', '.bench', 'report.txt');
const update = process.argv.includes('--update');

rmSync(report, { force: true });
mkdirSync(join(packageRoot, 'node_modules', '.bench'), { recursive: true });
const run = Bun.spawnSync(
  ['bunx', 'vitest', 'run', '--config', 'vitest.bench.config.ts'],
  {
    cwd: packageRoot,
    env: { ...process.env, DOCSPOT_BENCH_UPDATE: update ? '1' : '0' },
    stdout: 'inherit',
    stderr: 'inherit',
  }
);
if (existsSync(report)) console.log(readFileSync(report, 'utf8'));
if (update && run.exitCode === 0) console.log('Recorded baselines/bench.json');
process.exit(run.exitCode);
