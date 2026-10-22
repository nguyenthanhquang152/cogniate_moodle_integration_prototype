// LA-E7-10 K0 acceptance tests: the local CI script `npm run ci:local` (no Docker).
// Source: docs/architecture/ltiaas/tasks/LA-E7-10.md (AC-LA-E7-10-01 to -05) and the design README §4a.
// QA-3 wrote these tests from the spec and the design only (test-first). See README.md in this folder.
//
// Input (environment):
//   LA_TASK_SHA  the 40-hex SHA to verify (required)
//   LA_RUN_DIR   a new private folder outside the repository (required; made with mode 0700)
//   LA_SRC_REPO  the git repository to clone from (default: the repository of this file)
//
// The suite makes two fresh clones of LA_TASK_SHA in LA_RUN_DIR:
//   clone-a: one full run (AC-01, AC-04, AC-05), then one run with a planted key (AC-02);
//   clone-b: one run with the npm registry unreachable (AC-03).
// The runs of clone-a read the npm registry (steps 1 and 3). The planted key is random and lives only in memory
// and in clone-a for the AC-02 run; the clean-up removes it.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.umask(0o077);

const here = path.dirname(fileURLToPath(import.meta.url));
const SHA = process.env.LA_TASK_SHA ?? '';
const RUN_DIR = process.env.LA_RUN_DIR ? path.resolve(process.env.LA_RUN_DIR) : '';
const SRC = process.env.LA_SRC_REPO ?? git(here, ['rev-parse', '--show-toplevel']);
const RUN_TIMEOUT_MS = 20 * 60_000;

type Result = 'pass' | 'fail' | 'network_unavailable';
interface StepLine { n: number; result: Result; line: string; index: number }
interface Run { label: string; code: number | null; signal: string | null; seconds: number; output: string; steps: StepLine[] }

// Step lines. The design fixes the content (name, result, seconds), not the layout, so the parser accepts common
// layouts. A line is a step line when it has a step name (or "step <n>" / "[n/5]"), a result word and a number of
// seconds. Name priority 5 > 4 > 3 > 2 > 1, so "secret check" is step 5 and "vulnerability check" is step 3.
const STEP_NAMES: Array<[number, RegExp]> = [
  [5, /\bsecrets?\b|\bsecret[-_ ]?scan\b/i],
  [4, /\bsbom\b/i],
  [3, /\baudit\b|\bvulnerabilit(?:y|ies)\b|\bvuln\b/i],
  [2, /\bcheck\b/i],
  [1, /\binstall\b|\bnpm[-_ ]ci\b|\bdeps\b|\bdependencies\b/i],
];
const STEP_NUMBER = [/\bstep\s*[=:#]?\s*([1-5])\b/i, /\[([1-5])\s*\/\s*5\]/];
const RESULT = /\b(passed|pass|ok|failed|fail|error|network_unavailable)\b/i;
const SECONDS = /\b\d+(?:\.\d+)?\s?(?:s|secs?|seconds)\b|\b(?:seconds|secs?|duration|elapsed|time)\s*[=:]\s*\d+(?:\.\d+)?\b/i;
const ADVISORY = /\bGHSA(?:-[0-9a-z]{4}){3}\b|\bCVE-\d{4}-\d{4,}\b/i;

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// The child npm runs as from a plain shell: without the npm_* and INIT_CWD values that npx or npm run put into
// this process (for example npm_config_local_prefix of tests/).
function plainEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/.test(k) && k !== 'INIT_CWD'));
  return { ...env, ...extra };
}

function parseSteps(output: string): StepLine[] {
  const steps: StepLine[] = [];
  output.split('\n').forEach((line, index) => {
    const word = RESULT.exec(line);
    if (!word || !SECONDS.test(line)) return;
    let n = 0;
    for (const re of STEP_NUMBER) {
      const m = re.exec(line);
      if (m) { n = Number(m[1]); break; }
    }
    if (!n) n = STEP_NAMES.find(([, re]) => re.test(line))?.[0] ?? 0;
    if (!n) return;
    const w = word[1].toLowerCase();
    const result: Result = w === 'network_unavailable' ? w : ['pass', 'passed', 'ok'].includes(w) ? 'pass' : 'fail';
    steps.push({ n, result, line, index });
  });
  return steps;
}

function oneLine(run: Run, n: number): StepLine {
  const lines = run.steps.filter((s) => s.n === n);
  expect(lines.length, `${run.label}: one output line for step ${n} (see ${run.label}.log); found:\n${lines.map((s) => s.line).join('\n')}`).toBe(1);
  return lines[0];
}

function cloneAt(name: string): string {
  const dir = path.join(RUN_DIR, name);
  execFileSync('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', SRC, dir], { stdio: 'pipe' });
  git(dir, ['remote', 'set-url', '--push', 'origin', 'DISABLED']);
  git(dir, ['checkout', '--quiet', '--detach', SHA]);
  expect(git(dir, ['rev-parse', 'HEAD'])).toBe(SHA);
  expect(git(dir, ['status', '--porcelain']), `${name} is not clean`).toBe('');
  return dir;
}

function runCiLocal(cwd: string, label: string, env: Record<string, string> = {}): Promise<Run> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const chunks: Buffer[] = [];
    const child = spawn('npm', ['run', 'ci:local'], { cwd, env: plainEnv(env), stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), RUN_TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => chunks.push(d));
    child.stderr.on('data', (d: Buffer) => chunks.push(d));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8');
      fs.writeFileSync(path.join(RUN_DIR, `${label}.log`), output, { mode: 0o600, flag: 'wx' });
      resolve({ label, code, signal, seconds: (Date.now() - started) / 1000, output, steps: parseSteps(output) });
    });
  });
}

function closedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** No 12-character part of the planted value may appear: not the whole key, not a cut or wrapped part. */
function expectNoValue(text: string, key: string, where: string): void {
  const secret = key.slice('ltis_'.length);
  for (let i = 0; i + 12 <= secret.length; i += 1) {
    expect(text.includes(secret.slice(i, i + 12)), `${where} prints a part of the planted value`).toBe(false);
  }
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .map((f) => path.join(dir, f))
    .filter((f) => !f.includes(`${path.sep}node_modules${path.sep}`) && fs.lstatSync(f).isFile() && fs.lstatSync(f).size < 50_000_000);
}

interface AllowEntry { text: string; file: string; reason: string }

/** The reviewed allow list inside the script: a bash array or a heredoc whose opening line names "allow". */
function parseAllowList(script: string, tracked: Set<string>): AllowEntry[] | null {
  const lines = script.split('\n');
  const start = lines.findIndex((l) => !/^\s*#/.test(l) && /allow/i.test(l) && (/=\(/.test(l) || /<<-?\s*['"]?\w+/.test(l)));
  if (start < 0) return null;
  const heredoc = /<<-?\s*['"]?(\w+)['"]?/.exec(lines[start]);
  let body: string[];
  if (heredoc) {
    const end = lines.findIndex((l, i) => i > start && l.trim() === heredoc[1]);
    if (end < 0) return null;
    body = lines.slice(start + 1, end);
  } else {
    const rest = lines[start].slice(lines[start].indexOf('=(') + 2);
    if (/\)\s*(#.*)?$/.test(rest)) {
      body = (rest.replace(/\)\s*(#.*)?$/, '').match(/"[^"]*"|'[^']*'/g) ?? []);
    } else {
      const end = lines.findIndex((l, i) => i > start && /^\s*\)\s*(#.*)?$/.test(l));
      if (end < 0) return null;
      body = [rest, ...lines.slice(start + 1, end)];
    }
  }
  const words = (s: string): number => (s.match(/[A-Za-z]{2,}/g) ?? []).length;
  const entries: AllowEntry[] = [];
  let comment = '';
  for (const raw of body) {
    const line = raw.trim();
    if (!line) { comment = ''; continue; }
    if (line.startsWith('#')) { comment = `${comment} ${line.replace(/^#+\s*/, '')}`.trim(); continue; }
    const file = line.split(/[\s"'|,;=]+|:(?!\/)/).find((t) => tracked.has(t)) ?? '';
    const inline = /\s#\s?(.*)$/.exec(line)?.[1] ?? '';
    const fields = line.replace(/["']/g, '').split(/\s*\|\s*|\t+/).map((f) => f.trim()).filter(Boolean);
    const reason = words(inline) >= 2 ? inline
      : fields.length >= 3 && words(fields[fields.length - 1]) >= 2 ? fields[fields.length - 1]
        : words(comment) >= 2 ? comment : '';
    entries.push({ text: line, file, reason });
    comment = '';
  }
  return entries;
}

const runs: { a1?: Run; a2?: Run; b?: Run } = {};
let cloneA = '';

beforeAll(async () => {
  expect(SHA, 'LA_TASK_SHA must be a 40-hex SHA').toMatch(/^[0-9a-f]{40}$/);
  expect(RUN_DIR, 'LA_RUN_DIR is required').not.toBe('');
  const top = git(here, ['rev-parse', '--show-toplevel']);
  for (const repo of [top, SRC]) {
    expect(RUN_DIR === repo || RUN_DIR.startsWith(repo + path.sep), 'LA_RUN_DIR must be outside the repository').toBe(false);
  }
  expect(!fs.existsSync(RUN_DIR) || fs.readdirSync(RUN_DIR).length === 0, 'LA_RUN_DIR must be new or empty').toBe(true);
  fs.mkdirSync(RUN_DIR, { recursive: true, mode: 0o700 });
  git(SRC, ['cat-file', '-e', `${SHA}^{commit}`]);
  cloneA = cloneAt('clone-a');
  runs.a1 = await runCiLocal(cloneA, 'run-a1-clean');
});

afterAll(() => {
  if (!RUN_DIR || !cloneA) return;
  const summary = {
    sha: SHA,
    node: process.version,
    npm: execFileSync('npm', ['--version'], { encoding: 'utf8', env: plainEnv() }).trim(),
    runs: Object.values(runs).map((r) => r && { label: r.label, code: r.code, signal: r.signal, seconds: r.seconds, steps: r.steps }),
  };
  fs.writeFileSync(path.join(RUN_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
});

describe('LA-E7-10 local CI script (K0)', () => {
  it('AC-LA-E7-10-01: on a clean clone, steps 1, 2, 4 and 5 pass; step 3 passes or names its advisory ids', () => {
    const a1 = runs.a1!;
    expect(a1.output, 'npm run ci:local has no script line (root package.json, lane K by RQ-1)').not.toMatch(/Missing script/i);
    for (const n of [1, 2, 4, 5]) expect(oneLine(a1, n).result, `step ${n}: ${oneLine(a1, n).line}`).toBe('pass');
    const s3 = oneLine(a1, 3);
    if (s3.result !== 'pass') expect(s3.line, 'a failed step 3 names the advisory ids in its line').toMatch(ADVISORY);
    // Step 1 installed both projects; step 4 wrote a CycloneDX SBOM.
    expect(fs.existsSync(path.join(cloneA, 'node_modules')), 'root node_modules').toBe(true);
    expect(fs.existsSync(path.join(cloneA, 'tests', 'node_modules')), 'tests/node_modules').toBe(true);
    const sbom = JSON.parse(fs.readFileSync(path.join(cloneA, '.tmp', 'ci', 'sbom.cdx.json'), 'utf8')) as { bomFormat?: string; components?: unknown[] };
    expect(sbom.bomFormat).toBe('CycloneDX');
    expect(Array.isArray(sbom.components) && sbom.components.length > 0, 'the SBOM lists components').toBe(true);
  });

  it('AC-LA-E7-10-05: the clean tree passes step 5 with the allow list; each entry names a file and a reason', () => {
    expect(oneLine(runs.a1!, 5).result).toBe('pass');
    const script = fs.readFileSync(path.join(cloneA, 'infra', 'scripts', 'ci-local.sh'), 'utf8');
    const tracked = new Set(git(cloneA, ['ls-files']).split('\n'));
    const entries = parseAllowList(script, tracked);
    fs.writeFileSync(path.join(RUN_DIR, 'ac05-allow-list.json'), `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    expect(entries, 'no allow-list block (a bash array or heredoc named "allow") in infra/scripts/ci-local.sh').not.toBeNull();
    expect(entries!.length, 'the allow list has entries (design: the private-key pattern of 99-logs.test.ts)').toBeGreaterThan(0);
    for (const e of entries!) {
      expect(e.file, `allow-list entry names no tracked file: ${e.text}`).not.toBe('');
      expect(e.reason, `allow-list entry has no reason: ${e.text}`).not.toBe('');
    }
  });

  it('AC-LA-E7-10-02: a planted ltis_ key in a temporary tracked copy fails step 5 with exit 1; the output names file and line, never the value', async () => {
    const key = `ltis_${randomBytes(32).toString('base64url')}`;
    expect(key).toMatch(/^ltis_[A-Za-z0-9_-]{43}$/);
    const rel = `qa-e710-plant-${Date.now()}.txt`;
    const lineNo = 7;
    const copy = fs.readFileSync(path.join(cloneA, '.gitignore'), 'utf8').split('\n');
    copy.splice(lineNo - 1, 0, `QA negative control, not a real key: ${key}`);
    fs.writeFileSync(path.join(cloneA, rel), copy.join('\n'), { mode: 0o600, flag: 'wx' });
    git(cloneA, ['add', '--', rel]);
    try {
      const a2 = await runCiLocal(cloneA, 'run-a2-planted');
      runs.a2 = a2;
      expect(a2.code, 'exit code with a planted key').toBe(1);
      expect(oneLine(a2, 5).result).toBe('fail');
      const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const named = a2.output.split('\n').some((l) => new RegExp(`${esc}:${lineNo}\\b`).test(l)
        || (l.includes(rel) && new RegExp(`\\bline\\D{0,3}${lineNo}\\b`, 'i').test(l)));
      expect(named, `the output names ${rel} and line ${lineNo} (see run-a2-planted.log)`).toBe(true);
      expectNoValue(a2.output, key, 'the script output');
      for (const f of filesUnder(path.join(cloneA, '.tmp'))) expectNoValue(fs.readFileSync(f, 'latin1'), key, f);
    } finally {
      git(cloneA, ['rm', '--cached', '--quiet', '--', rel]);
      fs.rmSync(path.join(cloneA, rel), { force: true });
    }
    expect(git(cloneA, ['status', '--porcelain']), 'clone-a is clean after the clean-up').toBe('');
  });

  it('AC-LA-E7-10-03: with the npm registry unreachable, the script prints network_unavailable and exits 2', async () => {
    const cloneB = cloneAt('clone-b');
    const dead = `http://127.0.0.1:${await closedPort()}`;
    const cache = path.join(RUN_DIR, 'npm-cache-empty');
    fs.mkdirSync(cache, { mode: 0o700 });
    // The configured registry and every proxy point to a closed local port; an empty npm cache makes npm fetch.
    const b = await runCiLocal(cloneB, 'run-b-registry-unreachable', {
      npm_config_registry: `${dead}/`,
      npm_config_cache: cache,
      npm_config_offline: 'false',
      npm_config_prefer_offline: 'false',
      npm_config_fetch_retries: '0',
      npm_config_update_notifier: 'false',
      HTTP_PROXY: dead, HTTPS_PROXY: dead, http_proxy: dead, https_proxy: dead, ALL_PROXY: dead, all_proxy: dead,
      NO_PROXY: '', no_proxy: '', NODE_USE_ENV_PROXY: '1',
    });
    runs.b = b;
    expect(b.code, 'exit code with the registry unreachable').toBe(2);
    expect(b.output).toMatch(/\bnetwork_unavailable\b/);
    const passes = b.steps.filter((s) => (s.n === 1 || s.n === 3) && s.result === 'pass');
    expect(passes.map((s) => s.line), 'a network step reports a pass').toEqual([]);
  });

  it('AC-LA-E7-10-04: one output line per step with name, result and seconds; exit 0 only when every step passes', () => {
    for (const run of [runs.a1, runs.a2]) {
      expect(run, 'the AC-01 and AC-02 runs exist').toBeDefined();
      const lines = [1, 2, 3, 4, 5].map((n) => oneLine(run!, n));
      for (const s of lines) {
        const name = STEP_NAMES.find(([n]) => n === s.n)![1];
        expect(s.line, `${run!.label}: step ${s.n} line has the step name`).toMatch(name);
        expect(s.line, `${run!.label}: step ${s.n} line has the seconds`).toMatch(SECONDS);
      }
      const order = lines.map((s) => s.index);
      expect(order, `${run!.label}: the step lines are in step order`).toEqual([...order].sort((x, y) => x - y));
      const allPass = lines.every((s) => s.result === 'pass');
      expect(run!.code === 0, `${run!.label}: exit ${run!.code}, every step passes = ${allPass}`).toBe(allPass);
    }
    expect(runs.b?.code, 'the registry-unreachable run does not exit 0').not.toBe(0);
  });
});
