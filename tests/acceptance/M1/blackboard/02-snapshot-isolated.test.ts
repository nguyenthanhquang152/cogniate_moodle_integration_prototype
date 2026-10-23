// These cases run in a separate fresh project, never alongside a populated suite.
import {
  admin, assert, expectStatus, gateEvents, gatePhase, gateReset, m1Test, remote,
} from '../common/client';
import {
  gateMark, grantList, grantState, liveRelease, noRequests, readiness, received, refusedWithoutAttempt,
  restartApp, snapshotScope, vBeforeMutation, watchAll,
} from '../common/snapshot';
import {
  apply, captureControl, emptyShared, issueFailure, issuedAndPending, oneAttempt, pending, readinessAttempt, replaceShared,
  setActive, successful,
} from './snapshot-fixture';

function isolated(ac: number, variant: string, title: string, body: (id: string) => Promise<void>) {
  const id = `M1-${ac}.blackboard.${variant}`;
  m1Test(id, title, () => snapshotScope(id, () => emptyShared(body)), 240_000);
}
isolated(37, 'w', 'inactive V retains the reservation and the same code retries after reactivation', async (id) => {
  const a = await pending(id), b = await pending(id, 'B', a.deploymentId), control = await pending(id);
  await setActive(id, false);
  await watchAll();
  await readinessAttempt(a, 'platform_inactive');
  assert.equal(await remote(id, a.deploymentId), undefined);
  await setActive(id, true);
  await watchAll('fail_before');
  expectStatus(await noRequests(() => refusedWithoutAttempt(b.connection.id, 'PUT', () => apply(b))), 409, 'DEPLOYMENT_IN_USE');
  await captureControl(control);
  await gateReset(); const mark = await watchAll();
  expectStatus(await oneAttempt(a), 200); vBeforeMutation(await gateEvents(0), mark); await successful(a);
});
isolated(37, 'y2', 'a shared platform replaced after V cannot receive writes from the old attempt', async (id) => {
  const p = await pending(id);
  await watchAll('pass', [{ id: 'replace-after-v', method: 'GET', pathRegex: '^/api/providers$', action: 'hold_after', times: 1 }]);
  const mark = await gateMark(), request = oneAttempt(p), held = await gatePhase('replace-after-v', 'held_after');
  const replacement = await replaceShared(id);
  await liveRelease(held); const answer = await request;
  await readiness(answer, p.connection.id, 'platform_changed');
  const calls = received(await gateEvents(0), mark);
  assert.deepEqual(calls.map((e) => [e.method, e.path]),
    [['GET', '/api/providers'], ['POST', `/api/platforms/${id}/deployments`]]);
  assert.equal(await remote(replacement, p.deploymentId), undefined);
  await issuedAndPending(p);
});
isolated(29, 'k1', 'same-client platform-id drift stays pinned across restart and a new connection succeeds', async (id) => {
  const p = await pending(id), before = await grantList(p.connection.id);
  const replacement = await replaceShared(id);
  for (const restart of [false, true]) {
    if (restart) await restartApp();
    const mark = await watchAll(), r = await issueFailure(p);
    assert.equal(r.code, 1);
    const calls = received(await gateEvents(0), mark);
    assert.deepEqual(calls.map((e) => [e.method, e.path]), [['GET', '/api/providers']]);
    assert.deepEqual(await grantList(p.connection.id), before, 'Failed issue does not revoke the saved grant');
    await readinessAttempt(p, 'platform_changed');
    assert.equal(await remote(replacement, p.deploymentId), undefined);
  }
  const current = await pending(replacement);
  const mark = await watchAll(); expectStatus(await oneAttempt(current), 200);
  vBeforeMutation(await gateEvents(0), mark); await successful(current);
});
isolated(29, 'k2', 'issue refuses a missing shared platform without altering grants', async (id) => {
  const p = await pending(id), before = await grantList(p.connection.id);
  expectStatus(await admin('DELETE', '/api/platforms/' + id), 204);
  assert.equal((await issueFailure(p)).code, 1);
  assert.deepEqual(await grantList(p.connection.id), before);
  await grantState(p.connection.id, p.grant.id, 'issued');
});
isolated(29, 'k3', 'issue refuses a replacement with another client without altering grants', async (id) => {
  const p = await pending(id), before = await grantList(p.connection.id);
  await replaceShared(id, 'qa-other-bb-client');
  assert.equal((await issueFailure(p)).code, 1);
  assert.deepEqual(await grantList(p.connection.id), before);
  await grantState(p.connection.id, p.grant.id, 'issued');
});
