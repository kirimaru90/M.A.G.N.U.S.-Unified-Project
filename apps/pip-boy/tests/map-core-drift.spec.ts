import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// src/shared/map-core/ is a committed copy of apps/packages/map-core
// (map-shared-core). A hand edit to the copy, or a package edit that was never
// synced, fails here — and names the file.

// Playwright loads this spec as CommonJS, so __dirname rather than import.meta.
const SCRIPT = join(__dirname, '../../../scripts/sync-map-core.mjs');

test('the shared map core copies match apps/packages/map-core', () => {
  const run = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
  expect(run.stderr, 'run `node scripts/sync-map-core.mjs` from the repo root').toBe('');
  expect(run.status).toBe(0);
});
