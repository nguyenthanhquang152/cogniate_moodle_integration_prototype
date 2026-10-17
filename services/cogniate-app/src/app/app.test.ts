import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeZip, scormManifest } from '@cogniate/package-inspector/testing';
import type { TestEntry } from '@cogniate/package-inspector/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../testkit.ts';
import { QA_B, TEST_URLS, THANH, formBody, testApp } from '../testkit.ts';

const FIXTURES = process.env.COURSE_FIXTURES_DIR ?? fileURLToPath(new URL('../../../../docs/raw/data/courses/', import.meta.url));
const HTML_ZIP = join(FIXTURES, 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip');
const SCORM_ZIP = join(FIXTURES, 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip');
const S3 = 'cogniate-prod-ai-course-creation.s3.ap-southeast-1.amazonaws.com';
const INDEX: TestEntry = { name: 'index.html', data: '<html><body data-lesson-id="L1"><div data-cog-quiz="Q1"></div></body></html>' };

let t: TestApp;
afterEach(async () => {
  await t?.app.close();
});

async function newCourse(cookie: string, title = 'Course A'): Promise<{ id: string }> {
  const res = await t.app.inject({ method: 'POST', url: '/app-api/courses', headers: t.writeHeaders(cookie), payload: { title } });
  expect(res.statusCode).toBe(201);
  return res.json();
}

async function upload(cookie: string, courseId: string, zip: Buffer, extra: Record<string, string> = {}) {
  const body = await formBody({ ...extra, package: zip });
  return t.app.inject({ method: 'POST', url: `/app-api/courses/${courseId}/versions`, headers: { ...t.writeHeaders(cookie), ...body.headers }, payload: body.payload });
}

const packageCount = () => readdirSync(t.store.packages).length;

describe('health', () => {
  it('GET /healthz', async () => {
    t = await testApp();
    const res = await t.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.json()).toEqual({ status: 'ok', service: 'cogniate-app', profile: 'default', knobs: [] });
    expect(t.logs.find((l) => l.event === 'http_request')?.level).toBe('debug');
  });
});

describe('session (AC-T4-01)', () => {
  it('login sets __Host-cog_session with Secure, HttpOnly, SameSite=Lax, Path=/, Max-Age=28800', async () => {
    t = await testApp();
    const res = await t.app.inject({ method: 'POST', url: '/app-api/session', headers: { origin: TEST_URLS.app }, payload: { email: THANH.email, password: THANH.password } });
    expect(res.statusCode).toBe(204);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/^__Host-cog_session=[A-Za-z0-9_-]{43}; /);
    for (const attr of ['Path=/', 'Max-Age=28800', 'Secure', 'HttpOnly', 'SameSite=Lax']) expect(cookie.split('; ')).toContain(attr);
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it('wrong password and unknown email: 401 INVALID_CREDENTIALS; email is case-insensitive', async () => {
    t = await testApp();
    for (const payload of [{ email: THANH.email, password: 'wrong-password' }, { email: 'nobody@cogniate.test', password: THANH.password }]) {
      const res = await t.app.inject({ method: 'POST', url: '/app-api/session', headers: { origin: TEST_URLS.app }, payload });
      expect(res.statusCode).toBe(401);
      expect(res.json().details.message).toBe('INVALID_CREDENTIALS');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    await expect(t.login({ email: THANH.email.toUpperCase(), password: THANH.password })).resolves.toMatch(/^__Host-cog_session=/);
  });

  it('GET /app-api/me: 401 NOT_SIGNED_IN without the cookie; user and library with it', async () => {
    t = await testApp();
    const none = await t.app.inject({ method: 'GET', url: '/app-api/me' });
    expect(none.statusCode).toBe(401);
    expect(none.json()).toEqual({ status: 401, error: 'Unauthorized', details: { message: 'NOT_SIGNED_IN', description: 'Sign in first.' } });
    const bad = await t.app.inject({ method: 'GET', url: '/app-api/me', headers: { cookie: '__Host-cog_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
    expect(bad.statusCode).toBe(401);
    const cookie = await t.login(THANH);
    const me = await t.app.inject({ method: 'GET', url: '/app-api/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ user: { email: THANH.email, name: THANH.name, role: 'owner' }, library: { name: THANH.library } });
    expect(me.json().user.id).toMatch(/^usr_/);
    expect(me.json().library.id).toMatch(/^lib_/);
    expect(me.headers['cache-control']).toBe('no-store');
    expect(me.headers['x-content-type-options']).toBe('nosniff');
    expect((await t.app.inject({ method: 'GET', url: '/nope' })).headers['x-content-type-options']).toBe('nosniff');
  });

  it('DELETE /app-api/session ends the session and clears the cookie; a session ends after 8 h', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const del = await t.app.inject({ method: 'DELETE', url: '/app-api/session', headers: t.writeHeaders(cookie) });
    expect(del.statusCode).toBe(204);
    expect(String(del.headers['set-cookie'])).toMatch(/^__Host-cog_session=; Path=\/; Max-Age=0; Secure; HttpOnly; SameSite=Lax$/);
    expect((await t.app.inject({ method: 'GET', url: '/app-api/me', headers: { cookie } })).statusCode).toBe(401);

    const second = await t.login(THANH);
    t.clock.now += 28800 * 1000 - 1;
    expect((await t.app.inject({ method: 'GET', url: '/app-api/me', headers: { cookie: second } })).statusCode).toBe(200);
    t.clock.now += 1;
    expect((await t.app.inject({ method: 'GET', url: '/app-api/me', headers: { cookie: second } })).statusCode).toBe(401);
  });

  it('a bad login body is 400 INVALID_REQUEST', async () => {
    t = await testApp();
    const res = await t.app.inject({ method: 'POST', url: '/app-api/session', headers: { origin: TEST_URLS.app }, payload: { email: THANH.email } });
    expect(res.statusCode).toBe(400);
    expect(res.json().details.message).toBe('INVALID_REQUEST');
  });
});

describe('Origin rule (AC-T4-02, security §6)', () => {
  it('a write with the content origin, "null" or no Origin is 403 ORIGIN_NOT_ALLOWED and makes nothing', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    for (const origin of [TEST_URLS.content, 'null', undefined, `${TEST_URLS.app}.evil.test`, 'http://app.cogniate.test', `${TEST_URLS.app}/`]) {
      const headers: Record<string, string> = { cookie, ...(origin === undefined ? {} : { origin }) };
      const res = await t.app.inject({ method: 'POST', url: '/app-api/courses', headers, payload: { title: 'X' } });
      expect(res.statusCode).toBe(403);
      expect(res.json().details.message).toBe('ORIGIN_NOT_ALLOWED');
    }
    const list = await t.app.inject({ method: 'GET', url: '/app-api/courses', headers: { cookie } });
    expect(list.json()).toEqual({ courses: [] });
    const rejected = t.logs.filter((l) => l.event === 'csrf_rejected');
    expect(rejected.map((l) => l.origin)).toEqual([TEST_URLS.content, 'null', null, `${TEST_URLS.app}.evil.test`, 'http://app.cogniate.test', `${TEST_URLS.app}/`]);
    expect(rejected[0]?.level).toBe('warn');
  });

  it('applies to the login, the logout and the upload too; reads need no Origin', async () => {
    t = await testApp();
    const login = await t.app.inject({ method: 'POST', url: '/app-api/session', payload: { email: THANH.email, password: THANH.password } });
    expect(login.statusCode).toBe(403);
    const cookie = await t.login(THANH);
    expect((await t.app.inject({ method: 'DELETE', url: '/app-api/session', headers: { cookie } })).statusCode).toBe(403);
    const course = await newCourse(cookie);
    const body = await formBody({ package: makeZip([INDEX]) });
    const up = await t.app.inject({ method: 'POST', url: `/app-api/courses/${course.id}/versions`, headers: { cookie, ...body.headers }, payload: body.payload });
    expect(up.statusCode).toBe(403);
    expect(packageCount()).toBe(0);
    expect((await t.app.inject({ method: 'GET', url: '/app-api/me', headers: { cookie } })).statusCode).toBe(200);
  });
});

describe('courses', () => {
  it('POST /app-api/courses makes a course with defaults; GET lists it; invalid fields are 400', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const res = await t.app.inject({ method: 'POST', url: '/app-api/courses', headers: t.writeHeaders(cookie), payload: { title: '  My course  ' } });
    expect(res.statusCode).toBe(201);
    const course = res.json();
    expect(course).toEqual({
      id: expect.stringMatching(/^crs_[A-Za-z0-9_-]{22}$/), title: 'My course', summary: '', variant: 'default', lang: 'en',
      createdAt: '2026-10-17T08:00:00.000Z', latestVersion: null, publications: [],
    });
    expect((await t.app.inject({ method: 'GET', url: '/app-api/courses', headers: { cookie } })).json()).toEqual({ courses: [course] });
    for (const payload of [{}, { title: '' }, { title: 'x', variant: 'a b' }, { title: 'x', lang: 'english!' }, { title: 'x'.repeat(201) }]) {
      const bad = await t.app.inject({ method: 'POST', url: '/app-api/courses', headers: t.writeHeaders(cookie), payload });
      expect(bad.statusCode).toBe(400);
      expect(bad.json().details.message).toBe('INVALID_REQUEST');
    }
  });
});

describe('upload', () => {
  it.skipIf(!existsSync(HTML_ZIP))('HTML fixture: 201 CourseVersion (AC-T4-04); files, original zip and rows are stored', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    const res = await upload(cookie, course.id, readFileSync(HTML_ZIP));
    expect(res.statusCode).toBe(201);
    const v = res.json();
    expect(v).toMatchObject({ courseId: course.id, version: 1, format: 'html', createdAt: '2026-10-17T08:00:00.000Z' });
    expect(v.id).toMatch(/^ver_/);
    expect(v.packageId).toMatch(/^pkg_/);
    expect(v.report).toMatchObject({ format: 'html', fileCount: 7, totalBytes: 12103306, externalHosts: [S3, 'fonts.gstatic.com'] });
    expect(v.report.html).toEqual({ pages: ['index', 'lesson-ai-web-sprint'], menuPage: 'index', questionIds: ['01M2M36Y89M9KPPZENF1ZW4AWJ'] });
    expect(v.trackingProfile.masteryScore).toBe(70);
    expect(readdirSync(join(t.store.packages, v.packageId)).sort()).toEqual(['assets', 'fonts', 'index.html', 'lesson-ai-web-sprint.html', 'style.css']);
    expect(readdirSync(t.store.uploads).filter((f) => f.endsWith('.zip'))).toHaveLength(1);
    expect(readdirSync(t.store.tmp)).toEqual([]);
    expect(t.logs.find((l) => l.event === 'package_accepted')).toMatchObject({ version_id: v.id, format: 'html' });

    const got = await t.app.inject({ method: 'GET', url: `/app-api/courses/${course.id}/versions/${v.id}`, headers: { cookie } });
    expect(got.json()).toEqual(v);
    const full = (await t.app.inject({ method: 'GET', url: `/app-api/courses/${course.id}`, headers: { cookie } })).json();
    expect(full.versions).toEqual([v]);
    expect(full.latestVersion).toEqual({ id: v.id, version: 1, format: 'html', createdAt: v.createdAt });
  });

  it.skipIf(!existsSync(SCORM_ZIP))('SCORM fixture: 201 with the AC-T4-03 values; a second upload is version 2', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    const res = await upload(cookie, course.id, readFileSync(SCORM_ZIP));
    expect(res.statusCode).toBe(201);
    const v = res.json();
    expect(v.format).toBe('scorm12');
    expect(v.report).toMatchObject({ entryPath: 'index.html', fileCount: 7, totalBytes: 12723159, externalHosts: [S3] });
    expect(v.report.scorm).toMatchObject({ schemaVersion: '1.2', masteryScore: 70, scoCount: 1 });
    expect(v.trackingProfile.questionIds).toEqual(['01M2M36Y89M9KPPZENF1ZW4AWJ']);
    const again = await upload(cookie, course.id, readFileSync(SCORM_ZIP));
    expect(again.json().version).toBe(2);
    expect(again.json().packageId).not.toBe(v.packageId); // no dedupe (ADR-006)
    expect(packageCount()).toBe(2);
  });

  it('crafted bad zips: 422 PACKAGE_REJECTED with the code; the package store does not change (AC-T4-05)', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    const cases: Array<[string, Buffer]> = [
      ['PATH_TRAVERSAL', makeZip([INDEX, { name: '../evil.html', data: 'x' }])],
      ['PATH_TRAVERSAL', makeZip([INDEX, { name: 'a/../../evil.html', data: 'x' }])],
      ['ABSOLUTE_PATH', makeZip([INDEX, { name: '/abs.html', data: 'x' }])],
      ['SYMLINK_ENTRY', makeZip([INDEX, { name: 'link', data: '/etc/passwd', unixMode: 0o120777 }])],
      ['ZIP_BOMB', makeZip([INDEX, { name: 'zeros.bin', data: Buffer.alloc(500_000), method: 8 }])],
      ['MANIFEST_DTD_FORBIDDEN', makeZip([INDEX, { name: 'imsmanifest.xml', data: `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>${scormManifest()}` }])],
      ['MANIFEST_INVALID_XML', makeZip([INDEX, { name: 'imsmanifest.xml', data: 'not xml at all <' }])],
      ['SCORM_VERSION_UNSUPPORTED', makeZip([INDEX, { name: 'imsmanifest.xml', data: scormManifest({ schemaVersion: '2004 4th Edition' }) }])],
      ['MULTI_SCO_UNSUPPORTED', makeZip([INDEX, { name: 'imsmanifest.xml', data: scormManifest({ scos: [{ href: 'index.html', id: 'a' }, { href: 'index.html', id: 'b' }] }) }])],
      ['LAUNCH_FILE_MISSING', makeZip([INDEX, { name: 'imsmanifest.xml', data: scormManifest({ scos: [{}] }) }])],
      ['NO_ENTRY_PAGE', makeZip([{ name: 'page.html', data: 'x' }])],
      ['ZIP_INVALID', Buffer.from('this is a text file\n')],
      ['DUPLICATE_ENTRY', makeZip([INDEX, { name: 'A.html', data: 'x' }, { name: 'a.html', data: 'y' }])],
      ['INVALID_ENTRY_NAME', makeZip([INDEX, { name: 'a\u0007.html', data: 'x' }])],
      ['ZIP_TOO_MANY_ENTRIES', makeZip([INDEX, ...Array.from({ length: 5000 }, (_, i) => ({ name: `f/${i}.txt` }))])],
    ];
    for (const [code, zip] of cases) {
      const res = await upload(cookie, course.id, zip);
      expect(res.statusCode, code).toBe(422);
      const body = res.json();
      expect(body.details.message).toBe('PACKAGE_REJECTED');
      expect(body.details.reasons[0].code, code).toBe(code);
      // B-T4a-02 / contract §3.2: details.action, and a title and an action in each reason.
      expect(body.details.action, code).toMatch(/^[A-Z].{10,}\.$/);
      expect(body.details.reasons[0]).toMatchObject({ title: expect.any(String), action: body.details.action });
    }
    expect(packageCount()).toBe(0);
    expect(readdirSync(t.store.tmp)).toEqual([]);
    expect(readdirSync(t.store.uploads).filter((f) => f.endsWith('.zip'))).toEqual([]);
    const logged = t.logs.filter((l) => l.event === 'package_rejected');
    expect(logged).toHaveLength(cases.length);
    expect(logged[0]).toMatchObject({ level: 'warn', codes: ['PATH_TRAVERSAL'] });
    const detail = (await t.app.inject({ method: 'GET', url: `/app-api/courses/${course.id}`, headers: { cookie } })).json();
    expect(detail.versions).toEqual([]);
  });

  it('masteryScore with a SCORM package: 400 MASTERY_SCORE_NOT_ALLOWED, nothing stored (AC-T4-03)', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    const scorm = makeZip([INDEX, { name: 'imsmanifest.xml', data: scormManifest() }]);
    const res = await upload(cookie, course.id, scorm, { masteryScore: '50' });
    expect(res.statusCode).toBe(400);
    expect(res.json().details).toMatchObject({ message: 'MASTERY_SCORE_NOT_ALLOWED', description: 'SCORM packages use the mastery score of their manifest.', action: expect.any(String) });
    expect(packageCount()).toBe(0);
    expect(readdirSync(t.store.tmp)).toEqual([]);
    expect((await t.app.inject({ method: 'GET', url: `/app-api/courses/${course.id}`, headers: { cookie } })).json().versions).toEqual([]);
    expect((await upload(cookie, course.id, scorm)).statusCode).toBe(201); // without masteryScore it works
  });

  it('a package identifier that breaks the rules: 422 INVALID_PACKAGE_IDENTIFIER with details.action, nothing stored (AC-T4-35)', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    const res = await upload(cookie, course.id, makeZip([{ name: 'index.html', data: '<div data-cog-quiz="__proto__"></div>' }]));
    expect(res.statusCode).toBe(422);
    expect(res.json().details).toMatchObject({ message: 'PACKAGE_REJECTED', action: expect.any(String), reasons: [{ code: 'INVALID_PACKAGE_IDENTIFIER', path: 'index.html' }] });
    expect(packageCount()).toBe(0);
  });

  it('an upload over the limit is 422 ZIP_TOO_LARGE before any zip check', async () => {
    t = await testApp({ limits: { maxUploadBytes: 50_000 } });
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    const res = await upload(cookie, course.id, Buffer.alloc(60_000, 1));
    expect(res.statusCode).toBe(422);
    expect(res.json().details.reasons).toEqual([{ code: 'ZIP_TOO_LARGE', detail: 'The upload is larger than 0.05 MB.', title: 'The package is too large', action: expect.any(String) }]);
    expect(res.json().details.action).toMatch(/200 MB/);
    expect(readdirSync(t.store.tmp)).toEqual([]);
  });

  it('over the limit on a real socket: the client gets the 422 (the rest of the body is read, no hang)', async () => {
    t = await testApp({ limits: { maxUploadBytes: 1_000_000 } });
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    const address = await t.app.listen({ port: 0, host: '127.0.0.1' });
    const form = new FormData();
    form.append('package', new Blob([new Uint8Array(3_000_000)]), 'big.zip');
    const res = await fetch(`${address}/app-api/courses/${course.id}/versions`, { method: 'POST', headers: t.writeHeaders(cookie), body: form, signal: AbortSignal.timeout(10_000) });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { details: { reasons: Array<{ code: string }> } }).details.reasons[0]?.code).toBe('ZIP_TOO_LARGE');
  });

  it('masteryScore: used for HTML; not 0-100 is 400; a missing file or another field is 400; JSON is 400', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    const ok = await upload(cookie, course.id, makeZip([INDEX]), { masteryScore: '85' });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().trackingProfile.masteryScore).toBe(85);
    for (const m of ['101', '-1', 'abc', '50.123']) {
      const bad = await upload(cookie, course.id, makeZip([INDEX]), { masteryScore: m });
      expect(bad.statusCode, m).toBe(400);
      expect(bad.json().details).toMatchObject({ message: 'INVALID_REQUEST', field: 'masteryScore' });
    }
    const noFile = await formBody({ masteryScore: '70' });
    const r1 = await t.app.inject({ method: 'POST', url: `/app-api/courses/${course.id}/versions`, headers: { ...t.writeHeaders(cookie), ...noFile.headers }, payload: noFile.payload });
    expect(r1.statusCode).toBe(400);
    const other = await formBody({ other: 'x', package: makeZip([INDEX]) });
    const r2 = await t.app.inject({ method: 'POST', url: `/app-api/courses/${course.id}/versions`, headers: { ...t.writeHeaders(cookie), ...other.headers }, payload: other.payload });
    expect(r2.statusCode).toBe(400);
    const r3 = await t.app.inject({ method: 'POST', url: `/app-api/courses/${course.id}/versions`, headers: t.writeHeaders(cookie), payload: { package: 'x' } });
    expect(r3.statusCode).toBe(400);
    expect(packageCount()).toBe(1);
    expect(readdirSync(t.store.tmp)).toEqual([]);
  });
});

describe('library scope (AC-T4-06)', () => {
  it('QA Library B gets 404 for a course of Thanh, its versions and an upload to it, and does not list it', async () => {
    t = await testApp();
    const thanh = await t.login(THANH);
    const course = await newCourse(thanh, "Thanh's course");
    const up = await upload(thanh, course.id, makeZip([INDEX]));
    expect(up.statusCode).toBe(201);
    const versionId = up.json().id as string;

    const qaB = await t.login(QA_B);
    const notFound = (res: { statusCode: number; json: () => { details: { message: string } } }) => {
      expect(res.statusCode).toBe(404);
      expect(res.json().details.message).toBe('NOT_FOUND');
    };
    notFound(await t.app.inject({ method: 'GET', url: `/app-api/courses/${course.id}`, headers: { cookie: qaB } }));
    notFound(await t.app.inject({ method: 'GET', url: `/app-api/courses/${course.id}/versions/${versionId}`, headers: { cookie: qaB } }));
    notFound(await upload(qaB, course.id, makeZip([INDEX])));
    expect((await t.app.inject({ method: 'GET', url: '/app-api/courses', headers: { cookie: qaB } })).json()).toEqual({ courses: [] });
    expect(packageCount()).toBe(1);

    // Same answer as an id that does not exist.
    notFound(await t.app.inject({ method: 'GET', url: '/app-api/courses/crs_doesnotexist', headers: { cookie: qaB } }));
    const own = await t.app.inject({ method: 'GET', url: '/app-api/courses', headers: { cookie: thanh } });
    expect(own.json().courses.map((c: { id: string }) => c.id)).toEqual([course.id]);
  });
});

describe('logging', () => {
  it('http_request logs the route pattern, not the ids', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const course = await newCourse(cookie);
    await t.app.inject({ method: 'GET', url: `/app-api/courses/${course.id}?x=1`, headers: { cookie } });
    const line = t.logs.filter((l) => l.event === 'http_request').at(-1);
    expect(line).toMatchObject({ level: 'info', method: 'GET', path: '/app-api/courses/:courseId', status: 200 });
    expect(JSON.stringify(t.logs)).not.toContain(course.id);
    expect(JSON.stringify(t.logs)).not.toContain(THANH.password);
  });
});
