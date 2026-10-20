import { waitForLog } from '../../lib/logs';
import {
  admin, app, assert, bound, cli, connPath, createConnection, denied, expectStatus, gateEvents, gatePhase,
  gateReset, gateRules, issueGrant, launch, logEvents, m1Test, redeem, release, remote, service,
  session, unique, type Json,
} from '../common/client';
import { openPlay, publication } from '../common/course';
import {
  completed, connection, exactPath, gateMark, grantList, grantState, liveRelease, noRequests, onlyV,
  readiness, received, refusedWithoutAttempt, restartApp, snapshotScope, vBeforeMutation, watchAll,
} from '../common/snapshot';
import { apply, captureControl, issuedAndPending, oneAttempt, pending, setActive, successful, type Pending } from './snapshot-fixture';

const caseOf = (ac: number, variant: string, title: string, body: () => Promise<void>) => {
  const id = `M1-${ac}.blackboard.${variant}`;
  m1Test(id, title, () => snapshotScope(id, body), 240_000);
};
async function local(p: Pending, request: () => ReturnType<typeof apply>, status: number, code: string) {
  const r = await noRequests(() => refusedWithoutAttempt(p.connection.id, 'PUT', request));
  expectStatus(r, status, code); return r;
}
async function vRule(id: string, action: string) {
  await gateRules([{ id, method: 'GET', pathRegex: '^/api/providers$', action, times: 1 }]);
}
async function freshRedemption(p: Pending) {
  const rule = unique('phase-before-v');
  await vRule(rule, 'hold_before');
  const mark = await gateMark(), request = oneAttempt(p), held = await gatePhase(rule, 'held_before');
  // A naive provider preflight before phase 1 waits here and cannot produce this
  // committed-attempt event until V is delivered. No clock comparison is used.
  const started = await waitForLog('cogniate-app', (e) =>
    e.event === 'grant_attempt_started' && e.grant_id === p.grant.id, 1000);
  assert.ok(started, 'BLOCKED: phase-1 positive control is missing while V is held');
  await liveRelease(held); expectStatus(await request, 200);
  vBeforeMutation(await gateEvents(0), mark); await successful(p);
}
async function keyOf(p: Json) {
  const pub = await publication(p), play = await openPlay(p, pub);
  const key = play.token.services.serviceKey; assert.ok(key);
  expectStatus(await service(key, 'GET', '/api/lineitems'), 200);
  return key;
}
caseOf(37, 'v2', 'unknown code refuses locally with a bounded no-attempt oracle', async () => {
  const p = await pending(); await watchAll('fail_before');
  const r = await local(p, () => redeem(p.s, p.connection, p.deploymentId, { code: 'a'.repeat(43) }), 403, 'GRANT_INVALID');
  assert.equal(logEvents('grant_rejected', 0, { trace_id: r.traceId, reason: 'not_found' }).length, 1);
  await captureControl(p);
});
caseOf(37, 'v5', 'a dead handler retains its lease across restart without provider reads', async () => {
  const p = await pending(), control = await pending(p.platformId);
  const rule = unique('dead');
  await gateRules([{ id: rule, method: 'POST', pathRegex: exactPath(`/api/platforms/${p.platformId}/deployments`), action: 'hold_before', times: 1 }]);
  const first = apply(p).catch(() => null), held = await gatePhase(rule, 'held_before');
  const started = await waitForLog('cogniate-app', (e) => e.event === 'grant_attempt_started' && e.grant_id === p.grant.id, 1000);
  assert.ok(started, 'BLOCKED: first attempt was not captured before restart');
  await restartApp(); await first;
  assert.ok(Date.now() - Date.parse(String(started.entry.ts)) < 55_000, 'BLOCKED: restart missed the 60 s lease window');
  await grantState(p.connection.id, p.grant.id, 'redeeming');
  await watchAll('fail_before');
  await local(p, () => apply(p), 409, 'GRANT_IN_USE'); await captureControl(control);
  await release(held.request_id, 'drop');
});
caseOf(37, 'v7', 'foreign reservation is refused locally without changing the approved key', async () => {
  const a = await bound(), key = await keyOf(a);
  const b = await pending(a.platformId, 'B', a.deploymentId), control = await pending(a.platformId);
  const before = await remote(a.platformId, a.deploymentId);
  await watchAll('fail_before'); await local(b, () => apply(b), 409, 'DEPLOYMENT_IN_USE');
  await captureControl(control); await gateReset();
  assert.deepEqual(await remote(a.platformId, a.deploymentId), before);
  expectStatus(await service(key, 'GET', '/api/lineitems'), 200);
});
caseOf(37, 'v9', 'grant mismatch precedes a foreign deployment reservation', async () => {
  const a = await bound(), p = await pending(a.platformId);
  await watchAll('fail_before');
  const r = await local(p, () => redeem(p.s, p.connection, a.deploymentId, p.grant), 422, 'GRANT_MISMATCH');
  assert.deepEqual(r.json.details.fields, ['deploymentId']); await captureControl(p);
});
caseOf(37, 'v11', 'explicit wrong client is strict-body refusal while matching and omitted clients work', async () => {
  const p = await pending(), matching = await pending(p.platformId);
  await watchAll('fail_before');
  const r = await local(p, () => app(p.s, 'PUT', connPath(p.connection.id) + '/platform',
    { deploymentId: p.deploymentId, grantCode: p.grant.code, clientId: 'wrong-client' }), 422, 'INVALID_PLATFORM_VALUES');
  assert.deepEqual(r.json.details.fields, ['clientId']);
  assert.equal(logEvents('grant_rejected', 0, { trace_id: r.traceId }).length, 0);
  await captureControl(p); await gateReset();
  expectStatus(await oneAttempt(p), 200);
  expectStatus(await app(matching.s, 'PUT', connPath(matching.connection.id) + '/platform',
    { deploymentId: matching.deploymentId, grantCode: matching.grant.code, clientId: 'qa-bb-app' }), 200);
});
caseOf(37, 'v12', 'local guards and finalized repeat retain precedence across a cold restart', async () => {
  const a = await bound(), b = await session('B'), p = await pending(a.platformId), control = await pending(a.platformId);
  const spare = await issueGrant(a.s, p.connection, p.deploymentId); // finalized repeat must not consume this code
  const before = await grantList(p.connection.id);
  for (const cold of [false, true]) {
    if (cold) await restartApp();
    await watchAll('fail_before');
    await noRequests(() => refusedWithoutAttempt(a.connection.id, 'PUT', async () => {
      const r = await app(b, 'PUT', connPath(a.connection.id) + '/platform', {}); expectStatus(r, 404, 'NOT_FOUND'); return r;
    }));
    await local(p, () => app(p.s, 'PUT', connPath(p.connection.id) + '/platform', {}), 422, 'INVALID_PLATFORM_VALUES');
    const repeat = await noRequests(() => refusedWithoutAttempt(a.connection.id, 'PUT', () =>
      redeem(a.s, a.connection, a.deploymentId, spare)));
    expectStatus(repeat, 200); assert.deepEqual(repeat.json.platform, a.connection.platform);
    await captureControl(control); await gateReset();
  }
  assert.deepEqual(await grantList(p.connection.id), before);
});
caseOf(37, 'x1', 'V transport failure frees the grant and retry has a new V and attempt', async () => {
  const p = await pending(); await vRule('v-fail', 'fail_before');
  const mark = await gateMark(); expectStatus(await oneAttempt(p), 502, 'LTI_SERVICE_ERROR');
  onlyV(await gateEvents(0), mark); assert.equal(await remote(p.platformId, p.deploymentId), undefined);
  await issuedAndPending(p); await gateReset();
  const retry = await gateMark(); expectStatus(await oneAttempt(p), 200);
  vBeforeMutation(await gateEvents(0), retry); await successful(p);
});
caseOf(37, 'x2', 'timed-out V cannot resume after its late answer is delivered', async () => {
  const p = await pending(); await vRule('v-timeout', 'hold_after');
  const mark = await gateMark(), request = oneAttempt(p), held = await gatePhase('v-timeout', 'held_after');
  expectStatus(await request, 502, 'LTI_SERVICE_ERROR');
  await gatePhase('v-timeout', 'caller_gone', 2000); await release(held.request_id);
  onlyV(await gateEvents(0), mark); await issuedAndPending(p);
  assert.equal(await remote(p.platformId, p.deploymentId), undefined);
  await gateReset(); expectStatus(await oneAttempt(p), 200); await successful(p);
});
caseOf(37, 'y1', 'deactivation after V pins the target but parent readiness is not atomic', async () => {
  const p = await pending();
  try {
    await vRule('v-parent', 'hold_after');
    const request = oneAttempt(p), held = await gatePhase('v-parent', 'held_after');
    await setActive(p.platformId, false); await liveRelease(held);
    expectStatus(await request, 200); await successful(p);
    denied((await launch({ deploymentId: p.deploymentId })).response, 'PLATFORM_NOT_ACTIVE', 403);
    await setActive(p.platformId, true);
    assert.equal((await launch({ deploymentId: p.deploymentId })).response.status, 303);
  } finally { await setActive(p.platformId, true); }
});
for (const [variant, action, mismatch] of [
  ['z1', 'revoke', false], ['z2', 'delete', false], ['z3', 'suspend', false], ['z4', 'revoke', true],
] as const) caseOf(37, variant, `${action} wins over ${mismatch ? 'non-matching' : 'matching'} held V`, async () => {
  const p = await pending();
  try {
    if (mismatch) await setActive(p.platformId, false);
    await vRule('v-cancel', 'hold_after');
    const mark = await gateMark(), request = oneAttempt(p), held = await gatePhase('v-cancel', 'held_after');
    if (action === 'delete') expectStatus(await app(p.s, 'DELETE', connPath(p.connection.id)), 204);
    else {
      const r = await cli(action === 'revoke' ? 'app:grant' : 'app:binding',
        action === 'revoke' ? ['revoke', '--grant', p.grant.id] : ['suspend', '--connection', p.connection.id, '--note', 'QA held V']);
      assert.equal(r.code, 0);
    }
    await liveRelease(held);
    const r = await request;
    expectStatus(r, action === 'revoke' ? 403 : 409, action === 'revoke' ? 'GRANT_INVALID' : 'CONNECTION_NOT_PENDING');
    const calls = received(await gateEvents(0), mark);
    assert.equal(calls.some((e) => ['POST', 'PATCH', 'DELETE'].includes(e.method)), false, 'No S1 or compensation; cleanup may only read absent target');
    assert.equal(calls.filter((e) => e.path === '/api/providers').length, 1);
    assert.equal(await remote(p.platformId, p.deploymentId), undefined);
    await grantState(p.connection.id, p.grant.id, 'revoked');
    assert.equal(logEvents('grant_redemption_cancelled', 0, { trace_id: r.traceId,
      reason: action === 'revoke' ? 'revoked' : 'connection_changed' }).length, 1);
  } finally { await setActive(p.platformId, true); }
});
caseOf(37, 'z5', 'cleanup fences the earlier lost-S3 target even after a new V failure', async () => {
  const p = await pending();
  try {
    await gateRules([{ id: 'lost-activation', method: 'PATCH',
      pathRegex: exactPath(`/api/platforms/${p.platformId}/deployments/${p.deploymentId}`), action: 'drop_after', times: 1 }]);
    expectStatus(await oneAttempt(p), 502, 'LTI_SERVICE_ERROR');
    const a = await remote(p.platformId, p.deploymentId); assert.equal(a?.active, true);
    await setActive(p.platformId, false); await gateReset();
    await readiness(await oneAttempt(p), p.connection.id, 'platform_inactive');
    assert.deepEqual(await remote(p.platformId, p.deploymentId), a);
    const deleted = await app(p.s, 'DELETE', connPath(p.connection.id)); expectStatus(deleted, 204);
    await completed(deleted, 'DELETE');
    const fenced = await remote(p.platformId, p.deploymentId);
    assert.equal(fenced?.active, false); assert.notEqual(fenced?.bindingRef, a?.bindingRef);
    assert.equal(logEvents('binding_fenced', 0, { connection_id: p.connection.id, result: 'fenced' }).length, 1);
    const again = await cli('app:binding', ['suspend', '--connection', p.connection.id, '--note', 'QA repeated fence']);
    assert.equal(again.code, 0); assert.match(again.stdout, /\bfenced\b/);
    const next = await remote(p.platformId, p.deploymentId);
    assert.equal(next?.active, false); assert.notEqual(next?.bindingRef, fenced?.bindingRef);
    assert.equal(next?.bindingGeneration, fenced?.bindingGeneration);
  } finally { await setActive(p.platformId, true); }
});
caseOf(38, 'i3', 'fresh Blackboard snapshot redeems with one V before staged mutation', async () => {
  await freshRedemption(await pending());
});
caseOf(38, 'i4', 'Blackboard snapshot persists through both restart boundaries', async () => {
  // Capture at create, restart, issue, restart, then measure redemption only.
  const platformId = await (await import('../common/client')).sharedPlatform(), s = await session();
  const c = await createConnection(s); await restartApp();
  const d = unique('restart'), grant = await issueGrant(s, c, d); await restartApp();
  await freshRedemption({ s, connection: c, deploymentId: d, grant, platformId });
});
