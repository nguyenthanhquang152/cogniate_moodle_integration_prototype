import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../../db/index.ts';
import { DEFAULT_CLAIM_POLICY, ensureAccount, getAccount } from '../../store/accounts.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { initOperatorKey } from '../../store/operator-keys.ts';
import { activePrivateJwk, publicJwks } from '../../store/tool-keys.ts';
import { URLS, capturingLogger } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const input = (id: string) => ({ id, name: id, launchUrl: 'https://tool.test/launch', deepLinkingUrl: 'https://tool.test/deep', registrationUrl: 'https://tool.test/register' });
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); vi.restoreAllMocks(); });
async function fixture() {
  const db = openDb(':memory:');
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  const issued = initOperatorKey(db, { operator: 'test-op', mode: 'refuse' }, T0);
  if (issued.result !== 'issued') throw new Error('fixture');
  const { logger, lines } = capturingLogger();
  const clock = { now: T0 };
  const app = await buildOperatorApp({ db, keys, urls: URLS, simulationProfiles: true, logger, now: () => clock.now });
  cleanup.push(async () => { await app.close(); db.close(); });
  const headers = { authorization: `OPERATOR-AUTH-V1 ${issued.operatorKey}` };
  const events = () => listAuditEvents(db, { limit: 100 }).events.filter((e) => e.action.startsWith('account.'));
  const create = (id: string) => app.inject({ method: 'POST', url: '/operator/v1/accounts', headers, payload: input(id) });
  const patch = (id: string, payload: object) => app.inject({ method: 'PATCH', url: `/operator/v1/accounts/${id}`, headers, payload });
  return { db, keys, clock, app, lines, headers, events, create, patch };
}

it('creates a private-by-default account, its active key, and exactly one audit event; conflicts do no key work', async () => {
  const h = await fixture();
  const seal = vi.spyOn(h.keys, 'seal');
  for (const id of ['one', 'two']) {
    const response = await h.create(id);
    expect(response.statusCode).toBe(201);
    const account = response.json();
    expect(account).toMatchObject({ ...input(id), status: 'active', publicBaseUrl: null, limits: null, claimPolicy: DEFAULT_CLAIM_POLICY,
      createdAt: new Date(T0).toISOString(), statusChangedAt: new Date(T0).toISOString() });
    expect(account.protocolUrls.launch).toBe(`${URLS.lti}/lti/launch/${id}`);
    expect(Object.keys(account).some((key) => /apiKey|hash|private/i.test(key))).toBe(false);
    const key = publicJwks(h.db, id)[0]!;
    expect(activePrivateJwk(h.db, h.keys, id)?.kid).toBe(key.kid);
    expect(h.events().filter((e) => e.toolAccountId === id)).toEqual([expect.objectContaining({ action: 'account.create', result: 'ok',
      actor: { type: 'operator', id: 'test-op' }, target: { type: 'account', id }, details: { fields: Object.keys(input(id)), kid: key.kid } })]);
  }
  expect((await h.create('one')).statusCode).toBe(409);
  expect(seal).toHaveBeenCalledTimes(2);
  expect(h.events().filter((e) => e.result === 'refused')[0]?.code).toBe('ACCOUNT_ALREADY_EXISTS');
});

it('prepares outside the transaction and rolls back account and first key when the audit insert fails', async () => {
  const h = await fixture();
  const seal = h.keys.seal;
  vi.spyOn(h.keys, 'seal').mockImplementation(async (...args) => {
    expect(h.db.isTransaction).toBe(false);
    return seal(...args);
  });
  h.db.exec("CREATE TRIGGER fail_account_audit BEFORE INSERT ON audit_event WHEN NEW.action = 'account.create' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
  expect((await h.create('one')).statusCode).toBe(500);
  expect(getAccount(h.db, 'one')).toBeNull();
  expect(publicJwks(h.db, 'one')).toEqual([]);
  expect(h.events()).toEqual([]);
});

it('keeps account creation authoritative across async key preparation', async () => {
  const h = await fixture();
  const responses = await Promise.all([h.create('race'), h.create('race')]);
  expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  expect(publicJwks(h.db, 'race')).toHaveLength(1);
  expect(h.events().map((e) => e.result).sort()).toEqual(['ok', 'refused']);
});

it('a failed key preparation leaves no account or successful audit', async () => {
  const h = await fixture();
  vi.spyOn(h.keys, 'seal').mockRejectedValue(new Error('fixture key failure'));
  expect((await h.create('one')).statusCode).toBe(500);
  expect(getAccount(h.db, 'one')).toBeNull();
  expect(h.events()).toEqual([]);
});

it('lists in stable pages, filters status, reads without auditing, and refuses unknown accounts', async () => {
  const h = await fixture();
  for (const id of ['c', 'a', 'b']) ensureAccount(h.db, { id, name: id, appUrl: URLS.app });
  await h.patch('b', { status: 'suspended' });
  const read = (url: string) => h.app.inject({ url, headers: h.headers });
  const first = (await read('/operator/v1/accounts?limit=2')).json();
  expect(first.accounts.map((a: { id: string }) => a.id)).toEqual(['a', 'b']);
  const second = (await read(`/operator/v1/accounts?limit=2&cursor=${first.next}`)).json();
  expect(second.accounts.map((a: { id: string }) => a.id)).toEqual(['c']);
  expect(second.next).toBeUndefined();
  expect((await read('/operator/v1/accounts?status=suspended')).json().accounts.map((a: { id: string }) => a.id)).toEqual(['b']);
  expect((await read('/operator/v1/accounts/a')).json().id).toBe('a');
  expect((await read('/operator/v1/accounts/missing')).statusCode).toBe(404);
  for (const query of ['limit=101', 'limit=0', 'cursor=../x', 'status=bad']) expect((await read(`/operator/v1/accounts?${query}`)).statusCode).toBe(400);
  expect(h.events()).toHaveLength(1);
});

it('stores settings and audits status transitions separately from field updates; close is final', async () => {
  const h = await fixture();
  ensureAccount(h.db, { id: 'one', name: 'One', appUrl: URLS.app });
  h.clock.now += 100;
  const policy = { mode: 'allowlist', keep: { names: false, email: true, custom: false, lis: false } };
  const response = await h.patch('one', { name: 'Renamed', claimPolicy: policy, limits: { api: { ratePerMinute: 5, burst: 5 } }, serviceKeyWriteScope: 'resource-link', launchUrl: 'https://tool-b.test/launch' });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ name: 'Renamed', claimPolicy: policy, limits: { api: { ratePerMinute: 5, burst: 5 } }, serviceKeyWriteScope: 'resource-link' });
  expect((await h.patch('one', { status: 'suspended', name: 'Paused' })).statusCode).toBe(200);
  expect(h.events().map((e) => e.action).sort()).toEqual(['account.status', 'account.update']);
  expect((await h.patch('one', { limits: null, claimPolicy: null })).json()).toMatchObject({ limits: null, claimPolicy: null });
  expect((await h.patch('one', { status: 'closed' })).statusCode).toBe(200);
  for (const body of [{ status: 'active' }, { name: 'New' }, {}]) {
    const denied = await h.patch('one', body);
    expect([denied.statusCode, denied.json().details.message]).toEqual([409, 'ACCOUNT_CLOSED']);
  }
});

describe('account field validation is atomic', () => {
  for (const field of ['launchUrl', 'deepLinkingUrl', 'registrationUrl']) {
    it.each(['http://x.test', 'https://u:p@x.test/a', 'https://x.test/a#f', 'https://x.test/a#', URLS.content, `${URLS.lti}:8443/a`, 'https://content.cogniate-content.test./a'])(`rejects ${field}=%s without a change`, async (url) => {
        const h = await fixture();
        const { account } = ensureAccount(h.db, { id: 'one', name: 'One', appUrl: URLS.app });
        const response = await h.patch('one', { [field]: url, name: 'Changed' });
        expect([response.statusCode, response.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
        expect(response.json().details.description).toContain(field);
        expect(getAccount(h.db, 'one')).toEqual(account);
        expect(h.events()).toEqual([expect.objectContaining({ result: 'refused', code: 'INVALID_REQUEST' })]);
      });
  }
  it.each([
    ['publicBaseUrl', 'https://tenant.test'], ['claimPolicy', { mode: 'unknown' }],
    ['claimPolicy', { mode: 'allowlist', keep: { names: true } }], ['limits', { unknown: { ratePerMinute: 1, burst: 1 } }],
    ['limits', { api: { ratePerMinute: 0, burst: 1 } }], ['limits', { api: { ratePerMinute: 1, burst: 1.5 } }], ['serviceKeyWriteScope', 'all'],
  ])('rejects malformed %s', async (field, value) => {
    const h = await fixture();
    ensureAccount(h.db, { id: 'one', name: 'One', appUrl: URLS.app });
    const response = await h.patch('one', { [field as string]: value });
    expect(response.statusCode).toBe(400);
    expect(response.json().details.description).toContain(field);
  });
});


it('chooses the PATCH audit action from the state locked by its change transaction', async () => {
  const h = await fixture();
  await h.create('one');
  const exec = h.db.exec.bind(h.db);
  let changed = false;
  vi.spyOn(h.db, 'exec').mockImplementation((sql) => {
    if (!changed && sql === 'BEGIN IMMEDIATE') {
      changed = true;
      // Another connection committed the requested status before this request acquired its write lock.
      exec("UPDATE tool_account SET status = 'suspended', status_changed_at = 123 WHERE id = 'one'");
    }
    return exec(sql);
  });
  const response = await h.patch('one', { status: 'suspended' });
  expect(response.statusCode).toBe(200);
  expect(changed).toBe(true);
  expect(getAccount(h.db, 'one')?.statusChangedAt).toBe(123);
  expect(h.events().filter((e) => e.action !== 'account.create')).toEqual([
    expect.objectContaining({ action: 'account.update', result: 'ok', details: { fields: ['status'] } }),
  ]);
});
