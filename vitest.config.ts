// One Vitest config. Each workspace folder is one project. Run: npm run test:unit
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'services/*', 'apps/*'],
    // QA owns tests/ (Playwright). Unit tests live next to the code.
    exclude: ['**/node_modules/**', 'tests/**'],
  },
});
