// Canvas M1 helpers (Canvas QA). Values come from ADR-011 revision 6, the contracts and the M1/M3 criteria.
// They use public APIs, the QA simulator, the transport gate and the operator CLI only. No product module.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sinkHitsSince } from '../../lib/lti';
import { artifactsDir } from '../../lib/paths';
import {
  CANVAS_LOGIN, CLOUD, ROLE, SELF, canvasClientId, canvasDeepLinking, canvasDeploymentId, hostOf,
} from './constants';
import {
  APP, DL, admin, app, assert, cli, connPath, expectStatus, gateEvents, gateReset, gateRules, httpsRequest, idToken,
  issueGrant, launch, logEvents, parseForm, poll, records, rememberSecret, session, unique, urls, type Json,
} from '../common/client';
import { commitGrade, publication, results, waitSync } from '../common/course';
import { METHODS } from '../common/snapshot-oracle.mjs';

export {
  CANVAS_LOGIN, CANVAS_SCORE, CLOUD, PATHS, ROLE, SELF, canvasClientId, canvasDeepLinking, canvasDeploymentId, escape, hostOf,
} from './constants';

export interface CanvasBinding {
  s: any; connection: Json; clientId: string; deploymentId: string; grant: { id: string; code: string; stdout: string };
  provider: string; serviceHost: string; pageHost: string; platformId: string;
}
export async function canvasConnection(s: any, patch: Json = {}) {
  const response = await app(s as any, 'POST', '/app-api/connections', {
    name: unique('M1 Canvas'), siteUrl: CLOUD.siteA, method: 'manual', lms: 'canvas', profile: CLOUD.profile, ...patch,
  });
  expectStatus(response, 201);
  return response.json;
}
export async function canvasGrant(s: any, connection: Json, clientId: string, deploymentId: string, extra: Record<string, string> = {}) {
  return issueGrant(s, connection, deploymentId, { 'client-id': clientId, 'service-url': connection.serviceUrl, ...extra });
}
export const addGrant = (b: CanvasBinding, deploymentId: string, extra: Record<string, string> = {}) =>
  canvasGrant(b.s, b.connection, b.clientId, deploymentId, { purpose: 'add_deployment', ...extra });
export const canvasRedeem = (s: any, c: Json, clientId: string, deploymentId: string, grant?: { code: string }, extra: Json = {}) =>
  app(s as any, 'PUT', connPath(c.id) + '/platform', { clientId, deploymentId, ...(grant ? { grantCode: grant.code } : {}), ...extra });
export const addDeployment = (b: CanvasBinding, deploymentId: string, grant?: { code: string }) =>
  app(b.s as any, 'POST', connPath(b.connection.id) + '/deployments', { deploymentId, ...(grant ? { grantCode: grant.code } : {}) });
export function binding(s: any, connection: Json, clientId: string, deploymentId: string, grant: CanvasBinding['grant']): CanvasBinding {
  return { s, connection, clientId, deploymentId, grant,
    provider: connection.profile === SELF.profile ? SELF.provider : CLOUD.provider,
    serviceHost: hostOf(connection.serviceUrl), pageHost: hostOf(connection.siteUrl), platformId: connection.platform?.id ?? '' };
}
/** A registered Canvas connection through the operator grant (AC-M1-17 path). */
export async function canvasBound(library: 'A' | 'B' = 'A', patch: Json = {}, clientId = canvasClientId(), deploymentId = canvasDeploymentId()) {
  const s = await session(library), connection = await canvasConnection(s, patch);
  const grant = await canvasGrant(s, connection, clientId, deploymentId);
  const response = await canvasRedeem(s, connection, clientId, deploymentId, grant);
  expectStatus(response, 200);
  assert.equal(response.json.status, 'registered');
  return binding(s, response.json, clientId, deploymentId, grant);
}
/** An LTI-only Canvas platform (admin API) for protocol cases that need no app connection. */
export async function canvasPlatform(patch: Json = {}) {
  const clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  const body = { profile: CLOUD.profile, clientId, name: unique('QA Canvas'), siteUrl: CLOUD.siteA, deploymentIds: [deploymentId], ...patch };
  const response = await admin('POST', '/api/platforms', body); expectStatus(response, 201);
  const self = body.profile === SELF.profile;
  return { clientId, deploymentId, platformId: String(response.json.id), platform: response.json,
    provider: self ? SELF.provider : CLOUD.provider,
    serviceHost: hostOf(response.json.serviceUrl), pageHost: hostOf(response.json.siteUrl) };
}
type Target = { provider: string; clientId: string; deploymentId: string; serviceHost: string; pageHost: string };
export const scenarioOf = (t: Target, patch: Json = {}) => ({ provider: t.provider, clientId: t.clientId,
  deploymentId: t.deploymentId, siteHost: t.serviceHost, pageHost: t.pageHost, ...patch });
export const canvasLaunch = (t: Target, patch: Json = {}, options: { login?: Json; noCookie?: boolean } = {}) =>
  launch(scenarioOf(t, patch), { ...options, login: { ...CANVAS_LOGIN, ...options.login } });
/** Canvas Deep Linking launch as an instructor (unless the patch sets roles). */
export function canvasDeepLink(t: Target, patch: Json = {}, options: { login?: Json; noCookie?: boolean } = {}) {
  const id = String(patch.id ?? unique('cvdl')), pageHost = String(patch.pageHost ?? t.pageHost);
  return canvasLaunch(t, { roles: [ROLE.instructor], ...patch, id, pageHost, messageType: 'LtiDeepLinkingRequest',
    claims: { ...canvasDeepLinking(id, pageHost), ...(patch.claims ?? {}) } }, options);
}
export const jwtPayload = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
export const jwtHeader = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString('utf8'));
/** Independent RS256 check against the tool JWKS at /lti/keys/cogniate (no product validator). */
export async function verifyToolJwt(jwt: string, key?: Json) {
  const [header, payload, signature] = jwt.split('.');
  const kid = jwtHeader(jwt).kid;
  let jwk = key;
  if (!jwk) {
    const keys = await httpsRequest(`${urls.lti}/lti/keys/cogniate`); expectStatus(keys, 200);
    jwk = JSON.parse(keys.body).keys.find((k: Json) => k.kid === kid);
  }
  assert.ok(jwk && jwk.kid === kid, 'Tool JWT kid is in the key set');
  assert.equal(jwtHeader(jwt).alg, 'RS256');
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${header}.${payload}`),
    crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' }), Buffer.from(signature, 'base64url')), 'Tool JWT signature');
  return jwtPayload(jwt);
}
/** A refused protocol page: status, data-error-code, no redirect, no ltik. */
export function refused(response: { status: number; headers: any; body: string }, code: string, statuses: number[] = [400, 401]) {
  assert.ok(statuses.includes(response.status), `Status ${response.status} for ${code}; allowed ${statuses.join(',')}`);
  assert.ok(response.body.includes(`data-error-code="${code}"`), `Error page ${code}`);
  assert.equal(response.headers.location, undefined);
}
export async function appPage(ltiRedirect: { headers: any; status: number }) {
  assert.equal(ltiRedirect.status, 303, 'LTI service hands the launch to the app');
  return httpsRequest(String(ltiRedirect.headers.location));
}
/** LTI launch → app handoff → play URL. Canvas sends document_target iframe, so the handoff ends at /embedded. */
export async function canvasPlay(t: Target & { connection?: Json }, pub: Json, patch: Json = {}) {
  const result = await canvasLaunch(t, { resource: pub.id, resourceLinkId: unique('rl'), ...patch });
  assert.equal(result.response.status, 303, `Launch status ${result.response.status}`);
  const token = await idToken(result.ltik); expectStatus(token, 200);
  const handoff = await appPage(result.response);
  assert.equal(handoff.status, 303, 'Tool handoff opens a player');
  const location = new URL(String(handoff.headers.location), APP);
  assert.match(location.pathname, /^\/play\/ply_[^/]+(?:\/embedded)?$/);
  const playId = location.pathname.split('/')[2];
  const shell = await httpsRequest(`${APP}/play/${playId}`); expectStatus(shell, 200);
  const runtimeUrl = shell.body.match(/src="(https:[^"]+\/rt\/[^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  assert.ok(runtimeUrl, 'Player contains the runtime frame');
  const runtimeToken = new URL(runtimeUrl).pathname.split('/')[2]; rememberSecret(runtimeToken);
  const state = await httpsRequest(`${urls.content}/rt/${runtimeToken}/state`); expectStatus(state, 200);
  return { result, token: token.json, playId, location, shell, runtimeToken, state: JSON.parse(state.body) };
}
export async function scoreRecords(cursor: number, resource: string) {
  return (await records(cursor)).records.filter((r) => r.kind === 'score' && r.resource === resource);
}
/** One graded HTML or SCORM completion that reaches the simulator (used as "launch and grade work"). */
export async function canvasGradeWorks(b: CanvasBinding, format: 'html' | 'scorm12' = 'scorm12') {
  const pub = await publication(b, format), cursor = (await records()).cursor;
  const play = await canvasPlay(b, pub);
  await commitGrade(play, format, 7, 10);
  await waitSync(b, pub, 'sent');
  const hits = await scoreRecords(cursor, pub.id);
  assert.equal(hits.length, 1);
  assert.deepEqual([hits[0].body.scoreGiven, hits[0].body.scoreMaximum], format === 'html' ? [70, 100] : [7, 10]);
  assert.equal(hits[0].host, b.serviceHost);
  return { pub, play, hits };
}
/** Picker after a Canvas Deep Linking launch; checks the frame-ancestors site. */
export async function canvasPicker(b: CanvasBinding, patch: Json = {}) {
  const result = await canvasDeepLink(b, patch);
  assert.equal(result.response.status, 303, `Deep Linking launch status ${result.response.status}`);
  assert.equal(new URL(String(result.response.headers.location)).pathname, '/tool/deep-link');
  const handoff = await httpsRequest(String(result.response.headers.location)); assert.equal(handoff.status, 303);
  const url = new URL(String(handoff.headers.location), APP).href;
  assert.match(new URL(url).pathname, /^\/tool\/picker\/pck_/);
  const page = await httpsRequest(url); expectStatus(page, 200);
  assert.ok(String(page.headers['content-security-policy']).includes(`frame-ancestors ${b.connection.siteUrl}`),
    'Picker frame-ancestors is the connection site');
  const claims = jwtPayload(result.fields.id_token);
  return { url, page, result, settings: claims[DL + 'deep_linking_settings'] as Json };
}
export async function grantState(grant: { id: string; code: string }, connectionId: string, expected: string) {
  const list = await cli('app:grant', ['list', '--connection', connectionId]); assert.equal(list.code, 0);
  assert.equal(list.stdout.includes(grant.code), false, 'Grant list never prints the code');
  const line = list.stdout.split('\n').find((s) => s.includes(grant.id));
  assert.ok(line, 'Grant listed'); assert.match(line, new RegExp(`\\b${expected}\\b`));
}
export async function platformsFor(clientId: string, issuer?: string) {
  const query = (issuer ? `url=${encodeURIComponent(issuer)}&` : '') + `clientId=${encodeURIComponent(clientId)}`;
  const list = await admin('GET', `/api/platforms?${query}`);
  expectStatus(list, 200);
  return list.json.platforms as Json[];
}
/** Runs `body` and proves that it made no LTI call (gate), no simulator service call and no sink hit. */
export async function noRemoteCall(body: () => Promise<void>) {
  const since = Date.now(), cursor = (await records()).cursor;
  await gateReset();
  await gateRules(METHODS.map((method) =>
    ({ id: unique('watch'), method, pathRegex: '^/', action: 'pass', times: 10_000 })));
  const seq = (await gateEvents()).at(-1)?.seq ?? 0;
  try {
    await body();
    assert.deepEqual(await gateEvents(seq), [], 'No app-to-LTI call');
    assert.deepEqual((await records(cursor)).records.filter((r) => ['token', 'ags', 'score', 'nrps', 'deep-link'].includes(r.kind)), []);
    assert.deepEqual(sinkHitsSince(since), []);
  } finally { await gateReset(); }
}
export async function connectionOf(b: { s: any; connection: Json }) {
  const c = await app(b.s as any, 'GET', connPath(b.connection.id)); expectStatus(c, 200); return c.json as Json;
}
export function saveEvidence(id: string, value: Json) {
  fs.writeFileSync(path.join(artifactsDir('acceptance'), `${id}.json`), JSON.stringify({
    id, productSha: process.env.QA_PRODUCT_SHA, testSha: process.env.QA_TEST_SHA, environment: 'SIM', ...value }, null, 2));
}
export { logEvents, poll, results };
