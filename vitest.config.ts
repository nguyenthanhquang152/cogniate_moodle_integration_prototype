// Unit tests live next to the code, in workspaces and channel folders (allow-list, B-T1-01):
// git-ignored folders (**/.data, .tmp) and QA's tests/ are never scanned.
import { defineConfig } from 'vitest/config';

const portalTests = ['packages/channels/*/portal/**/*.test.{ts,tsx}'];
const excludedPaths = ['**/node_modules/**', '**/.data/**', '**/.tmp/**', 'tests/**'];

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts', 'services/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts',
      'packages/channels/*/**/*.test.{ts,tsx}',
    ],
    exclude: excludedPaths,
    projects: [
      { extends: true, test: { name: 'node', exclude: portalTests } },
      {
        // Inheriting would concatenate the root include list and run Node tests a second time in jsdom.
        extends: false,
        // Portal tests use the same jsdom environment, including new channel modules without a pragma.
        test: { name: 'portal', include: portalTests, exclude: excludedPaths, environment: 'jsdom' },
        oxc: { jsx: { runtime: 'automatic' } },
      },
    ],
  },
});
