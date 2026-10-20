// M1-23/M1-30: an isolated QA clone only; no SQL mutation, no ledger edits.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allContainers } from './lib.mjs';
import { SNAPSHOT_OLD_SHA, assertSnapshotBoundary } from './m1-phases.mjs';

export const OLD_REVISION = 'b0b83a8';
const databaseNames = ['lti-service/lti.db', 'cogniate-app/cogniate.db'];
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function dataSnapshot(root) {
  const output = {};
  for (const db of databaseNames) for (const suffix of ['', '-wal', '-shm']) {
    const name = db + suffix, file = path.join(root, 'infra/.data', name);
    if (fs.existsSync(file)) output[name] = { bytes: fs.statSync(file).size, sha256: sha(file) };
  }
  assert.ok(databaseNames.every((name) => output[name]), 'Both SQLite databases exist');
  return output;
}
function files(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(path.join(folder, entry.name)) : entry.isFile() ? [path.join(folder, entry.name)] : []);
}
function objects(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(objects)];
}
async function ledgerNames(root) {
  const { DatabaseSync } = await import('node:sqlite');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-ledger-'));
  try {
    const result = {};
    for (const name of databaseNames) {
      const dest = path.join(temporary, path.basename(name));
      for (const suffix of ['', '-wal', '-shm']) {
        const source = path.join(root, 'infra/.data', name + suffix);
        if (fs.existsSync(source)) fs.copyFileSync(source, dest + suffix);
      }
      const db = new DatabaseSync(dest, { readOnly: true });
      try { result[name] = db.prepare('SELECT name FROM schema_migration ORDER BY name').all().map((row) => row.name); }
      finally { db.close(); }
    }
    return result;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
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
  const migrations = nodes.flatMap((node) => Object.entries(node)
    .filter(([key, value]) => /migration/i.test(key) && Array.isArray(value))
    .flatMap(([, value]) => value.flatMap((item) => typeof item === 'string' ? [item]
      : item && typeof item.name === 'string' ? [item.name] : [])));
  assert.deepEqual([...new Set(migrations)].sort(), [...new Set(Object.values(ledger).flat())].sort(),
    'Manifest contains only the old migration names');
  return { manifestFile, manifest, listed, projectField, idField };
}
async function stopServices(r) {
  assert.ok(r.state.h1Verified, 'Own QA compose project verified before stop');
  const result = await r.exec('migration-stop', 'docker', [
    'compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'stop', 'cogniate-app', 'lti-service',
  ]);
  assert.equal(result.code, 0);
  await assertServicesStopped(r);
}
async function assertServicesStopped(r) {
  const services = (await allContainers()).filter((c) =>
    c.Config?.Labels?.['com.docker.compose.project'] === r.PROJECT
    && ['cogniate-app', 'lti-service'].includes(c.Config?.Labels?.['com.docker.compose.service']));
  assert.equal(services.length, 2); assert.ok(services.every((c) => c.State.Running === false));
}

export async function migrationRun(r, { installTests, setup, probe, identity }) {
  const candidate = r.opt.sha, evidence = [];
  const record = (id, notes) => evidence.push({ id, environment: 'MOODLE-LIVE', status: 'PASS', ...identity, notes });
  assert.match(candidate, /^[a-f0-9]{40}$/);
  const old = await r.exec('old-revision', 'git', ['rev-parse', OLD_REVISION]);
  assert.equal(old.code, 0); const oldSha = old.stdout.trim();
  assert.equal((await r.exec('checkout-old', 'git', ['checkout', '--detach', '--force', oldSha])).code, 0);
  await installTests();
  assert.ok(await setup(), 'Old revision stack starts');
  // Reuse the unmodified baseline QA browser setup and complete a real SCORM course.
  const baseline = await r.npm('migration-moodle-baseline', ['run', 'test:acceptance'], {
    env: { ...r.STACK_ENV, QA_TASK: 'T5a', QA_GREP: 'SETUP-T5a|AC-T5-07' }, timeoutMs: 1_800_000,
  });
  assert.equal(baseline.code, 0);
  await probe('baseline', oldSha); record('M1-23.common.baseline', 'Real Moodle SCORM activity, sent score and K0 captured on the old revision');
  await stopServices(r);
  const oldLedger = await ledgerNames(r.CLONE), before = dataSnapshot(r.CLONE);
  assert.equal((await r.exec('checkout-candidate', 'git', ['checkout', '--detach', '--force', candidate])).code, 0);
  await installTests();
  assert.equal((await r.npm('new-ci-no-start', ['ci', '--no-audit', '--no-fund'])).code, 0);
  assert.equal((await r.npm('new-build-no-start', ['run', 'build'])).code, 0);
  await assertServicesStopped(r); // Do not mask a build that unexpectedly starts a service.
  assert.deepEqual(await ledgerNames(r.CLONE), oldLedger, 'No new migration before backup');
  const backupRoot = fs.mkdtempSync(path.join(path.dirname(r.CLONE), 'qa-m1-private-backup-'));
  fs.chmodSync(backupRoot, 0o700);
  const backup = path.join(backupRoot, 'original');
  assert.equal((await r.npm('data-backup', ['run', 'stack:data-backup', '--', '--out', backup])).code, 0);
  const verified = inspectBackup(backup, before, oldLedger, r.PROJECT);
  record('M1-23.common.backup', 'Both stopped databases and present sidecars match the verified backup; old migration names remain');
  assert.equal((await r.npm('start-new-build', ['run', 'stack:up'], { timeoutMs: 900_000 })).code, 0);
  const refused = await r.npm('backup-refuses-running', ['run', 'stack:data-backup', '--', '--out', path.join(backupRoot, 'running-refusal')]);
  assert.equal(refused.code, 1); record('M1-23.common.backup-running', 'Maintenance backup refuses running services');
  await probe('upgrade', candidate); record('M1-23.common.upgrade', 'Moodle profile/generation/history and K0 survive migration');
  await probe('postwrite', candidate); record('M1-30.common.postwrite', 'A second learner score reached Moodle after the backup');
  await stopServices(r);
  const targetBefore = dataSnapshot(r.CLONE);
  for (const damage of ['bytes', 'missing', 'backup-id', 'project']) {
    const copy = path.join(backupRoot, damage); fs.cpSync(backup, copy, { recursive: true });
    const info = inspectBackup(copy, before, oldLedger, r.PROJECT);
    if (damage === 'bytes') fs.appendFileSync(info.listed.get(databaseNames[0]), Buffer.from([1]));
    if (damage === 'missing') fs.rmSync(info.listed.get(databaseNames[1]));
    if (damage === 'backup-id' || damage === 'project') {
      const field = damage === 'backup-id' ? info.idField : info.projectField;
      field.node[field.key] = damage === 'backup-id' ? '' : 'qa-other-project';
      fs.writeFileSync(info.manifestFile, JSON.stringify(info.manifest));
    }
    const restore = await r.npm(`restore-refuses-${damage}`, ['run', 'stack:data-restore', '--', '--from', copy]);
    assert.equal(restore.code, 1); assert.deepEqual(dataSnapshot(r.CLONE), targetBefore, 'Invalid backup changes no target database or sidecar');
    record(`M1-30.common.reject-${damage}`, 'Whole-backup validation rejects damage without changing targets');
  }
  // A valid restore must remove even unrelated stale target sidecars.
  for (const name of databaseNames) for (const suffix of ['-wal', '-shm']) {
    if (!Object.hasOwn(before, name + suffix)) fs.writeFileSync(path.join(r.CLONE, 'infra/.data', name + suffix), 'QA stale sidecar');
  }
  assert.equal((await r.npm('restore-valid', ['run', 'stack:data-restore', '--', '--from', backup])).code, 0);
  assert.deepEqual(dataSnapshot(r.CLONE), before);
  record('M1-30.common.restore', 'Valid restore reproduces every backed-up byte and removes unlisted sidecars');
  assert.equal((await r.exec('checkout-old-restored', 'git', ['checkout', '--detach', '--force', oldSha])).code, 0);
  await installTests();
  assert.equal((await r.npm('old-ci-restored', ['ci', '--no-audit', '--no-fund'])).code, 0);
  assert.equal((await r.npm('old-build-restored', ['run', 'build'])).code, 0);
  assert.equal((await r.npm('old-start-restored', ['run', 'stack:up'], { timeoutMs: 900_000 })).code, 0);
  for (const url of [r.state.urls.app, r.state.urls.lti]) assert.ok((await r.waitHealth(url, (h) => h.status === 'ok')).ok);
  await probe('rollback', oldSha); record('M1-30.common.rollback', 'Old build launches with K0; the portal loses the new write while Moodle retains the accepted score');
  r.saveText('migration-hashes.json', JSON.stringify({ oldSha, candidate, oldLedger, before, restored: before, evidence }, null, 2));
  // Backups contain secrets. Keep them private for investigation, outside checkout/evidence.
  r.record('MIGRATION', 'Upgrade and rollback lifecycle', 'PASS', ['Private backup retained outside shared evidence']);
  return evidence;
}

// A distinct clean clone/project from the released-v10 Moodle rollback route.
// Seed through the public APIs; read only stopped database copies for ledgers.
export async function snapshotMigrationRun(r, { installTests, setup, probe, identity }) {
  const candidate = r.opt.sha, evidence = [];
  assert.match(candidate, /^[a-f0-9]{40}$/);
  const tree = await r.exec('snapshot-old-tree', 'git', ['ls-tree', '--name-only', SNAPSHOT_OLD_SHA,
    'services/cogniate-app/src/domain/migrations/011_lms_types.sql',
    'services/cogniate-app/src/domain/migrations/012_connection_provider_snapshot.sql']);
  assert.equal(tree.code, 0);
  assertSnapshotBoundary(tree.stdout.trim().split('\n').map((name) => path.basename(name)), 'before');
  assert.equal((await r.exec('snapshot-checkout-011', 'git', ['checkout', '--detach', '--force', SNAPSHOT_OLD_SHA])).code, 0);
  await installTests(); assert.ok(await setup());
  const seedRows = await probe('snapshot-seed', SNAPSHOT_OLD_SHA);
  await stopServices(r);
  const oldLedger = await ledgerNames(r.CLONE), before = dataSnapshot(r.CLONE);
  assertSnapshotBoundary(oldLedger['cogniate-app/cogniate.db'], 'before');
  assert.equal((await r.exec('snapshot-checkout-candidate', 'git', ['checkout', '--detach', '--force', candidate])).code, 0);
  await installTests();
  assert.equal((await r.npm('snapshot-ci-no-start', ['ci', '--no-audit', '--no-fund'])).code, 0);
  assert.equal((await r.npm('snapshot-build-no-start', ['run', 'build'])).code, 0);
  await assertServicesStopped(r);
  assert.deepEqual(await ledgerNames(r.CLONE), oldLedger, 'Build cannot migrate before the stopped backup');
  const backupRoot = fs.mkdtempSync(path.join(path.dirname(r.CLONE), 'qa-m1-snapshot-private-'));
  fs.chmodSync(backupRoot, 0o700);
  const backup = path.join(backupRoot, 'original');
  assert.equal((await r.npm('snapshot-backup', ['run', 'stack:data-backup', '--', '--out', backup])).code, 0);
  inspectBackup(backup, before, oldLedger, r.PROJECT);
  evidence.push(...seedRows.map((row) => ({ ...row, sourceSha: SNAPSHOT_OLD_SHA,
    notes: 'Public 011 fixtures seeded; stopped databases and sidecars verified against the private backup before 012' })));
  assert.equal((await r.npm('snapshot-start-012', ['run', 'stack:up'], { timeoutMs: 900_000 })).code, 0);
  evidence.push(...await probe('snapshot-upgrade', candidate));
  await stopServices(r);
  const newLedger = await ledgerNames(r.CLONE);
  assertSnapshotBoundary(newLedger['cogniate-app/cogniate.db'], 'after');
  assert.deepEqual(newLedger['lti-service/lti.db'], oldLedger['lti-service/lti.db']);
  assert.deepEqual(newLedger['cogniate-app/cogniate.db'],
    [...oldLedger['cogniate-app/cogniate.db'], '012_connection_provider_snapshot.sql'].sort());
  r.saveText('snapshot-migration-hashes.json', JSON.stringify({
    ...identity, sourceSha: SNAPSHOT_OLD_SHA, oldLedger, newLedger, before,
    evidence: evidence.map(({ id, status, environment }) => ({ id, status, environment })),
  }, null, 2));
  return evidence;
}
