// Playwright config for QA browser tests. QA_SUITE selects the suite: "acceptance" (default) or "e2e".
// QA_TASK (for example "T1") limits acceptance specs to one task folder.
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { artifactsDir } from './acceptance/lib/paths';

const suite = process.env.QA_SUITE === 'e2e' ? 'e2e' : 'acceptance';
const task = process.env.QA_TASK;
const out = artifactsDir(suite);

export default defineConfig({
  testDir: suite === 'e2e' ? './e2e' : './acceptance',
  testMatch: suite === 'acceptance' && task ? `${task}/**/*.spec.ts` : '**/*.spec.ts',
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
  },
});
