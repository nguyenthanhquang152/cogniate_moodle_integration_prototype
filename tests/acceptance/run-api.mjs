import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tasks = (process.env.QA_TASK ?? '').split(',').map((t) => t.trim()).filter(Boolean);
const m1 = tasks.includes('M1') || Boolean(process.env.QA_M1_MIGRATION_STAGE);
if (m1 && tasks.some((t) => t !== 'M1')) throw new Error('M1 uses a separate ordered pass; do not mix legacy suites');
const k1 = tasks.includes('K1') || tasks.includes('LA-E7-06');
const la = !k1 && tasks.find((t) => /^LA-E\d+-\d+$/.test(t));
if ((k1 || la) && tasks.length !== 1) throw new Error('LA task uses a separate Vitest config; do not mix suites');
let config = k1 ? 'ltiaas/kit/vitest.config.mts' : m1 ? 'acceptance/M1/vitest.config.mts' : 'acceptance/vitest.config.mts';
if (la) {
  const ltiaasDir = path.join(testsDir, 'ltiaas');
  const matches = fs.existsSync(ltiaasDir)
    ? fs.readdirSync(ltiaasDir).filter((d) => d.startsWith('tasks-') && fs.existsSync(path.join(ltiaasDir, d, la, 'vitest.config.mts')))
    : [];
  if (matches.length !== 1) throw new Error(`Expected one tests/ltiaas/tasks-*/${la}/vitest.config.mts (found ${matches.length})`);
  config = path.posix.join('ltiaas', matches[0], la, 'vitest.config.mts');
}
const child = spawn(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', '--config',
  config, ...process.argv.slice(2),
], { stdio: 'inherit', env: process.env });
child.on('error', (error) => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
