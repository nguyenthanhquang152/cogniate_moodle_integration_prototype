// Author smoke check for T1 (not a QA test). Run in the e2e container:
//   infra/scripts/e2e-run.sh node infra/e2e/smoke.mjs
// It proves: Chromium trusts the stack CA (no ignoreHTTPSErrors), Moodle login works, and the
// MoodleSession cookie flags. It reads the password from /repo/.env (the repo is mounted).
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const env = Object.fromEntries(
  readFileSync('/repo/.env', 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
const moodle = process.env.PUBLIC_MOODLE_URL;
if (!moodle) throw new Error('PUBLIC_MOODLE_URL is not set (run it with infra/scripts/e2e-run.sh)');
const username = process.argv[2] ?? 'cg_teacher';
const password = env[{ admin: 'MOODLE_ADMIN_PASSWORD', cg_teacher: 'MOODLE_TEACHER_PASSWORD', cg_student: 'MOODLE_STUDENT_PASSWORD', cg_student2: 'MOODLE_STUDENT2_PASSWORD' }[username]];
if (!password) throw new Error(`No password in .env for ${username}`);

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const res = await page.goto(`${moodle}/login/index.php`);
  console.log('login page:', res?.status(), await page.title());
  // Moodle's core/togglesensitive (setting loginpasswordtoggle, default on) re-creates the password <input>
  // with outerHTML when its AMD module starts. A value typed before that is lost, and the login fails with
  // "invalid login" (about 1 in 3 runs without this wait). Wait for the wrapper it adds.
  await page.locator('.toggle-sensitive-wrapper #password').waitFor({ timeout: 5000 }).catch(() => undefined);
  await page.fill('#username', username);
  await page.fill('#password', password);
  if ((await page.inputValue('#password')) !== password) throw new Error('password field was reset before submit');
  // Start waiting before the click, so a fast redirect is not missed.
  try {
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith('/login/'), { timeout: 30000, waitUntil: 'domcontentloaded' }),
      page.click('#loginbtn'),
    ]);
  } catch (err) {
    const msg = await page.locator('#loginerrormessage, .loginerrors, .alert').allInnerTexts().catch(() => []);
    console.log('login did not leave /login/:', page.url(), '| page message:', JSON.stringify(msg));
    throw err;
  }
  const usermenu = await page.locator('#user-menu-toggle, .usermenu').first().getAttribute('aria-label').catch(() => null);
  console.log('after login:', page.url(), '| user menu:', usermenu);
  const cookie = (await context.cookies(moodle)).find((c) => c.name === 'MoodleSession');
  console.log('MoodleSession:', JSON.stringify({ secure: cookie?.secure, httpOnly: cookie?.httpOnly, sameSite: cookie?.sameSite, domain: cookie?.domain }));
  if (!cookie?.secure) process.exitCode = 1;
} finally {
  await browser.close();
}
