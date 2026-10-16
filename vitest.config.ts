// One Vitest config. Unit tests live next to the code, in src/ of each workspace (allow-list, B-T1-01):
// git-ignored folders (**/.data, .tmp) and QA's tests/ are never scanned.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'services/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.data/**', '**/.tmp/**', 'tests/**'],
  },
});
