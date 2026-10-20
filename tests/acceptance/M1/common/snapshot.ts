// Public interface shared with Canvas QA. Contract ccdd9ef, app §§4.4,4.7,12.
import fs from 'node:fs';
import path from 'node:path';
import { readLog, waitForLog } from '../../lib/logs';
import { artifactsDir } from '../../lib/paths';
import {
  app, assert, cli, connPath, expectStatus, gateEvents, gatePhase, gateReset, gateRules,
  host, httpsRequest, poll, release, unique, urls, type Json,
} from './client';
import {
  READINESS_TITLE, READINESS_ACTION, auditCursor, auditWindow, received, onlyV, vBeforeMutation,
} from './snapshot-oracle.mjs';
import { armCapture } from './gate-capture.mjs';
export { received, onlyV, vBeforeMutation, READINESS_TITLE, READINESS_ACTION };
export const exactPath = (p: string) => '^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
export async function gateMark() { return (await gateEvents(0)).at(-1)?.seq ?? 0; }
export async function watchAll(action = 'pass', faults: Json[] = []) {
  return armCapture({ setRules: gateRules, readEvents: () => gateEvents(0) },
    { action, faults, idPrefix: unique('snapshot-watch') });
}
function capture() {
  let log;
  try { log = readLog('cogniate-app'); } catch { throw new Error('BLOCKED: app log unavailable'); }
  assert.deepEqual(log.badLines, [], 'BLOCKED: incomplete app log capture');
  return log.entries;
}
export async function completed(answer: { status: number; traceId: string }, method: string) {
  assert.match(answer.traceId, /^[A-Za-z0-9-]{16,64}$/, 'BLOCKED: response trace id missing');
  const hit = await waitForLog('cogniate-app', (e) => e.event === 'http_request' && e.trace_id === answer.traceId, 15_000);
  assert.ok(hit, 'BLOCKED: same-process HTTP completion control missing');
  assert.equal(hit.entry.method, method); assert.equal(Number(hit.entry.status), answer.status);
  return hit;
}
export async function observedAttempt<T extends { status: number; traceId: string }>(
  connectionId: string, method: string, request: () => Promise<T>, count: 0 | 1, grantId?: string,
) {
  const cursor = auditCursor(capture());
  const answer = await request();
  await completed(answer, method);
  auditWindow(capture(), cursor, answer, method, connectionId, count, grantId);
  return answer;
}
export const refusedWithoutAttempt = <T extends { status: number; traceId: string }>(
  connectionId: string, method: string, request: () => Promise<T>,
) => observedAttempt(connectionId, method, request, 0);
export const redeemedWithOneAttempt = <T extends { status: number; traceId: string }>(
  connectionId: string, grantId: string, method: string, request: () => Promise<T>,
) => observedAttempt(connectionId, method, request, 1, grantId);
export async function noRequests<T>(request: () => Promise<T>) {
  const cursor = await gateMark();
  const answer = await request();
  assert.deepEqual(received(await gateEvents(0), cursor), [], 'Zero requests on every HTTP method, including GET');
  return answer;
}
export async function grantList(connectionId: string) {
  const r = await cli('app:grant', ['list', '--connection', connectionId]); assert.equal(r.code, 0);
  // Preserve only grant rows, not elapsed command times or npm banners.
  return r.stdout.split('\n').filter((line) => /\bgrt_[A-Za-z0-9_-]+\b/.test(line)).sort();
}
export async function grantState(connectionId: string, grantId: string, state: string) {
  const line = (await grantList(connectionId)).find((line) => line.includes(grantId));
  assert.ok(line, 'Grant is listed'); assert.match(line, new RegExp(`\\b${state}\\b`));
}
export async function readiness(answer: any, connectionId: string, cause: string) {
  expectStatus(answer, 409, 'PROVIDER_NOT_READY'); await completed(answer, 'PUT');
  const text = JSON.stringify(answer.json);
  assert.ok(text.includes(READINESS_TITLE), 'Neutral readiness title');
  assert.ok(text.includes(READINESS_ACTION), 'Neutral readiness action');
  const diagnosis = (value: any): boolean => value !== null && typeof value === 'object'
    && Object.entries(value).some(([key, v]) => ['cause', 'reason'].includes(key) || diagnosis(v));
  assert.equal(diagnosis(answer.json), false, 'No public diagnosis field');
  const lines = capture().filter(({ entry }) => entry.event === 'provider_not_ready'
    && entry.trace_id === answer.traceId && entry.connection_id === connectionId);
  assert.equal(lines.length, 1); assert.equal(lines[0].entry.cause, cause);
  assert.equal(lines[0].entry.level, 'warn');
  assert.ok(['blackboard-sim', 'canvas-sim-cloud', 'canvas-self-hosted'].includes(String(lines[0].entry.profile)));
}
export async function liveRelease(event: Json) {
  const elapsed = Date.now() - Date.parse(event.ts);
  assert.ok(elapsed < 4500, `BLOCKED: live schedule elapsed ${elapsed} ms; timeout remains 5 s`);
  assert.equal((await gateEvents(0, event.request_id)).some((e) => e.phase === 'caller_gone'), false,
    'BLOCKED: caller ended before live release');
  await release(event.request_id);
  try { await gatePhase(event.rule_id, 'delivered', 1000, event.seq - 1); }
  catch { throw new Error(`BLOCKED: live release was not delivered within 5 s; elapsed ${Date.now() - Date.parse(event.ts)} ms`); }
}
export async function restartApp() {
  const r = await host('m1-restart', { service: 'cogniate-app' });
  assert.equal(r.code, 0);
  await poll(async () => {
    try { return await httpsRequest(urls.app + '/healthz'); } catch { return { status: 0 }; }
  }, (r) => r.status === 200, 20_000, 100);
}
export async function connection(s: any, id: string) {
  const r = await app(s, 'GET', connPath(id)); expectStatus(r, 200); return r.json;
}
export function saveSnapshotEvidence(id: string, value: Json) {
  fs.writeFileSync(path.join(artifactsDir('acceptance'), id + '.json'), JSON.stringify({
    id, environment: 'SIM', productSha: process.env.QA_PRODUCT_SHA, testSha: process.env.QA_TEST_SHA, ...value,
  }, null, 2));
}
export async function snapshotScope(id: string, body: () => Promise<void>) {
  await gateReset(); const since = await watchAll(), startedAt = new Date().toISOString();
  try { await body(); }
  finally {
    saveSnapshotEvidence(id, { startedAt, endedAt: new Date().toISOString(), events: await gateEvents(since) });
    await gateReset();
  }
}
