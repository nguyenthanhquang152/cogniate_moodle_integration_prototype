// Public Canvas fixtures for the applied ccdd9ef contract. Existing canvas.ts exports stay unchanged.
import {
  assert, createConnection, expectStatus, gateEvents, issueGrant, logEvents, redeem,
  session, sharedPlatform, unique, type Json,
} from '../common/client';
import { gateMark, onlyV, redeemedWithOneAttempt } from '../common/snapshot';
import {
  canvasClientId, canvasConnection, canvasDeploymentId, canvasGrant, canvasRedeem, grantState, platformsFor,
} from './canvas';
import { initialCalls } from './snapshot-oracle.mjs';

export async function snapshotCanvas(patch: Json = {}) {
  const s = await session(), connection = await canvasConnection(s, patch);
  const clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  const grant = await canvasGrant(s, connection, clientId, deploymentId);
  return { s, connection, clientId, deploymentId, grant };
}
export type SnapshotCanvas = Awaited<ReturnType<typeof snapshotCanvas>>;
export const applySnapshot = (p: SnapshotCanvas) =>
  canvasRedeem(p.s, p.connection, p.clientId, p.deploymentId, p.grant);
export async function oneCanvasAttempt(p: SnapshotCanvas) {
  const answer = await redeemedWithOneAttempt(p.connection.id, p.grant.id, 'PUT', () => applySnapshot(p));
  const rows = logEvents('grant_attempt_started', 0, { connection_id: p.connection.id, trace_id: answer.traceId });
  assert.equal(rows.length, 1); assert.equal(rows[0].purpose, 'initial');
  return answer;
}
export async function freshCanvasSuccess(p: SnapshotCanvas, issuer: string) {
  const mark = await gateMark(), answer = await oneCanvasAttempt(p); expectStatus(answer, 200);
  initialCalls(await gateEvents(0), mark, answer.json.platform.id);
  assert.equal(answer.json.status, 'registered');
  assert.equal(answer.json.platform.issuer, issuer);
  assert.deepEqual(answer.json.platform.deploymentIds, [p.deploymentId]);
  const platforms = await platformsFor(p.clientId, issuer);
  assert.equal(platforms.length, 1); assert.equal(platforms[0].url, issuer);
  assert.equal(platforms[0].active, true); assert.equal(platforms[0].id, answer.json.platform.id);
  await grantState(p.grant, p.connection.id, 'redeemed');
  return answer;
}
// Prepare this before any negative cursor. A valid Blackboard request under the
// identical all-method fault proves that provider GET traffic cannot be hidden.
export async function prepareVControl() {
  await sharedPlatform(); const s = await session(), connection = await createConnection(s);
  const deploymentId = unique('canvas-v-control'), grant = await issueGrant(s, connection, deploymentId);
  return { s, connection, deploymentId, grant };
}
export async function failedVControl(p: Awaited<ReturnType<typeof prepareVControl>>) {
  const mark = await gateMark();
  const answer = await redeemedWithOneAttempt(p.connection.id, p.grant.id, 'PUT',
    () => redeem(p.s, p.connection, p.deploymentId, p.grant));
  expectStatus(answer, 502, 'LTI_SERVICE_ERROR'); onlyV(await gateEvents(0), mark);
  await grantState(p.grant, p.connection.id, 'issued');
}
