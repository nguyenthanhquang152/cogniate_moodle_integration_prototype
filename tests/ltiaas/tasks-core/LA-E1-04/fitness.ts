// QA-3 helpers for the K0 task suites that run inside a prepared clone of the task SHA (LA-E1-02, LA-E1-03,
// LA-E1-04, LA-E1-06; see the README.md of each folder). They wrap the public fitness commands of tasks README §3:
// `npm run fitness:lms-names -- --stdin --as <path>` (F1), the F5 rule runner in the same mode, and
// `npm run fitness:channel-diff` (F2). Other task folders import these helpers; they never copy them (L11).
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

process.umask(0o077);

/** The root of the clone that holds this file (tests/ltiaas/tasks-core/<id>/ is four levels below it). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export function git(args: string[], cwd = ROOT): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * Suites that write scratch files (QA form (k)) run only in a dedicated clone: LA_SCRATCH_CLONE must name this root,
 * and the tree must be clean. So a run in a shared worktree stops before any write.
 */
export function requireScratchClone(): void {
  expect(process.env.LA_SCRATCH_CLONE && path.resolve(process.env.LA_SCRATCH_CLONE), 'LA_SCRATCH_CLONE must equal the clone root').toBe(ROOT);
  expect(git(['status', '--porcelain']), 'the clone must be clean before the probes').toBe('');
}

/** LA_RUN_DIR: a private folder outside the clone for logs and probe lists (made with mode 0700). */
export function requireRunDir(): string {
  const dir = process.env.LA_RUN_DIR ? path.resolve(process.env.LA_RUN_DIR) : '';
  expect(dir, 'LA_RUN_DIR is required').not.toBe('');
  expect(dir === ROOT || dir.startsWith(ROOT + path.sep), 'LA_RUN_DIR must be outside the clone').toBe(false);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** Saves one artifact in LA_RUN_DIR (a private folder outside the clone), if it is set. */
export function artifact(name: string, content: string): void {
  const dir = process.env.LA_RUN_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, name), content, { mode: 0o600, flag: 'wx' });
}

/** The child runs as from a plain shell: without the npm_* and INIT_CWD values that npx or npm run put into this process. */
export function plainEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/.test(k) && k !== 'INIT_CWD'));
  return { ...env, ...extra };
}

export interface RunResult { code: number | null; stdout: string; stderr: string; output: string; seconds: number }

/** Async, so the Vitest worker stays responsive during long commands such as `npm run check`. */
export function run(cmd: string, args: string[], opts: { input?: string; cwd?: string; timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const all: Buffer[] = [];
    const child = spawn(cmd, args, { cwd: opts.cwd ?? ROOT, env: plainEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs ?? 20 * 60_000);
    child.stdout.on('data', (d: Buffer) => { out.push(d); all.push(d); });
    child.stderr.on('data', (d: Buffer) => { err.push(d); all.push(d); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        output: Buffer.concat(all).toString('utf8'),
        seconds: (Date.now() - started) / 1000,
      });
    });
    child.stdin.end(opts.input ?? '');
  });
}

/** `npm run check` in the clone; the log goes to LA_RUN_DIR/<label>.log. */
export async function npmCheck(label: string): Promise<RunResult> {
  const r = await run('npm', ['run', 'check']);
  artifact(`${label}.log`, r.output);
  return r;
}

/** The npm script echo lines (`> name` or `> pkg@ver name`) of an `npm run` log, in order. */
export function scriptEchoes(output: string): string[] {
  return output.split('\n').filter((l) => /^> \S/.test(l)).map((l) => l.slice(2).trim().replace(/^\S+@\S+\s+/, ''));
}

export interface F1Hit { path: string; line: number; col: number; token: string; word: string }

/** Parses the F1 hit lines `path:line:col  "<token>"  banned "<word>"` (TEST-STRATEGY §3.2 output). */
export function f1Hits(output: string): F1Hit[] {
  const hits: F1Hit[] = [];
  for (const l of output.split('\n')) {
    const m = /^(\S+):(\d+):(\d+)\s+"(.*)"\s+banned\s+"([^"]*)"\s*$/.exec(l.trim());
    if (m) hits.push({ path: m[1], line: Number(m[2]), col: Number(m[3]), token: m[4], word: m[5].toLowerCase() });
  }
  return hits;
}

/** F1 check-one-text mode: checks `text` as if it were the file at `asPath`. */
export function f1Text(asPath: string, text: string): Promise<RunResult> {
  return run('npm', ['run', '--silent', 'fitness:lms-names', '--', '--stdin', '--as', asPath], { input: text });
}

/** F5 rule runner in check-one-text mode (tasks README §3: "the F5 rule runner in the same mode"). */
export function f5Text(asPath: string, text: string): Promise<RunResult> {
  return run('npm', ['run', '--silent', 'fitness:rules', '--', '--stdin', '--as', asPath], { input: text });
}

/** F2 add-channel gate. */
export function channelDiff(args: string[]): Promise<RunResult> {
  return run('npm', ['run', '--silent', 'fitness:channel-diff', '--', ...args]);
}

/** True when the root package.json of the clone has the script (the fitness lines come by RQ-1 from lane K). */
export function hasScript(name: string): boolean {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
  return Boolean(pkg.scripts?.[name]);
}

/** Core paths for F1 (TEST-STRATEGY §3.1, §3.2): product code outside the channel folders, F1 extensions, no unit tests. */
export function isF1Core(p: string): boolean {
  return /^(services|packages|apps)\/[^/]+\/src\//.test(p)
    && !p.startsWith('packages/channels/')
    && /\.(ts|tsx|mts|js|mjs|sql|json|css|html)$/.test(p)
    && !/\.test\.tsx?$/.test(p)
    && path.basename(p) !== 'testkit.ts';
}

/** Writes scratch files under the clone root; returns a clean-up function that removes them (QA form (k)). */
export function scratch(files: Record<string, string>): () => void {
  const made: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, { flag: 'wx' });
    made.push(abs);
  }
  return () => { for (const abs of made) fs.rmSync(abs, { force: true }); };
}

/** Removes a scratch folder and checks that the clone is clean again. */
export function removeScratchDir(rel: string): void {
  fs.rmSync(path.join(ROOT, rel), { recursive: true, force: true });
  expect(git(['status', '--porcelain']), `the clone is clean after removing ${rel}`).toBe('');
}
