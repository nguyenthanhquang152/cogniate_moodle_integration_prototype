// T1 in-container browser: Moodle login. Source: T1.md AC-T1-07 (and AC-T1-03: the browser trusts the stack CA).
import { publicUrls } from '../lib/env';
import { isSignedIn, moodleLogin } from '../lib/moodle-ui';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();

test('AC-T1-07 cg_teacher signs in at Moodle and the MoodleSession cookie is Secure', async ({ page, context }, testInfo) => {
  testInfo.annotations.push({
    type: 'ignoreHTTPSErrors',
    description: process.env.QA_IGNORE_HTTPS_ERRORS === '1' ? 'ON (ADR-005 fallback, record in qa.md)' : 'off',
  });
  const teacher = seed().users.cg_teacher;

  await page.goto(`${urls.moodle}/login/index.php`);
  await expect(page.locator('form#login')).toBeVisible();

  await moodleLogin(page, urls.moodle, teacher.username, teacher.password);
  await page.waitForURL((u) => !u.pathname.startsWith('/login/'), { timeout: 30_000 });
  expect(await isSignedIn(page), 'logout link in the user menu').toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cg_teacher-signed-in.png'), fullPage: false });

  const session = (await context.cookies(urls.moodle)).find((c) => c.name === 'MoodleSession');
  expect(session, 'MoodleSession cookie').toBeDefined();
  expect(session!.secure).toBe(true);
  testInfo.annotations.push({ type: 'MoodleSession', description: `httpOnly=${session!.httpOnly} sameSite=${session!.sameSite}` });
});

test('AC-T1-07 a wrong password does not sign in', async ({ page }) => {
  await moodleLogin(page, urls.moodle, seed().users.cg_teacher.username, `wrong-${Date.now()}`);
  await expect(page.locator('#loginerrormessage')).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/^\/login\//);
  expect(await isSignedIn(page)).toBe(false);
});
