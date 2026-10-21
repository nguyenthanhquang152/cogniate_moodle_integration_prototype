// QA's own oracles for AC-M1-41 (ADR-012 revision 3.3). Pure functions over QA's listings, the
// fixture script's JSON and the product's printed JSON lines. A product command is never the
// oracle of its own row. Host-only helpers for legacy sets, lock records and process groups.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { run } from './lib.mjs';
import { StorageBlocked, StorageFail, defaultDocker, dockerSecond } from './storage-docker.mjs';
import { privateCopy } from './storage-fixture-script.mjs';

export const SERVICES = ['lti-service', 'cogniate-app'];
export const VOL_OF_SERVICE = { 'lti-service': 'lti', 'cogniate-app': 'app' };
export const DB_OF_VOL = { lti: 'lti.db', app: 'cogniate.db' };
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export const fail = (message) => { throw new StorageFail(message); };
export function check(condition, message) { if (!condition) throw new StorageFail(message); }

// ------------------------------------------------------------ product output

/** Every JSON object line of a command's output (stdout and stderr). */
export function jsonLines(...texts) {
  const out = [];
  for (const text of texts) for (const line of String(text ?? '').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try { const v = JSON.parse(t); if (v && typeof v === 'object') out.push(v); } catch { /* plain text line */ }
  }
  return out;
}
const values = (v) => v == null ? [] : Array.isArray(v) ? v.flatMap(values) : typeof v === 'object' ? Object.values(v).flatMap(values) : [v];
/** A JSON line names the code: a field value equal to it, or "<code>:<detail>", or a list holding it. */
export function namesCode(lines, code) {
  return lines.some((line) => values(line).some((v) => typeof v === 'string' && (v === code || v.startsWith(code + ':'))));
}
/** "Refuses <code>": exit 1 and the code in the command's JSON output (M1 AC-M1-41 rules). */
export function assertRefuses(result, code, what = 'command') {
  check(result.code === 1, `${what}: expected exit 1 (refuses ${code}), got ${result.code}`);
  check(namesCode(jsonLines(result.stdout, result.stderr), code), `${what}: exit 1 without ${code} in its JSON output`);
}
export const linesOf = (result, event) => jsonLines(result.stdout, result.stderr).filter((l) => l.event === event);
/**
 * The preflight of one guarded command: its `check` pass (ADR-012 §5). `stack:up` also prints the legacy scan's
 * `report` before the check and, on a first start, `mark-started` after the services are healthy. Neither gates the
 * start, so `summary` is selected by mode, never by position. `lines` keeps every storage_preflight line;
 * `checkLines` has only the folder lines of that check.
 */
export function preflightOf(result) {
  const lines = linesOf(result, 'storage_preflight'), summaries = linesOf(result, 'storage_preflight_summary');
  const checks = summaries.filter((s) => s.mode === 'check');
  check(checks.length <= 1, `${checks.length} check-mode preflight summaries in one command; expected one`);
  const summary = checks[0] ?? null;
  return { lines, summary, checkLines: summary ? lines.filter((l) => l.mode === 'check' && l.runId === summary.runId) : [],
    runIds: [...new Set([...lines, ...summaries].map((l) => l.runId))] };
}
/** Reads a JSON-lines log file from the clone (for example infra/.logs/storage-lock.jsonl). */
export function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return jsonLines(fs.readFileSync(file, 'utf8'));
}

// ------------------------------------------------------------ "nothing changes" (M1 rules, §11 item 5)

const entryKey = (e) => JSON.stringify([e.path, e.type, e.uid, e.gid, e.mode, e.size ?? null, e.sha256 ?? null, e.target ?? null]);
/** Differences between two listings of both volumes; "absent" is a value. */
export function listingDiff(before, after, vols = ['lti', 'app']) {
  const diffs = [];
  for (const vol of vols) {
    const a = before[vol], b = after[vol];
    if (a.state !== b.state) { diffs.push(`${vol}: ${a.state} → ${b.state}`); continue; }
    const ka = new Set(a.entries.map(entryKey)), kb = new Set(b.entries.map(entryKey));
    for (const e of a.entries) if (!kb.has(entryKey(e))) diffs.push(`${vol}: changed or removed ${e.path}`);
    for (const e of b.entries) if (!ka.has(entryKey(e))) diffs.push(`${vol}: changed or added ${e.path}`);
  }
  return diffs;
}
/** FRESH by §11 item 5: absent, or present with no entry other than the empty mountpoints. */
export function freshVolume(vol, listing) {
  if (listing.state === 'absent') return true;
  const others = listing.entries.filter((e) => e.path !== '.');
  const allowed = vol === 'app' ? ['packages', 'uploads'] : [];
  return others.every((e) => allowed.includes(e.path) && e.type === 'dir');
}
/**
 * "Nothing changes". An absent volume must stay absent, or exist with this project's labels, a creation
 * second not earlier than the command's start second, and state FRESH (Compose's own creation).
 */
export function nothingChanged({ beforeListing, afterListing, beforePresence, afterPresence, beforeServices, afterServices, startSecond }) {
  const diffs = [];
  const KEY = { lti: 'ltidb', app: 'appdb' };
  for (const vol of ['lti', 'app']) {
    const pb = beforePresence[KEY[vol]], pa = afterPresence[KEY[vol]];
    if (pb.state === 'absent' && pa.state !== 'absent') {
      if (pa.state !== 'labeled') diffs.push(`${vol}: appeared without this project's labels`);
      else if (dockerSecond(pa.record.CreatedAt) < startSecond) diffs.push(`${vol}: appeared with a creation time before the command`);
      else if (!freshVolume(vol, afterListing[vol])) diffs.push(`${vol}: appeared but is not FRESH`);
      continue;
    }
    if (pb.state !== pa.state) { diffs.push(`${vol}: presence ${pb.state} → ${pa.state}`); continue; }
    if (pb.record && pa.record && pb.record.CreatedAt !== pa.record.CreatedAt) diffs.push(`${vol}: volume replaced`);
    diffs.push(...listingDiff(beforeListing, afterListing, [vol]));
  }
  const key = (s) => `${s.id}|${s.startedAt}|${s.created}`;
  const sb = new Set(beforeServices.map(key)), sa = new Set(afterServices.map(key));
  for (const s of afterServices) if (!sb.has(key(s))) diffs.push(`service container created or recreated: ${s.name}`);
  for (const s of beforeServices) if (!sa.has(key(s))) diffs.push(`service container changed: ${s.name}`);
  return diffs;
}

// ------------------------------------------------------------ identities and file sets (§6, §8)

export function identities(fs_) {
  const out = {};
  for (const vol of ['lti', 'app']) {
    const id = fs_[vol]?.identity;
    out[vol] = id?.present ? (id.json ?? { invalid: id.error }) : null;
  }
  return out;
}
/** Both identities exist, equal in pairId and generation, with the stated kind and firstStart. */
export function assertPair(ids, { kind, generation, firstStart, pairId, composeProject } = {}) {
  check(ids.lti && ids.app && !ids.lti.invalid && !ids.app.invalid, 'Both identities must exist and parse');
  check(ids.lti.role === 'lti' && ids.app.role === 'app', 'Identity roles lti and app');
  check(ids.lti.formatVersion === 1 && ids.app.formatVersion === 1, 'Identity formatVersion 1');
  check(ids.lti.pairId === ids.app.pairId && /^[0-9a-f]{32}$/.test(ids.lti.pairId), 'Both identities have one 32-hex pairId');
  check(ids.lti.generation === ids.app.generation, 'Both identities have one generation');
  if (kind !== undefined) check(ids.lti.provenance?.kind === kind && ids.app.provenance?.kind === kind, `Provenance kind ${kind}`);
  if (generation !== undefined) check(ids.lti.generation === generation, `Generation ${generation}`);
  if (firstStart !== undefined) check(ids.lti.firstStart === firstStart && ids.app.firstStart === firstStart, `firstStart ${firstStart}`);
  if (pairId !== undefined) check(ids.lti.pairId === pairId, 'pairId as expected');
  if (composeProject !== undefined) check(ids.lti.composeProject === composeProject && ids.app.composeProject === composeProject, 'composeProject');
  return ids.lti.pairId;
}
const stable = (v) => JSON.stringify(v);
export const sameIdentities = (a, b) => stable(a.lti) === stable(b.lti) && stable(a.app) === stable(b.app);
/** The four names of each volume: presence, size and SHA-256 ("absent" is a value). */
export function fileSets(fs_) {
  const out = {};
  for (const vol of ['lti', 'app']) {
    const files = fs_[vol]?.files ?? {};
    out[vol] = Object.fromEntries(Object.entries(files).map(([name, f]) => [name, f.present ? { size: f.size, sha256: f.sha256, type: f.type ?? 'file' } : 'absent']));
  }
  return out;
}
export const fileSetsEqual = (a, b) => stable(a) === stable(b);
/** Database names only (the identity differs after a restore). */
export function dbFileSets(sets) {
  const out = {};
  for (const vol of ['lti', 'app']) {
    out[vol] = Object.fromEntries(Object.entries(sets[vol]).filter(([name]) => name !== '.storage-identity.json'));
  }
  return out;
}

// ------------------------------------------------------------ backups (§8)

function objects(value) { if (!value || typeof value !== 'object') return []; return [value, ...Object.values(value).flatMap(objects)]; }
/** File entries of a manifest, by the documented names (`lti-service/lti.db`, …), without trusting a layout. */
export function manifestFiles(manifest) {
  const files = {};
  for (const node of objects(manifest)) {
    const name = Object.values(node).find((v) => typeof v === 'string' && /^(lti-service|cogniate-app)\/[^/]+$/.test(v));
    const digest = Object.values(node).find((v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v));
    const size = Object.values(node).find((v) => Number.isInteger(v) && v >= 0);
    if (name && digest && size !== undefined) files[name] = { size, sha256: digest };
  }
  return files;
}
/** B's database file sets per volume, in the fileSets() shape (unlisted names are "absent"). */
export function manifestDbSets(manifest) {
  const files = manifestFiles(manifest), out = {};
  for (const [service, vol] of Object.entries(VOL_OF_SERVICE)) {
    const db = DB_OF_VOL[vol];
    out[vol] = Object.fromEntries([db, `${db}-wal`, `${db}-shm`].map((name) => {
      const f = files[`${service}/${name}`];
      return [name, f ? { size: f.size, sha256: f.sha256, type: 'file' } : 'absent'];
    }));
  }
  return out;
}
export function readManifest(folder) {
  const file = path.join(folder, 'manifest.json');
  check(fs.existsSync(file), 'Backup has no manifest.json: ' + folder);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
/** QA's own hashes of a backup folder's files, for the manifest equality checks. */
export function hashFolder(folder) {
  const out = {};
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name), r = rel ? `${rel}/${name}` : name, st = fs.lstatSync(file);
      if (st.isDirectory()) walk(file, r); else if (st.isFile()) out[r] = { size: st.size, sha256: sha(file) };
      else out[r] = { type: st.isSymbolicLink() ? 'symlink' : 'other' };
    }
  };
  if (fs.existsSync(folder)) walk(folder, '');
  return out;
}

// ------------------------------------------------------------ logical rows (the second recovery oracle)

/** True when the logical read shows every marker of `present` and none of `absent`, in both databases. */
export function logicalShows(read, { present = [], absent = [] }) {
  for (const vol of ['lti', 'app']) {
    const m = read[vol]?.markers ?? {};
    for (const marker of present.filter((x) => x.vol === vol)) if (!(m[marker.value] > 0)) return false;
    for (const marker of absent.filter((x) => x.vol === vol)) if (m[marker.value] !== 0) return false;
  }
  return true;
}

// ------------------------------------------------------------ legacy sets on the host (§10)

/** The legacy set of each service: entries named `<db>` or starting with `<db>-`, at rest on the host. */
export function legacySets(clone) {
  const out = {};
  for (const [service, vol] of Object.entries(VOL_OF_SERVICE)) {
    const dir = path.join(clone, 'infra/.data', service), db = DB_OF_VOL[vol];
    out[service] = !fs.existsSync(dir) ? [] : fs.readdirSync(dir).filter((n) => n === db || n.startsWith(db + '-')).sort().map((name) => {
      const file = path.join(dir, name), st = fs.lstatSync(file);
      return st.isFile() ? { name, size: st.size, sha256: sha(file) } : { name, type: st.isSymbolicLink() ? 'symlink' : 'other' };
    });
  }
  return out;
}
export const legacyEmpty = (sets) => Object.values(sets).every((list) => list.length === 0);
/**
 * QA's ledger of its own legacy copies. QA removes only a file that it placed and whose bytes are unchanged
 * (or changed only by QA's own recorded edit). Any other legacy entry is never moved or deleted (B-S-23).
 */
export class LegacyFixtures {
  constructor(clone) { this.clone = clone; this.placed = new Map(); }
  place(service, name, sourceFile, { hook } = {}) {
    const dir = path.join(this.clone, 'infra/.data', service);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const target = path.join(dir, name);
    if (fs.existsSync(target)) throw new StorageBlocked('Legacy target exists and is not QA-placed: ' + target);
    privateCopy(sourceFile, target, { hook }); // site #8: 0600 at creation, at the legacy place
    this.placed.set(target, sha(target));
    return { service, name, size: fs.statSync(target).size, sha256: this.placed.get(target) };
  }
  edited(service, name) { const t = path.join(this.clone, 'infra/.data', service, name); this.placed.set(t, sha(t)); }
  removeAll() {
    const removed = [];
    for (const [target, digest] of this.placed) {
      if (!fs.existsSync(target)) continue;
      if (sha(target) !== digest) throw new StorageBlocked('A QA legacy copy changed outside QA: ' + target);
      fs.unlinkSync(target); removed.push(target);
    }
    this.placed.clear();
    const rest = legacySets(this.clone);
    if (!legacyEmpty(rest)) throw new StorageBlocked('Legacy entries remain that QA did not place: ' + JSON.stringify(rest));
    return removed;
  }
}

// ------------------------------------------------------------ host processes and lock records (§7)

const psRun = (args) => run('ps', args, { env: { ...process.env, LC_ALL: 'C' }, timeoutMs: 15_000 });
/** `LC_ALL=C ps -o lstart= -p <pid>`; empty for an ended process. */
export async function pidStart(pid) { const r = await psRun(['-o', 'lstart=', '-p', String(pid)]); return r.code === 0 ? r.stdout.trim() : ''; }
export async function pgidOf(pid) { const r = await psRun(['-o', 'pgid=', '-p', String(pid)]); return r.code === 0 ? Number(r.stdout.trim()) : null; }
/** The exact group read of the design: `LC_ALL=C ps -A -o pid= -o pgid=`. */
export async function groupMembers(pgid) {
  const r = await psRun(['-A', '-o', 'pid=', '-o', 'pgid=']);
  if (r.code !== 0) throw new StorageBlocked('ps group read failed');
  return r.stdout.split('\n').map((l) => l.trim().split(/\s+/).map(Number)).filter(([p, g]) => g === pgid && p).map(([p]) => p);
}
/** Writes one lock record folder the §7 way (`owner.json.tmp`, fsync, rename) with QA's planted values. */
export function writeRecordFolder(folder, record) {
  fs.mkdirSync(folder, { mode: 0o700 });
  const tmp = path.join(folder, 'owner.json.tmp'), fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, path.join(folder, 'owner.json'));
  return sha(path.join(folder, 'owner.json'));
}
export const recordHash = (folder) => fs.existsSync(path.join(folder, 'owner.json')) ? sha(path.join(folder, 'owner.json')) : null;
/** Starts a command as its own process group (Node `spawn` with `detached: true`), output kept in memory. */
export function spawnGroup(cmd, args, { cwd, env } = {}) {
  const child = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; }); child.stderr.on('data', (d) => { stderr += d; });
  const done = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr })));
  return { pid: child.pid, pgid: child.pid, child, done, output: () => ({ stdout, stderr }),
    killGroup: (signal = 'SIGKILL') => { try { process.kill(-child.pid, signal); return true; } catch { return false; } } };
}
/** Waits until `predicate()` is true; a deadline, never a fixed sleep as proof. */
export async function until(predicate, { timeoutMs, intervalMs = 250, what }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > deadline) throw new StorageFail('Deadline: ' + what);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
/** Two intervals [a, b] do not overlap (lock acquire/release pairs of a-lock-scope). */
export function pairsDisjoint(pairs) {
  const sorted = [...pairs].sort((x, y) => Date.parse(x.acquired) - Date.parse(y.acquired));
  for (let i = 1; i < sorted.length; i++) if (Date.parse(sorted[i].acquired) < Date.parse(sorted[i - 1].released)) return false;
  return true;
}
/** Acquire/release pairs per runId from the lock log. */
export function lockPairs(events) {
  const byRun = new Map();
  for (const e of events) {
    if (!['storage_lock_acquired', 'storage_lock_released'].includes(e.event)) continue;
    const p = byRun.get(e.runId) ?? { runId: e.runId, command: e.command };
    if (e.event === 'storage_lock_acquired') p.acquired = e.ts; else p.released = e.ts;
    byRun.set(e.runId, p);
  }
  return [...byRun.values()];
}

// ------------------------------------------------------------ a-serialize oracle (storage repair triage §3.1)

/** Milliseconds since the epoch of an RFC 3339 time with any fraction, without loss below the millisecond. */
export function timeMs(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, sec, frac = '', zone] = m;
  let ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec)) + (frac ? Number('0.' + frac) * 1000 : 0);
  if (zone !== 'Z') ms -= (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6))) * 60_000;
  return ms;
}
/** One clock sample: host time h1, the Docker engine time E, host time h2; offset o = E − (h1 + h2) / 2, uncertainty u = (h2 − h1) / 2. */
export async function clockSample(docker = defaultDocker, now = Date.now) {
  const h1 = now();
  let r;
  try { r = await docker(['system', 'info', '--format', '{{.SystemTime}}']); } catch (e) { r = { code: -1, stdout: '', stderr: String(e?.message ?? e) }; }
  const h2 = now();
  const engine = r.code === 0 ? timeMs(r.stdout) : null;
  if (engine === null) return { ok: false, h1, h2, engineText: (r.stdout ?? '').trim(), error: r.code === 0 ? 'unreadable engine time' : `exit ${r.code}` };
  return { ok: true, h1, h2, engineText: r.stdout.trim(), engine, o: engine - (h1 + h2) / 2, u: (h2 - h1) / 2 };
}
/**
 * §3.1 step 3: the wait ends only on a sign of this run — an acquire event after the offset with the spawned pgid,
 * or a lock record with it. An event or a record of another run never ends it. `readLog` returns the whole log text.
 */
export async function waitForRun({ readLog, readRecord, offset, pgid, timeoutMs = 60_000, intervalMs = 50, now = Date.now, sleep }) {
  const pause = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + timeoutMs;
  for (;;) {
    const log = Buffer.from(readLog() ?? '');
    if (log.length >= offset && jsonLines(log.subarray(offset).toString('utf8')).some((e) => e.event === 'storage_lock_acquired' && e.pgid === pgid)) return { by: 'event' };
    const record = readRecord();
    if (record && record.pgid === pgid) return { by: 'record' };
    if (now() > deadline) return null;
    await pause(intervalMs);
  }
}
/**
 * §3.1 steps 1 and 4–8, one pure function. `log` is the whole lock log at evaluation, `offset` its byte length before
 * the spawn. Returns { verdict, selectedRunId, cause, notes, clock }. It never passes on clock uncertainty.
 */
export function serializeVerdict({ log, offset, pgid, waitLines = [], startedAt = {}, samples = [] }) {
  const out = { verdict: 'FAIL', selectedRunId: null, cause: null, notes: [], clock: null };
  const fail = (cause) => ({ ...out, cause });
  const bytes = Buffer.from(log ?? '');
  if (bytes.length < offset) return fail('lock log truncated');
  const events = jsonLines(bytes.subarray(offset).toString('utf8'));
  const acquires = events.filter((e) => e.event === 'storage_lock_acquired' && e.pgid === pgid);
  if (acquires.length !== 1) return fail('backup run not identified');
  const { runId: X, command: C } = acquires[0];
  out.selectedRunId = X;
  const waits = waitLines.filter((l) => l.event === 'storage_lock_wait');
  if (!waits.length) out.notes.push('no wait observed');
  if (waits.some((w) => w.owner?.runId !== X || w.owner?.pgid !== pgid)) return fail('stack:up waited on another run');
  const releases = events.filter((e) => e.event === 'storage_lock_released' && e.runId === X);
  if (releases.length === 0) return fail('no release for the backup run');
  if (releases.length > 1) return fail('more than one release for the backup run');
  const R = releases[0];
  if (typeof C !== 'string' || C === '' || typeof R.command !== 'string' || R.command !== C) return fail('release event without the backup command (ADR-012 §7)');
  if (samples.length !== 2 || samples.some((s) => !s?.ok)) return fail('clock not measured');
  const lo = Math.min(...samples.map((s) => s.o - s.u)), hi = Math.max(...samples.map((s) => s.o + s.u));
  const released = timeMs(R.ts);
  out.clock = { samples: samples.map(({ h1, h2, engineText, o, u }) => ({ h1, h2, engineText, o, u })), lo, hi, releaseTs: R.ts, margins: {} };
  if (released === null) return fail('clock not measured');
  for (const service of SERVICES) {
    const start = timeMs(startedAt[service]);
    if (start === null) return fail(`no StartedAt for ${service}`);
    out.clock.margins[service] = { startedAt: startedAt[service], marginToHiMs: start - (released + hi), marginToLoMs: start - (released + lo) };
    if (start >= released + hi) continue;
    return fail(start < released + lo ? 'service started before the backup released the lock' : 'clock uncertainty');
  }
  return { ...out, verdict: 'PASS' };
}
export { assert };
