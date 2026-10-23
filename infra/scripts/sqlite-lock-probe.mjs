// Storage preflight (ADR-012 §4–§6): the volume roots, the start-state table and a real SQLite WAL lock probe.
// It runs as the Compose service `storage-preflight` (a fresh one-shot container under the operation lock of §7):
//   node sqlite-lock-probe.mjs <report|check|mark-started> --run-id <16 hex> --project <name> \
//        --folder lti=<path> --folder app=<path> [--prepare]          (--prepare only with check)
//   node sqlite-lock-probe.mjs probe --run-id <16 hex> --folder <name>=<path> [--folder …]
//   node sqlite-lock-probe.mjs selftest --run-id <16 hex> --folder self=<path>
// Exit 0 pass, 1 fail (any reason), 2 usage error. A non-lock error is never a pass.
// Privilege rule (§4): as root it only reads and does the §4 volume-side steps; then it switches to HOST_UID:HOST_GID
// before it writes any other file, identity, journal or log line. Modes without a §4 step drop privilege at once.
// The functions below are also the library of stack-data.mjs (state table, journal classification, identities).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const IDENTITY = '.storage-identity.json';
export const JOURNAL = '.storage-journal.json';
/** The database of each volume role (§3). Mountpoints exist only in `appdb`. */
export const ROLES = {
  lti: { db: 'lti.db', mountpoints: [] },
  app: { db: 'cogniate.db', mountpoints: ['packages', 'uploads'] },
};
export const HEX16 = /^[0-9a-f]{16}$/;
export const HEX32 = /^[0-9a-f]{32}$/;
export const TERMINAL = new Set(['committed', 'rolled_back']);
export const JOURNAL_STATES = new Set(['prepared', 'staged', 'swapping', 'swapped', 'committed', 'rolling_back', 'rolled_back', 'rollback_failed']);
const PROBE_SCRATCH = /^\.lock-probe-[0-9a-f]{16}\.db(-wal|-shm)?$/;
const WAIT_MS = 10_000;
const RUN_MS = 60_000;

/** Messages of the §6 refusal codes (stderr only; the JSON lines carry the code). */
export const MESSAGES = {
  rollback_failed: 'A restore could not roll back. Do not start. Keep both volumes. Use `npm run stack:data-quarantine -- --out <folder>` (ADR-012 §9).',
  journal_inconsistent: 'A restore could not roll back. Do not start. Keep both volumes. Use `npm run stack:data-quarantine -- --out <folder>` (ADR-012 §9).',
  journal_open: 'A restore or import did not finish. Run `npm run stack:data-restore -- --recover`.',
  half_pair: 'One database of the pair is missing.',
  no_databases: 'Both databases are missing.',
  state_unclassified: 'A restore could not roll back. Do not start. Keep both volumes. Use `npm run stack:data-quarantine -- --out <folder>` (ADR-012 §9).',
};

// ------------------------------------------------------------------------------------------------ entries (§3)

/** The expected type of an allowed direct child, or null when the name is not allowed in a volume of this role. */
export function allowedType(role, name) {
  const { db, mountpoints } = ROLES[role];
  if (name === db || name === `${db}-wal` || name === `${db}-shm`) return 'file';
  if (name === IDENTITY || name === JOURNAL || name === `${IDENTITY}.tmp` || name === `${JOURNAL}.tmp`) return 'file';
  if (/^\.(restore|previous)-[0-9a-f]{32}$/.test(name)) return 'dir';
  if (PROBE_SCRATCH.test(name)) return 'file';
  if (/^\.qa-scratch-[0-9a-f]{16}$/.test(name)) return 'dir';
  if (mountpoints.includes(name)) return 'mountpoint';
  return null;
}

const typeOf = (st) => (st.isSymbolicLink() ? 'symlink' : st.isFile() ? 'file' : st.isDirectory() ? 'dir' : 'other');

/** Read a regular JSON file (never through a symbolic link). */
function readJsonEntry(dir, name, entries) {
  const e = entries.find((x) => x.name === name);
  if (!e) return { present: false };
  if (e.type !== 'file') return { present: true, ok: false };
  try {
    return { present: true, ok: true, value: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) };
  } catch {
    return { present: true, ok: false };
  }
}

/** One read of a volume root: every direct child with `lstat`, and the identity and journal. Read only. */
export function readFolder(dir, role) {
  const root = fs.lstatSync(dir);
  if (!root.isDirectory()) throw Object.assign(new Error(`not a folder: ${dir}`), { code: 'ENOTDIR' });
  const entries = fs.readdirSync(dir).sort().map((name) => {
    const st = fs.lstatSync(path.join(dir, name));
    const type = typeOf(st);
    return { name, type, uid: st.uid, gid: st.gid, mode: st.mode & 0o7777, size: type === 'file' ? st.size : null,
      empty: type === 'dir' ? fs.readdirSync(path.join(dir, name)).length === 0 : null };
  });
  return {
    dir, role, entries,
    root: { uid: root.uid, gid: root.gid, mode: root.mode & 0o7777 },
    identity: readJsonEntry(dir, IDENTITY, entries),
    journal: readJsonEntry(dir, JOURNAL, entries),
    hasDb: entries.some((e) => e.name === ROLES[role].db && e.type === 'file'),
  };
}

// ------------------------------------------------------------------------------------------------ identities and journals

export function validIdentity(v, role) {
  return Boolean(v) && typeof v === 'object' && v.formatVersion === 1 && v.role === role && typeof v.composeProject === 'string'
    && HEX32.test(String(v.pairId)) && Number.isInteger(v.generation) && v.generation >= 0 && typeof v.createdAt === 'string'
    && (v.firstStart === 'pending' || v.firstStart === 'completed') && Boolean(v.provenance) && typeof v.provenance === 'object'
    && ['fresh', 'restore', 'import'].includes(v.provenance.kind) && Array.isArray(v.legacySources);
}

export function validJournal(v) {
  return Boolean(v) && typeof v === 'object' && v.formatVersion === 1 && (v.operation === 'restore' || v.operation === 'import')
    && HEX32.test(String(v.opId)) && JOURNAL_STATES.has(v.state);
}

/** A journal read as {absent} | {invalid} | the journal object. */
export const journalOf = (folder) => (!folder.journal.present ? null : folder.journal.ok && validJournal(folder.journal.value) ? folder.journal.value : { invalid: true });

/**
 * The recovery row of two journals (§8 recovery table; lti is written first). R5 any `rollback_failed`; R0 every
 * present journal terminal; R1 lti `prepared` X with app absent or terminal with another opId; R2 both X in
 * `prepared`/`staged`/`rolled_back`; R4 lti `committed` X with app `swapped` X; R3 both X with any `swapping`,
 * `swapped` or `rolling_back`; R6 everything else (also a journal that does not parse).
 */
export function classifyJournals(lti, app) {
  if (lti?.invalid || app?.invalid) return { row: 'R6', opId: null };
  if (lti?.state === 'rollback_failed' || app?.state === 'rollback_failed') return { row: 'R5', opId: lti?.opId ?? app?.opId ?? null };
  const terminal = (j) => !j || TERMINAL.has(j.state);
  if (terminal(lti) && terminal(app)) return { row: 'R0', opId: null };
  if (lti && lti.state === 'prepared' && (!app || (TERMINAL.has(app.state) && app.opId !== lti.opId))) return { row: 'R1', opId: lti.opId };
  if (lti && app && lti.opId === app.opId) {
    const early = new Set(['prepared', 'staged', 'rolled_back']);
    if (early.has(lti.state) && early.has(app.state)) return { row: 'R2', opId: lti.opId };
    if (lti.state === 'committed' && app.state === 'swapped') return { row: 'R4', opId: lti.opId };
    const swap = new Set(['swapping', 'swapped', 'rolling_back']);
    if (swap.has(lti.state) || swap.has(app.state)) return { row: 'R3', opId: lti.opId };
  }
  return { row: 'R6', opId: null };
}

// ------------------------------------------------------------------------------------------------ state table (§6)

/**
 * The §6 state of the pair: the FIRST matching row. `folders` = {lti, app} from readFolder. Returns
 * {state, allowed, entry} where `state` is the refusal code or the allowed state.
 */
export function evaluateState(folders, { project, hostUid, hostGid }) {
  const { lti, app } = folders;
  const both = [lti, app];
  const result = (state, allowed, entry = null) => ({ state, allowed, entry });
  // Rows 1–3: the journal gate.
  const jr = classifyJournals(journalOf(lti), journalOf(app));
  if (jr.row === 'R5') return result('rollback_failed', false);
  if (jr.row === 'R6') return result('journal_inconsistent', false);
  if (jr.row !== 'R0') return result('journal_open', false);
  // Row 4: unknown entries (or an allowed name with the wrong type; a symbolic link is never allowed).
  for (const f of both) {
    for (const e of f.entries) {
      const want = allowedType(f.role, e.name);
      if (want === 'mountpoint') continue; // row 5 (§4 mountpoint rule)
      if (want === null || want !== e.type) return result('unknown_entry', false, `${f.role}:${e.name}`);
    }
  }
  // Row 5: the mountpoints (absent, or an empty directory owned by HOST_UID:HOST_GID or by root; check fixes root).
  for (const f of both) {
    for (const m of ROLES[f.role].mountpoints) {
      const e = f.entries.find((x) => x.name === m);
      if (!e) continue;
      const ownerOk = (e.uid === hostUid && e.gid === hostGid) || (e.uid === 0 && e.gid === 0);
      if (e.type !== 'dir' || !e.empty || !ownerOk) return result('mountpoint_unsafe', false, `${f.role}:${m}`);
    }
  }
  // Row 6: every other allowed entry belongs to HOST_UID:HOST_GID.
  for (const f of both) {
    for (const e of f.entries) {
      if (allowedType(f.role, e.name) === 'mountpoint') continue;
      if (e.uid !== hostUid || e.gid !== hostGid) return result('owner_mismatch', false, `${f.role}:${e.name}`);
    }
  }
  // Rows 7–9: identities.
  for (const f of both) {
    if (f.identity.present && !(f.identity.ok && validIdentity(f.identity.value, f.role))) return result('identity_invalid', false, `${f.role}:${IDENTITY}`);
  }
  const ids = both.filter((f) => f.identity.present).map((f) => f.identity.value);
  for (const id of ids) if (id.composeProject !== project) return result('identity_project', false);
  if (ids.length === 2 && (ids[0].pairId !== ids[1].pairId || ids[0].generation !== ids[1].generation)) return result('identity_mismatch', false);
  const dbs = (lti.hasDb ? 1 : 0) + (app.hasDb ? 1 : 0);
  const journals = [journalOf(lti), journalOf(app)].filter(Boolean);
  // Row 10: exactly one fresh, pending identity of generation 0; no database; no open journal.
  if (ids.length === 1 && ids[0].provenance.kind === 'fresh' && ids[0].generation === 0 && ids[0].firstStart === 'pending' && dbs === 0
    && journals.every((j) => TERMINAL.has(j.state))) return result('FRESH_INIT_PARTIAL', true);
  if (ids.length === 1) return result('identity_missing', false);
  if (ids.length === 0 && dbs > 0) return result('db_without_identity', false);
  const swapFolders = both.some((f) => f.entries.some((e) => /^\.(restore|previous)-/.test(e.name)));
  if (ids.length === 0 && dbs === 0 && !swapFolders && journals.every((j) => j.state === 'rolled_back')) return result('FRESH', true);
  if (ids.length === 2) {
    const completed = ids.some((id) => id.firstStart === 'completed');
    if (!completed && dbs <= 1) return result('FIRST_START', true);
    if (completed && dbs === 1) return result('half_pair', false);
    if (completed && dbs === 0) return result('no_databases', false);
    if (dbs === 2 && journals.every((j) => TERMINAL.has(j.state))) return result('OK', true);
  }
  return result('state_unclassified', false);
}

// ------------------------------------------------------------------------------------------------ durable writes

/** fsync of a folder (§6, §8 write order). */
export function fsyncDir(dir) {
  const fd = fs.openSync(dir, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

/** `.tmp`, fsync, rename, fsync of the folder. */
export function writeJsonDurable(dir, name, value) {
  const tmp = path.join(dir, `${name}.tmp`);
  const fd = fs.openSync(tmp, 'w', 0o600);
  try {
    fs.writeSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, path.join(dir, name));
  fsyncDir(dir);
}

export function newIdentity({ project, role, pairId, generation = 0, firstStart = 'pending', provenance = null, legacySources = [] }) {
  return {
    formatVersion: 1, composeProject: project, pairId, role, generation, createdAt: new Date().toISOString(), firstStart,
    provenance: provenance ?? { kind: 'fresh', opId: null, backupId: null, manifestSha256: null, restoredFromPairId: null, restoredFromGeneration: null },
    legacySources,
  };
}

// ------------------------------------------------------------------------------------------------ privilege (§4)

export function hostIds(env = process.env) {
  const has = (k) => env[k] !== undefined && env[k] !== '';
  // As root the service user must be named: a root program without HOST_UID/HOST_GID would write root-owned files.
  if (process.getuid?.() === 0 && !(has('HOST_UID') && has('HOST_GID'))) throw Object.assign(new Error('HOST_UID and HOST_GID are required as root'), { usage: true });
  const uid = has('HOST_UID') ? Number(env.HOST_UID) : process.getuid?.() ?? 0;
  const gid = has('HOST_GID') ? Number(env.HOST_GID) : process.getgid?.() ?? 0;
  if (!Number.isInteger(uid) || uid < 0 || !Number.isInteger(gid) || gid < 0) throw Object.assign(new Error('HOST_UID and HOST_GID must be numbers'), { usage: true });
  return { uid, gid };
}

/** Switch to HOST_UID:HOST_GID when running as root (setgroups, setgid, then setuid). A no-op for other users. */
export function dropPrivilege({ uid, gid }) {
  if (process.getuid?.() !== 0) return;
  process.setgroups?.([gid]);
  process.setgid(gid);
  process.setuid(uid);
}

/**
 * The §4 volume-side steps, as root before the drop: the volume root folder, then the `appdb` mountpoints. Never
 * recursive, never a file, never through a symbolic link. Returns {failure, unsafe} (both kept in memory).
 */
export function prepareFolder(dir, role, { uid, gid }) {
  const out = { failure: null, unsafe: null };
  try {
    const st = fs.lstatSync(dir);
    if (st.uid !== uid || st.gid !== gid) fs.chownSync(dir, uid, gid);
    if ((st.mode & 0o7777) !== 0o700) fs.chmodSync(dir, 0o700);
    for (const m of ROLES[role].mountpoints) {
      const p = path.join(dir, m);
      let e = null;
      try { e = fs.lstatSync(p); } catch (err) { if (err.code !== 'ENOENT') throw err; }
      if (e === null) {
        fs.mkdirSync(p, { mode: 0o700 });
        fs.chownSync(p, uid, gid);
        fs.chmodSync(p, 0o700);
        continue;
      }
      if (!e.isDirectory() || e.isSymbolicLink() || fs.readdirSync(p).length > 0) { out.unsafe = `${role}:${m}`; continue; }
      if (e.uid === uid && e.gid === gid) continue;
      if (e.uid === 0) {
        fs.chownSync(p, uid, gid);
        fs.chmodSync(p, 0o700);
        continue;
      }
      out.unsafe = `${role}:${m}`; // an empty folder of another owner: not listed in §4, so unsafe
    }
  } catch (err) {
    out.failure = `${role}: ${err.code ?? err.name}`;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the lock probe (§5 steps 7–10)

/** The holder child: WAL, BEGIN IMMEDIATE, one row, then HELD; PING → PONG; COMMIT → COMMITTED, exit 0. */
const HOLDER = `
const { DatabaseSync } = require('node:sqlite');
const [file, marker, scenario] = process.argv.slice(1);
const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS probe (marker TEXT)');
if (scenario !== 'no-hold') { db.exec('BEGIN IMMEDIATE'); db.prepare('INSERT INTO probe VALUES (?)').run(marker); }
process.stdout.write('HELD\\n');
if (scenario === 'holder-dies') process.exit(3);
let buf = '';
process.stdin.on('data', (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf('\\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (line === 'PING') process.stdout.write('PONG inTransaction=' + (db.isTransaction ? 1 : 0) + '\\n');
    if (line === 'COMMIT') { if (db.isTransaction) db.exec('COMMIT'); db.close(); process.stdout.write('COMMITTED\\n'); process.exit(0); }
  }
});
`;

/**
 * The waits of the probe (§5 bounds). Each wait gives {line}, {ended} (the holder exited or its stream closed) or
 * {timeout} (the wait elapsed), so an elapsed wait (`timeout`) is never mixed up with a crashed or wrong holder
 * (`probe_error`).
 */
function lineWaiter(child) {
  const lines = [];
  const waiters = [];
  let buf = '';
  let ended = false;
  child.stdout.on('data', (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      lines.push(buf.slice(0, i)); buf = buf.slice(i + 1);
      while (waiters.length && lines.length) waiters.shift().settle({ line: lines.shift() });
    }
  });
  const end = () => { ended = true; while (waiters.length) waiters.shift().settle({ ended: true }); };
  child.on('exit', end);
  child.on('error', end);
  return (ms) => new Promise((resolve) => {
    if (lines.length) return resolve({ line: lines.shift() });
    if (ended) return resolve({ ended: true });
    let t;
    const w = { settle: (r) => { clearTimeout(t); resolve(r); } };
    waiters.push(w);
    t = setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); resolve({ timeout: true }); } }, ms);
  });
}

/** The exit of the holder: {code} or {timeout}. */
const exitOf = (child, ms) => new Promise((resolve) => {
  if (child.exitCode !== null) return resolve({ code: child.exitCode });
  const t = setTimeout(() => resolve({ timeout: true }), ms);
  child.on('exit', (code) => { clearTimeout(t); resolve({ code }); });
});

/** One expected holder answer: an elapsed wait → `timeout`; an ended holder or another answer → `probe_error`. */
const answer = (r, want) => (r.timeout ? 'timeout' : r.line === want ? null : 'probe_error');

/**
 * The real driver of the lock probe. A unit test passes another one to probeFolder (an internal library seam; no CLI
 * flag or environment variable selects it): a scripted holder, a database whose `BEGIN IMMEDIATE` fails with a chosen
 * extended code, a file delete that fails, or shorter waits.
 */
export const REAL_DRIVER = Object.freeze({
  waitMs: WAIT_MS,
  spawnHolder: (base, runId, scenario) => spawn(process.execPath, ['-e', HOLDER, base, runId, scenario], { stdio: ['pipe', 'pipe', 'ignore'] }),
  openDatabase: (file) => new DatabaseSync(file, { timeout: 0 }),
  removeFile: (p) => fs.rmSync(p, { force: true }),
});
export const PROBE_BOUNDS = Object.freeze({ waitMs: WAIT_MS, runMs: RUN_MS });

/**
 * Steps 7–10 on one folder: a live holder, the negative oracle (extended code 5 exactly), the release-positive control,
 * and the cleanup of the run's scratch files. Returns {result: 'pass'|'fail', reason, waits}.
 */
export async function probeFolder(dir, runId, { scenario = 'normal', driver = REAL_DRIVER } = {}) {
  const base = path.join(dir, `.lock-probe-${runId}.db`);
  const waits = { busyMs: null, releaseMs: null };
  let child = null;
  let result;
  try {
    result = await probeSteps(base, runId, scenario, waits, driver, (c) => { child = c; });
  } catch {
    result = { result: 'fail', reason: 'probe_error', waits };
  }
  if (child && child.exitCode === null) { try { child.kill('SIGKILL'); } catch { /* already gone */ } }
  if (child) await exitOf(child, driver.waitMs);
  // Step 10: the cleanup always runs; a failed delete wins over the probe result.
  const failed = [];
  for (const s of ['', '-wal', '-shm']) {
    try { driver.removeFile(`${base}${s}`); } catch { failed.push(`${base}${s}`); }
  }
  if (failed.length) return { result: 'fail', reason: 'scratch_cleanup_failed', waits, cleanup: failed };
  return result;
}

/** Steps 7–9 (the caller cleans up in step 10). */
async function probeSteps(base, runId, scenario, waits, driver, setChild) {
  const fail = (reason) => ({ result: 'fail', reason, waits });
  const child = driver.spawnHolder(base, runId, scenario);
  setChild(child);
  const next = lineWaiter(child);
  let bad = answer(await next(driver.waitMs), 'HELD');
  if (bad) return fail(bad);
  // Step 8: the negative oracle.
  const db = driver.openDatabase(base);
  try {
    const t0 = Date.now();
    let busy = null;
    try {
      db.exec('BEGIN IMMEDIATE');
    } catch (err) {
      busy = err ?? new Error('unknown');
    }
    waits.busyMs = Date.now() - t0;
    if (busy === null) {
      db.exec('ROLLBACK');
      return fail('lock_not_enforced');
    }
    // Only the extended code 5 (SQLITE_BUSY) is an enforced lock; 261, 517, 6 and every other result are probe_error.
    if (busy.errcode !== 5) return fail('probe_error');
    child.stdin.write('PING\n');
    bad = answer(await next(driver.waitMs), 'PONG inTransaction=1');
    if (bad) return fail(bad);
    // Step 9: the release-positive control.
    const t1 = Date.now();
    child.stdin.write('COMMIT\n');
    bad = answer(await next(driver.waitMs), 'COMMITTED');
    if (bad) return fail(bad);
    const exit = await exitOf(child, driver.waitMs);
    if (exit.timeout) return fail('timeout');
    if (exit.code !== 0) return fail('probe_error');
    db.exec('BEGIN IMMEDIATE');
    waits.releaseMs = Date.now() - t1;
    const row = db.prepare('SELECT marker FROM probe WHERE marker = ?').get(runId);
    db.exec('ROLLBACK');
    if (!row) return fail('probe_error');
    return { result: 'pass', reason: null, waits };
  } catch {
    return fail('probe_error');
  } finally {
    try { db.close(); } catch { /* closed */ }
  }
}

/** Step 5: delete probe scratch files and the identity/journal `.tmp` files of earlier runs. */
export function cleanLeftovers(dir, { removeFile = (p) => fs.rmSync(p) } = {}) {
  const failed = [];
  for (const name of fs.readdirSync(dir)) {
    if (!(PROBE_SCRATCH.test(name) || name === `${IDENTITY}.tmp` || name === `${JOURNAL}.tmp`)) continue;
    const p = path.join(dir, name);
    try {
      if (fs.lstatSync(p).isFile()) removeFile(p);
    } catch {
      failed.push(p);
    }
  }
  return failed;
}

/** fsType of the mount that holds `p` (from /proc/mounts, the longest mount point prefix). */
export function fsTypeOf(p) {
  try {
    const abs = path.resolve(p);
    let best = { mp: '', type: 'unknown' };
    for (const line of fs.readFileSync('/proc/mounts', 'utf8').split('\n')) {
      const [, mp, type] = line.split(' ');
      if (!mp) continue;
      const m = mp.replace(/\\040/g, ' ');
      if ((abs === m || abs.startsWith(m.endsWith('/') ? m : `${m}/`)) && m.length > best.mp.length) best = { mp: m, type };
    }
    return best.type;
  } catch {
    return 'unknown';
  }
}

// ------------------------------------------------------------------------------------------------ the modes

class Usage extends Error {}

function logLines(lines) {
  for (const l of lines) process.stdout.write(`${JSON.stringify(l)}\n`);
  const dir = process.env.STORAGE_LOG_DIR ?? '/logs';
  try {
    if (fs.existsSync(dir)) fs.appendFileSync(path.join(dir, 'storage-preflight.jsonl'), lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
  } catch { /* the stdout lines stay the evidence */ }
}

function parseFolders(list, required) {
  const out = {};
  for (const item of list ?? []) {
    const i = item.indexOf('=');
    if (i <= 0) throw new Usage(`--folder needs <name>=<path>, got ${item}`);
    out[item.slice(0, i)] = item.slice(i + 1);
  }
  if (required && (Object.keys(out).sort().join(',') !== 'app,lti')) throw new Usage('this mode needs exactly --folder lti=<path> and --folder app=<path>');
  if (!required && Object.keys(out).length === 0) throw new Usage('at least one --folder is needed');
  return out;
}

/** Run one mode. Returns the exit code. `deps` is for unit tests (log, env). */
export async function main(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const emit = deps.emit ?? logLines;
  let values;
  let mode;
  try {
    ({ values, positionals: [mode] } = parseArgs({ args: argv, allowPositionals: true, options: {
      'run-id': { type: 'string' }, project: { type: 'string' }, folder: { type: 'string', multiple: true }, prepare: { type: 'boolean' },
    } }));
    if (!['report', 'check', 'mark-started', 'probe', 'selftest'].includes(mode)) throw new Usage(`unknown mode ${mode}`);
    if (!HEX16.test(values['run-id'] ?? '')) throw new Usage('--run-id must be 16 lowercase hex');
    if (values.prepare && mode !== 'check') throw new Usage('--prepare is only for check');
  } catch (err) {
    process.stderr.write(`usage: ${err.message}\n`);
    return 2;
  }
  const runId = values['run-id'];
  const ts = () => new Date().toISOString();
  let ids;
  let folders;
  try {
    ids = hostIds(env);
    folders = parseFolders(values.folder, ['report', 'check', 'mark-started'].includes(mode));
    if (mode === 'selftest' && Object.keys(folders).join() !== 'self') throw new Usage('selftest needs exactly --folder self=<path>');
    if (['report', 'check', 'mark-started'].includes(mode) && !values.project) throw new Usage('--project is needed');
  } catch (err) {
    process.stderr.write(`usage: ${err.message}\n`);
    return 2;
  }

  if (mode === 'selftest') {
    dropPrivilege(ids);
    const dir = folders.self;
    if (!fs.existsSync(dir) || fs.readdirSync(dir).length > 0) { process.stderr.write('selftest needs an existing empty folder\n'); return 2; }
    const lines = [];
    for (const [scenario, expected] of [['normal', 'pass'], ['no-hold', 'lock_not_enforced'], ['holder-dies', 'probe_error']]) {
      const r = await probeFolder(dir, randomBytes(8).toString('hex'), { scenario });
      const observed = r.result === 'pass' ? 'pass' : r.reason;
      lines.push({ event: 'storage_selftest', ts: ts(), runId, scenario, expected, observed, ok: observed === expected });
    }
    emit(lines);
    return lines.every((l) => l.ok) ? 0 : 1;
  }

  if (mode === 'probe') {
    dropPrivilege(ids);
    const lines = [];
    for (const [name, dir] of Object.entries(folders)) {
      const r = await probeFolder(dir, runId);
      lines.push({ event: 'storage_preflight', ts: ts(), runId, mode, project: values.project ?? null, folder: name, path: dir, fsType: fsTypeOf(dir), state: null,
        result: r.result, reason: r.reason, waits: r.waits });
    }
    const reasons = lines.filter((l) => l.result !== 'pass').map((l) => `${l.folder}:${l.reason}`);
    emit([...lines, { event: 'storage_preflight_summary', ts: ts(), runId, mode, result: reasons.length ? 'fail' : 'pass', reasons }]);
    return reasons.length ? 1 : 0;
  }

  // report, check, mark-started: the pair, under the whole-run bound of §5 (60 s; `runMs` and `driver` are internal
  // unit-test seams of this function, never a CLI flag or an environment variable).
  const project = values.project;
  const driver = deps.driver ?? REAL_DRIVER;
  let expired = false;
  let settled = false;
  const read = () => ({ lti: readFolder(folders.lti, 'lti'), app: readFolder(folders.app, 'app') });
  const done = (state, perFolder, reasons, extra = []) => {
    if (settled) return null; // the deadline has already reported this run
    settled = true;
    const lines = ['lti', 'app'].map((f) => ({
      event: 'storage_preflight', ts: ts(), runId, mode, project, folder: f, path: folders[f], fsType: fsTypeOf(folders[f]), state,
      result: perFolder[f]?.result ?? (reasons.length ? 'fail' : 'pass'), reason: perFolder[f]?.reason ?? null,
      waits: perFolder[f]?.waits ?? { busyMs: null, releaseMs: null },
    }));
    emit([...lines, ...extra, { event: 'storage_preflight_summary', ts: ts(), runId, mode, result: reasons.length ? 'fail' : 'pass', reasons }]);
    for (const r of reasons) if (MESSAGES[r.split(':')[0]]) process.stderr.write(`${MESSAGES[r.split(':')[0]]}\n`);
    return reasons.length ? 1 : 0;
  };
  const work = async () => {
    let snap;
    try {
      snap = read(); // step 1, as root: read only
    } catch (err) {
      dropPrivilege(ids);
      return done(null, {}, [`probe_error:${err.code ?? err.name}`]);
    }
    if (mode !== 'check') {
      dropPrivilege(ids);
      const st = evaluateState(snap, { project, hostUid: ids.uid, hostGid: ids.gid });
      if (mode === 'report') {
        // The §10 legacy scan of stack-up.sh compares legacySources: report adds one line per valid identity.
        const extra = ['lti', 'app'].filter((r) => snap[r].identity.ok && validIdentity(snap[r].identity.value, r)).map((r) => {
          const id = snap[r].identity.value;
          return { event: 'storage_report_identity', ts: ts(), runId, folder: r, pairId: id.pairId, generation: id.generation, firstStart: id.firstStart,
            provenanceKind: id.provenance.kind,
            // Identity metadata only (name, size, SHA-256 of each legacy file), never another field or file content.
            legacySources: id.legacySources.map((x) => ({ name: x?.name ?? null, size: x?.size ?? null, sha256: x?.sha256 ?? null })) };
        });
        return done(st.state, {}, st.allowed ? [] : [st.entry ? `${st.state}:${st.entry}` : st.state], extra);
      }
      // mark-started: both identities valid and equal, both databases present.
      if (st.state !== 'OK') return done(st.state, {}, [`mark_started_state:${st.state}`]);
      for (const role of ['lti', 'app']) {
        const id = snap[role].identity.value;
        if (id.firstStart !== 'completed') writeJsonDurable(folders[role], IDENTITY, { ...id, firstStart: 'completed' });
      }
      return done(st.state, {}, []);
    }

    // check: step 2, the journal gate (rows 1–3), before any change.
    const gate = evaluateState(snap, { project, hostUid: ids.uid, hostGid: ids.gid });
    if (['rollback_failed', 'journal_inconsistent', 'journal_open'].includes(gate.state)) {
      dropPrivilege(ids);
      return done(gate.state, {}, [gate.state]);
    }
    // Step 3: prepare (root only), step 4: drop privilege.
    const prep = values.prepare ? { lti: prepareFolder(folders.lti, 'lti', ids), app: prepareFolder(folders.app, 'app', ids) } : { lti: {}, app: {} };
    dropPrivilege(ids);
    const rootFailures = ['lti', 'app'].map((f) => prep[f].failure).filter(Boolean);
    if (rootFailures.length) {
      // A fixed §6 code of the step-1 snapshot (rows 4–18) comes first; prepare_failed never displaces it.
      const fixed = gate.allowed ? [] : [gate.entry ? `${gate.state}:${gate.entry}` : gate.state];
      return done(gate.allowed ? null : gate.state, {}, [...fixed, ...rootFailures.map((x) => `prepare_failed:${x}`)]);
    }
    // Step 5: leftovers.
    const leftovers = [...cleanLeftovers(folders.lti, { removeFile: driver.removeFile }), ...cleanLeftovers(folders.app, { removeFile: driver.removeFile })];
    if (leftovers.length) return done(null, {}, leftovers.map((p) => `scratch_cleanup_failed:${p}`));
    // Step 6: rows 4–18.
    snap = read();
    const st = evaluateState(snap, { project, hostUid: ids.uid, hostGid: ids.gid });
    if (!st.allowed) return done(st.state, {}, [st.entry ? `${st.state}:${st.entry}` : st.state]);
    // Steps 7–10: the lock probe, on both folders.
    const perFolder = {};
    for (const role of ['lti', 'app']) {
      perFolder[role] = await probeFolder(folders[role], runId, { driver });
    }
    const failed = ['lti', 'app'].filter((r) => perFolder[r].result !== 'pass').map((r) => `${r}:${perFolder[r].reason}`);
    if (failed.length) return done(st.state, perFolder, failed);
    if (expired) return null; // the run is over (timeout): nothing is written after its summary
    // Step 11: initialization.
    if (st.state === 'FRESH') {
      const pairId = randomBytes(16).toString('hex');
      writeJsonDurable(folders.lti, IDENTITY, newIdentity({ project, role: 'lti', pairId }));
      writeJsonDurable(folders.app, IDENTITY, newIdentity({ project, role: 'app', pairId }));
    } else if (st.state === 'FRESH_INIT_PARTIAL') {
      const have = snap.lti.identity.present ? 'lti' : 'app';
      const missing = have === 'lti' ? 'app' : 'lti';
      writeJsonDurable(folders[missing], IDENTITY, newIdentity({ project, role: missing, pairId: snap[have].identity.value.pairId }));
    } else if (st.state === 'OK') {
      for (const role of ['lti', 'app']) {
        const id = snap[role].identity.value;
        if (id.firstStart !== 'completed') writeJsonDurable(folders[role], IDENTITY, { ...id, firstStart: 'completed' });
      }
    }
    return done(st.state, perFolder, []);
  };
  // The whole-run bound: on expiry, one storage_preflight line per folder (reason timeout), then the summary, exit 1.
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      dropPrivilege(ids);
      const timedOut = { result: 'fail', reason: 'timeout', waits: { busyMs: null, releaseMs: null } };
      resolve(done(null, { lti: timedOut, app: timedOut }, ['timeout']));
    }, deps.runMs ?? RUN_MS);
  });
  try {
    return await Promise.race([work(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

const isMain = process.argv[1] !== undefined && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    process.stderr.write(`probe_error: ${err?.message ?? err}\n`);
    process.exit(1);
  });
}
