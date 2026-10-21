// HARNESS ONLY: the handoff binding of the storage repair (triage revision 4 §9.1) on a synthetic run root. No real
// migration child runs (QA-SRT-04). Each scene makes its entries in the order that the case needs; it never sets a
// time. Ordered events are at least 2 ms apart, and each premise is asserted before the check (IN-2, B-SR-04).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeHandoff } from './m1-migration.mjs';
import { baseOfStorageProject, checkHandoff } from './storage-handoff.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567', B = 'qa-multi-r1', PROJECT = `${B}-st`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const twoMsAfter = async (raw) => { while (Date.now() < raw + 2) await pause(1); };
/**
 * Makes D, w, the clone, the backup root, H and s in `order`. Returns the facts of the storage child and the raw times.
 * `edit` changes one fact for the outside, type and variable cases.
 */
async function scene(t, { order = ['D', 'w', 'clone', 'root', 'H', 's'], cloneName = `${B}-${SHA.slice(0, 8)}-2026-10-21T13-00-00-000Z`,
  rootName = 'qa-m1-private-backup-Ab12Cd', composeProject = B, cloneDir, rootDir } = {}) {
  const run = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-handoff-'))); // os.tmpdir() is under a link on macOS
  t.after(() => fs.rmSync(run, { recursive: true, force: true }));
  const f = { run, D: path.join(run, 'D-handoff'), clone: path.join(cloneDir ?? run, cloneName), root: path.join(rootDir ?? run, rootName) };
  f.backup = path.join(f.root, 'original'); f.H = path.join(f.D, 'handoff.json');
  const times = {};
  let last = null;
  for (const step of order) {
    if (last !== null) await twoMsAfter(last);
    if (step === 'D') { fs.mkdirSync(f.D, { mode: 0o700 }); fs.chmodSync(f.D, 0o700); last = times.D = fs.lstatSync(f.D).birthtimeMs; }
    if (step === 'w') { f.w = new Date().toISOString(); last = times.w = Date.parse(f.w); }
    if (step === 'clone') { fs.mkdirSync(f.clone, { recursive: true }); last = times.clone = fs.lstatSync(f.clone).birthtimeMs; }
    if (step === 'root') {
      fs.mkdirSync(f.root, { recursive: true, mode: 0o700 }); fs.chmodSync(f.root, 0o700); last = times.root = fs.lstatSync(f.root).birthtimeMs;
      fs.mkdirSync(f.backup, { mode: 0o700 }); fs.writeFileSync(path.join(f.backup, 'manifest.json'), JSON.stringify({ composeProject }), { mode: 0o600 });
    }
    if (step === 'H') { writeHandoff({ CLONE: f.clone }, f.backup, f.H); last = times.H = fs.lstatSync(f.H).mtimeMs; }
    if (step === 's') { f.s = Date.now(); last = times.s = f.s; }
  }
  f.times = times;
  f.facts = { file: f.H, windowStart: f.w, runRoot: run, project: PROJECT, productSha: SHA, s: f.s, hostUid: process.getuid() };
  return f;
}
/** The premise of a case, asserted on the raw times; a false premise is BLOCKED (the control does not grade it). */
const premise = (ok, what, times) => assert.ok(ok, `BLOCKED (precondition not made): ${what} ${JSON.stringify(times)}`);
const blocked = (f, item, edit = {}) => {
  const res = checkHandoff({ ...f.facts, ...edit });
  assert.equal(res.ok, false, 'BLOCKED expected');
  assert.equal(res.item, item, res.cause);
  assert.match(res.cause, new RegExp(`^handoff check failed: ${item}: `));
  return res;
};

test('HARNESS ONLY: V8-1 a handoff of this window passes and returns both paths; the writer creates H exclusively with mode 0600', async (t) => {
  const f = await scene(t);
  const { w, clone, root, H, s } = f.times;
  premise(w < clone && clone < root && root < H && H < s, 'w < clone < root < H < s', f.times);
  const res = checkHandoff(f.facts);
  assert.deepEqual([res.ok, res.m123Clone, res.m123Backup], [true, f.clone, f.backup]);
  const st = fs.lstatSync(f.H);
  assert.deepEqual([st.isFile(), st.mode & 0o7777, st.nlink], [true, 0o600, 1]);
  const bytes = fs.readFileSync(f.H);
  assert.throws(() => writeHandoff({ CLONE: f.clone }, f.backup, f.H), /EEXIST/, 'A second write to the same path fails');
  assert.deepEqual(fs.readFileSync(f.H), bytes, 'and leaves H unchanged');
  assert.equal(baseOfStorageProject(PROJECT), B);
});

test('HARNESS ONLY: V8-2 a stale handoff, clone or backup root, or s before H, is BLOCKED with the window item', async (t) => {
  const a = await scene(t, { order: ['D', 'clone', 'root', 'w', 'H', 's'] });
  premise(a.times.clone < a.times.w && a.times.root < a.times.w, 'clone and root before w', a.times);
  blocked(a, 'clone');
  const b = await scene(t, { order: ['D', 'clone', 'root', 'H', 'w', 's'] });
  premise(b.times.H < b.times.w, 'H before w', b.times);
  blocked(b, 'handoff file');
  const c = await scene(t, { order: ['D', 'w', 'clone', 'root', 's', 'H'] });
  premise(c.times.s < c.times.H, 's before H.mtime', c.times);
  blocked(c, 'handoff file');
  const d = await scene(t, { order: ['D', 'w', 'root', 'clone', 'H', 's'] });
  premise(d.times.root < d.times.clone, 'root before the clone', d.times);
  blocked(d, 'backup root');
});

test('HARNESS ONLY: V8-3 a clone or backup root outside this window\'s lane is BLOCKED; the handoff path alone is never trusted', async (t) => {
  const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-handoff-elsewhere-'))); t.after(() => fs.rmSync(elsewhere, { recursive: true, force: true }));
  blocked(await scene(t, { cloneDir: elsewhere }), 'clone');
  const nested = await scene(t, { cloneName: `deeper/${B}-${SHA.slice(0, 8)}-2026-10-21T13-00-00-000Z` });
  assert.equal(blocked(nested, 'clone').cause, 'handoff check failed: clone: not in the run root', 'Inside the run root but not a direct entry');
  blocked(await scene(t, { cloneName: `qa-canvas-${SHA.slice(0, 8)}-2026-10-21T13-00-00-000Z` }), 'clone');
  blocked(await scene(t, { cloneName: `${B}-ffffffff-2026-10-21T13-00-00-000Z` }), 'clone');
  blocked(await scene(t, { cloneName: `${PROJECT}-${SHA.slice(0, 8)}-2026-10-21T13-00-00-000Z` }), 'clone');
  blocked(await scene(t, { rootDir: elsewhere }), 'backup root');
  blocked(await scene(t, { rootName: 'qa-m1-snapshot-private-Ab12Cd' }), 'backup root');
  const other = await scene(t);
  fs.mkdirSync(path.join(other.root, 'second')); fs.writeFileSync(path.join(other.root, 'second/manifest.json'), JSON.stringify({ composeProject: B }));
  fs.rmSync(other.H); writeHandoff({ CLONE: other.clone }, path.join(other.root, 'second'), other.H);
  blocked(other, 'backup root', { s: Date.now() + 10 });
  blocked(await scene(t, { composeProject: 'qa-other-project' }), 'backup');
  blocked(await scene(t), 'project', { project: 'qa-multi-r1' });
  blocked(await scene(t), 'project', { project: 'qa-canvas-st', productSha: 'nope' });
});

test('HARNESS ONLY: V8-4 a link, a wrong mode or owner, or a missing or wrong window variable is BLOCKED', async (t) => {
  const link = await scene(t);
  fs.renameSync(link.H, link.H + '.real'); fs.symlinkSync(link.H + '.real', link.H);
  blocked(link, 'handoff file');
  const wide = await scene(t); fs.chmodSync(wide.H, 0o644); blocked(wide, 'handoff file');
  const folder = await scene(t); fs.chmodSync(folder.D, 0o755); blocked(folder, 'handoff file');
  const viaLink = await scene(t);
  fs.symlinkSync(viaLink.clone, path.join(viaLink.run, `${B}-${SHA.slice(0, 8)}-2026-10-21T13-59-59-999Z`));
  const content = JSON.parse(fs.readFileSync(viaLink.H, 'utf8'));
  fs.rmSync(viaLink.H); fs.writeFileSync(viaLink.H, JSON.stringify({ ...content, m123Clone: path.join(viaLink.run, `${B}-${SHA.slice(0, 8)}-2026-10-21T13-59-59-999Z`) }), { mode: 0o600 });
  blocked(viaLink, 'handoff file', { s: Date.now() + 10 });
  const root = await scene(t); fs.chmodSync(root.root, 0o755); blocked(root, 'backup root');
  const owner = await scene(t);
  assert.equal(blocked(owner, 'handoff file', { hostUid: process.getuid() + 1 }).cause, `handoff check failed: handoff file: owner ${process.getuid()} is not the host user`);
  const w = await scene(t);
  blocked(w, 'window', { windowStart: undefined });
  blocked(w, 'window', { windowStart: w.w.replace('Z', '+00:00') });
  blocked(w, 'window', { windowStart: '2026-10-21T13:00:00Z' });
  blocked(w, 'window', { windowStart: new Date(w.s + 5).toISOString() });
  blocked(w, 'handoff file', { file: undefined });
});
