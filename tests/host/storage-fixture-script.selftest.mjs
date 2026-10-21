// HARNESS ONLY: QA's in-container script, run on host temporary folders. No Docker, no product code.
// This proves QA's own listing, file-set, logical-row, plant, P5 and lock-oracle logic, not the product.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyOut, fileset, inside, listRoot, lockOracle, logicalRead, p5Delete, plant } from './storage-fixture-script.mjs';

const SCRIPT = fileURLToPath(new URL('./storage-fixture-script.mjs', import.meta.url));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function lane(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-fixture-script-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const lti = path.join(root, 'ltidb'), app = path.join(root, 'appdb'), out = path.join(root, 'out');
  for (const d of [lti, app, out, path.join(app, 'packages'), path.join(app, 'uploads')]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  return { root, lti, app, out };
}
async function makeDb(file, rows, { wal = true } = {}) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file);
  if (wal) db.exec('PRAGMA journal_mode = WAL');
  db.exec('CREATE TABLE platform (id INTEGER PRIMARY KEY, name TEXT, extra BLOB); CREATE TABLE schema_migration (name TEXT)');
  for (const name of rows) db.prepare('INSERT INTO platform (name, extra) VALUES (?, ?)').run(name, Buffer.from('x'));
  db.prepare("INSERT INTO schema_migration VALUES ('001_init.sql'), ('002_more.sql')").run();
  return db; // left open on purpose: the committed rows stay in -wal
}

test('HARNESS ONLY: listing has every entry with owner, mode and hash; symbolic links are never followed', (t) => {
  const l = lane(t);
  fs.writeFileSync(path.join(l.lti, 'lti.db'), 'db'); fs.symlinkSync('/etc/hosts', path.join(l.lti, 'lti.db-wal'));
  const listing = listRoot(l.lti);
  assert.equal(listing.state, 'present');
  assert.deepEqual(listing.entries.map((e) => [e.path, e.type]), [['.', 'dir'], ['lti.db', 'file'], ['lti.db-wal', 'symlink']]);
  assert.equal(listing.entries[1].sha256, crypto.createHash('sha256').update('db').digest('hex'));
  assert.equal(listing.entries[2].target, '/etc/hosts');
  assert.equal(listing.entries[0].mode, '0700');
  assert.deepEqual(listRoot(path.join(l.root, 'none')), { state: 'absent', entries: [] }, 'An absent volume is the value "absent"');
  const app = listRoot(l.app);
  assert.deepEqual(app.entries.map((e) => e.path), ['.', 'packages', 'uploads']);
});

test('HARNESS ONLY: file set and identity parse; an unparsable identity is reported, not repaired', (t) => {
  const l = lane(t);
  fs.writeFileSync(path.join(l.lti, '.storage-identity.json'), JSON.stringify({ formatVersion: 1, role: 'lti', pairId: 'a'.repeat(32) }));
  fs.writeFileSync(path.join(l.app, '.storage-identity.json'), '{ broken');
  fs.writeFileSync(path.join(l.app, 'cogniate.db'), 'x');
  const f = fileset({ lti: l.lti, app: l.app });
  assert.equal(f.lti.identity.json.pairId, 'a'.repeat(32));
  assert.match(f.app.identity.error, /^parse:/);
  assert.equal(f.app.files['cogniate.db'].present, true);
  assert.deepEqual(f.app.files['cogniate.db-wal'], { present: false });
  assert.equal(f.lti.journal.present, false);
});

test('HARNESS ONLY: logical read opens only a copy, sees committed rows still in -wal, and leaves the originals unchanged', async (t) => {
  const l = lane(t);
  const db = await makeDb(path.join(l.lti, 'lti.db'), ['qa-marker-one']);
  try {
    assert.ok(fs.existsSync(path.join(l.lti, 'lti.db-wal')), 'The fixture keeps committed rows in -wal');
    const before = Object.fromEntries(['lti.db', 'lti.db-wal', 'lti.db-shm'].filter((n) => fs.existsSync(path.join(l.lti, n))).map((n) => [n, sha(path.join(l.lti, n))]));
    const scratchBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-scratch-base-'));
    const read = await logicalRead(l.lti, 'lti.db', { markers: ['qa-marker-one', 'qa-marker-absent'], migrations: true, integrity: true, scratchBase });
    assert.deepEqual(read.markers, { 'qa-marker-one': 1, 'qa-marker-absent': 0 });
    assert.deepEqual(read.schemaMigration, ['001_init.sql', '002_more.sql']);
    assert.deepEqual(read.integrity, ['ok']);
    assert.deepEqual(fs.readdirSync(scratchBase), [], 'The scratch copy is removed');
    for (const [n, h] of Object.entries(before)) assert.equal(sha(path.join(l.lti, n)), h, 'Original unchanged: ' + n);
    fs.rmSync(scratchBase, { recursive: true, force: true });
  } finally { db.close(); }
});

test('HARNESS ONLY: planted changes are exact; unsafe paths are refused; stash and unstash keep bytes', (t) => {
  const l = lane(t);
  fs.writeFileSync(path.join(l.app, 'cogniate.db'), 'app-bytes');
  plant({ lti: l.lti, app: l.app }, [
    { op: 'write', vol: 'lti', path: 'notes.txt', base64: '' },
    { op: 'copy', fromVol: 'app', from: 'cogniate.db', vol: 'lti', path: 'cogniate.db' },
    { op: 'symlink', vol: 'lti', path: 'lti.db-wal', target: '/qa/out/target' },
    { op: 'mkdir', vol: 'lti', path: '.qa-scratch-0123456789abcdef', mode: '0700' },
    { op: 'flip', vol: 'app', path: 'cogniate.db', offset: 0 },
  ], { outDir: l.out });
  assert.equal(fs.statSync(path.join(l.lti, 'notes.txt')).size, 0);
  assert.equal(fs.readFileSync(path.join(l.lti, 'cogniate.db'), 'utf8'), 'app-bytes');
  assert.equal(fs.readlinkSync(path.join(l.lti, 'lti.db-wal')), '/qa/out/target');
  assert.notEqual(fs.readFileSync(path.join(l.app, 'cogniate.db'), 'utf8'), 'app-bytes', 'One byte changed');
  for (const bad of ['../escape', '/abs', 'a//b', 'lti.db-wal/inner']) {
    assert.throws(() => plant({ lti: l.lti, app: l.app }, [{ op: 'write', vol: 'lti', path: bad, base64: '' }]), `Refused: ${bad}`);
  }
  assert.throws(() => plant({ lti: l.lti, app: l.app }, [{ op: 'write', vol: 'lti', path: 'notes.txt', base64: '' }]), 'Never overwrites');
  const original = sha(path.join(l.app, 'cogniate.db'));
  plant({ lti: l.lti, app: l.app }, [{ op: 'stash', vol: 'app', names: ['cogniate.db', 'cogniate.db-wal'], hold: 'hold/a' }], { outDir: l.out });
  assert.equal(fs.existsSync(path.join(l.app, 'cogniate.db')), false);
  plant({ lti: l.lti, app: l.app }, [{ op: 'unstash', vol: 'app', names: ['cogniate.db', 'cogniate.db-wal'], hold: 'hold/a' }], { outDir: l.out });
  assert.equal(sha(path.join(l.app, 'cogniate.db')), original, 'Bytes back');
  fs.writeFileSync(path.join(l.lti, '.storage-identity.json'), JSON.stringify({ pairId: 'a', role: 'lti' }), { mode: 0o640 });
  plant({ lti: l.lti, app: l.app }, [{ op: 'editjson', vol: 'lti', path: '.storage-identity.json', set: { composeProject: 'qa-other' } }]);
  const edited = JSON.parse(fs.readFileSync(path.join(l.lti, '.storage-identity.json'), 'utf8'));
  assert.deepEqual(edited, { pairId: 'a', role: 'lti', composeProject: 'qa-other' });
  assert.equal(fs.statSync(path.join(l.lti, '.storage-identity.json')).mode & 0o777, 0o640, 'Mode kept');
  const copied = copyOut({ lti: l.lti, app: l.app }, { vol: 'lti', names: ['.storage-identity.json', 'absent.db'], folder: 'orig/lti' }, l.out);
  assert.deepEqual(copied.map((c) => [c.name, c.mode]), [['.storage-identity.json', '0640']], 'Absent names are skipped; mode kept');
  assert.throws(() => inside(l.lti, 'notes.txt/x'));
});

test('HARNESS ONLY: P5 deletes exactly one failed sync and refuses anything else', async (t) => {
  const l = lane(t);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(l.app, 'cogniate.db'));
  db.exec("CREATE TABLE score_sync (id TEXT PRIMARY KEY, status TEXT); INSERT INTO score_sync VALUES ('sync_a', 'failed'), ('sync_b', 'sent')");
  db.close();
  assert.deepEqual(await p5Delete(l.app, 'sync_a'), { deletedSyncId: 'sync_a', deletedCount: 1 });
  await assert.rejects(p5Delete(l.app, 'sync_a'), /must already be failed/);
  await assert.rejects(p5Delete(l.app, 'sync_b'), /must already be failed/);
  await assert.rejects(p5Delete(l.app, 'not a sync'), /Invalid sync id/);
  const check = new DatabaseSync(path.join(l.app, 'cogniate.db'));
  assert.deepEqual(check.prepare('SELECT id FROM score_sync ORDER BY id').all().map((r) => r.id), ['sync_b']);
  check.close();
});

test('HARNESS ONLY: QA lock oracle shows enforcement on this host folder; its decision-path negative (no shared lock) gives "not enforced"', async (t) => {
  const l = lane(t);
  const enforced = await lockOracle(path.join(l.root, 'enforced'));
  assert.equal(enforced.verdict, 'LOCK ENFORCED (B refused while A held)', JSON.stringify(enforced.bWhileHeld));
  assert.equal(enforced.bWhileHeld.error.errcode, 5);
  process.env.QA_ORACLE_NEGATIVE_CONTROL = 'separate-file';
  try {
    const negative = await lockOracle(path.join(l.root, 'negative'));
    assert.equal(negative.verdict, 'LOCK NOT ENFORCED (B acquired while A held)', 'The oracle can see a missing lock');
  } finally { delete process.env.QA_ORACLE_NEGATIVE_CONTROL; }
});

test('HARNESS ONLY: command line answers one JSON line; the oracle removes its .qa-scratch folder', (t) => {
  const l = lane(t);
  const run = (op, extra = []) => JSON.parse(execFileSync(process.execPath, ['--no-warnings', SCRIPT, op, '--lti', l.lti, '--app', l.app, '--out', l.out, ...extra], { encoding: 'utf8' }).trim().split('\n').at(-1));
  assert.equal(run('list').app.entries.length, 3);
  const spec = Buffer.from(JSON.stringify({ scratch: '.qa-scratch-0123456789abcdef' })).toString('base64');
  const o = JSON.parse(execFileSync(process.execPath, ['--no-warnings', SCRIPT, 'oracle', '--lti', l.lti, '--spec', spec], { encoding: 'utf8' }).trim().split('\n').at(-1));
  assert.equal(o.verdict, 'LOCK ENFORCED (B refused while A held)');
  assert.equal(o.scratchRemoved, true);
  assert.deepEqual(fs.readdirSync(l.lti), [], 'Nothing left in the volume root');
  const bad = Buffer.from(JSON.stringify({ scratch: 'other' })).toString('base64');
  assert.throws(() => execFileSync(process.execPath, ['--no-warnings', SCRIPT, 'oracle', '--lti', l.lti, '--spec', bad], { encoding: 'utf8', stdio: 'pipe' }));
});
