import type { OutboundClient, OutboundRequest, OutboundResponse } from '@cogniate/shared';
import Fastify from 'fastify';
import { createLocalJWKSet, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api-errors.ts';
import { openDb } from '../../db/index.ts';
import { CLAIM } from '../../lti/checks.ts';
import { AGS_SCOPES, createAgsClient } from '../../platform/ags.ts';
import { createScoreClock } from '../../platform/score-clock.ts';
import { createTokenClient } from '../../platform/token-client.ts';
import { ensureAccount, getAccount } from '../../store/accounts.ts';
import { ensureToolKey, publicJwks } from '../../store/tool-keys.ts';
import type { LaunchRecord } from '../../store/launches.ts';
import { createPlatform, updatePlatform } from '../../store/platforms.ts';
import { findServiceKey } from '../../store/service-keys.ts';
import { CLIENT_ID, ISSUER, LAUNCH, MASTER_KEY, URLS, capturingLogger } from '../../testkit.ts';
import { serviceKeyForLaunch } from '../../lti/service-keys.ts';
import type { AuthResult, Scheme } from '../auth.ts';
import type { RouteContext } from '../context.ts';
import { registerServiceRoutes } from './services.ts';

const LINE_ITEM = 'https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1';
const AGS = { scope: [AGS_SCOPES.lineitemReadonly, AGS_SCOPES.score, AGS_SCOPES.resultReadonly], lineitems: 'https://moodle.test/mod/lti/services.php/2/lineitems?type_id=1', lineitem: LINE_ITEM };
const RETURN_URL = `${ISSUER}/mod/lti/contentitem_return.php?course=2&id=1`;

async function setup() {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'cogniate');
  const platform = createPlatform(db, 'cogniate', {
    issuer: ISSUER, clientId: CLIENT_ID, name: 'Moodle', authEndpoint: `${ISSUER}/mod/lti/auth.php`, tokenEndpoint: `${ISSUER}/mod/lti/token.php`,
    jwksUrl: `${ISSUER}/mod/lti/certs.php`, deploymentIds: ['1'], active: true,
  });
  const launch = (messageType: string, claims: Record<string, unknown>): LaunchRecord => ({ id: 'lch', toolAccountId: 'cogniate', platformId: platform.id, deploymentId: '1', messageType, claims, expiresAt: 0, siteOrigin: null, serviceOrigin: null, bindingGeneration: 0 });
  const rlLaunch = launch('LtiResourceLinkRequest', { [CLAIM.ags]: AGS, [CLAIM.context]: { id: '2' }, [CLAIM.resourceLink]: { id: 'rl-3' } });
  const dlLaunch = launch('LtiDeepLinkingRequest', { [CLAIM.deepLinkingSettings]: { deep_link_return_url: RETURN_URL, accept_types: ['ltiResourceLink'], accept_multiple: true } });
  const calls: string[] = [];
  const answers: Array<() => OutboundResponse> = [];
  const res = (status: number, body: unknown = ''): OutboundResponse => {
    const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    return { status, headers: {}, body: buf, text: () => buf.toString(), json: () => JSON.parse(buf.toString()) as unknown };
  };
  const outbound: OutboundClient = {
    allowlist: [],
    async request(url: string, _req?: OutboundRequest) {
      calls.push(url);
      if (url.endsWith('/token.php')) return res(200, { access_token: 'tok', expires_in: 3600 });
      return answers.shift()?.() ?? res(500);
    },
  };
  const { logger } = capturingLogger();
  const now = () => Date.now();
  const ags = createAgsClient({ outbound, tokens: createTokenClient({ db, masterKey: MASTER_KEY, outbound, logger, now }), clock: createScoreClock(now) });
  const account = getAccount(db, 'cogniate')!;
  // Fake auth: the test header names the caller. The real one is auth.ts (LTIK-AUTH-V2 / SERVICE-AUTH-V1).
  const auth = (req: { headers: Record<string, unknown> }, schemes: Scheme[]): AuthResult => {
    const who = String(req.headers['x-test-caller']);
    if (who === 'service') {
      if (!schemes.includes('service')) throw new ApiError('INVALID_AUTHORIZATION_HEADER');
      return { scheme: 'service', serviceKeyHash: 'unit-service-key-hash', account, actor: { type: 'api_key', id: 'bootstrap-cogniate' }, launch: null, serviceKey: { toolAccountId: 'cogniate', platformId: platform.id, deploymentId: '1', contextId: '2', resourceLinkId: 'rl-3', agsClaim: AGS, nrpsClaim: null, bindingGeneration: 0 } };
    }
    return { scheme: 'ltik', account, actor: { type: 'api_key', id: 'bootstrap-cogniate' }, launch: who === 'dl' ? dlLaunch : rlLaunch, serviceKey: null };
  };
  const app = Fastify({ maxParamLength: 2048 });
  app.decorateRequest('traceId', 'trace-test');
  app.setErrorHandler((err, _req, reply) => (err instanceof ApiError ? reply.code(err.status).send(err.body()) : reply.code(500).send({ error: String(err) })));
  const ctx = { db, urls: URLS, logger, masterKey: MASTER_KEY, ags, outbound, now, auth, profiles: { simulation: false } } as unknown as RouteContext;
  registerServiceRoutes(app, ctx);
  return { db, platform, app, calls, answers, res, rlLaunch, dlLaunch };
}

const enc = encodeURIComponent;

describe('T3a routes', () => {
  it('POST /api/deeplinking: 200 {message, target}; the message verifies with the tool keys', async () => {
    const s = await setup();
    const item = { type: 'ltiResourceLink', title: 'QA DL', url: `${LAUNCH}?resource=qa-dl`, lineItem: { scoreMaximum: 100, label: 'QA DL' } };
    const r = await s.app.inject({ method: 'POST', url: '/api/deeplinking', headers: { 'x-test-caller': 'dl' }, payload: { contentItems: [item] } });
    expect(r.statusCode).toBe(200);
    const { message, target } = r.json() as { message: string; target: string };
    expect(target).toBe(RETURN_URL);
    const { payload } = await jwtVerify(message, createLocalJWKSet({ keys: publicJwks(s.db, 'cogniate') }), { issuer: CLIENT_ID, audience: ISSUER });
    expect(payload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items']).toEqual([item]);
    expect(payload.exp! - payload.iat!).toBe(330);
    expect(payload.iat!).toBeLessThanOrEqual(Date.now() / 1000 - 25);
  });

  it('a resource-link ltik on /api/deeplinking -> 403 SERVICE_NOT_AVAILABLE; a bad item -> 400 INVALID_CONTENT_ITEM', async () => {
    const s = await setup();
    const r1 = await s.app.inject({ method: 'POST', url: '/api/deeplinking', headers: { 'x-test-caller': 'rl' }, payload: { contentItems: [{ type: 'ltiResourceLink' }] } });
    expect([r1.statusCode, r1.json().details.message]).toEqual([403, 'SERVICE_NOT_AVAILABLE']);
    const r2 = await s.app.inject({ method: 'POST', url: '/api/deeplinking', headers: { 'x-test-caller': 'dl' }, payload: { contentItems: [{ type: 'ltiResourceLink', url: 'https://evil.test/x' }] } });
    expect([r2.statusCode, r2.json().details.message]).toEqual([400, 'INVALID_CONTENT_ITEM']);
  });

  it('POST scores with an encoded line item id (ltik and service key) -> 204; the AGS call goes to <id>/scores', async () => {
    const s = await setup();
    const body = { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 87, scoreMaximum: 100 };
    for (const caller of ['rl', 'service']) {
      s.answers.push(() => s.res(204));
      const r = await s.app.inject({ method: 'POST', url: `/api/lineitems/${enc(LINE_ITEM)}/scores`, headers: { 'x-test-caller': caller }, payload: body });
      expect(r.statusCode, caller).toBe(204);
    }
    expect(s.calls.filter((u) => !u.endsWith('/token.php'))).toEqual([
      'https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem/scores?type_id=1',
      'https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem/scores?type_id=1',
    ]);
  });

  it('a foreign line item id -> 400 INVALID_LINE_ITEM_ID with no outbound call; a bad score body -> 400 INVALID_REQUEST', async () => {
    const s = await setup();
    const r = await s.app.inject({ method: 'POST', url: `/api/lineitems/${enc('https://evil.test/x')}/scores`, headers: { 'x-test-caller': 'rl' }, payload: { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded' } });
    expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_LINE_ITEM_ID']);
    const b = await s.app.inject({ method: 'POST', url: `/api/lineitems/${enc(LINE_ITEM)}/scores`, headers: { 'x-test-caller': 'rl' }, payload: { userId: '5' } });
    expect([b.statusCode, b.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    expect(s.calls).toEqual([]);
  });

  it('refuses a ninth extension or a value over 4 KB before any outbound call (LA-E3-11 AC-03)', async () => {
    const s = await setup();
    const score = { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded' };
    const tooMany = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`https://platform.test/ext/${i}`, i]));
    for (const extra of [tooMany, { 'https://platform.test/ext': 'x'.repeat(4095) }, { 'https://platform.test/ext': 'é'.repeat(2048) }]) {
      for (const caller of ['rl', 'service']) {
        const r = await s.app.inject({ method: 'POST', url: `/api/lineitems/${enc(LINE_ITEM)}/scores`,
          headers: { 'x-test-caller': caller }, payload: { ...score, ...extra } });
        expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
        expect(s.calls).toEqual([]);
      }
    }
    await s.app.close();
    s.db.close();
  });

  it('GET line items, one line item and scores; a bad limit -> 400', async () => {
    const s = await setup();
    s.answers.push(() => s.res(200, [{ id: LINE_ITEM, label: 'QA DL', scoreMaximum: 100 }]));
    expect((await s.app.inject({ method: 'GET', url: '/api/lineitems?resourceLinkId=rl-3', headers: { 'x-test-caller': 'service' } })).json())
      .toEqual({ lineItems: [{ id: LINE_ITEM, label: 'QA DL', scoreMaximum: 100 }] });
    s.answers.push(() => s.res(200, { id: LINE_ITEM, label: 'QA DL', scoreMaximum: 100 }));
    expect((await s.app.inject({ method: 'GET', url: `/api/lineitems/${enc(LINE_ITEM)}`, headers: { 'x-test-caller': 'rl' } })).json()).toMatchObject({ label: 'QA DL' });
    s.answers.push(() => s.res(200, [{ userId: '5', resultScore: 92, resultMaximum: 100 }]));
    expect((await s.app.inject({ method: 'GET', url: `/api/lineitems/${enc(LINE_ITEM)}/scores?userId=5`, headers: { 'x-test-caller': 'rl' } })).json())
      .toEqual({ scores: [{ userId: '5', resultScore: 92, resultMaximum: 100 }] });
    const bad = await s.app.inject({ method: 'GET', url: '/api/lineitems?limit=0', headers: { 'x-test-caller': 'rl' } });
    expect(bad.statusCode).toBe(400);
  });

  it('an inactive platform -> 403 PLATFORM_NOT_ACTIVE, no outbound call', async () => {
    const s = await setup();
    updatePlatform(s.db, 'cogniate', s.platform.id, { active: false });
    const r = await s.app.inject({ method: 'GET', url: `/api/lineitems/${enc(LINE_ITEM)}`, headers: { 'x-test-caller': 'service' } });
    expect([r.statusCode, r.json().details.message]).toEqual([403, 'PLATFORM_NOT_ACTIVE']);
    expect(s.calls).toEqual([]);
  });

  it('serviceKeyForLaunch: AGS + context + resource link -> a stable key; a deep-linking launch -> none', async () => {
    const s = await setup();
    const k1 = serviceKeyForLaunch(s.db, MASTER_KEY, s.rlLaunch, 1);
    const k2 = serviceKeyForLaunch(s.db, MASTER_KEY, { ...s.rlLaunch, id: 'lch-2', claims: { ...s.rlLaunch.claims, sub: 'other-user' } }, 2);
    expect(k1).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(k2).toBe(k1);
    expect(findServiceKey(s.db, 'cogniate', k1!)).toMatchObject({ contextId: '2', resourceLinkId: 'rl-3', agsClaim: AGS });
    expect(serviceKeyForLaunch(s.db, MASTER_KEY, s.dlLaunch, 3)).toBeUndefined();
  });
});
