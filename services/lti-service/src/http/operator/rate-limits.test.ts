import { afterEach, expect, it, vi } from 'vitest';
import { openDb } from '../../db/index.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { readRateLimitSettings } from '../../store/settings.ts';
import { MASTER_KEY, URLS, capturingLogger } from '../../testkit.ts';
import { rateLimiterFor } from '../rate-limit.ts';
import { buildOperatorApp } from './index.ts';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); vi.unstubAllEnvs(); });
async function fixture() {
  const db = openDb(':memory:');
  const { logger } = capturingLogger();
  const clock = { now: 1000 };
  const app = await buildOperatorApp({ db, keys: MASTER_KEY, urls: URLS, logger, now: () => clock.now });
  const first = issueOperatorKey(db, { operator: 'test-op', expiresAt: 86_400_000 }, clock.now);
  const headers = { authorization: `OPERATOR-AUTH-V1 ${first.operatorKey}`, 'content-type': 'application/json' };
  cleanup.push(async () => { await app.close(); db.close(); });
  const get = () => app.inject({ url: '/operator/v1/rate-limits', headers });
  const patch = (payload: unknown) => app.inject({ method: 'PATCH', url: '/operator/v1/rate-limits', headers, payload: JSON.stringify(payload) });
  const events = () => listAuditEvents(db, { limit: 100 }).events;
  return { db, app, clock, headers, get, patch, events, limiter: (await rateLimiterFor(db, logger)), key: first.operatorKey };
}

it('gets effective sources, patches and removes overrides, and audits one event with changed field names', async () => {
  vi.stubEnv('LTI_RATE_LIMITS', JSON.stringify({ classes: { api: { ratePerMinute: 10, burst: 10 } }, registrationSessionsPerAddress: 12 }));
  const h = await fixture();
  expect((await h.get()).json()).toMatchObject({ classes: { api: { source: 'env' }, admin: { source: 'default' } }, registrationSessionsPerAddress: 12, registrationSessionsSource: 'env' });
  expect(h.events()).toEqual([]);
  const change = await h.patch({ classes: { api: { ratePerMinute: 2, burst: 2 } }, registrationSessionsPerAddress: 3 });
  expect(change.statusCode).toBe(200);
  expect(change.json()).toMatchObject({ classes: { api: { ratePerMinute: 2, burst: 2, source: 'operator' } }, registrationSessionsPerAddress: 3, registrationSessionsSource: 'operator' });
  expect(h.limiter.view()).toEqual(change.json());
  expect(h.events()).toEqual([expect.objectContaining({ action: 'settings.rate_limits', result: 'ok', actor: { type: 'operator', id: 'test-op' }, details: { fields: ['classes.api', 'registrationSessionsPerAddress'], classes: { api: { ratePerMinute: 2, burst: 2 } }, registrationSessionsPerAddress: 3 } })]);
  const reset = await h.patch({ classes: { api: null }, registrationSessionsPerAddress: null });
  expect(reset.json()).toMatchObject({ classes: { api: { ratePerMinute: 10, burst: 10, source: 'env' } }, registrationSessionsPerAddress: 12, registrationSessionsSource: 'env' });
  expect(readRateLimitSettings(h.db)).toEqual({ classes: {} });
  expect(h.events()).toContainEqual(expect.objectContaining({ details: { fields: ['classes.api', 'registrationSessionsPerAddress'], classes: { api: null }, registrationSessionsPerAddress: null } }));
});

it.each([
  [{ classes: { unknown: { ratePerMinute: 1, burst: 1 } } }, 'classes'],
  [{ classes: { api: { ratePerMinute: 0, burst: 1 } } }, 'ratePerMinute'],
  [{ classes: { api: { ratePerMinute: 1, burst: 0.5 } } }, 'burst'],
  [{ registrationSessionsPerAddress: 0 }, 'registrationSessionsPerAddress'],
  [{ registrationSessionsPerAddress: 1001 }, 'registrationSessionsPerAddress'],
  [{ registrationSessionsPerAddress: 1.5 }, 'registrationSessionsPerAddress'],
  [{ typo: 5 }, 'typo'],
])('rejects invalid settings without changing storage or cache: %j', async (payload, field) => {
  const h = await fixture();
  const before = h.limiter.view();
  const response = await h.patch(payload);
  expect(response.statusCode).toBe(400);
  expect(response.json().details).toMatchObject({ message: 'INVALID_REQUEST', description: expect.stringContaining(field) });
  expect(readRateLimitSettings(h.db)).toEqual({});
  expect(h.limiter.view()).toEqual(before);
  expect(h.events()).toEqual([expect.objectContaining({ action: 'settings.rate_limits', result: 'refused', code: 'INVALID_REQUEST' })]);
});

it('rolls back settings and does not publish a cache change when audit insertion fails', async () => {
  const h = await fixture();
  const before = h.limiter.view();
  h.db.exec("CREATE TRIGGER refuse_settings_audit BEFORE INSERT ON audit_event WHEN NEW.action = 'settings.rate_limits' BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END");
  expect((await h.patch({ classes: { protocol: { ratePerMinute: 1, burst: 1 } } })).statusCode).toBe(500);
  expect(readRateLimitSettings(h.db)).toEqual({});
  expect(h.limiter.view()).toEqual(before);
  expect(h.events()).toEqual([]);
});

it('uses the operator key id after authentication, and checks a failed-key address before its next lookup', async () => {
  const h = await fixture();
  h.limiter.replaceSettings({ classes: { operator: { ratePerMinute: 60, burst: 1 }, auth_failure: { ratePerMinute: 60, burst: 1 } } });
  expect((await h.get()).statusCode).toBe(200);
  expect((await h.get()).statusCode).toBe(429);
  const other = issueOperatorKey(h.db, { operator: 'second-op', expiresAt: 86_400_000 }, h.clock.now);
  expect((await h.app.inject({ url: '/operator/v1/rate-limits', headers: { authorization: `OPERATOR-AUTH-V1 ${other.operatorKey}` } })).statusCode).toBe(200);
  expect((await h.app.inject({ url: '/operator/v1/rate-limits' })).statusCode).toBe(401);
  const prepare = vi.spyOn(h.db, 'prepare');
  expect((await h.app.inject({ url: '/operator/v1/rate-limits', headers: h.headers })).statusCode).toBe(429);
  expect(prepare).not.toHaveBeenCalled();
  prepare.mockRestore();
  h.clock.now += 1000;
  expect((await h.get()).statusCode).toBe(200);
});
