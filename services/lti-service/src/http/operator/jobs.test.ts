import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, expect, it, vi } from 'vitest';
import type { Db } from '../../db/index.ts';
import { openDb } from '../../db/index.ts';
import type { LtiJobRunner } from '../../jobs/index.ts';
import { createLtiJobRunner } from '../../jobs/index.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { capturingLogger, URLS } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const T0 = Date.parse('2026-10-23T10:00:00Z');
const resources: Array<{ db: Db; app: FastifyInstance; jobs: LtiJobRunner }> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const { db, app, jobs } of resources.splice(0)) { await jobs.stop(); await app.close(); db.close(); }
});

async function fixture(options: { withoutRunner?: boolean; start?: boolean } = {}) {
  const db = openDb(':memory:');
  const { logger, lines } = capturingLogger();
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  const jobs = createLtiJobRunner({ db, logger, keys, now: () => T0, env: { JOB_INSTANCE_ID: 'jobs-unit' } });
  const app = await buildOperatorApp({ db, keys, ...(options.withoutRunner ? {} : { jobs }), urls: URLS, logger, now: () => T0 });
  resources.push({ db, app, jobs });
  const { operatorKey } = issueOperatorKey(db, { operator: 'unit', expiresAt: T0 + 3600_000 }, T0);
  const headers = { authorization: `OPERATOR-AUTH-V1 ${operatorKey}` };
  if (options.start !== false) {
    jobs.start();
    await vi.waitFor(() => expect(jobs.state()).toBe('active'));
  }
  const run = (name: string) => app.inject({ method: 'POST', url: `/operator/v1/jobs/${name}/run`, headers });
  const events = () => listAuditEvents(db, { action: 'job.run', limit: 100 }).events;
  return { db, jobs, app, lines, headers, run, events };
}

it('AC-LA-E5-20-01 (unit part): lists every registered job with name, everyMs, lastRunAt (ISO or null) and lastResult', async () => {
  const h = await fixture({ start: false });
  expect((await h.app.inject('/operator/v1/jobs')).statusCode).toBe(401);
  h.db.prepare("INSERT INTO job_lease (name, owner, lease_until, last_run_at, last_result) VALUES ('retention', NULL, NULL, ?, 'ok')").run(T0 - 1000);
  const response = await h.app.inject({ url: '/operator/v1/jobs', headers: h.headers });
  expect(response.statusCode).toBe(200);
  expect(response.json().jobs).toEqual(h.jobs.jobs.map(({ name, everyMs }) => ({
    name, everyMs, lastRunAt: name === 'retention' ? new Date(T0 - 1000).toISOString() : null, lastResult: name === 'retention' ? 'ok' : null,
  })));
  expect(response.json().jobs.map((job: { name: string }) => job.name)).toContain('idempotency-cleanup');
  expect(h.events()).toEqual([]);
});

it('starts a run with the request trace id: 202 {job, traceId}, one job.run event and one job_run line', async () => {
  const h = await fixture();
  await vi.waitFor(() => expect(h.lines.filter((line) => line.event === 'job_run' && line.job === 'retention')).toHaveLength(1));
  const trigger = vi.spyOn(h.jobs, 'runNow');
  const response = await h.run('retention');
  expect(response.statusCode).toBe(202);
  const traceId = response.headers['x-trace-id'];
  expect(response.json()).toEqual({ job: 'retention', traceId });
  expect(trigger).toHaveBeenCalledWith('retention', { traceId });
  await vi.waitFor(() => expect(h.lines).toContainEqual(expect.objectContaining({ event: 'job_run', job: 'retention', trace_id: traceId, result: 'ok' })));
  expect(h.events()).toEqual([expect.objectContaining({ actor: { type: 'operator', id: 'unit' }, result: 'ok', traceId, target: { type: 'job', id: 'retention' } })]);
});

it('AC-LA-E5-20-03: a run request while the job holds its lease gives 409 JOB_RUNNING, one refused event and no run', async () => {
  const h = await fixture();
  h.db.prepare('INSERT INTO job_lease (name, owner, lease_until) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET owner = excluded.owner, lease_until = excluded.lease_until')
    .run('signing-key-cleanup', 'another/boot', T0 + 60_000);
  const trigger = vi.spyOn(h.jobs, 'runNow');
  const response = await h.run('signing-key-cleanup');
  expect([response.statusCode, response.json().details.message]).toEqual([409, 'JOB_RUNNING']);
  expect(h.events()).toEqual([expect.objectContaining({ result: 'refused', code: 'JOB_RUNNING', target: { type: 'job', id: 'signing-key-cleanup' } })]);
  expect(trigger).not.toHaveBeenCalled();
});

it('gives an unknown job 404 with one refused event that keeps no target id', async () => {
  const h = await fixture();
  const response = await h.run('person@example.test');
  expect([response.statusCode, response.json().details.message]).toEqual([404, 'NOT_FOUND']);
  expect(h.events()).toEqual([expect.objectContaining({ result: 'refused', code: 'NOT_FOUND', target: { type: 'job', id: null } })]);
  expect(JSON.stringify(h.events())).not.toContain('person@example.test');
});

it.each(['idle', 'missing'] as const)('a %s runner gives 503 NOT_READY with Retry-After and no event (BD-A2-69)', async (state) => {
  const h = await fixture({ withoutRunner: state === 'missing', start: false });
  const trigger = vi.spyOn(h.jobs, 'runNow');
  const response = await h.run('retention');
  expect(response.statusCode).toBe(503);
  expect(response.json().details).toMatchObject({ message: 'NOT_READY', reasons: ['job_runner_not_active'], retryAfter: 30 });
  expect(response.headers['retry-after']).toBe('30');
  expect(h.events()).toEqual([]);
  expect(trigger).not.toHaveBeenCalled();
  if (state === 'missing') expect((await h.app.inject({ url: '/operator/v1/jobs', headers: h.headers })).json()).toEqual({ jobs: [] });
});
