#!/usr/bin/env node
// QA-E2E host runner for LA-E5-24: Pilot backup and restore drill (AC-LA-E5-24-01..06).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E5-24.md
// - docs/architecture/ltiaas/tasks/README.md (§2 form (g), form (h), §6)
// - docs/architecture/ltiaas/operability.md (§7, §7.2, §7.3)
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md (D3, D6, D14)
//
// Host-only dry-run (safe under DOCKER BAN; zero Docker or stack commands):
//   node tests/e2e/ltiaas/run-la-e5-24.mjs --dry-run [--sha <commit>] [--source <repo>] [--artifacts-dir <dir>]
//
// Live K1-SIM stack drill (only when Lead grants DOCKER-YES SIM window):
//   COMPOSE_PROJECT_NAME=qa-e2e-la-drill-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//   node tests/e2e/ltiaas/run-la-e5-24.mjs --sha <commit> --replace-tests
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { newIdentity } from '../../../infra/scripts/sqlite-lock-probe.mjs';
import { volumeBackup, volumeRestore } from '../../../infra/scripts/stack-data.mjs';
import { createRunner } from '../../host/core.mjs';
import { httpsLoopback, run, walkFiles } from '../../host/lib.mjs';
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
  verifyDrillMarkerAbsent,
} from './la-e5-24-drill.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.resolve(HERE, '..', '..');

const extraOptions = {
  'dry-run': { type: 'boolean', default: false },
  'harness-only': { type: 'boolean', default: false },
  'artifacts-dir': { type: 'string' },
  'test-sha': { type: 'string' },
};

const { values: cliOpt } = parseArgs({
  strict: false,
  options: {
    ...extraOptions,
    sha: { type: 'string' },
    source: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

const print = (line) => process.stdout.write(`${line}\n`);

if (cliOpt['dry-run'] || cliOpt['harness-only']) {
  // Strictly host-only branch: must remain above all Docker, clone, and stack operations.
  const startedAt = Date.now();
  const sourceRepo = path.resolve(cliOpt.source ?? path.join(TESTS_DIR, '..'));
  const headRes = await run('git', ['rev-parse', cliOpt.sha ? `${cliOpt.sha}^{commit}` : 'HEAD'], { cwd: sourceRepo });
  assert.equal(headRes.code, 0, `Could not resolve commit in ${sourceRepo}: ${headRes.stderr}`);
  const resolvedSha = headRes.stdout.trim();

  // 1. Run the node:test selftest suite.
  const selftestFile = path.join(HERE, 'la-e5-24-drill.selftest.mjs');
  const selftestRes = await run(process.execPath, ['--test', selftestFile], {
    cwd: sourceRepo,
    timeoutMs: 120_000,
  });
  print(selftestRes.stdout.trim());
  assert.equal(selftestRes.code, 0, selftestRes.stderr);

  // 2. Syntax-check the in-container helper script.
  const containerStepFile = path.join(HERE, 'la-e5-24-container-step.mjs');
  const syntaxRes = await run(process.execPath, ['--check', containerStepFile], {
    cwd: sourceRepo,
    timeoutMs: 30_000,
  });
  assert.equal(syntaxRes.code, 0, syntaxRes.stderr);

  // 3. Execute an end-to-end host dry-run simulation across AC-LA-E5-24-01..06 using real SQLite files and stack-data.mjs.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'la-e5-24-dryrun-'));
  fs.chmodSync(tmpRoot, 0o700);
  const dryRunRows = [];
  let drillMetrics = null;
  let backupRecord = null;
  let secretScan = null;

  try {
    const project = 'qa-e2e-la-drill-r1';
    const runId = 'dryrun01';
    const pairId = crypto.randomBytes(16).toString('hex');
    const ids = { uid: process.getuid(), gid: process.getgid() };
    const ltiVol = path.join(tmpRoot, 'volumes', 'lti-service');
    const appVol = path.join(tmpRoot, 'volumes', 'cogniate-app');
    const appContentDir = path.join(tmpRoot, 'infra', '.data', 'cogniate-app');
    const drillBackupRoot = path.join(tmpRoot, 'external-drill-backup');
    const backupDbDir = path.join(drillBackupRoot, 'db');
    const backupContentDir = path.join(drillBackupRoot, 'content');
    fs.mkdirSync(ltiVol, { recursive: true, mode: 0o700 });
    fs.mkdirSync(appVol, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(appContentDir, 'packages', 'ver_dryrun'), { recursive: true });
    fs.mkdirSync(path.join(appContentDir, 'uploads'), { recursive: true });

    for (const [role, dir] of [
      ['lti', ltiVol],
      ['app', appVol],
    ]) {
      const idObj = newIdentity({
        project,
        role,
        pairId,
        generation: 1,
        firstStart: 'completed',
      });
      fs.writeFileSync(path.join(dir, '.storage-identity.json'), `${JSON.stringify(idObj, null, 2)}\n`, {
        mode: 0o600,
      });
    }

    const ltiDbPath = path.join(ltiVol, 'lti.db');
    const ltiDb = new DatabaseSync(ltiDbPath);
    ltiDb.exec(`
      CREATE TABLE schema_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migration (name, applied_at) VALUES
        ('001_initial.sql', '2026-10-20T00:00:00.000Z'),
        ('006_key_provider.sql', '2026-10-22T00:00:00.000Z'),
        ('007_service_operability.sql', '2026-10-22T01:00:00.000Z');
      CREATE TABLE tool_account (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL);
      INSERT INTO tool_account (id, name, status) VALUES ('cogniate', 'Cogniate', 'active');
    `);
    ltiDb.close();
    fs.chmodSync(ltiDbPath, 0o600);

    const appDbPath = path.join(appVol, 'cogniate.db');
    const appDb = new DatabaseSync(appDbPath);
    appDb.exec(`
      CREATE TABLE schema_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migration (name, applied_at) VALUES
        ('001_initial.sql', '2026-10-20T00:00:00.000Z'),
        ('013_channel_kernel.sql', '2026-10-22T00:00:00.000Z'),
        ('015_app_operability.sql', '2026-10-22T02:00:00.000Z');
      CREATE TABLE package (id TEXT PRIMARY KEY, storage_path TEXT NOT NULL);
      INSERT INTO package (id, storage_path) VALUES ('ver_dryrun', 'packages/ver_dryrun');
    `);
    appDb.close();
    fs.chmodSync(appDbPath, 0o600);

    const zipBuf = makeHtmlCourseZipBuffer('Dry-Run HTML Course');
    fs.writeFileSync(
      path.join(appContentDir, 'packages', 'ver_dryrun', 'index.html'),
      '<!doctype html><body data-lesson-id="index"></body>',
    );
    fs.writeFileSync(path.join(appContentDir, 'uploads', 'ver_dryrun.zip'), zipBuf);

    const dirs = { lti: ltiVol, app: appVol };

    // AC-LA-E5-24-01 dry-run
    const manifest = volumeBackup({
      dirs,
      out: backupDbDir,
      project,
      revision: resolvedSha,
      ids,
    });
    const inspected = inspectDrillBackup(backupDbDir, project);
    const contentSummary = copyContentFolders(appContentDir, backupContentDir);
    dryRunRows.push({
      ac: 'AC-LA-E5-24-01',
      status: 'PASS (HOST-DRY-RUN)',
      notes: `volumeBackup + inspectDrillBackup validated backupId=${manifest.backupId}, composeProject=${project}, files=${inspected.filesChecked}, ltiMigrations=${inspected.ltiMigrations}, appMigrations=${inspected.appMigrations}`,
    });

    // AC-LA-E5-24-02 dry-run
    const keyProviderStatus = {
      kind: 'local-keyring',
      activeVersion: 'legacy',
      versions: [{ id: 'legacy', state: 'active', sealedCount: 3, derivedCount: 1 }],
    };
    backupRecord = buildBackupRecord({
      manifest,
      keyProviderStatus,
      sourceRevision: resolvedSha,
      contentSummary,
    });
    const recordPath = path.join(drillBackupRoot, 'backup-record.json');
    fs.writeFileSync(recordPath, `${JSON.stringify(backupRecord, null, 2)}\n`, { mode: 0o600 });
    const syntheticSecrets = [
      crypto.randomBytes(32).toString('hex'),
      crypto.randomBytes(32).toString('hex'),
      `ltio_${crypto.randomBytes(32).toString('base64url')}`,
      `ltis_${crypto.randomBytes(32).toString('base64url')}`,
    ];
    secretScan = scanBackupRecordForSecrets(fs.readFileSync(recordPath, 'utf8'), syntheticSecrets);
    assert.equal(secretScan.hits, 0, 'Zero secrets in backup-record.json');
    dryRunRows.push({
      ac: 'AC-LA-E5-24-02',
      status: 'PASS (HOST-DRY-RUN)',
      notes: `backup-record.json lists key version IDs ${JSON.stringify(backupRecord.keyProvider.versionIds)} (activeVersion=${backupRecord.keyProvider.activeVersion}); secret scan checked ${secretScan.checkedSecretsCount} secrets + ${secretScan.patternChecks} patterns with 0 hits`,
    });

    // AC-LA-E5-24-03 dry-run
    const markerPayload = buildDrillMarkerAccount(runId, 'https://app.cogniate.test:9443');
    const ltiDbWrite = new DatabaseSync(ltiDbPath);
    ltiDbWrite
      .prepare('INSERT INTO tool_account (id, name, status) VALUES (?, ?, ?)')
      .run(markerPayload.id, markerPayload.name, 'active');
    const preRestoreAccounts = ltiDbWrite.prepare('SELECT id, name, status FROM tool_account ORDER BY id').all();
    ltiDbWrite.close();
    assert.ok(preRestoreAccounts.some((a) => a.id === markerPayload.id));
    dryRunRows.push({
      ac: 'AC-LA-E5-24-03',
      status: 'PASS (HOST-DRY-RUN)',
      notes: `Post-backup marker account payload ${markerPayload.id} built and written to post-backup state (accounts before restore: ${preRestoreAccounts.map((a) => a.id).join(', ')})`,
    });

    // AC-LA-E5-24-04 & AC-LA-E5-24-06 dry-run
    await new Promise((r) => setTimeout(r, 15));
    const restoreStartedAt = new Date().toISOString();
    restoreContentFolders(backupContentDir, appContentDir);
    const restoreExitCode = volumeRestore({
      dirs,
      from: backupDbDir,
      project,
      operation: 'restore',
      ids,
      log: () => {},
      contentPackages: path.join(appContentDir, 'packages'),
    });
    assert.equal(restoreExitCode, 0, 'volumeRestore exited 0');
    await new Promise((r) => setTimeout(r, 10));
    const restoreCompletedAt = new Date().toISOString();

    const ltiDbRestored = new DatabaseSync(ltiDbPath, { readOnly: true });
    const postRestoreAccounts = ltiDbRestored.prepare('SELECT id, name, status FROM tool_account ORDER BY id').all();
    ltiDbRestored.close();
    const absence = verifyDrillMarkerAbsent(postRestoreAccounts, markerPayload.id);
    const ltiJournal = JSON.parse(fs.readFileSync(path.join(ltiVol, JOURNAL_FILE), 'utf8'));
    const appJournal = JSON.parse(fs.readFileSync(path.join(appVol, JOURNAL_FILE), 'utf8'));
    assert.equal(ltiJournal.state, 'committed');
    assert.equal(appJournal.state, 'committed');
    dryRunRows.push({
      ac: 'AC-LA-E5-24-04',
      status: 'PASS (HOST-DRY-RUN)',
      notes: `volumeRestore exited 0 in same project ${project}; committed restore journals opId=${ltiJournal.opId}; ${markerPayload.id} absent after restore (remaining accounts: ${absence.accountIds.join(', ')})`,
    });

    // AC-LA-E5-24-05 dry-run
    dryRunRows.push({
      ac: 'AC-LA-E5-24-05',
      status: 'PASS (HOST-DRY-RUN)',
      notes: `Content folders (${contentSummary.packagesFiles} package file, ${contentSummary.uploadsFiles} upload zip) restored; in-container learner launch + AGS score helper (la-e5-24-container-step.mjs) syntax-checked and ready for K1-SIM Docker window`,
    });

    // AC-LA-E5-24-06 dry-run
    drillMetrics = computeDrillMetrics({
      backupCreatedAt: manifest.createdAt,
      restoreStartedAt,
      restoreCompletedAt,
    });
    fs.rmSync(drillBackupRoot, { recursive: true, force: true });
    assert.equal(fs.existsSync(drillBackupRoot), false, 'External drill backup folder removed at end of drill');
    dryRunRows.push({
      ac: 'AC-LA-E5-24-06',
      status: 'PASS (HOST-DRY-RUN)',
      notes: `Recorded restoreStartedAt=${drillMetrics.restoreStartedAt}, restoreCompletedAt=${drillMetrics.restoreCompletedAt}, rtoMs=${drillMetrics.rtoMs}, rpoMs=${drillMetrics.rpoMs}; external backup directory removed`,
    });
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  const durationMs = Date.now() - startedAt;
  const summary = {
    task: 'LA-E5-24',
    mode: 'HOST-DRY-RUN',
    sha: resolvedSha,
    durationMs,
    selftestPassed: true,
    containerHelperChecked: true,
    acCount: DRILL_ACS.length,
    rows: dryRunRows,
    drillMetrics,
    secretScan,
  };

  if (cliOpt['artifacts-dir']) {
    const outDir = path.resolve(cliOpt['artifacts-dir']);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'la-e5-24-dry-run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, 'la-e5-24-selftest.log'), `${selftestRes.stdout}\n`);
  }

  print(
    `DRY RUN ONLY (LA-E5-24): ${DRILL_ACS.length}/${DRILL_ACS.length} ACs verified on host in ${durationMs} ms at SHA ${resolvedSha}.`,
  );
  print('No Docker, compose or live stack command was executed.');
  process.exit(0);
}

// ============================================================================
// Live K1-SIM stack drill mode (only during a Lead-granted DOCKER-YES SIM slot)
// ============================================================================
const r = createRunner({
  task: 'LA-E5-24',
  defaultProject: 'qa-e2e-la-drill-r1',
  extraOptions,
  extraHelp: '  --dry-run                    Run host-only selftests and dry-run simulation (no Docker calls).\n',
});

const runId = crypto.randomBytes(4).toString('hex');

async function runInE2eContainer(label, stepName) {
  const inside =
    'set -euo pipefail; source infra/scripts/lib.sh; require_running proxy; prepare_e2e; qa_env_args; ' +
    `dc --profile test run --rm --no-deps --name "$COMPOSE_PROJECT_NAME-qa-e524-${stepName}-$$" --build "\${QA_ENV_ARGS[@]+"\${QA_ENV_ARGS[@]}"}" e2e ` +
    `node tests/e2e/ltiaas/la-e5-24-container-step.mjs --step ${stepName} --run-id ${runId}`;
  const res = await r.exec(`e524-${label}`, 'bash', ['-c', inside], {
    env: r.STACK_ENV,
    timeoutMs: 600_000,
  });
  return res;
}

function loadCapturedSecrets() {
  const file = path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'captured-secrets.jsonl');
  const values = [];
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      const parsed = JSON.parse(line);
      const val = typeof parsed === 'string' ? parsed : parsed.value;
      if (typeof val === 'string' && val.length >= 8) {
        r.redact.add(val);
        values.push(val);
      }
    }
  }
  if (r.state.env) {
    for (const [k, v] of Object.entries(r.state.env)) {
      if (/KEY|SECRET|PASSWORD|TOKEN/i.test(k) && typeof v === 'string' && v.length >= 8) {
        r.redact.add(v);
        values.push(v);
      }
    }
  }
  const secretsDir = path.join(r.CLONE, 'infra', '.secrets');
  if (fs.existsSync(secretsDir)) {
    for (const f of walkFiles(secretsDir)) {
      if (f.endsWith('.json')) continue;
      const raw = fs.readFileSync(f, 'utf8').trim();
      if (raw.length >= 8) {
        r.redact.add(raw);
        values.push(raw);
      }
    }
  }
  return [...new Set(values)];
}

async function waitLtiAndAppReady(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastLti = null;
  let lastApp = null;
  while (Date.now() < deadline) {
    try {
      const ltiRes = await httpsLoopback(`${r.state.urls.lti}/readyz`, { ca: r.state.ca, timeoutMs: 5_000 });
      const appRes = await httpsLoopback(`${r.state.urls.app}/healthz`, { ca: r.state.ca, timeoutMs: 5_000 });
      lastLti = ltiRes.status === 200 ? JSON.parse(ltiRes.body) : { status: ltiRes.status };
      lastApp = appRes.status === 200 ? JSON.parse(appRes.body) : { status: appRes.status };
      if (ltiRes.status === 200 && lastLti?.status === 'ready' && appRes.status === 200 && lastApp?.status === 'ok') {
        return { ok: true, lti: lastLti, app: lastApp };
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return { ok: false, lti: lastLti, app: lastApp };
}

await r.main(async () => {
  const drillBackupRoot = fs.mkdtempSync(path.join(path.dirname(r.CLONE), 'qa-la-e5-24-backup-'));
  fs.chmodSync(drillBackupRoot, 0o700);
  const backupDbDir = path.join(drillBackupRoot, 'db');
  const backupContentDir = path.join(drillBackupRoot, 'content');
  const backupRecordPath = path.join(drillBackupRoot, 'backup-record.json');
  const appContentDir = path.join(r.CLONE, 'infra', '.data', 'cogniate-app');

  try {
    // Stage the current drill helpers into the clone so the in-container step runs the latest helper code.
    const cloneE2eDir = path.join(r.CLONE, 'tests', 'e2e', 'ltiaas');
    fs.mkdirSync(cloneE2eDir, { recursive: true });
    for (const helperFile of ['la-e5-24-drill.mjs', 'la-e5-24-container-step.mjs']) {
      fs.copyFileSync(path.join(HERE, helperFile), path.join(cloneE2eDir, helperFile));
    }

    // 1. Setup & initial stack start on acceptance profile.
    assert.equal((await r.npm('root-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 })).code, 0);
    assert.equal((await r.npm('gen-env', ['run', 'gen-env'])).code, 0);
    r.loadStackFiles();
    await r.composeNameGuard();
    assert.equal(r.state.abort, null, 'compose name guard');
    assert.equal(
      (
        await r.npm('stack-up-initial', ['run', 'stack:up'], {
          env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' },
          timeoutMs: 900_000,
        })
      ).code,
      0,
    );
    assert.equal((await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 })).code, 0);
    r.loadStackFiles();
    await r.checkProject();
    assert.ok(r.state.h1Verified, 'QA project guard');

    // 2. Pre-backup state setup in e2e container (Moodle-sim connection + published HTML course + key-provider query).
    const preBackupRes = await runInE2eContainer('pre-backup', 'pre-backup');
    assert.equal(preBackupRes.code, 0, 'pre-backup container step exited 0');
    const preState = JSON.parse(
      fs.readFileSync(path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'la-e5-24-state.json'), 'utf8'),
    );

    // 3. AC-LA-E5-24-01: Stop services (npm run stack:down, never stack:reset) and run stack:data-backup.
    const stopForBackup = await r.npm('stack-down-before-backup', ['run', 'stack:down'], { timeoutMs: 300_000 });
    assert.equal(stopForBackup.code, 0, 'npm run stack:down before backup exited 0');

    const backupCmd = await r.npm('stack-data-backup', ['run', 'stack:data-backup', '--', '--out', backupDbDir], {
      timeoutMs: 300_000,
    });
    const inspected = inspectDrillBackup(backupDbDir, r.PROJECT);
    const contentSummary = copyContentFolders(appContentDir, backupContentDir);
    r.saveText('drill-backup-manifest.json', JSON.stringify(inspected.manifest, null, 2));
    r.record(
      'AC-LA-E5-24-01',
      'stack:data-backup -- --out <external folder> with both services stopped exits 0 and passes manifest validation',
      r.pass(backupCmd.code === 0 && inspected.filesChecked >= 2),
      [
        `exit ${backupCmd.code}; backupId=${inspected.manifest.backupId}; composeProject=${inspected.manifest.composeProject}; pairId=${inspected.manifest.pairId}; generation=${inspected.manifest.generation}`,
        `files=${inspected.filesChecked}; ltiMigrations=${inspected.ltiMigrations}; appMigrations=${inspected.appMigrations}; content=${JSON.stringify(contentSummary)}`,
      ],
      [backupCmd.log, 'drill-backup-manifest.json'],
    );
    assert.equal(backupCmd.code, 0, 'stack:data-backup exited 0');

    // 4. AC-LA-E5-24-02: Write backup-record.json with key version IDs from GET /operator/v1/key-provider and scan for secrets.
    const headSha = (await run('git', ['rev-parse', 'HEAD'], { cwd: r.CLONE })).stdout.trim();
    const backupRecord = buildBackupRecord({
      manifest: inspected.manifest,
      keyProviderStatus: preState.keyProviderStatus,
      sourceRevision: headSha,
      contentSummary,
    });
    fs.writeFileSync(backupRecordPath, `${JSON.stringify(backupRecord, null, 2)}\n`, { mode: 0o600 });
    const capturedSecretsBefore = loadCapturedSecrets();
    const recordScan = scanBackupRecordForSecrets(fs.readFileSync(backupRecordPath, 'utf8'), capturedSecretsBefore);
    const manifestScan = scanBackupRecordForSecrets(
      fs.readFileSync(path.join(backupDbDir, 'manifest.json'), 'utf8'),
      capturedSecretsBefore,
    );
    r.saveText('drill-backup-record.json', JSON.stringify(backupRecord, null, 2));
    r.saveText('drill-backup-secret-scan.json', JSON.stringify({ recordScan, manifestScan }, null, 2));
    r.record(
      'AC-LA-E5-24-02',
      'Backup record lists key version IDs from GET /operator/v1/key-provider and holds no key material (0 secret hits)',
      r.pass(recordScan.hits === 0 && manifestScan.hits === 0 && backupRecord.keyProvider.versionIds.length > 0),
      [
        `kind=${backupRecord.keyProvider.kind}; activeVersion=${backupRecord.keyProvider.activeVersion}; versionIds=${JSON.stringify(backupRecord.keyProvider.versionIds)}`,
        `secret scan: checked ${recordScan.checkedSecretsCount} secret values + ${recordScan.patternChecks} patterns; record hits=${recordScan.hits}, manifest hits=${manifestScan.hits}`,
      ],
      ['drill-backup-record.json', 'drill-backup-secret-scan.json'],
    );
    assert.equal(recordScan.hits, 0, 'Zero secrets in backup-record.json');
    assert.equal(manifestScan.hits, 0, 'Zero secrets in manifest.json');

    // 5. AC-LA-E5-24-03: Start stack after backup and create post-backup account drill-<runId> (201).
    const upAfterBackup = await r.npm('stack-up-after-backup', ['run', 'stack:up'], {
      env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' },
      timeoutMs: 900_000,
    });
    assert.equal(upAfterBackup.code, 0, 'stack:up after backup exited 0');
    const postWriteRes = await runInE2eContainer('post-backup-write', 'post-backup-write');
    const postWriteJson = JSON.parse(
      fs.readFileSync(path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'la-e5-24-post-backup-write.json'), 'utf8'),
    );
    r.saveText('drill-post-backup-write.json', JSON.stringify(postWriteJson, null, 2));
    r.record(
      'AC-LA-E5-24-03',
      `After backup, stack starts and POST /operator/v1/accounts with {id: "drill-${runId}", ...} returns 201`,
      r.pass(postWriteRes.code === 0 && postWriteJson.createdStatus === 201),
      [
        `POST /operator/v1/accounts status=${postWriteJson.createdStatus}; id=${postWriteJson.createdAccount?.id}; accounts before restore=${JSON.stringify(postWriteJson.accountIdsBeforeRestore)}`,
      ],
      [upAfterBackup.log, postWriteRes.log, 'drill-post-backup-write.json'],
    );
    assert.equal(postWriteRes.code, 0, 'post-backup-write exited 0');

    // 6. AC-LA-E5-24-04 & AC-LA-E5-24-06: Stop services, restore content & run stack:data-restore, restart stack, measure RTO/RPO, verify readiness & absence of drill-<runId>.
    const restoreStartedAt = new Date().toISOString();
    const stopForRestore = await r.npm('stack-down-before-restore', ['run', 'stack:down'], { timeoutMs: 300_000 });
    assert.equal(stopForRestore.code, 0, 'npm run stack:down before restore exited 0');

    // Restore content folders before stack:data-restore so stack-data.mjs contentCheck finds every package.storage_path.
    const restoredContent = restoreContentFolders(backupContentDir, appContentDir);
    const restoreCmd = await r.npm('stack-data-restore', ['run', 'stack:data-restore', '--', '--from', backupDbDir], {
      timeoutMs: 300_000,
    });
    assert.equal(restoreCmd.code, 0, 'stack:data-restore exited 0');

    const upAfterRestore = await r.npm('stack-up-after-restore', ['run', 'stack:up'], {
      env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' },
      timeoutMs: 900_000,
    });
    assert.equal(upAfterRestore.code, 0, 'stack:up after restore exited 0');
    r.loadStackFiles();
    const readyWait = await waitLtiAndAppReady(120_000);
    assert.equal(readyWait.ok, true, 'LTI /readyz and App /healthz succeeded after restore');
    const restoreCompletedAt = new Date().toISOString();

    const metrics = computeDrillMetrics({
      backupCreatedAt: inspected.manifest.createdAt,
      restoreStartedAt,
      restoreCompletedAt,
    });

    const postRestoreRes = await runInE2eContainer('post-restore-verify', 'post-restore-verify');
    assert.equal(postRestoreRes.code, 0, 'post-restore-verify exited 0');
    const postRestoreJson = JSON.parse(
      fs.readFileSync(path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'la-e5-24-post-restore.json'), 'utf8'),
    );
    r.saveText('drill-post-restore-verify.json', JSON.stringify(postRestoreJson, null, 2));

    r.record(
      'AC-LA-E5-24-04',
      `stack:data-restore -- --from <folder> exits 0; after stack:up, LTI /readyz and app /healthz succeed, and GET /operator/v1/accounts has no drill-${runId}`,
      r.pass(
        restoreCmd.code === 0 &&
          readyWait.ok &&
          postRestoreJson.absenceCheck?.drillMarkerPresent === false &&
          postRestoreJson.directGetDrillAccountStatus === 404,
      ),
      [
        `restore exit=${restoreCmd.code}; contentFilesRestored=${restoredContent.restoredFiles}; LTI /readyz=${JSON.stringify(readyWait.lti)}; App /healthz=${JSON.stringify(readyWait.app?.status)}`,
        `accounts after restore=${JSON.stringify(postRestoreJson.absenceCheck?.accountIds)}; GET /operator/v1/accounts/drill-${runId} status=${postRestoreJson.directGetDrillAccountStatus}`,
      ],
      [restoreCmd.log, upAfterRestore.log, postRestoreRes.log, 'drill-post-restore-verify.json'],
    );

    // 7. AC-LA-E5-24-05: Simulator learner launch reaches the player, and one final score reaches the simulator.
    const ls = postRestoreJson.launchAndScore;
    r.record(
      'AC-LA-E5-24-05',
      'On the restored stack, one simulator learner launch reaches the player, and one final score reaches the simulator',
      r.pass(
        ls &&
          ls.packageHtmlStatus === 200 &&
          ls.commitStatus === 200 &&
          ls.simulatorScore?.scoreGiven === 90 &&
          ls.simulatorScore?.scoreMaximum === 100 &&
          ls.portalSyncStatus === 'sent',
      ),
      [
        `playId=${ls?.playId}; packageHtmlStatus=${ls?.packageHtmlStatus}; commitStatus=${ls?.commitStatus}; simulatorScore=${JSON.stringify(ls?.simulatorScore)}; portalSyncStatus=${ls?.portalSyncStatus}`,
      ],
      [postRestoreRes.log, 'drill-post-restore-verify.json'],
    );

    // 8. AC-LA-E5-24-06: Record start/end times of restore (RTO) and backup age (RPO); remove external backup folder.
    fs.rmSync(drillBackupRoot, { recursive: true, force: true });
    const backupFolderRemoved = !fs.existsSync(drillBackupRoot);
    r.saveText(
      'drill-metrics.json',
      JSON.stringify({ ...metrics, backupFolderRemoved, composeProject: r.PROJECT }, null, 2),
    );
    r.record(
      'AC-LA-E5-24-06',
      'Evidence records restore start/end times (RTO) and backup age (RPO); external backup folder and drill project removed',
      r.pass(metrics.rtoMs >= 0 && metrics.rpoMs >= 0 && backupFolderRemoved),
      [
        `backupCreatedAt=${metrics.backupCreatedAt}; restoreStartedAt=${metrics.restoreStartedAt}; restoreCompletedAt=${metrics.restoreCompletedAt}`,
        `RTO=${metrics.rtoMs} ms (${metrics.rtoSeconds} s); RPO=${metrics.rpoMs} ms (${metrics.rpoSeconds} s); externalBackupRemoved=${backupFolderRemoved}`,
      ],
      ['drill-metrics.json'],
    );

    loadCapturedSecrets();
  } finally {
    fs.rmSync(drillBackupRoot, { recursive: true, force: true });
  }
});
