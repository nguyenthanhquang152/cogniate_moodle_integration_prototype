// HARNESS ONLY: the storage-phase order, prerequisites and helpers. No Docker and no product command.
// Prerequisite failures are shown with a fake lane whose boot is BLOCKED; no row reaches Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STORAGE_GROUPS } from './storage-inventory.mjs';
import { StorageBlocked, StorageFail, fixtureArgs } from './storage-docker.mjs';
import { NEEDS, SEQUENCE, copyCredentials, coversListing, defineRows, storagePaths, storagePhase } from './storage-rows.mjs';
import { volumeSnapshot } from './m1-migration.mjs';

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
  for (const rel of ['packages', 'uploads']) fs.mkdirSync(path.join(clone, 'infra/.data/cogniate-app', rel), { recursive: true, mode: 0o700 });
  const uid = process.getuid(), gid = process.getgid(), project = 'qa-multi-r1-st';
  const dir = (p) => ({ path: p, type: 'dir', uid, gid, mode: '0700' });
  const id = (role) => ({ formatVersion: 1, role, pairId: 'c'.repeat(32), generation: 0, firstStart: 'completed', composeProject: project, provenance: { kind: 'fresh' } });
  const calls = [], queue = [...outputs];
  return { clone, project, hostUid: uid, hostGid: gid, calls,
    presence: async () => ({ ltidb: { state: 'absent' }, appdb: { state: 'absent' } }),
    product: async (label, args) => { calls.push([label, ...args].join(' ')); return { code: 0, stdout: queue.shift(), stderr: '' }; },
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
