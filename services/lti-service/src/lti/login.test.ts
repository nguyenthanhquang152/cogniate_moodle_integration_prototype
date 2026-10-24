import * as shared from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderProfile } from '../profiles/index.ts';
import { CLIENT_ID, ISSUER, LAUNCH, URLS, harness, loginForm, testProfileRegistry } from '../testkit.ts';
import { updateAccount } from '../store/accounts.ts';
import { STATE_TTL_MS } from '../store/states.ts';

const state = 'a'.repeat(43);
const nonce = 'b'.repeat(43);
const params = { iss: ISSUER, client_id: CLIENT_ID, login_hint: '5', target_link_uri: `${LAUNCH}?resource=seed`, lti_message_hint: '{"cmid":3}', lti_deployment_id: '1' };
const close: Array<() => Promise<void>> = [];
afterEach(async () => { vi.restoreAllMocks(); for (const fn of close.splice(0)) await fn(); });

async function setup(storage: ProviderProfile['platformStorage']) {
  const registry = await testProfileRegistry('Unit LMS', storage);
  const h = await harness({ profiles: { simulation: false, registry } });
  close.push(async () => { await h.app.close(); h.db.close(); });
  h.db.prepare('UPDATE platform SET profile = ? WHERE id = ?').run('zz-admin', h.platform.id);
  const random = vi.spyOn(shared, 'randomToken');
  const login = (over: Record<string, string> = {}, method: 'GET' | 'POST' = 'GET') => {
    // Reuse the exact state and nonce when comparing the two response builders.
    h.db.prepare('DELETE FROM oidc_state').run();
    random.mockReset().mockReturnValueOnce(state).mockReturnValueOnce(nonce).mockReturnValue('c'.repeat(43));
    const form = new URLSearchParams({ ...params, ...over }).toString();
    return h.app.inject(method === 'GET'
      ? { method, url: `/lti/login/cogniate?${form}` }
      : { method, url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: form });
  };
  return { h, login };
}

// The pre-storage builder, with the same controlled random values (AC-01).
function legacyAnswer(over: Record<string, string> = {}) {
  const p = { ...params, ...over };
  const auth = new URL(`${ISSUER}/mod/lti/auth.php`);
  for (const [key, value] of Object.entries({
    scope: 'openid', response_type: 'id_token', response_mode: 'form_post', prompt: 'none', client_id: CLIENT_ID,
    redirect_uri: `${URLS.lti}/lti/launch/cogniate`, login_hint: p.login_hint, lti_message_hint: p.lti_message_hint, state, nonce,
  })) auth.searchParams.set(key, value);
  return { location: auth.href, cookie: `__Host-lti_state_${shared.sha256Hex(state).slice(0, 8)}=${state}; Path=/; Max-Age=${STATE_TTL_MS / 1000}; Secure; HttpOnly; SameSite=None; Partitioned` };
}

function pageData(html: string) {
  return JSON.parse(html.match(/<script id="lti-storage-data" type="application\/json">([^]*?)<\/script>/)![1]!) as {
    authUrl: string; state: string; target: string; origin: string; key: string;
  };
}

describe('platform storage login', () => {
  it('keeps the old 302, Location and Set-Cookie with a null trait (AC-01)', async () => {
    const { h, login } = await setup(null);
    const result = await login({ lti_storage_target: 'forwarding' });
    const old = legacyAnswer();
    expect(result.statusCode).toBe(302);
    expect(result.headers.location).toBe(old.location);
    expect(result.headers['set-cookie']).toBe(old.cookie);
    expect(result.body).toBe('');
    expect(h.db.prepare('SELECT storage_target, storage_origin FROM oidc_state').get()).toMatchObject({ storage_target: null, storage_origin: null });
  });

  it.each([undefined, '', 'a'.repeat(65), 'a b'])('keeps the 302 with an absent or invalid from-login target %s (AC-02, AC-05)', async (target) => {
    const { h, login } = await setup({ targetFrame: 'from-login', origin: 'authOrigin' });
    const result = await login(target === undefined ? {} : { lti_storage_target: target });
    expect(result.statusCode).toBe(302);
    expect(result.headers.location).toBe(legacyAnswer().location);
    expect(result.headers['set-cookie']).toBe(legacyAnswer().cookie);
    expect(h.db.prepare('SELECT storage_target, storage_origin FROM oidc_state').get()).toMatchObject({ storage_target: null, storage_origin: null });
  });

  it.each(['GET', 'POST'] as const)('returns the page and unchanged cookie for %s, with the exact old auth URL (AC-03, AC-04, AC-08)', async (method) => {
    const { h, login } = await setup({ targetFrame: 'from-login', origin: 'authOrigin' });
    const result = await login({ lti_storage_target: 'post_message_forwarding' }, method);
    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'set-cookie': legacyAnswer().cookie });
    const cspNonce = result.body.match(/<script nonce="([^"]+)">/)![1];
    expect(result.headers['content-security-policy']).toBe(`default-src 'none'; script-src 'nonce-${cspNonce}'; frame-ancestors https:; form-action 'none'; base-uri 'none'`);
    expect(result.headers.location).toBeUndefined();
    expect(pageData(result.body)).toMatchObject({ authUrl: legacyAnswer().location, state, target: 'post_message_forwarding', origin: new URL(h.platform.authEndpoint).origin, key: `cog_state_${shared.sha256Hex(state)[0]}` });
    expect(h.db.prepare('SELECT storage_target, storage_origin FROM oidc_state').get()).toMatchObject({ storage_target: 'post_message_forwarding', storage_origin: new URL(h.platform.authEndpoint).origin });
  });

  it('uses a fixed frame and fixed storage origin without a target parameter (AC-07)', async () => {
    const { login } = await setup({ targetFrame: '_parent', origin: 'https://storage.example.edu' });
    const result = await login({ lti_storage_target: 'ignored' });
    expect(result.statusCode).toBe(200);
    expect(pageData(result.body)).toMatchObject({ target: '_parent', origin: 'https://storage.example.edu' });
  });

  it('preserves the hostile login hint through URL encoding and the JSON block (AC-06 login)', async () => {
    const { login } = await setup({ targetFrame: 'from-login', origin: 'authOrigin' });
    const loginHint = '</script><script>alert(1)</script>&\u2028\u2029';
    const result = await login({ lti_storage_target: '_parent', login_hint: loginHint });
    expect(result.statusCode).toBe(200);
    const data = pageData(result.body);
    expect(data.authUrl).toBe(legacyAnswer({ login_hint: loginHint }).location);
    expect(new URL(data.authUrl).searchParams.get('login_hint')).toBe(loginHint);
    expect(result.body).not.toContain(loginHint);
    expect(result.body.match(/<script\b/g)).toHaveLength(2);
    expect(result.body).toContain('\\u0026');
  });
});

// LA-E5-18 (contract delta §6): login_rejected names the account and the platform only when each is a stored row.
describe('tenant ids in login_rejected', () => {
  async function plain() {
    const h = await harness();
    close.push(async () => { await h.app.close(); h.db.close(); });
    const get = (account: string, over: Record<string, string> = {}) => h.app.inject({ method: 'GET', url: `/lti/login/${encodeURIComponent(account)}?${loginForm(over)}` });
    const rejected = () => {
      const lines = h.lines.filter((l) => l.event === 'login_rejected');
      expect(lines).toHaveLength(1);
      return lines[0]!;
    };
    return { h, get, rejected };
  }

  it.each(['nobody', 'Not-An-Id!'])('a login for an unknown account %s logs no tool_account_id field: the old field set (AC-LA-E5-18-04)', async (account) => {
    const { get, rejected } = await plain();
    const res = await get(account);
    expect(res.statusCode).toBe(404);
    expect(rejected()).toEqual({
      ts: expect.any(String), level: 'warn', service: 'lti-service', event: 'login_rejected', trace_id: res.headers['x-trace-id'],
      code: 'UNKNOWN_TOOL_ACCOUNT', detail: 'unknown_tool_account',
    });
  });

  it.each([
    ['an unknown iss (AC-LA-E5-18-01 at unit level)', { iss: 'https://unknown-lms.test' }, 'UNKNOWN_PLATFORM'],
    ['a missing login_hint', { login_hint: '' }, 'INVALID_REQUEST'],
  ])('%s: tool_account_id only, no platform_id field', async (_n, over, code) => {
    const { get, rejected } = await plain();
    await get('cogniate', over);
    const line = rejected();
    expect(line).toMatchObject({ code, tool_account_id: 'cogniate' });
    expect(line).not.toHaveProperty('platform_id');
  });

  it.each([
    ['an unknown deployment', { lti_deployment_id: 'nine' }, 'UNKNOWN_DEPLOYMENT'],
    ['a target that is not our launch URL', { target_link_uri: 'https://evil.test/lti/launch/cogniate' }, 'INVALID_TARGET_LINK_URI'],
  ])('%s after the platform is found: tool_account_id and platform_id', async (_n, over, code) => {
    const { h, get, rejected } = await plain();
    await get('cogniate', over);
    expect(rejected()).toMatchObject({ code, tool_account_id: 'cogniate', platform_id: h.platform.id });
  });

  it.each(['suspended', 'closed'] as const)('a %s account is a stored row: tool_account_id, no platform_id', async (status) => {
    const { h, get, rejected } = await plain();
    updateAccount(h.db, 'cogniate', { status }, h.clock.now);
    await get('cogniate');
    const line = rejected();
    expect(line).toMatchObject({ tool_account_id: 'cogniate' });
    expect(line).not.toHaveProperty('platform_id');
  });
});
