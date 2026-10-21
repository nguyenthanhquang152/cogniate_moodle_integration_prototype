import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertRestoreJournalsCommitted, dataSnapshot, inspectBackup, journalOpIds } from './m1-migration.mjs';

test('HARNESS ONLY: backup oracle detects wrong bytes, missing sidecars and new migration names', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-backup-oracle-'));
  try {
    const names = ['lti-service/lti.db', 'lti-service/lti.db-wal', 'cogniate-app/cogniate.db'];
    const ledger = { 'lti-service/lti.db': ['lti-old'], 'cogniate-app/cogniate.db': ['app-old'] };
    const backup = path.join(root, 'backup'); fs.mkdirSync(backup);
    for (const name of names) {
      const target = path.join(root, 'infra/.data', name);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, 'independent-oracle-' + name);
      fs.copyFileSync(target, path.join(backup, path.basename(name)));
    }
    const snapshot = dataSnapshot(root);
    const manifest = { backupId: crypto.randomUUID(), project: 'qa-selfcheck',
      files: names.map((name) => ({ name, ...snapshot[name] })), migrations: Object.values(ledger).flat() };
    const file = path.join(backup, 'manifest.json');
    fs.writeFileSync(file, JSON.stringify(manifest));
    assert.equal(inspectBackup(backup, snapshot, ledger, 'qa-selfcheck').listed.size, 3);
    manifest.migrations.push('unexpected-new-migration'); fs.writeFileSync(file, JSON.stringify(manifest));
    assert.throws(() => inspectBackup(backup, snapshot, ledger, 'qa-selfcheck'), /only the old migration/);
    manifest.migrations.pop(); fs.writeFileSync(file, JSON.stringify(manifest));
    fs.appendFileSync(path.join(backup, 'lti.db'), 'damaged');
    assert.throws(() => inspectBackup(backup, snapshot, ledger, 'qa-selfcheck'));
    fs.copyFileSync(path.join(root, 'infra/.data/lti-service/lti.db'), path.join(backup, 'lti.db'));
    fs.rmSync(path.join(backup, 'lti.db-wal'));
    assert.throws(() => inspectBackup(backup, snapshot, ledger, 'qa-selfcheck'), /Backup file exists/);
    // The oracle only reads targets.
    assert.deepEqual(dataSnapshot(root), snapshot);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
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
