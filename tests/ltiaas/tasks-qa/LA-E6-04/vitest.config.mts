// Vitest config for LA-E6-04 (QA-3: Channel capability flags for connection check).
// Host-only K0 suite (0 Docker).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: here,
    include: ['*.k0.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    retry: 0,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    ...(process.env.QA_GREP ? { testNamePattern: process.env.QA_GREP } : {}),
  },
});
