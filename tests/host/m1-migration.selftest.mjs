import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertRestoreJournalsCommitted, dataSnapshot, inspectBackup, journalOpIds } from './m1-migration.mjs';

// The stopped-volume ledgers of the two old builds: the migration files of each SHA (`git ls-tree`).
const LTI = 'lti-service/lti.db', APP = 'cogniate-app/cogniate.db', FUTURE = '012_connection_provider_snapshot.sql';
const LEDGER_B0B83A8 = { // phase migration (AC-M1-23/30)
  [LTI]: ['001_init.sql', '002_service_keys.sql', '003_registration_sessions.sql'],
  [APP]: ['001_init.sql', '002_connections.sql', '003_connection_last_error.sql', '004_launch.sql', '005_runtime_and_score_sync.sql',
    '006_attempt_archived_time.sql', '007_resend_and_gradebook.sql', '008_session_last_cmi.sql', '009_native_channel.sql',
    '010_score_delivery_confirmation.sql'],
};
const LEDGER_9F96F7B = { // phase snapshot-upgrade (AC-M1-38 h1)
  [LTI]: [...LEDGER_B0B83A8[LTI], '004_provider_profiles.sql'], [APP]: [...LEDGER_B0B83A8[APP], '011_lms_types.sql'],
};

/** A backup in the form of infra/scripts/stack-data.mjs volumeBackup: <service>/<file> copies, `migrations` per database. */
function productBackup(root, ledger) {
  const names = [LTI, `${LTI}-wal`, APP], backup = path.join(root, 'backup');
  for (const name of names) {
    const target = path.join(root, 'infra/.data', name), copy = path.join(backup, name);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, 'independent-oracle-' + name);
    fs.mkdirSync(path.dirname(copy), { recursive: true }); fs.copyFileSync(target, copy);
  }
  const snapshot = dataSnapshot(root);
  const manifest = { formatVersion: 1, backupId: crypto.randomUUID(), createdAt: new Date().toISOString(), composeProject: 'qa-selfcheck',
    sourceRevision: 'f'.repeat(40), files: names.map((name) => ({ name, size: snapshot[name].bytes, sha256: snapshot[name].sha256 })),
    migrations: structuredClone(ledger), source: 'volume', pairId: 'c'.repeat(32), generation: 0, legacySources: [] };
  const file = path.join(backup, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return { backup, snapshot, manifest, file };
}

test('HARNESS ONLY: backup oracle detects wrong bytes, missing sidecars and new migration names', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-backup-oracle-'));
  try {
    const ledger = LEDGER_9F96F7B, { backup, snapshot, manifest, file } = productBackup(root, ledger);
    assert.equal(inspectBackup(backup, snapshot, ledger, 'qa-selfcheck').listed.size, 3);
    manifest.migrations[APP].push(FUTURE); fs.writeFileSync(file, JSON.stringify(manifest));
    assert.throws(() => inspectBackup(backup, snapshot, ledger, 'qa-selfcheck'), /only the old migration names of cogniate-app/);
    manifest.migrations[APP].pop(); fs.writeFileSync(file, JSON.stringify(manifest));
    fs.appendFileSync(path.join(backup, LTI), 'damaged');
    assert.throws(() => inspectBackup(backup, snapshot, ledger, 'qa-selfcheck'));
    fs.copyFileSync(path.join(root, 'infra/.data', LTI), path.join(backup, LTI));
    fs.rmSync(path.join(backup, `${LTI}-wal`));
    assert.throws(() => inspectBackup(backup, snapshot, ledger, 'qa-selfcheck'), /Backup file exists/);
    // The oracle only reads targets.
    assert.deepEqual(dataSnapshot(root), snapshot);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('HARNESS ONLY: backup oracle checks the per-database migration names of both old builds', () => {
  for (const [phase, ledger] of [['migration', LEDGER_B0B83A8], ['snapshot-upgrade', LEDGER_9F96F7B]]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-backup-ledger-'));
    try {
      const { backup, snapshot, manifest, file } = productBackup(root, ledger);
      const inspect = () => inspectBackup(backup, snapshot, ledger, 'qa-selfcheck');
      const info = inspect();
      assert.equal(info.listed.get(APP), path.join(backup, APP), phase);
      const rejects = (why, change, pattern) => {
        const changed = structuredClone(manifest); change(changed); fs.writeFileSync(file, JSON.stringify(changed));
        try { assert.throws(inspect, pattern, `${phase}: ${why}`); } finally { fs.writeFileSync(file, JSON.stringify(manifest)); }
      };
      rejects('one flat list (not the product form)', (m) => { m.migrations = Object.values(ledger).flat(); }, /per database/);
      rejects('one database with the names of both', (m) => { m.migrations = { [APP]: [...m.migrations[APP], ...m.migrations[LTI]] }; }, /exactly the stopped databases/);
      rejects('an extra database', (m) => { m.migrations['cogniate-app/other.db'] = []; }, /exactly the stopped databases/);
      rejects('a key without its service folder', (m) => { m.migrations['lti.db'] = m.migrations[LTI]; delete m.migrations[LTI]; }, /exactly the stopped databases/);
      rejects('names in one string', (m) => { m.migrations[LTI] = m.migrations[LTI].join(','); }, /lists the migration names of lti-service/);
      rejects('names in an object', (m) => { m.migrations[APP] = { names: m.migrations[APP] }; }, /lists the migration names of cogniate-app/);
      rejects('names as objects', (m) => { m.migrations[LTI] = m.migrations[LTI].map((name) => ({ name })); }, /lists the migration names of lti-service/);
      // The next four cases keep the union of all names unchanged; only the per-database check finds them.
      rejects('an old name is missing', (m) => { m.migrations[APP] = m.migrations[APP].filter((name) => name !== '001_init.sql'); }, /only the old migration names of cogniate-app/);
      rejects('an old name twice', (m) => { m.migrations[LTI].push('001_init.sql'); }, /only the old migration names of lti-service/);
      rejects('a name of the other database', (m) => { m.migrations[LTI].push('002_connections.sql'); }, /only the old migration names of lti-service/);
      rejects('the ledgers swapped', (m) => { [m.migrations[LTI], m.migrations[APP]] = [m.migrations[APP], m.migrations[LTI]]; }, /only the old migration names of lti-service/);
      rejects('future 012 in the app ledger', (m) => { m.migrations[APP].push(FUTURE); }, /only the old migration names of cogniate-app/);
      rejects('future 012 in another migration list', (m) => { m.pendingMigrations = [FUTURE]; }, /only the old migration names\n/);
      rejects('manifest size differs', (m) => { m.files[0].size += 1; }, /Manifest gives size and SHA-256: lti-service\/lti\.db$/);
      rejects('manifest SHA-256 differs', (m) => { m.files[2].sha256 = '0'.repeat(64); }, /Manifest gives size and SHA-256: cogniate-app/);
      // The damage of migrationRun: the returned fields are the product's backupId and composeProject.
      assert.deepEqual([info.idField.key, info.projectField.key], ['backupId', 'composeProject'], phase);
      for (const [field, value] of [[info.idField, ''], [info.projectField, 'qa-other-project']]) {
        const original = field.node[field.key];
        field.node[field.key] = value; fs.writeFileSync(file, JSON.stringify(info.manifest));
        assert.throws(inspect, /identifies the compose project and backup/, `${phase}: ${field.key} changed`);
        field.node[field.key] = original; fs.writeFileSync(file, JSON.stringify(info.manifest));
      }
      assert.equal(inspect().listed.size, 3, `${phase}: the restored manifest passes again`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('HARNESS ONLY: AC-M1-30 step 3 needs both restore journals committed for this restore, read by QA', () => {
  const op = 'a'.repeat(32), backupId = crypto.randomUUID();
  const manifest = { formatVersion: 1, backupId, project: 'qa-selfcheck', files: [] };
  const file = (size, sha256) => ({ present: true, size, sha256 });
  const journal = (vol, patch = {}) => ({ present: true, sha256: 'j', json: { formatVersion: 1, operation: 'restore', opId: op, backupId,
    manifestSha256: 'm'.repeat(64), state: 'committed', before: [], identityBefore: null,
    after: vol === 'lti' ? [{ name: 'lti-service/lti.db', size: 3, sha256: 'x' }] : [{ name: 'cogniate.db', size: 4, sha256: 'y' }, { name: 'cogniate.db-wal', size: 2, sha256: 'w' }],
    ...patch } });
  const files = (lti = journal('lti'), app = journal('app')) => ({
    lti: { files: { 'lti.db': file(3, 'x'), 'lti.db-wal': { present: false }, 'lti.db-shm': { present: false }, '.storage-identity.json': file(1, 'i') }, journal: lti },
    app: { files: { 'cogniate.db': file(4, 'y'), 'cogniate.db-wal': file(2, 'w'), 'cogniate.db-shm': { present: false }, '.storage-identity.json': file(1, 'k') }, journal: app },
  });
  // Positive: both committed, one new opId, the restored backup id, after-lists equal the files in place.
  assert.equal(assertRestoreJournalsCommitted(files(), { manifest, priorOpIds: [] }), op);
  assert.deepEqual(journalOpIds(files()), [op, op]);
  // Missing journal (the app record is absent).
  assert.throws(() => assertRestoreJournalsCommitted(files(undefined, { present: false }), { manifest }), /Restore journal exists in app/);
  // One journal not committed (a cut between the commit writes leaves app `swapped`).
  assert.throws(() => assertRestoreJournalsCommitted(files(journal('lti'), journal('app', { state: 'swapped' })), { manifest }), /app is committed/);
  // Invalid journal: does not parse.
  assert.throws(() => assertRestoreJournalsCommitted(files({ present: true, sha256: 'j', error: 'parse: Unexpected token' }), { manifest }), /lti parses/);
  // Other wrong records: another operation, two operations, an earlier operation, another backup, a sidecar not in `after`.
  assert.throws(() => assertRestoreJournalsCommitted(files(journal('lti', { operation: 'import' })), { manifest }), /restore journal/);
  assert.throws(() => assertRestoreJournalsCommitted(files(journal('lti'), journal('app', { opId: 'b'.repeat(32) })), { manifest }), /same opId/);
  assert.throws(() => assertRestoreJournalsCommitted(files(), { manifest, priorOpIds: [op] }), /not to an earlier operation/);
  assert.throws(() => assertRestoreJournalsCommitted(files(journal('lti', { backupId: crypto.randomUUID() })), { manifest }), /names the restored backup/);
  assert.throws(() => assertRestoreJournalsCommitted(files(), { manifest: { files: [] } }), /names its backup id/);
  const unlisted = files(); unlisted.lti.files['lti.db-shm'] = file(1, 's');
  assert.throws(() => assertRestoreJournalsCommitted(unlisted, { manifest }), /lti journal after-list equals/);
  assert.deepEqual(journalOpIds({ lti: { journal: { present: false } }, app: {} }), [], 'No journal, no prior opId');
});
