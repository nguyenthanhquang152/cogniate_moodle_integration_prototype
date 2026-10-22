import type { JobRunner } from '@cogniate/shared';
import { createLocalKeyProvider, encrypt } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, expect, it, vi } from 'vitest';
import type { Db } from '../../db/index.ts';
import { openDb } from '../../db/index.ts';
import { createLtiJobRunner } from '../../jobs/index.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { legacyBlobsRefused } from '../../store/settings.ts';
import { capturingLogger, URLS } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const LEGACY = Buffer.alloc(32, 7);
const resources: Array<{ db: Db; app: FastifyInstance; jobs: JobRunner }> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const { db, app, jobs } of resources.splice(0)) { await jobs.stop(); await app.close(); db.close(); }
});

async function fixture(options: { withoutRunner?: boolean } = {}) {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'tool', name: 'Tool', appUrl: URLS.app });
  db.prepare(`INSERT INTO tool_key (kid, tool_account_id, public_jwk, private_jwk_encrypted, status, created_at)
    VALUES ('unit', 'tool', '{}', ?, 'active', ?)`).run(encrypt(LEGACY, 'unit-private-value'), T0);
  const { logger, lines } = capturingLogger();
  const keys = createLocalKeyProvider({ active: 'k2', keys: new Map([['legacy', LEGACY], ['k2', Buffer.alloc(32, 2)]]) },
    { logger, legacyBlobsRefused: () => legacyBlobsRefused(db) });
  const jobs = createLtiJobRunner({ db, logger, keys, now: () => T0, env: { JOB_INSTANCE_ID: 'key-rewrap-unit' } });
  const app = await buildOperatorApp({ db, keys, ...(options.withoutRunner ? {} : { jobs }), urls: URLS, logger, now: () => T0 });
  resources.push({ db, app, jobs });
  const { operatorKey } = issueOperatorKey(db, { operator: 'unit', expiresAt: T0 + 3600_000 }, T0);
  const headers = { authorization: `OPERATOR-AUTH-V1 ${operatorKey}` };
  const events = () => listAuditEvents(db, { action: 'key_provider.rewrap', limit: 100 }).events;
  jobs.start();
  await vi.waitFor(() => expect(jobs.state()).toBe('active'));
  return { db, keys, jobs, app, lines, headers, events };
}

it('status is operator-only and reports version counts without secret values', async () => {
  const h = await fixture();
  expect((await h.app.inject('/operator/v1/key-provider')).statusCode).toBe(401);
  const response = await h.app.inject({ url: '/operator/v1/key-provider', headers: h.headers });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ kind: 'local-keyring', activeVersion: 'k2', versions: [
    { id: 'k2', state: 'active', sealedCount: 0, derivedCount: 0 },
    { id: 'legacy', state: 'decrypt-only', sealedCount: 1, derivedCount: 0 },
  ] });
  expect(response.body).not.toContain('unit-private-value');
  expect(h.events()).toEqual([]);
});

it('starts the actual on-demand runner, returns 202, and records one request event, one completion event and one job log', async () => {
  const h = await fixture();
  const trigger = vi.spyOn(h.jobs, 'runNow');
  const response = await h.app.inject({ method: 'POST', url: '/operator/v1/key-provider/rewrap', headers: h.headers });
  expect(response.statusCode).toBe(202);
  expect(response.json()).toEqual({ job: 'key-rewrap', traceId: response.headers['x-trace-id'] });
  expect(trigger).toHaveBeenCalledWith('key-rewrap', { traceId: response.headers['x-trace-id'] });
  await vi.waitFor(() => expect(h.lines.filter((line) => line.event === 'job_run' && line.job === 'key-rewrap')).toHaveLength(1));
  const run = h.lines.find((line) => line.event === 'job_run' && line.job === 'key-rewrap')!;
  expect(run).toMatchObject({ result: 'ok', counts: { rewrapped: 1, skippedChanged: 0, notReached: 0, unreadable: 0 } });
  expect(h.events()).toHaveLength(2);
  expect(h.events()).toEqual(expect.arrayContaining([
    expect.objectContaining({ actor: { type: 'operator', id: 'unit' }, result: 'ok', traceId: response.headers['x-trace-id'] }),
    expect.objectContaining({ actor: { type: 'system', id: 'key-rewrap' }, result: 'ok', code: null, traceId: run.trace_id,
      details: { outcome: 'complete', rewrapped: 1, skippedChanged: 0, notReached: 0, unreadable: 0, legacyBlobsRefused: true } }),
  ]));
  expect(legacyBlobsRefused(h.db)).toBe(true);
  const status = await h.app.inject({ url: '/operator/v1/key-provider', headers: h.headers });
  expect(status.json().versions).toEqual([
    { id: 'k2', state: 'active', sealedCount: 1, derivedCount: 0 },
    { id: 'legacy', state: 'decrypt-only', sealedCount: 0, derivedCount: 0 },
  ]);
  expect(JSON.stringify({ events: h.events(), logs: h.lines })).not.toContain('unit-private-value');
});

it.each(['idle', 'waiting', 'stopping', 'off', 'missing'] as const)('BD-A2-50: a %s runner gives 503, Retry-After, and no event', async (state) => {
  const h = await fixture({ withoutRunner: state === 'missing' });
  if (state !== 'missing') vi.spyOn(h.jobs, 'state').mockReturnValue(state);
  const run = vi.spyOn(h.jobs, 'runNow');
  const response = await h.app.inject({ method: 'POST', url: '/operator/v1/key-provider/rewrap', headers: h.headers });
  expect(response.statusCode).toBe(503);
  expect(response.json().details).toMatchObject({ message: 'NOT_READY', reasons: ['job_runner_not_active'], retryAfter: 30 });
  expect(response.headers['retry-after']).toBe('30');
  expect(h.events()).toEqual([]);
  expect(run).not.toHaveBeenCalled();
});

it.each(['same', 'another'])('BD-A2-50: a live lease of the %s owner gives one refused event and no second run', async (owner) => {
  const h = await fixture();
  h.db.prepare('INSERT INTO job_lease (name, owner, lease_until) VALUES (?, ?, ?)')
    .run('key-rewrap', owner === 'same' ? h.jobs.leaseOwner : 'another/boot', T0 + 60_000);
  const run = vi.spyOn(h.jobs, 'runNow');
  const response = await h.app.inject({ method: 'POST', url: '/operator/v1/key-provider/rewrap', headers: h.headers });
  expect([response.statusCode, response.json().details.message]).toEqual([409, 'JOB_RUNNING']);
  expect(h.events()).toEqual([expect.objectContaining({ action: 'key_provider.rewrap', result: 'refused', code: 'JOB_RUNNING',
    traceId: response.headers['x-trace-id'], actor: { type: 'operator', id: 'unit' } })]);
  expect(run).not.toHaveBeenCalled();
});

it.each(['expired', 'unowned'] as const)('BD-A2-50: an %s lease permits a new run', async (kind) => {
  const h = await fixture();
  h.db.prepare('INSERT INTO job_lease (name, owner, lease_until) VALUES (?, ?, ?)')
    .run('key-rewrap', kind === 'expired' ? 'another/boot' : null, kind === 'expired' ? T0 : T0 + 60_000);
  const response = await h.app.inject({ method: 'POST', url: '/operator/v1/key-provider/rewrap', headers: h.headers });
  expect(response.statusCode).toBe(202);
  await vi.waitFor(() => expect(h.events()).toHaveLength(2));
  expect(h.events().every((event) => event.result === 'ok')).toBe(true);
});

it('a failed run logs failed while its audit event records outcome failed with result ok', async () => {
  const h = await fixture();
  h.db.prepare("UPDATE tool_key SET private_jwk_encrypted = ? WHERE kid = 'unit'").run(Buffer.from('broken fixture'));
  expect((await h.app.inject({ method: 'POST', url: '/operator/v1/key-provider/rewrap', headers: h.headers })).statusCode).toBe(202);
  await vi.waitFor(() => expect(h.lines).toContainEqual(expect.objectContaining({ event: 'job_run', job: 'key-rewrap', result: 'failed' })));
  expect(h.events()).toHaveLength(2);
  expect(h.events()).toContainEqual(expect.objectContaining({ actor: { type: 'system', id: 'key-rewrap' }, result: 'ok', code: null,
    details: { outcome: 'failed', rewrapped: 0, skippedChanged: 0, notReached: 0, unreadable: 1, unreadableVersions: ['legacy'] } }));
  expect(legacyBlobsRefused(h.db)).toBe(false);
});

it('authentication or request-audit failure never starts the job', async () => {
  const h = await fixture();
  const run = vi.spyOn(h.jobs, 'runNow');
  expect((await h.app.inject({ method: 'POST', url: '/operator/v1/key-provider/rewrap' })).statusCode).toBe(401);
  expect(run).not.toHaveBeenCalled();
  h.db.exec("CREATE TRIGGER fail_rewrap_request BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'unit fault'); END");
  expect((await h.app.inject({ method: 'POST', url: '/operator/v1/key-provider/rewrap', headers: h.headers })).statusCode).toBe(500);
  expect(run).not.toHaveBeenCalled();
  expect(h.events()).toEqual([]);
  expect(legacyBlobsRefused(h.db)).toBe(false);
});
