// Integration tests of the T5a runtime path: launch (app) -> content host (/pkg, /rt) -> commit rules -> score sync worker
// -> results. Outside src/content-host on purpose: the ADR-008 import fence of that folder also covers its files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { makeZip, scormManifest } from '@cogniate/package-inspector/testing';
import type { LogLine } from '@cogniate/shared';
import { createLogger, sha256Hex } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { LtiServiceError } from './clients/lti-client.ts';
import { runtimeTokenFor } from './tool-pages/launch-rules.ts';
import type { TestApp } from './testkit.ts';
import { INSTRUCTOR, QA_B, TEST_MASTER_KEY, TEST_URLS, THANH, formBody, launchToken, testApp } from './testkit.ts';
import { createScoreSyncWorker } from './worker/score-sync.ts';
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

async function world(opts: Parameters<typeof testApp>[0] = {}) {
  t = await testApp(opts);
  contentLogs = [];
  const playerDir = join(t.dataDir, 'player');
  mkdirSync(playerDir, { recursive: true });
  writeFileSync(join(playerDir, 'runtime.js'), 'export {};');
  content = await buildContentApp({
    logger: createLogger({ service: 'cogniate-content', level: 'debug', write: (l) => contentLogs.push(JSON.parse(l) as LogLine) }),
    urls: TEST_URLS, profile: 'default', knobs: [], outboundAllowlist: [], db: t.db, dataDir: t.dataDir, playerDir, now: () => t.clock.now,
  });
  const thanh = await t.login(THANH);
  const c = (await json('POST', '/app-api/connections', thanh, { name: 'M', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
  const platformId = (await json('PUT', `/app-api/connections/${c.id}/platform`, thanh, {
    issuer: TEST_URLS.moodle, clientId: 'c1', deploymentId: '1', authenticationEndpoint: `${TEST_URLS.moodle}/a`, accessTokenEndpoint: `${TEST_URLS.moodle}/t`, jwksUrl: `${TEST_URLS.moodle}/k`,
  })).json().platform.id as string;
  const scormCourse = await course(thanh, 'SCORM course', scormFiles());
  const htmlCourse = await course(thanh, 'HTML course', [{ name: 'index.html', data: '<html><body>h</body></html>' }]);
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
const syncs = () => t.db.prepare('SELECT * FROM score_sync ORDER BY created_at, rowid').all();

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
    const worker = createScoreSyncWorker({ db: t.db, lti: t.lti.client, logger: createLogger({ service: 'cogniate-app', write: (l) => t.logs.push(JSON.parse(l)) }), masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
    await worker.kick();
    expect(t.lti.scores).toEqual([{ serviceKey: 's'.repeat(43), lineItemId: `${TEST_URLS.moodle}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1`, body: { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 100, scoreMaximum: 100 } }]);
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'score_sync', status: 'sent', tries: 1 }));
    const rows = (await json('GET', `/app-api/publications/${w.scorm}/results`, w.thanh)).json().rows;
    expect(rows).toEqual([expect.objectContaining({
      learner: { sub: '5', label: 'Learner 5 @ moodle.test' }, activity: expect.objectContaining({ title: 'Cogniate SCORM', contextTitle: 'Cogniate Dev 101' }), preview: false,
      best: expect.objectContaining({ outcome: 'passed', scoreGiven: 100, scoreMaximum: 100 }), scoreSyncs: [expect.objectContaining({ status: 'sent', tries: 1, scoreGiven: 100 })], gradebook: null,
    })]);
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.thanh)).json().stats).toMatchObject({ passed: 1, learners: 1, lastScoreSync: new Date(t.clock.now).toISOString() });
    expect((await t.app.inject({ method: 'GET', url: `/app-api/play/${playId}/status` })).json().scoreSync).toEqual({ status: 'sent' });
    expect((await t.app.inject({ method: 'GET', url: `/play/${playId}` })).body).toContain('Completed — score 100 sent to Moodle');
    const qaB = await t.login(QA_B);
    expect((await json('GET', `/app-api/publications/${w.scorm}/results`, qaB)).statusCode).toBe(404);
  });

  it('answers: 409 -> conflict, 400 -> failed (lastError), 502 -> retry in 5 s, no service key -> failed; a missing line item is looked up', async () => {
    const w = await world();
    const worker = createScoreSyncWorker({ db: t.db, lti: t.lti.client, logger: createLogger({ service: 'cogniate-app', write: () => undefined }), masterKey: TEST_MASTER_KEY, now: () => t.clock.now });
    const run = async (sub: string, fail: { status: number; code: string } | null) => {
      const { token } = await launch(w.platformId, w.scorm, { sub });
      await commit(token, 'finish', cmi({ status: 'passed', raw: '100' }));
      t.lti.failNext = fail;
      await worker.kick();
      return t.db.prepare('SELECT * FROM score_sync WHERE user_sub = ?').get(sub)!;
    };
    expect((await run('11', { status: 409, code: 'PLATFORM_CONFLICT' })).status).toBe('conflict');
    const rejected = await run('12', { status: 400, code: 'PLATFORM_REJECTED_REQUEST' });
    expect([rejected.status, rejected.last_error]).toEqual(['failed', '400 PLATFORM_REJECTED_REQUEST']);
    const retry = await run('13', { status: 502, code: 'PLATFORM_ERROR' });
    expect([retry.status, retry.tries, Number(retry.next_try_at) - t.clock.now]).toEqual(['pending', 1, 5000]);
    t.clock.now += 5000;
    await worker.kick();
    expect(t.db.prepare("SELECT status FROM score_sync WHERE user_sub = '13'").get()!.status).toBe('sent');
    // Missing line item (a launch without the AGS lineitem claim): GET /api/lineitems?resourceLinkId=.
    const l14 = await launch(w.platformId, w.scorm, { sub: '14' });
    t.db.prepare('UPDATE resource_link SET line_item_id = NULL').run();
    t.lti.lineItems.set('3', [`${TEST_URLS.moodle}/lineitems/9/lineitem`]);
    await commit(l14.token, 'finish', cmi({ status: 'passed', raw: '100' }));
    await worker.kick();
    expect([t.db.prepare("SELECT status FROM score_sync WHERE user_sub = '14'").get()!.status, t.lti.scores.at(-1)!.lineItemId]).toEqual(['sent', `${TEST_URLS.moodle}/lineitems/9/lineitem`]);
    expect(t.db.prepare('SELECT line_item_id AS l FROM resource_link').get()!.l).toBe(`${TEST_URLS.moodle}/lineitems/9/lineitem`);
    t.db.prepare('UPDATE resource_link SET service_key_encrypted = NULL').run();
    const { token } = await launch(w.platformId, w.scorm, { sub: '15' });
    t.db.prepare('UPDATE resource_link SET service_key_encrypted = NULL').run();
    await commit(token, 'finish', cmi({ status: 'passed', raw: '100' }));
    await worker.kick();
    expect(t.db.prepare("SELECT status, last_error FROM score_sync WHERE user_sub = '15'").get()).toEqual({ status: 'failed', last_error: 'No gradebook column: the activity has no AGS line item.' });
    expect(LtiServiceError).toBeDefined();
  });
});
