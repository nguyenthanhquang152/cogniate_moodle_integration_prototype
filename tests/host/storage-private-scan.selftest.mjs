// HARNESS ONLY: the private-root scans of the storage repair (triage revision 4 §7.4, §7.5) on host temporary folders.
// V4-3 (no name exemption in a private area), V4-4 (outside classes), V4-5 (bin/), V4-7 (hit record and the bounded
// correction), V4-10 (root closure), V4-8 / Lead R2-01 (a scratch removal with a hit keeps the folder and the file).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StorageFail } from './storage-docker.mjs';
import { StorageLane } from './storage-lane.mjs';
import { PhaseAbort, binRule, correctHit, protectedClass, rootClosure, scanOutside, scanPoint, scanTree } from './storage-private-scan.mjs';

const UID = process.getuid();
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function tmp(t) { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-private-scan-'))); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; }
/** A closed lane private root: the five folders 0700, bin/ with the script 0555. */
function privateRoot(t) {
  const root = path.join(tmp(t), 'clone-storage-private');
  fs.mkdirSync(root, { mode: 0o700 }); fs.chmodSync(root, 0o700);
  for (const d of ['backups', 'bin', 'out', 'quarantine', 'scratch']) { fs.mkdirSync(path.join(root, d), { mode: 0o700 }); fs.chmodSync(path.join(root, d), 0o700); }
  const script = path.join(root, 'bin/storage-fixture-script.mjs'); fs.writeFileSync(script, '// qa'); fs.chmodSync(script, 0o555);
  return { root, scriptSha: sha(script) };
}
const put = (file, mode, text = 'x') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); fs.chmodSync(file, mode); };

test('HARNESS ONLY: V4-3 in each private data area a 0644 file FAILs the scan, whatever its name (no exemption)', (t) => {
  for (const area of ['out', 'backups', 'quarantine', 'scratch']) for (const name of ['x/cogniate.db', 'x/lti.db-wal', 'x/.storage-identity.json', 'x/lti-api-key.cogniate', 'x/pkg/index.html']) {
    const { root, scriptSha } = privateRoot(t);
    put(path.join(root, area, name), 0o644);
    const rec = scanPoint({ point: 'p', privateRoot: root, uid: UID, script: 'storage-fixture-script.mjs', scriptSha });
    assert.equal(rec.failed, true, `${area}/${name}`);
    assert.deepEqual(rec.hits.map((h) => [h.area, h.path, h.mode]), [[area, name, '0644']]);
  }
  const { root, scriptSha } = privateRoot(t);
  put(path.join(root, 'out/x/ok.db'), 0o600); fs.symlinkSync('/etc/hosts', path.join(root, 'out/x/link'));
  assert.equal(scanPoint({ point: 'p', privateRoot: root, uid: UID, script: 'storage-fixture-script.mjs', scriptSha }).failed, false, 'A 0600 file passes; a link is never followed');
});

test('HARNESS ONLY: V4-4 outside the areas: a 0644 protected file in a legacy placement folder FAILs; a 0644 non-protected file does not', (t) => {
  const clone = tmp(t);
  put(path.join(clone, 'infra/.data/lti-service/lti.db'), 0o644);
  put(path.join(clone, 'infra/.data/cogniate-app/notes.txt'), 0o644);
  put(path.join(clone, 'infra/.data/cogniate-app/packages/p/cogniate.db'), 0o644); // not a direct entry
  const ledger = new Set([path.join(clone, '.env'), path.join(clone, 'infra/.secrets/seed.json')]);
  put(path.join(clone, '.env'), 0o600); put(path.join(clone, 'infra/.secrets/seed.json'), 0o640);
  const s = scanOutside(clone, ledger, { uid: UID });
  assert.deepEqual(s.hits.map((h) => h.path).sort(), ['infra/.data/lti-service/lti.db', 'infra/.secrets/seed.json']);
  assert.deepEqual(s.problems, []);
  assert.equal(protectedClass('infra/.data/cogniate-app/notes.txt'), null);
  for (const p of ['a.db', 'a.db-wal', 'a.db-shm', 'a.db-journal', '.storage-identity.json', '.storage-journal.json', 'manifest.json', 'quarantine.json', '.env', 'k.key', 'c.pem', 'r.crt', 'infra/.secrets/app/lti-api-key'])
    assert.ok(protectedClass(p), p);
  const { root, scriptSha } = privateRoot(t);
  const point = scanPoint({ point: 'p', privateRoot: root, uid: UID, script: 'storage-fixture-script.mjs', scriptSha, clone, ledger });
  assert.deepEqual(point.hits.map((h) => h.path).sort(), ['infra/.data/lti-service/lti.db', 'infra/.secrets/seed.json'], 'The scan point includes the outside classes');
  fs.rmSync(path.join(clone, 'infra/.data/lti-service'), { recursive: true }); fs.symlinkSync(path.join(clone, 'infra'), path.join(clone, 'infra/.data/lti-service'));
  assert.deepEqual(scanOutside(clone, new Set(), { uid: UID }).problems, ['outside: infra/.data/lti-service is a symbolic link (not followed)']);
});

test('HARNESS ONLY: V4-5 bin/ holds exactly the recorded script at 0555', (t) => {
  const check = (edit) => { const { root, scriptSha } = privateRoot(t); edit(root); return binRule(path.join(root, 'bin'), { script: 'storage-fixture-script.mjs', sha256: scriptSha }); };
  assert.deepEqual(check(() => {}), []);
  assert.equal(check((root) => put(path.join(root, 'bin/extra.mjs'), 0o555)).length, 1, 'A second file');
  assert.equal(check((root) => { fs.chmodSync(path.join(root, 'bin/storage-fixture-script.mjs'), 0o755); fs.appendFileSync(path.join(root, 'bin/storage-fixture-script.mjs'), ' '); fs.chmodSync(path.join(root, 'bin/storage-fixture-script.mjs'), 0o555); }).length, 1, 'A changed digest');
  assert.deepEqual(check((root) => fs.chmodSync(path.join(root, 'bin/storage-fixture-script.mjs'), 0o755)), ['bin/storage-fixture-script.mjs has mode 0755, not 0555']);
});

test('HARNESS ONLY: V4-7 a hit is recorded and corrected once on the same inode; a link or another inode refuses; the step stays FAIL', (t) => {
  const { root, scriptSha } = privateRoot(t);
  const file = path.join(root, 'out/hold/cogniate.db'); put(file, 0o644, 'db bytes');
  const before = fs.lstatSync(file);
  const rec = scanPoint({ point: 'after x', privateRoot: root, uid: UID, script: 'storage-fixture-script.mjs', scriptSha });
  assert.equal(rec.failed, true, 'The step FAILs');
  assert.deepEqual(rec.hits[0], { area: 'out', path: 'hold/cogniate.db', type: 'file', mode: '0644', size: 8, uid: UID, sha256: sha(file), dev: before.dev, ino: before.ino });
  assert.deepEqual(rec.corrections.map((c) => [c.path, c.from, c.to, c.ino]), [['hold/cogniate.db', '0644', '0600', before.ino]]);
  assert.equal(fs.lstatSync(file).ino, before.ino); assert.equal(fs.lstatSync(file).mode & 0o7777, 0o600); assert.equal(fs.readFileSync(file, 'utf8'), 'db bytes');
  assert.deepEqual(rec.refusals, []);
  // Variants: the path replaced by a link, or by another inode, between the record and the correction.
  for (const swap of ['link', 'inode']) {
    const f = path.join(root, `out/v-${swap}.db`); put(f, 0o644, 'v');
    const s = scanTree(path.join(root, 'out'), 'out'); const hit = s.hits.find((h) => h.path === `v-${swap}.db`);
    const outside = path.join(path.dirname(root), `outside-${swap}`);
    // link: the recorded inode moves outside and a link to it takes its path (a follow would reach the same inode).
    if (swap === 'link') { fs.renameSync(f, outside); fs.symlinkSync(outside, f); } else { put(outside, 0o644, 'outside'); fs.rmSync(f); put(f, 0o644, 'v'); }
    const c = correctHit(hit, { uid: UID });
    assert.ok(c.refused, swap + ' refused');
    assert.equal(fs.lstatSync(outside).mode & 0o7777, 0o644, 'The link target is unchanged');
    if (swap === 'inode') assert.equal(fs.lstatSync(f).mode & 0o7777, 0o644, 'The other inode is unchanged');
    assert.ok(fs.existsSync(f), 'Nothing is deleted');
  }
});

test('HARNESS ONLY: V4-10 the lane private root is closed: exactly five 0700 folders of the host user', (t) => {
  const { root } = privateRoot(t);
  assert.deepEqual(rootClosure(root, { uid: UID }), []);
  const variants = {
    a: (r) => { fs.mkdirSync(path.join(r, 'extra')); put(path.join(r, 'extra/cogniate.db'), 0o600); },
    b: (r) => put(path.join(r, 'lti.db'), 0o600),
    c: (r) => fs.rmSync(path.join(r, 'scratch'), { recursive: true }),
    d: (r) => fs.chmodSync(path.join(r, 'out'), 0o755),
    e: (r) => { const real = path.join(path.dirname(r), 'real-backups'); fs.mkdirSync(real, { mode: 0o700 }); fs.rmSync(path.join(r, 'backups'), { recursive: true }); fs.symlinkSync(real, path.join(r, 'backups')); },
  };
  const want = { a: 'extra', b: 'lti.db', c: 'scratch', d: 'out', e: 'backups' };
  for (const [k, edit] of Object.entries(variants)) {
    const { root: r } = privateRoot(t); edit(r);
    const problems = rootClosure(r, { uid: UID });
    assert.ok(problems.some((p) => p === `private root not closed: ${want[k]}` || p.startsWith(`private root not closed: ${want[k]} (`)), `${k}: ${problems.join('; ')}`);
  }
  assert.ok(rootClosure(privateRoot(t).root, { uid: UID + 1 }).every((p) => /owner/.test(p)), '(f) another expected uid: every entry fails on its owner');
});

/** A real StorageLane with a fake runner, only for its private scratch. */
function scratchLane(t) {
  const run = tmp(t), r = { PROJECT: 'qa-scan-st', CLONE: path.join(run, 'clone'), saveText: () => {} };
  fs.mkdirSync(r.CLONE);
  const lane = new StorageLane(r);
  fs.mkdirSync(lane.private, { mode: 0o700 }); fs.mkdirSync(lane.scratch, { mode: 0o700 });
  return lane;
}
test('HARNESS ONLY: V4-8 / R2-01 a hit at the scratch removal keeps the folder and the file, also after a safe correction; the step FAILs', (t) => {
  const lane = scratchLane(t);
  const s = lane.privateScratch('compat-config');
  const file = path.join(s.path, 'env'); put(file, 0o644, 'LTI_MASTER_KEY=qa');
  const ino = fs.lstatSync(file).ino;
  assert.throws(() => s.remove(), (e) => e instanceof StorageFail && !(e instanceof PhaseAbort) && /scan hit: scratch\/compat-config-[0-9a-f]{16}\/env \(file 0644\); the folder is kept as evidence$/.test(e.message));
  assert.ok(fs.existsSync(s.path) && fs.existsSync(file), 'The folder and the file are kept');
  assert.deepEqual([fs.lstatSync(file).ino, fs.lstatSync(file).mode & 0o7777], [ino, 0o600], 'A safe correction of the same inode');
  const rec = lane.scans.at(-1);
  assert.deepEqual([rec.point, rec.failed, rec.corrections.length, rec.refusals.length], ['scratch removal compat-config', true, 1, 0]);
  // A refused correction (another owner cannot be made here; a link swap is the race): the phase stops.
  const s2 = lane.privateScratch('backup-read'), f2 = path.join(s2.path, 'lti.db'); put(f2, 0o644);
  // The race of §7.5 step 4: the path becomes a link after the record and before the correction opens it.
  const outside = path.join(path.dirname(lane.private), 'outside.db'); put(outside, 0o644);
  const orig = fs.openSync;
  fs.openSync = function (p, flags, ...rest) { if (p === f2) { fs.openSync = orig; fs.rmSync(f2); fs.symlinkSync(outside, f2); } return orig.call(fs, p, flags, ...rest); };
  try { assert.throws(() => s2.remove(), (e) => e instanceof PhaseAbort && /correction refused/.test(e.message)); }
  finally { fs.openSync = orig; }
  assert.ok(fs.existsSync(s2.path), 'Kept'); assert.equal(fs.lstatSync(outside).mode & 0o7777, 0o644, 'The link target is unchanged');
  const clean = lane.privateScratch('storage-paths'); put(path.join(clean.path, 'cogniate.db'), 0o600);
  clean.remove();
  assert.equal(fs.existsSync(clean.path), false, 'Zero hits: removed');
});

// ---------------------------------------------------------------- Round 2 (A-SH-01, A-SH-02): no link follow, guarded roots, bounded corrections

const SCRIPT_NAME = 'storage-fixture-script.mjs';
/** Every entry below `dir`, with the metadata that a chmod or a write changes (ctimeMs too); links are not followed. */
function tree(dir) {
  const out = {};
  const walk = (d, rel) => {
    for (const n of fs.readdirSync(d).sort()) {
      const f = path.join(d, n), r = rel ? `${rel}/${n}` : n, st = fs.lstatSync(f);
      const type = st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : 'file';
      out[r] = { type, mode: st.mode & 0o7777, size: type === 'file' ? st.size : 0, sha256: type === 'file' ? sha(f) : null, dev: st.dev, ino: st.ino, ctimeMs: st.ctimeMs };
      if (type === 'dir') walk(f, r);
    }
  };
  walk(dir, '');
  return out;
}
/** T: a folder outside the lane private root with 0644 protected and plain files, also in a subfolder. */
function outsideT(base, name) {
  const T = path.join(base, name);
  fs.mkdirSync(path.join(T, 'sub'), { recursive: true }); fs.chmodSync(T, 0o700); fs.chmodSync(path.join(T, 'sub'), 0o700);
  put(path.join(T, 'x.db'), 0o644, 'outside db'); put(path.join(T, 'notes.txt'), 0o644, 'outside'); put(path.join(T, 'sub/y.db-wal'), 0o644, 'outside wal');
  return T;
}
const none = (rec) => [rec.hits, rec.corrections, rec.refusals];
const point = (root, scriptSha, extra = {}) => scanPoint({ point: 'p', privateRoot: root, uid: UID, script: SCRIPT_NAME, scriptSha, ...extra });

test('HARNESS ONLY: R2-01-01 a normal root: a clean scan passes; a 0644 hit keeps its record fields and its same-inode correction', (t) => {
  const { root, scriptSha } = privateRoot(t);
  assert.equal(point(root, scriptSha).failed, false, 'A clean root passes');
  const f = path.join(root, 'out/a.db'); put(f, 0o644, 'a'); const st = fs.lstatSync(f);
  const rec = point(root, scriptSha);
  assert.deepEqual(rec.hits, [{ area: 'out', path: 'a.db', type: 'file', mode: '0644', size: 1, uid: UID, sha256: sha(f), dev: st.dev, ino: st.ino }], 'The public hit record has exactly its fields');
  assert.deepEqual(rec.corrections.map((c) => [c.path, c.from, c.to, c.ino]), [['a.db', '0644', '0600', st.ino]]);
  assert.deepEqual([rec.failed, rec.refusals, fs.lstatSync(f).mode & 0o7777], [true, [], 0o600]);
});

test('HARNESS ONLY: R2-01-02 a data area or bin/ that is a link is never walked: T keeps every mode, byte, inode and ctime; the scan FAILs', (t) => {
  for (const area of ['out', 'backups', 'quarantine', 'scratch', 'bin']) {
    const { root, scriptSha } = privateRoot(t);
    const T = outsideT(path.dirname(root), 'T'), before = tree(T);
    fs.rmSync(path.join(root, area), { recursive: true }); fs.symlinkSync(T, path.join(root, area));
    const rec = point(root, scriptSha);
    assert.deepEqual(tree(T), before, `${area}: T is unchanged`);
    assert.deepEqual(none(rec), [[], [], []], `${area}: nothing in T is recorded or corrected`);
    assert.equal(rec.failed, true, area);
    assert.ok(rec.problems.includes(`private root not closed: ${area} (symlink)`), rec.problems.join('; '));
    if (area !== 'bin') assert.ok(rec.problems.includes(`${area}: not scanned: ${area} (symlink)`), rec.problems.join('; '));
    assert.equal(fs.readlinkSync(path.join(root, area)), T, 'The link stays');
  }
});

test('HARNESS ONLY: R2-01-03 a linked migration or snapshot root, legacy folder, infra/.data or ledger parent is not walked; T is unchanged', (t) => {
  for (const name of ['qa-m1-private-backup-Ab12Cd', 'qa-m1-snapshot-private-Ef34Gh']) {
    const { root, scriptSha } = privateRoot(t);
    const T = outsideT(path.dirname(root), 'T'), before = tree(T), extra = path.join(path.dirname(root), name);
    fs.symlinkSync(T, extra);
    const rec = point(root, scriptSha, { extraRoots: [extra] });
    assert.deepEqual(tree(T), before, name + ': T is unchanged');
    assert.deepEqual(none(rec), [[], [], []], name);
    assert.deepEqual([rec.failed, rec.problems], [true, [`${name}: not scanned: . (symlink)`]], name);
  }
  const make = {
    'lti-service': (clone, T) => { fs.mkdirSync(path.join(clone, 'infra/.data'), { recursive: true }); fs.symlinkSync(T, path.join(clone, 'infra/.data/lti-service')); },
    'cogniate-app': (clone, T) => { fs.mkdirSync(path.join(clone, 'infra/.data'), { recursive: true }); fs.symlinkSync(T, path.join(clone, 'infra/.data/cogniate-app')); },
    'infra/.data': (clone, T) => { put(path.join(T, 'lti-service/lti.db'), 0o644, 'outside legacy'); fs.mkdirSync(path.join(clone, 'infra')); fs.symlinkSync(T, path.join(clone, 'infra/.data')); },
    'infra/.secrets': (clone, T) => { put(path.join(T, 'seed.json'), 0o644, 'outside secret'); fs.mkdirSync(path.join(clone, 'infra')); fs.symlinkSync(T, path.join(clone, 'infra/.secrets')); },
  };
  const want = {
    'lti-service': ['outside: infra/.data/lti-service is a symbolic link (not followed)'],
    'cogniate-app': ['outside: infra/.data/cogniate-app is a symbolic link (not followed)'],
    'infra/.data': ['outside: infra/.data/lti-service: not scanned: infra/.data (symlink)', 'outside: infra/.data/cogniate-app: not scanned: infra/.data (symlink)'],
    'infra/.secrets': ['outside: infra/.secrets/seed.json: not scanned: infra/.secrets (symlink)'],
  };
  for (const [k, edit] of Object.entries(make)) {
    const { root, scriptSha } = privateRoot(t);
    const clone = path.join(path.dirname(root), 'clone'), T = outsideT(path.dirname(root), 'T');
    fs.mkdirSync(clone); edit(clone, T);
    const before = tree(T);
    const rec = point(root, scriptSha, { clone, ledger: new Set([path.join(clone, 'infra/.secrets/seed.json')]) });
    assert.deepEqual(tree(T), before, k + ': T is unchanged');
    assert.deepEqual(none(rec), [[], [], []], k);
    assert.deepEqual([rec.failed, rec.problems], [true, want[k]], k);
  }
});

test('HARNESS ONLY: R2-01-04 a root that is missing, a file or of another owner is not walked or corrected; a 0755 area FAILs the closure and is still scanned', (t) => {
  { // (a) missing: the closure names the area; a missing extra root is not scanned.
    const { root, scriptSha } = privateRoot(t); fs.rmSync(path.join(root, 'quarantine'), { recursive: true });
    const rec = point(root, scriptSha, { extraRoots: [path.join(path.dirname(root), 'qa-m1-private-backup-Zz99Zz')] });
    assert.deepEqual([rec.failed, rec.problems], [true, ['private root not closed: quarantine (missing)', 'qa-m1-private-backup-Zz99Zz: not scanned: . (missing)']]);
  }
  { // (b) a regular file in place of an area and of an extra root: not read, not changed.
    const { root, scriptSha } = privateRoot(t); fs.rmSync(path.join(root, 'out'), { recursive: true }); put(path.join(root, 'out'), 0o644, 'a file');
    const extra = path.join(path.dirname(root), 'qa-m1-snapshot-private-Yy88Yy'); put(extra, 0o644, 'a file');
    const files = [path.join(root, 'out'), extra].map((f) => [f, fs.lstatSync(f)]);
    const rec = point(root, scriptSha, { extraRoots: [extra] });
    assert.deepEqual(none(rec), [[], [], []]);
    for (const [f, st] of files) assert.deepEqual([fs.lstatSync(f).mode & 0o7777, fs.lstatSync(f).ctimeMs, fs.lstatSync(f).ino], [0o644, st.ctimeMs, st.ino], 'Unchanged: ' + f);
    assert.deepEqual(rec.problems, ['private root not closed: out (file)', 'out: not scanned: out (file)', 'qa-m1-snapshot-private-Yy88Yy: not scanned: . (file)']);
  }
  { // (c) another owner: the expected uid is not the owner of the root and of the extra root; nothing inside is corrected.
    const { root, scriptSha } = privateRoot(t); const f = path.join(root, 'out/x.db'); put(f, 0o644, 'x');
    const extra = path.join(path.dirname(root), 'qa-m1-private-backup-Xx77Xx'), g = path.join(extra, 'original/manifest.json'); put(g, 0o644, '{}');
    const stF = fs.lstatSync(f), stG = fs.lstatSync(g);
    const rec = scanPoint({ point: 'p', privateRoot: root, uid: UID + 1, script: SCRIPT_NAME, scriptSha, extraRoots: [extra] });
    assert.deepEqual(none(rec), [[], [], []], 'Not walked: no hit, no correction, no refusal');
    for (const [p, st] of [[f, stF], [g, stG]]) assert.deepEqual([fs.lstatSync(p).mode & 0o7777, fs.lstatSync(p).ctimeMs], [0o644, st.ctimeMs], 'Unchanged: ' + p);
    for (const a of ['out', 'backups', 'quarantine', 'scratch', 'qa-m1-private-backup-Xx77Xx']) assert.ok(rec.problems.includes(`${a}: not scanned: . (owner ${UID})`), rec.problems.join('; '));
    assert.equal(rec.failed, true);
  }
  { // (d) a 0755 area of the host user: the closure FAILs, T is unchanged, and the area is still scanned (a same-owner hit is corrected).
    const { root, scriptSha } = privateRoot(t); const T = outsideT(path.dirname(root), 'T'), before = tree(T);
    fs.chmodSync(path.join(root, 'out'), 0o755); const f = path.join(root, 'out/x.db'); put(f, 0o644, 'x'); const st = fs.lstatSync(f);
    const rec = point(root, scriptSha);
    assert.deepEqual(rec.problems, ['private root not closed: out (mode 0755)']);
    assert.deepEqual([rec.failed, rec.hits.map((h) => h.path), rec.corrections.map((c) => c.ino), fs.lstatSync(f).mode & 0o7777], [true, ['x.db'], [st.ino], 0o600]);
    assert.deepEqual(tree(T), before);
  }
});

test('HARNESS ONLY: R2-01-05 a link inside an area is never followed: no record names a T inode; the scan passes as with T at 0600', (t) => {
  const { root, scriptSha } = privateRoot(t); const T = outsideT(path.dirname(root), 'T'), before = tree(T);
  fs.symlinkSync(T, path.join(root, 'out/sub'));
  const rec = point(root, scriptSha);
  assert.deepEqual(tree(T), before); assert.deepEqual(none(rec), [[], [], []]); assert.equal(rec.failed, false);
});

test('HARNESS ONLY: R2-01-06 a scratch removal never walks or removes a scratch folder that is not a real folder of the host user; it stops the phase', (t) => {
  const lane = scratchLane(t), base = path.dirname(lane.private);
  const kept = (label) => new RegExp(`^private scratch ${label}: scratch/${label}-[0-9a-f]{16}: not scanned: (scratch/${label}-[0-9a-f]{16}|scratch) \\((symlink|file)\\); the folder is not a real folder of the host user and is kept$`);
  // (c) the scratch folder replaced by a link to T.
  const s = lane.privateScratch('backup-read'), T = outsideT(base, 'T-c'), before = tree(T);
  fs.rmSync(s.path, { recursive: true }); fs.symlinkSync(T, s.path);
  assert.throws(() => s.remove(), (e) => e instanceof PhaseAbort && kept('backup-read').test(e.message), 'PhaseAbort; nothing walked');
  assert.deepEqual(tree(T), before, 'T is unchanged'); assert.equal(fs.readlinkSync(s.path), T, 'The link is kept');
  // (d) scratch/ replaced by a link to T2, which holds the label folder with a 0644 file.
  const s2 = lane.privateScratch('storage-paths'), T2 = path.join(base, 'T-d');
  fs.renameSync(lane.scratch, T2); fs.symlinkSync(T2, lane.scratch); put(path.join(T2, path.basename(s2.path), 'cogniate.db'), 0o644, 'outside');
  const before2 = tree(T2);
  try {
    assert.throws(() => s2.remove(), (e) => e instanceof PhaseAbort && kept('storage-paths').test(e.message));
    assert.deepEqual(tree(T2), before2, 'Nothing under the linked scratch/ is walked, corrected or removed');
  } finally { fs.unlinkSync(lane.scratch); fs.renameSync(T2, lane.scratch); }
  // (e) a regular file in place of the scratch folder.
  const s3 = lane.privateScratch('compat-config'); fs.rmSync(s3.path, { recursive: true }); put(s3.path, 0o644, 'a file'); const st = fs.lstatSync(s3.path);
  assert.throws(() => s3.remove(), (e) => e instanceof PhaseAbort && kept('compat-config').test(e.message));
  assert.deepEqual([fs.lstatSync(s3.path).ino, fs.lstatSync(s3.path).mode & 0o7777, fs.lstatSync(s3.path).ctimeMs], [st.ino, 0o644, st.ctimeMs], 'The file is unchanged');
  // (a) a clean real folder is removed.
  const s4 = lane.privateScratch('backup-read'); put(path.join(s4.path, 'lti.db'), 0o600); s4.remove(); assert.equal(fs.existsSync(s4.path), false);
});

test('HARNESS ONLY: R2-01-07 a correction stays in its area: a folder change before it, at its open or after it is refused; T is unchanged except in the late case', (t) => {
  const run = (variant) => {
    const { root, scriptSha } = privateRoot(t), T = path.join(path.dirname(root), 'T'); fs.mkdirSync(T, { mode: 0o700 });
    put(path.join(T, 'other.db'), 0o644, 'other'); const other0 = fs.lstatSync(path.join(T, 'other.db'));
    for (const d of ['out/a', 'out/a/b']) fs.mkdirSync(path.join(root, d), { mode: 0o700 });
    const file = path.join(root, 'out/a/b/x.db'); put(file, 0o644, 'x bytes'); const st0 = fs.lstatSync(file);
    const moveParent = () => { fs.renameSync(path.join(root, 'out/a'), path.join(T, 'a')); fs.symlinkSync(path.join(T, 'a'), path.join(root, 'out/a')); };
    const moveArea = () => { fs.renameSync(path.join(root, 'out'), path.join(T, 'out')); fs.symlinkSync(path.join(T, 'out'), path.join(root, 'out')); };
    // Another real folder takes the place of `level` ('' = the private root) and holds the same entries, so the same file inode.
    const replace = (level) => () => {
      const old = path.join(root, level), fresh = old + '-new';
      fs.mkdirSync(fresh, { mode: 0o700 });
      for (const n of fs.readdirSync(old)) fs.renameSync(path.join(old, n), path.join(fresh, n));
      fs.renameSync(old, path.join(T, 'old-' + (level.replace(/\W/g, '_') || 'root'))); fs.renameSync(fresh, old);
    };
    const early = { P: moveParent, R: moveArea, D: replace('out/a'), Da: replace('out'), Db: replace('') }[variant];
    const orig = { openSync: fs.openSync, fchmodSync: fs.fchmodSync, chmodSync: fs.chmodSync };
    let opens = 0; const calls = { fchmod: 0, chmod: 0 };
    fs.openSync = function (p, ...rest) {
      if (p !== file) return orig.openSync.call(fs, p, ...rest);
      opens += 1;
      if (opens === 2 && variant === 'O') moveParent(); // at the correction open: after stage 1, before the open
      const fd = orig.openSync.call(fs, p, ...rest);
      if (opens === 1 && early) early(); // after the hash of the record, before the correction
      return fd;
    };
    fs.fchmodSync = function (...a) { calls.fchmod += 1; orig.fchmodSync.apply(fs, a); if (variant === 'L') moveParent(); }; // L: after the change
    fs.chmodSync = function (...a) { calls.chmod += 1; return orig.chmodSync.apply(fs, a); };
    let rec;
    try { rec = point(root, scriptSha); } finally { Object.assign(fs, orig); }
    const moved = { P: path.join(T, 'a/b/x.db'), O: path.join(T, 'a/b/x.db'), L: path.join(T, 'a/b/x.db'), R: path.join(T, 'out/a/b/x.db') }[variant] ?? file;
    const other = fs.lstatSync(path.join(T, 'other.db'));
    return { rec, st0, calls: { ...calls, opens }, now: fs.lstatSync(moved), bytes: fs.readFileSync(moved, 'utf8'), other: [other.ino, other.mode, other.ctimeMs], other0: [other0.ino, other0.mode, other0.ctimeMs] };
  };
  const want = {
    P: 'path changed before the correction: out/a (symlink)',
    O: 'path changed after the open: out/a (symlink)',
    R: 'path changed before the correction: out (symlink)',
    D: 'path changed before the correction: out/a (another device or inode)',
    Da: 'path changed before the correction: out (another device or inode)',
    Db: 'path changed before the correction: . (another device or inode)',
    L: 'path changed during the correction (the recorded inode now has mode 0600): out/a (symlink)',
  };
  for (const variant of Object.keys(want)) {
    const { rec, st0, calls, now, bytes, other, other0 } = run(variant);
    assert.deepEqual([now.ino, bytes], [st0.ino, 'x bytes'], variant + ': the recorded inode and its bytes');
    assert.equal(now.mode & 0o7777, variant === 'L' ? 0o600 : 0o644, variant + ': mode (0600 only in the late case, as reported)');
    if (variant !== 'L') assert.equal(now.ctimeMs, st0.ctimeMs, variant + ': no chmod (ctime unchanged)');
    // The open spy saw the hash open (1) and, in O and L, the correction open (2); the fchmod spy saw exactly one call in L.
    assert.deepEqual(calls, { fchmod: variant === 'L' ? 1 : 0, chmod: 0, opens: variant === 'O' || variant === 'L' ? 2 : 1 }, variant + ': fchmod only in the late case, once');
    assert.deepEqual(other, other0, variant + ': every other entry of T is unchanged');
    assert.deepEqual(rec.refusals, [{ area: 'out', path: 'a/b/x.db', reason: want[variant] }], variant);
    assert.deepEqual([rec.failed, rec.corrections], [true, []], variant);
  }
});

test('HARNESS ONLY: R2-01-07o an outside hit (ledger or legacy) whose parent folder changes after the record is refused; the target is unchanged', (t) => {
  for (const [rel, level] of [['infra/.secrets/seed.json', 'infra/.secrets'], ['infra/.data/lti-service/lti.db', 'infra/.data']]) {
    const { root, scriptSha } = privateRoot(t), base = path.dirname(root), clone = path.join(base, 'clone'), T = path.join(base, 'T');
    fs.mkdirSync(T, { mode: 0o700 }); const file = path.join(clone, rel); put(file, 0o644, 'outside hit'); const st0 = fs.lstatSync(file);
    const orig = { openSync: fs.openSync, fchmodSync: fs.fchmodSync }; let opens = 0, fchmods = 0;
    fs.openSync = function (p, ...rest) {
      const fd = orig.openSync.call(fs, p, ...rest);
      if (p === file && ++opens === 1) { fs.renameSync(path.join(clone, level), path.join(T, path.basename(level))); fs.symlinkSync(path.join(T, path.basename(level)), path.join(clone, level)); }
      return fd;
    };
    fs.fchmodSync = function (...a) { fchmods += 1; return orig.fchmodSync.apply(fs, a); };
    let rec;
    try { rec = point(root, scriptSha, { clone, ledger: new Set([path.join(clone, 'infra/.secrets/seed.json')]) }); } finally { Object.assign(fs, orig); }
    const now = fs.lstatSync(path.join(T, path.basename(level), path.relative(path.join(clone, level), file)));
    assert.deepEqual([now.ino, now.mode & 0o7777, now.ctimeMs, fchmods], [st0.ino, 0o644, st0.ctimeMs, 0], rel + ': the target is unchanged; no fchmod');
    assert.deepEqual(rec.refusals, [{ area: 'outside', path: rel, reason: `path changed before the correction: ${level} (symlink)` }], rel);
  }
});

test('HARNESS ONLY: R2-01-02b a lane private root that is a link is never walked: closure FAIL, no area scanned, the target unchanged', (t) => {
  const { root, scriptSha } = privateRoot(t);
  put(path.join(root, 'out/x.db'), 0o644, 'x');
  const target = path.join(path.dirname(root), 'real-private'); fs.renameSync(root, target); fs.symlinkSync(target, root);
  const before = tree(target);
  const rec = point(root, scriptSha);
  assert.deepEqual(tree(target), before, 'The target is unchanged');
  assert.deepEqual(none(rec), [[], [], []]);
  assert.ok(rec.problems.includes('private root not closed: . (symlink)'), rec.problems.join('; '));
  for (const a of ['out', 'backups', 'quarantine', 'scratch']) assert.ok(rec.problems.includes(`${a}: not scanned: . (symlink)`), rec.problems.join('; '));
});

/** A real StorageLane with a fake runner whose saveText (the save of the removal scan record) can act after that scan. */
function savingLane(t, hook) {
  const run = tmp(t), r = { PROJECT: 'qa-scan-st', CLONE: path.join(run, 'clone'), saveText: (rel) => hook.fn?.(rel) };
  fs.mkdirSync(r.CLONE);
  const lane = new StorageLane(r);
  fs.mkdirSync(lane.private, { mode: 0o700 }); fs.mkdirSync(lane.scratch, { mode: 0o700 });
  return lane;
}
test('HARNESS ONLY: R2-01-06b a scratch folder whose parent folders change after the removal scan is not removed: PhaseAbort; nothing deleted through the link', (t) => {
  for (const level of ['scratch', '.']) {
    const hook = {}, lane = savingLane(t, hook), base = path.dirname(lane.private);
    const s = lane.privateScratch('backup-read'); put(path.join(s.path, 'lti.db'), 0o600, 'kept');
    const from = level === '.' ? lane.private : lane.scratch, to = path.join(base, level === '.' ? 'T-root' : 'T-scratch');
    let snap = null;
    hook.fn = (rel) => { if (!/scratch_removal/.test(rel)) return; hook.fn = null; fs.renameSync(from, to); fs.symlinkSync(to, from); snap = tree(to); };
    assert.throws(() => s.remove(), (e) => e instanceof PhaseAbort && e.message === `private scratch backup-read: the folder changed before the removal: ${level} (symlink); the folder is kept`, level);
    assert.ok(snap, level + ': the swap ran after the scan');
    assert.deepEqual(tree(to), snap, level + ': nothing under the link target is deleted or changed');
    assert.equal(fs.readlinkSync(from), to, level + ': the link stays');
  }
});

test('HARNESS ONLY: R2-02-05u withScratch keeps a body error as the thrown error and carries the refused removal correction as its cleanup', async (t) => {
  const lane = scratchLane(t), outsideFile = path.join(path.dirname(lane.private), 'outside-u.db'); put(outsideFile, 0o644, 'outside');
  const orig = fs.openSync; let target = null;
  fs.openSync = function (p, ...rest) { if (p === target) { fs.openSync = orig; fs.rmSync(target); fs.symlinkSync(outsideFile, target); } return orig.call(fs, p, ...rest); };
  try {
    await assert.rejects(lane.withScratch('backup-read', async (dir) => { const f = path.join(dir, 'lti.db'); put(f, 0o644, 'held'); target = f; throw new StorageFail('R2 injected body failure'); }),
      (e) => e instanceof StorageFail && !(e instanceof PhaseAbort) && e.message === 'R2 injected body failure' && e.scratchCleanup instanceof PhaseAbort
        && /^private scratch backup-read: scan hit: scratch\/backup-read-[0-9a-f]{16}\/lti\.db \(file 0644\); correction refused: scratch\/backup-read-[0-9a-f]{16}\/lti\.db: cannot open without a link follow \(ELOOP\); the folder is kept$/.test(e.scratchCleanup.message));
  } finally { fs.openSync = orig; }
  assert.equal(fs.lstatSync(outsideFile).mode & 0o7777, 0o644, 'The link target is unchanged');
  // Body PASS and a refused removal correction: the PhaseAbort itself (unchanged rule).
  target = null;
  fs.openSync = function (p, ...rest) { if (p === target) { fs.openSync = orig; fs.rmSync(target); fs.symlinkSync(outsideFile, target); } return orig.call(fs, p, ...rest); };
  try {
    await assert.rejects(lane.withScratch('storage-paths', async (dir) => { const f = path.join(dir, 'cogniate.db'); put(f, 0o644, 'held'); target = f; return 'value'; }),
      (e) => e instanceof PhaseAbort && /correction refused/.test(e.message));
  } finally { fs.openSync = orig; }
});
