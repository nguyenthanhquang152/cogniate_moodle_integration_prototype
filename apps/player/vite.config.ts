// apps/player build (ADR-008): two browser entry files, no shared chunks.
//   dist/runtime.js  the runtime page script on the content origin (/_rt/assets/runtime.js)
//   dist/shell.js    the player shell script on the app origin (/_player/shell.js)
//   dist/runtime.css copied from public/
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    lib: {
      entry: { runtime: 'src/runtime/main.ts', shell: 'src/shell/main.ts' },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
