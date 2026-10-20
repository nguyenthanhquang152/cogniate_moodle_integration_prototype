import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataSnapshot, inspectBackup } from './m1-migration.mjs';

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
