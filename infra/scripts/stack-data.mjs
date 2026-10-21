// Upgrade, rollback and recovery maintenance (ADR-011 §14, ADR-012 §8–§10): the single internal program and library.
// The public routes are only infra/scripts/stack-data.sh (lock, positive stop check, then one maintenance storage
// container). Internal CLI; <root> holds lti-service/ and cogniate-app/ (/check in the maintenance container):
//   backup --source legacy --out <folder> --data <infra/.data> --project <name> [--revision <sha>] [--repo <checkout>]
//        host side: the bind folders are only read (manifest source "legacy"; §8 legacy rules)
//   backup --source volume --out <folder> --data <root> --project <name> [--revision <sha>]   (volumes read-only)
//   restore|import --from <folder> --data <root> --project <name> [--content <packages>] [--stop-after|--pause-after <p>]
//   recover --data <root> --project <name>                                                     (§8 recovery table)
//   quarantine-copy --out <folder> --data <root> --project <name>                              (§9 step 1)
//   legacy-decide --data <infra/.data> --report <file of storage_preflight report lines>       (§10, host side)
// A backup copies the databases and their present -wal/-shm files byte for byte, never opens a source for writing and
// never checkpoints; the manifest is written LAST (.tmp, fsync, rename). A restore validates the whole backup first,
// then journals every step in both volumes (lti first) with checked moves, so a crash at any point is recoverable
// (`recover`) and the rollback never overwrites data that it does not know. No command writes a database into a bind
// folder. The backup contains secrets: keep it outside the checkout (mode 0600). Exit codes: 0 done, 1 refused or
// cancelled/rolled back (verified), 2 unresolved (quarantine) or usage, 3 stopped by --stop-after.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, chmodSync, closeSync, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  IDENTITY, JOURNAL, ROLES, HEX32, classifyJournals, dropPrivilege, evaluateState, fsyncDir, hostIds, journalOf, prepareFolder, readFolder, validIdentity,
  writeJsonDurable,
} from './sqlite-lock-probe.mjs';

export const DATABASES = ['lti-service/lti.db', 'cogniate-app/cogniate.db'];
const SIDECARS = ['-wal', '-shm'];
const ALLOWED = new Set(DATABASES.flatMap((d) => [d, ...SIDECARS.map((s) => `${d}${s}`)]));
const MANIFEST = 'manifest.json';
const INCOMPLETE = 'INCOMPLETE';
/** The two volumes: role → service folder (also the folder in a backup) and its database. */
export const VOLUMES = { lti: { folder: 'lti-service', db: ROLES.lti.db }, app: { folder: 'cogniate-app', db: ROLES.app.db } };

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

export class Refused extends Error {
  constructor(message, code = null) { super(message); this.code = code; }
}

/** The schema_migration names of a database (read from a scratch copy, so the source and the backup never change). */
function migrationNames(dataDir, db) {
  const scratch = mkdtempSync(join(tmpdir(), 'cogniate-backup-'));
  try {
    for (const name of [db, ...SIDECARS.map((s) => `${db}${s}`)]) {
      if (existsSync(join(dataDir, name))) {
        mkdirSync(dirname(join(scratch, name)), { recursive: true });
        copyFileSync(join(dataDir, name), join(scratch, name));
      }
    }
    const conn = new DatabaseSync(join(scratch, db));
    try {
      return conn.prepare('SELECT name FROM schema_migration ORDER BY name').all().map((r) => String(r.name));
    } finally {
      conn.close();
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** The manifest: `.tmp`, fsync, rename, fsync of the folder (written last). */
function writeManifest(outDir, manifest) {
  const tmp = join(outDir, `${MANIFEST}.tmp`);
  const fd = openSync(tmp, 'w', 0o600);
  try { writeSync(fd, `${JSON.stringify(manifest, null, 2)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, join(outDir, MANIFEST));
  fsyncDir(outDir);
}

// ------------------------------------------------------------------------------------------------ legacy sets (§10)

/** The legacy set of one service folder: every entry named `<db>` or starting with `<db>-` (packages/ uploads/ are content). */
export function legacySet(dataDir, folder, db) {
  const dir = join(dataDir, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n === db || n.startsWith(`${db}-`)).sort().map((n) => {
    const p = join(dir, n);
    const st = lstatSync(p);
    return { name: `${folder}/${n}`, type: st.isFile() ? 'file' : 'other', size: st.isFile() ? st.size : null, sha256: st.isFile() ? sha256(p) : null };
  });
}

/** The legacy sets of both services, and the first legacy refusal (a hot rollback journal, or another unknown entry). */
export function legacySets(dataDir) {
  const entries = [...legacySet(dataDir, 'lti-service', 'lti.db'), ...legacySet(dataDir, 'cogniate-app', 'cogniate.db')];
  let refusal = null;
  for (const e of entries) {
    const base = e.name.split('/')[1];
    const db = e.name.startsWith('lti-service/') ? 'lti.db' : 'cogniate.db';
    if (base === `${db}-journal`) { refusal = { code: 'legacy_hot_journal', entry: e.name }; break; }
    if (e.type !== 'file' || (base !== db && base !== `${db}-wal` && base !== `${db}-shm`)) { refusal = { code: 'legacy_unknown_entry', entry: e.name }; break; }
  }
  return { entries, refusal };
}

/** §10 table L1–L7, from the legacy sets and the report lines of the preflight. */
export function legacyDecide(dataDir, reportLines) {
  const summary = reportLines.find((l) => l.event === 'storage_preflight_summary');
  const lti = reportLines.find((l) => l.event === 'storage_preflight' && l.folder === 'lti');
  if (!summary || !lti) return { row: 'L3', result: 'refuse', code: 'report_unavailable', message: 'The storage report did not finish. Nothing was changed.' };
  const state = lti.state ?? (summary.reasons?.[0] ?? 'state_unclassified').split(':')[0];
  const allowed = ['FRESH', 'FRESH_INIT_PARTIAL', 'FIRST_START', 'OK'].includes(state);
  if (['rollback_failed', 'journal_inconsistent', 'journal_open'].includes(state)) return { row: 'L1', result: 'refuse', code: state };
  const { entries, refusal } = legacySets(dataDir);
  if (refusal) return { row: 'L2', result: 'refuse', code: refusal.code, entry: refusal.entry };
  if (!allowed) return { row: 'L3', result: 'refuse', code: state };
  if (entries.length === 0) return { row: 'L4', result: 'continue' };
  if (state === 'FRESH') {
    return { row: 'L5', result: 'refuse', code: 'legacy_present',
      message: 'Import the legacy databases explicitly (`stack:data-backup -- --source legacy`, then `stack:data-import`), or move them out of the checkout. No empty database was made.' };
  }
  // L6 only for exactly two valid identity records (lti and app) whose legacySources both equal the host legacy set
  // (name, size, SHA-256; order-free). Anything missing, different or not parsable is L7 (fail closed).
  const ids = reportLines.filter((l) => l.event === 'storage_report_identity');
  const source = (x) => Boolean(x) && typeof x === 'object' && typeof x.name === 'string' && Number.isInteger(x.size) && typeof x.sha256 === 'string';
  const key = (list) => JSON.stringify(list.map((x) => JSON.stringify([x.name, x.size, x.sha256])).sort());
  const valid = ids.length === 2 && ids.map((i) => i.folder).sort().join() === 'app,lti'
    && ids.every((i) => Array.isArray(i.legacySources) && i.legacySources.every(source));
  if ((state === 'OK' || state === 'FIRST_START') && valid && ids.every((i) => key(i.legacySources) === key(entries))) {
    return { row: 'L6', result: 'continue', warning: 'legacy files are kept for reference and are not used' };
  }
  return { row: 'L7', result: 'refuse', code: 'legacy_conflict',
    message: 'Legacy and volume databases both exist and are not the same import. Move the legacy files out, or import into a quarantined lane.' };
}

// ------------------------------------------------------------------------------------------------ the legacy backup (host)

export function backup({ out, data, project, revision, repo }) {
  const outDir = resolve(out);
  if (repo && (outDir === resolve(repo) || outDir.startsWith(`${resolve(repo)}${sep}`))) throw new Refused('The backup folder must be outside the checkout (it contains secrets).');
  if (existsSync(outDir) && readdirSync(outDir).length > 0) throw new Refused(`The backup folder ${outDir} is not empty.`);
  const { refusal } = legacySets(data);
  if (refusal) throw new Refused(`${refusal.code}: ${refusal.entry} (a hot rollback journal or an unknown entry is not supported). Nothing was copied.`, refusal.code);
  for (const db of DATABASES) if (!existsSync(join(data, db))) throw new Refused(`Missing database ${db}. Nothing was copied.`);
  const migrations = Object.fromEntries(DATABASES.map((db) => [db, migrationNames(data, db)]));
  mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const files = [];
  for (const db of DATABASES) {
    for (const name of [db, ...SIDECARS.map((s) => `${db}${s}`)]) {
      const src = join(data, name);
      if (!existsSync(src)) continue;
      mkdirSync(dirname(join(outDir, name)), { recursive: true, mode: 0o700 });
      copyFileSync(src, join(outDir, name));
      chmodSync(join(outDir, name), 0o600);
      files.push({ name, size: statSync(src).size, sha256: sha256(src) });
    }
  }
  const manifest = { formatVersion: 1, backupId: randomUUID(), createdAt: new Date().toISOString(), composeProject: project, sourceRevision: revision, files, migrations, source: 'legacy' };
  // The copies are re-hashed against the source hashes before the manifest exists.
  for (const f of files) if (sha256(join(outDir, f.name)) !== f.sha256) throw new Refused(`The copy of ${f.name} does not match its source.`);
  writeManifest(outDir, manifest);
  validate(outDir, project);
  return manifest;
}

/** Validate the whole backup (form, id, project, source, every listed file with size and SHA-256). Throws Refused. */
export function validate(fromDir, project) {
  if (existsSync(join(fromDir, INCOMPLETE))) throw new Refused('The backup is marked INCOMPLETE (a service started during the copy).', 'backup_incomplete');
  let m;
  try {
    m = JSON.parse(readFileSync(join(fromDir, MANIFEST), 'utf8'));
  } catch {
    throw new Refused('The manifest is missing or is not JSON.', 'no_manifest');
  }
  if (!m || m.formatVersion !== 1 || typeof m.createdAt !== 'string' || typeof m.sourceRevision !== 'string' || !Array.isArray(m.files)
    || typeof m.migrations !== 'object' || m.migrations === null) throw new Refused('The manifest has another form.', 'manifest_invalid');
  if (typeof m.backupId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(m.backupId)) throw new Refused('The backup id is not valid.', 'manifest_invalid');
  if (m.composeProject !== project) throw new Refused(`The backup is of compose project ${String(m.composeProject)}, not ${project}.`, 'project_mismatch');
  if (m.source !== undefined && m.source !== 'legacy' && m.source !== 'volume') throw new Refused('The manifest has an unknown source.', 'manifest_invalid');
  if (m.source === 'volume' && (!HEX32.test(String(m.pairId)) || !Number.isInteger(m.generation) || !Array.isArray(m.legacySources))) {
    throw new Refused('A volume manifest without pairId, generation or legacySources.', 'manifest_incomplete');
  }
  const names = new Set();
  for (const f of m.files) {
    if (!f || typeof f.name !== 'string' || !ALLOWED.has(f.name) || names.has(f.name) || !Number.isInteger(f.size) || typeof f.sha256 !== 'string') {
      throw new Refused('The manifest lists a file that is not allowed, twice, or without size and SHA-256.', 'manifest_invalid');
    }
    names.add(f.name);
    const file = join(fromDir, f.name);
    if (!existsSync(file)) throw new Refused(`Missing backup file ${f.name}.`, 'backup_damaged');
    if (statSync(file).size !== f.size || sha256(file) !== f.sha256) throw new Refused(`The backup file ${f.name} does not match the manifest.`, 'backup_damaged');
  }
  for (const db of DATABASES) if (!names.has(db)) throw new Refused(`The backup does not list ${db}.`, 'manifest_invalid');
  return m;
}

// ------------------------------------------------------------------------------------------------ volumes: files and journals

/**
 * The file operations of the volume backup and the journal engine. The defaults are the real ones; a unit test
 * replaces one of them through the library API to inject a partial copy, an fsync failure or a failed rename (§8).
 */
export const REAL_IO = Object.freeze({
  copyFile: (src, dst) => copyFileSync(src, dst),
  fsyncFile: (p) => { const fd = openSync(p, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } },
  fsyncDir: (d) => fsyncDir(d),
  rename: (src, dst) => renameSync(src, dst),
});

const canonical = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const sameIdentity = (a, b) => a !== null && b !== null && canonical(a) === canonical(b);

/** One regular file as {size, sha256}, or null when absent. A non-regular entry throws (never followed). */
function fileState(p) {
  let st;
  try { st = lstatSync(p); } catch (err) { if (err.code === 'ENOENT') return null; throw err; }
  if (!st.isFile()) throw new Refused(`${p} is not a regular file.`, 'unknown_entry');
  return { size: st.size, sha256: sha256(p) };
}
function readIdentityAt(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/** The database file set of a volume (§8 "File set"): db, -wal, -shm (presence, size, SHA-256). */
export function dbFiles(dir, role) {
  const { db } = VOLUMES[role];
  const out = [];
  for (const name of [db, `${db}-wal`, `${db}-shm`]) {
    const s = fileState(join(dir, name));
    if (s) out.push({ name, ...s });
  }
  return out;
}

/** In place equals a list (every one of the three database names: same presence and bytes) and the identity rule. */
function inPlaceEquals(dir, role, list, identityRule) {
  const want = new Map(list.map((f) => [f.name, f]));
  const { db } = VOLUMES[role];
  for (const name of [db, `${db}-wal`, `${db}-shm`]) {
    const s = fileState(join(dir, name));
    const w = want.get(name);
    if (!s !== !w) return false;
    if (s && (s.size !== w.size || s.sha256 !== w.sha256)) return false;
  }
  const idPath = join(dir, IDENTITY);
  const id = existsSync(idPath) ? readIdentityAt(idPath) : null;
  return identityRule(id, existsSync(idPath));
}

class Unresolved extends Error {}

function journalPath(dir) { return join(dir, JOURNAL); }
function readJournal(dir) {
  const p = journalPath(dir);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { invalid: true }; }
}
function writeJournal(dir, j, state) {
  const next = { ...j, state, updatedAt: new Date().toISOString() };
  writeJsonDurable(dir, JOURNAL, next);
  return next;
}

/**
 * Checked move (§8): one rename inside one volume, then fsync of both folders. The source must have the expected
 * bytes (or, for an identity, the expected content), and the target name must not exist (a collision moves nothing).
 */
function checkedMove(src, dst, expect, io) {
  const st = lstatSync(src);
  if (!st.isFile()) throw new Unresolved(`not a regular file: ${src}`);
  if (expect.identity !== undefined) {
    if (!sameIdentity(readIdentityAt(src), expect.identity)) throw new Unresolved(`identity with other content: ${src}`);
  } else if (st.size !== expect.size || sha256(src) !== expect.sha256) {
    throw new Unresolved(`other bytes: ${src}`);
  }
  let exists = true;
  try { lstatSync(dst); } catch (err) { if (err.code === 'ENOENT') exists = false; else throw err; }
  if (exists) throw new Unresolved(`collision: ${dst}`);
  io.rename(src, dst);
  io.fsyncDir(dirname(src));
  io.fsyncDir(dirname(dst));
}

const isNewIdentity = (id, opId) => Boolean(id) && id.provenance && id.provenance.opId === opId;

// ------------------------------------------------------------------------------------------------ drills

const POINTS = ['prepared-lti', 'prepared', 'staged', 'swap-lti-mid', 'swapped-lti', 'swap-app-mid', 'swapped', 'identity-lti', 'identity-app', 'committed-lti', 'rollback-mid'];

function drillOptions(values, env) {
  const stop = values['stop-after'];
  const pause = values['pause-after'];
  if (!stop && !pause) return { point: () => {} };
  if (stop && pause) throw new Refused('Use --stop-after or --pause-after, not both.', 'usage');
  if (env.STORAGE_DRILL !== '1') throw new Refused('--stop-after and --pause-after are drill options: they need STORAGE_DRILL=1. Nothing was changed.', 'drill_not_enabled');
  const name = stop ?? pause;
  if (!POINTS.includes(name)) throw new Refused(`Unknown drill point ${name}.`, 'usage');
  if (name === 'rollback-mid' && env.STORAGE_DRILL_FAIL !== 'after-swapped') throw new Refused('rollback-mid needs STORAGE_DRILL_FAIL=after-swapped. Nothing was changed.', 'drill_not_enabled');
  const seconds = Number(env.STORAGE_DRILL_PAUSE_SECONDS);
  if (pause && !(Number.isInteger(seconds) && seconds >= 1 && seconds <= 300)) throw new Refused('--pause-after needs STORAGE_DRILL_PAUSE_SECONDS from 1 to 300. Nothing was changed.', 'drill_not_enabled');
  return {
    point: (p, opId, log) => {
      if (p !== name) return;
      if (stop) { log({ event: 'storage_drill_stop', ts: new Date().toISOString(), opId, point: p }); throw Object.assign(new Error('drill stop'), { drillStop: true }); }
      log({ event: 'storage_drill_pause', ts: new Date().toISOString(), opId, point: p, seconds });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
      log({ event: 'storage_drill_resume', ts: new Date().toISOString(), opId, point: p });
    },
  };
}

// ------------------------------------------------------------------------------------------------ the journal engine (§8)

/**
 * The engine over the two volume folders. `dirs` = {lti, app}; `log` writes one JSON line; `point(name)` is the
 * drill hook; `io` the file operations (REAL_IO). Every method throws Unresolved for a failure that must end in
 * `rollback_failed`.
 */
export function createEngine({ dirs, log, point = () => {}, fail = null, io = REAL_IO }) {
  const roles = ['lti', 'app'];
  const restoreDir = (role, opId) => join(dirs[role], `.restore-${opId}`);
  const previousDir = (role, opId) => join(dirs[role], `.previous-${opId}`);

  function verifyBefore(role, j) {
    return inPlaceEquals(dirs[role], role, j.before, (id, present) => (j.identityBefore === null ? !present : sameIdentity(id, j.identityBefore)));
  }
  function verifyAfter(role, j) {
    return inPlaceEquals(dirs[role], role, j.after, (id) => isNewIdentity(id, j.opId) && validIdentity(id, role));
  }

  /** R1/R2 cancel of one volume: drop the staged copies, verify in place = before, write rolled_back. */
  function cancel(role, j) {
    rmSync(restoreDir(role, j.opId), { recursive: true, force: true });
    if (!verifyBefore(role, j)) throw new Unresolved(`${role}: in place differs from before`);
    return writeJournal(dirs[role], j, 'rolled_back');
  }

  /** The R3 order for one volume (§8). */
  function rollbackVolume(role, j, opts = {}) {
    const dir = dirs[role];
    const X = j.opId;
    j = writeJournal(dir, j, 'rolling_back');
    const { db } = VOLUMES[role];
    const before = new Map(j.before.map((f) => [f.name, f]));
    const after = new Map(j.after.map((f) => [f.name, f]));
    mkdirSync(restoreDir(role, X), { recursive: true, mode: 0o700 });
    // Step 2: classify each in-place name; the after-files leave before any before-file comes back.
    for (const name of [db, `${db}-wal`, `${db}-shm`]) {
      const s = fileState(join(dir, name));
      if (!s) continue;
      const b = before.get(name);
      if (b && b.size === s.size && b.sha256 === s.sha256) continue;
      const a = after.get(name);
      if (a && a.size === s.size && a.sha256 === s.sha256) { checkedMove(join(dir, name), join(restoreDir(role, X), name), a, io); continue; }
      throw new Unresolved(`${role}: ${name} has bytes that neither before nor after lists`);
    }
    const idPath = join(dir, IDENTITY);
    if (existsSync(idPath)) {
      const id = readIdentityAt(idPath);
      if (j.identityBefore !== null && sameIdentity(id, j.identityBefore)) { /* keep */ } else if (isNewIdentity(id, X)) {
        checkedMove(idPath, join(restoreDir(role, X), IDENTITY), { identity: id }, io);
      } else {
        throw new Unresolved(`${role}: an identity that neither before nor this operation wrote`);
      }
    }
    // Step 3: the before files back from .previous-X/.
    let first = true;
    for (const f of j.before) {
      if (fileState(join(dir, f.name))) continue;
      checkedMove(join(previousDir(role, X), f.name), join(dir, f.name), f, io);
      if (first && opts.midPoint) { first = false; opts.midPoint(); }
    }
    // Step 4: the old identity.
    if (j.identityBefore !== null && !existsSync(idPath)) {
      const prev = join(previousDir(role, X), IDENTITY);
      if (existsSync(prev)) checkedMove(prev, idPath, { identity: j.identityBefore }, io);
      else writeJsonDurable(dir, IDENTITY, j.identityBefore);
    }
    // Step 5, 6.
    if (!verifyBefore(role, j)) throw new Unresolved(`${role}: after the rollback, in place differs from before`);
    rmSync(restoreDir(role, X), { recursive: true, force: true });
    const prev = previousDir(role, X);
    if (existsSync(prev) && readdirSync(prev).length === 0) rmSync(prev, { recursive: true, force: true });
    fsyncDir(dir);
    return writeJournal(dir, j, 'rolled_back');
  }

  /** R3 for both volumes (lti first). A failure writes rollback_failed to every journal that it can write. */
  function rollbackBoth(js, opts = {}) {
    try {
      for (const role of roles) {
        if (js[role] && js[role].state !== 'rolled_back') {
          js[role] = rollbackVolume(role, js[role], role === 'lti' ? { midPoint: opts.midPoint } : {});
        }
      }
      return 1;
    } catch (err) {
      if (err.drillStop) throw err;
      markFailed(js);
      log({ event: 'storage_restore_unresolved', ts: new Date().toISOString(), opId: js.lti?.opId ?? null, error: String(err.message) });
      return 2;
    }
  }

  function markFailed(js) {
    for (const role of roles) {
      const j = readJournal(dirs[role]) ?? js[role];
      if (!j || j.invalid) continue;
      try { writeJournal(dirs[role], j, 'rollback_failed'); } catch { /* keep going: write every journal that we can */ }
    }
  }

  function cleanupCommitted(opId) {
    for (const role of roles) {
      rmSync(restoreDir(role, opId), { recursive: true, force: true });
      for (const n of readdirSync(dirs[role])) {
        if (/^\.previous-[0-9a-f]{32}$/.test(n) && n !== `.previous-${opId}`) rmSync(join(dirs[role], n), { recursive: true, force: true });
      }
      fsyncDir(dirs[role]);
    }
  }

  /** The commit tail: identities (lti, app), verification, journals (lti, app). */
  function commit(js, newIds) {
    for (const role of roles) {
      if (!isNewIdentity(readIdentityAt(join(dirs[role], IDENTITY)), js[role].opId)) writeJsonDurable(dirs[role], IDENTITY, newIds[role]);
      point(role === 'lti' ? 'identity-lti' : 'identity-app');
    }
    for (const role of roles) if (!verifyAfter(role, js[role])) throw new Error(`${role}: in place differs from after`);
    js.lti = writeJournal(dirs.lti, js.lti, 'committed');
    point('committed-lti');
    js.app = writeJournal(dirs.app, js.app, 'committed');
    cleanupCommitted(js.lti.opId);
  }

  /** The swap of one volume: current files and identity into .previous-X/, then the staged files into place. */
  function swapVolume(role, j) {
    const dir = dirs[role];
    const X = j.opId;
    j = writeJournal(dir, j, 'swapping');
    mkdirSync(previousDir(role, X), { recursive: true, mode: 0o700 });
    const before = new Map(j.before.map((f) => [f.name, f]));
    const { db } = VOLUMES[role];
    for (const name of [db, `${db}-wal`, `${db}-shm`]) {
      const s = fileState(join(dir, name));
      if (!s) continue;
      const b = before.get(name);
      if (!b || b.size !== s.size || b.sha256 !== s.sha256) throw new Error(`${role}: in-place ${name} is not the one of before`);
      checkedMove(join(dir, name), join(previousDir(role, X), name), b, io);
    }
    if (existsSync(join(dir, IDENTITY))) checkedMove(join(dir, IDENTITY), join(previousDir(role, X), IDENTITY), { identity: j.identityBefore }, io);
    point(role === 'lti' ? 'swap-lti-mid' : 'swap-app-mid');
    for (const f of j.after) checkedMove(join(restoreDir(role, X), f.name), join(dir, f.name), f, io);
    return writeJournal(dir, j, 'swapped');
  }

  /**
   * A live restore or import (§8). `plan` = {operation, opId, backupId, manifestSha256, fromDir, filesByRole, newIds,
   * contentCheck}. Returns the exit code.
   */
  function run(plan) {
    const js = {};
    for (const role of roles) {
      const folder = readFolder(dirs[role], role);
      js[role] = {
        formatVersion: 1, operation: plan.operation, opId: plan.opId, backupId: plan.backupId, manifestSha256: plan.manifestSha256,
        pairIdBefore: folder.identity.ok ? folder.identity.value.pairId ?? null : null,
        generationBefore: folder.identity.ok ? folder.identity.value.generation ?? null : null,
        state: 'prepared', before: dbFiles(dirs[role], role), after: plan.filesByRole[role].map(({ name, size, sha256: s }) => ({ name, size, sha256: s })),
        identityBefore: folder.identity.ok ? folder.identity.value : null, updatedAt: new Date().toISOString(),
      };
    }
    // prepared (lti, then app).
    js.lti = writeJournal(dirs.lti, js.lti, 'prepared');
    point('prepared-lti');
    js.app = writeJournal(dirs.app, js.app, 'prepared');
    point('prepared');
    // staged: copy, fsync and verify every listed file into .restore-X/; then the content check.
    try {
      for (const role of roles) {
        mkdirSync(restoreDir(role, plan.opId), { recursive: true, mode: 0o700 });
        for (const f of plan.filesByRole[role]) {
          const dst = join(restoreDir(role, plan.opId), f.name);
          io.copyFile(join(plan.fromDir, VOLUMES[role].folder, f.name), dst);
          io.fsyncFile(dst);
          const s = fileState(dst);
          if (!s || s.size !== f.size || s.sha256 !== f.sha256) throw new Error(`staged copy of ${f.name} does not match the manifest`);
        }
        io.fsyncDir(restoreDir(role, plan.opId));
      }
      const check = plan.contentCheck(join(restoreDir('app', plan.opId), VOLUMES.app.db), restoreDir('app', plan.opId));
      log({ event: 'storage_content_check', ts: new Date().toISOString(), opId: plan.opId, result: check.missing.length ? 'content_missing' : 'pass', checked: check.checked, missing: check.missing });
      if (check.missing.length) throw Object.assign(new Error('content_missing'), { contentMissing: true });
      js.lti = writeJournal(dirs.lti, js.lti, 'staged');
      js.app = writeJournal(dirs.app, js.app, 'staged');
      point('staged');
    } catch (err) {
      if (err.drillStop) throw err;
      try {
        for (const role of roles) js[role] = cancel(role, js[role]);
      } catch {
        markFailed(js);
        return 2;
      }
      log({ event: 'storage_restore_cancelled', ts: new Date().toISOString(), opId: plan.opId, reason: err.contentMissing ? 'content_missing' : String(err.message) });
      return 1;
    }
    // swap (lti, then app), commit; any failure from here on → R3.
    try {
      js.lti = swapVolume('lti', js.lti);
      point('swapped-lti');
      js.app = swapVolume('app', js.app);
      point('swapped');
      if (fail === 'after-swapped') throw new Error('forced failure after swapped (STORAGE_DRILL_FAIL)');
      commit(js, plan.newIds);
      return 0;
    } catch (err) {
      if (err.drillStop) throw err;
      log({ event: 'storage_restore_rollback', ts: new Date().toISOString(), opId: plan.opId, error: String(err.message) });
      return rollbackBoth(js, { midPoint: () => point('rollback-mid') });
    }
  }

  /** The recovery table (§8) from the observed journals. Returns {code, message}. */
  function recover() {
    const lti = readJournal(dirs.lti);
    const app = readJournal(dirs.app);
    const lj = lti && !lti.invalid && journalOf({ journal: { present: true, ok: true, value: lti } });
    const aj = app && !app.invalid && journalOf({ journal: { present: true, ok: true, value: app } });
    const { row } = classifyJournals(lti === null ? null : lj, app === null ? null : aj);
    const js = { lti: lj && !lj.invalid ? lj : null, app: aj && !aj.invalid ? aj : null };
    try {
      if (row === 'R0') return { code: 0, message: 'nothing to recover' };
      if (row === 'R5' || row === 'R6') return { code: 2, message: 'the rollback did not finish; do not start; keep both volumes; use stack:data-quarantine' };
      if (row === 'R1') {
        cancel('lti', js.lti);
        return { code: 1, message: 'cancelled at the first journal write; the targets equal the state before (verified)' };
      }
      if (row === 'R2') {
        for (const role of roles) if (js[role].state !== 'rolled_back') js[role] = cancel(role, js[role]);
        return { code: 1, message: 'cancelled; the targets equal the state before (verified)' };
      }
      if (row === 'R4') {
        const ok = verifyAfter('lti', js.lti) && inPlaceEquals(dirs.app, 'app', js.app.after, (id, present) => !present || (isNewIdentity(id, js.app.opId) && validIdentity(id, 'app')));
        if (ok) {
          const ltiId = readIdentityAt(join(dirs.lti, IDENTITY));
          if (!existsSync(join(dirs.app, IDENTITY))) writeJsonDurable(dirs.app, IDENTITY, { ...ltiId, role: 'app' });
          if (!verifyAfter('app', js.app)) throw new Unresolved('app: in place differs from after');
          js.app = writeJournal(dirs.app, js.app, 'committed');
          cleanupCommitted(js.lti.opId);
          return { code: 0, message: 'commit completed' };
        }
      }
      // R3 (also an R4 pair whose file sets are not equal to after).
      const code = rollbackBoth(js);
      return code === 1 ? { code: 1, message: 'rolled back; the targets equal the state before (verified)' }
        : { code: 2, message: 'the rollback did not finish; do not start; keep both volumes; use stack:data-quarantine' };
    } catch (err) {
      if (err.drillStop) throw err;
      markFailed(js);
      return { code: 2, message: 'the rollback did not finish; do not start; keep both volumes; use stack:data-quarantine' };
    }
  }

  return { run, recover, rollbackBoth, verifyBefore, verifyAfter };
}

/** The content check (§8): every package.storage_path of the staged app database exists as a folder of the content. */
export function contentCheck(stagedDb, stagedDir, contentPackages) {
  const scratch = mkdtempSync(join(tmpdir(), 'cogniate-content-'));
  try {
    for (const n of readdirSync(stagedDir)) if (n === VOLUMES.app.db || n.startsWith(`${VOLUMES.app.db}-`)) copyFileSync(join(stagedDir, n), join(scratch, n));
    const conn = new DatabaseSync(join(scratch, VOLUMES.app.db), { readOnly: true });
    let paths;
    try {
      const has = conn.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'package'").get();
      paths = has ? conn.prepare('SELECT DISTINCT storage_path FROM package ORDER BY storage_path').all().map((r) => String(r.storage_path)) : [];
    } finally {
      conn.close();
    }
    const missing = paths.filter((p) => {
      const m = /^packages\/([^/]+)$/.exec(p);
      if (!m) return true;
      try { return !lstatSync(join(contentPackages, m[1])).isDirectory(); } catch { return true; }
    });
    return { checked: paths.length, missing };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------------------------------------ the volume commands

function logTo(dir) {
  return (line) => {
    process.stdout.write(`${JSON.stringify(line)}\n`);
    try { if (existsSync(dir)) appendFileSync(join(dir, 'storage-maintenance.jsonl'), `${JSON.stringify(line)}\n`); } catch { /* stdout stays the evidence */ }
  };
}

/** The §6 state of the two volumes, as `report` reads it. */
function pairState(dirs, project, ids) {
  return evaluateState({ lti: readFolder(dirs.lti, 'lti'), app: readFolder(dirs.app, 'app') }, { project, hostUid: ids.uid, hostGid: ids.gid });
}

/** §8 volume backup (volumes read-only): state OK, byte copy, re-hash, manifest last. */
export function volumeBackup({ dirs, out, project, revision, ids, io = REAL_IO }) {
  const st = pairState(dirs, project, ids);
  if (st.state !== 'OK') throw new Refused(`backup_source_not_ok:${st.state}. Nothing was copied.`, `backup_source_not_ok:${st.state}`);
  if (existsSync(out) && readdirSync(out).length > 0) throw new Refused('The backup folder is not empty. Nothing was copied.', 'backup_folder_not_empty');
  mkdirSync(out, { recursive: true, mode: 0o700 });
  const files = [];
  const migrations = {};
  let identity = null;
  for (const role of ['lti', 'app']) {
    const { folder, db } = VOLUMES[role];
    mkdirSync(join(out, folder), { recursive: true, mode: 0o700 });
    for (const f of dbFiles(dirs[role], role)) {
      const dst = join(out, folder, f.name);
      io.copyFile(join(dirs[role], f.name), dst);
      chmodSync(dst, 0o600);
      // A partial copy is found here, before the manifest exists (no manifest: not a backup).
      if (sha256(dst) !== f.sha256) throw new Refused(`The copy of ${folder}/${f.name} does not match its source. No manifest was written.`, 'backup_copy_mismatch');
      files.push({ name: `${folder}/${f.name}`, size: f.size, sha256: f.sha256 });
    }
    migrations[`${folder}/${db}`] = migrationNames(dirs[role], db);
    if (role === 'lti') identity = readIdentityAt(join(dirs[role], IDENTITY));
  }
  const manifest = { formatVersion: 1, backupId: randomUUID(), createdAt: new Date().toISOString(), composeProject: project, sourceRevision: revision, files, migrations,
    source: 'volume', pairId: identity.pairId, generation: identity.generation, legacySources: identity.legacySources ?? [] };
  writeManifest(out, manifest);
  validate(out, project);
  return manifest;
}

/** §8 restore and import: step 1 (validation, pair rule, target state), then the journal engine. */
export function volumeRestore({ dirs, from, project, operation, ids, log, drill = { point: () => {} }, fail = null, contentPackages, io = REAL_IO, opId: givenOpId = null }) {
  const m = validate(from, project);
  const manifestSha256 = sha256(join(from, MANIFEST));
  const source = m.source ?? 'legacy';
  const st = pairState(dirs, project, ids);
  const opId = givenOpId ?? randomBytes(16).toString('hex');
  const filesByRole = { lti: [], app: [] };
  for (const f of m.files) {
    const [folder, name] = f.name.split('/');
    filesByRole[folder === 'lti-service' ? 'lti' : 'app'].push({ name, size: f.size, sha256: f.sha256 });
  }
  let pairId;
  let generation;
  let legacySources;
  let provenance;
  // §8 precedence: the whole backup (validated above) → the target state → the source kind → the pair rule.
  const journalRow = ['rollback_failed', 'journal_inconsistent', 'journal_open', 'state_unclassified'].includes(st.state);
  const next = st.state === 'journal_open' ? 'npm run stack:data-restore -- --recover'
    : journalRow ? 'quarantine (npm run stack:data-quarantine)'
      : operation === 'restore' && ['FIRST_START', 'FRESH_INIT_PARTIAL'].includes(st.state) ? 'npm run stack:up to finish the first start'
        : 'quarantine first (npm run stack:data-quarantine, ADR-012 §9)';
  if (operation === 'import') {
    if (st.state !== 'FRESH') throw new Refused(`import_target_not_fresh: the target state is ${st.state}. Import only into a FRESH pair; next: ${next}. Nothing was changed.`, 'import_target_not_fresh');
    if (source !== 'legacy') throw new Refused('import_needs_legacy_backup: a volume backup is restored with `npm run stack:data-restore`, not imported. Nothing was changed.', 'import_needs_legacy_backup');
    pairId = randomBytes(16).toString('hex');
    generation = 1;
    legacySources = m.files.map(({ name, size, sha256: s }) => ({ name, size, sha256: s }));
    provenance = { kind: 'import', opId, backupId: m.backupId, manifestSha256, restoredFromPairId: null, restoredFromGeneration: null };
  } else {
    if (st.state !== 'OK' && st.state !== 'FRESH') throw new Refused(`restore_target_state: the target state is ${st.state}; next: ${next}. Nothing was changed.`, 'restore_target_state');
    if (source === 'legacy') {
      throw st.state === 'FRESH'
        ? new Refused('restore_needs_volume_backup: a legacy backup goes into a FRESH pair with `npm run stack:data-import`. Nothing was changed.', 'restore_needs_volume_backup')
        : new Refused('import_target_not_fresh: a legacy backup needs a FRESH target; the target state is OK. Nothing was changed.', 'import_target_not_fresh');
    }
    if (st.state === 'OK') {
      const target = readIdentityAt(join(dirs.lti, IDENTITY));
      if (target.pairId !== m.pairId) throw new Refused('pair_mismatch: the backup is of another pair. To restore another pair, quarantine first (ADR-012 §9). Nothing was changed.', 'pair_mismatch');
      pairId = target.pairId;
      generation = target.generation + 1;
      legacySources = target.legacySources ?? [];
    } else {
      pairId = m.pairId;
      generation = m.generation + 1;
      legacySources = m.legacySources ?? [];
    }
    provenance = { kind: 'restore', opId, backupId: m.backupId, manifestSha256, restoredFromPairId: m.pairId, restoredFromGeneration: m.generation };
  }
  const id = (role) => ({ formatVersion: 1, composeProject: project, pairId, role, generation, createdAt: new Date().toISOString(), firstStart: 'completed', provenance, legacySources });
  // Step 1 passed: only now a partial `.tmp` file of an earlier identity or journal write is removed (never renamed in).
  for (const role of ['lti', 'app']) {
    for (const n of [`${IDENTITY}.tmp`, `${JOURNAL}.tmp`]) rmSync(join(dirs[role], n), { force: true });
  }
  const engine = createEngine({ dirs, log, point: (p) => drill.point(p, opId, log), fail, io });
  return engine.run({
    operation, opId, backupId: m.backupId, manifestSha256, fromDir: from, filesByRole, newIds: { lti: id('lti'), app: id('app') },
    contentCheck: (stagedDb, stagedDir) => contentCheck(stagedDb, stagedDir, contentPackages),
  });
}

/** §9 step 1: copy every entry of both volumes (manifest last) and verify the copy. Volumes read-only. */
export function quarantineCopy({ dirs, out, project, io = REAL_IO }) {
  if (existsSync(out) && readdirSync(out).length > 0) throw new Refused('The quarantine folder is not empty. Nothing was copied.', 'quarantine_folder_not_empty');
  mkdirSync(out, { recursive: true, mode: 0o700 });
  const files = [];
  const walk = (src, dst, rel) => {
    for (const n of readdirSync(src).sort()) {
      const s = join(src, n);
      const d = join(dst, n);
      const st = lstatSync(s);
      if (st.isSymbolicLink()) { symlinkSync(readlinkSync(s), d); files.push({ name: `${rel}/${n}`, type: 'symlink', target: readlinkSync(s) }); continue; }
      if (st.isDirectory()) { mkdirSync(d, { mode: 0o700 }); files.push({ name: `${rel}/${n}`, type: 'dir' }); walk(s, d, `${rel}/${n}`); continue; }
      if (st.isFile()) { io.copyFile(s, d); chmodSync(d, 0o600); files.push({ name: `${rel}/${n}`, type: 'file', size: st.size, sha256: sha256(s) }); continue; }
      files.push({ name: `${rel}/${n}`, type: 'other' });
    }
  };
  for (const role of ['lti', 'app']) {
    const folder = VOLUMES[role].folder;
    mkdirSync(join(out, folder), { mode: 0o700 });
    walk(dirs[role], join(out, folder), folder);
  }
  // A partial copy is found here, before the manifest exists; stack-data.sh then removes nothing (§9 step 1).
  for (const f of files) if (f.type === 'file' && sha256(join(out, f.name)) !== f.sha256) throw new Refused(`The quarantine copy of ${f.name} does not match. No manifest was written.`, 'quarantine_copy_mismatch');
  const manifest = { formatVersion: 1, kind: 'quarantine', composeProject: project, createdAt: new Date().toISOString(), files };
  writeManifest(out, manifest);
  return { manifest, manifestSha256: sha256(join(out, MANIFEST)) };
}

// ------------------------------------------------------------------------------------------------ CLI

const USAGE = `Usage (internal; the public route is infra/scripts/stack-data.sh; <root> holds lti-service/ and cogniate-app/):
  stack-data.mjs backup --source legacy|volume --out <folder> --data <root> --project <name> [--revision <sha>] [--repo <checkout>]
  stack-data.mjs restore|import --from <folder> --data <root> --project <name> [--content <packages>] [--stop-after <p> | --pause-after <p>]
  stack-data.mjs recover --data <root> --project <name>
  stack-data.mjs quarantine-copy --out <folder> --data <root> --project <name>
  stack-data.mjs legacy-decide --data <infra/.data> --report <file>`;

/** The CLI. Returns the exit code; `env` carries HOST_UID/HOST_GID, STORAGE_LOG_DIR and the drill variables. */
export async function main(argv, { env = process.env } = {}) {
  const [command, ...rest] = argv;
  let values;
  try {
    ({ values } = parseArgs({ args: rest, options: {
      source: { type: 'string' }, out: { type: 'string' }, from: { type: 'string' }, data: { type: 'string' }, project: { type: 'string' },
      revision: { type: 'string' }, repo: { type: 'string' }, report: { type: 'string' }, content: { type: 'string' },
      'stop-after': { type: 'string' }, 'pause-after': { type: 'string' },
    } }));
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    return 2;
  }
  const need = (...names) => names.every((n) => typeof values[n] === 'string' && values[n] !== '');
  // Host side: the legacy scan decision and the legacy-source backup (the bind folders are only read).
  if (command === 'legacy-decide' && need('data', 'report')) {
    const lines = readFileSync(values.report, 'utf8').split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const d = legacyDecide(values.data, lines);
    console.log(JSON.stringify({ event: 'storage_legacy_scan', ts: new Date().toISOString(), ...d }));
    if (d.warning) console.error(`WARNING: ${d.warning}`);
    if (d.result !== 'continue') { console.error(`${d.code}${d.entry ? `: ${d.entry}` : ''}${d.message ? `: ${d.message}` : ''}`); return 1; }
    return 0;
  }
  if (command === 'backup' && values.source === 'legacy' && need('out', 'data', 'project')) {
    try {
      const m = backup({ out: values.out, data: values.data, project: values.project, revision: values.revision ?? 'unknown', repo: values.repo });
      console.log(`Backup ${m.backupId} (source legacy) written to ${resolve(values.out)}: ${m.files.map((f) => f.name).join(', ')}. Keep it outside the checkout; it contains secrets.`);
      return 0;
    } catch (err) {
      if (err instanceof Refused) { console.error(err.message); return 1; }
      throw err;
    }
  }
  // The volume commands (in the maintenance container: --data /check).
  const ok = need('data', 'project') && (
    (command === 'backup' && values.source === 'volume' && need('out'))
    || (['restore', 'import'].includes(command) && need('from'))
    || command === 'recover'
    || (command === 'quarantine-copy' && need('out')));
  if (!ok) { console.error(USAGE); return 2; }
  let ids;
  try { ids = hostIds(env); } catch (err) { console.error(`usage: ${err.message}`); return 2; }
  const root = resolve(values.data);
  const dirs = { lti: join(root, VOLUMES.lti.folder), app: join(root, VOLUMES.app.folder) };
  const log = logTo(env.STORAGE_LOG_DIR ?? '/logs');
  // §4: every maintenance writer does only the volume-side steps as root, keeps a failure in memory, then drops privilege.
  let rootFailure = null;
  for (const role of ['lti', 'app']) rootFailure ??= prepareFolder(dirs[role], role, ids).failure;
  let drill = { point: () => {} };
  try {
    if (['restore', 'import'].includes(command)) drill = drillOptions(values, env);
    else if (values['stop-after'] || values['pause-after']) throw new Refused(`--stop-after and --pause-after are only for restore and import.`, 'usage');
  } catch (err) {
    dropPrivilege(ids);
    console.error(err.message);
    return err.code === 'usage' ? 2 : 1;
  }
  dropPrivilege(ids);
  if (rootFailure) {
    // A fixed §6 code of the volumes comes first; prepare_failed never displaces it (read after the drop).
    let fixed = null;
    try { const st = pairState(dirs, values.project, ids); if (!st.allowed) fixed = st.state; } catch { /* the folders cannot be read */ }
    console.error(`${fixed ? `${fixed}: the target state is ${fixed}. ` : ''}prepare_failed: ${rootFailure}. Nothing was changed.`);
    return 1;
  }
  try {
    if (command === 'backup') {
      const m = volumeBackup({ dirs, out: resolve(values.out), project: values.project, revision: values.revision ?? 'unknown', ids });
      log({ event: 'storage_backup', ts: new Date().toISOString(), backupId: m.backupId, source: 'volume', pairId: m.pairId, generation: m.generation, files: m.files.map((f) => f.name) });
      return 0;
    }
    if (command === 'quarantine-copy') {
      const r = quarantineCopy({ dirs, out: resolve(values.out), project: values.project });
      log({ event: 'storage_quarantine_copy', ts: new Date().toISOString(), manifestSha256: r.manifestSha256, entries: r.manifest.files.length });
      return 0;
    }
    if (command === 'recover') {
      const r = createEngine({ dirs, log }).recover();
      log({ event: 'storage_recover', ts: new Date().toISOString(), code: r.code, message: r.message });
      console.error(r.message);
      return r.code;
    }
    const code = volumeRestore({ dirs, from: resolve(values.from), project: values.project, operation: command, ids, log, drill,
      fail: env.STORAGE_DRILL === '1' ? env.STORAGE_DRILL_FAIL ?? null : null, contentPackages: values.content ?? '/content/packages' });
    const msg = { 0: 'committed', 1: 'cancelled or rolled back; the targets equal the state before (verified)', 2: 'the rollback did not finish; do not start; keep both volumes; use `npm run stack:data-quarantine`' }[code];
    console.error(`${command}: ${msg}`);
    return code;
  } catch (err) {
    if (err.drillStop) return 3;
    if (err instanceof Refused) { console.error(`${err.message}${/no target changed|Nothing was/.test(err.message) ? '' : ' No target changed.'}`); return 1; }
    // Backup and quarantine-copy only read the volumes. A writer with an unexpected failure is unresolved (exit 2):
    // exit 1 follows only a verification, and exit 2 never says "no target changed".
    if (['backup', 'quarantine-copy'].includes(command)) { console.error(`Failed: ${err?.message ?? err}. The volumes were only read.`); return 1; }
    console.error(`Failed: ${err?.message ?? err}. The result is not verified: do not start; run \`npm run stack:data-restore -- --recover\`.`);
    return 2;
  }
}

// Real paths on both sides: Node runs the main module from its real path, so a checkout under a symlink (macOS /tmp,
// /var) must not look like an import (that would exit 0 without a backup).
const isMain = process.argv[1] !== undefined && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err instanceof Refused ? err.message : `Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
