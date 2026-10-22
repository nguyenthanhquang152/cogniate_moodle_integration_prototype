import { afterEach, expect, it } from 'vitest';
import { updateAccount } from '../../store/accounts.ts';
import { doLogin, harness, loginForm, moodleClaims, postLaunch, sign } from '../../testkit.ts';

const close: Array<() => Promise<void>> = [];
afterEach(async () => { for (const fn of close.splice(0)) await fn(); });

it.each([
  ['suspended', 403, 'TOOL_ACCOUNT_SUSPENDED', 200],
  ['closed', 404, 'UNKNOWN_TOOL_ACCOUNT', 404],
] as const)('gates %s before state consumption or outbound work, with the required key policy', async (status, expected, code, keysStatus) => {
  const h = await harness();
  close.push(async () => { await h.app.close(); h.db.close(); });
  const login = await doLogin(h);
  const token = await sign(h.key, moodleClaims({ nonce: login.nonce }, Math.floor(h.clock.now / 1000)));
  updateAccount(h.db, 'cogniate', { status }, h.clock.now);

  for (const method of ['GET', 'POST'] as const) {
    const form = loginForm();
    const answer = await h.app.inject(method === 'GET'
      ? { method, url: `/lti/login/cogniate?${form}` }
      : { method, url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: form });
    expect(answer.statusCode).toBe(expected);
    expect(answer.body).toContain(`data-error-code="${code}"`);
    expect(answer.headers['set-cookie']).toBeUndefined();
  }
  const launch = await postLaunch(h, { state: login.state, id_token: token }, login.cookie);
  expect(launch.statusCode).toBe(expected);
  expect(launch.body).toContain(`data-error-code="${code}"`);
  expect(launch.headers.location).toBeUndefined();
  expect(h.db.prepare('SELECT used_at FROM oidc_state').all()).toEqual([{ used_at: null }]);
  expect(h.db.prepare('SELECT COUNT(*) AS n FROM launch').get()?.n).toBe(0);
  const registration = await h.app.inject({ method: 'GET', url: '/lti/register/cogniate?openid_configuration=https%3A%2F%2Flms.example.test%2Fconfig' });
  expect(registration.statusCode).toBe(expected);
  expect(registration.body).toContain(`data-error-code="${code}"`);
  expect(h.db.prepare('SELECT COUNT(*) AS n FROM registration_session').get()?.n).toBe(0);
  expect(h.outbound.calls).toEqual([]);
  const keys = await h.app.inject({ method: 'GET', url: '/lti/keys/cogniate' });
  expect(keys.statusCode).toBe(keysStatus);
  if (status === 'suspended') expect(keys.json().keys).toHaveLength(1);
  expect((await h.app.inject({ method: 'GET', url: '/lti/keys/qa-second' })).statusCode).toBe(200);
});
