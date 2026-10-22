import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JobContext } from '@cogniate/shared';
import { bindKeyProvider, createLocalKeyProvider, createLogger, legacyKeyRing } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api-errors.ts';
import { openDb, transaction } from '../db/index.ts';
import { keyRewrapJob } from '../jobs/key-rewrap.ts';
import { keyVersionsInUse } from '../keys/key-config.ts';
import { createPlatformKeys } from '../lti/jwks.ts';
import { createAgsClient } from '../platform/ags.ts';
import { createNrpsClient } from '../platform/nrps.ts';
import { createScoreClock } from '../platform/score-clock.ts';
import { createTokenClient } from '../platform/token-client.ts';
import { ensureAccount } from '../store/accounts.ts';
import { listAuditEvents, withAudit } from '../store/audit.ts';
import { createPlatform } from '../store/platforms.ts';
import { issueOperatorKey } from '../store/operator-keys.ts';
import { ensureToolKey } from '../store/tool-keys.ts';
import { capturingLogger, fakeOutbound, URLS } from '../testkit.ts';
import { buildApp } from './app.ts';
import { metricsFor, OPENMETRICS_TYPE, readiness } from './metrics.ts';
import { buildOperatorApp } from './operator/index.ts';
import { RateLimiter } from './rate-limit.ts';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

async function setup(profile = 'default', file = ':memory:') {
  const db = openDb(file);
  const clock = { now: 1_800_000_000_000 };
  const masterKey = Buffer.alloc(32, 2);
  const provider = createLocalKeyProvider(legacyKeyRing(masterKey), { referencedVersions: () => keyVersionsInUse(db) });
  bindKeyProvider(masterKey, provider);
  const a = ensureAccount(db, { id: 'cogniate', name: 'Personal name', appUrl: URLS.app });
  ensureAccount(db, { id: 'second', name: 'Second name', appUrl: URLS.app });
  const { logger: sink, lines } = capturingLogger();
  const metrics = metricsFor(db, () => clock.now);
  const logger = metrics.logger(sink);
  const outbound = fakeOutbound(() => []);
  const tokens = createTokenClient({ db, masterKey, outbound, logger, now: () => clock.now });
  const app = await buildApp({
    db, masterKey, logger, urls: URLS, keys: createPlatformKeys(outbound), ltikTtlSeconds: 3600,
    ags: createAgsClient({ outbound, tokens, logger, clock: createScoreClock() }), nrps: createNrpsClient({ outbound, tokens, logger }),
    outbound, profile, knobs: [], now: () => clock.now,
  });
  const operator = await buildOperatorApp({ db, keys: provider, logger, urls: URLS, now: () => clock.now });
  cleanup.push(async () => { await Promise.all([app.close(), operator.close()]); if (db.isOpen) db.close(); });
  return { db, clock, masterKey, provider, app, operator, metrics, logger, lines, apiKey: a.apiKey! };
}

const scrape = async (h: Awaited<ReturnType<typeof setup>>) => (await h.operator.inject('/metrics')).body;

describe('health and readiness', () => {
  it('AC-05: production health contains only liveness and service', async () => {
    const h = await setup('production');
    const answer = await h.app.inject('/healthz');
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toEqual({ status: 'ok', service: 'lti-service' });
  });

  it.each(['default', 'acceptance'])('keeps the %s health fields', async (profile) => {
    const h = await setup(profile);
    expect((await h.app.inject('/healthz')).json()).toEqual({ status: 'ok', service: 'lti-service', profile, knobs: [], outbound_allowlist: [], simulation_profiles: [] });
  });

  it('AC-04: a stored signing key whose version is missing makes both listeners unready', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-ready-'));
    cleanup.push(async () => rmSync(dir, { recursive: true, force: true }));
    const h = await setup('default', join(dir, 'lti.db'));
    const other = createLocalKeyProvider({ active: 'old', keys: new Map([['old', Buffer.alloc(32, 8)]]) });
    await ensureToolKey(h.db, other, 'cogniate');
    const internal = await h.operator.inject('/readyz');
    expect(internal.statusCode).toBe(503);
    expect(internal.json()).toEqual({ status: 'not_ready', reasons: ['key_version_missing'] });
    const publicAnswer = await h.app.inject('/readyz');
    expect(publicAnswer.statusCode).toBe(503);
    expect(publicAnswer.json()).toEqual({ status: 'not_ready' });
    expect(await scrape(h)).toContain('lti_ready 0\n');
    // Liveness is independent of readiness.
    expect((await h.app.inject('/healthz')).statusCode).toBe(200);
  });

  it('detects missing or changed migrations without applying them', async () => {
    const h = await setup();
    expect(await readiness(h.db, h.provider)).toEqual([]);
    h.db.prepare("UPDATE schema_migration SET sha256 = 'changed' WHERE name = '001_init.sql'").run();
    expect(await readiness(h.db, h.provider)).toEqual(['migrations']);
    h.db.prepare("DELETE FROM schema_migration WHERE name = '017_idempotency_record.sql'").run();
    expect((await h.operator.inject('/readyz')).json()).toEqual({ status: 'not_ready', reasons: ['migrations'] });
    expect(h.db.prepare("SELECT name FROM schema_migration WHERE name = '017_idempotency_record.sql'").get()).toBeUndefined();
  });

  it('reports a closed database without leaking a driver error', async () => {
    const h = await setup();
    h.db.close();
    const answer = await h.operator.inject('/readyz');
    expect(answer.statusCode).toBe(503);
    expect(answer.json()).toEqual({ status: 'not_ready', reasons: ['database'] });
    expect((await h.app.inject('/readyz')).json()).toEqual({ status: 'not_ready' });
    expect(await scrape(h)).toContain('lti_ready 0\n');
  });
});

describe('metrics collection', () => {
  it('exposes OpenMetrics only on the operator listener, outside operator auth', async () => {
    const h = await setup();
    expect((await h.app.inject('/metrics')).statusCode).toBe(404);
    expect((await h.app.inject('/readyz')).json()).toEqual({ status: 'ready' });
    expect((await h.operator.inject('/readyz')).json()).toEqual({ status: 'ready', reasons: [] });
    const answer = await h.operator.inject('/metrics');
    expect(answer.statusCode).toBe(200);
    expect(answer.headers['content-type']).toBe(OPENMETRICS_TYPE);
    expect(answer.headers['cache-control']).toBe('no-store');
    for (const metric of ['lti_http_requests_total', 'lti_rate_limited_total', 'lti_launch_total', 'lti_ready']) expect(answer.body).toContain(`${metric}`);
    expect(answer.body.endsWith('# EOF\n')).toBe(true);
    expect(answer.body).toContain('# TYPE lti_http_requests counter\n');
    expect((await h.operator.inject('/operator/v1/accounts')).statusCode).toBe(401);
    const text = await scrape(h);
    expect(text).toContain('lti_api_auth_failed_total{scheme="OPERATOR-AUTH-V1",code="INVALID_OPERATOR_AUTHORIZATION_HEADER"} 1\n');
    expect(text).toContain('lti_http_request_duration_seconds_count{route_class="ready"} 2\n');
    expect(text).toContain('lti_http_request_duration_seconds_bucket{route_class="ready",le="+Inf"} 2\n');
  });

  it('keeps concurrent tenant labels separate and never labels an unregistered path value', async () => {
    const h = await setup();
    const urls = ['/lti/launch/cogniate', '/lti/launch/second', '/lti/launch/unknown-person'];
    await Promise.all(urls.map((url) => h.app.inject({ method: 'POST', url, headers: { 'x-trace-id': 'same-trace-12345678' } })));
    await h.app.inject('/lti/login/cogniate');
    const text = await scrape(h);
    expect(text).toMatch(/lti_launch_total\{result="failed",check="[^"]*",tool_account_id="cogniate"\} 1/);
    expect(text).toMatch(/lti_launch_total\{result="failed",check="[^"]*",tool_account_id="second"\} 1/);
    expect(text).toMatch(/lti_launch_total\{result="failed",check="[^"]*",tool_account_id=""\} 1/);
    expect(text).not.toContain('unknown-person');
    expect(text).not.toContain('Personal name');
    expect(h.lines).toContainEqual(expect.objectContaining({ event: 'http_request', path: '/lti/login/cogniate', tool_account_id: 'cogniate' }));
    await h.app.inject({ url: '/api/platforms', headers: { authorization: `Bearer ${h.apiKey}` } });
    expect(await scrape(h)).toContain('lti_http_requests_total{route_class="admin",status_class="2xx",tool_account_id="cogniate"} 1\n');
  });

  it('counts hard refusals and soft excesses even when warnings are sampled', async () => {
    const h = await setup();
    const limiter = new RateLimiter(h.db, h.logger, () => h.clock.now, JSON.stringify({ classes: {
      protocol: { ratePerMinute: 1, burst: 1 }, protocol_account: { ratePerMinute: 1, burst: 1 },
    } }));
    limiter.check('protocol', '192.0.2.1');
    for (let i = 0; i < 3; i++) expect(() => limiter.check('protocol', '192.0.2.1')).toThrow(ApiError);
    for (let i = 0; i < 4; i++) limiter.check('protocol_account', 'cogniate');
    expect(h.lines.filter((r) => r.event === 'rate_limited')).toHaveLength(1);
    expect(h.lines.filter((r) => r.event === 'rate_limit_soft')).toHaveLength(1);
    const text = await scrape(h);
    expect(text).toContain('lti_rate_limited_total{class="protocol",key_kind="address",mode="hard"} 3\n');
    expect(text).toContain('lti_rate_limited_total{class="protocol_account",key_kind="account",mode="soft"} 3\n');
    expect(text).not.toContain('192.0.2.1');
  });

  it('counts committed audit writes and refusals once, after the outermost commit; never a rollback (BD-A2-60)', async () => {
    const h = await setup();
    const base = { actor: { type: 'system' as const, id: 'unit' }, toolAccountId: 'cogniate', traceId: null, clientIp: null,
      action: 'account.update', target: { type: 'account', id: 'cogniate' } };
    await withAudit(h.db, () => h.clock.now, base, (audit) => audit.change(() => 1, () => ({ action: 'account.create' })));
    await expect(withAudit(h.db, () => h.clock.now, base, () => { throw new ApiError('INVALID_REQUEST'); })).rejects.toThrow();
    await expect(withAudit(h.db, () => h.clock.now, base, (audit) => audit.change(() => { throw new Error('rollback'); }))).rejects.toThrow('rollback');
    // A nested change in a caller-owned transaction counts when that transaction commits.
    let pending: Promise<unknown> | undefined;
    transaction(h.db, () => { pending = withAudit(h.db, () => h.clock.now, { ...base, action: 'settings.rate_limits' }, (audit) => audit.change(() => 1)); });
    await pending;
    // An outer rollback after a released savepoint counts nothing.
    expect(() => transaction(h.db, () => {
      void withAudit(h.db, () => h.clock.now, { ...base, action: 'api_key.issue' }, (audit) => audit.change(() => 1));
      throw new Error('outer rollback');
    })).toThrow('outer rollback');
    h.db.exec("CREATE TRIGGER unit_refuse_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'failed insert'); END");
    await expect(withAudit(h.db, () => h.clock.now, base, (audit) => audit.change(() => h.db.prepare("UPDATE tool_account SET name = 'changed' WHERE id = 'cogniate'").run()))).rejects.toThrow('failed insert');
    expect(h.db.prepare("SELECT name FROM tool_account WHERE id = 'cogniate'").get()?.name).toBe('Personal name');
    const text = await scrape(h);
    expect(text).toContain('lti_audit_events_total{action="account.create",result="ok"} 1\n');
    expect(text).toContain('lti_audit_events_total{action="account.update",result="refused"} 1\n');
    expect(text).toContain('lti_audit_events_total{action="settings.rate_limits",result="ok"} 1\n');
    expect(text).not.toContain('lti_audit_events_total{action="account.update",result="ok"}');
    expect(text).not.toContain('action="api_key.issue"');
  });

  it('counts the committed key-rewrap completion event once (BD-A2-60)', async () => {
    const h = await setup();
    h.db.prepare("INSERT INTO job_lease (name, owner, lease_until) VALUES ('key-rewrap', 'unit/boot', ?)").run(h.clock.now + 60_000);
    const ctx: JobContext = { instanceId: 'unit', bootId: 'boot', leaseOwner: 'unit/boot', traceId: 'rewrap-trace-unit',
      now: () => h.clock.now, signal: new AbortController().signal, logger: h.logger };
    expect((await keyRewrapJob(h.db, h.provider).run(ctx)).result).toBe('ok');
    expect(listAuditEvents(h.db, { action: 'key_provider.rewrap', limit: 10 }).events).toHaveLength(1);
    expect(await scrape(h)).toContain('lti_audit_events_total{action="key_provider.rewrap",result="ok"} 1\n');
  });

  it('logs an audit observer failure and keeps the committed write', async () => {
    const h = await setup();
    const spy = vi.spyOn(h.metrics as unknown as { increment: () => void }, 'increment').mockImplementationOnce(() => { throw new RangeError('observer'); });
    await withAudit(h.db, () => h.clock.now, { actor: { type: 'system', id: 'unit' }, toolAccountId: null, traceId: null, clientIp: null,
      action: 'settings.rate_limits', target: { type: 'settings', id: null } }, (audit) => audit.change(() => 1));
    spy.mockRestore();
    expect(listAuditEvents(h.db, { action: 'settings.rate_limits', limit: 10 }).events).toHaveLength(1);
    expect(h.lines).toContainEqual(expect.objectContaining({ event: 'metrics_observer_failed', source: 'audit', error: 'RangeError' }));
  });

  it('reads key gauges at scrape time and exposes only metadata', async () => {
    const h = await setup();
    const kid = await ensureToolKey(h.db, h.provider, 'cogniate');
    h.db.prepare('UPDATE tool_key SET created_at = ? WHERE kid = ?').run(h.clock.now - 10_000, kid);
    issueOperatorKey(h.db, { operator: 'person@example.test', expiresAt: h.clock.now + 5000 }, h.clock.now);
    h.db.prepare("UPDATE api_key SET expires_at = ? WHERE tool_account_id = 'cogniate'").run(h.clock.now + 10_000);
    let text = await scrape(h);
    expect(text).toContain('lti_signing_key_age_seconds{tool_account_id="cogniate",status="active"} 10\n');
    expect(text).toContain('lti_api_key_expires_in_seconds{tool_account_id="cogniate"} 10\n');
    expect(text).toContain('lti_operator_key_expires_in_seconds 5\n');
    expect(text).toContain('lti_key_provider_sealed_rows{version="legacy"} 1\n');
    h.clock.now += 1000;
    text = await scrape(h);
    expect(text).toContain('lti_operator_key_expires_in_seconds 4\n');
    expect(text).not.toContain('person@example.test');
    expect(text).not.toContain(h.apiKey);
  });

  it('observes existing log signals once, before log level filtering, with no arbitrary fields', async () => {
    const h = await setup();
    const platform = createPlatform(h.db, 'cogniate', { issuer: 'https://unit.test', clientId: 'c', name: 'Personal name',
      authEndpoint: 'https://unit.test/auth', tokenEndpoint: 'https://unit.test/token', jwksUrl: 'https://unit.test/keys', deploymentIds: ['1'], active: true });
    const sink = createLogger({ service: 'lti-service', level: 'error', write: () => { throw new Error('filtered event reached sink'); } });
    const logger = h.metrics.logger(h.metrics.logger(sink));
    logger.info('outbound_request', { ms: 20, host: 'private.example', method: 'POST', status: 200, sub: 'learner', email: 'person@example.test' });
    logger.warn('outbound_blocked', { reason: 'not_https', host: 'private.example' });
    logger.warn('platform_rate_limited', { platform_id: platform.id });
    logger.warn('platform_rate_limited', { platform_id: 'unregistered-path-value' });
    logger.info('job_run', { job: 'retention', result: 'ok' });
    h.clock.now += 1000;
    logger.warn('job_run', { job: 'retention', result: 'failed' });
    const text = await scrape(h);
    expect(text).toContain('lti_outbound_total{result="response",reason=""} 1\n');
    expect(text).toContain('lti_outbound_duration_seconds_sum 0.02\n');
    expect(text).toContain(`lti_platform_rate_limited_total{platform_id="${platform.id}"} 1\n`);
    expect(text).toContain('lti_job_last_success_timestamp_seconds{job="retention"} 1800000000\n');
    for (const secret of ['private.example', 'learner', 'person@example.test', 'unregistered-path-value']) expect(text).not.toContain(secret);
  });

  describe('platform observers (BD-A2-52, BD-A2-54)', () => {
    const platformOn = (h: Awaited<ReturnType<typeof setup>>, name: string, jwksUrl: string, active = true) => createPlatform(h.db, 'cogniate', {
      issuer: `https://${name}.test`, clientId: name, name, authEndpoint: `https://${name}.test/auth`, tokenEndpoint: `https://${name}.test/token`,
      jwksUrl, deploymentIds: ['1'], active,
    });
    const answer = (status: number, body: unknown) => {
      const bytes = Buffer.from(JSON.stringify(body));
      return { status, body: bytes, headers: {}, text: () => bytes.toString(), json: () => JSON.parse(bytes.toString()) as unknown };
    };

    it('counts token failures and one JWKS failure per waiting verification, for stored platforms only', async () => {
      const h = await setup();
      const shared = 'https://shared.test/keys';
      const [first, second] = [platformOn(h, 'first', shared), platformOn(h, 'second', shared)];
      await ensureToolKey(h.db, h.provider, 'cogniate');
      let tokenStatus = 401;
      const outbound = { ...fakeOutbound(() => []), request: async (url: string) => url === shared ? answer(500, {}) : answer(tokenStatus, { access_token: 'unit', expires_in: 60 }) };
      const tokens = createTokenClient({ db: h.db, masterKey: h.masterKey, outbound, logger: h.logger, now: () => h.clock.now, onTokenResult: h.metrics.tokenResult });
      await expect(tokens.getToken(first, ['scope'], 'trace-token-1')).rejects.toThrow(ApiError);
      tokenStatus = 200;
      await tokens.getToken(second, ['scope'], 'trace-token-2');
      const keys = createPlatformKeys(outbound, () => h.clock.now, h.metrics.jwksFetch);
      // The first call starts the fetch; the second joins it. Each waiting call counts for its own platform.
      await Promise.allSettled([keys.verify('a.b.c', shared, 'trace-jwks-1', first.id), keys.verify('a.b.c', shared, 'trace-jwks-2', second.id)]);
      h.clock.now += 61_000;
      await expect(keys.verify('a.b.c', shared, 'trace-jwks-3', 'unregistered-platform')).rejects.toThrow();
      h.clock.now += 61_000;
      await expect(keys.verify('a.b.c', shared, 'trace-jwks-4')).rejects.toThrow();
      const text = await scrape(h);
      expect(text).toContain(`lti_platform_token_failures_total{platform_id="${first.id}"} 1\n`);
      expect(text).not.toContain(`lti_platform_token_failures_total{platform_id="${second.id}"}`);
      for (const platform of [first, second]) expect(text).toContain(`lti_jwks_fetch_failures_total{platform_id="${platform.id}"} 1\n`);
      expect(text).not.toContain('unregistered-platform');
      expect(text.match(/^lti_jwks_fetch_failures_total/gm)).toHaveLength(2);
    });

    it('reports the cache age at scrape time for every active platform whose JWKS URL has an entry', async () => {
      const h = await setup();
      const shared = 'https://shared.test/keys';
      const [first, second] = [platformOn(h, 'first', shared), platformOn(h, 'second', shared)];
      const [unfetched, inactive] = [platformOn(h, 'unfetched', 'https://unfetched.test/keys'), platformOn(h, 'inactive', shared, false)];
      const outbound = { ...fakeOutbound(() => []), request: async () => answer(200, { keys: [] }) };
      const keys = createPlatformKeys(outbound, () => h.clock.now, h.metrics.jwksFetch);
      h.metrics.readJwksAges(keys);
      expect(await scrape(h)).not.toMatch(/^lti_jwks_cache_age_seconds\{/m);
      // Only the first platform's launch fetches; the second shares the cache entry with no own call.
      await expect(keys.verify('a.b.c', shared, 'trace-age', first.id)).rejects.toThrow();
      h.clock.now += 30_000;
      const text = await scrape(h);
      expect(text).toContain('# TYPE lti_jwks_cache_age_seconds gauge\n');
      for (const platform of [first, second]) expect(text).toContain(`lti_jwks_cache_age_seconds{platform_id="${platform.id}"} 30\n`);
      for (const platform of [unfetched, inactive]) expect(text).not.toContain(platform.id);
    });
  });
});
