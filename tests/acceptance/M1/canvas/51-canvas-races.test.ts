// Canvas redemption faults and races through the transport gate: AC-M1-37 Canvas variants
// c, c2, d, e, f, g, h, i, j, m, n, p-create, p-activate, q, r, s-retry, s-dead, s-compensation, t, u-after-c, u-after-c2.
// Each subcase reports the remote record (exists, active, ref) and the app authority separately (evidence JSON).
import {
  admin, app, assert, cli, connPath, expectStatus, gateEvents, gatePhase, gateReset,
  httpsRequest, logEvents, m1Test, pause, poll, records, release, service, session, type Json,
} from '../common/client';
import { commitGrade, publication, waitSync } from '../common/course';
import {
  CLOUD, PATHS, addDeployment, addGrant, binding, canvasBound, canvasClientId, canvasConnection, canvasDeploymentId,
  canvasGrant, canvasGradeWorks, canvasLaunch, canvasPlay, canvasRedeem, connectionOf, escape, grantState, hostOf,
  platformsFor, refused, saveEvidence, type CanvasBinding,
} from './canvas';
import { liveRelease, restartApp, watchAll } from '../common/snapshot';
import { leaseWindow } from './snapshot-oracle.mjs';

type Race = Awaited<ReturnType<typeof fresh>>;
async function fresh(library: 'A' | 'B' = 'A', patch: Json = {}, values?: { clientId: string; deploymentId: string }) {
  const s = await session(library), connection = await canvasConnection(s, patch);
  const clientId = values?.clientId ?? canvasClientId(), deploymentId = values?.deploymentId ?? canvasDeploymentId();
  const grant = await canvasGrant(s, connection, clientId, deploymentId);
  return { s, connection, clientId, deploymentId, grant, since: Date.now(), provider: CLOUD.provider,
    serviceHost: hostOf(connection.serviceUrl), pageHost: hostOf(connection.siteUrl) };
}
const apply = (p: Race, grant = p.grant) => canvasRedeem(p.s, p.connection, p.clientId, p.deploymentId, grant);
const PLATFORMS = '^/api/platforms$';
const PLATFORM = '^/api/platforms/[^/]+$';
const ANY_RECORD = '^/api/platforms/[^/]+(?:/deployments/[^/]+)?$';
const createRule = (id: string, action: string) => ({ id, method: 'POST', pathRegex: PLATFORMS, action, times: 1 });
const activateRule = (id: string, action: string, times = 1) => ({ id, method: 'PATCH', pathRegex: PLATFORM, action, times });
const addCreate = (b: CanvasBinding) => `^/api/platforms/${escape(b.platformId)}/deployments$`;
const addActivate = (b: CanvasBinding, d: string) => `^/api/platforms/${escape(b.platformId)}/deployments/${escape(encodeURIComponent(d))}$`;

async function remote(p: { clientId: string }) {
  const list = await platformsFor(p.clientId, CLOUD.issuer);
  assert.ok(list.length <= 1, 'At most one LTI platform for the values');
  return list[0] as Json | undefined;
}
async function deployment(b: CanvasBinding, deploymentId: string) {
  const r = await admin('GET', `/api/platforms/${b.platformId}`); expectStatus(r, 200);
  return r.json.deployments.find((d: Json) => d.deploymentId === deploymentId) as Json | undefined;
}
async function approved(p: Race) {
  const c = await connectionOf(p);
  assert.ok(['registered', 'connected'].includes(c.status), `status ${c.status}`);
  assert.deepEqual(c.platform.deploymentIds, [p.deploymentId]);
  assert.equal((await remote(p))?.active, true);
  return binding(p.s, c, p.clientId, p.deploymentId, p.grant);
}
async function noServiceCalls(cursor: number) {
  assert.deepEqual((await records(cursor)).records.filter((r) => ['ags', 'score', 'nrps', 'token'].includes(r.kind)), []);
}
/** Active remote platform without an approval and without an owner connection (pending Canvas initial). */
async function unapprovedInitial(p: Race) {
  const cursor = (await records()).cursor, since = Date.now();
  for (const messageType of ['LtiResourceLinkRequest', 'LtiDeepLinkingRequest']) {
    const roles = ['http://purl.imsglobal.org/vocab/lis/v2/membership#' + (messageType === 'LtiResourceLinkRequest' ? 'Learner' : 'Instructor')];
    const l = await canvasLaunch(p, { messageType, roles });
    assert.equal(l.response.status, 303, 'The LTI record is active');
    const page = await httpsRequest(String(l.response.headers.location));
    refused(page, 'UNKNOWN_PLATFORM', [404]);
  }
  assert.ok(logEvents('launch_rejected', since, { reason: 'unknown_platform' }).length >= 1, 'launch_rejected unknown_platform');
  await noServiceCalls(cursor);
}
/** Active remote deployment of an owned Canvas platform without an approval. */
async function unapprovedAdded(b: CanvasBinding, deploymentId: string) {
  const cursor = (await records()).cursor, since = Date.now();
  for (const messageType of ['LtiResourceLinkRequest', 'LtiDeepLinkingRequest']) {
    const roles = ['http://purl.imsglobal.org/vocab/lis/v2/membership#' + (messageType === 'LtiResourceLinkRequest' ? 'Learner' : 'Instructor')];
    const l = await canvasLaunch({ ...b, deploymentId }, { messageType, roles });
    assert.equal(l.response.status, 303);
    refused(await httpsRequest(String(l.response.headers.location)), 'UNKNOWN_PLATFORM', [404]);
  }
  const rows = logEvents('launch_rejected', since, { reason: 'deployment_not_approved' });
  assert.ok(rows.some((e) => e.platform_id === b.platformId && e.deployment_id === deploymentId), 'deployment_not_approved with ids');
  await noServiceCalls(cursor);
}
async function upstream(event: Json, status: number) {
  const all = await poll(() => gateEvents(0, event.request_id), (rows) => rows.some((r) => r.phase === 'upstream_completed'), 6000, 25);
  assert.equal(all.find((r) => r.phase === 'upstream_completed')!.status, status);
}
const revoke = async (grantId: string) => cli('app:grant', ['revoke', '--grant', grantId]);

async function scope(id: string, p: { clientId: string; since: number; connection: Json; s: any }, body: () => Promise<void>) {
  await gateReset();
  await watchAll();
  try {
    await body();
    await remote(p);
    const redeemed = logEvents('grant_redeemed', p.since).filter((e) => e.connection_id === p.connection.id);
    assert.equal(redeemed.length, new Set(redeemed.map((e) => e.grant_id)).size, 'Each grant is consumed at most once');
  } finally {
    saveEvidence(id, { started: p.since, events: await gateEvents(0), remote: await remote(p).catch(() => null),
      connection: await connectionOf(p).catch(() => null) });
    await gateReset();
  }
}
function race(variant: string, title: string, body: (p: Race) => Promise<void>) {
  const id = `M1-37.canvas.${variant}`;
  m1Test(id, title, async () => { const p = await fresh(); await scope(id, p, () => body(p)); }, 240_000);
}
function addRace(variant: string, title: string, body: (b: CanvasBinding, pub: Json, key: string) => Promise<void>) {
  const id = `M1-37.canvas.${variant}`;
  m1Test(id, title, async () => {
    const b = await canvasBound(), pub = await publication(b), first = await canvasPlay(b, pub);
    await scope(id, { ...b, since: Date.now() }, () => body(b, pub, first.token.services.serviceKey));
  }, 240_000);
}
/** dA launch, its service key and (when asked) a graded dA attempt still work. */
async function firstWorks(b: CanvasBinding, pub: Json, key: string, graded = false) {
  const play = await canvasPlay(b, pub);
  expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(CLOUD.siteA + PATHS.lineitems)), 200);
  if (graded) { await commitGrade(play, 'scorm12', 7, 10); await waitSync(b, pub, 'sent'); }
  assert.deepEqual((await connectionOf(b)).platform.deploymentIds, [b.deploymentId]);
}

race('c', 'Canvas initial S1 answer lost leaves an inactive platform; retry adopts it (A2)', async (p) => {
  await watchAll('pass', [createRule('create', 'drop_after')]);
  expectStatus(await apply(p), 502, 'LTI_SERVICE_ERROR');
  assert.equal((await remote(p))?.active, false);
  refused((await canvasLaunch(p)).login, 'PLATFORM_NOT_ACTIVE', [403]);
  const c = await connectionOf(p); assert.equal(c.status, 'pending'); assert.equal(c.platform, null);
  expectStatus(await apply(p), 200); await approved(p);
});
race('c2', 'Canvas initial S3 answer lost: active without approval gives no authority; retry finishes', async (p) => {
  await watchAll('pass', [activateRule('activate', 'drop_after')]);
  expectStatus(await apply(p), 502, 'LTI_SERVICE_ERROR');
  assert.equal((await remote(p))?.active, true);
  await unapprovedInitial(p);
  expectStatus(await apply(p), 200); await approved(p);
});
race('d', 'dead Canvas handler keeps the lease for 60 s; its late S3 loses to the retry', async (p) => {
  await watchAll('pass', [activateRule('activate', 'hold_before')]);
  const started = Date.now(), first = apply(p).catch(() => null), held = await gatePhase('activate', 'held_before');
  await restartApp(); await gatePhase('activate', 'caller_gone', 10_000); await first;
  leaseWindow(started);
  const refused = await apply(p); leaseWindow(started, Date.now(), true);
  expectStatus(refused, 409, 'GRANT_IN_USE');
  await pause(Math.max(0, started + 62_000 - Date.now()));
  expectStatus(await apply(p), 200);
  const before = await remote(p);
  await release(held.request_id); await upstream(held, 409);
  assert.deepEqual(await remote(p), before);
  await canvasGradeWorks(await approved(p));
});
race('e', 'revoke during a held Canvas S3 cancels and switches off with a new ref', async (p) => {
  await watchAll('pass', [activateRule('activate', 'hold_after')]);
  const first = apply(p), held = await gatePhase('activate', 'held_after'), old = await remote(p);
  assert.equal((await revoke(p.grant.id)).code, 0);
  await liveRelease(held); expectStatus(await first, 403, 'GRANT_INVALID');
  const row = await remote(p); assert.equal(row?.active, false); assert.notEqual(row?.bindingRef, old?.bindingRef);
  assert.equal(logEvents('grant_redemption_cancelled', p.since, { reason: 'revoked', connection_id: p.connection.id }).length, 1);
  await grantState(p.grant, p.connection.id, 'revoked');
  const replacement = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId);
  expectStatus(await apply(p, replacement), 200); await approved(p);
});
race('f', 'a Canvas replacement cannot start during a live lease and adopts after the cancel', async (p) => {
  await watchAll('pass', [activateRule('activate', 'hold_after')]);
  const first = apply(p), held = await gatePhase('activate', 'held_after');
  const replacement = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId);
  const cursor = (await gateEvents(0)).at(-1)!.seq;
  expectStatus(await apply(p, replacement), 409, 'GRANT_IN_USE');
  assert.deepEqual(await gateEvents(cursor), [], 'The refused replacement makes no LTI call');
  await liveRelease(held); expectStatus(await first, 403, 'GRANT_INVALID');
  assert.equal(logEvents('grant_redemption_cancelled', p.since, { reason: 'replaced', connection_id: p.connection.id }).length, 1);
  expectStatus(await apply(p, replacement), 200); await approved(p);
});
race('g', 'DELETE during a held Canvas S3 fences the platform; the stale compensation cannot undo it', async (p) => {
  await watchAll('pass', [activateRule('activate', 'hold_after'), activateRule('cleanup', 'pass', 10)]);
  const first = apply(p), held = await gatePhase('activate', 'held_after');
  expectStatus(await app(p.s, 'DELETE', connPath(p.connection.id)), 204);
  const fenced = await remote(p); assert.equal(fenced?.active, false);
  await liveRelease(held); expectStatus(await first, 409, 'CONNECTION_NOT_PENDING');
  assert.deepEqual(await remote(p), fenced);
  assert.ok((await gateEvents(0)).some((e) => e.rule_id === 'cleanup' && e.phase === 'upstream_completed' && e.status === 409));
  assert.equal((await connectionOf(p)).status, 'disabled');
  await grantState(p.grant, p.connection.id, 'revoked');
});
addRace('h', 'DELETE during a held Canvas add_deployment ends with the platform off and the connection disabled', async (b) => {
  const second = canvasDeploymentId(), grant = await addGrant(b, second);
  await watchAll('pass', [{ id: 'activate', method: 'PATCH', pathRegex: addActivate(b, second), action: 'hold_after', times: 1 },
    { id: 'cleanup', method: 'PATCH', pathRegex: ANY_RECORD, action: 'pass', times: 10 }]);
  const first = addDeployment(b, second, grant), held = await gatePhase('activate', 'held_after');
  expectStatus(await app(b.s, 'DELETE', connPath(b.connection.id)), 204);
  await liveRelease(held); expectStatus(await first, 409, 'CONNECTION_NOT_READY');
  const platform = await admin('GET', `/api/platforms/${b.platformId}`); expectStatus(platform, 200);
  assert.equal(platform.json.active, false);
  assert.equal((await connectionOf(b)).status, 'disabled');
});
race('i', 'a timed-out late Canvas activation gives no authority; the same grant then finishes (A2)', async (p) => {
  await watchAll('pass', [activateRule('activate', 'hold_before')]);
  const first = apply(p), held = await gatePhase('activate', 'held_before');
  await gatePhase('activate', 'caller_gone', 7000); expectStatus(await first, 502, 'LTI_SERVICE_ERROR');
  await release(held.request_id); await upstream(held, 200);
  assert.equal((await remote(p))?.active, true);
  await unapprovedInitial(p);
  expectStatus(await apply(p), 200); await approved(p);
});
race('j', 'two parallel Canvas redemptions with one grant commit exactly once', async (p) => {
  const both = await Promise.all([apply(p), apply(p)]);
  assert.ok(both.some((r) => r.status === 200));
  assert.ok(both.every((r) => r.status === 200 || (r.status === 409 && r.json.details.message === 'GRANT_IN_USE')));
  assert.equal(logEvents('grant_redeemed', p.since, { grant_id: p.grant.id }).length, 1);
  await approved(p);
});
race('m', 'a failed Canvas compensation leaves no authority; a second revoke fences the record', async (p) => {
  await watchAll('pass', [activateRule('activate', 'hold_after'), activateRule('compensate', 'fail_before')]);
  const first = apply(p), held = await gatePhase('activate', 'held_after');
  assert.equal((await revoke(p.grant.id)).code, 0);
  await liveRelease(held); expectStatus(await first, 403, 'GRANT_INVALID');
  assert.equal(logEvents('grant_compensation_failed', p.since, { grant_id: p.grant.id }).length, 1);
  assert.equal((await remote(p))?.active, true);
  await unapprovedInitial(p);
  const again = await revoke(p.grant.id); assert.equal(again.code, 0); assert.match(again.stdout, /\bfenced\b/);
  assert.equal((await remote(p))?.active, false);
});
async function staleCompensation(p: Race) {
  await watchAll('pass', [activateRule('activate', 'hold_after'), activateRule('compensate', 'hold_before')]);
  const first = apply(p), held = await gatePhase('activate', 'held_after');
  const replacement = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId);
  await liveRelease(held);
  const compensation = await gatePhase('compensate', 'held_before');
  await gatePhase('compensate', 'caller_gone', 7000); expectStatus(await first, 403, 'GRANT_INVALID');
  assert.equal(logEvents('grant_compensation_failed', p.since, { grant_id: p.grant.id }).length, 1);
  return { compensation, replacement };
}
race('n', 'a late Canvas compensation loses to the replacement binding', async (p) => {
  const { compensation, replacement } = await staleCompensation(p);
  expectStatus(await apply(p, replacement), 200); const newer = await remote(p);
  await release(compensation.request_id); await upstream(compensation, 409);
  assert.deepEqual(await remote(p), newer);
  await canvasGradeWorks(await approved(p));
});
addRace('p-create', 'a timed-out Canvas added deployment create, revoke and late write give no authority', async (b, pub, key) => {
  const second = canvasDeploymentId(), grant = await addGrant(b, second);
  await watchAll('pass', [{ id: 'create', method: 'POST', pathRegex: addCreate(b), action: 'hold_before', times: 1 }]);
  const first = addDeployment(b, second, grant), held = await gatePhase('create', 'held_before');
  await gatePhase('create', 'caller_gone', 7000); expectStatus(await first, 502, 'LTI_SERVICE_ERROR');
  await firstWorks(b, pub, key);
  const absent = await revoke(grant.id); assert.equal(absent.code, 0); assert.match(absent.stdout, /\babsent\b/);
  await release(held.request_id); await upstream(held, 201);
  assert.equal((await deployment(b, second))?.active, false);
  refused((await canvasLaunch({ ...b, deploymentId: second })).login, 'DEPLOYMENT_NOT_ACTIVE', [403]);
  await firstWorks(b, pub, key);
  const fenced = await revoke(grant.id); assert.equal(fenced.code, 0); assert.match(fenced.stdout, /\bfenced\b/);
  await firstWorks(b, pub, key, true);
});
addRace('p-activate', 'a late Canvas added deployment activation has no authority until revoke fences it', async (b, pub, key) => {
  const second = canvasDeploymentId(), grant = await addGrant(b, second);
  await watchAll('pass', [{ id: 'activate', method: 'PATCH', pathRegex: addActivate(b, second), action: 'hold_before', times: 1 }]);
  const first = addDeployment(b, second, grant), held = await gatePhase('activate', 'held_before');
  await gatePhase('activate', 'caller_gone', 7000); expectStatus(await first, 502, 'LTI_SERVICE_ERROR');
  await release(held.request_id); await upstream(held, 200);
  assert.equal((await deployment(b, second))?.active, true);
  await unapprovedAdded(b, second);
  await firstWorks(b, pub, key);
  const fenced = await revoke(grant.id); assert.equal(fenced.code, 0); assert.match(fenced.stdout, /\bfenced\b/);
  assert.equal((await deployment(b, second))?.active, false);
  expectStatus(await addDeployment(b, second, grant), 403, 'GRANT_INVALID');
  await firstWorks(b, pub, key, true);
});
race('q', 'a Canvas replacement creates first after the old S1 times out; the old create cannot overwrite', async (p) => {
  await watchAll('pass', [createRule('create', 'hold_before')]);
  const first = apply(p), held = await gatePhase('create', 'held_before');
  const replacement = await canvasGrant(p.s, p.connection, p.clientId, p.deploymentId);
  assert.ok(Date.now() - Date.parse(held.ts) < 4500, 'BLOCKED: replacement CLI exceeded the live schedule');
  expectStatus(await apply(p, replacement), 409, 'GRANT_IN_USE');
  await gatePhase('create', 'caller_gone', 7000); expectStatus(await first, 502, 'LTI_SERVICE_ERROR');
  expectStatus(await apply(p, replacement), 200); const newer = await remote(p);
  await release(held.request_id); await upstream(held, 409);
  assert.deepEqual(await remote(p), newer);
  assert.equal((await canvasLaunch(p)).response.status, 303);
});
race('r', 'a Canvas replacement reads again when the old compensation lands between its S2 and S3', async (p) => {
  const { compensation, replacement } = await staleCompensation(p);
  await watchAll('pass', [activateRule('replacement', 'hold_before'), activateRule('retry', 'pass', 3)]);
  const next = apply(p, replacement), held = await gatePhase('replacement', 'held_before');
  await release(compensation.request_id); await upstream(compensation, 200);
  assert.equal((await remote(p))?.active, false);
  await liveRelease(held); await upstream(held, 409); expectStatus(await next, 200);
  assert.ok((await gateEvents(0)).some((e) => e.rule_id === 'retry' && e.phase === 'upstream_completed' && e.status === 200));
  await canvasGradeWorks(await approved(p));
});
addRace('s-retry', 'a lost Canvas added deployment S3 answer: no authority before approval; retry finishes once', async (b, pub) => {
  const second = canvasDeploymentId(), grant = await addGrant(b, second), since = Date.now();
  await watchAll('pass', [{ id: 'activate', method: 'PATCH', pathRegex: addActivate(b, second), action: 'drop_after', times: 1 }]);
  expectStatus(await addDeployment(b, second, grant), 502, 'LTI_SERVICE_ERROR');
  await unapprovedAdded(b, second);
  const done = await addDeployment(b, second, grant); expectStatus(done, 200);
  assert.equal(logEvents('grant_redeemed', since, { grant_id: grant.id }).length, 1);
  assert.deepEqual([...done.json.platform.deploymentIds].sort(), [b.deploymentId, second].sort());
  await canvasPlay({ ...b, deploymentId: second }, pub);
});
addRace('s-dead', 'a dead Canvas added deployment handler: no authority until the 60 s lease ends', async (b, pub) => {
  const second = canvasDeploymentId(), grant = await addGrant(b, second);
  await watchAll('pass', [{ id: 'activate', method: 'PATCH', pathRegex: addActivate(b, second), action: 'hold_after', times: 1 }]);
  const started = Date.now(), first = addDeployment(b, second, grant).catch(() => null), held = await gatePhase('activate', 'held_after');
  await restartApp(); await first;
  await unapprovedAdded(b, second);
  leaseWindow(started);
  const refused = await addDeployment(b, second, grant); leaseWindow(started, Date.now(), true);
  expectStatus(refused, 409, 'GRANT_IN_USE');
  await pause(Math.max(0, started + 62_000 - Date.now()));
  expectStatus(await addDeployment(b, second, grant), 200);
  await release(held.request_id).catch(() => undefined);
  await canvasPlay({ ...b, deploymentId: second }, pub);
});
addRace('s-compensation', 'a stale Canvas added deployment compensation cannot undo the replacement; dA is unchanged', async (b, pub, key) => {
  const second = canvasDeploymentId(), grant = await addGrant(b, second), firstRow = await deployment(b, b.deploymentId);
  await watchAll('pass', [{ id: 'activate', method: 'PATCH', pathRegex: addActivate(b, second), action: 'hold_after', times: 1 },
    { id: 'compensate', method: 'PATCH', pathRegex: addActivate(b, second), action: 'hold_before', times: 1 }]);
  const first = addDeployment(b, second, grant), held = await gatePhase('activate', 'held_after');
  const replacement = await addGrant(b, second);
  await liveRelease(held);
  const compensation = await gatePhase('compensate', 'held_before');
  await gatePhase('compensate', 'caller_gone', 7000); expectStatus(await first, 403, 'GRANT_INVALID');
  expectStatus(await addDeployment(b, second, replacement), 200);
  const newer = await deployment(b, second); assert.equal(newer?.active, true);
  await release(compensation.request_id); await upstream(compensation, 409);
  assert.deepEqual(await deployment(b, second), newer);
  assert.deepEqual(await deployment(b, b.deploymentId), firstRow, 'dA is unchanged');
  await canvasPlay(b, pub);
  expectStatus(await service(key, 'GET', '/api/lineitems?url=' + encodeURIComponent(CLOUD.siteA + PATHS.lineitems)), 200);
});
m1Test('M1-37.canvas.t', 'a foreign active Canvas record is not adoptable until its owner is fenced (I4, A3)', async () => {
  const k1 = await fresh(), k2 = await fresh('A', {}, { clientId: k1.clientId, deploymentId: k1.deploymentId });
  await scope('M1-37.canvas.t', k1, async () => {
    await watchAll('pass', [activateRule('activate', 'drop_after')]);
    expectStatus(await apply(k1), 502, 'LTI_SERVICE_ERROR');
    const before = await remote(k1); assert.equal(before?.active, true);
    expectStatus(await apply(k2), 409, 'PLATFORM_IN_USE');
    assert.deepEqual(await remote(k1), before);
    expectStatus(await app(k1.s, 'DELETE', connPath(k1.connection.id)), 204);
    assert.equal((await remote(k1))?.active, false);
    expectStatus(await apply(k2), 200); await approved(k2);
  });
}, 240_000);
for (const [variant, rule] of [['u-after-c', createRule('create', 'drop_after')], ['u-after-c2', activateRule('activate', 'drop_after')]] as const) {
  race(variant, `cancelling a pending Canvas connection after ${variant.slice(8)} fences through the saved target`, async (p) => {
    await watchAll('pass', [rule]);
    expectStatus(await apply(p), 502, 'LTI_SERVICE_ERROR');
    const before = await remote(p); assert.ok(before, 'The lost call made a record');
    expectStatus(await app(p.s, 'DELETE', connPath(p.connection.id)), 204);
    const after = await remote(p); assert.equal(after?.active, false); assert.notEqual(after?.bindingRef, before.bindingRef);
    assert.equal((await connectionOf(p)).status, 'disabled');
    const k2 = await fresh('A', {}, { clientId: p.clientId, deploymentId: p.deploymentId });
    expectStatus(await apply(k2), 200); await approved(k2);
  });
}
