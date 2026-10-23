// M1-23/M1-30: an isolated QA clone only; no SQL mutation, no ledger edits.
// ADR-012 revision 3.3: the databases are on the lane volumes. QA reads them only through its
// storage-fixture container (§11), and every old-build step runs with the storage-compatibility
// override of §12 (enabled in the candidate checkout, old starts only through storage-compat.sh run --).
// The guards and assertions of the original rows are unchanged; only the database access and the
// old-build route change. j-migration and j-snapshot record the §12 qualifiers of every old step.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { allContainers } from './lib.mjs';
import { SNAPSHOT_OLD_SHA, assertSnapshotBoundary } from './m1-phases.mjs';
import { CompatRoute, OLD_OPLOCK, qualifyRow } from './storage-compat-route.mjs';
import { StorageFail } from './storage-docker.mjs';
import { privateCopyTree, privateWrite } from './storage-fixture-script.mjs';
import { StorageLane } from './storage-lane.mjs';
import { PhaseAbort, scanCause } from './storage-private-scan.mjs';

export const OLD_REVISION = 'b0b83a8';
const databaseNames = ['lti-service/lti.db', 'cogniate-app/cogniate.db'];
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** Host-folder form of the snapshot (kept for the host-only oracle self-test). */
export function dataSnapshot(root) {
  const output = {};
  for (const db of databaseNames) for (const suffix of ['', '-wal', '-shm']) {
    const name = db + suffix, file = path.join(root, 'infra/.data', name);
    if (fs.existsSync(file)) output[name] = { bytes: fs.statSync(file).size, sha256: sha(file) };
  }
  assert.ok(databaseNames.every((name) => output[name]), 'Both SQLite databases exist');
  return output;
}
/** The same snapshot of the stopped lane volumes, through QA's read-mode fixture container (§11). */
export async function volumeSnapshot(lane) {
  const f = await lane.fileset(), output = {};
  for (const [service, vol, db] of [['lti-service', 'lti', 'lti.db'], ['cogniate-app', 'app', 'cogniate.db']]) {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = f[vol]?.files?.[db + suffix];
      if (file?.present) output[`${service}/${db}${suffix}`] = { bytes: file.size, sha256: file.sha256 };
    }
  }
  assert.ok(databaseNames.every((name) => output[name]), 'Both SQLite databases exist');
  return output;
}
/** schema_migration names of both stopped databases, from copies in the fixture container's own layer. */
export async function volumeLedger(lane) {
  const read = await lane.script('logical', { spec: { markers: [], migrations: true } });
  return { 'lti-service/lti.db': read.lti.schemaMigration, 'cogniate-app/cogniate.db': read.app.schemaMigration };
}
function files(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(path.join(folder, entry.name)) : entry.isFile() ? [path.join(folder, entry.name)] : []);
}
function objects(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(objects)];
}
export function inspectBackup(folder, snapshot, ledger, project) {
  const candidates = files(folder).filter((f) => f.endsWith('.json'));
  const manifestFile = candidates.find((f) => {
    const text = fs.readFileSync(f, 'utf8');
    return text.includes('sha256') && text.includes('lti.db') && text.includes('cogniate.db');
  });
  assert.ok(manifestFile, 'Backup manifest describes both databases and SHA-256 values');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const nodes = objects(manifest);
  const projectField = nodes.flatMap((node) => Object.entries(node).map(([key, value]) => ({ node, key, value })))
    .find(({ key, value }) => /project/i.test(key) && value === project);
  const idField = nodes.flatMap((node) => Object.entries(node).map(([key, value]) => ({ node, key, value })))
    .find(({ key, value }) => /^(backup_?id|backupId|id)$/.test(key) && typeof value === 'string' && value.length > 0);
  assert.ok(projectField && idField, 'Manifest identifies the compose project and backup');
  const listed = new Map();
  for (const [name, expected] of Object.entries(snapshot)) {
    const file = files(folder).find((f) => path.basename(f) === path.basename(name));
    assert.ok(file, `Backup file exists: ${name}`);
    assert.equal(fs.statSync(file).size, expected.bytes);
    assert.equal(sha(file), expected.sha256);
    assert.ok(nodes.some((node) => Object.values(node).includes(expected.sha256)
      && Object.values(node).includes(expected.bytes)), `Manifest gives size and SHA-256: ${name}`);
    listed.set(name, file);
  }
  const serialized = JSON.stringify(manifest);
  for (const names of Object.values(ledger)) for (const name of names) assert.ok(serialized.includes(name), `Old migration named: ${name}`);
  // stack-data.mjs (9f96f7b and later) writes `migrations` per database: { '<service>/<db>': [schema_migration names] }.
  const perDatabase = manifest.migrations;
  assert.ok(perDatabase && typeof perDatabase === 'object' && !Array.isArray(perDatabase), 'Manifest gives the migration names per database');
  assert.deepEqual(Object.keys(perDatabase).sort(), Object.keys(ledger).sort(), 'Manifest gives the migration names of exactly the stopped databases');
  for (const [db, names] of Object.entries(ledger)) {
    assert.ok(Array.isArray(perDatabase[db]) && perDatabase[db].every((name) => typeof name === 'string'), `Manifest lists the migration names of ${db}`);
    assert.deepEqual([...perDatabase[db]].sort(), [...names].sort(), `Manifest contains only the old migration names of ${db}`);
  }
  const migrations = nodes.flatMap((node) => Object.entries(node)
    .filter(([key, value]) => /migration/i.test(key) && Array.isArray(value))
    .flatMap(([, value]) => value.flatMap((item) => typeof item === 'string' ? [item]
      : item && typeof item.name === 'string' ? [item.name] : [])));
  assert.deepEqual([...new Set([...migrations, ...Object.values(perDatabase).flat()])].sort(), [...new Set(Object.values(ledger).flat())].sort(),
    'Manifest contains only the old migration names');
  return { manifestFile, manifest, listed, projectField, idField };
}
/** opIds of the journal records that exist now (absent journals give none). */
export function journalOpIds(files) {
  return ['lti', 'app'].map((vol) => files[vol]?.journal).filter((j) => j?.present && j.json?.opId).map((j) => j.json.opId);
}
/**
 * AC-M1-30 step 3 (ADR-012 §8): after a valid restore both volumes hold a journal of this restore, each `committed`.
 * QA checks each record itself: present and parsable, `operation: "restore"`, `state: "committed"`, one new opId for
 * both, the backup id of the restored manifest, one manifest digest, and each `after` list equal to the database
 * files in place (the meaning of `committed`). Returns the opId.
 */
export function assertRestoreJournalsCommitted(files, { manifest, priorOpIds = [] } = {}) {
  const journal = {};
  for (const vol of ['lti', 'app']) {
    const record = files[vol]?.journal;
    assert.ok(record?.present, `Restore journal exists in ${vol}`);
    assert.ok(record.json && !record.error, `Restore journal of ${vol} parses`);
    journal[vol] = record.json;
    assert.equal(journal[vol].operation, 'restore', `Journal of ${vol} is a restore journal`);
    assert.equal(journal[vol].state, 'committed', `Restore journal of ${vol} is committed`);
    assert.match(String(journal[vol].opId ?? ''), /^[0-9a-f]{32}$/, `Journal of ${vol} has an opId`);
  }
  assert.equal(journal.lti.opId, journal.app.opId, 'Both journals belong to one restore (the same opId)');
  assert.ok(!priorOpIds.includes(journal.lti.opId), 'The committed journals belong to this restore, not to an earlier operation');
  const backupIds = objects(manifest).flatMap((node) => Object.entries(node))
    .filter(([key, value]) => /^(backup_?id|backupId)$/i.test(key) && typeof value === 'string' && value).map(([, value]) => value);
  assert.ok(backupIds.length > 0, 'The restored manifest names its backup id');
  for (const vol of ['lti', 'app']) assert.ok(backupIds.includes(journal[vol].backupId), `Journal of ${vol} names the restored backup`);
  assert.equal(journal.lti.manifestSha256, journal.app.manifestSha256, 'Both journals name one manifest digest');
  for (const vol of ['lti', 'app']) {
    const inPlace = Object.entries(files[vol]?.files ?? {}).filter(([name, f]) => name !== '.storage-identity.json' && f.present)
      .map(([name, f]) => `${name}:${f.size}:${f.sha256}`).sort();
    const after = (Array.isArray(journal[vol].after) ? journal[vol].after : []).map((e) => `${path.basename(String(e.name))}:${e.size}:${e.sha256}`).sort();
    assert.deepEqual(after, inPlace, `The ${vol} journal after-list equals the database files in place`);
  }
  return journal.lti.opId;
}
async function stopServices(r, route) {
  assert.ok(r.state.h1Verified, 'Own QA compose project verified before stop');
  const args = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'stop', 'cogniate-app', 'lti-service'];
  route?.logCommand('docker', args);
  const result = await r.exec('migration-stop', 'docker', args);
  assert.equal(result.code, 0);
  await assertServicesStopped(r);
}
async function assertServicesStopped(r) {
  const services = (await allContainers()).filter((c) =>
    c.Config?.Labels?.['com.docker.compose.project'] === r.PROJECT
    && ['cogniate-app', 'lti-service'].includes(c.Config?.Labels?.['com.docker.compose.service']));
  assert.equal(services.length, 2); assert.ok(services.every((c) => c.State.Running === false));
}
/** Host-control restarts that executed (not refused) since a time; the marker makes the host control refuse them. */
function hostRestartsSince(r, since) {
  const dir = path.join(r.ART, 'host-actions');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).map((n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')))
    .filter((a) => ['m1-restart', 'm1-profile'].includes(a.action) && a.startedAt >= since && a.code !== 2).length;
}
async function checkoutOld(r, route, label, oldSha, installTests) {
  route.begin(label, oldSha);
  route.logCommand('git', ['checkout', '--detach', '--force', oldSha]);
  assert.equal((await r.exec(label + '-checkout', 'git', ['checkout', '--detach', '--force', oldSha])).code, 0);
  await installTests({ exact: oldSha });
  const tree = await route.treeRule();
  assert.ok(tree.ok, 'BLOCKED: ADR-012 §12 tree rule: ' + tree.problem);
  const hashes = route.compatHashes();
  assert.ok(hashes.ok, 'BLOCKED: storage-compat copies differ from infra/compat/storage-compat.sha256');
}
/** The handoff of this round (site #16): ids and paths only, exclusive create, 0600; an existing file fails and stays unchanged. */
export function writeHandoff(r, backup, file = process.env.QA_M1_HANDOFF_FILE) {
  if (!file) return;
  // Only ids, never the service key K0 of the migration state file.
  let platformId = null, connectionId = null;
  const state = path.join(r.CLONE, 'tests/acceptance/artifacts/m1-migration.raw.json');
  if (fs.existsSync(state)) { const s = JSON.parse(fs.readFileSync(state, 'utf8')); platformId = s.platformId ?? null; connectionId = s.connection?.id ?? null; }
  privateWrite(file, Buffer.from(JSON.stringify({ m123Backup: backup, m123Clone: r.CLONE, m123PlatformId: platformId, m123ConnectionId: connectionId })));
}
/**
 * One §7.4 scan point of a migration or snapshot-upgrade phase (triage revision 4 SD-1). A hit makes the phase FAIL
 * at this point; a refused correction stops it. The caller publishes every record (`scans`).
 */
export function scanAt(lane, point) {
  const record = lane.scanPoint(point);
  if (record.refusals.length) throw new PhaseAbort(`scan at ${point}: ${scanCause(record)}`);
  if (record.failed) throw new StorageFail(`scan at ${point}: ${scanCause(record)}`);
  return record;
}

// copyHook: a self-test observer of the creation checks of copy site #13; null at run time.
export async function migrationRun(r, { installTests, setup, probe, identity, scans = [], copyHook = null }) {
  const candidate = r.opt.sha, evidence = [];
  const record = (id, notes) => evidence.push({ id, environment: 'MOODLE-LIVE', status: 'PASS', ...identity, notes });
  assert.match(candidate, /^[a-f0-9]{40}$/);
  const old = await r.exec('old-revision', 'git', ['rev-parse', OLD_REVISION]);
  assert.equal(old.code, 0); const oldSha = old.stdout.trim();
  // Both lanes share one private root and one scan record list (its configDiff scratch removals included).
  const candidateLane = new StorageLane(r, { scans }), oldLane = new StorageLane(r, { oplock: OLD_OPLOCK, scans });
  await candidateLane.boot(); oldLane.imageId = candidateLane.imageId;
  const route = new CompatRoute(r, { testSha: identity.testSha, lane: oldLane });
  // Fresh old-route lane (§12 routes): enable in the candidate checkout before the old checkout.
  await route.enable();
  let since = Date.now();
  await checkoutOld(r, route, 'm1-23-old', oldSha, installTests);
  assert.ok(await setup({ route }), 'Old revision stack starts');
  for (const profiles of [[], ['acceptance']]) assert.deepEqual((await route.configDiff(profiles)).disallowed, [], 'BLOCKED: C1 − C0 outside items (a)–(e)');
  // Reuse the unmodified baseline QA browser setup and complete a real SCORM course.
  const baseline = await route.oldStart('migration-moodle-baseline', ['npm', 'run', 'test:acceptance'], {
    env: { QA_TASK: 'T5a', QA_GREP: 'SETUP-T5a|AC-T5-07' }, timeoutMs: 1_800_000,
  });
  assert.equal(baseline.code, 0);
  await probe('baseline', oldSha, { route }); record('M1-23.common.baseline', 'Real Moodle SCORM activity, sent score and K0 captured on the old revision');
  await stopServices(r, route);
  route.end({ hostRestarts: hostRestartsSince(r, since) });
  const oldLedger = await volumeLedger(oldLane), before = await volumeSnapshot(oldLane);
  assert.equal((await r.exec('checkout-candidate', 'git', ['checkout', '--detach', '--force', candidate])).code, 0);
  await installTests();
  await route.disable();
  assert.equal((await r.npm('new-ci-no-start', ['ci', '--no-audit', '--no-fund'])).code, 0);
  assert.equal((await r.npm('new-build-no-start', ['run', 'build'])).code, 0);
  await assertServicesStopped(r); // Do not mask a build that unexpectedly starts a service.
  assert.deepEqual(await volumeLedger(candidateLane), oldLedger, 'No new migration before backup');
  const backupRoot = fs.mkdtempSync(path.join(path.dirname(r.CLONE), 'qa-m1-private-backup-'));
  fs.chmodSync(backupRoot, 0o700);
  candidateLane.extraRoots = [backupRoot];
  const backup = path.join(backupRoot, 'original');
  assert.equal((await r.npm('data-backup', ['run', 'stack:data-backup', '--', '--out', backup])).code, 0);
  const verified = inspectBackup(backup, before, oldLedger, r.PROJECT);
  scanAt(candidateLane, 'migration after the private backup');
  record('M1-23.common.backup', 'Both stopped databases and present sidecars match the verified backup; old migration names remain');
  assert.equal((await r.npm('start-new-build', ['run', 'stack:up'], { timeoutMs: 900_000 })).code, 0);
  const refused = await r.npm('backup-refuses-running', ['run', 'stack:data-backup', '--', '--out', path.join(backupRoot, 'running-refusal')]);
  assert.equal(refused.code, 1); record('M1-23.common.backup-running', 'Maintenance backup refuses running services');
  await probe('upgrade', candidate); record('M1-23.common.upgrade', 'Moodle profile/generation/history and K0 survive migration');
  await probe('postwrite', candidate); record('M1-30.common.postwrite', 'A second learner score reached Moodle after the backup');
  await stopServices(r);
  const targetBefore = await volumeSnapshot(candidateLane);
  for (const damage of ['bytes', 'missing', 'backup-id', 'project']) {
    const copy = path.join(backupRoot, damage); privateCopyTree(backup, copy, { hook: copyHook });
    scanAt(candidateLane, `migration after the damage copy ${damage}`);
    const info = inspectBackup(copy, before, oldLedger, r.PROJECT);
    if (damage === 'bytes') fs.appendFileSync(info.listed.get(databaseNames[0]), Buffer.from([1]));
    if (damage === 'missing') fs.rmSync(info.listed.get(databaseNames[1]));
    if (damage === 'backup-id' || damage === 'project') {
      const field = damage === 'backup-id' ? info.idField : info.projectField;
      field.node[field.key] = damage === 'backup-id' ? '' : 'qa-other-project';
      fs.writeFileSync(info.manifestFile, JSON.stringify(info.manifest));
    }
    const restore = await r.npm(`restore-refuses-${damage}`, ['run', 'stack:data-restore', '--', '--from', copy]);
    assert.equal(restore.code, 1); assert.deepEqual(await volumeSnapshot(candidateLane), targetBefore, 'Invalid backup changes no target database or sidecar');
    record(`M1-30.common.reject-${damage}`, 'Whole-backup validation rejects damage without changing targets');
  }
  // A valid restore must remove even unrelated stale target sidecars (planted in the volumes, write mode, QA's lock).
  const stale = [];
  for (const [service, vol, db] of [['lti-service', 'lti', 'lti.db'], ['cogniate-app', 'app', 'cogniate.db']]) for (const suffix of ['-wal', '-shm']) {
    if (!Object.hasOwn(before, `${service}/${db}${suffix}`) && !Object.hasOwn(targetBefore, `${service}/${db}${suffix}`))
      stale.push({ op: 'write', vol, path: db + suffix, base64: Buffer.from('QA stale sidecar').toString('base64') });
  }
  if (stale.length) await candidateLane.plant(stale);
  // AC-M1-30 step 3: the journals before the valid restore, so the committed pair must belong to this restore.
  const priorOpIds = journalOpIds(await candidateLane.fileset());
  assert.equal((await r.npm('restore-valid', ['run', 'stack:data-restore', '--', '--from', backup])).code, 0);
  // AC-M1-30 step 3: both journals committed — QA's own read of both journal records (read-mode fixture, §11),
  // after the restore and before any service or old build starts. Exit 0 alone is not this evidence.
  assertRestoreJournalsCommitted(await candidateLane.fileset(), { manifest: verified.manifest, priorOpIds });
  assert.deepEqual(await volumeSnapshot(candidateLane), before);
  record('M1-30.common.restore', 'Valid restore reproduces every backed-up byte and removes unlisted sidecars');
  // Rollback order (§12): restore done; enable in the candidate tree; check out the old SHA; install and build; start.
  await route.enable();
  since = Date.now();
  await checkoutOld(r, route, 'm1-30-old', oldSha, installTests);
  for (const [label, args] of [['old-ci-restored', ['ci', '--no-audit', '--no-fund']], ['old-build-restored', ['run', 'build']]]) {
    route.logCommand('npm', args); assert.equal((await r.npm(label, args)).code, 0);
  }
  for (const profiles of [[], ['acceptance']]) assert.deepEqual((await route.configDiff(profiles)).disallowed, [], 'BLOCKED: C1 − C0 outside items (a)–(e)');
  assert.equal((await route.oldStart('old-start-restored', ['npm', 'run', 'stack:up'], { timeoutMs: 900_000 })).code, 0);
  for (const url of [r.state.urls.app, r.state.urls.lti]) assert.ok((await r.waitHealth(url, (h) => h.status === 'ok')).ok);
  await probe('rollback', oldSha, { route }); record('M1-30.common.rollback', 'Old build launches with K0; the portal loses the new write while Moodle retains the accepted score');
  route.end({ hostRestarts: hostRestartsSince(r, since) });
  const problems = qualifyRow(route.steps, { oldSha });
  r.saveText('storage/j-migration.json', JSON.stringify({ oldSha, steps: route.steps.map(({ commands, ...s }) => ({ ...s, commands: commands.length })), problems }, null, 2));
  evidence.push({ id: 'M1-41.common.j-migration', environment: 'SIM', status: problems.length ? 'FAIL' : 'PASS', ...identity,
    notes: problems.length ? problems.join('; ') : `old build ${oldSha}: ${route.steps.length} old steps with tree, hash, config, wrapper, preflight, status and lock records` });
  r.saveText('migration-hashes.json', JSON.stringify({ oldSha, candidate, oldLedger, before, restored: before, evidence }, null, 2));
  scanAt(candidateLane, 'migration phase end');
  writeHandoff(r, backup);
  // Backups contain secrets. Keep them private for investigation, outside checkout/evidence.
  r.record('MIGRATION', 'Upgrade and rollback lifecycle', 'PASS', ['Private backup retained outside shared evidence']);
  return evidence;
}

// A distinct clean clone/project from the released-v10 Moodle rollback route.
// Seed through the public APIs; read only stopped database copies for ledgers.
export async function snapshotMigrationRun(r, { installTests, setup, probe, identity, scans = [] }) {
  const candidate = r.opt.sha, evidence = [];
  assert.match(candidate, /^[a-f0-9]{40}$/);
  const tree = await r.exec('snapshot-old-tree', 'git', ['ls-tree', '--name-only', SNAPSHOT_OLD_SHA,
    'services/cogniate-app/src/domain/migrations/011_lms_types.sql',
    'services/cogniate-app/src/domain/migrations/012_connection_provider_snapshot.sql']);
  assert.equal(tree.code, 0);
  assertSnapshotBoundary(tree.stdout.trim().split('\n').map((name) => path.basename(name)), 'before');
  const candidateLane = new StorageLane(r, { scans }), oldLane = new StorageLane(r, { oplock: OLD_OPLOCK, scans });
  await candidateLane.boot(); oldLane.imageId = candidateLane.imageId;
  const route = new CompatRoute(r, { testSha: identity.testSha, lane: oldLane });
  await route.enable();
  const since = Date.now();
  await checkoutOld(r, route, 'm1-38-h1-old', SNAPSHOT_OLD_SHA, installTests);
  assert.ok(await setup({ route }));
  for (const profiles of [[], ['acceptance']]) assert.deepEqual((await route.configDiff(profiles)).disallowed, [], 'BLOCKED: C1 − C0 outside items (a)–(e)');
  const seedRows = await probe('snapshot-seed', SNAPSHOT_OLD_SHA, { route });
  await stopServices(r, route);
  route.end({ hostRestarts: hostRestartsSince(r, since) });
  const oldLedger = await volumeLedger(oldLane), before = await volumeSnapshot(oldLane);
  assertSnapshotBoundary(oldLedger['cogniate-app/cogniate.db'], 'before');
  assert.equal((await r.exec('snapshot-checkout-candidate', 'git', ['checkout', '--detach', '--force', candidate])).code, 0);
  await installTests();
  await route.disable();
  assert.equal((await r.npm('snapshot-ci-no-start', ['ci', '--no-audit', '--no-fund'])).code, 0);
  assert.equal((await r.npm('snapshot-build-no-start', ['run', 'build'])).code, 0);
  await assertServicesStopped(r);
  assert.deepEqual(await volumeLedger(candidateLane), oldLedger, 'Build cannot migrate before the stopped backup');
  const backupRoot = fs.mkdtempSync(path.join(path.dirname(r.CLONE), 'qa-m1-snapshot-private-'));
  fs.chmodSync(backupRoot, 0o700);
  candidateLane.extraRoots = [backupRoot];
  const backup = path.join(backupRoot, 'original');
  assert.equal((await r.npm('snapshot-backup', ['run', 'stack:data-backup', '--', '--out', backup])).code, 0);
  inspectBackup(backup, before, oldLedger, r.PROJECT);
  scanAt(candidateLane, 'snapshot-upgrade after the snapshot backup');
  evidence.push(...seedRows.map((row) => ({ ...row, sourceSha: SNAPSHOT_OLD_SHA,
    notes: 'Public 011 fixtures seeded; stopped databases and sidecars verified against the private backup before 012' })));
  assert.equal((await r.npm('snapshot-start-012', ['run', 'stack:up'], { timeoutMs: 900_000 })).code, 0);
  evidence.push(...await probe('snapshot-upgrade', candidate));
  await stopServices(r);
  const newLedger = await volumeLedger(candidateLane);
  assertSnapshotBoundary(newLedger['cogniate-app/cogniate.db'], 'after');
  assert.deepEqual(newLedger['lti-service/lti.db'], oldLedger['lti-service/lti.db']);
  assert.deepEqual(newLedger['cogniate-app/cogniate.db'],
    [...oldLedger['cogniate-app/cogniate.db'], '012_connection_provider_snapshot.sql'].sort());
  const problems = qualifyRow(route.steps, { oldSha: SNAPSHOT_OLD_SHA });
  r.saveText('storage/j-snapshot.json', JSON.stringify({ oldSha: SNAPSHOT_OLD_SHA, steps: route.steps.map(({ commands, ...s }) => ({ ...s, commands: commands.length })), problems }, null, 2));
  evidence.push({ id: 'M1-41.common.j-snapshot', environment: 'SIM', status: problems.length ? 'FAIL' : 'PASS', ...identity,
    notes: problems.length ? problems.join('; ') : `old build ${SNAPSHOT_OLD_SHA}: tree, hash, config, wrapper, preflight, status and lock records` });
  r.saveText('snapshot-migration-hashes.json', JSON.stringify({
    ...identity, sourceSha: SNAPSHOT_OLD_SHA, oldLedger, newLedger, before,
    evidence: evidence.map(({ id, status, environment }) => ({ id, status, environment })),
  }, null, 2));
  scanAt(candidateLane, 'snapshot-upgrade phase end');
  return evidence;
}
