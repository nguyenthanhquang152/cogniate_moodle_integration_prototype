// T3b negative cases. Source: tasks/T3b.md AC-T3-04, -05, -28; contract §2.4, §3.8; security §2.4, §9.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { publicUrls } from '../lib/env';
import { httpsRequest } from '../lib/https';
import { ACCOUNT, apiKey, auth, checkErrorPage, errorCode, eventsSince, hostIs, loadState, ltiApi, waitForEvent } from '../lib/lti';
import { newStackContext } from '../lib/moodle-launch';
import { openManageTools } from '../lib/moodle-reg';
import { expect, test } from '../lib/pw';
import { QA_FIXTURE_DIR, QA_ISSUER } from '../lib/qa-platform';
import { seed } from '../lib/seed';

const urls = publicUrls();
const register = (configUrl: string) => `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(configUrl)}&ref=qa-neg`;

test.describe.serial('T3b negative cases', () => {
  test('AC-T3-04 a second complete → 409 REGISTRATION_ALREADY_COMPLETED; unknown id → 404 REGISTRATION_NOT_FOUND; no Bearer → 401', async () => {
    const id = String(loadState('T3b').registrationId ?? '');
    expect(id, 'AC-T3-03 completed a registration (1-registration.spec.ts)').not.toBe('');
    const key = apiKey(ACCOUNT);
    const again = await ltiApi('POST', `/api/registrations/${encodeURIComponent(id)}/complete`, { authorization: auth.bearer(key), body: { platformName: 'QA again' } });
    expect(again.status, again.body).toBe(409);
    expect(errorCode(again)).toBe('REGISTRATION_ALREADY_COMPLETED');
    const unknown = await ltiApi('GET', `/api/registrations/reg-unknown-${crypto.randomBytes(4).toString('hex')}`, { authorization: auth.bearer(key) });
    expect(unknown.status).toBe(404);
    expect(errorCode(unknown)).toBe('REGISTRATION_NOT_FOUND');
    const noAuth = await ltiApi('GET', `/api/registrations/${encodeURIComponent(id)}`);
    expect(noAuth.status).toBe(401);
  });

  test('AC-T3-05 the openid_configuration URL goes through the guard (private IP, http) and its issuer must be its origin', async () => {
    // 1. Link-local IP: blocked before any request.
    const meta = await httpsRequest(register('https://169.254.169.254/x'));
    expect(meta.status, meta.body.slice(0, 200)).toBe(400);
    const metaTrace = String(meta.headers['x-trace-id'] ?? '');
    const blocked = await waitForEvent('lti-service', (e) => e.event === 'outbound_blocked' && e.trace_id === metaTrace);
    expect(blocked?.reason, 'outbound_blocked reason').toBe('private_ip');
    expect(eventsSince('lti-service', 0, (e) => e.event === 'outbound_request' && hostIs(e, '169.254.169.254')), 'outbound_request to 169.254.169.254').toEqual([]);

    // 2. http:// → not_https.
    const plain = await httpsRequest(register(`${QA_ISSUER.replace(/^https:/, 'http:')}/openid.json`));
    expect(plain.status).toBe(400);
    const plainTrace = String(plain.headers['x-trace-id'] ?? '');
    const notHttps = await waitForEvent('lti-service', (e) => e.event === 'outbound_blocked' && e.trace_id === plainTrace);
    expect(notHttps?.reason, 'outbound_blocked reason').toBe('not_https');

    // 3. A configuration on qa-platform.test whose issuer is another origin → ISSUER_MISMATCH.
    const file = `openid-mismatch-${crypto.randomBytes(4).toString('hex')}.json`;
    const other = 'https://other-issuer.test';
    fs.mkdirSync(QA_FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(QA_FIXTURE_DIR, file),
      JSON.stringify({
        issuer: other,
        authorization_endpoint: `${other}/auth`,
        token_endpoint: `${other}/token`,
        jwks_uri: `${other}/jwks`,
        registration_endpoint: `${other}/register`,
        scopes_supported: ['openid'],
        'https://purl.imsglobal.org/spec/lti-platform-configuration': { product_family_code: 'qa', version: '1', messages_supported: [{ type: 'LtiResourceLinkRequest' }] },
      }),
    );
    try {
      const mismatch = await httpsRequest(register(`${QA_ISSUER}/${file}`));
      expect(checkErrorPage(mismatch, 'ISSUER_MISMATCH', { statuses: [400], test: 'AC-T3-05', endpoint: 'register' })).toEqual([]);
    } finally {
      fs.rmSync(path.join(QA_FIXTURE_DIR, file), { force: true });
    }
  });

  test('AC-T3-28 an unknown tool account shows the UNKNOWN_TOOL_ACCOUNT page inside Moodle\'s registration frame', async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await newStackContext(browser);
    try {
      const page = await context.newPage();
      await openManageTools(page, seed().users.admin);
      const target = `${urls.lti}/lti/register/unknown`;
      const responsePromise = context.waitForEvent('response', { predicate: (r) => r.url().startsWith(target), timeout: 45_000 });
      await page.locator('#tool-url').fill(target);
      await page.locator('#tool-create-button').click();
      // Moodle may first show "update or register new" (a tool with the same domain exists): register as new.
      const choose = (async () => {
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline) {
          const reg = page.frames().find((f) => /startltiadvregistration\.php/.test(f.url()));
          const btn = reg?.locator('button[data-href$="&type=0"]');
          if (btn && (await btn.count().catch(() => 0)) > 0) return btn.first().click();
          await page.waitForTimeout(250);
        }
      })();
      const res = await responsePromise;
      await choose.catch(() => undefined);
      const headers = await res.allHeaders();
      const body = await res.text();
      expect(checkErrorPage({ status: res.status(), headers, body }, 'UNKNOWN_TOOL_ACCOUNT', { statuses: [404], test: 'AC-T3-28', endpoint: 'register' })).toEqual([]);
      expect(headers['content-security-policy'] ?? '', 'CSP').toMatch(/frame-ancestors[^;]*\bhttps:/);
      const frame = page.frames().find((f) => f.url().startsWith(target));
      expect(frame, 'the error page loaded in a frame').toBeDefined();
      await expect(frame!.locator('[data-error-code="UNKNOWN_TOOL_ACCOUNT"]'), 'the frame shows the page (not blocked)').toBeVisible();
      await page.screenshot({ path: test.info().outputPath('unknown-account-in-frame.png') });
    } finally {
      await context.close();
    }
  });
});
