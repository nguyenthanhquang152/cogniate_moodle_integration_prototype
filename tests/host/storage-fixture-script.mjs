#!/usr/bin/env node
// QA's own script inside the storage-fixture, storage-oracle and storage-p5 containers (ADR-012 §11).
// Node built-ins only. It never imports product code. QA's harness decides every oracle from this
// script's JSON output. The same code runs host-only in storage-fixture-script.selftest.mjs.
//   node storage-fixture-script.mjs <op> [--lti <dir>] [--app <dir>] [--out <dir>] [--spec <json>] [--dir <dir>]
// Ops: list | fileset | logical | plant | oracle | p5 | copyout
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
 * Copies a database with its present sidecars into a new scratch folder of this container's own
 * writable layer, opens only the copy, and finds QA's marker strings in any text column.
 */
export async function logicalRead(root, db, { markers = [], migrations = false, integrity = false, scratchBase = os.tmpdir() } = {}) {
  const source = path.join(root, db);
  if (!fs.existsSync(source)) return { present: false };
  const { DatabaseSync } = await import('node:sqlite');
  const scratch = fs.mkdtempSync(path.join(scratchBase, 'qa-logical-'));
  try {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = source + suffix;
      if (fs.existsSync(file) && fs.lstatSync(file).isFile()) fs.copyFileSync(file, path.join(scratch, db + suffix));
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

/** Applies QA's planted changes in order. Every op names one entry; nothing is recursive. */
export function plant(roots, ops, { outDir } = {}) {
  const root = (vol) => { const r = roots[vol]; if (!r || !fs.existsSync(r)) throw new Error('Volume not mounted: ' + vol); return r; };
  const results = [];
  for (const op of ops) {
    const file = op.path ? inside(root(op.vol), op.path) : null;
    switch (op.op) {
      case 'write': {
        if (fs.existsSync(file) || isLink(file)) throw new Error('write target exists: ' + op.path);
        fs.writeFileSync(file, Buffer.from(op.base64 ?? '', 'base64'), { mode: Number.parseInt(op.mode ?? '0600', 8), flag: 'wx' });
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
        fs.copyFileSync(from, file, fs.constants.COPYFILE_EXCL);
        break;
      }
      case 'stash': case 'unstash': {
        if (!outDir) throw new Error('stash needs the output folder');
        const hold = ensureFolder(outDir, op.hold);
        const moved = [];
        for (const name of op.names) {
          const vfile = inside(root(op.vol), name), hfile = path.join(hold, name);
          const [from, to] = op.op === 'stash' ? [vfile, hfile] : [hfile, vfile];
          if (!fs.existsSync(from)) continue;
          if (fs.existsSync(to) || isLink(to)) throw new Error('target exists: ' + name);
          const digest = sha(from);
          fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
          if (sha(to) !== digest) throw new Error('copy not equal: ' + name);
          fs.unlinkSync(from);
          moved.push({ name, sha256: digest });
        }
        results.push({ op: op.op, moved });
        continue;
      }
      case 'editjson': {
        const st = fs.lstatSync(file);
        if (!st.isFile()) throw new Error('editjson needs a regular file');
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        Object.assign(value, op.set ?? {});
        const tmp = path.join(path.dirname(file), `.qa-edit-${crypto.randomBytes(4).toString('hex')}`);
        fs.writeFileSync(tmp, JSON.stringify(value), { mode: st.mode & 0o777, flag: 'wx' });
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
/** Copies named regular files of one volume into the output folder, with their hashes. */
export function copyOut(roots, { vol, names, folder }, outDir) {
  const target = ensureFolder(outDir, folder);
  const copied = [];
  for (const name of names) {
    const from = inside(roots[vol], name);
    if (!fs.existsSync(from)) continue;
    if (!fs.lstatSync(from).isFile()) throw new Error('copyout needs a regular file: ' + name);
    const to = path.join(target, name);
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    const mode = fs.lstatSync(from).mode & 0o777;
    fs.chmodSync(to, mode);
    copied.push({ name, size: fs.statSync(to).size, sha256: sha(to), mode: mode.toString(8).padStart(4, '0') });
  }
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
    if (negative) fs.copyFileSync(file, file + '.qa-negative');
    const db = await openDb(negative ? file + '.qa-negative' : file);
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
    case 'fileset': return out({ op, ...fileset(Object.fromEntries(Object.entries(roots).filter(([, v]) => v))) });
    case 'logical': {
      const result = { op };
      for (const vol of ['lti', 'app']) if (roots[vol]) result[vol] = await logicalRead(roots[vol], DB[vol], spec);
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
