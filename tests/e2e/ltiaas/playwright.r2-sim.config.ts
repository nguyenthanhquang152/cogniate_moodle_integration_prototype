// Playwright config for Slot 6 R2-sim Moodle simulator browser suite (tests/e2e/ltiaas/r2-moodle-sim.r2sim.ts).
// Uses .r2sim.ts so tests/playwright.config.ts (T7 testMatch **/*.spec.ts) never selects it (WE-F9).
import { defineConfig } from '@playwright/test';

const artifactDir = process.env.QA_R2_SIM_ARTIFACT_DIR || '../artifacts/r2-sim';

export default defineConfig({
  testDir: '.',
  testMatch: ['r2-moodle-sim.r2sim.ts'],
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
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'r2-sim-chromium', use: { browserName: 'chromium' } }],
});
