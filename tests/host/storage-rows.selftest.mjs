// HARNESS ONLY: the storage-phase order, prerequisites and helpers. No Docker and no product command.
// Prerequisite failures are shown with a fake lane whose boot is BLOCKED; no row reaches Docker. The mock lane below
// (storage repair triage revision 4 §12: V7-1, V2, V5, V6, V1-16) runs every row on real temporary folders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STORAGE_GROUPS } from './storage-inventory.mjs';
import { StorageBlocked, StorageFail, fixtureArgs } from './storage-docker.mjs';
import { copyOut, fileset, listRoot, logicalRead, meta, plant, privateCopyTree } from './storage-fixture-script.mjs';
import { StorageLane } from './storage-lane.mjs';
import { groupMembers, legacySets, pidStart, spawnGroup } from './storage-oracle.mjs';
import {
  NEEDS, SEQUENCE, absenceClaim, copyCredentials, coversListing, defineRows, rootJournalChanges, staleChanges, staleRecords, storagePaths, storagePhase,
  tamperChanges, writeMarker,
} from './storage-rows.mjs';
import { volumeSnapshot, writeHandoff } from './m1-migration.mjs';

const { DatabaseSync } = await import('node:sqlite');

const rows = SEQUENCE.filter((s) => !s.startsWith('@'));
const at = (id) => SEQUENCE.indexOf(id);
/** Runs one real row procedure on a fake lane; `state` is shared between rows as in storagePhase. */
const runRow = async (lane, step, state = {}) => { await defineRows({ lane, r: {}, add: () => {}, acc: {}, state })[step](); return state; };

// The a-fresh stack:up output of the 9cdd768 storage run (QA lane values): report, check, then mark-started after `up`.
const [REPORT_RUN, CHECK_RUN, MARK_RUN] = ['7be9a2f4930d022f', 'f57afda16ad9f494', '8834c47d7bfd5dc3'];
const passLines = (mode, runId, ts, state) => [
  ...['lti', 'app'].map((folder) => `{"event":"storage_preflight","ts":"${ts}","runId":"${runId}","mode":"${mode}","project":"qa-multi-r1-st","folder":"${folder}",`
    + `"path":"/check/${folder === 'lti' ? 'lti-service' : 'cogniate-app'}","fsType":"ext4","state":"${state}","result":"pass","reason":null,"waits":{"busyMs":0,"releaseMs":2}}`),
  `{"event":"storage_preflight_summary","ts":"${ts}","runId":"${runId}","mode":"${mode}","result":"pass","reasons":[]}`];
const FIRST_START = [
  '{"event":"storage_lock_acquired","ts":"2026-10-21T07:40:06.307Z","project":"qa-multi-r1-st","command":"stack:up","runId":"a9761e46d3c324e2","pid":46416}',
  'Building the portal (apps/portal/dist).',
  ...passLines('report', REPORT_RUN, '2026-10-21T07:40:08.947Z', 'FRESH'),
  '{"event":"storage_legacy_scan","ts":"2026-10-21T07:40:09.008Z","row":"L4","result":"continue"}',
  ...passLines('check', CHECK_RUN, '2026-10-21T07:40:09.248Z', 'FRESH'),
  ...passLines('mark-started', MARK_RUN, '2026-10-21T07:40:39.035Z', 'OK'),
  'Stack healthy in 31 s (profile: default). Next: npm run seed',
  '{"event":"storage_lock_released","ts":"2026-10-21T07:40:40.142Z","project":"qa-multi-r1-st","command":null,"runId":"a9761e46d3c324e2","pid":46416}',
].join('\n');
// Docker `Created` of the lane's service containers in that run (engine clock, nanoseconds): 142 ms after the check.
const CREATED = { proxy: '2026-10-21T07:40:09.390164667Z', postgres: '2026-10-21T07:40:09.390352667Z', 'lti-service': '2026-10-21T07:40:09.427389583Z',
  'cogniate-app': '2026-10-21T07:40:09.430672583Z', moodle: '2026-10-21T07:40:09.432478917Z' };
const editLines = (text, match, edit) => text.split('\n').map((l) => (match(l) ? edit(l) : l)).join('\n');

/** A host-only lane for the start rows: product commands answer the given outputs in order; Docker reads are fixed. */
function startLane(t, outputs, { created = CREATED } = {}) {
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rows-lane-')); t.after(() => fs.rmSync(clone, { recursive: true, force: true }));
  // P-1a: the fresh clone has no P; stack:up makes P and both children 0700 (ADR-012 §4 host side).
  const makeContent = () => { for (const rel of ['packages', 'uploads']) fs.mkdirSync(path.join(clone, 'infra/.data/cogniate-app', rel), { recursive: true, mode: 0o700 }); };
  const uid = process.getuid(), gid = process.getgid(), project = 'qa-multi-r1-st';
  const dir = (p) => ({ path: p, type: 'dir', uid, gid, mode: '0700' });
  const id = (role) => ({ formatVersion: 1, role, pairId: 'c'.repeat(32), generation: 0, firstStart: 'completed', composeProject: project, provenance: { kind: 'fresh' } });
  const calls = [], queue = [...outputs];
  return { clone, project, hostUid: uid, hostGid: gid, calls,
    presence: async () => ({ ltidb: { state: 'absent' }, appdb: { state: 'absent' } }),
    product: async (label, args) => { calls.push([label, ...args].join(' ')); if (args[0] === 'stack:up') makeContent(); return { code: 0, stdout: queue.shift(), stderr: '' }; },
    loadStack: () => {}, waitHealthy: async () => {},
    services: async () => Object.entries(created).map(([service, c]) => ({ service, name: `${project}-${service}-1`, created: c, running: true })),
    state: async () => ({ ids: { lti: id('lti'), app: id('app') } }),
    listing: async () => ({ lti: { state: 'present', entries: [dir('.')] }, app: { state: 'present', entries: [dir('.'), dir('packages'), dir('uploads')] } }) };
}

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

test('HARNESS ONLY: a-fresh judges the check pass, not mark-started, against the first container; state.runIds keeps the check runId', async (t) => {
  const state = await runRow(startLane(t, [FIRST_START]), 'a-fresh');
  assert.deepEqual([...state.runIds], [CHECK_RUN], 'The check runId; not the report or mark-started runId');
  const fails = (stdout, message, opts) => assert.rejects(runRow(startLane(t, [stdout], opts), 'a-fresh'),
    (e) => e instanceof StorageFail && e.message === message);
  const ORDER = 'Preflight pass is logged before the first service container is created';
  await fails(FIRST_START, ORDER, { created: { ...CREATED, proxy: '2026-10-21T07:40:09.100000000Z' } });
  // One millisecond after the check (07:40:09.248Z) passes; one millisecond before it fails.
  await runRow(startLane(t, [FIRST_START], { created: { ...CREATED, proxy: '2026-10-21T07:40:09.249Z' } }), 'a-fresh');
  await fails(FIRST_START, ORDER, { created: { ...CREATED, proxy: '2026-10-21T07:40:09.247Z' } });
  await fails(FIRST_START, ORDER, { created: {} });
  await fails(FIRST_START.replace(`{"event":"storage_preflight_summary","ts":"2026-10-21T07:40:09.248Z",`, '{"event":"storage_preflight_summary",'), ORDER);
  const isCheck = (l) => l.includes('"mode":"check"');
  await fails(editLines(FIRST_START, isCheck, () => 'check line lost'), 'Preflight summary pass');
  await fails(editLines(FIRST_START, (l) => isCheck(l) && l.includes('_summary'), (l) => l.replace('"result":"pass"', '"result":"fail"')), 'Preflight summary pass');
  await fails(editLines(FIRST_START, (l) => isCheck(l) && !l.includes('_summary'), (l) => l.replace('"fsType":"ext4"', '"fsType":null')), 'Both folders record fsType');
  await fails(FIRST_START + '\n' + passLines('check', 'e'.repeat(16), '2026-10-21T07:40:09.300Z', 'FRESH').join('\n'),
    '2 check-mode preflight summaries in one command; expected one');
});

test('HARNESS ONLY: a-restart needs a new check runId against the earlier check runIds (stack:restart prints a check only)', async (t) => {
  const restart = (runId, ts) => passLines('check', runId, ts, 'OK').join('\n');
  const [r1, r2] = ['1'.repeat(16), '2'.repeat(16)];
  const lane = startLane(t, [FIRST_START, restart(r1, '2026-10-21T07:41:00.000Z'), restart(r2, '2026-10-21T07:41:30.000Z')]);
  const state = await runRow(lane, 'a-fresh');
  await runRow(lane, 'a-restart', state);
  assert.deepEqual([...state.runIds], [CHECK_RUN, r1, r2]);
  assert.deepEqual(lane.calls, ['a-fresh-stack-up stack:up', 'a-restart-lti-service stack:restart -- lti-service', 'a-restart-cogniate-app stack:restart -- cogniate-app']);
  const again = startLane(t, [FIRST_START, restart(CHECK_RUN, '2026-10-21T07:41:00.000Z')]);
  const s2 = await runRow(again, 'a-fresh');
  await assert.rejects(runRow(again, 'a-restart', s2), (e) => e instanceof StorageFail && e.message === 'A new runId', 'The first start check runId again is not new');
});

test('HARNESS ONLY: c-selftest makes its new 0700 folder in the probe container, then runs the probe there; no bind and no volume', async (t) => {
  const specs = [];
  const ok = [['normal', 'pass'], ['no-hold', 'lock_not_enforced'], ['holder-dies', 'probe_error']]
    .map(([scenario, v]) => JSON.stringify({ event: 'storage_selftest', scenario, expected: v, observed: v, ok: true })).join('\n');
  const lane = { clone: '/qa/clone', container: async (spec) => { specs.push(spec); return { code: 0, stdout: ok, stderr: '' }; } };
  await runRow(lane, 'c-selftest');
  assert.equal(specs.length, 1);
  const { command } = specs[0], probe = '/probe/sqlite-lock-probe.mjs';
  const folder = command.at(-1).replace(/^self=/, ''), runId = command.at(-3);
  assert.match(folder, /^\/tmp\/qa-selftest-[0-9a-f]{16}$/);
  assert.deepEqual(command.slice(command.indexOf(probe) - 1), ['node', probe, 'selftest', '--run-id', runId, '--folder', `self=${folder}`]);
  assert.match(runId, /^[0-9a-f]{16}$/);
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  // The exact command on the host. Only the probe path changes, to a stub with the probe's prerequisite:
  // "selftest needs an existing empty folder" (exit 2), the c-selftest failure of the 9cdd768 run.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rows-probe-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const stub = path.join(dir, 'probe-stub.mjs');
  fs.writeFileSync(stub, `import fs from 'node:fs';
const argv = process.argv.slice(2), folder = argv[argv.indexOf('--folder') + 1].replace(/^self=/, '');
const st = fs.existsSync(folder) ? fs.lstatSync(folder) : null;
if (!st || !st.isDirectory() || fs.readdirSync(folder).length > 0) { process.stderr.write('selftest needs an existing empty folder\\n'); process.exit(2); }
process.stdout.write(JSON.stringify({ argv, mode: (st.mode & 0o777).toString(8), uid: st.uid }));
`);
  const argv = command.map((a) => (a === probe ? stub : a));
  const env = { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` };
  const first = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', env });
  assert.equal(first.status, 0, 'The probe finds an existing empty folder: ' + first.stderr);
  assert.deepEqual(JSON.parse(first.stdout), { argv: ['selftest', '--run-id', runId, '--folder', `self=${folder}`], mode: '700', uid: process.getuid() });
  const second = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', env });
  assert.ok(second.status !== 0 && second.stdout === '', 'An existing path is never reused: mkdir fails and the probe does not run');
  // The container: the probe file is its only mount; nothing is mounted for the folder (§11 storage-probe).
  const imageId = 'sha256:' + 'a'.repeat(64);
  const { args } = fixtureArgs({ project: 'qa-x', imageId, hostUid: 501, hostGid: 20, ...specs[0] });
  assert.deepEqual(args.filter((_, i) => args[i - 1] === '--mount'),
    ['type=bind,source=/qa/clone/infra/scripts/sqlite-lock-probe.mjs,target=/probe/sqlite-lock-probe.mjs,readonly']);
  assert.ok(!args.some((a) => /^(-v|--volume|--tmpfs|--mount=|--volume=|--tmpfs=)/.test(a)), 'No other mount option');
  assert.deepEqual(args.slice(args.indexOf(imageId) + 1), command);
  assert.deepEqual(args.slice(args.indexOf('--user'), args.indexOf('--user') + 2), ['--user', '501:20']);
});

test('HARNESS ONLY: a BLOCKED preparation blocks every storage row, each with its reason; nothing reaches Docker', async (t) => {
  const recorded = [], scanned = [];
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rows-blocked-')); t.after(() => fs.rmSync(clone, { recursive: true, force: true }));
  const lane = { clone, boot: async () => { throw new StorageBlocked('image not present'); },
    scanPoint: (point) => { scanned.push(point); return { point, failed: false, problems: [], hits: [], corrections: [], refusals: [] }; },
    r: { record: (...a) => recorded.push(a), saveText: () => {}, state: {} } };
  const identity = { productSha: 'a'.repeat(40), testSha: 'b'.repeat(40) };
  const out = await storagePhase(lane, { identity, handoff: {}, setupClone: async () => assert.fail('no clone setup') });
  assert.deepEqual(scanned, SEQUENCE.map((step) => 'after ' + step), 'The §7.4 scan point runs after every step, also a not-run step');
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
  const scratch = path.join(root, 'scratch'); fs.mkdirSync(scratch, { mode: 0o700 });
  assert.deepEqual(await storagePaths(app, scratch), { values: ['packages/pkg_a', 'packages/pkg_b/v2'], folders: ['pkg_a', 'pkg_b'] });
  await assert.rejects(storagePaths(app), /private scratch folder/, 'Site #11: no default scratch folder');
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

// ================================================================ mock lane (V7-1, V2, V5, V6, V1-16)
// A fake product and a fake Docker on real temporary folders. Lane volumes are host folders, QA's fixture operations run
// in this process on them, and the real StorageLane, row procedures, helpers and scans run unchanged. A root-owned
// entry (QA's root plant) is an overlay record: as on the real host, a HOST_UID listing of a root-owned 0700 folder
// fails with EACCES. Child processes are real and QA-owned (sleep, and small node scripts that act as the lock holder,
// the background backup and the paused restore). No Docker, no network, no product file.

const SHA = '0123456789abcdef0123456789abcdef01234567', TEST_SHA = 'fedcba9876543210fedcba9876543210fedcba98';
const IDENTITY = { productSha: SHA, testSha: TEST_SHA };
const BASE = 'qa-multi-r1', PROJECT = 'qa-multi-r1-st', OPLOCK = 'infra/scripts/storage-oplock.sh';
const IMAGE = 'sha256:' + 'a'.repeat(64);
const URLS = { lti: 'https://lti.qa-st.test:8443', app: 'https://app.qa-st.test:8443', moodle: 'https://moodle.qa-st.test:8443', content: 'https://content.qa-st.test:8443' };
const MIGRATIONS = { lti: ['001_init.sql', '004_provider_profiles.sql'], app: ['001_init.sql', '012_connection_provider_snapshot.sql'] };
const DBN = { ltidb: 'lti.db', appdb: 'cogniate.db' }, SVC = { ltidb: 'lti-service', appdb: 'cogniate-app' };
const rnd = (n = 8) => crypto.randomBytes(n).toString('hex');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** B-SR-04: wait until Date.now() is at least 2 ms after an event's raw time. */
const twoMsAfter = async (raw) => { while (Date.now() < raw + 2) await pause(1); };
const engineText = (ms = Date.now()) => new Date(ms).toISOString().replace('Z', '345678Z');
const fsha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const lexists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };

// Small QA scripts for the real child processes of the mock lane.
const HOLDER = `import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const [lockDir, command, holdMs, project, checkout] = process.argv.slice(2);
const pidStart = execFileSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], { env: { ...process.env, LC_ALL: 'C' }, encoding: 'utf8' }).trim();
const rec = { formatVersion: 1, project, checkout, command, runId: Math.random().toString(16).slice(2, 10).padEnd(16, '0'), pid: process.pid, pidStart, pgid: process.pid, acquiredAt: new Date().toISOString(), containers: [] };
fs.mkdirSync(lockDir + '.cand'); fs.writeFileSync(path.join(lockDir + '.cand', 'owner.json'), JSON.stringify(rec)); fs.renameSync(lockDir + '.cand', lockDir);
process.stdout.write(JSON.stringify({ holder: rec.runId }) + '\\n');
if (command === 'stack:data-restore') process.stdout.write(JSON.stringify({ event: 'storage_drill_pause', point: 'swapped-lti' }) + '\\n');
if (Number(holdMs) < 0) setInterval(() => {}, 1000); else setTimeout(() => { fs.rmSync(lockDir, { recursive: true, force: true }); process.exit(0); }, Number(holdMs));
`;
const BACKUP = `import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const [lockDir, logFile, out, project, secret, mode] = process.argv.slice(2);
const pidStart = execFileSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], { env: { ...process.env, LC_ALL: 'C' }, encoding: 'utf8' }).trim();
const runId = [...Array(16)].map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const pg = mode === 'unidentified' ? 1 : process.pid;
const ev = (event, extra = {}) => { const line = JSON.stringify({ event, ts: new Date().toISOString(), project, command: 'stack:data-backup', runId, pid: process.pid, pidStart, pgid: pg, owner: null, reason: null, waitedMs: 0, container: null, ...extra });
  fs.mkdirSync(path.dirname(logFile), { recursive: true }); fs.appendFileSync(logFile, line + '\\n'); process.stdout.write(line + '\\n'); };
fs.mkdirSync(lockDir + '.cand'); fs.writeFileSync(path.join(lockDir + '.cand', 'owner.json'), JSON.stringify({ formatVersion: 1, project, command: 'stack:data-backup', runId, pid: process.pid, pidStart, pgid: pg, acquiredAt: new Date().toISOString(), containers: [] }));
fs.renameSync(lockDir + '.cand', lockDir);
ev('storage_lock_acquired');
process.stdout.write('backup output with ' + secret + '\\n');
fs.mkdirSync(out, { mode: 0o700 }); fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ formatVersion: 1, source: 'volume' }), { mode: 0o600 });
setTimeout(() => { fs.rmSync(lockDir, { recursive: true, force: true }); ev('storage_lock_released', mode === 'null-command' ? { command: null } : {});
  if (mode === 'unidentified') process.stdout.write('backup finished after the deadline\\n'); process.exit(0); }, mode === 'unidentified' ? 61_500 : 400);
`;

class FakeWorld {
  /**
   * @param inject the §4.3 restore site whose restore fails in this run (V2-8), or another named fault of one control
   */
  constructor(t, { inject = null } = {}) {
    this.t = t; this.inject = inject;
    this.root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rows-world-')));
    this.runRoot = path.join(this.root, 'runs'); fs.mkdirSync(this.runRoot, { mode: 0o700 });
    this.clone = path.join(this.runRoot, `${PROJECT}-${SHA.slice(0, 8)}-2026-10-21T14-00-00-000Z`);
    for (const d of ['infra/scripts', '.tmp', 'tests/acceptance/artifacts']) fs.mkdirSync(path.join(this.clone, d), { recursive: true });
    this.volRoot = path.join(this.root, 'volumes'); fs.mkdirSync(this.volRoot);
    this.containerTmp = path.join(this.root, 'container-tmp'); fs.mkdirSync(this.containerTmp, { mode: 0o700 });
    this.scripts = path.join(this.root, 'scripts'); fs.mkdirSync(this.scripts);
    for (const [name, text] of Object.entries({ 'holder.mjs': HOLDER, 'backup.mjs': BACKUP })) fs.writeFileSync(path.join(this.scripts, name), text);
    this.volumes = {}; this.overlay = new Map(); this.services = []; this.qa = []; this.storage = [];
    this.log = []; this.saved = new Map(); this.records = []; this.secrets = new Set(); this.children = []; this.leftovers = []; this.violations = [];
    this.productCalls = []; this.resetMarks = []; this.cookies = new Set(); this.completeOrphan = false;
    this.uid = process.getuid(); this.gid = process.getgid();
    t.after(() => this.cleanup());
    this.r = this.makeR();
    this.lane = new StorageLane(this.r, { oplock: OPLOCK, docker: (args) => this.docker(args), request: (url, o) => this.request(url, o) });
    this.lane.spawnGroup = (cmd, args, opts) => this.spawn(cmd, args, opts);
    this.lane.run = async (cmd, args) => (cmd === 'git' && args[0] === 'ls-files'
      ? { code: 0, stdout: [...MIGRATIONS.lti.map((n) => `services/lti-service/src/db/migrations/${n}`), ...MIGRATIONS.app.map((n) => `services/cogniate-app/src/domain/migrations/${n}`)].join('\n') + '\n', stderr: '' }
      : { code: 1, stdout: '', stderr: 'fake run: ' + cmd });
    this.secret = 'qa-planted-redaction-' + rnd(6);
    this.r.redact.add(this.secret);
  }
  cleanup() {
    for (const c of this.children) { try { process.kill(-c.pgid, 'SIGKILL'); } catch { /* ended */ } }
    const open = (dir) => { if (!lexists(dir)) return; const st = fs.lstatSync(dir); if (st.isSymbolicLink()) return; if (st.isDirectory()) { fs.chmodSync(dir, 0o700); for (const n of fs.readdirSync(dir)) open(path.join(dir, n)); } };
    try { open(this.root); } catch { /* best effort before the removal */ }
    fs.rmSync(this.root, { recursive: true, force: true });
  }
  // ---------------------------------------------------------------- the fake core.mjs runner
  makeR() {
    const w = this;
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('npm_')));
    const r = {
      PROJECT, CLONE: w.clone, ART: path.join(w.root, 'art'), STACK_ENV: { ...env, COMPOSE_PROJECT_NAME: PROJECT },
      state: { h1Verified: false, urls: null, env: null, ca: null, ledger: { records: [] } },
      redact: { add: (...v) => v.forEach((x) => { if (typeof x === 'string' && x.length >= 6) w.secrets.add(x); }),
        apply: (text) => [...w.secrets].reduce((acc, s) => acc.split(s).join('<redacted>'), String(text)) },
      record: (id, title, status, notes) => w.records.push({ id, title, status, notes }),
      saveText: (rel, text) => { w.saved.set(rel, r.redact.apply(text)); w.afterSave(rel); return rel; },
      exec: (name, cmd, args, opts) => w.exec(name, cmd, args, opts),
      npm: (name, args, opts) => w.npm(name, args, opts),
      observe: async () => {},
      loadStackFiles: () => { r.state.env = w.readEnv(); r.state.urls = { ...URLS }; },
      checkProject: async () => { r.state.h1Verified = true; },
      healthz: async () => (w.running() ? { status: 'ok', profile: 'default', knobs: [], simulation_profiles: [] } : null),
      waitHealth: async () => ({ ok: w.running() }),
      docker: (args) => w.docker(args),
    };
    return r;
  }
  readEnv() {
    const file = path.join(this.clone, '.env');
    return fs.existsSync(file) ? Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n').map((l) => /^([A-Z_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]])) : null;
  }
  /** The storage phase clone preparation of run-m1.mjs, as files: .env and the secret files. */
  async setupClone() {
    fs.writeFileSync(path.join(this.clone, '.env'), ['COMPOSE_PROJECT_NAME=' + PROJECT, 'LTI_MASTER_KEY=lane-lti-master-' + rnd(), 'APP_MASTER_KEY=lane-app-master-' + rnd(),
      'PORTAL_THANH_PASSWORD=lane-thanh-' + rnd(), 'PORTAL_QAB_PASSWORD=lane-qab-' + rnd(), 'DB_PASS=lane-db-' + rnd(), ''].join('\n'), { mode: 0o600 });
    fs.mkdirSync(path.join(this.clone, 'infra/.secrets/app'), { recursive: true, mode: 0o700 });
    for (const f of ['lti-api-key.cogniate', 'lti-api-key.qa-second', 'app/lti-api-key', 'seed.json']) fs.writeFileSync(path.join(this.clone, 'infra/.secrets', f), 'lane-' + rnd(), { mode: 0o600 });
    this.r.loadStackFiles();
  }
  // ---------------------------------------------------------------- volumes, services and the lock
  vol(key) { return path.join(this.volRoot, `${PROJECT}_${key}`); }
  hasVol(key) { return Boolean(this.volumes[key]) && fs.existsSync(this.vol(key)); }
  makeVol(key) {
    if (this.volumes[key]) return;
    fs.mkdirSync(this.vol(key), { mode: 0o700 }); fs.chmodSync(this.vol(key), 0o700);
    this.volumes[key] = { Name: `${PROJECT}_${key}`, CreatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), Driver: 'local',
      Labels: { 'com.docker.compose.project': PROJECT, 'com.docker.compose.volume': key }, Mountpoint: '/var/lib/docker/volumes/' + key, Options: null, Scope: 'local' };
    if (key === 'appdb') for (const m of ['packages', 'uploads']) { fs.mkdirSync(path.join(this.vol(key), m), { mode: 0o700 }); fs.chmodSync(path.join(this.vol(key), m), 0o700); }
  }
  dropVols() {
    for (const key of ['ltidb', 'appdb']) { fs.rmSync(this.vol(key), { recursive: true, force: true }); delete this.volumes[key]; }
    this.overlay.clear();
  }
  running() { return this.services.length === 2 && this.services.every((s) => s.State.Running); }
  container(service) { return this.services.find((s) => s.Config.Labels['com.docker.compose.service'] === service); }
  startServices() {
    if (this.services.length === 0) {
      for (const service of ['lti-service', 'cogniate-app']) this.services.push({ Id: rnd(32), Name: `/${PROJECT}-${service}-1`, Created: engineText(),
        Config: { Labels: { 'com.docker.compose.project': PROJECT, 'com.docker.compose.service': service } }, State: { Status: 'created', Running: false, StartedAt: '0001-01-01T00:00:00Z' }, Mounts: [] });
    }
    for (const s of this.services) if (!s.State.Running) Object.assign(s.State, { Status: 'running', Running: true, StartedAt: engineText() });
    // The services write their WAL (a fake sidecar: an SQLite database in rollback mode ignores it).
    if (this.hasVol('ltidb')) fs.writeFileSync(path.join(this.vol('ltidb'), 'lti.db-wal'), 'qa fake wal ' + rnd(4));
  }
  stopServices() { for (const s of this.services) if (s.State.Running) Object.assign(s.State, { Status: 'exited', Running: false }); }
  lockDir() { return path.join(this.clone, '.tmp', `storage-op.${PROJECT}.lock`); }
  lockLog() { return path.join(this.clone, 'infra/.logs/storage-lock.jsonl'); }
  event(lines, event, ctx, extra = {}) {
    const line = { event, ts: new Date().toISOString(), project: PROJECT, command: ctx.command, runId: ctx.runId, pid: process.pid, pidStart: 'fake', pgid: process.pid,
      owner: null, reason: null, waitedMs: 0, container: null, ...extra };
    fs.mkdirSync(path.dirname(this.lockLog()), { recursive: true }); fs.appendFileSync(this.lockLog(), JSON.stringify(line) + '\n');
    lines.push(line); return line;
  }
  async live(rec) {
    if (!rec) return false;
    if (rec.pidStart && rec.pidStart !== 'fake' && (await pidStart(rec.pid)) === rec.pidStart) return true;
    return Number.isInteger(rec.pgid) && rec.pgid !== process.pid && (await groupMembers(rec.pgid)).length > 0;
  }
  /** ADR-012 §7 A1–A6 and the release, on the clone's lock folder (QA's own model; real ps for liveness). */
  async acquire(command, lines) {
    this.storageListed();
    const ctx = { command, runId: rnd() }, lock = this.lockDir(), tmp = path.join(this.clone, '.tmp');
    const owner = (k) => ({ runId: k.runId, command: k.command, pid: k.pid, pidStart: k.pidStart, pgid: k.pgid, acquiredAt: k.acquiredAt });
    let waited = null;
    for (;;) {
      if (!fs.existsSync(lock)) {
        fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ formatVersion: 1, project: PROJECT, checkout: this.clone, ...ctx, pid: process.pid, pidStart: 'fake', pgid: process.pid, acquiredAt: new Date().toISOString(), containers: [] }));
        break;
      }
      const k = JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'), 'utf8'));
      if (await this.live(k)) {
        waited ??= this.event(lines, 'storage_lock_wait', ctx, { owner: owner(k) });
        const until = Date.now() + 1500;
        while (fs.existsSync(lock) && Date.now() < until) await pause(25);
        if (fs.existsSync(lock)) {
          const group = await groupMembers(k.pgid);
          this.event(lines, 'storage_lock_refused', ctx, { reason: 'operation_in_progress', owner: owner(k), ts: new Date(Date.parse(waited.ts) + 120_000).toISOString() });
          return { refused: `operation_in_progress: ${k.command} (run ${k.runId}, pid ${k.pid}); process group ${k.pgid} still has: ${group.join(', ')}` };
        }
        continue;
      }
      const active = this.storage.find((c) => c.State.Running);
      if (active) { this.event(lines, 'storage_lock_refused', ctx, { reason: 'storage_writer_active', container: { name: active.Name.slice(1), id: active.Id } }); return { refused: `storage_writer_active: ${active.Name.slice(1)} (${active.Id})` }; }
      fs.renameSync(lock, path.join(tmp, `storage-op.${PROJECT}.stale-${k.runId}`));
      this.event(lines, 'storage_lock_reclaimed', ctx, { owner: owner(k) });
    }
    this.event(lines, 'storage_lock_acquired', ctx, { waitedMs: waited ? 1000 : 0 });
    for (const c of this.storage.filter((x) => !x.State.Running)) { this.storage = this.storage.filter((x) => x !== c); this.event(lines, 'storage_container_removed', ctx, { container: { name: c.Name.slice(1), id: c.Id } }); }
    for (const name of fs.readdirSync(tmp).filter((n) => n.startsWith(`storage-op.${PROJECT}.cand-`) || n.startsWith(`storage-op.${PROJECT}.rel-`))) {
      const k = JSON.parse(fs.readFileSync(path.join(tmp, name, 'owner.json'), 'utf8'));
      if (!(await this.live(k))) { fs.rmSync(path.join(tmp, name), { recursive: true }); this.event(lines, 'storage_lock_cleanup', ctx, { owner: owner(k) }); }
    }
    return { ctx };
  }
  release(ctx, lines) {
    const rel = path.join(this.clone, '.tmp', `storage-op.${PROJECT}.rel-${ctx.runId}`);
    fs.renameSync(this.lockDir(), rel); fs.rmSync(rel, { recursive: true });
    this.event(lines, 'storage_lock_released', ctx);
  }
  // ---------------------------------------------------------------- fake Docker CLI
  ok(stdout = '') { return { code: 0, stdout, stderr: '', durationMs: 0 }; }
  no(code, stderr = '', stdout = '') { return { code, stdout, stderr, durationMs: 0 }; }
  all() { return [...this.services, ...this.storage, ...this.qa]; }
  async docker(args) {
    if (this.stopped) throw new Error('mock lane stopped after ' + this.stopAfter);
    this.log.push({ kind: 'docker', args });
    const [a0, a1] = args;
    if (a0 === 'image' && a1 === 'inspect') return this.ok(IMAGE + '\n');
    if (a0 === 'system' && a1 === 'info') return this.inject === 'clock-fails' ? this.no(1, 'engine down') : this.ok(engineText() + '\n');
    if (a0 === 'volume' && a1 === 'inspect') {
      const found = args.slice(2).map((n) => Object.values(this.volumes).find((v) => v.Name === n));
      return found.every(Boolean) ? this.ok(JSON.stringify(found)) : this.no(1, 'Error response from daemon: get x: no such volume', '[]');
    }
    if (a0 === 'volume' && a1 === 'ls') return this.ok(Object.values(this.volumes).map((v) => v.Name).join('\n') + '\n');
    if (a0 === 'ps') {
      const filters = args.flatMap((a, i) => (args[i - 1] === '--filter' ? [a] : []));
      if (filters.includes('label=org.cogniate.storage')) this.storageListed();
      const list = this.all().filter((c) => filters.every((f) => {
        const [k, v] = f.replace(/^label=/, '').split('=');
        return v === undefined ? k in c.Config.Labels : c.Config.Labels[k] === v;
      }));
      return this.ok(list.map((c) => c.Id).join('\n') + (list.length ? '\n' : ''));
    }
    if (a0 === 'container' && a1 === 'inspect') {
      const found = args.slice(2).map((id) => this.all().find((c) => c.Id === id || c.Id.startsWith(id)));
      return found.every(Boolean) ? this.ok(JSON.stringify(found)) : this.no(1, 'Error: No such container');
    }
    if (a0 === 'rm') {
      const id = args.at(-1), c = this.qa.find((x) => x.Id === id || x.Name === '/' + id);
      if ((this.inject === 'g-quarantine-in-use QA container' && c?.kind === 'storage-volume-user') || (this.inject === 'e-old-layout QA decoy' && c?.kind === 'storage-decoy')) return this.no(1, 'injected: removal failed');
      this.qa = this.qa.filter((x) => x !== c);
      return this.ok(id + '\n');
    }
    throw new Error('fake docker: unexpected ' + args.join(' '));
  }
  async exec(name, cmd, args) {
    if (this.stopped) throw new Error('mock lane stopped after ' + this.stopAfter);
    this.log.push({ kind: 'exec', name, cmd, args });
    if (cmd === 'docker' && args[0] === 'compose' && args.includes('stop')) {
      if (this.inject === 'restore-services-running' && this.stuck) return this.ok();
      this.stopServices(); return this.ok();
    }
    if (cmd === 'docker' && ['run', 'create'].includes(args[0])) return this.qaContainer(name, args, { locked: false });
    if (cmd === 'docker' && args[0] === 'stop') {
      const c = this.storage.find((x) => x.Name === '/' + args[1]);
      if (c) Object.assign(c.State, { Status: 'exited', Running: false });
      return c ? this.ok(args[1] + '\n') : this.no(1, 'No such container');
    }
    if (cmd === 'bash' && args[0] === OPLOCK) {
      if (args[1] === 'selftest') return this.ok(['rename-held', 'locale', 'orphan-client', 'dead-owner', 'own-group']
        .map((scenario) => JSON.stringify({ event: 'storage_lock_selftest', ts: new Date().toISOString(), runId: rnd(), scenario, expected: 'x', observed: 'x', ok: true, psCommand: 'LC_ALL=C ps -A -o pid= -o pgid=' })).join('\n') + '\n');
      if (this.inject === 'lock-refused' && this.lockRefusalArmed && args[3] === 'docker')
        return this.no(1, 'injected: QA lock not held', JSON.stringify({ event: 'storage_lock_refused', reason: 'operation_in_progress' }) + '\n');
      const lines = [], got = await this.acquire(args[3] === 'docker' ? 'qa-fixture' : args.slice(3).join(' '), lines);
      const out = (res) => ({ ...res, stdout: lines.map((l) => JSON.stringify(l)).join('\n') + '\n' + (res.stdout ?? '') });
      if (got.refused) return out(this.no(1, got.refused));
      try {
        if (args[3] === 'docker') return out(await this.qaContainer(name, args.slice(4), { locked: true }));
        if (args[3] === 'bash') { this.firstStartSetup(); return out(this.ok()); }
        if (args[3] === 'npm') { this.event(lines, 'storage_lock_refused', got.ctx, { reason: 'operation_lock_reentry' }); return out(this.no(1, 'operation_lock_reentry')); }
      } finally { if (fs.existsSync(this.lockDir())) this.release(got.ctx, lines); }
    }
    throw new Error(`fake exec: unexpected ${cmd} ${args.join(' ')}`);
  }
  /** One QA container (§11 kinds), from its exact docker arguments. */
  async qaContainer(name, args, { locked }) {
    const label = (k) => args.find((a, i) => args[i - 1] === '--label' && a.startsWith(k + '='))?.slice(k.length + 1);
    const kind = label('org.cogniate.qa'), user = args[args.indexOf('--user') + 1], cmd = args.slice(args.indexOf(IMAGE) + 1);
    const mounts = args.flatMap((a, i) => (args[i - 1] === '--mount' ? [a] : []));
    if (kind === 'storage-volume-user' || kind === 'storage-decoy') {
      const c = { Id: rnd(32), Name: '/' + args[args.indexOf('--name') + 1], kind, Created: engineText(),
        Config: { Labels: { 'org.cogniate.qa': kind, 'org.cogniate.lane': PROJECT, ...(kind === 'storage-decoy' ? { 'com.docker.compose.project': PROJECT } : {}) } },
        State: kind === 'storage-decoy' ? { Status: 'running', Running: true } : { Status: 'created', Running: false } };
      this.qa.push(c);
      return this.ok(c.Id + '\n');
    }
    if (kind === 'storage-probe') {
      if (cmd.includes('selftest')) return this.ok(['normal:pass', 'no-hold:lock_not_enforced', 'holder-dies:probe_error'].map((x) => {
        const [scenario, v] = x.split(':'); return JSON.stringify({ event: 'storage_selftest', scenario, expected: v, observed: v, ok: true });
      }).join('\n') + '\n');
      if (this.inject === 'c-host-negative scratch') {
        const bind = mounts.find((m) => m.includes('target=/check/host-negative')).match(/source=([^,]+)/)[1];
        fs.writeFileSync(path.join(bind, 'kept'), 'x'); fs.chmodSync(bind, 0o500);
      }
      return this.ok(JSON.stringify({ event: 'storage_probe', result: 'pass' }) + '\n');
    }
    if (kind === 'storage-oracle') return this.ok(JSON.stringify({ op: 'oracle', verdict: 'LOCK ENFORCED (B refused while A held)', scratchRemoved: true }) + '\n');
    if (kind !== 'storage-fixture') throw new Error('fake: unexpected QA container ' + kind);
    return this.fixture(cmd, { root: user === '0:0', write: mounts.some((m) => m.startsWith('type=volume') && !m.endsWith(',readonly')), locked });
  }
  /** QA's fixture script, run in this process on the volume folders; root ownership is the overlay. */
  async fixture(cmd, { root, write, locked }) {
    const op = cmd[3], opt = {};
    for (let i = 4; i < cmd.length; i += 2) opt[cmd[i].slice(2)] = cmd[i + 1];
    const spec = opt.spec ? JSON.parse(Buffer.from(opt.spec, 'base64').toString('utf8')) : {};
    const roots = { ...(opt.lti ? { lti: this.vol('ltidb') } : {}), ...(opt.app ? { app: this.vol('appdb') } : {}) };
    const keyOf = (vol) => (vol === 'lti' ? 'ltidb' : 'appdb');
    this.log.push({ kind: 'fixture', op, root, write, ops: spec.ops?.map((o) => `${o.op}:${o.vol}:${o.path ?? o.names?.join('+') ?? ''}`) });
    try {
      let answer;
      // Sensors (Docker enforces neither): a write without QA's lock, or a write while the services run, is a violation.
      if (write && !locked) this.violations.push(`write without QA lock: ${op}`);
      if (write && this.running() && !(op === 'plant' && spec.ops?.every((o) => o.path?.startsWith('qa-unknown-'))) && op !== 'oracle') this.violations.push(`write while services run: ${op}`);
      if (op === 'list') answer = { op, lti: this.listAs('ltidb', roots.lti, root), app: this.listAs('appdb', roots.app, root) };
      else if (op === 'meta') answer = { op, entries: meta(roots[spec.vol], spec.names).map((e) => this.over(keyOf(spec.vol), e)) };
      else if (op === 'fileset') answer = { op, ...fileset(roots) };
      else if (op === 'logical') { answer = { op }; for (const vol of Object.keys(roots)) answer[vol] = await logicalRead(roots[vol], DBN[keyOf(vol)], { ...spec, scratchBase: this.containerTmp }); }
      else if (op === 'copyout') answer = { op, copied: copyOut(roots, spec, this.lane.out) };
      else if (op === 'oracle') answer = { op, verdict: 'LOCK ENFORCED (B refused while A held)', bWhileHeld: { error: { errcode: 5 } }, aBefore: { alive: true }, aAfter: { alive: true }, positiveControl: { event: 'ACQUIRED' }, scratchRemoved: true };
      else if (op === 'plant') {
        if (!write) throw new Error('fake: plant in read mode');
        for (const o of spec.ops) this.injectPlant(o, spec.ops);
        if (root) {
          for (const o of spec.ops) {
            if (o.op !== 'chown') throw new Error('fake: root only for chown');
            if (this.inject === 'plant-no-effect' && o.vol === 'app') continue;
            const key = keyOf(o.vol);
            if (o.uid === this.uid && o.gid === this.gid) this.overlay.delete(`${key}/${o.path}`); else this.overlay.set(`${key}/${o.path}`, { uid: o.uid, gid: o.gid });
            // V2-10: the root plant changes packages, then fails or times out.
            if (this.partial && o.path === 'packages') {
              const mode = this.partial; this.partial = null;
              return mode === 'timeout' ? { code: -1, timedOut: true, stdout: '', stderr: 'timeout', durationMs: 120_000 } : this.no(1, '', JSON.stringify({ error: 'injected: the plant failed after packages' }) + '\n');
            }
          }
          answer = { op, results: spec.ops.map((o) => ({ op: o.op, vol: o.vol, path: o.path })) };
        } else {
          answer = { op, results: plant(roots, spec.ops, { outDir: this.lane.out }) };
          // V4-2: a returned file whose mode drifts (the row must compare it with its listing before the row).
          const drift = { 'unstash-mode-drift:d-symlink': 'hold-d-symlink-', 'unstash-mode-drift:identity': 'orig-f-pairid-' }[this.inject];
          const u = spec.ops.find((o) => o.op === 'unstash');
          if (drift && u?.hold.startsWith(drift)) for (const r of answer.results.filter((x) => x.op === 'unstash')) for (const m of r.moved) fs.chmodSync(path.join(roots[u.vol], m.name), 0o640);
        }
      } else throw new Error('fake: unknown fixture op ' + op);
      return this.ok(JSON.stringify(answer) + '\n');
    } catch (e) { return this.no(1, '', JSON.stringify({ error: String(e.message) }) + '\n'); }
  }
  over(key, e) { const o = this.overlay.get(`${key}/${e.path}`); return o ? { ...e, uid: o.uid, gid: o.gid } : e; }
  listAs(key, root, asRoot) {
    if (!root) return { state: 'absent', entries: [] };
    if (!asRoot) for (const [k] of this.overlay) {
      const [vk, ...rest] = k.split('/'), rel = rest.join('/'), file = path.join(this.vol(vk), rel);
      if (vk === key && lexists(file) && fs.lstatSync(file).isDirectory() && (fs.lstatSync(file).mode & 0o007) === 0) throw new Error(`EACCES: permission denied, scandir '/v/${key}/${rel}'`);
    }
    const l = listRoot(root);
    return { ...l, entries: l.entries.map((e) => this.over(key, e)) };
  }
  /** The V2-8 restore failures of the fixture plants (a removal or a return that fails). */
  injectPlant(o, ops = [o]) {
    const site = this.inject;
    const hit = (site === 'a-restart-refusal planted entry' && o.op === 'remove' && /^qa-unknown-/.test(o.path ?? ''))
      || (site === 'd-stale near-match' && o.op === 'remove' && /^\.lock-probe-[0-9a-f]{15}\.db$/.test(o.path ?? ''))
      || (site === 'd-unknown notes.txt' && o.op === 'remove' && o.path === 'notes.txt')
      || (site === 'd-symlink link and WAL stash' && o.op === 'remove' && o.path === 'lti.db-wal')
      || (site === 'd-owner lti.db owner' && o.op === 'chown' && o.path === 'lti.db' && o.uid === this.uid)
      || (site === 'd-mountpoint root plant' && o.op === 'chown' && o.vol === 'app' && ['packages', 'uploads'].includes(o.path) && o.uid === this.uid)
      || (site === 'd-mountpoint file case' && o.op === 'remove' && o.path === 'uploads/qa-unsafe-file')
      || (site === 'd-mountpoint link case' && o.op === 'remove' && o.path === 'packages' && ops.some((x) => x.op === 'mkdir' && x.path === 'packages'))
      || (site?.startsWith('identityCase ') && o.op === 'unstash' && o.hold?.startsWith(`orig-${site.slice('identityCase '.length)}-`));
    if (hit) throw new Error(`injected: ${o.op} failed`);
  }
  // ---------------------------------------------------------------- volume state (QA's model of ADR-012 §5, §6, §8)
  idFile(key) { return path.join(this.vol(key), '.storage-identity.json'); }
  readId(key) {
    if (!this.hasVol(key) || !lexists(this.idFile(key))) return null;
    try { return JSON.parse(fs.readFileSync(this.idFile(key), 'utf8')); } catch { return { invalid: true }; }
  }
  writeId(key, value) { fs.writeFileSync(this.idFile(key), JSON.stringify({ formatVersion: 1, role: key === 'ltidb' ? 'lti' : 'app', ...value }), { mode: 0o600 }); }
  hasDb(key) { return this.hasVol(key) && lexists(path.join(this.vol(key), DBN[key])); }
  journal(key) { const f = path.join(this.vol(key), '.storage-journal.json'); return this.hasVol(key) && lexists(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
  writeJournal(key, value) { fs.writeFileSync(path.join(this.vol(key), '.storage-journal.json'), JSON.stringify({ formatVersion: 1, ...value }), { mode: 0o600 }); }
  withDb(key, fn) {
    const db = new DatabaseSync(path.join(this.vol(key), DBN[key]));
    try { return fn(db); } finally { db.close(); if (key === 'ltidb' && this.running()) fs.writeFileSync(path.join(this.vol(key), 'lti.db-wal'), 'qa fake wal ' + rnd(4)); }
  }
  createDbs() {
    for (const key of ['ltidb', 'appdb']) {
      const tables = key === 'ltidb' ? 'CREATE TABLE platform (id TEXT, name TEXT, client_id TEXT)' : 'CREATE TABLE connection (id TEXT, name TEXT); CREATE TABLE package (id TEXT, storage_path TEXT)';
      this.withDb(key, (db) => {
        db.exec(`PRAGMA journal_mode = DELETE; ${tables}; CREATE TABLE schema_migration (name TEXT)`);
        for (const name of MIGRATIONS[key === 'ltidb' ? 'lti' : 'app']) db.prepare('INSERT INTO schema_migration VALUES (?)').run(name);
      });
      fs.chmodSync(path.join(this.vol(key), DBN[key]), 0o644);
    }
  }
  pairState() {
    if (!this.hasVol('ltidb') && !this.hasVol('appdb')) return { state: 'FRESH' };
    const ids = { ltidb: this.readId('ltidb'), appdb: this.readId('appdb') }, dbs = { ltidb: this.hasDb('ltidb'), appdb: this.hasDb('appdb') };
    if (ids.ltidb?.invalid || ids.appdb?.invalid) return { code: 'identity_invalid' };
    if (!ids.ltidb && !ids.appdb) return dbs.ltidb || dbs.appdb ? { code: 'db_without_identity' } : { state: 'FRESH' };
    if (!ids.ltidb || !ids.appdb) return dbs.ltidb || dbs.appdb ? { code: 'identity_missing' } : { state: 'FIRST_START', ids };
    if (ids.ltidb.composeProject !== PROJECT || ids.appdb.composeProject !== PROJECT) return { code: 'identity_project' };
    if (ids.ltidb.pairId !== ids.appdb.pairId) return { code: 'identity_mismatch' };
    if (ids.ltidb.firstStart === 'pending' && !dbs.ltidb && !dbs.appdb) return { state: 'FIRST_START', ids };
    if (dbs.ltidb && dbs.appdb) return { state: 'OK', ids };
    return { code: dbs.ltidb || dbs.appdb ? 'half_pair' : 'no_databases' };
  }
  /** The preflight entry and mountpoint rules (unknown entries, owners, mountpoints) of both volumes. */
  volumeIssue() {
    for (const key of ['ltidb', 'appdb']) {
      if (!this.hasVol(key)) continue;
      const db = DBN[key], allowed = new Set([db, db + '-wal', db + '-shm', '.storage-identity.json', '.storage-journal.json']);
      for (const name of fs.readdirSync(this.vol(key)).sort()) {
        const st = fs.lstatSync(path.join(this.vol(key), name));
        if (/^\.lock-probe-[0-9a-f]{16}\.db(-wal|-shm)?$/.test(name) && st.isFile()) continue;
        if (/^\.(previous|restore)-[0-9a-f]{32}$/.test(name) && st.isDirectory()) continue;
        if (key === 'appdb' && (name === 'packages' || name === 'uploads')) continue;
        if (!allowed.has(name) || !st.isFile()) return { code: 'unknown_entry', detail: name };
        const o = this.overlay.get(`${key}/${name}`);
        if (o && (o.uid !== this.uid || o.gid !== this.gid)) return { code: 'owner_mismatch', detail: name };
      }
    }
    if (this.hasVol('appdb')) for (const m of ['packages', 'uploads']) {
      const file = path.join(this.vol('appdb'), m);
      if (!lexists(file)) continue;
      const st = fs.lstatSync(file);
      if (st.isSymbolicLink() || !st.isDirectory() || fs.readdirSync(file).length) return { code: 'mountpoint_unsafe', detail: m };
    }
    for (const key of ['ltidb', 'appdb']) {
      const j = this.journal(key);
      if (j && j.state === 'rollback_failed') return { code: 'rollback_failed', detail: 'run npm run stack:data-quarantine' };
      if (j && !['committed', 'rolled_back'].includes(j.state)) return { code: 'journal_open', detail: 'run stack:data-restore -- --recover' };
    }
    return null;
  }
  /** §4 volume side: absent mountpoints made, root-owned empty mountpoints changed to HOST_UID 0700; stale probes removed. */
  prepareVolumes() {
    for (const key of ['ltidb', 'appdb']) {
      if (!this.hasVol(key)) continue;
      for (const name of fs.readdirSync(this.vol(key))) if (/^\.lock-probe-[0-9a-f]{16}\.db(-wal|-shm)?$/.test(name)) fs.rmSync(path.join(this.vol(key), name));
    }
    if (this.hasVol('appdb')) for (const m of ['packages', 'uploads']) {
      const file = path.join(this.vol('appdb'), m);
      if (!lexists(file)) { fs.mkdirSync(file, { mode: 0o700 }); fs.chmodSync(file, 0o700); }
      this.overlay.delete(`appdb/${m}`);
    }
  }
  contentIssue() {
    const P = path.join(this.clone, 'infra/.data/cogniate-app');
    for (const d of [P, path.join(P, 'packages'), path.join(P, 'uploads')]) {
      if (!lexists(d)) continue;
      const st = fs.lstatSync(d);
      if (st.isSymbolicLink() || !st.isDirectory() || st.uid !== this.uid) return { code: 'content_path_unsafe', detail: path.relative(this.clone, d) };
    }
    return null;
  }
  prepareContent() {
    const P = path.join(this.clone, 'infra/.data/cogniate-app');
    fs.mkdirSync(path.dirname(P), { recursive: true });
    for (const d of [P, path.join(P, 'packages'), path.join(P, 'uploads')]) if (!lexists(d)) { fs.mkdirSync(d, { mode: 0o700 }); fs.chmodSync(d, 0o700); }
  }
  legacyIssue() {
    if (this.qa.some((c) => c.kind === 'storage-decoy' && c.State.Running)) return { code: 'old_layout_container' };
    // An open journal is not FRESH: the preflight reports journal_open first.
    if (['ltidb', 'appdb'].some((key) => { const j = this.journal(key); return j && !['committed', 'rolled_back'].includes(j.state); })) return null;
    const files = Object.entries(legacySets(this.clone)).flatMap(([svc, list]) => list.map((f) => ({ svc, ...f })));
    if (!files.length) return null;
    if (files.some((f) => f.name.endsWith('-journal'))) return { code: 'legacy_hot_journal' };
    const ps = this.pairState();
    if (ps.state === 'FRESH' || ps.state === 'FIRST_START') return { code: 'legacy_present' };
    const sources = ps.ids?.ltidb?.legacySources;
    if (!Array.isArray(sources) || !sources.length) return { code: 'legacy_conflict' };
    const want = sources.map((x) => `${x.name}:${x.sha256}`).sort(), have = files.map((f) => `${f.name}:${f.sha256}`).sort();
    return JSON.stringify(want) === JSON.stringify(have) ? { kept: true } : { code: 'legacy_conflict' };
  }
  guarded() { const k = path.join(this.clone, '.tmp/compose.knobs.yaml'); return fs.existsSync(k) && fs.readFileSync(k, 'utf8').includes('x-cogniate-storage-compat'); }
  pf(lines, mode, state) {
    const runId = rnd(), ts = new Date().toISOString();
    for (const [folder, key] of [['lti', 'ltidb'], ['app', 'appdb']]) lines.push({ event: 'storage_preflight', ts, runId, mode, project: PROJECT, folder, path: `/check/${SVC[key]}`, fsType: 'ext4', state, result: 'pass', reason: null });
    lines.push({ event: 'storage_preflight_summary', ts, runId, mode, result: 'pass', reasons: [] });
  }
  refuse(lines, code, detail = '') {
    lines.push({ event: 'storage_preflight_summary', ts: new Date().toISOString(), runId: rnd(), mode: 'check', result: 'fail', reasons: [code], detail });
    return { code: 1, text: `refused ${code} ${detail}` };
  }
  /** The candidate stack:up and stack:restart (ADR-012 §5, §6, §10 as QA's model). */
  async start(lines, { label, restart = null, env = {} }) {
    const P = path.join(this.clone, 'infra/.data/cogniate-app');
    this.log.push({ kind: 'content-before-start', label, packages: lexists(path.join(P, 'packages')), uploads: lexists(path.join(P, 'uploads')) });
    if (!restart) { const c = this.contentIssue(); if (c) return this.refuse(lines, c.code, c.detail); }
    if (this.guarded()) return { code: 1, text: 'The storage-compatibility override is enabled. Run `npm run stack:storage-compat -- disable` first.' };
    if (this.inject === 'a-lock-stale case 4 stub group' && label === 'a-lock-stale-4') return { code: 0, text: 'injected: no wait' };
    const got = await this.acquire(restart ? 'stack:restart' : 'stack:up', lines);
    if (got.refused) { lines.push({ event: 'storage_refusal', code: got.refused.split(':')[0] }); return { code: 1, text: got.refused }; }
    try {
      let warning = '';
      if (!restart) {
        const l = this.legacyIssue();
        if (l?.code) return this.refuse(lines, l.code);
        if (l?.kept) warning = 'legacy files are kept for reference and are not used';
        if (label === 'd-mountpoint-up' && ['d-mountpoint root plant', 'stack-up-fails', 'restore-services-running', 'lock-refused'].includes(this.inject)) {
          if (this.inject === 'restore-services-running') { this.startServices(); this.stuck = true; }
          if (this.inject === 'lock-refused') this.lockRefusalArmed = true;
          return { code: 1, text: 'injected: stack:up failed' };
        }
        this.prepareContent();
        for (const key of ['ltidb', 'appdb']) this.makeVol(key);
      }
      const v = this.volumeIssue();
      if (v) return this.refuse(lines, v.code, v.detail);
      const ps = this.pairState();
      if (ps.code) return this.refuse(lines, ps.code);
      if (!restart) this.pf(lines, 'report', ps.state === 'OK' ? 'OK' : ps.state);
      this.prepareVolumes();
      this.pf(lines, 'check', ps.state === 'OK' ? 'OK' : ps.state);
      if (ps.state === 'FRESH' || ps.state === 'FIRST_START') {
        const pairId = ps.ids?.ltidb?.pairId ?? ps.ids?.appdb?.pairId ?? rnd(16);
        for (const key of ['ltidb', 'appdb']) if (!this.readId(key)) this.writeId(key, { pairId, generation: 0, firstStart: 'pending', composeProject: PROJECT, provenance: { kind: 'fresh' } });
        this.createDbs();
      }
      if (this.inject === 'unrelated-change' && label === 'd-mountpoint-up') fs.writeFileSync(path.join(this.vol('ltidb'), '.storage-journal.json'), JSON.stringify({ state: 'committed', note: 'unrelated' }));
      this.log.push({ kind: 'compose-start', label });
      if (restart) { const s = this.container(restart); Object.assign(s.State, { Status: 'running', Running: true, StartedAt: engineText() }); }
      else { await pause(20); this.startServices(); }
      if (ps.state === 'FRESH' || ps.state === 'FIRST_START') {
        for (const key of ['ltidb', 'appdb']) this.writeId(key, { ...this.readId(key), firstStart: 'completed' });
        this.pf(lines, 'mark-started', 'OK');
      }
      return { code: 0, text: `Stack healthy. ${warning}` };
    } finally { if (fs.existsSync(this.lockDir()) && got.ctx) this.release(got.ctx, lines); }
  }
  firstStartSetup() {
    for (const key of ['ltidb', 'appdb']) this.makeVol(key);
    this.prepareVolumes();
    const pairId = rnd(16);
    for (const key of ['ltidb', 'appdb']) this.writeId(key, { pairId, generation: 0, firstStart: 'pending', composeProject: PROJECT, provenance: { kind: 'fresh' } });
  }
  // ---------------------------------------------------------------- maintenance commands (ADR-012 §8, §9 as QA's model)
  volumeFiles(key) {
    return this.hasVol(key) ? [DBN[key], DBN[key] + '-wal', DBN[key] + '-shm'].filter((n) => lexists(path.join(this.vol(key), n))) : [];
  }
  writeFolder(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700); }
  /** A product copy: 0600 files, 0700 folders (the product's final modes). */
  put(file, bytes) { this.writeFolder(path.dirname(file)); fs.writeFileSync(file, bytes, { mode: 0o600 }); fs.chmodSync(file, 0o600); }
  backup(lines, out, source) {
    if (fs.existsSync(out) && fs.readdirSync(out).length) return this.refuse(lines, 'backup_folder_not_empty');
    if (source === 'legacy') {
      if (this.qa.some((c) => c.kind === 'storage-decoy' && c.State.Running)) return this.refuse(lines, 'old_layout_container');
      const sets = legacySets(this.clone);
      if (Object.values(sets).flat().some((f) => f.name.endsWith('-journal'))) return this.refuse(lines, 'legacy_hot_journal');
      const files = [];
      for (const [svc, list] of Object.entries(sets)) for (const f of list) {
        this.put(path.join(out, svc, f.name), fs.readFileSync(path.join(this.clone, 'infra/.data', svc, f.name)));
        files.push({ name: `${svc}/${f.name}`, size: f.size, sha256: f.sha256 });
      }
      this.put(path.join(out, 'manifest.json'), JSON.stringify({ formatVersion: 1, backupId: crypto.randomUUID(), composeProject: PROJECT, source: 'legacy', files }));
      return { code: 0, text: 'backup done' };
    }
    const c = this.contentIssue(); if (c) return this.refuse(lines, c.code, c.detail);
    this.prepareContent();
    for (const key of ['ltidb', 'appdb']) { const j = this.journal(key); if (j && !['committed', 'rolled_back'].includes(j.state)) return this.refuse(lines, 'backup_source_not_ok:journal_open'); }
    const ps = this.pairState();
    if (ps.state !== 'OK') return this.refuse(lines, 'backup_source_not_ok:' + (ps.code ?? ps.state));
    const files = [];
    for (const key of ['ltidb', 'appdb']) for (const n of this.volumeFiles(key)) {
      const bytes = fs.readFileSync(path.join(this.vol(key), n));
      this.put(path.join(out, SVC[key], n), bytes);
      files.push({ name: `${SVC[key]}/${n}`, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    }
    const id = ps.ids.ltidb;
    this.put(path.join(out, 'manifest.json'), JSON.stringify({ formatVersion: 1, backupId: crypto.randomUUID(), composeProject: PROJECT, source: 'volume',
      pairId: id.pairId, generation: id.generation, legacySources: id.legacySources ?? null, files, migrations: { 'lti-service/lti.db': MIGRATIONS.lti, 'cogniate-app/cogniate.db': MIGRATIONS.app } }));
    return { code: 0, text: 'backup done' };
  }
  /** QA's model of a valid manifest folder; a damaged copy is refused with "no target changed". */
  readBackup(lines, from) {
    const mf = path.join(from, 'manifest.json');
    if (!fs.existsSync(mf) || fs.existsSync(path.join(from, 'INCOMPLETE'))) return { refusal: this.refuse(lines, 'manifest_missing', 'no target changed') };
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    for (const f of m.files ?? []) {
      const file = path.join(from, f.name);
      if (!fs.existsSync(file) || fsha(file) !== f.sha256) return { refusal: this.refuse(lines, 'backup_file_mismatch', 'no target changed') };
    }
    if (!m.backupId) return { refusal: this.refuse(lines, 'manifest_invalid', 'no target changed') };
    if (m.composeProject !== PROJECT) return { refusal: this.refuse(lines, 'backup_project', 'no target changed') };
    if (m.source === 'volume' && !m.pairId) return { refusal: this.refuse(lines, 'manifest_incomplete', 'no target changed') };
    return { m };
  }
  contentCheck(lines, appDbFile) {
    const db = new DatabaseSync(appDbFile, { readOnly: true });
    let values;
    try { values = [...new Set(db.prepare('SELECT storage_path FROM package WHERE storage_path IS NOT NULL').all().map((x) => String(x.storage_path)))]; } finally { db.close(); }
    const packages = path.join(this.clone, 'infra/.data/cogniate-app/packages');
    const missing = [...new Set(values.map((v) => v.replace(/^packages\//, '').split('/')[0]))].filter((folder) => !fs.existsSync(path.join(packages, folder)));
    lines.push({ event: 'storage_content_check', ts: new Date().toISOString(), result: missing.length ? 'content_missing' : 'pass', checked: values.length });
    if (missing.length && this.inject === 'e-content-missing package folder hold' && this.label === 'content-restore') fs.writeFileSync(path.join(packages, missing[0]), 'injected: a file at the held package path');
    return missing.length ? this.refuse(lines, 'content_missing') : null;
  }
  /** Puts the files of a backup or a legacy folder into the volumes (an exact file set). */
  applyFiles(from, m) {
    for (const key of ['ltidb', 'appdb']) {
      this.makeVol(key);
      for (const n of [DBN[key], DBN[key] + '-wal', DBN[key] + '-shm']) fs.rmSync(path.join(this.vol(key), n), { force: true });
      for (const f of m.files.filter((x) => x.name.startsWith(SVC[key] + '/'))) this.put(path.join(this.vol(key), path.basename(f.name)), fs.readFileSync(path.join(from, f.name)));
    }
    this.prepareVolumes();
  }
  drillStop(lines, operation, point, from, m) {
    const opId = rnd(16);
    for (const key of ['ltidb', 'appdb']) {
      this.makeVol(key);
      this.writeFolder(path.join(this.vol(key), `.restore-${opId}`));
      for (const n of this.volumeFiles(key)) this.put(path.join(this.vol(key), `.restore-${opId}`, n), fs.readFileSync(path.join(this.vol(key), n)));
      if (['swapped', 'swapped-lti', 'swap-app-mid', 'identity-lti', 'identity-app', 'rollback-mid', 'committed-lti'].includes(point)) {
        const prev = path.join(this.vol(key), `.previous-${opId}`);
        this.writeFolder(prev);
        const hashes = {};
        for (const n of this.volumeFiles(key)) { this.put(path.join(prev, n), fs.readFileSync(path.join(this.vol(key), n))); hashes[n] = fsha(path.join(prev, n)); }
        this.writeJournal(key, { operation, opId, state: point, backupId: m.backupId, from, previous: hashes, updatedAt: new Date().toISOString() });
      } else this.writeJournal(key, { operation, opId, state: point, backupId: m.backupId, from, updatedAt: new Date().toISOString() });
    }
    lines.push({ event: 'storage_drill_stop', ts: new Date().toISOString(), point });
    return { code: 3, text: `drill stop at ${point}` };
  }
  restoreInto(m, from) {
    const ps = this.pairState(), base = ps.state === 'OK' ? ps.ids.ltidb : null;
    this.applyFiles(from, m);
    const id = { pairId: base?.pairId ?? m.pairId, generation: (base ? base.generation : m.generation) + 1, firstStart: 'completed', composeProject: PROJECT,
      provenance: { kind: 'restore', backupId: m.backupId }, ...(base?.legacySources ? { legacySources: base.legacySources } : {}) };
    for (const key of ['ltidb', 'appdb']) { this.writeId(key, id); this.writeJournal(key, { operation: 'restore', opId: rnd(16), state: 'committed', backupId: m.backupId }); }
  }
  recover(lines) {
    const j = { ltidb: this.journal('ltidb'), appdb: this.journal('appdb') };
    if (!j.ltidb && !j.appdb) return { code: 0, text: 'nothing to recover' };
    if (['committed', 'rolled_back'].includes(j.ltidb?.state) && ['committed', 'rolled_back'].includes(j.appdb?.state)) return { code: 0, text: 'nothing to recover' };
    const opId = j.ltidb.opId;
    for (const key of ['ltidb', 'appdb']) {
      const prev = path.join(this.vol(key), `.previous-${opId}`);
      if (fs.existsSync(prev) && Object.entries(j[key].previous ?? {}).some(([n, h]) => fsha(path.join(prev, n)) !== h)) {
        for (const k of ['ltidb', 'appdb']) this.writeJournal(k, { ...j[k], state: 'rollback_failed', updatedAt: new Date().toISOString() });
        this.injectTamper();
        return { code: 2, text: 'rollback_failed: run npm run stack:data-quarantine' };
      }
    }
    if (j.ltidb.state === 'committed-lti') {
      const m = JSON.parse(fs.readFileSync(path.join(j.ltidb.from, 'manifest.json'), 'utf8'));
      for (const key of ['ltidb', 'appdb']) for (const d of fs.readdirSync(this.vol(key)).filter((n) => /^\.(previous|restore)-/.test(n))) fs.rmSync(path.join(this.vol(key), d), { recursive: true });
      this.restoreInto(m, j.ltidb.from);
      return { code: 0, text: 'recovered: committed' };
    }
    for (const key of ['ltidb', 'appdb']) {
      for (const d of fs.readdirSync(this.vol(key)).filter((n) => /^\.(previous|restore)-/.test(n))) fs.rmSync(path.join(this.vol(key), d), { recursive: true });
      this.writeJournal(key, { ...j[key], state: 'rolled_back' });
    }
    if (j.ltidb.intoFresh) for (const key of ['ltidb', 'appdb']) for (const n of this.volumeFiles(key)) fs.rmSync(path.join(this.vol(key), n));
    return { code: 1, text: 'verified rolled_back; no target changed' };
  }
  restore(lines, { from, stopAfter, recover, label }) {
    if (recover) return this.recover(lines);
    const b = this.readBackup(lines, from);
    if (b.refusal) return b.refusal;
    const m = b.m;
    if (!m.source) return this.refuse(lines, 'import_target_not_fresh', 'an older manifest is a legacy import');
    for (const key of ['ltidb', 'appdb']) { const j = this.journal(key); if (j && !['committed', 'rolled_back'].includes(j.state)) return this.refuse(lines, 'restore_target_state', 'journal_open: run --recover'); }
    const ps = this.pairState();
    if (ps.state === 'FIRST_START') return this.refuse(lines, 'restore_target_state', 'FIRST_START');
    if (ps.state === 'OK' && ps.ids.ltidb.pairId !== m.pairId) return this.refuse(lines, 'pair_mismatch');
    if (ps.code) return this.refuse(lines, 'restore_target_state', ps.code);
    const failure = this.contentCheck(lines, path.join(from, 'cogniate-app/cogniate.db'));
    if (failure) return failure;
    if (stopAfter) { const r = this.drillStop(lines, 'restore', stopAfter, from, m); if (ps.state === 'FRESH') for (const key of ['ltidb', 'appdb']) this.writeJournal(key, { ...this.journal(key), intoFresh: true }); return r; }
    this.restoreInto(m, from);
    return { code: 0, text: 'restore done' };
  }
  import(lines, { from, stopAfter }) {
    const b = this.readBackup(lines, from);
    if (b.refusal) return b.refusal;
    const m = b.m, ps = this.pairState();
    if (ps.state !== 'FRESH') return this.refuse(lines, 'import_target_not_fresh', ps.state ?? ps.code);
    for (const key of ['ltidb', 'appdb']) if (this.hasVol(key) && fs.readdirSync(this.vol(key)).some((n) => !['packages', 'uploads', '.storage-journal.json'].includes(n))) return this.refuse(lines, 'import_target_not_fresh');
    const failure = this.contentCheck(lines, path.join(from, 'cogniate-app/cogniate.db'));
    if (failure) return failure;
    if (stopAfter) { const r = this.drillStop(lines, 'import', stopAfter, from, m); for (const key of ['ltidb', 'appdb']) this.writeJournal(key, { ...this.journal(key), intoFresh: true }); return r; }
    this.applyFiles(from, m);
    const id = { pairId: rnd(16), generation: 1, firstStart: 'completed', composeProject: PROJECT, provenance: { kind: 'import' },
      legacySources: m.files.map((f) => ({ name: path.basename(f.name), sha256: f.sha256 })) };
    for (const key of ['ltidb', 'appdb']) { this.writeId(key, id); this.writeJournal(key, { operation: 'import', opId: rnd(16), state: 'committed' }); }
    return { code: 0, text: 'import done' };
  }
  quarantine(lines, out) {
    const user = this.qa.find((c) => c.kind === 'storage-volume-user');
    this.writeFolder(out);
    for (const key of ['ltidb', 'appdb']) if (this.hasVol(key)) for (const e of listRoot(this.vol(key)).entries.filter((x) => x.type === 'file')) this.put(path.join(out, `${PROJECT}_${key}`, e.path), fs.readFileSync(path.join(this.vol(key), e.path)));
    lines.push({ event: 'storage_quarantine_copy', ts: new Date().toISOString() });
    if (user) { this.put(path.join(out, 'manifest.json'), JSON.stringify({ formatVersion: 1, kind: 'quarantine-copy', verified: true })); return this.refuse(lines, 'volume_in_use', `${user.Name.slice(1)} ${user.Id}`); }
    const removedContainers = this.services.map((s) => ({ id: s.Id, name: s.Name.slice(1) })), removedVolumes = Object.values(this.volumes).map((v) => v.Name);
    this.put(path.join(out, 'quarantine.json'), JSON.stringify({ removedContainers, removedVolumes }));
    this.services = []; this.dropVols();
    return { code: 0, text: 'quarantine done' };
  }
  reset() {
    this.services = []; this.dropVols();
    fs.rmSync(path.join(this.clone, 'infra/.data/lti-service'), { recursive: true, force: true });
    const P = path.join(this.clone, 'infra/.data/cogniate-app');
    if (fs.existsSync(P)) for (const n of fs.readdirSync(P)) fs.rmSync(path.join(P, n), { recursive: true, force: true });
    fs.rmSync(path.join(this.clone, 'infra/.logs'), { recursive: true, force: true });
    return { code: 0, text: 'reset done' };
  }
  // ---------------------------------------------------------------- npm run <script>: the fake product
  async npm(name, args, { env = {} } = {}) {
    const [, script, , ...rest] = args;
    const opt = (k) => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : undefined);
    this.productCalls.push({ name, script, rest, env: { STORAGE_DRILL: env.STORAGE_DRILL } });
    this.label = name;
    this.log.push({ kind: 'product', name, script, rest });
    const lines = [];
    let res;
    const guardedScripts = ['stack:up', 'stack:restart', 'test:acceptance', 'e2e:reset', 'demo:prepare', 'stack:data-backup'];
    if (this.stopped) throw new Error('mock lane stopped after ' + this.stopAfter);
    if (script === 'stack:reset') { const log = fs.existsSync(this.lockLog()) ? fs.readFileSync(this.lockLog(), 'utf8').trim().split('\n') : []; this.resetMarks.push({ label: name, lastLine: log.at(-1) ?? null }); }
    if (this.inject === 'first-start-fails' && name === 'a-first-start-partial') res = { code: 1, text: 'injected: quarantine failed' };
    else if (this.guarded() && guardedScripts.includes(script)) res = { code: 1, text: 'The storage-compatibility override is enabled. Run `npm run stack:storage-compat -- disable` first.' };
    else if (script === 'seed') res = this.running() ? { code: 0, text: 'seeded' } : { code: 1, text: "Service 'lti-service' is not healthy (status: missing)" };
    else if (script === 'stack:up') res = await this.start(lines, { label: name, env });
    else if (script === 'stack:restart') {
      const knobs = path.join(this.clone, '.tmp/compose.knobs.yaml');
      if (rest.includes('--env')) { fs.writeFileSync(knobs, 'services: {}\n'); res = await this.start(lines, { label: name, restart: rest[0] }); }
      else { fs.rmSync(knobs, { force: true }); res = await this.start(lines, { label: name, restart: rest[0] }); }
    } else if (script === 'stack:down') { this.stopServices(); res = { code: 0, text: 'down' }; }
    else if (script === 'stack:reset') res = this.reset();
    else if (script === 'stack:storage-compat') {
      const knobs = path.join(this.clone, '.tmp/compose.knobs.yaml');
      if (rest[0] === 'enable') res = fs.existsSync(knobs) ? { code: 1, text: 'test knobs present' } : (fs.writeFileSync(knobs, 'x-cogniate-storage-compat: { formatVersion: 1 }\n'), { code: 0, text: 'enabled' });
      else res = this.inject === 'i-candidate-guard override marker' ? { code: 1, text: 'injected: disable failed' } : (fs.rmSync(knobs, { force: true }), { code: 0, text: 'disabled' });
    } else if (script === 'test:acceptance') res = { code: 1, text: 'QA mock lane: no suite runs host-only' };
    else if (script.startsWith('stack:data-')) {
      const got = await this.acquire(script, lines);
      if (got.refused) { lines.push({ event: 'storage_refusal', code: got.refused.split(':')[0] }); res = { code: 1, text: got.refused }; }
      else {
        try {
          if (this.running() && script !== 'stack:data-quarantine') res = this.refuse(lines, 'services_running');
          else if (script === 'stack:data-backup') res = this.backup(lines, opt('--out'), opt('--source') ?? 'volume');
          else if (script === 'stack:data-restore') res = this.restore(lines, { from: opt('--from'), stopAfter: env.STORAGE_DRILL === '1' ? opt('--stop-after') : null, recover: rest.includes('--recover'), label: name });
          else if (script === 'stack:data-import') res = this.import(lines, { from: opt('--from'), stopAfter: env.STORAGE_DRILL === '1' ? opt('--stop-after') : null });
          else if (script === 'stack:data-quarantine') res = this.quarantine(lines, opt('--out'));
          else throw new Error('fake product: ' + script);
        } finally { if (fs.existsSync(this.lockDir())) this.release(got.ctx, lines); }
      }
    } else throw new Error('fake product: unexpected npm run ' + script);
    // V2-8: the faults that make a host-side restore fail (the plant changed outside QA while the row ran).
    this.injectHost(name);
    const stdout = lines.map((l) => JSON.stringify(l)).join('\n') + '\n' + (res.text ?? '') + '\n';
    Object.assign(this.productCalls.at(-1), { code: res.code, text: res.text, reasons: lines.filter((l) => l.reasons?.length).map((l) => l.reasons.join(',') + (l.detail ? ' ' + l.detail : '')) });
    return { code: res.code, stdout, stderr: '', durationMs: 0 };
  }
  /** LD-3 row-level negatives: one forbidden change made by the recovery. */
  injectTamper() {
    const lti = this.vol('ltidb'), app = this.vol('appdb'), prev = fs.readdirSync(lti).find((n) => n.startsWith('.previous-'));
    if (this.inject === 'tamper-app-journal-not-failed') this.writeJournal('appdb', { ...this.journal('appdb'), state: 'swapped' });
    if (this.inject === 'tamper-opid-changed') this.writeJournal('ltidb', { ...this.journal('ltidb'), opId: rnd(16) });
    if (this.inject === 'tamper-nested-journal') fs.writeFileSync(path.join(lti, prev, '.storage-journal.json'), '{}');
    if (this.inject === 'tamper-root-journal-deleted') fs.rmSync(path.join(app, '.storage-journal.json'));
    if (this.inject === 'tamper-byte-changed') fs.appendFileSync(path.join(app, 'cogniate.db'), 'x');
  }
  injectHost(label) {
    const site = this.inject, legacy = (f) => path.join(this.clone, 'infra/.data', f);
    // LD-2 row-level negatives: a reclaim (also when a later command removes it again), a removed earlier record, a changed lock.
    const tmp = path.join(this.clone, '.tmp'), stale = fs.readdirSync(tmp).filter((n) => n.includes('.stale-'));
    if (site === 'orphan-transient-reclaim' && label === 'orphan-recover') { fs.mkdirSync(path.join(tmp, `storage-op.${PROJECT}.stale-${rnd()}`)); }
    if (site === 'orphan-transient-reclaim' && label === 'orphan-up') for (const n of stale.filter((x) => fs.readdirSync(path.join(tmp, x)).length === 0)) fs.rmSync(path.join(tmp, n), { recursive: true });
    if (site === 'orphan-earlier-removed' && label === 'orphan-backup') fs.rmSync(path.join(tmp, stale[0]), { recursive: true });
    if (site === 'orphan-earlier-changed' && label === 'orphan-up') fs.appendFileSync(path.join(tmp, stale[0], 'owner.json'), ' ');
    if (site === 'orphan-lock-changed' && label === 'orphan-up') fs.appendFileSync(path.join(this.lockDir(), 'owner.json'), ' ');
    if (site === 'e-not-same-import legacy copies' && label === 'e-not-same-import') fs.appendFileSync(legacy('lti-service/lti.db'), 'x');
    if (site === 'e-hot-journal legacy journal' && label === 'e-hot-journal-backup') fs.rmSync(legacy('lti-service/lti.db-journal'));
    if (site === 'e-added-wal legacy WAL' && label === 'e-added-wal') fs.rmSync(legacy('lti-service/lti.db-wal'));
    if (site === 'e-changed-byte legacy byte' && label === 'e-changed-byte') { const fd = fs.openSync(legacy('lti-service/lti.db'), 'r+'); fs.writeSync(fd, Buffer.from([0x5a]), 0, 1, 300); fs.closeSync(fd); }
    if (site === 'd-content-folder unsafe case' && label === 'd-content-folder') { const up = legacy('cogniate-app/uploads'); fs.unlinkSync(up); fs.mkdirSync(up, { mode: 0o700 }); }
  }
  // ---------------------------------------------------------------- the public APIs (synthetic values; Origin rule of security.md)
  appLog(entry) { const f = path.join(this.clone, 'infra/.logs/cogniate-app.jsonl'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'); }
  async request(url, { method = 'GET', headers = {}, body } = {}) {
    if (this.stopped) throw new Error('mock lane stopped after ' + this.stopAfter);
    const u = new URL(url), route = u.pathname;
    this.log.push({ kind: 'http', method, url, origin: headers.origin ?? null });
    if (!this.running()) throw new Error('connect ECONNREFUSED ' + u.host);
    const json = (status, value, extra = {}) => ({ status, headers: extra, body: value === undefined ? '' : JSON.stringify(value) });
    if (u.origin === URLS.lti) {
      if (route === '/api/platforms' && method === 'POST') { const b = JSON.parse(body), id = 'plat_' + rnd(6); this.withDb('ltidb', (db) => db.prepare('INSERT INTO platform VALUES (?, ?, ?)').run(id, b.name, b.clientId)); return json(201, { id, name: b.name }); }
      if (route === '/api/platforms') return json(200, this.withDb('ltidb', (db) => db.prepare('SELECT id, name, client_id FROM platform').all()));
      if (route === '/api/providers') return json(200, { profiles: [] });
    }
    if (u.origin === URLS.app) {
      if (method !== 'GET' && headers.origin !== URLS.app) { this.appLog({ event: 'csrf_rejected', origin: headers.origin ?? null }); return json(403, { error: 'ORIGIN_NOT_ALLOWED' }); }
      if (route === '/app-api/session' && method === 'POST') {
        const b = JSON.parse(body), env = this.readEnv();
        if ((b.email.startsWith('thanh') ? env.PORTAL_THANH_PASSWORD : env.PORTAL_QAB_PASSWORD) !== b.password) return json(401, { error: 'INVALID_CREDENTIALS' });
        const c = rnd(16); this.cookies.add(c);
        return { status: 204, headers: { 'set-cookie': [`__Host-cog_session=${c}; Path=/; Secure; HttpOnly`] }, body: '' };
      }
      if (!this.cookies.has(String(headers.cookie ?? '').replace(/^__Host-cog_session=/, ''))) return json(401, { error: 'UNAUTHENTICATED' });
      if (route === '/app-api/connections' && method === 'POST') { const b = JSON.parse(body), id = 'conn_' + rnd(6); this.withDb('appdb', (db) => db.prepare('INSERT INTO connection VALUES (?, ?)').run(id, b.name)); return json(201, { id }); }
      if (route === '/app-api/connections') return json(200, this.withDb('appdb', (db) => db.prepare('SELECT id, name FROM connection').all()));
    }
    return json(404, { error: 'NOT_FOUND' });
  }
  // ---------------------------------------------------------------- QA-owned child processes
  spawn(cmd, args, opts) {
    let handle;
    const node = (script, extra) => spawnGroup(process.execPath, [path.join(this.scripts, script), ...extra], opts);
    if (cmd === 'bash' && args[0] === OPLOCK && args[1] === 'run') handle = node('holder.mjs', [this.lockDir(), args.slice(3).join(' '), '3500', PROJECT, this.clone]);
    else if (cmd === 'npm' && args[1] === 'stack:data-backup') {
      handle = node('backup.mjs', [this.lockDir(), this.lockLog(), args[args.indexOf('--out') + 1], PROJECT, this.secret, this.inject === 'backup-unidentified' ? 'unidentified' : 'ok']);
      handle.done.then(() => { this.backupClosedAt = Date.now(); });
    }
    else if (cmd === 'npm' && args[1] === 'stack:data-restore') {
      handle = node('holder.mjs', [this.lockDir(), 'stack:data-restore', '-1', PROJECT, this.clone]);
      this.orphanFrom = args[args.indexOf('--from') + 1];
      this.drillStop([], 'restore', 'swapped-lti', this.orphanFrom, JSON.parse(fs.readFileSync(path.join(this.orphanFrom, 'manifest.json'), 'utf8')));
      this.storage.push({ Id: rnd(32), Name: `/${PROJECT}-storage-${rnd()}`, Created: engineText(),
        Config: { Labels: { 'com.docker.compose.project': PROJECT, 'org.cogniate.storage': 'maintenance', 'org.cogniate.storage.run': rnd() } }, State: { Status: 'running', Running: true } });
    } else if (cmd === 'sleep') handle = spawnGroup('sleep', [args[0] === '2' ? '0.5' : args[0]], opts);
    else if (cmd === 'bash' && args[0] === '-c') handle = spawnGroup(cmd, args, opts);
    else throw new Error('fake spawn: unexpected ' + cmd + ' ' + args.join(' '));
    this.children.push(handle);
    const noKill = (this.inject === 'a-lock-stale case 2 QA process group' && cmd === 'sleep' && args[0] === '300')
      || (this.inject === 'a-lock-stale case 4 stub group' && cmd === 'bash' && args[0] === '-c');
    return noKill ? { ...handle, killGroup: () => false } : handle;
  }
  /** The orphaned maintenance container of g-orphan-* ends (its restore of B completes) on the first listing after the refusal row. */
  storageListed() {
    const c = this.storage.find((x) => x.State.Running);
    if (!c || !this.completeOrphan) return;
    this.completeOrphan = false;
    this.storage = this.storage.filter((x) => x !== c);
    const from = this.orphanFrom, m = JSON.parse(fs.readFileSync(path.join(from, 'manifest.json'), 'utf8'));
    for (const key of ['ltidb', 'appdb']) for (const d of fs.readdirSync(this.vol(key)).filter((n) => /^\.(previous|restore)-/.test(n))) fs.rmSync(path.join(this.vol(key), d), { recursive: true });
    this.restoreInto(m, from);
  }
  // ---------------------------------------------------------------- left-over plants after each step (V7-1)
  afterSave(rel) {
    const m = /^storage\/steps\/\d{3}-(.+)\.json$/.exec(rel);
    if (!m) return;
    const problems = [];
    for (const key of ['ltidb', 'appdb']) if (this.hasVol(key)) for (const e of listRoot(this.vol(key)).entries) {
      if (/^qa-unknown-|^notes\.txt$|^\.lock-probe-[0-9a-f]{15}\.db$/.test(e.path) || (key === 'ltidb' && /^(lti\.db-journal|cogniate\.db)$/.test(e.path))
        || e.type === 'symlink' || e.path === 'uploads/qa-unsafe-file') problems.push(`${key}:${e.path}`);
    }
    if (this.overlay.size) problems.push('root-owned: ' + [...this.overlay.keys()].join(', '));
    if (fs.readdirSync(path.join(this.clone, '.tmp')).some((n) => n.startsWith('qa-host-negative-'))) problems.push('host scratch');
    const up = path.join(this.clone, 'infra/.data/cogniate-app/uploads');
    if (lexists(up) && fs.lstatSync(up).isSymbolicLink()) problems.push('uploads link');
    for (const f of ['infra/.data/lti-service/lti.db-journal', 'infra/.data/lti-service/lti.db-wal']) if (lexists(path.join(this.clone, f))) problems.push(f);
    if (this.guarded()) problems.push('override marker');
    if (this.qa.length) problems.push('QA containers: ' + this.qa.map((c) => c.kind).join(', '));
    for (const c of this.children) if (c.child.exitCode === null && c.child.signalCode === null && c.lingerOk !== true) problems.push('live QA process ' + c.pid);
    if (problems.length) this.leftovers.push(`${m[1]}: ${problems.join('; ')}`);
    this.log.push({ kind: 'step-end', step: m[1], at: Date.now() });
    // The paused maintenance container of g-orphan-refusal ends by itself after its pause (its restore completes).
    if (m[1] === 'g-orphan-refusal') this.completeOrphan = true;
    this.hooks?.[m[1]]?.(this);
    if (m[1] === this.stopAfter) this.stopped = true;
  }
}

// ---------------------------------------------------------------- the synthetic AC-M1-23 clone, backup and handoff (§9.1)

function m123Db(file, kind, { platformId, connectionId }) {
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA journal_mode = DELETE; CREATE TABLE schema_migration (name TEXT)');
    for (const name of MIGRATIONS[kind]) db.prepare('INSERT INTO schema_migration VALUES (?)').run(name);
    if (kind === 'lti') { db.exec('CREATE TABLE platform (id TEXT, name TEXT, client_id TEXT)'); db.prepare('INSERT INTO platform VALUES (?, ?, ?)').run(platformId, 'v10 platform', 'v10-client'); }
    else {
      db.exec('CREATE TABLE connection (id TEXT, name TEXT); CREATE TABLE package (id TEXT, storage_path TEXT)');
      db.prepare('INSERT INTO connection VALUES (?, ?)').run(connectionId, 'v10 connection');
      for (const [id, p] of [['1', 'packages/pkg_a/v1/index.html'], ['2', 'packages/pkg_a/v1/index.html'], ['3', 'packages/pkg_b']]) db.prepare('INSERT INTO package VALUES (?, ?)').run(id, p);
    }
  } finally { db.close(); }
}
/** This window's handoff in the §9.1 order: D, w, the migration clone, the backup root, H, then s; each ≥ 2 ms after the last. */
async function makeHandoff(world) {
  const run = world.runRoot, platformId = 'plat_v10_' + rnd(4), connectionId = 'conn_v10_' + rnd(4);
  const D = path.join(run, 'handoff-' + rnd(4)); fs.mkdirSync(D, { mode: 0o700 }); fs.chmodSync(D, 0o700);
  await twoMsAfter(fs.lstatSync(D).birthtimeMs);
  const windowStart = new Date().toISOString();
  await twoMsAfter(Date.parse(windowStart));
  const Cm = path.join(run, `${BASE}-${SHA.slice(0, 8)}-2026-10-21T13-00-00-000Z`);
  fs.mkdirSync(Cm, { mode: 0o700 });
  fs.writeFileSync(path.join(Cm, '.env'), ['LTI_MASTER_KEY=m123-lti-master-' + rnd(), 'APP_MASTER_KEY=m123-app-master-' + rnd(), 'PORTAL_THANH_PASSWORD=m123-thanh-' + rnd(),
    'PORTAL_QAB_PASSWORD=m123-qab-' + rnd(), 'DB_PASS=m123-db', 'COMPOSE_PROJECT_NAME=' + BASE, ''].join('\n'), { mode: 0o600 });
  fs.mkdirSync(path.join(Cm, 'infra/.secrets/app'), { recursive: true, mode: 0o700 });
  for (const f of ['lti-api-key.cogniate', 'lti-api-key.qa-second', 'app/lti-api-key', 'seed.json']) fs.writeFileSync(path.join(Cm, 'infra/.secrets', f), 'm123-' + rnd(), { mode: 0o600 });
  for (const pkg of ['pkg_a/v1', 'pkg_b']) { fs.mkdirSync(path.join(Cm, 'infra/.data/cogniate-app/packages', pkg), { recursive: true, mode: 0o700 }); fs.writeFileSync(path.join(Cm, 'infra/.data/cogniate-app/packages', pkg, 'index.html'), 'course ' + pkg); }
  fs.mkdirSync(path.join(Cm, 'tests/acceptance/artifacts'), { recursive: true });
  fs.writeFileSync(path.join(Cm, 'tests/acceptance/artifacts/m1-migration.raw.json'), JSON.stringify({ platformId, connection: { id: connectionId } }));
  await twoMsAfter(fs.lstatSync(Cm).birthtimeMs);
  const Rd = path.join(run, 'qa-m1-private-backup-Ab12Cd'); fs.mkdirSync(Rd, { mode: 0o700 }); fs.chmodSync(Rd, 0o700);
  const backup = path.join(Rd, 'original');
  for (const sub of ['lti-service', 'cogniate-app']) fs.mkdirSync(path.join(backup, sub), { recursive: true, mode: 0o700 });
  m123Db(path.join(backup, 'lti-service/lti.db'), 'lti', { platformId, connectionId });
  m123Db(path.join(backup, 'cogniate-app/cogniate.db'), 'app', { platformId, connectionId });
  const files = ['lti-service/lti.db', 'cogniate-app/cogniate.db'].map((name) => ({ name, size: fs.statSync(path.join(backup, name)).size, sha256: fsha(path.join(backup, name)) }));
  fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify({ formatVersion: 1, backupId: crypto.randomUUID(), composeProject: BASE, source: 'volume', pairId: rnd(16), generation: 0, files }), { mode: 0o600 });
  await twoMsAfter(fs.lstatSync(Rd).birthtimeMs);
  const file = path.join(D, 'handoff.json');
  writeHandoff({ CLONE: Cm }, backup, file);
  await twoMsAfter(fs.lstatSync(file).mtimeMs);
  const startedAt = Date.now();
  // IN-2, B-SR-04: the premises of the window order, asserted; a false premise is BLOCKED, never PASS.
  const times = { w: Date.parse(windowStart), clone: fs.lstatSync(Cm).birthtimeMs, root: fs.lstatSync(Rd).birthtimeMs, H: fs.lstatSync(file).mtimeMs, s: startedAt };
  if (!(times.w < times.clone && times.clone < times.root && times.root < times.H && times.H < times.s)) throw new Error('BLOCKED (precondition not made): window order ' + JSON.stringify(times));
  return { file, windowStart, startedAt, Cm, backup, platformId, connectionId };
}
/** A dry run of the storage phase on the mock lane. `stopAfter`: a step file name after which every fake call fails at once. */
async function dryRun(t, { inject = null, stopAfter = null, hooks = {}, partial = null } = {}) {
  const world = new FakeWorld(t, { inject });
  Object.assign(world, { stopAfter, hooks, partial });
  const h = await makeHandoff(world);
  const rows = await storagePhase(world.lane, { identity: IDENTITY, handoff: { file: h.file, windowStart: h.windowStart, startedAt: h.startedAt }, setupClone: () => world.setupClone() });
  return { world, rows, byId: Object.fromEntries(rows.map((row) => [row.id.replace('M1-41.common.', ''), row])), h };
}
const ROW_IDS = SEQUENCE.filter((step) => !step.startsWith('@'));
const causeOf = (row) => (row.status === 'PASS' ? null : row.notes[0]);
/**
 * V7-1 (R2-02, B-SR-07): the expectation map, declared before the run: every row id, its status and its exact first
 * cause. A row FAIL is declared only when a fake answer causes it.
 */
const EXPECTED = Object.freeze({
  ...Object.fromEntries(ROW_IDS.map((id) => [id, { status: 'PASS', cause: null }])),
  'c-host-negative': { status: 'NOT_APPLICABLE', cause: 'QA oracle shows enforcement on this host; probe exit 0; reported apart, never counted as PASS' },
  // Fake answer: the mock lane runs no acceptance suite (a real suite and host-control restart are outside a host-only run).
  'a-lock-scope': { status: 'FAIL', cause: 'test:acceptance with the QA storage case: expected exit 0, got 1' },
});
/** Both directions: every observed row is declared with the same status and cause, and every declared row is observed. */
function compareMap(rows, expected) {
  const problems = [], seen = new Set();
  for (const row of rows) {
    const id = row.id.replace('M1-41.common.', ''), want = expected[id];
    if (seen.has(id)) problems.push(`${id}: more than one result`); seen.add(id);
    if (!want) { problems.push(`${id}: undeclared result ${row.status}`); continue; }
    if (row.status !== want.status || causeOf(row) !== want.cause) problems.push(`${id}: ${row.status} "${causeOf(row)}", declared ${want.status} "${want.cause}"`);
  }
  for (const id of Object.keys(expected)) if (!seen.has(id)) problems.push(`${id}: declared, not observed`);
  return problems;
}
const savedJson = (world, rel) => JSON.parse(world.saved.get(rel));
const segmentsOf = (world) => [...world.saved.keys()].filter((k) => /^storage\/log-archive\/\d{2}-[^/]+\/index\.json$/.test(k)).map((k) => savedJson(world, k));
async function pool(items, size, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

test('HARNESS ONLY: V7-1 mock-lane dry run of the full SEQUENCE matches the declared map in both directions; hooks, restores, archive', async (t) => {
  const { world, rows, byId } = await dryRun(t);
  assert.equal(rows.length, 70, 'One result for each of the 70 row ids');
  assert.deepEqual(compareMap(rows, EXPECTED), [], 'Observed statuses and first causes equal the declared map; failed fake commands: '
    + JSON.stringify(world.productCalls.filter((c) => c.code !== 0 && !/refusal|guard|reentry|lock-wait|stale-4|damaged|nomanifest|drill|orphan|tamper|in-use|content-import|-near|unknown|symlink|owner|mountpoint-|d-content-folder$|f-|h-|e-|recover/.test(c.name)).map(({ name, code, text, reasons }) => ({ name, code, text, reasons }))));
  // The scan hook ran after every step (rows and fixtures), in order; no abort path.
  assert.deepEqual(world.lane.scans.filter((s) => s.point.startsWith('after ')).map((s) => s.point), SEQUENCE.map((s) => 'after ' + s));
  assert.ok(world.lane.scans.every((s) => !s.failed && s.refusals.length === 0), 'No scan hit and no refused correction: ' + world.lane.scans.filter((s) => s.failed).map((s) => s.point).join(', '));
  assert.ok(!world.lane.scans.some((s) => s.point.startsWith('abort path')));
  // Each §4.3 restore ran and succeeded: 21 sites, 29 calls; no plant was left after its step.
  const restores = savedJson(world, 'storage/restores.json');
  assert.equal(restores.length, 29); assert.ok(restores.every((x) => x.ok), JSON.stringify(restores.filter((x) => !x.ok)));
  assert.equal(new Set(restores.map((x) => x.site.replace(/^(d-unknown) .*$/, '$1').replace(/^identityCase .*$/, 'identityCase'))).size, 21, 'All 21 restore sites');
  assert.deepEqual(world.leftovers, [], 'No QA plant remains after its step');
  assert.deepEqual(world.violations, [], 'No write without QA lock and no write while the services run');
  // V6-1: a log segment before each product stack:reset, with the last line before that reset; and one at the phase end.
  const segments = segmentsOf(world);
  assert.deepEqual(world.resetMarks.map((m) => m.label), ['b-sequence-reset-1', 'b-sequence-reset-2', 'b-sequence-reset-3', 'old-schema-reset']);
  for (const mark of world.resetMarks) {
    const seg = segments.find((s) => s.label === 'before-' + mark.label);
    assert.ok(seg?.ok, 'Segment before ' + mark.label);
    assert.ok(world.saved.get(`${seg.folder}/storage-lock.jsonl`).includes(mark.lastLine), 'The segment holds the log as it was before ' + mark.label);
  }
  assert.equal(segments.at(-1).label, 'phase-end');
  assert.equal(savedJson(world, 'storage/log-archive/absence.json').csrfRejected.status, 'PASS', 'V3-R: zero csrf_rejected over the phase window');
  // V1-16: the background backup output is saved through saveText; the planted redaction value is absent.
  const backupLog = world.saved.get('storage/a-serialize-backup.log');
  assert.ok(backupLog && backupLog.includes('<redacted>') && !backupLog.includes(world.secret), 'storage/a-serialize-backup.log through saveText');
  assert.equal(savedJson(world, 'storage/a-serialize-oracle.json').verdict, 'PASS');
  // V4-1 #12: the private recursive copies of B in backups/ are 0700 folders with 0600 files.
  const damaged = fs.readdirSync(world.lane.backups).filter((n) => /^(damaged-|nomanifest-|incomplete-|old-manifest-)/.test(n));
  assert.equal(damaged.length, 8);
  for (const d of damaged) for (const e of listRoot(path.join(world.lane.backups, d)).entries) assert.equal(e.mode, e.type === 'dir' ? '0700' : '0600', `${d}/${e.path}`);
  assert.equal(byId['e-old-schema'].status, 'PASS');
});

/** The 21 restore sites of triage §4.3 and the seven site-14 calls: 27 injections, each [restore site, row]. */
const INJECTIONS = [
  ['c-host-negative scratch', 'c-host-negative'], ['a-restart-refusal planted entry', 'a-restart-refusal'],
  ['a-lock-stale case 2 QA process group', 'a-lock-stale'], ['a-lock-stale case 4 stub group', 'a-lock-stale'],
  ['i-candidate-guard override marker', 'i-candidate-guard'], ['d-stale near-match', 'd-stale'], ['d-unknown notes.txt', 'd-unknown'],
  ['d-symlink link and WAL stash', 'd-symlink'], ['d-owner lti.db owner', 'd-owner'], ['d-mountpoint root plant', 'd-mountpoint'],
  ['d-mountpoint file case', 'd-mountpoint'], ['d-mountpoint link case', 'd-mountpoint'], ['d-content-folder unsafe case', 'd-content-folder'],
  ...['f-pairid', 'f-identity-missing', 'f-db-without-identity', 'f-project', 'f-project-invalid', 'f-half-pair', 'f-half-pair-none']
    .map((label) => ['identityCase ' + label, label.replace(/-(invalid|none)$/, '')]),
  ['e-not-same-import legacy copies', 'e-not-same-import'], ['g-quarantine-in-use QA container', 'g-quarantine-in-use'],
  ['e-hot-journal legacy journal', 'e-hot-journal'], ['e-old-layout QA decoy', 'e-old-layout'], ['e-changed-byte legacy byte', 'e-changed-byte'],
  ['e-added-wal legacy WAL', 'e-added-wal'], ['e-content-missing package folder hold', 'e-content-missing'],
];
/** V2-4 and V2-8: the phase stop after a failed restore at `site` in `row`. Returns the problems (empty: the stop is right). */
function phaseStopProblems({ world, rows }, site, row, before = EXPECTED) {
  const problems = [], at = ROW_IDS.indexOf(row), byId = Object.fromEntries(rows.map((r) => [r.id.replace('M1-41.common.', ''), r]));
  if (rows.length !== 70 || new Set(rows.map((r) => r.id)).size !== 70) problems.push(`${rows.length} results`);
  const failed = byId[row];
  if (failed?.status !== 'FAIL') problems.push(`${row} is ${failed?.status}`);
  const restoreNote = (failed?.notes ?? []).find((n) => n.startsWith(`cleanup ${site} failed: `) || n.startsWith(`restore note: cleanup ${site} failed: `));
  if (!restoreNote) problems.push(`${row} has no restore note of ${site}`);
  const cleanupCause = restoreNote?.replace(/^restore note: /, '');
  const note = `phase stopped after ${row}: ${cleanupCause}; first cause: ${failed?.notes[0]}`;
  for (const [i, id] of ROW_IDS.entries()) {
    if (i < at) { const want = before[id]; if (byId[id].status !== want.status || causeOf(byId[id]) !== want.cause) problems.push(`${id} before the stop: ${byId[id].status} "${causeOf(byId[id])}"`); }
    if (i > at && (byId[id].status !== 'BLOCKED' || byId[id].notes.length !== 1 || byId[id].notes[0] !== note)) problems.push(`${id} after the stop: ${byId[id].status} "${byId[id].notes[0]}"`);
  }
  // Every fixture after the stop is recorded the same way, without running.
  const stopIndex = SEQUENCE.indexOf(row);
  for (const step of SEQUENCE.slice(stopIndex + 1).filter((s) => s.startsWith('@'))) {
    const rec = world.records.filter((x) => x.id === 'STORAGE' + step.replace('@', '-').toUpperCase()).at(-1);
    if (rec?.status !== 'FAIL' || rec.notes[0] !== note) problems.push(`fixture ${step} after the stop: ${rec?.status} "${rec?.notes?.[0]}"`);
  }
  if (!world.lane.scans.some((s) => s.point === `abort path after ${row}`)) problems.push('no abort-path scan');
  if (segmentsOf(world).at(-1)?.label !== 'phase-end') problems.push('no phase-end log segment (teardown archive)');
  if (!savedJson(world, 'storage/restores.json').some((x) => x.site === site && !x.ok)) problems.push('the failed restore is not recorded');
  return problems;
}

test('HARNESS ONLY: V2-8 one injected failure at each of the 21 restore sites and the seven site-14 calls stops the phase (27 runs)', async (t) => {
  assert.equal(INJECTIONS.length, 27);
  assert.equal(new Set(INJECTIONS.map(([site]) => site.replace(/^identityCase .*$/, 'identityCase'))).size, 21);
  // The rows before each stop must equal an uninjected run of the same tree. A site whose row does not run there
  // cannot be reached: that injection is BLOCKED (precondition not made), never PASS.
  const base = await dryRun(t);
  const before = Object.fromEntries(base.rows.map((r) => [r.id.replace('M1-41.common.', ''), { status: r.status, cause: causeOf(r) }]));
  const only = process.env.QA_V28_ONLY;
  const results = await pool(INJECTIONS.filter(([site]) => !only || site === only), 4, async ([site, row]) => (/^not run:/.test(base.byId[row].notes[0])
    ? { site, problems: [`BLOCKED: precondition not made: ${row} does not run in the uninjected dry run (${base.byId[row].notes[0]})`] }
    : { site, problems: phaseStopProblems(await dryRun(t, { inject: site }), site, row, before) }));
  const failures = results.filter((r) => r.problems.length);
  assert.deepEqual(failures, [], 'Each injection stops the phase with 70 results: ' + JSON.stringify(failures.map((f) => [f.site, f.problems.slice(0, 3)])));
});

test('HARNESS ONLY: V2-4 a failed root restore: d-mountpoint FAIL with its first cause and the restore note; every later step BLOCKED', async (t) => {
  const run = await dryRun(t, { inject: 'd-mountpoint root plant' });
  assert.deepEqual(phaseStopProblems(run, 'd-mountpoint root plant', 'd-mountpoint'), []);
  const row = run.byId['d-mountpoint'];
  assert.equal(row.notes[0], 'stack:up: expected exit 0, got 1', 'The first cause stays the body cause');
  assert.ok(row.notes.includes('restore note: cleanup d-mountpoint root plant failed: QA fixture plant failed: injected: chown failed'), row.notes.join(' | '));
  assert.equal(run.byId['d-content-folder'].notes[0],
    'phase stopped after d-mountpoint: cleanup d-mountpoint root plant failed: QA fixture plant failed: injected: chown failed; first cause: stack:up: expected exit 0, got 1');
});

/** The fixture and product commands of one step, in order (from the mock lane log). */
function stepLog(world, step) {
  const end = world.log.findIndex((e) => e.kind === 'step-end' && e.step === step);
  const start = world.log.slice(0, end).findLastIndex((e) => e.kind === 'step-end');
  return world.log.slice(start + 1, end).filter((e) => e.kind === 'fixture' || e.kind === 'product')
    .map((e) => (e.kind === 'product' ? `product ${e.name}` : `${e.op}${e.root ? ' as root' : ''}${e.ops ? ' ' + e.ops.join(',') : ''}`));
}

test('HARNESS ONLY: V2-3 an injected stack:up failure: listing, plant, meta, stack:up, then the restore; FAIL with the stack:up cause and a restore note', async (t) => {
  const { world, byId } = await dryRun(t, { inject: 'stack-up-fails', stopAfter: 'd-mountpoint' });
  const row = byId['d-mountpoint'];
  assert.equal(row.status, 'FAIL'); assert.equal(row.notes[0], 'stack:up: expected exit 0, got 1');
  assert.ok(row.notes.includes('root restore: packages, uploads; both mountpoints HOST_UID:HOST_GID 0700 and empty'), row.notes.join(' | '));
  assert.deepEqual(stepLog(world, 'd-mountpoint').slice(0, 8), ['list', 'plant as root chown:app:packages,chown:app:uploads', 'meta', 'product d-mountpoint-up',
    'meta', 'plant as root chown:app:packages,chown:app:uploads', 'list'].concat([]).slice(0, 8), 'Order: listing, plant, meta, stack:up; the restore; the next listing works');
  assert.equal(world.overlay.size, 0, 'Nothing stays root-owned');
  assert.ok(savedJson(world, 'storage/restores.json').some((x) => x.site === 'd-mountpoint root plant' && x.ok));
  assert.ok(!byId['d-content-folder'].notes[0].startsWith('phase stopped'), 'A successful restore does not stop the phase');
});

test('HARNESS ONLY: V2-5 and V2-6: an unrelated change FAILs "nothing else changed"; a plant without effect FAILs "precondition not made"', async (t) => {
  const changed = await dryRun(t, { inject: 'unrelated-change', stopAfter: 'd-mountpoint' });
  assert.equal(changed.byId['d-mountpoint'].status, 'FAIL');
  assert.equal(changed.byId['d-mountpoint'].notes[0], 'Nothing else changed: lti: changed or added .storage-journal.json');
  const noEffect = await dryRun(t, { inject: 'plant-no-effect', stopAfter: 'd-mountpoint' });
  assert.equal(noEffect.byId['d-mountpoint'].status, 'FAIL', noEffect.byId['d-mountpoint'].notes.join(' | '));
  assert.equal(noEffect.byId['d-mountpoint'].notes[0], 'precondition not made');
  assert.ok(!stepLog(noEffect.world, 'd-mountpoint').includes('product d-mountpoint-up'), 'No product start on a state that was not made');
});

test('HARNESS ONLY: V2-7 the root restore does not run unless both services are positively stopped and QA holds the lock', async (t) => {
  const running = await dryRun(t, { inject: 'restore-services-running' });
  assert.deepEqual(phaseStopProblems(running, 'd-mountpoint root plant', 'd-mountpoint'), []);
  assert.ok(running.byId['d-mountpoint'].notes.includes('restore note: cleanup d-mountpoint root plant failed: Both services are positively stopped'));
  assert.deepEqual(stepLog(running.world, 'd-mountpoint').filter((e) => e.startsWith('plant as root')).length, 1, 'No root chown back while the services run');
  assert.equal(running.world.overlay.size, 2, 'Both mountpoints stay as found (no restore ran)');
  const unlocked = await dryRun(t, { inject: 'lock-refused' });
  assert.deepEqual(phaseStopProblems(unlocked, 'd-mountpoint root plant', 'd-mountpoint'), []);
  assert.ok(unlocked.byId['d-mountpoint'].notes.some((n) => /^restore note: cleanup d-mountpoint root plant failed: QA fixture plant failed/.test(n)));
  assert.equal(unlocked.world.overlay.size, 2, 'No chown without QA lock');
  assert.deepEqual(unlocked.world.violations, []);
});

test('HARNESS ONLY: V2-10 a partial root plant that fails or times out is restored: only packages, then the listing works', async (t) => {
  for (const partial of ['fail', 'timeout']) {
    const { world, byId } = await dryRun(t, { partial, stopAfter: 'd-mountpoint' });
    const row = byId['d-mountpoint'];
    assert.equal(row.status, 'FAIL', partial);
    assert.equal(row.notes[0], partial === 'fail' ? 'QA fixture plant failed: injected: the plant failed after packages' : row.notes[0]);
    if (partial === 'timeout') assert.match(row.notes[0], /^QA container qa-multi-r1-st-qa-fixture-[0-9a-f]{16} exceeded its time bound and was removed$/);
    assert.ok(row.notes.includes('root restore: packages; both mountpoints HOST_UID:HOST_GID 0700 and empty'), row.notes.join(' | '));
    const log = stepLog(world, 'd-mountpoint');
    assert.ok(log.includes('plant as root chown:app:packages'), 'The restore changes only the root-owned mountpoint');
    assert.equal(world.overlay.size, 0);
  }
});

test('HARNESS ONLY: V2-9 a failed a-first-start-resume: the second seed does not run; e-not-same-import and @backup-B name it', async (t) => {
  assert.deepEqual(NEEDS['@seed'], ['a-fresh'], 'The first seed needs only a-fresh');
  assert.deepEqual(NEEDS['@seed-resume'], ['a-fresh', 'a-first-start-resume']);
  const { world, byId } = await dryRun(t, { inject: 'first-start-fails', stopAfter: 'fixture-backup-B' });
  assert.equal(byId['a-first-start-resume'].status, 'FAIL');
  assert.equal(byId['a-first-start-resume'].notes[0], 'stack:data-quarantine: expected exit 0, got 1');
  const seed2 = world.records.filter((x) => x.id === 'STORAGE-SEED-RESUME').at(-1);
  assert.deepEqual([seed2.status, seed2.notes[0]], ['FAIL', 'not run: prerequisite a-first-start-resume did not pass']);
  assert.equal(world.productCalls.filter((c) => c.script === 'seed').length, 1, 'Only the first seed ran');
  assert.equal(byId['e-not-same-import'].notes[0], 'not run: prerequisite a-first-start-resume, @seed-resume did not pass');
  const b = world.records.filter((x) => x.id === 'STORAGE-BACKUP-B').at(-1);
  assert.equal(b.notes[0], 'not run: prerequisite a-first-start-resume, @seed-resume did not pass');
});

test('HARNESS ONLY: V5-1 P or a child of P present before a-fresh makes a-fresh BLOCKED "lane not fresh: <path>"', async (t) => {
  for (const make of [(P) => fs.mkdirSync(P, { recursive: true }), (P) => { fs.mkdirSync(path.dirname(P), { recursive: true }); fs.writeFileSync(P, 'x'); },
    (P) => fs.mkdirSync(path.join(P, 'uploads'), { recursive: true })]) {
    const { world, byId } = await dryRun(t, { stopAfter: 'a-fresh', hooks: { 'c-host-negative': (w) => make(path.join(w.clone, 'infra/.data/cogniate-app')) } });
    assert.equal(byId['a-fresh'].status, 'BLOCKED', byId['a-fresh'].notes.join(' | '));
    assert.equal(byId['a-fresh'].notes[0], 'lane not fresh: infra/.data/cogniate-app');
    assert.ok(!world.productCalls.some((c) => c.name === 'a-fresh-stack-up'), 'No start on a lane that is not fresh');
  }
});

/** Every (device, inode) in the clone and the private root, links not followed. */
function inodes(...roots) {
  const out = new Set();
  const walk = (dir) => { for (const n of fs.readdirSync(dir)) { const f = path.join(dir, n), st = fs.lstatSync(f); out.add(`${st.dev}:${st.ino}`); if (st.isDirectory() && !st.isSymbolicLink()) walk(f); } };
  for (const r of roots) walk(r);
  return out;
}
test('HARNESS ONLY: V5-2 and V5-3 d-content-folder deletes the children (never a rename) and keeps P; the unsafe case refuses before any start', async (t) => {
  const before = {};
  const { world, byId } = await dryRun(t, { stopAfter: 'd-content-folder', hooks: { 'd-mountpoint': (w) => {
    for (const rel of ['', 'packages', 'uploads']) { const st = fs.lstatSync(path.join(w.clone, 'infra/.data/cogniate-app', rel)); before[rel] = { dev: st.dev, ino: st.ino, mode: st.mode, uid: st.uid, gid: st.gid }; }
  } } });
  assert.equal(byId['d-content-folder'].status, 'PASS', byId['d-content-folder'].notes.join(' | '));
  const P = path.join(world.clone, 'infra/.data/cogniate-app'), st = fs.lstatSync(P);
  assert.deepEqual({ dev: st.dev, ino: st.ino, mode: st.mode, uid: st.uid, gid: st.gid }, before[''], 'P has the same device, inode, owner, group and mode');
  const alive = inodes(world.clone, world.lane.private);
  for (const rel of ['packages', 'uploads']) {
    assert.ok(!alive.has(`${before[rel].dev}:${before[rel].ino}`), `The old ${rel} inode exists nowhere in the clone or the private root`);
    const now = fs.lstatSync(path.join(P, rel));
    assert.ok(now.isDirectory() && (now.mode & 0o7777) === 0o700 && now.uid === world.uid, `${rel}: a new 0700 directory of the host user`);
  }
  const starts = world.log.filter((e) => e.kind === 'content-before-start' && e.label === 'd-content-folder-absent');
  assert.deepEqual(starts.map(({ packages, uploads }) => [packages, uploads]), [[false, false]], 'Both children are absent (ENOENT) before stack:up');
  assert.ok(!world.log.some((e) => e.kind === 'compose-start' && e.label === 'd-content-folder'), 'The unsafe case refuses before any compose start command');
  assert.ok([...world.saved.keys()].includes('storage/d-content-folder-unsafe-uploads-before.json'), 'A listing of each child before its deletion');
  const note = byId['d-content-folder'].notes.find((n) => n.startsWith('unsafe case cleanup: '));
  const made = /device (\d+), inode (\d+)/.exec(note ?? '');
  assert.ok(made, 'The unsafe-case cleanup records its new uploads folder');
  assert.notEqual(`${made[1]}:${made[2]}`, `${before.uploads.dev}:${before.uploads.ino}`, 'After the unsafe-case cleanup uploads is a new inode (no rename-back)');
});

test('HARNESS ONLY: V5-4 a child that is a link or a file before a deletion: BLOCKED (setup), nothing deleted, the link target unchanged', async (t) => {
  for (const [child, make] of [['uploads', (w, P) => {
    const target = path.join(w.root, 'outside-target'); fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'keep.txt'), 'keep');
    fs.rmSync(path.join(P, 'uploads'), { recursive: true }); fs.symlinkSync(target, path.join(P, 'uploads'));
  }], ['packages', (w, P) => { fs.rmSync(path.join(P, 'packages'), { recursive: true }); fs.writeFileSync(path.join(P, 'packages'), 'a file'); }]]) {
    let listed = null;
    const { world, byId } = await dryRun(t, { stopAfter: 'd-content-folder', hooks: { 'd-mountpoint': (w) => {
      const P = path.join(w.clone, 'infra/.data/cogniate-app'); make(w, P); listed = listRoot(P).entries.map((e) => [e.path, e.type, e.sha256 ?? null]);
    } } });
    assert.equal(byId['d-content-folder'].status, 'BLOCKED', child);
    assert.equal(byId['d-content-folder'].notes[0], `setup: ${child} is not a real directory of the host user`);
    const P = path.join(world.clone, 'infra/.data/cogniate-app');
    assert.deepEqual(listRoot(P).entries.map((e) => [e.path, e.type, e.sha256 ?? null]), listed, 'Nothing deleted or changed in P');
    if (child === 'uploads') assert.equal(fs.readFileSync(path.join(world.root, 'outside-target/keep.txt'), 'utf8'), 'keep', 'The link target is unchanged');
  }
});

test('HARNESS ONLY: V6-2 an absence claim is BLOCKED when a segment is missing or unreadable; PASS only with every segment', () => {
  const seg = (label, n = 0, ok = true) => ({ label, ok, files: [{ name: 'cogniate-app.jsonl', counts: { csrf_rejected: n } }] });
  const resets = ['b-sequence-reset-1', 'old-schema-reset'];
  const all = [seg('before-b-sequence-reset-1'), seg('before-old-schema-reset'), seg('phase-end')];
  assert.equal(absenceClaim(all, { claim: 'csrf_rejected', resets }).status, 'PASS');
  assert.equal(absenceClaim([all[0], all[2]], { claim: 'csrf_rejected', resets }).status, 'BLOCKED', 'A missing segment before a reset');
  assert.equal(absenceClaim([all[0], all[1]], { claim: 'csrf_rejected', resets }).status, 'BLOCKED', 'No phase-end segment');
  assert.equal(absenceClaim([all[0], seg('before-old-schema-reset', 0, false), all[2]], { claim: 'csrf_rejected', resets }).status, 'BLOCKED', 'An unreadable segment');
  const hit = absenceClaim([all[0], seg('before-old-schema-reset', 2), all[2]], { claim: 'csrf_rejected', resets });
  assert.deepEqual([hit.status, hit.count], ['FAIL', 2]);
});

test('HARNESS ONLY: V4-1 #9, #11 and V4-6 #15: credential replaces, the storage_path read and QA markers are 0600 from creation', async (t) => {
  for (const mask of [0o022, 0o000]) {
    const old = process.umask(mask);
    try {
      assert.equal(process.umask(mask), mask, 'umask pinned');
      const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rows-copies-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      const from = path.join(root, 'm123'), to = path.join(root, 'st');
      for (const c of [from, to]) fs.mkdirSync(path.join(c, 'infra/.secrets/app'), { recursive: true });
      fs.writeFileSync(path.join(from, '.env'), 'LTI_MASTER_KEY=m1\nAPP_MASTER_KEY=m2\nPORTAL_THANH_PASSWORD=p1\nPORTAL_QAB_PASSWORD=p2\n', { mode: 0o644 });
      fs.writeFileSync(path.join(to, '.env'), 'LTI_MASTER_KEY=s1\nAPP_MASTER_KEY=s2\nPORTAL_THANH_PASSWORD=s3\nPORTAL_QAB_PASSWORD=s4\n', { mode: 0o644 }); fs.chmodSync(path.join(to, '.env'), 0o644);
      for (const f of ['lti-api-key.cogniate', 'lti-api-key.qa-second', 'app/lti-api-key', 'seed.json']) { fs.writeFileSync(path.join(from, 'infra/.secrets', f), 'v-' + f); fs.chmodSync(path.join(from, 'infra/.secrets', f), 0o644); }
      const hooked = [], ledger = new Set();
      copyCredentials(to, from, { ledger, hook: (h) => hooked.push(h) });
      assert.equal(hooked.length, 5, 'Site #9: five exclusive creates');
      for (const h of hooked) assert.ok(h.regular && h.mode === '0600' && h.size === 0, 'Created 0600 and empty: ' + h.target);
      for (const target of ledger) {
        const st = fs.lstatSync(target);
        assert.equal(st.mode & 0o777, 0o600, 'Final 0600: ' + target);
        assert.ok(hooked.some((h) => h.dev === st.dev && h.ino === st.ino), 'The created inode is the final file: ' + target);
      }
      assert.equal(ledger.size, 5, 'Every replaced target joins the write ledger');
      // #11: the storage_path read copies into the caller's scratch only.
      const app = path.join(root, 'app'); fs.mkdirSync(app);
      const db = new DatabaseSync(path.join(app, 'cogniate.db')); db.exec("CREATE TABLE package (id TEXT, storage_path TEXT); INSERT INTO package VALUES ('1', 'packages/p')"); db.close();
      fs.chmodSync(path.join(app, 'cogniate.db'), 0o644);
      const scratch = path.join(root, 'scratch'); fs.mkdirSync(scratch, { mode: 0o700 });
      const seen = [];
      await storagePaths(app, scratch, { hook: (h) => seen.push(h) });
      const copy = fs.lstatSync(path.join(scratch, 'cogniate.db'));
      assert.deepEqual(seen.map((h) => [h.mode, h.size, h.dev, h.ino]), [['0600', 0, copy.dev, copy.ino]], 'Site #11 hook: 0600, empty, the final inode');
      assert.equal(copy.mode & 0o777, 0o600);
      // #15 / V4-6: a QA marker is 0600 and never replaces an existing path.
      const marker = path.join(root, 'qa.txt');
      writeMarker(marker, 'qa');
      assert.equal(fs.lstatSync(marker).mode & 0o777, 0o600);
      assert.throws(() => writeMarker(marker, 'again'), /EEXIST/);
    } finally { process.umask(old); }
  }
});

test('HARNESS ONLY: V4-2 identityCase and the d-symlink unstash compare each returned mode with the listing before the row', async (t) => {
  const link = await dryRun(t, { inject: 'unstash-mode-drift:d-symlink', stopAfter: 'd-symlink' });
  assert.equal(link.byId['d-symlink'].status, 'FAIL');
  assert.equal(link.byId['d-symlink'].notes[0], 'cleanup d-symlink link and WAL stash failed: lti.db-wal is back with its mode and bytes from before the row');
  assert.match(link.byId['d-owner'].notes[0], /^phase stopped after d-symlink: /, 'A wrong returned mode is a failed restore: the phase stops');
  const id = await dryRun(t, { inject: 'unstash-mode-drift:identity', stopAfter: 'f-pairid' });
  assert.equal(id.byId['f-pairid'].status, 'FAIL');
  assert.match(id.byId['f-pairid'].notes[0], /^cleanup identityCase f-pairid failed: (lti|app):[^ ]+ is back with its mode from before the row$/);
});

test('HARNESS ONLY: V1-8 an unidentified backup run FAILs only after the backup process ended; its output is saved', async (t) => {
  const { world, byId } = await dryRun(t, { inject: 'backup-unidentified', stopAfter: 'a-serialize' });
  assert.equal(byId['a-serialize'].status, 'FAIL'); assert.equal(byId['a-serialize'].notes[0], 'backup run not identified');
  const log = world.saved.get('storage/a-serialize-backup.log');
  assert.ok(log && log.includes('backup finished after the deadline'), 'The row waited for backup.done: the last output line is saved');
  const end = world.log.findIndex((e) => e.kind === 'step-end' && e.step === 'a-serialize');
  assert.ok(world.backupClosedAt && world.log[end].at >= world.backupClosedAt, 'The row result is recorded after the backup process ended');
  assert.ok(!world.productCalls.some((c) => c.name === 'a-serialize-up'), 'No stack:up without an identified backup run');
});

// ---------------------------------------------------------------- LD-2 and LD-3 (M1 a60ba4a): the declared controls

test('HARNESS ONLY: LD-2 g-orphan-refusal: a reclaim after any one command, or a changed earlier record or lock, FAILs; earlier records may stay', async (t) => {
  // Synthetic records.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-ld2-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const id of ['a', 'b']) { fs.mkdirSync(path.join(dir, `storage-op.qa-x-st.stale-${id}`)); fs.writeFileSync(path.join(dir, `storage-op.qa-x-st.stale-${id}/owner.json`), '{"runId":"' + id + '"}'); }
  fs.mkdirSync(path.join(dir, 'storage-op.qa-other-st.stale-z'));
  const before = staleRecords(dir, 'qa-x-st');
  assert.deepEqual(Object.keys(before), ['storage-op.qa-x-st.stale-a', 'storage-op.qa-x-st.stale-b']);
  assert.deepEqual(staleChanges(before, staleRecords(dir, 'qa-x-st')), [], 'The earlier records stay and are unchanged: PASS');
  fs.mkdirSync(path.join(dir, 'storage-op.qa-x-st.stale-killed'));
  assert.deepEqual(staleChanges(before, staleRecords(dir, 'qa-x-st')), ['added storage-op.qa-x-st.stale-killed']);
  fs.rmSync(path.join(dir, 'storage-op.qa-x-st.stale-killed'), { recursive: true });
  fs.renameSync(path.join(dir, 'storage-op.qa-x-st.stale-a'), path.join(dir, 'storage-op.qa-x-st.stale-c'));
  assert.deepEqual(staleChanges(before, staleRecords(dir, 'qa-x-st')), ['added storage-op.qa-x-st.stale-c', 'removed storage-op.qa-x-st.stale-a'], 'A rename');
  fs.renameSync(path.join(dir, 'storage-op.qa-x-st.stale-c'), path.join(dir, 'storage-op.qa-x-st.stale-a'));
  fs.appendFileSync(path.join(dir, 'storage-op.qa-x-st.stale-b/owner.json'), ' ');
  assert.deepEqual(staleChanges(before, staleRecords(dir, 'qa-x-st')), ['changed storage-op.qa-x-st.stale-b/owner.json']);
  // Row level, each command checked on its own.
  const cases = { 'orphan-transient-reclaim': /^orphan-recover: no command adds a stale-\* folder, and the earlier records are unchanged: added storage-op\.qa-multi-r1-st\.stale-[0-9a-f]{16}$/,
    'orphan-earlier-removed': /^orphan-backup: no command adds a stale-\* folder, and the earlier records are unchanged: removed storage-op\.qa-multi-r1-st\.stale-/,
    'orphan-earlier-changed': /^orphan-up: no command adds a stale-\* folder, and the earlier records are unchanged: changed storage-op\.qa-multi-r1-st\.stale-[0-9a-f]+\/owner\.json$/,
    'orphan-lock-changed': /^The lock record is unchanged$/ };
  for (const [inject, cause] of Object.entries(cases)) {
    const { byId } = await dryRun(t, { inject, stopAfter: 'g-orphan-refusal' });
    assert.equal(byId['g-orphan-refusal'].status, 'FAIL', inject);
    assert.match(byId['g-orphan-refusal'].notes[0], cause, inject);
  }
});

test('HARNESS ONLY: LD-3 g-tamper: only state and updatedAt of the two root journals may change; every other name and byte stays', async (t) => {
  const f = (p, sha) => ({ path: p, type: 'file', sha256: sha });
  const L = (lti, app) => ({ lti: { entries: [{ path: '.', type: 'dir' }, ...lti] }, app: { entries: [{ path: '.', type: 'dir' }, ...app] } });
  const P = '.previous-' + 'a'.repeat(32), Q = '.restore-' + 'a'.repeat(32);
  const base = L([f('lti.db', 'L1'), f('.storage-journal.json', 'J1'), f(`${P}/lti.db`, 'T1'), f(`${Q}/lti.db`, 'R1')], [f('cogniate.db', 'A1'), f('.storage-journal.json', 'J2')]);
  const ok = L([f('lti.db', 'L1'), f('.storage-journal.json', 'J1x'), f(`${Q}/lti.db`, 'T1'), f(`${P}/lti.db`, 'R1')], [f('cogniate.db', 'A1'), f('.storage-journal.json', 'J2x')]);
  assert.deepEqual(tamperChanges(base, ok), [], 'Only the root journals change; a moved file inside its volume keeps its name and bytes');
  const names = 'the multiset of file names changed (a file was deleted or added)', bytes = 'a file other than the two root journals changed its bytes';
  assert.deepEqual(tamperChanges(base, L(base.lti.entries.slice(1), base.app.entries.slice(1, 2))), [names], 'A deleted root journal');
  assert.deepEqual(tamperChanges(base, L([...base.lti.entries.slice(1), f(`${P}/.storage-journal.json`, 'N')], base.app.entries.slice(1))), [names, bytes], 'An added nested journal');
  assert.deepEqual(tamperChanges(base, L([f('lti.db', 'L2'), ...base.lti.entries.slice(2)], base.app.entries.slice(1))), [bytes], 'One changed byte');
  assert.deepEqual(tamperChanges(base, L(base.lti.entries.slice(1, 3), base.app.entries.slice(1))), [names, bytes], 'One deleted file');
  const nested = L([...base.lti.entries.slice(1), f(`${P}/.storage-journal.json`, 'N1')], base.app.entries.slice(1));
  assert.deepEqual(tamperChanges(nested, L([...base.lti.entries.slice(1), f(`${P}/.storage-journal.json`, 'N2')], base.app.entries.slice(1))), [bytes], 'A nested journal is never exempt');
  assert.deepEqual(tamperChanges(base, L(base.lti.entries.slice(1, 3), [...base.app.entries.slice(1), f('lti.db', 'R1')])), [names, bytes], 'A move across volumes keeps no name');
  const j = (json) => ({ present: true, sha256: 'x', json });
  const fsB = { lti: { journal: j({ opId: 'o', state: 'swapped', backupId: 'b', updatedAt: '1' }) }, app: { journal: j({ opId: 'o', state: 'swapped', backupId: 'b', updatedAt: '1' }) } };
  const after = (lti, app) => ({ lti: { journal: j(lti) }, app: { journal: j(app) } });
  const good = { opId: 'o', state: 'rollback_failed', backupId: 'b', updatedAt: '2' };
  assert.deepEqual(rootJournalChanges(fsB, after(good, good)), []);
  assert.deepEqual(rootJournalChanges(fsB, after(good, { ...good, state: 'swapped' })), ['app root journal state is swapped'], 'Each root journal gives its own result');
  assert.deepEqual(rootJournalChanges(fsB, after({ ...good, opId: 'other' }, good)), ['lti root journal opId changed']);
  assert.deepEqual(rootJournalChanges(fsB, after({ ...good, extra: 1 }, good)), ['lti root journal keys changed']);
  const { updatedAt, ...noUpdated } = good;
  assert.deepEqual(rootJournalChanges(fsB, after(noUpdated, good)), ['lti root journal keys changed'], 'A removed key');
  assert.deepEqual(rootJournalChanges(fsB, { lti: { journal: { present: true, error: 'not a regular file' } }, app: { journal: j(good) } }), ['lti root journal is not a JSON object file after']);
  assert.deepEqual(rootJournalChanges(fsB, { lti: { journal: j([1]) }, app: { journal: { present: false } } }), ['lti root journal is not a JSON object file after', 'app root journal is not a JSON object file after']);
  // Row level: the recovery makes one forbidden change.
  for (const [inject, part] of [['tamper-app-journal-not-failed', 'Every journal rollback_failed'], ['tamper-opid-changed', 'lti root journal opId changed'],
    ['tamper-nested-journal', names], ['tamper-root-journal-deleted', 'Every journal rollback_failed'], ['tamper-byte-changed', bytes]]) {
    const { byId } = await dryRun(t, { inject, stopAfter: 'g-tamper' });
    assert.equal(byId['g-tamper'].status, 'FAIL', inject);
    assert.ok(byId['g-tamper'].notes[0].includes(part), `${inject}: ${byId['g-tamper'].notes[0]}`);
  }
});
