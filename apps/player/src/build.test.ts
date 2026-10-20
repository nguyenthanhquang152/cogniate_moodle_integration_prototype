import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { createBuilder } from 'vite';

it('builds self-contained shell and runtime scripts for their separate asset routes', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'cogniate-player-build-'));
  const chunks: Array<{ fileName: string; imports: string[]; dynamicImports: string[] }> = [];
  try {
    const builder = await createBuilder({
      root: fileURLToPath(new URL('../', import.meta.url)),
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
      plugins: [{
        name: 'capture-player-artifacts',
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (output.type === 'chunk') chunks.push({
              fileName: output.fileName, imports: output.imports, dynamicImports: output.dynamicImports,
            });
          }
        },
      }],
    });
    await builder.buildApp();
    expect(chunks.sort((a, b) => a.fileName.localeCompare(b.fileName))).toEqual([
      { fileName: 'runtime.js', imports: [], dynamicImports: [] },
      { fileName: 'shell.js', imports: [], dynamicImports: [] },
    ]);
    expect((await readdir(outDir)).sort()).toEqual(['runtime.css', 'runtime.js', 'shell.js']);
    for (const file of ['runtime.js', 'shell.js', 'runtime.css']) {
      expect((await readFile(join(outDir, file), 'utf8')).length).toBeGreaterThan(0);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
