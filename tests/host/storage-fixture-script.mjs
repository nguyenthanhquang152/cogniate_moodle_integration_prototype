#!/usr/bin/env node
// QA's own script inside the storage-fixture, storage-oracle and storage-p5 containers (ADR-012 §11).
// Node built-ins only. It never imports product code. QA's harness decides every oracle from this
// script's JSON output. The same code runs host-only in storage-fixture-script.selftest.mjs.
//   node storage-fixture-script.mjs <op> [--lti <dir>] [--app <dir>] [--out <dir>] [--spec <json>] [--dir <dir>]
// Ops: list | meta | fileset | logical | plant | oracle | p5 | copyout
// Every QA copy and every planted or returned file goes through the helpers of the storage repair triage §7.3:
// an exclusive 0600 create without a link follow, so no copy ever has the source mode or a umask mode.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

export const DB = { lti: 'lti.db', app: 'cogniate.db' };
export const FILESET = (vol) => [DB[vol], `${DB[vol]}-wal`, `${DB[vol]}-shm`, '.storage-identity.json'];
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const out = (value) => process.stdout.write(JSON.stringify(value) + '\n');

// ------------------------------------------------------------ safe paths

/** Makes a relative folder below a root (QA's own output folder only), then resolves it safely. */
export function ensureFolder(root, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.split(/[\\/]/).some((p) => p === '..' || p === ''))
    throw new Error('Unsafe folder path: ' + JSON.stringify(rel));
  let current = root;
  for (const part of rel.split('/')) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) fs.mkdirSync(current, { mode: 0o700 });
    const st = fs.lstatSync(current);
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Error('Folder path goes through a non-directory: ' + rel);
  }
  return current;
}
/** Resolves a relative entry path inside a root. No absolute path, no "..", no symbolic link on the way. */
export function inside(root, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.split(/[\\/]/).some((p) => p === '..' || p === ''))
    throw new Error('Unsafe entry path: ' + JSON.stringify(rel));
  const parts = rel.split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    const st = fs.lstatSync(current);
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Error('Path goes through a non-directory: ' + rel);
  }
  return path.join(root, rel);
}
const exists = (file) => { try { fs.lstatSync(file); return true; } catch { return false; } };

// ------------------------------------------------------------ private copies (triage §7.3)

const { O_APPEND, O_CREAT, O_EXCL, O_NOFOLLOW, O_RDONLY, O_WRONLY } = fs.constants;
const EXCLUSIVE = O_CREAT | O_EXCL | O_NOFOLLOW | O_WRONLY;
const modeOf = (st) => st.mode & 0o7777;
const octal = (mode) => mode.toString(8).padStart(4, '0');
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function writeAll(fd, bytes) { for (let at = 0; at < bytes.length;) at += fs.writeSync(fd, bytes, at, bytes.length - at); }

/** The bytes of a regular file, read through a descriptor that never follows a link. */
export function readRegular(file) {
  const fd = fs.openSync(file, O_RDONLY | O_NOFOLLOW);
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) throw new Error('Not a regular file: ' + file);
    return { bytes: fs.readFileSync(fd), st };
  } finally { fs.closeSync(fd); }
}
/** Exclusive create (O_CREAT|O_EXCL|O_NOFOLLOW, mode 0600). The descriptor is checked before the first byte. */
function createExclusive(target, hook) {
  const fd = fs.openSync(target, EXCLUSIVE, 0o600);
  try {
    const st = fs.fstatSync(fd);
    const created = { target, regular: st.isFile(), mode: octal(modeOf(st)), size: st.size, dev: st.dev, ino: st.ino, uid: st.uid };
    hook?.(created);
    if (!st.isFile() || modeOf(st) !== 0o600 || st.size !== 0) throw new Error(`New file is not an empty 0600 regular file: ${target} (${created.mode}, ${st.size} bytes)`);
    return { fd, st };
  } catch (e) { fs.closeSync(fd); throw e; }
}
/** Private helper: writes a new QA file outside the product volumes, 0600 from creation. */
export function privateWrite(target, bytes, { hook } = {}) {
  const { fd, st } = createExclusive(target, hook);
  try { writeAll(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const now = readRegular(target);
  if (now.st.dev !== st.dev || now.st.ino !== st.ino || modeOf(now.st) !== 0o600 || digest(now.bytes) !== digest(bytes)) throw new Error('Private copy check failed: ' + target);
  return { mode: '0600', size: bytes.length, sha256: digest(bytes), dev: st.dev, ino: st.ino };
}
/** Private helper for a copy: the source mode is returned as a record and never applied to the copy. */
export function privateCopy(source, target, { hook } = {}) {
  const { bytes, st } = readRegular(source);
  return { ...privateWrite(target, bytes, { hook }), sourceMode: octal(modeOf(st) & 0o777) };
}
/** Private helper for a replace (#9): an exclusive 0600 temporary in the target folder, fsync, then rename. */
export function privateReplace(target, bytes, { hook } = {}) {
  const tmp = path.join(path.dirname(target), `.qa-replace-${crypto.randomBytes(8).toString('hex')}`);
  const written = privateWrite(tmp, bytes, { hook });
  fs.renameSync(tmp, target);
  const st = fs.lstatSync(target);
  if (!st.isFile() || st.dev !== written.dev || st.ino !== written.ino || modeOf(st) !== 0o600) throw new Error('Private replace check failed: ' + target);
  return written;
}
/** Into-volume helper: a returned or planted volume file with the recorded original mode or the planted mode. */
export function intoVolumeWrite(target, bytes, mode, { hook } = {}) {
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) throw new Error('A target mode is required: ' + target);
  const { fd, st } = createExclusive(target, hook);
  try { writeAll(fd, bytes); fs.fsyncSync(fd); fs.fchmodSync(fd, mode); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const now = fs.lstatSync(target);
  if (!now.isFile() || now.dev !== st.dev || now.ino !== st.ino || modeOf(now) !== mode || digest(readRegular(target).bytes) !== digest(bytes))
    throw new Error('Into-volume check failed: ' + target);
  return { mode: octal(mode), size: bytes.length, sha256: digest(bytes), dev: st.dev, ino: st.ino };
}
/** Private recursive copy (#12, #13): each folder 0700, each file through the private helper; a link fails, never followed. */
export function privateCopyTree(source, target, { hook } = {}) {
  const top = fs.lstatSync(source);
  if (top.isSymbolicLink() || !top.isDirectory()) throw new Error('Copy source is not a real folder: ' + source);
  const copied = [];
  const walk = (from, to, rel) => {
    fs.mkdirSync(to, { mode: 0o700 }); fs.chmodSync(to, 0o700); // a new empty folder: the mode is explicit, never the umask
    const made = fs.lstatSync(to);
    if (made.isSymbolicLink() || !made.isDirectory() || modeOf(made) !== 0o700) throw new Error('Copy folder is not 0700: ' + to);
    for (const name of fs.readdirSync(from).sort()) {
      const src = path.join(from, name), dst = path.join(to, name), r = rel ? `${rel}/${name}` : name, st = fs.lstatSync(src);
      if (st.isDirectory()) walk(src, dst, r);
      else if (st.isFile()) copied.push({ path: r, ...privateCopy(src, dst, { hook }) });
      else throw new Error(`Copy source holds a ${st.isSymbolicLink() ? 'symbolic link' : 'special file'}: ${r}`);
    }
  };
  walk(source, target, '');
  return copied;
}
/** Private empty file (#14): exclusive 0600 create, no link follow; a regular empty file of this user. Returns its identity. */
export function privateEmptyFile(target, { uid = process.getuid() } = {}) {
  const fd = fs.openSync(target, EXCLUSIVE, 0o600);
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.uid !== uid || modeOf(st) !== 0o600 || st.size !== 0) throw new Error('New capture file is not an empty 0600 regular file of this user: ' + target);
    return { dev: st.dev, ino: st.ino, mode: '0600', size: 0, uid: st.uid };
  } finally { fs.closeSync(fd); }
}
/** The caller's lstat checks of a private empty file: `before` the shell starts, `after` it ends. Returns the problems. */
export function checkCapture(target, id, when) {
  let st;
  try { st = fs.lstatSync(target); } catch (e) { return [`${path.basename(target)}: ${e.code ?? e.message}`]; }
  const problems = [];
  if (st.isSymbolicLink() || !st.isFile()) problems.push('not a regular file');
  if (st.dev !== id.dev || st.ino !== id.ino) problems.push('another device or inode');
  if (modeOf(st) !== 0o600) problems.push('mode ' + octal(modeOf(st)));
  if (when === 'before' && st.size !== 0) problems.push('not empty');
  if (when === 'before' && st.nlink !== 1) problems.push(`${st.nlink} links`);
  return problems.map((p) => `${path.basename(target)} ${when} the shell: ${p}`);
}
// A stash or copy-out folder keeps the source mode of each held file here, so its return can use it.
const HOLD_RECORD = '.qa-hold.json';
function holdRecord(hold) {
  const file = path.join(hold, HOLD_RECORD);
  return exists(file) ? JSON.parse(readRegular(file).bytes.toString('utf8')) : {};
}
function writeHoldRecord(hold, record) {
  const file = path.join(hold, HOLD_RECORD), bytes = Buffer.from(JSON.stringify(record));
  if (exists(file)) privateReplace(file, bytes); else privateWrite(file, bytes);
}

// ------------------------------------------------------------ listing (the "nothing changes" oracle)

function entry(root, rel) {
  const file = rel === '.' ? root : path.join(root, rel);
  const st = fs.lstatSync(file);
  const type = st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : st.isFile() ? 'file' : 'other';
  const e = { path: rel, type, uid: st.uid, gid: st.gid, mode: (st.mode & 0o7777).toString(8).padStart(4, '0') };
  if (type === 'file') Object.assign(e, { size: st.size, sha256: sha(file) });
  if (type === 'symlink') e.target = fs.readlinkSync(file);
  return e;
}
/** Every entry of one volume root and its subfolders, sorted by path. Symbolic links are never followed. */
export function listRoot(root) {
  if (!root || !fs.existsSync(root)) return { state: 'absent', entries: [] };
  const entries = [entry(root, '.')];
  const walk = (relDir) => {
    const dir = relDir === '.' ? root : path.join(root, relDir);
    for (const name of fs.readdirSync(dir).sort()) {
      const rel = relDir === '.' ? name : `${relDir}/${name}`;
      const e = entry(root, rel); entries.push(e);
      if (e.type === 'dir') walk(rel);
    }
  };
  walk('.');
  return { state: 'present', entries };
}
/** Type, owner and mode of named entries through lstat only: no folder read and no link follow (triage §4.0 step 4). */
export function meta(root, names) {
  if (!root || !fs.existsSync(root)) throw new Error('Volume not mounted');
  return names.map((name) => {
    const st = fs.lstatSync(inside(root, name));
    return { path: name, type: st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : st.isFile() ? 'file' : 'other',
      uid: st.uid, gid: st.gid, mode: octal(modeOf(st)) };
  });
}
function readJson(file) {
  if (!fs.existsSync(file)) return { present: false };
  const st = fs.lstatSync(file);
  if (!st.isFile()) return { present: true, error: 'not a regular file' };
  const text = fs.readFileSync(file, 'utf8');
  try { return { present: true, sha256: sha(file), json: JSON.parse(text) }; } catch (e) { return { present: true, sha256: sha(file), error: 'parse: ' + e.message }; }
}
/** The §8 file set of each volume, with the parsed identity and journal. */
export function fileset(roots) {
  const result = {};
  for (const [vol, root] of Object.entries(roots)) {
    if (!root || !fs.existsSync(root)) { result[vol] = { state: 'absent' }; continue; }
    const files = {};
    for (const name of FILESET(vol)) {
      const file = path.join(root, name);
      if (!fs.existsSync(file) && !isLink(file)) { files[name] = { present: false }; continue; }
      const st = fs.lstatSync(file);
      files[name] = st.isFile() ? { present: true, size: st.size, sha256: sha(file) } : { present: true, type: st.isSymbolicLink() ? 'symlink' : 'other' };
    }
    result[vol] = { state: 'present', files, identity: readJson(path.join(root, '.storage-identity.json')),
      journal: readJson(path.join(root, '.storage-journal.json')) };
  }
  return result;
}
function isLink(file) { try { return fs.lstatSync(file).isSymbolicLink(); } catch { return false; } }

// ------------------------------------------------------------ logical rows (copies only)

/**
 * Copies a database with its present sidecars into a new scratch folder under `scratchBase`, opens only the copy,
 * and finds QA's marker strings in any text column. `scratchBase` has no default: in the fixture container it is
 * the container's own writable layer (main), on the host a lane private scratch folder.
 */
export async function logicalRead(root, db, { markers = [], migrations = false, integrity = false, scratchBase, hook } = {}) {
  if (typeof scratchBase !== 'string' || !path.isAbsolute(scratchBase)) throw new Error('logicalRead needs an absolute scratchBase');
  const source = path.join(root, db);
  if (!fs.existsSync(source)) return { present: false };
  const { DatabaseSync } = await import('node:sqlite');
  const scratch = fs.mkdtempSync(path.join(scratchBase, 'qa-logical-'));
  try {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = source + suffix;
      if (fs.existsSync(file) && fs.lstatSync(file).isFile()) privateCopy(file, path.join(scratch, db + suffix), { hook });
    }
    const copy = new DatabaseSync(path.join(scratch, db));
    try {
      const found = Object.fromEntries(markers.map((m) => [m, 0]));
      const tables = copy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((t) => t.name);
      for (const table of tables) {
        const quoted = '"' + table.replaceAll('"', '""') + '"';
        const columns = copy.prepare(`PRAGMA table_info(${quoted})`).all().map((c) => c.name);
        for (const column of columns) {
          const col = '"' + column.replaceAll('"', '""') + '"';
          for (const marker of markers) {
            const n = copy.prepare(`SELECT count(*) AS n FROM ${quoted} WHERE typeof(${col}) = 'text' AND instr(${col}, ?) > 0`).get(marker).n;
            found[marker] += Number(n);
          }
        }
      }
      const result = { present: true, markers: found, tables: tables.length };
      if (migrations) result.schemaMigration = tables.includes('schema_migration')
        ? copy.prepare('SELECT name FROM schema_migration ORDER BY name').all().map((r) => r.name) : null;
      if (integrity) result.integrity = copy.prepare('PRAGMA integrity_check').all().map((r) => Object.values(r)[0]);
      return result;
    } finally { copy.close(); }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

// ------------------------------------------------------------ write fixtures (write mode only)

/**
 * Applies QA's planted changes in order. Every op names one entry; nothing is recursive. A planted or returned
 * file goes through the into-volume helper; a held copy through the private helper (`hook` sees each create).
 */
export function plant(roots, ops, { outDir, hook } = {}) {
  const root = (vol) => { const r = roots[vol]; if (!r || !fs.existsSync(r)) throw new Error('Volume not mounted: ' + vol); return r; };
  const results = [];
  for (const op of ops) {
    const file = op.path ? inside(root(op.vol), op.path) : null;
    switch (op.op) {
      case 'write': {
        if (fs.existsSync(file) || isLink(file)) throw new Error('write target exists: ' + op.path);
        intoVolumeWrite(file, Buffer.from(op.base64 ?? '', 'base64'), Number.parseInt(op.mode ?? '0600', 8), { hook });
        break;
      }
      case 'remove': {
        const st = fs.lstatSync(file);
        if (st.isDirectory()) fs.rmdirSync(file); else fs.unlinkSync(file);
        break;
      }
      case 'flip': {
        const st = fs.lstatSync(file);
        if (!st.isFile()) throw new Error('flip needs a regular file');
        const fd = fs.openSync(file, 'r+');
        try {
          const offset = Math.min(op.offset ?? 0, Math.max(0, st.size - 1));
          const b = Buffer.alloc(1); fs.readSync(fd, b, 0, 1, offset); b[0] ^= 0x01; fs.writeSync(fd, b, 0, 1, offset); fs.fsyncSync(fd);
        } finally { fs.closeSync(fd); }
        break;
      }
      case 'symlink': fs.symlinkSync(op.target, file); break;
      case 'chown': fs.lchownSync(file, op.uid, op.gid); break;
      case 'chmod': fs.chmodSync(file, Number.parseInt(op.mode, 8)); break;
      case 'mkdir': fs.mkdirSync(file, { mode: Number.parseInt(op.mode ?? '0700', 8) }); break;
      case 'copy': {
        const from = inside(root(op.fromVol), op.from);
        if (!fs.lstatSync(from).isFile()) throw new Error('copy needs a regular file');
        if (exists(file)) throw new Error('copy target exists: ' + op.path);
        const { bytes, st } = readRegular(from);
        intoVolumeWrite(file, bytes, op.mode ? Number.parseInt(op.mode, 8) : modeOf(st) & 0o777, { hook });
        break;
      }
      case 'stash': case 'unstash': {
        if (!outDir) throw new Error('stash needs the output folder');
        const hold = ensureFolder(outDir, op.hold);
        const record = holdRecord(hold), moved = [];
        for (const name of op.names) {
          const vfile = inside(root(op.vol), name), hfile = path.join(hold, name);
          const [from, to] = op.op === 'stash' ? [vfile, hfile] : [hfile, vfile];
          if (!exists(from)) continue;
          if (exists(to)) throw new Error('target exists: ' + name);
          if (op.op === 'stash') {
            const held = privateCopy(from, to, { hook });
            record[name] = { mode: held.sourceMode, size: held.size, sha256: held.sha256 };
            fs.unlinkSync(from);
            moved.push({ name, sha256: held.sha256, mode: held.sourceMode });
          } else {
            const kept = record[name];
            if (!kept) throw new Error('No recorded original mode for ' + name);
            const { bytes } = readRegular(from);
            if (digest(bytes) !== kept.sha256) throw new Error('copy not equal: ' + name);
            const back = intoVolumeWrite(to, bytes, Number.parseInt(kept.mode, 8), { hook });
            fs.unlinkSync(from);
            moved.push({ name, sha256: back.sha256, mode: back.mode });
          }
        }
        if (op.op === 'stash') writeHoldRecord(hold, record);
        results.push({ op: op.op, moved });
        continue;
      }
      case 'editjson': {
        const st = fs.lstatSync(file);
        if (!st.isFile()) throw new Error('editjson needs a regular file');
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        Object.assign(value, op.set ?? {});
        const tmp = path.join(path.dirname(file), `.qa-edit-${crypto.randomBytes(4).toString('hex')}`);
        intoVolumeWrite(tmp, Buffer.from(JSON.stringify(value)), modeOf(st) & 0o777, { hook });
        fs.renameSync(tmp, file);
        break;
      }
      case 'rawwrite': {
        const st = fs.lstatSync(file);
        if (!st.isFile()) throw new Error('rawwrite needs a regular file');
        fs.writeFileSync(file, op.text);
        break;
      }
      default: throw new Error('Unknown plant op ' + op.op);
    }
    results.push({ op: op.op, vol: op.vol, path: op.path });
  }
  return results;
}
/** Copies named regular files of one volume into the output folder (0600 copies); returns hashes and source modes. */
export function copyOut(roots, { vol, names, folder }, outDir, { hook } = {}) {
  const target = ensureFolder(outDir, folder);
  const record = holdRecord(target), copied = [];
  for (const name of names) {
    const from = inside(roots[vol], name);
    if (!fs.existsSync(from)) continue;
    if (!fs.lstatSync(from).isFile()) throw new Error('copyout needs a regular file: ' + name);
    const held = privateCopy(from, path.join(target, name), { hook });
    record[name] = { mode: held.sourceMode, size: held.size, sha256: held.sha256 };
    copied.push({ name, size: held.size, sha256: held.sha256, mode: held.sourceMode });
  }
  writeHoldRecord(target, record);
  return copied;
}

// ------------------------------------------------------------ P5 (ADR-012 §11 storage-p5)

/** The approved T5b P5 write: delete exactly one failed score sync row in cogniate.db (app stopped). */
export async function p5Delete(appRoot, syncId) {
  if (!/^sync_[A-Za-z0-9_-]+$/.test(syncId ?? '')) throw new Error('Invalid sync id');
  const file = path.join(appRoot, 'cogniate.db');
  if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) throw new Error('QA database missing or symlinked');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('score_sync','score_syncs')").all();
      if (tables.length !== 1) throw new Error('Expected one score-sync table');
      const table = tables[0].name;
      const row = db.prepare(`SELECT id, status FROM ${table} WHERE id=?`).get(syncId);
      if (row?.status !== 'failed') throw new Error('P5 higher row must already be failed');
      const deleted = db.prepare(`DELETE FROM ${table} WHERE id=? AND status='failed'`).run(syncId);
      if (Number(deleted.changes) !== 1) throw new Error('P5 must delete exactly one row');
      db.exec('COMMIT');
      return { deletedSyncId: syncId, deletedCount: Number(deleted.changes) };
    } catch (err) { db.exec('ROLLBACK'); throw err; }
  } finally { db.close(); }
}

// ------------------------------------------------------------ QA's two-process WAL lock oracle

const self = fileURLToPath(import.meta.url);
async function openDb(file) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout = 0');
  return db;
}
const sqliteError = (e) => ({ name: e?.name, code: e?.code, errcode: e?.errcode, errstr: e?.errstr, message: String(e?.message ?? e).slice(0, 160) });
async function oracleChild(role, file) {
  if (role === 'oracle-A') {
    const db = await openDb(file);
    const journal = db.prepare('PRAGMA journal_mode').get().journal_mode;
    db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO t (who) VALUES (?)').run('A');
    out({ role: 'A', event: 'READY', pid: process.pid, journal });
    for await (const line of readline.createInterface({ input: process.stdin })) {
      if (line === 'PING') out({ role: 'A', event: 'PONG', inTransaction: db.isTransaction ?? null, rowsSeenByA: db.prepare('SELECT count(*) AS n FROM t').get().n });
      else if (line === 'RELEASE') { db.exec('COMMIT'); db.close(); out({ role: 'A', event: 'RELEASED' }); process.exit(0); }
    }
    process.exit(3);
  }
  if (role === 'oracle-B') {
    // Controlled negative of the oracle's decision path (host self-test only): the contender writes a separate
    // copy of the file, so it shares no lock with A; the oracle must classify that as "not enforced".
    const negative = process.env.QA_ORACLE_NEGATIVE_CONTROL === 'separate-file';
    // Site #7: a private copy (exclusive create), one per contender process. A host self-test may name an existing private
    // file in QA_ORACLE_CREATE_OBSERVE: the creation check is then appended there as one JSON line (never created here).
    const separate = `${file}.qa-negative-${process.pid}`, observe = process.env.QA_ORACLE_CREATE_OBSERVE;
    const hook = observe ? (created) => { const fd = fs.openSync(observe, O_WRONLY | O_APPEND | O_NOFOLLOW); try { writeAll(fd, Buffer.from(JSON.stringify(created) + '\n')); } finally { fs.closeSync(fd); } } : undefined;
    if (negative) privateCopy(file, separate, { hook });
    const db = await openDb(negative ? separate : file);
    try {
      db.exec('BEGIN IMMEDIATE'); db.prepare('INSERT INTO t (who) VALUES (?)').run('B'); db.exec('COMMIT');
      db.close(); out({ role: 'B', event: 'ACQUIRED' }); process.exit(2);
    } catch (e) { try { db.close(); } catch { /* after refusal */ } out({ role: 'B', event: 'REFUSED', error: sqliteError(e) }); process.exit(0); }
  }
}
/**
 * In `dir`, a holder A takes the WAL write lock and holds it; a contender B with busy timeout 0 must get the
 * extended code 5; then A releases and a new B must succeed (positive control). Every wait has a deadline.
 */
export async function lockOracle(dir, { deadlineMs = 20_000 } = {}) {
  const file = path.join(dir, 't.db');
  const r = { dir, file };
  const children = [];
  const deadline = (p, what) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('deadline: ' + what)), deadlineMs);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
  const child = (role) => {
    const p = spawn(process.execPath, ['--no-warnings', self, role, '--file', file], { stdio: ['pipe', 'pipe', 'pipe'] });
    children.push(p);
    const lines = [], waiters = [];
    readline.createInterface({ input: p.stdout }).on('line', (l) => { let v; try { v = JSON.parse(l); } catch { v = { raw: l.slice(0, 160) }; } lines.push(v); for (const w of [...waiters]) w(); });
    let stderr = ''; p.stderr.on('data', (d) => { stderr += d; });
    const exited = new Promise((resolve) => p.on('close', (code, signal) => resolve({ code, signal })));
    const next = (events) => new Promise((resolve, reject) => {
      let timer = null;
      const check = () => { const hit = lines.find((x) => events.includes(x.event)); if (!hit) return false;
        clearTimeout(timer); waiters.splice(waiters.indexOf(check), 1); lines.splice(lines.indexOf(hit), 1); resolve(hit); return true; };
      if (check()) return;
      timer = setTimeout(() => { waiters.splice(waiters.indexOf(check), 1); reject(new Error(`deadline waiting for ${role} ${events}`)); }, deadlineMs);
      waiters.push(check);
    });
    return { p, next, exited: () => deadline(exited, role + ' exit'), stderr: () => stderr.slice(0, 300),
      alive: () => { try { process.kill(p.pid, 0); return p.exitCode === null; } catch { return false; } } };
  };
  try {
    fs.mkdirSync(dir, { recursive: true });
    const { DatabaseSync } = await import('node:sqlite');
    const setup = new DatabaseSync(file);
    r.journalMode = setup.prepare('PRAGMA journal_mode = WAL').get().journal_mode;
    setup.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, who TEXT)'); setup.close();
    const A = child('oracle-A');
    r.aReady = await A.next(['READY']);
    A.p.stdin.write('PING\n'); r.aBefore = { ...(await A.next(['PONG'])), alive: A.alive() };
    const B = child('oracle-B');
    r.bWhileHeld = { ...(await B.next(['ACQUIRED', 'REFUSED'])), exit: await B.exited(), stderr: B.stderr() };
    A.p.stdin.write('PING\n'); r.aAfter = { ...(await A.next(['PONG'])), alive: A.alive() };
    A.p.stdin.write('RELEASE\n');
    try { r.aReleased = { ...(await A.next(['RELEASED'])), exit: await A.exited() }; }
    catch (e) { r.aReleased = { event: 'NOT_RELEASED', error: sqliteError(e) }; A.p.kill('SIGKILL'); await A.exited(); }
    const P = child('oracle-B');
    r.positiveControl = { ...(await P.next(['ACQUIRED', 'REFUSED'])), exit: await P.exited() };
    const holding = (pong) => pong.alive && (pong.inTransaction === true || (pong.inTransaction === null && pong.rowsSeenByA === 1));
    const held = holding(r.aBefore) && holding(r.aAfter);
    const code5 = r.bWhileHeld.event === 'REFUSED' && r.bWhileHeld.error?.errcode === 5;
    r.verdict = !held ? 'INCONCLUSIVE (A did not stay alive and holding)'
      : r.bWhileHeld.event === 'ACQUIRED' ? 'LOCK NOT ENFORCED (B acquired while A held)'
        : !code5 ? 'INCONCLUSIVE (B failed for a reason other than the extended code 5)'
          : r.positiveControl.event !== 'ACQUIRED' ? 'INCONCLUSIVE (positive control failed)'
            : r.aReleased.event !== 'RELEASED' ? 'INCONCLUSIVE (A could not commit)'
              : 'LOCK ENFORCED (B refused while A held)';
  } catch (e) {
    r.verdict = 'INCONCLUSIVE (error)'; r.error = sqliteError(e);
  } finally {
    for (const c of children) if (c.exitCode === null) c.kill('SIGKILL');
  }
  return r;
}

// ------------------------------------------------------------ command line

function parse(argv) {
  const [op, ...rest] = argv;
  const opt = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith('--')) throw new Error('Bad argument ' + rest[i]);
    opt[rest[i].slice(2)] = rest[i + 1];
  }
  return { op, opt };
}
async function main(argv) {
  const { op, opt } = parse(argv);
  if (op === 'oracle-A' || op === 'oracle-B') return oracleChild(op, opt.file);
  const spec = opt.spec ? JSON.parse(Buffer.from(opt.spec, 'base64').toString('utf8')) : {};
  const roots = { lti: opt.lti, app: opt.app };
  switch (op) {
    case 'list': return out({ op, lti: listRoot(roots.lti), app: listRoot(roots.app) });
    case 'meta': return out({ op, entries: meta(roots[spec.vol], spec.names ?? []) });
    case 'fileset': return out({ op, ...fileset(Object.fromEntries(Object.entries(roots).filter(([, v]) => v))) });
    case 'logical': {
      const result = { op };
      // The container's own writable layer, set after the spec, so a spec value never chooses the scratch folder.
      for (const vol of ['lti', 'app']) if (roots[vol]) result[vol] = await logicalRead(roots[vol], DB[vol], { ...spec, scratchBase: os.tmpdir() });
      return out(result);
    }
    case 'plant': return out({ op, results: plant(roots, spec.ops ?? [], { outDir: opt.out }) });
    case 'copyout': return out({ op, copied: copyOut(roots, spec, opt.out) });
    case 'oracle': {
      const base = opt.dir ?? opt.lti ?? opt.app;
      if (!base) throw new Error('--dir, --lti or --app required');
      // Inside a lane volume the oracle uses only .qa-scratch-<16 hex>/ and removes it (§11).
      const scratch = spec.scratch ? path.join(base, spec.scratch) : base;
      if (spec.scratch && !/^\.qa-scratch-[0-9a-f]{16}$/.test(spec.scratch)) throw new Error('Bad scratch name');
      const result = await lockOracle(scratch);
      if (spec.scratch) fs.rmSync(scratch, { recursive: true, force: true });
      else for (const name of fs.readdirSync(scratch)) fs.rmSync(path.join(scratch, name), { force: true });
      result.scratchRemoved = spec.scratch ? !fs.existsSync(scratch) : fs.readdirSync(scratch).length === 0;
      return out({ op, ...result });
    }
    case 'p5': return out({ op, ...(await p5Delete(roots.app, spec.syncId)) });
    default: throw new Error('Unknown op ' + op);
  }
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(self)) {
  main(process.argv.slice(2)).catch((e) => { out({ error: String(e?.message ?? e) }); process.exit(1); });
}
