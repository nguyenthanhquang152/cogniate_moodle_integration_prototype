import { makeZip } from '@cogniate/package-inspector/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { LtiServiceError } from '../clients/lti-client.ts';
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
const manualValues = (clientId: string, deploymentId = '1') => ({
  issuer: TEST_URLS.moodle, clientId, deploymentId, authenticationEndpoint: `${TEST_URLS.moodle}/mod/lti/auth.php`,
  accessTokenEndpoint: `${TEST_URLS.moodle}/mod/lti/token.php`, jwksUrl: `${TEST_URLS.moodle}/mod/lti/certs.php`,
});
const patches = () => t.lti.calls.filter((x) => x.startsWith('PATCH platform'));
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
    expect(rows[15]).toEqual({ key: 'accept_grades', label: 'Accept grades from the tool', value: 'As specified in Deep Linking definition or Delegate to teacher' }); // Q-T7-01
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

  it('AC-T4-36 (1): the dev seed platform is never adopted -> 409 PLATFORM_IN_USE; the seed platform is not changed', async () => {
    t = await testApp();
    // The dev seed platform: made through the LTI API (seed:lti-manual), bound to no connection.
    t.lti.platforms.set('plt_seed', { id: 'plt_seed', url: TEST_URLS.moodle, clientId: 'seed-client', name: 'Moodle (seed)', active: true, deploymentIds: ['2'], productFamilyCode: null });
    const cookie = await t.login(QA_B);
    const c = (await json('POST', '/app-api/connections', cookie, { name: 'B', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    const r = await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, manualValues('seed-client', '2'));
    expect([r.statusCode, r.json().details.message]).toEqual([409, 'PLATFORM_IN_USE']);
    expect((await json('GET', `/app-api/connections/${c.id}`, cookie)).json()).toMatchObject({ status: 'pending', platform: null });
    expect(t.lti.platforms.get('plt_seed')).toMatchObject({ active: true, name: 'Moodle (seed)' });
    expect(patches()).toEqual([]);
  });

  it('AC-T4-36 (2), (3): another library\'s platform -> 409 PLATFORM_IN_USE, nothing changes; the own PUT again -> 200, same platform', async () => {
    t = await testApp();
    const thanh = await t.login(THANH);
    const a = (await json('POST', '/app-api/connections', thanh, { name: 'A', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    expect((await json('PUT', `/app-api/connections/${a.id}/platform`, thanh, manualValues('thanh-client'))).statusCode).toBe(200);
    const aBefore = (await json('GET', `/app-api/connections/${a.id}`, thanh)).json();
    const qaB = await t.login(QA_B);
    const b = (await json('POST', '/app-api/connections', qaB, { name: 'B', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    const taken = await json('PUT', `/app-api/connections/${b.id}/platform`, qaB, manualValues('thanh-client'));
    expect([taken.statusCode, taken.json().details.message]).toEqual([409, 'PLATFORM_IN_USE']);
    expect((await json('GET', `/app-api/connections/${a.id}`, thanh)).json()).toEqual(aBefore);
    expect(t.lti.platforms.get(aBefore.platform.id)!.active).toBe(true);
    const own = await json('PUT', `/app-api/connections/${b.id}/platform`, qaB, manualValues('b-client'));
    const again = await json('PUT', `/app-api/connections/${b.id}/platform`, qaB, manualValues('b-client'));
    expect([own.statusCode, again.statusCode, again.json().platform.id]).toEqual([200, 200, own.json().platform.id]);
    expect(t.lti.calls.filter((x) => x.startsWith('POST platform') && x.includes('b-client'))).toHaveLength(1);
    // Other values on a registered connection are not a repeat.
    const other = await json('PUT', `/app-api/connections/${b.id}/platform`, qaB, manualValues('b-client-2'));
    expect([other.statusCode, other.json().details.message]).toEqual([409, 'CONNECTION_NOT_PENDING']);
    expect(patches()).toEqual([]);
  });

  it('security §2.6: a platform made in the PUT that cannot be bound is switched off (platform_orphan_deactivated)', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const c = (await json('POST', '/app-api/connections', cookie, { name: 'M', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    // A second request registers the connection while the LTI service makes this platform.
    const orig = t.lti.client.createPlatform;
    t.lti.client.createPlatform = async (body, traceId) => {
      const p = await orig(body, traceId);
      t.db.prepare("UPDATE connection SET status = 'registered' WHERE id = ?").run(c.id);
      return p;
    };
    const r = await json('PUT', `/app-api/connections/${c.id}/platform`, cookie, manualValues('race-client'));
    expect([r.statusCode, r.json().details.message]).toEqual([409, 'CONNECTION_NOT_PENDING']);
    const made = [...t.lti.platforms.values()].find((p) => p.clientId === 'race-client')!;
    expect(made.active).toBe(false);
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'platform_orphan_deactivated', platform_id: made.id }));
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
    expect(page.body).toContain('Go back in Moodle and choose Register as a new external tool.');
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
    lti.client.completeRegistration = async () => { throw new (await import('../clients/lti-client.ts')).LtiServiceError(502, 'PLATFORM_ERROR', 'x', 'tool_may_exist'); };
    const r = await post(reg, ref);
    lti.client.completeRegistration = orig;
    expect([r.statusCode, pageCode(r.body)]).toEqual([502, 'MOODLE_TOOL_MAY_EXIST']);
    expect(r.body).toContain('Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool &#39;Cogniate (Thanh&#39;s Library)&#39;, then connect again.');
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'registration_confirm_rejected', code: 'MOODLE_TOOL_MAY_EXIST' }));
  });

  it.each([
    [0, 'LTI_SERVICE_UNREACHABLE', 'MOODLE_TOOL_MAY_EXIST'],
    [504, 'PLATFORM_TIMEOUT', 'MOODLE_TOOL_MAY_EXIST'],
    [0, 'NO_API_KEY', 'REGISTRATION_FAILED'],
    [502, 'PLATFORM_ERROR', 'REGISTRATION_FAILED'],
  ] as const)('P1: completion %s %s shows %s and preserves the pending ref', async (status, code, expected) => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { id, ref } = await pending(cookie);
    const reg = t.lti.addRegistration();
    t.lti.client.completeRegistration = async () => { throw new LtiServiceError(status, code, 'test failure'); };
    const page = await post(reg, ref);
    expect([page.statusCode, pageCode(page.body)]).toEqual([502, expected]);
    expect((await json('GET', `/app-api/connections/${id}`, cookie)).json()).toMatchObject({
      status: 'pending', platform: null, lastError: { code: expected, ltiCode: code },
    });
    expect((await get(reg, ref)).statusCode).toBe(200);
    expect(patches()).toEqual([]);
  });

  it('P1: a preflight lookup timeout remains generic because completion was never called', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { ref } = await pending(cookie);
    t.lti.client.getRegistration = async () => { throw new LtiServiceError(504, 'PLATFORM_TIMEOUT', 'test failure'); };
    expect(pageCode((await post(t.lti.addRegistration(), ref)).body)).toBe('REGISTRATION_FAILED');
    expect(t.lti.calls.some((c) => c.startsWith('POST complete'))).toBe(false);
  });

  it.each([
    [0, 'LTI_SERVICE_UNREACHABLE', null],
    [504, 'PLATFORM_TIMEOUT', null],
    [502, 'PLATFORM_ERROR', 'tool_may_exist'],
  ] as const)('P1: after completion, %s %s (%s) cleans up the known orphan before the generic failure', async (status, code, reason) => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { id, ref } = await pending(cookie);
    t.lti.client.getPlatform = async () => { throw new LtiServiceError(status, code, 'test failure', reason); };
    const page = await post(t.lti.addRegistration(), ref);
    expect([page.statusCode, pageCode(page.body)]).toEqual([502, 'REGISTRATION_FAILED']);
    const orphan = [...t.lti.platforms.values()].at(-1)!;
    expect(orphan.active).toBe(false);
    expect(t.logs.filter((l) => ['platform_orphan_deactivated', 'registration_confirm_rejected'].includes(l.event)).map((l) => l.event)).toEqual(['platform_orphan_deactivated', 'registration_confirm_rejected']);
    expect((await json('GET', `/app-api/connections/${id}`, cookie)).json()).toMatchObject({ status: 'pending', platform: null });
  });

  it('P1: post-completion lookup failure cannot deactivate a platform owned by another connection', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const owner = await pending(cookie);
    expect((await post(t.lti.addRegistration(), owner.ref)).statusCode).toBe(200);
    const before = (await json('GET', `/app-api/connections/${owner.id}`, cookie)).json();
    const next = await pending(cookie);
    t.lti.client.completeRegistration = async () => ({ platformId: before.platform.id, html: '' });
    t.lti.client.getPlatform = async () => { throw new LtiServiceError(0, 'LTI_SERVICE_UNREACHABLE', 'test failure'); };
    expect(pageCode((await post(t.lti.addRegistration(), next.ref)).body)).toBe('REGISTRATION_FAILED');
    expect(patches()).toEqual([]);
    expect((await json('GET', `/app-api/connections/${owner.id}`, cookie)).json()).toEqual(before);
  });

  it('P1: an orphan cleanup failure preserves the original registration error and logs the failed cleanup', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { id, ref } = await pending(cookie);
    t.lti.client.getPlatform = async () => { throw new LtiServiceError(504, 'PLATFORM_TIMEOUT', 'test failure'); };
    t.lti.client.patchPlatform = async () => { throw new LtiServiceError(0, 'LTI_SERVICE_UNREACHABLE', 'cleanup failure'); };
    expect(pageCode((await post(t.lti.addRegistration(), ref)).body)).toBe('REGISTRATION_FAILED');
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'platform_orphan_deactivate_failed', lti_code: 'LTI_SERVICE_UNREACHABLE' }));
    expect((await json('GET', `/app-api/connections/${id}`, cookie)).json()).toMatchObject({ lastError: { code: 'REGISTRATION_FAILED', ltiCode: 'PLATFORM_TIMEOUT' } });
  });

  it('the returned platform belongs to another connection -> REGISTRATION_FAILED; neither connection changes (app contract §6)', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const a = await pending(cookie);
    const first = t.lti.addRegistration();
    expect((await post(first, a.ref)).statusCode).toBe(200);
    const aBefore = (await json('GET', `/app-api/connections/${a.id}`, cookie)).json();
    const b = await pending(cookie);
    const second = t.lti.addRegistration();
    // The LTI service answers with the platform that connection A already holds.
    const orig = t.lti.client.completeRegistration;
    t.lti.client.completeRegistration = async () => ({ platformId: aBefore.platform.id, html: '' });
    const r = await post(second, b.ref);
    t.lti.client.completeRegistration = orig;
    expect([r.statusCode, pageCode(r.body)]).toEqual([502, 'REGISTRATION_FAILED']);
    expect(r.body).toContain('The connection failed. Go back to Moodle and try again.');
    expect((await json('GET', `/app-api/connections/${a.id}`, cookie)).json()).toEqual(aBefore);
    expect((await json('GET', `/app-api/connections/${b.id}`, cookie)).json()).toMatchObject({ status: 'pending', platform: null });
    expect(patches()).toEqual([]); // the platform of connection A is not switched off
    expect(pageCode((await get(t.lti.addRegistration(), b.ref)).body)).toBeUndefined(); // the ref still works (confirm page)
  });

  it('PUT platform only for a pending manual connection (409 CONNECTION_NOT_PENDING)', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const d = await pending(cookie);
    const r = await json('PUT', `/app-api/connections/${d.id}/platform`, cookie, { issuer: TEST_URLS.moodle });
    expect([r.statusCode, r.json().details.message]).toEqual([409, 'CONNECTION_NOT_PENDING']);
  });

  it('security §2.5 (A-T4b1-02): every update is refused, whatever existingPlatformId names; complete is never called', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { id, ref } = await pending(cookie);
    for (const existingPlatformId of [null, 'plt_1', 'plt_seed']) {
      const upd = t.lti.addRegistration({ operation: 'update', existingPlatformId });
      expect(pageCode((await get(upd, ref)).body)).toBe('UPDATE_NOT_ALLOWED');
      expect(pageCode((await post(upd, ref)).body)).toBe('UPDATE_NOT_ALLOWED');
    }
    expect(t.lti.calls.some((x) => x.startsWith('POST complete'))).toBe(false);
    expect((await json('GET', `/app-api/connections/${id}`, cookie)).json()).toMatchObject({ status: 'pending', lastError: { code: 'UPDATE_NOT_ALLOWED', ltiCode: null } });
  });

  it('security §2.6: library A\'s orphan (a second confirm that lost the race) is switched off; library B cannot adopt it', async () => {
    t = await testApp();
    const thanh = await t.login(THANH);
    const a = await pending(thanh);
    // Another tab registers connection A while this confirm runs: the platform of this confirm is an orphan.
    const orig = t.lti.client.completeRegistration;
    t.lti.client.completeRegistration = async (regId, body, traceId) => {
      const done = await orig(regId, body, traceId);
      t.db.prepare("UPDATE connection SET status = 'registered', ref_token_hash = NULL WHERE id = ?").run(a.id);
      return done;
    };
    const r = await post(t.lti.addRegistration(), a.ref);
    t.lti.client.completeRegistration = orig;
    expect([r.statusCode, pageCode(r.body)]).toEqual([502, 'REGISTRATION_FAILED']);
    const orphan = [...t.lti.platforms.values()].at(-1)!;
    expect(orphan.active).toBe(false);
    expect(t.logs).toContainEqual(expect.objectContaining({ event: 'platform_orphan_deactivated', platform_id: orphan.id }));
    const qaB = await t.login(QA_B);
    const b = (await json('POST', '/app-api/connections', qaB, { name: 'B', siteUrl: TEST_URLS.moodle, method: 'manual' })).json();
    const take = await json('PUT', `/app-api/connections/${b.id}/platform`, qaB, manualValues(orphan.clientId, orphan.deploymentIds[0]));
    expect([take.statusCode, take.json().details.message]).toEqual([409, 'PLATFORM_IN_USE']);
    expect((await json('GET', `/app-api/connections/${b.id}`, qaB)).json()).toMatchObject({ status: 'pending', platform: null });
  });

  it('A-T4b1-03: complete returns an existing switched-off platform -> REGISTRATION_FAILED; not bound, not changed', async () => {
    t = await testApp();
    const cookie = await t.login(QA_B);
    const { id, ref } = await pending(cookie);
    t.lti.platforms.set('plt_off', { id: 'plt_off', url: TEST_URLS.moodle, clientId: 'off-client', name: "Cogniate (Thanh's Library)", active: false, deploymentIds: ['4'], productFamilyCode: 'moodle' });
    const orig = t.lti.client.completeRegistration;
    t.lti.client.completeRegistration = async () => ({ platformId: 'plt_off', html: '' });
    const r = await post(t.lti.addRegistration(), ref);
    t.lti.client.completeRegistration = orig;
    expect([r.statusCode, pageCode(r.body)]).toEqual([502, 'REGISTRATION_FAILED']);
    expect((await json('GET', `/app-api/connections/${id}`, cookie)).json()).toMatchObject({ status: 'pending', platform: null, lastError: { code: 'REGISTRATION_FAILED', ltiCode: 'PLATFORM_NOT_ACTIVE' } });
    expect(t.lti.platforms.get('plt_off')!.active).toBe(false);
    expect(patches()).toEqual([]);
  });

  it('T6 round 2: lastError of MOODLE_TOOL_MAY_EXIST has the page action with the tool name', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { id, ref } = await pending(cookie);
    const reg = t.lti.addRegistration();
    const orig = t.lti.client.completeRegistration;
    t.lti.client.completeRegistration = async () => { throw new LtiServiceError(502, 'PLATFORM_ERROR', 'x', 'tool_may_exist'); };
    const page = await post(reg, ref);
    t.lti.client.completeRegistration = orig;
    const last = (await json('GET', `/app-api/connections/${id}`, cookie)).json().lastError;
    expect(last).toMatchObject({ code: 'MOODLE_TOOL_MAY_EXIST', title: 'Cogniate could not connect this Moodle site' });
    expect(last.action).toBe("Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Cogniate (Thanh's Library)', then connect again.");
    expect(page.body).toContain('Cogniate (Thanh&#39;s Library)'); // the page and the JSON share the text
    const list = (await json('GET', '/app-api/connections', cookie)).json().connections[0].lastError;
    expect(list.action).toBe(last.action);
  });

  it('B-T4b1-01: a failed Connect logs the LTI status and code and stores lastError; success clears it', async () => {
    t = await testApp();
    const cookie = await t.login(THANH);
    const { id, ref } = await pending(cookie);
    const reg = t.lti.addRegistration();
    const orig = t.lti.client.completeRegistration;
    t.lti.client.completeRegistration = async () => { throw new LtiServiceError(502, 'PLATFORM_ERROR', 'Moodle said no', null); };
    const r = await post(reg, ref);
    t.lti.client.completeRegistration = orig;
    expect(pageCode(r.body)).toBe('REGISTRATION_FAILED');
    const traceId = String(r.headers['x-trace-id']);
    const line = t.logs.find((l) => l.event === 'registration_confirm_rejected' && l.trace_id === traceId);
    expect(line).toMatchObject({ code: 'REGISTRATION_FAILED', lti_status: 502, lti_code: 'PLATFORM_ERROR', lti_reason: null });
    expect(JSON.stringify(line)).not.toContain('Moodle said no');
    expect((await json('GET', `/app-api/connections/${id}`, cookie)).json().lastError).toEqual({
      code: 'REGISTRATION_FAILED', ltiCode: 'PLATFORM_ERROR', traceId, at: new Date(t.clock.now).toISOString(),
      // T6 round 2: the same title and action line as the register page (one text table).
      title: 'Cogniate could not connect this Moodle site', action: 'The connection failed. Go back to Moodle and try again.',
    });
    // No platform id came back, so nothing is switched off.
    expect(patches()).toEqual([]);
    const ok = await post(reg, ref);
    expect(ok.body).toContain('<h1>Connected</h1>');
    expect((await json('GET', `/app-api/connections/${id}`, cookie)).json()).toMatchObject({ status: 'registered', lastError: null });
  });

  it('the header builder', () => {
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
