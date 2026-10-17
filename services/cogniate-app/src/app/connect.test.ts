import { makeZip } from '@cogniate/package-inspector/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { isUpdateAllowed } from '../tool-pages/register.ts';
import { toolPageHeaders } from '../tool-pages/page.ts';
import type { TestApp } from '../testkit.ts';
import { QA_B, TEST_URLS, THANH, formBody, testApp } from '../testkit.ts';
import { badPlatformFields, toolName } from './connections.ts';

let t: TestApp;
afterEach(async () => {
  await t?.app.close();
});

const json = async (method: string, url: string, cookie: string, payload?: unknown) =>
  t.app.inject({ method: method as 'GET', url, headers: method === 'GET' ? { cookie } : t.writeHeaders(cookie), ...(payload !== undefined ? { payload: payload as object } : {}) });

async function course(cookie: string): Promise<string> {
  const c = (await json('POST', '/app-api/courses', cookie, { title: 'SCORM course' })).json().id as string;
  const body = await formBody({ package: makeZip([{ name: 'index.html', data: '<html><body>x</body></html>' }]) });
  const r = await t.app.inject({ method: 'POST', url: `/app-api/courses/${c}/versions`, headers: { ...t.writeHeaders(cookie), ...body.headers }, payload: body.payload });
  expect(r.statusCode).toBe(201);
  return c;
}

const refOf = (registrationUrl: string) => new URL(registrationUrl).searchParams.get('ref')!;
const pageCode = (body: string) => /data-error-code="([A-Z_]+)"/.exec(body)?.[1];

describe('connections (app contract §4)', () => {
  it('AC-T4-07 dynamic: 201 pending with a registration URL; GET shows it; a new URL replaces the old ref', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const r = await json('POST', '/app-api/connections', cookie, { name: 'Dev Moodle', siteUrl: TEST_URLS.moodle, method: 'dynamic' });
    expect(r.statusCode).toBe(201);
    const c = r.json();
    expect(c).toMatchObject({ name: 'Dev Moodle', siteUrl: TEST_URLS.moodle, method: 'dynamic', status: 'pending', platform: null, lastLaunchAt: null });
    expect(c.id).toMatch(/^con_/);
    expect(c.registrationUrl).toMatch(new RegExp(`^${TEST_URLS.lti.replace(/\./g, '\\.')}/lti/register/cogniate\\?ref=[A-Za-z0-9_-]{43}$`));
    expect(Date.parse(c.registrationUrlExpiresAt) - t.clock.now).toBe(86400 * 1000);
    expect((await json('GET', `/app-api/connections/${c.id}`, cookie)).json().registrationUrl).toBe(c.registrationUrl);
    const n = await json('POST', `/app-api/connections/${c.id}/registration-url`, cookie);
    expect(n.json().registrationUrl).not.toBe(c.registrationUrl);
    expect((await json('GET', '/app-api/connections', cookie)).json().connections).toHaveLength(1);
    // The ref is stored only as a hash and an encrypted copy.
    expect(JSON.stringify(t.db.prepare('SELECT * FROM connection').all())).not.toContain(refOf(n.json().registrationUrl));
  });

  it('a bad siteUrl or method is 400', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    for (const payload of [{ name: 'x', siteUrl: 'http://moodle.test', method: 'dynamic' }, { name: 'x', siteUrl: 'https://moodle.test/path', method: 'dynamic' }, { name: 'x', siteUrl: TEST_URLS.moodle, method: 'lti11' }]) {
      expect((await json('POST', '/app-api/connections', cookie, payload)).statusCode).toBe(400);
    }
  });

  it('AC-T4-10 manual: the 16 tool-configuration rows in order; PUT platform registers it; evil.test JWKS -> 422 with fields', async () => {
    t = await testApp();
    const cookie = await t.login(QA_B);
    const c = (await json('POST', '/app-api/connections', cookie, { name: 'B Moodle', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    expect(c.registrationUrl).toBeNull();
    const rows = (await json('GET', `/app-api/connections/${c.id}/tool-configuration`, cookie)).json() as Array<{ key: string; label: string; value: string }>;
    expect(rows.map((r) => r.key)).toEqual(['tool_name', 'tool_url', 'lti_version', 'public_key_type', 'public_keyset_url', 'initiate_login_url', 'redirection_uris',
      'deep_linking', 'content_selection_url', 'tool_configuration_usage', 'launch_container', 'ags', 'nrps', 'share_name', 'share_email', 'accept_grades']);
    expect(rows[0]).toEqual({ key: 'tool_name', label: 'Tool name', value: 'Cogniate (QA Library B)' });
    expect(rows[4]!.value).toBe(`${TEST_URLS.lti}/lti/keys/cogniate`);
    const values = { issuer: TEST_URLS.moodle, clientId: 'abc', deploymentId: '3', authenticationEndpoint: `${TEST_URLS.moodle}/mod/lti/auth.php`,
      accessTokenEndpoint: `${TEST_URLS.moodle}/mod/lti/token.php`, jwksUrl: `${TEST_URLS.moodle}/mod/lti/certs.php` };
    const bad = await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, { ...values, jwksUrl: 'https://evil.test/certs' });
    expect([bad.statusCode, bad.json().details.message, bad.json().details.fields]).toEqual([422, 'INVALID_PLATFORM_VALUES', ['jwksUrl']]);
    const ok = await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, values);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ status: 'registered', platform: { issuer: TEST_URLS.moodle, clientId: 'abc', deploymentIds: ['3'] } });
    expect(t.lti.calls.find((x) => x.startsWith('POST platform'))).toContain('"name":"Cogniate (QA Library B)"');
  });

  it('badPlatformFields: issuer origin = siteUrl; endpoints on the issuer origin; https', () => {
    const v = { issuer: 'https://moodle.test', clientId: 'c', deploymentId: '1', authenticationEndpoint: 'https://moodle.test/a', accessTokenEndpoint: 'https://moodle.test/t', jwksUrl: 'https://moodle.test/k' };
    expect(badPlatformFields('https://moodle.test', v)).toEqual([]);
    expect(badPlatformFields('https://other.test', v)).toEqual(['issuer']);
    expect(badPlatformFields('https://moodle.test', { ...v, accessTokenEndpoint: 'http://moodle.test/t', authenticationEndpoint: 'https://moodle.test:8443/a' })).toEqual(['authenticationEndpoint', 'accessTokenEndpoint']);
  });

  it('DELETE switches the platform off in the LTI service and disables the connection', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const c = (await json('POST', '/app-api/connections', cookie, { name: 'M', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, { issuer: TEST_URLS.moodle, clientId: 'z', deploymentId: '1', authenticationEndpoint: `${TEST_URLS.moodle}/a`, accessTokenEndpoint: `${TEST_URLS.moodle}/t`, jwksUrl: `${TEST_URLS.moodle}/k` });
    expect((await json('DELETE', `/app-api/connections/${c.id}`, cookie)).statusCode).toBe(204);
    expect((await json('GET', `/app-api/connections/${c.id}`, cookie)).json().status).toBe('disabled');
    expect(t.lti.calls.some((x) => x.startsWith('PATCH platform') && x.includes('"active":false'))).toBe(true);
  });

  it('toolName is ASCII', () => {
    expect(toolName("Thanh's Library")).toBe("Cogniate (Thanh's Library)");
    expect(toolName('Thư viện Đà Nẵng')).toBe('Cogniate (Thu vien a Nang)');
  });
});

describe('/tool/register (app contract §6, security §5, §6)', () => {
  async function pending(cookie: string, siteUrl = TEST_URLS.moodle) {
    const c = (await json('POST', '/app-api/connections', cookie, { name: 'Dev Moodle', siteUrl, method: 'dynamic' })).json();
    return { id: c.id as string, ref: refOf(c.registrationUrl) };
  }
  const get = (registrationId: string, ref: string) => t.app.inject({ method: 'GET', url: `/tool/register?registrationId=${registrationId}&ref=${ref}` });
  /** origin 'none' = no Origin header (undefined would take the default). */
  const post = (registrationId: string, ref: string, origin: string = TEST_URLS.app) =>
    t.app.inject({ method: 'POST', url: '/tool/register', headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origin !== 'none' ? { origin } : {}) }, payload: new URLSearchParams({ registrationId, ref }).toString() });

  it('AC-T4-08: confirm page with site, version, library and privacy text; Connect registers and closes the dialog', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { id, ref } = await pending(cookie);
    const reg = t.lti.addRegistration();
    const page = await get(reg, ref);
    expect(page.statusCode).toBe(200);
    for (const text of [TEST_URLS.moodle, '5.2.4 (Build: 20261005)', 'Thanh&#39;s Library', 'Learners are anonymous: Moodle does not send names or emails.', '>Connect</button>']) expect(page.body).toContain(text);
    // AC-T4-33 headers
    const csp = String(page.headers['content-security-policy']);
    expect(csp).toContain(`frame-ancestors ${TEST_URLS.moodle}`);
    expect(csp).toContain("form-action 'self'");
    expect(csp).toMatch(/script-src 'nonce-[A-Za-z0-9+/=]+'/);
    expect(page.headers['referrer-policy']).toBe('same-origin');
    expect(page.headers['x-frame-options']).toBeUndefined();
    expect(page.headers['set-cookie']).toBeUndefined();

    const done = await post(reg, ref);
    expect(done.statusCode).toBe(200);
    expect(done.body).toContain('Done. Go back to Moodle and activate the tool.');
    expect(done.body).toMatch(/<script nonce="[^"]+">\(window\.opener \|\| window\.parent\)\.postMessage\(\{subject:'org\.imsglobal\.lti\.close'\}, '\*'\);<\/script>/);
    expect(String(done.headers['content-security-policy'])).toContain("form-action 'none'");
    expect(t.lti.calls.find((x) => x.startsWith('POST complete'))).toContain('"platformName":"Cogniate (Thanh\'s Library)","privacyLevel":"anonymous","autoActivate":true');
    const c = (await json('GET', `/app-api/connections/${id}`, cookie)).json();
    expect(c).toMatchObject({ status: 'registered', registrationUrl: null, platform: { clientId: expect.stringMatching(/^client-/) } });
    // AC-T4-09: the same URL again -> REF_INVALID
    expect(pageCode((await get(reg, ref)).body)).toBe('REF_INVALID');
  });

  it('AC-T4-09: SITE_MISMATCH and REF_EXPIRED; AC-T4-33: unknown ref -> REF_INVALID error page that any https frame may show', async () => {
    t = await testApp({ refTtlSeconds: 20 });
    const cookie = await t.login(THANH);
    const other = await pending(cookie, 'https://other.test');
    expect(pageCode((await get(t.lti.addRegistration(), other.ref)).body)).toBe('SITE_MISMATCH');
    const p = await pending(cookie);
    t.clock.now += 23_000;
    const expired = await get(t.lti.addRegistration(), p.ref);
    expect([expired.statusCode, pageCode(expired.body)]).toEqual([400, 'REF_EXPIRED']);
    const unknown = await get(t.lti.addRegistration(), 'x'.repeat(43));
    expect(pageCode(unknown.body)).toBe('REF_INVALID');
    expect(unknown.body).toMatch(/data-trace-id="[A-Za-z0-9-]+"/);
    expect(unknown.body).toMatch(/<p data-error-action>[^<]+<\/p>/);
    expect(String(unknown.headers['content-security-policy'])).toContain('frame-ancestors https:');
    expect(String(unknown.headers['content-security-policy'])).toContain("form-action 'none'");
    expect(t.logs.filter((l) => l.event === 'registration_confirm_rejected').map((l) => l.code)).toEqual(['SITE_MISMATCH', 'REF_EXPIRED', 'REF_INVALID']);
  });

  it('AC-T4-30: an update of another platform -> UPDATE_NOT_ALLOWED page, nothing completed; "register as new" then works', async () => {
    t = await testApp();
    const cookie = await t.login(QA_B);
    const { ref } = await pending(cookie);
    const upd = t.lti.addRegistration({ operation: 'update', existingPlatformId: 'plt_thanh' });
    const page = await get(upd, ref);
    expect([page.statusCode, pageCode(page.body)]).toEqual([409, 'UPDATE_NOT_ALLOWED']);
    expect(page.body).toContain('Go back in Moodle and choose Register as a new tool.');
    expect(pageCode((await post(upd, ref)).body)).toBe('UPDATE_NOT_ALLOWED');
    expect(t.lti.calls.some((x) => x.startsWith('POST complete'))).toBe(false);
    const fresh = t.lti.addRegistration();
    expect((await post(fresh, ref)).statusCode).toBe(200);
  });

  it('AC-T4-33: POST with a foreign Origin, null, or none -> 403, csrf_rejected, connection still pending', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { id, ref } = await pending(cookie);
    const reg = t.lti.addRegistration();
    for (const origin of ['https://evil.test', 'null', 'none']) {
      const r = await post(reg, ref, origin);
      expect([r.statusCode, pageCode(r.body)]).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    }
    expect(t.logs.filter((l) => l.event === 'csrf_rejected').map((l) => l.origin)).toEqual(['https://evil.test', 'null', null]);
    expect((await json('GET', `/app-api/connections/${id}`, cookie)).json().status).toBe('pending');
    expect(t.lti.calls.some((x) => x.startsWith('POST complete'))).toBe(false);
  });

  it('an LTI service failure on complete -> REGISTRATION_FAILED page; the ref still works afterwards', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { ref } = await pending(cookie);
    const reg = t.lti.addRegistration();
    t.lti.failNext = { status: 502, code: 'PLATFORM_ERROR' };
    expect(pageCode((await get(reg, ref)).body)).toBe('REGISTRATION_FAILED');
    expect((await post(reg, ref)).statusCode).toBe(200);
  });

  it('A-T3b-01: the LTI service does not know if Moodle saved the tool -> MOODLE_TOOL_MAY_EXIST page with the clean-up text', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { ref } = await pending(cookie);
    const reg = t.lti.addRegistration();
    await get(reg, ref); // the confirm page (no failure yet)
    t.lti.failNext = null;
    const lti = t.lti;
    const orig = lti.client.completeRegistration;
    lti.client.completeRegistration = async () => { throw new (await import('../domain/lti-client.ts')).LtiServiceError(502, 'PLATFORM_ERROR', 'x', 'tool_may_exist'); };
    const r = await post(reg, ref);
    lti.client.completeRegistration = orig;
    expect([r.statusCode, pageCode(r.body)]).toEqual([502, 'MOODLE_TOOL_MAY_EXIST']);
    expect(r.body).toContain('Delete it in Site administration &gt; Plugins &gt; Activity modules &gt; External tool &gt; Manage tools, then start Connect again.');
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'registration_confirm_rejected', code: 'MOODLE_TOOL_MAY_EXIST' }));
  });

  it('isUpdateAllowed and the header builder', () => {
    expect(isUpdateAllowed({ operation: 'new', existingPlatformId: null }, { ltiPlatformId: null })).toBe(true);
    expect(isUpdateAllowed({ operation: 'update', existingPlatformId: 'p1' }, { ltiPlatformId: 'p1' })).toBe(true);
    expect(isUpdateAllowed({ operation: 'update', existingPlatformId: 'p1' }, { ltiPlatformId: null })).toBe(false);
    expect(isUpdateAllowed({ operation: 'update', existingPlatformId: null }, { ltiPlatformId: null })).toBe(false);
    expect(toolPageHeaders('register-result', { site: 'https://m.test', nonce: 'n' })['content-security-policy']).toContain("frame-ancestors https://m.test; form-action 'none'");
    expect(() => toolPageHeaders('register-form')).toThrow();
  });
});

describe('publications (app contract §5)', () => {
  async function registered(cookie: string): Promise<string> {
    const c = (await json('POST', '/app-api/connections', cookie, { name: 'M', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, { issuer: TEST_URLS.moodle, clientId: `c-${c.id}`, deploymentId: '1', authenticationEndpoint: `${TEST_URLS.moodle}/a`, accessTokenEndpoint: `${TEST_URLS.moodle}/t`, jwksUrl: `${TEST_URLS.moodle}/k` });
    return c.id as string;
  }

  it('AC-T4-12 / AC-T4-14: 409 on a pending connection; 201 then 200 with the same id; withdraw; publish again -> available', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const courseId = await course(cookie);
    const pendingC = (await json('POST', '/app-api/connections', cookie, { name: 'P', siteUrl: TEST_URLS.moodle, method: 'dynamic' })).json().id;
    const r0 = await json('POST', '/app-api/publications', cookie, { connectionId: pendingC, courseId });
    expect([r0.statusCode, r0.json().details.message]).toEqual([409, 'CONNECTION_NOT_READY']);
    const connectionId = await registered(cookie);
    const r1 = await json('POST', '/app-api/publications', cookie, { connectionId, courseId });
    expect(r1.statusCode).toBe(201);
    expect(r1.json()).toMatchObject({ connectionId, courseId, courseTitle: 'SCORM course', version: 1, format: 'html', status: 'available', stats: { activities: 0, learners: 0 } });
    const r2 = await json('POST', '/app-api/publications', cookie, { connectionId, courseId });
    expect([r2.statusCode, r2.json().id]).toEqual([200, r1.json().id]);
    expect((await json('POST', `/app-api/publications/${r1.json().id}/withdraw`, cookie)).json().status).toBe('withdrawn');
    const r3 = await json('POST', '/app-api/publications', cookie, { connectionId, courseId });
    expect([r3.statusCode, r3.json().status]).toEqual([200, 'available']);
    expect((await json('GET', `/app-api/publications?connectionId=${connectionId}`, cookie)).json().publications).toHaveLength(1);
    const empty = await json('POST', '/app-api/courses', cookie, { title: 'Empty' });
    expect((await json('POST', '/app-api/publications', cookie, { connectionId, courseId: empty.json().id })).json().details.message).toBe('VERSION_NOT_READY');
  });

  it('AC-T4-34 tenant matrix: library B gets 404 for every Thanh resource', async () => {
    t = await testApp();
    const thanh = await t.login(THANH);
    const courseId = await course(thanh);
    const connectionId = await registered(thanh);
    const pub = (await json('POST', '/app-api/publications', thanh, { connectionId, courseId })).json().id as string;
    const qaB = await t.login(QA_B);
    const reqs: Array<[string, string, unknown?]> = [
      ['GET', `/app-api/connections/${connectionId}`], ['POST', `/app-api/connections/${connectionId}/registration-url`],
      ['GET', `/app-api/connections/${connectionId}/tool-configuration`], ['PUT', `/app-api/connections/${connectionId}/platform`, { issuer: 'x' }],
      ['DELETE', `/app-api/connections/${connectionId}`], ['GET', `/app-api/publications/${pub}`], ['POST', `/app-api/publications/${pub}/withdraw`],
      ['POST', '/app-api/publications', { connectionId, courseId }],
    ];
    for (const [method, url, payload] of reqs) {
      const r = await json(method, url, qaB, payload);
      expect(r.statusCode, `${method} ${url}`).toBe(404);
    }
    expect((await json('GET', '/app-api/connections', qaB)).json().connections).toEqual([]);
    expect((await json('GET', '/app-api/publications', qaB)).json().publications).toEqual([]);
  });
});
