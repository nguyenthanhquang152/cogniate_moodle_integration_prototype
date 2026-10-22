// LA-E1-01 AC-LA-E1-01-04 (K0, no Docker): `npm run check` passes at the task SHA, in a fresh clone.
// The F1 part ("the F1 counts of the three changed files do not rise") waits for LA-E1-04 (spec text; RQ-3).
// QA-3 wrote this test from the spec only (test-first). See README.md in this folder.
//
// Input (environment): LA_TASK_SHA (40-hex, required), LA_RUN_DIR (new private folder outside the repository,
// required), LA_SRC_REPO (the git repository to clone from; default: the repository of this file).
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

process.umask(0o077);

const here = path.dirname(fileURLToPath(import.meta.url));
const SHA = process.env.LA_TASK_SHA ?? '';
const RUN_DIR = process.env.LA_RUN_DIR ? path.resolve(process.env.LA_RUN_DIR) : '';
const SRC = process.env.LA_SRC_REPO ?? git(here, ['rev-parse', '--show-toplevel']);

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// The child npm runs as from a plain shell: without the npm_* and INIT_CWD values that npx or npm run put into
// this process (for example npm_config_local_prefix of tests/).
function plainEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/.test(k) && k !== 'INIT_CWD'));
  return { ...env, ...extra };
}

// Async, so the Vitest worker stays responsive during the long `npm run check`.
function run(cwd: string, label: string, args: string[]): Promise<{ code: number | null; seconds: number; output: string }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const chunks: Buffer[] = [];
    const child = spawn('npm', args, { cwd, env: plainEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), 20 * 60_000);
    child.stdout.on('data', (d: Buffer) => chunks.push(d));
    child.stderr.on('data', (d: Buffer) => chunks.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8');
      fs.writeFileSync(path.join(RUN_DIR, `${label}.log`), output, { mode: 0o600, flag: 'wx' });
      resolve({ code, seconds: (Date.now() - started) / 1000, output });
    });
  });
}

function count(output: string, re: RegExp): number | null {
  const m = re.exec(output);
  return m ? Number(m[1]) : null;
}

describe('LA-E1-01 K0', () => {
  it('AC-LA-E1-01-04 (check part): npm run check passes at the task SHA in a fresh clone', async () => {
    expect(SHA, 'LA_TASK_SHA must be a 40-hex SHA').toMatch(/^[0-9a-f]{40}$/);
    expect(RUN_DIR, 'LA_RUN_DIR is required').not.toBe('');
    const top = git(here, ['rev-parse', '--show-toplevel']);
    for (const repo of [top, SRC]) {
      expect(RUN_DIR === repo || RUN_DIR.startsWith(repo + path.sep), 'LA_RUN_DIR must be outside the repository').toBe(false);
    }
    expect(!fs.existsSync(RUN_DIR) || fs.readdirSync(RUN_DIR).length === 0, 'LA_RUN_DIR must be new or empty').toBe(true);
    fs.mkdirSync(RUN_DIR, { recursive: true, mode: 0o700 });

    const clone = path.join(RUN_DIR, 'clone');
    execFileSync('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', SRC, clone], { stdio: 'pipe' });
    git(clone, ['remote', 'set-url', '--push', 'origin', 'DISABLED']);
    git(clone, ['checkout', '--quiet', '--detach', SHA]);
    expect(git(clone, ['rev-parse', 'HEAD'])).toBe(SHA);

    const ci = await run(clone, 'npm-ci', ['ci']);
    expect(ci.code, 'npm ci (see npm-ci.log)').toBe(0);
    const check = await run(clone, 'check', ['run', 'check']);

    // Counts for qa.md, next to the LA-E0-01 numbers (1,123 passed, 5 skipped, 111 infra at the intake SHA).
    const counts = {
      sha: SHA,
      checkExit: check.code,
      checkSeconds: check.seconds,
      vitestFilesPassed: count(check.output, /Test Files\s+(\d+) passed/),
      vitestPassed: count(check.output, /Tests\s+(\d+) passed/),
      vitestSkipped: count(check.output, /Tests\s+\d+ passed\s*\|\s*(\d+) skipped/) ?? 0,
      infraTests: count(check.output, /ℹ tests (\d+)/),
      infraPass: count(check.output, /ℹ pass (\d+)/),
      infraFail: count(check.output, /ℹ fail (\d+)/),
      statusAfter: git(clone, ['status', '--porcelain']),
    };
    fs.writeFileSync(path.join(RUN_DIR, 'counts.json'), `${JSON.stringify(counts, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    expect(check.code, 'npm run check (see check.log)').toBe(0);
  });

  // Pending: LA-E1-04 (F1 lands in step S2). Method when it lands: in a clone of the first SHA with F1, run the
  // check-one-text mode (`npm run fitness:lms-names -- --stdin --as <path>`, tasks README §3) on each of the three
  // files at G-BASE and at the LA-E1-01 SHA; the LA-E1-01 count must not be higher. Files:
  // services/cogniate-app/src/clients/lti-client.ts, services/cogniate-app/src/providers/index.ts,
  // services/cogniate-app/src/app/connections.ts.
  it.todo('AC-LA-E1-01-04 (F1 part): the F1 counts of the three changed files do not rise (pending: LA-E1-04)');
});
