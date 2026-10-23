// LA-E4-07 (app API delta §8a; the rules of LA-ADR-06 D10): the app operator listener with GET /metrics (OpenMetrics
// text) and GET /readyz. The proxy does not route it. Label values are code values (reporter ids, statuses, outcome
// kinds, refusal reasons, channel ids, job names); a value never holds a library, user, learner, token or key.
//
// Sources (a series with no accurate source is not exposed):
//   app_dispatch_rows, app_dispatch_oldest_pending_seconds   record_dispatch at scrape time
//   app_dispatch_sends_total                                 the outbox observer: one per recorded outcome, after its commit
//   app_launch_refusals_total                                launchRefused(), called by the launch page
//   app_grant_redemptions_total                              binding_attempt at scrape time (rows are never deleted)
//   app_grant_compensation_failures_total                    the grant_compensation_failed log event
//   app_job_runs_total, app_job_last_success_timestamp_seconds  job_run log events (as the LTI service)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger, LogLevel } from '@cogniate/shared';
import { ConfigRefusedError } from '@cogniate/shared';
import type { DeliveryOutcome } from '@cogniate/tracking';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from '../domain/db.ts';
import { observeDispatchSends } from '../kernel/records/outbox.ts';
import { recordReporters } from '../kernel/records/records.ts';

export const OPENMETRICS_TYPE = 'application/openmetrics-text; version=1.0.0; charset=utf-8';

// ---------------------------------------------------------------- listener settings

export interface OperatorListenerConfig { host: string; port: number }

/** 127.0.0.0/8, ::1 or localhost: an address that only this host can reach. */
export function isLoopbackHost(host: string): boolean {
  const bare = host.replace(/^\[(.*)\]$/, '$1').toLowerCase();
  return bare === 'localhost' || bare === '::1' || (isIP(bare) === 4 && bare.startsWith('127.'));
}

/**
 * OPERATOR_HOST (default 127.0.0.1) and OPERATOR_PORT (default 4210), the bind rule of the LTI operator listener
 * (LA-ADR-06 D3): only the `acceptance` compose profile binds the stack network; `production` refuses a host that is
 * not loopback.
 */
export function operatorListenerConfig(env: Record<string, string | undefined> = process.env): OperatorListenerConfig {
  const host = env.OPERATOR_HOST?.trim() || '127.0.0.1';
  if (env.STACK_PROFILE === 'production' && !isLoopbackHost(host)) {
    // BD-A2-79, BD-A2-88: the same reason and fixed text as the LTI service.
    throw new ConfigRefusedError('operator_bind_not_loopback',
      'Production allows the operator listener on loopback only. Set OPERATOR_HOST to 127.0.0.1 or ::1, then start the service again.');
  }
  const raw = env.OPERATOR_PORT;
  const port = raw === undefined || raw === '' ? 4210 : Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`OPERATOR_PORT must be a port number, got "${raw}"`);
  return { host, port };
}

// ---------------------------------------------------------------- readiness

const migrationDir = new URL('../domain/migrations/', import.meta.url);
const migrations = new Map(readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).map((name) => [
  name, createHash('sha256').update(readFileSync(new URL(name, migrationDir))).digest('hex'),
]));

export type ReadinessReason = 'database' | 'migrations';

/**
 * Read-only checks of the app itself (BD-A2-88): the database answers and every migration file is applied unchanged.
 * The LTI service is not checked: its outage must not make the app not ready (runbooks read /readyz of both services).
 */
export function readiness(db: Db): ReadinessReason[] {
  try { db.prepare('SELECT 1').get(); }
  catch { return ['database']; }
  try {
    const applied = new Map(db.prepare('SELECT name, sha256 FROM schema_migration').all().map((r) => [String(r.name), String(r.sha256)]));
    return applied.size !== migrations.size || [...migrations].some(([name, hash]) => applied.get(name) !== hash) ? ['migrations'] : [];
  } catch { return ['migrations']; }
}

// ---------------------------------------------------------------- metrics

type Labels = Record<string, string>;
interface Sample { labels: Labels; value: number }
const COUNTERS = {
  app_dispatch_sends: 'Delivery outcomes that the outbox recorded, by reporter and outcome kind.',
  app_launch_refusals: 'Refused course launches, by reason and channel.',
  app_job_runs: 'Completed job attempts.',
} as const;
type Counter = keyof typeof COUNTERS;
const OUTCOMES: readonly DeliveryOutcome['kind'][] = ['accepted', 'conflict', 'rejected', 'retryable', 'throttled', 'local_failure'];
const GRANT_RESULTS = ['committed', 'cancelled', 'failed'] as const;
const CODE_VALUE = /^[a-z][a-z0-9_-]{0,63}$/;
const escapeLabel = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
const labelText = (labels: Labels): string => Object.keys(labels).length ? `{${Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',')}}` : '';
const sample = (name: string, labels: Labels, value: number): string => `${name}${labelText(labels)} ${value}\n`;

export class AppMetrics {
  private readonly db: Db;
  private readonly now: () => number;
  private readonly counters = new Map<Counter, Map<string, Sample>>();
  private readonly lastJobSuccess = new Map<string, number>();
  private compensationFailures = 0;
  private channelIds: ReadonlySet<string> = new Set();
  private readonly loggers = new WeakMap<Logger, Logger>();

  constructor(db: Db, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
    observeDispatchSends(db, (reporter, outcome) => this.increment('app_dispatch_sends', { reporter, outcome }));
  }

  private increment(name: Counter, labels: Labels, amount = 1): void {
    let series = this.counters.get(name);
    if (!series) { series = new Map(); this.counters.set(name, series); }
    const key = JSON.stringify(labels);
    const entry = series.get(key) ?? { labels, value: 0 };
    entry.value += amount;
    series.set(key, entry);
  }

  /** The channel ids that may become a `channel` label value (the loaded registry). */
  useChannels(channels: Pick<ChannelRegistry, 'channels'>): void {
    this.channelIds = new Set(channels.channels().map((c) => c.id));
  }

  /** This process runs the job runner: publish the zero state of each send series of the registered reporters. Without
   *  it the send and job series are absent, not zero (BD-A2-88). */
  countSends(): void {
    for (const reporter of recordReporters(this.db)) for (const outcome of OUTCOMES) this.increment('app_dispatch_sends', { reporter: reporter.id, outcome }, 0);
  }

  /** One refused launch. An unknown channel id becomes '', a reason that is not a code value becomes 'other'. */
  launchRefused(reason: string, channel: string): void {
    this.increment('app_launch_refusals', { reason: CODE_VALUE.test(reason) ? reason : 'other', channel: this.channelIds.has(channel) ? channel : '' });
  }

  /** Observe before the sink filters levels, so metrics do not depend on LOG_LEVEL. No input field is copied. */
  logger(sink: Logger): Logger {
    const existing = this.loggers.get(sink);
    if (existing) return existing;
    const log = (level: LogLevel, event: string, fields: Record<string, unknown> = {}): void => {
      this.event(event, fields);
      sink.log(level, event, fields);
    };
    const wrapped: Logger = {
      service: sink.service, bootTraceId: sink.bootTraceId, log,
      debug: (e, f) => log('debug', e, f), info: (e, f) => log('info', e, f),
      warn: (e, f) => log('warn', e, f), error: (e, f) => log('error', e, f),
    };
    this.loggers.set(sink, wrapped);
    this.loggers.set(wrapped, wrapped);
    return wrapped;
  }

  private event(event: string, f: Record<string, unknown>): void {
    if (event === 'grant_compensation_failed') this.compensationFailures++;
    else if (event === 'job_run' && typeof f.job === 'string' && CODE_VALUE.test(f.job) && ['ok', 'failed', 'skipped_lease'].includes(String(f.result))) {
      this.increment('app_job_runs', { job: f.job, result: String(f.result) });
      if (f.result === 'ok') this.lastJobSuccess.set(f.job, this.now() / 1000);
    }
  }

  render(): string {
    let text = '';
    const family = (name: string, type: 'counter' | 'gauge', help: string, rows: Sample[], suffix = ''): void => {
      text += `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n`;
      for (const row of rows) text += sample(`${name}${suffix}`, row.labels, row.value);
    };
    const store = this.storeSeries();
    family('app_dispatch_rows', 'gauge', 'Dispatch rows by reporter and status.', store?.rows ?? []);
    family('app_dispatch_oldest_pending_seconds', 'gauge', 'Time since the oldest pending dispatch row started its retry window.', store?.oldest ?? []);
    for (const [name, help] of Object.entries(COUNTERS)) family(name, 'counter', help, [...this.counters.get(name as Counter)?.values() ?? []], '_total');
    family('app_grant_redemptions', 'counter', 'Ended grant redemption attempts, by result.', store?.grants ?? [], '_total');
    family('app_grant_compensation_failures', 'counter', 'Compensation calls that failed after a cancelled redemption.', [{ labels: {}, value: this.compensationFailures }], '_total');
    family('app_job_last_success_timestamp_seconds', 'gauge', 'Time of the last successful job run.', [...this.lastJobSuccess].map(([job, value]) => ({ labels: { job }, value })));
    return `${text}# EOF\n`;
  }

  /** The store series, or null when the database cannot answer (then they are not exposed). */
  private storeSeries(): { rows: Sample[]; oldest: Sample[]; grants: Sample[] } | null {
    try {
      const now = this.now();
      const rows = this.db.prepare('SELECT reporter, status, COUNT(*) AS n FROM record_dispatch GROUP BY reporter, status ORDER BY reporter, status').all()
        .map((r) => ({ labels: { reporter: String(r.reporter), status: String(r.status) }, value: Number(r.n) }));
      const pending = new Map(this.db.prepare(`SELECT reporter, MIN(COALESCE(resent_at, created_at)) AS since FROM record_dispatch
        WHERE status = 'pending' GROUP BY reporter`).all().map((r) => [String(r.reporter), Number(r.since)]));
      let registered: string[] = [];
      try { registered = recordReporters(this.db).map((r) => r.id); } catch { registered = []; }
      const oldest = [...new Set([...registered, ...pending.keys()])].sort().map((reporter) => ({
        labels: { reporter }, value: pending.has(reporter) ? Math.max(0, (now - pending.get(reporter)!) / 1000) : 0,
      }));
      const ended = new Map(this.db.prepare(`SELECT state, COUNT(*) AS n FROM binding_attempt WHERE state IN ('committed', 'cancelled', 'failed') GROUP BY state`).all()
        .map((r) => [String(r.state), Number(r.n)]));
      const grants = GRANT_RESULTS.map((result) => ({ labels: { result }, value: ended.get(result) ?? 0 }));
      return { rows, oldest, grants };
    } catch {
      return null;
    }
  }
}

const registries = new WeakMap<Db, AppMetrics>();
/** One registry per database, shared by the listeners of the process and by the outbox observer. */
export function appMetricsFor(db: Db, now: () => number = Date.now): AppMetrics {
  let metrics = registries.get(db);
  if (!metrics) { metrics = new AppMetrics(db, now); registries.set(db, metrics); }
  return metrics;
}

// ---------------------------------------------------------------- listener

/** The operator app: GET /metrics and GET /readyz only. The caller listens on operatorListenerConfig(). */
export function buildOperatorListener(deps: { db: Db; metrics: AppMetrics }): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/metrics', async (_req, reply) => reply.type(OPENMETRICS_TYPE).header('cache-control', 'no-store').send(deps.metrics.render()));
  app.get('/readyz', async (_req, reply) => {
    const reasons = readiness(deps.db);
    return reply.code(reasons.length ? 503 : 200).header('cache-control', 'no-store')
      .send(reasons.length ? { status: 'not_ready', reasons } : { status: 'ready' });
  });
  return app;
}
