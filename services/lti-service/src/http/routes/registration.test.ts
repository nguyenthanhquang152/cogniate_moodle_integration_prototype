import type { OutboundClient, OutboundRequest, OutboundResponse } from '@cogniate/shared';
import { OutboundError } from '@cogniate/shared';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../db/index.ts';
import { createPlatformKeys } from '../../lti/jwks.ts';
import { PLATFORM_CONFIG_CLAIM, TOOL_CONFIG_CLAIM } from '../../lti/registration.ts';
import { createAgsClient } from '../../platform/ags.ts';
import { createScoreClock } from '../../platform/score-clock.ts';
import { createTokenClient } from '../../platform/token-client.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { getPlatform } from '../../store/platforms.ts';
import { ensureToolKey } from '../../store/tool-keys.ts';
import { MASTER_KEY, URLS, capturingLogger, makeKey, sign } from '../../testkit.ts';
import { buildApp } from '../app.ts';

const M = 'https://moodle.test';
const CONFIG_URL = `${M}/mod/lti/openid-configuration.php`;
const CONFIG = {
  issuer: M, token_endpoint: `${M}/mod/lti/token.php`, jwks_uri: `${M}/mod/lti/certs.php`, authorization_endpoint: `${M}/mod/lti/auth.php`,
  registration_endpoint: `${M}/mod/lti/openid-registration.php`,
  scopes_supported: ['https://purl.imsglobal.org/spec/lti-ags/scope/score', 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'],
  [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'moodle', version: '5.2.4 (Build: 20261005)', messages_supported: [{ type: 'LtiResourceLinkRequest' }, { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] }] },
};

async function setup() {
  const db = openDb(':memory:');
  const a = ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  const b = ensureAccount(db, { id: 'qa-second', name: 'QA second', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'cogniate');
  const moodleKey = await makeKey('moodle-kid');
  const state = { config: CONFIG as Record<string, unknown>, nextTypeId: 11, clientId: 'client-dyn-1', registrations: [] as Array<{ auth?: string; body: Record<string, unknown> }>, reject: null as null | number,
    mode: null as null | 'timeout' | 'token_used' | 'server_error' | 'garbage' };
  const res = (status: number, body: unknown): OutboundResponse => {
    const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    return { status, headers: {}, body: buf, text: () => buf.toString(), json: () => JSON.parse(buf.toString()) as unknown };
  };
  const outbound: OutboundClient = {
    allowlist: [],
    async request(url: string, req: OutboundRequest = {}) {
      const u = new URL(url);
      if (u.protocol !== 'https:') throw new OutboundError('not_https', u.hostname, 'only https');
      if (u.hostname === '169.254.169.254') throw new OutboundError('private_ip', u.hostname, 'private');
      if (url === CONFIG_URL || url.startsWith('https://qa-platform.test/')) return res(200, state.config);
      if (url === CONFIG.jwks_uri) return res(200, { keys: [moodleKey.publicJwk] });
      if (url === CONFIG.registration_endpoint) {
        state.registrations.push({ auth: req.headers?.authorization, body: JSON.parse(String(req.body)) as Record<string, unknown> });
        if (state.mode === 'timeout') throw new OutboundError('timeout', 'moodle.test', 'slow');
        if (state.mode === 'token_used') return res(401, 'token_already_used');
        if (state.mode === 'server_error') return res(500, 'error');
        if (state.mode === 'garbage') return res(200, 'not json');
        if (state.reject) return res(state.reject, 'domain_targetlinkuri_mismatch');
        return res(200, { client_id: state.clientId, [TOOL_CONFIG_CLAIM]: { deployment_id: String(state.nextTypeId) } });
      }
      return res(404, 'not found');
    },
  };
  const { logger, lines } = capturingLogger();
  const clock = { now: Date.now() };
  const tokens = createTokenClient({ db, masterKey: MASTER_KEY, outbound, logger, now: () => clock.now });
  const app = await buildApp({
    db, urls: URLS, logger, keys: createPlatformKeys(outbound, () => clock.now), ltikTtlSeconds: 86400, masterKey: MASTER_KEY, outbound,
    ags: createAgsClient({ outbound, tokens, clock: createScoreClock(() => clock.now) }), profile: 'default', knobs: [], now: () => clock.now,
  });
  const regToken = (claims: Record<string, unknown>) => {
    const now = Math.floor(clock.now / 1000);
    return sign(moodleKey, { iat: now, exp: now + 3600, ...claims });
  };
  const start = async (token: string | undefined, extra: Record<string, string> = {}, account = 'cogniate') => {
    const q = new URLSearchParams({ openid_configuration: CONFIG_URL, ...(token ? { registration_token: token } : {}), ...extra });
    return app.inject({ method: 'GET', url: `/lti/register/${account}?${q}` });
  };
  const bearer = (key = a.apiKey!) => ({ authorization: `Bearer ${key}` });
  return { db, app, state, lines, clock, regToken, start, bearer, apiKey2: b.apiKey! };
}
const idOf = (location: string) => new URL(location).searchParams.get('registrationId')!;

describe('dynamic registration (contract §2.4, §3.8)', () => {
  it('new: 303 to the app with registrationId and ref only; GET shows the platform data; complete registers and stores the platform', async () => {
    const s = await setup();
    const r = await s.start(await s.regToken({ scope: 'reg', sub: 'new-client' }), { ref: 'qa123' });
    expect(r.statusCode).toBe(303);
    const loc = new URL(String(r.headers.location));
    expect(`${loc.origin}${loc.pathname}`).toBe(`${URLS.app}/tool/register`);
    expect([...loc.searchParams.keys()].sort()).toEqual(['ref', 'registrationId']);
    expect(loc.searchParams.get('ref')).toBe('qa123');
    const id = idOf(loc.href);
    expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_started', registration_id: id, operation: 'new' }));

    const g = await s.app.inject({ method: 'GET', url: `/api/registrations/${id}`, headers: s.bearer() });
    expect(g.json()).toEqual({
      url: M, familyCode: 'moodle', version: '5.2.4 (Build: 20261005)', supportedScopes: CONFIG.scopes_supported,
      supportedMessages: [{ type: 'LtiResourceLinkRequest' }, { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] }],
      privacyLevel: 'anonymous', operation: 'new', existingPlatformId: null,
    });
    expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id}?raw=true`, headers: s.bearer() })).json().raw.issuer).toBe(M);

    const c = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: { platformName: 'QA dyn 1' } });
    expect(c.statusCode).toBe(200);
    expect(c.json().html).toContain('org.imsglobal.lti.close');
    const platform = getPlatform(s.db, 'cogniate', c.json().platformId)!;
    expect(platform).toMatchObject({ issuer: M, clientId: 'client-dyn-1', name: 'QA dyn 1', active: true, deploymentIds: ['11'], productFamilyCode: 'moodle', tokenEndpoint: CONFIG.token_endpoint });
    const sent = s.state.registrations[0]!;
    expect(sent.auth).toMatch(/^Bearer ey/);
    expect(sent.body).toMatchObject({ client_name: 'QA dyn 1', token_endpoint_auth_method: 'private_key_jwt', jwks_uri: `${URLS.lti}/lti/keys/cogniate` });
    expect((sent.body[TOOL_CONFIG_CLAIM] as { claims: string[] }).claims).toEqual(['iss', 'sub']);
    expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_completed', platform_id: platform.id, operation: 'new' }));

    // AC-T3-04
    const again = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} });
    expect([again.statusCode, again.json().details.message]).toEqual([409, 'REGISTRATION_ALREADY_COMPLETED']);
    expect((await s.app.inject({ method: 'GET', url: '/api/registrations/reg_unknown', headers: s.bearer() })).json().details.message).toBe('REGISTRATION_NOT_FOUND');
    expect((await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, payload: {} })).statusCode).toBe(401);
    expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id}`, headers: s.bearer(s.apiKey2) })).statusCode).toBe(404); // other account
    expect(JSON.stringify(s.lines)).not.toContain(String(sent.auth).slice(7));
  });

  it('update (AC-T3-25, AC-T3-26): only with updatePlatformId = existingPlatformId; refused updates send nothing to Moodle', async () => {
    const s = await setup();
    const first = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c1' }))).headers.location));
    const created = (await s.app.inject({ method: 'POST', url: `/api/registrations/${first}/complete`, headers: s.bearer(), payload: { platformName: 'QA dyn' } })).json().platformId as string;

    const id2 = idOf(String((await s.start(await s.regToken({ scope: 'reg-update', sub: '11' }))).headers.location));
    expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id2}`, headers: s.bearer() })).json()).toMatchObject({ operation: 'update', existingPlatformId: created });
    const sentBefore = s.state.registrations.length;
    for (const payload of [{}, { updatePlatformId: 'plt_other' }]) {
      const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id2}/complete`, headers: s.bearer(), payload });
      expect([r.statusCode, r.json().details.message]).toEqual([409, 'REGISTRATION_UPDATE_NOT_ALLOWED']);
    }
    expect(s.state.registrations.length).toBe(sentBefore);
    expect(s.lines.filter((l) => l.event === 'registration_rejected' && l.code === 'REGISTRATION_UPDATE_NOT_ALLOWED')).toHaveLength(2);

    const ok = await s.app.inject({ method: 'POST', url: `/api/registrations/${id2}/complete`, headers: s.bearer(), payload: { updatePlatformId: created, platformName: 'QA dyn' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().platformId).toBe(created);
    expect(getPlatform(s.db, 'cogniate', created)!.clientId).toBe('client-dyn-1');
    expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_completed', platform_id: created, operation: 'update' }));
  });

  it('an update of a tool that this account does not have: existingPlatformId null, complete is refused', async () => {
    const s = await setup();
    const id = idOf(String((await s.start(await s.regToken({ scope: 'reg-update', sub: '999' }))).headers.location));
    expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id}`, headers: s.bearer() })).json()).toMatchObject({ operation: 'update', existingPlatformId: null });
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: { updatePlatformId: 'plt_x' } });
    expect(r.statusCode).toBe(409);
    expect(s.state.registrations).toEqual([]);
  });

  it('error pages (AC-T3-05, AC-T3-28): unknown account 404; private IP, http and issuer mismatch 400; frameable by https origins', async () => {
    const s = await setup();
    const unknown = await s.start(await s.regToken({ scope: 'reg', sub: 'x' }), {}, 'unknown');
    expect(unknown.statusCode).toBe(404);
    expect(unknown.body).toContain('data-error-code="UNKNOWN_TOOL_ACCOUNT"');
    expect(unknown.body).toMatch(/data-trace-id="[A-Za-z0-9-]+"/);
    expect(unknown.body).toContain('The registration did not work');
    expect(String(unknown.headers['content-security-policy'])).toContain('frame-ancestors https:');
    const page = async (configUrl: string) => s.app.inject({ method: 'GET', url: `/lti/register/cogniate?openid_configuration=${encodeURIComponent(configUrl)}` });
    expect((await page('https://169.254.169.254/x')).body).toContain('data-error-code="FETCH_FAILED"');
    expect((await page('http://moodle.test/mod/lti/openid-configuration.php')).body).toContain('data-error-code="FETCH_FAILED"');
    s.state.config = { ...CONFIG, issuer: 'https://moodle.test' };
    const mismatch = await page('https://qa-platform.test/openid-configuration.json');
    expect([mismatch.statusCode, /data-error-code="([A-Z_]+)"/.exec(mismatch.body)?.[1]]).toEqual([400, 'ISSUER_MISMATCH']);
    expect((await s.app.inject({ method: 'GET', url: '/lti/register/cogniate' })).body).toContain('data-error-code="INVALID_REQUEST"');
    expect(s.lines.filter((l) => l.event === 'registration_rejected').map((l) => l.code)).toEqual(['UNKNOWN_TOOL_ACCOUNT', 'FETCH_FAILED', 'FETCH_FAILED', 'ISSUER_MISMATCH', 'INVALID_REQUEST']);
  });

  it('a token that is not signed by the platform, an expired token, or a wrong scope -> INVALID_OPENID_CONFIGURATION page', async () => {
    const s = await setup();
    const stranger = await makeKey('moodle-kid');
    const now = Math.floor(s.clock.now / 1000);
    for (const token of [await sign(stranger, { scope: 'reg', sub: 'x', iat: now, exp: now + 60 }), await s.regToken({ scope: 'reg', sub: 'x', exp: now - 120 }), await s.regToken({ scope: 'admin', sub: 'x' })]) {
      const r = await s.start(token);
      expect(r.body, token.slice(0, 10)).toContain('data-error-code="INVALID_OPENID_CONFIGURATION"');
    }
  });

  it('the platform refuses the registration: 502 PLATFORM_ERROR with its code; the session can be completed again later', async () => {
    const s = await setup();
    const id = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c' }))).headers.location));
    s.state.reject = 400;
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} });
    expect([r.statusCode, r.json().details.message]).toEqual([502, 'PLATFORM_ERROR']);
    expect(r.json().details.description).toContain('domain_targetlinkuri_mismatch');
    s.state.reject = null;
    expect((await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} })).statusCode).toBe(200);
  });

  it('B-T3b-01: the pages speak to the Moodle admin; the "cannot reach Moodle" page names public https', async () => {
    const s = await setup();
    const unknown = await s.start(await s.regToken({ scope: 'reg', sub: 'x' }), {}, 'unknown');
    expect(unknown.body).toMatch(/<p data-error-action>This registration URL is not valid\. Copy it again in Cogniate/);
    const fetchFailed = await s.app.inject({ method: 'GET', url: `/lti/register/cogniate?openid_configuration=${encodeURIComponent('https://169.254.169.254/x')}` });
    expect(fetchFailed.body).toContain('must be reachable from the internet over https (port 443)');
    expect(fetchFailed.body.match(/data-error-action/g)).toHaveLength(1);
  });

  it.each([
    ['a timeout', 'timeout'], ['Moodle 401 token_already_used (a retry)', 'token_used'], ['a Moodle 5xx', 'server_error'], ['an unreadable 2xx answer', 'garbage'],
  ] as const)('A-T3b-01: %s -> PLATFORM_ERROR "tool may exist", logged; no automatic clean-up', async (_n, mode) => {
    const s = await setup();
    const id = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c' }))).headers.location));
    s.state.mode = mode;
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} });
    expect([r.statusCode, r.json().details.message, r.json().details.reason]).toEqual([502, 'PLATFORM_ERROR', 'tool_may_exist']);
    // B-T4b1-02: the same text as the app page, with the tool name that was sent to Moodle.
    expect(r.json().details.description).toMatch(/^Moodle may have saved a Pending tool\. In Manage tools, delete the Pending tool '[^']+', then connect again\.$/);
    expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_rejected', code: 'PLATFORM_ERROR', detail: 'tool_may_exist' }));
  });

  it('a certain refusal (Moodle 400) is a normal PLATFORM_ERROR without the "tool may exist" reason', async () => {
    const s = await setup();
    const id = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c' }))).headers.location));
    s.state.reject = 400;
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} });
    expect(r.json().details.reason).toBeUndefined();
  });

  it('B-T3b-02: a "new" registration answered with a client id we have is an update of that platform (same id, new values, operation update)', async () => {
    const s = await setup();
    const first = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c1' }))).headers.location));
    const created = (await s.app.inject({ method: 'POST', url: `/api/registrations/${first}/complete`, headers: s.bearer(), payload: { platformName: 'Old name' } })).json().platformId;
    s.state.nextTypeId = 12; // same client id, another deployment
    const second = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c2' }))).headers.location));
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${second}/complete`, headers: s.bearer(), payload: { platformName: 'New name' } });
    expect(r.json().platformId).toBe(created);
    expect(getPlatform(s.db, 'cogniate', created)).toMatchObject({ name: 'New name', deploymentIds: ['11', '12'] });
    expect(s.lines.filter((l) => l.event === 'registration_completed').map((l) => l.operation)).toEqual(['new', 'update']);
  });

  it('A-T4b1-03: the B-T3b-02 path keeps a switched-off platform inactive (autoActivate does not switch it on again)', async () => {
    const s = await setup();
    const first = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c1' }))).headers.location));
    const created = (await s.app.inject({ method: 'POST', url: `/api/registrations/${first}/complete`, headers: s.bearer(), payload: {} })).json().platformId;
    const off = await s.app.inject({ method: 'PATCH', url: `/api/platforms/${created}`, headers: s.bearer(), payload: { active: false } });
    expect(off.statusCode).toBe(200);
    s.state.nextTypeId = 12;
    const second = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c2' }))).headers.location));
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${second}/complete`, headers: s.bearer(), payload: { autoActivate: true } });
    expect(r.json().platformId).toBe(created);
    expect(getPlatform(s.db, 'cogniate', created)!.active).toBe(false);
  });

  it('A-T3b-03: a message target of another account is refused; the stored token is dropped after completion', async () => {
    const s = await setup();
    const id = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c' }))).headers.location));
    const bad = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(),
      payload: { messages: [{ type: 'LtiDeepLinkingRequest', target_link_uri: `${URLS.lti}/lti/launch/qa-second` }] } });
    expect([bad.statusCode, bad.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    expect(s.state.registrations).toEqual([]);
    expect((await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} })).statusCode).toBe(200);
    expect(s.db.prepare('SELECT registration_token_encrypted AS t FROM registration_session WHERE id = ?').get(id)?.t).toBeNull();
  });

  it('a session expires with the token (at most 1 h)', async () => {
    const s = await setup();
    const id = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c' }))).headers.location));
    s.clock.now += 3600 * 1000 + 1;
    expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id}`, headers: s.bearer() })).statusCode).toBe(404);
  });
});
