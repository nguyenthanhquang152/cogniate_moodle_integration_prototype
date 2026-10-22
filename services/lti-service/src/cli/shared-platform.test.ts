import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { OperatorApiError } from './operator-client.ts';
import { runSharedPlatform } from './shared-platform.ts';

it('names the unknown account in the shared-platform CLI error', async () => {
  const client = { request: vi.fn().mockRejectedValue(new OperatorApiError(404, 'NOT_FOUND', 'Unknown tool account.')) };
  await expect(runSharedPlatform({ account: 'missing-tool', profile: 'blackboard', clientId: 'client' }, client))
    .rejects.toThrow('Unknown tool account: missing-tool.');
});

it('maps create and repeat status to the unchanged output and forwards failures', async () => {
  const request = vi.fn().mockResolvedValueOnce({ status: 201, body: { id: 'platform-one' } })
    .mockResolvedValueOnce({ status: 200, body: { id: 'platform-one' } })
    .mockRejectedValueOnce(new OperatorApiError(409, 'SHARED_PLATFORM_EXISTS', 'Another client id exists. Nothing changed.'));
  const input = { account: 'one', profile: 'blackboard', clientId: 'client', name: 'Name' };
  expect(await runSharedPlatform(input, { request })).toEqual({ platformId: 'platform-one', created: true });
  expect(await runSharedPlatform(input, { request })).toEqual({ platformId: 'platform-one', created: false });
  expect(request).toHaveBeenCalledWith('POST', '/accounts/one/shared-platforms', { profile: 'blackboard', clientId: 'client', name: 'Name' });
  await expect(runSharedPlatform(input, { request })).rejects.toThrow('Another client id exists. Nothing changed.');
});

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
