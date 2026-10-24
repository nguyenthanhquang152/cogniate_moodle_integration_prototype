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
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { newIdentity } from '../../../infra/scripts/sqlite-lock-probe.mjs';
import { validate, volumeBackup, volumeRestore } from '../../../infra/scripts/stack-data.mjs';
import { Redactor, run, walkFiles } from '../../host/lib.mjs';
import {
  DRILL_ACS,
  JOURNAL_FILE,
  RUNNER_ENTRY_POINT,
  buildBackupRecord,
  buildDrillMarkerAccount,
  buildRunnerHelpText,
  collectCloneSecretCandidates,
  computeDrillMetrics,
  copyContentFolders,
  inspectDrillBackup,
  installLiveSecretRedaction,
  makeHtmlCourseZipBuffer,
  redactPlayId,
  restoreContentFolders,
  sanitizeUrlForError,
  scanBackupRecordForSecrets,
  sha256File,
  stageDrillHelpers,
  verifyDrillMarkerAbsent,
} from './la-e5-24-drill.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

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

  const rootStat = fs.statSync(rootDir);
  const ids = { uid: rootStat.uid, gid: rootStat.gid };
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

test('B-LA-E5-24-01: runtime-token and playId redaction runs on every post-restore failure path (exit 1, timeout, exception) before any output reaches logs, artifacts or terminal', async () => {
  for (const mode of ['exit-1', 'timeout', 'exception']) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `la-e5-24-selftest-b01-${mode}-`));
    fs.chmodSync(tmp, 0o700);
    try {
      const cloneDir = path.join(tmp, 'clone');
      const artDir = path.join(tmp, 'artifacts');
      const drillBackupRoot = path.join(tmp, 'external-backup');
      const capturedSecretsFile = path.join(cloneDir, 'tests', 'acceptance', 'artifacts', 'captured-secrets.jsonl');
      fs.mkdirSync(path.dirname(capturedSecretsFile), { recursive: true, mode: 0o700 });
      fs.mkdirSync(path.join(artDir, 'cmd'), { recursive: true, mode: 0o700 });
      fs.mkdirSync(drillBackupRoot, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(drillBackupRoot, 'marker.txt'), 'temp-backup', { mode: 0o600 });

      const knownRuntimeToken = `rt_tok_${crypto.randomBytes(24).toString('base64url')}`;
      const knownPlayId = `ply_${crypto.randomBytes(16).toString('base64url')}`;
      const hookOnlyToken = `rt_hook_${crypto.randomBytes(24).toString('base64url')}`;
      const lateFinalToken = `rt_late_${crypto.randomBytes(24).toString('base64url')}`;
      const redact = new Redactor();
      const terminalOutput = [];

      // Mirror core.mjs saveText / log / record / exec / summarize / finalRedaction behavior.
      const log = (line) => terminalOutput.push(redact.apply(line));
      const saveText = (rel, text) => {
        const file = path.join(artDir, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        fs.writeFileSync(file, redact.apply(text), { mode: 0o600 });
        return rel;
      };
      const results = [];
      const record = (id, title, status, notes = []) => {
        const entry = { id, title, status, notes: notes.map((n) => redact.apply(n)) };
        results.push(entry);
        log(`${status} ${id} ${title} ${entry.notes.join(' ')}`);
      };

      const liveRedaction = installLiveSecretRedaction({
        redact,
        cloneDir,
        getEnv: () => ({}),
        artDir,
      });

      // Layer 1 pin (redact.apply hook at la-e5-24-drill.mjs:592):
      // Append a newly captured token to captured-secrets.jsonl and call redact.apply directly
      // BEFORE any runStepWithRedaction finally block, finalizeDrillRun, or manual syncSecrets().
      fs.appendFileSync(
        capturedSecretsFile,
        `${JSON.stringify({ label: 'hook_probe_token', value: hookOnlyToken })}\n`,
        { mode: 0o600 },
      );
      const hookedProbe = redact.apply(`layer1-probe=${hookOnlyToken}`);
      assert.equal(
        hookedProbe,
        `layer1-probe=<redacted:${hookOnlyToken.length}>`,
        `Layer 1 redact.apply hook must sync captured-secrets.jsonl before applying redaction (${mode})`,
      );

      const stepRawDiagFile = path.join(artDir, 'cmd', '16-step-raw-unredacted.log');
      const lateRawDiagFile = path.join(artDir, 'cmd', '17-late-raw-unredacted.log');

      const simulatedExec = async (name) => {
        // Simulate container step writing newly issued runtime_token & play_id to captured-secrets.jsonl
        // and then failing / timing out / throwing with the raw token in stdout/stderr/error stack.
        fs.appendFileSync(
          capturedSecretsFile,
          `${JSON.stringify({ label: 'runtime_token', value: knownRuntimeToken })}\n` +
            `${JSON.stringify({ label: 'play_id', value: knownPlayId })}\n`,
          { mode: 0o600 },
        );

        // Write a raw file directly to artDir (bypassing saveText / Layer 1) to pin Layer 2 step finally scrub.
        fs.writeFileSync(
          stepRawDiagFile,
          `layer2-raw-step-file: /rt/${knownRuntimeToken}/commit and /play/${knownPlayId}\n`,
          { mode: 0o600 },
        );

        if (mode === 'exception') {
          // Even if an exception is thrown after writing a partial diagnostic file before saveText:
          fs.writeFileSync(
            path.join(artDir, 'cmd', '16-e524-post-restore-verify.log'),
            `raw diagnostic before scrub: /rt/${knownRuntimeToken}/commit and /play/${knownPlayId}\n`,
            { mode: 0o600 },
          );
          throw new Error(`Uncaught container failure on /rt/${knownRuntimeToken}/commit (${knownPlayId})`);
        }

        const r =
          mode === 'timeout'
            ? {
                code: 124,
                timedOut: true,
                durationMs: 20_000,
                stdout: `step started for ${knownPlayId}\n`,
                stderr: `Error: Timeout after 20000 ms on https://content.cogniate.test:9443/rt/${knownRuntimeToken}/state\n`,
              }
            : {
                code: 1,
                timedOut: false,
                durationMs: 1_500,
                stdout: `step output token=${knownRuntimeToken}\n`,
                stderr: `AssertionError: POST /rt/${knownRuntimeToken}/commit failed for ${knownPlayId}\n`,
              };

        const rel = saveText(
          path.join('cmd', `16-${name}.log`),
          `$ e2e post-restore-verify\nexit: ${r.code}${r.timedOut ? ' (TIMEOUT)' : ''}\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}\n`,
        );
        return { ...r, log: rel };
      };

      // Execute the post-restore step and outer drill try/finally, mirroring run-la-e5-24.mjs + core.mjs.
      try {
        try {
          let stepErr = null;
          let postRestoreRes = null;
          try {
            postRestoreRes = await liveRedaction.runStepWithRedaction(() =>
              simulatedExec('e524-post-restore-verify'),
            );
          } catch (err) {
            stepErr = err;
          }

          // Layer 2 pin (runStepWithRedaction step finally scrub at la-e5-24-drill.mjs:601):
          // Verify that BEFORE finalizeDrillRun runs, the raw file written inside stepFn (bypassing saveText)
          // was already scrubbed on disk by runStepWithRedaction's finally block.
          const stepRawAfterLayer2 = fs.readFileSync(stepRawDiagFile, 'utf8');
          assert.equal(
            stepRawAfterLayer2.includes(knownRuntimeToken),
            false,
            `Layer 2 runStepWithRedaction finally must scrub runtime token from raw disk file before finalizeDrillRun (${mode})`,
          );
          assert.equal(
            stepRawAfterLayer2.includes(knownPlayId),
            false,
            `Layer 2 runStepWithRedaction finally must scrub playId from raw disk file before finalizeDrillRun (${mode})`,
          );
          assert.ok(
            stepRawAfterLayer2.includes(`<redacted:${knownRuntimeToken.length}>`) &&
              stepRawAfterLayer2.includes(`<redacted:${knownPlayId.length}>`),
            `Layer 2 runStepWithRedaction finally must write <redacted:N> placeholders on disk (${mode})`,
          );

          // Stage a post-step raw file and newly captured secret to pin Layer 3 (finalizeDrillRun scrub).
          fs.appendFileSync(
            capturedSecretsFile,
            `${JSON.stringify({ label: 'late_final_token', value: lateFinalToken })}\n`,
            { mode: 0o600 },
          );
          fs.writeFileSync(
            lateRawDiagFile,
            `layer3-raw-late-file: /rt/${lateFinalToken}/state\n`,
            { mode: 0o600 },
          );

          if (stepErr) throw stepErr;
          assert.equal(
            postRestoreRes.code,
            0,
            `post-restore-verify exited 0 (stderr: ${postRestoreRes.stderr})`,
          );
        } finally {
          liveRedaction.finalizeDrillRun({ drillBackupRoot });
        }
      } catch (e) {
        record('ERROR', 'Runner error', 'FAIL', [e.stack ?? String(e)]);
      }

      // Layer 3 pin (finalizeDrillRun scrub at la-e5-24-drill.mjs:607):
      // Verify the raw file written AFTER runStepWithRedaction was scrubbed by finalizeDrillRun.
      const lateRawAfterLayer3 = fs.readFileSync(lateRawDiagFile, 'utf8');
      assert.equal(
        lateRawAfterLayer3.includes(lateFinalToken),
        false,
        `Layer 3 finalizeDrillRun must scrub late token from raw disk file (${mode})`,
      );
      assert.ok(
        lateRawAfterLayer3.includes(`<redacted:${lateFinalToken.length}>`),
        `Layer 3 finalizeDrillRun must write <redacted:N> placeholder for late token (${mode})`,
      );

      saveText('summary.json', JSON.stringify({ results }, null, 2));

      // Verify external backup folder was cleaned up even on failure.
      assert.equal(fs.existsSync(drillBackupRoot), false, `drillBackupRoot removed on ${mode} path`);

      // Verify every written artifact/log file in artDir has 0 occurrences of knownRuntimeToken, knownPlayId, or lateFinalToken.
      const writtenFiles = walkFiles(artDir);
      assert.ok(writtenFiles.length >= 4, `Expected cmd logs and summary.json in ${artDir}`);
      for (const f of writtenFiles) {
        const content = fs.readFileSync(f, 'utf8');
        assert.equal(
          content.includes(knownRuntimeToken),
          false,
          `Runtime token must NOT appear in ${path.relative(artDir, f)} on ${mode} path`,
        );
        assert.equal(
          content.includes(knownPlayId),
          false,
          `playId capability must NOT appear in ${path.relative(artDir, f)} on ${mode} path`,
        );
        assert.equal(
          content.includes(lateFinalToken),
          false,
          `Late final token must NOT appear in ${path.relative(artDir, f)} on ${mode} path`,
        );
      }

      // Verify terminal output also has 0 occurrences of knownRuntimeToken or knownPlayId.
      const allTerminalText = terminalOutput.join('\n');
      assert.equal(allTerminalText.includes(knownRuntimeToken), false, `Runtime token not in terminal output (${mode})`);
      assert.equal(allTerminalText.includes(knownPlayId), false, `playId not in terminal output (${mode})`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test('B-LA-E5-24-02 & A-LA-E5-24-01..03: accurate --help entry point, complete secret candidates (seed.json + DB_PASS), playId redaction, URL sanitization, and staged helper hashes', async () => {
  // 1. B-LA-E5-24-02: --help prints tests/e2e/ltiaas/run-la-e5-24.mjs and never tests/host/run-la-e5-24.mjs.
  const helpText = buildRunnerHelpText();
  assert.ok(helpText.includes(RUNNER_ENTRY_POINT), 'Help text includes tests/e2e/ltiaas/run-la-e5-24.mjs');
  assert.equal(helpText.includes('tests/host/run-la-e5-24.mjs'), false, 'Help text never points to nonexistent tests/host/ path');

  const cliHelpRes = await run(process.execPath, [path.join(HERE, 'run-la-e5-24.mjs'), '--help'], {
    cwd: HERE,
    timeoutMs: 15_000,
  });
  assert.equal(cliHelpRes.code, 0, '--help exits 0');
  assert.ok(cliHelpRes.stdout.includes('tests/e2e/ltiaas/run-la-e5-24.mjs'));
  assert.equal(cliHelpRes.stdout.includes('tests/host/run-la-e5-24.mjs'), false);

  // 2. B-LA-E5-24-01 & A-LA-E5-24-03: sanitizeUrlForError and redactPlayId strip bearer capabilities.
  const rawRtUrl = 'https://content.cogniate.test:9443/rt/tok_secret_1234567890abcdef/state?foo=bar';
  const safeRtUrl = sanitizeUrlForError(rawRtUrl);
  assert.equal(safeRtUrl, 'https://content.cogniate.test:9443/rt/[REDACTED]/state');
  assert.equal(safeRtUrl.includes('tok_secret_'), false);

  const syntheticPlayId = 'ply_synthetic_selftest_token_01';
  const expectedPlayShaPrefix = crypto.createHash('sha256').update(syntheticPlayId).digest('hex').slice(0, 12);
  const rawPlayUrl = `https://app.cogniate.test:9443/play/${syntheticPlayId}`;
  const safePlayUrl = sanitizeUrlForError(rawPlayUrl);
  assert.equal(safePlayUrl, 'https://app.cogniate.test:9443/play/[REDACTED]');

  const redactedPlay = redactPlayId(syntheticPlayId);
  assert.equal(redactedPlay.playIdRedacted, 'ply_[REDACTED]');
  assert.equal(redactedPlay.playIdSha256Prefix, expectedPlayShaPrefix);

  // 3. A-LA-E5-24-02 & A-LA-E5-24-01: collectCloneSecretCandidates + stageDrillHelpers.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e5-24-selftest-secrets-'));
  fs.chmodSync(tmp, 0o700);
  try {
    fs.mkdirSync(path.join(tmp, 'infra', '.secrets'), { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(tmp, 'tests', 'acceptance', 'artifacts'), { recursive: true, mode: 0o700 });

    const dbPass = 'dbpass_secret_9876543210';
    const moodleProdToken = 'moodle_ws_prod_token_abcdef123456';
    const moodleOracleToken = 'moodle_ws_oracle_token_fedcba654321';
    const portalPass = 'portal_thanh_pass_11223344';
    const operatorKey = `ltio_${crypto.randomBytes(32).toString('base64url')}`;
    const capturedRt = `rt_captured_${crypto.randomBytes(16).toString('hex')}`;

    fs.writeFileSync(path.join(tmp, '.env'), `DB_PASS=${dbPass}\nPUBLIC_PORT=9443\n`, { mode: 0o600 });
    fs.writeFileSync(path.join(tmp, 'infra', '.secrets', 'lti-operator-key'), `${operatorKey}\n`, { mode: 0o600 });
    fs.writeFileSync(
      path.join(tmp, 'infra', '.secrets', 'seed.json'),
      JSON.stringify({
        productToken: moodleProdToken,
        oracleToken: moodleOracleToken,
        portal: { users: [{ email: 'thanh@cogniate.test', password: portalPass }] },
      }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(tmp, 'tests', 'acceptance', 'artifacts', 'captured-secrets.jsonl'),
      `${JSON.stringify({ label: 'runtime_token', value: capturedRt })}\n`,
      { mode: 0o600 },
    );

    const candidates = collectCloneSecretCandidates({ cloneDir: tmp });
    for (const expected of [dbPass, moodleProdToken, moodleOracleToken, portalPass, operatorKey, capturedRt]) {
      assert.ok(candidates.includes(expected), `Expected candidate list to include ${expected.slice(0, 12)}...`);
    }

    const staged = stageDrillHelpers({
      helperDir: HERE,
      cloneDir: tmp,
      runnerHeadSha: '4ec50888',
      runnerDirty: false,
    });
    assert.equal(staged.runnerHeadSha, '4ec50888');
    assert.ok(staged.sha256['run-la-e5-24.mjs']?.length === 64);
    assert.ok(staged.sha256['la-e5-24-drill.mjs']?.length === 64);
    assert.ok(staged.sha256['la-e5-24-container-step.mjs']?.length === 64);
    assert.ok(staged.sha256['la-e5-24-drill.selftest.mjs']?.length === 64);
    assert.equal(
      sha256File(path.join(tmp, 'tests', 'e2e', 'ltiaas', 'la-e5-24-container-step.mjs')),
      staged.sha256['la-e5-24-container-step.mjs'],
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
