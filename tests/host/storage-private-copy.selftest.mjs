// HARNESS ONLY: the private copy helpers of the storage repair (triage revision 4 §7.3) and the copy sites of QA's
// fixture script, on host temporary folders. V4-1 (sites #1–#8, creation hook and final mode), V4-2 (into-volume
// final modes), V4-8 (the private empty file and its lstat checks) and IN-4. Each umask is pinned and asserted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkCapture, copyOut, intoVolumeWrite, logicalRead, plant, privateCopy, privateCopyTree, privateEmptyFile, privateReplace, privateWrite,
} from './storage-fixture-script.mjs';
import { LegacyFixtures } from './storage-oracle.mjs';

const { DatabaseSync } = await import('node:sqlite');
const SCRIPT = fileURLToPath(new URL('./storage-fixture-script.mjs', import.meta.url));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const mode = (f) => fs.lstatSync(f).mode & 0o7777;
function tmp(t) { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-private-copy-'))); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; }
/** Runs `fn` with the umask pinned (and asserted); restores the old mask. */
function withUmask(mask, fn) {
  const old = process.umask(mask);
  try { assert.equal(process.umask(mask), mask, 'umask pinned'); return fn(); } finally { process.umask(old); }
}
async function withUmaskAsync(mask, fn) {
  const old = process.umask(mask);
  try { assert.equal(process.umask(mask), mask, 'umask pinned'); return await fn(); } finally { process.umask(old); }
}
/** A volume-like layout with a 0644 source file of each kind. */
function layout(t) {
  const root = tmp(t), lti = path.join(root, 'ltidb'), app = path.join(root, 'appdb'), out = path.join(root, 'out');
  for (const d of [lti, app, out]) fs.mkdirSync(d, { mode: 0o700 });
  for (const [dir, name, text] of [[lti, 'lti.db', 'lti bytes'], [lti, '.storage-identity.json', '{"pairId":"a"}'], [app, 'cogniate.db', 'app bytes']]) {
    fs.writeFileSync(path.join(dir, name), text); fs.chmodSync(path.join(dir, name), 0o644);
  }
  return { root, lti, app, out, roots: { lti, app } };
}
/** V4-1: the hook saw an empty 0600 regular file, and it is the final file (same device and inode). */
function createdAs0600(hooks, file) {
  const st = fs.lstatSync(file), h = hooks.find((x) => x.target === file);
  assert.ok(h, 'Hook for ' + file);
  assert.deepEqual([h.regular, h.mode, h.size], [true, '0600', 0], 'Created empty 0600: ' + file);
  assert.deepEqual([h.dev, h.ino], [st.dev, st.ino], 'The created inode is the final file: ' + file);
}

for (const mask of [0o022, 0o000]) {
  test(`HARNESS ONLY: V4-1 fixture copy sites #1–#7 are 0600 from creation (umask ${mask.toString(8).padStart(3, '0')})`, async (t) => {
    await withUmaskAsync(mask, async () => {
      const l = layout(t), hooks = [], hook = (h) => hooks.push(h);
      // #1 stash: volume → out/<hold>; the source mode is recorded, never applied.
      const stashed = plant(l.roots, [{ op: 'stash', vol: 'lti', names: ['lti.db'], hold: 'hold/s1' }], { outDir: l.out, hook });
      createdAs0600(hooks, path.join(l.out, 'hold/s1/lti.db')); assert.equal(mode(path.join(l.out, 'hold/s1/lti.db')), 0o600);
      assert.equal(stashed[0].moved[0].mode, '0644', 'Source mode recorded');
      // #2 unstash: creation hook only (its final mode is V4-2).
      plant(l.roots, [{ op: 'unstash', vol: 'lti', names: ['lti.db'], hold: 'hold/s1' }], { outDir: l.out, hook });
      createdAs0600(hooks, path.join(l.lti, 'lti.db'));
      // #3 copyOut: volume → out/<folder>, 0600; the returned mode is the source mode.
      const copied = copyOut(l.roots, { vol: 'lti', names: ['.storage-identity.json'], folder: 'orig/lti' }, l.out, { hook });
      createdAs0600(hooks, path.join(l.out, 'orig/lti/.storage-identity.json')); assert.equal(mode(path.join(l.out, 'orig/lti/.storage-identity.json')), 0o600);
      assert.equal(copied[0].mode, '0644');
      // #4 logicalRead: copies under the caller's scratchBase only (in the container: its own layer; on the host: lane scratch).
      const db = new DatabaseSync(path.join(l.app, 'q.db')); db.exec("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('m')"); db.close(); fs.chmodSync(path.join(l.app, 'q.db'), 0o644);
      const base = path.join(l.root, 'scratch-base'); fs.mkdirSync(base, { mode: 0o700 });
      const seen = [];
      const read = await logicalRead(l.app, 'q.db', { markers: ['m'], scratchBase: base, hook: (h) => seen.push({ ...h, mode0: mode(h.target) }) });
      assert.equal(read.markers.m, 1);
      assert.equal(seen.length, 1); assert.ok(seen[0].target.startsWith(base + path.sep)); assert.deepEqual([seen[0].mode, seen[0].size], ['0600', 0]);
      await assert.rejects(logicalRead(l.app, 'q.db', {}), /needs an absolute scratchBase/, 'No default scratchBase');
      await assert.rejects(logicalRead(l.app, 'absent.db', {}), /needs an absolute scratchBase/, 'Also when the database is absent');
      // #5 plant copy and #6 plant write and editjson: creation hook only.
      plant(l.roots, [{ op: 'copy', fromVol: 'app', from: 'cogniate.db', vol: 'lti', path: 'cogniate.db' }], { outDir: l.out, hook });
      createdAs0600(hooks, path.join(l.lti, 'cogniate.db'));
      plant(l.roots, [{ op: 'write', vol: 'lti', path: 'notes.txt', base64: '', mode: '0644' }], { outDir: l.out, hook });
      createdAs0600(hooks, path.join(l.lti, 'notes.txt'));
      const before = hooks.length;
      plant(l.roots, [{ op: 'editjson', vol: 'lti', path: '.storage-identity.json', set: { x: 1 } }], { outDir: l.out, hook });
      assert.equal(hooks.length, before + 1); const h = hooks.at(-1); const st = fs.lstatSync(path.join(l.lti, '.storage-identity.json'));
      assert.deepEqual([h.mode, h.size, h.dev, h.ino], ['0600', 0, st.dev, st.ino], 'editjson: the temporary made 0600 is the final file');
      // #7 the oracle-B negative copy (a child process of the oracle): its final file is 0600 under this mask.
      const neg = path.join(l.root, 'neg'); fs.mkdirSync(neg);
      const dbf = path.join(neg, 't.db'), d2 = new DatabaseSync(dbf); d2.exec('PRAGMA journal_mode = WAL; CREATE TABLE t (id INTEGER PRIMARY KEY, who TEXT)'); d2.close(); fs.chmodSync(dbf, 0o644);
      try { execFileSync(process.execPath, ['--no-warnings', SCRIPT, 'oracle-B', '--file', dbf], { env: { ...process.env, QA_ORACLE_NEGATIVE_CONTROL: 'separate-file' }, stdio: 'pipe' }); }
      catch (e) { assert.equal(e.status, 2, 'oracle-B acquired on its separate copy'); }
      const copies = fs.readdirSync(neg).filter((n) => /^t\.db\.qa-negative-\d+$/.test(n));
      assert.equal(copies.length, 1); assert.equal(mode(path.join(neg, copies[0])), 0o600, 'Site #7 final 0600');
    });
  });
}

test('HARNESS ONLY: V4-1 #8 a legacy placement is 0600 from creation; #12 and #13 recursive copies: 0700 folders, 0600 files, a link fails', (t) => {
  for (const mask of [0o022, 0o000]) withUmask(mask, () => {
    const root = tmp(t), src = path.join(root, 'b.db'); fs.writeFileSync(src, 'legacy'); fs.chmodSync(src, 0o644);
    const hooks = [];
    new LegacyFixtures(root).place('lti-service', 'lti.db', src, { hook: (h) => hooks.push(h) });
    const placed = path.join(root, 'infra/.data/lti-service/lti.db');
    createdAs0600(hooks, placed); assert.equal(mode(placed), 0o600);
    const tree = path.join(root, 'B');
    for (const d of ['lti-service', 'cogniate-app']) { fs.mkdirSync(path.join(tree, d), { recursive: true }); fs.chmodSync(path.join(tree, d), 0o755); }
    for (const f of ['lti-service/lti.db', 'cogniate-app/cogniate.db', 'manifest.json']) { fs.writeFileSync(path.join(tree, f), f); fs.chmodSync(path.join(tree, f), 0o644); }
    const th = [], copy = path.join(root, 'copy');
    const list = privateCopyTree(tree, copy, { hook: (h) => th.push(h) });
    assert.equal(list.length, 3);
    for (const f of ['lti-service/lti.db', 'cogniate-app/cogniate.db', 'manifest.json']) { createdAs0600(th, path.join(copy, f)); assert.equal(mode(path.join(copy, f)), 0o600); assert.equal(sha(path.join(copy, f)), sha(path.join(tree, f))); }
    for (const d of ['', 'lti-service', 'cogniate-app']) assert.equal(mode(path.join(copy, d)), 0o700, 'Folder 0700: ' + (d || '.'));
    fs.symlinkSync('/etc/hosts', path.join(tree, 'cogniate-app/link'));
    assert.throws(() => privateCopyTree(tree, path.join(root, 'copy2')), /symbolic link: cogniate-app\/link/, 'A link fails and is never followed');
    assert.throws(() => privateCopyTree(path.join(tree, 'cogniate-app/link'), path.join(root, 'copy3')), /not a real folder/);
    assert.throws(() => privateCopyTree(tree, copy), /EEXIST/, 'Never into an existing folder');
  });
});

test('HARNESS ONLY: V4-2 every returned or planted volume file has exactly its recorded or planted mode (umask 022 and 077)', (t) => {
  for (const mask of [0o022, 0o077]) for (const recorded of [0o644, 0o600]) withUmask(mask, () => {
    const l = layout(t);
    fs.chmodSync(path.join(l.lti, 'lti.db'), recorded); fs.chmodSync(path.join(l.lti, '.storage-identity.json'), recorded);
    const before = sha(path.join(l.lti, 'lti.db'));
    plant(l.roots, [{ op: 'stash', vol: 'lti', names: ['lti.db'], hold: 'h' }], { outDir: l.out });
    plant(l.roots, [{ op: 'unstash', vol: 'lti', names: ['lti.db'], hold: 'h' }], { outDir: l.out });
    assert.equal(mode(path.join(l.lti, 'lti.db')), recorded, 'unstash: the recorded original mode');
    assert.equal(sha(path.join(l.lti, 'lti.db')), before);
    copyOut(l.roots, { vol: 'lti', names: ['lti.db'], folder: 'o/lti' }, l.out);
    fs.rmSync(path.join(l.lti, 'lti.db'));
    plant(l.roots, [{ op: 'unstash', vol: 'lti', names: ['lti.db'], hold: 'o/lti' }], { outDir: l.out });
    assert.equal(mode(path.join(l.lti, 'lti.db')), recorded, 'unstash of a copy-out hold: the recorded original mode');
    plant(l.roots, [{ op: 'write', vol: 'lti', path: 'w644', base64: '', mode: '0644' }, { op: 'write', vol: 'lti', path: 'w600', base64: '' }], { outDir: l.out });
    assert.deepEqual([mode(path.join(l.lti, 'w644')), mode(path.join(l.lti, 'w600'))], [0o644, 0o600], 'write: the planted mode');
    plant(l.roots, [{ op: 'copy', fromVol: 'lti', from: 'lti.db', vol: 'app', path: 'lti.db' }, { op: 'copy', fromVol: 'lti', from: 'lti.db', vol: 'app', path: 'p644', mode: '0644' }], { outDir: l.out });
    assert.deepEqual([mode(path.join(l.app, 'lti.db')), mode(path.join(l.app, 'p644'))], [recorded, 0o644], 'copy: the source mode, or the planted mode');
    plant(l.roots, [{ op: 'editjson', vol: 'lti', path: '.storage-identity.json', set: { y: 2 } }], { outDir: l.out });
    assert.equal(mode(path.join(l.lti, '.storage-identity.json')), recorded, 'editjson: the recorded original mode');
    assert.deepEqual(plant(l.roots, [{ op: 'unstash', vol: 'lti', names: ['notes'], hold: 'x' }], { outDir: l.out })[0].moved, [], 'An absent held file is skipped');
  });
});

test('HARNESS ONLY: private helper contracts: exclusive create, no link follow, verified bytes, replace by rename', (t) => {
  for (const mask of [0o022, 0o000]) withUmask(mask, () => {
    const d = tmp(t), src = path.join(d, 'src'); fs.writeFileSync(src, 'secret-bytes'); fs.chmodSync(src, 0o644);
    const r = privateCopy(src, path.join(d, 'c'));
    assert.deepEqual([r.mode, r.sourceMode, mode(path.join(d, 'c'))], ['0600', '0644', 0o600]);
    assert.throws(() => privateCopy(src, path.join(d, 'c')), /EEXIST/, 'An existing target fails and stays unchanged');
    fs.symlinkSync(path.join(d, 'elsewhere'), path.join(d, 'link'));
    assert.throws(() => privateWrite(path.join(d, 'link'), Buffer.from('x')), /EEXIST|ELOOP/, 'A link target fails');
    assert.equal(fs.existsSync(path.join(d, 'elsewhere')), false, 'The link is not followed');
    fs.symlinkSync(src, path.join(d, 'src-link'));
    assert.throws(() => privateCopy(path.join(d, 'src-link'), path.join(d, 'c2')), /ELOOP|regular/, 'A link source is never followed');
    fs.writeFileSync(path.join(d, 'target'), 'old'); fs.chmodSync(path.join(d, 'target'), 0o644);
    privateReplace(path.join(d, 'target'), Buffer.from('new'));
    assert.deepEqual([fs.readFileSync(path.join(d, 'target'), 'utf8'), mode(path.join(d, 'target'))], ['new', 0o600]);
    assert.deepEqual(fs.readdirSync(d).filter((n) => n.startsWith('.qa-replace-')), [], 'No temporary is left');
    assert.throws(() => intoVolumeWrite(path.join(d, 'v'), Buffer.from('x')), /target mode is required/);
  });
});

test('HARNESS ONLY: V4-8 private empty file: exclusive 0600 create, then the lstat checks before and after the shell', (t) => {
  withUmask(0o022, () => {
    const d = tmp(t), f = path.join(d, 'env');
    const id = privateEmptyFile(f);
    assert.deepEqual([id.mode, id.size, mode(f)], ['0600', 0, 0o600]);
    assert.deepEqual(checkCapture(f, id, 'before'), []);
    assert.throws(() => privateEmptyFile(f), /EEXIST/, 'A target that exists before the create fails');
    fs.symlinkSync('/etc/hosts', path.join(d, 'l'));
    assert.throws(() => privateEmptyFile(path.join(d, 'l')), /EEXIST|ELOOP/);
    fs.writeFileSync(f, 'x');
    assert.deepEqual(checkCapture(f, id, 'before'), ['env before the shell: not empty']);
    assert.deepEqual(checkCapture(f, id, 'after'), [], 'After the shell the file may hold the capture');
    fs.rmSync(f); fs.symlinkSync('/etc/hosts', f);
    const linked = checkCapture(f, id, 'before');
    for (const p of ['env before the shell: not a regular file', 'env before the shell: another device or inode']) assert.ok(linked.includes(p), p);
    fs.rmSync(f); fs.writeFileSync(f, ''); fs.chmodSync(f, 0o600);
    assert.ok(checkCapture(f, id, 'after').includes('env after the shell: another device or inode'), 'Another inode after the shell');
    fs.chmodSync(f, 0o644);
    assert.ok(checkCapture(f, { ...id, ...fs.lstatSync(f) }, 'after').some((p) => /mode 0644/.test(p)));
    fs.rmSync(f);
    assert.deepEqual(checkCapture(f, id, 'after'), ['env: ENOENT']);
  });
});

test('HARNESS ONLY: IN-4 the container logical read uses its own temporary folder; a spec scratchBase cannot choose another one', (t) => {
  const d = tmp(t), lti = path.join(d, 'ltidb'), own = path.join(d, 'own-tmp'), evil = path.join(d, 'evil');
  for (const x of [lti, own, evil]) fs.mkdirSync(x, { mode: 0o700 });
  const db = new DatabaseSync(path.join(lti, 'lti.db')); db.exec("CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('m')"); db.close();
  fs.chmodSync(evil, 0o500);
  const spec = Buffer.from(JSON.stringify({ markers: ['m'], scratchBase: evil })).toString('base64');
  const outText = execFileSync(process.execPath, ['--no-warnings', SCRIPT, 'logical', '--lti', lti, '--spec', spec], { env: { ...process.env, TMPDIR: own }, encoding: 'utf8' });
  const answer = JSON.parse(outText.trim().split('\n').at(-1));
  assert.equal(answer.lti?.markers?.m, 1, 'The read used the container temporary folder: ' + outText);
  assert.deepEqual(fs.readdirSync(evil), [], 'Nothing in the folder named by the spec');
  fs.chmodSync(evil, 0o700);
});
