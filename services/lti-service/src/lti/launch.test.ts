// LA-E5-18: tenant ids in the launch log lines (contract delta §6). An id is in a line only when it is a stored row.
import { sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { findProfile, profileEndpoints } from '../profiles/index.ts';
import type { ToolAccount } from '../store/accounts.ts';
import { updateAccount } from '../store/accounts.ts';
import type { Platform } from '../store/platforms.ts';
import { createPlatform } from '../store/platforms.ts';
import type { Harness } from '../testkit.ts';
import { CLIENT_ID, URLS, doLogin, harness, loginForm, makeKey, moodleClaims, postLaunch, sign } from '../testkit.ts';
import { CLAIM, stateCookieName } from './checks.ts';
import { tenantLogIds } from './launch.ts';

const close: Array<() => Promise<void>> = [];
afterEach(async () => { for (const fn of close.splice(0)) await fn(); });

async function setup(opts: { simulationProfiles?: boolean } = {}) {
  const h = await harness(opts);
  close.push(async () => { await h.app.close(); h.db.close(); });
  return h;
}
const nowS = (h: Harness) => Math.floor(h.clock.now / 1000);
/** The one line of this event; a second line would hide which request wrote the ids. */
function lineOf(h: Harness, event: string): Record<string, unknown> {
  const lines = h.lines.filter((l) => l.event === event);
  expect(lines).toHaveLength(1);
  return lines[0]!;
}
// Personal data in the token; no log line may hold it (AC-LA-E5-18-05 at unit level).
const PERSONAL = { sub: 'learner-sub-7f3a9c', name: 'Private Person', email: 'private.person@example.test' };

describe('tenantLogIds', () => {
  const account = { id: 'cogniate' } as ToolAccount;
  const platform = { id: 'plt_1' } as Platform;

  it('gives each id only when its row is known, never an empty string', () => {
    expect(tenantLogIds(null)).toEqual({});
    expect(tenantLogIds(null, platform)).toEqual({});
    expect(tenantLogIds(account)).toEqual({ tool_account_id: 'cogniate' });
    expect(tenantLogIds(account, null)).toEqual({ tool_account_id: 'cogniate' });
    expect(tenantLogIds(account, platform)).toEqual({ tool_account_id: 'cogniate', platform_id: 'plt_1' });
  });
});

describe('launch_accepted (contract delta §6)', () => {
  it('a valid launch logs tool_account_id, platform_id and binding cookie, and no other new field (AC-LA-E5-18-03 at unit level)', async () => {
    const h = await setup();
    const { state, nonce, cookie } = await doLogin(h);
    const idToken = await sign(h.key, moodleClaims({ nonce, ...PERSONAL }, nowS(h)));
    const res = await postLaunch(h, { state, id_token: idToken }, cookie);
    expect(res.statusCode).toBe(303);
    expect(lineOf(h, 'launch_accepted')).toEqual({
      ts: expect.any(String), level: 'info', service: 'lti-service', event: 'launch_accepted', trace_id: res.headers['x-trace-id'],
      tool_account_id: 'cogniate', platform_id: h.platform.id, message_type: 'LtiResourceLinkRequest', binding: 'cookie',
    });
    for (const value of Object.values(PERSONAL)) expect(JSON.stringify(h.lines)).not.toContain(value);
  });
});

describe('launch_check_failed (contract delta §6)', () => {
  it('a bad signature for a known platform logs check 6 with tool_account_id and platform_id (AC-LA-E5-18-02 at unit level)', async () => {
    const h = await setup();
    const { state, nonce, cookie } = await doLogin(h);
    // The same kid with another key pair: the signature does not verify.
    const other = await makeKey(h.key.kid);
    const res = await postLaunch(h, { state, id_token: await sign(other, moodleClaims({ nonce, ...PERSONAL }, nowS(h))) }, cookie);
    expect(res.statusCode).toBe(401);
    expect(lineOf(h, 'launch_check_failed')).toMatchObject({ check: '6', tool_account_id: 'cogniate', platform_id: h.platform.id });
    for (const value of Object.values(PERSONAL)) expect(JSON.stringify(h.lines)).not.toContain(value);
  });

  it.each([
    ['an OIDC error answer', 'oidc_error', async (h: Harness) => {
      const { state, cookie } = await doLogin(h);
      return postLaunch(h, { error: 'access_denied', state }, cookie);
    }],
    ['no state cookie', '2', async (h: Harness) => {
      const { state, nonce } = await doLogin(h);
      return postLaunch(h, { state, id_token: await sign(h.key, moodleClaims({ nonce }, nowS(h))) });
    }],
    ['an expired token', '7', async (h: Harness) => {
      const { state, nonce, cookie } = await doLogin(h);
      return postLaunch(h, { state, id_token: await sign(h.key, moodleClaims({ nonce }, nowS(h) - 3600)) }, cookie);
    }],
    ['a wrong nonce', '8', async (h: Harness) => {
      const { state, cookie } = await doLogin(h);
      return postLaunch(h, { state, id_token: await sign(h.key, moodleClaims({ nonce: 'other' }, nowS(h))) }, cookie);
    }],
  ])('%s after the state names the platform logs both ids (check %s)', async (_n, check, run) => {
    const h = await setup();
    await run(h);
    expect(lineOf(h, 'launch_check_failed')).toMatchObject({ check, tool_account_id: 'cogniate', platform_id: h.platform.id });
  });

  it('a state that is not stored: tool_account_id only, no platform_id field', async () => {
    const h = await setup();
    await postLaunch(h, { state: 's'.repeat(43), id_token: 'a.b.c' });
    const line = lineOf(h, 'launch_check_failed');
    expect(line).toMatchObject({ check: '1', code: 'INVALID_STATE', tool_account_id: 'cogniate' });
    expect(line).not.toHaveProperty('platform_id');
  });

  it.each(['nobody', 'Not-An-Id!'])('an account path %s that is not a stored account gives the old field set (no id field)', async (account) => {
    const h = await setup();
    const res = await h.app.inject({ method: 'POST', url: `/lti/launch/${encodeURIComponent(account)}`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: 'state=x' });
    expect(res.statusCode).toBe(404);
    expect(lineOf(h, 'launch_check_failed')).toEqual({
      ts: expect.any(String), level: 'warn', service: 'lti-service', event: 'launch_check_failed', trace_id: res.headers['x-trace-id'],
      check: '1', code: 'UNKNOWN_TOOL_ACCOUNT', detail: 'unknown_tool_account',
    });
  });

  it.each(['suspended', 'closed'] as const)('a %s account is a stored row: tool_account_id, no platform_id (the gate runs before the state)', async (status) => {
    const h = await setup();
    const { state, nonce, cookie } = await doLogin(h);
    updateAccount(h.db, 'cogniate', { status }, h.clock.now);
    await postLaunch(h, { state, id_token: await sign(h.key, moodleClaims({ nonce }, nowS(h))) }, cookie);
    const line = lineOf(h, 'launch_check_failed');
    expect(line).toMatchObject({ check: '1', tool_account_id: 'cogniate' });
    expect(line).not.toHaveProperty('platform_id');
  });
});

describe('platform storage and claim policy lines (contract delta §6)', () => {
  // A Canvas simulator platform: claim allowlist and platform storage (as in storage-check.test.ts).
  async function canvas() {
    const h = await setup({ simulationProfiles: true });
    const profile = findProfile('canvas-sim-cloud', { simulation: true })!;
    const endpoints = profileEndpoints(profile, { siteUrl: 'https://school.example.test', clientId: CLIENT_ID });
    const platform = createPlatform(h.db, 'cogniate', {
      issuer: endpoints.issuer, clientId: CLIENT_ID, name: 'Unit', active: true,
      authEndpoint: endpoints.authenticationEndpoint, tokenEndpoint: endpoints.accesstokenEndpoint, jwksUrl: endpoints.jwksUrl,
      profile: profile.id, siteUrl: 'https://school.example.test', deploymentIds: ['1'],
    });
    const login = await h.app.inject({ method: 'POST', url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: loginForm({ iss: platform.issuer, lti_storage_target: 'forwarding' }) });
    expect(login.statusCode).toBe(200);
    const data = JSON.parse(login.body.match(/<script id="lti-storage-data" type="application\/json">([^]*?)<\/script>/)![1]!) as { authUrl: string };
    const auth = new URL(data.authUrl);
    const state = auth.searchParams.get('state')!;
    const claims = moodleClaims({ iss: platform.issuer, nonce: auth.searchParams.get('nonce'), ...PERSONAL, [CLAIM.toolPlatform]: { product_family_code: 'canvas' } }, nowS(h));
    return { h, platform, state, form: { state, id_token: await sign(h.key, claims) } };
  }
  const storageCheck = (h: Harness, check: string, value: string) => h.app.inject({
    method: 'POST', url: '/lti/launch/cogniate/storage-check',
    headers: { origin: URLS.lti, 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams({ check, value }).toString(),
  });
  const checkOf = (html: string) => (JSON.parse(html.match(/<script id="lti-storage-data" type="application\/json">([^]*?)<\/script>/)![1]!) as { check: string }).check;

  it('launch_claims_minimized and launch_accepted (cookie) name the account and the platform', async () => {
    const { h, platform, state, form } = await canvas();
    expect((await postLaunch(h, form, `${stateCookieName(sha256Hex(state))}=${state}`)).statusCode).toBe(303);
    expect(lineOf(h, 'launch_claims_minimized')).toMatchObject({ tool_account_id: 'cogniate', platform_id: platform.id });
    expect(lineOf(h, 'launch_accepted')).toMatchObject({ tool_account_id: 'cogniate', platform_id: platform.id, binding: 'cookie' });
    for (const value of Object.values(PERSONAL)) expect(JSON.stringify(h.lines)).not.toContain(value);
  });

  it('the storage check: a mismatch logs both ids; the accepted launch logs both ids and binding storage', async () => {
    const first = await canvas();
    const page = await postLaunch(first.h, first.form);
    expect(page.statusCode).toBe(200);
    expect((await storageCheck(first.h, checkOf(page.body), 'wrong')).statusCode).toBe(400);
    expect(lineOf(first.h, 'launch_check_failed')).toMatchObject({ check: 'storage', detail: 'storage_mismatch', tool_account_id: 'cogniate', platform_id: first.platform.id });

    const { h, platform, state, form } = await canvas();
    const next = await postLaunch(h, form);
    expect((await storageCheck(h, checkOf(next.body), state)).statusCode).toBe(303);
    expect(lineOf(h, 'launch_accepted')).toMatchObject({ tool_account_id: 'cogniate', platform_id: platform.id, binding: 'storage' });
  });

  it('the storage check before the record names a platform: tool_account_id only; an unknown account: no id', async () => {
    const h = await setup();
    await storageCheck(h, 'c'.repeat(43), 'value');
    const line = lineOf(h, 'launch_check_failed');
    expect(line).toMatchObject({ check: 'storage', detail: 'storage_check_unknown_used_or_expired', tool_account_id: 'cogniate' });
    expect(line).not.toHaveProperty('platform_id');

    const other = await setup();
    await other.app.inject({ method: 'POST', url: '/lti/launch/nobody/storage-check', headers: { origin: URLS.lti, 'content-type': 'application/x-www-form-urlencoded' }, payload: 'check=x&value=y' });
    const unknown = lineOf(other, 'launch_check_failed');
    expect(unknown).toMatchObject({ check: 'storage', code: 'UNKNOWN_TOOL_ACCOUNT' });
    expect(unknown).not.toHaveProperty('tool_account_id');
    expect(unknown).not.toHaveProperty('platform_id');
  });
});
