import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('prints usage and exits 2 when the shared-platform entry point is a symlink with no arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shared-platform-link-'));
  try {
    const entry = join(dir, 'shared-platform.ts');
    symlinkSync(new URL('./shared-platform.ts', import.meta.url), entry);
    const result = spawnSync(process.execPath, [entry], { cwd: dir, encoding: 'utf8', timeout: 10_000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Usage: shared-platform.ts --account <id>');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
