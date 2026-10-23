import type { JobContext } from '@cogniate/shared';
import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount, updateAccount } from '../store/accounts.ts';
import { listAuditEvents } from '../store/audit.ts';
import { DAY_MS } from '../store/retention.ts';
import * as toolKeys from '../store/tool-keys.ts';
import { createFirstToolKey, createNextToolKey, listSigningKeys, prepareToolKey } from '../store/tool-keys.ts';
import { capturingLogger } from '../testkit.ts';
import { signingKeyRotateDays, signingKeyRotationJob } from './signing-key-rotation.ts';

const T0 = Date.UTC(2026, 0, 1);
const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
const databases: Db[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });

async function fixture() {
  const db = openDb(':memory:'); databases.push(db);
  for (const id of ['auto', 'manual', 'paused']) {
    ensureAccount(db, { id, appUrl: 'https://app.test' });
    createFirstToolKey(db, await prepareToolKey(keys, id), T0);
  }
  updateAccount(db, 'auto', { autoRotate: true }, T0);
  updateAccount(db, 'paused', { autoRotate: true, status: 'suspended' }, T0);
  const { logger, lines } = capturingLogger();
  const job = signingKeyRotationJob(db, keys, { rotateDays: 90, publishLeadSeconds: 86_400 });
  const runAt = (day: number) => job.run({ instanceId: 'lti-1', bootId: 'test', leaseOwner: 'lti-1/test', traceId: `rotation-day-${day}`,
    now: () => T0 + day * DAY_MS, logger, signal: new AbortController().signal } satisfies JobContext);
  const states = (id: string) => listSigningKeys(db, id).map((key) => key.status);
  return { db, job, runAt, states, lines };
}

it('AC-LA-E5-20-05: makes a next key at day 83 and activates it at day 90; manual and suspended accounts get no new key', async () => {
  const h = await fixture();
  expect([h.job.name, h.job.everyMs, h.job.runAtStart]).toEqual(['signing-key-rotation', DAY_MS, true]);
  const first = listSigningKeys(h.db, 'auto')[0]!.kid;
  expect(await h.runAt(82)).toEqual({ result: 'ok', counts: { created: 0, activated: 0, failed: 0 } });
  expect(h.states('auto')).toEqual(['active']);
  expect(await h.runAt(83)).toEqual({ result: 'ok', counts: { created: 1, activated: 0, failed: 0 } });
  expect(h.states('auto')).toEqual(['active', 'next']);
  const next = listSigningKeys(h.db, 'auto').find((key) => key.status === 'next')!;
  expect(next.publishedAt).toBe(T0 + 83 * DAY_MS);
  expect((await h.runAt(89)).counts).toEqual({ created: 0, activated: 0, failed: 0 });
  expect(await h.runAt(90)).toEqual({ result: 'ok', counts: { created: 0, activated: 1, failed: 0 } });
  expect(listSigningKeys(h.db, 'auto').map(({ kid, status }) => ({ kid, status }))).toEqual([{ kid: next.kid, status: 'active' }, { kid: first, status: 'retired' }]);
  for (const id of ['manual', 'paused']) expect(h.states(id)).toEqual(['active']);
  const events = listAuditEvents(h.db, { toolAccountId: 'auto', limit: 10 }).events;
  expect(events.map(({ action, actor, traceId, result, target, details }) => ({ action, actor, traceId, result, target, details }))).toEqual([
    { action: 'signing_key.activate', actor: { type: 'system', id: 'signing-key-rotation' }, traceId: 'rotation-day-90', result: 'ok',
      target: { type: 'signing_key', id: next.kid }, details: { forced: false, retired: first } },
    { action: 'signing_key.create', actor: { type: 'system', id: 'signing-key-rotation' }, traceId: 'rotation-day-83', result: 'ok',
      target: { type: 'signing_key', id: next.kid }, details: { status: 'next' } },
  ]);
  expect(h.lines).toContainEqual(expect.objectContaining({ event: 'signing_key_changed', tool_account_id: 'auto', kid: first, status: 'retired', trace_id: 'rotation-day-90' }));
});

it('never activates before the publish lead time, also at the rotation age', async () => {
  const h = await fixture();
  // An operator published a next key late, at day 89.5: the job waits for 24 hours after it.
  createNextToolKey(h.db, await prepareToolKey(keys, 'auto'), T0 + 89.5 * DAY_MS);
  expect((await h.runAt(90)).counts).toEqual({ created: 0, activated: 0, failed: 0 });
  expect(h.states('auto')).toEqual(['active', 'next']);
  expect((await h.runAt(90.5)).counts).toEqual({ created: 0, activated: 1, failed: 0 });
});

it('reads SIGNING_KEY_ROTATE_DAYS as a whole number of at least 8 days (default 90)', () => {
  expect(signingKeyRotateDays(undefined)).toBe(90);
  expect(signingKeyRotateDays('8')).toBe(8);
  for (const value of ['', '7', '0', '-1', '8.5', 'ninety', '999999999999999999']) expect(() => signingKeyRotateDays(value)).toThrow('SIGNING_KEY_ROTATE_DAYS');
});

/** A controlled clock, and a hook that runs during the async key preparation of the job (after the real preparation). */
async function changingFixture(publishLeadSeconds: number, ids: string[]) {
  const db = openDb(':memory:'); databases.push(db);
  for (const id of ids) {
    ensureAccount(db, { id, appUrl: 'https://app.test' });
    createFirstToolKey(db, await prepareToolKey(keys, id), T0);
    updateAccount(db, id, { autoRotate: true }, T0);
  }
  const clock = { now: T0 + 90 * DAY_MS };
  const during: Array<(accountId: string) => void> = [];
  const prepare = toolKeys.prepareToolKey;
  vi.spyOn(toolKeys, 'prepareToolKey').mockImplementation(async (handle, accountId) => {
    const prepared = await prepare(handle, accountId);
    for (const hook of during) hook(accountId);
    return prepared;
  });
  const job = signingKeyRotationJob(db, keys, { rotateDays: 90, publishLeadSeconds });
  const run = () => job.run({ instanceId: 'lti-1', bootId: 'test', leaseOwner: 'lti-1/test', traceId: 'rotation-change',
    now: () => clock.now, logger: capturingLogger().logger, signal: new AbortController().signal } satisfies JobContext);
  const states = (id: string) => listSigningKeys(db, id).map((key) => key.status);
  const events = (id: string) => listAuditEvents(db, { toolAccountId: id, limit: 10 }).events.filter((event) => event.action.startsWith('signing_key.'));
  return { db, clock, during, run, states, events };
}

it('A-LA-E5-20-01: published_at is the time of the real key write, so activation waits the full lead time after it', async () => {
  const h = await changingFixture(600, ['tool']);
  const start = h.clock.now;
  // The preparation (RSA generation and sealing) takes one second.
  h.during.push(() => { h.clock.now += 1000; });
  expect((await h.run()).counts).toEqual({ created: 1, activated: 0, failed: 0 });
  const next = listSigningKeys(h.db, 'tool').find((key) => key.status === 'next')!;
  expect(next.publishedAt).toBe(start + 1000);
  h.clock.now = next.publishedAt + 599_999;
  expect((await h.run()).counts).toEqual({ created: 0, activated: 0, failed: 0 });
  expect(h.states('tool')).toEqual(['active', 'next']);
  h.clock.now = next.publishedAt + 600_000;
  expect((await h.run()).counts).toEqual({ created: 0, activated: 1, failed: 0 });
  expect(listSigningKeys(h.db, 'tool')[0]).toMatchObject({ kid: next.kid, status: 'active', activatedAt: next.publishedAt + 600_000 });
});

it.each([
  ['autoRotate false', { autoRotate: false }],
  ['suspended', { status: 'suspended' as const }],
])('A-LA-E5-20-02: an account set to %s during the run gets no activation and no event', async (_name, patch) => {
  const h = await changingFixture(86_400, ['a-first', 'b-second']);
  // b-second already has a mature next key; a-first's preparation is where the operator change lands.
  createNextToolKey(h.db, await prepareToolKey(keys, 'b-second'), T0 + 80 * DAY_MS);
  h.during.push((accountId) => { if (accountId === 'a-first') updateAccount(h.db, 'b-second', patch, h.clock.now); });
  expect((await h.run()).counts).toEqual({ created: 1, activated: 0, failed: 0 });
  expect(h.states('b-second')).toEqual(['active', 'next']);
  expect(h.events('b-second')).toEqual([]);
});

it.each([
  ['autoRotate false', { autoRotate: false }],
  ['suspended', { status: 'suspended' as const }],
])('A-LA-E5-20-02: an account set to %s during its own key preparation gets no next key and no event', async (_name, patch) => {
  const h = await changingFixture(86_400, ['tool']);
  h.during.push((accountId) => updateAccount(h.db, accountId, patch, h.clock.now));
  expect(await h.run()).toEqual({ result: 'ok', counts: { created: 0, activated: 0, failed: 0 } });
  expect(h.states('tool')).toEqual(['active']);
  expect(h.events('tool')).toEqual([]);
});
