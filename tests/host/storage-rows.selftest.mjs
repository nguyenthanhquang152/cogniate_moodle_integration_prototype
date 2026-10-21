// HARNESS ONLY: the storage-phase order, prerequisites and helpers. No Docker and no product command.
// Prerequisite failures are shown with a fake lane whose boot is BLOCKED; no row reaches Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STORAGE_GROUPS } from './storage-inventory.mjs';
import { StorageBlocked } from './storage-docker.mjs';
import { NEEDS, SEQUENCE, copyCredentials, coversListing, defineRows, storagePaths, storagePhase } from './storage-rows.mjs';
import { volumeSnapshot } from './m1-migration.mjs';

const rows = SEQUENCE.filter((s) => !s.startsWith('@'));
const at = (id) => SEQUENCE.indexOf(id);

test('HARNESS ONLY: the storage sequence runs each of the 70 storage-phase rows exactly once, with a procedure', () => {
  const storageIds = Object.values(STORAGE_GROUPS).flat().filter((id) => !id.startsWith('j-'));
  assert.equal(storageIds.length, 70);
  assert.deepEqual([...rows].sort(), [...storageIds].sort());
  assert.equal(new Set(rows).size, rows.length, 'No row twice');
  const procedures = defineRows({ lane: {}, r: {}, add: () => {}, acc: {}, state: {} });
  for (const step of SEQUENCE) assert.equal(typeof procedures[step], 'function', 'Procedure for ' + step);
  for (const [step, needs] of Object.entries(NEEDS)) {
    assert.ok(SEQUENCE.includes(step), 'NEEDS names a known step: ' + step);
    for (const n of needs) assert.ok(at(n) >= 0 && at(n) < SEQUENCE.lastIndexOf(step), `${step} needs ${n}, which runs before it`);
  }
});

test('HARNESS ONLY: the contract order constraints hold', () => {
  const firstE = Math.min(...SEQUENCE.map((s, i) => (/^e-/.test(s) ? i : Infinity)));
  assert.ok(at('a-first-start-resume') < firstE, 'a-first-start-resume before any e-* legacy copy (B-S-23)');
  assert.ok(at('g-tamper') < at('g-quarantine-in-use') && at('g-quarantine-in-use') < at('g-quarantine'), 'in-use before quarantine, on the g-tamper state');
  assert.ok(at('g-quarantine') < at('h-target-state') && at('h-target-state') < at('g-fresh-target'), 'h-target-state (2) between g-quarantine and g-fresh-target');
  assert.ok(at('g-fresh-target') < at('h-pair-mismatch'), 'h-pair-mismatch after g-fresh-target');
  assert.ok(at('@old-schema-setup') > at('b-sequence') && at('e-old-schema') > at('@old-schema-setup'), 'e-old-schema in the last block after its reset');
  assert.equal(SEQUENCE.at(-2), 'e-old-schema'); assert.equal(SEQUENCE.at(-1), 'e-content-missing');
  const drills = SEQUENCE.filter((s) => /^g-(prepared|staged|swap|identity|committed|rollback)/.test(s));
  assert.equal(drills.at(-1), 'g-committed-lti', 'The committing drill is last, so every other drill rolls back to the post-B state');
  assert.ok(at('g-damaged') < at(drills[0]) && at('h-nomanifest') < at(drills[0]), '"no journal file" rows run before any drill writes a journal');
  assert.ok(at('d-clean') > at('a-restart') && at('f-originals-back') > at('f-half-pair'));
  assert.ok(at('e-import') > at('e-import-recover') && at('e-kept') > at('e-import'));
  assert.ok(at('a-fresh') < at('@seed'), 'a-fresh is the lane first start');
  assert.ok(at('c-selftest') < at('a-fresh') && at('c-host-negative') < at('a-fresh'));
});

test('HARNESS ONLY: a BLOCKED preparation blocks every storage row, each with its reason; nothing reaches Docker', async () => {
  const recorded = [];
  const lane = { boot: async () => { throw new StorageBlocked('image not present'); },
    r: { record: (...a) => recorded.push(a), saveText: () => {}, state: {} } };
  const identity = { productSha: 'a'.repeat(40), testSha: 'b'.repeat(40) };
  const out = await storagePhase(lane, { identity, handoff: () => null, setupClone: async () => assert.fail('no clone setup') });
  assert.equal(out.length, 70);
  assert.ok(out.every((r) => r.status === 'BLOCKED' && r.environment === 'SIM' && r.productSha === identity.productSha));
  assert.ok(out.find((r) => r.id === 'M1-41.common.a-fresh').notes[0].includes('@prepare'));
  assert.ok(recorded.some(([id, , status, notes]) => id === 'STORAGE-PREPARE' && status === 'FAIL' && notes.includes('image not present')));
});

test('HARNESS ONLY: e-old-schema helpers copy only the four .env values and four secret files, and count storage_path values', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rows-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const from = path.join(root, 'm123'), to = path.join(root, 'st');
  for (const c of [from, to]) fs.mkdirSync(path.join(c, 'infra/.secrets/app'), { recursive: true });
  fs.writeFileSync(path.join(from, '.env'), 'LTI_MASTER_KEY=m1\nAPP_MASTER_KEY=m2\nPORTAL_THANH_PASSWORD=p1\nPORTAL_QAB_PASSWORD=p2\nDB_PASS=old\nCOMPOSE_PROJECT_NAME=qa-multi-r1\n');
  fs.writeFileSync(path.join(to, '.env'), 'LTI_MASTER_KEY=s1\nAPP_MASTER_KEY=s2\nPORTAL_THANH_PASSWORD=s3\nPORTAL_QAB_PASSWORD=s4\nDB_PASS=keep\nCOMPOSE_PROJECT_NAME=qa-multi-r1-st\n');
  for (const f of ['lti-api-key.cogniate', 'lti-api-key.qa-second', 'app/lti-api-key', 'seed.json', 'other']) fs.writeFileSync(path.join(from, 'infra/.secrets', f), 'v-' + f);
  copyCredentials(to, from);
  const env = fs.readFileSync(path.join(to, '.env'), 'utf8');
  assert.match(env, /LTI_MASTER_KEY=m1/); assert.match(env, /PORTAL_QAB_PASSWORD=p2/);
  assert.match(env, /DB_PASS=keep/, 'The lane keeps its own DB_PASS'); assert.match(env, /COMPOSE_PROJECT_NAME=qa-multi-r1-st/, 'and its own project');
  assert.equal(fs.existsSync(path.join(to, 'infra/.secrets/other')), false, 'Nothing else is copied');
  assert.equal(fs.statSync(path.join(to, 'infra/.secrets/seed.json')).mode & 0o777, 0o600);
  const app = path.join(root, 'app'); fs.mkdirSync(app);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path.join(app, 'cogniate.db'));
  db.exec("CREATE TABLE package (id TEXT, storage_path TEXT); INSERT INTO package VALUES ('1','packages/pkg_a'),('2','packages/pkg_a'),('3','packages/pkg_b/v2'),('4',NULL)");
  db.close();
  assert.deepEqual(await storagePaths(app), { values: ['packages/pkg_a', 'packages/pkg_b/v2'], folders: ['pkg_a', 'pkg_b'] });
});

test('HARNESS ONLY: a quarantine copy must hold every listed file with equal bytes', (t) => {
  const q = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-q-')); t.after(() => fs.rmSync(q, { recursive: true, force: true }));
  fs.mkdirSync(path.join(q, 'ltidb')); fs.writeFileSync(path.join(q, 'ltidb/lti.db'), 'x'); fs.writeFileSync(path.join(q, 'quarantine.json'), '{}');
  const sha = '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881';
  const listing = { lti: { entries: [{ path: 'lti.db', type: 'file', size: 1, sha256: sha }] }, app: { entries: [] } };
  assert.doesNotThrow(() => coversListing(q, listing));
  listing.app.entries.push({ path: 'cogniate.db', type: 'file', size: 1, sha256: sha });
  assert.throws(() => coversListing(q, listing), /holds app:cogniate.db/);
});

test('HARNESS ONLY: the migration snapshot from the volumes has the host-folder shape', async () => {
  const f = { lti: { files: { 'lti.db': { present: true, size: 3, sha256: 'a' }, 'lti.db-wal': { present: true, size: 1, sha256: 'b' }, 'lti.db-shm': { present: false } } },
    app: { files: { 'cogniate.db': { present: true, size: 4, sha256: 'c' }, 'cogniate.db-wal': { present: false }, 'cogniate.db-shm': { present: false } } } };
  assert.deepEqual(await volumeSnapshot({ fileset: async () => f }), {
    'lti-service/lti.db': { bytes: 3, sha256: 'a' }, 'lti-service/lti.db-wal': { bytes: 1, sha256: 'b' }, 'cogniate-app/cogniate.db': { bytes: 4, sha256: 'c' } });
  await assert.rejects(volumeSnapshot({ fileset: async () => ({ lti: f.lti, app: { files: {} } }) }), /Both SQLite databases exist/);
});

test('HARNESS ONLY: under QA lock the fixture answer is QA script output, never a lock event line', async () => {
  const { fixtureAnswer } = await import('./storage-lane.mjs');
  const out = ['{"event":"storage_lock_acquired","runId":"a"}', '{"op":"list","lti":{"state":"present"}}', '{"event":"storage_lock_released","runId":"a"}'].join('\n');
  assert.deepEqual(fixtureAnswer(out), { op: 'list', lti: { state: 'present' } });
  assert.deepEqual(fixtureAnswer('{"event":"storage_lock_refused"}\n{"error":"Volume not mounted: lti"}'), { error: 'Volume not mounted: lti' });
  assert.equal(fixtureAnswer('{"event":"x"}'), null);
});
