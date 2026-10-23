import { describe, it, expect } from 'vitest';

// src/app/shared/map-core/ is a committed copy of apps/packages/map-core
// (map-shared-core). A hand edit to the copy, or a package edit that was never
// synced, fails here — and names the file.
//
// The CMS carries no @types/node, so the Node APIs are reached through a
// dynamic import and typed here. Vitest runs under Node, so they exist; the
// suite runs from apps/cms, two levels below the repo root.

interface SpawnResult {
  status: number | null;
  stderr: string;
}
type SpawnSync = (
  file: string,
  args: string[],
  opts: { encoding: 'utf8'; cwd: string },
) => SpawnResult;
interface NodeProcess {
  execPath: string;
  cwd(): string;
}

describe('the shared map core', () => {
  it('copies match apps/packages/map-core', async () => {
    const childProcess = 'node:child_process';
    const { spawnSync } = (await import(/* @vite-ignore */ childProcess)) as {
      spawnSync: SpawnSync;
    };
    const proc = (globalThis as unknown as { process: NodeProcess }).process;
    const root = `${proc.cwd()}/../..`;

    const run = spawnSync(proc.execPath, ['scripts/sync-map-core.mjs', '--check'], {
      encoding: 'utf8',
      cwd: root,
    });

    expect(run.stderr, 'run `node scripts/sync-map-core.mjs` from the repo root').toBe('');
    expect(run.status).toBe(0);
  });
});
