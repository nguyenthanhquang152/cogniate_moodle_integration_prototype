// K0 contract suite Vitest configuration (no Docker).
// Called from the repo root by `npm run check`:
//   vitest run --config tests/ltiaas/k0/vitest.config.mts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    include: ['tests/ltiaas/k0/**/*.test.ts'],
    fileParallelism: false,
    passWithNoTests: false,
    retry: 0,
  },
});
