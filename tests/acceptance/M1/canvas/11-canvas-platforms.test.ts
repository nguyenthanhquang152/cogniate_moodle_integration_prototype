// Canvas platforms, origins, deployments and connection DTOs: AC-M1-04, -05, -07, -15 (Canvas parts).
import { sinkHitsSince } from '../../lib/lti';
import {
  admin, app, assert, deploymentPath, expectStatus, logEvents, m1Test, preparedLaunch,
  records, session, sharedPlatform, unique, urls, type Json,
} from '../common/client';
import {
  CLOUD, SELF, canvasClientId, canvasConnection, canvasDeploymentId, canvasGrant, canvasLaunch, canvasPlatform,
  canvasRedeem, platformsFor, refused, scenarioOf,
} from './canvas';

const cloudBody = (patch: Json = {}) => ({ profile: CLOUD.profile, clientId: canvasClientId(), name: unique('QA Canvas'),
  siteUrl: CLOUD.siteA, deploymentIds: ['dA'], ...patch });

// ---------------------------------------------------------------- AC-M1-04 fixed endpoints
m1Test('M1-04.canvas.cloud-fixed', 'canvas-sim-cloud create stores the fixed issuer, SSO endpoints and service token URL', async () => {
  const since = Date.now(), body = cloudBody(), r = await admin('POST', '/api/platforms', body);
  expectStatus(r, 201);
  assert.equal(r.json.profile, CLOUD.profile);
  assert.equal(r.json.url, CLOUD.issuer);
  assert.equal(r.json.authenticationEndpoint, CLOUD.auth);
  assert.equal(r.json.authConfig?.method, 'JWK_SET'); assert.equal(r.json.authConfig?.key, CLOUD.jwks);
  assert.equal(r.json.accesstokenEndpoint, `${CLOUD.siteA}/login/oauth2/token`);
  assert.equal(r.json.siteUrl, CLOUD.siteA); assert.equal(r.json.serviceUrl, CLOUD.siteA);
  assert.deepEqual(r.json.deploymentIds, ['dA']);
  assert.equal(logEvents('platform_created', since, { platform_id: r.json.id, profile: CLOUD.profile }, 'lti-service').length, 1);
  assert.deepEqual(sinkHitsSince(since), []);
});
for (const [variant, field, patch] of [
  ['override-url', 'url', { url: 'https://evil.test' }],
  ['override-auth', 'authenticationEndpoint', { authenticationEndpoint: 'https://evil.test/auth' }],
  ['override-token', 'accesstokenEndpoint', { accesstokenEndpoint: 'https://evil.test/token' }],
  ['override-jwks', 'authConfig', { authConfig: { method: 'JWK_SET', key: 'https://evil.test/jwks' } }],
] as const) {
  m1Test(`M1-04.canvas.${variant}`, `a sent ${field} that is not the profile value is refused and stores nothing`, async () => {
    const since = Date.now(), body = cloudBody(patch), r = await admin('POST', '/api/platforms', body);
    expectStatus(r, 400, 'PLATFORM_URL_NOT_IN_PROFILE');
    assert.ok(String(r.json.details.description).includes(field), `description names ${field}`);
    assert.deepEqual(await platformsFor(body.clientId), []);
    assert.deepEqual(sinkHitsSince(since), [], 'Zero evil.test sink hits');
  });
}
m1Test('M1-04.canvas.split-hosts', 'a Canvas page host and a separate service host are both kept; token on the service host', async () => {
  const r = await admin('POST', '/api/platforms', cloudBody({ siteUrl: CLOUD.pageA, serviceUrl: CLOUD.siteA }));
  expectStatus(r, 201);
  assert.equal(r.json.siteUrl, CLOUD.pageA); assert.equal(r.json.serviceUrl, CLOUD.siteA);
  assert.equal(r.json.accesstokenEndpoint, `${CLOUD.siteA}/login/oauth2/token`);
  assert.equal(r.json.url, CLOUD.issuer);
});
m1Test('M1-04.canvas.self-hosted', 'canvas-self-hosted builds issuer, auth and JWKS from the site and the token URL from the service', async () => {
  const r = await admin('POST', '/api/platforms', { profile: SELF.profile, clientId: canvasClientId(), name: unique('QA self'),
    siteUrl: SELF.site, serviceUrl: SELF.service, deploymentIds: ['dS'] });
  expectStatus(r, 201);
  assert.equal(r.json.url, SELF.site);
  assert.equal(r.json.authenticationEndpoint, `${SELF.site}/api/lti/authorize_redirect`);
  assert.equal(r.json.authConfig?.key, `${SELF.site}/api/lti/security/jwks`);
  assert.equal(r.json.accesstokenEndpoint, `${SELF.service}/login/oauth2/token`);
  assert.equal(r.json.siteUrl, SELF.site); assert.equal(r.json.serviceUrl, SELF.service);
});
m1Test('M1-04.canvas.service-url-standard', 'serviceUrl is refused on a standard platform', async () => {
  const issuer = 'https://qa-platform.test';
  expectStatus(await admin('POST', '/api/platforms', { url: issuer, clientId: unique('std'), name: 'QA standard',
    authenticationEndpoint: issuer + '/auth', accesstokenEndpoint: issuer + '/token',
    authConfig: { method: 'JWK_SET', key: issuer + '/jwks' }, deploymentIds: ['legacy'], serviceUrl: issuer }), 400, 'INVALID_REQUEST');
});
m1Test('M1-04.canvas.service-url-blackboard', 'serviceUrl is refused on a blackboard-sim platform', async () => {
  await sharedPlatform();
  expectStatus(await admin('POST', '/api/platforms', { profile: 'blackboard-sim', clientId: 'qa-bb-app', name: 'QA Blackboard',
    serviceUrl: 'https://learn-a.blackboard.sim.test' }), 400, 'INVALID_REQUEST');
});

// ---------------------------------------------------------------- AC-M1-05 canonical origins and site rules
const ruleCases: [string, string, number, 'cloud' | 'self', 'siteUrl' | 'serviceUrl'][] = [
  ['rule1-http', 'http://school-a.canvas.sim.test', 1, 'cloud', 'siteUrl'],
  ['rule1-path', 'https://school-a.canvas.sim.test/canvas', 1, 'cloud', 'siteUrl'],
  ['rule1-query', 'https://school-a.canvas.sim.test/?x=1', 1, 'cloud', 'siteUrl'],
  ['rule1-fragment', 'https://school-a.canvas.sim.test/#f', 1, 'cloud', 'siteUrl'],
  ['rule1-userinfo', 'https://u:p@school-a.canvas.sim.test', 1, 'cloud', 'siteUrl'],
  ['rule2-ipv4', 'https://10.20.30.40', 2, 'cloud', 'siteUrl'],
  ['rule2-ipv6', 'https://[::1]', 2, 'cloud', 'siteUrl'],
  ['rule2-localhost', 'https://localhost', 2, 'cloud', 'siteUrl'],
  ['rule2-sub-localhost', 'https://a.localhost', 2, 'cloud', 'siteUrl'],
  ['rule3-lti', `https://${new URL(urls.lti).hostname}`, 3, 'cloud', 'siteUrl'],
  ['rule3-app', `https://${new URL(urls.app).hostname}`, 3, 'cloud', 'siteUrl'],
  ['rule3-content', `https://${new URL(urls.content).hostname}`, 3, 'cloud', 'siteUrl'],
  ['rule4-sso', 'https://sso.canvas.sim.test', 4, 'cloud', 'siteUrl'],
  ['rule4-sso-port', 'https://sso.canvas.sim.test:8443', 4, 'cloud', 'siteUrl'],
  ['rule5-instructure', 'https://school.instructure.com', 5, 'self', 'siteUrl'],
  ['rule4-service-sso', 'https://sso.canvas.sim.test', 4, 'cloud', 'serviceUrl'],
];
for (const [variant, input, rule, kind, field] of ruleCases) {
  m1Test(`M1-05.canvas.${variant}`, `site rule ${rule} refuses ${field} ${input} at both services without an outbound call`, async () => {
    const since = Date.now(), cursor = (await records()).cursor;
    const profile = kind === 'self' ? SELF.profile : CLOUD.profile;
    const valid = kind === 'self' ? SELF.site : CLOUD.siteA;
    const values = field === 'siteUrl' ? { siteUrl: input } : { siteUrl: valid, serviceUrl: input };
    const clientId = canvasClientId();
    const lti = await admin('POST', '/api/platforms', { profile, clientId, name: unique('rule'), deploymentIds: ['dR'], ...values });
    expectStatus(lti, 400, 'INVALID_SITE_URL');
    assert.match(String(lti.json.details.description), new RegExp(`rule ${rule}\\b`));
    assert.deepEqual(await platformsFor(clientId), []);
    const s = await session(), before = await app(s, 'GET', '/app-api/connections');
    const created = await app(s, 'POST', '/app-api/connections', { name: unique('rule'), method: 'manual', lms: 'canvas', profile, ...values });
    expectStatus(created, 422, 'INVALID_SITE_URL');
    assert.equal(String(created.json.details.rule), String(rule));
    assert.equal(created.json.details.field, field);
    assert.deepEqual((await app(s, 'GET', '/app-api/connections')).json, before.json, 'No connection is made');
    assert.deepEqual((await records(cursor)).records, [], 'No simulator request');
    assert.deepEqual(sinkHitsSince(since), [], 'No sink request');
  });
}
m1Test('M1-05.canvas.canonical', 'an upper-case origin with :443 and / is stored, granted and site-checked in canonical form', async () => {
  const raw = 'HTTPS://School-A.Canvas.Sim.Test:443/';
  const lti = await admin('POST', '/api/platforms', cloudBody({ siteUrl: raw })); expectStatus(lti, 201);
  assert.equal(lti.json.siteUrl, CLOUD.siteA); assert.equal(lti.json.serviceUrl, CLOUD.siteA);
  const s = await session(), connection = await canvasConnection(s, { siteUrl: raw });
  assert.equal(connection.siteUrl, CLOUD.siteA); assert.equal(connection.serviceUrl, CLOUD.siteA);
  const clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  const grant = await canvasGrant(s, connection, clientId, deploymentId, { site: raw, 'service-url': 'https://SCHOOL-A.canvas.sim.test' });
  assert.ok(grant.stdout.includes(CLOUD.siteA), 'Operator output shows the canonical site');
  const registered = await canvasRedeem(s, connection, clientId, deploymentId, grant); expectStatus(registered, 200);
  assert.equal(registered.json.platform.siteUrl, CLOUD.siteA);
  const result = await canvasLaunch({ provider: CLOUD.provider, clientId, deploymentId, serviceHost: 'school-a.canvas.sim.test', pageHost: 'school-a.canvas.sim.test' });
  assert.equal(result.response.status, 303, 'Site check accepts the canonical value');
});
m1Test('M1-05.canvas.self-positive', 'a self-hosted site is accepted at the LTI service and the app', async () => {
  expectStatus(await admin('POST', '/api/platforms', { profile: SELF.profile, clientId: canvasClientId(), name: unique('self'),
    siteUrl: SELF.site, deploymentIds: ['dS'] }), 201);
  const s = await session();
  const c = await app(s, 'POST', '/app-api/connections', { name: unique('self'), siteUrl: SELF.site, method: 'manual', lms: 'canvas', profile: SELF.profile });
  expectStatus(c, 201); assert.equal(c.json.siteUrl, SELF.site); assert.equal(c.json.serviceUrl, SELF.site);
});

// ---------------------------------------------------------------- AC-M1-07 Canvas deployments
async function cloudPlatform() {
  const p = await canvasPlatform();
  return { ...p, path: (d?: string) => deploymentPath(p.platformId, d) };
}
m1Test('M1-07.canvas.deployment-site-refused', 'a Canvas deployment can name only the platform site', async () => {
  const p = await cloudPlatform();
  expectStatus(await admin('POST', p.path(), { deploymentId: canvasDeploymentId(), siteUrl: CLOUD.siteB }), 400, 'INVALID_SITE_URL');
  const same = await admin('POST', p.path(), { deploymentId: canvasDeploymentId(), siteUrl: CLOUD.siteA });
  expectStatus(same, 201); assert.equal(same.json.siteUrl, CLOUD.siteA);
});
m1Test('M1-07.canvas.deployment-add', 'a Canvas deployment without site is active with generation zero and is logged', async () => {
  const p = await cloudPlatform(), since = Date.now(), id = canvasDeploymentId();
  const r = await admin('POST', p.path(), { deploymentId: id }); expectStatus(r, 201);
  assert.deepEqual({ ...r.json, bindingRef: undefined }, { deploymentId: id, siteUrl: CLOUD.siteA, active: true, bindingGeneration: 0, bindingRef: undefined });
  const logs = logEvents('deployment_added', since, { platform_id: p.platformId, deployment_id: id }, 'lti-service');
  assert.equal(logs.length, 1);
  expectStatus(await admin('POST', p.path(), { deploymentId: id }), 409, 'DEPLOYMENT_ALREADY_EXISTS');
});
m1Test('M1-07.canvas.deactivate-reactivate', 'switching a Canvas deployment off and on keeps generation zero', async () => {
  const p = await cloudPlatform(), since = Date.now();
  const off = await admin('PATCH', p.path(p.deploymentId), { active: false }); expectStatus(off, 200);
  assert.equal(off.json.active, false); assert.equal(off.json.bindingGeneration, 0);
  const listed = await admin('GET', `/api/platforms/${p.platformId}`); expectStatus(listed, 200);
  assert.deepEqual(listed.json.deploymentIds, []);
  assert.equal(listed.json.deployments.find((d: Json) => d.deploymentId === p.deploymentId)?.active, false);
  const on = await admin('PATCH', p.path(p.deploymentId), { active: true }); expectStatus(on, 200);
  assert.equal(on.json.active, true); assert.equal(on.json.bindingGeneration, 0);
  const updates = logEvents('deployment_updated', since, { platform_id: p.platformId, deployment_id: p.deploymentId }, 'lti-service');
  assert.deepEqual(updates.map((e) => [e.active, e.binding_generation]), [[false, 0], [true, 0]]);
});
m1Test('M1-07.canvas.patch-site-refused', 'a Canvas deployment PATCH cannot change the site', async () => {
  const p = await cloudPlatform();
  const r = await admin('PATCH', p.path(p.deploymentId), { active: true, siteUrl: CLOUD.siteA });
  expectStatus(r, 400, 'INVALID_REQUEST'); assert.ok(String(r.json.details.description).includes('siteUrl'));
});
m1Test('M1-07.canvas.platform-diff', 'PATCH deploymentIds on a Canvas platform is a diff that keeps listed rows', async () => {
  const p = await cloudPlatform(), extra = canvasDeploymentId(), added = canvasDeploymentId();
  expectStatus(await admin('POST', p.path(), { deploymentId: extra }), 201);
  const before = (await admin('GET', `/api/platforms/${p.platformId}`)).json.deployments.find((d: Json) => d.deploymentId === p.deploymentId);
  const r = await admin('PATCH', `/api/platforms/${p.platformId}`, { deploymentIds: [p.deploymentId, added] }); expectStatus(r, 200);
  const after = await admin('GET', `/api/platforms/${p.platformId}`); expectStatus(after, 200);
  assert.deepEqual([...after.json.deploymentIds].sort(), [p.deploymentId, added].sort());
  assert.deepEqual(after.json.deployments.find((d: Json) => d.deploymentId === p.deploymentId), before);
  assert.equal(after.json.deployments.some((d: Json) => d.deploymentId === extra), false);
  const fresh = after.json.deployments.find((d: Json) => d.deploymentId === added);
  assert.equal(fresh.active, true); assert.equal(fresh.bindingGeneration, 0); assert.equal(fresh.siteUrl, CLOUD.siteA);
});
m1Test('M1-07.canvas.staged-platform', 'an inactive Canvas create refuses login and launch until its conditional activation', async () => {
  const clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  const created = await admin('POST', '/api/platforms', cloudBody({ clientId, deploymentIds: [deploymentId], active: false, bindingRef: 's1' }));
  expectStatus(created, 201); assert.equal(created.json.active, false); assert.equal(created.json.bindingRef, 's1');
  const t = { provider: CLOUD.provider, clientId, deploymentId, serviceHost: 'school-a.canvas.sim.test', pageHost: 'school-a.canvas.sim.test' };
  const login = await canvasLaunch(t); refused(login.response, 'PLATFORM_NOT_ACTIVE', [403]);
  const id = created.json.id;
  expectStatus(await admin('PATCH', `/api/platforms/${id}`, { active: true, bindingRef: 's2', ifBindingRef: 'wrong' }), 409, 'BINDING_REF_MISMATCH');
  expectStatus(await admin('PATCH', `/api/platforms/${id}`, { active: true, ifBindingRef: 's1' }), 400, 'INVALID_REQUEST');
  expectStatus(await admin('PATCH', `/api/platforms/${id}`, { active: true, bindingRef: 's2', ifBindingRef: 's1' }), 200);
  const prepared = await preparedLaunch(scenarioOf(t));
  expectStatus(await admin('PATCH', `/api/platforms/${id}`, { active: false, bindingRef: 's3', ifBindingRef: 's2' }), 200);
  refused(await prepared.submit(), 'PLATFORM_NOT_ACTIVE', [403]);
  expectStatus(await admin('PATCH', `/api/platforms/${id}`, { active: true, bindingRef: 's4', ifBindingRef: 's3' }), 200);
  assert.equal((await canvasLaunch(t)).response.status, 303, 'Launch works after the conditional activation');
});
m1Test('M1-07.canvas.parallel-conditional', 'two parallel conditional activations of one Canvas platform: exactly one wins', async () => {
  const p = await canvasPlatform({ active: false, bindingRef: 'p1' });
  const both = await Promise.all(['p2', 'p3'].map((ref) => admin('PATCH', `/api/platforms/${p.platformId}`, { active: true, bindingRef: ref, ifBindingRef: 'p1' })));
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);
  assert.equal(both.find((r) => r.status === 409)!.json.details.message, 'BINDING_REF_MISMATCH');
  const winner = both.find((r) => r.status === 200)!.json.bindingRef;
  expectStatus(await admin('PATCH', `/api/platforms/${p.platformId}`, { active: false, bindingRef: 'p4', ifBindingRef: 'p1' }), 409, 'BINDING_REF_MISMATCH');
  const now = await admin('GET', `/api/platforms/${p.platformId}`); expectStatus(now, 200);
  assert.equal(now.json.active, true); assert.equal(now.json.bindingRef, winner);
});
m1Test('M1-07.canvas.conditional-delete', 'a conditional DELETE with another ref keeps the Canvas platform', async () => {
  const p = await canvasPlatform({ bindingRef: 'd1' });
  expectStatus(await admin('DELETE', `/api/platforms/${p.platformId}?ifBindingRef=wrong`), 409, 'BINDING_REF_MISMATCH');
  expectStatus(await admin('GET', `/api/platforms/${p.platformId}`), 200);
  const removed = await admin('DELETE', `/api/platforms/${p.platformId}?ifBindingRef=d1`);
  assert.ok(removed.status >= 200 && removed.status < 300, `Conditional DELETE status ${removed.status}`);
  expectStatus(await admin('GET', `/api/platforms/${p.platformId}`), 404);
});

// ---------------------------------------------------------------- AC-M1-15 Canvas connections
const CANVAS_CAPABILITIES = { dynamicRegistration: false, operatorApproval: true, webServices: false,
  courseShell: false, addDeployment: true, canvasConfiguration: true };
m1Test('M1-15.canvas.dto', 'a Canvas connection is pending, manual, has the Canvas capabilities and no grant field', async () => {
  const s = await session(), c = await canvasConnection(s);
  assert.equal(c.lms, 'canvas'); assert.equal(c.profile, CLOUD.profile); assert.equal(c.method, 'manual');
  assert.equal(c.status, 'pending'); assert.equal(c.siteUrl, CLOUD.siteA); assert.equal(c.serviceUrl, CLOUD.siteA);
  assert.equal(c.platform, null); assert.equal(c.registrationUrl ?? null, null);
  assert.deepEqual(c.capabilities, CANVAS_CAPABILITIES);
  assert.equal(Object.keys(c).some((key) => /grant/i.test(key)), false);
  assert.equal(JSON.stringify(c).toLowerCase().includes('approval code'), false);
});
m1Test('M1-15.canvas.split', 'a Canvas connection stores its page site and its service URL', async () => {
  const s = await session(), c = await canvasConnection(s, { siteUrl: CLOUD.pageA, serviceUrl: CLOUD.siteA });
  assert.equal(c.siteUrl, CLOUD.pageA); assert.equal(c.serviceUrl, CLOUD.siteA);
  const read = await app(s, 'GET', `/app-api/connections/${c.id}`); expectStatus(read, 200);
  assert.equal(read.json.siteUrl, CLOUD.pageA); assert.equal(read.json.serviceUrl, CLOUD.siteA);
});
m1Test('M1-15.canvas.default-profile', 'a Canvas connection without profile gets canvas-cloud-production', async () => {
  const s = await session();
  const r = await app(s, 'POST', '/app-api/connections', { name: unique('Canvas default'), siteUrl: CLOUD.siteA, method: 'manual', lms: 'canvas' });
  expectStatus(r, 201); assert.equal(r.json.profile, 'canvas-cloud-production'); assert.equal(r.json.lms, 'canvas');
});
for (const [variant, body, status, code, detail] of [
  ['dynamic-refused', { method: 'dynamic' }, 422, 'CAPABILITY_NOT_SUPPORTED', ['capability', 'dynamicRegistration']],
  ['profile-mismatch', { profile: 'blackboard' }, 400, 'INVALID_REQUEST', ['field', 'profile']],
  ['lms-unknown', { lms: 'other' }, 400, 'INVALID_REQUEST', ['field', 'lms']],
] as const) {
  m1Test(`M1-15.canvas.${variant}`, `Canvas connection create refuses ${variant} and stores nothing`, async () => {
    const s = await session(), before = await app(s, 'GET', '/app-api/connections');
    const r = await app(s, 'POST', '/app-api/connections', Object.assign({ name: unique('refused'), siteUrl: CLOUD.siteA,
      method: 'manual', lms: 'canvas', profile: CLOUD.profile }, body));
    expectStatus(r, status, code); assert.equal(r.json.details[detail[0]], detail[1]);
    assert.deepEqual((await app(s, 'GET', '/app-api/connections')).json, before.json);
  });
}
m1Test('M1-15.canvas.lms-providers', 'lms-providers lists the Canvas methods, capabilities and profiles with the simulation last', async () => {
  const s = await session(), r = await app(s, 'GET', '/app-api/lms-providers'); expectStatus(r, 200);
  assert.deepEqual(r.json.lms.map((l: Json) => l.lms), ['moodle', 'canvas', 'blackboard']);
  const canvas = r.json.lms.find((l: Json) => l.lms === 'canvas');
  assert.deepEqual(canvas.methods, ['manual']);
  assert.deepEqual(canvas.capabilities, CANVAS_CAPABILITIES);
  assert.deepEqual(canvas.profiles.map((p: Json) => [p.id, p.simulation, p.ready, p.clientId]), [
    ['canvas-cloud-production', false, true, null], ['canvas-cloud-beta', false, true, null],
    ['canvas-cloud-test', false, true, null], ['canvas-self-hosted', false, true, null], [CLOUD.profile, true, true, null],
  ]);
  for (const p of canvas.profiles) assert.equal(typeof p.label, 'string');
  assert.match(canvas.profiles.at(-1).label, / \(simulation\)$/);
});
