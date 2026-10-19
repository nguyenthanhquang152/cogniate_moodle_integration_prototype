#!/usr/bin/env node
// T9 AC-T9-01 (command part, QA run): open the stack like `npm run demo:browser` does, but headless and driven by
// Playwright, so no window opens on the Mac. Same browser (Google Chrome in /Applications, or CHROME_BIN), same flags:
//   --host-resolver-rules  maps the stack host names to 127.0.0.1 in this browser only
//   --ignore-certificate-errors-spki-list  trusts only the stack leaf key (SPKI SHA-256 of infra/.certs/stack.crt)
// Then: the Moodle login page, sign in as cg_student (guide Procedure 3 step 3), the portal sign-in page, sign in as
// thanh@cogniate.test (step 5). Passwords come from infra/.secrets/seed.json (the guide says so). Prints no secret.
//
//   node tests/e2e/host/t9-open-pages.mjs --repo <clone> --out <folder>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values: opt } = parseArgs({ options: { repo: { type: 'string' }, out: { type: 'string' } } });
const repo = path.resolve(opt.repo ?? '.');
const out = path.resolve(opt.out ?? path.join(repo, '.tmp', 't9-open-pages'));
fs.mkdirSync(out, { recursive: true });
const env = Object.fromEntries(
  fs.readFileSync(path.join(repo, '.env'), 'utf8').split('\n').map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, '')]),
);
const moodle = env.PUBLIC_MOODLE_URL;
const app = env.PUBLIC_APP_URL;
const hosts = ['PUBLIC_MOODLE_URL', 'PUBLIC_LTI_URL', 'PUBLIC_APP_URL', 'PUBLIC_CONTENT_URL'].map((k) => new URL(env[k]).hostname);
const crt = path.join(repo, 'infra', '.certs', 'stack.crt');
const pub = execFileSync('openssl', ['x509', '-in', crt, '-noout', '-pubkey']);
const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: pub });
const spki = execFileSync('openssl', ['dgst', '-sha256', '-binary'], { input: der }).toString('base64');
const chrome = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const seed = JSON.parse(fs.readFileSync(path.join(repo, 'infra', '.secrets', 'seed.json'), 'utf8'));

const t0 = Date.now();
const results = [];
const mark = (what, ok, detail = '') => {
  results.push({ what, ok, seconds: Math.round((Date.now() - t0) / 100) / 10, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`);
};

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 't9-chrome-profile-'));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: chrome,
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--no-first-run', '--no-default-browser-check', `--host-resolver-rules=${hosts.map((h) => `MAP ${h} 127.0.0.1`).join(', ')}`, `--ignore-certificate-errors-spki-list=${spki}`],
});
try {
  const page = context.pages()[0] ?? (await context.newPage());
  // Moodle login page.
  const r1 = await page.goto(`${moodle}/login/index.php`, { waitUntil: 'load', timeout: 60_000 });
  const login = await page.locator('#username').isVisible().catch(() => false);
  await page.screenshot({ path: path.join(out, '1-moodle-login.png') });
  mark('Moodle login page', r1?.status() === 200 && login, `${moodle}/login/index.php HTTP ${r1?.status()}`);
  // Sign in as cg_student (wait for the password field that Moodle JS re-creates).
  await page.locator('.toggle-sensitive-wrapper #password').waitFor({ timeout: 30_000 });
  await page.fill('#username', 'cg_student');
  await page.fill('#password', seed.moodle.users.cg_student.password);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/login/index.php'), { timeout: 30_000 }).catch(() => undefined), page.click('#loginbtn')]);
  const signedIn = (await page.locator('a[href*="/login/logout.php"]').count()) > 0;
  await page.screenshot({ path: path.join(out, '2-moodle-signed-in.png') });
  mark('Moodle: signed in as cg_student', signedIn, new URL(page.url()).pathname);
  // Portal sign-in page.
  const p2 = await context.newPage();
  const r2 = await p2.goto(`${app}/signin`, { waitUntil: 'load', timeout: 60_000 });
  const signinButton = await p2.getByRole('button', { name: 'Sign in' }).isVisible({ timeout: 15_000 }).catch(() => false);
  await p2.screenshot({ path: path.join(out, '3-portal-signin.png') });
  mark('Portal sign-in page', r2?.status() === 200 && signinButton, `${app}/signin HTTP ${r2?.status()}`);
  await p2.getByLabel('Email').fill('thanh@cogniate.test');
  await p2.getByLabel('Password').fill(seed.portal.users['thanh@cogniate.test'].password);
  await Promise.all([p2.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 30_000 }).catch(() => undefined), p2.getByRole('button', { name: 'Sign in' }).click()]);
  await p2.screenshot({ path: path.join(out, '4-portal-signed-in.png') });
  mark('Portal: signed in as thanh@cogniate.test', !new URL(p2.url()).pathname.startsWith('/signin'), new URL(p2.url()).pathname);
} catch (e) {
  mark('browser check', false, String(e?.message ?? e).split('\n')[0]);
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ chrome, chromeVersion: execFileSync(chrome, ['--version']).toString().trim(), flags: { hostResolverRules: hosts, spkiPinned: true }, results }, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
