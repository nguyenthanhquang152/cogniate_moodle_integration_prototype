// Conformance P1 (Lead; app contract §6 register failure pages and security §2.6, §9 at 5d2bf50): when Moodle is slow
// at registration, the app waits up to 15 s for `complete` (the LTI service waits 5 s for Moodle), so the LTI
// service's tool_may_exist answer reaches the app and the page is MOODLE_TOOL_MAY_EXIST, not REGISTRATION_FAILED.
// Slow Moodle (Lead decision): `docker compose pause moodle` through the host channel (QA project only), always
// unpaused. After Moodle resumes, QA checks that no new active platform without a connection is left.
// Run by the "P1" pass of tests/host/run-t5.mjs (QA_TASK=T4b1, QA_GREP="P1 register with a paused").
import crypto from 'node:crypto';
import { appApi, QA_B, signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { hostAction } from '../lib/host-control';
import { ACCOUNT, apiKey, auth, ltiApi } from '../lib/lti';
import { newStackContext } from '../lib/moodle-launch';
import { openManageTools, startRegistration } from '../lib/moodle-reg';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();

async function activePlatformIds(): Promise<string[]> {
  const res = await ltiApi<{ platforms: { id: string; active: boolean }[] }>('GET', '/api/platforms', { authorization: auth.bearer(apiKey(ACCOUNT)) });
  expect(res.status, res.body.slice(0, 200)).toBe(200);
  return res.json.platforms.filter((p) => p.active).map((p) => p.id);
}

async function boundPlatformIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const who of [THANH, QA_B]) {
    const s = await signIn(who);
    const list = await appApi<{ connections: { platform?: { id?: string } | null }[] }>('GET', '/app-api/connections', { cookie: s.cookie });
    for (const c of list.json.connections ?? []) if (c.platform?.id) ids.add(c.platform.id);
  }
  return ids;
}

test('P1 register with a paused (slow) Moodle → "Connect" disabled with the waiting text, one POST only; MOODLE_TOOL_MAY_EXIST after the LTI service\'s 5 s and within 15 s; the connection stays pending; after Moodle resumes, no new active platform without a connection', async ({ browser }) => {
  test.setTimeout(300_000);
  const b = await signIn(QA_B);
  const before = new Set(await activePlatformIds());
  const name = `QA P1 ${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
  const created = await appApi<{ id: string; registrationUrl?: string; status: string }>('POST', '/app-api/connections', { cookie: b.cookie, body: { name, siteUrl: urls.moodle, method: 'dynamic' } });
  expect(created.status, created.body.slice(0, 200)).toBe(201);
  const regUrl = String(created.json.registrationUrl ?? '');
  expect(regUrl, 'registration URL').toMatch(/^https:\/\//);

  const admin = await newStackContext(browser);
  let paused = false;
  try {
    const page = await admin.newPage();
    await openManageTools(page, seed().users.admin);
    const held = await startRegistration(admin, page, regUrl, 'new', 45_000, { hold: false });
    const connect = held.frame.getByRole('button', { name: 'Connect' });
    await expect(connect, 'the app confirm page').toBeVisible();
    // Count the confirm form posts (B-FIX-02: the button is disabled on submit, so a second click sends nothing).
    const posts: string[] = [];
    admin.on('request', (q) => {
      if (q.method() === 'POST' && q.url().startsWith(`${urls.app}/tool/register`)) posts.push(q.url());
    });
    await hostAction('moodle-pause');
    paused = true;
    const t0 = Date.now();
    await connect.click();
    // While Moodle is slow (app contract §6, GET /tool/register): "Connect" disabled and the waiting text.
    await expect(connect, '"Connect" is disabled after submit').toBeDisabled({ timeout: 3_000 });
    await expect(held.frame.getByText('Connecting to Moodle. This can take up to 15 seconds. Do not close this window.').first()).toBeVisible({ timeout: 3_000 });
    await connect.click({ force: true, timeout: 2_000 }).catch(() => undefined); // a second click
    test.info().annotations.push({ type: 'waiting state', description: `disabled and waiting text ${((Date.now() - t0) / 1000).toFixed(1)} s after Connect` });
    try {
      await expect(held.frame.getByText(/Moodle may have saved a Pending tool/).first(), 'MOODLE_TOOL_MAY_EXIST page').toBeVisible({ timeout: 30_000 });
    } catch (err) {
      const shown = (await held.frame.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      test.info().annotations.push({ type: 'page instead', description: `${((Date.now() - t0) / 1000).toFixed(1)} s after Connect: ${shown.slice(0, 500)}` });
      throw err;
    }
    const seconds = (Date.now() - t0) / 1000;
    const text = (await held.frame.locator('body').innerText()).replace(/\s+/g, ' ');
    test.info().annotations.push({ type: 'page', description: `${seconds.toFixed(1)} s after Connect: ${text.slice(0, 400)}` });
    expect(text, 'the page names the code').toContain('MOODLE_TOOL_MAY_EXIST');
    expect(text).not.toContain('REGISTRATION_FAILED');
    expect(seconds, 'after the LTI service\'s 5 s Moodle call').toBeGreaterThanOrEqual(4.5);
    expect(seconds, 'within the app\'s 15 s').toBeLessThanOrEqual(16);
    expect(posts, 'one confirm POST (the second click sent nothing)').toHaveLength(1);
  } finally {
    if (paused) await hostAction('moodle-unpause').catch(() => undefined);
    await admin.close();
  }

  const conn = await appApi<{ status: string }>('GET', `/app-api/connections/${created.json.id}`, { cookie: b.cookie });
  expect(conn.json.status, 'the connection stays pending').toBe('pending');
  // Moodle resumes and may finish the frozen request late: no new active platform may stay without a connection.
  const deadline = Date.now() + 30_000;
  let ownerless: string[] = [];
  while (Date.now() < deadline) {
    const bound = await boundPlatformIds();
    ownerless = (await activePlatformIds()).filter((id) => !before.has(id) && !bound.has(id));
    await new Promise((r) => setTimeout(r, 5_000));
  }
  test.info().annotations.push({ type: 'new active platforms without a connection', description: ownerless.length ? ownerless.join(', ') : 'none' });
  expect(ownerless, 'no new active ownerless platform').toEqual([]);
});
