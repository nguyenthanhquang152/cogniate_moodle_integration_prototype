import { spawn } from 'node:child_process';
const tasks = (process.env.QA_TASK ?? '').split(',').filter(Boolean);
const m1 = tasks.includes('M1') || Boolean(process.env.QA_M1_MIGRATION_STAGE);
if (m1 && tasks.some((t) => t !== 'M1')) throw new Error('M1 uses a separate ordered pass; do not mix legacy suites');
const child = spawn(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run', '--config',
  m1 ? 'acceptance/M1/vitest.config.mts' : 'acceptance/vitest.config.mts', ...process.argv.slice(2),
], { stdio: 'inherit', env: process.env });
child.on('error', (error) => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
