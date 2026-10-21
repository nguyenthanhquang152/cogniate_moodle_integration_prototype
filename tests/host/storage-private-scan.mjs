// Scans of QA's private data (storage repair triage revision 4 §7.4, §7.5). Host only. The scan reads lstat only,
// never follows a symbolic link, and hashes only a hit. A hit makes its step FAIL; one bounded correction may then
// set the same inode to 0600. A correction never deletes a file and never turns a FAIL into a PASS.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { StorageFail } from './storage-docker.mjs';

/** A refused correction or a failed cleanup: the phase stops (triage §4.3, §7.5 step 4). */
export class PhaseAbort extends StorageFail { constructor(message) { super(message); this.name = 'PhaseAbort'; } }

/** The five folders of a lane private root, and the four private data areas among them. */
export const ROOT_ENTRIES = ['backups', 'bin', 'out', 'quarantine', 'scratch'];
export const DATA_AREAS = ['out', 'backups', 'quarantine', 'scratch'];
const modeOf = (st) => st.mode & 0o7777;
const octal = (mode) => mode.toString(8).padStart(4, '0');
const typeOf = (st) => (st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : st.isFile() ? 'file' : 'other');
const { O_NOFOLLOW, O_RDONLY } = fs.constants;

/** Hash of a regular file through a descriptor that never follows a link; null when it cannot be read. */
function hashNoFollow(file) {
  let fd;
  try { fd = fs.openSync(file, O_RDONLY | O_NOFOLLOW); } catch { return null; }
  try { return fs.fstatSync(fd).isFile() ? crypto.createHash('sha256').update(fs.readFileSync(fd)).digest('hex') : null; }
  finally { fs.closeSync(fd); }
}
/** The protected classes of §7.2, by name. `rel` is relative to a clone or an area. */
export function protectedClass(rel) {
  const name = path.basename(rel), posix = rel.split(path.sep).join('/');
  if (/\.db(-wal|-shm|-journal)?$/.test(name)) return 'database';
  if (name === '.storage-identity.json' || name === '.storage-journal.json') return 'identity or journal';
  if (name === 'manifest.json' || name === 'quarantine.json') return 'backup or quarantine record';
  if (name === '.env') return 'env';
  if (/\.(key|pem|crt)$/.test(name)) return 'key or certificate';
  if (/(^|\/)infra\/\.secrets\//.test(posix)) return 'secret';
  return null;
}
function hitRecord(area, rel, abs, st) {
  return { area, path: rel, abs, type: typeOf(st), mode: octal(modeOf(st)), size: st.size, uid: st.uid,
    sha256: st.isFile() ? hashNoFollow(abs) : null, dev: st.dev, ino: st.ino };
}

/**
 * The folders from `base` down to `base/rel` ('' = `base` only), each read with lstat: a directory, not a link, of the
 * host user. Returns { chain: [{ rel, dev, ino }] }, { absent: rel } or { problem: '<rel> (<reason>)' }.
 */
function realChain(base, rel, uid) {
  const parts = rel ? rel.split(path.sep) : [], chain = [];
  for (let i = 0; i <= parts.length; i++) {
    const r = parts.slice(0, i).join('/') || '.';
    let st;
    try { st = fs.lstatSync(path.join(base, ...parts.slice(0, i))); } catch (e) { return e.code === 'ENOENT' ? { absent: r } : { problem: `${r} (${e.code ?? e.message})` }; }
    if (st.isSymbolicLink() || !st.isDirectory()) return { problem: `${r} (${typeOf(st)})` };
    if (st.uid !== uid) return { problem: `${r} (owner ${st.uid})` };
    chain.push({ rel: r, dev: st.dev, ino: st.ino });
  }
  return { chain };
}
/** The first change of recorded folders `{ base, chain }` (a link, another type, owner, device or inode), or null. */
export function folderChange({ base, chain }, uid) {
  for (const c of chain) {
    let st;
    try { st = fs.lstatSync(path.join(base, c.rel)); } catch (e) { return `${c.rel} (${e.code ?? e.message})`; }
    if (st.isSymbolicLink() || !st.isDirectory()) return `${c.rel} (${typeOf(st)})`;
    if (st.uid !== uid) return `${c.rel} (owner ${st.uid})`;
    if (st.dev !== c.dev || st.ino !== c.ino) return `${c.rel} (another device or inode)`;
  }
  return null;
}
/** The hit's own path: still a regular file with the recorded device and inode, or the change. */
function pathChange(hit) {
  const rel = path.relative(hit.base, hit.abs);
  let st;
  try { st = fs.lstatSync(hit.abs); } catch (e) { return `${rel} (${e.code ?? e.message})`; }
  if (st.isSymbolicLink() || !st.isFile()) return `${rel} (${typeOf(st)})`;
  return st.dev !== hit.dev || st.ino !== hit.ino ? `${rel} (another device or inode)` : null;
}
const lexists = (file) => { try { fs.lstatSync(file); return true; } catch { return false; } };

/**
 * A private data area: every regular file, whoever made it, has no group or other bit. No name exemption. The root and
 * the folders from `base` to it must be real folders of the host user (lstat); else nothing is walked (`scanned` false).
 * Each hit keeps its folders from `base` (device and inode) for the correction.
 */
export function scanTree(root, area, { uid = process.getuid(), base = root } = {}) {
  const hits = [], problems = [];
  const top = realChain(base, path.relative(base, root), uid);
  if (!top.chain) { problems.push(`${area}: not scanned: ${top.problem ?? `${top.absent} (missing)`}`); return { hits, problems, scanned: false }; }
  const walk = (dir, rel, chain) => {
    let names;
    try { names = fs.readdirSync(dir).sort(); } catch (e) { problems.push(`${area}: cannot read ${rel || '.'} (${e.code ?? e.message})`); return; }
    for (const name of names) {
      const abs = path.join(dir, name), r = rel ? `${rel}/${name}` : name;
      let st;
      try { st = fs.lstatSync(abs); } catch (e) { problems.push(`${area}: cannot lstat ${r} (${e.code ?? e.message})`); continue; }
      if (st.isDirectory()) walk(abs, r, [...chain, { rel: path.relative(base, abs), dev: st.dev, ino: st.ino }]);
      else if (st.isFile() && (modeOf(st) & 0o077) !== 0) hits.push({ ...hitRecord(area, r, abs, st), base, chain });
    }
  };
  walk(root, '', top.chain);
  return { hits, problems, scanned: true, chain: top.chain };
}
/** Lane private root closure: exactly the five folders; the root and each one a real 0700 directory of the host user. */
export function rootClosure(root, { uid }) {
  const problems = [];
  const real = (file, label) => {
    let st;
    try { st = fs.lstatSync(file); } catch { problems.push(`private root not closed: ${label} (missing)`); return; }
    if (st.isSymbolicLink() || !st.isDirectory()) problems.push(`private root not closed: ${label} (${typeOf(st)})`);
    else if (st.uid !== uid) problems.push(`private root not closed: ${label} (owner ${st.uid})`);
    else if (modeOf(st) !== 0o700) problems.push(`private root not closed: ${label} (mode ${octal(modeOf(st))})`);
  };
  real(root, '.');
  let names;
  try { names = fs.readdirSync(root).sort(); } catch (e) { problems.push(`private root not closed: . (${e.code ?? e.message})`); return problems; }
  for (const name of names) if (!ROOT_ENTRIES.includes(name)) problems.push(`private root not closed: ${name}`);
  for (const name of ROOT_ENTRIES) real(path.join(root, name), name);
  return problems;
}
/** `bin/` holds exactly the fixture script: a regular file with the digest that boot() recorded, mode 0555. */
export function binRule(bin, { script, sha256 }) {
  const problems = [];
  let names;
  try { names = fs.readdirSync(bin).sort(); } catch (e) { return [`bin/ cannot be read (${e.code ?? e.message})`]; }
  if (names.length !== 1 || names[0] !== script) problems.push(`bin/ must hold exactly ${script}: ${names.join(', ') || 'nothing'}`);
  let st;
  try { st = fs.lstatSync(path.join(bin, script)); } catch { problems.push(`bin/${script} is missing`); return problems; }
  if (st.isSymbolicLink() || !st.isFile()) problems.push(`bin/${script} is not a regular file`);
  else {
    if (modeOf(st) !== 0o555) problems.push(`bin/${script} has mode ${octal(modeOf(st))}, not 0555`);
    if (!sha256 || hashNoFollow(path.join(bin, script)) !== sha256) problems.push(`bin/${script} differs from the digest of boot()`);
  }
  return problems;
}
/**
 * Outside the areas: the direct entries of the two legacy placement folders of the clone and every path of QA's
 * write ledger. Each protected-class file must be a regular file of the host user with no group or other bit.
 */
export function scanOutside(clone, ledger, { uid }) {
  const hits = [], problems = [], files = new Map();
  // The clone, infra and infra/.data must be real folders of the host user; a link on the way is never followed.
  const data = realChain(clone, path.join('infra', '.data'), uid);
  for (const service of ['lti-service', 'cogniate-app']) {
    if (data.absent) continue;
    if (!data.chain) { problems.push(`outside: infra/.data/${service}: not scanned: ${data.problem}`); continue; }
    const dir = path.join(clone, 'infra/.data', service);
    let st = null;
    try { st = fs.lstatSync(dir); } catch (e) { if (e.code !== 'ENOENT') problems.push(`outside: cannot lstat infra/.data/${service} (${e.code})`); }
    // An absent folder or a non-folder has no direct entries; a link is never followed.
    if (!st || (!st.isDirectory() && !st.isSymbolicLink())) continue;
    if (st.isSymbolicLink()) { problems.push(`outside: infra/.data/${service} is a symbolic link (not followed)`); continue; }
    if (st.uid !== uid) { problems.push(`outside: infra/.data/${service}: not scanned: infra/.data/${service} (owner ${st.uid})`); continue; }
    let names = [];
    try { names = fs.readdirSync(dir).sort(); } catch (e) { problems.push(`outside: cannot read infra/.data/${service} (${e.code})`); }
    const chain = [...data.chain, { rel: `infra/.data/${service}`, dev: st.dev, ino: st.ino }];
    for (const name of names) files.set(path.join(dir, name), { rel: `infra/.data/${service}/${name}`, chain });
  }
  for (const file of ledger ?? []) {
    const rel = path.relative(clone, file), parent = path.dirname(rel);
    if (rel.startsWith('..') || path.isAbsolute(rel)) { problems.push(`outside: ${file} is not inside the clone`); continue; }
    const folders = realChain(clone, parent === '.' ? '' : parent, uid);
    if (folders.absent) continue;
    if (!folders.chain) { problems.push(`outside: ${rel}: not scanned: ${folders.problem}`); continue; }
    files.set(file, { rel, chain: folders.chain });
  }
  for (const [abs, { rel, chain }] of files) {
    if (!protectedClass(rel)) continue;
    let st;
    try { st = fs.lstatSync(abs); } catch (e) { if (e.code !== 'ENOENT') problems.push(`outside: cannot lstat ${rel} (${e.code})`); continue; }
    if (st.isDirectory()) continue;
    if (st.isSymbolicLink() || !st.isFile() || st.uid !== uid || (modeOf(st) & 0o077) !== 0) hits.push({ ...hitRecord('outside', rel, abs, st), base: clone, chain });
  }
  return { hits, problems };
}
/**
 * §7.5 step 3 in bounded stages. (1) The recorded folders from the area base to the file are unchanged real folders of
 * the host user. (2) Open the same path without a link follow: a regular file of the host user with the recorded device
 * and inode. (3) The folders again, after the open and before any change: the open may have passed a folder that
 * changed after (1). (4) fchmod 0600; fstat again with the same device, inode, size and SHA-256. (5) The folders and the
 * path once more: a change after (3) is reported as a late refusal with the mode that the recorded inode has now.
 * Any other result is refused. Nothing is deleted.
 */
export function correctHit(hit, { uid }) {
  const before = folderChange(hit, uid);
  if (before) return { refused: `path changed before the correction: ${before}` };
  let fd;
  try { fd = fs.openSync(hit.abs, O_RDONLY | O_NOFOLLOW); } catch (e) { return { refused: `cannot open without a link follow (${e.code ?? e.message})` }; }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) return { refused: 'not a regular file' };
    if (st.uid !== uid) return { refused: `another owner (${st.uid})` };
    if (st.dev !== hit.dev || st.ino !== hit.ino) return { refused: 'another device or inode' };
    const opened = folderChange(hit, uid);
    if (opened) return { refused: `path changed after the open: ${opened}` };
    fs.fchmodSync(fd, 0o600);
    const again = fs.fstatSync(fd);
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(fd)).digest('hex');
    if (modeOf(again) !== 0o600 || again.dev !== hit.dev || again.ino !== hit.ino || again.size !== hit.size || sha256 !== hit.sha256)
      return { refused: 'the file changed during the correction' };
    const late = folderChange(hit, uid) ?? pathChange(hit);
    if (late) return { refused: `path changed during the correction (the recorded inode now has mode ${octal(modeOf(again))}): ${late}` };
    return { corrected: { area: hit.area, path: hit.path, from: hit.mode, to: '0600', dev: hit.dev, ino: hit.ino, size: hit.size, sha256 } };
  } finally { fs.closeSync(fd); }
}
/** Corrects each hit once; returns the corrections and the refusals. */
export function correctAll(hits, { uid }) {
  const corrections = [], refusals = [];
  for (const hit of hits) {
    const c = correctHit(hit, { uid });
    if (c.corrected) corrections.push(c.corrected); else refusals.push({ area: hit.area, path: hit.path, reason: c.refused });
  }
  return { corrections, refusals };
}
const publicHit = ({ abs, base, chain, ...hit }) => hit;
/** One scan record. `failed`: a hit or a problem (the step FAILs). `refusals`: a correction was refused (the phase stops). */
export function scanRecord(point, { problems, hits, corrections, refusals }) {
  return { point, at: new Date().toISOString(), problems, hits: hits.map(publicHit), corrections, refusals,
    failed: problems.length > 0 || hits.length > 0 };
}
/**
 * The scan point of §7.4: root closure, the `bin/` rule, the four private data areas, the extra private roots of the
 * phase (the migration roots) and the outside classes of the clone. Every hit is recorded, then corrected once.
 */
export function scanPoint({ point, privateRoot, uid, script, scriptSha, extraRoots = [], clone, ledger }) {
  const problems = [...rootClosure(privateRoot, { uid }), ...binRule(path.join(privateRoot, 'bin'), { script, sha256: scriptSha })];
  const hits = [];
  const add = (s) => { hits.push(...s.hits); problems.push(...s.problems); };
  for (const area of DATA_AREAS) if (lexists(path.join(privateRoot, area))) add(scanTree(path.join(privateRoot, area), area, { uid, base: privateRoot }));
  for (const root of extraRoots) add(scanTree(root, path.basename(root), { uid }));
  if (clone) add(scanOutside(clone, ledger, { uid }));
  return scanRecord(point, { problems, hits, ...correctAll(hits, { uid }) });
}
/** The text of a failed scan record: problems, then hits, then refused corrections. */
export function scanCause(record) {
  return [...record.problems, ...record.hits.map((h) => `scan hit: ${h.area}/${h.path} (${h.type} ${h.mode})`),
    ...record.refusals.map((r) => `correction refused: ${r.area}/${r.path}: ${r.reason}`)].join('; ');
}
