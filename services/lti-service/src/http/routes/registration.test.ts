import type { OutboundClient, OutboundRequest, OutboundResponse } from '@cogniate/shared';
import type { ChannelManifest, LoadedChannel } from '@cogniate/channel-kernel';
import { loadChannelFolders } from '@cogniate/channel-kernel';
import { OutboundError } from '@cogniate/shared';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../db/index.ts';
import { createPlatformKeys } from '../../lti/jwks.ts';
import { PLATFORM_CONFIG_CLAIM, REGISTRATION_SCOPES, TOOL_CONFIG_CLAIM } from '../../lti/registration.ts';
import { createAgsClient } from '../../platform/ags.ts';
import { createNrpsClient } from '../../platform/nrps.ts';
import { createScoreClock } from '../../platform/score-clock.ts';
import { createTokenClient } from '../../platform/token-client.ts';
import type { ProfileRegistry } from '../../profiles/index.ts';
import { CHANNEL_ROOT, buildProfileRegistry } from '../../profiles/index.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { listApiKeys } from '../../store/api-keys.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { getPlatform } from '../../store/platforms.ts';
import { ensureToolKey } from '../../store/tool-keys.ts';
import { MASTER_KEY, URLS, capturingLogger, makeKey, sign } from '../../testkit.ts';
import { buildApp } from '../app.ts';
import { rateLimiterFor } from '../rate-limit.ts';

const M = 'https://moodle.test';
const CONFIG_URL = `${M}/mod/lti/openid-configuration.php`;
const CONFIG = {
  issuer: M, token_endpoint: `${M}/mod/lti/token.php`, jwks_uri: `${M}/mod/lti/certs.php`, authorization_endpoint: `${M}/mod/lti/auth.php`,
  registration_endpoint: `${M}/mod/lti/openid-registration.php`,
  scopes_supported: ['https://purl.imsglobal.org/spec/lti-ags/scope/score', 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'],
  [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'moodle', version: '5.2.4 (Build: 20261005)', messages_supported: [{ type: 'LtiResourceLinkRequest' }, { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] }] },
};

async function setup(profileRegistry?: ProfileRegistry) {
  const db = openDb(':memory:');
  const a = ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  const b = ensureAccount(db, { id: 'qa-second', name: 'QA second', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'cogniate');
  const moodleKey = await makeKey('moodle-kid');
  const state = { config: CONFIG as Record<string, unknown>, configurationFetches: 0, nextTypeId: 11, clientId: 'client-dyn-1', registrations: [] as Array<{ auth?: string; body: Record<string, unknown> }>, reject: null as null | number,
    mode: null as null | 'timeout' | 'token_used' | 'server_error' | 'garbage', /** A slow configuration server: each fetch waits for it. */ hold: null as null | Promise<void>,
    /** More configurations by URL; their registration endpoints end with /register-tool. */ configs: {} as Record<string, Record<string, unknown>>,
    /** The `scope` of the registration answer (D5 item 7). */ grantedScope: null as null | string, fetched: [] as string[] };
  const res = (status: number, body: unknown): OutboundResponse => {
    const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    return { status, headers: {}, body: buf, text: () => buf.toString(), json: () => JSON.parse(buf.toString()) as unknown };
  };
  const outbound: OutboundClient = {
    allowlist: [],
    async request(url: string, req: OutboundRequest = {}) {
      state.fetched.push(url);
      const u = new URL(url);
      if (u.protocol !== 'https:') throw new OutboundError('not_https', u.hostname, 'only https');
      if (u.hostname === '169.254.169.254') throw new OutboundError('private_ip', u.hostname, 'private');
      if (state.configs[url]) return res(200, state.configs[url]);
      if (url === CONFIG_URL || url.startsWith('https://qa-platform.test/')) {
        state.configurationFetches++;
        if (state.hold) await state.hold;
        return res(200, state.config);
      }
      if (url === CONFIG.jwks_uri) return res(200, { keys: [moodleKey.publicJwk] });
      if (url === CONFIG.registration_endpoint || url.endsWith('/register-tool')) {
        state.registrations.push({ auth: req.headers?.authorization, body: JSON.parse(String(req.body)) as Record<string, unknown> });
        if (state.mode === 'timeout') throw new OutboundError('timeout', 'moodle.test', 'slow');
        if (state.mode === 'token_used') return res(401, 'token_already_used');
        if (state.mode === 'server_error') return res(500, 'error');
        if (state.mode === 'garbage') return res(200, 'not json');
        if (state.reject) return res(state.reject, 'domain_targetlinkuri_mismatch');
        return res(200, { client_id: state.clientId, [TOOL_CONFIG_CLAIM]: { deployment_id: String(state.nextTypeId) }, ...(state.grantedScope ? { scope: state.grantedScope } : {}) });
      }
      return res(404, 'not found');
    },
  };
  const { logger, lines } = capturingLogger();
  const clock = { now: Date.now() };
  const tokens = createTokenClient({ db, masterKey: MASTER_KEY, outbound, logger, now: () => clock.now });
  const app = await buildApp({
    db, urls: URLS, logger, keys: createPlatformKeys(outbound, () => clock.now), ltikTtlSeconds: 86400, masterKey: MASTER_KEY, outbound,
    ags: createAgsClient({ outbound, tokens, clock: createScoreClock(() => clock.now) }), nrps: createNrpsClient({ outbound, tokens }), profile: 'default', knobs: [], now: () => clock.now,
    ...(profileRegistry ? { profileRegistry } : {}),
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
  it('enforces the session cap before fetching, per account, and releases capacity on completion and expiry', async () => {
    const s = await setup();
    try {
      rateLimiterFor(s.db, capturingLogger().logger).replaceSettings({
        registrationSessionsPerAddress: 3, classes: { registration: { ratePerMinute: 100, burst: 100 } },
      });
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await s.start(undefined);
        expect(r.statusCode).toBe(303);
        ids.push(idOf(String(r.headers.location)));
      }
      const refused = await s.start(undefined);
      expect(refused.statusCode).toBe(409);
      expect(refused.body).toContain('data-error-code="REGISTRATION_SESSION_LIMIT"');
      expect(refused.body).toContain('Too many registrations are open. Wait one hour, or finish the open registration in Moodle.');
      expect(s.state.configurationFetches).toBe(3);
      expect((await s.start(undefined, {}, 'qa-second')).statusCode).toBe(303);
      const completed = await s.app.inject({ method: 'POST', url: `/api/registrations/${ids[0]}/complete`, headers: s.bearer(), payload: {} });
      expect(completed.statusCode).toBe(200);
      expect(s.db.prepare('SELECT client_key FROM registration_session WHERE id = ?').get(ids[0]!)?.client_key).toBeNull();
      expect((await s.start(undefined)).statusCode).toBe(303);
      expect((await s.start(undefined)).statusCode).toBe(409);
      expect(s.state.configurationFetches).toBe(5);
      s.clock.now += 3600_001;
      expect((await s.start(undefined)).statusCode).toBe(303);
    } finally { await s.app.close(); s.db.close(); }
  });

  it('A-LA-E5-06-01: parallel starts that wait for a slow configuration fetch open at most the cap sessions', async () => {
    const s = await setup();
    try {
      rateLimiterFor(s.db, capturingLogger().logger).replaceSettings({
        registrationSessionsPerAddress: 3, classes: { registration: { ratePerMinute: 100, burst: 100 } },
      });
      let release!: () => void;
      s.state.hold = new Promise<void>((resolve) => { release = resolve; });
      const starts = Array.from({ length: 6 }, () => s.start(undefined));
      // All six pass the first check: no session exists while they wait for their fetch.
      for (let i = 0; i < 1000 && s.state.configurationFetches < 6; i++) await new Promise((resolve) => setImmediate(resolve));
      expect(s.state.configurationFetches).toBe(6);
      release();
      const results = await Promise.all(starts);
      expect(results.map((r) => r.statusCode).sort()).toEqual([303, 303, 303, 409, 409, 409]);
      for (const refused of results.filter((r) => r.statusCode === 409)) {
        expect(refused.body).toContain('data-error-code="REGISTRATION_SESSION_LIMIT"');
        expect(refused.body).toContain('Too many registrations are open. Wait one hour, or finish the open registration in Moodle.');
      }
      expect(s.db.prepare("SELECT count(*) AS n FROM registration_session WHERE tool_account_id = 'cogniate'").get()?.n).toBe(3);
      expect(s.lines.filter((l) => l.event === 'registration_started')).toHaveLength(3);
    } finally { await s.app.close(); s.db.close(); }
  });

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
      privacyLevel: 'anonymous', operation: 'new', existingPlatformId: null, endpointsOnIssuerOrigin: true,
    });
    expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id}?raw=true`, headers: s.bearer() })).json().raw.issuer).toBe(M);
    expect(listAuditEvents(s.db, { action: 'registration.complete', limit: 10 }).events).toEqual([]);

    const c = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: { platformName: 'QA dyn 1' } });
    expect(c.statusCode).toBe(200);
    expect(c.json().html).toContain('org.imsglobal.lti.close');
    const platform = getPlatform(s.db, 'cogniate', c.json().platformId)!;
    expect(platform).toMatchObject({ issuer: M, clientId: 'client-dyn-1', name: 'QA dyn 1', active: true, deploymentIds: ['11'], productFamilyCode: 'moodle', tokenEndpoint: CONFIG.token_endpoint });
    const sent = s.state.registrations[0]!;
    expect(sent.auth).toMatch(/^Bearer ey/);
    expect(sent.body).toMatchObject({ client_name: 'QA dyn 1', token_endpoint_auth_method: 'private_key_jwt', jwks_uri: `${URLS.lti}/lti/keys/cogniate`, scope: REGISTRATION_SCOPES.join(' ') });
    expect((sent.body[TOOL_CONFIG_CLAIM] as { claims: string[] }).claims).toEqual(['iss', 'sub']);
    expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_completed', platform_id: platform.id, operation: 'new' }));

    // AC-T3-04
    const again = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} });
    expect([again.statusCode, again.json().details.message]).toEqual([409, 'REGISTRATION_ALREADY_COMPLETED']);
    expect((await s.app.inject({ method: 'GET', url: '/api/registrations/reg_unknown', headers: s.bearer() })).json().details.message).toBe('REGISTRATION_NOT_FOUND');
    expect((await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, payload: {} })).statusCode).toBe(401);
    expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id}`, headers: s.bearer(s.apiKey2) })).statusCode).toBe(404); // other account
    expect(JSON.stringify(s.lines)).not.toContain(String(sent.auth).slice(7));
    const events = listAuditEvents(s.db, { action: 'registration.complete', limit: 10 }).events;
    expect(events).toHaveLength(2); // Reads and the unauthenticated POST write no event.
    const context = { actor: { type: 'api_key', id: listApiKeys(s.db, 'cogniate')[0]!.id }, toolAccountId: 'cogniate', target: { type: 'registration', id } };
    expect(events.find((event) => event.result === 'ok')).toMatchObject({ ...context, code: null, traceId: c.headers['x-trace-id'], clientIp: '127.0.0.1', details: { platformId: platform.id, operation: 'new' } });
    expect(events.find((event) => event.result === 'refused')).toMatchObject({ ...context, code: 'REGISTRATION_ALREADY_COMPLETED', traceId: again.headers['x-trace-id'] });
    expect(JSON.stringify(events)).not.toContain(String(sent.auth).slice(7));
  });

  it.each([
    ['empty list', []], ['unknown scope', ['openid']], ['mixed scopes', [REGISTRATION_SCOPES[0], 'admin']],
    ['not a list', REGISTRATION_SCOPES[0]], ['null', null], ['non-string member', [1]],
    ['repeated scope', [REGISTRATION_SCOPES[0], REGISTRATION_SCOPES[0]]],
  ])('refuses %s before sending or claiming the session (LA-E3-06 AC-04)', async (_name, scopes) => {
    const s = await setup();
    const id = idOf(String((await s.start(undefined)).headers.location));
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: { scopes } });
    expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    expect(r.json().details.description).toContain('Invalid field: scopes');
    expect(s.state.registrations).toEqual([]);
    expect(s.db.prepare('SELECT status FROM registration_session WHERE id = ?').get(id)?.status).toBe('open');
    expect(listAuditEvents(s.db, { action: 'registration.complete', limit: 10 }).events).toMatchObject([
      { target: { type: 'registration', id }, result: 'refused', code: 'INVALID_REQUEST' },
    ]);
  });

  it('checks advertised scopes for an explicit list before sending', async () => {
    const s = await setup();
    s.state.config = { ...CONFIG, scopes_supported: [REGISTRATION_SCOPES[3]] };
    const id = idOf(String((await s.start(undefined)).headers.location));
    const unsupported = [REGISTRATION_SCOPES[0], REGISTRATION_SCOPES[1]];
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: { scopes: [REGISTRATION_SCOPES[3], ...unsupported] } });
    expect([r.statusCode, r.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    expect(r.json().details).toMatchObject({
      field: 'scopes', unsupported, description: `Invalid field: scopes. The platform does not support: ${unsupported.join(', ')}.`,
    });
    expect(s.state.registrations).toEqual([]);
    const ok = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: { scopes: [REGISTRATION_SCOPES[3]] } });
    expect(ok.statusCode).toBe(200);
    expect(s.state.registrations.map((call) => call.body.scope)).toEqual([REGISTRATION_SCOPES[3]]);
  });

  it.each([undefined, [], [REGISTRATION_SCOPES[3]]])('keeps all five default scopes when scopes_supported is %j (B-LA-E3-06-01)', async (scopes_supported) => {
    const s = await setup();
    s.state.config = { ...CONFIG, scopes_supported };
    const id = idOf(String((await s.start(undefined)).headers.location));
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} });
    expect(r.statusCode).toBe(200);
    expect(s.state.registrations.map((call) => call.body.scope)).toEqual([REGISTRATION_SCOPES.join(' ')]);
  });

  it('rolls back the platform and session completion if the audit insert fails', async () => {
    const s = await setup();
    const id = idOf(String((await s.start(await s.regToken({ scope: 'reg', sub: 'c' }))).headers.location));
    s.db.exec("CREATE TRIGGER fail_registration_audit BEFORE INSERT ON audit_event WHEN NEW.action = 'registration.complete' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
    const r = await s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload: {} });
    expect(r.statusCode).toBe(500);
    expect(s.state.registrations).toHaveLength(1);
    expect(s.db.prepare('SELECT COUNT(*) AS n FROM platform').get()?.n).toBe(0);
    expect(s.db.prepare('SELECT status, platform_id, registration_token_encrypted FROM registration_session WHERE id = ?').get(id))
      .toMatchObject({ status: 'open', platform_id: null, registration_token_encrypted: expect.any(Uint8Array) });
    expect(listAuditEvents(s.db, { action: 'registration.complete', limit: 10 }).events).toEqual([]);
    expect(s.lines.some((line) => line.event === 'registration_completed')).toBe(false);
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

  it.each([['the product registry (an opaque-token DR profile is loaded)', false], ['a registry without opaque-token DR profiles', true]])(
    'a token that is not signed by the platform, an expired token, or a wrong scope -> INVALID_OPENID_CONFIGURATION page, with %s (A-LA-E2-02-05)',
    async (_, baseline) => {
      const s = await setup(baseline ? await baselineRegistry() : undefined);
      try {
        const stranger = await makeKey('moodle-kid');
        const now = Math.floor(s.clock.now / 1000);
        for (const token of [await sign(stranger, { scope: 'reg', sub: 'x', iat: now, exp: now + 60 }), await s.regToken({ scope: 'reg', sub: 'x', exp: now - 120 }), await s.regToken({ scope: 'admin', sub: 'x' })]) {
          const r = await s.start(token);
          expect(r.body, token.slice(0, 10)).toContain('data-error-code="INVALID_OPENID_CONFIGURATION"');
        }
        expect(s.db.prepare('SELECT COUNT(*) AS n FROM registration_session').get()?.n).toBe(0);
      } finally { await s.app.close(); s.db.close(); }
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

  it('M1 (§9.2): a Canvas or Blackboard platform configuration is refused on the start page; no session starts', async () => {
    const s = await setup();
    for (const [family, lms] of [['canvas', 'Canvas'], ['BlackboardLearn', 'Blackboard']] as const) {
      s.state.config = { ...CONFIG, [PLATFORM_CONFIG_CLAIM]: { ...CONFIG[PLATFORM_CONFIG_CLAIM], product_family_code: family } };
      const r = await s.start(await s.regToken({ scope: 'reg', sub: 'c' }));
      expect(r.statusCode).toBe(400);
      expect(r.body).toContain('data-error-code="PROVIDER_PROFILE_MISMATCH"');
      expect(r.body).toContain(`This is a ${lms} site. Connect it as ${lms} in the Cogniate portal.`);
    }
    expect((s.db.prepare('SELECT COUNT(*) AS n FROM registration_session').get() as { n: number }).n).toBe(0);
    expect(s.lines.filter((l) => l.event === 'registration_rejected').map((l) => l.detail)).toEqual(['family=canvas', 'family=blackboardlearn']);
  });
});

// ---------------------------------------------------------------- E2: Dynamic Registration per profile (LA-ADR-02 D5)

const E2_TRAITS = ['wireLms', 'issuerKind', 'endpointOrigins', 'clientAssertionAud', 'assertionDeploymentId', 'dynamicRegistration'];
/** The product channels without the opaque-token generic DR channel: the start page then has today's Moodle rule. */
async function baselineRegistry(): Promise<ProfileRegistry> {
  const loaded = await loadChannelFolders([CHANNEL_ROOT], 'lti');
  return buildProfileRegistry(loaded.filter((e) => (e.manifest as ChannelManifest).id !== 'lti-generic'));
}
/**
 * The baseline channels and two test channels: `zz-dr` offers Dynamic Registration of the `any-https` profile
 * `zz-generic` (opaque token, {platformValue} audience) and guards the family `zzdr`; `zz-guard` has no DR and
 * guards the family `zzguard`. Both guards are registration level.
 */
async function drRegistry(): Promise<ProfileRegistry> {
  const loaded = structuredClone(await loadChannelFolders([CHANNEL_ROOT], 'lti'));
  const moodle = loaded.find((e) => (e.manifest as ChannelManifest).registration.some((m) => m.profiles.includes('standard')))!;
  const base: Record<string, unknown> = { ...(moodle.ltiProfiles![0] as Record<string, unknown>), privacyFloor: 'allowlist' };
  for (const field of E2_TRAITS) delete base[field];
  const channel = (id: string, text: string, profile: Record<string, unknown>, dynamic: boolean, family: string): LoadedChannel => ({
    folder: `/unit/${id}`,
    manifest: {
      ...(moodle.manifest as ChannelManifest), id, names: { text, label: text },
      registration: [{ method: dynamic ? 'dynamic' : 'manual', authority: dynamic ? 'self' : 'operatorGrant', profiles: [profile.id as string], defaultProfile: profile.id as string }],
      lti: { guardedFamilies: [{ family, level: 'registration' }], toolConfiguration: 'none' },
      texts: { ...(moodle.manifest as ChannelManifest).texts, registration: undefined },
    },
    ltiProfiles: [profile],
  });
  return buildProfileRegistry([...loaded,
    channel('zz-dr', 'ZZ DR', { ...base, id: 'zz-generic', listOrder: 100, endpointOrigins: 'any-https',
      clientAssertionAud: { value: '{platformValue}', form: 'string' }, dynamicRegistration: { issuerRule: 'path-prefix', registrationToken: 'opaque-bearer' } }, true, 'zzdr'),
    channel('zz-guard', 'ZZ Guard', { ...base, id: 'zz-manual', listOrder: 110 }, false, 'zzguard'),
  ]);
}

const G = 'https://lms.school.test/sakai';
const G_CONFIG_URL = `${G}/.well-known/openid-configuration`;
const genericConfig = (extra: Record<string, unknown> = {}) => ({
  ...CONFIG, issuer: G, authorization_endpoint: `${G}/auth`, token_endpoint: `${G}/token`, jwks_uri: `${G}/jwks`, registration_endpoint: `${G}/register-tool`,
  [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'sakai-like', version: '23', messages_supported: [{ type: 'LtiDeepLinkingRequest' }] }, ...extra,
});

const registry = await drRegistry();

describe('E2 Dynamic Registration rules per profile (AC-LA-E2-02-01)', () => {
  const startAt = (s: Awaited<ReturnType<typeof setup>>, url: string, token?: string) =>
    s.app.inject({ method: 'GET', url: `/lti/register/cogniate?${new URLSearchParams({ openid_configuration: url, ...(token ? { registration_token: token } : {}) })}` });
  const complete = (s: Awaited<ReturnType<typeof setup>>, id: string, payload: Record<string, unknown>) =>
    s.app.inject({ method: 'POST', url: `/api/registrations/${id}/complete`, headers: s.bearer(), payload });
  const refusal = (r: { statusCode: number; json: () => { details: { message: string; description: string } } }) => [r.statusCode, r.json().details.message];

  it('I-SELF holds: an opaque token, an issuer with a path; complete is active with the profile and the granted scopes (items 1, 3, 6, 7, 10)', async () => {
    const s = await setup(registry);
    try {
      s.state.configs[G_CONFIG_URL] = genericConfig();
      s.state.grantedScope = 'https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-ags/scope/lineitem';
      const r = await startAt(s, G_CONFIG_URL, 'opaque-token-1');
      expect(r.statusCode, r.body).toBe(303);
      const id = idOf(String(r.headers.location));
      expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id}`, headers: s.bearer() })).json()).toMatchObject({ url: G, endpointsOnIssuerOrigin: true });
      const c = await complete(s, id, { profile: 'zz-generic', bindingRef: 'conn-1' });
      expect(c.statusCode, c.body).toBe(200);
      expect(c.json()).toMatchObject({ active: true });
      expect(getPlatform(s.db, 'cogniate', c.json().platformId)).toMatchObject({
        profile: 'zz-generic', issuer: G, active: true, bindingRef: null, clientAssertionAud: null, siteUrl: null,
        grantedScopes: ['https://purl.imsglobal.org/spec/lti-ags/scope/score', 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'],
      });
      expect(s.state.registrations[0]!.auth).toBe('Bearer opaque-token-1');
      expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_completed', operation: 'new' }));
      expect(s.lines.find((l) => l.event === 'registration_completed')).not.toHaveProperty('staged');
    } finally { await s.app.close(); s.db.close(); }
  });

  it.each([
    ['the token endpoint on a second host', { token_endpoint: 'https://auth.idp.test/token' }, null],
    ['authorization_server off the issuer origin', { authorization_server: 'https://auth.idp.test' }, 'https://auth.idp.test'],
  ])('I-SELF broken by %s: GET says so; complete stages an inactive platform with the binding ref (items 4, 10)', async (_, extra, aud) => {
    const s = await setup(registry);
    try {
      s.state.configs[G_CONFIG_URL] = genericConfig(extra);
      const id = idOf(String((await startAt(s, G_CONFIG_URL, 'opaque-token-2')).headers.location));
      expect((await s.app.inject({ method: 'GET', url: `/api/registrations/${id}`, headers: s.bearer() })).json().endpointsOnIssuerOrigin).toBe(false);
      // The binding ref is required for this profile; nothing is sent without it.
      expect(refusal(await complete(s, id, { profile: 'zz-generic' }))).toEqual([400, 'INVALID_REQUEST']);
      expect(s.state.registrations).toEqual([]);
      const c = await complete(s, id, { profile: 'zz-generic', bindingRef: 'conn-2', autoActivate: true });
      expect(c.statusCode, c.body).toBe(200);
      expect(c.json().active).toBe(false);
      expect(getPlatform(s.db, 'cogniate', c.json().platformId)).toMatchObject({ profile: 'zz-generic', active: false, bindingRef: 'conn-2', clientAssertionAud: aud });
      expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_completed', staged: true }));
    } finally { await s.app.close(); s.db.close(); }
  });

  it('item 2: a configuration host of a fixed profile is PLATFORM_URL_NOT_IN_PROFILE on the start page; nothing goes to it', async () => {
    const s = await setup(registry);
    try {
      s.state.configs[G_CONFIG_URL] = genericConfig({ token_endpoint: 'https://sso.canvaslms.com/login/oauth2/token', jwks_uri: 'https://canvas.instructure.com/jwks' });
      const r = await startAt(s, G_CONFIG_URL, 'opaque-token-3');
      expect(r.statusCode).toBe(400);
      expect(r.body).toContain('data-error-code="PLATFORM_URL_NOT_IN_PROFILE"');
      expect(s.state.fetched.filter((url) => !url.startsWith(G))).toEqual([]);
      expect(s.db.prepare('SELECT COUNT(*) AS n FROM registration_session').get()?.n).toBe(0);
    } finally { await s.app.close(); s.db.close(); }
  });

  it('item 3 and the exact rule at complete: standard refuses an opaque token and a generic configuration; nothing is sent', async () => {
    const s = await setup(registry);
    try {
      s.state.configs[G_CONFIG_URL] = genericConfig({ token_endpoint: 'https://auth.idp.test/token' });
      const generic = idOf(String((await startAt(s, G_CONFIG_URL)).headers.location));
      const standardOnGeneric = await complete(s, generic, {});
      expect(refusal(standardOnGeneric)).toEqual([400, 'INVALID_REQUEST']);
      expect(standardOnGeneric.json().details.description).toContain('Dynamic Registration rule of profile standard');
      // A Moodle configuration with a token that is not a registration JWT: the start page takes it (zz-generic allows
      // an opaque token); the standard profile refuses it at complete.
      const opaque = idOf(String((await startAt(s, CONFIG_URL, 'not-a-jwt')).headers.location));
      const r = await complete(s, opaque, { profile: 'standard' });
      expect(refusal(r)).toEqual([400, 'INVALID_REQUEST']);
      expect(r.json().details.description).toContain('registration token');
      expect(s.state.registrations).toEqual([]);
      // A real registration JWT still works for standard.
      const jwt = idOf(String((await s.start(await s.regToken({ scope: 'reg' }))).headers.location));
      expect((await complete(s, jwt, { profile: 'standard' })).statusCode).toBe(200);
    } finally { await s.app.close(); s.db.close(); }
  });

  it('item 6: an unknown profile and a profile without Dynamic Registration are refused before anything is sent', async () => {
    const s = await setup(registry);
    try {
      const id = idOf(String((await s.start(undefined)).headers.location));
      expect(refusal(await complete(s, id, { profile: 'nope' }))).toEqual([400, 'UNKNOWN_PROFILE']);
      expect(refusal(await complete(s, id, { profile: 'zz-manual' }))).toEqual([400, 'INVALID_REQUEST']);
      expect(refusal(await complete(s, id, { bindingRef: 'not a ref' }))).toEqual([400, 'INVALID_REQUEST']);
      expect(s.state.registrations).toEqual([]);
    } finally { await s.app.close(); s.db.close(); }
  });

  it('item 5: a family guarded by a channel without DR is a start page; a DR channel guard is checked at complete', async () => {
    const s = await setup(registry);
    try {
      s.state.configs[G_CONFIG_URL] = genericConfig({ [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'ZZGuard', messages_supported: [{ type: 'LtiDeepLinkingRequest' }] } });
      const guarded = await startAt(s, G_CONFIG_URL);
      expect(guarded.statusCode).toBe(400);
      expect(guarded.body).toContain('data-error-code="PROVIDER_PROFILE_MISMATCH"');
      expect(guarded.body).toContain('This is a ZZ Guard site. Connect it as ZZ Guard in the Cogniate portal.');
      expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_rejected', code: 'PROVIDER_PROFILE_MISMATCH', detail: 'family=zzguard' }));
      s.state.configs[G_CONFIG_URL] = genericConfig({ [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'zzdr', messages_supported: [{ type: 'LtiDeepLinkingRequest' }] } });
      const id = idOf(String((await startAt(s, G_CONFIG_URL)).headers.location));
      const wrong = await complete(s, id, { profile: 'standard' });
      expect(refusal(wrong)).toEqual([400, 'INVALID_REQUEST']);
      expect(s.state.registrations).toEqual([]);
      expect((await complete(s, id, { profile: 'zz-generic', bindingRef: 'conn-5' })).statusCode).toBe(200);
    } finally { await s.app.close(); s.db.close(); }
  });

  it('item 5 (B-LA-E2-02-03): complete refuses a family that another channel guards, with a configuration that passes every other rule', async () => {
    const s = await setup(registry);
    try {
      // A standard-compatible configuration (Moodle path, every endpoint on the issuer origin): only the family differs.
      s.state.config = { ...CONFIG, [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'zzdr', messages_supported: [{ type: 'LtiDeepLinkingRequest' }] } };
      const id = idOf(String((await s.start(await s.regToken({ scope: 'reg' }))).headers.location));
      const r = await complete(s, id, { profile: 'standard' });
      expect([r.statusCode, r.json().details.message, r.json().details.reason]).toEqual([400, 'INVALID_REQUEST', 'family=zzdr']);
      expect(r.json().details.description).toBe('Invalid field: profile. This is a ZZ DR site. Connect it as ZZ DR in the Cogniate portal.');
      expect(s.state.registrations).toEqual([]);
      expect(s.db.prepare('SELECT status FROM registration_session WHERE id = ?').get(id)?.status).toBe('open');
    } finally { await s.app.close(); s.db.close(); }
  });

  it.each(['timeout', 'token_used', 'server_error', 'garbage'] as const)(
    'B-LA-E2-02-01 (BD-A1-87): an uncertain outcome (%s) gives the channel recovery sentence; the code and reason stay', async (mode) => {
      const s = await setup(registry);
      try {
        s.state.configs[G_CONFIG_URL] = genericConfig();
        const id = idOf(String((await startAt(s, G_CONFIG_URL, 'opaque-token-9')).headers.location));
        s.state.mode = mode;
        const r = await complete(s, id, { profile: 'zz-generic', bindingRef: 'conn-9', platformName: 'Review tool' });
        expect([r.statusCode, r.json().details.message, r.json().details.reason]).toEqual([502, 'PLATFORM_ERROR', 'tool_may_exist']);
        expect(r.json().details.description).toBe("ZZ DR may have saved the Cogniate tool already. If ZZ DR shows the tool 'Review tool', delete it there, then connect again.");
      } finally { await s.app.close(); s.db.close(); }
    });

  it('item 5: a configuration without Deep Linking gets a clear start page and no session', async () => {
    const s = await setup(registry);
    try {
      s.state.configs[G_CONFIG_URL] = genericConfig({ [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'x', messages_supported: [{ type: 'LtiResourceLinkRequest' }] } });
      const r = await startAt(s, G_CONFIG_URL);
      expect(r.statusCode).toBe(400);
      expect(r.body).toContain('data-error-code="INVALID_OPENID_CONFIGURATION"');
      expect(r.body).toContain('does not offer Deep Linking to this tool');
      expect(s.db.prepare('SELECT COUNT(*) AS n FROM registration_session').get()?.n).toBe(0);
    } finally { await s.app.close(); s.db.close(); }
  });
});

describe('LA-IC-03: Moodle in a subfolder; the configuration must be at /mod/lti/openid-configuration.php', () => {
  const moodleIn = (base: string) => ({
    ...CONFIG, issuer: base, authorization_endpoint: `${base}/mod/lti/auth.php`, token_endpoint: `${base}/mod/lti/token.php`,
    jwks_uri: CONFIG.jwks_uri, registration_endpoint: CONFIG.registration_endpoint,
  });

  it('completes for a subfolder issuer; refuses another path of the same site; stores the granted scopes', async () => {
    const s = await setup(await baselineRegistry());
    try {
      const base = 'https://moodle.test/moodle';
      s.state.configs[`${base}/mod/lti/openid-configuration.php`] = { ...moodleIn(base), jwks_uri: `${base}/mod/lti/certs.php`, registration_endpoint: `${base}/register-tool` };
      s.state.grantedScope = REGISTRATION_SCOPES.slice(0, 2).join(' ');
      const r = await s.app.inject({ method: 'GET', url: `/lti/register/cogniate?openid_configuration=${encodeURIComponent(`${base}/mod/lti/openid-configuration.php`)}` });
      expect(r.statusCode, r.body).toBe(303);
      const c = await s.app.inject({ method: 'POST', url: `/api/registrations/${idOf(String(r.headers.location))}/complete`, headers: s.bearer(), payload: {} });
      expect(c.statusCode, c.body).toBe(200);
      expect(c.json().active).toBe(true);
      expect(getPlatform(s.db, 'cogniate', c.json().platformId)).toMatchObject({ issuer: base, profile: 'standard', grantedScopes: REGISTRATION_SCOPES.slice(0, 2) });
      s.state.configs['https://moodle.test/pluginfile.php/7/config.json'] = CONFIG;
      const other = await s.app.inject({ method: 'GET', url: `/lti/register/cogniate?openid_configuration=${encodeURIComponent('https://moodle.test/pluginfile.php/7/config.json')}` });
      expect(other.statusCode).toBe(400);
      expect(other.body).toContain('data-error-code="ISSUER_MISMATCH"');
      expect(other.body).toContain('Start the registration again from Manage tools on the site itself.');
      expect(s.lines).toContainEqual(expect.objectContaining({ event: 'registration_rejected', code: 'ISSUER_MISMATCH', detail: 'configuration_path_mismatch' }));
    } finally { await s.app.close(); s.db.close(); }
  });

  it('with a path-prefix DR profile without a fixed path loaded, the start page takes another path and complete refuses it for standard', async () => {
    const s = await setup();
    try {
      s.state.configs['https://moodle.test/pluginfile.php/7/config.json'] = CONFIG;
      const r = await s.app.inject({ method: 'GET', url: `/lti/register/cogniate?openid_configuration=${encodeURIComponent('https://moodle.test/pluginfile.php/7/config.json')}` });
      expect(r.statusCode, r.body).toBe(303);
      const c = await s.app.inject({ method: 'POST', url: `/api/registrations/${idOf(String(r.headers.location))}/complete`, headers: s.bearer(), payload: {} });
      expect([c.statusCode, c.json().details.message, c.json().details.reason]).toEqual([400, 'INVALID_REQUEST', 'configuration_path_mismatch']);
      expect(s.state.registrations).toEqual([]);
    } finally { await s.app.close(); s.db.close(); }
  });
});
