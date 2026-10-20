import {
  admin, app, assert, cli, createConnection, deploymentPath, expectStatus, idToken, launch,
  m1Test, remote, service, session, sharedPlatform, unique, urls, logEvents,
} from '../common/client';

const siteA = 'https://learn-a.blackboard.sim.test';
const siteB = 'https://learn-b.blackboard.sim.test';

m1Test('M1-04.blackboard.fixed-endpoints', 'Blackboard endpoint template and forbidden overrides', async () => {
  const id = await sharedPlatform();
  const p = await admin('GET', '/api/platforms/' + id); expectStatus(p, 200);
  assert.equal(p.json.authConfig.key, 'https://developer.blackboard.sim.test/api/v1/management/applications/qa-bb-app/jwks.json');
  for (const field of ['siteUrl', 'serviceUrl']) {
    expectStatus(await admin('POST', '/api/platforms', {
      profile: 'blackboard-sim', clientId: unique('client'), name: 'Invalid field', [field]: siteA,
    }), 400, 'INVALID_REQUEST');
  }
});

m1Test('M1-06.blackboard.singleton', 'one shared platform and protected platform mutations', async () => {
  const id = await sharedPlatform();
  expectStatus(await admin('POST', '/api/platforms', { profile: 'blackboard-sim', clientId: 'other', name: 'Other' }), 409, 'SHARED_PLATFORM_EXISTS');
  expectStatus(await admin('POST', '/api/platforms', { profile: 'blackboard-sim', clientId: 'other', name: 'Other', deploymentIds: ['x'] }), 400, 'INVALID_REQUEST');
  expectStatus(await admin('PATCH', '/api/platforms/' + id, { deploymentIds: ['x'] }), 409, 'SHARED_PLATFORM_DEPLOYMENTS');
  expectStatus(await admin('POST', deploymentPath(id), { deploymentId: unique('protect'), siteUrl: siteA }), 201);
  expectStatus(await admin('DELETE', '/api/platforms/' + id), 409, 'SHARED_PLATFORM_IN_USE');
  expectStatus(await admin('GET', '/api/platforms/' + id), 200);
});
m1Test('M1-06.blackboard.cli', 'shared-platform CLI repeats exactly and refuses another client', async () => {
  const id = await sharedPlatform();
  const args = ['--account', 'cogniate', '--profile', 'blackboard-sim', '--client-id', 'qa-bb-app'];
  const first = await cli('lti:shared-platform', args);
  assert.equal(first.code, 0); assert.ok(first.stdout.includes(id));
  const second = await cli('lti:shared-platform', [...args.slice(0, -1), 'other']);
  assert.equal(second.code, 1);
  assert.equal((await admin('GET', '/api/platforms/' + id)).json.clientId, 'qa-bb-app');
});

const invalidSites: [string, string, number][] = [
  ['http', 'http://learn-a.blackboard.sim.test', 1],
  ['path', siteA + '/learn', 1], ['query', siteA + '/?x=1', 1], ['fragment', siteA + '/#f', 1],
  ['userinfo', 'https://u:p@learn-a.blackboard.sim.test', 1], ['ipv4', 'https://10.20.30.40', 2],
  ['ipv6', 'https://[::1]', 2], ['localhost', 'https://localhost', 2], ['localhost-subdomain', 'https://a.localhost', 2],
  ['tool', urls.lti, 3], ['app', urls.app, 3], ['content', urls.content, 3],
  ['fixed-host', 'https://developer.blackboard.sim.test', 4], ['fixed-host-port', 'https://developer.blackboard.sim.test:8443', 4],
];
for (const [name, siteUrl, rule] of invalidSites) {
  m1Test(`M1-05.blackboard.${name}`, `both APIs reject invalid Blackboard site: ${name}`, async () => {
    const id = await sharedPlatform(), s = await session();
    const since = Date.now(), rejectedHost = new URL(siteUrl).hostname;
    const deploy = await admin('POST', deploymentPath(id), { deploymentId: unique('badsite'), siteUrl });
    expectStatus(deploy, 400, 'INVALID_SITE_URL');
    const connection = await app(s, 'POST', '/app-api/connections', { name: unique('badsite'),
      lms: 'blackboard', profile: 'blackboard-sim', method: 'manual', siteUrl });
    expectStatus(connection, 422, 'INVALID_SITE_URL');
    assert.equal(connection.json.details.rule, rule);
    assert.equal(connection.json.details.field, 'siteUrl');
    for (const serviceName of ['lti-service', 'cogniate-app']) for (const event of ['outbound_request', 'outbound_blocked']) {
      assert.equal(logEvents(event, since, { host: rejectedHost }, serviceName).length, 0);
    }
  });
}
m1Test('M1-05.blackboard.canonical', 'both services canonicalize the Blackboard site origin', async () => {
  const id = await sharedPlatform(), s = await session(), deploymentId = unique('canonical');
  const siteUrl = 'HTTPS://Learn-A.Blackboard.Sim.Test:443/';
  const d = await admin('POST', deploymentPath(id), { deploymentId, siteUrl }); expectStatus(d, 201);
  assert.equal(d.json.siteUrl, siteA);
  const c = await createConnection(s, { siteUrl }); assert.equal(c.siteUrl, siteA);
});

m1Test('M1-07.blackboard.crud', 'shared deployment active state, generation and site changes', async () => {
  const id = await sharedPlatform(), deploymentId = unique('crud');
  const url = deploymentPath(id, deploymentId);
  const created = await admin('POST', deploymentPath(id), { deploymentId, siteUrl: siteA }); expectStatus(created, 201);
  assert.equal(created.json.bindingGeneration, 1); assert.equal(created.json.active, true);
  expectStatus(await admin('POST', deploymentPath(id), { deploymentId, siteUrl: siteA }), 409, 'DEPLOYMENT_ALREADY_EXISTS');
  const off = await admin('PATCH', url, { active: false }); expectStatus(off, 200); assert.equal(off.json.bindingGeneration, 1);
  const p = await admin('GET', '/api/platforms/' + id); assert.equal(p.json.deploymentIds.includes(deploymentId), false);
  const on = await admin('PATCH', url, { active: true, siteUrl: siteB }); expectStatus(on, 200);
  assert.equal(on.json.bindingGeneration, 2); assert.equal(on.json.siteUrl, siteB);
  expectStatus(await admin('PATCH', url, { siteUrl: siteA }), 400, 'INVALID_REQUEST');
  expectStatus(await admin('PATCH', deploymentPath(id, unique('unknown')), { active: true }), 404, 'UNKNOWN_DEPLOYMENT');
});
m1Test('M1-07.blackboard.alphabet', 'encoded deployment ids round-trip and spaces never store', async () => {
  const id = await sharedPlatform(), deploymentId = unique('a') + '/b:c';
  expectStatus(await admin('POST', deploymentPath(id), { deploymentId, siteUrl: siteA }), 201);
  expectStatus(await admin('PATCH', deploymentPath(id, deploymentId), { active: false }), 200);
  assert.equal((await remote(id, deploymentId))?.deploymentId, deploymentId);
  const invalid = unique('a') + '/b c';
  const response = await admin('POST', deploymentPath(id), { deploymentId: invalid, siteUrl: siteA });
  expectStatus(response, 400, 'INVALID_REQUEST'); assert.equal(response.json.details.field, 'deploymentId');
  assert.equal(await remote(id, invalid), undefined);
});
m1Test('M1-07.blackboard.fencing', 'binding refs rotate atomically and compare only the current ref', async () => {
  const id = await sharedPlatform(), deploymentId = unique('fence'), url = deploymentPath(id, deploymentId);
  expectStatus(await admin('POST', deploymentPath(id), { deploymentId, siteUrl: siteA, bindingRef: 'r1' }), 201);
  expectStatus(await admin('PATCH', url, { active: false, bindingRef: 'r1b', ifBindingRef: 'r0' }), 409, 'BINDING_REF_MISMATCH');
  for (const patch of [{ active: false, ifBindingRef: 'r1' }, { active: false, bindingRef: 'r1', ifBindingRef: 'r1' }]) {
    const r = await admin('PATCH', url, patch); expectStatus(r, 400, 'INVALID_REQUEST');
    assert.equal(r.json.details.field, 'bindingRef'); assert.equal((await remote(id, deploymentId))?.bindingRef, 'r1');
  }
  expectStatus(await admin('PATCH', url, { active: false, bindingRef: 'r1b', ifBindingRef: 'r1' }), 200);
  const parallel = await Promise.all(['r2', 'r3'].map((bindingRef) => admin('PATCH', url, { active: true, bindingRef, ifBindingRef: 'r1b' })));
  assert.deepEqual(parallel.map((r) => r.status).sort(), [200, 409]);
  expectStatus(await admin('PATCH', url, { active: false, bindingRef: 'r4', ifBindingRef: 'r1b' }), 409, 'BINDING_REF_MISMATCH');
});
m1Test('M1-07.blackboard.staging-generation', 'staged deployment activates once and adoption invalidates old credentials', async () => {
  const id = await sharedPlatform(), deploymentId = unique('staged'), url = deploymentPath(id, deploymentId);
  const created = await admin('POST', deploymentPath(id), { deploymentId, siteUrl: siteA, active: false, bindingRef: 's1' });
  expectStatus(created, 201); assert.equal(created.json.bindingGeneration, 0);
  const denied = await launch({ deploymentId }); assert.ok(denied.response.body.includes('DEPLOYMENT_NOT_ACTIVE'));
  const activated = await admin('PATCH', url, { active: true, bindingRef: 's2', ifBindingRef: 's1' });
  expectStatus(activated, 200); assert.equal(activated.json.bindingGeneration, 1);
  const first = await launch({ deploymentId }); assert.equal(first.response.status, 303);
  const token = await idToken(first.ltik); expectStatus(token, 200);
  const adopted = await admin('PATCH', url, { active: true, siteUrl: siteA, bindingRef: 's3', ifBindingRef: 's2' });
  expectStatus(adopted, 200); assert.equal(adopted.json.bindingGeneration, 2);
  expectStatus(await idToken(first.ltik), 401, 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
  expectStatus(await service(token.json.services.serviceKey, 'GET', '/api/lineitems'), 401, 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  const same = await admin('PATCH', url, { active: true }); expectStatus(same, 200); assert.equal(same.json.bindingGeneration, 2);
  const off = await admin('PATCH', url, { active: false, bindingRef: 's4', ifBindingRef: 's3' });
  expectStatus(off, 200); assert.equal(off.json.bindingGeneration, 2);
});
