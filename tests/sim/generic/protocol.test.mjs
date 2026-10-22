// HARNESS ONLY self-tests of the generic LTI 1.3 and Moodle-shaped simulator module (LA-E7-02).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeSigner, verifyJwt } from '../core/crypto.mjs';
import { AGS, DL, LTI, NRPS, SCOPES, createRuntime } from '../core/runtime.mjs';
import { loadProviders } from '../server.mjs';
import { createProviders as createCanvasProviders, canvasCloud, canvasSelf } from '../canvas/index.mjs';
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

test('HARNESS ONLY: LA-E7-05 Dynamic Registration on generic-sim, moodle-sim, and canvas-sim (opaque and JWT tokens, second token host, authorization_server, issuer path)', async () => {
  const f = fixture();
  const canvasProviders = createCanvasProviders(f.runtime);
  f.providers.push(...canvasProviders);

  // 1. generic-sim DR with second token host and authorization_server off issuer origin (opaque token)
  const genDrScenario = f.runtime.scenario({
    id: 'gen-dr-1',
    provider: 'generic-sim',
    clientId: 'gen-dr-client-1',
    deploymentId: 'deploy-generic-2',
    siteHost: 'generic.sim.test',
    secondTokenHost: true,
    authorizationServer: 'https://authz.generic.sim.test/oauth2',
  });
  assert.equal(genDrScenario.registration.tokenFormat, 'opaque-bearer');
  assert.match(genDrScenario.registration.registrationToken, /^regtok-gen-dr-1-/);

  const openidRes = await f.request('generic.sim.test', `/lti/.well-known/openid-configuration?scenario=${genDrScenario.id}`);
  assert.equal(openidRes.status, 200);
  const openidDoc = JSON.parse(openidRes.body);
  assert.equal(openidDoc.issuer, 'https://generic.sim.test/lti');
  assert.equal(openidDoc.token_endpoint, 'https://token.generic.sim.test/lti/oauth2/token');
  assert.equal(openidDoc.authorization_server, 'https://authz.generic.sim.test/oauth2');
  assert.equal(openidDoc['https://purl.imsglobal.org/spec/lti-platform-configuration'].product_family_code, 'generic');
  assert.deepEqual(
    openidDoc['https://purl.imsglobal.org/spec/lti-platform-configuration'].messages_supported.map((m) => m.type),
    ['LtiResourceLinkRequest', 'LtiDeepLinkingRequest'],
  );

  const toolConfigPayload = {
    application_type: 'web',
    response_types: ['id_token'],
    grant_types: ['implicit', 'client_credentials'],
    initiate_login_uri: `${TOOL}/lti/login/cogniate`,
    redirect_uris: [`${TOOL}/lti/launch/cogniate`],
    client_name: 'Cogniate',
    jwks_uri: `${TOOL}/lti/keys/cogniate`,
    token_endpoint_auth_method: 'private_key_jwt',
    scope: `${SCOPES.lineitem} ${SCOPES.score} ${SCOPES.result} ${SCOPES.nrps}`,
    'https://purl.imsglobal.org/spec/lti-tool-configuration': {
      domain: 'lti.cogniate.test',
      target_link_uri: `${TOOL}/lti/launch/cogniate`,
      claims: ['iss', 'sub'],
      messages: [
        { type: 'LtiResourceLinkRequest', target_link_uri: `${TOOL}/lti/launch/cogniate` },
        { type: 'LtiDeepLinkingRequest', target_link_uri: `${TOOL}/lti/launch/cogniate` },
      ],
    },
  };

  // Missing Bearer token is rejected
  assert.equal(
    (await f.request('generic.sim.test', '/lti/register', 'POST', toolConfigPayload, { 'content-type': 'application/json' })).status,
    400,
  );

  const regRes = await f.request('generic.sim.test', `/lti/register?scenario=${genDrScenario.id}`, 'POST', toolConfigPayload, {
    'content-type': 'application/json',
    authorization: `Bearer ${genDrScenario.registration.registrationToken}`,
  });
  assert.equal(regRes.status, 200, regRes.body);
  const regBody = JSON.parse(regRes.body);
  assert.equal(regBody.client_id, 'gen-dr-client-1');
  assert.equal(regBody['https://purl.imsglobal.org/spec/lti-tool-configuration'].deployment_id, 'deploy-generic-2');

  // 2. moodle-sim DR with Moodle-style scope JWT ('reg' and 'reg-update') and issuer with a subpath
  const moodleDrNew = f.runtime.scenario({
    id: 'moodle-dr-new',
    provider: 'moodle-sim',
    clientId: 'moodle-dr-client-1',
    deploymentId: '1',
    siteHost: 'moodle.sim.test',
    issuer: 'https://moodle.sim.test/moodle',
    dr: { operation: 'new' },
  });
  assert.equal(moodleDrNew.registration.tokenFormat, 'moodle-scope-jwt');
  const moodleOpenid = await f.request('moodle.sim.test', `/moodle/mod/lti/openid-configuration.php?scenario=${moodleDrNew.id}`);
  assert.equal(moodleOpenid.status, 200);
  const moodleDoc = JSON.parse(moodleOpenid.body);
  assert.equal(moodleDoc.issuer, 'https://moodle.sim.test/moodle');
  assert.equal(moodleDoc.token_endpoint, 'https://moodle.sim.test/moodle/mod/lti/token.php');

  // Opaque token on JWT-requiring moodle-sim scenario is rejected
  assert.equal(
    (await f.request('moodle.sim.test', `/moodle/mod/lti/openid-registration.php?scenario=${moodleDrNew.id}`, 'POST', toolConfigPayload, {
      'content-type': 'application/json',
      authorization: 'Bearer opaque-not-a-jwt',
    })).status,
    400,
  );

  // Signed 'reg' JWT succeeds
  const moodleRegRes = await f.request('moodle.sim.test', `/moodle/mod/lti/openid-registration.php?scenario=${moodleDrNew.id}`, 'POST', toolConfigPayload, {
    'content-type': 'application/json',
    authorization: `Bearer ${moodleDrNew.registration.registrationToken}`,
  });
  assert.equal(moodleRegRes.status, 200, moodleRegRes.body);

  // 'reg-update' JWT succeeds
  const moodleDrUpdate = f.runtime.scenario({
    id: 'moodle-dr-update',
    provider: 'moodle-sim',
    clientId: 'moodle-dr-client-1',
    deploymentId: '2',
    siteHost: 'moodle.sim.test',
    dr: { operation: 'update', updateId: '2' },
  });
  const updateRes = await f.request('moodle.sim.test', `/mod/lti/openid-registration.php?scenario=${moodleDrUpdate.id}`, 'POST', toolConfigPayload, {
    'content-type': 'application/json',
    authorization: `Bearer ${moodleDrUpdate.registration.registrationToken}`,
  });
  assert.equal(updateRes.status, 200, updateRes.body);

  // 3. Canvas DR with opaque token (LA-E3-09 Could)
  const cvDr = f.runtime.scenario({
    id: 'cv-dr-1',
    provider: 'canvas-sim-cloud',
    clientId: '10000000000099',
    deploymentId: '99:cvdr',
    siteHost: 'school-a.canvas.sim.test',
  });
  const cvOpenid = await f.request('sso.canvas.sim.test', `${canvasCloud.dr.configPaths[0]}?scenario=${cvDr.id}`);
  assert.equal(cvOpenid.status, 200);
  const cvReg = await f.request('school-a.canvas.sim.test', `${canvasCloud.dr.registrationPaths[0]}?scenario=${cvDr.id}`, 'POST', toolConfigPayload, {
    'content-type': 'application/json',
    authorization: `Bearer ${cvDr.registration.registrationToken}`,
  });
  assert.equal(cvReg.status, 200);
  assert.equal((await f.request('canvas-self.sim.test', canvasSelf.dr.configPaths[0])).status, 200);

  // Check /__sim/records for recorded scopes, messages, and redirectUris
  const records = JSON.parse((await f.runtime.control({ method: 'GET', url: new URL('https://lms-sim.test/__sim/records') })).body).records;
  const regRecords = records.filter((r) => r.kind === 'registration');
  assert.equal(regRecords.length, 4);
  assert.deepEqual(regRecords[0].scopes, [SCOPES.lineitem, SCOPES.score, SCOPES.result, SCOPES.nrps]);
  assert.equal(regRecords[0].messages.length, 2);
  assert.deepEqual(regRecords[0].redirectUris, [`${TOOL}/lti/launch/cogniate`]);
  assert.equal(regRecords[1].tokenFormat, 'moodle-scope-jwt');
  assert.equal(regRecords[1].tokenScope, 'reg');
  assert.equal(regRecords[2].tokenScope, 'reg-update');
  assert.equal(regRecords[2].tokenSub, '2');
});

test('HARNESS ONLY: LA-E7-05 throttling options on score (429 with/without Retry-After, 403 Rate Limit Exceeded), token (429), and memberships (429)', async () => {
  const f = fixture();
  const scenario = {
    id: 'gen-throttle-1',
    provider: 'generic-sim',
    clientId: 'gen-throttle-client',
    deploymentId: generic.deployments[0],
    siteHost: 'generic.sim.test',
    resource: 'pub_throttle',
    tokenAnswers: [
      { status: 429, retryAfter: 15, message: 'Too Many Token Requests' },
    ],
    nrpsAnswers: [
      { status: 429, retryAfter: 20, message: 'Too Many NRPS Requests' },
    ],
    scoreAnswers: [
      { status: 429, retryAfter: 30, message: 'Too Many Score Requests' },
      { status: 429, message: 'Too Many Score Requests (no header)' },
      { status: 403, message: '403 Forbidden (Rate Limit Exceeded)' },
      { status: 204 },
    ],
  };
  f.runtime.scenario(scenario);
  const now = Math.floor(Date.now() / 1000);
  const tokenEndpoint = 'https://generic.sim.test/lti/oauth2/token';
  const signAssertion = (jti) => f.tool.sign({
    iss: scenario.clientId,
    sub: scenario.clientId,
    aud: tokenEndpoint,
    iat: now,
    exp: now + 60,
    jti,
  });
  const callToken = (jti) => f.request('generic.sim.test', generic.token.path, 'POST', {
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    scope: `${SCOPES.score} ${SCOPES.nrps}`,
    client_assertion: signAssertion(jti),
  });

  // 1st token call -> 429 with Retry-After: 15
  const tok429 = await callToken('t-jti-1');
  assert.equal(tok429.status, 429);
  assert.equal(tok429.headers['Retry-After'], '15');

  // 2nd token call -> 200
  const tok200 = await callToken('t-jti-2');
  assert.equal(tok200.status, 200);
  const bearer = JSON.parse(tok200.body).access_token;

  // 1st NRPS call -> 429 with Retry-After: 20
  const nrps429 = await f.request('generic.sim.test', generic.sites[0].nrps, 'GET', {}, { authorization: `Bearer ${bearer}` });
  assert.equal(nrps429.status, 429);
  assert.equal(nrps429.headers['Retry-After'], '20');

  // 2nd NRPS call -> 200
  const nrps200 = await f.request('generic.sim.test', generic.sites[0].nrps, 'GET', {}, { authorization: `Bearer ${bearer}` });
  assert.equal(nrps200.status, 200);

  // Score calls: 429 with Retry-After: 30, 429 without header, 403 Rate Limit Exceeded, then 204
  const scoreHeaders = { authorization: `Bearer ${bearer}`, 'content-type': 'application/vnd.ims.lis.v1.score+json' };
  const scorePath = `${generic.sites[0].lineitems}/pub_throttle/scores`;
  const scoreBody = {
    userId: 'learner-1',
    scoreGiven: 85,
    scoreMaximum: 100,
    timestamp: new Date().toISOString(),
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
  };

  const s1 = await f.request('generic.sim.test', scorePath, 'POST', scoreBody, scoreHeaders);
  assert.equal(s1.status, 429);
  assert.equal(s1.headers['Retry-After'], '30');

  const s2 = await f.request('generic.sim.test', scorePath, 'POST', scoreBody, scoreHeaders);
  assert.equal(s2.status, 429);
  assert.equal(s2.headers['Retry-After'], undefined);

  const s3 = await f.request('generic.sim.test', scorePath, 'POST', scoreBody, scoreHeaders);
  assert.equal(s3.status, 403);
  assert.match(s3.body, /Rate Limit Exceeded/);

  const s4 = await f.request('generic.sim.test', scorePath, 'POST', scoreBody, scoreHeaders);
  assert.equal(s4.status, 204);

  const records = JSON.parse((await f.runtime.control({ method: 'GET', url: new URL('https://lms-sim.test/__sim/records') })).body).records;
  const scoreRecords = records.filter((r) => r.kind === 'score');
  assert.deepEqual(scoreRecords.map((r) => r.status), [429, 429, 403, 204]);
  assert.equal(scoreRecords[0].retryAfter, 30);
  for (const r of records.filter((rec) => ['token', 'nrps', 'score'].includes(rec.kind))) {
    assert.equal(Number.isFinite(Date.parse(r.ts)), true);
  }
});

test('HARNESS ONLY: LA-E7-05 Deep Linking options (accept_multiple, accept_lineitem, accept_media_types, Cancel empty array, multi-item return) and NRPS members option', async () => {
  const f = fixture();
  const roster = [
    { user_id: 'learner-1', status: 'Active', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'], name: 'Ada Lovelace' },
    { user_id: 'inst-1', status: 'Active', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'], name: 'Grace Hopper' },
  ];
  const dlScenario = {
    id: 'gen-dl-multi',
    provider: 'generic-sim',
    clientId: 'gen-dl-client',
    deploymentId: generic.deployments[0],
    siteHost: 'generic.sim.test',
    messageType: 'LtiDeepLinkingRequest',
    acceptMultiple: true,
    acceptLineitem: false,
    acceptMediaTypes: 'application/vnd.ims.lti.v1.ltilink,text/html',
    members: roster,
  };
  f.runtime.scenario(dlScenario);

  const claims = await idToken(f, generic, dlScenario);
  const settings = claims[DL + 'deep_linking_settings'];
  assert.equal(settings.accept_multiple, true);
  assert.equal(settings.accept_lineitem, false);
  assert.equal(settings.accept_media_types, 'application/vnd.ims.lti.v1.ltilink,text/html');

  const now = Math.floor(Date.now() / 1000);
  const makeDlJwt = (nonce, items, extra = {}) => f.tool.sign({
    iss: dlScenario.clientId,
    aud: generic.issuer,
    nonce,
    iat: now,
    exp: now + 60,
    [LTI + 'message_type']: 'LtiDeepLinkingResponse',
    [LTI + 'version']: '1.3.0',
    [LTI + 'deployment_id']: dlScenario.deploymentId,
    [DL + 'data']: 'data-gen-dl-multi',
    [DL + 'content_items']: items,
    ...extra,
  });

  // 1a. By default (dlAllowCancel not set), an empty content_items: [] is refused
  const refusedEmptyRes = await f.request('generic.sim.test', generic.sites[0].dlReturn, 'POST', {
    JWT: makeDlJwt('dl-empty-refused-nonce', []),
  });
  assert.equal(refusedEmptyRes.status, 400);
  assert.equal(JSON.parse(refusedEmptyRes.body).error, 'DL item count');

  // 1b. Setting scenario.claims[DL + 'deep_linking_settings'] replaces the computed claim object
  const replaceClaimScenario = {
    id: 'gen-dl-replace-claim',
    provider: 'generic-sim',
    clientId: 'gen-dl-replace-client',
    deploymentId: generic.deployments[0],
    siteHost: 'generic.sim.test',
    messageType: 'LtiDeepLinkingRequest',
    claims: {
      [DL + 'deep_linking_settings']: {
        deep_link_return_url: 'https://generic.sim.test/lti/deep-link/return',
        accept_types: ['ltiResourceLink'],
      },
    },
  };
  f.runtime.scenario(replaceClaimScenario);
  const replacedClaims = await idToken(f, generic, replaceClaimScenario);
  assert.deepEqual(replacedClaims[DL + 'deep_linking_settings'], {
    deep_link_return_url: 'https://generic.sim.test/lti/deep-link/return',
    accept_types: ['ltiResourceLink'],
  });

  // 1c. With dlAllowCancel: true set on the scenario, empty content_items: [] (Cancel) is accepted and recorded
  f.runtime.scenario({ ...dlScenario, dlAllowCancel: true });
  const cancelRes = await f.request('generic.sim.test', generic.sites[0].dlReturn, 'POST', {
    JWT: makeDlJwt('dl-cancel-nonce', [], { [DL + 'msg']: 'Selection cancelled' }),
  });
  assert.equal(cancelRes.status, 200, cancelRes.body);

  // 2. Multi-item response (without lineItem because accept_lineitem: false) is accepted and recorded
  const multiItems = [
    { type: 'ltiResourceLink', title: 'Course 1', url: `${TOOL}/lti/launch/cogniate?resource=pub_multi_1`, window: { targetName: '_blank' } },
    { type: 'ltiResourceLink', title: 'Course 2', url: `${TOOL}/lti/launch/cogniate?resource=pub_multi_2`, window: { targetName: '_blank' } },
  ];
  const multiRes = await f.request('generic.sim.test', generic.sites[0].dlReturn, 'POST', {
    JWT: makeDlJwt('dl-multi-nonce', multiItems),
  });
  assert.equal(multiRes.status, 200, multiRes.body);

  // 3. NRPS members option returns the configured membership list
  const tokRes = await f.request('generic.sim.test', generic.token.path, 'POST', {
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    scope: SCOPES.nrps,
    client_assertion: f.tool.sign({
      iss: dlScenario.clientId,
      sub: dlScenario.clientId,
      aud: 'https://generic.sim.test/lti/oauth2/token',
      iat: now,
      exp: now + 60,
      jti: 'nrps-roster-jti-1',
    }),
  });
  const bearer = JSON.parse(tokRes.body).access_token;
  const nrpsRes = await f.request('generic.sim.test', generic.sites[0].nrps, 'GET', {}, { authorization: `Bearer ${bearer}` });
  assert.equal(nrpsRes.status, 200);
  const nrpsBody = JSON.parse(nrpsRes.body);
  assert.deepEqual(nrpsBody.members, roster);

  const records = JSON.parse((await f.runtime.control({ method: 'GET', url: new URL('https://lms-sim.test/__sim/records') })).body).records;
  const dlRecords = records.filter((r) => r.kind === 'deep-link');
  assert.equal(dlRecords.length, 2);
  assert.equal(dlRecords[0].cancelled, true);
  assert.deepEqual(dlRecords[0].items, []);
  assert.equal(dlRecords[1].itemCount, 2);
  assert.equal(dlRecords[1].items.length, 2);
});

test('HARNESS ONLY: LA-E7-05 platform storage (lti_storage_target, lti.put_data and lti.get_data origin + message_id isolation) and Should/Could options', async () => {
  const f = fixture();

  // 1. Platform storage login field and auth host storage frame
  const defaultSc = f.runtime.scenario({
    id: 'gen-no-storage',
    provider: 'generic-sim',
    clientId: 'gen-storage-client',
    deploymentId: generic.deployments[0],
    siteHost: 'generic.sim.test',
  });
  assert.equal(Object.hasOwn(defaultSc.login, 'lti_storage_target'), false);

  const storageSc = f.runtime.scenario({
    id: 'gen-with-storage',
    provider: 'generic-sim',
    clientId: 'gen-storage-client',
    deploymentId: generic.deployments[0],
    siteHost: 'generic.sim.test',
    storageTarget: 'post_message_forwarding',
    secondKey: true,
    useSecondKey: true,
    institutionAdmin: true,
    extraAud: 'https://extra-aud.sim.test',
    ungradedPlacement: true,
    tokenError: 'invalid_client',
  });
  assert.equal(storageSc.login.lti_storage_target, 'post_message_forwarding');
  assert.match(storageSc.login.target_link_uri, /cogniate_placement=ungraded/);

  const frameRes = await f.request('generic.sim.test', `/__frame?url=${encodeURIComponent(`${TOOL}/lti/login/cogniate`)}`);
  assert.equal(frameRes.status, 200);
  assert.match(frameRes.body, /name="post_message_forwarding"/);
  const storageFramePage = await f.request('generic.sim.test', '/__storage', 'GET');
  assert.equal(storageFramePage.status, 200);

  // Execute the storage frame's inline <script> the way a browser does:
  // the frame runs on https://generic.sim.test, so its same-origin fetch('/__storage', { method: 'POST' })
  // sends Origin: 'https://generic.sim.test' alongside the frame's 'x-storage-origin': event.origin header.
  const scriptMatch = /<script>([\s\S]*?)<\/script>/.exec(storageFramePage.body);
  assert.ok(scriptMatch, 'storage frame includes inline <script>');
  let messageListener = null;
  const browserContext = vm.createContext({
    Map,
    JSON,
    window: {
      addEventListener(type, fn) {
        if (type === 'message') messageListener = fn;
      },
    },
    fetch: async (path, init = {}) => {
      const headers = {
        ...(init.headers ?? {}),
        // A browser always sets Origin to the frame's own auth-host origin on a same-origin POST.
        origin: `https://${generic.auth.host}`,
      };
      const res = await f.request(generic.auth.host, path, init.method ?? 'GET', JSON.parse(init.body ?? '{}'), headers);
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        json: async () => JSON.parse(res.body),
      };
    },
  });
  vm.runInContext(scriptMatch[1], browserContext);
  assert.equal(typeof messageListener, 'function');

  async function postToStorageFrame(senderOrigin, data) {
    const replies = [];
    await messageListener({
      origin: senderOrigin,
      data,
      source: {
        postMessage(msg, targetOrigin) {
          replies.push({ msg, targetOrigin });
        },
      },
    });
    return replies;
  }

  // Browser postMessage from TOOL stores and replies to TOOL (not to the auth host Origin)
  const putReplies = await postToStorageFrame(TOOL, {
    subject: 'lti.put_data',
    message_id: 'msg-put-1',
    key: 'state-123',
    value: 'nonce-abc',
  });
  assert.deepEqual(putReplies, [
    {
      msg: { subject: 'lti.put_data.response', message_id: 'msg-put-1' },
      targetOrigin: TOOL,
    },
  ]);

  // Same sender origin gets the stored value with its own message_id and targetOrigin === TOOL
  const getSameReplies = await postToStorageFrame(TOOL, {
    subject: 'lti.get_data',
    message_id: 'msg-get-2',
    key: 'state-123',
  });
  assert.deepEqual(getSameReplies, [
    {
      msg: { subject: 'lti.get_data.response', message_id: 'msg-get-2', value: 'nonce-abc' },
      targetOrigin: TOOL,
    },
  ]);

  // Different sender origin does NOT get the first origin's data, even though both frame POSTs
  // carry the same browser HTTP Origin header (https://generic.sim.test)
  const getOtherReplies = await postToStorageFrame('https://other-tool.test', {
    subject: 'lti.get_data',
    message_id: 'msg-get-3',
    key: 'state-123',
  });
  assert.deepEqual(getOtherReplies, [
    {
      msg: { subject: 'lti.get_data.response', message_id: 'msg-get-3' },
      targetOrigin: 'https://other-tool.test',
    },
  ]);

  // Direct same-origin POST without x-storage-origin (Origin === auth host) or missing message_id is rejected
  assert.equal(
    (await f.request(generic.auth.host, '/__storage', 'POST', {
      subject: 'lti.get_data',
      message_id: 'msg-get-self',
      key: 'state-123',
    }, { 'content-type': 'application/json', origin: `https://${generic.auth.host}` })).status,
    400,
  );
  assert.equal(
    (await f.request('generic.sim.test', '/__storage', 'POST', {
      subject: 'lti.get_data',
      message_id: '',
      key: 'state-123',
    }, { 'content-type': 'application/json', 'x-storage-origin': TOOL })).status,
    400,
  );

  // 2. Should/Could options: second signing key, institution admin role, extra aud, ungraded target, invalid_client token
  const jwksRes = await f.request('generic.sim.test', generic.jwks.path);
  const jwks = JSON.parse(jwksRes.body);
  assert.equal(jwks.keys.length, 2);
  assert.equal(jwks.keys[1].kid, f.runtime.signer2.jwk.kid);

  const authRes = await f.request(generic.auth.host, `${generic.auth.path}?${authParams({ id: 'gen-with-storage', clientId: 'gen-storage-client' })}`);
  assert.equal(authRes.status, 200);
  const rawJwt = formFields(authRes.body).id_token;
  const header = JSON.parse(Buffer.from(rawJwt.split('.')[0], 'base64url').toString('utf8'));
  assert.equal(header.kid, f.runtime.signer2.jwk.kid);
  const signedClaims = verifyJwt(rawJwt, jwks, {
    issuer: generic.issuer,
    audience: ['gen-storage-client', 'https://extra-aud.sim.test'],
  });
  assert.deepEqual(signedClaims.aud, ['gen-storage-client', 'https://extra-aud.sim.test']);
  assert.equal(signedClaims.azp, 'gen-storage-client');
  assert.equal(signedClaims[LTI + 'roles'].includes('http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator'), true);
  assert.match(signedClaims[LTI + 'target_link_uri'], /cogniate_placement=ungraded/);

  // Token endpoint returns invalid_client on demand
  const now = Math.floor(Date.now() / 1000);
  const invClientRes = await f.request('generic.sim.test', generic.token.path, 'POST', {
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    scope: SCOPES.score,
    client_assertion: f.tool.sign({
      iss: 'gen-storage-client',
      sub: 'gen-storage-client',
      aud: 'https://generic.sim.test/lti/oauth2/token',
      iat: now,
      exp: now + 60,
      jti: 'inv-client-jti-1',
    }),
  });
  assert.equal(invClientRes.status, 400);
  assert.equal(JSON.parse(invClientRes.body).error, 'invalid_client');
});
