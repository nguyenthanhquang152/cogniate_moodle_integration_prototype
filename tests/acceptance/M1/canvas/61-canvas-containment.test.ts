// Canvas operator containment and recovery (AC-M1-38 a, b, d, e, f, f-held-delete, g-late-create) and the signed
// product family squatting path with the operator order and the residual D-12 race (AC-M1-39, Canvas parts).
import {
  app, assert, cli, connPath, expectStatus, gateEvents, gatePhase, gateReset, gateRules, httpsRequest, idToken,
  logEvents, m1Test, poll, records, release, service, session, unique, type Json,
} from '../common/client';
import { commitGrade, publication, results, waitSync } from '../common/course';
import {
  CLOUD, PATHS, SELF, binding, canvasBound, canvasClientId, canvasConnection, canvasDeploymentId, canvasGrant,
  canvasGradeWorks, canvasLaunch, canvasPlay, canvasRedeem, connectionOf, hostOf, platformsFor, refused, saveEvidence,
  scoreRecords, type CanvasBinding,
} from './canvas';

const suspend = (id: string) => cli('app:binding', ['suspend', '--connection', id, '--note', 'M1-38 Canvas QA']);
const releaseBinding = (id: string) => cli('app:binding', ['release', '--connection', id, '--note', 'M1-38 Canvas QA']);
async function pending(patch: Json = {}, values?: { clientId: string; deploymentId: string }, library: 'A' | 'B' = 'A') {
  const s = await session(library), connection = await canvasConnection(s, patch);
  const clientId = values?.clientId ?? canvasClientId(), deploymentId = values?.deploymentId ?? canvasDeploymentId();
  const grant = await canvasGrant(s, connection, clientId, deploymentId);
  return { s, connection, clientId, deploymentId, grant, provider: CLOUD.provider,
    serviceHost: hostOf(connection.serviceUrl), pageHost: hostOf(connection.siteUrl) };
}
const redeem = (p: Awaited<ReturnType<typeof pending>>, grant = p.grant) => canvasRedeem(p.s, p.connection, p.clientId, p.deploymentId, grant);
const remote = async (clientId: string, issuer = CLOUD.issuer) => (await platformsFor(clientId, issuer))[0] as Json | undefined;
/** Publications, results and the connection of a library, for the no-transfer comparison (AC-M1-38 e). */
async function snapshot(b: { s: any; connection: Json }, pubId: string) {
  const pub = await app(b.s, 'GET', `/app-api/publications/${pubId}`); expectStatus(pub, 200);
  const rows = await results(b, { id: pubId });
  const strip = (row: Json) => ({ ...row, gradebook: null });
  return { publication: { ...pub.json, updatedAt: undefined }, rows: rows.map(strip) };
}

m1Test('M1-38.canvas.a', 'suspend without a library session disables Canvas; a due row fails without a POST; B is unaffected', async () => {
  const a = await canvasBound(), b = await canvasBound('B'), pub = await publication(a), cursor = (await records()).cursor;
  const play = await canvasPlay(a, pub, { scoreAnswers: [503, 503] });
  await commitGrade(play, 'scorm12', 7, 10);
  const pendingRow = await waitSync(a, pub, 'pending', 2, 30_000);
  const out = await suspend(a.connection.id); assert.equal(out.code, 0); assert.match(out.stdout, /\bfenced\b/);
  const after = (await records()).cursor;
  assert.equal((await connectionOf(a)).status, 'disabled');
  assert.equal((await remote(a.clientId))?.active, false);
  refused((await canvasLaunch(a)).login, 'PLATFORM_NOT_ACTIVE', [403]);
  const failed = await waitSync(a, pub, 'failed', 2, 30_000 + 2 * 2000 + 5000 + 10_000);
  assert.equal(failed.id, pendingRow.id); assert.equal(failed.lastError, 'CONNECTION_DISABLED');
  assert.deepEqual(await scoreRecords(after, pub.id), [], 'Zero score POSTs after the disable');
  assert.equal((await scoreRecords(cursor, pub.id)).length, 2);
  expectStatus(await app(a.s, 'POST', `/app-api/score-syncs/${failed.id}/resend`), 409, 'CONNECTION_NOT_READY');
  expectStatus(await app(a.s, 'POST', `/app-api/publications/${pub.id}/results/refresh`), 409, 'CONNECTION_NOT_READY');
  await canvasGradeWorks(b);
  const again = await suspend(a.connection.id); assert.equal(again.code, 0); assert.match(again.stdout, /\bfenced\b/);
  assert.equal((await remote(a.clientId))?.active, false);
  assert.equal((await connectionOf(a)).status, 'disabled');
}, 240_000);
m1Test('M1-38.canvas.b', 'Canvas release needs a suspend first, deletes only the owned platform and keeps history', async () => {
  const a = await canvasBound(), other = await canvasBound('B'), done = await canvasGradeWorks(a);
  const otherBefore = await remote(other.clientId), history = await snapshot(a, done.pub.id);
  const early = await releaseBinding(a.connection.id); assert.equal(early.code, 1);
  assert.equal((await remote(a.clientId))?.active, true, 'Release on an active connection changes nothing');
  assert.equal((await suspend(a.connection.id)).code, 0);
  const out = await releaseBinding(a.connection.id); assert.equal(out.code, 0); assert.match(out.stdout, /\bdeleted\b/);
  assert.deepEqual(await platformsFor(a.clientId, CLOUD.issuer), [], 'The LTI platform is gone');
  expectStatus(await service(done.play.token.services.serviceKey, 'GET', '/api/lineitems'), 401, 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  assert.deepEqual(await remote(other.clientId), otherBefore, 'No row of another connection changes');
  assert.deepEqual(await snapshot(a, done.pub.id), history, 'Publications, attempts and score history stay');
  const again = await releaseBinding(a.connection.id); assert.equal(again.code, 0);
  assert.equal(logEvents('binding_released', 0, { connection_id: a.connection.id }).length >= 1, true);
});
m1Test('M1-38.canvas.d', 'a registered Canvas connection with a wrong service URL is corrected without a new developer key', async () => {
  const wrong = await canvasBound('A', { serviceUrl: CLOUD.siteB }), since = Date.now();
  const real = await canvasLaunch({ ...wrong, serviceHost: 'school-a.canvas.sim.test' });
  refused(real.response, 'SERVICE_ORIGIN_MISMATCH', [400]);
  assert.ok(logEvents('launch_check_failed', since, { check: '13' }, 'lti-service')
    .some((e) => e.detail === 'claim=ags_lineitems host=https://school-a.canvas.sim.test'));
  const accepted = await canvasLaunch(wrong); assert.equal(accepted.response.status, 303);
  const key = (await idToken(accepted.ltik)).json.services.serviceKey;
  assert.equal((await suspend(wrong.connection.id)).code, 0);
  const out = await releaseBinding(wrong.connection.id); assert.equal(out.code, 0); assert.match(out.stdout, /\bdeleted\b/);
  expectStatus(await service(key, 'GET', '/api/lineitems'), 401, 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  const fixed = await canvasBound('A', { serviceUrl: CLOUD.siteA }, wrong.clientId, wrong.deploymentId);
  await canvasGradeWorks(fixed);
});
m1Test('M1-38.canvas.e', 'after release and a new binding, old Canvas publications and history stay with their own library', async () => {
  const a = await canvasBound(), done = await canvasGradeWorks(a), history = await snapshot(a, done.pub.id);
  assert.equal((await suspend(a.connection.id)).code, 0); assert.equal((await releaseBinding(a.connection.id)).code, 0);
  const b = await canvasBound('B', {}, a.clientId, a.deploymentId);
  assert.deepEqual(await snapshot(a, done.pub.id), history, 'Old publication, attempts and score rows unchanged');
  expectStatus(await app(b.s, 'GET', `/app-api/publications/${done.pub.id}`), 404, 'NOT_FOUND');
  expectStatus(await app(b.s, 'GET', `/app-api/publications/${done.pub.id}/results`), 404, 'NOT_FOUND');
  const old = await canvasLaunch(b, { resource: done.pub.id }); assert.equal(old.response.status, 303);
  refused(await httpsRequest(String(old.response.headers.location)), 'PUBLICATION_NOT_IN_CONNECTION', [404]);
});
async function lostActivation(p: Awaited<ReturnType<typeof pending>>) {
  await gateReset();
  await gateRules([{ id: 'activate', method: 'PATCH', pathRegex: '^/api/platforms/[^/]+$', action: 'drop_after', times: 1 }]);
  expectStatus(await redeem(p), 502, 'LTI_SERVICE_ERROR');
  const c = await connectionOf(p); assert.equal(c.platform, null, 'No lti_platform_id yet');
  assert.equal((await remote(p.clientId))?.active, true, 'Active platform without approval');
  await gateReset();
}
m1Test('M1-38.canvas.f', 'a pending Canvas connection with a wrong service URL is suspended, released and corrected', async () => {
  const p = await pending({ serviceUrl: CLOUD.siteB });
  try {
    await lostActivation(p);
    const out = await suspend(p.connection.id); assert.equal(out.code, 0); assert.match(out.stdout, /\bfenced\b/);
    const rel = await releaseBinding(p.connection.id); assert.equal(rel.code, 0); assert.match(rel.stdout, /\bdeleted\b/);
    assert.deepEqual(await platformsFor(p.clientId, CLOUD.issuer), []);
    const fixed = await canvasBound('A', { serviceUrl: CLOUD.siteA }, p.clientId, p.deploymentId);
    const graded = await canvasGradeWorks(fixed); assert.equal(graded.hits[0].host, 'school-a.canvas.sim.test');
  } finally { saveEvidence('M1-38.canvas.f', { remote: await remote(p.clientId) ?? null }); await gateReset(); }
});
m1Test('M1-38.canvas.f-held-delete', 'a held release DELETE fails; the same values bind (A3); the late DELETE then fails', async () => {
  const p = await pending({ serviceUrl: CLOUD.siteB });
  try {
    await lostActivation(p);
    assert.equal((await suspend(p.connection.id)).code, 0);
    await gateRules([{ id: 'delete', method: 'DELETE', pathRegex: '^/api/platforms/[^/]+$', action: 'hold_before', times: 1 }]);
    const pendingRelease = releaseBinding(p.connection.id);
    const held = await gatePhase('delete', 'held_before', 30_000);
    await gatePhase('delete', 'caller_gone', 10_000);
    const rel = await pendingRelease; assert.equal(rel.code, 1); assert.match(rel.stdout + rel.stderr, /\bfailed\b/);
    const again = await pending({ serviceUrl: CLOUD.siteB }, { clientId: p.clientId, deploymentId: p.deploymentId });
    expectStatus(await redeem(again), 200);
    const bound = await remote(p.clientId);
    await release(held.request_id);
    const events = await poll(() => gateEvents(0, held.request_id), (rows) => rows.some((r) => r.phase === 'upstream_completed'), 6000, 25);
    assert.equal(events.find((r) => r.phase === 'upstream_completed')!.status, 409);
    assert.deepEqual(await remote(p.clientId), bound, 'The platform and the new binding stay');
    const b = binding(again.s, await connectionOf(again), again.clientId, again.deploymentId, again.grant);
    await canvasGradeWorks(b);
  } finally { saveEvidence('M1-38.canvas.f-held-delete', { remote: await remote(p.clientId) ?? null }); await gateReset(); }
}, 240_000);
m1Test('M1-38.canvas.g-late-create', 'a late Canvas create after release is inactive; another value set waits for a second release', async () => {
  const k1 = await pending({ serviceUrl: CLOUD.siteB });
  try {
    await gateReset();
    await gateRules([{ id: 'create', method: 'POST', pathRegex: '^/api/platforms$', action: 'hold_before', times: 1 }]);
    const first = redeem(k1), held = await gatePhase('create', 'held_before');
    await gatePhase('create', 'caller_gone', 7000); expectStatus(await first, 502, 'LTI_SERVICE_ERROR');
    const out = await suspend(k1.connection.id); assert.equal(out.code, 0); assert.match(out.stdout, /\babsent\b/);
    const rel = await releaseBinding(k1.connection.id); assert.equal(rel.code, 0); assert.match(rel.stdout, /\babsent\b/);
    await release(held.request_id);
    await poll(async () => remote(k1.clientId), (row) => Boolean(row), 6000, 50);
    assert.equal((await remote(k1.clientId))?.active, false, 'The late create is inactive');
    refused((await canvasLaunch(k1)).login, 'PLATFORM_NOT_ACTIVE', [403]);
    const k2 = await pending({ serviceUrl: CLOUD.siteA }, { clientId: k1.clientId, deploymentId: k1.deploymentId });
    expectStatus(await redeem(k2), 409, 'PLATFORM_IN_USE');
    const again = await releaseBinding(k1.connection.id); assert.equal(again.code, 0); assert.match(again.stdout, /\bdeleted\b/);
    expectStatus(await redeem(k2), 200);
  } finally { saveEvidence('M1-38.canvas.g-late-create', { remote: await remote(k1.clientId) ?? null }); await gateReset(); }
}, 240_000);

// ---------------------------------------------------------------- AC-M1-39 self-hosted squatting and the operator order
async function standardSquat(clientId: string, deploymentId: string) {
  const b = await session('B');
  const c = await app(b, 'POST', '/app-api/connections', { name: unique('Squat'), siteUrl: SELF.site, method: 'manual' }); expectStatus(c, 201);
  const reg = await app(b, 'PUT', connPath(c.json.id) + '/platform', { issuer: SELF.site, clientId, deploymentId,
    authenticationEndpoint: `${SELF.site}/api/lti/authorize_redirect`, accessTokenEndpoint: `${SELF.site}${PATHS.token}`,
    jwksUrl: `${SELF.site}/api/lti/security/jwks` });
  expectStatus(reg, 200); assert.equal(reg.json.lms, 'moodle'); assert.equal(reg.json.profile, 'standard');
  return { s: b, connection: reg.json };
}
async function canvasSignedRefused(clientId: string, deploymentId: string, connection: Json, s: any) {
  const since = Date.now(), cursor = (await records()).cursor;
  const l = await canvasLaunch({ provider: SELF.provider, clientId, deploymentId, serviceHost: 'api.canvas-self.sim.test', pageHost: 'canvas-self.sim.test' });
  refused(l.response, 'PROVIDER_PROFILE_MISMATCH', [400]); assert.equal(l.ltik, '');
  assert.ok(logEvents('launch_check_failed', since, { check: '14' }, 'lti-service').some((e) => e.detail === 'family=canvas'));
  assert.equal(logEvents('launch_claims_minimized', since, {}, 'lti-service').length, 0, 'No claim is stored');
  assert.deepEqual((await records(cursor)).records.filter((r) => ['token', 'ags', 'score', 'nrps', 'deep-link'].includes(r.kind)), []);
  const pubs = await app(s, 'GET', '/app-api/publications?connectionId=' + connection.id); expectStatus(pubs, 200);
  for (const pub of pubs.json.publications) assert.deepEqual(await results({ s }, pub), [], 'No attempt');
}
const selfPatch = { profile: SELF.profile, siteUrl: SELF.site, serviceUrl: SELF.service };
m1Test('M1-39.canvas.squat-refused', 'a standard connection with a self-hosted Canvas issuer cannot run Canvas-signed launches', async () => {
  const clientId = canvasClientId(), deploymentId = canvasDeploymentId(), squat = await standardSquat(clientId, deploymentId);
  await canvasSignedRefused(clientId, deploymentId, squat.connection, squat.s);
  const rightful = await pending(selfPatch, { clientId, deploymentId });
  expectStatus(await redeem(rightful), 409, 'PLATFORM_IN_USE');
});
m1Test('M1-39.canvas.operator-order', 'grant first, then suspend and release the squatter, then redeem: 200', async () => {
  const clientId = canvasClientId(), deploymentId = canvasDeploymentId(), squat = await standardSquat(clientId, deploymentId);
  const rightful = await pending(selfPatch, { clientId, deploymentId });
  expectStatus(await redeem(rightful), 409, 'PLATFORM_IN_USE');
  const grant = await canvasGrant(rightful.s, rightful.connection, clientId, deploymentId);
  assert.equal((await suspend(squat.connection.id)).code, 0);
  assert.equal((await releaseBinding(squat.connection.id)).code, 0);
  expectStatus(await redeem(rightful, grant), 200);
  const b = binding(rightful.s, await connectionOf(rightful), clientId, deploymentId, grant);
  assert.equal(b.connection.platform.issuer, SELF.site);
  await canvasGradeWorks(b);
});
m1Test('M1-39.canvas.residual-race', 'the accepted D-12 race: a new standard connect after release blocks the redemption until repeated release', async () => {
  const clientId = canvasClientId(), deploymentId = canvasDeploymentId(), squat = await standardSquat(clientId, deploymentId);
  const rightful = await pending(selfPatch, { clientId, deploymentId });
  const grant = await canvasGrant(rightful.s, rightful.connection, clientId, deploymentId);
  assert.equal((await suspend(squat.connection.id)).code, 0);
  assert.equal((await releaseBinding(squat.connection.id)).code, 0);
  const second = await standardSquat(clientId, deploymentId);
  expectStatus(await redeem(rightful, grant), 409, 'PLATFORM_IN_USE');
  await canvasSignedRefused(clientId, deploymentId, second.connection, second.s);
  assert.equal((await suspend(second.connection.id)).code, 0);
  assert.equal((await releaseBinding(second.connection.id)).code, 0);
  expectStatus(await redeem(rightful, grant), 200);
  saveEvidence('M1-39.canvas.residual-race', { note: 'Race recorded as the accepted D-12 deferral; no prevention claim.' });
});
