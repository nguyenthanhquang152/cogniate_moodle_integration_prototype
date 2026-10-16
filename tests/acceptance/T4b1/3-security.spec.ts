// T4b1 security: ref rules, register page headers and CSRF, tenant matrix.
// Source: tasks/T4b1.md AC-T4-09, -33, -34; contract cogniate-app-api.md §1, §4, §5, §6; security §5, §6, §8.
// AC-T4-09 has a knob part (REF_TTL_SECONDS=20): the host runner runs it in a knob pass (lib/knobs.ts).
import crypto from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { APP, appApi, QA_B, signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import { ACCOUNT, loadState, waitForEvent } from '../lib/lti';
import { newStackContext } from '../lib/moodle-launch';
import { frameErrorProblems, openManageTools, startRegistration, TOOL_REGISTER } from '../lib/moodle-reg';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();

async function newConnection(siteUrl = urls.moodle): Promise<{ id: string; registrationUrl: string }> {
  const s = await signIn(THANH);
  const res = await appApi<{ id: string; registrationUrl: string }>('POST', '/app-api/connections', { cookie: s.cookie, body: { name: `QA ${crypto.randomBytes(3).toString('hex')}`, siteUrl, method: 'dynamic' } });
  expect(res.status, res.body).toBe(201);
  return res.json;
}

async function openInMoodle(context: BrowserContext, page: Page, url: string) {
  await openManageTools(page, seed().users.admin);
  return startRegistration(context, page, url, 'new', 45_000, { hold: false });
}

test.describe.serial('T4b1 security', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T4-09 a used registration URL → REF_INVALID; a connection for https://other.test used from Moodle → SITE_MISMATCH', async () => {
    test.setTimeout(150_000);
    const used = String(loadState('T4b').thanhRegistrationUrl ?? '');
    expect(used, 'AC-T4-08 used Thanh\'s registration URL').not.toBe('');
    const again = await openInMoodle(context, page, used);
    expect(await frameErrorProblems(again, 'REF_INVALID', 'AC-T4-09')).toEqual([]);
    await again.release();

    const other = await newConnection('https://other.test');
    const mismatch = await openInMoodle(context, page, other.registrationUrl);
    expect(await frameErrorProblems(mismatch, 'SITE_MISMATCH', 'AC-T4-09')).toEqual([]);
    await mismatch.release();
  });

  test('AC-T4-09 [knob REF_TTL_SECONDS=20] a registration URL used at TTL + 3 s → REF_EXPIRED', async () => {
    test.setTimeout(150_000);
    const conn = await newConnection();
    const madeAt = Date.now();
    await new Promise((r) => setTimeout(r, Math.max(0, madeAt + 23_000 - Date.now())));
    const expired = await openInMoodle(context, page, conn.registrationUrl);
    expect(await frameErrorProblems(expired, 'REF_EXPIRED', 'AC-T4-09')).toEqual([]);
    await expired.release();
  });

  test('AC-T4-33 register page headers; POST /tool/register with a foreign, null or no Origin → 403; an unknown ref shows REF_INVALID in the frame', async () => {
    test.setTimeout(180_000);
    // 1. Headers of the confirm page (recorded in AC-T4-08).
    const h = (loadState('T4b').registerPageHeaders ?? {}) as Record<string, string>;
    expect(Object.keys(h).length, 'AC-T4-08 recorded the confirm page headers').toBeGreaterThan(0);
    const csp = h['content-security-policy'] ?? '';
    expect(csp).toMatch(new RegExp(`frame-ancestors\\s+${urls.moodle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*;|\\s*$)`));
    expect(csp).toMatch(/form-action\s+'self'/);
    expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/);
    expect(h['referrer-policy']).toBe('same-origin');
    expect(h).not.toHaveProperty('x-frame-options');
    expect(h).not.toHaveProperty('set-cookie');

    // 2. CSRF: a pending connection with a real registration session, then POSTs without the right Origin.
    const conn = await newConnection();
    const held = await openInMoodle(context, page, conn.registrationUrl);
    expect(held.response?.status, 'confirm page').toBe(200);
    await held.release();
    const form = new URLSearchParams({ registrationId: held.registrationId, ref: held.ref ?? '' }).toString();
    for (const [label, origin] of [['Origin https://evil.test', 'https://evil.test'], ['Origin null', 'null'], ['no Origin', null]] as const) {
      const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(form)) };
      if (origin) headers.origin = origin;
      const res = await httpsRequest(TOOL_REGISTER, { method: 'POST', headers, body: form });
      expect(res.status, label).toBe(403);
      const trace = String(res.headers['x-trace-id'] ?? '');
      const ev = await waitForEvent('cogniate-app', (e) => e.event === 'csrf_rejected' && e.trace_id === trace);
      expect(ev, `${label}: csrf_rejected with trace id ${trace}`).toBeDefined();
    }
    const s = await signIn(THANH);
    const still = await appApi<{ status: string }>('GET', `/app-api/connections/${conn.id}`, { cookie: s.cookie });
    expect(still.json.status, 'the connection is still pending').toBe('pending');

    // 3. Unknown ref from Moodle → REF_INVALID page inside the frame.
    const unknown = await openInMoodle(context, page, `${urls.lti}/lti/register/${ACCOUNT}?ref=${crypto.randomBytes(32).toString('base64url')}`);
    expect(await frameErrorProblems(unknown, 'REF_INVALID', 'AC-T4-33')).toEqual([]);
    await unknown.release();
    expect(APP).toBe(urls.app);
  });

  test("AC-T4-34 tenant matrix: library B gets 404 for Thanh's connection, publication and course version endpoints", async () => {
    const st = loadState('T4b') as { thanhConnectionId?: string; thanhScormPublicationId?: string; thanhScorm?: { courseId: string; versionId: string } };
    expect(st.thanhConnectionId && st.thanhScormPublicationId && st.thanhScorm, 'T4b1 state (connection, publication, course)').toBeTruthy();
    const b = await signIn(QA_B);
    const c = st.thanhConnectionId!;
    const p = st.thanhScormPublicationId!;
    const course = st.thanhScorm!;
    const calls: [string, string, unknown?][] = [
      ['GET', `/app-api/connections/${c}`],
      ['POST', `/app-api/connections/${c}/registration-url`],
      ['GET', `/app-api/connections/${c}/tool-configuration`],
      ['PUT', `/app-api/connections/${c}/platform`, { issuer: urls.moodle, clientId: 'x', deploymentId: '1', authenticationEndpoint: `${urls.moodle}/mod/lti/auth.php`, accessTokenEndpoint: `${urls.moodle}/mod/lti/token.php`, jwksUrl: `${urls.moodle}/mod/lti/certs.php` }],
      ['DELETE', `/app-api/connections/${c}`],
      ['GET', `/app-api/publications/${p}`],
      ['POST', `/app-api/publications/${p}/withdraw`],
      ['POST', '/app-api/publications', { connectionId: c, courseId: course.courseId }],
      ['GET', `/app-api/courses/${course.courseId}/versions/${course.versionId}`],
    ];
    const wrong: string[] = [];
    for (const [method, path, body] of calls) {
      const res = await appApi(method, path, { cookie: b.cookie, body });
      if (res.status !== 404) wrong.push(`${method} ${path}: HTTP ${res.status}`);
    }
    expect(wrong).toEqual([]);
    // Nothing changed for Thanh.
    const thanh = await signIn(THANH);
    const conn = await appApi<{ status: string }>('GET', `/app-api/connections/${c}`, { cookie: thanh.cookie });
    expect(['registered', 'connected'], 'Thanh\'s connection is not disabled').toContain(conn.json.status);
    const pub = await appApi<{ status: string }>('GET', `/app-api/publications/${p}`, { cookie: thanh.cookie });
    expect(pub.json.status, "Thanh's publication is not withdrawn").toBe('available');
  });
});
