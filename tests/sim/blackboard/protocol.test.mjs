import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSigner, verifyJwt } from '../core/crypto.mjs';
import { AGS, DL, LTI, SCOPES, createRuntime } from '../core/runtime.mjs';
import { blackboard, createProviders } from './index.mjs';

function fixture() {
  const tool = makeSigner();
  const runtime = createRuntime({ publicLtiUrl: 'https://lti.cogniate.test',
    fetchJwks: async () => ({ keys: [tool.jwk] }) });
  const [provider] = createProviders(runtime);
  const scenario = { id: 'bb-test', provider: 'blackboard-sim', clientId: 'qa-bb-app',
    deploymentId: 'dA', siteHost: 'learn-a.blackboard.sim.test', resource: 'pub_qa' };
  runtime.scenario(scenario);
  const request = (host, path, method = 'GET', fields = {}, headers = {}) => provider.handle({
    host, method, url: new URL(path, `https://${host}`), headers,
    body: headers['content-type']?.includes('json') ? JSON.stringify(fields) : new URLSearchParams(fields).toString(),
  });
  return { runtime, tool, request, scenario };
}
function fieldsFromForm(body) {
  const decode = (s) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  return Object.fromEntries([...body.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
}

test('HARNESS ONLY: Blackboard signed auth, data claim and hint preservation', async () => {
  const { runtime, request, scenario } = fixture();
  runtime.scenario({ ...scenario, messageType: 'LtiDeepLinkingRequest' });
  const params = new URLSearchParams({ client_id: scenario.clientId, login_hint: scenario.id,
    lti_message_hint: `message-${scenario.id}`, nonce: 'nonce', state: 'state', response_type: 'id_token',
    scope: 'openid', redirect_uri: 'https://lti.cogniate.test/lti/launch/cogniate' });
  const response = await request(blackboard.auth.host, blackboard.auth.path + '?' + params);
  assert.equal(response.status, 200);
  const fields = fieldsFromForm(response.body);
  const claims = verifyJwt(fields.id_token, { keys: [runtime.signer.jwk] }, { audience: scenario.clientId });
  assert.equal(fields.state, 'state');
  assert.equal(claims[LTI + 'tool_platform'].product_family_code, 'BlackboardLearn');
  assert.equal(claims[DL + 'deep_linking_settings'].data, 'data-bb-test');
  assert.equal(new URL(claims[DL + 'deep_linking_settings'].deep_link_return_url).search, '');
  assert.equal(claims[AGS].lineitem, 'https://learn-a.blackboard.sim.test/learn/api/v1/lti/courses/course-1/lineItems/pub_qa');
  params.set('lti_message_hint', 'wrong');
  assert.equal((await request(blackboard.auth.host, blackboard.auth.path + '?' + params)).status, 400);
});

test('HARNESS ONLY: token array audience, replay rejection, scope and score oracle', async () => {
  const { runtime, tool, request, scenario } = fixture();
  const now = Math.floor(Date.now() / 1000), endpoint = `https://${blackboard.auth.host}${blackboard.token.path}`;
  const claims = { iss: scenario.clientId, sub: scenario.clientId, aud: [endpoint], iat: now, exp: now + 60, jti: 'one' };
  const fields = { grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    scope: SCOPES.score, client_assertion: tool.sign(claims) };
  const response = await request(blackboard.auth.host, blackboard.token.path, 'POST', fields);
  assert.equal(response.status, 200);
  const token = JSON.parse(response.body).access_token;
  assert.equal((await request(blackboard.auth.host, blackboard.token.path, 'POST', fields)).status, 400);
  fields.client_assertion = tool.sign({ ...claims, aud: endpoint, jti: 'two' });
  assert.equal((await request(blackboard.auth.host, blackboard.token.path, 'POST', fields)).status, 400);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/vnd.ims.lis.v1.score+json' };
  const score = { userId: 'learner-1', scoreGiven: 7, scoreMaximum: 10,
    timestamp: new Date().toISOString(), activityProgress: 'Completed', gradingProgress: 'FullyGraded' };
  const scorePath = blackboard.sites[0].lineitems + '/pub_qa/scores';
  assert.equal((await request(scenario.siteHost, scorePath, 'POST', score, headers)).status, 204);
  assert.equal((await request(scenario.siteHost, scorePath, 'POST', { ...score, userId: 'other' }, headers)).status, 400);
  assert.equal((await request(scenario.siteHost, blackboard.sites[0].lineitems, 'GET', {}, headers)).status, 400);
  const records = JSON.parse((await runtime.control({ method: 'GET', url: new URL('https://lms-sim.test/__sim/records') })).body);
  const text = JSON.stringify(records);
  assert.equal(text.includes(token), false);
  assert.equal(text.includes(fields.client_assertion), false);
  assert.equal(records.records.find((r) => r.kind === 'score').body.scoreGiven, 7);
});

test('HARNESS ONLY: DL signature, subject/data and replay are independently checked', async () => {
  const { runtime, tool, request, scenario } = fixture();
  runtime.scenario({ ...scenario, messageType: 'LtiDeepLinkingRequest' });
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: scenario.clientId, sub: scenario.clientId, aud: blackboard.issuer,
    nonce: 'response-nonce', iat: now, exp: now + 60,
    [LTI + 'message_type']: 'LtiDeepLinkingResponse', [LTI + 'version']: '1.3.0',
    [LTI + 'deployment_id']: scenario.deploymentId, [DL + 'data']: 'data-bb-test',
    [DL + 'content_items']: [{ type: 'ltiResourceLink', url: 'https://lti.cogniate.test/lti/launch/cogniate?resource=pub_qa',
      lineItem: { scoreMaximum: 100 }, window: { targetName: '_blank' } }],
  };
  const post = (jwt) => request(scenario.siteHost, blackboard.sites[0].dlReturn, 'POST', { JWT: jwt });
  assert.equal((await post(tool.sign({ ...claims, sub: 'wrong' }))).status, 400);
  assert.equal((await post(tool.sign(claims, 'altered-signature'))).status, 400);
  assert.equal((await post(tool.sign(claims))).status, 200);
  assert.equal((await post(tool.sign(claims))).status, 400);
});
