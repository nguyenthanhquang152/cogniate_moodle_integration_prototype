// Applied M1 37(v1,v3,v4,v6,v8,v10,v12), 38(i1,i2,i4). Preparation only until a frozen full run.
import {
  app, assert, connPath, expectStatus, gateEvents, gatePhase, gateReset,
  host, httpsRequest, logEvents, m1Test, poll, release, session, urls,
} from '../common/client';
import {
  completed, gateMark, grantList, noRequests, received, refusedWithoutAttempt, redeemedWithOneAttempt,
  restartApp, snapshotScope, watchAll,
} from '../common/snapshot';
import {
  CLOUD, SELF, addDeployment, addGrant, canvasBound, canvasClientId, canvasConnection, canvasDeploymentId,
  canvasGrant, canvasRedeem, connectionOf, escape, grantState,
} from './canvas';
import { applySnapshot, failedVControl, freshCanvasSuccess, prepareVControl, snapshotCanvas } from './snapshot-fixture';
import { leaseWindow } from './snapshot-oracle.mjs';

/** AC-M1-37 dead handler: SIGKILL, so the old process cannot let its held LTI call time out and clear its lease. */
async function killApp() {
  assert.equal((await host('m1-restart', { service: 'cogniate-app', mode: 'kill' })).code, 0);
  await poll(async () => {
    try { return await httpsRequest(urls.app + '/healthz'); } catch { return { status: 0 }; }
  }, (r) => r.status === 200, 20_000, 100);
}

function snapshotCase(ac: number, variant: string, title: string, body: () => Promise<void>) {
  const id = `M1-${ac}.canvas.${variant}`;
  m1Test(id, title, () => snapshotScope(id, body), 240_000);
}
for (const [variant, added, mismatch] of [
  ['v1', false, false], ['v3', true, false], ['v8', false, true], ['v10', true, true],
] as const) {
  snapshotCase(37, variant, `Canvas ${added ? 'added deployment' : 'initial'} ${mismatch ? 'mismatch' : 'unknown code'} is local with a bounded audit control`, async () => {
    const p = added ? await canvasBound() : await snapshotCanvas();
    const deploymentId = added ? canvasDeploymentId() : p.deploymentId;
    const grant = added ? await addGrant(p as Awaited<ReturnType<typeof canvasBound>>, deploymentId) : p.grant;
    const control = await prepareVControl(), before = await connectionOf(p);
    const method = added ? 'POST' : 'PUT';
    const request = (d: string, g: { code: string }) => added
      ? app(p.s, 'POST', connPath(p.connection.id) + '/deployments', { deploymentId: d, grantCode: g.code })
      : canvasRedeem(p.s, p.connection, p.clientId, d, g);
    await watchAll('fail_before'); // all create, issue and preparation reads finished
    const answer = await noRequests(() => refusedWithoutAttempt(p.connection.id, method,
      () => request(mismatch ? canvasDeploymentId() : deploymentId, mismatch ? grant : { code: 'A'.repeat(43) })));
    expectStatus(answer, mismatch ? 422 : 403, mismatch ? 'GRANT_MISMATCH' : 'GRANT_INVALID');
    if (mismatch) assert.deepEqual(answer.json.details.fields, ['deploymentId']);
    const rejected = logEvents('grant_rejected', 0, { trace_id: answer.traceId, connection_id: p.connection.id });
    assert.deepEqual(rejected.map((e) => e.reason), [mismatch ? 'mismatch' : 'not_found']);
    assert.deepEqual(await connectionOf(p), before); await grantState(grant, p.connection.id, 'issued');
    await failedVControl(control); // separate positive phase-1 event, fails at V under the same faults
    await gateReset(); await watchAll();
    const mark = await gateMark();
    const success = await redeemedWithOneAttempt(p.connection.id, grant.id, method, () => request(deploymentId, grant));
    expectStatus(success, 200);
    const calls = received(await gateEvents(0), mark);
    assert.ok(calls.length >= 2); assert.equal(calls.some((e) => e.path === '/api/providers'), false);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].path, added ? `/api/platforms/${p.connection.platform.id}/deployments` : '/api/platforms');
    assert.deepEqual([...success.json.platform.deploymentIds].sort(),
      (added ? [p.deploymentId, deploymentId] : [deploymentId]).sort());
    await grantState(grant, p.connection.id, 'redeemed');
  });
}
for (const [variant, added] of [['v4', false], ['v6', true]] as const) {
  snapshotCase(37, variant, `dead Canvas ${added ? 'added deployment' : 'initial'} handler refuses within its lease using a new healthy-process cursor`, async () => {
    const p = added ? await canvasBound() : await snapshotCanvas();
    const deploymentId = added ? canvasDeploymentId() : p.deploymentId;
    const grant = added ? await addGrant(p as Awaited<ReturnType<typeof canvasBound>>, deploymentId) : p.grant;
    const control = await prepareVControl(), method = added ? 'POST' : 'PUT';
    const request = () => added
      ? app(p.s, 'POST', connPath(p.connection.id) + '/deployments', { deploymentId, grantCode: grant.code })
      : applySnapshot(p);
    const activation = added
      ? `^/api/platforms/${escape(p.connection.platform.id)}/deployments/${escape(encodeURIComponent(deploymentId))}$`
      : '^/api/platforms/[^/]+$';
    await watchAll('pass', [{ id: 'canvas-dead-s3', method: 'PATCH', pathRegex: activation, action: 'hold_before', times: 1 }]);
    const started = Date.now(), first = request().catch(() => null);
    const held = await gatePhase('canvas-dead-s3', 'held_before');
    await killApp(); await gatePhase('canvas-dead-s3', 'caller_gone', 10_000);
    const firstAnswer = await first;
    assert.notEqual(firstAnswer?.json?.details?.message, 'LTI_SERVICE_ERROR',
      'BLOCKED: the old handler timed out before the restart killed it');
    await completed(await app(p.s, 'GET', connPath(p.connection.id)), 'GET');
    leaseWindow(started);
    await watchAll('fail_before');
    const answer = await noRequests(() => refusedWithoutAttempt(p.connection.id, method, request));
    leaseWindow(started, Date.now(), true); expectStatus(answer, 409, 'GRANT_IN_USE');
    await failedVControl(control);
    // d/s-dead keep their existing late-write controls. Drop this held S3 without
    // forwarding; this case owns only the local lease refusal in the new process.
    await release(held.request_id, 'drop');
  });
}
snapshotCase(37, 'v12', 'Canvas local guards and finalized repeats keep first-failure order before and after app restart', async () => {
  const pending = await snapshotCanvas(), b = await canvasBound(), other = await session('B');
  const second = canvasDeploymentId(), secondGrant = await addGrant(b, second);
  expectStatus(await addDeployment(b, second, secondGrant), 200);
  const unused = await addGrant(b, second), control = await prepareVControl();
  const lists = await Promise.all([grantList(pending.connection.id), grantList(b.connection.id)]);
  for (const restart of [false, true]) {
    if (restart) {
      await restartApp();
      await completed(await app(pending.s, 'GET', connPath(pending.connection.id)), 'GET');
    }
    await watchAll('fail_before');
    const mark = await gateMark();
    const checked = async (id: string, method: string, request: () => ReturnType<typeof app>, status: number, code?: string) => {
      const answer = await noRequests(() => refusedWithoutAttempt(id, method, request));
      expectStatus(answer, status, code);
      assert.deepEqual(logEvents('grant_rejected', 0, { trace_id: answer.traceId }), [], 'Endpoint guard/repeat never checks a grant');
      return answer;
    };
    // Library guard precedes malformed body and pending-state checks on both endpoints.
    for (const [p, suffix, method] of [
      [pending, '/platform', 'PUT'], [pending, '/deployments', 'POST'], [b, '/deployments', 'POST'],
    ] as const) await checked(p.connection.id, method, () => app(other, method, connPath(p.connection.id) + suffix, {}), 404, 'NOT_FOUND');
    // Pending POST status precedes strict body (C-2), while PUT strict body precedes phase 1.
    await checked(pending.connection.id, 'POST', () => app(pending.s, 'POST', connPath(pending.connection.id) + '/deployments', {}), 409, 'CONNECTION_NOT_READY');
    for (const p of [pending, b]) {
      const malformed = await checked(p.connection.id, 'PUT', () => app(p.s, 'PUT', connPath(p.connection.id) + '/platform',
        { clientId: p.clientId, deploymentId: p.deploymentId }), 422, 'INVALID_PLATFORM_VALUES');
      assert.deepEqual(malformed.json.details.fields, ['grantCode']);
    }
    const badAdd = await checked(b.connection.id, 'POST',
      () => app(b.s, 'POST', connPath(b.connection.id) + '/deployments', { deploymentId: second }), 422, 'INVALID_PLATFORM_VALUES');
    assert.deepEqual(badAdd.json.details.fields, ['grantCode']);
    for (const grant of [{ code: 'A'.repeat(43) }, unused]) {
      const repeat = await checked(b.connection.id, 'PUT',
        () => canvasRedeem(b.s, b.connection, b.clientId, b.deploymentId, grant), 200);
      assert.equal(repeat.json.platform.id, b.platformId);
      const addRepeat = await checked(b.connection.id, 'POST', () => addDeployment(b, second, grant), 200);
      assert.deepEqual([...addRepeat.json.platform.deploymentIds].sort(), [b.deploymentId, second].sort());
    }
    assert.deepEqual(received(await gateEvents(0), mark), []);
    assert.deepEqual(await Promise.all([grantList(pending.connection.id), grantList(b.connection.id)]), lists);
    await failedVControl(control); await gateReset();
  }
  await watchAll(); await freshCanvasSuccess(pending, CLOUD.issuer);
});

for (const [variant, patch, issuer] of [
  ['i1', { siteUrl: 'HTTPS://School-A.Canvas.Sim.Test:443/' }, CLOUD.issuer],
  ['i2', { profile: SELF.profile, siteUrl: 'HTTPS://Canvas-Self.Sim.Test:443/', serviceUrl: SELF.service }, SELF.site],
] as const) {
  snapshotCase(38, variant, `fresh Canvas ${variant === 'i1' ? 'cloud' : 'self-hosted'} connection uses its saved canonical issuer`, async () => {
    const p = await snapshotCanvas(patch); await watchAll(); await freshCanvasSuccess(p, issuer);
  });
}
snapshotCase(38, 'i4', 'Canvas cloud and self-hosted snapshots survive restarts between create, issue and redemption', async () => {
  for (const [patch, issuer] of [
    [{ siteUrl: 'HTTPS://School-A.Canvas.Sim.Test:443/' }, CLOUD.issuer],
    [{ profile: SELF.profile, siteUrl: 'HTTPS://Canvas-Self.Sim.Test:443/', serviceUrl: SELF.service }, SELF.site],
  ] as const) {
    const s = await session(), connection = await canvasConnection(s, patch);
    await completed(await app(s, 'GET', connPath(connection.id)), 'GET');
    await restartApp();
    const clientId = canvasClientId(), deploymentId = canvasDeploymentId();
    const grant = await canvasGrant(s, connection, clientId, deploymentId);
    await restartApp(); // no attempt event is compared across either restart
    await completed(await app(s, 'GET', connPath(connection.id)), 'GET');
    await watchAll();
    await freshCanvasSuccess({ s, connection, clientId, deploymentId, grant }, issuer);
    await gateReset();
  }
});
