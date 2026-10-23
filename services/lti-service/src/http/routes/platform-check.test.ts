import { OutboundError } from '@cogniate/shared';
import { decodeJwt } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import { listAuditEvents } from '../../store/audit.ts';
import { createPlatform } from '../../store/platforms.ts';
import type { Harness } from '../../testkit.ts';
import { harness } from '../../testkit.ts';

const SECRET_TOKEN = 'platform-access-token-value';
const LINEITEM_READONLY = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly';
const SCORE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';
type Answer = { status: number; body: unknown } | Error | undefined;

const resources: Harness[] = [];
afterEach(async () => { for (const h of resources.splice(0)) { await h.app.close(); h.db.close(); } });

/** The harness with a token endpoint answer and a JWKS answer (undefined = the harness key set). */
async function fixture() {
  const answers: { token: Answer; jwks: Answer } = { token: { status: 200, body: { access_token: SECRET_TOKEN, expires_in: 3600 } }, jwks: undefined };
  const h = await harness({
    outbound: (_url, init) => {
      const answer = init.method === 'POST' ? answers.token : answers.jwks;
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  resources.push(h);
  const check = (platformId = h.platform.id, payload: unknown = {}, apiKey = h.apiKey) => h.app.inject({
    method: 'POST', url: `/api/platforms/${platformId}/check`,
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, payload: JSON.stringify(payload),
  });
  const events = () => listAuditEvents(h.db, { limit: 100 }).events.filter((event) => event.action === 'platform.check');
  const tokenRequests = () => h.outbound.requests.filter((request) => request.method === 'POST');
  return { ...h, answers, check, events, tokenRequests };
}

describe('POST /api/platforms/:id/check (LA-ADR-08 D4, contract delta §2.6)', () => {
  it('checks the JWKS and one token request, returns no token, logs and audits without a token value', async () => {
    const h = await fixture();
    const res = await h.check();
    expect(res.statusCode).toBe(200);
    const answer = { jwks: { ok: true, keys: 1 }, token: { ok: true, scope: LINEITEM_READONLY } };
    expect(res.json()).toEqual({ checkedAt: new Date(h.clock.now).toISOString(), ...answer, platform: { active: true, deploymentActive: true }, limits: null });
    expect(h.outbound.requests.map((request) => [request.method, request.url])).toEqual(expect.arrayContaining([
      ['GET', h.platform.jwksUrl], ['POST', h.platform.tokenEndpoint],
    ]));
    expect(h.outbound.requests).toHaveLength(2);
    const sent = new URLSearchParams(h.tokenRequests()[0]!.body);
    expect([sent.get('grant_type'), sent.get('scope')]).toEqual(['client_credentials', LINEITEM_READONLY]);
    const assertion = sent.get('client_assertion')!;
    expect(decodeJwt(assertion)).toMatchObject({ iss: h.platform.clientId, sub: h.platform.clientId, aud: h.platform.tokenEndpoint });
    // AC-LA-E6-01-08 and -10: no token or assertion value in the answer, the log line or the audit event.
    const events = h.events();
    expect(events).toEqual([expect.objectContaining({
      actor: { type: 'api_key', id: expect.any(String) }, toolAccountId: 'cogniate', target: { type: 'platform', id: h.platform.id },
      result: 'ok', details: { deploymentId: '1', jwks: answer.jwks, tokenResult: answer.token },
    })]);
    expect(h.lines.filter((line) => line.event === 'platform_check')).toEqual([expect.objectContaining({ platform_id: h.platform.id, jwks: answer.jwks, token_result: answer.token })]);
    for (const text of [res.body, JSON.stringify(h.lines), JSON.stringify(events)]) {
      expect(text).not.toContain(SECRET_TOKEN);
      expect(text).not.toContain(assertion);
    }
  });

  it('never caches the token: the next check makes a new token request', async () => {
    const h = await fixture();
    expect((await h.check()).statusCode).toBe(200);
    h.clock.now += 60_000;
    expect((await h.check()).statusCode).toBe(200);
    expect(h.tokenRequests()).toHaveLength(2);
  });

  it.each([
    [{ status: 401, body: { error: 'invalid_client' } }, 'invalid_client'],
    [{ status: 400, body: { error: 'invalid_scope' } }, 'invalid_scope'],
    [{ status: 400, body: { error: 'invalid_grant' } }, 'http_400'],
    [{ status: 500, body: 'Server error' }, 'http_500'],
    [{ status: 429, body: {} }, 'http_429'],
    [{ status: 200, body: { expires_in: 3600 } }, 'invalid_token_response'],
    [new OutboundError('timeout', 'moodle.test', 'timeout'), 'timeout'],
  ] as const)('gives the token answer class %j -> %s', async (answer, detail) => {
    const h = await fixture();
    h.answers.token = answer;
    const res = await h.check();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ jwks: { ok: true, keys: 1 }, token: { ok: false, scope: LINEITEM_READONLY, detail } });
  });

  it.each([
    [{ status: 404, body: {} }, 'http_404'],
    [{ status: 200, body: { keys: [] } }, 'invalid_jwks'],
    [{ status: 200, body: 'not json' }, 'invalid_jwks'],
    [new OutboundError('private_ip', 'moodle.test', 'private address'), 'private_ip'],
  ] as const)('gives the JWKS failure %j -> %s', async (answer, detail) => {
    const h = await fixture();
    h.answers.jwks = answer;
    const res = await h.check();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ jwks: { ok: false, detail }, token: { ok: true } });
  });

  it('asks for score when lineitem.readonly is not granted, and makes no token request without a granted AGS scope (BD-A2-98)', async () => {
    const h = await fixture();
    h.db.prepare('UPDATE platform SET granted_scopes = ? WHERE id = ?').run(JSON.stringify([SCORE]), h.platform.id);
    expect((await h.check()).json()).toMatchObject({ token: { ok: true, scope: SCORE } });
    h.db.prepare('UPDATE platform SET granted_scopes = ? WHERE id = ?').run(JSON.stringify(['https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly']), h.platform.id);
    h.clock.now += 60_000;
    expect((await h.check()).json()).toMatchObject({ token: { ok: false, detail: 'no_granted_scope' } });
    expect(h.tokenRequests()).toHaveLength(1);
  });

  it('refuses a staged (inactive) platform before any outbound call (AC-LA-E6-01-04, A-LAD-01)', async () => {
    const h = await fixture();
    h.db.prepare('UPDATE platform SET active = 0 WHERE id = ?').run(h.platform.id);
    const res = await h.check();
    expect([res.statusCode, res.json().details.message]).toEqual([403, 'PLATFORM_NOT_ACTIVE']);
    expect(h.outbound.requests).toEqual([]);
    expect(h.events()).toEqual([expect.objectContaining({ result: 'refused', code: 'PLATFORM_NOT_ACTIVE' })]);
  });

  it('refuses an unknown deployment with 404 and an inactive one with 403 before any outbound call (BD-A2-98)', async () => {
    const h = await fixture();
    const unknown = await h.check(h.platform.id, { deploymentId: 'absent' });
    expect([unknown.statusCode, unknown.json().details.message]).toEqual([404, 'UNKNOWN_DEPLOYMENT']);
    h.db.prepare('UPDATE deployment SET active = 0 WHERE platform_id = ?').run(h.platform.id);
    for (const payload of [{ deploymentId: '1' }, {}]) {
      const res = await h.check(h.platform.id, payload);
      expect([res.statusCode, res.json().details.message]).toEqual([403, 'DEPLOYMENT_NOT_ACTIVE']);
    }
    expect(h.outbound.requests).toEqual([]);
  });

  it("refuses another account's platform with 404 and no outbound call (AC-LA-E6-01-07)", async () => {
    const h = await fixture();
    for (const [platformId, apiKey] of [[h.platform.id, h.otherApiKey], ['absent', h.apiKey]] as const) {
      const res = await h.check(platformId, {}, apiKey);
      expect([res.statusCode, res.json().details.message]).toEqual([404, 'UNREGISTERED_PLATFORM']);
    }
    expect(h.outbound.requests).toEqual([]);
  });

  it('allows one check per platform and deployment per minute (429 RATE_LIMITED with Retry-After)', async () => {
    const h = await fixture();
    expect((await h.check()).statusCode).toBe(200);
    const again = await h.check();
    expect([again.statusCode, again.json().details.message, again.headers['retry-after']]).toEqual([429, 'RATE_LIMITED', '60']);
    h.clock.now += 30_000;
    expect((await h.check()).headers['retry-after']).toBe('30');
    // Another platform has its own minute.
    const other = createPlatform(h.db, 'cogniate', {
      issuer: 'https://other.test', clientId: 'other', name: 'Other', authEndpoint: 'https://other.test/auth', tokenEndpoint: 'https://other.test/token',
      jwksUrl: 'https://other.test/jwks', deploymentIds: ['7'], active: true,
    });
    expect((await h.check(other.id)).statusCode).toBe(200);
    h.clock.now += 30_000;
    expect((await h.check()).statusCode).toBe(200);
    expect(h.tokenRequests()).toHaveLength(3);
    expect(h.events().map((event) => event.code).sort()).toEqual(['RATE_LIMITED', 'RATE_LIMITED', null, null, null]);
  });

  it('marks a shared platform with limits "shared-application" (AC-LA-E6-01-06)', async () => {
    const h = await fixture();
    const shared = createPlatform(h.db, 'cogniate', {
      issuer: 'https://blackboard.test', clientId: 'bb-app', name: 'Blackboard', authEndpoint: 'https://blackboard.test/auth',
      tokenEndpoint: 'https://blackboard.test/token', jwksUrl: 'https://blackboard.test/jwks', deploymentIds: ['bb-1'], active: true,
      profile: 'blackboard', shared: true,
    });
    expect((await h.check(shared.id)).json()).toMatchObject({ limits: 'shared-application', token: { ok: true } });
  });

  it('refuses unknown body keys', async () => {
    const h = await fixture();
    const res = await h.check(h.platform.id, { deploymentId: '1', scope: 'x' });
    expect([res.statusCode, res.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    expect(h.outbound.requests).toEqual([]);
  });
});
