import type { JobContext } from '@cogniate/shared';
import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, expect, it } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount, updateAccount } from '../store/accounts.ts';
import { listAuditEvents } from '../store/audit.ts';
import { DAY_MS } from '../store/retention.ts';
import { createFirstToolKey, createNextToolKey, listSigningKeys, prepareToolKey } from '../store/tool-keys.ts';
import { capturingLogger } from '../testkit.ts';
import { signingKeyRotateDays, signingKeyRotationJob } from './signing-key-rotation.ts';

const T0 = Date.UTC(2026, 0, 1);
const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
const databases: Db[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

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
