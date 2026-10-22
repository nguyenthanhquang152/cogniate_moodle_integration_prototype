// Golden capture script, version 1 (LA-E0-03; TEST-STRATEGY §4.6). It runs in the e2e container of an `acceptance`
// stack through tests/ltiaas/golden/run-golden.mjs, which also captures the `default` profile part of G1 before.
// It uses only public surfaces: the app API, the LTI tenant API, tool pages, the simulator (`/__sim/*`) and the M1
// host control for the operator CLI. It imports the frozen M1 helpers; it imports no product code.
//
// Script: one Moodle connection pair (dynamic, manual; G1 only, see note), then for Blackboard sim and Canvas sim:
// one registered connection, a Deep Linking pick, learner launches and grades, with score sync rows in every status
// (sent, conflict, failed, Resend, superseded, pending), the tool error pages, then a disabled connection.
// Note: G2 and G3 of the Moodle channel need the Moodle-shaped simulator config (LA-E7-02, LA-E7-05). Golden version 2
// adds them when that config exists. Version 1 keeps the Moodle connection DTOs and tool configuration rows (G1).
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { artifactsDir } from '../../acceptance/lib/paths';
import { AGS, APP, LTI, admin, app, assert, beginLaunch, connPath, createConnection, expectStatus, formPost, httpsRequest,
  idToken, issueGrant, launch, logEvents, parseForm, poll, records, redeem, rememberSecret, session, sharedPlatform, urls,
  type Json } from '../../acceptance/M1/common/client';
import { commitGrade, openPlay, pick, picker, publication, results, returnDeepLink, waitSync } from '../../acceptance/M1/common/course';
import { CANVAS_LOGIN, CANVAS_SCORE, ROLE, canvasBound, canvasDeepLink, canvasLaunch, canvasPlay, scenarioOf } from '../../acceptance/M1/canvas/canvas';
import { normalizeFile, secretScan } from './lib/normalize.mjs';

const LABEL = process.env.QA_GOLDEN_LABEL ?? 'capture';
const OUT = path.join(artifactsDir('acceptance'), 'golden', LABEL);
const G1: Json = {}, G2: Json = {}, G3: Json = {}, G4: Json = {};
const u1: Json = { connections: {}, publications: {}, rows: {} };

// Fixed values: the same on every fresh stack (G2 records name them).
const CANVAS_CLIENT = '10000000000042', CANVAS_DEPLOYMENT = '7:' + 'c0ffee'.repeat(6) + 'c0ff', BB_DEPLOYMENT = 'golden-bb-1';
const DISABLED_CANVAS_CLIENT = '10000000000043', DISABLED_BB_DEPLOYMENT = 'golden-bb-2';
const SCOPE = ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/score'];

const entities = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&nbsp;', ' ');
/** G4 form of an HTML page: status, error code, action line and the visible text; the trace id becomes <trace>. */
function page(response: { status: number; headers: any; body: string }) {
  const body = response.body ?? '';
  const trace = body.match(/data-trace-id="([^"]*)"/)?.[1];
  const visible = entities(body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const action = body.match(/data-error-action[^>]*>([\s\S]*?)<\//)?.[1];
  const hide = (s: string) => (trace ? s.split(trace).join('<trace>') : s);
  return { status: response.status, errorCode: body.match(/data-error-code="([^"]*)"/)?.[1] ?? null,
    action: action === undefined ? null : hide(entities(action.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()),
    location: response.headers?.location ? '(redirect)' : null, text: hide(visible) };
}
/** OIDC parameters of the tool's login redirect to the platform authorize endpoint (G2). */
function oidc(location: string) {
  const url = new URL(location);
  return { endpoint: url.origin + url.pathname, params: Object.fromEntries([...url.searchParams].sort(([a], [b]) => a.localeCompare(b))) };
}
const json = (r: { status: number; json?: any }) => ({ status: r.status, body: r.json ?? null });
const syncsOf = (rows: Json[]) => rows.flatMap((row) => row.scoreSyncs ?? []);
/**
 * A pending row whose `tries`-th send is answered and stored. `tries` counts up before the POST, so the row alone
 * does not show that the answer arrived; the app's `score_sync` event of that send does (app contract §12).
 */
async function settledPending(b: Json, pub: Json, tries: number, since: number, cursor: number) {
  const row = await waitSync(b, pub, 'pending', tries, 30_000);
  await poll(
    async () =>
      logEvents('score_sync', since, { sync_id: row.id, tries, status: 'pending' }).length > 0 &&
      (await records(cursor)).records.filter((r: Json) => r.kind === 'score' && r.resource === pub.id && r.status === 503).length >= tries,
    Boolean,
    30_000,
    100,
  );
  return (await waitSync(b, pub, 'pending', tries, 5_000));
}

interface Channel {
  id: 'blackboard' | 'canvas'; provider: string; b: Json;
  play: (pub: Json, patch?: Json) => Promise<Json>;
  dlLaunch: (patch?: Json) => Promise<Json>;
  launch: (patch?: Json, options?: Json) => Promise<Json>;
  family: string; otherFamily: string;
  /** A publication of the other channel's connection (for PUBLICATION_NOT_AVAILABLE and PUBLICATION_NOT_IN_CONNECTION). */
  foreign: Json;
}

async function channelSegment(c: Channel) {
  const cursor0 = (await records()).cursor;
  const g2: Json = { oidc: [] as Json[], records: [] as Json[] };
  const g3: Json = { publications: {} as Json, resend: {} as Json };
  const g4: Json = { pages: {} as Json, players: {} as Json };
  const pubs: Json = {};
  for (const name of ['A-sent', 'B-conflict', 'C-failed', 'C2-resend', 'D-superseded', 'E-pending']) {
    pubs[name] = await publication(c.b, 'scorm12');
    g3.publications[name] = { create: pubs[name] };
  }
  // Deep Linking: picker, pick of publication A, the return to the platform.
  const dl = await c.dlLaunch();
  g2.oidc.push({ step: 'deep-linking', ...oidc(dl.location) });
  assert.equal(dl.response.status, 303, 'Deep Linking launch');
  const handoff = await httpsRequest(String(dl.response.headers.location)); assert.equal(handoff.status, 303);
  const pickerUrl = new URL(String(handoff.headers.location), APP).href;
  const pickerPage = await httpsRequest(pickerUrl); expectStatus(pickerPage, 200);
  g4.pages['picker'] = page(pickerPage);
  g4.pages['PUBLICATION_NOT_AVAILABLE'] = page(await pick(pickerUrl, c.foreign.id));
  const picked = await pick(pickerUrl, pubs['A-sent'].id); expectStatus(picked, 200);
  g3.deepLinkReturn = { status: (await returnDeepLink(picked)).response.status };
  g4.pages['PICKER_USED'] = page(await httpsRequest(pickerUrl));
  // A: sent. Launch, player shell, grade 7/10.
  const a = await c.play(pubs['A-sent']);
  g2.oidc.push({ step: 'learner launch', ...oidc(a.result.location) });
  g4.players['shell'] = page(a.shell);
  g4.players['status-before'] = json(await app(c.b.s, 'GET', `/app-api/play/${a.playId}/status`));
  await commitGrade(a, 'scorm12', 7, 10);
  u1.rows[`${c.id}-sent`] = await waitSync(c.b, pubs['A-sent'], 'sent');
  g4.players['status-sent'] = json(await app(c.b.s, 'GET', `/app-api/play/${a.playId}/status`));
  g4.pages['HANDOFF_USED'] = page(await httpsRequest(String(a.result.response.headers.location)));
  // B: conflict (platform 409).
  const b = await c.play(pubs['B-conflict'], { scoreAnswers: [{ status: 409, message: 'Golden conflict' }] });
  await commitGrade(b, 'scorm12', 8, 10);
  u1.rows[`${c.id}-conflict`] = await waitSync(c.b, pubs['B-conflict'], 'conflict', 1);
  g4.players['status-conflict'] = json(await app(c.b.s, 'GET', `/app-api/play/${b.playId}/status`));
  // C: failed (platform 400), kept failed for U1.
  const cPlay = await c.play(pubs['C-failed'], { scoreAnswers: [{ status: 400, message: CANVAS_SCORE.olderTimestamp }] });
  await commitGrade(cPlay, 'scorm12', 6, 10);
  u1.rows[`${c.id}-failed`] = await waitSync(c.b, pubs['C-failed'], 'failed', 1);
  g4.players['status-failed'] = json(await app(c.b.s, 'GET', `/app-api/play/${cPlay.playId}/status`));
  // C2: failed, then Resend (200) and sent; then Resend of a sent row.
  const c2 = await c.play(pubs['C2-resend'], { scoreAnswers: [{ status: 422, message: CANVAS_SCORE.attemptLimit }] });
  await commitGrade(c2, 'scorm12', 5, 10);
  const c2failed = await waitSync(c.b, pubs['C2-resend'], 'failed', 1);
  g3.resend['failed'] = json(await app(c.b.s, 'POST', `/app-api/score-syncs/${c2failed.id}/resend`));
  const c2sent = await waitSync(c.b, pubs['C2-resend'], 'sent');
  g3.resend['sent'] = json(await app(c.b.s, 'POST', `/app-api/score-syncs/${c2sent.id}/resend`));
  // D: a pending 60 (two 503 answers) superseded by a 90 of a second attempt on the same resource link.
  const link = { resourceLinkId: `golden-rl-${c.id}-d` };
  const d1 = await c.play(pubs['D-superseded'], { ...link, scoreAnswers: [503, 503] });
  const sinceD = Date.now();
  await commitGrade(d1, 'scorm12', 60, 100);
  const lower = await settledPending(c.b, pubs['D-superseded'], 2, sinceD, cursor0);
  const d2 = await c.play(pubs['D-superseded'], link);
  await commitGrade(d2, 'scorm12', 90, 100);
  await poll(() => results(c.b, pubs['D-superseded']), (rows) => syncsOf(rows).some((s) => s.id === lower.id && s.status === 'superseded')
    && syncsOf(rows).some((s) => s.scoreGiven === 90 && s.status === 'sent'), 30_000, 250);
  u1.rows[`${c.id}-superseded`] = { ...lower, status: 'superseded' };
  g4.players['status-superseded-attempt'] = json(await app(c.b.s, 'GET', `/app-api/play/${d1.playId}/status`));
  g3.resend['superseded'] = json(await app(c.b.s, 'POST', `/app-api/score-syncs/${lower.id}/resend`));
  // Tool error pages of this channel (G4).
  const role = await c.dlLaunch({ roles: [ROLE.learner] });
  g4.pages['ROLE_NOT_ALLOWED'] = page(await httpsRequest(String(role.response.headers.location)));
  const notDl = await c.launch({ resource: pubs['A-sent'].id });
  g4.pages['deep-link-with-resource-link'] = page(await httpsRequest(String(notDl.response.headers.location).replace('/tool/launch', '/tool/deep-link')));
  const foreignLaunch = await c.launch({ resource: c.foreign.id });
  g4.pages['PUBLICATION_NOT_IN_CONNECTION'] = page(await httpsRequest(String(foreignLaunch.response.headers.location)));
  g4.pages['UNKNOWN_DEPLOYMENT'] = page((await c.launch({ deploymentId: 'golden-unknown-deployment' })).login);
  g4.pages['STATE_COOKIE_MISSING'] = page((await c.launch({}, { noCookie: true })).response);
  const started = c.id === 'canvas' ? await beginLaunch(scenarioOf(c.b as any), CANVAS_LOGIN)
    : await beginLaunch({ deploymentId: c.b.deploymentId, siteHost: new URL(c.b.connection.siteUrl).hostname });
  const authorize = await httpsRequest(started.location); expectStatus(authorize, 200);
  const form = parseForm(authorize.body); rememberSecret(form.fields.id_token); rememberSecret(form.fields.state);
  assert.equal((await formPost(form.action, form.fields, started.cookie)).status, 303);
  g4.pages['INVALID_STATE'] = page(await formPost(form.action, form.fields, started.cookie));
  g4.pages['PROVIDER_PROFILE_MISMATCH'] = page((await c.launch({ claims: { [LTI + 'tool_platform']: { product_family_code: c.otherFamily } } })).response);
  g4.pages['SERVICE_ORIGIN_MISMATCH'] = page((await c.launch({ claims: { [AGS]: { lineitem: 'https://evil.test/lineitem', scope: SCOPE } } })).response);
  // E: pending (many 503 answers); the results are read at tries = 2, before the third send (30 s later).
  const e = await c.play(pubs['E-pending'], { scoreAnswers: Array(20).fill(503) });
  const sinceE = Date.now();
  await commitGrade(e, 'scorm12', 4, 10);
  u1.rows[`${c.id}-pending`] = await settledPending(c.b, pubs['E-pending'], 2, sinceE, cursor0);
  g4.players['status-pending'] = json(await app(c.b.s, 'GET', `/app-api/play/${e.playId}/status`));
  for (const [name, pub] of Object.entries(pubs)) g3.publications[name].results = await results(c.b, pub);
  g2.records = (await records(cursor0)).records.filter((r: Json) => r.provider === c.provider);
  g3.connection = (await app(c.b.s, 'GET', connPath(c.b.connection.id))).json;
  g3.publicationList = (await app(c.b.s, 'GET', '/app-api/publications?connectionId=' + c.b.connection.id)).json;
  const labels = new Set<string>();
  const walk = (v: any): void => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    else if (typeof v === 'string' && v.startsWith('Learner ')) labels.add(v); };
  walk(Object.values(g3.publications).map((p: any) => p.results));
  g4.learnerLabels = [...labels].sort();
  u1.connections[c.id] = c.b.connection.id;
  u1.publications[c.id] = Object.fromEntries(Object.entries(pubs).map(([k, v]) => [k, (v as Json).id]));
  return { g2, g3, g4 };
}

test('golden capture v1', async () => {
  fs.mkdirSync(path.join(OUT, 'private'), { recursive: true, mode: 0o700 });
  await sharedPlatform();
  const s = await session('A');
  // G1: the `default` profile answers that run-golden.mjs read before the profile change, then the acceptance answers.
  const defaultFile = process.env.QA_GOLDEN_DEFAULT;
  assert.ok(defaultFile && fs.existsSync(defaultFile), 'QA_GOLDEN_DEFAULT (G1 default profile answers) is required');
  G1.default = JSON.parse(fs.readFileSync(defaultFile, 'utf8'));
  G1.acceptance = {
    providers: (await admin('GET', '/api/providers')).json,
    lmsProviders: (await app(s, 'GET', '/app-api/lms-providers')).json,
    ltiHealth: JSON.parse((await httpsRequest(urls.lti + '/healthz')).body),
    appHealth: JSON.parse((await httpsRequest(urls.app + '/healthz')).body),
  };
  G1.connections = {} as Json; G1.toolConfiguration = {} as Json;
  // Moodle: dynamic and manual pending connections, the 16 configuration rows.
  for (const method of ['dynamic', 'manual']) {
    const created = await app(s, 'POST', '/app-api/connections', { name: `Golden Moodle ${method}`, siteUrl: urls.moodle, method });
    expectStatus(created, 201);
    G1.connections[`moodle-${method}-pending`] = created.json;
    if (method === 'manual') G1.toolConfiguration.moodle = (await app(s, 'GET', connPath(created.json.id) + '/tool-configuration')).json;
  }
  // Blackboard: pending (configuration rows), registered, connected.
  const bbPending = await createConnection(s, { name: 'Golden Blackboard pending', siteUrl: 'https://learn-b.blackboard.sim.test' });
  G1.connections['blackboard-pending'] = bbPending;
  G1.toolConfiguration.blackboard = (await app(s, 'GET', connPath(bbPending.id) + '/tool-configuration')).json;
  const bbConn = await createConnection(s, { name: 'Golden Blackboard' });
  const bbGrant = await issueGrant(s, bbConn, BB_DEPLOYMENT);
  const bbRedeem = await redeem(s, bbConn, BB_DEPLOYMENT, bbGrant); expectStatus(bbRedeem, 200);
  G1.connections['blackboard-registered'] = bbRedeem.json;
  const bb = { s, connection: bbRedeem.json, deploymentId: BB_DEPLOYMENT };
  // Canvas: pending (configuration rows and Canvas JSON in both forms), registered, connected.
  const cvPending = await app(s, 'POST', '/app-api/connections', { name: 'Golden Canvas pending', siteUrl: 'https://school-b.canvas.sim.test',
    method: 'manual', lms: 'canvas', profile: 'canvas-sim-cloud' });
  expectStatus(cvPending, 201);
  G1.connections['canvas-pending'] = cvPending.json;
  G1.toolConfiguration.canvas = (await app(s, 'GET', connPath(cvPending.json.id) + '/tool-configuration')).json;
  G1.canvasConfiguration = {
    'jwk=url': (await app(s, 'GET', connPath(cvPending.json.id) + '/canvas-configuration?jwk=url')).json,
    'jwk=inline': (await app(s, 'GET', connPath(cvPending.json.id) + '/canvas-configuration?jwk=inline')).json,
  };
  const cv = await canvasBound('A', { name: 'Golden Canvas' }, CANVAS_CLIENT, CANVAS_DEPLOYMENT);
  G1.connections['canvas-registered'] = cv.connection;

  const bbForeign = await publication(bb, 'html'), cvForeign = await publication(cv, 'html');
  const channels: Channel[] = [
    { id: 'blackboard', provider: 'blackboard-sim', b: bb, family: 'BlackboardLearn', otherFamily: 'canvas', foreign: cvForeign,
      play: (pub, patch = {}) => openPlay(bb, pub, patch),
      dlLaunch: (patch = {}) => launch({ deploymentId: BB_DEPLOYMENT, siteHost: 'learn-a.blackboard.sim.test',
        messageType: 'LtiDeepLinkingRequest', roles: [ROLE.instructor], ...patch }),
      launch: (patch = {}, options = {}) => launch({ deploymentId: BB_DEPLOYMENT, siteHost: 'learn-a.blackboard.sim.test', ...patch }, options) },
    { id: 'canvas', provider: cv.provider, b: cv, family: 'canvas', otherFamily: 'BlackboardLearn', foreign: bbForeign,
      play: (pub, patch = {}) => canvasPlay(cv, pub, patch),
      dlLaunch: (patch = {}) => canvasDeepLink(cv, patch),
      launch: (patch = {}, options = {}) => canvasLaunch(cv, patch, options) },
  ];
  for (const c of channels) {
    const { g2, g3, g4 } = await channelSegment(c);
    G2[c.id] = g2; G3[c.id] = g3; G4[c.id] = g4;
    G1.connections[`${c.id}-connected`] = g3.connection;
  }
  // Channel-free tool pages (no connection: the Moodle texts).
  G4.common = { pages: {
    INVALID_LTIK: page(await httpsRequest(`${APP}/tool/deep-link?ltik=golden-invalid`)),
    PICKER_NOT_FOUND: page(await httpsRequest(`${APP}/tool/picker/pck_goldenunknown0000`)),
    PLAY_NOT_FOUND: page(await httpsRequest(`${APP}/play/ply_goldenunknown0000`)),
  } };
  // Disabled: a second registered connection per channel, then DELETE; its launch is refused.
  // (library B, so that the sites of library A stay as they are)
  const sB = await session('B');
  const bbOff = await createConnection(sB, { name: 'Golden Blackboard disabled', siteUrl: 'https://learn-b.blackboard.sim.test' });
  const bbOffGrant = await issueGrant(sB, bbOff, DISABLED_BB_DEPLOYMENT);
  expectStatus(await redeem(sB, bbOff, DISABLED_BB_DEPLOYMENT, bbOffGrant), 200);
  expectStatus(await app(sB, 'DELETE', connPath(bbOff.id)), 204);
  G1.connections['blackboard-disabled'] = (await app(sB, 'GET', connPath(bbOff.id))).json;
  G4.blackboard.pages['PLATFORM_NOT_ACTIVE-or-refusal'] = page((await launch({ deploymentId: DISABLED_BB_DEPLOYMENT, siteHost: 'learn-b.blackboard.sim.test' })).response);
  const cvOff = await canvasBound('B', { name: 'Golden Canvas disabled', siteUrl: 'https://school-b.canvas.sim.test' }, DISABLED_CANVAS_CLIENT, '8:golden');
  expectStatus(await app(cvOff.s, 'DELETE', connPath(cvOff.connection.id)), 204);
  G1.connections['canvas-disabled'] = (await app(cvOff.s, 'GET', connPath(cvOff.connection.id))).json;
  G4.canvas.pages['PLATFORM_NOT_ACTIVE-or-refusal'] = page((await canvasLaunch(cvOff)).response);
  G1.connectionList = (await app(s, 'GET', '/app-api/connections')).json;
  G1.lmsProvidersAfter = (await app(s, 'GET', '/app-api/lms-providers')).json;
  G1.providersAfter = (await admin('GET', '/api/providers')).json;

  // Normalize at capture: no raw token, key or secret enters a golden file.
  const files: [string, string][] = [];
  const stats: Json = {};
  for (const [name, sections] of Object.entries({ G1, G2, G3, G4 })) {
    const { data, stats: st } = normalizeFile(sections);
    stats[name] = st;
    files.push([name, JSON.stringify(data, null, 2) + '\n']);
  }
  const secrets = ['m1-secrets.raw.jsonl', 'captured-secrets.jsonl'].flatMap((f) => {
    const file = path.join(artifactsDir('acceptance'), f);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { const v = JSON.parse(l); return typeof v === 'string' ? v : v.value; }) : [];
  });
  const hits = secretScan(files, secrets);
  assert.deepEqual(hits, [], 'secret scan of the normalized golden files');
  for (const [name, text] of files) fs.writeFileSync(path.join(OUT, `${name}.json`), text);
  fs.writeFileSync(path.join(OUT, 'capture-stats.json'), JSON.stringify({ label: LABEL, stats, secretValuesChecked: secrets.length, hits: 0 }, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'private', 'u1-seed.json'), JSON.stringify(u1, null, 2) + '\n', { mode: 0o600 });
}, 900_000);
