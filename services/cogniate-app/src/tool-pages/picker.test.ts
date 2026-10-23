// LA-E3-05 (LA-ADR-05 D3a, D3b, D3c; data model §5b): picker Cancel, multi-select and the not-graded page.
import { makeZip } from '@cogniate/package-inspector/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestApp } from '../testkit.ts';
import { DL_RETURN, INSTRUCTOR, QA_B, TEST_URLS, THANH, formBody, launchToken, testApp } from '../testkit.ts';
import { PICKER_ERRORS } from './picker.ts';

let t: TestApp;
afterEach(async () => {
  vi.restoreAllMocks();
  await t?.app.close();
});

const json = async (method: string, url: string, cookie: string, payload?: unknown) =>
  t.app.inject({ method: method as 'GET', url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as object } : {}) });

async function course(cookie: string, title: string): Promise<string> {
  const id = (await json('POST', '/app-api/courses', cookie, { title })).json().id as string;
  const body = await formBody({ package: makeZip([{ name: 'index.html', data: `<html><body>${title}</body></html>` }]) });
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
const activities = async (cookie: string, pub: string) => (await json('GET', `/app-api/publications/${pub}`, cookie)).json().stats.activities as number;
const get = (url: string) => t.app.inject({ method: 'GET', url });
const pageCode = (body: string) => /data-error-code="([A-Z_]+)"/.exec(body)?.[1];
const count = (sql: string, ...args: string[]) => Number((t.db.prepare(sql).get(...args) as { n: number }).n);

/** The provider profile of a launch on this channel (the LMS check of app contract §6.1 compares its channel). */
let profile: string | undefined;

/**
 * Thanh's connection with three publications (created a, b, c: the list shows c, b, a, newest first) and library B's
 * connection with one. `channel` sets the connection's channel and the launch profile (the real registry: lti-generic
 * has content.multiple; its profile id is lti-generic).
 */
async function world(channel = 'moodle') {
  t = await testApp();
  profile = channel === 'moodle' ? undefined : channel;
  const thanh = await t.login(THANH);
  const a = await connected(thanh, 'thanh-client');
  if (channel !== 'moodle') t.db.prepare('UPDATE connection SET channel = ? WHERE id = ?').run(channel, a.id);
  const pubs: string[] = [];
  for (const title of ['Course A', 'Course B', 'Course C']) {
    pubs.push(await publish(thanh, a.id, await course(thanh, title)));
    t.clock.now += 1000; // a distinct created_at, so the list order is fixed
  }
  const qaB = await t.login(QA_B);
  const b = await connected(qaB, 'b-client');
  const bPub = await publish(qaB, b.id, await course(qaB, 'B course'));
  return { thanh, a, b, pubs: pubs as [string, string, string], bPub };
}

/** A Deep Linking launch of the connection's platform with these deepLinkingSettings; returns the picker id. */
async function openPicker(platformId: string, settings: Record<string, unknown> = {}): Promise<string> {
  const token = launchToken({ platformId, type: 'LtiDeepLinkingRequest', roles: [INSTRUCTOR] });
  token.launch.deepLinkingSettings = settings;
  if (profile) token.platform.profile = profile;
  const r = await get(`/tool/deep-link?ltik=${t.lti.addLaunch(token)}`);
  expect(r.statusCode).toBe(303);
  return /\/tool\/picker\/(pck_[A-Za-z0-9_-]+)$/.exec(String(r.headers.location))![1]!;
}

const form = (headers: Record<string, string>, origin: string | null) => ({ 'content-type': 'application/x-www-form-urlencoded', ...(origin !== null ? { origin } : {}), ...headers });
const pick = (id: string, publicationIds: unknown[], origin: string | null = TEST_URLS.app) => t.app.inject({
  method: 'POST', url: `/tool/picker/${id}`, headers: form({}, origin),
  payload: publicationIds.map((p) => `publicationId=${encodeURIComponent(String(p))}`).join('&'),
});
const cancel = (id: string, origin: string | null = TEST_URLS.app) => t.app.inject({ method: 'POST', url: `/tool/picker/${id}/cancel`, headers: form({}, origin), payload: '' });
const radios = (body: string) => [...body.matchAll(/type="radio" name="publicationId" value="(pub_[^"]+)"/g)].map((m) => m[1]);
const checkboxes = (body: string) => [...body.matchAll(/type="checkbox" name="publicationId" value="(pub_[^"]+)"/g)].map((m) => m[1]);
const cancelForm = (id: string) => `<form method="post" action="/tool/picker/${id}/cancel">\n  <button type="submit" data-cancel>Cancel</button>\n  </form>`;
const rejected = (traceId: string) => t.logs.filter((l) => l.trace_id === traceId && l.event === 'picker_rejected');

describe('multi-select (LA-ADR-05 D3b)', () => {
  it('content.multiple and acceptMultiple: checkboxes; three picks give one answer with three items in list order (AC-LA-E3-05-01 at unit level)', async () => {
    const w = await world('lti-generic');
    const id = await openPicker(w.a.platformId, { acceptMultiple: true });
    const page = await get(`/tool/picker/${id}`);
    expect(page.statusCode).toBe(200);
    expect(checkboxes(page.body)).toEqual([w.pubs[2], w.pubs[1], w.pubs[0]]);
    expect(radios(page.body)).toEqual([]);
    expect(page.body).toContain('<legend>Choose one or more courses (at most 20)</legend>');

    // The form order does not matter: the items keep the list order.
    const done = await pick(id, [w.pubs[0], w.pubs[2], w.pubs[1]]);
    expect(done.statusCode).toBe(200);
    expect(t.lti.deepLinks).toHaveLength(1);
    const items = t.lti.deepLinks[0]!.items;
    expect(items.map((i) => i.lineItem.resourceId)).toEqual([w.pubs[2], w.pubs[1], w.pubs[0]]);
    expect(items.map((i) => i.title)).toEqual(['Course C', 'Course B', 'Course A']);
    for (const item of items) {
      expect(item).toMatchObject({ type: 'ltiResourceLink', url: `${TEST_URLS.lti}/lti/launch/cogniate?resource=${item.lineItem.resourceId}`, lineItem: { scoreMaximum: 100, tag: 'cogniate-score' } });
    }
    expect(done.body).toContain('<h1>Adding the courses to');
    // One pick row per publication; a multi-pick leaves picker_session.publication_id empty (data model §5b).
    expect(count('SELECT COUNT(*) AS n FROM picker_pick')).toBe(3);
    expect(t.db.prepare('SELECT publication_id, used_at FROM picker_session').get()).toEqual({ publication_id: null, used_at: t.clock.now });
  });

  it('a three-item pick grows each picked activities stat by 1 before any launch; the launches then take over the picks (AC-LA-E3-05-09)', async () => {
    const w = await world('lti-generic');
    const before = await Promise.all(w.pubs.map((p) => activities(w.thanh, p)));
    expect(before).toEqual([0, 0, 0]);
    expect((await pick(await openPicker(w.a.platformId, { acceptMultiple: true }), [...w.pubs])).statusCode).toBe(200);
    expect(await Promise.all(w.pubs.map((p) => activities(w.thanh, p)))).toEqual([1, 1, 1]);
    // The first launch of each new activity matches its pick: still one activity per publication.
    for (const [i, pub] of w.pubs.entries()) {
      const token = launchToken({ platformId: w.a.platformId, target: `${TEST_URLS.lti}/lti/launch/cogniate?resource=${pub}`, resourceLinkId: `rl-${i}` });
      token.platform.profile = 'lti-generic';
      const ltik = t.lti.addLaunch(token);
      expect((await get(`/tool/launch?ltik=${ltik}`)).statusCode).toBe(303);
    }
    expect(await Promise.all(w.pubs.map((p) => activities(w.thanh, p)))).toEqual([1, 1, 1]);
    expect(count('SELECT COUNT(*) AS n FROM picker_pick WHERE resource_link_id IS NULL')).toBe(0);
  });

  it('a single pick grows the stat by 1 and writes picker_session.publication_id as before (AC-LA-E3-05-09)', async () => {
    const w = await world();
    const id = await openPicker(w.a.platformId);
    expect((await pick(id, [w.pubs[1]])).statusCode).toBe(200);
    expect(await activities(w.thanh, w.pubs[1])).toBe(1);
    expect(t.db.prepare('SELECT publication_id FROM picker_session').get()).toEqual({ publication_id: w.pubs[1] });
    expect(t.db.prepare('SELECT publication_id, resource_link_id FROM picker_pick').all()).toEqual([{ publication_id: w.pubs[1], resource_link_id: null }]);
    const ltik = t.lti.addLaunch(launchToken({ platformId: w.a.platformId, target: `${TEST_URLS.lti}/lti/launch/cogniate?resource=${w.pubs[1]}`, resourceLinkId: '40' }));
    expect((await get(`/tool/launch?ltik=${ltik}`)).statusCode).toBe(303);
    expect(await activities(w.thanh, w.pubs[1])).toBe(1);
    // Both records of the single pick name the activity.
    const rl = t.db.prepare('SELECT id FROM resource_link').get() as { id: string };
    expect(t.db.prepare('SELECT resource_link_id FROM picker_session').get()).toEqual({ resource_link_id: rl.id });
    expect(t.db.prepare('SELECT resource_link_id FROM picker_pick').get()).toEqual({ resource_link_id: rl.id });
  });

  it('21 ids give the 400 page PUBLICATION_NOT_AVAILABLE and nothing is posted; 20 ids pass (AC-LA-E3-05-02 at unit level)', async () => {
    const w = await world('lti-generic');
    // 18 more available publications of the same connection (copies of course A's version), 21 in all.
    const version = t.db.prepare('SELECT v.* FROM course_version v JOIN publication p ON p.current_version_id = v.id WHERE p.id = ?').get(w.pubs[0]) as
      { format: string; package_id: string; validation_report: string; tracking_profile: string };
    const libraryId = (t.db.prepare('SELECT library_id FROM connection WHERE id = ?').get(w.a.id) as { library_id: string }).library_id;
    const more: string[] = [];
    for (let i = 0; i < 18; i++) {
      t.db.prepare("INSERT INTO course (id, library_id, title, summary, variant, lang, created_at) VALUES (?, ?, ?, '', 'scorm', 'en', 0)").run(`crs_x${i}`, libraryId, `Extra ${i}`);
      t.db.prepare('INSERT INTO course_version (id, course_id, version, format, package_id, validation_report, tracking_profile, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, 0)')
        .run(`ver_x${i}`, `crs_x${i}`, version.format, version.package_id, version.validation_report, version.tracking_profile);
      t.db.prepare("INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'available', ?, ?)")
        .run(`pub_x${i}`, w.a.id, `crs_x${i}`, `ver_x${i}`, i, i);
      more.push(`pub_x${i}`);
    }
    const all = [...w.pubs, ...more];
    expect(all).toHaveLength(21);
    const id = await openPicker(w.a.platformId, { acceptMultiple: true });
    const r = await pick(id, all);
    expect([r.statusCode, pageCode(r.body)]).toEqual([400, 'PUBLICATION_NOT_AVAILABLE']);
    expect(rejected(String(r.headers['x-trace-id']))).toEqual([expect.objectContaining({ reason: 'publication_not_available' })]);
    expect(t.lti.deepLinks).toEqual([]);
    expect(count('SELECT COUNT(*) AS n FROM picker_pick')).toBe(0);
    // Nothing changed: the same picker takes 20.
    expect((await pick(id, all.slice(0, 20))).statusCode).toBe(200);
    expect(t.lti.deepLinks[0]!.items).toHaveLength(20);
  });

  it.each([
    ['one id of another connection (AC-LA-E3-05-03)', (w: Awaited<ReturnType<typeof world>>) => [w.pubs[0], w.bPub]],
    ['a withdrawn publication', (w: Awaited<ReturnType<typeof world>>) => {
      t.db.prepare("UPDATE publication SET status = 'withdrawn' WHERE id = ?").run(w.pubs[1]);
      return [w.pubs[0], w.pubs[1]];
    }],
    ['the same id twice', (w: Awaited<ReturnType<typeof world>>) => [w.pubs[0], w.pubs[0]]],
    ['no id', () => []],
    ['an id that is not a publication id', (w: Awaited<ReturnType<typeof world>>) => [w.pubs[0], 'pub_<x>']],
  ])('multi-select with %s: the 400 page PUBLICATION_NOT_AVAILABLE, no Deep Linking call, the picker stays usable', async (_n, ids) => {
    const w = await world('lti-generic');
    const id = await openPicker(w.a.platformId, { acceptMultiple: true });
    const r = await pick(id, ids(w));
    expect([r.statusCode, pageCode(r.body)]).toEqual([400, 'PUBLICATION_NOT_AVAILABLE']);
    expect(t.lti.deepLinks).toEqual([]);
    expect(t.db.prepare('SELECT used_at FROM picker_session').get()).toEqual({ used_at: null });
    expect((await pick(id, [w.pubs[2]])).statusCode).toBe(200);
  });

  it.each([
    ['moodle', { acceptMultiple: true }, 'Moodle sends accept_multiple: true (AC-LA-E3-05-04, AC-LA-E3-05-12 at unit level)'],
    ['lti-generic', { acceptMultiple: false }, 'acceptMultiple false'],
    ['lti-generic', {}, 'no acceptMultiple'],
    ['lti-generic', { acceptMultiple: 'true' }, 'acceptMultiple that is not the boolean true'],
  ])('%s with %j: the radio list, and a crafted POST with two ids gives the 400 page; nothing is posted (%s)', async (channel, settings, _why) => {
    const w = await world(channel);
    const id = await openPicker(w.a.platformId, settings);
    const page = await get(`/tool/picker/${id}`);
    expect(radios(page.body)).toEqual([w.pubs[2], w.pubs[1], w.pubs[0]]);
    expect(checkboxes(page.body)).toEqual([]);
    expect(page.body).toContain('<legend>Choose one course</legend>');
    const r = await pick(id, [w.pubs[0], w.pubs[1]]);
    expect([r.statusCode, pageCode(r.body)]).toEqual([400, 'PUBLICATION_NOT_AVAILABLE']);
    expect(t.lti.deepLinks).toEqual([]);
    // One item still works.
    expect((await pick(id, [w.pubs[0]])).statusCode).toBe(200);
    expect(t.lti.deepLinks[0]!.items).toHaveLength(1);
  });

  it('a failed Deep Linking call releases the claim and its picks; the retry sends the same items', async () => {
    const w = await world('lti-generic');
    const id = await openPicker(w.a.platformId, { acceptMultiple: true });
    t.lti.failNext = { status: 502, code: 'PLATFORM_ERROR' };
    const failed = await pick(id, [w.pubs[0], w.pubs[1]]);
    expect([failed.statusCode, pageCode(failed.body)]).toEqual([502, 'LTI_SERVICE_ERROR']);
    expect(count('SELECT COUNT(*) AS n FROM picker_pick')).toBe(0);
    expect(t.db.prepare('SELECT used_at FROM picker_session').get()).toEqual({ used_at: null });
    expect((await pick(id, [w.pubs[0], w.pubs[1]])).statusCode).toBe(200);
    expect(count('SELECT COUNT(*) AS n FROM picker_pick')).toBe(2);
  });
});

describe('Cancel (LA-ADR-05 D3a)', () => {
  it('posts an empty answer to the return URL with "No course was added.", uses the picker, writes no pick (AC-LA-E3-05-05 at unit level)', async () => {
    const w = await world();
    const id = await openPicker(w.a.platformId);
    const page = await get(`/tool/picker/${id}`);
    expect(page.body).toContain(cancelForm(id));
    const deepLinking = vi.spyOn(t.lti.client, 'deepLinking');
    const r = await cancel(id);
    expect(r.statusCode).toBe(200);
    expect(deepLinking).toHaveBeenCalledTimes(1);
    expect(deepLinking.mock.calls[0]!.slice(1)).toEqual([[], String(r.headers['x-trace-id']), { message: 'No course was added.' }]);
    expect(t.lti.deepLinks.map((d) => d.items)).toEqual([[]]);
    expect(r.body).toContain(`<form id="cogniate-dl" method="post" action="${DL_RETURN.replace(/&/g, '&amp;')}">`);
    expect(r.body).toMatch(/<input type="hidden" name="JWT" value="header\.[A-Za-z0-9_-]+\.sig">/);
    expect(r.body).toContain('<p>No course was added.</p>');
    expect(r.body).toMatch(/<script nonce="[^"]+">document\.getElementById\('cogniate-dl'\)\.submit\(\);<\/script>/);
    // Security delta §5: the headers of the pick auto-submit.
    expect(r.headers['content-security-policy']).toMatch(new RegExp(`frame-ancestors ${TEST_URLS.moodle}; form-action ${new URL(DL_RETURN).origin}$`));
    expect(r.headers['referrer-policy']).toBe('same-origin');
    // Used, with no publication and no pick: the stats do not change, the ltik is cleared.
    expect(t.db.prepare('SELECT publication_id, used_at IS NOT NULL AS used, length(ltik_encrypted) AS ltik FROM picker_session').get()).toEqual({ publication_id: null, used: 1, ltik: 0 });
    expect(count('SELECT COUNT(*) AS n FROM picker_pick')).toBe(0);
    expect(await Promise.all(w.pubs.map((p) => activities(w.thanh, p)))).toEqual([0, 0, 0]);
    // A second cancel or a pick gets today's used-picker answer.
    for (const again of [await cancel(id), await pick(id, [w.pubs[0]])]) expect([again.statusCode, pageCode(again.body)]).toEqual([410, 'PICKER_USED']);
    expect(t.lti.deepLinks).toHaveLength(1);
  });

  it.each([['https://evil.test'], ['null'], [null]])('a cancel with Origin %s gives 403 and changes nothing (AC-LA-E3-05-06 at unit level)', async (origin) => {
    const w = await world();
    const id = await openPicker(w.a.platformId);
    const r = await cancel(id, origin);
    expect([r.statusCode, pageCode(r.body)]).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    expect(t.logs.filter((l) => l.event === 'csrf_rejected')).toHaveLength(1);
    expect(t.lti.deepLinks).toEqual([]);
    expect(t.db.prepare('SELECT used_at FROM picker_session').get()).toEqual({ used_at: null });
    expect((await cancel(id)).statusCode).toBe(200);
  });

  it('the "No course is published" page has the Cancel button, and Cancel works there (AC-LA-E3-05-07 at unit level)', async () => {
    t = await testApp();
    profile = undefined;
    const thanh = await t.login(THANH);
    const a = await connected(thanh, 'thanh-client');
    const id = await openPicker(a.platformId);
    const page = await get(`/tool/picker/${id}`);
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('<p data-empty>No course is published to this Moodle site yet.');
    expect(page.body).toContain(cancelForm(id));
    expect((await cancel(id)).statusCode).toBe(200);
    expect(t.lti.deepLinks.map((d) => d.items)).toEqual([[]]);
  });

  it.each(['unknown', 'expired'])('a cancel of an %s picker gets the picker answer and no Deep Linking call', async (state) => {
    t = await testApp({ pickerTtlSeconds: 20 });
    profile = undefined;
    const thanh = await t.login(THANH);
    const a = await connected(thanh, 'thanh-client');
    const id = state === 'unknown' ? 'pck_unknownunknownunknown' : await openPicker(a.platformId);
    if (state === 'expired') t.clock.now += 23_000;
    const r = await cancel(id);
    expect([r.statusCode, pageCode(r.body)]).toEqual(state === 'unknown' ? [404, 'PICKER_NOT_FOUND'] : [410, 'PICKER_EXPIRED']);
    expect(t.lti.deepLinks).toEqual([]);
  });

  it('a failed Deep Linking call releases the cancel; a retry works', async () => {
    const w = await world();
    const id = await openPicker(w.a.platformId);
    t.lti.failNext = { status: 502, code: 'PLATFORM_ERROR' };
    const r = await cancel(id);
    expect([r.statusCode, pageCode(r.body)]).toEqual([502, 'LTI_SERVICE_ERROR']);
    expect(t.db.prepare('SELECT used_at FROM picker_session').get()).toEqual({ used_at: null });
    expect((await cancel(id)).statusCode).toBe(200);
  });
});

describe('PLACEMENT_NOT_GRADED (LA-ADR-05 D3c)', () => {
  it.each(['moodle', 'lti-generic'])('%s (content.ungraded false) with acceptLineItem false: the page, picker_rejected, no Deep Linking call (AC-LA-E3-05-08 at unit level)', async (channel) => {
    const w = await world(channel);
    const id = await openPicker(w.a.platformId, { acceptLineItem: false, acceptMultiple: true });
    const page = await get(`/tool/picker/${id}`);
    expect([page.statusCode, pageCode(page.body)]).toEqual([403, 'PLACEMENT_NOT_GRADED']);
    if (channel === 'moodle') expect(page.body).toContain("This Moodle placement does not take graded items. Use Moodle&#39;s graded placement to add a Cogniate course.");
    expect(page.headers['content-security-policy']).toContain("frame-ancestors https:; form-action 'none'");
    expect(page.headers['referrer-policy']).toBe('same-origin');
    expect(rejected(String(page.headers['x-trace-id']))).toEqual([expect.objectContaining({ reason: 'placement_not_graded' })]);
    // A crafted POST gets the same page and makes no Deep Linking call.
    const post = await pick(id, [w.pubs[0]]);
    expect([post.statusCode, pageCode(post.body)]).toEqual([403, 'PLACEMENT_NOT_GRADED']);
    expect(t.lti.deepLinks).toEqual([]);
    expect(t.db.prepare('SELECT used_at FROM picker_session').get()).toEqual({ used_at: null });
  });

  it.each([[true], [undefined], ['false']])('acceptLineItem %s: the picker list as before', async (acceptLineItem) => {
    const w = await world();
    const id = await openPicker(w.a.platformId, acceptLineItem === undefined ? {} : { acceptLineItem });
    const page = await get(`/tool/picker/${id}`);
    expect(page.statusCode).toBe(200);
    expect(radios(page.body)).toHaveLength(3);
    expect((await pick(id, [w.pubs[0]])).statusCode).toBe(200);
  });

  it('the text has a status and an action line in the picker error table', () => {
    expect(PICKER_ERRORS.PLACEMENT_NOT_GRADED).toEqual({
      status: 403, action: "This {LMS} placement does not take graded items. Use {LMS}'s graded placement to add a Cogniate course.",
    });
  });
});
