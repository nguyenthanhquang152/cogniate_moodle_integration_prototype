import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { cliError, createOperatorClient, OperatorApiError } from './operator-client.ts';

const dirs: string[] = [];
afterEach(() => { vi.unstubAllGlobals(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'operator-client-')); dirs.push(dir);
  const file = join(dir, 'operator-key');
  const key = `ltio_${'x'.repeat(43)}`;
  writeFileSync(file, `${key}\n`, { mode: 0o600 });
  return { dir, file, key, env: { LTI_OPERATOR_KEY_FILE: file, OPERATOR_HOST: '0.0.0.0', OPERATOR_PORT: '4321' } };
}

it('uses the key file, loopback for a wildcard listener, JSON, a deadline, and no redirects', async () => {
  const h = fixture();
  const fetch = vi.fn().mockResolvedValue(new Response('{"id":"account"}', { status: 201 })); vi.stubGlobal('fetch', fetch);
  expect(await createOperatorClient(h.env).request('POST', '/accounts', { name: 'Name' })).toEqual({ status: 201, body: { id: 'account' } });
  expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:4321/operator/v1/accounts', expect.objectContaining({
    method: 'POST', headers: { authorization: `OPERATOR-AUTH-V1 ${h.key}`, 'content-type': 'application/json' },
    body: '{"name":"Name"}', redirect: 'error', signal: expect.any(AbortSignal),
  }));
});

it('formats an IPv6 listener and preserves operator error status/code without retrying a mutation', async () => {
  const h = fixture();
  const fetch = vi.fn().mockResolvedValue(new Response('{"details":{"message":"ACCOUNT_CLOSED","description":"Account is closed."}}', { status: 409 })); vi.stubGlobal('fetch', fetch);
  await expect(createOperatorClient({ ...h.env, OPERATOR_HOST: '::' }).request('POST', '/accounts/one/api-keys', {}))
    .rejects.toMatchObject({ status: 409, code: 'ACCOUNT_CLOSED', message: 'Account is closed.' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]?.[0]).toBe('http://[::1]:4321/operator/v1/accounts/one/api-keys');
});

it('names the host file and a real recovery path when the server rejects the copied key', async () => {
  const h = fixture(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
  await expect(createOperatorClient(h.env).request('GET', '/accounts')).rejects.toThrow(`Operator key file ${h.file}`);
  await expect(createOperatorClient(h.env).request('GET', '/accounts')).rejects.toThrow('npm run seed');
  await expect(createOperatorClient(h.env).request('GET', '/accounts')).rejects.toThrow('infra/.secrets/lti-operator-key');
  await expect(createOperatorClient(h.env).request('GET', '/accounts')).rejects.toThrow('Put the current operator key');
  // B-LA-E5-05-04: the revoke-all step comes last and says that it revokes every operator key.
  const message = await createOperatorClient(h.env).request('GET', '/accounts').then(() => '', (error: Error) => error.message);
  expect(message).toMatch(/ask another operator to issue you a new key\. Only if no operator has a working key, run npm run lti:bootstrap .* --replace-operator-key \(init --replace\)\. This revokes every operator key, also the keys of other operators and scripts\.$/);
  expect(message).not.toContain('safely');
});

it.each(['missing', 'malformed'])('refuses a %s key before any HTTP request', (kind) => {
  const h = fixture();
  if (kind === 'missing') rmSync(h.file); else writeFileSync(h.file, 'invalid-key');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  expect(() => createOperatorClient(h.env)).toThrow(h.file);
  expect(() => createOperatorClient(h.env)).toThrow('Run npm run seed again.');
  expect(fetch).not.toHaveBeenCalled();
});

it('returns useful one-line errors for an unreachable listener and invalid JSON', async () => {
  const h = fixture();
  const fetch = vi.fn().mockRejectedValueOnce(new Error('socket')).mockResolvedValueOnce(new Response('bad json'));
  vi.stubGlobal('fetch', fetch);
  const client = createOperatorClient(h.env);
  await expect(client.request('GET', '/accounts')).rejects.toThrow('Cannot reach the operator API at http://127.0.0.1:4321');
  await expect(client.request('GET', '/accounts')).rejects.toThrow('invalid JSON');
  expect(cliError(new OperatorApiError(400, 'INVALID_REQUEST', 'first\nsecond\r\nthird'))).toBe('first second third');
});

it.each([
  ['bootstrap.ts', ['--account', 'new-tool']],
  ['shared-platform.ts', ['--account', 'new-tool', '--profile', 'blackboard', '--client-id', 'unit-client']],
] as const)('%s exits 1 with one key-file line and leaves database bytes untouched', (entry, args) => {
  const h = fixture(); rmSync(h.file);
  const dbFile = join(h.dir, 'lti.db'); writeFileSync(dbFile, 'must remain unchanged');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(entry, import.meta.url)), ...args], {
    env: { ...process.env, ...h.env, DATA_DIR: h.dir }, encoding: 'utf8', timeout: 10_000,
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr.trim().split('\n')).toHaveLength(1);
  expect(result.stderr).toContain(h.file);
  expect(readFileSync(dbFile, 'utf8')).toBe('must remain unchanged');
});
