// Vitest-free glue for Canvas QA Playwright cases (M1 browser rows and the M2 suite). Public APIs, the QA simulator,
// the transport gate and the M1 host-control channel only (no product module, no database).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Frame, Page } from '@playwright/test';
import { APP, appApi, createCourse, QA_B, signIn, THANH, uploadVersion, type Session } from '../../lib/app';
import { publicUrls } from '../../lib/env';
import { httpsRequest } from '../../lib/https';
import { apiKey, auth, ltiApi, recordSecret } from '../../lib/lti';
import { artifactsDir } from '../../lib/paths';
import { zipBuffer } from '../../lib/zip';
import { BLACKBOARD, CANVAS_LOGIN, CLOUD, ROLE, SELF, canvasClientId, canvasDeepLinking, canvasDeploymentId, hostOf } from './constants';

export const urls = publicUrls();
export { APP };
export type Json = Record<string, any>;
export const unique = (label: string) => `${label}-${crypto.randomBytes(6).toString('hex')}`;
export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }

/** Product evidence needs both frozen SHAs (same rule as the Vitest cases). */
export function requireShas() {
  check(/^[0-9a-f]{40}$/.test(process.env.QA_PRODUCT_SHA ?? ''), 'Exact QA_PRODUCT_SHA required for product evidence');
  check(/^[0-9a-f]{40}$/.test(process.env.QA_TEST_SHA ?? ''), 'Exact QA_TEST_SHA required for product evidence');
}
export async function jsonRequest(url: string, method = 'GET', body?: unknown) {
  const r = await httpsRequest(url, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null; try { json = JSON.parse(r.body); } catch { json = null; }
  return { ...r, json };
}
export const sim = (p: string, method = 'GET', body?: unknown) => jsonRequest(`https://lms-sim.test/__sim${p}`, method, body);
export const gate = (p: string, method = 'GET', body?: unknown) => jsonRequest(`https://lti-gate.test/__gate${p}`, method, body);
export const admin = (method: string, p: string, body?: unknown) =>
  ltiApi<Json>(method, p, { authorization: auth.bearer(apiKey('cogniate')), body });
export async function session(library: 'A' | 'B' = 'A'): Promise<Session & { library: Json }> {
  const logged = await signIn(library === 'A' ? THANH : QA_B);
  const me = await appApi<Json>('GET', '/app-api/me', { cookie: logged.cookie });
  check(me.status === 200, `GET /app-api/me → ${me.status}`);
  return { ...logged, library: me.json.library };
}
export const app = (s: Session, method: string, p: string, body?: unknown) => appApi<Json>(method, p, { cookie: s.cookie, body });
export function ok(r: { status: number; body?: string }, status: number, what: string) {
  check(r.status === status, `${what}: expected HTTP ${status}, got ${r.status} ${String(r.body ?? '').slice(0, 200)}`);
}
/** Secrets for the private leak scan only (runner: m1-secrets.raw.jsonl, mode 0600, never shared). */
export function rememberPrivate(value: unknown) {
  if (typeof value !== 'string' || value.length < 8) return;
  fs.appendFileSync(path.join(artifactsDir('acceptance'), 'm1-secrets.raw.jsonl'), JSON.stringify(value) + '\n', { mode: 0o600 });
}
/** M1 host-control channel (tests/host/m1-control.mjs): whitelisted operator CLI and restarts of this QA project only. */
export async function hostAction(action: 'm1-cli' | 'm1-restart', payload: Json, timeoutMs = 240_000) {
  const dir = path.join(artifactsDir('acceptance'), 'control'); fs.mkdirSync(dir, { recursive: true });
  const id = `m1-${crypto.randomBytes(6).toString('hex')}`, request = path.join(dir, `req-${id}.json`);
  fs.writeFileSync(request + '.tmp', JSON.stringify({ id, action, ...payload }), { mode: 0o600 });
  fs.renameSync(request + '.tmp', request);
  const ack = path.join(dir, `ack-${id}.json`), deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(ack)) { check(Date.now() < deadline, `Host action ${action} timed out`); await pause(50); }
  const answer = JSON.parse(fs.readFileSync(ack, 'utf8'));
  check(answer.out && path.basename(answer.out) === answer.out, 'Host output path');
  return JSON.parse(fs.readFileSync(path.join(dir, answer.out), 'utf8')) as { code: number; stdout: string; stderr: string; durationMs: number };
}
export const cli = (script: 'app:grant' | 'app:binding' | 'lti:shared-platform', args: string[]) => hostAction('m1-cli', { script, args });
export interface Grant { id: string; code: string; stdout: string }
export async function issueGrant(s: Session & { library: Json }, connection: Json, values: Record<string, string>): Promise<Grant> {
  const all: Record<string, string> = { library: s.library.id, connection: connection.id, site: connection.siteUrl,
    purpose: 'initial', note: 'Independent Canvas QA', ...values };
  const r = await cli('app:grant', ['issue', ...Object.entries(all).flatMap(([k, v]) => ['--' + k, v])]);
  check(r.code === 0, `Grant issue exit ${r.code}: ${r.stderr.slice(0, 200)}`);
  const codes = [...new Set(r.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g) ?? [])];
  check(codes.length === 1, 'Exactly one approval code in operator output');
  const id = r.stdout.match(/\bgrt_[A-Za-z0-9_-]+\b/)?.[0]; check(id, 'Grant id printed');
  rememberPrivate(codes[0]);
  return { id, code: codes[0], stdout: r.stdout };
}

// ---------------------------------------------------------------- bindings and publications
export interface Target { provider: string; clientId: string; deploymentId: string; serviceHost: string; pageHost: string }
export interface Bound extends Target { s: Session & { library: Json }; connection: Json; grant: Grant; platformId: string; lms: 'canvas' | 'blackboard' }
export async function canvasPending(library: 'A' | 'B' = 'A', patch: Json = {}) {
  const s = await session(library);
  const r = await app(s, 'POST', '/app-api/connections', { name: unique('Canvas QA'), siteUrl: CLOUD.siteA, method: 'manual',
    lms: 'canvas', profile: CLOUD.profile, ...patch });
  ok(r, 201, 'Canvas connection');
  return { s, connection: r.json };
}
export async function canvasBinding(library: 'A' | 'B' = 'A', patch: Json = {}, clientId = canvasClientId(), deploymentId = canvasDeploymentId()): Promise<Bound> {
  const { s, connection } = await canvasPending(library, patch);
  const grant = await issueGrant(s, connection, { 'client-id': clientId, 'service-url': connection.serviceUrl, 'deployment-id': deploymentId });
  const r = await app(s, 'PUT', `/app-api/connections/${connection.id}/platform`, { clientId, deploymentId, grantCode: grant.code });
  ok(r, 200, 'Canvas redemption');
  return { s, connection: r.json, grant, clientId, deploymentId, lms: 'canvas', platformId: r.json.platform.id,
    provider: r.json.profile === SELF.profile ? SELF.provider : CLOUD.provider,
    serviceHost: hostOf(r.json.serviceUrl), pageHost: hostOf(r.json.siteUrl) };
}
export async function sharedPlatform() {
  const providers = await admin('GET', '/api/providers'); ok(providers, 200, 'providers');
  const existing = providers.json.profiles.find((p: Json) => p.id === BLACKBOARD.profile)?.sharedPlatform;
  if (existing) return String(existing.id);
  const r = await admin('POST', '/api/platforms', { profile: BLACKBOARD.profile, clientId: BLACKBOARD.clientId, name: 'QA Blackboard' });
  ok(r, 201, 'shared platform'); return String(r.json.id);
}
export async function blackboardBinding(library: 'A' | 'B' = 'A', siteUrl = BLACKBOARD.siteA, deploymentId = unique('d')): Promise<Bound> {
  const platformId = await sharedPlatform(), s = await session(library);
  const c = await app(s, 'POST', '/app-api/connections', { name: unique('Blackboard QA'), siteUrl, method: 'manual', lms: 'blackboard', profile: BLACKBOARD.profile });
  ok(c, 201, 'Blackboard connection');
  const grant = await issueGrant(s, c.json, { 'client-id': BLACKBOARD.clientId, 'deployment-id': deploymentId });
  const r = await app(s, 'PUT', `/app-api/connections/${c.json.id}/platform`, { deploymentId, grantCode: grant.code });
  ok(r, 200, 'Blackboard redemption');
  return { s, connection: r.json, grant, clientId: BLACKBOARD.clientId, deploymentId, lms: 'blackboard', platformId,
    provider: BLACKBOARD.provider, serviceHost: hostOf(siteUrl), pageHost: hostOf(siteUrl) };
}
/** A small course package. SCORM: one SCO without its own API calls. HTML: ten questions (data-cog-quiz). */
export function fixtureZip(format: 'html' | 'scorm12') {
  const title = unique('Canvas QA fixture');
  const questions = Array.from({ length: 10 }, (_, n) => `<fieldset data-cog-quiz="q${n}"><input type="radio" data-cog-correct="true"><input type="radio" data-cog-correct="false"></fieldset>`).join('');
  const entries = [{ name: 'index.html', data: `<!doctype html><meta charset="utf-8"><title>${title}</title><body data-lesson-id="index">${questions}</body>` }];
  if (format === 'scorm12') entries.push({ name: 'imsmanifest.xml', data: `<?xml version="1.0"?>
<manifest identifier="qa.canvas" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
<metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
<organizations default="org"><organization identifier="org"><title>Canvas QA</title><item identifier="item" identifierref="sco"><title>Canvas QA</title><adlcp:masteryscore>70</adlcp:masteryscore></item></organization></organizations>
<resources><resource identifier="sco" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource></resources></manifest>` });
  const file = path.join(artifactsDir('acceptance'), unique(format) + '.zip');
  fs.writeFileSync(file, zipBuffer(entries));
  return file;
}
export async function publicationFor(b: { s: Session; connection: Json }, format: 'html' | 'scorm12' = 'html') {
  const course = await createCourse(b.s, unique('Canvas QA course'));
  ok(await uploadVersion(b.s, course.id, fixtureZip(format)), 201, 'upload');
  const r = await app(b.s, 'POST', '/app-api/publications', { connectionId: b.connection.id, courseId: course.id });
  ok(r, 201, 'publication');
  return { ...r.json, courseId: course.id } as Json;
}

// ---------------------------------------------------------------- simulator launches
export async function scenario(t: Target, patch: Json = {}) {
  const id = String(patch.id ?? unique('scenario'));
  const body: Json = { id, provider: t.provider, clientId: t.clientId, deploymentId: t.deploymentId, siteHost: t.serviceHost, pageHost: t.pageHost, ...patch };
  if (body.messageType === 'LtiDeepLinkingRequest' && t.provider !== BLACKBOARD.provider) {
    body.claims = { ...canvasDeepLinking(id, String(body.pageHost)), ...(body.claims ?? {}) };
  }
  const r = await sim('/scenarios', 'POST', body); ok(r, 201, 'scenario');
  const fields: Record<string, string> = { ...r.json.login, ...(t.provider === BLACKBOARD.provider ? {} : CANVAS_LOGIN) };
  return { id, fields, loginUrl: `${urls.lti}/lti/login/cogniate?${new URLSearchParams(fields)}` };
}
export const deepLinkPatch = (patch: Json = {}) => ({ messageType: 'LtiDeepLinkingRequest', roles: [ROLE.instructor], ...patch });
function parseForm(body: string) {
  const decode = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
  const action = body.match(/<form\b[^>]*\baction="([^"]+)"/i)?.[1]; check(action, 'HTML form action');
  return { action: decode(action), fields: Object.fromEntries([...body.matchAll(/<input\b[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]*)"/gi)].map((m) => [m[1], decode(m[2])])) };
}
/** Server-side signed launch (login, simulator authorization, launch POST). Returns the LTI answer and the ltik. */
export async function serverLaunch(t: Target, patch: Json = {}) {
  const sc = await scenario(t, patch);
  const login = await httpsRequest(`${urls.lti}/lti/login/cogniate`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(sc.fields).toString() });
  check(login.status === 302, `login ${login.status}`);
  const cookie = [login.headers['set-cookie'] ?? []].flat().map((c) => String(c).split(';')[0]).find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  const authorize = await httpsRequest(String(login.headers.location)); ok(authorize, 200, 'simulator authorization');
  const form = parseForm(authorize.body); rememberPrivate(form.fields.id_token); rememberPrivate(form.fields.state);
  const response = await httpsRequest(form.action, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams(form.fields).toString() });
  const ltik = response.headers.location ? new URL(String(response.headers.location)).searchParams.get('ltik') ?? '' : '';
  if (ltik) recordSecret('ltik', ltik);
  return { response, ltik, scenario: sc };
}
export async function pickerUrlFor(t: Target, patch: Json = {}) {
  const l = await serverLaunch(t, deepLinkPatch(patch)); check(l.response.status === 303, `Deep Linking launch ${l.response.status}`);
  const handoff = await httpsRequest(String(l.response.headers.location)); check(handoff.status === 303, `deep-link handoff ${handoff.status}`);
  return new URL(String(handoff.headers.location), APP).href;
}

// ---------------------------------------------------------------- browser helpers
export async function waitForFrame(page: Page, test: (url: URL) => boolean, timeoutMs = 30_000): Promise<Frame> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const frame = page.frames().find((f) => { try { return test(new URL(f.url())); } catch { return false; } });
    if (frame) return frame;
    check(Date.now() < deadline, `No frame matched within ${timeoutMs} ms: ${page.frames().map((f) => f.url().split('?')[0]).join(' | ')}`);
    await page.waitForTimeout(200);
  }
}
/** Records browser-visible ltiks, runtime tokens and play ids for the leak scan (never into shared evidence). */
export function captureSecrets(context: BrowserContext) {
  context.on('request', (request) => {
    try {
      const u = new URL(request.url());
      const ltik = u.searchParams.get('ltik'); if (ltik) recordSecret('ltik', ltik);
      const rt = u.pathname.match(/^\/rt\/([^/]+)/)?.[1]; if (rt) recordSecret('runtime_token', rt);
    } catch { /* not a URL that carries a secret */ }
  });
}
export const playPath = /^\/play\/ply_[^/]+$/;
export const embeddedPath = /^\/play\/ply_[^/]+\/embedded$/;
/** HTML runtime completion through the public runtime commit (same body as the API cases). */
export async function completeHtml(runtimeToken: string, correct = 7) {
  const state = await httpsRequest(`${urls.content}/rt/${runtimeToken}/state`); ok(state, 200, 'runtime state');
  const s = JSON.parse(state.body);
  const body = { kind: 'html', event: 'progress', sessionId: s.sessionId, seq: s.lastSeq + 1,
    progress: { seenPages: ['index'], answers: Object.fromEntries(Array.from({ length: 10 }, (_, n) => ['q' + n, n < correct ? '1' : '0'])) } };
  ok(await httpsRequest(`${urls.content}/rt/${runtimeToken}/commit`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body) }), 200, 'runtime commit');
}
export { BLACKBOARD, CLOUD, ROLE, SELF, canvasClientId, canvasDeploymentId, escape } from './constants';
