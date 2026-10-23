import {
  APP, app, assert, bound, cli, connPath, createConnection, expectStatus, gateEvents, gateReset,
  httpsRequest, issueGrant, logEvents, m1Test, noServiceCalls, pause, records,
  redeem, remote, session, sharedPlatform, unique, urls,
} from '../common/client';
import { createCourse, uploadVersion } from '../../lib/app';
import { fixtureZip } from '../common/course';
import { watchAll } from '../common/snapshot';

async function pending(library: 'A' | 'B' = 'A', siteUrl = 'https://learn-a.blackboard.sim.test') {
  const platformId = await sharedPlatform(), s = await session(library), connection = await createConnection(s, { siteUrl });
  const deploymentId = unique('grant');
  return { s, connection, platformId, deploymentId };
}
async function noMutation(p: Awaited<ReturnType<typeof pending>>, run: () => Promise<void>) {
  const before = await remote(p.platformId, p.deploymentId);
  const cursor = (await records()).cursor;
  await gateReset(); const seq = await watchAll();
  try { await run(); assert.deepEqual(await remote(p.platformId, p.deploymentId), before); await noServiceCalls(cursor);
    assert.equal((await gateEvents(seq)).length, 0, 'Grant rejection makes no LTI call');
  } finally { await gateReset(); }
}
async function state(grant: { id: string; code: string }, connectionId: string, expected: string) {
  const list = await cli('app:grant', ['list', '--connection', connectionId]); assert.equal(list.code, 0);
  assert.equal(list.stdout.includes(grant.code), false);
  const line = list.stdout.split('\n').find((s) => s.includes(grant.id));
  assert.ok(line, 'Grant listed'); assert.match(line, new RegExp(`\\b${expected}\\b`));
}

m1Test('M1-28.blackboard.positive', 'operator approval binds one deployment and consumes one grant', async () => {
  const p = await pending(), since = Date.now(), issued = await issueGrant(p.s, p.connection, p.deploymentId);
  assert.match(issued.code, /^[A-Za-z0-9_-]{43}$/);
  for (const value of [p.s.library.name, p.connection.name, p.connection.siteUrl, p.deploymentId, 'qa-bb-app']) assert.ok(issued.stdout.includes(value));
  const expiry = issued.stdout.match(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g)?.map(Date.parse).find((n) => n > since + 23 * 3600_000);
  assert.ok(expiry && expiry < Date.now() + 25 * 3600_000, 'Default expiry is about 24 hours');
  await state(issued, p.connection.id, 'issued');
  const response = await redeem(p.s, p.connection, p.deploymentId, issued); expectStatus(response, 200);
  assert.equal(response.json.status, 'registered'); assert.deepEqual(response.json.platform.deploymentIds, [p.deploymentId]);
  assert.equal(JSON.stringify(response.json).includes(issued.code), false);
  const row = await remote(p.platformId, p.deploymentId); assert.equal(row?.active, true);
  assert.equal(row?.bindingGeneration, 1); assert.equal(row?.siteUrl, p.connection.siteUrl);
  assert.equal(logEvents('grant_redeemed', since, { grant_id: issued.id }).length, 1);
  await state(issued, p.connection.id, 'redeemed');
  expectStatus(await redeem(p.s, p.connection, p.deploymentId, issued), 200);
  assert.equal(logEvents('grant_redeemed', since, { grant_id: issued.id }).length, 1);
});
m1Test('M1-28.blackboard.replacement', 'new approval revokes the older unredeemed grant', async () => {
  const p = await pending(), first = await issueGrant(p.s, p.connection, p.deploymentId);
  const second = await issueGrant(p.s, p.connection, p.deploymentId);
  assert.notEqual(first.code, second.code); await state(first, p.connection.id, 'revoked'); await state(second, p.connection.id, 'issued');
});
m1Test('M1-29.blackboard.b', 'first-claim squatting fails without a code and with another library code', async () => {
  const a = await pending(), b = await pending('B'), grant = await issueGrant(a.s, a.connection, a.deploymentId);
  await noMutation(a, async () => {
    expectStatus(await redeem(b.s, b.connection, a.deploymentId), 422, 'INVALID_PLATFORM_VALUES');
    expectStatus(await redeem(b.s, b.connection, a.deploymentId, grant), 403, 'GRANT_INVALID');
  });
  await state(grant, a.connection.id, 'issued');
});
m1Test('M1-29.blackboard.c', 'cross-library grant redemption is refused before any remote call', async () => {
  const a = await pending(), b = await pending('B'), grant = await issueGrant(b.s, b.connection, a.deploymentId);
  const since = Date.now();
  await noMutation(a, async () => expectStatus(await redeem(a.s, a.connection, a.deploymentId, grant), 403, 'GRANT_INVALID'));
  await state(grant, b.connection.id, 'issued');
  assert.equal(logEvents('grant_rejected', since, { reason: 'other_library' }).length, 1);
});
m1Test('M1-29.blackboard.d', 'a grant belongs to exactly one connection within its library', async () => {
  const a = await pending(), other = await createConnection(a.s), grant = await issueGrant(a.s, a.connection, a.deploymentId);
  const since = Date.now();
  await noMutation(a, async () => expectStatus(await redeem(a.s, other, a.deploymentId, grant), 403, 'GRANT_INVALID'));
  await state(grant, a.connection.id, 'issued');
  assert.equal(logEvents('grant_rejected', since, { reason: 'other_connection' }).length, 1);
});
m1Test('M1-29.blackboard.e', 'mismatched deployment leaves the valid grant usable', async () => {
  const p = await pending(), grant = await issueGrant(p.s, p.connection, p.deploymentId), since = Date.now();
  await noMutation(p, async () => {
    const response = await redeem(p.s, p.connection, unique('wrong'), grant);
    expectStatus(response, 422, 'GRANT_MISMATCH'); assert.deepEqual(response.json.details.fields, ['deploymentId']);
  });
  await state(grant, p.connection.id, 'issued');
  assert.equal(logEvents('grant_rejected', since, { reason: 'mismatch' }).length, 1);
  expectStatus(await redeem(p.s, p.connection, p.deploymentId, grant), 200);
});
m1Test('M1-29.blackboard.f', 'redeemed grant cannot bind a new connection', async () => {
  const b = await bound(), other = await createConnection(b.s), since = Date.now();
  expectStatus(await redeem(b.s, other, b.deploymentId, b.grant), 403, 'GRANT_INVALID');
  assert.equal(logEvents('grant_rejected', since, { reason: 'redeemed' }).length, 1);
});
m1Test('M1-29.blackboard.g', '60-second grant expires using real wall time', async () => {
  const p = await pending(), grant = await issueGrant(p.s, p.connection, p.deploymentId, { 'ttl-seconds': '60' });
  await pause(63_000);
  const since = Date.now();
  await noMutation(p, async () => expectStatus(await redeem(p.s, p.connection, p.deploymentId, grant), 403, 'GRANT_INVALID'));
  await state(grant, p.connection.id, 'expired');
  assert.equal(logEvents('grant_rejected', since, { reason: 'expired' }).length, 1);
});
m1Test('M1-29.blackboard.h', 'revoked grant cannot authorize a deployment', async () => {
  const p = await pending(), grant = await issueGrant(p.s, p.connection, p.deploymentId);
  assert.equal((await cli('app:grant', ['revoke', '--grant', grant.id])).code, 0);
  const since = Date.now();
  await noMutation(p, async () => expectStatus(await redeem(p.s, p.connection, p.deploymentId, grant), 403, 'GRANT_INVALID'));
  await state(grant, p.connection.id, 'revoked');
  assert.equal(logEvents('grant_rejected', since, { reason: 'revoked' }).length, 1);
});
m1Test('M1-29.blackboard.j', 'valid approval cannot steal another library deployment', async () => {
  const b = await bound('B', 'https://learn-b.blackboard.sim.test'), p = await pending('A', b.connection.siteUrl);
  const grant = await issueGrant(p.s, p.connection, b.deploymentId);
  const before = await remote(b.platformId, b.deploymentId);
  expectStatus(await redeem(p.s, p.connection, b.deploymentId, grant), 409, 'DEPLOYMENT_IN_USE');
  assert.deepEqual(await remote(b.platformId, b.deploymentId), before); await state(grant, p.connection.id, 'issued');
});
for (const [variant, field, value] of [
  ['library', 'library', 'lib_does-not-exist'], ['site', 'site', 'https://learn-b.blackboard.sim.test'],
  ['client', 'client-id', 'other-application'], ['ttl', 'ttl-seconds', '30'],
] as const) {
  m1Test(`M1-29.blackboard.k-${variant}`, `grant CLI refuses ${variant} without storing a grant`, async () => {
    const p = await pending();
    const before = await cli('app:grant', ['list', '--connection', p.connection.id]);
    const values = { library: p.s.library.id, connection: p.connection.id, site: p.connection.siteUrl,
      'client-id': 'qa-bb-app', 'deployment-id': p.deploymentId, note: 'M1 negative', [field]: value };
    const response = await cli('app:grant', ['issue', ...Object.entries(values).flatMap(([k, v]) => ['--' + k, v])]);
    assert.equal(response.code, 1);
    assert.equal((await cli('app:grant', ['list', '--connection', p.connection.id])).stdout, before.stdout);
  });
}
m1Test('M1-29.blackboard.k-registered', 'initial grant for a registered connection is refused', async () => {
  const b = await bound();
  const response = await cli('app:grant', ['issue', '--library', b.s.library.id, '--connection', b.connection.id,
    '--site', b.connection.siteUrl, '--client-id', 'qa-bb-app', '--deployment-id', b.deploymentId, '--note', 'M1 negative']);
  assert.equal(response.code, 1);
});
for (const [variant, method, suffix] of [['get', 'GET', ''], ['put', 'PUT', '/platform'], ['deployment', 'POST', '/deployments'], ['delete', 'DELETE', '']] as const) {
  m1Test(`M1-29.blackboard.l-${variant}`, `other library sees 404 on connection ${method} ${suffix}`, async () => {
    const p = await pending(), foreign = await session('B');
    expectStatus(await app(foreign, method, connPath(p.connection.id) + suffix,
      method === 'PUT' || method === 'POST' ? { deploymentId: p.deploymentId, grantCode: 'a'.repeat(43) } : undefined), 404, 'NOT_FOUND');
  });
}

m1Test('M1-19.blackboard.configuration', 'Blackboard export contains exactly nine ordered rows and values', async () => {
  const p = await pending(), response = await app(p.s, 'GET', connPath(p.connection.id) + '/tool-configuration');
  expectStatus(response, 200);
  const expected = [
    ['client_id', 'Client ID', 'qa-bb-app'],
    ['login_initiation_url', 'Login Initiation URL', urls.lti + '/lti/login/cogniate'],
    ['tool_redirect_url', 'Tool Redirect URL(s)', urls.lti + '/lti/launch/cogniate'],
    ['tool_jwks_url', 'Tool JWKS URL', urls.lti + '/lti/keys/cogniate'],
    ['tool_status', 'Tool Status', 'Approved'],
    ['user_fields', 'User Fields to Send', 'Role in Course only. Do not send Name or Email Address.'],
    ['grade_service', 'Allow grade service access', 'Yes'],
    ['membership_service', 'Allow Membership Service access', 'Yes'],
    ['placement', 'Placement', `Cogniate: type Deep Linking, Target Link URI ${urls.lti}/lti/launch/cogniate, student access off`],
  ].map(([key, label, value]) => ({ key, label, value }));
  assert.deepEqual(response.json, expected);
  expectStatus(await app(p.s, 'GET', connPath(p.connection.id) + '/canvas-configuration'), 409, 'CAPABILITY_NOT_SUPPORTED');
});
m1Test('M1-21.blackboard.capabilities', 'Moodle-only operations are refused without remote calls or publication writes', async () => {
  const p = await pending();
  await noMutation(p, async () => {
    expectStatus(await app(p.s, 'PUT', connPath(p.connection.id) + '/web-services', { token: 'test-token' }), 409, 'CAPABILITY_NOT_SUPPORTED');
    expectStatus(await app(p.s, 'POST', connPath(p.connection.id) + '/registration-url'), 409, 'CONNECTION_NOT_PENDING');
    expectStatus(await app(p.s, 'POST', connPath(p.connection.id) + '/deployments', { deploymentId: 'other', grantCode: 'x'.repeat(43) }), 409, 'CAPABILITY_NOT_SUPPORTED');
  });
  // App contract §11: createMoodleCourse is an object ({ categoryId? }). A bound connection and a course with a
  // ready version leave the capability guard as the only reason to refuse. The fixture is ready before the cursor.
  const b = await bound(), course = await createCourse(b.s, unique('M1 shell'));
  expectStatus(await uploadVersion(b.s, course.id, fixtureZip('scorm12')), 201);
  await noMutation(b, async () => {
    const before = await app(b.s, 'GET', '/app-api/publications');
    const response = await app(b.s, 'POST', '/app-api/publications', { connectionId: b.connection.id, courseId: course.id, createMoodleCourse: {} });
    expectStatus(response, 409, 'CAPABILITY_NOT_SUPPORTED'); assert.equal(response.json.details.capability, 'courseShell');
    assert.deepEqual((await app(b.s, 'GET', '/app-api/publications')).json, before.json);
  });
});
m1Test('M1-31.blackboard.portal-routes', 'Blackboard routes require sign-in and use portal security headers', async () => {
  const p = await pending();
  for (const route of ['/integrations/blackboard/connect', '/integrations/blackboard/' + p.connection.id]) {
    const signedIn = await httpsRequest(APP + route, { headers: { cookie: p.s.cookie } }); expectStatus(signedIn, 200);
    assert.match(signedIn.body, /<html/i); assert.ok(signedIn.headers['content-security-policy']);
    assert.equal(signedIn.headers['x-content-type-options'], 'nosniff');
    const signedOut = await httpsRequest(APP + route);
    assert.ok([302, 303].includes(signedOut.status)); assert.equal(new URL(String(signedOut.headers.location), APP).pathname, '/signin');
  }
  const unknown = await httpsRequest(APP + '/integrations/other/connect', { headers: { cookie: p.s.cookie } });
  assert.equal(unknown.status, 404);
});
m1Test('M1-29.blackboard.m', 'the negative grant matrix emits every exact rejection reason', async () => {
  const reasons = new Set(logEvents('grant_rejected', 0).map((e) => e.reason));
  for (const reason of ['other_library', 'other_connection', 'mismatch', 'redeemed', 'expired', 'revoked']) {
    assert.ok(reasons.has(reason), 'Missing precise grant reason ' + reason);
  }
});
