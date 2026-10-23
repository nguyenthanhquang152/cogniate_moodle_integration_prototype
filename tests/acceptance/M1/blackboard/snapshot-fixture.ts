import {
  admin, assert, cli, createConnection, expectStatus, gateEvents, gateReset,
  issueGrant, redeem, remote, session, sharedPlatform, unique, type Json,
} from '../common/client';
import {
  connection, gateMark, grantState, onlyV, readiness, redeemedWithOneAttempt,
} from '../common/snapshot';

export async function pending(platformId?: string, library: 'A' | 'B' = 'A', deploymentId = unique('snapshot')) {
  const pid = platformId ?? await sharedPlatform(), s = await session(library);
  const c = await createConnection(s);
  const grant = await issueGrant(s, c, deploymentId);
  return { s, connection: c, grant, deploymentId, platformId: pid };
}
export type Pending = Awaited<ReturnType<typeof pending>>;
export const apply = (p: Pending) => redeem(p.s, p.connection, p.deploymentId, p.grant);
export async function oneAttempt(p: Pending) {
  return redeemedWithOneAttempt(p.connection.id, p.grant.id, 'PUT', () => apply(p));
}
export async function setActive(platformId: string, active: boolean) {
  expectStatus(await admin('PATCH', '/api/platforms/' + platformId, { active }), 200);
}
export async function issuedAndPending(p: Pending) {
  await grantState(p.connection.id, p.grant.id, 'issued');
  assert.equal((await connection(p.s, p.connection.id)).status, 'pending');
}
export async function successful(p: Pending) {
  const c = await connection(p.s, p.connection.id);
  assert.equal(c.status, 'registered'); assert.deepEqual(c.platform.deploymentIds, [p.deploymentId]);
  assert.equal(c.platform.id, p.platformId, 'Registered binding stays on the pinned platform id');
  assert.equal((await remote(p.platformId, p.deploymentId))?.active, true);
  await grantState(p.connection.id, p.grant.id, 'redeemed');
  return { ...p, connection: c };
}
// Paired fault control is prepared before arming catch-all faults. Each negative
// window is measured separately; the positive cannot hide a preceding GET.
export async function captureControl(p: Pending) {
  const mark = await gateMark();
  expectStatus(await oneAttempt(p), 502, 'LTI_SERVICE_ERROR');
  onlyV(await gateEvents(0), mark); await issuedAndPending(p);
}
export async function issueFailure(p: Pending) {
  return cli('app:grant', ['issue', '--library', p.s.library.id, '--connection', p.connection.id,
    '--site', p.connection.siteUrl, '--client-id', 'qa-bb-app', '--deployment-id', p.deploymentId,
    '--note', 'Independent snapshot mismatch check']);
}
export async function emptyShared<T>(body: (id: string) => Promise<T>) {
  assert.equal(process.env.QA_M1_ISOLATED, '1', 'BLOCKED: destructive shared-platform fixtures need their own fresh host phase');
  const providers = await admin('GET', '/api/providers'); expectStatus(providers, 200);
  assert.equal(providers.json.profiles.find((p: Json) => p.id === 'blackboard-sim').sharedPlatform, null,
    'Isolated fixture starts without a shared platform');
  const created = await admin('POST', '/api/platforms', { profile: 'blackboard-sim', clientId: 'qa-bb-app', name: 'Snapshot isolated' });
  expectStatus(created, 201);
  try { return await body(created.json.id); }
  finally {
    await gateReset();
    // This phase contains only these fixtures; no baseline/provider suite shares it.
    const rows = await admin('GET', '/api/platforms?profile=blackboard-sim'); expectStatus(rows, 200);
    assert.ok(rows.json.platforms.length <= 1);
    for (const p of rows.json.platforms) {
      const full = await admin('GET', '/api/platforms/' + p.id); expectStatus(full, 200);
      for (const d of full.json.deployments) if (d.active) expectStatus(await admin('PATCH',
        `/api/platforms/${p.id}/deployments/${encodeURIComponent(d.deploymentId)}`, { active: false }), 200);
      expectStatus(await admin('DELETE', '/api/platforms/' + p.id), 204);
    }
  }
}
export async function replaceShared(old: string, clientId = 'qa-bb-app') {
  expectStatus(await admin('DELETE', '/api/platforms/' + old), 204);
  const r = await admin('POST', '/api/platforms', { profile: 'blackboard-sim', clientId, name: 'Replacement' });
  expectStatus(r, 201); assert.notEqual(r.json.id, old, 'Platform ids are never reused');
  return String(r.json.id);
}
export async function readinessAttempt(p: Pending, cause: string) {
  const mark = await gateMark(), answer = await oneAttempt(p);
  await readiness(answer, p.connection.id, cause); onlyV(await gateEvents(0), mark);
  await issuedAndPending(p);
  return answer;
}
