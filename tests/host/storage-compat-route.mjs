// Old-build storage compatibility route (ADR-012 revision 3.3 §12) and the rows j-migration, j-snapshot.
// QA records the §12 qualifiers for every old-build step and decides them with its own checks.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from './lib.mjs';
import { StorageBlocked, StorageFail, laneVolumeName } from './storage-docker.mjs';
import { checkCapture, privateEmptyFile } from './storage-fixture-script.mjs';
import { check, jsonLines } from './storage-oracle.mjs';

export const OLD_SHAS = ['b0b83a8289e1bf9cf349068aca184f0879e9aaf0', '9f96f7b24cd0aed702e4dc40373bdda4307aad31'];
export const MARKER = 'x-cogniate-storage-compat';
export const KNOBS = '.tmp/compose.knobs.yaml';
export const WRAPPER = '.tmp/storage-compat/storage-compat.sh';
export const OLD_OPLOCK = '.tmp/storage-compat/storage-oplock.sh';
const COPIES = { 'storage-compat.knobs.json': KNOBS, 'sqlite-lock-probe.mjs': '.tmp/storage-compat/sqlite-lock-probe.mjs',
  'storage-compat.sh': WRAPPER, 'storage-oplock.sh': OLD_OPLOCK };
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// ---------------------------------------------------------------- pure checks

/** `<64 hex>  <path>` lines of infra/compat/storage-compat.sha256, keyed by file name. */
export function parseShaFile(text) {
  const out = {};
  for (const line of String(text).split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(\S.*)$/.exec(line.trim());
    if (m) out[path.basename(m[2].trim())] = m[1];
  }
  for (const name of Object.keys(COPIES)) if (!out[name]) throw new StorageBlocked('storage-compat.sha256 does not list ' + name);
  return out;
}
/** Forbidden while the override is enabled (§12 command rule); `cmd` and `args` as the harness ran them. */
export function forbiddenCommand(cmd, args) {
  if (cmd === 'npm' && args[0] === 'run') {
    const script = args[1] ?? '';
    if (['stack:restart', 'stack:reset', 'e2e:reset', 'test:e2e', 'demo', 'demo:prepare', 'demo:users', 'demo:browser'].includes(script)) return `old npm run ${script}`;
    if (['stack:up', 'test:acceptance'].includes(script)) return `old ${script} outside storage-compat.sh run --`;
  }
  if (cmd === 'docker' && args[0] === 'compose') {
    const verbs = args.filter((a) => ['up', 'create', 'run', 'start', 'restart'].includes(a));
    const withKnobs = args.some((a, i) => a === '-f' && (args[i + 1] ?? '').endsWith(KNOBS));
    if (verbs.length && !withKnobs) return `docker compose ${verbs.join(' ')} without the knobs file`;
  }
  return null;
}
/** Normalizes a compose config: sorted keys, and each `volumes` list as a set keyed by target. */
export function normalizeConfig(config) {
  const norm = (v, key) => {
    if (Array.isArray(v)) {
      const items = v.map((x) => norm(x));
      if (key === 'volumes' && items.every((x) => x && typeof x === 'object' && 'target' in x)) {
        return Object.fromEntries(items.map((x) => [x.target, x]).sort(([a], [b]) => a.localeCompare(b)));
      }
      return items;
    }
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k], k)]));
    return v;
  };
  return norm(config);
}
/** Paths whose values differ between two normalized configs. */
export function diffPaths(a, b, prefix = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  // One volume entry (keyed by target) is compared as one unit, as §12 states the allowed items.
  const isMount = (v) => v && typeof v === 'object' && 'target' in v && 'type' in v;
  if (isMount(a) || isMount(b)) return [{ path: prefix, before: a, after: b }];
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.flatMap((k) => diffPaths(a[k], b[k], [...prefix, k]));
  }
  return [{ path: prefix, before: a, after: b }];
}
/**
 * C1 − C0 may contain only the items (a)–(e) of §12. Returns the differences that are not allowed.
 * `checkout` is the absolute clone path; `probePath` the old-build program path of the storage-preflight service.
 */
export function disallowedDifferences(c0, c1, { checkout, project }) {
  const d = diffPaths(normalizeConfig(c0), normalizeConfig(c1));
  const isBind = (v, source) => v?.type === 'bind' && v.source === source;
  const isVol = (v, source) => v?.type === 'volume' && v.source === source;
  const bad = [];
  for (const x of d) {
    const p = x.path.join('.');
    if (p === 'services.lti-service.volumes./data' && isBind(x.before, `${checkout}/infra/.data/lti-service`) && isVol(x.after, 'ltidb')) continue; // (a)
    if (p === 'services.cogniate-app.volumes./data' && isBind(x.before, `${checkout}/infra/.data/cogniate-app`) && isVol(x.after, 'appdb')) continue; // (b)
    if (p === 'services.cogniate-app.volumes./data/packages' && x.before === undefined && isBind(x.after, `${checkout}/infra/.data/cogniate-app/packages`)) continue;
    if (p === 'services.cogniate-app.volumes./data/uploads' && x.before === undefined && isBind(x.after, `${checkout}/infra/.data/cogniate-app/uploads`)) continue;
    if ((p === 'volumes.ltidb' || p === 'volumes.appdb') && x.before === undefined) {
      if (x.after?.name === laneVolumeName(project, p.split('.')[1]) || x.after?.name === undefined) continue; // (c)
    }
    if (p === 'volumes' && x.before === undefined && Object.keys(x.after ?? {}).sort().join() === 'appdb,ltidb') continue; // (c), no volumes before
    if (p === 'services.storage-preflight' && x.before === undefined && storagePreflightOk(x.after, checkout)) continue; // (d)
    if (p === MARKER && x.before === undefined) continue; // (e)
    bad.push(p);
  }
  return bad;
}
/** The storage-preflight service of §5, with the old-build program path. Only the table's fields. */
export function storagePreflightOk(svc, checkout) {
  if (!svc || typeof svc !== 'object') return false;
  const allowed = new Set(['image', 'profiles', 'user', 'network_mode', 'restart', 'entrypoint', 'environment', 'volumes', 'labels',
    'networks', 'command', 'container_name', 'pull_policy', 'deploy']);
  // Compose fills some defaults in `config` output; QA accepts only empty values for keys that the table leaves unset.
  for (const k of Object.keys(svc)) if (!allowed.has(k)) return false;
  if (svc.image !== 'node:24.22.0-alpine3.24' || svc.user !== '0:0' || svc.network_mode !== 'none' || svc.restart !== 'no') return false;
  if (JSON.stringify(svc.profiles) !== '["storage"]') return false;
  if (JSON.stringify(svc.entrypoint) !== '["node","/probe/sqlite-lock-probe.mjs"]') return false;
  if (svc.command != null && !(Array.isArray(svc.command) && svc.command.length === 0)) return false;
  if (svc.labels?.['org.cogniate.storage'] !== 'preflight') return false;
  const env = svc.environment ?? {};
  if (Object.keys(env).sort().join() !== 'HOST_GID,HOST_UID') return false;
  const vols = Object.values(svc.volumes ?? {});
  const want = [
    (v) => v.type === 'volume' && v.source === 'ltidb' && v.target === '/check/lti-service',
    (v) => v.type === 'volume' && v.source === 'appdb' && v.target === '/check/cogniate-app',
    (v) => v.type === 'bind' && v.source === `${checkout}/.tmp/storage-compat/sqlite-lock-probe.mjs` && v.target === '/probe/sqlite-lock-probe.mjs' && v.read_only === true,
    (v) => v.type === 'bind' && v.source === `${checkout}/infra/.logs` && v.target === '/logs',
  ];
  return vols.length === want.length && want.every((f) => vols.some(f));
}

/** The j-row decision: every recorded old step has every qualifier; a missing record fails the row. */
export function qualifyRow(steps, { oldSha }) {
  const problems = [];
  if (!steps.length) problems.push('no old-build step was recorded');
  for (const s of steps) {
    const need = ['oldSha', 'treeRule', 'compatHashes', 'configDiff', 'starts', 'commandLog'];
    for (const k of need) if (!(k in s)) problems.push(`${s.label}: missing ${k} record`);
    if (s.oldSha !== oldSha) problems.push(`${s.label}: old SHA ${s.oldSha}`);
    if (s.treeRule && !s.treeRule.ok) problems.push(`${s.label}: tree rule: ${s.treeRule.problem}`);
    if (s.compatHashes && !s.compatHashes.ok) problems.push(`${s.label}: compat hashes differ`);
    for (const c of s.configDiff ?? []) if (c.disallowed.length) problems.push(`${s.label}: C1 − C0 not allowed for [${c.profiles}]: ${c.disallowed.join(', ')}`);
    for (const st of s.starts ?? []) {
      if (!st.throughWrapper) problems.push(`${s.label}: ${st.command} not through storage-compat.sh run --`);
      if (!st.preflightPass) problems.push(`${s.label}: ${st.command}: no preflight pass before`);
      if (!st.statusPass) problems.push(`${s.label}: ${st.command}: no status pass after`);
      if (!st.lockHeld) problems.push(`${s.label}: ${st.command}: the operation lock was not held for the command`);
    }
    for (const f of s.commandLog?.forbidden ?? []) problems.push(`${s.label}: forbidden command ${f}`);
    if ((s.commandLog?.hostRestarts ?? 0) > 0) problems.push(`${s.label}: host-control restart ran`);
  }
  return problems;
}

// ---------------------------------------------------------------- the route (Docker and git through the runner)

export class CompatRoute {
  /** @param r the core.mjs runner; @param lane a StorageLane (for QA's own mount checks) */
  constructor(r, { testSha, lane }) {
    this.r = r; this.testSha = testSha; this.lane = lane;
    this.steps = []; this.expectedHashes = null; this.current = null;
  }
  /** Candidate tree checked out: enable the override and check the copies against the committed hash file. */
  async enable() {
    this.expectedHashes = parseShaFile(fs.readFileSync(path.join(this.r.CLONE, 'infra/compat/storage-compat.sha256'), 'utf8'));
    const res = await this.r.npm('storage-compat-enable', ['run', 'stack:storage-compat', '--', 'enable']);
    check(res.code === 0, 'stack:storage-compat -- enable');
    check(fs.readFileSync(path.join(this.r.CLONE, KNOBS), 'utf8').includes(MARKER), 'The knobs file holds the marker');
    return this.compatHashes();
  }
  compatHashes() {
    const observed = Object.fromEntries(Object.entries(COPIES).map(([name, rel]) => [name, fs.existsSync(path.join(this.r.CLONE, rel)) ? sha(path.join(this.r.CLONE, rel)) : null]));
    const ok = Object.keys(COPIES).every((name) => observed[name] === this.expectedHashes?.[name]);
    return { ok, observed, expected: this.expectedHashes };
  }
  async disable() {
    const res = await this.r.npm('storage-compat-disable', ['run', 'stack:storage-compat', '--', 'disable']);
    check(res.code === 0, 'stack:storage-compat -- disable');
    check(!fs.existsSync(path.join(this.r.CLONE, KNOBS)), 'The override is removed');
  }
  /** Starts the record of one old-build step (one checkout of an old SHA). */
  begin(label, oldSha) {
    check(OLD_SHAS.includes(oldSha), 'Only the two old SHAs of §12');
    this.current = { label, oldSha, starts: [], configDiff: [], commands: [] };
    this.steps.push(this.current);
    return this.current;
  }
  /** Logs one harness command of the old step (the forbidden-command record). */
  logCommand(cmd, args) { if (this.current) this.current.commands.push({ cmd, args, at: new Date().toISOString() }); }
  async treeRule() {
    const c = this.r.CLONE, s = this.current;
    const head = (await run('git', ['rev-parse', 'HEAD'], { cwd: c })).stdout.trim();
    const outside = await run('git', ['diff', '--quiet', s.oldSha, '--', '.', ':(exclude)tests'], { cwd: c });
    const untracked = (await run('git', ['ls-files', '--others', '--exclude-standard', '--', '.', ':(exclude)tests'], { cwd: c })).stdout.trim();
    // The working tests/ tree hash, through a temporary index (ignored files stay out, as in git).
    const index = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-tree-')), 'index');
    const env = { ...process.env, GIT_INDEX_FILE: index };
    await run('git', ['read-tree', '--empty'], { cwd: c, env });
    await run('git', ['add', '-A', '--', 'tests'], { cwd: c, env });
    const workTests = (await run('git', ['write-tree', '--prefix=tests/'], { cwd: c, env })).stdout.trim();
    const frozenTests = (await run('git', ['rev-parse', `${this.testSha}:tests`], { cwd: c })).stdout.trim();
    const productTree = (await run('git', ['rev-parse', `${s.oldSha}^{tree}`], { cwd: c })).stdout.trim();
    const problem = head !== s.oldSha ? `HEAD ${head}` : outside.code !== 0 ? 'a tracked path outside tests/ differs from the old SHA'
      : untracked ? 'untracked files outside tests/: ' + untracked.split('\n').slice(0, 5).join(', ')
        : workTests !== frozenTests ? `tests/ tree ${workTests} is not the frozen ${frozenTests}` : null;
    s.treeRule = { ok: !problem, problem, productTree, testsTree: workTests, frozenTests };
    return s.treeRule;
  }
  /**
   * C1 and C0 through the old dc() itself, with the saved stack profile environment of the old lib.sh. Site #14: the
   * `env -0` capture holds the .env values, so both capture files are private empty files in a lane private scratch,
   * checked before the shell starts and after it ends; the scratch removal is a scan point. `shell` and `docker` are
   * the command runners (a self-test replaces them).
   */
  async configDiff(profiles, { shell = (script, opts) => run('bash', ['-c', script], opts), docker = (args, opts) => run('docker', args, opts) } = {}) {
    return this.lane.withScratch('compat-config', async (scratch) => {
      const c = this.r.CLONE;
      const argsFile = path.join(scratch, 'args'), envFile = path.join(scratch, 'env');
      const ids = { [argsFile]: privateEmptyFile(argsFile, { uid: this.lane.hostUid }), [envFile]: privateEmptyFile(envFile, { uid: this.lane.hostUid }) };
      const problems = (when) => Object.entries(ids).flatMap(([file, id]) => checkCapture(file, id, when));
      const beforeShell = problems('before');
      if (beforeShell.length) throw new StorageFail('Capture files are not private: ' + beforeShell.join('; '));
      const script = 'set -e; source infra/scripts/lib.sh; if declare -F apply_profile >/dev/null && declare -F saved_profile >/dev/null; then apply_profile "$(saved_profile)"; fi; '
        + `docker() { printf '%s\\0' "$@" > "$QA_ARGS_FILE"; env -0 > "$QA_ENV_FILE"; }; dc --profile storage ${profiles.map((p) => '--profile ' + p).join(' ')} config --format json`;
      const captured = await shell(script, { cwd: c, env: { ...this.r.STACK_ENV, QA_ARGS_FILE: argsFile, QA_ENV_FILE: envFile } });
      // QA reads no captured byte unless both files are still the same private files.
      const afterShell = problems('after');
      if (afterShell.length) throw new StorageFail('Capture files changed during the shell: ' + afterShell.join('; '));
      check(captured.code === 0, 'The old dc() arguments were captured');
      const args = fs.readFileSync(argsFile, 'utf8').split('\0').filter((x, i, a) => i < a.length - 1);
      const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split('\0').filter(Boolean).map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
      const knobsAt = args.findIndex((a, i) => a === '-f' && (args[i + 1] ?? '').endsWith(KNOBS));
      check(knobsAt >= 0, 'C1 includes -f .tmp/compose.knobs.yaml');
      const c0args = [...args.slice(0, knobsAt), ...args.slice(knobsAt + 2)];
      const c1 = await docker(args, { cwd: c, env }), c0 = await docker(c0args, { cwd: c, env });
      check(c1.code === 0 && c0.code === 0, 'docker compose config for C1 and C0');
      const disallowed = disallowedDifferences(JSON.parse(c0.stdout), JSON.parse(c1.stdout), { checkout: fs.realpathSync(c), project: this.r.PROJECT });
      const record = { profiles, disallowed, c1Sha256: crypto.createHash('sha256').update(c1.stdout).digest('hex') };
      this.current.configDiff.push(record);
      return record;
    });
  }
  /**
   * One harness-invoked old start command through the copied wrapper. QA's own evidence: the preflight
   * pass line before the command, QA's mount check after it, and the lock acquire/release pair around it.
   */
  async oldStart(label, command, { env = {}, timeoutMs = 7_200_000 } = {}) {
    const lockLog = path.join(this.r.CLONE, 'infra/.logs/storage-lock.jsonl');
    const before = fs.existsSync(lockLog) ? fs.readFileSync(lockLog, 'utf8').split('\n').length : 0;
    const res = await this.r.exec(label, 'bash', [WRAPPER, 'run', '--', ...command], { env: { ...this.r.STACK_ENV, ...env }, timeoutMs });
    const lines = jsonLines(res.stdout, res.stderr);
    const pre = lines.filter((l) => l.event === 'storage_preflight_summary');
    const lockEvents = fs.existsSync(lockLog) ? jsonLines(fs.readFileSync(lockLog, 'utf8').split('\n').slice(Math.max(0, before - 1)).join('\n')) : [];
    const acquired = lockEvents.find((e) => e.event === 'storage_lock_acquired');
    const released = lockEvents.find((e) => e.event === 'storage_lock_released' && e.runId === acquired?.runId);
    const mounts = await this.mountCheck();
    const start = { label, command: command.join(' '), throughWrapper: true, exit: res.code,
      preflightPass: pre.length > 0 && pre[0].result === 'pass', statusPass: res.code === 0 && mounts.ok, mounts,
      lockHeld: Boolean(acquired && released && Date.parse(acquired.ts) <= Date.parse(released.ts)), lockRunId: acquired?.runId ?? null };
    this.current.starts.push(start);
    return { ...res, start };
  }
  /** QA's own mount check of the running old services (§12 "status"), and the knobs hash. */
  async mountCheck() {
    const p = this.r.PROJECT, out = { ok: false, problems: [] };
    const ps = await run('docker', ['ps', '-q', '--no-trunc', '--filter', `label=com.docker.compose.project=${p}`]);
    const ids = ps.stdout.split('\n').filter(Boolean);
    const info = ids.length ? JSON.parse((await run('docker', ['container', 'inspect', ...ids])).stdout) : [];
    const svc = (name) => info.find((c) => c.Config?.Labels?.['com.docker.compose.service'] === name);
    const lti = svc('lti-service'), app = svc('cogniate-app');
    const at = (c, dest) => (c?.Mounts ?? []).filter((m) => m.Destination === dest);
    if (!lti || !app) out.problems.push('both services must run');
    else {
      if (!(at(lti, '/data').length === 1 && at(lti, '/data')[0].Type === 'volume' && at(lti, '/data')[0].Name === laneVolumeName(p, 'ltidb'))) out.problems.push('lti /data is not the ltidb volume');
      if (!(at(app, '/data').length === 1 && at(app, '/data')[0].Type === 'volume' && at(app, '/data')[0].Name === laneVolumeName(p, 'appdb'))) out.problems.push('app /data is not the appdb volume');
      for (const d of ['/data/packages', '/data/uploads']) if (!(at(app, d).length === 1 && at(app, d)[0].Type === 'bind')) out.problems.push('app nested bind missing: ' + d);
    }
    const knobs = path.join(this.r.CLONE, KNOBS);
    if (!fs.existsSync(knobs) || sha(knobs) !== this.expectedHashes?.['storage-compat.knobs.json']) out.problems.push('knobs file hash changed');
    out.ok = out.problems.length === 0;
    return out;
  }
  /** Closes the step record: the forbidden-command record and the host-control restarts. */
  end({ hostRestarts = 0 } = {}) {
    const s = this.current;
    s.commandLog = { count: s.commands.length, forbidden: s.commands.map((c) => forbiddenCommand(c.cmd, c.args)).filter(Boolean), hostRestarts };
    s.compatHashes = this.compatHashes();
    this.current = null;
    return s;
  }
}
