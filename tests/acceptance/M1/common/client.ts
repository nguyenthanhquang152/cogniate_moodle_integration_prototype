// M1 black-box client. Only public APIs, the documented simulator/gate, and
// operator CLI commands are used. No product module or database access.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { APP, appApi, signIn, THANH, QA_B, type Session } from '../../lib/app';
import { publicUrls } from '../../lib/env';
import { httpsRequest } from '../../lib/https';
import { apiKey, auth, eventsSince, ltiApi, recordSecret } from '../../lib/lti';
import { artifactsDir } from '../../lib/paths';

export const urls = publicUrls();
export const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
export const DL = 'https://purl.imsglobal.org/spec/lti-dl/claim/';
export const AGS = 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint';
export const NRPS = 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice';
export const unique = (label: string) => `${label}-${crypto.randomBytes(6).toString('hex')}`;
export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export type Json = Record<string, any>;
export type Owner = 'common' | 'blackboard' | 'canvas';
export type EvidenceLabel = 'SIM' | 'MOODLE-LIVE' | 'DOC' | 'CANVAS-LOCAL' | 'CANVAS-HOSTED' | 'BLACKBOARD-LIVE';
export function m1Test(id: string, title: string, body: () => Promise<void>, timeout = 180_000, environment: EvidenceLabel = 'SIM') {
  assert.match(id, /^M1-\d{2}\.(common|blackboard|canvas)\.[a-z0-9-]+$/);
  test(`[${environment}] AC-${id.split('.')[0]} ${title} {case:${id}}`, async () => {
    assert.match(process.env.QA_PRODUCT_SHA ?? '', /^[0-9a-f]{40}$/, 'Exact QA_PRODUCT_SHA required for product evidence');
    assert.match(process.env.QA_TEST_SHA ?? '', /^[0-9a-f]{40}$/, 'Exact QA_TEST_SHA required for product evidence');
    await body();
  }, timeout);
}
export async function poll<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeout = 15_000, interval = 100): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    assert.ok(Date.now() < deadline, `Poll deadline ${timeout} ms exceeded`);
    await pause(interval);
  }
}
export async function jsonRequest(url: string, method = 'GET', body?: unknown) {
  const response = await httpsRequest(url, { method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any;
  try { json = JSON.parse(response.body); } catch { json = null; }
  return { ...response, json };
}
export const sim = (path: string, method = 'GET', body?: unknown) => jsonRequest(`https://lms-sim.test/__sim${path}`, method, body);
export const gate = (path: string, method = 'GET', body?: unknown) => jsonRequest(`https://lti-gate.test/__gate${path}`, method, body);
export const admin = (method: string, path: string, body?: unknown) =>
  ltiApi<Json>(method, path, { authorization: auth.bearer(apiKey('cogniate')), body });
export const service = (key: string, method: string, path: string, body?: unknown) =>
  ltiApi<Json>(method, path, { authorization: auth.service(apiKey('cogniate'), key), body });
export function expectStatus(response: { status: number; json?: any; body?: string }, status: number, code?: string) {
  assert.equal(response.status, status, `Expected HTTP ${status}; actual ${response.status}, code ${response.json?.details?.message ?? 'none'}`);
  if (code) assert.equal(response.json?.details?.message, code);
}
export const connPath = (id: string) => `/app-api/connections/${encodeURIComponent(id)}`;
export const deploymentPath = (platform: string, deployment?: string) =>
  `/api/platforms/${encodeURIComponent(platform)}/deployments${deployment === undefined ? '' : '/' + encodeURIComponent(deployment)}`;
export async function session(library: 'A' | 'B' = 'A') {
  const logged = await signIn(library === 'A' ? THANH : QA_B);
  const me = await appApi<Json>('GET', '/app-api/me', { cookie: logged.cookie });
  expectStatus(me, 200);
  return { ...logged, library: me.json.library };
}
export const app = (s: Session, method: string, path: string, body?: unknown) => appApi<Json>(method, path, { cookie: s.cookie, body });
export async function createConnection(s: Session, patch: Json = {}) {
  const response = await app(s, 'POST', '/app-api/connections', {
    name: unique('M1 Blackboard'), siteUrl: 'https://learn-a.blackboard.sim.test',
    method: 'manual', lms: 'blackboard', profile: 'blackboard-sim', ...patch,
  });
  expectStatus(response, 201);
  return response.json;
}
export async function sharedPlatform() {
  const providers = await admin('GET', '/api/providers');
  expectStatus(providers, 200);
  const existing = providers.json.profiles.find((p: Json) => p.id === 'blackboard-sim')?.sharedPlatform;
  if (existing) { assert.equal(existing.clientId, 'qa-bb-app'); return existing.id as string; }
  const response = await admin('POST', '/api/platforms', { profile: 'blackboard-sim', clientId: 'qa-bb-app', name: 'QA Blackboard' });
  expectStatus(response, 201);
  return String(response.json.id);
}

export function rememberSecret(value: string) {
  if (!value) return;
  const file = path.join(artifactsDir('acceptance'), 'm1-secrets.raw.jsonl');
  fs.appendFileSync(file, JSON.stringify(value) + '\n', { mode: 0o600 });
}
export interface HostResult { code: number; stdout: string; stderr: string; durationMs: number }
export async function host(action: 'm1-cli' | 'm1-restart' | 'm1-profile', payload: Json = {}, timeout = 240_000): Promise<HostResult> {
  const dir = path.join(artifactsDir('acceptance'), 'control'); fs.mkdirSync(dir, { recursive: true });
  const id = unique('m1');
  const request = path.join(dir, `req-${id}.json`);
  fs.writeFileSync(request + '.tmp', JSON.stringify({ id, action, ...payload }), { mode: 0o600 });
  fs.renameSync(request + '.tmp', request);
  const ack = path.join(dir, `ack-${id}.json`);
  await poll(async () => fs.existsSync(ack), Boolean, timeout, 50);
  const answer = JSON.parse(fs.readFileSync(ack, 'utf8'));
  assert.ok(answer.out, `Host action ${action} returned no output`);
  assert.equal(path.basename(answer.out), answer.out, 'Host output path');
  return JSON.parse(fs.readFileSync(path.join(dir, answer.out), 'utf8'));
}
export const cli = (script: 'app:grant' | 'app:binding' | 'lti:shared-platform', args: string[]) =>
  host('m1-cli', { script, args });
export async function issueGrant(s: Json, connection: Json, deploymentId: string, extra: Record<string, string> = {}) {
  const values = { library: s.library.id, connection: connection.id, site: connection.siteUrl,
    'client-id': connection.lms === 'blackboard' ? 'qa-bb-app' : connection.platform?.clientId ?? 'qa-canvas-app',
    'deployment-id': deploymentId, purpose: 'initial', note: 'Independent M1 QA', ...extra };
  const args = ['issue', ...Object.entries(values).flatMap(([key, value]) => ['--' + key, String(value)])];
  const response = await cli('app:grant', args);
  assert.equal(response.code, 0, 'Grant issue exits 0');
  const code = response.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g) ?? [];
  assert.equal(new Set(code).size, 1, 'Exactly one approval code in operator output');
  const approvalCode = code[0]; assert.ok(approvalCode);
  const id = response.stdout.match(/\bgrt_[A-Za-z0-9_-]+\b/)?.[0];
  assert.ok(id, 'Grant id printed');
  rememberSecret(approvalCode);
  return { id, code: approvalCode, stdout: response.stdout };
}
export const redeem = (s: Session, c: Json, d: string, grant?: { code: string }) =>
  app(s, 'PUT', connPath(c.id) + '/platform', { deploymentId: d, ...(grant ? { grantCode: grant.code } : {}) });
export async function bound(library: 'A' | 'B' = 'A', site = 'https://learn-a.blackboard.sim.test', deploymentId = unique('d')) {
  const platformId = await sharedPlatform(), s = await session(library);
  const connection = await createConnection(s, { siteUrl: site });
  const grant = await issueGrant(s, connection, deploymentId);
  const response = await redeem(s, connection, deploymentId, grant); expectStatus(response, 200);
  return { s, connection: response.json, deploymentId, platformId, grant };
}
export async function remote(platformId: string, deploymentId: string) {
  const result = await admin('GET', `/api/platforms/${encodeURIComponent(platformId)}`);
  expectStatus(result, 200);
  return result.json.deployments.find((d: Json) => d.deploymentId === deploymentId) as Json | undefined;
}
export function parseForm(body: string) {
  const decode = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const action = body.match(/<form\b[^>]*\baction="([^"]+)"/i)?.[1];
  assert.ok(action, 'HTML form action present');
  const fields = Object.fromEntries([...body.matchAll(/<input\b[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]*)"/gi)].map((m) => [m[1], decode(m[2])]));
  return { action: decode(action), fields };
}
export async function formPost(url: string, fields: Record<string, string>, cookie?: string) {
  return httpsRequest(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams(fields).toString() });
}
export async function beginLaunch(patch: Json = {}, loginPatch: Json = {}) {
  const scenario = { id: unique('scenario'), provider: 'blackboard-sim', clientId: 'qa-bb-app',
    deploymentId: 'dA', siteHost: 'learn-a.blackboard.sim.test', ...patch };
  const created = await sim('/scenarios', 'POST', scenario); expectStatus(created, 201);
  const loginFields = { ...created.json.login, ...loginPatch };
  for (const key of Object.keys(loginFields)) if (loginFields[key] === null) delete loginFields[key];
  const login = await formPost(`${urls.lti}/lti/login/cogniate`, loginFields);
  const location = String(login.headers.location ?? '');
  const cookie = [login.headers['set-cookie'] ?? []].flat().map((c) => c.split(';')[0]).find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  return { scenario, login, location, cookie };
}
export async function launch(patch: Json = {}, options: { login?: Json; noCookie?: boolean; replay?: boolean } = {}) {
  const started = await beginLaunch(patch, options.login);
  if (started.login.status !== 302) return { ...started, response: started.login, ltik: '', fields: {} as Record<string, string> };
  const authorize = await httpsRequest(started.location); expectStatus(authorize, 200);
  const { action, fields } = parseForm(authorize.body);
  recordSecret('id_token', fields.id_token);
  recordSecret('state', fields.state);
  const response = await formPost(action, fields, options.noCookie ? undefined : started.cookie);
  const ltik = response.headers.location ? new URL(String(response.headers.location)).searchParams.get('ltik') ?? '' : '';
  if (ltik) recordSecret('ltik', ltik);
  return { ...started, response, ltik, fields };
}
export async function preparedLaunch(patch: Json = {}) {
  const started = await beginLaunch(patch); expectStatus(started.login, 302);
  const authorize = await httpsRequest(started.location); expectStatus(authorize, 200);
  const form = parseForm(authorize.body);
  rememberSecret(form.fields.id_token); rememberSecret(form.fields.state);
  return { started, submit: () => formPost(form.action, form.fields, started.cookie) };
}
export async function idToken(ltik: string, raw = false) {
  const result = await ltiApi<Json>('GET', '/api/idtoken' + (raw ? '?raw=true' : ''), { authorization: auth.ltik(apiKey('cogniate'), ltik) });
  if (result.json?.services?.serviceKey) recordSecret('service_key', result.json.services.serviceKey);
  return result;
}
export function denied(response: { status: number; headers: any; body: string }, code: string, status = 400) {
  assert.equal(response.status, status);
  assert.ok(response.body.includes(`data-error-code="${code}"`), `Error page ${code}`);
  assert.equal(response.headers.location, undefined);
}
export async function records(since = 0) { const r = await sim('/records?since=' + since); expectStatus(r, 200); return r.json as { cursor: number; records: Json[] }; }
export async function noServiceCalls(since: number) {
  assert.deepEqual((await records(since)).records.filter((r) => ['token', 'ags', 'score', 'nrps', 'deep-link'].includes(r.kind)), []);
}
export function logEvents(event: string, since: number, fields: Json = {}, serviceName = 'cogniate-app') {
  return eventsSince(serviceName, since, (entry) => entry.event === event && Object.entries(fields).every(([key, value]) => entry[key] === value));
}
export async function gateRules(rules: Json[]) { expectStatus(await gate('/rules', 'POST', rules), 200); }
let gateCursor = 0;
export async function gateEvents(since = gateCursor, requestId?: string) {
  const r = await gate(`/events?since=${since}${requestId ? '&requestId=' + encodeURIComponent(requestId) : ''}`);
  expectStatus(r, 200);
  return (Array.isArray(r.json) ? r.json : r.json.events) as Json[];
}
export async function gatePhase(ruleId: string, phase: string, timeout = 4000, since = gateCursor) {
  const events = await poll(() => gateEvents(since), (list) => list.some((e) => e.rule_id === ruleId && e.phase === phase), timeout, 25);
  return events.find((e) => e.rule_id === ruleId && e.phase === phase)!;
}
export async function release(requestId: string, then: 'deliver' | 'drop' = 'deliver') {
  expectStatus(await gate('/release', 'POST', { requestId, then }), 200);
}
export async function gateReset() {
  expectStatus(await gate('/reset', 'POST'), 200);
  gateCursor = (await gateEvents(0)).at(-1)?.seq ?? 0;
}
export { assert, APP, httpsRequest };
