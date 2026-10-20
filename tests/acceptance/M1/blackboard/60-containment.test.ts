import {
  app, assert, bound, cli, connPath, createConnection, denied, expectStatus, gateEvents,
  gatePhase, gateReset, gateRules, httpsRequest, idToken, issueGrant, launch, logEvents,
  m1Test, pause, poll, records, redeem, release, remote, session, sharedPlatform, unique, type Json,
} from '../common/client';
import { commitGrade, gradeWorks, openPlay, publication, results, waitSync } from '../common/course';

const bindingCommand = (verb: 'suspend' | 'release', id: string) =>
  cli('app:binding', [verb, '--connection', id, '--note', 'Independent M1 containment']);
async function unchangedHistory(old: Json, pub: Json, snapshot: Json[], foreign: Json) {
  assert.deepEqual(await results(old, pub), snapshot);
  expectStatus(await app(foreign.s, 'GET', `/app-api/publications/${pub.id}/results`), 404, 'NOT_FOUND');
  const own = await app(old.s, 'GET', '/app-api/publications?connectionId=' + old.connection.id); expectStatus(own, 200);
  assert.ok(own.json.publications.some((p: Json) => p.id === pub.id));
}

async function disablePendingScore(mode: 'delete' | 'suspend') {
  const a = await bound(), b = await bound('B', 'https://learn-b.blackboard.sim.test'), pub = await publication(a);
  // Make B's proof before A's 30 s due window begins.
  const bGrade = await gradeWorks(b);
  const since = Date.now(), play = await openPlay(a, pub, { scoreAnswers: [503, 503] });
  await commitGrade(play, 'scorm12', 7, 10);
  const pending = await waitSync(a, pub, 'pending', 2, 20_000);
  const scoreEvents = logEvents('score_sync', since, { sync_id: pending.id });
  assert.ok(scoreEvents.length, 'Worker emits a score_sync event');
  const last = scoreEvents.at(-1)!;
  const due = Date.parse(String(last.ts)) + 30_000;
  assert.ok(Number.isFinite(due) && due > Date.now() + 10_000, 'Observe the row before its next due time');
  const beforeShared = await remote(b.platformId, b.deploymentId), cursor = (await records()).cursor;
  if (mode === 'delete') expectStatus(await app(a.s, 'DELETE', connPath(a.connection.id)), 204);
  else {
    const off = await bindingCommand('suspend', a.connection.id); assert.equal(off.code, 0); assert.match(off.stdout, /\bfenced\b/);
  }
  assert.equal((await remote(a.platformId, a.deploymentId))?.active, false);
  const disabled = await app(a.s, 'GET', connPath(a.connection.id)); expectStatus(disabled, 200); assert.equal(disabled.json.status, 'disabled');
  denied((await launch({ deploymentId: a.deploymentId, resource: pub.id })).response, 'DEPLOYMENT_NOT_ACTIVE', 403);
  const atDisable = (await results(a, pub))[0].scoreSyncs.find((r: Json) => r.id === pending.id);
  assert.equal(atDisable.status, 'pending'); assert.equal(atDisable.tries, 2);
  await pause(Math.max(0, due - 500 - Date.now()));
  const beforeDue = (await results(a, pub))[0].scoreSyncs.find((r: Json) => r.id === pending.id);
  assert.equal(beforeDue.status, 'pending');
  const failed = await waitSync(a, pub, 'failed', 2, Math.max(1000, due + 9000 - Date.now()));
  assert.equal(failed.lastError, 'CONNECTION_DISABLED');
  assert.equal((await records(cursor)).records.filter((r) => r.kind === 'score' && r.resource === pub.id).length, 0);
  expectStatus(await app(a.s, 'POST', `/app-api/score-syncs/${pending.id}/resend`), 409, 'CONNECTION_NOT_READY');
  expectStatus(await app(a.s, 'POST', `/app-api/publications/${pub.id}/results/refresh`), 409, 'CONNECTION_NOT_READY');
  assert.deepEqual(await remote(b.platformId, b.deploymentId), beforeShared);
  const playB = await openPlay(b, bGrade.pub); assert.ok(playB.playId);
  await gradeWorks(b);
  if (mode === 'suspend') {
    const again = await bindingCommand('suspend', a.connection.id); assert.equal(again.code, 0); assert.match(again.stdout, /\bfenced\b/);
    assert.deepEqual(await remote(b.platformId, b.deploymentId), beforeShared);
  }
}
m1Test('M1-18.blackboard.disconnect', 'DELETE stops due score delivery and preserves the other deployment', () => disablePendingScore('delete'), 240_000);
m1Test('M1-18.blackboard.unredeemed-revoked', 'DELETE revokes an issued approval without activating a deployment', async () => {
  const s = await session(), c = await createConnection(s), d = unique('cancel-grant');
  const grant = await issueGrant(s, c, d);
  expectStatus(await app(s, 'DELETE', connPath(c.id)), 204);
  const list = await cli('app:grant', ['list', '--connection', c.id]); assert.equal(list.code, 0);
  assert.match(list.stdout.split('\n').find((line) => line.includes(grant.id)) ?? '', /\brevoked\b/);
  assert.equal(await remote(await sharedPlatform(), d), undefined);
});
m1Test('M1-38.blackboard.a', 'operator suspend stops due score delivery without a portal session', () => disablePendingScore('suspend'), 240_000);

m1Test('M1-38.blackboard.b', 'release requires suspend, keeps remote row inactive and preserves history', async () => {
  const a = await bound(), b = await bound('B', 'https://learn-b.blackboard.sim.test'), old = await gradeWorks(a);
  const history = await results(a, old.pub), before = await remote(a.platformId, a.deploymentId), unrelated = await remote(b.platformId, b.deploymentId);
  assert.equal((await bindingCommand('release', a.connection.id)).code, 1);
  assert.deepEqual(await remote(a.platformId, a.deploymentId), before);
  assert.equal((await bindingCommand('suspend', a.connection.id)).code, 0);
  const first = await bindingCommand('release', a.connection.id); assert.equal(first.code, 0); assert.match(first.stdout, /\bkept_inactive\b/);
  assert.equal((await remote(a.platformId, a.deploymentId))?.active, false);
  assert.deepEqual(await remote(b.platformId, b.deploymentId), unrelated);
  assert.equal((await bindingCommand('release', a.connection.id)).code, 0);
  await unchangedHistory(a, old.pub, history, b);
  // Foreign-library acquisition is the public oracle that A's reservation and approval were released.
  const c = await createConnection(b.s, { siteUrl: a.connection.siteUrl });
  const grant = await issueGrant(b.s, c, a.deploymentId);
  expectStatus(await redeem(b.s, c, a.deploymentId, grant), 200);
});
m1Test('M1-38.blackboard.c', 'new library binding invalidates old credentials and repeated old release is harmless', async () => {
  const a = await bound(), old = await gradeWorks(a), history = await results(a, old.pub);
  const generation = (await remote(a.platformId, a.deploymentId))!.bindingGeneration;
  assert.equal((await bindingCommand('suspend', a.connection.id)).code, 0);
  assert.equal((await bindingCommand('release', a.connection.id)).code, 0);
  const b = await bound('B', a.connection.siteUrl, a.deploymentId);
  assert.equal((await remote(a.platformId, a.deploymentId))?.bindingGeneration, generation + 1);
  const keyResponse = await import('../common/client').then((m) => m.service(old.play.token.services.serviceKey, 'GET', '/api/lineitems'));
  expectStatus(keyResponse, 401, 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  expectStatus(await idToken(old.play.result.ltik), 401, 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
  const oldLaunch = await launch({ deploymentId: b.deploymentId, resource: old.pub.id });
  assert.equal(oldLaunch.response.status, 303);
  denied(await httpsRequest(String(oldLaunch.response.headers.location)), 'PUBLICATION_NOT_IN_CONNECTION', 404);
  const before = await remote(b.platformId, b.deploymentId);
  const again = await bindingCommand('release', a.connection.id); assert.equal(again.code, 0); assert.match(again.stdout, /\bnot_owned\b/);
  assert.deepEqual(await remote(b.platformId, b.deploymentId), before);
  await unchangedHistory(a, old.pub, history, b);
  await gradeWorks(b);
}, 240_000);
m1Test('M1-38.blackboard.e', 'release and cross-library reuse transfer no publication, attempt or score history', async () => {
  const a = await bound(), old = await gradeWorks(a), history = await results(a, old.pub);
  assert.equal((await bindingCommand('suspend', a.connection.id)).code, 0);
  assert.equal((await bindingCommand('release', a.connection.id)).code, 0);
  const b = await bound('B', a.connection.siteUrl, a.deploymentId), fresh = await gradeWorks(b);
  await unchangedHistory(a, old.pub, history, b);
  const bRows = await results(b, fresh.pub);
  const oldAttempts = history.flatMap((r) => r.attempts.map((attempt: Json) => attempt.attemptId));
  assert.equal(bRows.some((r) => r.attempts.some((attempt: Json) => oldAttempts.includes(attempt.attemptId))), false);
  expectStatus(await app(a.s, 'GET', `/app-api/publications/${fresh.pub.id}/results`), 404, 'NOT_FOUND');
}, 240_000);

for (const step of ['S1', 'S3'] as const) {
  m1Test(`M1-38.blackboard.g-${step === 'S1' ? 'absent' : 'existing'}`, `late ${step} after release cannot gain app authority or change the new binding`, async () => {
    const platformId = await sharedPlatform(), s = await session(), connection = await createConnection(s);
    const deploymentId = unique('late-release'), grant = await issueGrant(s, connection, deploymentId);
    await gateReset();
    const url = `/api/platforms/${platformId}/deployments${step === 'S3' ? '/' + deploymentId : ''}`;
    await gateRules([{ id: 'old-write', method: step === 'S1' ? 'POST' : 'PATCH',
      pathRegex: '^' + url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', action: 'hold_before', times: 1 }]);
    try {
      const first = redeem(s, connection, deploymentId, grant), held = await gatePhase('old-write', 'held_before');
      await gatePhase('old-write', 'caller_gone', 7000); expectStatus(await first, 502, 'LTI_SERVICE_ERROR');
      const suspend = await bindingCommand('suspend', connection.id); assert.equal(suspend.code, 0);
      if (step === 'S1') assert.match(suspend.stdout, /\babsent\b/);
      assert.equal((await bindingCommand('release', connection.id)).code, 0);
      if (step === 'S1') {
        await release(held.request_id);
        const events = await poll(() => gateEvents(0, held.request_id), (r) => r.some((e) => e.phase === 'upstream_completed'), 6000);
        assert.equal(events.find((e) => e.phase === 'upstream_completed')!.status, 201);
        const row = await remote(platformId, deploymentId); assert.equal(row?.active, false); assert.equal(row?.bindingGeneration, 0);
        denied((await launch({ deploymentId })).response, 'DEPLOYMENT_NOT_ACTIVE', 403);
        const repair = await bindingCommand('suspend', connection.id); assert.equal(repair.code, 0); assert.match(repair.stdout, /\bfenced\b/);
        const b = await bound('B', connection.siteUrl, deploymentId);
        assert.equal((await remote(platformId, deploymentId))?.bindingGeneration, 1);
        await gradeWorks(b);
      } else {
        const b = await bound('B', connection.siteUrl, deploymentId), before = await remote(platformId, deploymentId);
        await release(held.request_id);
        const events = await poll(() => gateEvents(0, held.request_id), (r) => r.some((e) => e.phase === 'upstream_completed'), 6000);
        assert.equal(events.find((e) => e.phase === 'upstream_completed')!.status, 409);
        assert.deepEqual(await remote(platformId, deploymentId), before);
        await gradeWorks(b);
      }
      assert.deepEqual((await app(s, 'GET', '/app-api/publications?connectionId=' + connection.id)).json.publications, []);
    } finally { await gateReset(); }
  }, 240_000);
}
