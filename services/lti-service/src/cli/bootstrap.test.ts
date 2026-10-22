// Exercise CLI orchestration against the real host-only operator listener and its audit transactions.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blobKeyVersion, createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, expect, it, vi } from 'vitest';
import { openDb } from '../db/index.ts';
import { buildOperatorApp } from '../http/operator/index.ts';
import { getAccount, updateAccount } from '../store/accounts.ts';
import { listAuditEvents } from '../store/audit.ts';
import { issueOperatorKey } from '../store/operator-keys.ts';
import { issueApiKey, listApiKeys, useApiKey } from '../store/api-keys.ts';
import { createNextToolKey, prepareToolKey } from '../store/tool-keys.ts';
import { capturingLogger, MASTER_KEY, URLS } from '../testkit.ts';
import { runBootstrap } from './bootstrap.ts';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); vi.unstubAllEnvs(); });
const input = { account: 'new-tool', rotateApiKey: false, rotateSigningKey: false };
async function fixture(ring = false) {
  const dir = mkdtempSync(join(tmpdir(), 'cli-bootstrap-'));
  const db = openDb(':memory:');
  const keys = createLocalKeyProvider(ring ? { active: 'k2', keys: new Map([['legacy', MASTER_KEY], ['k2', Buffer.alloc(32, 2)]]) } : legacyKeyRing(MASTER_KEY));
  const { logger } = capturingLogger();
  const app = await buildOperatorApp({ db, keys, logger, urls: URLS });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address() as { port: number };
  const issued = issueOperatorKey(db, { operator: 'cli-unit', expiresAt: Date.now() + 3600_000 }, Date.now());
  const file = join(dir, 'operator-key');
  writeFileSync(file, issued.operatorKey, { mode: 0o600 });
  for (const [name, value] of Object.entries({ LTI_OPERATOR_KEY_FILE: file, OPERATOR_HOST: '127.0.0.1', OPERATOR_PORT: String(address.port), PUBLIC_APP_URL: URLS.app,
    DATA_DIR: join(dir, 'must-not-open-db'), LTI_MASTER_KEY: '', LTI_KEYRING_FILE: join(dir, 'must-not-load-ring') })) vi.stubEnv(name, value);
  cleanup.push(async () => { await app.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });
  const events = () => listAuditEvents(db, { limit: 100 }).events;
  return { db, keys, dir, file, events };
}

it.each(['cogniate', 'qa-second', 'another-tool'])('creates and repeats %s through audited requests while preserving URLs and omitted names', async (account) => {
  const h = await fixture();
  const first = await runBootstrap({ ...input, account });
  expect(first).toEqual({ account, created: true, kid: expect.any(String), apiKey: expect.stringMatching(/^ltis_/) });
  expect(getAccount(h.db, account)).toMatchObject({ name: account, launchUrl: `${URLS.app}/tool/launch`, deepLinkingUrl: `${URLS.app}/tool/deep-link`, registrationUrl: `${URLS.app}/tool/register` });
  expect(h.events().map((e) => e.action).sort()).toEqual(['account.create', 'api_key.issue']);
  expect(h.events().every((e) => e.actor.type === 'operator' && e.actor.id === 'cli-unit')).toBe(true);
  const edited = { name: 'Operator name', launchUrl: 'https://tool.test/launch', deepLinkingUrl: 'https://tool.test/deep', registrationUrl: 'https://tool.test/register' };
  updateAccount(h.db, account, edited, Date.now());
  expect(await runBootstrap({ ...input, account })).toEqual({ ...first, created: false, apiKey: null });
  expect(getAccount(h.db, account)).toMatchObject(edited);
  expect(h.events()).toHaveLength(2);
  await runBootstrap({ ...input, account, name: 'New name' });
  expect(getAccount(h.db, account)).toMatchObject({ ...edited, name: 'New name' });
  expect(h.events().find((e) => e.action === 'account.update')?.details).toEqual({ fields: ['name'] });
  expect(useApiKey(h.db, first.apiKey!, Date.now())?.toolAccountId).toBe(account);
});

it('BD-A2-33: emergency rotation replaces both active keys in one audited issue call', async () => {
  const h = await fixture();
  const first = await runBootstrap(input);
  const second = issueApiKey(h.db, input.account, { label: 'second', scopes: ['launch', 'admin'], createdBy: 'unit', expiresAt: null }, Date.now());
  const oldIds = listApiKeys(h.db, input.account).map((key) => key.id).sort();
  const before = h.events().length;
  const rotated = await runBootstrap({ ...input, rotateApiKey: true });
  expect(rotated).toMatchObject({ account: input.account, created: false, kid: first.kid });
  expect(rotated.apiKey).not.toBe(first.apiKey);
  expect(useApiKey(h.db, first.apiKey!, Date.now())).toBeNull();
  expect(useApiKey(h.db, second.apiKey, Date.now())).toBeNull();
  expect(useApiKey(h.db, rotated.apiKey!, Date.now())?.toolAccountId).toBe(input.account);
  expect(h.events()).toHaveLength(before + 1);
  const event = h.events().find((entry) => Array.isArray(entry.details?.revokedKeyIds));
  expect(event).toMatchObject({ action: 'api_key.issue', actor: { type: 'operator', id: 'cli-unit' } });
  expect((event?.details?.revokedKeyIds as string[]).sort()).toEqual(oldIds);
});

it('a failed atomic rotation preserves both old keys and returns no replacement secret', async () => {
  const h = await fixture();
  const first = await runBootstrap(input);
  const second = issueApiKey(h.db, input.account, { label: 'second', scopes: ['launch'], createdBy: 'unit', expiresAt: null }, Date.now());
  const before = h.events();
  h.db.exec("CREATE TRIGGER refuse_rotation BEFORE INSERT ON audit_event WHEN NEW.action = 'api_key.issue' BEGIN SELECT RAISE(ABORT, 'unit failure'); END");
  await expect(runBootstrap({ ...input, rotateApiKey: true })).rejects.toMatchObject({ status: 500 });
  expect(useApiKey(h.db, first.apiKey!, Date.now())).not.toBeNull();
  expect(useApiKey(h.db, second.apiKey, Date.now())).not.toBeNull();
  expect(h.events()).toEqual(before);
});

it.each(['revoked_at', 'expires_at'])('issues a replacement without a flag when the old API key is inactive through %s', async (column) => {
  const h = await fixture();
  const first = await runBootstrap(input);
  h.db.prepare(`UPDATE api_key SET ${column} = ? WHERE tool_account_id = ?`).run(Date.now() - 1, input.account);
  const next = await runBootstrap(input);
  expect(next.apiKey).toMatch(/^ltis_/);
  expect(next.apiKey).not.toBe(first.apiKey);
  expect(h.events().filter((event) => event.action === 'api_key.issue')).toHaveLength(2);
});

it.each([true, false])('the service seals first and rotated signing keys with its own provider (ring=%s)', async (ring) => {
  const h = await fixture(ring);
  const first = await runBootstrap(input);
  const next = createNextToolKey(h.db, await prepareToolKey(h.keys, input.account), Date.now());
  const rotated = await runBootstrap({ ...input, rotateSigningKey: true });
  expect(rotated).toMatchObject({ created: false, apiKey: null });
  expect(rotated.kid).not.toBe(first.kid);
  const rows = h.db.prepare('SELECT kid, status, private_jwk_encrypted AS blob FROM tool_key').all() as Array<{ kid: string; status: string; blob: Uint8Array }>;
  expect(rows.find((row) => row.kid === next.kid)?.status).toBe('removed');
  expect(rows.filter((row) => row.status !== 'removed').map((row) => blobKeyVersion(row.blob))).toEqual([ring ? 'k2' : 'legacy', ring ? 'k2' : 'legacy']);
  expect(h.events().find((e) => e.action === 'signing_key.activate')?.details).toMatchObject({ forced: true });
});

it('repairs an existing account with no signing key through create, without a redundant activate', async () => {
  const h = await fixture();
  await runBootstrap(input);
  h.db.prepare('DELETE FROM tool_key WHERE tool_account_id = ?').run(input.account);
  const result = await runBootstrap(input);
  expect(result.kid).toBeTruthy();
  expect(h.events().some((e) => e.action === 'signing_key.create')).toBe(true);
  expect(h.events().some((e) => e.action === 'signing_key.activate')).toBe(false);
});

it('runs the symlinked CLI entry point with one JSON stdout line', async () => {
  const h = await fixture(true);
  const entry = join(h.dir, 'bootstrap.ts');
  symlinkSync(new URL('./bootstrap.ts', import.meta.url), entry);
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [entry, '--account', input.account], { cwd: h.dir, timeout: 10_000 });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
  expect(result.code, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.trim().split('\n')).toHaveLength(1);
  expect(JSON.parse(result.stdout)).toMatchObject({ account: input.account, created: true, apiKey: expect.stringMatching(/^ltis_/) });
});
