// Populated 011 -> 012, public fixtures only. Host owns stopped backup/upgrade.
import fs from 'node:fs';
import path from 'node:path';
import { artifactsDir } from '../../lib/paths';
import {
  admin, app, assert, bound, cli, connPath, expectStatus, gateEvents, gatePhase, gateReset,
  logEvents, m1Test, redeem, remote, rememberSecret, service, session, type Json,
} from './client';
import {
  addDeployment, addGrant, binding, canvasBound, canvasClientId, canvasConnection, canvasDeploymentId,
  canvasGrant, canvasPlay, canvasRedeem, platformsFor,
} from '../canvas/canvas';
import { openPlay, publication } from './course';
import {
  connection, exactPath, gateMark, grantList, grantState, noRequests, readiness, received,
  refusedWithoutAttempt, redeemedWithOneAttempt, snapshotScope, watchAll,
} from './snapshot';
import { apply, captureControl, issueFailure, oneAttempt, pending, type Pending } from '../blackboard/snapshot-fixture';

const stage = process.env.QA_M1_MIGRATION_STAGE;
const file = () => path.join(artifactsDir('acceptance'), 'm1-snapshot-migration.raw.json');
const load = (): Json => JSON.parse(fs.readFileSync(file(), 'utf8'));
function store(state: Json) { fs.writeFileSync(file(), JSON.stringify(state), { mode: 0o600 }); }
async function preserve(state: Json) {
  for (const saved of [state.a, state.b]) {
    const now = await connection(saved.s, saved.connection.id);
    assert.deepEqual(now.platform, saved.connection.platform, 'Unrelated committed binding is unchanged');
  }
  // Fresh signed launches prove approvals and restore simulator scenarios after
  // a host upgrade. The saved service keys remain the expected values.
  const canvas = await canvasPlay(state.a, state.canvasPub), blackboard = await openPlay(state.b, state.blackboardPub);
  assert.equal(canvas.token.services.serviceKey, state.canvasKey);
  assert.equal(blackboard.token.services.serviceKey, state.blackboardKey);
  expectStatus(await service(state.canvasKey, 'GET', '/api/lineitems'), 200);
  expectStatus(await service(state.blackboardKey, 'GET', '/api/lineitems'), 200);
}
function upgradeCase(variant: string, title: string, body: (state: Json) => Promise<void>) {
  const id = `M1-38.common.${variant}`;
  m1Test(id, title, () => snapshotScope(id, async () => {
    const state = load();
    assert.equal(state.sourceSha, '9f96f7b24cd0aed702e4dc40373bdda4307aad31');
    assert.equal(process.env.QA_M1_EXECUTING_SHA, process.env.QA_PRODUCT_SHA);
    // Seed cookies can expire across a long build; refresh only through public login.
    for (const value of [state.a, state.b, state.oldB, state.oldC]) value.s = await session();
    await body(state);
    store(state);
  }), 300_000);
}
if (stage === 'snapshot-seed') m1Test('M1-38.common.h1', 'seed public 011 states with valid grants, reservation and lost-S3 orphan', async () => {
  assert.equal(process.env.QA_M1_EXECUTING_SHA, '9f96f7b24cd0aed702e4dc40373bdda4307aad31');
  await gateReset(); await watchAll();
  const a = await canvasBound(), b = await bound();
  const canvasPub = await publication(a), canvasRun = await canvasPlay(a, canvasPub);
  const blackboardPub = await publication(b), blackboardRun = await openPlay(b, blackboardPub);
  const canvasKey = canvasRun.token.services.serviceKey, blackboardKey = blackboardRun.token.services.serviceKey;
  assert.ok(canvasKey && blackboardKey); rememberSecret(canvasKey); rememberSecret(blackboardKey);
  const addId = canvasDeploymentId(), add = await addGrant(a, addId);
  const oldB = await pending(b.platformId);
  await watchAll('pass', [{ id: 'old-bb-fail', method: 'POST', pathRegex: exactPath(`/api/platforms/${b.platformId}/deployments`),
    action: 'fail_before', times: 1 }]);
  expectStatus(await apply(oldB), 502, 'LTI_SERVICE_ERROR');
  assert.equal(await remote(b.platformId, oldB.deploymentId), undefined);
  await grantState(oldB.connection.id, oldB.grant.id, 'issued');
  await gateReset(); await watchAll();
  const s = await session(), c = await canvasConnection(s), clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  const grant = await canvasGrant(s, c, clientId, deploymentId);
  await watchAll('pass', [{ id: 'old-cv-lost', method: 'PATCH', pathRegex: '^/api/platforms/[^/]+$', action: 'drop_after', times: 1 }]);
  expectStatus(await canvasRedeem(s, c, clientId, deploymentId, grant), 502, 'LTI_SERVICE_ERROR');
  const orphan = (await platformsFor(clientId))[0]; assert.ok(orphan); assert.equal(orphan.active, true);
  assert.equal((await connection(s, c.id)).status, 'pending');
  await grantState(c.id, grant.id, 'issued'); await gateReset(); await watchAll();
  const oldC = binding(s, c, clientId, deploymentId, grant);
  // Launches above may move registered -> connected; persist the actual stable view.
  a.connection = await connection(a.s, a.connection.id); b.connection = await connection(b.s, b.connection.id);
  const state = { sourceSha: process.env.QA_M1_EXECUTING_SHA, a, b, oldB, oldC, orphanId: orphan.id,
    canvasKey, blackboardKey, canvasPub, blackboardPub, addId, add };
  store(state); await preserve(state);
}, 300_000);

if (stage === 'snapshot-upgrade') {
  upgradeCase('h2', 'old pending valid codes hit 4a; unknown code and issue keep grant-first behavior', async (state) => {
    const control = await pending(state.b.platformId);
    for (const provider of ['oldB', 'oldC']) {
      const p = state[provider], before = await grantList(p.connection.id);
      const send = (code: string) => provider === 'oldB'
        ? redeem(p.s, p.connection, p.deploymentId, { code })
        : canvasRedeem(p.s, p.connection, p.clientId, p.deploymentId, { code });
      await watchAll('fail_before');
      const r = await noRequests(() => refusedWithoutAttempt(p.connection.id, 'PUT', () => send(p.grant.code)));
      await readiness(r, p.connection.id, 'no_snapshot');
      const unknown = await noRequests(() => refusedWithoutAttempt(p.connection.id, 'PUT', () => send('b'.repeat(43))));
      expectStatus(unknown, 403, 'GRANT_INVALID');
      assert.equal(logEvents('grant_rejected', 0, { trace_id: unknown.traceId, reason: 'not_found' }).length, 1);
      const issue = await noRequests(() => provider === 'oldB' ? issueFailure(p as Pending) : cli('app:grant',
        ['issue', '--library', p.s.library.id, '--connection', p.connection.id, '--site', p.connection.siteUrl,
          '--service-url', p.connection.serviceUrl, '--client-id', p.clientId, '--deployment-id', p.deploymentId,
          '--note', 'Old snapshot refusal']));
      assert.equal(issue.code, 1); assert.deepEqual(await grantList(p.connection.id), before);
      await captureControl(control);
      await gateReset(); await watchAll();
    }
    await preserve(state);
  });
  upgradeCase('h3', 'old registered repeat is local and redeemed initial code is rejected before state', async (state) => {
    const control = await pending(state.b.platformId);
    await watchAll('fail_before');
    const a = state.a, b = state.b;
    const ra = await noRequests(() => refusedWithoutAttempt(a.connection.id, 'PUT', () =>
      canvasRedeem(a.s, a.connection, a.clientId, a.deploymentId, a.grant)));
    const rb = await noRequests(() => refusedWithoutAttempt(b.connection.id, 'PUT', () =>
      redeem(b.s, b.connection, b.deploymentId, b.grant)));
    expectStatus(ra, 200); expectStatus(rb, 200);
    assert.deepEqual(ra.json.platform, a.connection.platform); assert.deepEqual(rb.json.platform, b.connection.platform);
    const r = await noRequests(() => refusedWithoutAttempt(a.connection.id, 'PUT', () =>
      canvasRedeem(a.s, a.connection, a.clientId, canvasDeploymentId(), a.grant)));
    expectStatus(r, 403, 'GRANT_INVALID');
    assert.equal(logEvents('grant_rejected', 0, { trace_id: r.traceId, reason: 'redeemed' }).length, 1);
    await captureControl(control);
    await gateReset(); await watchAll(); await preserve(state);
  });
  upgradeCase('h4', 'old Canvas adds seeded and freshly approved deployments while its original key survives', async (state) => {
    const a = state.a;
    for (const seeded of [true, false]) {
      const d = seeded ? state.addId : canvasDeploymentId();
      const mark = await watchAll(), grant = seeded ? state.add : await addGrant(a, d);
      expectStatus(await redeemedWithOneAttempt(a.connection.id, grant.id, 'POST', () => addDeployment(a, d, grant)), 200);
      assert.equal(received(await gateEvents(0), mark).some((e) => e.path === '/api/providers'), false);
      a.connection = await connection(a.s, a.connection.id);
      assert.ok(a.connection.platform.deploymentIds.includes(d));
      assert.ok(a.connection.platform.deploymentIds.includes(a.deploymentId));
      expectStatus(await service(state.canvasKey, 'GET', '/api/lineitems'), 200);
    }
    await preserve(state);
  });
  upgradeCase('h5', 'old reservation and active orphan require suspend/release before rebinding', async (state) => {
    for (const provider of ['oldB', 'oldC']) {
      const old = state[provider];
      const isB = provider === 'oldB';
      const fresh = isB ? await pending(old.platformId, 'A', old.deploymentId) : await (async () => {
        const c = await canvasConnection(old.s);
        const g = await canvasGrant(old.s, c, old.clientId, old.deploymentId);
        return binding(old.s, c, old.clientId, old.deploymentId, g);
      })();
      const send = () => isB ? apply(fresh as Pending) : canvasRedeem(fresh.s, fresh.connection,
        (fresh as Json).clientId, fresh.deploymentId, fresh.grant);
      const control = isB ? await pending(old.platformId) : null;
      const mark = await watchAll(isB ? 'fail_before' : 'pass');
      const negative = isB ? await refusedWithoutAttempt(fresh.connection.id, 'PUT', send)
        : await redeemedWithOneAttempt(fresh.connection.id, fresh.grant.id, 'PUT', send);
      expectStatus(negative, 409, isB ? 'DEPLOYMENT_IN_USE' : 'PLATFORM_IN_USE');
      if (isB) assert.deepEqual(received(await gateEvents(0), mark), []);
      else assert.deepEqual(received(await gateEvents(0), mark).map((e) => e.method), ['POST', 'GET']);
      if (control) await captureControl(control);
      await gateReset(); await watchAll();
      await grantState(fresh.connection.id, fresh.grant.id, 'issued');
      await preserve(state);
      const suspended = await cli('app:binding', ['suspend', '--connection', old.connection.id, '--note', '011 snapshot recovery']);
      assert.equal(suspended.code, 0); assert.match(suspended.stdout, isB ? /\babsent\b/ : /\bfenced\b/);
      assert.equal((await connection(old.s, old.connection.id)).status, 'disabled');
      await grantState(old.connection.id, old.grant.id, 'revoked'); await preserve(state);
      const released = await cli('app:binding', ['release', '--connection', old.connection.id, '--note', '011 snapshot recovery']);
      assert.equal(released.code, 0); assert.match(released.stdout, isB ? /\babsent\b/ : /\bdeleted\b/);
      if (isB) assert.equal(await remote(old.platformId, old.deploymentId), undefined);
      else expectStatus(await admin('GET', '/api/platforms/' + state.orphanId), 404, 'UNREGISTERED_PLATFORM');
      await preserve(state);
      if (isB) {
        await watchAll('pass', [{ id: 'fresh-bb-stage', method: 'POST', pathRegex: exactPath(`/api/platforms/${old.platformId}/deployments`),
          action: 'hold_after', times: 1 }]);
        const request = oneAttempt(fresh as Pending), held = await gatePhase('fresh-bb-stage', 'held_after');
        const row = await remote(old.platformId, old.deploymentId);
        assert.equal(row?.active, false); assert.equal(row?.bindingGeneration, 0);
        const { liveRelease } = await import('./snapshot'); await liveRelease(held);
        expectStatus(await request, 200);
        assert.equal((await remote(old.platformId, old.deploymentId))?.bindingGeneration, 1);
      } else {
        const r = await redeemedWithOneAttempt(fresh.connection.id, fresh.grant.id, 'PUT', send);
        expectStatus(r, 200); assert.notEqual(r.json.platform.id, state.orphanId);
      }
      await gateReset(); await watchAll(); await preserve(state);
      await grantState(fresh.connection.id, fresh.grant.id, 'redeemed');
    }
  });
}
if (!['snapshot-seed', 'snapshot-upgrade'].includes(stage ?? '')) throw new Error('Explicit snapshot migration stage required');
