// Playwright config for QA browser tests. QA_SUITE selects the suite: "acceptance" (default) or "e2e".
// QA_TASK (for example "T1") limits acceptance specs to one task folder.
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { artifactsDir } from './acceptance/lib/paths';

const suite = process.env.QA_SUITE === 'e2e' ? 'e2e' : 'acceptance';
// QA_TASK: one task folder or a comma list (T2a,T2b). QA_GREP: a title pattern. H14 forwards both into e2e.
const tasks = (process.env.QA_TASK ?? '').split(',').map((t) => t.trim()).filter(Boolean);
const grep = process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined;
const out = artifactsDir(suite);

export default defineConfig({
  testDir: suite === 'e2e' ? './e2e' : './acceptance',
  testMatch: suite === 'acceptance' && tasks.length ? tasks.map((t) => `${t}/**/*.spec.ts`) : '**/*.spec.ts',
  grep,
  outputDir: path.join(out, 'playwright'),
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(out, 'playwright-results.json') }],
    ['html', { outputFolder: path.join(out, 'playwright-report'), open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    // ADR-005 fallback only. When it is used, qa.md must say so.
    ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1',
    trace: 'on',
    screenshot: 'on',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Second guard for "block every non-*.test host" (tasks README §2): Playwright routes do not see redirected
    // requests, so a redirect to an outside host would pass the route guards. With this rule Chromium cannot
    // resolve any name outside *.test (checked in the e2e image: *.test loads, example.com and a redirect to it fail).
    launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE *.test'] },
  },
});
