// T8 (stretch): .mbz builds through the host-side Build Runner queue, Moodle web services token, course shell.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeZip, scormManifest } from '@cogniate/package-inspector/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { MoodleWsClient } from '../clients/moodle-ws.ts';
import { MoodleWsError } from '../clients/moodle-ws.ts';
import type { TestApp } from '../testkit.ts';
import { QA_B, TEST_URLS, THANH, formBody, queueDir, testApp } from '../testkit.ts';

let t: TestApp;
afterEach(async () => {
  await t?.app.close();
});

const json = async (method: string, url: string, cookie: string, payload?: unknown) =>
  t.app.inject({ method: method as 'GET', url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as object } : {}) });

async function version(cookie: string, files: Array<{ name: string; data: string }>, title = 'SCORM course') {
  const course = (await json('POST', '/app-api/courses', cookie, { title })).json().id as string;
  const body = await formBody({ package: makeZip(files) });
  const r = await t.app.inject({ method: 'POST', url: `/app-api/courses/${course}/versions`, headers: { ...t.writeHeaders(cookie), ...body.headers }, payload: body.payload });
  return { course, version: r.json().id as string };
}
const scorm = [{ name: 'imsmanifest.xml', data: scormManifest({ mastery: '70' }) }, { name: 'index.html', data: '<html><body>x</body></html>' }];
const requests = () => readdirSync(join(queueDir(t.dataDir), 'requests')).filter((f) => f.endsWith('.json'));

describe('.mbz builds (app contract §11, ADR-007)', () => {
  it('POST queues ONE request with checked fields and the knobs; a second POST while queued gives the same build', async () => {
    t = await testApp({ buildKnobs: { hold: true, failAt: 'backup' } });
    const cookie = await t.login(THANH);
    const v = await version(cookie, scorm, 'AI Website Sprint — SCORM');
    const r = await json('POST', `/app-api/courses/${v.course}/versions/${v.version}/mbz`, cookie);
    expect(r.statusCode).toBe(202);
    expect(r.json()).toMatchObject({ status: 'queued', courseId: v.course, versionId: v.version, downloadUrl: null, buildId: expect.stringMatching(/^bld_[0-9a-f]{24}$/) });
    expect(requests()).toEqual([`${r.json().buildId}.json`]);
    const req = JSON.parse(readFileSync(join(queueDir(t.dataDir), 'requests', requests()[0]!), 'utf8'));
    expect(req).toEqual({
      buildId: r.json().buildId, courseId: v.course, versionId: v.version, packageSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      variant: 'default', lang: 'en', title: 'AI Website Sprint — SCORM', hold: true, failAt: 'backup',
    });
    const again = await json('POST', `/app-api/courses/${v.course}/versions/${v.version}/mbz`, cookie);
    expect([again.statusCode, again.json().buildId]).toEqual([202, r.json().buildId]);
    expect(requests()).toHaveLength(1);
  });

  it('an HTML version cannot be built (422 MBZ_NOT_SUPPORTED); another library gets 404', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const html = await version(cookie, [{ name: 'index.html', data: '<html><body>h</body></html>' }]);
    const r = await json('POST', `/app-api/courses/${html.course}/versions/${html.version}/mbz`, cookie);
    expect([r.statusCode, r.json().details.message]).toEqual([422, 'MBZ_NOT_SUPPORTED']);
    const s = await version(cookie, scorm);
    expect((await json('POST', `/app-api/courses/${s.course}/versions/${s.version}/mbz`, await t.login(QA_B))).statusCode).toBe(404);
  });

  it('GET reads the runner status: running, then ready with a download (the .mbz bytes); failed shows the reason', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const v = await version(cookie, scorm);
    const url = `/app-api/courses/${v.course}/versions/${v.version}`;
    expect((await json('GET', `${url}/mbz`, cookie)).statusCode).toBe(404);
    const id = (await json('POST', `${url}/mbz`, cookie)).json().buildId as string;
    const status = (s: object) => writeFileSync(join(queueDir(t.dataDir), 'status', `${id}.json`), JSON.stringify(s));
    status({ status: 'running', step: 'scorm' });
    expect((await json('GET', `${url}/mbz`, cookie)).json()).toMatchObject({ status: 'running', step: 'scorm' });
    expect((await json('GET', `${url}/download?kind=mbz`, cookie)).statusCode).toBe(404);
    writeFileSync(join(queueDir(t.dataDir), 'out', `${id}.mbz`), Buffer.from('MBZ-BYTES'));
    status({ status: 'ready', step: 'done', bytes: 9, finishedAt: new Date(t.clock.now).toISOString() });
    const ready = (await json('GET', `${url}/mbz`, cookie)).json();
    expect(ready).toMatchObject({ status: 'ready', bytes: 9, downloadUrl: `${url}/download?kind=mbz`, finishedAt: new Date(t.clock.now).toISOString() });
    const dl = await json('GET', `${url}/download?kind=mbz`, cookie);
    expect([dl.statusCode, dl.body, String(dl.headers['content-disposition'])]).toEqual([200, 'MBZ-BYTES', 'attachment; filename="cogniate-course-v1.mbz"']);
    expect((await json('GET', `${url}/download?kind=mbz`, await t.login(QA_B))).statusCode).toBe(404);
    // A new build after a failed one; the reason comes from the runner (AC-T8-07).
    const v2 = await version(cookie, scorm, 'Other');
    const url2 = `/app-api/courses/${v2.course}/versions/${v2.version}`;
    const id2 = (await json('POST', `${url2}/mbz`, cookie)).json().buildId as string;
    writeFileSync(join(queueDir(t.dataDir), 'status', `${id2}.json`), JSON.stringify({ status: 'failed', step: 'backup', reason: 'Test knob BUILD_RUNNER_FAIL_AT=backup: the build stopped at step backup.' }));
    expect((await json('GET', `${url2}/mbz`, cookie)).json()).toMatchObject({ status: 'failed', step: 'backup', reason: expect.stringContaining('BUILD_RUNNER_FAIL_AT=backup') });
  });

  it('a request that the runner does not take for 60 s says how to start the runner', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const v = await version(cookie, scorm);
    const url = `/app-api/courses/${v.course}/versions/${v.version}/mbz`;
    await json('POST', url, cookie);
    t.clock.now += 61_000;
    expect((await json('GET', url, cookie)).json()).toMatchObject({ status: 'queued', reason: expect.stringContaining('npm run build-runner') });
  });

  it('the host runner checks every request field (untrusted input; no path from the request is used)', () => {
    const queue = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'infra', 'build-runner', 'queue.mjs');
    const good = { buildId: `bld_${'a'.repeat(24)}`, courseId: `crs_${'A'.repeat(22)}`, versionId: `ver_${'B'.repeat(22)}`, packageSha256: 'f'.repeat(64), variant: 'default', lang: 'en', title: 'T', hold: false, failAt: '' };
    const run = (r: object) => {
      const file = join(t.dataDir, 'req.json');
      writeFileSync(file, JSON.stringify(r));
      return spawnSync(process.execPath, [queue, 'validate', file], { encoding: 'utf8' });
    };
    expect(JSON.parse(run(good).stdout)).toMatchObject({ hex: 'a'.repeat(24), idnumber: `cogniate:crs_${'A'.repeat(22)}:default:en` });
    for (const bad of [{ packageSha256: '../../.secrets/seed' }, { buildId: 'bld_../../x' }, { variant: 'a/b' }, { failAt: 'rm -rf /' }, { title: 'a\nb' }, { courseId: 'crs_x' }]) {
      const r = run({ ...good, ...bad });
      expect(r.status, JSON.stringify(bad)).toBe(1);
      expect(r.stderr).toMatch(/bad field/);
    }
  });
});

/** A fake Moodle web services client. */
function fakeWs(opts: { functions?: string[]; reject?: string } = {}) {
  const courses = new Map<string, number>();
  const calls: string[] = [];
  const ws: MoodleWsClient = {
    async siteInfo(_s, token) {
      calls.push(`siteInfo ${token}`);
      if (opts.reject) throw new MoodleWsError(opts.reject, 'Invalid token - token not found');
      return { siteName: 'Cogniate Dev Moodle', release: '5.2.4 (Build: 20261005)', functions: opts.functions ?? ['core_webservice_get_site_info', 'core_course_get_courses_by_field', 'core_course_create_courses', 'core_user_get_users'] };
    },
    async courseByIdnumber(_s, _t, idnumber) {
      calls.push(`get ${idnumber}`);
      const id = courses.get(idnumber);
      return id ? { id, idnumber, shortname: idnumber, visible: 0 } : null;
    },
    async createCourse(_s, _t, c) {
      calls.push(`create ${c.idnumber} ${c.shortname} cat=${c.categoryId}`);
      const id = courses.size + 10;
      courses.set(c.idnumber, id);
      return id;
    },
  };
  return { ws, calls, courses };
}

async function registeredConnection(cookie: string): Promise<string> {
  const c = (await json('POST', '/app-api/connections', cookie, { name: 'M', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
  await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, { issuer: TEST_URLS.moodle, clientId: 'c1', deploymentId: '1', authenticationEndpoint: `${TEST_URLS.moodle}/a`, accessTokenEndpoint: `${TEST_URLS.moodle}/t`, jwksUrl: `${TEST_URLS.moodle}/k` });
  return c.id as string;
}
const TOKEN = '0123456789abcdef0123456789abcdef';

describe('web services token and course shell (app contract §11)', () => {
  it('AC-T8-08: PUT web-services -> 200 with release and functions; the token is stored encrypted; a wrong token -> 422 WS_TOKEN_INVALID', async () => {
    const f = fakeWs();
    t = await testApp({ moodleWs: f.ws });
    const cookie = await t.login(THANH);
    const id = await registeredConnection(cookie);
    const r = await json('PUT', `/app-api/connections/${id}/web-services`, cookie, { token: TOKEN });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ siteName: 'Cogniate Dev Moodle', release: expect.stringMatching(/^5\.2/), functions: expect.arrayContaining(['core_course_create_courses']) });
    expect(JSON.stringify(t.db.prepare('SELECT * FROM connection').all())).not.toContain(TOKEN);
    const shown = (await json('GET', `/app-api/connections/${id}`, cookie)).json();
    expect(shown.webServices).toEqual({ siteName: 'Cogniate Dev Moodle', release: '5.2.4 (Build: 20261005)' }); // AC-T8-10: the checkbox shows
    expect(JSON.stringify(shown)).not.toContain(TOKEN);
    const wrong = await testApp({ moodleWs: fakeWs({ reject: 'invalidtoken' }).ws });
    const c2 = await wrong.login(THANH);
    const id2 = (await wrong.app.inject({ method: 'POST', url: '/app-api/connections', headers: wrong.writeHeaders(c2), payload: { name: 'M', siteUrl: TEST_URLS.moodle, method: 'manual' } })).json().id;
    const bad = await wrong.app.inject({ method: 'PUT', url: `/app-api/connections/${id2}/web-services`, headers: wrong.writeHeaders(c2), payload: { token: TOKEN } });
    expect([bad.statusCode, bad.json().details.message]).toEqual([422, 'WS_TOKEN_INVALID']);
    await wrong.app.close();
  });

  it('a token without a needed function -> 422 WS_FUNCTIONS_MISSING with the list', async () => {
    t = await testApp({ moodleWs: fakeWs({ functions: ['core_webservice_get_site_info'] }).ws });
    const cookie = await t.login(THANH);
    const id = await registeredConnection(cookie);
    const r = await json('PUT', `/app-api/connections/${id}/web-services`, cookie, { token: TOKEN });
    expect([r.statusCode, r.json().details.message, r.json().details.missing]).toEqual([422, 'WS_FUNCTIONS_MISSING', ['core_course_get_courses_by_field', 'core_course_create_courses']]);
  });

  it('AC-T8-09: publish with createMoodleCourse -> a hidden course with idnumber cogniate:<course>:default:en; again -> exists; without a token -> failed', async () => {
    const f = fakeWs();
    t = await testApp({ moodleWs: f.ws });
    const cookie = await t.login(THANH);
    const id = await registeredConnection(cookie);
    const v = await version(cookie, scorm, 'Shell course');
    const noToken = await json('POST', '/app-api/publications', cookie, { connectionId: id, courseId: v.course, createMoodleCourse: {} });
    expect(noToken.json()).toMatchObject({ shellStatus: 'failed', shellError: 'The connection has no web services token.', moodleCourse: null });
    await json('PUT', `/app-api/connections/${id}/web-services`, cookie, { token: TOKEN });
    const first = await json('POST', '/app-api/publications', cookie, { connectionId: id, courseId: v.course, createMoodleCourse: {} });
    const idnumber = `cogniate:${v.course}:default:en`;
    expect(first.json()).toMatchObject({ shellStatus: 'created', moodleCourse: { id: 10, idnumber, url: `${TEST_URLS.moodle}/course/view.php?id=10` } });
    expect(f.calls).toContain(`create ${idnumber} ${idnumber} cat=1`);
    const second = await json('POST', '/app-api/publications', cookie, { connectionId: id, courseId: v.course, createMoodleCourse: { categoryId: 1 } });
    expect(second.json()).toMatchObject({ shellStatus: 'exists', moodleCourse: { id: 10, idnumber } });
    expect(f.courses.size).toBe(1);
    const plain = await json('POST', '/app-api/publications', cookie, { connectionId: id, courseId: v.course });
    expect(plain.json().moodleCourse).toMatchObject({ id: 10 }); // the shell stays on the publication
  });
});
