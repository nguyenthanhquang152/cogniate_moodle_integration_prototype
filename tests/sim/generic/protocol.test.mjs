// HARNESS ONLY self-tests of the generic LTI 1.3 and Moodle-shaped simulator module (LA-E7-02).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSigner, verifyJwt } from '../core/crypto.mjs';
import { AGS, DL, LTI, NRPS, SCOPES, createRuntime } from '../core/runtime.mjs';
import { loadProviders } from '../server.mjs';
import { createProviders, generic, moodleSim } from './index.mjs';

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
    nonce: 'nonce-gen-1',
    state: 'state-gen-1',
    response_type: 'id_token',
    scope: 'openid',
    redirect_uri: `${TOOL}/lti/launch/cogniate`,
    ...extra,
  });
}

async function idToken(f, config, scenario, method = 'GET') {
  const params = authParams(scenario);
  const response = method === 'GET'
    ? await f.request(config.auth.host, `${config.auth.path}?${params}`, 'GET')
    : await f.request(config.auth.host, config.auth.path, 'POST', Object.fromEntries(params));
  assert.equal(response.status, 200, response.body);
  const fields = formFields(response.body);
  assert.equal(fields.state, 'state-gen-1');
  return verifyJwt(fields.id_token, { keys: [f.runtime.signer.jwk] }, {
    issuer: scenario.issuer ?? config.issuer,
    audience: scenario.clientId,
  });
}

test('HARNESS ONLY: Generic module loads generic-sim and moodle-sim through the data-driven server loader', async () => {
  const runtime = createRuntime({ publicLtiUrl: TOOL, fetchJwks: async () => ({ keys: [] }) });
  const providers = await loadProviders(runtime, ['generic']);
  assert.deepEqual(providers.map((p) => p.id), ['generic-sim', 'moodle-sim']);
  assert.deepEqual([...providers[0].hosts].sort(), [
    'generic.sim.test',
    'school-b.generic.sim.test',
    'token.generic.sim.test',
  ]);
  assert.deepEqual([...providers[1].hosts].sort(), ['moodle.sim.test']);
  for (const host of providers.flatMap((p) => p.hosts)) {
    assert.match(host, /\.sim\.test$/);
  }
});

test('HARNESS ONLY: generic-sim supports issuer with a path and multiple deployments on one registration', async () => {
  const f = fixture();
  assert.equal(generic.issuer, 'https://generic.sim.test/lti');
  assert.equal(generic.deployments.length >= 3, true);

  for (const [idx, deploymentId] of generic.deployments.entries()) {
    const scenario = {
      id: `gen-dep-${idx + 1}`,
      provider: 'generic-sim',
      clientId: 'generic-client-1',
      deploymentId,
      siteHost: 'generic.sim.test',
      resource: `pub_gen_${idx + 1}`,
    };
    const created = f.runtime.scenario(scenario);
    assert.equal(created.login.iss, 'https://generic.sim.test/lti');
    assert.equal(created.login.lti_deployment_id, deploymentId);

    const claims = await idToken(f, generic, scenario, idx % 2 === 0 ? 'GET' : 'POST');
    assert.equal(claims.iss, 'https://generic.sim.test/lti');
    assert.equal(claims[LTI + 'deployment_id'], deploymentId);
    assert.equal(claims[LTI + 'tool_platform'].product_family_code, 'generic');
    assert.equal(claims[AGS].lineitems, 'https://generic.sim.test/lti/courses/course-1/lineitems');
    assert.equal(claims[NRPS].context_memberships_url, 'https://generic.sim.test/lti/courses/course-1/memberships');
  }
});

test('HARNESS ONLY: generic-sim issues tokens on a second host (token.generic.sim.test) for AGS and NRPS on generic.sim.test', async () => {
  const f = fixture();
  const scenario = {
    id: 'gen-split-token',
    provider: 'generic-sim',
    clientId: 'generic-client-split',
    deploymentId: generic.deployments[0],
    siteHost: 'generic.sim.test',
    resource: 'pub_split',
  };
  f.runtime.scenario(scenario);
  const now = Math.floor(Date.now() / 1000);
  const splitEndpoint = 'https://token.generic.sim.test/lti/oauth2/token';
  const sameHostEndpoint = 'https://generic.sim.test/lti/oauth2/token';

  const signAssertion = (extra) => f.tool.sign({
    iss: scenario.clientId,
    sub: scenario.clientId,
    aud: splitEndpoint,
    iat: now,
    exp: now + 60,
    ...extra,
  });
  const tokenRequest = (host, jwt, scope = `${SCOPES.score} ${SCOPES.nrps}`) => f.request(host, generic.token.path, 'POST', {
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    scope,
    client_assertion: jwt,
  });

  // Wrong audience (issuer or array instead of token endpoint URL) is rejected.
  assert.equal((await tokenRequest('token.generic.sim.test', signAssertion({ jti: 'g-bad-1', aud: generic.issuer }))).status, 400);
  assert.equal((await tokenRequest('token.generic.sim.test', signAssertion({ jti: 'g-bad-2', aud: [splitEndpoint] }))).status, 400);

  // Token minted on second host token.generic.sim.test succeeds and works against generic.sim.test AGS and NRPS.
  const tokRes = await tokenRequest('token.generic.sim.test', signAssertion({ jti: 'g-ok-1' }));
  assert.equal(tokRes.status, 200, tokRes.body);
  const bearer = JSON.parse(tokRes.body).access_token;

  const scoreHeaders = { authorization: `Bearer ${bearer}`, 'content-type': 'application/vnd.ims.lis.v1.score+json' };
  const score = {
    userId: 'learner-1',
    scoreGiven: 9,
    scoreMaximum: 10,
    timestamp: new Date().toISOString(),
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
  };
  assert.equal((await f.request('generic.sim.test', `${generic.sites[0].lineitems}/pub_split/scores`, 'POST', score, scoreHeaders)).status, 204);
  assert.equal((await f.request('generic.sim.test', generic.sites[0].nrps, 'GET', {}, { authorization: `Bearer ${bearer}` })).status, 200);

  // Same-host token on generic.sim.test is also supported and stays bound to generic.sim.test.
  const sameHostTok = await tokenRequest('generic.sim.test', signAssertion({ jti: 'g-ok-2', aud: sameHostEndpoint }));
  assert.equal(sameHostTok.status, 200);
  const sameHostBearer = JSON.parse(sameHostTok.body).access_token;
  assert.equal(
    (await f.request('school-b.generic.sim.test', generic.sites[1].nrps, 'GET', {}, { authorization: `Bearer ${sameHostBearer}` })).status,
    400,
  );
});

test('HARNESS ONLY: moodle-sim simulates Moodle-shaped config with issuer = site origin and no DL window hint', async () => {
  const f = fixture();
  assert.equal(moodleSim.issuer, 'https://moodle.sim.test');
  assert.equal(new URL(moodleSim.issuer).pathname, '/');

  const scenario = {
    id: 'moodle-dl-1',
    provider: 'moodle-sim',
    clientId: 'moodle-client-1',
    deploymentId: '1',
    siteHost: 'moodle.sim.test',
    messageType: 'LtiDeepLinkingRequest',
  };
  const created = f.runtime.scenario(scenario);
  assert.equal(created.login.iss, 'https://moodle.sim.test');

  const claims = await idToken(f, moodleSim, scenario);
  assert.equal(claims.iss, 'https://moodle.sim.test');
  assert.equal(claims[LTI + 'tool_platform'].product_family_code, 'moodle');
  assert.equal(claims[DL + 'deep_linking_settings'].deep_link_return_url, 'https://moodle.sim.test/mod/lti/contentitem_return.php');
  assert.equal(claims[DL + 'deep_linking_settings'].data, 'data-moodle-dl-1');

  const now = Math.floor(Date.now() / 1000);
  const baseResponse = {
    iss: scenario.clientId,
    aud: moodleSim.issuer,
    nonce: 'moodle-dl-nonce-1',
    iat: now,
    exp: now + 60,
    [LTI + 'message_type']: 'LtiDeepLinkingResponse',
    [LTI + 'version']: '1.3.0',
    [LTI + 'deployment_id']: '1',
    [DL + 'data']: 'data-moodle-dl-1',
  };

  // Moodle-shaped DL response rejects window.targetName by default and accepts items without window.
  const withWindow = {
    ...baseResponse,
    [DL + 'content_items']: [{
      type: 'ltiResourceLink',
      url: `${TOOL}/lti/launch/cogniate?resource=pub_moodle`,
      lineItem: { scoreMaximum: 100 },
      window: { targetName: '_blank' },
    }],
  };
  assert.equal((await f.request('moodle.sim.test', moodleSim.sites[0].dlReturn, 'POST', { JWT: f.tool.sign(withWindow) })).status, 400);

  const withoutWindow = {
    ...baseResponse,
    [DL + 'content_items']: [{
      type: 'ltiResourceLink',
      url: `${TOOL}/lti/launch/cogniate?resource=pub_moodle`,
      lineItem: { scoreMaximum: 100 },
    }],
  };
  assert.equal((await f.request('moodle.sim.test', moodleSim.sites[0].dlReturn, 'POST', { JWT: f.tool.sign(withoutWindow) })).status, 200);
});
