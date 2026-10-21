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
