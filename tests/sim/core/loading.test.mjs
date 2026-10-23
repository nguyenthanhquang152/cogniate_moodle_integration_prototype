import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('HARNESS ONLY: missing Canvas is a startup error, never an implicit Blackboard-only pass', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-module-gate-'));
  const source = fileURLToPath(new URL('..', import.meta.url));
  try {
    fs.cpSync(source, scratch, { recursive: true,
      filter: (file) => !path.relative(source, file).split(path.sep).includes('canvas') });
    const { createRuntime } = await import(pathToFileURL(path.join(scratch, 'core/runtime.mjs')));
    const { loadProviders } = await import(pathToFileURL(path.join(scratch, 'server.mjs')));
    const runtime = () => createRuntime({ publicLtiUrl: 'https://tool.test',
      fetchJwks: async () => { throw new Error('Module discovery cannot fetch keys'); } });
    assert.equal((await loadProviders(runtime(), ['blackboard'])).length, 1);
    await assert.rejects(loadProviders(runtime()), /Required canvas simulator is unavailable/);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
