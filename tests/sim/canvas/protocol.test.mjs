// HARNESS ONLY self-tests of the Canvas simulator module. They prove the fixture behaviour, not product behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSigner, verifyJwt } from '../core/crypto.mjs';
import { AGS, DL, LTI, NRPS, SCOPES, createRuntime } from '../core/runtime.mjs';
import { loadProviders } from '../server.mjs';
import { CANVAS_OIDC_REQUIRED, CANVAS_SCORE_MESSAGES, canvasCloud, canvasSelf, createProviders } from './index.mjs';

const TOOL = 'https://lti.cogniate.test';
function fixture() {
  const tool = makeSigner();
  const runtime = createRuntime({ publicLtiUrl: TOOL, fetchJwks: async () => ({ keys: [tool.jwk] }) });
  const providers = createProviders(runtime);
  const request = async (host, path, method = 'GET', fields = {}, headers = {}) => {
    for (const provider of providers) {
      const result = await provider.handle({ host, method, url: new URL(path, `https://${host}`), headers,
        body: headers['content-type']?.includes('json') ? JSON.stringify(fields) : new URLSearchParams(fields).toString() });
      if (result) return result;
    }
    return null;
  };
  return { runtime, tool, providers, request };
}
const decode = (s) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const formFields = (body) => Object.fromEntries([...body.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
function authParams(scenario, extra = {}) {
  return new URLSearchParams({ client_id: scenario.clientId, login_hint: scenario.id, lti_message_hint: `message-${scenario.id}`,
    nonce: 'nonce-1', state: 'state-1', response_type: 'id_token', scope: 'openid', prompt: 'none',
    response_mode: 'form_post', redirect_uri: `${TOOL}/lti/launch/cogniate`, ...extra });
}
async function idToken(f, config, scenario, extra) {
  const response = await f.request(config.auth.host, `${config.auth.path}?${authParams(scenario, extra)}`);
  assert.equal(response.status, 200, response.body);
  const fields = formFields(response.body);
  assert.equal(fields.state, 'state-1');
  return verifyJwt(fields.id_token, { keys: [f.runtime.signer.jwk] }, { issuer: config.issuer, audience: scenario.clientId });
}

test('HARNESS ONLY: Canvas module loads through the server loader with cloud and self-hosted providers', async () => {
  const runtime = createRuntime({ publicLtiUrl: TOOL, fetchJwks: async () => ({ keys: [] }) });
  const providers = await loadProviders(runtime, ['canvas']);
  assert.deepEqual(providers.map((p) => p.id), ['canvas-sim-cloud', 'canvas-sim-self']);
  assert.deepEqual([...providers[0].hosts].sort(), ['canvas.school-a.sim.test', 'school-a.canvas.sim.test',
    'school-b.canvas.sim.test', 'sso.canvas.sim.test']);
  assert.deepEqual([...providers[1].hosts].sort(), ['api.canvas-self.sim.test', 'canvas-self.sim.test']);
  for (const host of [...providers[0].hosts, ...providers[1].hosts]) assert.match(host, /\.sim\.test$/);
  // The cloud issuer is an issuer value only: no simulator host serves or resolves it (M3 §3.1).
  assert.equal(providers.flatMap((p) => p.hosts).includes(new URL(canvasCloud.issuer).host), false);
  assert.equal(canvasSelf.issuer, `https://${canvasSelf.auth.host}`);
});

test('HARNESS ONLY: Canvas authentication requires every Canvas key, signs family canvas and an iframe target', async () => {
  const f = fixture();
  const scenario = f.runtime.scenario({ id: 'cv-auth', provider: 'canvas-sim-cloud', clientId: '10000000000042',
    deploymentId: '12:abc', siteHost: 'school-a.canvas.sim.test', resource: 'pub_qa' });
  const s = { ...scenario, clientId: '10000000000042' };
  for (const name of CANVAS_OIDC_REQUIRED) {
    const params = authParams(s); params.delete(name);
    const missing = await f.request(canvasCloud.auth.host, `${canvasCloud.auth.path}?${params}`);
    assert.equal(missing.status, 400, `missing ${name}`);
  }
  const claims = await idToken(f, canvasCloud, s);
  assert.equal(claims[LTI + 'tool_platform'].product_family_code, 'canvas');
  assert.equal(claims[LTI + 'launch_presentation'].document_target, 'iframe');
  assert.equal(claims[AGS].lineitems, 'https://school-a.canvas.sim.test/api/lti/courses/course-1/line_items');
  assert.equal(claims[NRPS].context_memberships_url, 'https://school-a.canvas.sim.test/api/lti/courses/course-1/names_and_roles');
  const oidc = JSON.parse((await f.runtime.control({ method: 'GET', url: new URL('https://lms-sim.test/__sim/records') })).body)
    .records.filter((r) => r.kind === 'canvas-oidc').at(-1);
  assert.deepEqual([oidc.prompt, oidc.responseMode, oidc.hasState], ['none', 'form_post', true]);
  const post = await f.request(canvasCloud.auth.host, canvasCloud.auth.path, 'POST', Object.fromEntries(authParams(s)));
  assert.equal(post.status, 200);
});

test('HARNESS ONLY: Canvas Deep Linking puts data only in the return URL query on the page host', async () => {
  const f = fixture();
  const scenario = { id: 'cv-dl', provider: 'canvas-sim-cloud', clientId: '10000000000043', deploymentId: 'dA',
    siteHost: 'school-a.canvas.sim.test', pageHost: 'canvas.school-a.sim.test', messageType: 'LtiDeepLinkingRequest' };
  f.runtime.scenario(scenario);
  const claims = await idToken(f, canvasCloud, scenario);
  const settings = claims[DL + 'deep_linking_settings'];
  assert.equal(Object.hasOwn(settings, 'data'), false);
  const back = new URL(settings.deep_link_return_url);
  assert.equal(back.host, 'canvas.school-a.sim.test');
  assert.equal(back.searchParams.get('data'), 'data-cv-dl');
  assert.equal(claims[AGS].lineitems.startsWith('https://school-a.canvas.sim.test/'), true);
  const now = Math.floor(Date.now() / 1000);
  const response = { iss: scenario.clientId, aud: canvasCloud.issuer, nonce: 'resp-1', iat: now, exp: now + 60,
    [LTI + 'message_type']: 'LtiDeepLinkingResponse', [LTI + 'version']: '1.3.0', [LTI + 'deployment_id']: 'dA',
    [DL + 'content_items']: [{ type: 'ltiResourceLink', url: `${TOOL}/lti/launch/cogniate?resource=pub_x`,
      lineItem: { scoreMaximum: 100 }, window: { targetName: '_blank' } }] };
  const post = (jwt, path = back.pathname + back.search, host = back.host) => f.request(host, path, 'POST', { JWT: jwt });
  assert.equal((await post(f.tool.sign(response), back.pathname)).status, 400, 'missing data query');
  assert.equal((await post(f.tool.sign({ ...response, [DL + 'data']: 'data-cv-dl' }))).status, 400, 'data claim');
  assert.equal((await post(f.tool.sign({ ...response, sub: scenario.clientId }))).status, 400, 'sub claim');
  assert.equal((await post(f.tool.sign({ ...response, aud: [canvasCloud.issuer] }))).status, 400, 'array audience');
  assert.equal((await post(f.tool.sign(response, 'altered-signature'))).status, 400, 'signature');
  assert.equal((await post(f.tool.sign(response), back.pathname + back.search, 'school-a.canvas.sim.test')).status, 400, 'other host');
  assert.equal((await post(f.tool.sign(response))).status, 200);
  assert.equal((await post(f.tool.sign(response))).status, 400, 'nonce replay');
});

test('HARNESS ONLY: Canvas token needs a string audience of the requested host; tokens stay on that host', async () => {
  const f = fixture();
  const scenario = { id: 'cv-token', provider: 'canvas-sim-cloud', clientId: '10000000000044', deploymentId: 'dA',
    siteHost: 'school-a.canvas.sim.test', resource: 'pub_qa', scoreAnswers: [{ status: 422, message: CANVAS_SCORE_MESSAGES.attemptLimit }] };
  f.runtime.scenario(scenario);
  const now = Math.floor(Date.now() / 1000), endpoint = 'https://school-a.canvas.sim.test/login/oauth2/token';
  const assertion = (extra) => f.tool.sign({ iss: scenario.clientId, sub: scenario.clientId, aud: endpoint, iat: now, exp: now + 60, ...extra });
  const fields = (jwt) => ({ grant_type: 'client_credentials', scope: SCOPES.score,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: jwt });
  const token = (host, jwt) => f.request(host, '/login/oauth2/token', 'POST', fields(jwt));
  assert.equal((await token('school-a.canvas.sim.test', assertion({ jti: 'a1', aud: [endpoint] }))).status, 400, 'array audience');
  assert.equal((await token('school-b.canvas.sim.test', assertion({ jti: 'a2' }))).status, 400, 'other host audience');
  assert.equal(await token('canvas.school-a.sim.test', assertion({ jti: 'a3' })), null, 'page host has no token route');
  assert.equal(await token('sso.canvas.sim.test', assertion({ jti: 'a4' })), null, 'SSO host has no token route');
  const ok = await token('school-a.canvas.sim.test', assertion({ jti: 'a5' }));
  assert.equal(ok.status, 200);
  assert.equal((await token('school-a.canvas.sim.test', assertion({ jti: 'a5' }))).status, 400, 'jti replay');
  const bearer = JSON.parse(ok.body).access_token;
  const score = { userId: 'learner-1', scoreGiven: 7, scoreMaximum: 10, timestamp: new Date().toISOString(),
    activityProgress: 'Completed', gradingProgress: 'FullyGraded' };
  const headers = { authorization: `Bearer ${bearer}`, 'content-type': 'application/vnd.ims.lis.v1.score+json' };
  const path = canvasCloud.sites[0].lineitems + '/pub_qa/scores';
  assert.equal((await f.request('school-b.canvas.sim.test', path, 'POST', score, headers)).status, 400, 'token is host bound');
  assert.equal(await f.request('canvas.school-a.sim.test', path, 'POST', score, headers), null, 'page host has no AGS route');
  const refused = await f.request('school-a.canvas.sim.test', path, 'POST', score, headers);
  assert.equal(refused.status, 422);
  assert.equal(JSON.parse(refused.body).message, CANVAS_SCORE_MESSAGES.attemptLimit);
  assert.equal((await f.request('school-a.canvas.sim.test', path, 'POST', score, headers)).status, 204);
  const records = JSON.parse((await f.runtime.control({ method: 'GET', url: new URL('https://lms-sim.test/__sim/records') })).body);
  const text = JSON.stringify(records);
  assert.equal(text.includes(bearer), false);
  assert.equal(records.records.find((r) => r.kind === 'token').audience, endpoint);
});

test('HARNESS ONLY: self-hosted Canvas keeps auth and JWKS on the site and services on the service host', async () => {
  const f = fixture();
  const scenario = { id: 'cv-self', provider: 'canvas-sim-self', clientId: '20000000000001', deploymentId: 'dS',
    siteHost: 'api.canvas-self.sim.test', pageHost: 'canvas-self.sim.test', messageType: 'LtiDeepLinkingRequest' };
  f.runtime.scenario(scenario);
  const jwks = await f.request('canvas-self.sim.test', '/api/lti/security/jwks');
  assert.equal(jwks.status, 200);
  assert.equal(await f.request('sso.canvas.sim.test', '/api/lti/security/jwks').then((r) => r.status), 200);
  const claims = await idToken(f, canvasSelf, scenario);
  assert.equal(new URL(claims[DL + 'deep_linking_settings'].deep_link_return_url).host, 'canvas-self.sim.test');
  assert.equal(new URL(claims[AGS].lineitems).host, 'api.canvas-self.sim.test');
  assert.equal(await f.request('canvas-self.sim.test', '/login/oauth2/token', 'POST', {}), null);
  assert.equal(await f.request('canvas-self.sim.test', canvasSelf.sites[0].lineitems), null);
  assert.equal(await f.request('canvas-self.sim.test', canvasSelf.sites[0].nrps), null);
  assert.throws(() => f.runtime.scenario({ ...scenario, id: 'cv-self-bad', siteHost: 'canvas-self.sim.test' }), /service host/);
});
