// lti:bootstrap binds the key ring before its first store call (LA-ADR-06 D6; Reviewer-A A-LA-E5-08-01): a new
// signing key is sealed with the active ring version, not with LTI_MASTER_KEY as "legacy".
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blobKeyVersion } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../db/index.ts';
import { findAccountByApiKey, getAccount, updateAccount } from '../store/accounts.ts';
import { runBootstrap } from './bootstrap.ts';

// Fixture keys (test values, not secrets).
const LEGACY = Buffer.alloc(32, 7).toString('hex');
const K2 = Buffer.alloc(32, 2).toString('hex');

const temps: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function stack(ring: object | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'lti-bootstrap-'));
  temps.push(dir);
  const ringFile = join(dir, 'keyring.json');
  if (ring) writeFileSync(ringFile, JSON.stringify(ring), { mode: 0o600 });
  for (const [name, value] of Object.entries({
    DATA_DIR: dir, LTI_KEYRING_FILE: ringFile, LTI_MASTER_KEY: LEGACY, PUBLIC_MOODLE_URL: 'https://moodle.test', PUBLIC_LTI_URL: 'https://lti.cogniate.test',
    PUBLIC_APP_URL: 'https://app.cogniate.test', PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
  })) vi.stubEnv(name, value);
  return dir;
}

function blobVersions(dir: string): string[] {
  const db = openDb(join(dir, 'lti.db'));
  const rows = db.prepare('SELECT private_jwk_encrypted AS blob FROM tool_key ORDER BY created_at, kid').all() as Array<{ blob: Uint8Array }>;
  db.close();
  return rows.map((r) => blobKeyVersion(r.blob));
}

describe('runBootstrap (cli/bootstrap.ts)', () => {
  it.each(['cogniate', 'qa-second', 'another-tool'])('keeps operator tool URLs and an omitted name on repeat bootstrap of %s, including key rotation', async (account) => {
    const dir = stack(null);
    const input = { account, rotateApiKey: false, rotateSigningKey: false };
    const first = await runBootstrap(input);
    let db = openDb(join(dir, 'lti.db'));
    expect(getAccount(db, account)?.launchUrl).toBe('https://app.cogniate.test/tool/launch');
    const edited = { name: 'Operator name', launchUrl: 'https://tool.test/custom-launch', deepLinkingUrl: 'https://tool.test/custom-deep', registrationUrl: 'https://tool.test/custom-registration' };
    updateAccount(db, account, edited, Date.now());
    db.close();
    expect(await runBootstrap(input)).toMatchObject({ created: false, apiKey: null, kid: first.kid });
    db = openDb(join(dir, 'lti.db'));
    expect(getAccount(db, account)).toMatchObject(edited);
    expect(findAccountByApiKey(db, first.apiKey!)?.id).toBe(account);
    db.close();
    const rotated = await runBootstrap({ ...input, name: 'New name', rotateApiKey: true });
    db = openDb(join(dir, 'lti.db'));
    try {
      expect(getAccount(db, account)).toMatchObject({ ...edited, name: 'New name' });
      expect(findAccountByApiKey(db, first.apiKey!)).toBeNull();
      expect(findAccountByApiKey(db, rotated.apiKey!)?.id).toBe(account);
    } finally { db.close(); }
  });

  it('bootstraps an account when the CLI entry path is a symlink', () => {
    const dir = stack({ active: 'k2', keys: { legacy: LEGACY, k2: K2 } });
    const entry = join(dir, 'bootstrap.ts');
    symlinkSync(new URL('./bootstrap.ts', import.meta.url), entry);
    const result = spawnSync(process.execPath, [entry, '--account', 'linked-account'], {
      cwd: dir, encoding: 'utf8', timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).not.toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      account: 'linked-account', created: true, kid: expect.any(String), apiKey: expect.stringMatching(/^ltis_/),
    });
    expect(blobVersions(dir)).toEqual(['k2']);
  });

  it('with the ring {active: "k2"}, the first signing key and a rotated one are k2 blobs', async () => {
    const dir = stack({ active: 'k2', keys: { legacy: LEGACY, k2: K2 } });
    const first = await runBootstrap({ account: 'cogniate', name: 'Cogniate', rotateApiKey: false, rotateSigningKey: false });
    expect(first).toMatchObject({ account: 'cogniate', created: true, apiKey: expect.stringMatching(/^ltis_/) });
    const rotated = await runBootstrap({ account: 'cogniate', rotateApiKey: false, rotateSigningKey: true });
    expect([rotated.created, rotated.apiKey, rotated.kid === first.kid]).toEqual([false, null, false]);
    expect(blobVersions(dir)).toEqual(['k2', 'k2']);
  });

  it('with no ring file, LTI_MASTER_KEY stays the version legacy (today\'s stack)', async () => {
    const dir = stack(null);
    await runBootstrap({ account: 'cogniate', rotateApiKey: false, rotateSigningKey: false });
    expect(blobVersions(dir)).toEqual(['legacy']);
  });
});
