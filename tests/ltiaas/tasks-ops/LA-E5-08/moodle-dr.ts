// Starts one Moodle Dynamic Registration over plain HTTPS (no browser), so that the LTI service stores one
// registration session (contract §2.4: the session row holds the sealed registration token). LA-E5-08 AC-01 then
// checks after the upgrade that this old session still opens (`POST /api/registrations/:id/complete`, §3.8).
// The steps are the Moodle 5.2.4 steps of tests/acceptance/lib/moodle-reg.ts without the page: admin login,
// then `mod/lti/startltiadvregistration.php?url=…&sesskey=…` answers 302 to the registration URL (with
// openid_configuration and registration_token), and the LTI service answers 303 to {app}/tool/register?registrationId=….
// QA stops there: it does not open the app page. The registration token is a secret: it is never logged or asserted.
import assert from 'node:assert/strict';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest, type HttpResult } from '../../../acceptance/lib/https';
import { seed } from '../../../acceptance/lib/seed';

const urls = publicUrls();

/** Moodle web session as the seeded admin. Cookies of the Moodle origin only. */
async function moodleAdmin() {
  const jar = new Map<string, string>();
  const request = async (url: string, method = 'GET', fields?: Record<string, string>): Promise<HttpResult> => {
    assert.equal(new URL(url).origin, urls.moodle, 'the Moodle session sends cookies only to Moodle');
    const res = await httpsRequest(url, {
      method,
      headers: {
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: fields ? new URLSearchParams(fields).toString() : undefined,
    });
    for (const raw of [res.headers['set-cookie'] ?? []].flat()) {
      const pair = raw.split(';')[0];
      const at = pair.indexOf('=');
      if (/Max-Age=0/i.test(raw)) jar.delete(pair.slice(0, at));
      else jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return res;
  };
  const admin = seed().users.admin;
  const page = await request(`${urls.moodle}/login/index.php`);
  const token = /name="logintoken" value="([^"]+)"/.exec(page.body)?.[1];
  assert.ok(token, `Moodle login page has a logintoken (HTTP ${page.status})`);
  const login = await request(`${urls.moodle}/login/index.php`, 'POST', { username: admin.username, password: admin.password, logintoken: token, anchor: '' });
  assert.ok([301, 302, 303].includes(login.status), `Moodle admin login redirects (HTTP ${login.status})`);
  await request(new URL(String(login.headers.location), urls.moodle).href); // the testsession check page
  const tools = await request(`${urls.moodle}/mod/lti/toolconfigure.php`);
  assert.equal(tools.status, 200, 'Manage tools page as admin');
  const sesskey = /"sesskey":"([^"]+)"/.exec(tools.body)?.[1];
  assert.ok(sesskey, 'Manage tools page has a sesskey');
  return { request, sesskey };
}

/** Returns the registration id that the LTI service gave for a new registration session. */
export async function startRegistrationSession(registrationUrl: string): Promise<string> {
  const { request, sesskey } = await moodleAdmin();
  const start = `${urls.moodle}/mod/lti/startltiadvregistration.php?url=${encodeURIComponent(registrationUrl)}&sesskey=${encodeURIComponent(sesskey)}`;
  let res = await request(start);
  // A tool with the same domain gives the "update or register as new" page first: choose "new" (type=0).
  if (res.status === 200 && /startltiadvregistration\.php[^"']*type=0/.test(res.body)) res = await request(`${start}&type=0`);
  const toTool = String(res.headers.location ?? '');
  assert.ok([302, 303].includes(res.status) && toTool.startsWith(registrationUrl), `Moodle sends the browser to the registration URL (HTTP ${res.status})`);
  assert.ok(new URL(toTool).searchParams.get('openid_configuration'), 'the redirect has openid_configuration');
  const register = await httpsRequest(toTool);
  const toApp = String(register.headers.location ?? '');
  assert.equal(register.status, 303, `the LTI service stores the session and answers 303 (HTTP ${register.status}, page code ${/data-error-code="([^"]+)"/.exec(register.body)?.[1] ?? 'none'})`);
  assert.ok(toApp.startsWith(`${urls.app}/tool/register`), 'the 303 goes to the app registration page');
  const id = new URL(toApp).searchParams.get('registrationId');
  assert.ok(id, 'the 303 has registrationId');
  return id;
}
