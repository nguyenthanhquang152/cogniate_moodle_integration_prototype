import { afterEach, expect, it, vi } from 'vitest';
import { createLaunch } from '../store/launches.ts';
import { issueOperatorKey } from '../store/operator-keys.ts';
import { updateAccount } from '../store/accounts.ts';
import { MASTER_KEY, URLS, capturingLogger, harness } from '../testkit.ts';
import { buildOperatorApp } from './operator/index.ts';
import { rateLimiterFor } from './rate-limit.ts';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { vi.restoreAllMocks(); for (const close of cleanup.splice(0)) await close(); vi.unstubAllEnvs(); });
async function fixture() {
  const h = await harness();
  cleanup.push(async () => { await h.app.close(); h.db.close(); });
  const limiter = rateLimiterFor(h.db, capturingLogger().logger);
  const ltik = createLaunch(h.db, { toolAccountId: 'cogniate', platformId: h.platform.id, deploymentId: '1', messageType: 'LtiResourceLinkRequest', claims: {} }, 3600, h.clock.now).ltik;
  const api = (credential = ltik, scheme = 'LTIK-AUTH-V2') => h.app.inject({ url: '/api/idtoken', headers: { authorization: `${scheme} ${h.apiKey}:${credential}` } });
  return { ...h, limiter, api };
}

it('rejects an exhausted protocol address before any database read and returns a page without a cookie', async () => {
  const h = await fixture();
  h.limiter.replaceSettings({ classes: { protocol: { ratePerMinute: 60, burst: 1 } } });
  const request = () => h.app.inject({ url: '/lti/login/cogniate' });
  expect((await request()).statusCode).toBe(400);
  const prepare = vi.spyOn(h.db, 'prepare');
  const limited = await request();
  expect(prepare).not.toHaveBeenCalled();
  expect(limited.statusCode).toBe(429);
  expect(limited.body).toContain('data-error-code="RATE_LIMITED"');
  expect(limited.headers['retry-after']).toBe('1');
  expect(limited.headers['set-cookie']).toBeUndefined();
  expect(limited.headers['cache-control']).toContain('no-store');
  expect((await h.app.inject('/healthz')).statusCode).toBe(200);
});

it('keeps soft protocol accounts non-blocking and registration/keys address buckets separate', async () => {
  const h = await fixture();
  h.limiter.replaceSettings({ classes: { protocol_account: { ratePerMinute: 1, burst: 1 }, keys: { ratePerMinute: 60, burst: 1 }, registration: { ratePerMinute: 60, burst: 1 } } });
  for (let i = 0; i < 4; i++) expect((await h.app.inject('/lti/login/cogniate')).statusCode).toBe(400);
  expect(h.lines.filter((l) => l.event === 'rate_limit_soft')).toHaveLength(1);
  expect((await h.app.inject('/lti/keys/cogniate')).statusCode).toBe(200);
  const keys = await h.app.inject('/lti/keys/cogniate');
  expect(keys.statusCode).toBe(429);
  expect(keys.json().details.limit).toEqual({ class: 'keys' });
  expect(h.lines.find((line) => line.event === 'rate_limited')).toMatchObject({ trace_id: keys.headers['x-trace-id'] });
  expect(keys.headers['retry-after']).toBe(String(keys.json().details.retryAfter));
  expect((await h.app.inject('/lti/register/cogniate')).statusCode).toBe(400);
  const registration = await h.app.inject('/lti/register/cogniate');
  expect(registration.statusCode).toBe(429);
  expect(registration.body).toContain('data-error-code="RATE_LIMITED"');
});

it('ignores spoofed X-Forwarded-For from an untrusted socket', async () => {
  vi.stubEnv('TRUSTED_PROXY_CIDRS', '10.0.0.0/8');
  const h = await fixture();
  h.limiter.replaceSettings({ classes: { keys: { ratePerMinute: 1, burst: 1 } } });
  const request = (forwarded: string) => h.app.inject({ url: '/lti/keys/cogniate', remoteAddress: '192.0.2.1', headers: { 'x-forwarded-for': forwarded } });
  expect((await request('198.51.100.1')).statusCode).toBe(200);
  expect((await request('198.51.100.2')).statusCode).toBe(429);
  expect(h.lines.find((l) => l.event === 'rate_limited')).toMatchObject({ client_ip: '192.0.2.1' });
});

it('uses the actual client behind a trusted proxy and logs that address', async () => {
  vi.stubEnv('TRUSTED_PROXY_CIDRS', '10.0.0.0/8');
  const h = await fixture();
  h.limiter.replaceSettings({ classes: { keys: { ratePerMinute: 1, burst: 1 } } });
  const request = (forwarded: string) => h.app.inject({ url: '/lti/keys/cogniate', remoteAddress: '10.0.0.2', headers: { 'x-forwarded-for': forwarded } });
  expect((await request('192.0.2.1')).statusCode).toBe(200);
  expect((await request('192.0.2.1')).statusCode).toBe(429);
  expect((await request('192.0.2.2')).statusCode).toBe(200);
  expect(h.lines.find((l) => l.event === 'rate_limited')).toMatchObject({ client_ip: '192.0.2.1' });
});

it('checks api/admin only after full auth; bad ltiks or service keys do not spend auth_failure', async () => {
  const h = await fixture();
  h.limiter.replaceSettings({ classes: { api: { ratePerMinute: 1, burst: 1 }, admin: { ratePerMinute: 1, burst: 1 }, auth_failure: { ratePerMinute: 1, burst: 1 } } });
  for (let i = 0; i < 3; i++) {
    expect((await h.api('wrong')).statusCode).toBe(401);
    expect((await h.app.inject({ url: '/api/memberships', headers: { authorization: `SERVICE-AUTH-V1 ${h.apiKey}:wrong` } })).statusCode).toBe(401);
  }
  expect((await h.api()).statusCode).toBe(200);
  expect((await h.api()).statusCode).toBe(429);
  const admin = () => h.app.inject({ url: '/api/platforms', headers: { authorization: `Bearer ${h.apiKey}` } });
  expect((await admin()).statusCode).toBe(200);
  expect((await admin()).statusCode).toBe(429);
  expect(h.lines.filter((l) => l.event === 'rate_limited' && l.class === 'auth_failure')).toEqual([]);
});

it('accounts stay isolated, and account edits apply to the next authenticated request', async () => {
  const h = await fixture();
  updateAccount(h.db, 'cogniate', { limits: { api: { ratePerMinute: 1, burst: 1 }, admin: { ratePerMinute: 1, burst: 1 } } }, h.clock.now);
  expect((await h.api()).statusCode).toBe(200);
  expect((await h.api()).statusCode).toBe(429);
  expect((await h.app.inject({ url: '/api/platforms', headers: { authorization: `Bearer ${h.otherApiKey}` } })).statusCode).toBe(200);
  updateAccount(h.db, 'cogniate', { limits: { api: { ratePerMinute: 5, burst: 5 } } }, h.clock.now);
  expect((await h.api()).statusCode).toBe(200);
});

it('a key failure exhausts its address for both invalid and valid callers until refill', async () => {
  const h = await fixture();
  h.limiter.replaceSettings({ classes: { auth_failure: { ratePerMinute: 60, burst: 1 } } });
  expect((await h.app.inject('/api/idtoken')).statusCode).toBe(401);
  const prepare = vi.spyOn(h.db, 'prepare');
  const res = await h.api();
  expect(res.statusCode).toBe(429);
  expect(res.json().details).toMatchObject({ message: 'RATE_LIMITED', retryAfter: 1, limit: { class: 'auth_failure' }, description: 'Too many requests. Retry after 1 s.' });
  expect(res.headers['retry-after']).toBe('1');
  expect(prepare).not.toHaveBeenCalled();
  prepare.mockRestore();
  h.clock.now += 1000;
  expect((await h.api()).statusCode).toBe(200);
});

it('publishes operator changes to the public listener immediately; both listeners share auth_failure', async () => {
  const h = await fixture();
  const { logger } = capturingLogger();
  const operator = await buildOperatorApp({ db: h.db, logger, keys: MASTER_KEY, urls: URLS, now: () => h.clock.now });
  const { operatorKey } = issueOperatorKey(h.db, { operator: 'test', expiresAt: h.clock.now + 86_400_000 }, h.clock.now);
  try {
    const patched = await operator.inject({ method: 'PATCH', url: '/operator/v1/rate-limits', headers: { authorization: `OPERATOR-AUTH-V1 ${operatorKey}` },
      payload: { classes: { keys: { ratePerMinute: 1, burst: 1 }, auth_failure: { ratePerMinute: 1, burst: 1 } } } });
    expect(patched.statusCode).toBe(200);
    expect((await h.app.inject('/lti/keys/cogniate')).statusCode).toBe(200);
    expect((await h.app.inject('/lti/keys/cogniate')).statusCode).toBe(429);
    expect((await operator.inject('/operator/v1/rate-limits')).statusCode).toBe(401);
    expect((await h.api()).statusCode).toBe(429);
  } finally { await operator.close(); }
});
