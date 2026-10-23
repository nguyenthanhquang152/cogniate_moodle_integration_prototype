#!/usr/bin/env node
// Host-only self-test for LA-E5-24 pilot backup and restore drill.
// Exercises the real `volumeBackup`, `validate`, and `volumeRestore` functions of `infra/scripts/stack-data.mjs`
// on synthetic SQLite volume directories in `os.tmpdir()` (zero Docker calls; safe under DOCKER BAN),
// plus `inspectDrillBackup`, `buildBackupRecord`, `scanBackupRecordForSecrets`, `buildDrillMarkerAccount`,
// `verifyDrillMarkerAbsent`, `copyContentFolders`, `restoreContentFolders`, and `computeDrillMetrics`.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import zlib from 'node:zlib';
import { newIdentity } from '../../../infra/scripts/sqlite-lock-probe.mjs';
import { validate, volumeBackup, volumeRestore } from '../../../infra/scripts/stack-data.mjs';
import {
  DRILL_ACS,
  JOURNAL_FILE,
  buildBackupRecord,
  buildDrillMarkerAccount,
  computeDrillMetrics,
  copyContentFolders,
  inspectDrillBackup,
  makeHtmlCourseZipBuffer,
  restoreContentFolders,
  scanBackupRecordForSecrets,
  sha256File,
  verifyDrillMarkerAbsent,
} from './la-e5-24-drill.mjs';

function createSyntheticVolumes(rootDir, project = 'qa-e2e-la-drill-r1') {
  const ltiDir = path.join(rootDir, 'volumes', 'lti-service');
  const appDir = path.join(rootDir, 'volumes', 'cogniate-app');
  const contentPackagesDir = path.join(rootDir, 'content', 'packages');
  fs.mkdirSync(ltiDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(appDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(contentPackagesDir, 'pkg_drill_1'), { recursive: true, mode: 0o700 });

  const pairId = crypto.randomBytes(16).toString('hex');
  const generation = 1;
  for (const [role, dir] of [
    ['lti', ltiDir],
    ['app', appDir],
  ]) {
    const idObj = newIdentity({
      project,
      role,
      pairId,
      generation,
      firstStart: 'completed',
    });
    fs.writeFileSync(path.join(dir, '.storage-identity.json'), `${JSON.stringify(idObj, null, 2)}\n`, { mode: 0o600 });
  }

  const ltiDbPath = path.join(ltiDir, 'lti.db');
  const ltiDb = new DatabaseSync(ltiDbPath);
  ltiDb.exec(`
    CREATE TABLE schema_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    INSERT INTO schema_migration (name, applied_at) VALUES
      ('001_initial.sql', '2026-10-20T00:00:00.000Z'),
      ('006_key_provider.sql', '2026-10-22T00:00:00.000Z'),
      ('007_service_operability.sql', '2026-10-22T01:00:00.000Z');
    CREATE TABLE tool_account (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL);
    INSERT INTO tool_account (id, name, status) VALUES
      ('cogniate', 'Cogniate', 'active'),
      ('qa-second', 'QA Second', 'active');
  `);
  ltiDb.close();
  fs.chmodSync(ltiDbPath, 0o600);

  const appDbPath = path.join(appDir, 'cogniate.db');
  const appDb = new DatabaseSync(appDbPath);
  appDb.exec(`
    CREATE TABLE schema_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    INSERT INTO schema_migration (name, applied_at) VALUES
      ('001_initial.sql', '2026-10-20T00:00:00.000Z'),
      ('013_channel_kernel.sql', '2026-10-22T00:00:00.000Z'),
      ('015_app_operability.sql', '2026-10-22T02:00:00.000Z');
    CREATE TABLE package (id TEXT PRIMARY KEY, storage_path TEXT NOT NULL);
    INSERT INTO package (id, storage_path) VALUES ('pkg_drill_1', 'packages/pkg_drill_1');
    CREATE TABLE publication (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, connection_id TEXT NOT NULL);
    INSERT INTO publication (id, course_id, connection_id) VALUES
      ('pub_drill_prebackup', 'crs_drill_1', 'con_drill_moodle_1');
  `);
  appDb.close();
  fs.chmodSync(appDbPath, 0o600);

  const ids = { uid: process.getuid(), gid: process.getgid() };
  return {
    dirs: { lti: ltiDir, app: appDir },
    contentPackagesDir,
    ids,
    pairId,
    generation,
    ltiDbPath,
    appDbPath,
  };
}

test('AC-LA-E5-24-01: volumeBackup + inspectDrillBackup validates manifest, hashes and migrations and rejects damage/mismatch', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e5-24-selftest-01-'));
  fs.chmodSync(tmp, 0o700);
  try {
    const project = 'qa-e2e-la-drill-r1';
    const { dirs, ids, pairId } = createSyntheticVolumes(tmp, project);
    const drillOutRoot = path.join(tmp, 'external-backup');
    const backupDbDir = path.join(drillOutRoot, 'db');

    const manifest = volumeBackup({
      dirs,
      out: backupDbDir,
      project,
      revision: '053ea576f1e07834b359c8e7297f1effedcf1f57',
      ids,
    });
    const inspected = inspectDrillBackup(backupDbDir, project);
    assert.equal(inspected.manifest.backupId, manifest.backupId);
    assert.equal(inspected.manifest.pairId, pairId);
    assert.equal(inspected.filesChecked, 2);
    assert.equal(inspected.ltiMigrations, 3);
    assert.equal(inspected.appMigrations, 3);

    // Negative 1: project_mismatch is rejected when restoring/validating under another compose project.
    assert.throws(
      () => inspectDrillBackup(backupDbDir, 'qa-other-project'),
      (err) => err.code === 'project_mismatch',
      'validate rejects project_mismatch',
    );

    // Negative 2: INCOMPLETE marker in backupDbDir is rejected with backup_incomplete.
    const incFile = path.join(backupDbDir, 'INCOMPLETE');
    fs.writeFileSync(incFile, '');
    assert.throws(
      () => validate(backupDbDir, project),
      (err) => err.code === 'backup_incomplete',
      'validate rejects INCOMPLETE backup folder',
    );
    fs.rmSync(incFile);

    // Negative 3: byte corruption in backed-up lti.db is rejected with backup_damaged.
    const damagedDir = path.join(tmp, 'damaged-bytes');
    fs.cpSync(backupDbDir, damagedDir, { recursive: true });
    const backedUpLti = path.join(damagedDir, 'lti-service', 'lti.db');
    const buf = fs.readFileSync(backedUpLti);
    buf[buf.length - 1] ^= 0xff;
    fs.writeFileSync(backedUpLti, buf);
    assert.throws(
      () => inspectDrillBackup(damagedDir, project),
      (err) => err.code === 'backup_damaged',
      'validate rejects corrupted database bytes',
    );

    // Negative 4: missing cogniate.db is rejected with backup_damaged.
    const missingDir = path.join(tmp, 'missing-db');
    fs.cpSync(backupDbDir, missingDir, { recursive: true });
    fs.rmSync(path.join(missingDir, 'cogniate-app', 'cogniate.db'));
    assert.throws(
      () => inspectDrillBackup(missingDir, project),
      (err) => err.code === 'backup_damaged',
      'validate rejects missing database file',
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('AC-LA-E5-24-02: buildBackupRecord lists key version IDs from GET /operator/v1/key-provider and scanBackupRecordForSecrets enforces 0 hits', () => {
  const manifest = {
    formatVersion: 1,
    backupId: crypto.randomUUID(),
    createdAt: '2026-10-23T17:00:00.000Z',
    composeProject: 'qa-e2e-la-drill-r1',
    source: 'volume',
    pairId: crypto.randomBytes(16).toString('hex'),
    generation: 1,
    files: [
      { name: 'lti-service/lti.db', size: 16384, sha256: 'a'.repeat(64) },
      { name: 'cogniate-app/cogniate.db', size: 24576, sha256: 'b'.repeat(64) },
    ],
    migrations: {
      'lti-service/lti.db': ['001_initial.sql', '007_service_operability.sql'],
      'cogniate-app/cogniate.db': ['001_initial.sql', '015_app_operability.sql'],
    },
  };

  const fakeMasterKey = crypto.randomBytes(32).toString('hex');
  const fakeAppMasterKey = crypto.randomBytes(32).toString('hex');
  const fakeOperatorKey = `ltio_${crypto.randomBytes(32).toString('base64url')}`;
  const fakeTenantKey = `ltis_${crypto.randomBytes(32).toString('base64url')}`;

  // Even if an input object accidentally carried an extra property on a version item, buildBackupRecord strips it.
  const keyProviderStatus = {
    kind: 'local-keyring',
    activeVersion: 'k2',
    versions: [
      { id: 'legacy', state: 'decrypt-only', sealedCount: 0, derivedCount: 2, accidentalExtra: 'ignored' },
      { id: 'k2', state: 'active', sealedCount: 5, derivedCount: 1 },
    ],
  };

  const record = buildBackupRecord({
    manifest,
    keyProviderStatus,
    sourceRevision: '053ea576f1e07834b359c8e7297f1effedcf1f57',
    contentSummary: { packagesFiles: 3, uploadsFiles: 1, totalBytes: 4096 },
  });

  assert.equal(record.backupId, manifest.backupId);
  assert.equal(record.keyProvider.kind, 'local-keyring');
  assert.equal(record.keyProvider.activeVersion, 'k2');
  assert.deepEqual(record.keyProvider.versionIds, ['legacy', 'k2']);
  assert.equal(Object.hasOwn(record.keyProvider.versions[0], 'accidentalExtra'), false);

  const candidateSecrets = [fakeMasterKey, fakeAppMasterKey, fakeOperatorKey, fakeTenantKey];
  const cleanScan = scanBackupRecordForSecrets(record, candidateSecrets);
  assert.equal(cleanScan.checkedSecretsCount, 4);
  assert.equal(cleanScan.hits, 0, 'Clean backup-record.json has 0 secret hits');

  const manifestScan = scanBackupRecordForSecrets(manifest, candidateSecrets);
  assert.equal(manifestScan.hits, 0, 'Clean manifest.json has 0 secret hits');

  // Negative controls: verify every forbidden secret form is caught by scanBackupRecordForSecrets.
  const leakedMaster = scanBackupRecordForSecrets({ ...record, note: fakeMasterKey }, candidateSecrets);
  assert.ok(leakedMaster.hits > 0 && leakedMaster.matched.includes('candidate_secret_value'));

  const leakedOpKey = scanBackupRecordForSecrets({ ...record, note: fakeOperatorKey }, []);
  assert.ok(leakedOpKey.hits > 0 && leakedOpKey.matched.includes('operator_key_token'));

  const leakedTenantKey = scanBackupRecordForSecrets({ ...record, note: fakeTenantKey }, []);
  assert.ok(leakedTenantKey.hits > 0 && leakedTenantKey.matched.includes('tenant_api_key_token'));

  const leakedPem = scanBackupRecordForSecrets({ ...record, pem: '-----BEGIN PRIVATE KEY-----' }, []);
  assert.ok(leakedPem.hits > 0 && leakedPem.matched.includes('pem_private_key'));

  const leakedRawProp = scanBackupRecordForSecrets({ ...record, masterKey: '1234567890' }, []);
  assert.ok(leakedRawProp.hits > 0 && leakedRawProp.matched.includes('raw_key_property'));
});

test('AC-LA-E5-24-03 & AC-LA-E5-24-04: post-backup drill-<runId> account is wiped by volumeRestore and restore journals commit', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e5-24-selftest-03-04-'));
  fs.chmodSync(tmp, 0o700);
  try {
    const project = 'qa-e2e-la-drill-r1';
    const runId = 'r1test01';
    const { dirs, contentPackagesDir, ids, ltiDbPath, appDbPath } = createSyntheticVolumes(tmp, project);
    const ltiShaBefore = sha256File(ltiDbPath);
    const appShaBefore = sha256File(appDbPath);

    // 1. Take backup while services are stopped (AC-LA-E5-24-01).
    const backupDbDir = path.join(tmp, 'drill-out', 'db');
    const manifest = volumeBackup({
      dirs,
      out: backupDbDir,
      project,
      revision: '053ea576f1e07834b359c8e7297f1effedcf1f57',
      ids,
    });

    // 2. Post-backup write: insert drill-<runId> account into lti.db and a stale -wal sidecar (AC-LA-E5-24-03).
    const markerPayload = buildDrillMarkerAccount(runId, 'https://app.cogniate.test:9443');
    assert.equal(markerPayload.id, 'drill-r1test01');
    assert.equal(markerPayload.launchUrl, 'https://app.cogniate.test:9443/tool/launch');

    const ltiDb = new DatabaseSync(ltiDbPath);
    ltiDb
      .prepare('INSERT INTO tool_account (id, name, status) VALUES (?, ?, ?)')
      .run(markerPayload.id, markerPayload.name, 'active');
    const rowsAfterWrite = ltiDb.prepare('SELECT id FROM tool_account ORDER BY id').all();
    ltiDb.close();
    assert.ok(rowsAfterWrite.some((r) => r.id === markerPayload.id), 'drill-<runId> exists before restore');
    assert.notEqual(sha256File(ltiDbPath), ltiShaBefore, 'lti.db changed after post-backup account insert');

    // Plant a stale -wal sidecar that was not in the backup.
    const staleWal = path.join(dirs.lti, 'lti.db-wal');
    fs.writeFileSync(staleWal, 'stale-wal-bytes', { mode: 0o600 });

    // 3. Restore backup into the same project (AC-LA-E5-24-04).
    const restoreLogs = [];
    const restoreExitCode = volumeRestore({
      dirs,
      from: backupDbDir,
      project,
      operation: 'restore',
      ids,
      log: (entry) => restoreLogs.push(entry),
      contentPackages: contentPackagesDir,
    });
    assert.equal(restoreExitCode, 0, 'volumeRestore exited with code 0');
    assert.equal(fs.existsSync(staleWal), false, 'Stale -wal sidecar removed by volumeRestore');
    assert.equal(sha256File(ltiDbPath), ltiShaBefore, 'lti.db SHA-256 matches pre-backup state');
    assert.equal(sha256File(appDbPath), appShaBefore, 'cogniate.db SHA-256 matches pre-backup state');

    // Check committed restore journals in both volumes (ADR-012 §8).
    const ltiJournal = JSON.parse(fs.readFileSync(path.join(dirs.lti, JOURNAL_FILE), 'utf8'));
    const appJournal = JSON.parse(fs.readFileSync(path.join(dirs.app, JOURNAL_FILE), 'utf8'));
    assert.equal(ltiJournal.operation, 'restore');
    assert.equal(appJournal.operation, 'restore');
    assert.equal(ltiJournal.state, 'committed');
    assert.equal(appJournal.state, 'committed');
    assert.equal(ltiJournal.opId, appJournal.opId);
    assert.equal(ltiJournal.backupId, manifest.backupId);

    // 4. Verify drill-<runId> is absent after restore (AC-LA-E5-24-04).
    const ltiDbRestored = new DatabaseSync(ltiDbPath, { readOnly: true });
    const accountsAfterRestore = ltiDbRestored.prepare('SELECT id, name, status FROM tool_account ORDER BY id').all();
    ltiDbRestored.close();

    const check = verifyDrillMarkerAbsent(accountsAfterRestore, markerPayload.id);
    assert.equal(check.drillMarkerPresent, false);
    assert.deepEqual(check.accountIds, ['cogniate', 'qa-second']);

    // Negative check: verifyDrillMarkerAbsent fails if drill-<runId> is still present.
    assert.throws(
      () => verifyDrillMarkerAbsent([...accountsAfterRestore, { id: markerPayload.id }], markerPayload.id),
      /must not contain post-backup marker/,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('AC-LA-E5-24-05: copyContentFolders + restoreContentFolders round-trip and makeHtmlCourseZipBuffer validity', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e5-24-selftest-05-'));
  fs.chmodSync(tmp, 0o700);
  try {
    const appDataDir = path.join(tmp, 'infra', '.data', 'cogniate-app');
    const pkgFile = path.join(appDataDir, 'packages', 'ver_1', 'index.html');
    const upFile = path.join(appDataDir, 'uploads', 'ver_1.zip');
    fs.mkdirSync(path.dirname(pkgFile), { recursive: true });
    fs.mkdirSync(path.dirname(upFile), { recursive: true });

    const zipBuf = makeHtmlCourseZipBuffer('Drill Self-Test Course');
    assert.equal(zipBuf.readUInt32LE(0), 0x04034b50, 'Valid PKZIP local file header signature');
    const nameLen = zipBuf.readUInt16LE(26);
    const extraLen = zipBuf.readUInt16LE(28);
    const compLen = zipBuf.readUInt32LE(18);
    const entryName = zipBuf.subarray(30, 30 + nameLen).toString('utf8');
    assert.equal(entryName, 'index.html');
    const inflated = zlib
      .inflateRawSync(zipBuf.subarray(30 + nameLen + extraLen, 30 + nameLen + extraLen + compLen))
      .toString('utf8');
    assert.ok(inflated.includes('data-cog-quiz="q0"') && inflated.includes('data-cog-quiz="q9"'));

    fs.writeFileSync(pkgFile, inflated);
    fs.writeFileSync(upFile, zipBuf);

    const backupContentDir = path.join(tmp, 'drill-out', 'content');
    const summary = copyContentFolders(appDataDir, backupContentDir);
    assert.equal(summary.packagesFiles, 1);
    assert.equal(summary.uploadsFiles, 1);
    assert.equal(summary.totalBytes, Buffer.byteLength(inflated) + zipBuf.length);

    // Write a post-backup unreferenced package file and delete the original package file.
    const postBackupPkg = path.join(appDataDir, 'packages', 'ver_post_backup', 'index.html');
    fs.mkdirSync(path.dirname(postBackupPkg), { recursive: true });
    fs.writeFileSync(postBackupPkg, 'post-backup');
    fs.rmSync(pkgFile);

    const restored = restoreContentFolders(backupContentDir, appDataDir);
    assert.equal(restored.restoredFiles, 2);
    assert.equal(fs.existsSync(pkgFile), true, 'Pre-backup package file restored');
    assert.equal(fs.existsSync(postBackupPkg), false, 'Post-backup unreferenced package file removed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('AC-LA-E5-24-06: computeDrillMetrics calculates RTO and RPO and covers all 6 ACs', () => {
  assert.deepEqual(DRILL_ACS, [
    'AC-LA-E5-24-01',
    'AC-LA-E5-24-02',
    'AC-LA-E5-24-03',
    'AC-LA-E5-24-04',
    'AC-LA-E5-24-05',
    'AC-LA-E5-24-06',
  ]);

  const metrics = computeDrillMetrics({
    backupCreatedAt: '2026-10-23T17:00:00.000Z',
    restoreStartedAt: '2026-10-23T17:00:42.500Z',
    restoreCompletedAt: '2026-10-23T17:01:18.750Z',
  });
  assert.equal(metrics.rpoMs, 42_500);
  assert.equal(metrics.rpoSeconds, 42.5);
  assert.equal(metrics.rtoMs, 36_250);
  assert.equal(metrics.rtoSeconds, 36.25);

  assert.throws(
    () =>
      computeDrillMetrics({
        backupCreatedAt: '2026-10-23T17:01:00.000Z',
        restoreStartedAt: '2026-10-23T17:00:00.000Z',
        restoreCompletedAt: '2026-10-23T17:02:00.000Z',
      }),
    /restoreStartedAt must be >= backupCreatedAt/,
  );
  assert.throws(
    () =>
      computeDrillMetrics({
        backupCreatedAt: '2026-10-23T17:00:00.000Z',
        restoreStartedAt: '2026-10-23T17:02:00.000Z',
        restoreCompletedAt: '2026-10-23T17:01:00.000Z',
      }),
    /restoreCompletedAt must be >= restoreStartedAt/,
  );
});
