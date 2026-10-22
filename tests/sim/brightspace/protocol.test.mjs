// HARNESS ONLY self-tests of the D2L Brightspace simulator module (LA-E7-02).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSigner, verifyJwt } from '../core/crypto.mjs';
import { AGS, DL, LTI, NRPS, SCOPES, createRuntime } from '../core/runtime.mjs';
import { loadProviders } from '../server.mjs';
import { BRIGHTSPACE_DEPLOYMENTS, BRIGHTSPACE_TOKEN_AUDIENCE, brightspace, createProviders } from './index.mjs';

const TOOL = 'https://lti.cogniate.test';

function fixture() {
  const tool = makeSigner();
  const runtime = createRuntime({ publicLtiUrl: TOOL, fetchJwks: async () => ({ keys: [tool.jwk] }) });
  const providers = createProviders(runtime);
  const request = async (host, path, method = 'GET', fields = {}, headers = {}) => {
    for (const provider of providers) {
      const result = await provider.handle({
        host,
        method,
        url: new URL(path, `https://${host}`),
        headers,
        body: headers['content-type']?.includes('json') ? JSON.stringify(fields) : new URLSearchParams(fields).toString(),
      });
      if (result) return result;
    }
    return null;
  };
  return { runtime, tool, providers, request };
}

const decode = (s) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const formFields = (body) => Object.fromEntries([...body.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));

function authParams(scenario, extra = {}) {
  return new URLSearchParams({
    client_id: scenario.clientId,
    login_hint: scenario.id,
    lti_message_hint: `message-${scenario.id}`,
    nonce: 'nonce-d2l-1',
    state: 'state-d2l-1',
    response_type: 'id_token',
    scope: 'openid',
    redirect_uri: `${TOOL}/lti/launch/cogniate`,
    ...extra,
  });
}

async function idToken(f, scenario) {
  const response = await f.request(brightspace.auth.host, `${brightspace.auth.path}?${authParams(scenario)}`);
  assert.equal(response.status, 200, response.body);
  const fields = formFields(response.body);
  assert.equal(fields.state, 'state-d2l-1');
  return verifyJwt(fields.id_token, { keys: [f.runtime.signer.jwk] }, {
    issuer: brightspace.issuer,
    audience: scenario.clientId,
  });
}

test('HARNESS ONLY: Brightspace module loads through the data-driven server loader with expected hosts', async () => {
  const runtime = createRuntime({ publicLtiUrl: TOOL, fetchJwks: async () => ({ keys: [] }) });
  const providers = await loadProviders(runtime, ['brightspace']);
  assert.deepEqual(providers.map((p) => p.id), ['brightspace-sim']);
  assert.deepEqual([...providers[0].hosts].sort(), [
    'auth.brightspace.sim.test',
    'brightspace.sim.test',
    'school-b.brightspace.sim.test',
  ]);
});

test('HARNESS ONLY: Brightspace signs family desire2learn, enforces UUID deployments, and supports multiple UUID deployments', async () => {
  const f = fixture();
  assert.throws(
    () => f.runtime.scenario({
      id: 'd2l-non-uuid',
      provider: 'brightspace-sim',
      clientId: 'd2l-client-1',
      deploymentId: 'not-a-uuid',
      siteHost: 'brightspace.sim.test',
    }),
    /UUID deployment id required/,
  );

  for (const [idx, deploymentId] of BRIGHTSPACE_DEPLOYMENTS.entries()) {
    const scenario = {
      id: `d2l-uuid-${idx + 1}`,
      provider: 'brightspace-sim',
      clientId: 'd2l-client-1',
      deploymentId,
      siteHost: 'brightspace.sim.test',
      resource: `pub_d2l_${idx + 1}`,
    };
    f.runtime.scenario(scenario);
    const claims = await idToken(f, scenario);
    assert.equal(claims.iss, 'https://brightspace.sim.test');
    assert.equal(claims[LTI + 'deployment_id'], deploymentId);
    assert.equal(claims[LTI + 'tool_platform'].product_family_code, 'desire2learn');
    assert.equal(claims[LTI + 'launch_presentation'].document_target, 'iframe');
    assert.equal(claims[AGS].lineitems.startsWith('https://brightspace.sim.test/d2l/api/lti/ags/2.0/'), true);
    assert.equal(claims[NRPS].context_memberships_url.startsWith('https://brightspace.sim.test/d2l/api/lti/nrps/2.0/'), true);
  }
});

test('HARNESS ONLY: Brightspace token is on auth.brightspace.sim.test with audience different from the token URL', async () => {
  const f = fixture();
  const scenario = {
    id: 'd2l-token-1',
    provider: 'brightspace-sim',
    clientId: 'd2l-client-token',
    deploymentId: BRIGHTSPACE_DEPLOYMENTS[0],
    siteHost: 'brightspace.sim.test',
    resource: 'pub_d2l_score',
  };
  f.runtime.scenario(scenario);
  const now = Math.floor(Date.now() / 1000);
  const tokenUrl = `https://auth.brightspace.sim.test${brightspace.token.path}`;
  assert.notEqual(BRIGHTSPACE_TOKEN_AUDIENCE, tokenUrl);

  const signAssertion = (extra) => f.tool.sign({
    iss: scenario.clientId,
    sub: scenario.clientId,
    aud: BRIGHTSPACE_TOKEN_AUDIENCE,
    iat: now,
    exp: now + 60,
    ...extra,
  });
  const requestToken = (host, jwt) => f.request(host, brightspace.token.path, 'POST', {
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    scope: `${SCOPES.score} ${SCOPES.nrps}`,
    client_assertion: jwt,
  });

  // Site host does not expose the token route; only auth.brightspace.sim.test serves tokens.
  assert.equal(await requestToken('brightspace.sim.test', signAssertion({ jti: 'd2l-1' })), null);
  // Assertion with aud = tokenUrl (instead of BRIGHTSPACE_TOKEN_AUDIENCE) must be rejected!
  assert.equal((await requestToken('auth.brightspace.sim.test', signAssertion({ jti: 'd2l-2', aud: tokenUrl }))).status, 400);
  assert.equal((await requestToken('auth.brightspace.sim.test', signAssertion({ jti: 'd2l-3', aud: [BRIGHTSPACE_TOKEN_AUDIENCE] }))).status, 400);

  // Assertion with aud = https://api.brightspace.sim.test/auth/token succeeds.
  const ok = await requestToken('auth.brightspace.sim.test', signAssertion({ jti: 'd2l-4' }));
  assert.equal(ok.status, 200, ok.body);
  const bearer = JSON.parse(ok.body).access_token;

  // Replay with same jti is rejected.
  assert.equal((await requestToken('auth.brightspace.sim.test', signAssertion({ jti: 'd2l-4' }))).status, 400);

  // Token works on brightspace.sim.test for AGS score and NRPS.
  const scoreHeaders = { authorization: `Bearer ${bearer}`, 'content-type': 'application/vnd.ims.lis.v1.score+json' };
  const score = {
    userId: 'learner-1',
    scoreGiven: 8,
    scoreMaximum: 10,
    timestamp: new Date().toISOString(),
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
  };
  assert.equal((await f.request('brightspace.sim.test', `${brightspace.sites[0].lineitems}/pub_d2l_score/scores`, 'POST', score, scoreHeaders)).status, 204);
  assert.equal((await f.request('brightspace.sim.test', brightspace.sites[0].nrps, 'GET', {}, { authorization: `Bearer ${bearer}` })).status, 200);

  const records = JSON.parse((await f.runtime.control({ method: 'GET', url: new URL('https://lms-sim.test/__sim/records') })).body);
  assert.equal(records.records.find((r) => r.kind === 'token').audience, BRIGHTSPACE_TOKEN_AUDIENCE);
});

test('HARNESS ONLY: Brightspace Deep Linking uses claim data and no sub claim', async () => {
  const f = fixture();
  const scenario = {
    id: 'd2l-dl-1',
    provider: 'brightspace-sim',
    clientId: 'd2l-client-dl',
    deploymentId: BRIGHTSPACE_DEPLOYMENTS[1],
    siteHost: 'brightspace.sim.test',
    messageType: 'LtiDeepLinkingRequest',
  };
  f.runtime.scenario(scenario);
  const claims = await idToken(f, scenario);
  assert.equal(claims[DL + 'deep_linking_settings'].data, 'data-d2l-dl-1');

  const now = Math.floor(Date.now() / 1000);
  const dlResponse = {
    iss: scenario.clientId,
    aud: brightspace.issuer,
    nonce: 'd2l-dl-nonce-1',
    iat: now,
    exp: now + 60,
    [LTI + 'message_type']: 'LtiDeepLinkingResponse',
    [LTI + 'version']: '1.3.0',
    [LTI + 'deployment_id']: scenario.deploymentId,
    [DL + 'data']: 'data-d2l-dl-1',
    [DL + 'content_items']: [{
      type: 'ltiResourceLink',
      url: `${TOOL}/lti/launch/cogniate?resource=pub_d2l_dl`,
      lineItem: { scoreMaximum: 100 },
      window: { targetName: '_blank' },
    }],
  };
  const post = (jwt) => f.request('brightspace.sim.test', brightspace.sites[0].dlReturn, 'POST', { JWT: jwt });
  assert.equal((await post(f.tool.sign({ ...dlResponse, sub: scenario.clientId }))).status, 400);
  assert.equal((await post(f.tool.sign(dlResponse))).status, 200);
});
