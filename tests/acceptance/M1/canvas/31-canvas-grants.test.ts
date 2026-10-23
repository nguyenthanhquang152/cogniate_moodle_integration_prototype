// Canvas registration, configuration documents, added deployments, capability guards, grant negatives and
// portal routes: AC-M1-17, -19, -20, -21, -29, -31 (Canvas parts).
import { createCourse } from '../../lib/app';
import { readLog } from '../../lib/logs';
import { completed, refusedWithoutAttempt, redeemedWithOneAttempt } from '../common/snapshot';
export { completed, refusedWithoutAttempt, redeemedWithOneAttempt } from '../common/snapshot';
import {
  APP, app, assert, cli, connPath, createConnection, expectStatus, httpsRequest, idToken, logEvents, m1Test,
  parseForm, pause, service, session, sharedPlatform, unique, urls, type Json,
} from '../common/client';
import { pick, publication } from '../common/course';
import {
  CLOUD, PATHS, addDeployment, addGrant, canvasBound, canvasClientId, canvasConnection, canvasDeploymentId, canvasGrant,
  canvasLaunch, canvasPicker, canvasPlay, canvasRedeem, connectionOf, grantState, jwtHeader, noRemoteCall, platformsFor, refused,
  verifyToolJwt,
} from './canvas';

async function pendingCanvas(library: 'A' | 'B' = 'A', patch: Json = {}) {
  const s = await session(library), connection = await canvasConnection(s, patch);
  return { s, connection, clientId: canvasClientId(), deploymentId: canvasDeploymentId() };
}
type Pending = Awaited<ReturnType<typeof pendingCanvas>>;
const redeemP = (p: Pending, grant?: { code: string }, extra: Json = {}, connection = p.connection, values = p) =>
  canvasRedeem(p.s, connection, values.clientId, values.deploymentId, grant, extra);
async function unchanged(p: Pending, body: () => Promise<void>) {
  const before = await connectionOf(p);
  await noRemoteCall(body);
  assert.deepEqual(await connectionOf(p), before, 'Connection unchanged');
  assert.deepEqual(await platformsFor(p.clientId), [], 'No LTI platform for these values');
}
const rejected = (since: number, reason: string, connectionId?: string) =>
  logEvents('grant_rejected', since, connectionId ? { reason, connection_id: connectionId } : { reason });

// AC-M1-20 no-attempt subclaim (C-2, C-3) through the accepted audit oracle (docs/architecture/review-response-M1.md, D
// revision 3, R3.7): `grant_attempt_started {connection_id, grant_id, attempt_id}` is written after a committed phase 1,
// in first-in, first-out order before the same request's `http_request` line. Bounded use: one healthy process, complete
// capture of cogniate-app.jsonl, no claim across a crash or restart, and an absent line is no database or rollback proof.
// The connection DTO and a later successful redemption are not used as evidence of "no attempt".
export function attemptLines(connectionId: string) {
  const log = readLog('cogniate-app');
  assert.deepEqual(log.badLines, [], 'BLOCKED: incomplete capture of cogniate-app.jsonl');
  return log.entries.filter((e) => e.entry.event === 'grant_attempt_started' && e.entry.connection_id === connectionId)
    .map((e) => ({ line: e.line, ...e.entry }) as Json);
}
/** `grant_redeemed` lines of one connection, with the same capture guard. Counted after a same-trace completion barrier. */
export function redeemedLines(connectionId: string) {
  const log = readLog('cogniate-app');
  assert.deepEqual(log.badLines, [], 'BLOCKED: incomplete capture of cogniate-app.jsonl');
  return log.entries.filter((e) => e.entry.event === 'grant_redeemed' && e.entry.connection_id === connectionId)
    .map((e) => ({ line: e.line, ...e.entry }) as Json);
}
/** Baseline after a completed request of this test, so every earlier line of the connection is already captured. */
async function attemptBaseline(s: any, connectionId: string) {
  await completed(await app(s, 'GET', connPath(connectionId)), 'GET');
  return attemptLines(connectionId).length;
}

// ---------------------------------------------------------------- AC-M1-17 registration through the app
m1Test('M1-17.canvas.register', 'a matching grant registers the Canvas connection once', async () => {
  const p = await pendingCanvas(), since = Date.now(), grant = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId);
  await grantState(grant, p.connection.id, 'issued');
  const r = await redeemP(p, grant); expectStatus(r, 200);
  assert.equal(r.json.status, 'registered');
  assert.equal(r.json.platform.issuer, CLOUD.issuer);
  assert.equal(r.json.platform.clientId, p.clientId);
  assert.equal(r.json.platform.siteUrl, CLOUD.siteA); assert.equal(r.json.platform.serviceUrl, CLOUD.siteA);
  assert.deepEqual(r.json.platform.deploymentIds, [p.deploymentId]);
  assert.equal(JSON.stringify(r.json).includes(grant.code), false, 'DTO never contains the approval code');
  assert.equal(logEvents('grant_redeemed', since, { grant_id: grant.id }).length, 1);
  await grantState(grant, p.connection.id, 'redeemed');
  const remote = await platformsFor(p.clientId, CLOUD.issuer);
  assert.equal(remote.length, 1); assert.equal(remote[0].active, true); assert.equal(remote[0].profile, CLOUD.profile);
});
for (const [variant, extra, fields] of [
  ['strict-missing-code', null, ['grantCode']],
  ['strict-jwks-url', { jwksUrl: CLOUD.jwks }, ['jwksUrl']],
  ['strict-client-secret', { clientSecret: 'not-a-secret' }, ['clientSecret']],
  ['strict-issuer', { issuer: CLOUD.issuer }, ['issuer']],
] as const) {
  m1Test(`M1-17.canvas.${variant}`, `the strict Canvas body refuses ${fields[0]} and changes nothing`, async () => {
    const p = await pendingCanvas(), grant = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId);
    await unchanged(p, async () => {
      const r = extra === null ? await redeemP(p) : await redeemP(p, grant, extra);
      expectStatus(r, 422, 'INVALID_PLATFORM_VALUES'); assert.deepEqual(r.json.details.fields, fields);
    });
    await grantState(grant, p.connection.id, 'issued');
  });
}
m1Test('M1-17.canvas.repeat', 'repeating the registering call answers 200 with the same platform and no new redemption', async () => {
  const b = await canvasBound();
  // Line counts, not a time window: the first redemption's lines come before its own http_request line (R3.7), so after
  // a completed later request of this test they are already counted. A millisecond timestamp cannot separate them.
  await completed(await app(b.s, 'GET', connPath(b.connection.id)), 'GET');
  const first = redeemedLines(b.connection.id);
  assert.deepEqual(first.map((e) => e.grant_id), [b.grant.id], 'The first call wrote one grant_redeemed line, for its grant');
  await noRemoteCall(async () => {
    const again = await canvasRedeem(b.s, b.connection, b.clientId, b.deploymentId, b.grant); expectStatus(again, 200);
    assert.equal(again.json.platform.id, b.connection.platform.id);
    await completed(again, 'PUT');
  });
  assert.equal(redeemedLines(b.connection.id).length, first.length, 'No new grant_redeemed line from the repeat');
});
m1Test('M1-17.canvas.other-library-conflict', 'another library cannot bind a Canvas client id that a connection owns', async () => {
  const a = await canvasBound(), b = await pendingCanvas('B');
  const grant = await canvasGrant(b.s, b.connection, a.clientId, a.deploymentId);
  const r = await canvasRedeem(b.s, b.connection, a.clientId, a.deploymentId, grant);
  expectStatus(r, 409, 'PLATFORM_IN_USE');
  await grantState(grant, b.connection.id, 'issued');
  assert.equal((await connectionOf(b)).status, 'pending');
  assert.equal((await canvasLaunch(a)).response.status, 303, 'The owner keeps working');
});

// ---------------------------------------------------------------- AC-M1-19 configuration documents
const SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
];
export function expectedCanvasJson(libraryName: string, domain: string, key?: Json) {
  return {
    title: `Cogniate (${libraryName})`,
    description: 'Cogniate courses (SCORM 1.2 and HTML) with grade return.',
    oidc_initiation_url: `${urls.lti}/lti/login/cogniate`,
    target_link_uri: `${urls.lti}/lti/launch/cogniate`,
    scopes: SCOPES,
    extensions: [{ domain, tool_id: 'cogniate', platform: 'canvas.instructure.com', privacy_level: 'anonymous',
      settings: { text: 'Cogniate', placements: [{ placement: 'assignment_selection', message_type: 'LtiDeepLinkingRequest',
        target_link_uri: `${urls.lti}/lti/launch/cogniate`, text: 'Cogniate' }] } }],
    ...(key ? { public_jwk: key } : { public_jwk_url: `${urls.lti}/lti/keys/cogniate` }),
    custom_fields: {},
  };
}
// C-1 (docs/architecture/review-response-M1.md, app contract §4.6): `domain` is the URL host of PUBLIC_LTI_URL: the
// lower-case host name, plus ":<port>" only when the port is not 443. Computed here independently of the product.
function expectedDomain(publicLtiUrl = urls.lti) {
  const url = new URL(publicLtiUrl);
  const port = url.port && url.port !== '443' ? `:${url.port}` : '';
  return url.hostname.toLowerCase() + port;
}
function domainOf(document: Json) {
  const expected = expectedDomain(), domain = document?.extensions?.[0]?.domain;
  assert.equal(domain, expected, 'Extension domain is the exact URL host of PUBLIC_LTI_URL');
  const port = new URL(urls.lti).port;
  if (port && port !== '443') assert.notEqual(domain, new URL(urls.lti).hostname, 'A bare host name is refused at a non-443 port');
  return expected;
}
function configurationHeaders(response: { headers: Json }) {
  assert.equal(String(response.headers['content-type']).toLowerCase().replace(/\s/g, ''), 'application/json;charset=utf-8');
  assert.equal(response.headers['content-disposition'], 'attachment; filename="cogniate-canvas-lti.json"');
  assert.equal(response.headers['cache-control'], 'no-store');
}
m1Test('M1-19.canvas.json', 'a pending Canvas connection exports exactly the contract JSON with its headers', async () => {
  const p = await pendingCanvas();
  const r = await app(p.s, 'GET', connPath(p.connection.id) + '/canvas-configuration'); expectStatus(r, 200);
  configurationHeaders(r);
  assert.deepEqual(r.json, expectedCanvasJson(p.s.library.name, domainOf(r.json)));
  assert.equal(r.headers['x-cogniate-key-id'], undefined);
  assert.equal(JSON.stringify(r.json).includes('link_selection'), false);
  const again = await app(p.s, 'GET', connPath(p.connection.id) + '/canvas-configuration?jwk=url'); expectStatus(again, 200);
  assert.deepEqual(again.json, r.json);
});
m1Test('M1-19.canvas.inline-key', 'the inline export is a public snapshot of the active signing key', async () => {
  const b = await canvasBound();
  const url = await app(b.s, 'GET', connPath(b.connection.id) + '/canvas-configuration'); expectStatus(url, 200);
  const r = await app(b.s, 'GET', connPath(b.connection.id) + '/canvas-configuration?jwk=inline'); expectStatus(r, 200);
  configurationHeaders(r);
  const key = r.json.public_jwk;
  assert.deepEqual(Object.keys(key).sort(), ['alg', 'e', 'kid', 'kty', 'n', 'use'], 'Public members only');
  assert.deepEqual([key.kty, key.alg, key.use], ['RSA', 'RS256', 'sig']);
  assert.equal(r.headers['x-cogniate-key-id'], key.kid);
  assert.deepEqual(r.json, expectedCanvasJson(b.s.library.name, domainOf(r.json), key));
  const jwks = await httpsRequest(`${urls.lti}/lti/keys/cogniate`); expectStatus(jwks, 200);
  const published = JSON.parse(jwks.body).keys.find((k: Json) => k.kid === key.kid);
  assert.ok(published, 'Snapshot kid is published'); assert.equal(published.n, key.n); assert.equal(published.e, key.e);
  // Active key: a Deep Linking response signed now uses this kid and verifies with the snapshot alone.
  const pub = await publication(b, 'html'), picker = await canvasPicker(b);
  const selected = await pick(picker.url, pub.id); expectStatus(selected, 200);
  const jwt = parseForm(selected.body).fields.JWT;
  assert.equal(jwtHeader(jwt).kid, key.kid);
  await verifyToolJwt(jwt, key);
});
m1Test('M1-19.canvas.jwk-other', 'an unknown jwk mode is refused', async () => {
  const p = await pendingCanvas();
  expectStatus(await app(p.s, 'GET', connPath(p.connection.id) + '/canvas-configuration?jwk=other'), 400, 'INVALID_REQUEST');
});
m1Test('M1-19.canvas.blackboard-refused', 'a Blackboard connection has no Canvas configuration', async () => {
  await sharedPlatform();
  const s = await session(), c = await createConnection(s);
  expectStatus(await app(s, 'GET', connPath(c.id) + '/canvas-configuration'), 409, 'CAPABILITY_NOT_SUPPORTED');
});
m1Test('M1-19.canvas.rows', 'a Canvas connection returns exactly the four developer key rows in order', async () => {
  const p = await pendingCanvas();
  const r = await app(p.s, 'GET', connPath(p.connection.id) + '/tool-configuration'); expectStatus(r, 200);
  assert.deepEqual(r.json.map((row: Json) => [row.key, row.label, row.value]), [
    ['key_name', 'Key Name', `Cogniate (${p.s.library.name})`],
    ['redirect_uris', 'Redirect URIs', `${urls.lti}/lti/launch/cogniate`],
    ['method', 'Method', 'Paste JSON'],
    ['lti_json', 'LTI 1.3 Configuration', 'Paste the JSON from "Copy JSON" or "Download JSON". Do not edit it.'],
  ]);
});

// ---------------------------------------------------------------- AC-M1-20 added deployments
m1Test('M1-20.canvas.add', 'an add_deployment grant adds one approved deployment without touching the first one', async () => {
  const b = await canvasBound(), second = canvasDeploymentId(), pub = await publication(b), since = Date.now();
  const first = await canvasLaunch(b); assert.equal(first.response.status, 303);
  const key = (await idToken(first.ltik)).json.services.serviceKey;
  refused((await canvasLaunch({ ...b, deploymentId: second })).login, 'UNKNOWN_DEPLOYMENT', [400, 403, 404]);
  const grant = await addGrant(b, second);
  const r = await addDeployment(b, second, grant); expectStatus(r, 200);
  assert.deepEqual([...r.json.platform.deploymentIds].sort(), [b.deploymentId, second].sort());
  assert.equal(logEvents('grant_redeemed', since, { grant_id: grant.id }).length, 1);
  const added = await canvasPlay({ ...b, deploymentId: second }, pub);
  assert.equal(added.token.platform.deploymentId, second, 'Approved added deployment opens a player');
  assert.equal((await canvasLaunch(b)).response.status, 303);
  expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(CLOUD.siteA + PATHS.lineitems)), 200);
});
m1Test('M1-20.canvas.repeat', 'a finalized repeat answers 200 without an LTI call, a redemption or use of the code', async () => {
  const b = await canvasBound(), second = canvasDeploymentId();
  const grant = await addGrant(b, second), first = await addDeployment(b, second, grant); expectStatus(first, 200);
  // Line counts, not a time window: the first redemption's lines come before its own http_request line (R3.7), so after
  // this barrier they are already counted. A millisecond timestamp cannot separate them from later lines.
  await completed(first, 'POST');
  const redeemed = redeemedLines(b.connection.id).length, attempts = attemptLines(b.connection.id).length;
  const other = await addGrant(b, second);
  await noRemoteCall(async () => {
    const again = await addDeployment(b, second, grant); expectStatus(again, 200); await completed(again, 'POST');
    const withOther = await addDeployment(b, second, other); expectStatus(withOther, 200); await completed(withOther, 'POST');
    assert.deepEqual([...withOther.json.platform.deploymentIds].sort(), [b.deploymentId, second].sort());
  });
  assert.equal(redeemedLines(b.connection.id).length, redeemed, 'No grant_redeemed line from a finalized repeat');
  assert.equal(attemptLines(b.connection.id).length, attempts, 'No grant_attempt_started line from a finalized repeat');
  await grantState(other, b.connection.id, 'issued');
});
m1Test('M1-20.canvas.missing-code', 'an added deployment without a code is refused', async () => {
  const b = await canvasBound();
  const r = await addDeployment(b, canvasDeploymentId()); expectStatus(r, 422, 'INVALID_PLATFORM_VALUES');
  assert.deepEqual(r.json.details.fields, ['grantCode']);
});
m1Test('M1-20.canvas.initial-grant', 'the redeemed initial grant cannot add a deployment: GRANT_INVALID, reason redeemed, no LTI call', async () => {
  // C-3: the only reachable initial grant of a registered connection is the redeemed one; check 2 answers before check 3.
  // Check 3 (`purpose`) needs an unredeemed initial grant on a registered connection; no CLI path makes one (unit test only).
  const b = await canvasBound(), third = canvasDeploymentId(), before = await connectionOf(b), since = Date.now();
  const baseline = await attemptBaseline(b.s, b.connection.id); // includes the registration's own attempt line
  await noRemoteCall(async () => {
    const answer = await refusedWithoutAttempt(b.connection.id, 'POST', () => addDeployment(b, third, b.grant));
    expectStatus(answer, 403, 'GRANT_INVALID');
  });
  const lines = logEvents('grant_rejected', since, { connection_id: b.connection.id });
  assert.deepEqual(lines.map((e) => e.reason), ['redeemed'], 'Exactly one grant_rejected {reason: "redeemed"} for this connection');
  assert.deepEqual(await connectionOf(b), before, 'Approvals and platform.deploymentIds unchanged');
  // Positive control: a proper add_deployment grant for the same id redeems with exactly one attempt line.
  const grant = await addGrant(b, third);
  const added = await redeemedWithOneAttempt(b.connection.id, grant.id, 'POST', () => addDeployment(b, third, grant));
  expectStatus(added, 200);
  assert.deepEqual([...added.json.platform.deploymentIds].sort(), [b.deploymentId, third].sort());
  // A delayed line of the refused request is not ignored: the connection has only the positive line since the baseline.
  assert.equal(attemptLines(b.connection.id).length, baseline + 1, 'No later grant_attempt_started line from the refused request');
});
m1Test('M1-20.canvas.capability-blackboard', 'Blackboard connections cannot add deployments', async () => {
  await sharedPlatform();
  const s = await session(), c = await createConnection(s);
  const r = await app(s, 'POST', connPath(c.id) + '/deployments', { deploymentId: 'x', grantCode: 'A'.repeat(43) });
  expectStatus(r, 409, 'CAPABILITY_NOT_SUPPORTED');
});
m1Test('M1-20.canvas.capability-moodle', 'Moodle connections cannot add deployments', async () => {
  const s = await session();
  const c = await app(s, 'POST', '/app-api/connections', { name: unique('Moodle'), siteUrl: urls.moodle, method: 'manual' }); expectStatus(c, 201);
  expectStatus(await app(s, 'POST', connPath(c.json.id) + '/deployments', { deploymentId: 'x', grantCode: 'A'.repeat(43) }), 409, 'CAPABILITY_NOT_SUPPORTED');
});
m1Test('M1-20.canvas.pending', 'a pending Canvas connection answers CONNECTION_NOT_READY before any grant check', async () => {
  // C-2: checks 1–3 of the endpoint (other library, capability, status) read no grant and log no grant_rejected.
  const p = await pendingCanvas(), since = Date.now();
  const initial = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId);
  const baseline = await attemptBaseline(p.s, p.connection.id);
  await unchanged(p, async () => {
    for (const grantCode of ['A'.repeat(43), initial.code]) {
      const answer = await refusedWithoutAttempt(p.connection.id, 'POST',
        () => app(p.s, 'POST', connPath(p.connection.id) + '/deployments', { deploymentId: canvasDeploymentId(), grantCode }));
      expectStatus(answer, 409, 'CONNECTION_NOT_READY');
    }
  });
  assert.deepEqual(logEvents('grant_rejected', since, { connection_id: p.connection.id }), [], 'No grant_rejected line');
  await grantState(initial, p.connection.id, 'issued');
  // Positive control: the same initial grant then redeems through PUT …/platform with exactly one attempt line
  // (this also shows that no live lease blocks it; it is not used as the no-attempt evidence).
  const registered = await redeemedWithOneAttempt(p.connection.id, initial.id, 'PUT', () => redeemP(p, initial));
  expectStatus(registered, 200);
  assert.equal(registered.json.status, 'registered');
  // A delayed line of a refused request is not ignored: the connection has only the positive line since the baseline.
  assert.equal(attemptLines(p.connection.id).length, baseline + 1, 'No later grant_attempt_started line from the refused requests');
});

// ---------------------------------------------------------------- AC-M1-21 capability guards
m1Test('M1-21.canvas.web-services', 'Canvas has no Moodle web services and makes no outbound call', async () => {
  const b = await canvasBound();
  await noRemoteCall(async () => {
    const r = await app(b.s, 'PUT', connPath(b.connection.id) + '/web-services', { token: 'a'.repeat(32) });
    expectStatus(r, 409, 'CAPABILITY_NOT_SUPPORTED'); assert.equal(r.json.details.capability, 'webServices');
  });
});
m1Test('M1-21.canvas.course-shell', 'Canvas publications cannot ask for a Moodle course shell', async () => {
  const b = await canvasBound(), course = await createCourse(b.s, unique('shell'));
  const before = await app(b.s, 'GET', '/app-api/publications');
  const r = await app(b.s, 'POST', '/app-api/publications', { connectionId: b.connection.id, courseId: course.id, createMoodleCourse: {} });
  expectStatus(r, 409, 'CAPABILITY_NOT_SUPPORTED'); assert.equal(r.json.details.capability, 'courseShell');
  assert.deepEqual((await app(b.s, 'GET', '/app-api/publications')).json, before.json);
});
m1Test('M1-21.canvas.registration-url', 'a Canvas connection has no Moodle registration URL', async () => {
  const p = await pendingCanvas();
  expectStatus(await app(p.s, 'POST', connPath(p.connection.id) + '/registration-url'), 409, 'CONNECTION_NOT_PENDING');
});

// ---------------------------------------------------------------- AC-M1-29 grant negatives (Canvas counterparts)
m1Test('M1-29.canvas.a-no-code', 'first-claim squatting: another library cannot bind Canvas ids without a code', async () => {
  const a = await pendingCanvas(), b = await pendingCanvas('B');
  await canvasGrant(a.s, a.connection, a.clientId, a.deploymentId);
  await unchanged(b, async () => {
    const r = await canvasRedeem(b.s, b.connection, a.clientId, a.deploymentId);
    expectStatus(r, 422, 'INVALID_PLATFORM_VALUES'); assert.deepEqual(r.json.details.fields, ['grantCode']);
  });
});
m1Test('M1-29.canvas.a-foreign-code', 'first-claim squatting: another library cannot use the rightful code', async () => {
  const a = await pendingCanvas(), b = await pendingCanvas('B'), since = Date.now();
  const grant = await canvasGrant(a.s, a.connection, a.clientId, a.deploymentId);
  await unchanged(b, async () => expectStatus(await canvasRedeem(b.s, b.connection, a.clientId, a.deploymentId, grant), 403, 'GRANT_INVALID'));
  await grantState(grant, a.connection.id, 'issued');
  assert.equal(rejected(since, 'other_library').length, 1);
});
m1Test('M1-29.canvas.c', 'a grant of library B cannot register library A', async () => {
  const a = await pendingCanvas(), b = await pendingCanvas('B'), since = Date.now();
  const grant = await canvasGrant(b.s, b.connection, a.clientId, a.deploymentId);
  await unchanged(a, async () => expectStatus(await redeemP(a, grant), 403, 'GRANT_INVALID'));
  await grantState(grant, b.connection.id, 'issued');
  assert.equal(rejected(since, 'other_library').length, 1);
});
m1Test('M1-29.canvas.d', 'a grant of one connection cannot register another connection of the same library', async () => {
  const a = await pendingCanvas(), other = await canvasConnection(a.s), since = Date.now();
  const grant = await canvasGrant(a.s, a.connection, a.clientId, a.deploymentId);
  await unchanged(a, async () => expectStatus(await redeemP(a, grant, {}, other), 403, 'GRANT_INVALID'));
  await grantState(grant, a.connection.id, 'issued');
  assert.equal(rejected(since, 'other_connection').length, 1);
});
for (const field of ['deploymentId', 'clientId'] as const) {
  m1Test(`M1-29.canvas.e-${field === 'deploymentId' ? 'deployment' : 'client'}`, `a grant with another ${field} is a mismatch and stays usable`, async () => {
    const p = await pendingCanvas(), grant = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId), since = Date.now();
    await unchanged(p, async () => {
      const wrong = { ...p, [field]: field === 'clientId' ? canvasClientId() : canvasDeploymentId() };
      const r = await redeemP(p, grant, {}, p.connection, wrong);
      expectStatus(r, 422, 'GRANT_MISMATCH'); assert.deepEqual(r.json.details.fields, [field]);
    });
    await grantState(grant, p.connection.id, 'issued');
    assert.equal(rejected(since, 'mismatch').length, 1);
    expectStatus(await redeemP(p, grant), 200);
  });
}
m1Test('M1-29.canvas.f', 'a redeemed Canvas grant cannot register another connection', async () => {
  const b = await canvasBound(), other = await pendingCanvas(), since = Date.now();
  await unchanged(other, async () => expectStatus(await canvasRedeem(other.s, other.connection, b.clientId, b.deploymentId, b.grant), 403, 'GRANT_INVALID'));
  assert.equal(rejected(since, 'redeemed').length, 1);
});
m1Test('M1-29.canvas.g', 'an expired Canvas grant is refused at phase 1 and listed as expired', async () => {
  const p = await pendingCanvas();
  const grant = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId, { 'ttl-seconds': '60' });
  await pause(63_000);
  const since = Date.now();
  await unchanged(p, async () => expectStatus(await redeemP(p, grant), 403, 'GRANT_INVALID'));
  await grantState(grant, p.connection.id, 'expired');
  assert.equal(rejected(since, 'expired').length, 1);
}, 240_000);
m1Test('M1-29.canvas.h', 'a revoked Canvas grant is refused', async () => {
  const p = await pendingCanvas(), grant = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId);
  assert.equal((await cli('app:grant', ['revoke', '--grant', grant.id])).code, 0);
  const since = Date.now();
  await unchanged(p, async () => expectStatus(await redeemP(p, grant), 403, 'GRANT_INVALID'));
  await grantState(grant, p.connection.id, 'revoked');
  assert.equal(rejected(since, 'revoked').length, 1);
});
m1Test('M1-29.canvas.i-other-library', 'an add_deployment code of library B cannot add a deployment to library A', async () => {
  const a = await canvasBound(), b = await canvasBound('B'), second = canvasDeploymentId();
  const grant = await addGrant(b, second), before = await connectionOf(a), since = Date.now();
  await noRemoteCall(async () => expectStatus(await addDeployment(a, second, grant), 403, 'GRANT_INVALID'));
  assert.deepEqual(await connectionOf(a), before);
  await grantState(grant, b.connection.id, 'issued');
  assert.equal(rejected(since, 'other_library').length, 1);
});
m1Test('M1-29.canvas.i-redeemed', 'a redeemed add_deployment code cannot add another deployment', async () => {
  const a = await canvasBound(), second = canvasDeploymentId(), third = canvasDeploymentId();
  const grant = await addGrant(a, second); expectStatus(await addDeployment(a, second, grant), 200);
  const before = await connectionOf(a), since = Date.now();
  await noRemoteCall(async () => expectStatus(await addDeployment(a, third, grant), 403, 'GRANT_INVALID'));
  assert.deepEqual(await connectionOf(a), before);
  assert.equal(rejected(since, 'redeemed').length, 1);
});
const cliCases: [string, (p: Pending, other: Json) => string[]][] = [
  ['k-library', (p, other) => ['--library', other.library.id, '--site', p.connection.siteUrl]],
  ['k-site', (p) => ['--library', p.s.library.id, '--site', CLOUD.siteB]],
  ['k-site-canonical', (p) => ['--library', p.s.library.id, '--site', 'HTTPS://School-B.Canvas.Sim.Test:443/']],
  ['k-service-url', (p) => ['--library', p.s.library.id, '--site', p.connection.siteUrl, '--service-url', CLOUD.siteB]],
  ['k-ttl', (p) => ['--library', p.s.library.id, '--site', p.connection.siteUrl, '--ttl-seconds', '30']],
  ['k-add-pending', (p) => ['--library', p.s.library.id, '--site', p.connection.siteUrl, '--purpose', 'add_deployment']],
];
for (const [variant, args] of cliCases) {
  m1Test(`M1-29.canvas.${variant}`, `operator CLI refuses ${variant} for a Canvas connection and stores nothing`, async () => {
    const p = await pendingCanvas(), other = await session('B');
    const before = await cli('app:grant', ['list', '--connection', p.connection.id]);
    const r = await cli('app:grant', ['issue', '--connection', p.connection.id, ...args(p, other),
      '--client-id', p.clientId, '--deployment-id', p.deploymentId, '--note', 'M1-29 Canvas CLI negative']);
    assert.equal(r.code, 1, `exit code for ${variant}`);
    assert.equal(r.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/), null, 'No approval code printed');
    assert.equal((await cli('app:grant', ['list', '--connection', p.connection.id])).stdout, before.stdout);
  });
}
m1Test('M1-29.canvas.k-initial-registered', 'operator CLI refuses an initial grant for a registered Canvas connection', async () => {
  const b = await canvasBound(), before = await cli('app:grant', ['list', '--connection', b.connection.id]);
  const r = await cli('app:grant', ['issue', '--library', b.s.library.id, '--connection', b.connection.id, '--site', b.connection.siteUrl,
    '--client-id', b.clientId, '--deployment-id', canvasDeploymentId(), '--purpose', 'initial', '--note', 'M1-29 k']);
  assert.equal(r.code, 1);
  assert.equal((await cli('app:grant', ['list', '--connection', b.connection.id])).stdout, before.stdout);
});
m1Test('M1-29.canvas.k-add-client', 'operator CLI refuses an add_deployment grant with another client id', async () => {
  const b = await canvasBound(), before = await cli('app:grant', ['list', '--connection', b.connection.id]);
  const r = await cli('app:grant', ['issue', '--library', b.s.library.id, '--connection', b.connection.id, '--site', b.connection.siteUrl,
    '--client-id', canvasClientId(), '--deployment-id', canvasDeploymentId(), '--purpose', 'add_deployment', '--note', 'M1-29 k']);
  assert.equal(r.code, 1);
  assert.equal((await cli('app:grant', ['list', '--connection', b.connection.id])).stdout, before.stdout);
});
for (const [variant, method, suffix, body] of [
  ['l-get', 'GET', '', undefined],
  ['l-put', 'PUT', '/platform', { clientId: 'x', deploymentId: 'y', grantCode: 'A'.repeat(43) }],
  ['l-post-deployments', 'POST', '/deployments', { deploymentId: 'y', grantCode: 'A'.repeat(43) }],
  ['l-delete', 'DELETE', '', undefined],
] as const) {
  m1Test(`M1-29.canvas.${variant}`, `library B gets 404 for ${method} on a library A Canvas connection`, async () => {
    const a = await canvasBound(), b = await session('B'), before = await connectionOf(a);
    await noRemoteCall(async () => expectStatus(await app(b, method, connPath(a.connection.id) + suffix, body), 404, 'NOT_FOUND'));
    assert.deepEqual(await connectionOf(a), before);
  });
}
m1Test('M1-29.canvas.m', 'every grant rejection gives the same public answer while the log keeps the precise reason', async () => {
  const a = await pendingCanvas(), b = await pendingCanvas('B'), since = Date.now();
  const mine = await canvasGrant(a.s, a.connection, a.clientId, a.deploymentId);
  const theirs = await canvasGrant(b.s, b.connection, a.clientId, a.deploymentId);
  const other = await canvasConnection(a.s);
  const answers: Awaited<ReturnType<typeof redeemP>>[] = [];
  // Phase 1 refuses before any LTI call (B-M1-03): no gate request of any method, provider reads included.
  await noRemoteCall(async () => {
    answers.push(await redeemP(a, theirs)); // other_library
    answers.push(await redeemP(a, mine, {}, other)); // other_connection
    answers.push(await redeemP(a, { code: 'A'.repeat(43) })); // not_found
  });
  for (const r of answers) expectStatus(r, 403, 'GRANT_INVALID');
  assert.equal(new Set(answers.map((r) => `${r.status} ${r.json.details.message} ${r.json.details.description}`)).size, 1,
    'The public answer never says which check failed');
  for (const reason of ['other_library', 'other_connection', 'not_found']) assert.ok(rejected(since, reason).length >= 1, `reason ${reason}`);
  const lines = logEvents('grant_rejected', since);
  assert.equal(JSON.stringify(lines).includes(mine.code) || JSON.stringify(lines).includes(theirs.code), false, 'No code in logs');
});

// ---------------------------------------------------------------- AC-M1-31 portal routes and publication fields
const normalize = (text: string) => text.replace(/nonce-[A-Za-z0-9+/=_-]+/g, 'nonce-x').replace(/nonce="[^"]*"/g, 'nonce="x"');
const SECURITY_HEADERS = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options',
  'cross-origin-opener-policy', 'permissions-policy', 'strict-transport-security', 'cache-control'];
async function portalGet(path: string, cookie?: string) {
  return httpsRequest(`${APP}${path}`, { headers: cookie ? { cookie } : {} });
}
m1Test('M1-31.canvas.routes', 'signed-in Canvas routes answer the portal page with the portal security headers', async () => {
  const p = await pendingCanvas(), baseline = await portalGet('/integrations', p.s.cookie); expectStatus(baseline, 200);
  for (const path of ['/integrations/canvas/connect', `/integrations/canvas/${p.connection.id}`]) {
    const r = await portalGet(path, p.s.cookie); expectStatus(r, 200);
    assert.equal(normalize(r.body), normalize(baseline.body), `${path} serves the portal page`);
    for (const name of SECURITY_HEADERS) {
      assert.equal(normalize(String(r.headers[name] ?? '')), normalize(String(baseline.headers[name] ?? '')), `${path} header ${name}`);
    }
  }
});
m1Test('M1-31.canvas.signed-out', 'signed-out Canvas routes redirect to sign-in', async () => {
  const p = await pendingCanvas();
  for (const path of ['/integrations/canvas/connect', `/integrations/canvas/${p.connection.id}`]) {
    const r = await portalGet(path);
    assert.ok([302, 303].includes(r.status), `${path} status ${r.status}`);
    assert.equal(new URL(String(r.headers.location), APP).pathname, '/signin');
  }
});
m1Test('M1-31.canvas.other-lms', 'an unknown LMS route does not answer the portal page', async () => {
  const s = await session(), baseline = await portalGet('/integrations', s.cookie);
  const r = await portalGet('/integrations/other/connect', s.cookie);
  assert.ok(!(r.status === 200 && normalize(r.body) === normalize(baseline.body)), `status ${r.status}`);
});
m1Test('M1-31.canvas.publication-fields', 'Canvas publication answers carry lms and connectionName', async () => {
  const b = await canvasBound(), pub = await publication(b);
  for (const row of [pub, (await app(b.s, 'GET', `/app-api/publications/${pub.id}`)).json,
    ...(await app(b.s, 'GET', '/app-api/publications?connectionId=' + b.connection.id)).json.publications]) {
    assert.equal(row.lms, 'canvas'); assert.equal(row.connectionName, b.connection.name);
  }
});
