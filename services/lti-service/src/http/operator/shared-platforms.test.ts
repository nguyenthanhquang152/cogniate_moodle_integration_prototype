import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, expect, it } from 'vitest';
import { openDb } from '../../db/index.ts';
import { ensureAccount, updateAccount } from '../../store/accounts.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { initOperatorKey } from '../../store/operator-keys.ts';
import { listPlatforms } from '../../store/platforms.ts';
import { URLS, capturingLogger } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
async function fixture(simulationProfiles = true) {
  const db = openDb(':memory:');
  const now = Date.now();
  const operator = initOperatorKey(db, { operator: 'op', mode: 'refuse' }, now);
  if (operator.result !== 'issued') throw new Error('fixture');
  for (const id of ['one', 'two']) ensureAccount(db, { id, name: id, appUrl: URLS.app });
  const app = await buildOperatorApp({ db, keys: createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7))), urls: URLS,
    simulationProfiles, logger: capturingLogger().logger });
  cleanup.push(async () => { await app.close(); db.close(); });
  const call = (account = 'one', payload: object = { profile: 'blackboard-sim', clientId: 'app-id' }) => app.inject({
    method: 'POST', url: `/operator/v1/accounts/${account}/shared-platforms`, headers: { authorization: `OPERATOR-AUTH-V1 ${operator.operatorKey}` }, payload,
  });
  const events = () => listAuditEvents(db, { action: 'platform.create_shared', limit: 100 }).events;
  return { db, call, events };
}

it('provisions per account, returns the same platform on retry, and audits each request once', async () => {
  const h = await fixture();
  const first = await h.call();
  expect(first.statusCode).toBe(201);
  expect(first.json()).toMatchObject({ profile: 'blackboard-sim', clientId: 'app-id', active: true, deploymentIds: [] });
  const repeat = await h.call();
  expect(repeat.statusCode).toBe(200);
  expect(repeat.json()).toEqual(first.json());
  const conflict = await h.call('one', { profile: 'blackboard-sim', clientId: 'another-id' });
  expect([conflict.statusCode, conflict.json().details.message]).toEqual([409, 'SHARED_PLATFORM_EXISTS']);
  const other = await h.call('two');
  expect(other.statusCode).toBe(201);
  expect(other.json().id).not.toBe(first.json().id);
  expect(h.events()).toHaveLength(4);
  expect(h.events().filter((e) => e.result === 'ok').map((e) => e.target.id).sort()).toEqual([first.json().id, first.json().id, other.json().id].sort());
  expect(listPlatforms(h.db, 'one')).toHaveLength(1);
  expect(listPlatforms(h.db, 'two')).toHaveLength(1);
});

it('refuses unknown accounts, wrong profiles and malformed input without a platform', async () => {
  const h = await fixture(false);
  expect((await h.call('missing')).statusCode).toBe(404);
  expect((await h.call()).json().details.message).toBe('UNKNOWN_PROFILE');
  for (const payload of [{ profile: 'standard', clientId: 'a' }, { profile: 'blackboard', clientId: 'has space' }]) {
    expect((await h.call('one', payload)).statusCode).toBe(400);
  }
  expect(listPlatforms(h.db, 'one')).toEqual([]);
  expect(h.events().every((e) => e.result === 'refused')).toBe(true);
});

it('rolls back the platform if the audit insert fails', async () => {
  const h = await fixture();
  h.db.exec("CREATE TRIGGER fail_platform_audit BEFORE INSERT ON audit_event WHEN NEW.action = 'platform.create_shared' BEGIN SELECT RAISE(ABORT, 'audit failed'); END");
  expect((await h.call()).statusCode).toBe(500);
  expect(listPlatforms(h.db, 'one')).toEqual([]);
  expect(h.events()).toEqual([]);
});

it('BD-A2-12: unknown and closed accounts take priority over body errors and write a refusal', async () => {
  const h = await fixture();
  expect((await h.call('missing', {})).json().details.message).toBe('NOT_FOUND');
  updateAccount(h.db, 'one', { status: 'closed' }, Date.now());
  const denied = await h.call('one', {});
  expect([denied.statusCode, denied.json().details.message]).toEqual([409, 'ACCOUNT_CLOSED']);
  expect(h.events()).toContainEqual(expect.objectContaining({ result: 'refused', code: 'ACCOUNT_CLOSED', toolAccountId: 'one' }));
  expect(listPlatforms(h.db, 'one')).toEqual([]);
});
