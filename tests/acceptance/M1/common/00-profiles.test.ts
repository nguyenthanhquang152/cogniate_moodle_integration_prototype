import { admin, app, assert, cli, createConnection, expectStatus, httpsRequest, m1Test, session, sharedPlatform, unique, urls } from './client';

const expectedProfiles = [
  { id: 'standard', lms: null, sharing: 'exclusive', issuer: null, authenticationEndpoint: null,
    accesstokenEndpoint: null, jwksUrl: null, siteUrlOn: null, serviceUrl: false, simulation: false },
  ...['production', 'beta', 'test'].map((tier) => {
    const part = tier === 'production' ? '' : tier + '.';
    return { id: 'canvas-cloud-' + tier, lms: 'canvas', sharing: 'exclusive',
      issuer: `https://canvas.${part}instructure.com`,
      authenticationEndpoint: `https://sso.${part}canvaslms.com/api/lti/authorize_redirect`,
      jwksUrl: `https://sso.${part}canvaslms.com/api/lti/security/jwks`,
      accesstokenEndpoint: '{serviceUrl}/login/oauth2/token',
      siteUrlOn: 'platform', serviceUrl: true, simulation: false };
  }),
  { id: 'canvas-self-hosted', lms: 'canvas', sharing: 'exclusive', issuer: '{siteUrl}',
    authenticationEndpoint: '{siteUrl}/api/lti/authorize_redirect', jwksUrl: '{siteUrl}/api/lti/security/jwks',
    accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', siteUrlOn: 'platform', serviceUrl: true, simulation: false },
  ...[false, true].map((simulation) => {
    const domain = simulation ? 'blackboard.sim.test' : 'blackboard.com';
    return { id: simulation ? 'blackboard-sim' : 'blackboard', lms: 'blackboard', sharing: 'shared',
      issuer: `https://${domain}`, authenticationEndpoint: `https://developer.${domain}/api/v1/gateway/oidcauth`,
      accesstokenEndpoint: `https://developer.${domain}/api/v1/gateway/oauth2/jwttoken`,
      jwksUrl: `https://developer.${domain}/api/v1/management/applications/{clientId}/jwks.json`,
      siteUrlOn: 'deployment', serviceUrl: false, simulation };
  }),
  { id: 'canvas-sim-cloud', lms: 'canvas', sharing: 'exclusive', issuer: 'https://canvas.sim.test',
    authenticationEndpoint: 'https://sso.canvas.sim.test/api/lti/authorize_redirect',
    jwksUrl: 'https://sso.canvas.sim.test/api/lti/security/jwks',
    accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', siteUrlOn: 'platform', serviceUrl: true, simulation: true },
];

m1Test('M1-21.common.moodle-grant-refused', 'operator cannot issue approval grants for Moodle', async () => {
  const s = await session();
  const c = await app(s, 'POST', '/app-api/connections', { name: unique('Moodle'), siteUrl: urls.moodle, method: 'manual' }); expectStatus(c, 201);
  const response = await cli('app:grant', ['issue', '--library', s.library.id, '--connection', c.json.id,
    '--site', urls.moodle, '--client-id', 'any', '--deployment-id', 'any', '--note', 'M1 capability']);
  assert.equal(response.code, 1);
});

m1Test('M1-01.common.constants', 'all production and simulation profile constants and order', async () => {
  const result = await admin('GET', '/api/providers'); expectStatus(result, 200);
  assert.deepEqual(result.json.profiles.map((p: any) => {
    const { label, sharedPlatform: ignored, ...values } = p;
    assert.equal(typeof label, 'string'); return values;
  }), expectedProfiles);
  for (const profile of result.json.profiles) assert.equal(profile.sharedPlatform, null);
  const health = await httpsRequest(urls.lti + '/healthz');
  expectStatus(health, 200);
  assert.deepEqual(JSON.parse(health.body).simulation_profiles, ['blackboard-sim', 'canvas-sim-cloud']);
  assert.deepEqual(JSON.parse(health.body).knobs, []);
});

m1Test('M1-15.blackboard.not-ready', 'Blackboard connection is refused before the shared application exists', async () => {
  const s = await session();
  const result = await app(s, 'POST', '/app-api/connections', {
    name: unique('not-ready'), lms: 'blackboard', profile: 'blackboard-sim', method: 'manual', siteUrl: 'https://learn-a.blackboard.sim.test',
  });
  expectStatus(result, 409, 'PROVIDER_NOT_READY');
});

m1Test('M1-01.blackboard.readiness', 'shared provider readiness changes after explicit creation', async () => {
  const id = await sharedPlatform();
  const result = await admin('GET', '/api/providers'); expectStatus(result, 200);
  assert.deepEqual(result.json.profiles.find((p: any) => p.id === 'blackboard-sim').sharedPlatform,
    { id, clientId: 'qa-bb-app', active: true });
  const s = await session();
  const appProviders = await app(s, 'GET', '/app-api/lms-providers'); expectStatus(appProviders, 200);
  assert.ok(JSON.stringify(appProviders.json).includes('qa-bb-app'));
});

const standardBody = (issuer = 'https://qa-platform.test') => ({
  url: issuer, clientId: unique('standard'), name: 'QA standard',
  authenticationEndpoint: issuer + '/auth', accesstokenEndpoint: issuer + '/token',
  authConfig: { method: 'JWK_SET', key: issuer + '/jwks' }, deploymentIds: ['legacy'],
});
m1Test('M1-03.common.legacy', 'omitted profile keeps legacy standard generation and site defaults', async () => {
  const result = await admin('POST', '/api/platforms', standardBody()); expectStatus(result, 201);
  assert.equal(result.json.profile, 'standard'); assert.equal(result.json.siteUrl, null);
  assert.deepEqual(result.json.deploymentIds, ['legacy']);
  assert.equal(result.json.deployments[0].bindingGeneration, 0);
  assert.equal(result.json.deployments[0].siteUrl, 'https://qa-platform.test');
  assert.equal(result.json.deployments[0].active, true);
});
for (const field of ['siteUrl', 'serviceUrl']) {
  m1Test(`M1-03.common.reject-${field.toLowerCase()}`, `standard rejects ${field}`, async () => {
    expectStatus(await admin('POST', '/api/platforms', { ...standardBody(), [field]: 'https://qa-platform.test' }), 400, 'INVALID_REQUEST');
  });
}
m1Test('M1-03.common.auth-origin', 'standard auth endpoint must stay on the issuer origin', async () => {
  expectStatus(await admin('POST', '/api/platforms', { ...standardBody(), authenticationEndpoint: 'https://evil.test/auth' }), 400, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN');
});
for (const [label, issuer] of [
  ['blackboard', 'https://blackboard.com'], ['canvas', 'https://canvas.instructure.com'],
  ['canvas-beta', 'https://canvas.beta.instructure.com'], ['canvas-test', 'https://canvas.test.instructure.com'],
  ['blackboard-sim', 'https://blackboard.sim.test'], ['canvas-sim', 'https://canvas.sim.test'],
]) {
  m1Test(`M1-03.common.reserved-${label}`, `standard cannot reserve ${label}`, async () => {
    const body = standardBody(issuer);
    expectStatus(await admin('POST', '/api/platforms', body), 400, 'ISSUER_RESERVED');
    const list = await admin('GET', `/api/platforms?url=${encodeURIComponent(issuer)}&clientId=${body.clientId}`);
    expectStatus(list, 200); assert.deepEqual(list.json.platforms, []);
  });
}
m1Test('M1-15.common.moodle-default', 'omitted LMS preserves Moodle DTO and 16 configuration rows', async () => {
  const s = await session();
  const result = await app(s, 'POST', '/app-api/connections', { name: unique('Moodle'), siteUrl: urls.moodle, method: 'manual' });
  expectStatus(result, 201);
  assert.equal(result.json.lms, 'moodle'); assert.equal(result.json.profile, 'standard');
  assert.equal(result.json.serviceUrl, urls.moodle);
  assert.deepEqual(result.json.capabilities, { dynamicRegistration: true, operatorApproval: false,
    webServices: true, courseShell: true, addDeployment: false, canvasConfiguration: false });
  const rows = await app(s, 'GET', `/app-api/connections/${result.json.id}/tool-configuration`);
  expectStatus(rows, 200); assert.equal(rows.json.length, 16);
});
m1Test('M1-19.common.moodle-configuration', 'Moodle export keeps all 16 keys and values in order', async () => {
  const s = await session();
  const c = await app(s, 'POST', '/app-api/connections', { name: unique('Moodle export'), siteUrl: urls.moodle, method: 'manual' });
  expectStatus(c, 201);
  const rows = await app(s, 'GET', `/app-api/connections/${c.json.id}/tool-configuration`); expectStatus(rows, 200);
  const expected = [
    ['tool_name', `Cogniate (${s.library.name})`], ['tool_url', urls.lti + '/lti/launch/cogniate'],
    ['lti_version', 'LTI 1.3'], ['public_key_type', 'Keyset URL'], ['public_keyset_url', urls.lti + '/lti/keys/cogniate'],
    ['initiate_login_url', urls.lti + '/lti/login/cogniate'], ['redirection_uris', urls.lti + '/lti/launch/cogniate'],
    ['deep_linking', 'Yes'], ['content_selection_url', urls.lti + '/lti/launch/cogniate'],
    ['tool_configuration_usage', 'Show in activity chooser and as a preconfigured tool'], ['launch_container', 'New window'],
    ['ags', 'Use this service for grade sync and column management'], ['nrps', "Use this service to retrieve members' information as per privacy settings"],
    ['share_name', 'Never'], ['share_email', 'Never'], ['accept_grades', 'As specified in Deep Linking definition or Delegate to teacher'],
  ];
  assert.deepEqual(rows.json.map((row: any) => [row.key, row.value]), expected);
});
m1Test('M1-15.blackboard.dto', 'Blackboard DTO is strict and contains capability values without grants', async () => {
  const s = await session(); const connection = await createConnection(s);
  assert.equal(connection.status, 'pending'); assert.equal(connection.platform, null);
  assert.equal(connection.serviceUrl, connection.siteUrl);
  assert.deepEqual(connection.capabilities, { dynamicRegistration: false, operatorApproval: true,
    webServices: false, courseShell: false, addDeployment: false, canvasConfiguration: false });
  assert.equal(Object.keys(connection).some((key) => /grant/i.test(key)), false);
  for (const [body, status, code] of [
    [{ serviceUrl: 'https://learn-a.blackboard.sim.test' }, 400, 'INVALID_REQUEST'],
    [{ method: 'dynamic' }, 422, 'CAPABILITY_NOT_SUPPORTED'],
    [{ profile: 'canvas-sim-cloud' }, 400, 'INVALID_REQUEST'],
  ] as const) {
    const before = await app(s, 'GET', '/app-api/connections');
    const response = await app(s, 'POST', '/app-api/connections', {
      name: unique('invalid'), siteUrl: connection.siteUrl, method: 'manual',
      lms: 'blackboard', profile: 'blackboard-sim', ...body,
    });
    expectStatus(response, status, code);
    assert.deepEqual((await app(s, 'GET', '/app-api/connections')).json, before.json);
  }
});
