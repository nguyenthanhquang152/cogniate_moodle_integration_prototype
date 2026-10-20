// Playwright config of the M2 portal suite (QA-E2E). Run by tests/e2e/host/run-m2.mjs inside the e2e container of an
// acceptance stack (lms-sim, lti-gate). Files end in .m2.ts so the T7 suite (testMatch **/*.spec.ts) never runs them.
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const out = path.join(__dirname, '..', 'artifacts', 'm2');
export default defineConfig({
  testDir: __dirname,
  testMatch: '**/*.m2.ts',
  grep: process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined,
  outputDir: path.join(out, 'playwright'),
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: path.join(out, 'playwright-results.json') }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1',
    // Traces and videos would hold typed approval codes; screenshots mask the approval input (AC-M3-07).
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    acceptDownloads: true,
    launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE *.test'] },
  },
});
