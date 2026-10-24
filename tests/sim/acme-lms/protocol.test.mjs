// HARNESS ONLY self-tests of the Acme LMS simulator module (packages/channels/acme-lms/README.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSigner, verifyJwt } from '../core/crypto.mjs';
import { AGS, DL, LTI, NRPS, SCOPES, createRuntime } from '../core/runtime.mjs';
import { loadProviders } from '../server.mjs';
import { ACME_LMS_DEPLOYMENTS, acmeLms, createProviders } from './index.mjs';

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
    nonce: 'nonce-acme-1',
    state: 'state-acme-1',
    response_type: 'id_token',
    scope: 'openid',
    redirect_uri: `${TOOL}/lti/launch/cogniate`,
    ...extra,
  });
}

async function idToken(f, scenario) {
  const response = await f.request(acmeLms.auth.host, `${acmeLms.auth.path}?${authParams(scenario)}`);
  assert.equal(response.status, 200, response.body);
  const fields = formFields(response.body);
  assert.equal(fields.state, 'state-acme-1');
  return verifyJwt(fields.id_token, { keys: [f.runtime.signer.jwk] }, {
    issuer: acmeLms.issuer,
    audience: scenario.clientId,
  });
}

test('HARNESS ONLY: Acme LMS module loads through the data-driven server loader with one provider and one host', async () => {
  const runtime = createRuntime({ publicLtiUrl: TOOL, fetchJwks: async () => ({ keys: [] }) });
  const providers = await loadProviders(runtime, ['acme-lms']);
  assert.deepEqual(providers.map((p) => p.id), ['acme-lms-sim']);
  assert.deepEqual([...providers[0].hosts].sort(), ['acme-lms.sim.test']);
});

test('HARNESS ONLY: Acme LMS signs family acme with the site URL issuer and supports multiple string deployments', async () => {
  const f = fixture();
  for (const [idx, deploymentId] of ACME_LMS_DEPLOYMENTS.entries()) {
    const scenario = {
      id: `acme-launch-${idx + 1}`,
      provider: 'acme-lms-sim',
      clientId: 'acme-client-1',
      deploymentId,
      siteHost: 'acme-lms.sim.test',
      resource: `pub_acme_${idx + 1}`,
    };
    f.runtime.scenario(scenario);
    const claims = await idToken(f, scenario);
    assert.equal(claims.iss, 'https://acme-lms.sim.test');
    assert.equal(claims[LTI + 'deployment_id'], deploymentId);
    assert.equal(claims[LTI + 'tool_platform'].product_family_code, 'acme');
    assert.equal(claims[LTI + 'launch_presentation'].document_target, 'iframe');
    assert.equal(claims[AGS].lineitems, 'https://acme-lms.sim.test/lti/courses/course-1/lineitems');
    assert.equal(claims[NRPS].context_memberships_url, 'https://acme-lms.sim.test/lti/courses/course-1/memberships');
  }
});

test('HARNESS ONLY: Acme LMS token is on the issuer host with the token URL as audience; AGS score and NRPS work', async () => {
  const f = fixture();
  const scenario = {
    id: 'acme-token-1',
    provider: 'acme-lms-sim',
    clientId: 'acme-client-token',
    deploymentId: ACME_LMS_DEPLOYMENTS[0],
    siteHost: 'acme-lms.sim.test',
    resource: 'pub_acme_score',
  };
  f.runtime.scenario(scenario);
  const now = Math.floor(Date.now() / 1000);
  const tokenUrl = `https://acme-lms.sim.test${acmeLms.token.path}`;

  const signAssertion = (extra) => f.tool.sign({
    iss: scenario.clientId,
    sub: scenario.clientId,
    aud: tokenUrl,
    iat: now,
    exp: now + 60,
    ...extra,
  });
  const requestToken = (jwt) => f.request('acme-lms.sim.test', acmeLms.token.path, 'POST', {
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    scope: `${SCOPES.score} ${SCOPES.nrps}`,
    client_assertion: jwt,
  });

  // The audience must be the token URL as a string.
  assert.equal((await requestToken(signAssertion({ jti: 'acme-1', aud: 'https://other.sim.test/token' }))).status, 400);
  assert.equal((await requestToken(signAssertion({ jti: 'acme-2', aud: [tokenUrl] }))).status, 400);
  const ok = await requestToken(signAssertion({ jti: 'acme-3' }));
  assert.equal(ok.status, 200, ok.body);
  const bearer = JSON.parse(ok.body).access_token;

  const scoreHeaders = { authorization: `Bearer ${bearer}`, 'content-type': 'application/vnd.ims.lis.v1.score+json' };
  const score = {
    userId: 'learner-1',
    scoreGiven: 8,
    scoreMaximum: 10,
    timestamp: new Date().toISOString(),
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
  };
  assert.equal((await f.request('acme-lms.sim.test', `${acmeLms.sites[0].lineitems}/pub_acme_score/scores`, 'POST', score, scoreHeaders)).status, 204);
  assert.equal((await f.request('acme-lms.sim.test', acmeLms.sites[0].nrps, 'GET', {}, { authorization: `Bearer ${bearer}` })).status, 200);

  const records = JSON.parse((await f.runtime.control({ method: 'GET', url: new URL('https://lms-sim.test/__sim/records') })).body);
  assert.equal(records.records.find((r) => r.kind === 'token').audience, tokenUrl);
});

test('HARNESS ONLY: Acme LMS Deep Linking uses claim data and no sub claim', async () => {
  const f = fixture();
  const scenario = {
    id: 'acme-dl-1',
    provider: 'acme-lms-sim',
    clientId: 'acme-client-dl',
    deploymentId: ACME_LMS_DEPLOYMENTS[1],
    siteHost: 'acme-lms.sim.test',
    messageType: 'LtiDeepLinkingRequest',
  };
  f.runtime.scenario(scenario);
  const claims = await idToken(f, scenario);
  assert.equal(claims[DL + 'deep_linking_settings'].data, 'data-acme-dl-1');

  const now = Math.floor(Date.now() / 1000);
  const dlResponse = {
    iss: scenario.clientId,
    aud: acmeLms.issuer,
    nonce: 'acme-dl-nonce-1',
    iat: now,
    exp: now + 60,
    [LTI + 'message_type']: 'LtiDeepLinkingResponse',
    [LTI + 'version']: '1.3.0',
    [LTI + 'deployment_id']: scenario.deploymentId,
    [DL + 'data']: 'data-acme-dl-1',
    [DL + 'content_items']: [{
      type: 'ltiResourceLink',
      url: `${TOOL}/lti/launch/cogniate?resource=pub_acme_dl`,
      lineItem: { scoreMaximum: 100 },
      window: { targetName: '_blank' },
    }],
  };
  const post = (jwt) => f.request('acme-lms.sim.test', acmeLms.sites[0].dlReturn, 'POST', { JWT: jwt });
  assert.equal((await post(f.tool.sign({ ...dlResponse, sub: scenario.clientId }))).status, 400);
  assert.equal((await post(f.tool.sign(dlResponse))).status, 200);
});

test('HARNESS ONLY: Acme LMS has no Dynamic Registration routes', async () => {
  const f = fixture();
  assert.equal(acmeLms.dr, undefined);
  assert.equal(await f.request('acme-lms.sim.test', '/.well-known/openid-configuration'), null);
});
