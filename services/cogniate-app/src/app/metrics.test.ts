import type { AddressInfo } from 'node:net';
import { ConfigRefusedError, createLogger, type JobContext, type LogLine } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../domain/db.ts';
import { observeDispatchSends } from '../kernel/records/outbox.ts';
import { registerRecordReporters } from '../kernel/records/records.ts';
import { recordsFixture, seedBase, testReporter } from '../kernel/records/records.testkit.ts';
import { TEST_CHANNELS } from '../testkit.ts';
import { AppMetrics, OPENMETRICS_TYPE, buildOperatorListener, operatorListenerConfig, readiness } from './metrics.ts';

const FAMILIES = ['app_dispatch_rows', 'app_dispatch_oldest_pending_seconds', 'app_dispatch_sends', 'app_launch_refusals',
  'app_grant_redemptions', 'app_grant_compensation_failures', 'app_job_runs', 'app_job_last_success_timestamp_seconds'];
const closers: Array<() => unknown> = [];
afterEach(async () => { for (const close of closers.splice(0).reverse()) await close(); vi.useRealTimers(); });

/** The value of one sample line, or undefined when the series is absent. */
function value(text: string, series: string): number | undefined {
  const line = text.split('\n').find((l) => l.startsWith(`${series} `));
  return line === undefined ? undefined : Number(line.slice(series.length + 1));
}

function memoryDb() {
  const db = openDb(':memory:');
  closers.push(() => db.close());
  seedBase(db);
  return db;
}

describe('operator listener settings (LA-E4-07)', () => {
  it('AC-LA-E4-07-01: the default settings bind 127.0.0.1:4210 only', async () => {
    expect(operatorListenerConfig({})).toEqual({ host: '127.0.0.1', port: 4210 });
    const db = memoryDb();
    const app = buildOperatorListener({ db, metrics: new AppMetrics(db) });
    closers.push(() => app.close());
    // The default host with a free port: the test checks the address that the socket is bound to.
    const { host } = operatorListenerConfig({ OPERATOR_PORT: '0' });
    await app.listen({ host, port: 0 });
    expect(app.server.address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' } satisfies Partial<AddressInfo>);
  });

  it('BD-A2-88: production refuses a host that is not loopback with the LTI service reason and text; acceptance may bind the network', () => {
    const refusal = (() => { try { operatorListenerConfig({ STACK_PROFILE: 'production', OPERATOR_HOST: '0.0.0.0' }); } catch (err) { return err; } })();
    expect(refusal).toBeInstanceOf(ConfigRefusedError);
    expect(refusal).toMatchObject({ reason: 'operator_bind_not_loopback', setting: undefined,
      message: 'Production allows the operator listener on loopback only. Set OPERATOR_HOST to 127.0.0.1 or ::1, then start the service again.' });
    expect(operatorListenerConfig({ STACK_PROFILE: 'production', OPERATOR_HOST: '::1', OPERATOR_PORT: '4300' })).toEqual({ host: '::1', port: 4300 });
    expect(operatorListenerConfig({ STACK_PROFILE: 'acceptance', OPERATOR_HOST: '0.0.0.0' })).toEqual({ host: '0.0.0.0', port: 4210 });
    expect(() => operatorListenerConfig({ OPERATOR_PORT: 'x' })).toThrow('OPERATOR_PORT must be a port number, got "x"');
  });
});

describe('GET /readyz (BD-A2-88: the app only)', () => {
  it('answers 200 when the database and every migration are in place, else 503 with the reason', async () => {
    const db = memoryDb();
    const app = buildOperatorListener({ db, metrics: new AppMetrics(db) });
    closers.push(() => app.close());
    const ready = await app.inject({ method: 'GET', url: '/readyz' });
    expect([ready.statusCode, ready.headers['cache-control'], ready.json()]).toEqual([200, 'no-store', { status: 'ready' }]);
    db.exec("UPDATE schema_migration SET sha256 = 'changed' WHERE name = '014_learning_records.sql'");
    expect(readiness(db)).toEqual(['migrations']);
    const changed = await app.inject({ method: 'GET', url: '/readyz' });
    expect([changed.statusCode, changed.json()]).toEqual([503, { status: 'not_ready', reasons: ['migrations'] }]);
    const closed = openDb(':memory:');
    closed.close();
    expect(readiness(closed)).toEqual(['database']);
  });
});

describe('GET /metrics', () => {
  it('AC-LA-E4-07-02 (unit side): one OpenMetrics answer has the eight app families and ends with # EOF', async () => {
    const db = memoryDb();
    const app = buildOperatorListener({ db, metrics: new AppMetrics(db) });
    closers.push(() => app.close());
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect([res.statusCode, res.headers['content-type'], res.headers['cache-control']]).toEqual([200, OPENMETRICS_TYPE, 'no-store']);
    for (const name of FAMILIES) expect(res.body).toContain(`# TYPE ${name} `);
    expect(res.body.endsWith('# EOF\n')).toBe(true);
    // Store series that always have an accurate source; a fresh process has no send, refusal or job series.
    expect(value(res.body, 'app_grant_redemptions_total{result="committed"}')).toBe(0);
    expect(value(res.body, 'app_grant_compensation_failures_total')).toBe(0);
    expect(res.body).not.toMatch(/^app_(dispatch_sends|launch_refusals|job_runs)_total/m);
    expect(res.body).not.toMatch(/^app_job_last_success/m);
  });

  it('dispatch rows and the oldest pending row come from the store at scrape time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(100_000);
    const f = recordsFixture(); closers.push(() => f.close());
    registerRecordReporters(f.db, [testReporter(async () => null)]);
    const old = await f.addRow({ key: 'a', partition: 'p', score: 0.5, nextTryAt: 0 });
    await f.addRow({ key: 'b', partition: 'p', score: 0.5, nextTryAt: 0 });
    await f.addRow({ key: 'c', partition: 'p', score: 0.5, nextTryAt: 0 });
    f.db.prepare("UPDATE record_dispatch SET status = 'sent' WHERE learner_subject = 'c'").run();
    f.db.prepare('UPDATE record_dispatch SET created_at = 40000 WHERE id = ?').run(old);
    const text = new AppMetrics(f.db).render();
    expect(value(text, 'app_dispatch_rows{reporter="lti-ags",status="pending"}')).toBe(2);
    expect(value(text, 'app_dispatch_rows{reporter="lti-ags",status="sent"}')).toBe(1);
    expect(value(text, 'app_dispatch_oldest_pending_seconds{reporter="lti-ags"}')).toBe(60);
    // A resend starts a new retry window; with no pending row the registered reporter shows 0.
    f.db.prepare('UPDATE record_dispatch SET resent_at = 90000 WHERE id = ?').run(old);
    expect(value(new AppMetrics(f.db).render(), 'app_dispatch_oldest_pending_seconds{reporter="lti-ags"}')).toBe(10);
    f.db.prepare("UPDATE record_dispatch SET status = 'failed'").run();
    expect(value(new AppMetrics(f.db).render(), 'app_dispatch_oldest_pending_seconds{reporter="lti-ags"}')).toBe(0);
  });

  it('AC-LA-E4-07-03 (unit side): a recorded delivery outcome counts once, after its commit; a lost lease counts nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(100_000);
    const f = recordsFixture(); closers.push(() => f.close());
    let steal = false;
    const job = registerRecordReporters(f.db, [testReporter(async (row, ctx) => {
      if (ctx.beginSend() !== 'started') return null;
      if (steal) f.db.prepare('UPDATE record_dispatch SET lease_owner = ? WHERE id = ?').run('b/boot', row.id);
      return { kind: 'accepted' };
    })]);
    const metrics = new AppMetrics(f.db);
    const inTransaction: boolean[] = [];
    // A second observer on the same database records whether each call comes after the commit.
    observeDispatchSends(f.db, () => inTransaction.push(f.db.isTransaction));
    metrics.countSends();
    const ctx: JobContext = { instanceId: 'a', bootId: 'boot', leaseOwner: 'a/boot', now: Date.now, traceId: 't',
      signal: new AbortController().signal, logger: createLogger({ service: 'x', write: () => {} }) };
    const run = async () => {
      const [item] = await job.due(Date.now(), 10);
      await job.lease(item!, 'a/boot', Date.now() + 60_000, Date.now());
      await job.run(item!, ctx);
    };
    expect(value(metrics.render(), 'app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"}')).toBe(0);
    await f.addRow({ key: 'a', partition: 'p', score: 0.5, nextTryAt: 0 });
    await run();
    let text = metrics.render();
    expect(value(text, 'app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"}')).toBe(1);
    expect(value(text, 'app_dispatch_sends_total{reporter="lti-ags",outcome="throttled"}')).toBe(0);
    expect(inTransaction).toEqual([false]);
    steal = true;
    await f.addRow({ key: 'b', partition: 'p', score: 0.5, nextTryAt: 0 });
    await run();
    text = metrics.render();
    expect(value(text, 'app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"}')).toBe(1);
    expect(inTransaction).toEqual([false]);
  });

  it('AC-LA-E4-07-04 (unit side), AC-LA-E4-07-06 (unit side): launch refusals keep only code values as labels', () => {
    const db = memoryDb();
    const metrics = new AppMetrics(db);
    metrics.useChannels(TEST_CHANNELS);
    const channel = TEST_CHANNELS.channels()[0]!.id;
    metrics.launchRefused('deployment_not_approved', channel);
    metrics.launchRefused('deployment_not_approved', channel);
    metrics.launchRefused('site_mismatch', 'https://school.test/lib');
    metrics.launchRefused('Learner user-42@school', channel);
    const text = metrics.render();
    expect(value(text, `app_launch_refusals_total{reason="deployment_not_approved",channel="${channel}"}`)).toBe(2);
    expect(value(text, 'app_launch_refusals_total{reason="site_mismatch",channel=""}')).toBe(1);
    expect(value(text, `app_launch_refusals_total{reason="other",channel="${channel}"}`)).toBe(1);
    expect(text).not.toMatch(/school|user-42|lib"/);
  });

  it('grant redemptions count ended attempts in the store; compensation failures and job runs come from log events', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(5_000);
    const db = memoryDb();
    db.exec(`INSERT INTO binding_grant (id, code_hash, library_id, connection_id, lms, lti_profile, purpose, site_url, service_url, client_id,
      deployment_id, note, created_at, expires_at) VALUES ('grt_1', 'hash', 'lib', 'con', 'x', 'p', 'initial', 'https://s.test', 'https://s.test', 'c', 'd', '', 0, 1)`);
    ['committed', 'cancelled', 'cancelled', 'failed', 'open', 'abandoned'].forEach((state, i) => db.prepare(`INSERT INTO binding_attempt (attempt_id, seq, connection_id,
      grant_id, purpose, lti_profile, issuer, client_id, deployment_id, history_floor, state, started_at) VALUES (?, ?, 'con', 'grt_1', 'initial', 'p', 'i', 'c', 'd', 0, ?, 0)`)
      .run(`att_${i}`, i + 1, state));
    const lines: LogLine[] = [];
    const metrics = new AppMetrics(db);
    const log = metrics.logger(createLogger({ service: 'x', level: 'error', write: (l) => lines.push(JSON.parse(l) as LogLine) }));
    expect(metrics.logger(log)).toBe(log);
    log.error('grant_compensation_failed', { grant_id: 'grt_1', error: 'Error' });
    log.info('job_run', { job: 'retention', result: 'ok', ms: 1 });
    log.warn('job_run', { job: 'record-dispatch', result: 'failed', ms: 1 });
    log.info('job_run', { job: 'Bad Job', result: 'ok' });
    const text = metrics.render();
    expect(['committed', 'cancelled', 'failed'].map((result) => value(text, `app_grant_redemptions_total{result="${result}"}`))).toEqual([1, 2, 1]);
    expect(value(text, 'app_grant_compensation_failures_total')).toBe(1);
    expect(value(text, 'app_job_runs_total{job="retention",result="ok"}')).toBe(1);
    expect(value(text, 'app_job_runs_total{job="record-dispatch",result="failed"}')).toBe(1);
    expect(value(text, 'app_job_last_success_timestamp_seconds{job="retention"}')).toBe(5);
    expect(text).not.toMatch(/Bad Job|grt_1/);
    // The sink still filters by level; the metrics saw the lines before the filter.
    expect(lines.map((l) => l.event)).toEqual(['grant_compensation_failed']);
  });
});
