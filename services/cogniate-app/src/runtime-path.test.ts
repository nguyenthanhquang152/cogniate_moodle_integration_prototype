import { TEST_CHANNELS } from './testkit.ts';
// Integration tests of the runtime path (T5a SCORM, T5b HTML): launch (app) -> content host (/pkg, /rt) -> commit rules -> score sync worker
// -> results. Outside src/content-host on purpose: the ADR-008 import fence of that folder also covers its files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { makeZip, scormManifest } from '@cogniate/package-inspector/testing';
import type { LogLine } from '@cogniate/shared';
import { createLogger, sha256Hex } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { LtiServiceError } from './clients/lti-client.ts';
import { runtimeTokenFor } from './tool-pages/launch-rules.ts';
import type { TestApp } from './testkit.ts';
import { INSTRUCTOR, QA_B, TEST_MASTER_KEY, TEST_URLS, THANH, formBody, launchToken, testApp } from './testkit.ts';
import { createScoreSyncWorker } from './worker/score-sync.ts';
import { openDb } from './domain/db.ts';
import { buildContentApp, packageFilePath, parseRange } from './content-host/server.ts';

let t: TestApp;
let content: FastifyInstance;
let contentLogs: LogLine[];
afterEach(async () => {
  await content?.close();
  await t?.app.close();
});

const json = async (method: string, url: string, cookie: string, payload?: unknown) =>
  t.app.inject({ method: method as 'GET', url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as object } : {}) });

const VIDEO = Buffer.alloc(5000, 7);

async function course(cookie: string, title: string, files: Array<{ name: string; data: string | Buffer }>): Promise<string> {
  const id = (await json('POST', '/app-api/courses', cookie, { title })).json().id as string;
  await upload(cookie, id, files);
  return id;
}
async function upload(cookie: string, courseId: string, files: Array<{ name: string; data: string | Buffer }>) {
  const body = await formBody({ package: makeZip(files) });
  const r = await t.app.inject({ method: 'POST', url: `/app-api/courses/${courseId}/versions`, headers: { ...t.writeHeaders(cookie), ...body.headers }, payload: body.payload });
  expect(r.statusCode).toBe(201);
  return r.json();
}
const scormFiles = (mastery = '70') => [
  { name: 'imsmanifest.xml', data: scormManifest({ mastery }) },
  { name: 'index.html', data: '<html><body>blank SCO</body></html>' },
  { name: 'assets/ask-lyra/lyra.mp4', data: VIDEO },
];

const HTML_Q = '01M2M36Y89M9KPPZENF1ZW4AWJ';
const HTML_FILES = [
  { name: 'index.html', data: '<html><body data-lesson-id="index"><a href="lesson.html">Lesson</a></body></html>' },
  { name: 'lesson.html', data: `<html><body data-lesson-id="lesson"><div data-cog-quiz="${HTML_Q}"><input type="radio" data-cog-correct="true"><input type="radio" data-cog-correct="false"></div></body></html>` },
  { name: 'assets/logo.png', data: Buffer.from([137, 80, 78, 71, 1, 2, 3]) },
];

async function world(opts: Parameters<typeof testApp>[0] = {}) {
  t = await testApp(opts);
  contentLogs = [];
  const playerDir = join(t.dataDir, 'player');
  mkdirSync(playerDir, { recursive: true });
  writeFileSync(join(playerDir, 'runtime.js'), 'export {};');
  content = await buildContentApp({ channels: TEST_CHANNELS,
    logger: createLogger({ service: 'cogniate-content', level: 'debug', write: (l) => contentLogs.push(JSON.parse(l) as LogLine) }),
    urls: TEST_URLS, profile: 'default', knobs: [], outboundAllowlist: [], db: t.db, dataDir: t.dataDir, playerDir, now: () => t.clock.now,
  });
  const thanh = await t.login(THANH);
  const c = (await json('POST', '/app-api/connections', thanh, { name: 'M', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
  const platformId = (await json('PUT', `/app-api/connections/${c.id}/platform`, thanh, {
    issuer: TEST_URLS.moodle, clientId: 'c1', deploymentId: '1', authenticationEndpoint: `${TEST_URLS.moodle}/a`, accessTokenEndpoint: `${TEST_URLS.moodle}/t`, jwksUrl: `${TEST_URLS.moodle}/k`,
  })).json().platform.id as string;
  const scormCourse = await course(thanh, 'SCORM course', scormFiles());
  const htmlCourse = await course(thanh, 'HTML course', HTML_FILES);
  const scorm = (await json('POST', '/app-api/publications', thanh, { connectionId: c.id, courseId: scormCourse })).json().id as string;
  const html = (await json('POST', '/app-api/publications', thanh, { connectionId: c.id, courseId: htmlCourse })).json().id as string;
  return { thanh, platformId, scorm, html, scormCourse, connectionId: c.id as string };
}

/** A launch through the app: returns the play id and its runtime token. */
async function launch(platformId: string, pub: string, over: Partial<Parameters<typeof launchToken>[0]> = {}) {
  const ltik = t.lti.addLaunch(launchToken({ platformId, target: `${TEST_URLS.lti}/lti/launch/cogniate?resource=${pub}`, ...over }));
  const r = await t.app.inject({ method: 'GET', url: `/tool/launch?ltik=${ltik}` });
  expect(r.statusCode).toBe(303);
  const playId = /\/play\/(ply_[A-Za-z0-9_-]+)/.exec(String(r.headers.location))![1]!;
  return { playId, token: runtimeTokenFor(TEST_MASTER_KEY, playId) };
}

const state = async (token: string) => (await content.inject({ method: 'GET', url: `/rt/${token}/state` })).json();
const cmi = (o: { status?: string; raw?: string; session?: string; exit?: string; suspend?: string } = {}) => ({
  core: { lesson_status: o.status ?? 'incomplete', lesson_location: 'index', score: { raw: o.raw ?? '', min: '', max: '' }, session_time: o.session ?? '0000:00:01.00', exit: o.exit ?? '' },
  suspend_data: o.suspend ?? '',
});
/** One commit of a session (seq taken from the state, unless given). */
async function commit(token: string, event: 'commit' | 'finish' | 'unload', c: ReturnType<typeof cmi>, seq?: number, beacon = false) {
  const st = await state(token);
  const body = { kind: 'scorm12', event, sessionId: st.sessionId, seq: seq ?? st.lastSeq + 1, cmi: c };
  return content.inject({
    method: 'POST', url: `/rt/${token}/commit`, headers: { 'content-type': beacon ? 'text/plain;charset=UTF-8' : 'application/json' },
    payload: JSON.stringify(body),
  });
}
const attemptOf = (token: string) => t.db.prepare('SELECT a.* FROM attempt a JOIN play_session ps ON ps.attempt_id = a.id WHERE ps.runtime_token_hash = ?').get(sha256Hex(token))!;
const syncs = () => t.db.prepare('SELECT *, learner_subject AS user_sub FROM record_dispatch ORDER BY created_at, seq').all();

describe('content origin (app contract §7, security §7)', () => {
  it('AC-T5-01: package file with nosniff and frame-ancestors {content} {app}; raw ../ and %2e%2e/ -> 400 or 404', async () => {
    await world();
    const pkg = String(t.db.prepare('SELECT package_id AS p FROM course_version LIMIT 1').get()!.p);
    const r = await content.inject({ method: 'GET', url: `/pkg/${pkg}/index.html` });
    expect([r.statusCode, r.headers['content-type'], r.headers['x-content-type-options']]).toEqual([200, 'text/html; charset=utf-8', 'nosniff']);
    expect(r.headers['content-security-policy']).toBe(`frame-ancestors ${TEST_URLS.content} ${TEST_URLS.app}`);
    expect(r.headers['set-cookie']).toBeUndefined();
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
    // Raw paths as sent (curl --path-as-is): a real HTTP request, because inject resolves dot segments itself.
    await content.listen({ port: 0, host: '127.0.0.1' });
    const port = (content.server.address() as AddressInfo).port;
    const raw = (path: string) => new Promise<{ status: number; body: string }>((ok, ko) => {
      request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
        let body = '';
        res.on('data', (c: Buffer) => { body += c.toString(); });
        res.on('end', () => ok({ status: res.statusCode ?? 0, body }));
      }).on('error', ko).end();
    });
    for (const path of [`/pkg/${pkg}/../${pkg}/index.html`, `/pkg/${pkg}/assets/../index.html`, `/pkg/${pkg}/%2e%2e/%2e%2e/cogniate.db`, `/pkg/${pkg}/%2E%2E/index.html`,
      `/pkg/${pkg}/assets/..%2f..%2findex.html`, `/pkg/${pkg}/a%5c..%5cindex.html`, '/pkg/../packages/index.html']) {
      const bad = await raw(path);
      expect([400, 404], path).toContain(bad.status);
      expect(bad.body).not.toContain('blank SCO');
    }
    expect((await raw(`/pkg/${pkg}/index.html`)).body).toContain('blank SCO');
    expect((await content.inject({ method: 'GET', url: `/pkg/${pkg}/imsmanifest.xml` })).headers['content-type']).toBe('application/xml');
    expect((await content.inject({ method: 'GET', url: '/pkg/pkg_AAAAAAAAAAAAAAAAAAAAAA/index.html' })).statusCode).toBe(404);
  });

  it('AC-T5-02: Range bytes=0-1023 -> 206 video/mp4 with Content-Range; an unsatisfiable range -> 416', async () => {
    await world();
    const pkg = String(t.db.prepare('SELECT package_id AS p FROM course_version LIMIT 1').get()!.p);
    const r = await content.inject({ method: 'GET', url: `/pkg/${pkg}/assets/ask-lyra/lyra.mp4`, headers: { range: 'bytes=0-1023' } });
    expect([r.statusCode, r.headers['content-type'], r.headers['content-range'], r.rawPayload.length]).toEqual([206, 'video/mp4', 'bytes 0-1023/5000', 1024]);
    expect((await content.inject({ method: 'GET', url: `/pkg/${pkg}/assets/ask-lyra/lyra.mp4`, headers: { range: 'bytes=6000-' } })).statusCode).toBe(416);
    expect(parseRange('bytes=-500', 5000)).toEqual([4500, 4999]);
    expect(parseRange('bytes=0-1,5-6', 5000)).toBeNull();
    expect(packageFilePath('/d/p', 'a/../../x')).toBeNull();
    expect(packageFilePath('/d/p', 'a/b.html')).toBe('/d/p/a/b.html');
  });

  it('AC-T5-03: the runtime page has frame-ancestors {app} and loads the runtime script; a random token -> 404', async () => {
    const w = await world();
    const { token } = await launch(w.platformId, w.scorm);
    const page = await content.inject({ method: 'GET', url: `/rt/${token}` });
    expect(page.statusCode).toBe(200);
    expect(String(page.headers['content-security-policy'])).toContain(`frame-ancestors ${TEST_URLS.app}`);
    expect(page.body).toContain('<script type="module" src="/_rt/assets/runtime.js"></script>');
    expect((await content.inject({ method: 'GET', url: `/rt/${'x'.repeat(43)}` })).statusCode).toBe(404);
    expect((await content.inject({ method: 'GET', url: '/_rt/assets/runtime.js' })).headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect((await content.inject({ method: 'GET', url: '/_rt/assets/..%2fcogniate.db' })).statusCode).toBe(404);
  });

  it('AC-T5-15: token scope, STALE_SEQUENCE, and RUNTIME_EXPIRED at PLAY_TTL_SECONDS + 3 s', async () => {
    const w = await world({ playTtlSeconds: 20 });
    const a = await launch(w.platformId, w.scorm, { sub: '5' });
    const b = await launch(w.platformId, w.scorm, { sub: '6' });
    expect([(await state(a.token)).learner.id, (await state(b.token)).learner.id]).toEqual(['5', '6']);
    expect((await content.inject({ method: 'GET', url: `/rt/${'y'.repeat(43)}/state` })).statusCode).toBe(404);
    expect((await commit(a.token, 'commit', cmi(), 3)).statusCode).toBe(200);
    const stale = await commit(a.token, 'commit', cmi(), 3);
    expect([stale.statusCode, stale.json().details.message]).toEqual([409, 'STALE_SEQUENCE']);
    expect((await state(a.token)).lastSeq).toBe(3);
    t.clock.now += 23_000;
    const late = await content.inject({ method: 'POST', url: `/rt/${a.token}/commit`, headers: { 'content-type': 'application/json' }, payload: { kind: 'scorm12', event: 'commit', sessionId: 'x', seq: 9, cmi: cmi() } });
    expect([late.statusCode, late.json().details.message]).toEqual([410, 'RUNTIME_EXPIRED']);
  });

  it('AC-T5-16: 5,000 chars of suspend_data -> 400 INVALID_CMI, details.field cmi.suspend_data, commit_rejected logged', async () => {
    const w = await world();
    const { token } = await launch(w.platformId, w.scorm);
    const r = await commit(token, 'commit', cmi({ suspend: 'x'.repeat(5000) }));
    expect([r.statusCode, r.json().details.message, r.json().details.field]).toEqual([400, 'INVALID_CMI', 'cmi.suspend_data']);
    expect(contentLogs).toContainEqual(expect.objectContaining({ event: 'commit_rejected', code: 'INVALID_CMI', field: 'cmi.suspend_data' }));
    const wrongSession = await content.inject({ method: 'POST', url: `/rt/${token}/commit`, headers: { 'content-type': 'application/json' }, payload: { kind: 'scorm12', event: 'commit', sessionId: 'ses_other', seq: 1, cmi: cmi() } });
    expect([wrongSession.statusCode, wrongSession.json().details.field]).toEqual([400, 'sessionId']);
  });
});

describe('SCORM sessions and outcome (app contract §7, ADR-010)', () => {
  it('AC-T5-21 / AC-T5-22: LMSFinish only -> completed and one 100/100 row; each session counts once with its largest session_time', async () => {
    const w = await world();
    const s1 = await launch(w.platformId, w.scorm);
    expect((await state(s1.token)).scorm).toMatchObject({ entry: 'ab-initio', masteryScore: 70, credit: 'credit', cmi: { core: { total_time: '0000:00:00.00' } } });
    expect((await commit(s1.token, 'commit', cmi({ status: 'not attempted', session: '0000:00:30.00' }))).statusCode).toBe(200);
    const fin = await commit(s1.token, 'finish', cmi({ status: 'not attempted', session: '0000:00:30.00' }));
    expect(fin.json()).toEqual({ accepted: true, outcome: 'completed', scoreGiven: 100, scoreMaximum: 100 });
    // The runtime's unload after LMSFinish (window close, sendBeacon text/plain): stored, nothing lowered, no second row.
    expect((await commit(s1.token, 'unload', cmi({ status: 'not attempted', session: '0000:00:30.00' }), undefined, true)).statusCode).toBe(200);
    expect(JSON.parse(String(attemptOf(s1.token).cmi_or_progress)).core.lesson_status).toBe('completed');
    expect(syncs().map((s) => [s.status, s.score_given, s.score_maximum])).toEqual([['pending', 100, 100]]);
    expect(JSON.parse(String(syncs()[0]!.payload))).toEqual({ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 100, scoreMaximum: 100 });
    const s2 = await launch(w.platformId, w.scorm);
    expect((await state(s2.token)).scorm.cmi.core.total_time).toBe('0000:00:30.00');
    await commit(s2.token, 'commit', cmi({ session: '0000:00:30.00' }));
    await commit(s2.token, 'finish', cmi({ session: '0000:00:30.00' }));
    await commit(s2.token, 'unload', cmi({ session: '0000:00:30.00' }), undefined, true);
    const s3 = await launch(w.platformId, w.scorm);
    expect((await state(s3.token)).scorm.cmi.core.total_time).toBe('0000:01:00.00');
    expect(contentLogs.filter((l) => l.event === 'commit_accepted').map((l) => l.commit_event)).toEqual(['commit', 'finish', 'unload', 'commit', 'finish', 'unload']);
  });

  it('AC-T5-06 / AC-T5-35: suspend + commit (or only the unload of a closed window) -> the next session resumes', async () => {
    const w = await world();
    const s1 = await launch(w.platformId, w.scorm);
    await commit(s1.token, 'commit', cmi({ suspend: 'qa-resume', exit: 'suspend' }));
    const st = await state((await launch(w.platformId, w.scorm)).token);
    expect([st.scorm.entry, st.scorm.cmi.suspend_data, st.scorm.cmi.core.exit]).toEqual(['resume', 'qa-resume', '']);
    const other = await launch(w.platformId, w.scorm, { sub: '6' });
    await commit(other.token, 'unload', cmi({ status: 'incomplete', exit: 'suspend' }), undefined, true);
    expect(attemptOf(other.token).outcome).toBe('in_progress');
    expect((await state((await launch(w.platformId, w.scorm, { sub: '6' })).token)).scorm.entry).toBe('resume');
    expect(syncs()).toEqual([]);
  });

  it('AC-T5-07 / -20 / -12 / -08 / -23: best result wins and is never lowered; the mastery rule decides on finish', async () => {
    const w = await world();
    const a = await launch(w.platformId, w.scorm);
    await commit(a.token, 'commit', cmi({ status: 'passed', raw: '100' }));
    expect((await commit(a.token, 'finish', cmi({ status: 'passed', raw: '100' }))).json().outcome).toBe('passed');
    const reopen = await launch(w.platformId, w.scorm); // AC-T5-20: the package finishes again at once
    await commit(reopen.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    const later = await launch(w.platformId, w.scorm); // AC-T5-12: a forged lower result
    expect((await commit(later.token, 'commit', cmi({ status: 'failed', raw: '0' }))).json()).toMatchObject({ outcome: 'passed', scoreGiven: 100 });
    expect(syncs().map((s) => [s.user_sub, s.score_given])).toEqual([['5', 100]]);
    const b = await launch(w.platformId, w.scorm, { sub: '6' }); // AC-T5-08: wrong answer, mastery 70
    expect((await commit(b.token, 'finish', cmi({ status: 'incomplete', raw: '0' }))).json()).toMatchObject({ outcome: 'failed', scoreGiven: 0 });
    const b2 = await launch(w.platformId, w.scorm, { sub: '6' }); // AC-T5-23: a better result later
    await commit(b2.token, 'commit', cmi({ status: 'passed', raw: '100' }));
    await commit(b2.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    expect(syncs().map((s) => [s.user_sub, s.score_given])).toEqual([['5', 100], ['6', 0], ['6', 100]]);
  });

  it('AC-T5-34: after finish only the unload arrives; the outcome stays', async () => {
    const w = await world();
    const a = await launch(w.platformId, w.scorm);
    await commit(a.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    await commit(a.token, 'unload', cmi({ status: 'passed', raw: '100' }), undefined, true);
    expect(attemptOf(a.token).outcome).toBe('passed');
    expect(contentLogs.filter((l) => l.event === 'commit_accepted' && l.commit_event === 'finish')).toHaveLength(1);
  });

  it('AC-T5-13: a teacher preview has credit "no-credit", never makes a row, and is a preview result row', async () => {
    const w = await world();
    const p = await launch(w.platformId, w.scorm, { roles: [INSTRUCTOR], sub: '2' });
    expect((await state(p.token)).scorm.credit).toBe('no-credit');
    await commit(p.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    expect(syncs()).toEqual([]);
    expect((await t.app.inject({ method: 'GET', url: `/app-api/play/${p.playId}/status` })).json().scoreSync).toEqual({ status: null, scoreGiven: null, scoreMaximum: null });
    const rows = (await json('GET', `/app-api/publications/${w.scorm}/results`, w.thanh)).json().rows;
    expect(rows).toEqual([expect.objectContaining({ preview: true, scoreSyncs: [], best: expect.objectContaining({ outcome: 'passed' }) })]);
  });

  it('AC-T5-24: an in-progress attempt continues on version 1; a final one starts a new attempt on version 2', async () => {
    const w = await world();
    const done = await launch(w.platformId, w.scorm, { sub: '5' });
    await commit(done.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    const going = await launch(w.platformId, w.scorm, { sub: '6' });
    await commit(going.token, 'commit', cmi({ status: 'incomplete' }));
    const v1 = (await state(going.token)).packageBaseUrl;
    await upload(w.thanh, w.scormCourse, scormFiles());
    await json('POST', '/app-api/publications', w.thanh, { connectionId: w.connectionId, courseId: w.scormCourse });
    expect((await state((await launch(w.platformId, w.scorm, { sub: '6' })).token)).packageBaseUrl).toBe(v1);
    expect((await state((await launch(w.platformId, w.scorm, { sub: '5' })).token)).packageBaseUrl).not.toBe(v1);
    const rows = (await json('GET', `/app-api/publications/${w.scorm}/results`, w.thanh)).json().rows;
    expect(rows.find((r: { learner: { sub: string } }) => r.learner.sub === '5').attempts).toHaveLength(2);
  });

  it('AC-T5-37: rebind with an in-progress attempt -> a new HTML attempt; the SCORM attempt stays, gets no row, shows under its publication', async () => {
    const w = await world();
    const s = await launch(w.platformId, w.scorm, { sub: '6', resourceLinkId: '77' });
    await commit(s.token, 'commit', cmi({ status: 'incomplete' }));
    const h = await launch(w.platformId, w.html, { sub: '6', resourceLinkId: '77' });
    expect((await state(h.token)).format).toBe('html');
    expect(attemptOf(s.token).outcome).toBe('in_progress');
    const scormRows = (await json('GET', `/app-api/publications/${w.scorm}/results`, w.thanh)).json().rows;
    const htmlRows = (await json('GET', `/app-api/publications/${w.html}/results`, w.thanh)).json().rows;
    expect(scormRows).toEqual([expect.objectContaining({ best: expect.objectContaining({ outcome: 'in_progress' }), scoreSyncs: [] })]);
    expect(htmlRows).toEqual([expect.objectContaining({ best: expect.objectContaining({ outcome: 'not_started' }) })]);
  });
});

describe('results and score sync (app contract §5, §10)', () => {
  it('the worker sends with SERVICE-AUTH-V1 and marks sent; results show best, attempts and scoreSyncs; status shows the text', async () => {
    const w = await world();
    const { playId, token } = await launch(w.platformId, w.scorm);
    await commit(token, 'finish', cmi({ status: 'passed', raw: '100' }));
    const worker = createScoreSyncWorker({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger: createLogger({ service: 'cogniate-app', write: (l) => t.logs.push(JSON.parse(l)) }), masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
    await worker.kick();
    expect(t.lti.scores).toEqual([{ serviceKey: 's'.repeat(43), lineItemId: `${TEST_URLS.moodle}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1`, body: { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 100, scoreMaximum: 100 } }]);
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'score_sync', status: 'sent', tries: 1 }));
    const rows = (await json('GET', `/app-api/publications/${w.scorm}/results`, w.thanh)).json().rows;
    expect(rows).toEqual([expect.objectContaining({
      learner: { sub: '5', label: 'Learner 5 @ moodle.test' }, activity: expect.objectContaining({ title: 'Cogniate SCORM', contextTitle: 'Cogniate Dev 101' }), preview: false,
      best: expect.objectContaining({ outcome: 'passed', scoreGiven: 100, scoreMaximum: 100 }), scoreSyncs: [expect.objectContaining({ status: 'sent', tries: 1, scoreGiven: 100 })], gradebook: null,
    })]);
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.thanh)).json().stats).toMatchObject({ passed: 1, learners: 1, lastScoreSync: new Date(t.clock.now).toISOString() });
    expect((await t.app.inject({ method: 'GET', url: `/app-api/play/${playId}/status` })).json().scoreSync).toEqual({ status: 'sent', scoreGiven: 100, scoreMaximum: 100 });
    expect((await t.app.inject({ method: 'GET', url: `/play/${playId}` })).body).toContain('Completed — score 100 sent to Moodle');
    const qaB = await t.login(QA_B);
    expect((await json('GET', `/app-api/publications/${w.scorm}/results`, qaB)).statusCode).toBe(404);
  });

  it('answers: 409 -> conflict, 400 -> failed (lastError), 502 -> retry in 5 s, no service key -> failed; a missing line item is looked up', async () => {
    const w = await world();
    const worker = createScoreSyncWorker({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger: createLogger({ service: 'cogniate-app', write: () => undefined }), masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
    const run = async (sub: string, fail: { status: number; code: string } | null) => {
      const { token } = await launch(w.platformId, w.scorm, { sub });
      await commit(token, 'finish', cmi({ status: 'passed', raw: '100' }));
      t.lti.failNext = fail;
      await worker.kick();
      return t.db.prepare('SELECT *, learner_subject AS user_sub FROM record_dispatch WHERE learner_subject = ?').get(sub)!;
    };
    expect((await run('11', { status: 409, code: 'PLATFORM_CONFLICT' })).status).toBe('conflict');
    const rejected = await run('12', { status: 400, code: 'PLATFORM_REJECTED_REQUEST' });
    expect([rejected.status, rejected.last_error]).toEqual(['failed', '400 PLATFORM_REJECTED_REQUEST']);
    const retry = await run('13', { status: 502, code: 'PLATFORM_ERROR' });
    expect([retry.status, retry.tries, Number(retry.next_try_at) - t.clock.now]).toEqual(['pending', 1, 5000]);
    t.clock.now += 5000;
    await worker.kick();
    expect(t.db.prepare("SELECT status FROM record_dispatch WHERE learner_subject = '13'").get()!.status).toBe('sent');
    // Missing line item (a launch without the AGS lineitem claim): GET /api/lineitems?resourceLinkId=.
    const l14 = await launch(w.platformId, w.scorm, { sub: '14' });
    t.db.prepare('UPDATE resource_link SET line_item_id = NULL').run();
    t.lti.lineItems.set('3', [`${TEST_URLS.moodle}/lineitems/9/lineitem`]);
    await commit(l14.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    await worker.kick();
    expect([t.db.prepare("SELECT status FROM record_dispatch WHERE learner_subject = '14'").get()!.status, t.lti.scores.at(-1)!.lineItemId]).toEqual(['sent', `${TEST_URLS.moodle}/lineitems/9/lineitem`]);
    expect(t.db.prepare('SELECT line_item_id AS l FROM resource_link').get()!.l).toBe(`${TEST_URLS.moodle}/lineitems/9/lineitem`);
    t.db.prepare('UPDATE resource_link SET service_key_encrypted = NULL').run();
    const { token } = await launch(w.platformId, w.scorm, { sub: '15' });
    t.db.prepare('UPDATE resource_link SET service_key_encrypted = NULL').run();
    await commit(token, 'finish', cmi({ status: 'passed', raw: '100' }));
    await worker.kick();
    expect(t.db.prepare("SELECT status, last_error FROM record_dispatch WHERE learner_subject = '15'").get()).toEqual({ status: 'failed', last_error: 'No gradebook column: the activity has no AGS line item.' });
    expect(LtiServiceError).toBeDefined();
  });
});

// ---------------------------------------------------------------- T5b: HTML runtime, retry, conflict, Resend, refresh
async function progress(token: string, event: 'progress' | 'unload', p: { seenPages: string[]; answers?: Record<string, string> }, beacon = false) {
  const st = await state(token);
  return content.inject({
    method: 'POST', url: `/rt/${token}/commit`, headers: { 'content-type': beacon ? 'text/plain;charset=UTF-8' : 'application/json' },
    payload: JSON.stringify({ kind: 'html', event, sessionId: st.sessionId, seq: st.lastSeq + 1, progress: { answers: {}, ...p } }),
  });
}
const quietWorker = () => createScoreSyncWorker({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger: createLogger({ service: 'cogniate-app', write: () => undefined }), masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
const rowOf = (sub: string) => t.db.prepare('SELECT *, learner_subject AS user_sub FROM record_dispatch WHERE learner_subject = ? ORDER BY created_at DESC, seq DESC').get(sub)!;

describe('P2 durable score confirmation', () => {
  const sub = 'p2-recovery';
  async function uncertainLower() {
    const w = await world();
    const worker = quietWorker();
    const low = await launch(w.platformId, w.scorm, { sub });
    await commit(low.token, 'finish', cmi({ status: 'failed', raw: '60' }));
    t.lti.failNext = { status: 504, code: 'PLATFORM_TIMEOUT' };
    await worker.kick();
    return { w, worker, lowId: String(rowOf(sub).id) };
  }
  async function confirmationPending() {
    const fixture = await uncertainLower();
    const high = await launch(fixture.w.platformId, fixture.w.scorm, { sub });
    await commit(high.token, 'finish', cmi({ status: 'passed', raw: '90' }));
    await fixture.worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'pending', tries: 1, sent_at: null, confirmation_after: t.clock.now + 5000 });
    return { ...fixture, high, highId: String(rowOf(sub).id) };
  }
  function restartSnapshot() {
    // A file database carries the state into a fresh connection and worker; no worker memory is reused.
    const file = join(t.dataDir, 'restart.db');
    t.db.prepare('VACUUM INTO ?').run(file);
    const db = openDb(file);
    const worker = createScoreSyncWorker({ channels: TEST_CHANNELS, db, lti: t.lti.client,
      logger: createLogger({ service: 'cogniate-app', write: (line) => t.logs.push(JSON.parse(line)) }),
      masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
    return { db, worker };
  }

  it('reopens a pending confirmation, waits the full five seconds, then sends once', async () => {
    const { highId, lowId } = await confirmationPending();
    const { db, worker } = restartSnapshot();
    try {
      t.clock.now += 4999;
      await worker.kick();
      expect(t.lti.scores.map((s) => s.body.scoreGiven)).toEqual([90]);
      expect(db.prepare('SELECT status, sent_at FROM record_dispatch WHERE id = ?').get(highId)).toEqual({ status: 'pending', sent_at: null });
      t.clock.now += 1;
      await worker.kick();
      expect(db.prepare('SELECT status, tries, sent_at FROM record_dispatch WHERE id = ?').get(highId)).toEqual({ status: 'sent', tries: 2, sent_at: t.clock.now });
      expect(db.prepare('SELECT status, delivery_uncertain FROM record_dispatch WHERE id = ?').get(lowId)).toEqual({ status: 'superseded', delivery_uncertain: 0 });
      t.clock.now += 90_000;
      await worker.kick();
      expect(t.lti.scores.map((s) => s.body.scoreGiven)).toEqual([90, 90]);
    } finally { db.close(); }
  });

  it('recovers a crash during the lower POST after a better row superseded it', async () => {
    const w = await world();
    const worker = quietWorker();
    const low = await launch(w.platformId, w.scorm, { sub });
    await commit(low.token, 'finish', cmi({ status: 'failed', raw: '60' }));
    const lowId = String(rowOf(sub).id);
    const started = Promise.withResolvers<void>();
    const timeout = Promise.withResolvers<void>();
    const original = t.lti.client.postScore;
    t.lti.client.postScore = async (...args) => {
      if ((args[2] as { scoreGiven: number }).scoreGiven === 60) {
        started.resolve();
        await timeout.promise;
        throw new LtiServiceError(0, 'LTI_SERVICE_UNREACHABLE', 'No answer.');
      }
      return original(...args);
    };
    const sending = worker.kick();
    await started.promise;
    const high = await launch(w.platformId, w.scorm, { sub });
    await commit(high.token, 'finish', cmi({ status: 'passed', raw: '90' }));
    const highId = String(rowOf(sub).id);
    const recovered = restartSnapshot();
    try {
      expect(recovered.db.prepare('SELECT status, tries, delivery_uncertain, send_started_at FROM record_dispatch WHERE id = ?').get(lowId))
        .toEqual({ status: 'superseded', tries: 1, delivery_uncertain: 1, send_started_at: null });
      await recovered.worker.kick();
      expect(recovered.db.prepare('SELECT status, sent_at FROM record_dispatch WHERE id = ?').get(highId)).toEqual({ status: 'pending', sent_at: null });
      t.clock.now += 5000;
      await recovered.worker.kick();
      expect(recovered.db.prepare('SELECT status, tries FROM record_dispatch WHERE id = ?').get(highId)).toEqual({ status: 'sent', tries: 2 });
    } finally {
      recovered.db.close();
      timeout.resolve();
      await sending;
    }
  });

  it('transfers confirmation to a still higher result on a new course version', async () => {
    const { w, worker, high, highId } = await confirmationPending();
    const oldVersion = attemptOf(high.token).course_version_id;
    t.clock.now += 1;
    await upload(w.thanh, w.scormCourse, [...scormFiles(), { name: 'version.txt', data: '2' }]);
    await json('POST', '/app-api/publications', w.thanh, { connectionId: w.connectionId, courseId: w.scormCourse });
    const newer = await launch(w.platformId, w.scorm, { sub });
    expect(attemptOf(newer.token).course_version_id).not.toBe(oldVersion);
    await commit(newer.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'pending', score_given: 100, sent_at: null });
    expect(syncs().find((r) => r.id === highId)?.status).toBe('superseded');
    t.clock.now += 5000;
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'sent', score_given: 100 });
    expect(t.lti.scores.map((s) => s.body.scoreGiven)).toEqual([90, 100, 100]);
  });

  it.each([[409, 'conflict'], [400, 'failed']] as const)('a confirmation %i stays %s with no automatic retry', async (http, status) => {
    const { worker } = await confirmationPending();
    t.clock.now += 5000;
    t.lti.failNext = { status: http, code: http === 409 ? 'PLATFORM_CONFLICT' : 'PLATFORM_REJECTED_REQUEST' };
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status, tries: 2, sent_at: null, next_try_at: null });
    const calls = t.lti.calls.length;
    t.clock.now += 120_000;
    await worker.kick();
    expect(t.lti.calls).toHaveLength(calls);
  });

  it('keeps the confirmation phase and thirty-second retry after a timeout and restart', async () => {
    const { worker, highId } = await confirmationPending();
    t.clock.now += 5000;
    t.lti.failNext = { status: 504, code: 'PLATFORM_TIMEOUT' };
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'pending', tries: 2, sent_at: null, next_try_at: t.clock.now + 30_000 });
    const restarted = restartSnapshot();
    try {
      t.clock.now += 29_999;
      await restarted.worker.kick();
      expect(t.lti.scores.map((s) => s.body.scoreGiven)).toEqual([90]);
      t.clock.now += 1;
      await restarted.worker.kick();
      expect(restarted.db.prepare('SELECT status, tries FROM record_dispatch WHERE id = ?').get(highId)).toEqual({ status: 'sent', tries: 3 });
      expect(t.lti.scores.map((s) => s.body.scoreGiven)).toEqual([90, 90]);
    } finally { restarted.db.close(); }
  });

  it('does not clear uncertainty when a confirmation is superseded in flight', async () => {
    const { w, worker, highId } = await confirmationPending();
    const original = t.lti.client.postScore;
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    t.lti.client.postScore = async (...args) => {
      if ((args[2] as { scoreGiven: number }).scoreGiven === 90) {
        started.resolve();
        await finish.promise;
      }
      return original(...args);
    };
    t.clock.now += 5000;
    const confirming = worker.kick();
    await started.promise;
    const newer = await launch(w.platformId, w.scorm, { sub });
    await commit(newer.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    finish.resolve();
    await confirming;
    expect(syncs().find((r) => r.id === highId)?.status).toBe('superseded');
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'pending', score_given: 100, sent_at: null });
    t.clock.now += 5000;
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'sent', score_given: 100 });
    expect(t.lti.scores.map((s) => s.body.scoreGiven)).toEqual([90, 90, 100, 100]);
  });

  it.each(['timeout', 'already expired'])('ends the original retry window on %s without claiming sent', async (mode) => {
    const { worker } = await confirmationPending();
    t.clock.now = Number(rowOf(sub).created_at) + 24 * 3_600_000 + (mode === 'timeout' ? -1000 : 1);
    t.lti.failNext = { status: 504, code: 'PLATFORM_TIMEOUT' };
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'failed', sent_at: null, next_try_at: null, tries: mode === 'timeout' ? 2 : 1 });
    const calls = t.lti.calls.length;
    await worker.kick();
    expect(t.lti.calls).toHaveLength(calls);
  });

  it('retains earlier uncertainty after an ordinary retry succeeds', async () => {
    const { w, worker, lowId } = await uncertainLower();
    t.clock.now += 5000;
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'sent', delivery_uncertain: 1 });
    const high = await launch(w.platformId, w.scorm, { sub });
    await commit(high.token, 'finish', cmi({ status: 'passed', raw: '90' }));
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'pending', sent_at: null });
    t.clock.now += 5000;
    await worker.kick();
    expect(rowOf(sub).status).toBe('sent');
    expect(syncs().find((r) => r.id === lowId)?.delivery_uncertain).toBe(0);
  });

  it('recovers an interrupted confirmation with its retry count and phase', async () => {
    const { worker, highId } = await confirmationPending();
    t.clock.now += 5000;
    const original = t.lti.client.postScore;
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    t.lti.client.postScore = async (...args) => {
      started.resolve();
      await finish.promise;
      return original(...args);
    };
    const interrupted = worker.kick();
    await started.promise;
    const restarted = restartSnapshot();
    finish.resolve();
    await interrupted;
    try {
      expect(restarted.db.prepare('SELECT status, tries, sent_at, next_try_at, delivery_uncertain FROM record_dispatch WHERE id = ?').get(highId))
        .toEqual({ status: 'pending', tries: 2, sent_at: null, next_try_at: t.clock.now + 30_000, delivery_uncertain: 1 });
      await restarted.worker.kick();
      t.clock.now += 30_000;
      await restarted.worker.kick();
      expect(restarted.db.prepare('SELECT status, tries FROM record_dispatch WHERE id = ?').get(highId)).toEqual({ status: 'sent', tries: 3 });
      expect(t.logs).toContainEqual(expect.objectContaining({ event: 'score_sync', sync_id: highId, status: 'sent', phase: 'confirmation', tries: 3 }));
    } finally { restarted.db.close(); }
  });

  it('fails when the first accepted higher score leaves no time for confirmation', async () => {
    const { w, worker } = await uncertainLower();
    const high = await launch(w.platformId, w.scorm, { sub });
    await commit(high.token, 'finish', cmi({ status: 'passed', raw: '90' }));
    t.clock.now += 24 * 3_600_000 - 4000;
    await worker.kick();
    expect(rowOf(sub)).toMatchObject({ status: 'failed', tries: 1, sent_at: null, next_try_at: null,
      last_error: 'The score confirmation could not finish within the retry window.' });
  });

  it.each(['batch', 'lookup'])('does not send a stale lower row after an awaited %s operation', async (mode) => {
    const w = await world();
    const worker = quietWorker();
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    if (mode === 'batch') {
      const blocker = await launch(w.platformId, w.scorm, { sub: 'other-learner' });
      await commit(blocker.token, 'finish', cmi({ status: 'passed', raw: '100' }));
      const original = t.lti.client.postScore;
      t.lti.client.postScore = async (...args) => {
        if ((args[2] as { userId: string }).userId === 'other-learner') {
          started.resolve();
          await finish.promise;
        }
        return original(...args);
      };
      t.clock.now += 1;
    }
    const low = await launch(w.platformId, w.scorm, { sub });
    await commit(low.token, 'finish', cmi({ status: 'failed', raw: '60' }));
    const lowId = String(rowOf(sub).id);
    if (mode === 'lookup') {
      t.db.prepare('UPDATE resource_link SET line_item_id = NULL').run();
      t.lti.client.findLineItems = async () => {
        started.resolve();
        await finish.promise;
        return [{ id: `${TEST_URLS.moodle}/lineitems/7/lineitem` }];
      };
    }
    const draining = worker.kick();
    await started.promise;
    const high = await launch(w.platformId, w.scorm, { sub });
    await commit(high.token, 'finish', cmi({ status: 'passed', raw: '90' }));
    finish.resolve();
    await draining;
    await worker.kick();
    expect(syncs().find((r) => r.id === lowId)).toMatchObject({ status: 'superseded', tries: 0 });
    expect(t.lti.scores.filter((s) => s.body.userId === sub).map((s) => s.body.scoreGiven)).toEqual([90]);
    expect(rowOf(sub)).toMatchObject({ status: 'sent', tries: 1 });
  });

  it('isolates uncertainty by learner, activity and tenant', async () => {
    const { w, worker, lowId } = await uncertainLower();
    const otherUser = await launch(w.platformId, w.scorm, { sub: 'another-user' });
    const otherActivity = await launch(w.platformId, w.scorm, { sub, resourceLinkId: 'another-activity' });
    const qaB = await t.login(QA_B);
    const connection = (await json('POST', '/app-api/connections', qaB, { name: 'B', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    const platform = (await json('PUT', `/app-api/connections/${connection.id}/platform`, qaB, {
      issuer: TEST_URLS.moodle, clientId: 'other-tenant', deploymentId: '1', authenticationEndpoint: `${TEST_URLS.moodle}/a`,
      accessTokenEndpoint: `${TEST_URLS.moodle}/t`, jwksUrl: `${TEST_URLS.moodle}/k`,
    })).json().platform.id as string;
    const otherCourse = await course(qaB, 'Other tenant course', scormFiles());
    const publication = (await json('POST', '/app-api/publications', qaB, { connectionId: connection.id, courseId: otherCourse })).json().id as string;
    const otherTenant = await launch(platform, publication, { sub });
    for (const target of [otherUser, otherActivity, otherTenant]) await commit(target.token, 'finish', cmi({ status: 'passed', raw: '90' }));
    await worker.kick();
    expect(syncs().filter((r) => r.id !== lowId).map((r) => [r.status, r.tries, r.confirmation_after]))
      .toEqual([['sent', 1, null], ['sent', 1, null], ['sent', 1, null]]);
    expect(syncs().find((r) => r.id === lowId)?.delivery_uncertain).toBe(1);
  });

  it.each(['send', 'confirmation'])('a higher final attempt without a sync row blocks a lower %s POST', async (phase) => {
    const { w, worker } = phase === 'confirmation' ? await confirmationPending() : await uncertainLower();
    const lowerId = String(rowOf(sub).id);
    const sentBefore = t.lti.scores.map((s) => s.body.scoreGiven);
    await upload(w.thanh, w.scormCourse, scormFiles());
    await json('POST', '/app-api/publications', w.thanh, { connectionId: w.connectionId, courseId: w.scormCourse });
    const higher = await launch(w.platformId, w.scorm, { sub });
    const attempt = attemptOf(higher.token);
    // Model a final attempt whose sync row is absent. Keep the lower row pending so the attempt guard is exercised.
    t.db.prepare("UPDATE attempt SET outcome = 'passed', score_given = ?, score_maximum = 100 WHERE id = ?")
      .run(phase === 'confirmation' ? 95 : 80, String(attempt.id));
    expect(t.db.prepare('SELECT s.id FROM record_dispatch s JOIN learning_record r ON r.id = s.record_id WHERE r.attempt_id = ?').get(String(attempt.id))).toBeUndefined();
    const callsBefore = t.lti.calls.length;
    t.clock.now += 5000;
    await worker.kick();
    expect(t.lti.scores.map((s) => s.body.scoreGiven)).toEqual(sentBefore);
    expect(t.lti.calls).toHaveLength(callsBefore);
    expect(t.db.prepare('SELECT status, tries FROM record_dispatch WHERE id = ?').get(lowerId)).toEqual({ status: 'pending', tries: 1 });
  });
});

describe('HTML runtime on the server (app contract §7, §9; T5b)', () => {
  it('RuntimeState has the profile; progress commits: menu only -> in_progress; all pages + correct answer -> passed 100 (AC-T5-09, -11)', async () => {
    const w = await world();
    const a = await launch(w.platformId, w.html);
    const st = await state(a.token);
    expect(st).toMatchObject({ format: 'html', scorm: null, html: { profile: { pages: ['index', 'lesson'], menuPage: 'index', questionIds: [HTML_Q], masteryScore: 70 }, progress: { seenPages: [] } } });
    expect((await progress(a.token, 'progress', { seenPages: ['index'] })).json()).toMatchObject({ outcome: 'in_progress' });
    expect((await progress(a.token, 'unload', { seenPages: ['index'] }, true)).statusCode).toBe(200); // AC-T5-11: closed after the menu
    expect(syncs()).toEqual([]);
    const b = await launch(w.platformId, w.html);
    expect((await state(b.token)).html.progress).toEqual({ seenPages: ['index'], answers: {} });
    const done = await progress(b.token, 'progress', { seenPages: ['index', 'lesson'], answers: { [HTML_Q]: '1' } });
    expect(done.json()).toEqual({ accepted: true, outcome: 'passed', scoreGiven: 100, scoreMaximum: 100 });
    expect(syncs().map((r) => [r.status, r.score_given])).toEqual([['pending', 100]]);
    expect(contentLogs.filter((l) => l.event === 'commit_accepted').map((l) => l.commit_event)).toEqual(['progress', 'unload', 'progress']);
  });

  it('AC-T5-27 / -28: a wrong first answer fails with 0 and cannot be changed later (400 INVALID_PROGRESS)', async () => {
    const w = await world();
    const a = await launch(w.platformId, w.html, { sub: '6' });
    await progress(a.token, 'progress', { seenPages: ['index'], answers: { [HTML_Q]: '0' } });
    const changed = await progress(a.token, 'progress', { seenPages: ['index', 'lesson'], answers: { [HTML_Q]: '1' } });
    expect([changed.statusCode, changed.json().details.message, changed.json().details.field]).toEqual([400, 'INVALID_PROGRESS', `progress.answers.${HTML_Q}`]);
    expect(contentLogs).toContainEqual(expect.objectContaining({ event: 'commit_rejected', code: 'INVALID_PROGRESS' }));
    expect((await progress(a.token, 'progress', { seenPages: ['index', 'lesson'], answers: { [HTML_Q]: '0' } })).json()).toMatchObject({ outcome: 'failed', scoreGiven: 0 });
    const bad = await progress(a.token, 'progress', { seenPages: ['index', 'secret-page'] });
    expect([bad.statusCode, bad.json().details.field]).toEqual([400, 'progress.seenPages']);
  });

  it('AC-T5-10: the HTML package bytes are served unchanged (SHA-256 per file)', async () => {
    await world();
    const pkg = String(t.db.prepare("SELECT package_id AS p FROM course_version WHERE format = 'html'").get()!.p);
    for (const f of HTML_FILES) {
      const r = await content.inject({ method: 'GET', url: `/pkg/${pkg}/${f.name}` });
      const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
      expect(sha(r.rawPayload), f.name).toBe(sha(Buffer.from(f.data)));
    }
  });
});

describe('score sync: retry, outage order, conflict, Resend, refresh (ADR-010 rules 5, 8-10; T5b)', () => {
  it.each(['sent', 'failed'] as const)('P11: a lower retake shows its 60 and the best sync score 80, pending then %s', async (status) => {
    const w = await world();
    const first = await launch(w.platformId, w.scorm);
    await commit(first.token, 'finish', cmi({ status: 'failed', raw: '40' }));
    const improved = await launch(w.platformId, w.scorm);
    await commit(improved.token, 'finish', cmi({ status: 'passed', raw: '80' }));
    // Same creation time: the newest row's status and score must be read together.
    expect(syncs().map((r) => [r.status, r.score_given])).toEqual([['superseded', 40], ['pending', 80]]);
    await upload(w.thanh, w.scormCourse, scormFiles());
    await json('POST', '/app-api/publications', w.thanh, { connectionId: w.connectionId, courseId: w.scormCourse });
    const retake = await launch(w.platformId, w.scorm);
    await commit(retake.token, 'finish', cmi({ status: 'failed', raw: '60' }));
    expect(syncs()).toHaveLength(2); // a lower attempt must not replace the best score
    // Newer rows from a different learner or activity must not change this shell's status.
    for (const over of [{ sub: 'other' }, { resourceLinkId: 'other' }]) {
      const other = await launch(w.platformId, w.scorm, over);
      await commit(other.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    }
    const check = async (syncStatus: string, text: string) => {
      expect((await t.app.inject({ method: 'GET', url: `/app-api/play/${retake.playId}/status` })).json()).toEqual({
        outcome: 'failed', scoreGiven: 60, scoreMaximum: 100, preview: false,
        scoreSync: { status: syncStatus, scoreGiven: 80, scoreMaximum: 100 },
      });
      expect((await t.app.inject({ method: 'GET', url: `/play/${retake.playId}` })).body).toContain(text);
    };
    await check('pending', 'Completed — score 60. Sending your best score, 80, to Moodle');
    if (status === 'failed') t.lti.failNext = { status: 400, code: 'PLATFORM_REJECTED_REQUEST' };
    await quietWorker().kick();
    await check(status, status === 'sent' ? 'Completed — score 60. Moodle keeps your best score: 80' : 'Completed — score 60. Your best score, 80, was not sent to Moodle');
  });

  it('P2: a failed in-flight lower score stays superseded and is never retried', async () => {
    const w = await world();
    const low = await launch(w.platformId, w.scorm, { sub: '29' });
    await commit(low.token, 'finish', cmi({ status: 'failed', raw: '60' }));
    const lowId = String(rowOf('29').id);
    let started!: () => void;
    let release!: () => void;
    const inFlight = new Promise<void>((resolve) => { started = resolve; });
    const finishSend = new Promise<void>((resolve) => { release = resolve; });
    const postScore = t.lti.client.postScore;
    const attempted: unknown[] = [];
    t.lti.client.postScore = async (...args) => {
      const score = (args[2] as { scoreGiven: number }).scoreGiven;
      attempted.push(score);
      if (score === 60) {
        started();
        await finishSend;
        throw new LtiServiceError(502, 'PLATFORM_ERROR', 'Moodle unavailable');
      }
      return postScore(...args);
    };
    const worker = createScoreSyncWorker({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client, logger: createLogger({ service: 'cogniate-app', write: (l) => t.logs.push(JSON.parse(l)) }), masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
    const running = worker.kick();
    await inFlight;
    try {
      const high = await launch(w.platformId, w.scorm, { sub: '29' });
      await commit(high.token, 'finish', cmi({ status: 'passed', raw: '80' }));
      expect(syncs().find((r) => r.id === lowId)?.status).toBe('superseded');
    } finally {
      release();
      await running;
    }
    expect(syncs().find((r) => r.id === lowId)).toMatchObject({ status: 'superseded', next_try_at: null });
    expect(t.logs.filter((l) => l.event === 'score_sync' && l.sync_id === lowId)).toEqual([
      expect.objectContaining({ trace_id: expect.stringMatching(/^[0-9a-f]{32}$/), status: 'superseded', send_result: 'pending', tries: 1 }),
    ]);
    await worker.kick();
    t.clock.now += 5000;
    await worker.kick();
    expect(attempted).toEqual([60, 80, 80]);
    expect(t.lti.scores.map((s) => s.body.scoreGiven)).toEqual([80, 80]);
    expect(rowOf('29').status).toBe('sent');
  });

  it.each([null, 50])('P2: late remote writes survive two timeouts; recover the best score with teacher override %s', async (override) => {
    const w = await world();
    const low = await launch(w.platformId, w.scorm, { sub: 'p2-late' });
    await commit(low.token, 'finish', cmi({ status: 'failed', raw: '60' }));
    const lowId = String(rowOf('p2-late').id);
    const attempts: number[] = [];
    const lateWrites: Array<() => void> = [];
    let remoteGrade: number | null = null;
    const secondStarted = Promise.withResolvers<void>();
    const secondTimeout = Promise.withResolvers<void>();
    t.lti.client.postScore = async (_serviceKey, _lineItemId, body) => {
      const score = (body as { scoreGiven: number }).scoreGiven;
      attempts.push(score);
      const apply = () => { remoteGrade = override ?? score; };
      if (score === 60) {
        // Cancelling the client request does not cancel Moodle's queued write.
        // On recovery both old requests can pass the timestamp check before 90 is stored.
        lateWrites.push(apply);
        if (lateWrites.length === 2) {
          secondStarted.resolve();
          await secondTimeout.promise;
          t.clock.now += 3000;
        } else {
          t.clock.now += 5000;
        }
        throw new LtiServiceError(0, 'LTI_SERVICE_UNREACHABLE', 'The LTI service did not answer.');
      }
      apply();
    };
    const logs: LogLine[] = [];
    const worker = createScoreSyncWorker({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client,
      logger: createLogger({ service: 'cogniate-app', write: (line) => logs.push(JSON.parse(line)) }),
      masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
    await worker.kick();
    expect(rowOf('p2-late')).toMatchObject({ status: 'pending', tries: 1 });
    t.clock.now += 5000;
    const second = worker.kick();
    await secondStarted.promise;
    t.clock.now += 2000; // QA: the better result arrives 7 s after the first timeout.
    const high = await launch(w.platformId, w.scorm, { sub: 'p2-late' });
    await commit(high.token, 'finish', cmi({ status: 'passed', raw: '90' }));
    expect(syncs().find((r) => r.id === lowId)?.status).toBe('superseded');
    secondTimeout.resolve();
    await second;
    await worker.kick();
    expect(remoteGrade).toBe(override ?? 90);
    expect(rowOf('p2-late')).toMatchObject({ status: 'pending', sent_at: null, tries: 1, confirmation_after: t.clock.now + 5000 });
    // Moodle completes the older writes after it acknowledges the higher write.
    for (const apply of lateWrites) apply();
    expect(remoteGrade).toBe(override ?? 60);
    for (let i = 0; i < 20; i++) {
      t.clock.now += 5000;
      await worker.kick();
    }
    expect(remoteGrade).toBe(override ?? 90);
    expect(rowOf('p2-late').status).toBe('sent');
    expect(attempts.filter((score) => score === 90)).toEqual([90, 90]);
    expect(syncs().find((r) => r.id === lowId)).toMatchObject({ status: 'superseded', next_try_at: null });
    expect(attempts.filter((score) => score === 60)).toEqual([60, 60]);
    expect(logs.filter((line) => line.event === 'score_sync' && line.sync_id === lowId)).toEqual([
      expect.objectContaining({ status: 'pending', tries: 1 }),
      expect.objectContaining({ status: 'superseded', send_result: 'pending', tries: 2 }),
    ]);
    expect(logs.filter((line) => line.event === 'score_sync' && line.sync_id !== lowId)).toEqual([
      expect.objectContaining({ status: 'pending', send_result: 'sent', phase: 'send', tries: 1 }),
      expect.objectContaining({ status: 'sent', phase: 'confirmation', tries: 2 }),
    ]);
  });

  it('AC-T5-14 / -30: a send that fails is retried; during an outage a later forged 0 makes no row; after the outage 100 is sent', async () => {
    const w = await world();
    const worker = quietWorker();
    const a = await launch(w.platformId, w.scorm, { sub: '30' });
    await commit(a.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    t.lti.failNext = { status: 504, code: 'PLATFORM_TIMEOUT' };
    await worker.kick();
    expect([rowOf('30').status, rowOf('30').tries, Number(rowOf('30').next_try_at) - t.clock.now]).toEqual(['pending', 1, 5000]);
    const forged = await launch(w.platformId, w.scorm, { sub: '30' });
    await commit(forged.token, 'commit', cmi({ status: 'failed', raw: '0' }));
    await commit(forged.token, 'finish', cmi({ status: 'failed', raw: '0' }));
    expect(syncs().filter((r) => r.user_sub === '30')).toHaveLength(1);
    t.lti.failNext = { status: 502, code: 'PLATFORM_ERROR' };
    t.clock.now += 5000;
    await worker.kick();
    expect([rowOf('30').status, rowOf('30').tries, Number(rowOf('30').next_try_at) - t.clock.now]).toEqual(['pending', 2, 30_000]);
    t.clock.now += 30_000;
    await worker.kick();
    expect(rowOf('30').status).toBe('sent');
    expect(t.lti.scores.map((x) => x.body.scoreGiven)).toEqual([100]);
  });

  it('AC-T5-31 / -32: conflict names PLATFORM_CONFLICT and is not retried; Resend: failed/conflict only, never lower, library scope', async () => {
    const w = await world();
    const worker = quietWorker();
    const c = await launch(w.platformId, w.scorm, { sub: '31' });
    await commit(c.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    t.lti.failNext = { status: 409, code: 'PLATFORM_CONFLICT' };
    await worker.kick();
    const conflict = rowOf('31');
    expect([conflict.status, conflict.tries, String(conflict.last_error)]).toEqual(['conflict', 1, expect.stringContaining('PLATFORM_CONFLICT')]);
    t.clock.now += 120_000;
    await worker.kick();
    expect(rowOf('31').tries).toBe(1); // no retry
    const f = await launch(w.platformId, w.scorm, { sub: '32' });
    await commit(f.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    t.lti.failNext = { status: 400, code: 'PLATFORM_REJECTED_REQUEST' };
    await worker.kick();
    const failed = rowOf('32');
    expect([failed.status, String(failed.last_error)]).toEqual(['failed', expect.stringContaining('PLATFORM_REJECTED_REQUEST')]);

    const resend = (id: string, cookie = w.thanh) => json('POST', `/app-api/score-syncs/${id}/resend`, cookie);
    const r = await resend(String(failed.id));
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ id: failed.id, status: 'pending', tries: 0, lastError: null });
    await worker.kick();
    expect(rowOf('32').status).toBe('sent');
    const again = await resend(String(failed.id));
    expect([again.statusCode, again.json().details.message]).toEqual([409, 'SYNC_NOT_RESENDABLE']);
    t.lti.failNext = { status: 409, code: 'PLATFORM_CONFLICT' };
    expect((await resend(String(conflict.id))).statusCode).toBe(200);
    await worker.kick();
    expect(rowOf('31').status).toBe('conflict'); // Moodle still has the newer time
    expect((await resend(String(conflict.id), await t.login(QA_B))).statusCode).toBe(404);
    expect((await resend('sync_unknown')).statusCode).toBe(404);
    // Never lower: a failed 0 row is not sent again while a sent 100 row exists.
    const low = await launch(w.platformId, w.scorm, { sub: '33' });
    await commit(low.token, 'finish', cmi({ status: 'failed', raw: '0' }));
    t.lti.failNext = { status: 400, code: 'PLATFORM_REJECTED_REQUEST' };
    await worker.kick();
    const lowRow = rowOf('33');
    const high = await launch(w.platformId, w.scorm, { sub: '33' });
    await commit(high.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    await worker.kick();
    expect([(await resend(String(lowRow.id))).statusCode]).toEqual([409]);
  });

  it('AC-T5-33 / -18: "Refresh from Moodle" stores the gradebook value; gradebookDiffers when Moodle keeps another grade', async () => {
    const w = await world();
    const worker = quietWorker();
    const lineItem = `${TEST_URLS.moodle}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1`;
    for (const sub of ['40', '41']) {
      const a = await launch(w.platformId, w.scorm, { sub });
      await commit(a.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    }
    await worker.kick();
    t.lti.gradebook.set(`${lineItem} 40`, { resultScore: 50, resultMaximum: 100 }); // a teacher override
    t.lti.gradebook.set(`${lineItem} 41`, { resultScore: 100, resultMaximum: 100 });
    const before = (await json('GET', `/app-api/publications/${w.scorm}/results`, w.thanh)).json().rows;
    expect(before.every((r: { gradebook: unknown; gradebookDiffers: boolean }) => r.gradebook === null && r.gradebookDiffers === false)).toBe(true);
    const r = await json('POST', `/app-api/publications/${w.scorm}/results/refresh`, w.thanh);
    expect(r.statusCode).toBe(200);
    const bySub = Object.fromEntries(r.json().rows.map((x: { learner: { sub: string } }) => [x.learner.sub, x]));
    expect(bySub['40']).toMatchObject({ gradebook: { resultScore: 50, resultMaximum: 100, readAt: new Date(t.clock.now).toISOString() }, gradebookDiffers: true });
    expect(bySub['41']).toMatchObject({ gradebook: { resultScore: 100 }, gradebookDiffers: false });
    expect(t.lti.calls.filter((c) => c.startsWith('GET results'))).toHaveLength(2);
    expect((await json('POST', `/app-api/publications/${w.scorm}/results/refresh`, await t.login(QA_B))).statusCode).toBe(404);
  });
});

describe('A-T5a-01 / -02 / -06: ordering, cookies, worker errors', () => {
  it('a finish that arrives after a higher-seq unload still closes the attempt (LMSFinish rule) and makes the row', async () => {
    const w = await world();
    const a = await launch(w.platformId, w.scorm);
    const st = await state(a.token);
    const send = (event: string, seq: number, c: ReturnType<typeof cmi>) => content.inject({ method: 'POST', url: `/rt/${a.token}/commit`,
      headers: { 'content-type': 'application/json' }, payload: { kind: 'scorm12', event, sessionId: st.sessionId, seq, cmi: c } });
    const blank = cmi({ status: 'not attempted', session: '0000:00:20.00' });
    expect((await send('unload', st.lastSeq + 2, blank)).json()).toMatchObject({ outcome: 'in_progress' });
    const late = await send('finish', st.lastSeq + 1, blank);
    expect([late.statusCode, late.json().outcome, late.json().scoreGiven]).toEqual([200, 'completed', 100]);
    expect(syncs().map((r) => [r.status, r.score_given])).toEqual([['pending', 100]]);
    expect(contentLogs.filter((l) => l.event === 'commit_accepted').map((l) => [l.commit_event, l.stale ?? false])).toEqual([['unload', false], ['finish', true]]);
    const stale = await send('commit', st.lastSeq + 1, blank);
    expect([stale.statusCode, stale.json().details.message]).toEqual([409, 'STALE_SEQUENCE']); // a late commit is still stale
    expect((await state(a.token)).lastSeq).toBe(st.lastSeq + 2);
  });

  it('a late unload is accepted but never overwrites newer data (SCORM keeps the stored CMI; HTML merges)', async () => {
    const w = await world();
    const a = await launch(w.platformId, w.scorm);
    await commit(a.token, 'commit', cmi({ suspend: 'newer' }), 5);
    expect((await commit(a.token, 'unload', cmi({ suspend: 'older' }), 4, true)).statusCode).toBe(200);
    expect(JSON.parse(String(attemptOf(a.token).cmi_or_progress)).suspend_data).toBe('newer');
    const h = await launch(w.platformId, w.html);
    const hs = await state(h.token);
    const post = (event: string, seq: number, p: object) => content.inject({ method: 'POST', url: `/rt/${h.token}/commit`, headers: { 'content-type': 'application/json' },
      payload: { kind: 'html', event, sessionId: hs.sessionId, seq, progress: p } });
    await post('progress', 3, { seenPages: ['index', 'lesson'], answers: {} });
    expect((await post('unload', 2, { seenPages: ['index'], answers: { [HTML_Q]: '1' } })).json()).toMatchObject({ outcome: 'passed', scoreGiven: 100 });
    expect((await state(h.token)).html.progress).toEqual({ seenPages: ['index', 'lesson'], answers: { [HTML_Q]: '1' } });
  });

  it('A-T5a-02: the runtime page clears the cookies of the content origin', async () => {
    const w = await world();
    const { token } = await launch(w.platformId, w.scorm);
    expect((await content.inject({ method: 'GET', url: `/rt/${token}` })).headers['clear-site-data']).toBe('"cookies"');
  });

  it('A-T5a-06: a service key that cannot be decrypted -> failed once (no send every 2 s)', async () => {
    const w = await world();
    const a = await launch(w.platformId, w.scorm, { sub: '60' });
    await commit(a.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    t.db.prepare("UPDATE resource_link SET service_key_encrypted = X'00112233'").run();
    const logs: LogLine[] = [];
    const worker = createScoreSyncWorker({ channels: TEST_CHANNELS, db: t.db, lti: t.lti.client,
      logger: createLogger({ service: 'cogniate-app', write: (line) => logs.push(JSON.parse(line)) }),
      masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
    await worker.kick();
    await worker.kick();
    expect([rowOf('60').status, rowOf('60').tries, String(rowOf('60').last_error)]).toEqual(['failed', 0, expect.stringContaining('Internal error')]); // no score POST
    expect(logs.filter((line) => line.event === 'score_sync')).toEqual([]);
    expect(t.lti.scores).toEqual([]);
  });
});

describe('T5b round 2: only the best result is ever sent; strict refresh; late body of its own session', () => {
  async function finalRow(w: Awaited<ReturnType<typeof world>>, sub: string, raw: string, fail: { status: number; code: string } | null) {
    const worker = quietWorker();
    const a = await launch(w.platformId, w.scorm, { sub });
    await commit(a.token, 'finish', cmi({ status: Number(raw) >= 70 ? 'passed' : 'failed', raw }));
    t.lti.failNext = fail;
    await worker.kick();
    return rowOf(sub);
  }
  const resend = (w: { thanh: string }, id: unknown) => json('POST', `/app-api/score-syncs/${String(id)}/resend`, w.thanh);

  it('A-T5b-02: a lower failed row is not resent when the better row is conflict or failed (409 SYNC_NOT_RESENDABLE)', async () => {
    const w = await world();
    for (const [sub, betterFail] of [['70', { status: 409, code: 'PLATFORM_CONFLICT' }], ['71', { status: 400, code: 'PLATFORM_REJECTED_REQUEST' }]] as const) {
      const low = await finalRow(w, sub, '50', { status: 400, code: 'PLATFORM_REJECTED_REQUEST' });
      const best = await finalRow(w, sub, '100', betterFail);
      expect([low.status, best.status]).toEqual(['failed', betterFail.status === 409 ? 'conflict' : 'failed']);
      const r = await resend(w, low.id);
      expect([r.statusCode, r.json().details.message, r.json().details.description]).toEqual([409, 'SYNC_NOT_RESENDABLE', 'This learner has a better result. Resend the better result instead.']);
      expect((await resend(w, best.id)).statusCode).toBe(200); // the best one may be resent
      await quietWorker().kick(); // send it now, so the next loop starts with no due row
    }
  });

  it('A-T5b-02: after a better row failed, a lower new result makes no row (it would lower the grade in Moodle)', async () => {
    const w = await world();
    await finalRow(w, '72', '100', { status: 400, code: 'PLATFORM_REJECTED_REQUEST' });
    const again = await launch(w.platformId, w.scorm, { sub: '72' });
    await commit(again.token, 'finish', cmi({ status: 'failed', raw: '0' }));
    expect(syncs().filter((r) => r.user_sub === '72').map((r) => [r.status, r.score_given])).toEqual([['failed', 100]]);
  });

  it('A-T5b-02: a resend is refused when a better final attempt exists, even without its own row', async () => {
    const w = await world();
    const low = await finalRow(w, '73', '50', { status: 400, code: 'PLATFORM_REJECTED_REQUEST' });
    t.db.prepare("UPDATE attempt SET outcome = 'passed', score_given = 100, score_maximum = 100 WHERE user_sub = '73'").run(); // e.g. a row lost to a crash
    expect((await resend(w, low.id)).statusCode).toBe(409);
  });

  it('P5: Resend compares fractional best scores across final attempts without a higher sync row', async () => {
    const w = await world();
    await upload(w.thanh, w.scormCourse, scormFiles());
    // Choose version ids in index order so integer division ties cannot accidentally pick the better attempt.
    const versions = t.db.prepare('SELECT id FROM course_version WHERE course_id = ? ORDER BY id').all(w.scormCourse);
    await json('POST', '/app-api/publications', w.thanh, { connectionId: w.connectionId, courseId: w.scormCourse, versionId: versions[0]!.id });
    const low = await finalRow(w, '74', '60', { status: 400, code: 'PLATFORM_REJECTED_REQUEST' });
    await json('POST', '/app-api/publications', w.thanh, { connectionId: w.connectionId, courseId: w.scormCourse, versionId: versions[1]!.id });
    const high = await launch(w.platformId, w.scorm, { sub: '74' });
    await commit(high.token, 'finish', cmi({ status: 'passed', raw: '80' }));
    expect(t.db.prepare("SELECT score_given FROM attempt WHERE user_sub = '74' ORDER BY rowid").all()).toEqual([{ score_given: 60 }, { score_given: 80 }]);
    t.db.prepare('DELETE FROM record_dispatch WHERE id = ?').run(String(rowOf('74').id)); // simulate a missing best-score row
    const r = await resend(w, low.id);
    expect([r.statusCode, r.json().details.message]).toEqual([409, 'SYNC_NOT_RESENDABLE']);
    expect(rowOf('74').status).toBe('failed');
  });

  it('B-T5b-01: refresh never stores another learner\'s value; failed reads are logged with the contract fields and the others go on', async () => {
    const w = await world();
    await finalRow(w, '80', '100', null);
    await finalRow(w, '81', '100', null);
    const lineItem = `${TEST_URLS.moodle}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1`;
    // A platform that ignores the user filter: it answers with another learner's entry only.
    const orig = t.lti.client.getResults;
    t.lti.client.getResults = async (_k, _l, userId) => (userId === '80' ? [{ userId: '99', resultScore: 7, resultMaximum: 100 }] : [{ userId, resultScore: 100, resultMaximum: 100 }]);
    const r = await json('POST', `/app-api/publications/${w.scorm}/results/refresh`, w.thanh);
    const bySub = Object.fromEntries(r.json().rows.map((x: { learner: { sub: string } }) => [x.learner.sub, x]));
    expect(bySub['80'].gradebook).toMatchObject({ resultScore: null });
    expect(bySub['81'].gradebook).toMatchObject({ resultScore: 100 });
    t.lti.client.getResults = async (_k, _l, userId) => {
      if (userId === '80') throw new LtiServiceError(502, 'PLATFORM_ERROR', 'Moodle down');
      return [{ userId, resultScore: 90, resultMaximum: 100 }];
    };
    const r2 = await json('POST', `/app-api/publications/${w.scorm}/results/refresh`, w.thanh);
    t.lti.client.getResults = orig;
    expect(r2.statusCode).toBe(200);
    const rl = String(t.db.prepare('SELECT id FROM resource_link').get()!.id);
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'gradebook_refresh_failed', publication_id: w.scorm, resource_link_id: rl, lti_status: 502, lti_code: 'PLATFORM_ERROR' }));
    const after = Object.fromEntries(r2.json().rows.map((x: { learner: { sub: string } }) => [x.learner.sub, x]));
    expect([after['80'].gradebook.resultScore, after['81'].gradebook.resultScore]).toEqual([null, 90]); // 80 keeps its last value
    expect(lineItem).toContain('lineitems');
  });

  it('A-T5b-03: a late finish uses the CMI of its own session, not another open window of the same attempt', async () => {
    const w = await world();
    const s1 = await launch(w.platformId, w.scorm, { sub: '90' });
    const s1State = await state(s1.token);
    const post = (token: string, sessionId: string, event: string, seq: number, c: ReturnType<typeof cmi>) => content.inject({
      method: 'POST', url: `/rt/${token}/commit`, headers: { 'content-type': 'application/json' }, payload: { kind: 'scorm12', event, sessionId, seq, cmi: c } });
    await post(s1.token, s1State.sessionId, 'commit', 2, cmi({ status: 'not attempted' }));
    const s2 = await launch(w.platformId, w.scorm, { sub: '90' });
    await post(s2.token, (await state(s2.token)).sessionId, 'commit', 1, cmi({ status: 'incomplete', raw: '40' }));
    // S1's finish (seq 1) arrives after its commit (seq 2): the rule runs on S1's data (no score -> completed 100),
    // not on S2's score 40 (which would give failed 40).
    const late = await post(s1.token, s1State.sessionId, 'finish', 1, cmi({ status: 'not attempted' }));
    expect(late.json()).toMatchObject({ outcome: 'completed', scoreGiven: 100 });
  });
});
