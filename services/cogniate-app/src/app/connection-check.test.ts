import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LtiPlatformCheck } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import { createConnection, disableConnection, getConnection, markRegistered, stageRegistration } from '../domain/connections.ts';
import { ensureLibrary } from '../domain/libraries.ts';
import type { ChannelId } from '../kernel/ports.ts';
import type { TestApp } from '../testkit.ts';
import { QA_B, TEST_CHANNELS, THANH, testApp, testSetupOf } from '../testkit.ts';

const SCORE_READ = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly';
const PLATFORM = { id: 'plt_check', issuer: 'https://canvas.sim.test', clientId: 'canvas-client', deploymentIds: ['deployment-one'], productFamilyCode: 'canvas' };
let t: TestApp;
let cookie: string;
beforeEach(async () => {
  t = await testApp();
  cookie = await t.login(THANH);
});
afterEach(async () => { await t?.app.close(); });

const PROFILES: Partial<Record<ChannelId, string>> = { canvas: 'canvas-sim-cloud', moodle: 'standard', blackboard: 'blackboard', 'lti-generic': 'lti-generic' };
function connection(channel: ChannelId = 'canvas', options: { library?: string; method?: 'manual' | 'dynamic' } = {}) {
  const library = ensureLibrary(t.db, options.library ?? THANH.library, t.clock.now);
  return createConnection(t.db, library.id, {
    name: 'School', siteUrl: 'https://school-a.canvas.sim.test', method: options.method ?? 'manual', channel, profile: PROFILES[channel]!,
  }, null, t.clock.now, TEST_CHANNELS, testSetupOf(channel)!.sharingOf);
}
function registered(channel: ChannelId = 'canvas', library?: string) {
  const c = connection(channel, library ? { library } : {});
  markRegistered(t.db, c.id, { ...PLATFORM, id: `plt_${c.id}` }, t.clock.now);
  return getConnection(t.db, c.libraryId, c.id)!;
}
const check = (id: string) => t.app.inject({ method: 'POST', url: `/app-api/connections/${id}/check`, headers: { ...t.writeHeaders(cookie), 'x-trace-id': 'check-trace-1234' } });
const checkCalls = () => t.lti.calls.filter((call) => call.startsWith('POST check'));
const answer = (over: Partial<LtiPlatformCheck> = {}): LtiPlatformCheck => ({
  checkedAt: '2026-10-17T08:00:00.000Z', jwks: { ok: true, keys: 2 }, token: { ok: true, scope: SCORE_READ },
  platform: { active: true, deploymentActive: true }, limits: null, ...over,
});

describe('POST /app-api/connections/:id/check (LA-ADR-08 D4, app API delta §3.7)', () => {
  it('checks the active platform of the connection and answers the result, checkedAt and details', async () => {
    const c = registered();
    t.lti.client.checkPlatform = async () => answer();
    const res = await check(c.id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ result: 'ok', checkedAt: '2026-10-17T08:00:00.000Z', details: {
      jwks: { ok: true, keys: 2 }, token: { ok: true, scope: SCORE_READ }, platform: { active: true, deploymentActive: true }, limits: null,
    } });
    expect(t.logs.filter((line) => line.event === 'connection_check')).toEqual([expect.objectContaining({
      trace_id: 'check-trace-1234', connection_id: c.id, platform_id: `plt_${c.id}`, jwks: { ok: true, keys: 2 }, token_result: { ok: true, scope: SCORE_READ },
    })]);
  });

  it('sends the platform id and the first deployment of the connection to the LTI service', async () => {
    const c = registered('lti-generic');
    expect((await check(c.id)).statusCode).toBe(200);
    expect(checkCalls()).toEqual([`POST check plt_${c.id} {"deploymentId":"deployment-one"}`]);
  });

  it.each([
    [{ token: { ok: false, scope: SCORE_READ, detail: 'invalid_client' } }],
    [{ jwks: { ok: false, detail: 'http_404' } }],
  ])('gives result "failed" when one part fails, and the connection status does not change (%j)', async (over) => {
    const c = registered();
    t.lti.client.checkPlatform = async () => answer(over);
    const res = await check(c.id);
    expect([res.statusCode, res.json().result]).toEqual([200, 'failed']);
    expect(res.json().details).toMatchObject(over);
    expect(getConnection(t.db, c.libraryId, c.id)!.status).toBe('registered');
  });

  it('refuses a staged, pending or disabled connection with 409 CONNECTION_NOT_READY before any LTI call (AC-LA-E6-01-04)', async () => {
    const staged = connection('canvas', { method: 'dynamic' });
    expect(stageRegistration(t.db, staged.id, 'canvas', PLATFORM, t.clock.now)).toBe(true);
    const pending = connection('lti-generic');
    const disabled = registered();
    disableConnection(t.db, disabled.libraryId, disabled.id, t.clock.now);
    for (const c of [staged, pending, disabled]) {
      const res = await check(c.id);
      expect([res.statusCode, res.json().details.message]).toEqual([409, 'CONNECTION_NOT_READY']);
    }
    expect(checkCalls()).toEqual([]);
  });

  it.each(['moodle', 'blackboard'] as const)('refuses a %s connection: its channel has no setup.connectionCheck (AC-LA-E6-01-05)', async (channel) => {
    const c = registered(channel);
    const res = await check(c.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().details).toMatchObject({ message: 'CAPABILITY_NOT_SUPPORTED', capability: 'setup.connectionCheck' });
    expect(checkCalls()).toEqual([]);
  });

  it("answers 404 for another library's connection, with no LTI call (AC-LA-E6-01-07)", async () => {
    const other = registered('canvas', QA_B.library);
    const res = await check(other.id);
    expect([res.statusCode, res.json().details.message]).toEqual([404, 'NOT_FOUND']);
    expect(checkCalls()).toEqual([]);
  });

  it('allows one check per connection per minute (429 RATE_LIMITED with Retry-After; AC-LA-E6-01-03)', async () => {
    const c = registered();
    const second = registered('lti-generic');
    expect((await check(c.id)).statusCode).toBe(200);
    const again = await check(c.id);
    expect([again.statusCode, again.json().details.message, again.json().details.retryAfter, again.headers['retry-after']]).toEqual([429, 'RATE_LIMITED', 60, '60']);
    t.clock.now += 45_000;
    expect((await check(c.id)).headers['retry-after']).toBe('15');
    expect((await check(second.id)).statusCode).toBe(200);
    t.clock.now += 15_000;
    expect((await check(c.id)).statusCode).toBe(200);
    expect(checkCalls()).toHaveLength(3);
  });

  it.each([
    [new LtiServiceError(403, 'PLATFORM_NOT_ACTIVE', ''), 409, 'CONNECTION_NOT_READY'],
    [new LtiServiceError(403, 'DEPLOYMENT_NOT_ACTIVE', ''), 409, 'CONNECTION_NOT_READY'],
    [new LtiServiceError(404, 'UNKNOWN_DEPLOYMENT', ''), 409, 'CONNECTION_NOT_READY'],
    [new LtiServiceError(503, 'HTTP_503', ''), 502, 'LTI_SERVICE_ERROR'],
    [new LtiServiceError(0, 'LTI_SERVICE_UNREACHABLE', ''), 502, 'LTI_SERVICE_ERROR'],
  ])('maps the LTI refusal %s to %i %s', async (error, status, code) => {
    const c = registered();
    t.lti.client.checkPlatform = async () => { throw error; };
    const res = await check(c.id);
    expect([res.statusCode, res.json().details.message]).toEqual([status, code]);
    expect(t.logs.filter((line) => line.event === 'connection_check_failed')).toEqual([expect.objectContaining({ connection_id: c.id, lti_status: error.status, lti_code: error.code })]);
  });

  it('passes the wait of an LTI 429 to the portal', async () => {
    const c = registered();
    t.lti.client.checkPlatform = async () => { throw new LtiServiceError(429, 'RATE_LIMITED', '', null, 17); };
    const res = await check(c.id);
    expect([res.statusCode, res.json().details.message, res.json().details.retryAfter, res.headers['retry-after']]).toEqual([429, 'RATE_LIMITED', 17, '17']);
  });
});
