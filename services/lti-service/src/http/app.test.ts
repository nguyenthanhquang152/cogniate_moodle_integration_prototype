import { describe, expect, it } from 'vitest';
import { CLAIM } from '../lti/checks.ts';
import { COOKIE_HELP } from '../lti/codes.ts';
import { updatePlatform } from '../store/platforms.ts';
import type { Harness } from '../testkit.ts';
import { CLIENT_ID, ISSUER, LAUNCH, URLS, doLogin, harness, loginForm, moodleClaims, postLaunch, sign } from '../testkit.ts';

const json = (h: Harness, method: 'GET' | 'POST' | 'PATCH', url: string, auth?: string, payload?: unknown) =>
  h.app.inject({ method, url, headers: { ...(auth ? { authorization: auth } : {}), ...(payload ? { 'content-type': 'application/json' } : {}) }, ...(payload ? { payload: JSON.stringify(payload) } : {}) });

const platformBody = (over: Record<string, unknown> = {}) => ({
  url: 'https://moodle2.test', clientId: 'c2', name: 'Moodle 2', authenticationEndpoint: 'https://moodle2.test/mod/lti/auth.php',
  accesstokenEndpoint: 'https://moodle2.test/mod/lti/token.php', authConfig: { method: 'JWK_SET', key: 'https://moodle2.test/mod/lti/certs.php' },
  deploymentIds: ['7'], ...over,
});

async function launchOk(h: Harness, claimsOver: Record<string, unknown> = {}) {
  const { state, nonce, cookie } = await doLogin(h);
  const nowS = Math.floor(h.clock.now / 1000);
  const idToken = await sign(h.key, moodleClaims({ nonce, ...claimsOver }, nowS));
  const res = await postLaunch(h, { id_token: idToken, state }, cookie);
  return { res, state, idToken, cookie };
}

describe('GET /lti/keys/:account', () => {
  it('serves public RSA keys only, and 404 for an unknown account', async () => {
    const h = await harness();
    const res = await h.app.inject('/lti/keys/cogniate');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    const keys = (res.json() as { keys: Array<Record<string, unknown>> }).keys;
    expect(keys.length).toBeGreaterThanOrEqual(1);
    for (const k of keys) {
      expect(k).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
      expect(typeof k.kid).toBe('string');
      for (const priv of ['d', 'p', 'q', 'dp', 'dq', 'qi']) expect(k[priv]).toBeUndefined();
    }
    expect((await h.app.inject('/lti/keys/unknown')).statusCode).toBe(404);
  });
});

describe('platforms API (Bearer)', () => {
  it('creates a platform with all contract fields, then 409 for the same issuer + client id', async () => {
    const h = await harness();
    const res = await json(h, 'POST', '/api/platforms', `Bearer ${h.apiKey}`, { ...platformBody(), unknownField: 1 });
    expect(res.statusCode).toBe(201);
    const p = res.json() as Record<string, unknown>;
    expect(p).toMatchObject({ url: 'https://moodle2.test', clientId: 'c2', name: 'Moodle 2', active: true, deploymentIds: ['7'],
      authenticationEndpoint: 'https://moodle2.test/mod/lti/auth.php', accesstokenEndpoint: 'https://moodle2.test/mod/lti/token.php',
      authConfig: { method: 'JWK_SET', key: 'https://moodle2.test/mod/lti/certs.php' }, productFamilyCode: null });
    expect(String(p.id)).toMatch(/^plt_/);
    expect(String(p.publicKey)).toContain('BEGIN PUBLIC KEY');
    const dup = await json(h, 'POST', '/api/platforms', `Bearer ${h.apiKey}`, platformBody());
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ status: 409, error: 'Conflict', details: { message: 'PLATFORM_ALREADY_EXISTS' } });
    const list = await json(h, 'GET', '/api/platforms?clientId=c2', `Bearer ${h.apiKey}`);
    expect((list.json() as { platforms: unknown[] }).platforms).toEqual([p]);
  });

  it('rejects a missing header, a wrong key, and isolates accounts', async () => {
    const h = await harness();
    expect((await json(h, 'GET', '/api/platforms')).json()).toMatchObject({ status: 401, details: { message: 'INVALID_AUTHORIZATION_HEADER' } });
    expect((await json(h, 'GET', '/api/platforms', `Bearer ltis_${'x'.repeat(43)}`)).json()).toMatchObject({ details: { message: 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER' } });
    const other = await json(h, 'GET', '/api/platforms', `Bearer ${h.otherApiKey}`);
    expect(other.json()).toEqual({ platforms: [] });
    const get = await json(h, 'GET', `/api/platforms/${h.platform.id}`, `Bearer ${h.otherApiKey}`);
    expect(get.statusCode).toBe(404);
    expect(get.json()).toMatchObject({ details: { message: 'UNREGISTERED_PLATFORM' } });
  });

  it('lets another account register the same issuer + client id (its own record)', async () => {
    const h = await harness();
    const res = await json(h, 'POST', '/api/platforms', `Bearer ${h.otherApiKey}`, platformBody({ url: ISSUER, clientId: CLIENT_ID,
      authenticationEndpoint: `${ISSUER}/mod/lti/auth.php`, accesstokenEndpoint: `${ISSUER}/mod/lti/token.php`, authConfig: { method: 'JWK_SET', key: `${ISSUER}/mod/lti/certs.php` } }));
    expect(res.statusCode).toBe(201);
    expect((res.json() as { id: string }).id).not.toBe(h.platform.id);
  });

  it.each([
    ['authConfig.key', { authConfig: { method: 'JWK_SET', key: 'https://evil.test/jwks' } }],
    ['accesstokenEndpoint', { accesstokenEndpoint: 'https://evil.test/token' }],
    ['authenticationEndpoint', { authenticationEndpoint: 'https://evil.test/auth' }],
  ])('400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN for %s, without an outbound call', async (_n, over) => {
    const h = await harness();
    const res = await json(h, 'POST', '/api/platforms', `Bearer ${h.apiKey}`, platformBody(over));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ details: { message: 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN' } });
    expect(h.outbound.calls).toEqual([]);
  });

  it('400 UNSUPPORTED_AUTH_METHOD for RSA_KEY, 400 INVALID_REQUEST for http or a missing field', async () => {
    const h = await harness();
    expect((await json(h, 'POST', '/api/platforms', `Bearer ${h.apiKey}`, platformBody({ authConfig: { method: 'RSA_KEY', key: 'x' } }))).json())
      .toMatchObject({ status: 400, details: { message: 'UNSUPPORTED_AUTH_METHOD' } });
    const http = await json(h, 'POST', '/api/platforms', `Bearer ${h.apiKey}`, platformBody({ url: 'http://moodle2.test' }));
    expect(http.json()).toMatchObject({ status: 400, details: { message: 'INVALID_REQUEST' } });
    const missing = await json(h, 'POST', '/api/platforms', `Bearer ${h.apiKey}`, platformBody({ clientId: undefined }));
    expect(missing.json()).toMatchObject({ details: { message: 'INVALID_REQUEST', description: 'Invalid field: clientId.' } });
  });

  it('PATCH changes name, active and deployment ids', async () => {
    const h = await harness();
    const res = await json(h, 'PATCH', `/api/platforms/${h.platform.id}`, `Bearer ${h.apiKey}`, { name: 'Renamed', active: false, deploymentIds: ['1', '2'] });
    expect(res.json()).toMatchObject({ name: 'Renamed', active: false, deploymentIds: ['1', '2'] });
  });
});

describe('OIDC login (/lti/login/:account)', () => {
  it('redirects to the platform auth endpoint with the OIDC parameters and sets the state cookie', async () => {
    const h = await harness();
    const res = await h.app.inject({ method: 'POST', url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: loginForm() });
    expect(res.statusCode).toBe(302);
    const loc = new URL(res.headers.location as string);
    expect(`${loc.origin}${loc.pathname}`).toBe(`${ISSUER}/mod/lti/auth.php`);
    expect(Object.fromEntries(loc.searchParams)).toMatchObject({
      scope: 'openid', response_type: 'id_token', response_mode: 'form_post', prompt: 'none', client_id: CLIENT_ID,
      redirect_uri: LAUNCH, login_hint: '5', lti_message_hint: '{"cmid":3}',
    });
    expect(loc.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(loc.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/^__Host-lti_state_[0-9a-f]{8}=[A-Za-z0-9_-]{43}; /);
    for (const attr of ['Path=/', 'Max-Age=600', 'Secure', 'HttpOnly', 'SameSite=None', 'Partitioned']) expect(cookie).toContain(attr);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    const second = await doLogin(h);
    expect(second.state).not.toBe(loc.searchParams.get('state'));
  });

  it('also accepts GET with the parameters in the query', async () => {
    const h = await harness();
    expect((await h.app.inject(`/lti/login/cogniate?${loginForm()}`)).statusCode).toBe(302);
  });

  it.each([
    ['UNKNOWN_PLATFORM', 400, { iss: 'https://evil.test' }],
    ['INVALID_TARGET_LINK_URI', 400, { target_link_uri: 'https://evil.test/x' }],
    ['INVALID_TARGET_LINK_URI', 400, { target_link_uri: `${LAUNCH}-evil` }],
    ['UNKNOWN_DEPLOYMENT', 400, { lti_deployment_id: '999' }],
    ['INVALID_REQUEST', 400, { iss: '' }],
  ])('page %s (%i), no Location, login_rejected logged', async (code, status, over) => {
    const h = await harness();
    const res = await h.app.inject({ method: 'POST', url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: loginForm(over) });
    expect(res.statusCode).toBe(status);
    expect(res.headers.location).toBeUndefined();
    expect(res.body).toContain(`data-error-code="${code}"`);
    expect(h.lines.some((l) => l.event === 'login_rejected' && l.code === code && typeof l.detail === 'string' && l.detail !== '')).toBe(true);
    expect(res.body).toMatch(/<p data-error-action>[^<]+<\/p>/);
  });

  it('404 UNKNOWN_TOOL_ACCOUNT and PLATFORM_NOT_ACTIVE', async () => {
    const h = await harness();
    const unknown = await h.app.inject({ method: 'POST', url: '/lti/login/unknown', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: loginForm() });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.body).toContain('data-error-code="UNKNOWN_TOOL_ACCOUNT"');
    updatePlatform(h.db, 'cogniate', h.platform.id, { active: false });
    const inactive = await h.app.inject({ method: 'POST', url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: loginForm() });
    expect(inactive.body).toContain('data-error-code="PLATFORM_NOT_ACTIVE"');
  });
});

describe('launch (/lti/launch/:account)', () => {
  it('redirects (303) to the tool with the target query and a 43-char ltik, and clears the cookie', async () => {
    const h = await harness();
    const { res } = await launchOk(h, { [CLAIM.targetLinkUri]: `${LAUNCH}?resource=seed` });
    expect(res.statusCode).toBe(303);
    const loc = new URL(res.headers.location as string);
    expect(`${loc.origin}${loc.pathname}`).toBe(`${URLS.app}/tool/launch`);
    expect(loc.searchParams.get('resource')).toBe('seed');
    expect(loc.searchParams.get('ltik')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(String(res.headers['set-cookie'])).toMatch(/^__Host-lti_state_[0-9a-f]{8}=; Path=\/; Max-Age=0; Secure; HttpOnly; SameSite=None; Partitioned$/);
    expect(h.lines.some((l) => l.event === 'launch_accepted' && l.platform_id === h.platform.id && l.message_type === 'LtiResourceLinkRequest')).toBe(true);
  });

  it('GET is 405', async () => {
    const h = await harness();
    const res = await h.app.inject('/lti/launch/cogniate');
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('POST');
  });

  it('a replay is INVALID_STATE (check 1); the error page carries the trace id that is in the log', async () => {
    const h = await harness();
    const { idToken, state, cookie } = await launchOk(h);
    const replay = await postLaunch(h, { id_token: idToken, state }, cookie);
    expect(replay.statusCode).toBe(401);
    expect(replay.headers.location).toBeUndefined();
    const trace = String(replay.headers['x-trace-id']);
    expect(replay.body).toContain('data-error-code="INVALID_STATE"');
    expect(replay.body).toContain(`data-trace-id="${trace}"`);
    expect(replay.headers['content-security-policy']).toBe("default-src 'none'; style-src 'self'; frame-ancestors https:; form-action 'none'");
    expect(h.lines).toContainEqual(expect.objectContaining({ event: 'launch_check_failed', check: '1', code: 'INVALID_STATE', detail: 'state_unknown_used_or_expired', trace_id: trace }));
    expect(replay.body).toMatch(/<p data-error-action>[^<]+<\/p>/);
    // No token, state or ltik in any log line.
    expect(JSON.stringify(h.lines)).not.toContain(idToken);
    expect(JSON.stringify(h.lines)).not.toContain(state);
  });

  it('no cookie: STATE_COOKIE_MISSING with the resource-link help text; the state is used up', async () => {
    const h = await harness();
    const { state, nonce, cookie } = await doLogin(h);
    const idToken = await sign(h.key, moodleClaims({ nonce }, Math.floor(h.clock.now / 1000)));
    const res = await postLaunch(h, { id_token: idToken, state });
    expect(res.body).toContain('data-error-code="STATE_COOKIE_MISSING"');
    expect(res.body).toContain(COOKIE_HELP.resourceLink.replace(/'/g, '&#39;'));
    const again = await postLaunch(h, { id_token: idToken, state }, cookie);
    expect(again.body).toContain('data-error-code="INVALID_STATE"');
  });

  it('an OIDC error answer shows PLATFORM_ERROR with the code and uses up the state', async () => {
    const h = await harness();
    const { state, cookie } = await doLogin(h);
    const res = await postLaunch(h, { error: 'access_denied', error_description: 'no', state }, cookie);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('data-error-code="PLATFORM_ERROR"');
    expect(res.body).toContain('access_denied');
    expect(h.lines).toContainEqual(expect.objectContaining({ event: 'launch_check_failed', check: 'oidc_error', code: 'PLATFORM_ERROR', detail: 'error=access_denied' }));
    expect((await postLaunch(h, { error: 'access_denied', state }, cookie)).body).toContain('INVALID_STATE');
  });

  it('a platform switched off between login and launch gives PLATFORM_NOT_ACTIVE', async () => {
    const h = await harness();
    const { state, nonce, cookie } = await doLogin(h);
    updatePlatform(h.db, 'cogniate', h.platform.id, { active: false });
    const res = await postLaunch(h, { id_token: await sign(h.key, moodleClaims({ nonce }, Math.floor(h.clock.now / 1000))), state }, cookie);
    expect(res.body).toContain('data-error-code="PLATFORM_NOT_ACTIVE"');
  });

  it('drops a ltik parameter that is inside target_link_uri', async () => {
    const h = await harness();
    const { state, nonce, cookie } = await doLogin(h, { target_link_uri: `${LAUNCH}?resource=seed&ltik=attacker` });
    const idToken = await sign(h.key, moodleClaims({ nonce, [CLAIM.targetLinkUri]: `${LAUNCH}?resource=seed&ltik=attacker` }, Math.floor(h.clock.now / 1000)));
    const res = await postLaunch(h, { id_token: idToken, state }, cookie);
    const loc = new URL(res.headers.location as string);
    expect(loc.searchParams.getAll('ltik')).toHaveLength(1);
    expect(loc.searchParams.get('ltik')).not.toBe('attacker');
  });
});

describe('GET /api/idtoken', () => {
  async function ltikOf(h: Harness): Promise<string> {
    const { res } = await launchOk(h);
    return new URL(res.headers.location as string).searchParams.get('ltik')!;
  }

  it('returns the LTIAAS-shaped token (no email or name for an anonymous launch)', async () => {
    const h = await harness();
    const ltik = await ltikOf(h);
    const res = await json(h, 'GET', '/api/idtoken', `LTIK-AUTH-V2 ${h.apiKey}:${ltik}`);
    expect(res.statusCode).toBe(200);
    const t = res.json() as Record<string, Record<string, unknown>>;
    expect(t.ltiVersion).toBe('1.3.0');
    expect(t.user).toEqual({ id: '5', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'] });
    expect(t.platform).toMatchObject({ id: h.platform.id, url: ISSUER, clientId: CLIENT_ID, deploymentId: '1', productFamilyCode: 'moodle' });
    expect(t.launch).toMatchObject({
      type: 'LtiResourceLinkRequest', target: `${LAUNCH}?resource=seed`, context: { id: '2', label: 'COGNIATE-DEV-101' },
      resourceLink: { id: '3' }, presentation: { documentTarget: 'window', document_target: 'window' }, custom: {},
    });
    expect(t.services).toMatchObject({ deepLinking: { available: false }, namesAndRoles: { available: false }, assignmentAndGrades: { available: false } });
    const raw = (await json(h, 'GET', '/api/idtoken?raw=true', `LTIK-AUTH-V2 ${h.apiKey}:${ltik}`)).json() as Record<string, unknown>;
    expect(raw).toMatchObject({ iss: ISSUER, aud: CLIENT_ID, sub: '5', [CLAIM.messageType]: 'LtiResourceLinkRequest', [CLAIM.deploymentId]: '1' });
  });

  it('rejects wrong headers with the contract codes', async () => {
    const h = await harness();
    const ltik = await ltikOf(h);
    const code = async (auth: string | undefined) => ((await json(h, 'GET', '/api/idtoken', auth)).json() as { details: { message: string } }).details.message;
    expect(await code(`LTIK-AUTH-V2 ${h.otherApiKey}:${ltik}`)).toBe('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
    expect(await code(`LTIK-AUTH-V2 ${h.apiKey}:${'a'.repeat(43)}`)).toBe('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
    expect(await code(`LTIK-AUTH-V2 ${h.apiKey}`)).toBe('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
    expect(await code(`Bearer ${h.apiKey}`)).toBe('INVALID_AUTHORIZATION_HEADER');
    expect(await code(`SERVICE-AUTH-V1 ${h.apiKey}:abc`)).toBe('INVALID_AUTHORIZATION_HEADER');
    expect(await code(undefined)).toBe('INVALID_AUTHORIZATION_HEADER');
    // Scheme names are case-insensitive (contract §1.2).
    expect((await json(h, 'GET', '/api/idtoken', `ltik-auth-v2 ${h.apiKey}:${ltik}`)).statusCode).toBe(200);
  });

  it('the ltik expires after LTIK_TTL_SECONDS', async () => {
    const h = await harness({ ltikTtlSeconds: 20 });
    const ltik = await ltikOf(h);
    expect((await json(h, 'GET', '/api/idtoken', `LTIK-AUTH-V2 ${h.apiKey}:${ltik}`)).statusCode).toBe(200);
    h.clock.now += 23_000;
    expect((await json(h, 'GET', '/api/idtoken', `LTIK-AUTH-V2 ${h.apiKey}:${ltik}`)).statusCode).toBe(401);
  });
});

describe('cross-cutting', () => {
  it('reuses a valid incoming X-Trace-Id and replaces an invalid one', async () => {
    const h = await harness();
    expect((await h.app.inject({ url: '/healthz', headers: { 'x-trace-id': 'abcdef0123456789-xyz' } })).headers['x-trace-id']).toBe('abcdef0123456789-xyz');
    expect((await h.app.inject({ url: '/healthz', headers: { 'x-trace-id': 'short' } })).headers['x-trace-id']).toMatch(/^[0-9a-f]{32}$/);
  });

  it('health has status, service, profile, knobs and the outbound allowlist', async () => {
    const h = await harness();
    expect((await h.app.inject('/healthz')).json()).toEqual({ status: 'ok', service: 'lti-service', profile: 'default', knobs: [], outbound_allowlist: [] });
  });

  it('unknown routes use the error shape', async () => {
    const h = await harness();
    expect((await h.app.inject('/nope')).json()).toEqual({ status: 404, error: 'Not Found', details: { message: 'NOT_FOUND', description: 'Unknown route.' } });
  });

  it('logs no ltik, id_token, state, nonce or API key', async () => {
    const h = await harness();
    const { res, idToken, state } = await launchOk(h);
    const ltik = new URL(res.headers.location as string).searchParams.get('ltik')!;
    await json(h, 'GET', '/api/idtoken', `LTIK-AUTH-V2 ${h.apiKey}:${ltik}`);
    await postLaunch(h, { id_token: idToken, state });
    const all = JSON.stringify(h.lines);
    for (const secret of [ltik, idToken, state, h.apiKey]) expect(all).not.toContain(secret);
    expect(h.lines.filter((l) => l.event === 'http_request').every((l) => typeof l.trace_id === 'string')).toBe(true);
  });
});
