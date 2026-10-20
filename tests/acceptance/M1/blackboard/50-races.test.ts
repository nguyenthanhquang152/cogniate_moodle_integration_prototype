import fs from 'node:fs';
import path from 'node:path';
import { artifactsDir } from '../../lib/paths';
import {
  admin, app, assert, cli, connPath, createConnection, denied, expectStatus, gateEvents, gatePhase,
  gateReset, gateRules, host, httpsRequest, issueGrant, launch, logEvents, m1Test, pause,
  poll, records, redeem, release, remote, session, sharedPlatform, unique, type Json,
} from '../common/client';
import { gradeWorks } from '../common/course';

type Race = Awaited<ReturnType<typeof fresh>>;
async function fresh() {
  const platformId = await sharedPlatform(), s = await session(), connection = await createConnection(s);
  const deploymentId = unique('race'), grant = await issueGrant(s, connection, deploymentId);
  const url = `/api/platforms/${platformId}/deployments`;
  return { s, connection, platformId, deploymentId, grant, url, since: Date.now() };
}
const pattern = (value: string) => '^' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
function rule(p: Race, id: string, step: 'S1' | 'S3', action: string) {
  return { id, method: step === 'S1' ? 'POST' : 'PATCH',
    pathRegex: pattern(p.url + (step === 'S3' ? '/' + encodeURIComponent(p.deploymentId) : '')), action, times: 1 };
}
const apply = (p: Race, grant = p.grant) => redeem(p.s, p.connection, p.deploymentId, grant);
async function connection(p: Race) {
  const c = await app(p.s, 'GET', connPath(p.connection.id)); expectStatus(c, 200); return c.json;
}
async function approved(p: Race) {
  const c = await connection(p);
  assert.ok(['registered', 'connected'].includes(c.status));
  assert.deepEqual(c.platform.deploymentIds, [p.deploymentId]);
  assert.equal((await remote(p.platformId, p.deploymentId))?.active, true);
  assert.equal(logEvents('grant_redeemed', p.since, { grant_id: p.grant.id }).length <= 1, true);
  return { ...p, connection: c };
}
async function unapproved(p: Race) {
  const cursor = (await records()).cursor;
  for (const messageType of ['LtiResourceLinkRequest', 'LtiDeepLinkingRequest']) {
    const l = await launch({ deploymentId: p.deploymentId, messageType,
      roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#'
        + (messageType === 'LtiResourceLinkRequest' ? 'Learner' : 'Instructor')] });
    assert.equal(l.response.status, 303);
    const response = await httpsRequest(String(l.response.headers.location));
    denied(response, 'UNKNOWN_PLATFORM', 404);
    assert.equal(response.headers.location, undefined);
  }
  assert.ok(logEvents('launch_rejected', p.since, { reason: 'deployment_not_approved' }).length);
  assert.equal((await records(cursor)).records.filter((r) => ['ags', 'score', 'nrps'].includes(r.kind)).length, 0);
  assert.equal(logEvents('grant_redeemed', p.since, { grant_id: p.grant.id }).length, 0);
}
async function upstream(event: Json, status: number) {
  const all = await poll(() => gateEvents(0, event.request_id),
    (rows) => rows.some((r) => r.phase === 'upstream_completed'), 6000, 25);
  assert.equal(all.find((r) => r.phase === 'upstream_completed')!.status, status);
}
async function liveRelease(event: Json) {
  // A slow local CLI is an infeasible schedule, not evidence against the product.
  const elapsed = Date.now() - Date.parse(event.ts);
  assert.ok(elapsed < 4500, `BLOCKED: live race schedule exceeded its budget (${elapsed} ms); production timeout stays 5 s`);
  await release(event.request_id);
  await poll(() => gateEvents(0, event.request_id), (rows) => rows.some((r) => r.phase === 'delivered'), 1000, 25);
}
async function scope(id: string, action: (p: Race) => Promise<void>) {
  const p = await fresh(); await gateReset();
  try {
    await action(p);
    const shared = await admin('GET', '/api/platforms/' + p.platformId); expectStatus(shared, 200);
    assert.ok(shared.json.deployments.filter((d: Json) => d.deploymentId === p.deploymentId).length <= 1);
    const redeemed = logEvents('grant_redeemed', p.since, { connection_id: p.connection.id });
    const grants = new Set(redeemed.map((event) => event.grant_id));
    assert.equal(redeemed.length, grants.size, 'Each grant is consumed at most once');
  }
  finally {
    const evidence = { id, productSha: process.env.QA_PRODUCT_SHA, testSha: process.env.QA_TEST_SHA,
      environment: 'SIM', started: p.since, events: await gateEvents(),
      remote: await remote(p.platformId, p.deploymentId), connection: await connection(p) };
    fs.writeFileSync(path.join(artifactsDir('acceptance'), id + '.json'), JSON.stringify(evidence, null, 2));
    await gateReset();
  }
}
function race(variant: string, title: string, body: (p: Race) => Promise<void>) {
  const id = `M1-37.blackboard.${variant}`;
  m1Test(id, title, () => scope(id, body), 240_000);
}
async function loseCreate(p: Race, action: 'fail_before' | 'drop_after') {
  await gateRules([rule(p, 'create', 'S1', action)]);
  expectStatus(await apply(p), 502, 'LTI_SERVICE_ERROR');
  assert.equal((await connection(p)).status, 'pending');
}
race('a', 'S1 fail-before reserves the deployment and retry activates generation one', async (p) => {
  await loseCreate(p, 'fail_before'); assert.equal(await remote(p.platformId, p.deploymentId), undefined);
  expectStatus(await apply(p), 200); await approved(p);
  assert.equal((await remote(p.platformId, p.deploymentId))?.bindingGeneration, 1);
});
race('b', 'lost S1 answer leaves an inactive generation-zero record that retry adopts', async (p) => {
  await loseCreate(p, 'drop_after');
  const row = await remote(p.platformId, p.deploymentId); assert.equal(row?.active, false); assert.equal(row?.bindingGeneration, 0);
  denied((await launch({ deploymentId: p.deploymentId })).response, 'DEPLOYMENT_NOT_ACTIVE', 403);
  expectStatus(await apply(p), 200); await approved(p);
  assert.equal((await remote(p.platformId, p.deploymentId))?.bindingGeneration, 1);
});
race('d', 'dead handler retains the lease for 60 seconds and its late S3 loses to the retry', async (p) => {
  await gateRules([rule(p, 'activate', 'S3', 'hold_before')]);
  const started = Date.now(), first = apply(p).catch(() => null), held = await gatePhase('activate', 'held_before');
  assert.equal((await host('m1-restart', { service: 'cogniate-app' })).code, 0);
  await gatePhase('activate', 'caller_gone', 10_000); await first;
  assert.ok(Date.now() - started < 55_000, 'Restart leaves time to observe the live lease');
  expectStatus(await apply(p), 409, 'GRANT_IN_USE');
  await pause(Math.max(0, started + 62_000 - Date.now()));
  expectStatus(await apply(p), 200);
  const before = await remote(p.platformId, p.deploymentId);
  await release(held.request_id); await upstream(held, 409);
  assert.deepEqual(await remote(p.platformId, p.deploymentId), before);
  await gradeWorks(await approved(p));
});
race('e', 'revocation during held S3 cancels approval and compensates with a new ref', async (p) => {
  await gateRules([rule(p, 'activate', 'S3', 'hold_after')]);
  const first = apply(p), held = await gatePhase('activate', 'held_after'), old = await remote(p.platformId, p.deploymentId);
  assert.equal((await cli('app:grant', ['revoke', '--grant', p.grant.id])).code, 0);
  await liveRelease(held); expectStatus(await first, 403, 'GRANT_INVALID');
  const row = await remote(p.platformId, p.deploymentId); assert.equal(row?.active, false); assert.notEqual(row?.bindingRef, old?.bindingRef);
  assert.equal(logEvents('grant_redemption_cancelled', p.since, { reason: 'revoked' }).length, 1);
  const replacement = await issueGrant(p.s, p.connection, p.deploymentId);
  expectStatus(await apply(p, replacement), 200); await approved(p);
});
race('f', 'replacement cannot start during a live lease and adopts after cancellation', async (p) => {
  await gateRules([rule(p, 'activate', 'S3', 'hold_after')]);
  const first = apply(p), held = await gatePhase('activate', 'held_after');
  const replacement = await issueGrant(p.s, p.connection, p.deploymentId), cursor = (await gateEvents()).at(-1)!.seq;
  expectStatus(await apply(p, replacement), 409, 'GRANT_IN_USE');
  assert.equal((await gateEvents(cursor)).length, 0);
  await liveRelease(held); expectStatus(await first, 403, 'GRANT_INVALID');
  assert.equal(logEvents('grant_redemption_cancelled', p.since, { reason: 'replaced' }).length, 1);
  expectStatus(await apply(p, replacement), 200); await approved(p);
});
race('g', 'disconnect during S3 fences the record and stale compensation cannot undo the fence', async (p) => {
  await gateRules([rule(p, 'activate', 'S3', 'hold_after'),
    { ...rule(p, 'cleanup', 'S3', 'pass'), times: 10 }]);
  const first = apply(p), held = await gatePhase('activate', 'held_after');
  expectStatus(await app(p.s, 'DELETE', connPath(p.connection.id)), 204);
  const fenced = await remote(p.platformId, p.deploymentId);
  await liveRelease(held); expectStatus(await first, 409, 'CONNECTION_NOT_PENDING');
  assert.equal(fenced?.active, false); assert.deepEqual(await remote(p.platformId, p.deploymentId), fenced);
  assert.ok((await gateEvents()).some((e) => e.rule_id === 'cleanup' && e.phase === 'upstream_completed' && e.status === 409));
  assert.equal((await connection(p)).status, 'disabled');
});
race('i', 'late S3 can create active remote state without app approval, then retry recovers', async (p) => {
  await gateRules([rule(p, 'activate', 'S3', 'hold_before')]);
  const first = apply(p), held = await gatePhase('activate', 'held_before');
  await gatePhase('activate', 'caller_gone', 7000); expectStatus(await first, 502, 'LTI_SERVICE_ERROR');
  await release(held.request_id); await upstream(held, 200);
  const row = await remote(p.platformId, p.deploymentId); assert.equal(row?.active, true);
  await unapproved(p);
  expectStatus(await apply(p), 200); await approved(p);
  assert.equal((await remote(p.platformId, p.deploymentId))?.bindingGeneration, row!.bindingGeneration + 1);
});
race('j', 'parallel same-grant redemptions commit exactly once', async (p) => {
  const both = await Promise.all([apply(p), apply(p)]);
  assert.ok(both.some((r) => r.status === 200));
  assert.ok(both.every((r) => r.status === 200 || (r.status === 409 && r.json.details.message === 'GRANT_IN_USE')));
  assert.equal(logEvents('grant_redeemed', p.since, { grant_id: p.grant.id }).length, 1);
  await approved(p);
});
for (const action of ['fail_before', 'drop_after'] as const) {
  race(action === 'fail_before' ? 'k-after-a' : 'k-after-b', 'pending cancel cleans ' + action, async (p) => {
    await loseCreate(p, action);
    const before = await remote(p.platformId, p.deploymentId);
    expectStatus(await app(p.s, 'DELETE', connPath(p.connection.id)), 204);
    const after = await remote(p.platformId, p.deploymentId);
    if (action === 'fail_before') assert.equal(after, undefined);
    else { assert.equal(after?.active, false); assert.notEqual(after?.bindingRef, before?.bindingRef); }
    assert.equal((await connection(p)).status, 'disabled');
  });
}
race('l', 'pending reservation cannot switch deployment through CLI or redemption', async (p) => {
  await loseCreate(p, 'fail_before');
  const other = unique('other'), listBefore = await cli('app:grant', ['list', '--connection', p.connection.id]);
  const command = await cli('app:grant', ['issue', '--library', p.s.library.id, '--connection', p.connection.id,
    '--site', p.connection.siteUrl, '--client-id', 'qa-bb-app', '--deployment-id', other, '--note', 'fixed deployment negative']);
  assert.equal(command.code, 1);
  assert.equal((await cli('app:grant', ['list', '--connection', p.connection.id])).stdout, listBefore.stdout);
  const response = await redeem(p.s, p.connection, other, p.grant); expectStatus(response, 422, 'GRANT_MISMATCH');
  assert.deepEqual(response.json.details.fields, ['deploymentId']); assert.equal(await remote(p.platformId, other), undefined);
  expectStatus(await apply(p), 200);
});
race('m', 'failed compensation leaves no authority and repeated revoke repairs the record', async (p) => {
  await gateRules([rule(p, 'activate', 'S3', 'hold_after'), rule(p, 'compensate', 'S3', 'fail_before')]);
  const first = apply(p), held = await gatePhase('activate', 'held_after');
  assert.equal((await cli('app:grant', ['revoke', '--grant', p.grant.id])).code, 0);
  await liveRelease(held); expectStatus(await first, 403, 'GRANT_INVALID');
  assert.equal(logEvents('grant_compensation_failed', p.since, { grant_id: p.grant.id }).length, 1);
  await unapproved(p);
  const again = await cli('app:grant', ['revoke', '--grant', p.grant.id]); assert.equal(again.code, 0); assert.match(again.stdout, /\bfenced\b/);
  assert.equal((await remote(p.platformId, p.deploymentId))?.active, false);
});
async function staleCompensation(p: Race) {
  await gateRules([rule(p, 'activate', 'S3', 'hold_after'), rule(p, 'compensate', 'S3', 'hold_before')]);
  const first = apply(p), held = await gatePhase('activate', 'held_after');
  const replacement = await issueGrant(p.s, p.connection, p.deploymentId);
  await liveRelease(held);
  const compensation = await gatePhase('compensate', 'held_before');
  await gatePhase('compensate', 'caller_gone', 7000); expectStatus(await first, 403, 'GRANT_INVALID');
  assert.equal(logEvents('grant_compensation_failed', p.since, { grant_id: p.grant.id }).length, 1);
  return { compensation, replacement };
}
race('n', 'late compensation loses to a successful replacement binding', async (p) => {
  const { compensation, replacement } = await staleCompensation(p);
  expectStatus(await apply(p, replacement), 200); const newer = await remote(p.platformId, p.deploymentId);
  await release(compensation.request_id); await upstream(compensation, 409);
  assert.deepEqual(await remote(p.platformId, p.deploymentId), newer);
  await gradeWorks(await approved(p));
});
race('o', 'operator suspend fences a dead attempt and release waits for its lease', async (p) => {
  await gateRules([rule(p, 'activate', 'S3', 'hold_before')]);
  const start = Date.now(), first = apply(p).catch(() => null), held = await gatePhase('activate', 'held_before');
  assert.equal((await host('m1-restart', { service: 'cogniate-app' })).code, 0);
  await gatePhase('activate', 'caller_gone', 10_000); await first;
  const suspend = await cli('app:binding', ['suspend', '--connection', p.connection.id, '--note', 'M1 race o']);
  assert.equal(suspend.code, 0); assert.match(suspend.stdout, /\bfenced\b/);
  assert.ok(Date.now() - start < 55_000, 'Lease refusal must be observed before 60 seconds');
  const early = await cli('app:binding', ['release', '--connection', p.connection.id, '--note', 'M1 race o']);
  assert.equal(early.code, 1); assert.match(early.stdout + early.stderr, /redemption may still run/);
  await pause(Math.max(0, start + 62_000 - Date.now()));
  assert.equal((await cli('app:binding', ['release', '--connection', p.connection.id, '--note', 'M1 race o'])).code, 0);
  await release(held.request_id); await upstream(held, 409);
  assert.equal((await remote(p.platformId, p.deploymentId))?.active, false);
});
race('q', 'replacement creates first after old S1 times out and the old create cannot overwrite', async (p) => {
  await gateRules([rule(p, 'create', 'S1', 'hold_before')]);
  const first = apply(p), held = await gatePhase('create', 'held_before');
  const replacement = await issueGrant(p.s, p.connection, p.deploymentId);
  assert.ok(Date.now() - Date.parse(held.ts) < 4500, 'BLOCKED: replacement CLI exceeded live schedule');
  expectStatus(await apply(p, replacement), 409, 'GRANT_IN_USE');
  await gatePhase('create', 'caller_gone', 7000); expectStatus(await first, 502, 'LTI_SERVICE_ERROR');
  expectStatus(await apply(p, replacement), 200); const newer = await remote(p.platformId, p.deploymentId);
  await release(held.request_id); await upstream(held, 409);
  assert.deepEqual(await remote(p.platformId, p.deploymentId), newer);
  await gradeWorks(await approved(p));
});
race('r', 'replacement rereads when old compensation wins between S2 and S3', async (p) => {
  const { compensation, replacement } = await staleCompensation(p);
  await gateRules([rule(p, 'replacement', 'S3', 'hold_before'), { ...rule(p, 'retry', 'S3', 'pass'), times: 3 }]);
  const next = apply(p, replacement), held = await gatePhase('replacement', 'held_before');
  await release(compensation.request_id); await upstream(compensation, 200);
  assert.equal((await remote(p.platformId, p.deploymentId))?.active, false);
  await liveRelease(held); await upstream(held, 409); expectStatus(await next, 200);
  assert.ok((await gateEvents()).some((e) => e.rule_id === 'retry' && e.phase === 'upstream_completed' && e.status === 200));
  await gradeWorks(await approved(p));
});
