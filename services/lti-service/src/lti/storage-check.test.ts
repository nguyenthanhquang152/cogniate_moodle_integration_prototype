import { afterEach, expect, it, vi } from 'vitest';
import * as shared from '@cogniate/shared';
import { sha256Hex } from '@cogniate/shared';
import { CLAIM, stateCookieName } from './checks.ts';
import type { LaunchDeps } from './launch.ts';
import { handleLaunch, handleStorageCheck } from './launch.ts';
import { createPlatformKeys } from './jwks.ts';
import { findProfile, profileEndpoints } from '../profiles/index.ts';
import { createPlatform } from '../store/platforms.ts';
import { createAccountResolver } from '../accounts/resolver.ts';
import { getAccount, updateAccount } from '../store/accounts.ts';
import { capturingLogger, CLIENT_ID, harness, LAUNCH, loginForm, moodleClaims, postLaunch, sign, URLS } from '../testkit.ts';

const close: Array<() => Promise<void>> = [];
afterEach(async () => { vi.restoreAllMocks(); for (const fn of close.splice(0)) await fn(); });
// The route resolves the account of the path once per request; these direct calls read it the same way.
const accountOf = (deps: LaunchDeps, id = 'cogniate') => getAccount(deps.db, id);
const parseData = (html: string): Record<string, string> => JSON.parse(html.match(/<script id="lti-storage-data" type="application\/json">([^]*?)<\/script>/)![1]!) as Record<string, string>;

async function setup(deepLinking = false) {
  const h = await harness({ simulationProfiles: true });
  close.push(async () => { await h.app.close(); h.db.close(); });
  const profile = findProfile('canvas-sim-cloud', { simulation: true })!;
  const endpoints = profileEndpoints(profile, { siteUrl: 'https://school.example.test', clientId: CLIENT_ID });
  const platform = createPlatform(h.db, 'cogniate', {
    issuer: endpoints.issuer, clientId: CLIENT_ID, name: 'Unit', active: true,
    authEndpoint: endpoints.authenticationEndpoint, tokenEndpoint: endpoints.accesstokenEndpoint, jwksUrl: endpoints.jwksUrl,
    profile: profile.id, siteUrl: 'https://school.example.test', deploymentIds: ['1'],
  });
  const login = await h.app.inject({ method: 'POST', url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: loginForm({ iss: platform.issuer, lti_storage_target: 'forwarding' }) });
  expect(login.statusCode).toBe(200);
  const auth = new URL(parseData(login.body).authUrl!);
  const state = auth.searchParams.get('state')!;
  const claims = moodleClaims({
    iss: platform.issuer, nonce: auth.searchParams.get('nonce'), email: 'private@example.test',
    [CLAIM.toolPlatform]: { product_family_code: 'canvas' },
    ...(deepLinking ? { [CLAIM.messageType]: 'LtiDeepLinkingRequest', [CLAIM.deepLinkingSettings]: { deep_link_return_url: 'https://school.example.test/deep-return' } } : {}),
  }, Math.floor(h.clock.now / 1000));
  const form = { state, id_token: await sign(h.key, claims) };
  const deps = { db: h.db, urls: URLS, resolver: createAccountResolver(h.db, URLS.lti), keys: createPlatformKeys(h.outbound), logger: capturingLogger().logger, now: () => h.clock.now, ltikTtlSeconds: 86400, profiles: { simulation: true } };
  const start = async () => {
    const page = await handleLaunch(deps, accountOf(deps), form, undefined, 'unit-storage');
    if (!page.ok || page.kind !== 'storage') throw new Error('Expected storage page');
    return { page, check: parseData(page.page.html).check! };
  };
  return { h, deps, form, state, start, platform };
}

it.each([false, true])('prepares minimized claims without an ltik, then completes the same tool redirect (deep linking %s)', async (deepLinking) => {
  const { h, deps, form, state, start, platform } = await setup(deepLinking);
  const { page, check } = await start();
  expect(page.page.headers).toMatchObject({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'same-origin' });
  expect(page.page.headers['content-security-policy']).toContain("form-action 'self'");
  expect(page.page.html).not.toContain(state);
  expect(page.page.html).not.toContain(form.id_token);
  expect(h.db.prepare('SELECT * FROM launch').all()).toHaveLength(0);
  const row = h.db.prepare('SELECT prepared_launch FROM storage_check').get() as { prepared_launch: string };
  expect(row.prepared_launch).not.toContain('private@example.test');
  expect(JSON.parse(row.prepared_launch)).toMatchObject({ platformId: platform.id, bindingGeneration: 0, siteOrigin: 'https://school.example.test' });
  const result = handleStorageCheck(deps, accountOf(deps), { check, value: state }, URLS.lti);
  if (!result.ok || result.kind !== 'redirect') throw new Error('Expected accepted launch');
  const redirect = new URL(result.location);
  expect(result.binding).toBe('storage');
  expect(redirect.origin).toBe(URLS.app);
  expect(redirect.pathname).toBe(deepLinking ? '/tool/deep-link' : '/tool/launch');
  expect(redirect.searchParams.get('resource')).toBe('seed');
  expect(redirect.searchParams.get('ltik')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(h.db.prepare('SELECT * FROM launch').all()).toHaveLength(1);
  expect(handleStorageCheck(deps, accountOf(deps), { check, value: state }, URLS.lti)).toMatchObject({ ok: false, detail: 'storage_check_unknown_used_or_expired' });
});

it('refuses the wrong origin before consumption and consumes a mismatch before a retry', async () => {
  const { h, deps, state, start } = await setup();
  const { check } = await start();
  for (const origin of [undefined, 'null', 'https://evil.test']) {
    expect(handleStorageCheck(deps, accountOf(deps), { check, value: state }, origin)).toMatchObject({ ok: false, check: 'storage', status: 400, code: 'INVALID_STATE', detail: 'storage_origin' });
    expect(h.db.prepare('SELECT used_at FROM storage_check').get()).toEqual({ used_at: null });
  }
  expect(handleStorageCheck(deps, accountOf(deps), { check, value: 'wrong' }, URLS.lti)).toMatchObject({ ok: false, code: 'INVALID_STATE', detail: 'storage_mismatch' });
  expect(handleStorageCheck(deps, accountOf(deps), { check, value: state }, URLS.lti)).toMatchObject({ ok: false, detail: 'storage_check_unknown_used_or_expired' });
  expect(h.db.prepare('SELECT * FROM launch').all()).toHaveLength(0);
});

it('shows the storage help for an empty value and enforces the controlled 121-second expiry', async () => {
  const { h, deps, state, start } = await setup();
  const { check } = await start();
  expect(handleStorageCheck(deps, accountOf(deps), { check, value: '' }, URLS.lti)).toMatchObject({
    ok: false, status: 400, code: 'STATE_COOKIE_MISSING', help: 'Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site.',
  });
  // A new attempt uses its own fresh state and check; the clock can advance without a running stack.
  const next = await setup();
  const pending = await next.start();
  next.h.clock.now += 121_000;
  expect(handleStorageCheck(next.deps, accountOf(next.deps), { check: pending.check, value: next.state }, URLS.lti)).toMatchObject({ ok: false, status: 400, detail: 'storage_check_unknown_used_or_expired' });
  expect(handleStorageCheck(deps, accountOf(deps, 'qa-second'), { check, value: state }, URLS.lti)).toMatchObject({ ok: false, detail: 'storage_check_unknown_used_or_expired' });
  expect(h.db.prepare('SELECT * FROM launch').all()).toHaveLength(0);
});

it('gates account status before origin and consumption, and allows the same check after reactivation', async () => {
  const { h, state, start } = await setup();
  const { check } = await start();
  const post = (origin: string) => h.app.inject({ method: 'POST', url: '/lti/launch/cogniate/storage-check', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams({ check, value: state }).toString() });
  updateAccount(h.db, 'cogniate', { status: 'suspended' }, h.clock.now);
  const refused = await post('null');
  expect(refused.statusCode).toBe(403);
  expect(refused.body).toContain('data-error-code="TOOL_ACCOUNT_SUSPENDED"');
  expect(h.db.prepare('SELECT used_at FROM storage_check').get()).toEqual({ used_at: null });
  updateAccount(h.db, 'cogniate', { status: 'active' }, h.clock.now);
  expect((await post(URLS.lti)).statusCode).toBe(303);
  expect(h.lines).toContainEqual(expect.objectContaining({ event: 'launch_accepted', binding: 'storage' }));
  updateAccount(h.db, 'cogniate', { status: 'closed' }, h.clock.now);
  const closed = await post('null');
  expect(closed.statusCode).toBe(404);
  expect(closed.body).toContain('data-error-code="UNKNOWN_TOOL_ACCOUNT"');
});

it('keeps the cookie path and refuses a mismatched cookie without creating a storage check', async () => {
  const { h, form, state } = await setup();
  const result = await postLaunch(h, form, `${stateCookieName(sha256Hex(state))}=${state}`);
  expect(result.statusCode).toBe(303);
  expect(h.lines).toContainEqual(expect.objectContaining({ event: 'launch_accepted', binding: 'cookie' }));
  expect(h.db.prepare('SELECT * FROM storage_check').all()).toHaveLength(0);
  const next = await setup();
  const refused = await postLaunch(next.h, next.form, `${stateCookieName(sha256Hex(next.state))}=wrong`);
  expect(refused.statusCode).toBe(401);
  expect(next.h.db.prepare('SELECT * FROM storage_check').all()).toHaveLength(0);
});

it.each([true, false])('a parallel login overwrites the storage slot; matching cookie present: %s (BD-A2-44)', async (cookiePresent) => {
  const { h, state, form, platform } = await setup();
  const firstKey = `cog_state_${sha256Hex(state)[0]}`;
  const storage = new Map([[firstKey, state]]);
  // Choose a distinct state with the same key digit, then issue a real second login on the same platform.
  const otherState = Array.from({ length: 1000 }, (_, i) => `parallel-${i}`.padEnd(43, 'x')).find((value) => value !== state && sha256Hex(value)[0] === sha256Hex(state)[0])!;
  vi.spyOn(shared, 'randomToken').mockReturnValueOnce(otherState).mockReturnValueOnce('n'.repeat(43));
  const secondLogin = await h.app.inject({ method: 'POST', url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: loginForm({ iss: platform.issuer, lti_storage_target: 'forwarding' }) });
  expect(secondLogin.statusCode).toBe(200);
  const secondData = parseData(secondLogin.body);
  expect(secondData.key).toBe(firstKey);
  expect(secondData.state).toBe(otherState);
  storage.set(secondData.key!, secondData.state!);
  const cookie = `${stateCookieName(sha256Hex(state))}=${state}`;
  const initial = await postLaunch(h, form, cookiePresent ? cookie : undefined);
  if (cookiePresent) {
    expect(initial.statusCode).toBe(303);
    expect(h.db.prepare('SELECT * FROM storage_check').all()).toHaveLength(0);
    expect(h.lines).toContainEqual(expect.objectContaining({ event: 'launch_accepted', binding: 'cookie' }));
  } else {
    expect(initial.statusCode).toBe(200);
    const data = parseData(initial.body);
    const answer = await h.app.inject({ method: 'POST', url: '/lti/launch/cogniate/storage-check',
      // Even a cookie restored at this point cannot authorize the storage-check route.
      headers: { origin: URLS.lti, cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ check: data.check!, value: storage.get(data.key!)! }).toString(),
    });
    expect(answer.statusCode).toBe(400);
    expect(answer.body).toContain('data-error-code="INVALID_STATE"');
    expect(h.lines).toContainEqual(expect.objectContaining({ event: 'launch_check_failed', check: 'storage', detail: 'storage_mismatch' }));
    expect(h.db.prepare('SELECT * FROM launch').all()).toHaveLength(0);
  }
});

it('runs signature verification before making a storage check and uses up the state', async () => {
  const { h, deps, form } = await setup();
  deps.keys.verify = async () => { throw new Error('bad signature'); };
  expect(await handleLaunch(deps, accountOf(deps), form, undefined, 'unit')).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' });
  expect(h.db.prepare('SELECT used_at FROM oidc_state').get()).toEqual({ used_at: h.clock.now });
  expect(h.db.prepare('SELECT * FROM storage_check').all()).toHaveLength(0);
});

it('returns 405 and Allow POST for non-POST methods on storage-check', async () => {
  const { h } = await setup();
  for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'] as const) {
    const result = await h.app.inject({ method, url: `${LAUNCH}/storage-check` });
    expect(result.statusCode, method).toBe(405);
    expect(result.headers.allow, method).toBe('POST');
  }
});
