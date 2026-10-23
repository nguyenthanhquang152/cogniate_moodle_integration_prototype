import { makeZip, scormManifest } from '@cogniate/package-inspector/testing';
import { sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { continuesNewest } from '../domain/attempts.ts';
import type { TestApp } from '../testkit.ts';
import { DL_RETURN, INSTRUCTOR, LEARNER, QA_B, TEST_MASTER_KEY, TEST_URLS, THANH, formBody, launchToken, testApp } from '../testkit.ts';
import { LAUNCH_ERRORS } from './launch.ts';
import { hasStaffRole, publicationFromTarget, runtimeTokenFor, safeReturnUrl } from './launch-rules.ts';
import { PICKER_ERRORS } from './picker.ts';
import { contentSecurityPolicy } from './page.ts';

let t: TestApp;
afterEach(async () => {
  await t?.app.close();
});

const HOSTILE_PACKAGE_TITLE = '<img src=x onerror="window.__xss=1">';

const json = async (method: string, url: string, cookie: string, payload?: unknown) =>
  t.app.inject({ method: method as 'GET', url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as object } : {}) });

async function course(cookie: string, title: string, files: Array<{ name: string; data: string }>): Promise<string> {
  const id = (await json('POST', '/app-api/courses', cookie, { title })).json().id as string;
  const body = await formBody({ package: makeZip(files) });
  const r = await t.app.inject({ method: 'POST', url: `/app-api/courses/${id}/versions`, headers: { ...t.writeHeaders(cookie), ...body.headers }, payload: body.payload });
  expect(r.statusCode).toBe(201);
  return id;
}

async function connected(cookie: string, clientId: string): Promise<{ id: string; platformId: string }> {
  const c = (await json('POST', '/app-api/connections', cookie, { name: 'Dev Moodle', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
  const r = await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, {
    issuer: TEST_URLS.moodle, clientId, deploymentId: '1', authenticationEndpoint: `${TEST_URLS.moodle}/mod/lti/auth.php`,
    accessTokenEndpoint: `${TEST_URLS.moodle}/mod/lti/token.php`, jwksUrl: `${TEST_URLS.moodle}/mod/lti/certs.php`,
  });
  return { id: c.id as string, platformId: r.json().platform.id as string };
}

const publish = async (cookie: string, connectionId: string, courseId: string) => (await json('POST', '/app-api/publications', cookie, { connectionId, courseId })).json().id as string;

/** Setup of the T4b2 ACs: Thanh's connection with a SCORM and an HTML publication; library B with its own. */
async function world(opts: Parameters<typeof testApp>[0] = {}) {
  t = await testApp(opts);
  const thanh = await t.login(THANH);
  const a = await connected(thanh, 'thanh-client');
  const scormCourse = await course(thanh, '<b>x</b>', [
    { name: 'imsmanifest.xml', data: scormManifest({ title: '&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;' }) },
    { name: 'index.html', data: '<html><body>sco</body></html>' },
  ]);
  const htmlCourse = await course(thanh, 'HTML course', [{ name: 'index.html', data: '<html><body>x</body></html>' }]);
  const scorm = await publish(thanh, a.id, scormCourse);
  const html = await publish(thanh, a.id, htmlCourse);
  const qaB = await t.login(QA_B);
  const b = await connected(qaB, 'b-client');
  const bPub = await publish(qaB, b.id, await course(qaB, 'B course', [{ name: 'index.html', data: '<html><body>b</body></html>' }]));
  return { thanh, qaB, a, b, scorm, html, bPub, scormCourse, htmlCourse };
}

const target = (pub: string) => `${TEST_URLS.lti}/lti/launch/cogniate?resource=${pub}`;
const get = (url: string, headers: Record<string, string> = {}) => t.app.inject({ method: 'GET', url, headers });
const pageCode = (body: string) => /data-error-code="([A-Z_]+)"/.exec(body)?.[1];
const playIdOf = (location: unknown) => /\/play\/(ply_[A-Za-z0-9_-]+)/.exec(String(location))?.[1] ?? '';
const events = (name: string, traceId?: string) => t.logs.filter((l) => l.event === name && (traceId === undefined || l.trace_id === traceId));
const count = (table: string) => Number(t.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n);

/** A learner (or teacher) resource launch: returns the 303 response. */
async function launch(platformId: string, pub: string, over: Parameters<typeof launchToken>[0] extends infer O ? Partial<O> : never = {}) {
  const ltik = t.lti.addLaunch(launchToken({ platformId, target: target(pub), ...over }));
  return { ltik, res: await get(`/tool/launch?resource=${pub}&ltik=${ltik}`) };
}

const picker = (id: string, publicationId: unknown, origin: string | null = TEST_URLS.app) => t.app.inject({
  method: 'POST', url: `/tool/picker/${id}`, headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origin !== null ? { origin } : {}) },
  payload: Array.isArray(publicationId) ? publicationId.map((p) => `publicationId=${encodeURIComponent(String(p))}`).join('&') : new URLSearchParams({ publicationId: String(publicationId) }).toString(),
});

async function deepLink(platformId: string, roles = [INSTRUCTOR]): Promise<string> {
  const ltik = t.lti.addLaunch(launchToken({ platformId, type: 'LtiDeepLinkingRequest', roles }));
  const r = await get(`/tool/deep-link?ltik=${ltik}`);
  expect(r.statusCode).toBe(303);
  return /\/tool\/picker\/(pck_[A-Za-z0-9_-]+)$/.exec(String(r.headers.location))![1]!;
}

describe('launch rules (security §4)', () => {
  it('role check: #Instructor, #ContentDeveloper, #Administrator only', () => {
    expect(hasStaffRole([INSTRUCTOR])).toBe(true);
    expect(hasStaffRole(['http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper'])).toBe(true);
    expect(hasStaffRole(['http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator'])).toBe(true);
    expect(hasStaffRole([LEARNER, 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Student'])).toBe(false);
    expect(hasStaffRole(['http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant'])).toBe(false);
    expect(hasStaffRole([])).toBe(false);
  });

  it('signed-target parsing: one resource on the LTI service launch URL, else null', () => {
    const lti = TEST_URLS.lti;
    expect(publicationFromTarget(`${lti}/lti/launch/cogniate?resource=pub_8Jk2`, lti)).toBe('pub_8Jk2');
    expect(publicationFromTarget(`${lti}/lti/launch/cogniate?resource=pub_a&resource=pub_b`, lti)).toBeNull();
    expect(publicationFromTarget(`${lti}/lti/launch/cogniate`, lti)).toBeNull();
    expect(publicationFromTarget(`${lti}/lti/launch/cogniate?resource=seed`, lti)).toBeNull();
    expect(publicationFromTarget('https://evil.test/lti/launch/cogniate?resource=pub_8Jk2', lti)).toBeNull();
    expect(publicationFromTarget(`${lti}/other?resource=pub_8Jk2`, lti)).toBeNull();
    expect(publicationFromTarget('not a url', lti)).toBeNull();
  });

  it('"Back to Moodle" only for an https URL on the platform origin', () => {
    expect(safeReturnUrl(`${TEST_URLS.moodle}/mod/lti/return.php?x=1`, TEST_URLS.moodle)).toBe(`${TEST_URLS.moodle}/mod/lti/return.php?x=1`);
    expect(safeReturnUrl('javascript:alert(1)', TEST_URLS.moodle)).toBeNull();
    expect(safeReturnUrl('https://evil.test/r', TEST_URLS.moodle)).toBeNull();
    expect(safeReturnUrl(undefined, TEST_URLS.moodle)).toBeNull();
  });

  it('attempt choice after a rebind: continue only an in-progress attempt of the current course', () => {
    expect(continuesNewest({ outcome: 'in_progress', courseId: 'crs_a' }, 'crs_a')).toBe(true);
    expect(continuesNewest({ outcome: 'in_progress', courseId: 'crs_a' }, 'crs_b')).toBe(false);
    expect(continuesNewest({ outcome: 'passed', courseId: 'crs_a' }, 'crs_a')).toBe(false);
    expect(continuesNewest(undefined, 'crs_a')).toBe(false);
  });

  it('header builder per page (security §5)', () => {
    const issuer = TEST_URLS.moodle;
    expect(contentSecurityPolicy('picker', { issuer })).toContain(`frame-ancestors ${issuer}; form-action 'self'`);
    expect(contentSecurityPolicy('picker-submit', { issuer, returnOrigin: issuer, nonce: 'n' })).toContain(`script-src 'nonce-n'; frame-ancestors ${issuer}; form-action ${issuer}`);
    expect(contentSecurityPolicy('play', { content: TEST_URLS.content, nonce: 'n' })).toMatch(new RegExp(`script-src 'nonce-n'.*frame-src ${TEST_URLS.content.replace(/\./g, '\\.')}; frame-ancestors 'none'`));
    expect(contentSecurityPolicy('embedded', { issuer })).toContain(`frame-ancestors ${issuer}; form-action 'none'`);
    expect(contentSecurityPolicy('error')).toContain("frame-ancestors https:; form-action 'none'");
    expect(() => contentSecurityPolicy('picker-submit', { issuer })).toThrow();
  });
});

describe('/tool/launch (app contract §6, flows §6c)', () => {
  it('AC-T4-17: 303 to /play with no-referrer and no ltik; shell with title, Back to Moodle, runtime iframe; status; learners = 1; connected', async () => {
    const w = await world();
    const { ltik, res } = await launch(w.a.platformId, w.scorm);
    expect(res.statusCode).toBe(303);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(String(res.headers.location)).toMatch(new RegExp(`^${TEST_URLS.app.replace(/\./g, '\\.')}/play/ply_[A-Za-z0-9_-]{22}$`));
    const playId = playIdOf(res.headers.location);
    const shell = await get(`/play/${playId}`);
    expect(shell.statusCode).toBe(200);
    expect(shell.body).toContain('<h1 data-course-title>&lt;b&gt;x&lt;/b&gt;</h1>');
    expect(shell.body).toContain(`<a href="${TEST_URLS.moodle}/mod/lti/return.php?course=2&amp;launch_container=4" rel="noopener noreferrer" data-back-to-moodle>Back to Moodle</a>`);
    const token = runtimeTokenFor(TEST_MASTER_KEY, playId);
    expect(shell.body).toContain(`src="${TEST_URLS.content}/rt/${token}" sandbox="allow-scripts allow-same-origin" allow="autoplay; fullscreen"`);
    expect(t.db.prepare('SELECT runtime_token_hash AS h FROM play_session WHERE id = ?').get(sha256Hex(playId))?.h).toBe(sha256Hex(token));
    // The play session holds no ltik (T4b2 design note).
    expect(JSON.stringify(t.db.prepare('SELECT * FROM play_session').all())).not.toContain(ltik);
    const status = await get(`/app-api/play/${playId}/status`);
    expect(status.json()).toEqual({ outcome: 'not_started', scoreGiven: null, scoreMaximum: null, preview: false, scoreSync: { status: null, scoreGiven: null, scoreMaximum: null } });
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.thanh)).json().stats).toMatchObject({ learners: 1, activities: 1 });
    expect((await json('GET', `/app-api/connections/${w.a.id}`, w.thanh)).json()).toMatchObject({ status: 'connected', lastLaunchAt: new Date(t.clock.now).toISOString() });
    expect(events('launch_accepted', String(res.headers['x-trace-id']))[0]).toMatchObject({ attempt_id: expect.stringMatching(/^att_/), preview: false });
    expect(JSON.stringify(t.logs)).not.toContain(ltik);
  });

  it('AC-T4-24: the same ltik again -> 409 HANDOFF_USED, handoff_rejected with the trace id, no launch_accepted', async () => {
    const w = await world();
    const { ltik } = await launch(w.a.platformId, w.scorm);
    const again = await get(`/tool/launch?ltik=${ltik}`);
    const traceId = String(again.headers['x-trace-id']);
    expect([again.statusCode, pageCode(again.body)]).toEqual([409, 'HANDOFF_USED']);
    expect(events('handoff_rejected', traceId)).toEqual([expect.objectContaining({ code: 'HANDOFF_USED' })]);
    expect(events('launch_accepted', traceId)).toEqual([]);
    expect(count('play_session')).toBe(1);
  });

  it('AC-T4-23: the resource query of the app URL is ignored; the signed target decides', async () => {
    const w = await world();
    const ltik = t.lti.addLaunch(launchToken({ platformId: w.a.platformId, target: target(w.scorm) }));
    const res = await get(`/tool/launch?resource=${w.html}&ltik=${ltik}`);
    const shell = await get(`/play/${playIdOf(res.headers.location)}`);
    expect(shell.body).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(shell.body).not.toContain('HTML course');
  });

  it('AC-T4-25: a new signed target for the same resource link rebinds it (resource_link_rebound); the next launch opens that course', async () => {
    const w = await world();
    await launch(w.a.platformId, w.scorm, { resourceLinkId: '9' });
    const second = await launch(w.a.platformId, w.html, { resourceLinkId: '9' });
    expect((await get(`/play/${playIdOf(second.res.headers.location)}`)).body).toContain('<h1 data-course-title>HTML course</h1>');
    expect(events('resource_link_rebound')).toEqual([expect.objectContaining({ from_publication: w.scorm, to_publication: w.html, resource_link_id: expect.stringMatching(/^rl_/) })]);
    expect(count('resource_link')).toBe(1);
    expect(t.db.prepare('SELECT publication_id AS p FROM resource_link').get()?.p).toBe(w.html);
  });

  it('resource link key and attempts: same (deployment, context, link) is one row; the in-progress attempt continues only for its own course', async () => {
    const w = await world();
    const first = await launch(w.a.platformId, w.scorm, { resourceLinkId: '9' });
    const scormAttempt = String(events('launch_accepted').at(-1)!.attempt_id);
    t.db.prepare("UPDATE attempt SET outcome = 'in_progress' WHERE id = ?").run(scormAttempt);
    await launch(w.a.platformId, w.scorm, { resourceLinkId: '9' });
    expect(events('launch_accepted').at(-1)!.attempt_id).toBe(scormAttempt); // continues
    await launch(w.a.platformId, w.scorm, { resourceLinkId: '9', contextId: '77' });
    expect(count('resource_link')).toBe(2); // another context = another activity
    await launch(w.a.platformId, w.html, { resourceLinkId: '9' }); // rebind: a new attempt on the HTML course
    const htmlAttempt = String(events('launch_accepted').at(-1)!.attempt_id);
    expect(htmlAttempt).not.toBe(scormAttempt);
    expect(t.db.prepare('SELECT outcome FROM attempt WHERE id = ?').get(scormAttempt)?.outcome).toBe('in_progress'); // the old attempt stays
    await launch(w.a.platformId, w.scorm, { resourceLinkId: '9' }); // back to SCORM: its row of that version again
    expect(events('launch_accepted').at(-1)!.attempt_id).toBe(scormAttempt);
    expect(first.res.statusCode).toBe(303);
  });

  it('AC-T4-18 / AC-T4-27: another library\'s publication -> 404, a withdrawn one -> 410; launch_rejected; no attempt', async () => {
    const w = await world();
    const foreign = await launch(w.a.platformId, w.bPub);
    expect([foreign.res.statusCode, pageCode(foreign.res.body)]).toEqual([404, 'PUBLICATION_NOT_IN_CONNECTION']);
    expect(foreign.res.body).toContain('<h1>This course is not available</h1>');
    expect(events('launch_rejected', String(foreign.res.headers['x-trace-id']))).toEqual([expect.objectContaining({ reason: 'publication_not_in_connection' })]);
    await json('POST', `/app-api/publications/${w.scorm}/withdraw`, w.thanh);
    const gone = await launch(w.a.platformId, w.scorm);
    expect([gone.res.statusCode, pageCode(gone.res.body)]).toEqual([410, 'PUBLICATION_WITHDRAWN']);
    expect(gone.res.body).toContain('<h1>This course is no longer available</h1>');
    expect(events('launch_rejected').map((l) => l.reason)).toEqual(['publication_not_in_connection', 'publication_withdrawn']);
    expect(count('attempt')).toBe(0);
    expect(count('resource_link')).toBe(0);
  });

  it('unknown platform -> 404 UNKNOWN_PLATFORM; unknown, malformed or missing ltik -> 401 INVALID_LTIK (invalid_ltik)', async () => {
    const w = await world();
    const unknown = await launch('plt_nobody', w.scorm);
    expect([unknown.res.statusCode, pageCode(unknown.res.body)]).toEqual([404, 'UNKNOWN_PLATFORM']);
    for (const url of [`/tool/launch?ltik=${'a'.repeat(43)}`, '/tool/launch?ltik=short', '/tool/launch']) {
      const r = await get(url);
      expect([r.statusCode, pageCode(r.body)], url).toEqual([401, 'INVALID_LTIK']);
    }
    expect(events('launch_rejected').map((l) => l.reason)).toEqual(['unknown_platform', 'invalid_ltik', 'invalid_ltik', 'invalid_ltik']);
  });

  it('AC-T4-19: a teacher launch is a preview (status preview = true; not counted as a learner)', async () => {
    const w = await world();
    const { res } = await launch(w.a.platformId, w.scorm, { roles: [INSTRUCTOR], sub: '2' });
    const playId = playIdOf(res.headers.location);
    expect((await get(`/app-api/play/${playId}/status`)).json().preview).toBe(true);
    expect((await get(`/play/${playId}`)).body).toContain('data-preview>Preview</span>');
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.thanh)).json().stats.learners).toBe(0);
  });

  it('AC-T4-31: documentTarget iframe -> the embedded page with "Open in a new window"; frame and window open the player', async () => {
    const w = await world();
    const framed = await launch(w.a.platformId, w.scorm, { documentTarget: 'iframe' });
    expect(String(framed.res.headers.location)).toMatch(/\/play\/ply_[A-Za-z0-9_-]+\/embedded$/);
    const playId = playIdOf(framed.res.headers.location);
    const page = await get(`/play/${playId}/embedded`);
    expect(page.body).toContain('<p>This course opens in a new window.</p>');
    expect(page.body).toContain(`<a class="button" href="/play/${playId}" target="_blank" rel="noopener">Open in a new window</a>`);
    expect(String(page.headers['content-security-policy'])).toContain(`frame-ancestors ${TEST_URLS.moodle}; form-action 'none'`);
    for (const documentTarget of ['frame', 'window']) {
      const r = await launch(w.a.platformId, w.scorm, { documentTarget });
      expect(String(r.res.headers.location)).toMatch(/\/play\/ply_[A-Za-z0-9_-]+$/);
    }
  });

  it('A-T4b2-03: the database keeps only the SHA-256 of play ids and picker ids (raw ids only in URLs)', async () => {
    const w = await world();
    const playId = playIdOf((await launch(w.a.platformId, w.scorm)).res.headers.location);
    const pickerId = await deepLink(w.a.platformId);
    const dump = JSON.stringify([t.db.prepare('SELECT * FROM play_session').all(), t.db.prepare('SELECT * FROM picker_session').all()]);
    expect(dump).not.toContain(playId);
    expect(dump).not.toContain(pickerId);
    expect(t.db.prepare('SELECT id FROM play_session').get()?.id).toBe(sha256Hex(playId));
    expect(t.db.prepare('SELECT id FROM picker_session').get()?.id).toBe(sha256Hex(pickerId));
    // The stored hash itself does not open anything.
    expect((await get(`/play/${sha256Hex(playId)}`)).statusCode).toBe(404);
    expect((await get(`/tool/picker/${sha256Hex(pickerId)}`)).statusCode).toBe(404);
    expect((await get(`/play/${playId}`)).statusCode).toBe(200);
  });

  it('AC-T4-29 and PLAY_TTL_SECONDS: unknown or expired play id -> 404 page and 404 status; library B gets 404 for Thanh\'s publication', async () => {
    const w = await world({ playTtlSeconds: 20 });
    const { res } = await launch(w.a.platformId, w.scorm);
    const playId = playIdOf(res.headers.location);
    expect((await get('/app-api/play/ply_unknown/status')).statusCode).toBe(404);
    expect(pageCode((await get('/play/ply_unknown')).body)).toBe('PLAY_NOT_FOUND');
    t.clock.now += 23_000;
    expect((await get(`/app-api/play/${playId}/status`)).statusCode).toBe(404);
    expect((await get(`/play/${playId}`)).statusCode).toBe(404);
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.qaB)).statusCode).toBe(404);
  });
});

describe('/tool/deep-link and /tool/picker (app contract §6, flows §6b)', () => {
  it('AC-T4-15 / AC-T4-16: the picker lists exactly this connection\'s available publications; the pick returns one content item', async () => {
    const w = await world();
    const pickerId = await deepLink(w.a.platformId);
    const page = await get(`/tool/picker/${pickerId}`);
    expect(page.statusCode).toBe(200);
    const ids = [...page.body.matchAll(/type="radio" name="publicationId" value="(pub_[^"]+)"/g)].map((m) => m[1]);
    expect(ids.sort()).toEqual([w.scorm, w.html].sort());
    expect(page.body).toContain('data-format="scorm12">SCORM 1.2</span>');
    expect(page.body).toContain('data-format="html">HTML</span>');
    expect((await json('GET', `/app-api/connections/${w.a.id}`, w.thanh)).json().status).toBe('connected');

    const done = await picker(pickerId, w.scorm);
    expect(done.statusCode).toBe(200);
    expect(done.body).toContain(`<form id="cogniate-dl" method="post" action="${DL_RETURN.replace(/&/g, '&amp;')}">`);
    expect(done.body).toMatch(/<input type="hidden" name="JWT" value="header\.[A-Za-z0-9_-]+\.sig">/);
    expect(done.body).toMatch(/<script nonce="[^"]+">document\.getElementById\('cogniate-dl'\)\.submit\(\);<\/script>/);
    expect(t.lti.deepLinks).toHaveLength(1);
    expect(t.lti.deepLinks[0]!.items).toEqual([{
      type: 'ltiResourceLink', title: '<b>x</b>', url: `${TEST_URLS.lti}/lti/launch/cogniate?resource=${w.scorm}`,
      lineItem: { scoreMaximum: 100, label: '<b>x</b>', resourceId: w.scorm, tag: 'cogniate-score' },
    }]);
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.thanh)).json().stats.activities).toBe(1);
    // The first launch of the new activity takes over the pick: still one activity.
    await launch(w.a.platformId, w.scorm, { resourceLinkId: '40' });
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.thanh)).json().stats.activities).toBe(1);

    const bPicker = await deepLink(w.b.platformId);
    const bIds = [...(await get(`/tool/picker/${bPicker}`)).body.matchAll(/value="(pub_[^"]+)"/g)].map((m) => m[1]);
    expect(bIds).toEqual([w.bPub]);
  });

  it('AC-T4-20: check order single use -> ltik -> message type -> role; deep_link_rejected reasons', async () => {
    const w = await world();
    // A resource-link ltik at /tool/deep-link: 403 not_deep_linking.
    const resourceLtik = t.lti.addLaunch(launchToken({ platformId: w.a.platformId, target: target(w.scorm) }));
    const notDl = await get(`/tool/deep-link?ltik=${resourceLtik}`);
    expect([notDl.statusCode, pageCode(notDl.body)]).toEqual([403, 'NOT_DEEP_LINKING']);
    expect(events('deep_link_rejected', String(notDl.headers['x-trace-id']))).toEqual([expect.objectContaining({ reason: 'not_deep_linking' })]);
    // Single use comes before the ltik check: an unknown ltik is invalid once, then used.
    const unknown = 'b'.repeat(43);
    expect(pageCode((await get(`/tool/deep-link?ltik=${unknown}`)).body)).toBe('INVALID_LTIK');
    expect(pageCode((await get(`/tool/deep-link?ltik=${unknown}`)).body)).toBe('HANDOFF_USED');
    // A learner in a deep-linking launch: 403 role_not_allowed (Moodle does not send this; unit test only).
    const learnerDl = t.lti.addLaunch(launchToken({ platformId: w.a.platformId, type: 'LtiDeepLinkingRequest', roles: [LEARNER] }));
    const role = await get(`/tool/deep-link?ltik=${learnerDl}`);
    expect([role.statusCode, pageCode(role.body)]).toEqual([403, 'ROLE_NOT_ALLOWED']);
    expect(events('deep_link_rejected').map((l) => l.reason)).toEqual(['not_deep_linking', 'invalid_ltik', 'role_not_allowed']);
    expect(events('handoff_rejected')).toHaveLength(1);
    expect(count('picker_session')).toBe(0);
  });

  it('AC-T4-20: a used picker -> 410; PICKER_TTL_SECONDS=20: a POST at TTL + 3 s -> 410 (picker_rejected)', async () => {
    const w = await world({ pickerTtlSeconds: 20 });
    const used = await deepLink(w.a.platformId);
    expect((await picker(used, w.scorm)).statusCode).toBe(200);
    const again = await picker(used, w.scorm);
    expect([again.statusCode, pageCode(again.body)]).toEqual([410, 'PICKER_USED']);
    expect([(await get(`/tool/picker/${used}`)).statusCode]).toEqual([410]);
    const late = await deepLink(w.a.platformId);
    t.clock.now += 23_000;
    const expired = await picker(late, w.scorm);
    expect([expired.statusCode, pageCode(expired.body)]).toEqual([410, 'PICKER_EXPIRED']);
    expect(events('picker_rejected').map((l) => l.reason)).toEqual(['used', 'used', 'expired']);
    expect(t.lti.deepLinks).toHaveLength(1);
  });

  it('AC-T4-26: another library\'s or a withdrawn publication -> 400 PUBLICATION_NOT_AVAILABLE, no Deep Linking call, picker still usable', async () => {
    const w = await world();
    const id = await deepLink(w.a.platformId);
    await json('POST', `/app-api/publications/${w.html}/withdraw`, w.thanh);
    for (const pub of [w.bPub, w.html, 'pub_unknown', [w.scorm, w.html]]) {
      const r = await picker(id, pub);
      expect([r.statusCode, pageCode(r.body)], JSON.stringify(pub)).toEqual([400, 'PUBLICATION_NOT_AVAILABLE']);
    }
    expect(t.lti.calls.some((c) => c.startsWith('POST deeplinking'))).toBe(false);
    expect(events('picker_rejected').map((l) => l.reason)).toEqual(Array(4).fill('publication_not_available'));
    expect((await picker(id, w.scorm)).statusCode).toBe(200);
  });

  it('AC-T4-22: picker POST with Origin evil.test, null, or none -> 403, csrf_rejected, picker not used, no Deep Linking call', async () => {
    const w = await world();
    const id = await deepLink(w.a.platformId);
    for (const origin of ['https://evil.test', 'null', null]) {
      const r = await picker(id, w.scorm, origin);
      expect([r.statusCode, pageCode(r.body)]).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    }
    expect(events('csrf_rejected').map((l) => l.origin)).toEqual(['https://evil.test', 'null', null]);
    expect(t.lti.calls.some((c) => c.startsWith('POST deeplinking'))).toBe(false);
    expect(t.db.prepare('SELECT used_at AS u FROM picker_session WHERE id = ?').get(sha256Hex(id))?.u).toBeNull();
  });

  it('a failed Deep Linking call -> 502 page; the picker is released and a retry works', async () => {
    const w = await world();
    const id = await deepLink(w.a.platformId);
    t.lti.failNext = { status: 502, code: 'PLATFORM_ERROR' };
    expect(pageCode((await picker(id, w.scorm)).body)).toBe('LTI_SERVICE_ERROR');
    expect((await picker(id, w.scorm)).statusCode).toBe(200);
  });
});

describe('B-T4b2-01 / -03, A-T4b2-04: every tool page error code logs one event with its trace id', () => {
  it('AC-T4-32 table: each code of LAUNCH_ERRORS and PICKER_ERRORS -> page with an action line + exactly one event (LTI code kept)', async () => {
    const w = await world({ pickerTtlSeconds: 20 });
    const resourceLtik = () => t.lti.addLaunch(launchToken({ platformId: w.a.platformId, target: target(w.scorm) }));
    const used = resourceLtik();
    await get(`/tool/launch?ltik=${used}`);
    const usedPicker = await deepLink(w.a.platformId);
    await picker(usedPicker, w.scorm);
    const cases: Array<[string, () => Promise<{ statusCode: number; body: string; headers: Record<string, unknown> }>, string, Record<string, unknown>?]> = [
      ['INVALID_LTIK', () => get('/tool/launch?ltik=short'), 'launch_rejected', { reason: 'invalid_ltik' }],
      ['HANDOFF_USED', () => get(`/tool/launch?ltik=${used}`), 'handoff_rejected'],
      ['UNKNOWN_PLATFORM', async () => (await launch('plt_nobody', w.scorm)).res, 'launch_rejected', { reason: 'unknown_platform' }],
      ['PUBLICATION_NOT_IN_CONNECTION', async () => (await launch(w.a.platformId, w.bPub)).res, 'launch_rejected', { reason: 'publication_not_in_connection' }],
      ['NOT_DEEP_LINKING', () => get(`/tool/deep-link?ltik=${resourceLtik()}`), 'deep_link_rejected', { reason: 'not_deep_linking' }],
      ['ROLE_NOT_ALLOWED', () => get(`/tool/deep-link?ltik=${t.lti.addLaunch(launchToken({ platformId: w.a.platformId, type: 'LtiDeepLinkingRequest', roles: [LEARNER] }))}`), 'deep_link_rejected', { reason: 'role_not_allowed' }],
      ['LTI_SERVICE_ERROR', () => { t.lti.failNext = { status: 503, code: 'HTTP_503' }; return get(`/tool/launch?ltik=${resourceLtik()}`); }, 'launch_rejected', { reason: 'lti_service_error', lti_status: 503, lti_code: 'HTTP_503' }],
      ['PICKER_NOT_FOUND', () => get('/tool/picker/pck_unknown'), 'picker_rejected', { reason: 'not_found' }],
      ['PICKER_USED', () => picker(usedPicker, w.scorm), 'picker_rejected', { reason: 'used' }],
      ['ORIGIN_NOT_ALLOWED', async () => picker(await deepLink(w.a.platformId), w.scorm, 'https://evil.test'), 'csrf_rejected'],
      ['PUBLICATION_NOT_AVAILABLE', async () => picker(await deepLink(w.a.platformId), w.bPub), 'picker_rejected', { reason: 'publication_not_available' }],
      ['LTI_SERVICE_ERROR', async () => { const id = await deepLink(w.a.platformId); t.lti.failNext = { status: 502, code: 'PLATFORM_ERROR' }; return picker(id, w.scorm); }, 'picker_rejected', { reason: 'lti_service_error', lti_status: 502, lti_code: 'PLATFORM_ERROR' }],
      ['RETURN_URL_MISMATCH', async () => {
        const id = await deepLink(w.a.platformId);
        const orig = t.lti.client.deepLinking;
        t.lti.client.deepLinking = async () => ({ message: 'jwt', target: 'https://evil.test/return' });
        try { return await picker(id, w.scorm); } finally { t.lti.client.deepLinking = orig; }
      }, 'picker_rejected', { reason: 'return_url_mismatch' }],
      ['PUBLICATION_WITHDRAWN', async () => { await json('POST', `/app-api/publications/${w.scorm}/withdraw`, w.thanh); return (await launch(w.a.platformId, w.scorm)).res; }, 'launch_rejected', { reason: 'publication_withdrawn' }],
      ['PICKER_EXPIRED', async () => { const id = await deepLink(w.a.platformId); t.clock.now += 23_000; return picker(id, w.html); }, 'picker_rejected', { reason: 'expired' }],
      ['PLACEMENT_NOT_GRADED', async () => {
        // LA-E3-05 (LA-ADR-05 D3c): acceptLineItem false on a channel with content.ungraded false (Moodle).
        const token = launchToken({ platformId: w.a.platformId, type: 'LtiDeepLinkingRequest', roles: [INSTRUCTOR] });
        token.launch.deepLinkingSettings = { acceptLineItem: false };
        const dl = await get(`/tool/deep-link?ltik=${t.lti.addLaunch(token)}`);
        return get(new URL(String(dl.headers.location)).pathname);
      }, 'picker_rejected', { reason: 'placement_not_graded' }],
    ];
    const seen = new Set<string>();
    for (const [code, run, event, fields] of cases) {
      const r = await run();
      const traceId = String(r.headers['x-trace-id']);
      expect(pageCode(r.body), code).toBe(code);
      expect(r.body, code).toMatch(/<p data-error-action>[^<]+<\/p>/);
      expect(r.body, code).not.toContain('Try again in a minute');
      if (code === 'RETURN_URL_MISMATCH') expect(r.body).not.toContain('Select content again'); // a retry cannot help
      const lines = t.logs.filter((l) => l.trace_id === traceId && l.event.endsWith('_rejected'));
      expect(lines, code).toHaveLength(1);
      expect(lines[0], code).toMatchObject({ event, ...(fields ?? {}) });
      seen.add(code);
    }
    expect([...seen].sort()).toEqual([...new Set([...Object.keys(LAUNCH_ERRORS), ...Object.keys(PICKER_ERRORS)])].sort());
  });

  it('B-T4b2-03: a valid deep-linking ltik on /tool/launch -> INVALID_LTIK page, reason not_resource_link', async () => {
    const w = await world();
    const ltik = t.lti.addLaunch(launchToken({ platformId: w.a.platformId, type: 'LtiDeepLinkingRequest' }));
    const r = await get(`/tool/launch?ltik=${ltik}`);
    expect([r.statusCode, pageCode(r.body)]).toEqual([401, 'INVALID_LTIK']);
    expect(events('launch_rejected', String(r.headers['x-trace-id']))).toEqual([expect.objectContaining({ reason: 'not_resource_link' })]);
  });

  it('A-T4b2-04: a used picker keeps no encrypted ltik; a failed Deep Linking call keeps it for the retry', async () => {
    const w = await world();
    const failed = await deepLink(w.a.platformId);
    t.lti.failNext = { status: 502, code: 'PLATFORM_ERROR' };
    await picker(failed, w.scorm);
    const len = (id: string) => Number(t.db.prepare('SELECT length(ltik_encrypted) AS n FROM picker_session WHERE id = ?').get(sha256Hex(id))!.n);
    expect(len(failed)).toBeGreaterThan(0);
    expect((await picker(failed, w.scorm)).statusCode).toBe(200);
    expect(len(failed)).toBe(0);
  });
});

describe('tool page security (AC-T4-21, AC-T4-28, AC-T4-32)', () => {
  it('AC-T4-21: headers of the picker GET and POST, the shell, the embedded page and the error pages', async () => {
    const w = await world();
    const id = await deepLink(w.a.platformId);
    const pages = {
      picker: await get(`/tool/picker/${id}`),
      submit: await picker(id, w.scorm),
      play: await get(`/play/${playIdOf((await launch(w.a.platformId, w.scorm)).res.headers.location)}`),
      embedded: await get(`/play/${playIdOf((await launch(w.a.platformId, w.scorm, { documentTarget: 'iframe' })).res.headers.location)}/embedded`),
      error: (await launch(w.a.platformId, w.bPub)).res,
    };
    const csp = (k: keyof typeof pages) => String(pages[k].headers['content-security-policy']);
    expect(csp('picker')).toContain(`frame-ancestors ${TEST_URLS.moodle}; form-action 'self'`);
    expect(csp('submit')).toContain(`frame-ancestors ${TEST_URLS.moodle}; form-action ${TEST_URLS.moodle}`);
    expect(csp('play')).toContain("frame-ancestors 'none'");
    expect(csp('play')).toContain(`frame-src ${TEST_URLS.content}`);
    expect(csp('embedded')).toContain(`frame-ancestors ${TEST_URLS.moodle}`);
    expect(csp('error')).toContain("frame-ancestors https:; form-action 'none'");
    for (const [name, r] of Object.entries(pages)) {
      expect(r.headers['referrer-policy'], name).toBe('same-origin');
      expect(r.headers['x-frame-options'], name).toBeUndefined();
      expect(r.headers['set-cookie'], name).toBeUndefined();
      const nonce = /script-src 'nonce-([^']+)'/.exec(String(r.headers['content-security-policy']))?.[1];
      // Every script tag (inline or the shell module) carries the nonce of the page CSP.
      for (const tag of r.body.match(/<script\b[^>]*>/g) ?? []) expect(tag, name).toContain(`nonce="${nonce}"`);
    }
  });

  it('AC-T4-28: course, package and activity titles are shown literally (escaped) in the picker and the shell', async () => {
    const w = await world();
    const page = (await get(`/tool/picker/${await deepLink(w.a.platformId)}`)).body;
    expect(page).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(page).toContain('&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;');
    const { res } = await launch(w.a.platformId, w.scorm, { resourceLinkTitle: '<i>y</i>' });
    const shell = (await get(`/play/${playIdOf(res.headers.location)}`)).body;
    expect(shell).toContain('<span data-activity-title>&lt;i&gt;y&lt;/i&gt;</span>');
    expect(shell).toContain('&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;');
    for (const body of [page, shell]) {
      expect(body).not.toContain(HOSTILE_PACKAGE_TITLE);
      expect(body).not.toContain('<b>x</b>');
      expect(body).not.toContain('<i>y</i>');
    }
  });

  it('AC-T4-32: every tool page error has a code, a trace id and one action line, and the trace id is in its log event', async () => {
    const w = await world();
    const pickerId = await deepLink(w.a.platformId);
    await picker(pickerId, w.scorm);
    const resourceLtik = t.lti.addLaunch(launchToken({ platformId: w.a.platformId, target: target(w.scorm) }));
    const cases: Array<[Promise<{ body: string; headers: Record<string, unknown> }>, string]> = [
      [launch(w.a.platformId, w.bPub).then((x) => x.res), 'launch_rejected'],
      [get(`/tool/launch?ltik=${resourceLtik}`).then(() => get(`/tool/launch?ltik=${resourceLtik}`)), 'handoff_rejected'],
      [picker(pickerId, w.scorm), 'picker_rejected'],
      [get(`/tool/deep-link?ltik=${t.lti.addLaunch(launchToken({ platformId: w.a.platformId, target: target(w.scorm) }))}`), 'deep_link_rejected'],
    ];
    for (const [p, event] of cases) {
      const r = await p;
      const traceId = /data-trace-id="([^"]+)"/.exec(r.body)?.[1];
      expect(traceId, event).toBe(String(r.headers['x-trace-id']));
      expect(r.body).toMatch(/<p data-error-action>[^<]+<\/p>/);
      expect(events(event, traceId), event).toHaveLength(1);
    }
  });
});

// LA-E3-03 (LA-ADR-05 D2, LA-IC-05): the context claim is optional (LTI Core §5.4.1). The placement key then uses
// context id "", and a resource link id is unique in its deployment (LTI Core §5.3.5).
describe('launch without context (LA-E3-03)', () => {
  /** The launch token of the test kit without launch.context, as GET /api/idtoken gives it for such a launch. */
  const noContext = (o: Parameters<typeof launchToken>[0]) => {
    const token = launchToken(o);
    delete token.launch.context;
    return token;
  };
  const launchNoContext = async (platformId: string, pub: string, over: Partial<Parameters<typeof launchToken>[0]> = {}) => {
    const ltik = t.lti.addLaunch(noContext({ platformId, target: target(pub), ...over }));
    return get(`/tool/launch?ltik=${ltik}`);
  };
  const links = () => t.db.prepare('SELECT deployment_id, context_id, resource_link_id, context_title, line_item_id, service_key_encrypted FROM resource_link ORDER BY created_at, id').all() as
    Array<{ deployment_id: string; context_id: string; resource_link_id: string; context_title: string; line_item_id: string | null; service_key_encrypted: Uint8Array | null }>;
  const externalKeys = () => (t.db.prepare('SELECT external_key FROM placement ORDER BY external_key').all() as Array<{ external_key: string }>).map((r) => r.external_key);

  it('a learner launch with AGS opens the player; the resource link and the placement use context id "" (AC-LA-E3-03-01 at unit level)', async () => {
    const w = await world();
    const res = await launchNoContext(w.a.platformId, w.scorm);
    const traceId = String(res.headers['x-trace-id']);
    expect(res.statusCode).toBe(303);
    expect(String(res.headers.location)).toMatch(/\/play\/ply_[A-Za-z0-9_-]{22}$/);
    expect((await get(`/play/${playIdOf(res.headers.location)}`)).statusCode).toBe(200);
    expect(events('launch_rejected', traceId)).toEqual([]);
    expect(events('launch_accepted', traceId)).toEqual([expect.objectContaining({ preview: false })]);
    expect(links()).toEqual([{
      deployment_id: '1', context_id: '', resource_link_id: '3', context_title: '',
      line_item_id: `${TEST_URLS.moodle}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1`, service_key_encrypted: expect.any(Uint8Array),
    }]);
    expect(externalKeys()).toEqual([JSON.stringify(['1', '', '3'])]);
  });

  it('without AGS and NRPS it still opens the player; no line item and no service key are stored (AC-LA-E3-03-04 at unit level)', async () => {
    const w = await world();
    const ltik = t.lti.addLaunch({ ...noContext({ platformId: w.a.platformId, target: target(w.scorm) }), services: {} });
    const res = await get(`/tool/launch?ltik=${ltik}`);
    expect(res.statusCode).toBe(303);
    expect(links()).toEqual([expect.objectContaining({ context_id: '', line_item_id: null, service_key_encrypted: null })]);
  });

  it('two launches of one activity use one placement; another deployment or a context gives another (AC-LA-E3-03-05 at unit level)', async () => {
    const w = await world();
    expect((await launchNoContext(w.a.platformId, w.scorm, { resourceLinkId: '9' })).statusCode).toBe(303);
    const first = String(events('launch_accepted').at(-1)!.attempt_id);
    t.db.prepare("UPDATE attempt SET outcome = 'in_progress' WHERE id = ?").run(first);
    expect((await launchNoContext(w.a.platformId, w.scorm, { resourceLinkId: '9' })).statusCode).toBe(303);
    expect(events('launch_accepted').at(-1)!.attempt_id).toBe(first); // the same activity: the attempt continues
    expect(externalKeys()).toEqual([JSON.stringify(['1', '', '9'])]);
    expect((await launchNoContext(w.a.platformId, w.scorm, { resourceLinkId: '9', deploymentId: '2' })).statusCode).toBe(303);
    expect((await launch(w.a.platformId, w.scorm, { resourceLinkId: '9', contextId: 'c1' })).res.statusCode).toBe(303);
    expect(externalKeys()).toEqual([JSON.stringify(['1', '', '9']), JSON.stringify(['1', 'c1', '9']), JSON.stringify(['2', '', '9'])].sort());
    expect(count('resource_link')).toBe(3);
  });

  it('a Deep Linking pick without a context goes to the first launch without a context of that course', async () => {
    const w = await world();
    const dl = await get(`/tool/deep-link?ltik=${t.lti.addLaunch(noContext({ platformId: w.a.platformId, type: 'LtiDeepLinkingRequest', roles: [INSTRUCTOR] }))}`);
    const pickerId = /\/tool\/picker\/(pck_[A-Za-z0-9_-]+)$/.exec(String(dl.headers.location))![1]!;
    expect((await picker(pickerId, w.scorm)).statusCode).toBe(200);
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.thanh)).json().stats.activities).toBe(1);
    expect((await launchNoContext(w.a.platformId, w.scorm, { resourceLinkId: '41' })).statusCode).toBe(303);
    // The launch takes over the pick: still one activity.
    expect((await json('GET', `/app-api/publications/${w.scorm}`, w.thanh)).json().stats.activities).toBe(1);
    expect(t.db.prepare('SELECT COUNT(*) AS n FROM picker_session WHERE context_id = ? AND resource_link_id IS NOT NULL').get('')?.n).toBe(1);
  });

  it.each([
    ['a deep-linking ltik (AC-LA-E3-03-08)', { type: 'LtiDeepLinkingRequest' as const }],
    ['a deep-linking ltik without a context', { type: 'LtiDeepLinkingRequest' as const, withoutContext: true }],
    ['a resource launch without a resource link and without a context', { withoutResourceLink: true, withoutContext: true }],
  ])('%s on /tool/launch still gives the INVALID_LTIK page with reason not_resource_link', async (_n, o: { type?: 'LtiDeepLinkingRequest'; withoutContext?: boolean; withoutResourceLink?: boolean }) => {
    const w = await world();
    const token = (o.withoutContext ? noContext : launchToken)({ platformId: w.a.platformId, target: target(w.scorm), ...(o.type ? { type: o.type } : {}) });
    if (o.withoutResourceLink) delete token.launch.resourceLink;
    const r = await get(`/tool/launch?ltik=${t.lti.addLaunch(token)}`);
    expect([r.statusCode, pageCode(r.body)]).toEqual([401, 'INVALID_LTIK']);
    expect(events('launch_rejected', String(r.headers['x-trace-id']))).toEqual([expect.objectContaining({ reason: 'not_resource_link' })]);
    expect(count('resource_link')).toBe(0);
  });
});
