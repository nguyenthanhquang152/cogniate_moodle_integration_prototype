#!/usr/bin/env bash
# The operation lock of ADR-012 §7: one lock per checkout and compose project, in .tmp/ of the checkout.
#   bash storage-oplock.sh run -- <command …>     hold the lock for the whole command (QA fixture writes; old-build copy)
#   bash storage-oplock.sh selftest                the host self-check (no Docker), scratch .tmp/storage-op-selftest-<id>/
# As a library (candidate guarded scripts):
#   source storage-oplock.sh; storage_lock_acquire <command name>     A1–A6, then COGNIATE_STORAGE_LOCK_RUN is exported
#   storage_lock_add_container <name>                                 before each storage container is created
#   storage_lock_release                                              also from the EXIT/INT/TERM trap
# Self-contained on purpose: storage-compat copies this file to .tmp/storage-compat/ for the old builds (§12).
# Every folder rename and every record write is done by node (fs.renameSync, fsync), never by shell mv; every ps call
# runs with LC_ALL=C. The record is live when its owner (pid, pidStart) is live, or when any other process has its pgid.

_storage_oplock_js() {
  node --input-type=module - "$@" <<'JS'
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [cmd, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const C = { ...process.env, LC_ALL: 'C' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HEX16 = /^[0-9a-f]{16}$/;

function psLstart(pid) {
  try { return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { env: C, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}
function psPgid(pid) {
  try { return Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)], { env: C, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { return null; }
}
/** One read of `LC_ALL=C ps -A -o pid= -o pgid=`, matched here. */
function groupMembers(pgid) {
  const out = execFileSync('ps', ['-A', '-o', 'pid=', '-o', 'pgid='], { env: C, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return out.split('\n').map((l) => l.trim().split(/\s+/).map(Number)).filter(([p, g]) => Number.isInteger(p) && g === pgid && p !== process.pid).map(([p]) => p);
}
const ownerLive = (rec) => rec.pidStart !== '' && psLstart(rec.pid) === rec.pidStart;
const recordLive = (rec) => ownerLive(rec) || groupMembers(rec.pgid).length > 0;

function writeRecord(dir, rec) {
  const tmp = path.join(dir, 'owner.json.tmp');
  const fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeSync(fd, `${JSON.stringify(rec, null, 2)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, path.join(dir, 'owner.json'));
  const d = fs.openSync(dir, 'r'); try { fs.fsyncSync(d); } finally { fs.closeSync(d); }
}
function readRecord(dir) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8'));
    const ok = r && r.formatVersion === 1 && typeof r.project === 'string' && HEX16.test(r.runId) && Number.isInteger(r.pid)
      && typeof r.pidStart === 'string' && Number.isInteger(r.pgid) && typeof r.acquiredAt === 'string' && Array.isArray(r.containers);
    return ok ? r : null;
  } catch { return null; }
}

function paths(repo, project) {
  const tmp = path.join(repo, '.tmp');
  const base = path.join(tmp, `storage-op.${project}`);
  return { tmp, lock: `${base}.lock`, cand: (id) => `${base}.cand-${id}`, stale: (id) => `${base}.stale-${id}`, rel: (id) => `${base}.rel-${id}`, prefix: `storage-op.${project}.` };
}

function eventLine(ctx, event, extra = {}) {
  const line = { event, ts: new Date().toISOString(), project: ctx.project, command: ctx.command ?? null, runId: ctx.runId ?? null,
    pid: ctx.pid ?? null, pidStart: ctx.pidStart ?? null, pgid: ctx.pgid ?? null, owner: null, reason: null, waitedMs: 0, container: null, ...extra };
  const text = `${JSON.stringify(line)}\n`;
  process.stdout.write(text);
  if (ctx.logDir) {
    try { fs.mkdirSync(ctx.logDir, { recursive: true, mode: 0o700 }); fs.appendFileSync(path.join(ctx.logDir, 'storage-lock.jsonl'), text); } catch { /* stdout stays the evidence */ }
  }
  return line;
}
const ownerView = (k) => (k ? { runId: k.runId, command: k.command, pid: k.pid, pidStart: k.pidStart, pgid: k.pgid, acquiredAt: k.acquiredAt } : null);

/** The storage containers of the project (label com.docker.compose.project=P and the label org.cogniate.storage). */
/** A failed child process, tagged with the step that ran it (the top-level message names the step, never its output). */
const tagged = (step, fn, extra = {}) => { try { return fn(); } catch (err) { throw Object.assign(err, { step, ...extra }); } };
function storageContainers(project) {
  const out = tagged('list', () => execFileSync('docker', ['ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '--filter', 'label=org.cogniate.storage',
    '--format', '{{.ID}}\t{{.Names}}\t{{.State}}\t{{.Label "org.cogniate.storage.run"}}'], { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'] }));
  return out.split('\n').filter(Boolean).map((l) => { const [id, name, state, runLabel] = l.split('\t'); return { id, name, state, runLabel }; });
}
const ACTIVE = new Set(['running', 'paused', 'restarting', 'removing']);

class Refusal extends Error { constructor(reason, message) { super(message); this.reason = reason; } }

/** A1–A6. `lister` lists storage containers (null: none, the self-check); `waitMs` bounds A4. */
async function acquire(ctx, { lister = storageContainers, removeContainer = (id) => execFileSync('docker', ['rm', id], { stdio: 'ignore', timeout: 30_000 }), waitMs = 120_000 } = {}) {
  ctx.reclaimed = null;
  ctx.removed = [];
  const p = paths(ctx.repo, ctx.project);
  fs.mkdirSync(p.tmp, { recursive: true });
  const rec = { formatVersion: 1, project: ctx.project, checkout: path.resolve(ctx.repo), command: ctx.command, runId: ctx.runId, pid: ctx.pid,
    pidStart: ctx.pidStart, pgid: ctx.pgid, acquiredAt: '', containers: [] };
  // A1: the candidate record.
  fs.mkdirSync(p.cand(ctx.runId));
  rec.acquiredAt = new Date().toISOString();
  writeRecord(p.cand(ctx.runId), rec);
  const started = Date.now();
  let waitLogged = false;
  try {
    for (;;) {
      // A2
      try {
        fs.renameSync(p.cand(ctx.runId), p.lock);
        break;
      } catch (err) {
        if (!['EEXIST', 'ENOTEMPTY', 'EISDIR'].includes(err.code)) throw err;
      }
      // A3: the lock record (a lock folder without a valid record for 10 s → invalid).
      let k = readRecord(p.lock);
      for (let t = 0; !k && t < 20 && fs.existsSync(p.lock); t++) { await sleep(500); k = readRecord(p.lock); }
      if (!fs.existsSync(p.lock)) continue;
      if (!k) throw new Refusal('operation_lock_invalid', `The lock folder ${p.lock} has no valid record. Follow the manual exit of the operator guide (only when no storage command of this checkout runs).`);
      // A4
      if (process.env.COGNIATE_STORAGE_LOCK_RUN === k.runId) throw Object.assign(new Refusal('operation_lock_reentry', `This command already runs inside the storage lock ${k.runId}; a guarded command must not be nested.`), { owner: k });
      if (recordLive(k)) {
        if (Date.now() - started >= waitMs) {
          const members = groupMembers(k.pgid);
          throw Object.assign(new Refusal('operation_in_progress', `Another storage command holds the lock: ${k.command} (run ${k.runId}, pid ${k.pid}, since ${k.acquiredAt}). ${ownerLive(k) ? '' : `Its owner has ended, but process group ${k.pgid} still has: ${members.join(', ')}. Wait for them, or end them.`}`), { owner: k });
        }
        if (!waitLogged) { eventLine(ctx, 'storage_lock_wait', { owner: ownerView(k) }); waitLogged = true; }
        await sleep(1000);
        continue;
      }
      // A5: a stale record.
      const active = (lister ? lister(ctx.project) : []).filter((c) => ACTIVE.has(c.state));
      if (active.length) throw Object.assign(new Refusal('storage_writer_active', `A storage container of ${ctx.project} still runs: ${active[0].name} (${active[0].id}, ${active[0].state}, run ${active[0].runLabel}). Wait until it ends, or stop it with docker stop ${active[0].name}.`), { container: active[0] });
      const again = readRecord(p.lock);
      if (!again || again.runId !== k.runId) continue;
      try {
        fs.renameSync(p.lock, p.stale(k.runId));
        ctx.reclaimed = k.runId;
        eventLine(ctx, 'storage_lock_reclaimed', { owner: ownerView(k), waitedMs: Date.now() - started });
      } catch { /* another command moved it first */ }
    }
  } catch (err) {
    fs.rmSync(p.cand(ctx.runId), { recursive: true, force: true });
    throw err;
  }
  // A6: this command holds the lock.
  eventLine(ctx, 'storage_lock_acquired', { waitedMs: Date.now() - started });
  try {
    for (const c of lister ? lister(ctx.project) : []) {
      if (ACTIVE.has(c.state)) throw Object.assign(new Refusal('storage_writer_active', `A storage container of ${ctx.project} still runs: ${c.name} (${c.id}, ${c.state}, run ${c.runLabel}). Wait until it ends, or stop it with docker stop ${c.name}.`), { container: c });
      tagged('remove', () => removeContainer(c.id), { container: c });
      ctx.removed.push(c);
      eventLine(ctx, 'storage_container_removed', { container: c });
    }
  } catch (err) {
    release(ctx, { quiet: true });
    throw err;
  }
  try {
    for (const name of fs.readdirSync(p.tmp)) {
      if (!name.startsWith(p.prefix) || !/\.(cand|rel)-[0-9a-f]{16}$/.test(name) || name === path.basename(p.cand(ctx.runId))) continue;
      const r = readRecord(path.join(p.tmp, name));
      if (r && recordLive(r)) continue;
      fs.rmSync(path.join(p.tmp, name), { recursive: true, force: true });
      eventLine(ctx, 'storage_lock_cleanup', { owner: ownerView(r) });
    }
  } catch (err) {
    release(ctx, { quiet: true }); // a failure here (for example `ps`) never leaves this command's lock behind
    throw err;
  }
  return rec;
}

/** Release steps 1–3: only our own lock is moved (rel-<runId>), then deleted. */
function release(ctx, { quiet = false } = {}) {
  const p = paths(ctx.repo, ctx.project);
  const k = readRecord(p.lock);
  if (!k || k.runId !== ctx.runId) {
    eventLine(ctx, 'storage_lock_lost', { owner: ownerView(k) });
    return false;
  }
  fs.renameSync(p.lock, p.rel(ctx.runId));
  fs.rmSync(p.rel(ctx.runId), { recursive: true, force: true });
  if (!quiet) eventLine(ctx, 'storage_lock_released');
  return true;
}

function addContainer(ctx, name) {
  const p = paths(ctx.repo, ctx.project);
  const k = readRecord(p.lock);
  if (!k || k.runId !== ctx.runId) throw new Refusal('storage_lock_lost', 'The storage lock is not held by this command.');
  k.containers = [...k.containers, name];
  writeRecord(p.lock, k);
}

function ctxOf(o) {
  const pid = Number(o.pid);
  if (!o.repo || !o.project || !HEX16.test(o['run-id'] ?? '') || !Number.isInteger(pid)) throw new Refusal('usage', 'usage: acquire|release|add-container --repo <checkout> --project <name> --run-id <16 hex> --pid <pid> [--command <text>] [--name <container>]');
  return { repo: o.repo, project: o.project, command: o.command ?? null, runId: o['run-id'], pid, pidStart: psLstart(pid), pgid: psPgid(pid),
    logDir: o['log-dir'] ?? path.join(o.repo, 'infra', '.logs') };
}

// ------------------------------------------------------------------------------------------------ self-check
async function selftest(repo) {
  const id = randomBytes(8).toString('hex');
  const scratch = path.join(repo, '.tmp', `storage-op-selftest-${id}`);
  const project = `selftest-${id}`;
  const scratchTmp = path.join(scratch, '.tmp');
  fs.mkdirSync(scratchTmp, { recursive: true });
  const clear = () => { for (const n of fs.readdirSync(scratchTmp)) fs.rmSync(path.join(scratchTmp, n), { recursive: true, force: true }); };
  const lines = [];
  const say = (scenario, expected, observed) => {
    const line = { event: 'storage_lock_selftest', ts: new Date().toISOString(), runId: id, scenario, expected, observed, ok: expected === observed, psCommand: 'LC_ALL=C ps -A -o pid= -o pgid=' };
    lines.push(line);
    process.stdout.write(`${JSON.stringify(line)}\n`);
  };
  const quietCtx = (extra) => ({ repo: scratch, project, logDir: null, ...extra });
  const stub = (script) => {
    const child = spawn('bash', ['-c', script], { detached: true, stdio: 'ignore' });
    return child;
  };
  const self = { pid: process.pid, pidStart: psLstart(process.pid), pgid: psPgid(process.pid) };
  // Each scenario has its own 30 s bound; an error in a scenario is a not-ok line, never a crash of the whole check.
  const bound = async (ms, fn, scenario) => {
    let t;
    try {
      const r = await Promise.race([fn(), new Promise((res) => { t = setTimeout(() => res('timeout'), ms); })]);
      if (r === 'timeout') say(scenario, 'within 30 s', 'timeout');
    } catch (err) {
      say(scenario, 'no error', `error: ${err?.code ?? err?.message ?? err}`);
    } finally {
      clearTimeout(t);
      try { clear(); } catch { /* the scratch folder is removed at the end */ }
    }
  };
  const outcome = async (fn) => { try { await fn(); return 'acquired'; } catch (err) { return err.reason ?? 'error'; } };
  const silence = () => { const w = process.stdout.write.bind(process.stdout); process.stdout.write = () => true; return () => { process.stdout.write = w; }; };
  try {
    // rename-held: a candidate rename onto a held lock fails; a second takeover onto an existing stale-<id> fails.
    await bound(30_000, async () => {
      const p = paths(scratch, project);
      fs.mkdirSync(p.lock); writeRecord(p.lock, { formatVersion: 1, project, checkout: scratch, command: 'held', runId: '0'.repeat(16), pid: process.pid, pidStart: self.pidStart, pgid: self.pgid, acquiredAt: 'x', containers: [] });
      fs.mkdirSync(p.cand('1'.repeat(16))); writeRecord(p.cand('1'.repeat(16)), { formatVersion: 1, project, checkout: scratch, command: 'cand', runId: '1'.repeat(16), pid: process.pid, pidStart: self.pidStart, pgid: self.pgid, acquiredAt: 'x', containers: [] });
      let candFailed = false; try { fs.renameSync(p.cand('1'.repeat(16)), p.lock); } catch { candFailed = true; }
      fs.mkdirSync(p.stale('0'.repeat(16))); writeRecord(p.stale('0'.repeat(16)), { formatVersion: 1, project, checkout: scratch, command: 'old', runId: '0'.repeat(16), pid: 1, pidStart: 'x', pgid: 1, acquiredAt: 'x', containers: [] });
      let staleFailed = false; try { fs.renameSync(p.lock, p.stale('0'.repeat(16))); } catch { staleFailed = true; }
      say('rename-held', 'both renames refused', candFailed && staleFailed ? 'both renames refused' : `cand refused=${candFailed} stale refused=${staleFailed}`);
      clear();
    }, 'rename-held');
    // locale: a record written under LC_ALL=C stays live when the check runs from another locale.
    await bound(30_000, async () => {
      const raw = (loc) => { try { return execFileSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], { env: { ...process.env, LC_ALL: loc }, encoding: 'utf8' }).trim(); } catch { return ''; } };
      const fr = raw('fr_FR.UTF-8');
      const check = execFileSync(process.execPath, ['--input-type=module', '-e', `
import { execFileSync } from 'node:child_process';
const C = { ...process.env, LC_ALL: 'C' };
const s = execFileSync('ps', ['-o', 'lstart=', '-p', '${process.pid}'], { env: C, encoding: 'utf8' }).trim();
process.stdout.write(s === ${JSON.stringify(self.pidStart)} ? 'live' : 'not-live');`], { env: { ...process.env, LC_ALL: 'fr_FR.UTF-8' }, encoding: 'utf8' });
      say('locale', 'live', check === 'live' ? 'live' : check);
      lines.at(-1).rawLstartDiffers = fr !== '' && fr !== self.pidStart;
    }, 'locale');
    // orphan-client: the owner gets SIGKILL alone; its client child stays in the group → refuse; after it ends → reclaim.
    await bound(30_000, async () => {
      const owner = stub('sleep 25 & wait');
      await sleep(300);
      const ownerStart = psLstart(owner.pid);
      const p = paths(scratch, project);
      fs.mkdirSync(p.lock); writeRecord(p.lock, { formatVersion: 1, project, checkout: scratch, command: 'stub-owner', runId: '2'.repeat(16), pid: owner.pid, pidStart: ownerStart, pgid: owner.pid, acquiredAt: 'x', containers: [] });
      process.kill(owner.pid, 'SIGKILL');
      await sleep(300);
      const restore = silence();
      const first = await outcome(() => acquire(quietCtx({ command: 'contender', runId: '3'.repeat(16), ...self }), { lister: null, waitMs: 2000 }));
      restore();
      for (const m of groupMembers(owner.pid)) { try { process.kill(m, 'SIGKILL'); } catch { /* ended */ } }
      await sleep(300);
      const restore2 = silence();
      let reclaimed = false;
      const w = process.stdout.write.bind(process.stdout);
      process.stdout.write = (t) => { if (String(t).includes('"storage_lock_reclaimed"')) reclaimed = true; return true; };
      const second = await outcome(() => acquire(quietCtx({ command: 'contender', runId: '4'.repeat(16), ...self }), { lister: null, waitMs: 2000 }));
      process.stdout.write = w; restore2();
      say('orphan-client', 'operation_in_progress then reclaimed', first === 'operation_in_progress' && second === 'acquired' && reclaimed ? 'operation_in_progress then reclaimed' : `${first} then ${second} reclaimed=${reclaimed}`);
      clear();
    }, 'orphan-client');
    // dead-owner: an ended owner with an empty group → reclaimed.
    await bound(30_000, async () => {
      const owner = stub('exit 0');
      await new Promise((r) => owner.on('exit', r));
      await sleep(200);
      const p = paths(scratch, project);
      fs.mkdirSync(p.lock); writeRecord(p.lock, { formatVersion: 1, project, checkout: scratch, command: 'dead', runId: '5'.repeat(16), pid: owner.pid, pidStart: 'ended', pgid: owner.pid, acquiredAt: 'x', containers: [] });
      let reclaimed = false;
      const w = process.stdout.write.bind(process.stdout);
      process.stdout.write = (t) => { if (String(t).includes('"storage_lock_reclaimed"')) reclaimed = true; return true; };
      const got = await outcome(() => acquire(quietCtx({ command: 'contender', runId: '6'.repeat(16), ...self }), { lister: null, waitMs: 2000 }));
      process.stdout.write = w;
      say('dead-owner', 'reclaimed', got === 'acquired' && reclaimed ? 'reclaimed' : `${got} reclaimed=${reclaimed}`);
      clear();
    }, 'dead-owner');
    // own-group: a job started like the Build Runner (`( set -m; nohup … & )`) has a group other than the command's.
    await bound(30_000, async () => {
      const out = execFileSync('bash', ['-c', '( set -m; nohup sleep 3 >/dev/null 2>&1 & echo $! > "$1" ); sleep 0.3; echo "$(ps -o pgid= -p $$ | tr -d " ") $(ps -o pgid= -p "$(cat "$1")" | tr -d " ")"', '_', path.join(scratch, 'job.pid')], { env: C, encoding: 'utf8' }).trim();
      const [cmdGroup, jobGroup] = out.split(' ');
      say('own-group', 'other group', jobGroup && cmdGroup !== jobGroup ? 'other group' : `same group ${out}`);
      try { process.kill(Number(fs.readFileSync(path.join(scratch, 'job.pid'), 'utf8')), 'SIGKILL'); } catch { /* ended */ }
    }, 'own-group');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const expected = ['rename-held', 'locale', 'orphan-client', 'dead-owner', 'own-group'];
  return expected.every((s) => lines.some((l) => l.scenario === s && l.ok)) ? 0 : 1;
}

let runCtx = null;
try {
  if (cmd === 'acquire') {
    runCtx = ctxOf(opt);
    await acquire(runCtx);
  } else if (cmd === 'release') {
    process.exitCode = release(ctxOf(opt)) ? 0 : 1;
  } else if (cmd === 'add-container') {
    addContainer(ctxOf(opt), opt.name);
  } else if (cmd === 'selftest') {
    const timer = setTimeout(() => { process.stderr.write('storage lock selftest: over 90 s\n'); process.exit(1); }, 90_000);
    try { process.exitCode = await selftest(opt.repo); } finally { clearTimeout(timer); }
  } else {
    throw new Refusal('usage', 'usage: acquire | release | add-container | selftest');
  }
} catch (err) {
  if (err instanceof Refusal && err.reason !== 'usage' && err.reason !== 'storage_lock_lost') {
    const ctx = (() => { try { return ctxOf(opt); } catch { return { project: opt.project, logDir: null }; } })();
    eventLine(ctx, 'storage_lock_refused', { reason: err.reason, owner: ownerView(err.owner), container: err.container ?? null });
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  } else if (err?.step === 'list' || err?.step === 'remove') {
    // A6 may have reclaimed a stale lock record (A5) and removed inactive storage containers before the failure: say so.
    // The lock is released; no database or volume entry was changed. Never the child's own output.
    const done = [runCtx?.reclaimed ? `a stale lock record was moved to .tmp/storage-op.<project>.stale-${runCtx.reclaimed}/` : null,
      runCtx?.removed?.length ? `inactive storage containers removed: ${runCtx.removed.map((c) => `${c.name} (${c.id})`).join(', ')}` : null].filter(Boolean);
    const how = err.signal ? `ended by ${err.signal}` : `exit ${err.status}`;
    const what = err.code === 'ENOENT' ? 'Cannot check the storage containers: docker is not installed'
      : err.step === 'list' ? `Cannot check the storage containers: Docker does not answer (docker ps: ${how}). Start Docker, then run the command again`
        : `Cannot remove the inactive storage container ${err.container.name} (${err.container.id}): docker rm failed (${how})`;
    process.stderr.write(`${what}. ${done.length ? `Before that, ${done.join('; ')}. ` : ''}No data was changed.\n`);
    process.exitCode = 1;
  } else if (err?.status !== undefined || err?.signal) {
    // A failed `ps` (the process check of A3/A4) or another child: name the case, never its output.
    process.stderr.write('Cannot read the process list (ps) for the lock check. The lock is not held. No data was changed.\n');
    process.exitCode = 1;
  } else {
    process.stderr.write(`${err?.message ?? err}\n`);
    process.exitCode = err?.reason === 'usage' ? 2 : 1;
  }
}
JS
}

_storage_oplock_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The checkout root: the candidate tree has this file in infra/scripts/, the old-build copy in .tmp/storage-compat/.
_storage_oplock_repo() {
  if [[ -n "${REPO_ROOT:-}" ]]; then echo "$REPO_ROOT"; return; fi
  case "$_storage_oplock_dir" in
    */.tmp/storage-compat) (cd "$_storage_oplock_dir/../.." && pwd) ;;
    *) (cd "$_storage_oplock_dir/../.." && pwd) ;;
  esac
}

# Acquire the lock for this shell (the guarded command is the process $$). Exits the shell on a refusal.
storage_lock_acquire() {
  local command="${1:-unknown}"
  STORAGE_LOCK_REPO="$(_storage_oplock_repo)"
  STORAGE_LOCK_PROJECT="${COMPOSE_PROJECT_NAME:?COMPOSE_PROJECT_NAME is not set}"
  STORAGE_LOCK_RUN_ID="$(node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))')"
  if ! _storage_oplock_js acquire --repo "$STORAGE_LOCK_REPO" --project "$STORAGE_LOCK_PROJECT" --command "$command" --run-id "$STORAGE_LOCK_RUN_ID" --pid "$$"; then
    exit 1
  fi
  export COGNIATE_STORAGE_LOCK_RUN="$STORAGE_LOCK_RUN_ID"
  STORAGE_LOCK_HELD=1
  trap 'storage_lock_release' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

storage_lock_add_container() {
  _storage_oplock_js add-container --repo "$STORAGE_LOCK_REPO" --project "$STORAGE_LOCK_PROJECT" --run-id "$STORAGE_LOCK_RUN_ID" --pid "$$" --name "$1" >/dev/null
}

storage_lock_release() {
  [[ "${STORAGE_LOCK_HELD:-0}" == 1 ]] || return 0
  STORAGE_LOCK_HELD=0
  _storage_oplock_js release --repo "$STORAGE_LOCK_REPO" --project "$STORAGE_LOCK_PROJECT" --run-id "$STORAGE_LOCK_RUN_ID" --pid "$$" || true
}

# A new storage run id (16 lowercase hex) for a storage container name and its run label.
storage_run_id() { node -e 'process.stdout.write(require("crypto").randomBytes(8).toString("hex"))'; }

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  sub="${1:-}"; shift || true
  case "$sub" in
    run)
      [[ "${1:-}" == "--" ]] && shift
      [[ $# -gt 0 ]] || { echo "Usage: storage-oplock.sh run -- <command …>" >&2; exit 2; }
      if [[ -z "${COMPOSE_PROJECT_NAME:-}" ]]; then
        # The checkout's .env names the project (the same rule as lib.sh).
        _env="$(_storage_oplock_repo)/.env"
        [[ -f "$_env" ]] && COMPOSE_PROJECT_NAME="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$_env" | tail -1)"
        export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cogniate-stack}"
      fi
      storage_lock_acquire "storage-oplock run -- $*"
      set +e
      "$@"
      code=$?
      set -e
      storage_lock_release
      exit "$code"
      ;;
    selftest) _storage_oplock_js selftest --repo "$(_storage_oplock_repo)" ;;
    *) echo "Usage: storage-oplock.sh run -- <command …> | selftest" >&2; exit 2 ;;
  esac
fi
