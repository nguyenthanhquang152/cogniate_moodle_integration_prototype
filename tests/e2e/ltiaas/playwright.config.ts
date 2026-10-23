// Playwright config for the LA-E7-07 K2 browser conformance kit (U1–U4, tests/e2e/ltiaas/*.k2.ts).
// Keeps tests/playwright.config.ts (T7) and tests/e2e/M2/playwright.config.ts (M2) unchanged.
import { defineConfig } from '@playwright/test';

const artifactDir = process.env.QA_K2_ARTIFACT_DIR || '../artifacts/k2';

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.k2.ts'],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  outputDir: `${artifactDir}/test-results`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${artifactDir}/playwright.json` }],
    ['html', { outputFolder: `${artifactDir}/html-report`, open: 'never' }],
  ],
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'k2-chromium', use: { browserName: 'chromium' } }],
});
