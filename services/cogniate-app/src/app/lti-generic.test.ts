// LA-E2-03: the lti-generic channel through the app API, served by the kernel admin-value adapter (no app.ts). Unit
// level with the fake LTI service; QA proves the stack (K1-SIM AC-03, -04, -05, -07).
import { afterEach, expect, it } from 'vitest';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, TEST_URLS, THANH, testApp } from '../testkit.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let t: TestApp;
afterEach(async () => { await t?.app.close(); });

const SITE = 'https://lms.school.edu';
const AGS = ['lineitem', 'lineitem.readonly', 'result.readonly', 'score'].map((s) => `https://purl.imsglobal.org/spec/lti-ags/scope/${s}`);

async function signedIn() {
  t = await testApp();
  const cookie = await t.login(THANH);
  const call = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    t.app.inject({ method, url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as Json } : {}) });
  return { call };
}

it('the provider list gives lti-generic after the three baseline entries, with its name, methods and profile', async () => {
  const { call } = await signedIn();
  const list = (await call('GET', '/app-api/lms-providers')).json().lms as Json[];
  expect(list.map((e) => e.lms)).toEqual(['moodle', 'canvas', 'blackboard', 'lti-generic']);
  expect(list[3]).toMatchObject({
    lms: 'lti-generic', channel: 'lti-generic', label: 'Other LTI 1.3 platform', channelName: 'your LMS', family: 'lti13', methods: ['dynamic', 'manual'],
    capabilities: { dynamicRegistration: true, operatorApproval: true, webServices: false, courseShell: false, addDeployment: true, canvasConfiguration: false },
    registration: [{ method: 'dynamic', authority: 'self', profiles: ['lti-generic'] }, { method: 'manual', authority: 'operatorGrant', profiles: ['lti-generic'] }],
    profiles: [{ id: 'lti-generic', label: 'Other LTI 1.3 platform', simulation: false, ready: true, clientId: null }],
  });
  expect(list[3]!.channelCapabilities['registration.scopes']).toEqual(AGS);
});

it('a manual or dynamic create passes site rules 1–4 and stores the channel, its profile and the method authority', async () => {
  const { call } = await signedIn();
  const create = (siteUrl: string, method: 'manual' | 'dynamic') => call('POST', '/app-api/connections', { name: 'School', siteUrl, method, lms: 'lti-generic' });
  for (const method of ['manual', 'dynamic'] as const) {
    for (const [siteUrl, rule] of [['https://203.0.113.7', 2], ['https://localhost', 2], [TEST_URLS.lti, 3]] as const) {
      const r = await create(siteUrl, method);
      expect([method, siteUrl, r.statusCode, r.json().details]).toEqual([method, siteUrl, 422, expect.objectContaining({ message: 'INVALID_SITE_URL', rule, field: 'siteUrl' })]);
    }
  }
  const manual = await create(`${SITE}/`, 'manual');
  expect([manual.statusCode, manual.json()]).toEqual([201, expect.objectContaining({
    channel: 'lti-generic', lms: 'lti-generic', profile: 'lti-generic', channelName: 'your LMS', bindingAuthority: 'operatorGrant', method: 'manual', status: 'pending', siteUrl: SITE,
  })]);
  const dynamic = await create(SITE, 'dynamic');
  expect([dynamic.statusCode, dynamic.json().bindingAuthority, dynamic.json().registrationUrl]).toEqual([201, 'self', expect.stringContaining('/lti/register/cogniate?ref=')]);
  expect(t.db.prepare('SELECT channel, binding_authority, lms FROM connection WHERE id = ?').get(manual.json().id)).toEqual({ channel: 'lti-generic', binding_authority: 'operatorGrant', lms: 'canvas' });
});

it('the tool configuration gives the eight generic rows; the strict body refuses unknown, missing and off-site values', async () => {
  const { call } = await signedIn();
  const c = (await call('POST', '/app-api/connections', { name: 'School', siteUrl: SITE, method: 'manual', lms: 'lti-generic' })).json();
  const rows = (await call('GET', `/app-api/connections/${c.id}/tool-configuration`)).json() as Json[];
  expect(rows.map((r) => [r.key, r.value])).toEqual([
    ['tool_name', "Cogniate (Thanh's Library)"], ['login_url', `${TEST_URLS.lti}/lti/login/cogniate`],
    ['redirect_uri', `${TEST_URLS.lti}/lti/launch/cogniate`], ['target_link_uri', `${TEST_URLS.lti}/lti/launch/cogniate`],
    ['jwks_url', `${TEST_URLS.lti}/lti/keys/cogniate`], ['deep_linking_url', `${TEST_URLS.lti}/lti/launch/cogniate`],
    ['scopes', AGS.join(' ')], ['privacy', "Do not send the learner's name or e-mail."],
  ]);
  const put = (body: Json) => call('PUT', `/app-api/connections/${c.id}/platform`, body);
  const body = { issuer: `${SITE}/sakai`, clientId: 'c-1', deploymentId: 'd-1', authenticationEndpoint: `${SITE}/auth`, accessTokenEndpoint: 'https://token.provider.test/token', jwksUrl: `${SITE}/jwks`, grantCode: 'A'.repeat(43) };
  const refused = async (b: Json) => { const r = await put(b); return [r.statusCode, r.json().details.message, r.json().details.fields, r.json().details.description]; };
  expect(await refused({ ...body, extra: 'x' })).toEqual([422, 'INVALID_PLATFORM_VALUES', ['extra'], 'Some values are missing or not valid.']);
  expect(await refused({ ...body, jwksUrl: undefined })).toEqual([422, 'INVALID_PLATFORM_VALUES', ['jwksUrl'], 'Some values are missing or not valid.']);
  // B-LA-E2-03-03: the issuer has its own sentence; the token URL on another host is allowed.
  expect(await refused({ ...body, issuer: 'https://other.school.edu/sakai' }))
    .toEqual([422, 'INVALID_PLATFORM_VALUES', ['issuer'], 'The issuer must have the same https origin as the site URL of this connection.']);
  expect(t.lti.calls).toEqual(expect.not.arrayContaining([expect.stringMatching(/^POST platform/)]));
  expect(TEST_CHANNELS.appAdapter('lti-generic')).toBeNull();
});
