// Playwright config for Slot 8 MOODLE-LIVE gate (LA-E7-09 Moodle K2 U1/U2 continuity, LA-E3-05 AC-04/-11, LA-E4-03 AC-09, LA-E5-22 AC-06).
import { defineConfig, devices } from '@playwright/test';

const artifactDir = process.env.QA_MOODLE_LIVE_ARTIFACT_DIR || '../artifacts/moodle-live-slot8';
const grep = process.env.QA_GREP ? new RegExp(process.env.QA_GREP) : undefined;

export default defineConfig({
  testDir: '.',
  testMatch: ['05-moodle-live-slot8.moodle.ts'],
  grep,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 360_000,
  expect: { timeout: 15_000 },
  outputDir: `${artifactDir}/test-results`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${artifactDir}/playwright.json` }],
    ['html', { outputFolder: `${artifactDir}/html-report`, open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    ignoreHTTPSErrors: process.env.QA_IGNORE_HTTPS_ERRORS === '1',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'on',
    trace: 'retain-on-failure',
    video: 'off',
    launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE *.test'] },
  },
});
