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

// ---------------------------------------------------------------- storage repair (triage revision 4 §7.4 SD-1): migration scan points

import { CompatRoute, OLD_SHAS } from './storage-compat-route.mjs';
import { StorageFail } from './storage-docker.mjs';
import { PhaseAbort } from './storage-private-scan.mjs';
import { migrationRun, scanAt, snapshotMigrationRun } from './m1-migration.mjs';
import { SNAPSHOT_OLD_SHA } from './m1-phases.mjs';

const MSHA = '0123456789abcdef0123456789abcdef01234567', MIMAGE = 'sha256:' + 'c'.repeat(64), MP = 'qa-multi-r1';
/**
 * A mocked migration lane: fake runner, fake Docker CLI on PATH (for allContainers), fake fixture answers, a product
 * backup with 0600 files. The CompatRoute steps that need git or a real old build are replaced in the test only.
 */
async function mockMigration(t, { phase = 'migration', manifestMode = 0o600, copyHook = null, probe = null, shell = null, afterBackup = null, backupId = null } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-mock-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clone = path.join(root, `${MP}-${MSHA.slice(0, 8)}-2026-10-21T13-00-00-000Z`);
  fs.mkdirSync(path.join(clone, 'infra/compat'), { recursive: true }); fs.mkdirSync(path.join(clone, '.tmp'));
  fs.writeFileSync(path.join(clone, 'infra/compat/storage-compat.sha256'), ['storage-compat.knobs.json', 'sqlite-lock-probe.mjs', 'storage-compat.sh', 'storage-oplock.sh'].map((n) => `${'a'.repeat(64)}  infra/x/${n}`).join('\n'));
  const bin = path.join(root, 'fake-bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'docker'), `#!${process.execPath}
const a = process.argv.slice(2);
if (a[0] === 'ps') { console.log('id-lti\\nid-app'); process.exit(0); }
if (a[0] === 'inspect') { console.log(JSON.stringify(['lti-service', 'cogniate-app'].map((s, i) => ({ Id: ['id-lti', 'id-app'][i], Name: '/' + s, Config: { Labels: { 'com.docker.compose.project': ${JSON.stringify(MP)}, 'com.docker.compose.service': s } }, State: { Running: false } })))); process.exit(0); }
process.exit(97);
`, { mode: 0o700 });
  const PATH = process.env.PATH; process.env.PATH = bin + path.delimiter + PATH; t.after(() => { process.env.PATH = PATH; });
  const old = phase === 'migration' ? OLD_SHAS[0] : SNAPSHOT_OLD_SHA;
  const ledger = phase === 'migration'
    ? { 'lti-service/lti.db': ['001_init.sql'], 'cogniate-app/cogniate.db': ['001_init.sql', '010_score_delivery_confirmation.sql'] }
    : { 'lti-service/lti.db': ['001_init.sql'], 'cogniate-app/cogniate.db': ['001_init.sql', '011_lms_types.sql'] };
  const bytes = { lti: Buffer.from('lti database bytes'), app: Buffer.from('app database bytes') };
  const file = (b) => ({ present: true, size: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') });
  const state = { restored: null, upgraded: false };
  const fileset = () => {
    const journal = (vol) => (state.restored ? { present: true, sha256: 'j', json: { operation: 'restore', opId: 'd'.repeat(32), backupId: state.restored.backupId, manifestSha256: 'e'.repeat(64), state: 'committed',
      after: [{ name: vol === 'lti' ? 'lti-service/lti.db' : 'cogniate-app/cogniate.db', ...file(bytes[vol]) }].map(({ name, size, sha256 }) => ({ name, size, sha256 })) } } : { present: false });
    return { op: 'fileset', lti: { state: 'present', files: { 'lti.db': file(bytes.lti), 'lti.db-wal': { present: false }, 'lti.db-shm': { present: false }, '.storage-identity.json': { present: true, size: 1, sha256: 'i' } }, journal: journal('lti') },
      app: { state: 'present', files: { 'cogniate.db': file(bytes.app), 'cogniate.db-wal': { present: false }, 'cogniate.db-shm': { present: false }, '.storage-identity.json': { present: true, size: 1, sha256: 'k' } }, journal: journal('app') } };
  };
  const answer = (args) => {
    const op = args[args.indexOf(MIMAGE) + 4];
    if (op === 'logical') return { op, lti: { schemaMigration: ledger['lti-service/lti.db'] }, app: { schemaMigration: state.upgraded ? [...ledger['cogniate-app/cogniate.db'], '012_connection_provider_snapshot.sql'].sort() : ledger['cogniate-app/cogniate.db'] } };
    if (op === 'fileset') return fileset();
    if (op === 'plant') return { op, results: [] };
    throw new Error('mock fixture op ' + op);
  };
  const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', durationMs: 0 });
  const backupTo = (out) => {
    fs.mkdirSync(out, { mode: 0o700 });
    for (const [sub, name, b] of [['lti-service', 'lti.db', bytes.lti], ['cogniate-app', 'cogniate.db', bytes.app]]) { fs.mkdirSync(path.join(out, sub), { mode: 0o700 }); fs.writeFileSync(path.join(out, sub, name), b, { mode: 0o600 }); }
    const manifest = { formatVersion: 1, backupId: backupId ?? crypto.randomUUID(), composeProject: MP, source: 'volume', pairId: 'p'.repeat(32), generation: 0,
      files: [['lti-service/lti.db', bytes.lti], ['cogniate-app/cogniate.db', bytes.app]].map(([name, b]) => ({ name, size: b.length, sha256: file(b).sha256 })), migrations: ledger };
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest), { mode: 0o600 }); fs.chmodSync(path.join(out, 'manifest.json'), manifestMode);
  };
  const r = { opt: { sha: MSHA }, PROJECT: MP, CLONE: clone, ART: path.join(root, 'art'), STACK_ENV: {}, state: { h1Verified: true, urls: { app: 'https://a', lti: 'https://l' } },
    redact: { add: () => {} }, saveText: () => {}, record: () => {}, waitHealth: async () => ({ ok: true }),
    docker: async (args) => (args[0] === 'image' ? ok(MIMAGE + '\n') : args[0] === 'volume' ? ok(JSON.stringify([{ Name: args[2], Labels: { 'com.docker.compose.project': MP, 'com.docker.compose.volume': args[2].split('_').at(-1) } }])) : ok('')),
    exec: async (name, cmd, args) => {
      if (cmd === 'git' && args[0] === 'rev-parse') return ok(OLD_SHAS[0] + '\n');
      if (cmd === 'git' && args[0] === 'ls-tree') return ok('services/cogniate-app/src/domain/migrations/011_lms_types.sql\n');
      if (cmd === 'git' || (cmd === 'docker' && args[0] === 'compose')) return ok();
      const all = cmd === 'bash' ? args.slice(4) : args;
      return ok(JSON.stringify(answer(all)) + '\n');
    },
    npm: async (name, args) => {
      if (name === 'storage-compat-enable') fs.writeFileSync(path.join(clone, '.tmp/compose.knobs.yaml'), 'x-cogniate-storage-compat: {}\n');
      if (name === 'storage-compat-disable') fs.rmSync(path.join(clone, '.tmp/compose.knobs.yaml'), { force: true });
      if (name === 'data-backup' || name === 'snapshot-backup') { backupTo(args[args.indexOf('--out') + 1]); afterBackup?.(args[args.indexOf('--out') + 1]); }
      if (name === 'restore-valid') state.restored = JSON.parse(fs.readFileSync(path.join(args[args.indexOf('--from') + 1], 'manifest.json'), 'utf8'));
      if (name === 'snapshot-start-012') state.upgraded = true;
      return { code: ['backup-refuses-running'].includes(name) || name.startsWith('restore-refuses-') ? 1 : 0, stdout: '', stderr: '', durationMs: 0 };
    } };
  // The route steps that need git or a real old build (§12) are replaced for this mock only.
  const saved = { ...Object.fromEntries(['treeRule', 'compatHashes', 'oldStart', 'configDiff'].map((k) => [k, CompatRoute.prototype[k]])) };
  t.after(() => Object.assign(CompatRoute.prototype, saved));
  Object.assign(CompatRoute.prototype, {
    async treeRule() { this.current.treeRule = { ok: true }; return this.current.treeRule; },
    compatHashes() { return { ok: true }; },
    async oldStart(label, command) { this.current.starts.push({ label, command: command.join(' '), throughWrapper: true, exit: 0, preflightPass: true, statusPass: true, lockHeld: true }); return ok(); },
    async configDiff(profiles) {
      return saved.configDiff.call(this, profiles, {
        shell: shell ?? (async (script, o) => { fs.writeFileSync(o.env.QA_ARGS_FILE, ['compose', '-f', '.tmp/compose.knobs.yaml', 'config', ''].join('\0')); fs.writeFileSync(o.env.QA_ENV_FILE, 'A=1\0'); return ok(); }),
        docker: async () => ok('{}') });
    },
  });
  const scans = [];
  const run = phase === 'migration'
    ? migrationRun(r, { installTests: async () => {}, setup: async () => true, probe: probe ?? (async () => {}), identity: { productSha: MSHA, testSha: 'f'.repeat(40) }, scans, copyHook })
    : snapshotMigrationRun(r, { installTests: async () => {}, setup: async () => true, probe: probe ?? (async (stage) => [{ id: stage === 'snapshot-seed' ? 'M1-38.common.h1' : 'M1-38.common.h2', status: 'PASS' }]),
      identity: { productSha: MSHA, testSha: 'f'.repeat(40) }, scans });
  return { run, scans, root };
}

test('HARNESS ONLY: SD-1 the migration phase scans after the private backup, after each damage copy, at each configDiff removal and at its end', async (t) => {
  const { run, scans, root } = await mockMigration(t);
  const evidence = await run;
  assert.equal(evidence.find((e) => e.id === 'M1-41.common.j-migration').status, 'PASS');
  assert.deepEqual(scans.map((s) => s.point), ['scratch removal compat-config', 'scratch removal compat-config', 'migration after the private backup',
    ...['bytes', 'missing', 'backup-id', 'project'].map((d) => `migration after the damage copy ${d}`),
    'scratch removal compat-config', 'scratch removal compat-config', 'migration phase end']);
  assert.ok(scans.every((s) => !s.failed), JSON.stringify(scans.filter((s) => s.failed)));
  const backupRoot = fs.readdirSync(root).find((n) => /^qa-m1-private-backup-[A-Za-z0-9]{6}$/.test(n));
  for (const d of ['bytes', 'missing', 'backup-id', 'project']) for (const f of ['manifest.json', 'lti-service', 'cogniate-app']) {
    const p = path.join(root, backupRoot, d, f);
    if (fs.existsSync(p)) assert.equal(fs.lstatSync(p).mode & 0o7777, f === 'manifest.json' ? 0o600 : 0o700, `Site #13 ${d}/${f}`);
  }
});

test('HARNESS ONLY: SD-1 a 0644 product file in the migration root FAILs the phase at its scan point; the correction keeps the inode', async (t) => {
  const { run, scans, root } = await mockMigration(t, { manifestMode: 0o644 });
  await assert.rejects(run, (e) => e instanceof StorageFail && /^scan at migration after the private backup: scan hit: qa-m1-private-backup-[A-Za-z0-9]{6}\/original\/manifest\.json \(file 0644\)$/.test(e.message));
  const rec = scans.at(-1);
  assert.deepEqual([rec.point, rec.failed, rec.corrections.length], ['migration after the private backup', true, 1]);
  const backupRoot = fs.readdirSync(root).find((n) => /^qa-m1-private-backup-/.test(n));
  assert.equal(fs.lstatSync(path.join(root, backupRoot, 'original/manifest.json')).mode & 0o7777, 0o600, 'Corrected in place, never deleted');
});

test('HARNESS ONLY: SD-1 the snapshot-upgrade phase scans at each configDiff removal, after the snapshot backup and at its end', async (t) => {
  const { run, scans } = await mockMigration(t, { phase: 'snapshot-upgrade' });
  await run;
  assert.deepEqual(scans.map((s) => s.point), ['scratch removal compat-config', 'scratch removal compat-config', 'snapshot-upgrade after the snapshot backup', 'snapshot-upgrade phase end']);
  assert.ok(scans.every((s) => !s.failed));
});

test('HARNESS ONLY: scanAt: a hit FAILs, a refused correction stops the phase, a clean point returns its record', () => {
  const lane = (record) => ({ scanPoint: (point) => ({ point, problems: [], hits: [], corrections: [], refusals: [], failed: false, ...record }) });
  assert.equal(scanAt(lane({}), 'p').point, 'p');
  assert.throws(() => scanAt(lane({ failed: true, hits: [{ area: 'out', path: 'x.db', type: 'file', mode: '0644' }] }), 'p'), (e) => e instanceof StorageFail && !(e instanceof PhaseAbort));
  assert.throws(() => scanAt(lane({ failed: true, hits: [{ area: 'out', path: 'x', type: 'file', mode: '0644' }], refusals: [{ area: 'out', path: 'x', reason: 'link' }] }), 'p'), PhaseAbort);
});

// ---------------------------------------------------------------- Round 2 (A-SH-05 #13, A-SH-02, A-SH-01)

/** O-1 to O-4 of the Round 2 site controls (the same check as storage-private-copy.selftest.mjs). Returns the problems. */
function createdProblems(records, files) {
  const problems = [];
  if (records.length !== files.length) problems.push(`${records.length} creation records for ${files.length} files`);
  for (const file of files) {
    const st = fs.lstatSync(file), mine = records.filter((h) => h.target === file), name = path.basename(file);
    if (mine.length !== 1) { problems.push(`${mine.length ? 'more than one' : 'missing'} creation observation: ${name}`); continue; }
    const [h] = mine;
    if (h.regular !== true || h.mode !== '0600' || h.size !== 0) problems.push(`not an empty 0600 regular file at creation: ${name} (${h.mode}, ${h.size} bytes)`);
    if (h.dev !== st.dev || h.ino !== st.ino) problems.push(`the created inode is not the final file: ${name}`);
    if ((st.mode & 0o7777) !== 0o600) problems.push(`final mode ${(st.mode & 0o7777).toString(8)}: ${name}`);
  }
  return problems;
}
/** Every entry below `dir` (links not followed): path, type, mode, size, SHA-256 and the metadata that a chmod changes. */
function entries(dir) {
  const out = [];
  const walk = (d, rel) => {
    for (const n of fs.readdirSync(d).sort()) {
      const f = path.join(d, n), r = rel ? `${rel}/${n}` : n, st = fs.lstatSync(f);
      const type = st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : 'file';
      out.push({ path: r, type, mode: (st.mode & 0o7777).toString(8).padStart(4, '0'), size: type === 'file' ? st.size : null,
        sha256: type === 'file' ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null, ino: st.ino, ctimeMs: st.ctimeMs });
      if (type === 'dir') walk(f, r);
    }
  };
  walk(dir, '');
  return out;
}
const backupRootOf = (root, phase = 'migration') => path.join(root, fs.readdirSync(root).find((n) => (phase === 'migration' ? /^qa-m1-private-backup-[A-Za-z0-9]{6}$/ : /^qa-m1-snapshot-private-[A-Za-z0-9]{6}$/).test(n)));
const NOFOLLOW_READ = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW;
/** The §7.5 step 4 race: right after the first no-follow open of a matching file, it moves to `outsideDir` and a link takes its path. */
function raceOn(t, match, outsideDir) {
  const orig = fs.openSync, raced = [];
  fs.openSync = function (p, flags, ...rest) {
    const fd = orig.call(fs, p, flags, ...rest);
    if (typeof p === 'string' && flags === NOFOLLOW_READ && match(p) && !raced.some((r) => r.path === p)) {
      const to = path.join(outsideDir, `${raced.length}-${path.basename(p)}`); fs.renameSync(p, to); fs.symlinkSync(to, p); raced.push({ path: p, to });
    }
    return fd;
  };
  const off = () => { fs.openSync = orig; };
  t.after(off);
  return { raced, off };
}
const outsideFolder = (t) => { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m1-r2-outside-'))); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const plant644 = (file) => { fs.writeFileSync(file, 'qa planted', { mode: 0o600, flag: 'wx' }); fs.chmodSync(file, 0o644); return file; };
const MIGRATION_POINTS = ['scratch removal compat-config', 'scratch removal compat-config', 'migration after the private backup',
  ...['bytes', 'missing', 'backup-id', 'project'].map((d) => `migration after the damage copy ${d}`), 'scratch removal compat-config', 'scratch removal compat-config', 'migration phase end'];

for (const mask of [0o022, 0o000]) {
  test(`HARNESS ONLY: R2-05-13 site #13: each file of the four damage copies is an empty 0600 regular file at creation (umask ${mask.toString(8).padStart(3, '0')})`, async (t) => {
    const seen = [], old = process.umask(mask);
    try {
      assert.equal(process.umask(mask), mask, 'umask pinned');
      const { run, root } = await mockMigration(t, { copyHook: (h) => { const m = process.umask(0o077); process.umask(m); seen.push({ ...h, umask: m }); } });
      await run;
      const backupRoot = backupRootOf(root), want = entries(path.join(backupRoot, 'original')).filter((e) => e.type === 'file').length;
      for (const d of ['bytes', 'missing', 'backup-id', 'project']) {
        const dir = path.join(backupRoot, d), mine = seen.filter((h) => h.target.startsWith(dir + path.sep));
        assert.equal(mine.length, want, `${d}: one creation record for each file of the backup`);
        const files = entries(dir).filter((e) => e.type === 'file').map((e) => path.join(dir, e.path));
        assert.deepEqual(createdProblems(mine.filter((h) => fs.existsSync(h.target)), files), [], d);
        assert.ok(mine.every((h) => h.umask === mask), `${d}: created under the pinned umask`);
        for (const e of entries(dir)) if (e.type === 'dir') assert.equal(e.mode, '0700', `${d}/${e.path}`);
      }
    } finally { process.umask(old); }
  });
}

test('HARNESS ONLY: R2-05-N site #13 unhooked, replayed inputs: the migration evidence, scan points and damage copies; the record for the cross-version check', async (t) => {
  // Replayed input bytes (Lead msg_c42ad04cf575): a fixed backupId, so no byte of the record depends on the run; nothing is normalized.
  const { run, scans, root } = await mockMigration(t, { backupId: '00000000-0000-4000-8000-000000000013' });
  const evidence = await run;
  const backupRoot = backupRootOf(root);
  const copies = Object.fromEntries(['original', 'bytes', 'missing', 'backup-id', 'project'].map((d) => [d, entries(path.join(backupRoot, d)).map(({ ino, ctimeMs, ...e }) => e)]));
  const record = { evidence: evidence.map(({ id, status, notes }) => ({ id, status, notes })), points: scans.map((s) => ({ point: s.point, failed: s.failed })), copies };
  assert.deepEqual(record.points.map((p) => p.point), MIGRATION_POINTS);
  for (const d of ['bytes', 'missing', 'backup-id', 'project']) for (const e of copies[d]) assert.equal(e.mode, e.type === 'dir' ? '0700' : '0600', `${d}/${e.path}`);
  if (process.env.QA_R2_NEUTRAL_OUT) fs.writeFileSync(path.join(process.env.QA_R2_NEUTRAL_OUT, 'site-13.json'), JSON.stringify(record, null, 1), { mode: 0o600, flag: 'wx' });
});

test('HARNESS ONLY: R2-01-03 migration entry: a backup root that becomes a link is not walked; the phase FAILs at its scan point; T is unchanged', async (t) => {
  let T = null, before = null;
  const { run, scans } = await mockMigration(t, { manifestMode: 0o644, afterBackup: (out) => {
    const backupRoot = path.dirname(out); T = backupRoot + '-T'; fs.renameSync(backupRoot, T); fs.symlinkSync(T, backupRoot); before = entries(T);
  } });
  await assert.rejects(run, (e) => e instanceof StorageFail && !(e instanceof PhaseAbort) && /^scan at migration after the private backup: qa-m1-private-backup-[A-Za-z0-9]{6}: not scanned: \. \(symlink\)$/.test(e.message));
  assert.deepEqual(entries(T), before, 'T keeps every mode, byte, inode and ctime');
  const rec = scans.at(-1);
  assert.deepEqual([rec.point, rec.hits, rec.corrections, rec.refusals], ['migration after the private backup', [], [], []]);
});

/** R2-02-06: a refused correction at one migration or snapshot scan point. */
async function refusalAt(t, { phase = 'migration', match, ...opts }) {
  const race = raceOn(t, match, outsideFolder(t));
  const m = await mockMigration(t, { phase, ...opts });
  let error = null;
  try { await m.run; } catch (e) { error = e; }
  race.off();
  return { ...m, error, race };
}
const refusedText = (p, area) => `scan at ${p}: scan hit: ${area} (file 0644); correction refused: ${area}: cannot open without a link follow (ELOOP)`;

// One mock per test: mockMigration replaces PATH and the CompatRoute methods until the test ends.
const REFUSAL_CASES = [
  { point: 'migration after the private backup', file: 'original/manifest.json', opts: { manifestMode: 0o644 } },
  { point: 'migration after the damage copy bytes', file: 'bytes/r2.db', opts: { copyHook: (h) => { if (!h.target.includes('/bytes/')) return; const f = path.join(h.target.split('/bytes/')[0], 'bytes/r2.db'); if (!fs.existsSync(f)) plant644(f); } } },
  { point: 'migration phase end', file: 'r2-end.db', opts: { probe: async (stage, sha, { route } = {}) => { if (stage === 'rollback') plant644(path.join(backupRootOf(path.dirname(route.r.CLONE)), 'r2-end.db')); } } },
  { point: 'snapshot-upgrade after the snapshot backup', file: 'original/manifest.json', phase: 'snapshot-upgrade', opts: { manifestMode: 0o644 } },
];
for (const c of REFUSAL_CASES) {
  test(`HARNESS ONLY: R2-02-06 a refused correction at "${c.point}" stops the phase; the record is published`, async (t) => {
    const { error, scans, root, race } = await refusalAt(t, { phase: c.phase, match: (p) => p.endsWith('/' + c.file), ...c.opts });
    const area = `${path.basename(backupRootOf(root, c.phase ?? 'migration'))}/${c.file}`;
    assert.ok(error instanceof PhaseAbort, `${c.point}: ${error?.message}`);
    assert.equal(error.message, refusedText(c.point, area));
    const rec = scans.at(-1);
    assert.deepEqual([rec.point, rec.refusals.length, rec.corrections.length], [c.point, 1, 0], 'The refused correction is published');
    const all = c.phase ? ['scratch removal compat-config', 'scratch removal compat-config', 'snapshot-upgrade after the snapshot backup', 'snapshot-upgrade phase end'] : MIGRATION_POINTS;
    assert.deepEqual(scans.map((s) => s.point), all.slice(0, all.indexOf(c.point) + 1), 'The scan points up to the stop');
    assert.equal(fs.lstatSync(race.raced[0].to).mode & 0o7777, 0o644, 'The moved file is unchanged');
  });
}

test('HARNESS ONLY: R2-02-06 a configDiff body error with a refused scratch correction: the body error stays first; the record is published', async (t) => {
  const { error, scans } = await refusalAt(t, { match: (p) => /\/scratch\/compat-config-[0-9a-f]{16}\/r2\.db$/.test(p),
    shell: async (script, o) => { fs.writeFileSync(o.env.QA_ARGS_FILE, 'x'); plant644(path.join(path.dirname(o.env.QA_ARGS_FILE), 'r2.db')); return { code: 1, stdout: '', stderr: 'injected', durationMs: 0 }; } });
  assert.ok(error instanceof StorageFail && !(error instanceof PhaseAbort), error?.message);
  assert.equal(error.message, 'The old dc() arguments were captured', 'The body error stays the first cause');
  assert.deepEqual(scans.map((s) => [s.point, s.refusals.length]), [['scratch removal compat-config', 1]], 'The refused correction is published');
});
