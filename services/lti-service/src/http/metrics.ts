// LA-ADR-06 D10: one registry per service database, shared by both HTTP listeners.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { KeyHandle, Logger, LogLevel } from '@cogniate/shared';
import { keyProviderFor } from '@cogniate/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db } from '../db/index.ts';
import { sealedVersionCounts } from '../keys/sealed-columns.ts';
import type { JwksFetchObserver, PlatformKeys } from '../lti/jwks.ts';
import type { TokenResultObserver } from '../platform/token-client.ts';
import { observeAuditEvents } from '../store/audit.ts';
import { observeRateLimits } from './rate-limit.ts';

export const OPENMETRICS_TYPE = 'application/openmetrics-text; version=1.0.0; charset=utf-8';
const migrationDir = new URL('../db/migrations/', import.meta.url);
const migrations = new Map(readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).map((name) => [
  name, createHash('sha256').update(readFileSync(new URL(name, migrationDir))).digest('hex'),
]));

export type ReadinessReason = 'database' | 'migrations' | 'key_version_missing';

/** Read-only checks. A probe never applies migrations or exposes key-version names. */
export async function readiness(db: Db, keys: KeyHandle): Promise<ReadinessReason[]> {
  const reasons: ReadinessReason[] = [];
  try { db.prepare('SELECT 1').get(); }
  catch { return ['database']; }
  try {
    const applied = new Map(db.prepare('SELECT name, sha256 FROM schema_migration').all().map((r) => [String(r.name), String(r.sha256)]));
    if (applied.size !== migrations.size || [...migrations].some(([name, hash]) => applied.get(name) !== hash)) reasons.push('migrations');
  } catch { reasons.push('migrations'); }
  try { await keyProviderFor(keys).ready(); }
  catch (error) {
    reasons.push(error instanceof Error && 'code' in error && error.code === 'key_version_missing' ? 'key_version_missing' : 'database');
  }
  return reasons;
}

type Labels = Record<string, string>;
interface Sample { labels: Labels; value: number }
interface Histogram { labels: Labels; count: number; sum: number; buckets: number[] }
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const COUNTERS = {
  lti_http_requests: 'Completed HTTP requests.',
  lti_launch: 'Accepted and refused LTI launches.',
  lti_launch_binding: 'Accepted launches by browser binding.',
  lti_rate_limited: 'Requests above a rate limit, before log sampling.',
  lti_api_auth_failed: 'Failed API authentication attempts.',
  lti_outbound: 'Outbound responses and guard refusals.',
  lti_platform_rate_limited: 'Platform responses that ask the caller to wait.',
  lti_platform_token_failures: 'Failed platform token requests.',
  lti_jwks_fetch_failures: 'Failed platform JWKS fetches, one per verification that waited on the fetch.',
  lti_audit_events: 'Committed audit events observed by this process.',
  lti_job_runs: 'Completed job attempts.',
} as const;
type Counter = keyof typeof COUNTERS;
const HISTOGRAMS = {
  lti_http_request_duration_seconds: 'HTTP response duration in seconds.',
  lti_outbound_duration_seconds: 'Outbound response duration in seconds.',
} as const;
type HistogramName = keyof typeof HISTOGRAMS;
const escapeLabel = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
const labelText = (labels: Labels): string => Object.keys(labels).length ? `{${Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',')}}` : '';
const sample = (name: string, labels: Labels, value: number): string => `${name}${labelText(labels)} ${value}\n`;

/** Route classes are fixed. Raw URLs, query strings and encoded ids never become labels. */
function routeClass(route: string | undefined): string {
  if (!route) return 'not_found';
  if (route === '/healthz') return 'health';
  if (route === '/readyz') return 'ready';
  if (route === '/metrics') return 'metrics';
  if (route.startsWith('/operator/')) return 'operator';
  if (route.startsWith('/api/platforms')) return 'admin';
  if (route.startsWith('/api/')) return 'api';
  const [, namespace, operation] = route.split('/');
  if (namespace === 'lti') return operation === 'keys' ? 'keys' : operation === 'register' ? 'registration' : 'protocol';
  return 'other';
}

declare module 'fastify' {
  interface FastifyRequest { toolAccountId: string }
}

export class LtiMetrics {
  private readonly db: Db;
  private readonly now: () => number;
  private readonly counters = new Map<Counter, Map<string, Sample>>();
  private readonly histograms = new Map<HistogramName, Map<string, Histogram>>();
  private readonly lastJobSuccess = new Map<string, number>();
  private jwksCache: Pick<PlatformKeys, 'lastSuccessAt'> | null = null;
  private readonly request = new AsyncLocalStorage<FastifyRequest>();
  private readonly loggers = new WeakMap<Logger, Logger>();

  constructor(db: Db, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
    observeRateLimits(db, (event) => this.rateLimited(event.class, event.keyKind, event.mode));
    observeAuditEvents(db, (action, result) => this.increment('lti_audit_events', { action, result }));
    // These signals are wired from start; publish their zero state before the first request or launch.
    this.increment('lti_http_requests', { route_class: 'health', status_class: '2xx', tool_account_id: '' }, 0);
    this.increment('lti_launch', { result: 'accepted', check: '', tool_account_id: '' }, 0);
    this.increment('lti_rate_limited', { class: 'protocol', key_kind: 'address', mode: 'hard' }, 0);
  }

  private increment(name: Counter, labels: Labels, amount = 1): void {
    let series = this.counters.get(name);
    if (!series) { series = new Map(); this.counters.set(name, series); }
    const key = JSON.stringify(labels);
    const entry = series.get(key) ?? { labels, value: 0 };
    entry.value += amount;
    series.set(key, entry);
  }

  private observe(name: HistogramName, labels: Labels, seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    let series = this.histograms.get(name);
    if (!series) { series = new Map(); this.histograms.set(name, series); }
    const key = JSON.stringify(labels);
    const entry = series.get(key) ?? { labels, count: 0, sum: 0, buckets: BUCKETS.map(() => 0) };
    entry.count++;
    entry.sum += seconds;
    BUCKETS.forEach((bound, i) => { if (seconds <= bound) entry.buckets[i] = entry.buckets[i]! + 1; });
    series.set(key, entry);
  }

  /** Only persisted ids may make tenant series; attacker-controlled path values share the empty label. */
  accountId(value: unknown): string {
    if (typeof value !== 'string' || !value) return '';
    try { return this.db.prepare('SELECT id FROM tool_account WHERE id = ?').get(value) ? value : ''; }
    catch { return ''; }
  }

  accountFor(req: FastifyRequest): string {
    return req.toolAccountId || '';
  }

  private resolveAccount(req: FastifyRequest): string {
    const params = req.params as Record<string, unknown> | undefined;
    return this.accountId(params?.account ?? (req.routeOptions.url?.startsWith('/operator/v1/accounts/:id') ? params?.id : undefined));
  }

  private platformId(value: unknown): string {
    if (typeof value !== 'string' || !value) return '';
    try { return this.db.prepare('SELECT id FROM platform WHERE id = ?').get(value) ? value : ''; }
    catch { return ''; }
  }

  install(app: FastifyInstance): void {
    app.decorateRequest('toolAccountId', '');
    // Callback scope keeps simultaneous requests separate, even when clients reuse a trace id.
    app.addHook('onRequest', (req, _reply, done) => this.request.run(req, done));
    // Address refusals run before this hook and perform no tenant lookup, including in onResponse.
    app.addHook('preHandler', async (req) => { req.toolAccountId = this.resolveAccount(req); });
    app.addHook('onResponse', async (req, reply) => {
      const route = routeClass(req.routeOptions.url);
      this.increment('lti_http_requests', { route_class: route, status_class: `${Math.floor(reply.statusCode / 100)}xx`, tool_account_id: this.accountFor(req) });
      this.observe('lti_http_request_duration_seconds', { route_class: route }, reply.elapsedTime / 1000);
    });
  }

  /** BD-A2-52: the injected token client observer. Only a failure of a stored platform makes a series. */
  readonly tokenResult: TokenResultObserver = ({ platformId, ok }) => {
    const id = ok ? '' : this.platformId(platformId);
    if (id) this.increment('lti_platform_token_failures', { platform_id: id });
  };

  /** BD-A2-54: the injected JWKS observer; one event per verification that waited on the fetch. */
  readonly jwksFetch: JwksFetchObserver = ({ platformId, ok }) => {
    const id = ok ? '' : this.platformId(platformId);
    if (id) this.increment('lti_jwks_fetch_failures', { platform_id: id });
  };

  /** BD-A2-54: the cache age comes from the cache at scrape time, not from events. */
  readJwksAges(cache: Pick<PlatformKeys, 'lastSuccessAt'>): void {
    this.jwksCache = cache;
  }

  rateLimited(name: string, keyKind: string, mode: 'hard' | 'soft'): void {
    this.increment('lti_rate_limited', { class: name, key_kind: keyKind, mode });
  }

  /** Observe before the sink filters levels; metrics do not depend on LOG_LEVEL. No input fields are copied. */
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
    if (event === 'launch_accepted' || event === 'launch_check_failed') {
      const req = this.request.getStore();
      const account = req ? this.accountFor(req) : this.accountId(f.tool_account_id);
      this.increment('lti_launch', { result: event === 'launch_accepted' ? 'accepted' : 'failed', check: event === 'launch_accepted' ? '' : String(f.check ?? ''), tool_account_id: account });
      if (event === 'launch_accepted' && (f.binding === 'cookie' || f.binding === 'storage')) this.increment('lti_launch_binding', { binding: f.binding });
    } else if (event === 'api_auth_failed') {
      const schemes: Record<string, string> = { bearer: 'Bearer', ltik: 'LTIK-AUTH-V2', service: 'SERVICE-AUTH-V1', operator: 'OPERATOR-AUTH-V1', none: 'none', unknown: 'unknown' };
      this.increment('lti_api_auth_failed', { scheme: schemes[String(f.scheme)] ?? 'unknown', code: String(f.code ?? '') });
    } else if (event === 'outbound_request' || event === 'outbound_blocked') {
      this.increment('lti_outbound', { result: event === 'outbound_request' ? 'response' : 'blocked', reason: event === 'outbound_blocked' ? String(f.reason ?? '') : '' });
      if (typeof f.ms === 'number') this.observe('lti_outbound_duration_seconds', {}, f.ms / 1000);
    } else if (event === 'platform_rate_limited') {
      const id = this.platformId(f.platform_id);
      if (id) this.increment('lti_platform_rate_limited', { platform_id: id });
    } else if (event === 'job_run' && typeof f.job === 'string' && ['ok', 'failed', 'skipped_lease'].includes(String(f.result))) {
      this.increment('lti_job_runs', { job: f.job, result: String(f.result) });
      if (f.result === 'ok') this.lastJobSuccess.set(f.job, this.now() / 1000);
    }
  }

  async render(keys: KeyHandle): Promise<string> {
    let text = '';
    for (const [name, help] of Object.entries(COUNTERS)) {
      text += `# HELP ${name} ${help}\n# TYPE ${name} counter\n`;
      for (const entry of this.counters.get(name as Counter)?.values() ?? []) text += sample(`${name}_total`, entry.labels, entry.value);
    }
    for (const [name, help] of Object.entries(HISTOGRAMS)) {
      text += `# HELP ${name} ${help}\n# TYPE ${name} histogram\n`;
      for (const entry of this.histograms.get(name as HistogramName)?.values() ?? []) {
        BUCKETS.forEach((bound, i) => { text += sample(`${name}_bucket`, { ...entry.labels, le: String(bound) }, entry.buckets[i]!); });
        text += sample(`${name}_bucket`, { ...entry.labels, le: '+Inf' }, entry.count);
        text += sample(`${name}_sum`, entry.labels, entry.sum) + sample(`${name}_count`, entry.labels, entry.count);
      }
    }
    const gauge = (name: string, help: string, rows: Sample[]): void => {
      text += `# HELP ${name} ${help}\n# TYPE ${name} gauge\n`;
      for (const row of rows) text += sample(name, row.labels, row.value);
    };
    const reasons = await readiness(this.db, keys);
    gauge('lti_ready', 'One when the database, migrations and key provider are ready.', [{ labels: {}, value: reasons.length ? 0 : 1 }]);
    gauge('lti_job_last_success_timestamp_seconds', 'Time of the last successful job run.', [...this.lastJobSuccess].map(([job, value]) => ({ labels: { job }, value })));
    if (!reasons.includes('database') && !reasons.includes('migrations')) {
      const now = this.now();
      const signing = this.db.prepare(`SELECT tool_account_id, status, MIN(created_at) AS created_at
        FROM tool_key WHERE status != 'removed' GROUP BY tool_account_id, status`).all();
      gauge('lti_signing_key_age_seconds', 'Age of the oldest signing key in each state.', signing.map((r) => ({
        labels: { tool_account_id: String(r.tool_account_id), status: String(r.status) }, value: Math.max(0, (now - Number(r.created_at)) / 1000),
      })));
      const apiKeys = this.db.prepare(`SELECT tool_account_id, MIN(expires_at) AS expires_at FROM api_key
        WHERE revoked_at IS NULL AND expires_at IS NOT NULL GROUP BY tool_account_id`).all();
      gauge('lti_api_key_expires_in_seconds', 'Time until the first unrevoked API key expires.', apiKeys.map((r) => ({
        labels: { tool_account_id: String(r.tool_account_id) }, value: (Number(r.expires_at) - now) / 1000,
      })));
      const operator = this.db.prepare('SELECT MIN(expires_at) AS expires_at FROM operator_key WHERE revoked_at IS NULL AND expires_at IS NOT NULL').get();
      gauge('lti_operator_key_expires_in_seconds', 'Time until the first unrevoked operator key expires.',
        operator?.expires_at === null || operator?.expires_at === undefined ? [] : [{ labels: {}, value: (Number(operator.expires_at) - now) / 1000 }]);
      // Every stored active platform with a cache entry for its URL; platforms that share one URL share its age.
      const cache = this.jwksCache;
      if (cache) {
        const platforms = this.db.prepare('SELECT id, jwks_url FROM platform WHERE active = 1 ORDER BY id').all();
        gauge('lti_jwks_cache_age_seconds', 'Time since the last good fetch of the platform JWKS.', platforms.flatMap((r) => {
          const goodAt = cache.lastSuccessAt(String(r.jwks_url));
          return goodAt === null ? [] : [{ labels: { platform_id: String(r.id) }, value: Math.max(0, (now - goodAt) / 1000) }];
        }));
      }
      const sealed = sealedVersionCounts(this.db);
      for (const v of keyProviderFor(keys).versions()) if (!sealed.has(v.id)) sealed.set(v.id, 0);
      gauge('lti_key_provider_sealed_rows', 'Stored sealed values by wrapping key version.', [...sealed].map(([version, value]) => ({ labels: { version }, value })));
    }
    return `${text}# EOF\n`;
  }
}

const registries = new WeakMap<Db, LtiMetrics>();
export function metricsFor(db: Db, now: () => number = Date.now): LtiMetrics {
  let metrics = registries.get(db);
  if (!metrics) { metrics = new LtiMetrics(db, now); registries.set(db, metrics); }
  return metrics;
}

export function registerReadiness(app: FastifyInstance, db: Db, keys: KeyHandle, operator = false): void {
  app.get('/readyz', async (_req, reply) => {
    const reasons = await readiness(db, keys);
    return reply.code(reasons.length ? 503 : 200).header('cache-control', 'no-store').send({ status: reasons.length ? 'not_ready' : 'ready', ...(operator ? { reasons } : {}) });
  });
}
