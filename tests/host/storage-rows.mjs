// AC-M1-41 rows of the `storage` phase (ADR-012 revision 3.3 §13; tasks/M1.md AC-M1-41). Written from
// the accepted criteria only. Each row uses product commands as the system under test and QA's own
// listings, hashes and parsing as its oracle. Rows j-migration and j-snapshot are in storage-compat-route.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { m1HostControl } from './m1-control.mjs';
import { fixtureAnswer } from './storage-lane.mjs';
import { StorageBlocked, StorageFail, createdNotBefore, hex16, laneVolumeName } from './storage-docker.mjs';
import {
  LegacyFixtures, assertPair, assertRefuses, check, dbFileSets, fileSetsEqual, freshVolume, groupMembers, hashFolder,
  legacyEmpty, legacySets, linesOf, listingDiff, lockPairs, logicalShows, manifestDbSets, manifestFiles, namesCode,
  pairsDisjoint, pidStart, pgidOf, preflightOf, readManifest, recordHash, sameIdentities, spawnGroup, until, writeRecordFolder,
} from './storage-oracle.mjs';
import { CONDITIONAL_ID, storageId } from './storage-inventory.mjs';

const DRILL_POINTS = ['prepared-lti', 'prepared', 'staged', 'swap-lti-mid', 'swapped-lti', 'swap-app-mid', 'swapped',
  'identity-lti', 'identity-app', 'rollback-mid', 'committed-lti'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The fixed order of the storage phase. "@" steps are fixtures, not rows. Constraints from the contract:
 * a-first-start-resume before any e-* legacy copy; g-quarantine-in-use before g-quarantine on the g-tamper state;
 * h-target-state (2) after g-quarantine and before g-fresh-target; h-pair-mismatch after g-fresh-target;
 * e-old-schema in the last block, after QA's stack:reset (the restore half of e-content-missing reuses its end state).
 */
export const SEQUENCE = [
  '@prepare', 'c-selftest', 'c-host-negative',
  'a-fresh', '@seed', 'a-second-start', 'a-restart', 'd-clean', 'a-restart-refusal', 'b-oracle-lti', 'b-oracle-app',
  'a-lock-reentry', 'a-lock-wait', 'a-lock-stale', 'a-serialize', 'a-lock-scope', 'i-enable-refusal', 'i-candidate-guard',
  'd-stale', 'd-unknown', 'd-symlink', 'd-owner', 'd-mountpoint', 'd-content-folder',
  'f-pairid', 'f-identity-missing', 'f-db-without-identity', 'f-project', 'f-half-pair', 'f-originals-back',
  'a-first-start-resume', '@seed', 'e-not-same-import',
  '@backup-B', 'h-volume-manifest', 'g-damaged', 'h-nomanifest',
  ...DRILL_POINTS.map((p) => 'g-' + p), 'h-open-journal', 'g-recover-idempotent',
  '@post-B', 'g-orphan-refusal', 'g-orphan-complete', '@post-B', 'g-orphan-stopped',
  '@post-B', 'g-tamper', 'g-quarantine-in-use', 'g-quarantine',
  '@legacy-place', 'h-legacy-manifest', 'h-target-state', 'e-fresh-refusal', 'e-hot-journal', 'e-old-layout', 'g-fresh-target',
  '@legacy-remove', 'h-pair-mismatch',
  '@legacy-import-lane', 'e-import-recover', 'e-import', 'e-kept', 'e-provenance-restore', 'e-changed-byte', 'e-added-wal',
  'e-import-nonfresh', 'h-old-manifest',
  'b-sequence',
  '@old-schema-setup', 'e-old-schema', 'e-content-missing',
];
/** Steps a row needs; a failed or blocked need makes the row not run (FAIL or BLOCKED with the reason). */
export const NEEDS = {
  'c-selftest': ['@prepare'], 'c-host-negative': ['@prepare'], 'a-fresh': ['@prepare'],
  '@seed': ['a-fresh'],
  ...Object.fromEntries(['a-second-start', 'a-restart', 'a-restart-refusal', 'b-oracle-lti', 'b-oracle-app', 'a-lock-reentry',
    'a-lock-wait', 'a-lock-stale', 'a-serialize', 'a-lock-scope', 'i-enable-refusal', 'i-candidate-guard', 'd-stale', 'd-unknown',
    'd-symlink', 'd-owner', 'd-mountpoint', 'd-content-folder', 'f-pairid', 'f-identity-missing', 'f-db-without-identity',
    'f-project', 'f-half-pair', 'a-first-start-resume'].map((id) => [id, ['a-fresh', '@seed']])),
  'd-clean': ['a-fresh', 'a-second-start', 'a-restart'],
  'f-originals-back': ['f-pairid', 'f-identity-missing', 'f-db-without-identity', 'f-project', 'f-half-pair'],
  'e-not-same-import': ['a-first-start-resume', '@seed'],
  '@backup-B': ['a-first-start-resume', '@seed'],
  ...Object.fromEntries(['h-volume-manifest', 'g-damaged', 'h-nomanifest', ...DRILL_POINTS.map((p) => 'g-' + p), '@post-B']
    .map((id) => [id, ['@backup-B']])),
  'h-open-journal': ['g-staged'], 'g-recover-idempotent': DRILL_POINTS.map((p) => 'g-' + p),
  'g-orphan-refusal': ['@post-B'], 'g-orphan-complete': ['g-orphan-refusal'], 'g-orphan-stopped': ['@post-B'],
  'g-tamper': ['@post-B'], 'g-quarantine-in-use': ['g-tamper'], 'g-quarantine': ['g-tamper'],
  '@legacy-place': ['g-quarantine'], 'h-legacy-manifest': ['@legacy-place'], 'h-target-state': ['g-staged', '@legacy-place'],
  'e-fresh-refusal': ['h-target-state'], 'e-hot-journal': ['@legacy-place'], 'e-old-layout': ['@legacy-place'],
  'g-fresh-target': ['h-target-state'], '@legacy-remove': ['@legacy-place'], 'h-pair-mismatch': ['g-fresh-target', '@legacy-remove'],
  '@legacy-import-lane': ['h-pair-mismatch'],
  ...Object.fromEntries(['e-import-recover', 'e-import', 'e-kept', 'e-provenance-restore', 'e-changed-byte', 'e-added-wal',
    'e-import-nonfresh', 'h-old-manifest'].map((id) => [id, ['@legacy-import-lane']])),
  'e-import': ['e-import-recover'], 'e-kept': ['e-import'], 'e-provenance-restore': ['e-kept'],
  'b-sequence': ['a-fresh'], '@old-schema-setup': ['@prepare'], 'e-old-schema': ['@old-schema-setup'],
  'e-content-missing': ['@old-schema-setup', 'e-old-schema'],
};

/** Runs the storage phase rows in SEQUENCE order and returns one result per storage-phase row. */
export async function storagePhase(lane, { identity, handoff, setupClone }) {
  const results = new Map(), steps = new Map(), acc = {};
  const add = (id, note) => { (acc[id] ??= []).push(note); };
  const r = lane.r;
  const ctx = { lane, r, identity, handoff, setupClone, add, acc, state: {} };
  const rows = defineRows(ctx);
  for (const step of SEQUENCE) {
    const needs = NEEDS[step] ?? [];
    const missing = needs.filter((n) => steps.get(n) !== 'PASS');
    let status, notes = [];
    if (missing.length) {
      const blocked = missing.some((n) => steps.get(n) === 'BLOCKED');
      status = blocked ? 'BLOCKED' : 'FAIL';
      notes = [`not run: prerequisite ${missing.join(', ')} did not pass`];
    } else {
      const started = Date.now();
      try {
        const out = await (rows[step] ?? (() => { throw new StorageFail('No procedure for ' + step); }))();
        status = out?.status ?? 'PASS'; notes = [...(acc[step] ?? []), ...(out?.notes ?? [])];
        if (out?.oracle) ctx.state['oracle:' + step] = out.oracle;
      } catch (e) {
        status = e instanceof StorageBlocked ? 'BLOCKED' : 'FAIL';
        notes = [...(acc[step] ?? []), e.message];
      }
      notes.push(`duration ${Math.round((Date.now() - started) / 1000)} s`);
    }
    steps.set(step, status);
    if (!step.startsWith('@')) {
      const id = storageId(step);
      const row = { id, status, environment: 'SIM', ...identity, notes };
      if (id === CONDITIONAL_ID && ctx.state['oracle:' + step]) row.oracle = ctx.state['oracle:' + step];
      results.set(id, row);
      r.record(id, `AC-M1-41 ${step}`, status === 'NOT_APPLICABLE' ? 'INFO' : status === 'BLOCKED' ? 'FAIL' : status,
        status === 'BLOCKED' ? ['BLOCKED', ...notes] : notes);
    } else r.record('STORAGE' + step.replace('@', '-').toUpperCase(), `Storage fixture ${step}`, status === 'PASS' ? 'PASS' : 'FAIL', notes);
    lane.r.saveText(`storage/steps/${String([...steps.keys()].length).padStart(3, '0')}-${step.replace('@', 'fixture-')}.json`,
      JSON.stringify({ step, status, notes }, null, 2));
  }
  return [...results.values()];
}

function defineRows(ctx) {
  const { lane, r, add, state } = ctx;
  const product = (...a) => lane.product(...a);
  const expectExit = (res, code, what) => check(res.code === code, `${what}: expected exit ${code}, got ${res.code}`);
  const up = async (label = 'stack-up') => {
    const res = await product(label, ['stack:up']); expectExit(res, 0, 'stack:up');
    lane.loadStack(); await lane.waitHealthy(); return res;
  };
  const noProbeScratch = async (label) => {
    const l = await lane.listing();
    const left = ['lti', 'app'].flatMap((v) => l[v].entries.filter((e) => /^\.lock-probe-/.test(e.path)).map((e) => `${v}:${e.path}`));
    check(left.length === 0, `${label}: probe scratch remains: ${left.join(', ')}`);
    add('d-clean', `${label}: no .lock-probe-* entry in either volume`);
  };
  const refusal = async (label, args, code, { env } = {}) => {
    const before = await lane.snapshot();
    const res = await product(label, args, { env });
    assertRefuses(res, code, label);
    await lane.assertUnchanged(before, label);
    return res;
  };
  const stopped = async () => { if (!(await lane.services()).every((s) => !s.running)) await lane.stopServices(); };
  const quarantine = async (label) => {
    await stopped();
    const out = lane.newFolder(lane.quarantine, label);
    const res = await product(label, ['stack:data-quarantine', '--', '--out', out]); expectExit(res, 0, 'stack:data-quarantine');
    const p = await lane.presence();
    check(p.ltidb.state === 'absent' && p.appdb.state === 'absent', 'Both lane volumes are gone after quarantine');
    return { out, res };
  };
  const preflightRunId = (res) => { const pf = preflightOf(res); check(pf.summary?.result === 'pass', 'Preflight summary pass'); return pf.summary.runId; };
  /** The exact-name check, the legacy precondition when stack:up follows, the product setup, and QA's own check. */
  const firstStartSetup = async ({ legacyPrecondition }) => {
    if (legacyPrecondition) {
      const sets = legacySets(lane.clone);
      if (!legacyEmpty(sets)) throw new StorageBlocked('Legacy entries present; QA moves or deletes nothing (B-S-23): ' + JSON.stringify(sets));
    }
    const p = await lane.presence();
    for (const k of ['ltidb', 'appdb']) check(p[k].state !== 'unsafe', `Lane volume ${p[k].name} is unsafe`);
    if (p.ltidb.state !== 'absent' || p.appdb.state !== 'absent') {
      const l = await lane.listing();
      check(freshVolume('lti', l.lti) && freshVolume('app', l.app), 'The setup needs absent or FRESH volumes');
    }
    const runId = hex16();
    const inner = `source infra/scripts/lib.sh && dc --profile storage run --rm --name ${lane.project}-storage-${runId} `
      + `--label org.cogniate.storage.run=${runId} storage-preflight check --prepare --run-id ${runId} --project ${lane.project} `
      + '--folder lti=/check/lti-service --folder app=/check/cogniate-app';
    const res = await lane.bash('first-start-setup', [lane.oplock, 'run', '--', 'bash', '-c', inner]);
    expectExit(res, 0, 'product first-start setup');
    // Independent setup check (§11 item 3); the setup's own output is not the oracle.
    const after = await lane.presence();
    for (const k of ['ltidb', 'appdb']) check(after[k].state === 'labeled', `Setup made ${after[k].name} with this project's labels`);
    const l = await lane.listing();
    const own = (v, rel) => l[v].entries.find((e) => e.path === rel);
    const okDir = (e) => e && e.type === 'dir' && e.uid === lane.hostUid && e.gid === lane.hostGid && e.mode === '0700';
    check(okDir(own('lti', '.')) && okDir(own('app', '.')), 'Both roots HOST_UID:HOST_GID 0700');
    check(okDir(own('app', 'packages')) && okDir(own('app', 'uploads')), 'Both mountpoints HOST_UID:HOST_GID 0700');
    check(l.app.entries.filter((e) => e.path.startsWith('packages/') || e.path.startsWith('uploads/')).length === 0, 'Mountpoints empty');
    const st = await lane.state();
    const pairId = assertPair(st.ids, { kind: 'fresh', generation: 0, firstStart: 'pending', composeProject: lane.project });
    for (const v of ['lti', 'app']) {
      const files = st.fileset[v].files, db = v === 'lti' ? 'lti.db' : 'cogniate.db';
      check(!files[db].present && !files[db + '-wal'].present && !files[db + '-shm'].present, `No database in ${v}`);
      check(!st.fileset[v].journal.present, `No journal in ${v}`);
    }
    return { pairId, runId, res };
  };
  /** The write after B, with QA's logical proof that the pair has it and B does not. */
  const postB = async (tag) => {
    if (!(await lane.services()).some((s) => s.running)) await up(`stack-up-before-${tag}`);
    const markers = await lane.writeMarkers(tag);
    await lane.stopServices(`stop-after-${tag}`);
    const now = await lane.logical(markers);
    check(logicalShows(now, { present: markers }), 'In-place pair has the post-B rows');
    const inB = await lane.backupLogical(state.B, markers);
    check(logicalShows(inB, { absent: markers }), 'Backup B does not have the post-B rows');
    state.postB = markers;
    state.before = await lane.state();
    return markers;
  };
  const equalsBefore = async (before) => {
    const now = await lane.state();
    check(fileSetsEqual(now.sets, before.sets), 'The file sets equal the state before');
    check(sameIdentities(now.ids, before.ids), 'The identities equal those before');
    check(logicalShows(await lane.logical(state.postB), { present: state.postB }), 'Logical read shows the post-B rows');
    const l = await lane.listing();
    for (const v of ['lti', 'app']) {
      check(!l[v].entries.some((e) => /^\.restore-/.test(e.path)), `No .restore-* in ${v}`);
      const prev = l[v].entries.filter((e) => /^\.previous-[0-9a-f]{32}$/.test(e.path));
      for (const p of prev) check(l[v].entries.some((e) => e.path.startsWith(p.path + '/')), `No empty ${p.path} in ${v}`);
    }
    return now;
  };
  const equalsB = async ({ generationBase, expectKind = 'restore' }) => {
    const now = await lane.state();
    check(fileSetsEqual(dbFileSets(now.sets), manifestDbSets(state.manifestB)), 'The database file sets equal B (no unlisted sidecar)');
    const markers = state.postB ?? [];
    const read = await lane.logical([...state.bMarkers, ...markers]);
    check(logicalShows(read, { present: state.bMarkers, absent: markers }), "Logical read shows B's rows without the post-B rows");
    assertPair(now.ids, { generation: generationBase + 1, kind: expectKind });
    if (state.bBackupId) check(now.ids.lti.provenance.backupId === state.bBackupId && now.ids.app.provenance.backupId === state.bBackupId, "B's backupId");
    return now;
  };
  const journalsAre = (st, value) => ['lti', 'app'].every((v) => st.fileset[v].journal?.json?.state === value);
  const drillEnv = (extra = {}) => ({ STORAGE_DRILL: '1', ...extra });
  const recover = (label = 'recover') => product(label, ['stack:data-restore', '--', '--recover']);
  const stopCheck = (res, point) => {
    expectExit(res, 3, `--stop-after ${point}`);
    const stop = [...linesOf(res, 'storage_drill_stop'), ...lane.allLogLines().filter((l) => l.event === 'storage_drill_stop')];
    check(stop.some((l) => l.point === point), `storage_drill_stop logged with point ${point}`);
  };

  const rows = {
    // ------------------------------------------------------------ fixtures
    async '@prepare'() {
      await lane.boot();
      await ctx.setupClone();       // frozen tests, npm ci, gen-env, compose name guard (no stack start)
      const self = await lane.bash('storage-oplock-selftest', [lane.oplock, 'selftest'], { timeoutMs: 120_000 });
      const lines = self.lines.filter((l) => l.event === 'storage_lock_selftest');
      lane.r.saveText('storage/lock-selftest.json', JSON.stringify(lines, null, 2));
      // Harness self-check of §13: the storage phase is BLOCKED when the lock self-check fails.
      if (self.code !== 0 || lines.length === 0 || !lines.every((l) => l.ok === true && l.psCommand === 'LC_ALL=C ps -A -o pid= -o pgid='))
        throw new StorageBlocked('storage-oplock.sh selftest did not pass with every scenario ok');
      lane.r.record('HARNESS-LOCK-SELFTEST', 'storage-oplock.sh selftest: every scenario ok (harness self-check, not a row)', 'PASS',
        [lines.map((l) => `${l.scenario}: ${l.observed}`).join('; ')]);
    },
    async '@seed'() {
      const res = await lane.r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }); expectExit(res, 0, 'seed');
      lane.loadStack(); await lane.r.checkProject(); check(lane.r.state.h1Verified, 'H1 project guard');
    },

    // ------------------------------------------------------------ (c) negatives
    async 'c-selftest'() {
      const folder = `/tmp/qa-selftest-${hex16()}`;
      const res = await lane.container({ kind: 'storage-probe', probeFile: path.join(lane.clone, 'infra/scripts/sqlite-lock-probe.mjs'),
        command: ['node', '/probe/sqlite-lock-probe.mjs', 'selftest', '--run-id', hex16(), '--folder', `self=${folder}`] });
      expectExit(res, 0, 'probe selftest');
      const lines = res.stdout.split('\n').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } }).filter((l) => l.event === 'storage_selftest');
      const want = { normal: 'pass', 'no-hold': 'lock_not_enforced', 'holder-dies': 'probe_error' };
      check(lines.length === 3, 'Three storage_selftest lines');
      for (const [scenario, expected] of Object.entries(want)) {
        const l = lines.find((x) => x.scenario === scenario);
        check(l && l.ok === true && l.expected === expected && l.observed === expected, `selftest ${scenario} → ${expected}`);
      }
    },
    async 'c-host-negative'() {
      const dir = path.join(lane.clone, '.tmp', `qa-host-negative-${hex16()}`);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      check(fs.readdirSync(dir).length === 0, 'Scratch bind folder is empty');
      try {
        const o = await lane.container({ kind: 'storage-oracle', hostNegativeDir: dir,
          command: ['node', '--no-warnings', `/qa/bin/storage-fixture-script.mjs`, 'oracle', '--dir', '/check/host-negative', '--spec', Buffer.from('{}').toString('base64')] });
        const oracle = fixtureAnswer(o.stdout);
        check(oracle && oracle.verdict && oracle.scratchRemoved === true, 'QA oracle ran and emptied the scratch folder');
        lane.r.saveText('storage/c-host-negative-oracle.json', JSON.stringify(oracle, null, 2));
        if (/^INCONCLUSIVE/.test(oracle.verdict)) throw new StorageFail('QA oracle inconclusive: ' + oracle.verdict);
        const probe = await lane.container({ kind: 'storage-probe', probeFile: path.join(lane.clone, 'infra/scripts/sqlite-lock-probe.mjs'),
          hostNegativeDir: dir, command: ['node', '/probe/sqlite-lock-probe.mjs', 'probe', '--run-id', hex16(), '--folder', 'host=/check/host-negative'] });
        const lines = probe.stdout.split('\n').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
        if (/^LOCK NOT ENFORCED/.test(oracle.verdict)) {
          check(probe.code === 1 && namesCode(lines, 'lock_not_enforced'), 'Fault shown: probe reports lock_not_enforced and exits 1');
          return { status: 'PASS', oracle: { verdict: oracle.verdict }, notes: ['fault shown by the QA oracle; probe lock_not_enforced'] };
        }
        return { status: 'NOT_APPLICABLE', oracle: { verdict: oracle.verdict },
          notes: [`QA oracle shows enforcement on this host; probe exit ${probe.code}; reported apart, never counted as PASS`] };
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    },

    // ------------------------------------------------------------ (a) start paths
    async 'a-fresh'() {
      const p = await lane.presence();
      check(p.ltidb.state === 'absent' && p.appdb.state === 'absent', 'Fresh lane: neither exact name exists');
      const res = await up('a-fresh-stack-up');
      const pf = preflightOf(res);
      check(pf.summary?.result === 'pass', 'Preflight summary pass');
      check(pf.lines.filter((l) => l.fsType).length >= 2 && ['lti', 'app'].every((f) => pf.lines.some((l) => l.folder === f && l.fsType)), 'Both folders record fsType');
      const services = await lane.services();
      const firstCreated = Math.min(...services.map((s) => Date.parse(s.created)));
      check(pf.summary.ts && Date.parse(pf.summary.ts) <= firstCreated, 'Preflight pass is logged before the first service container is created');
      const st = await lane.state();
      state.pairA = assertPair(st.ids, { kind: 'fresh', generation: 0, firstStart: 'completed', composeProject: lane.project });
      const l = await lane.listing();
      const okDir = (v, rel) => { const e = l[v].entries.find((x) => x.path === rel); return e && e.uid === lane.hostUid && e.gid === lane.hostGid && e.mode === '0700' && e.type === 'dir'; };
      check(okDir('lti', '.') && okDir('app', '.') && okDir('app', 'packages') && okDir('app', 'uploads'), 'Roots and mountpoints HOST_UID:HOST_GID 0700');
      for (const rel of ['infra/.data/cogniate-app', 'infra/.data/cogniate-app/packages', 'infra/.data/cogniate-app/uploads']) {
        const s = fs.lstatSync(path.join(lane.clone, rel));
        check(s.isDirectory() && (s.mode & 0o777) === 0o700 && s.uid === lane.hostUid, `${rel} mode 0700, host user`);
      }
      state.runIds = new Set([pf.summary.runId]);
      await noProbeScratch('a-fresh');
    },
    async 'a-second-start'() {
      const marker = { vol: 'lti', value: `qa-st-platform-second-${hex16()}` };
      const issuer = 'https://qa-storage.test';
      const created = await lane.lti('POST', '/api/platforms', { url: issuer, clientId: marker.value, name: marker.value,
        authenticationEndpoint: issuer + '/auth', accesstokenEndpoint: issuer + '/token', authConfig: { method: 'JWK_SET', key: issuer + '/jwks' }, deploymentIds: ['qa'] });
      check(created.status === 201, 'Platform made before the stop');
      const before = await lane.state();
      const second = await up('a-second-start-up');
      const runId = preflightRunId(second); check(!state.runIds.has(runId), 'A new runId'); state.runIds.add(runId);
      check(sameIdentities((await lane.state()).ids, before.ids), 'Identities unchanged after the second start');
      await noProbeScratch('a-second-start (running stack)');
      expectExit(await product('a-second-start-down', ['stack:down']), 0, 'stack:down');
      const third = await up('a-second-start-up-again');
      const pf = preflightOf(third); check(pf.lines.every((l) => l.state === 'OK'), 'State OK');
      state.runIds.add(preflightRunId(third));
      check(sameIdentities((await lane.state()).ids, before.ids), 'Identities unchanged after stop and start');
      const list = await lane.lti('GET', '/api/platforms');
      check(list.status === 200 && JSON.stringify(list.json).includes(marker.value), 'The platform is still listed');
      await noProbeScratch('a-second-start (after stop/start)');
    },
    async 'a-restart'() {
      const before = await lane.state();
      for (const service of ['lti-service', 'cogniate-app']) {
        const res = await product(`a-restart-${service}`, ['stack:restart', '--', service]); expectExit(res, 0, 'stack:restart ' + service);
        const runId = preflightRunId(res); check(!state.runIds.has(runId), 'A new runId'); state.runIds.add(runId);
        await lane.waitHealthy();
        check(sameIdentities((await lane.state()).ids, before.ids), 'Identities unchanged');
        await noProbeScratch('a-restart ' + service);
      }
    },
    async 'd-clean'() { check((ctx.acc['d-clean'] ?? []).length >= 5, 'Every preflight of a-fresh, a-second-start and a-restart was checked'); },
    async 'a-restart-refusal'() {
      const name = `qa-unknown-${hex16()}`;
      const lti = (await lane.services()).find((s) => s.service === 'lti-service');
      // The single §11 exception while services run: one empty entry in the ltidb root, under QA's lock.
      await lane.plant([{ op: 'write', vol: 'lti', path: name, base64: '' }], { allowWhileRunning: true });
      try {
        const res = await product('a-restart-refusal', ['stack:restart', '--', 'lti-service']);
        assertRefuses(res, 'unknown_entry', 'stack:restart');
        check(namesCode(res.lines, name) || (res.stdout + res.stderr).includes(name), 'The refusal names the file');
        const now = (await lane.services()).find((s) => s.service === 'lti-service');
        check(now.id === lti.id && now.startedAt === lti.startedAt, 'lti-service container id and StartedAt unchanged');
        check((await lane.r.healthz(lane.r.state.urls.lti)) !== null, '/healthz answers 200');
      } finally { await lane.plant([{ op: 'remove', vol: 'lti', path: name }], { allowWhileRunning: true }); }
      expectExit(await product('a-restart-after-removal', ['stack:restart', '--', 'lti-service']), 0, 'stack:restart after removal');
      await lane.waitHealthy();
    },
    async 'b-oracle-lti'() { return bOracle('lti'); },
    async 'b-oracle-app'() { return bOracle('app'); },
    async 'a-lock-reentry'() {
      const before = await lane.snapshot();
      const t0 = Date.now();
      const res = await lane.bash('a-lock-reentry', [lane.oplock, 'run', '--', 'npm', 'run', 'stack:up'], { timeoutMs: 60_000 });
      check(Date.now() - t0 < 5_000 + 15_000, 'Refusal does not wait 120 s');
      expectExit(res, 1, 'storage-oplock.sh run -- npm run stack:up');
      check(namesCode(res.lines, 'operation_lock_reentry'), 'Inner stack:up refuses operation_lock_reentry');
      const refused = res.lines.find((l) => l.event === 'storage_lock_refused' && l.reason === 'operation_lock_reentry');
      const acquired = res.lines.find((l) => l.event === 'storage_lock_acquired');
      check(refused && acquired && Date.parse(refused.ts) - Date.parse(acquired.ts) <= 5_000, 'Refused within 5 s of the wrapper acquire');
      check(!fs.existsSync(lane.lockFolder()), 'The lock folder is gone afterwards');
      await lane.assertUnchanged(before, 'a-lock-reentry');
      check((lane.r.state.ledger?.records ?? []).filter((x) => x.command === 'a-lock-reentry' && x.kind === 'container').length === 0, 'No container was created');
    },
    async 'a-lock-wait'() {
      const holder = spawnGroup('bash', [lane.oplock, 'run', '--', 'sleep', '150'], { cwd: lane.clone, env: lane.r.STACK_ENV });
      try {
        const record = await until(() => { const f = path.join(lane.lockFolder(), 'owner.json'); return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')); },
          { timeoutMs: 20_000, what: 'holder lock record' });
        const hash = recordHash(lane.lockFolder());
        const before = await lane.snapshot();
        const t0 = Date.now();
        const res = await product('a-lock-wait', ['stack:up'], { timeoutMs: 200_000 });
        const wait = res.lines.find((l) => l.event === 'storage_lock_wait' && l.owner?.runId === record.runId);
        check(wait, 'storage_lock_wait names the holder runId');
        assertRefuses(res, 'operation_in_progress', 'stack:up');
        const refused = res.lines.find((l) => l.event === 'storage_lock_refused' && l.reason === 'operation_in_progress');
        for (const key of ['command', 'runId', 'pid', 'acquiredAt']) check(refused?.owner?.[key] === record[key], `Refusal names owner ${key}`);
        const waited = (Date.parse(refused.ts) - Date.parse(wait.ts)) / 1000;
        check(waited >= 115 && waited <= 125, `The refusal comes 120 s ± 5 s after the first wait (${waited.toFixed(1)} s); command ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        await lane.assertUnchanged(before, 'a-lock-wait');
        check(recordHash(lane.lockFolder()) === hash, 'The lock record is unchanged (QA hash)');
      } finally { await holder.done; }
      check(!fs.existsSync(lane.lockFolder()), 'After the holder ends, the lock folder is gone');
      expectExit(await product('a-lock-wait-after', ['stack:up']), 0, 'stack:up after the holder');
    },
    async 'a-lock-stale'() { return lockStale(); },
    async 'a-serialize'() {
      await lane.stopServices('a-serialize-stop');
      const out = lane.newFolder(lane.backups, 'serialize');
      const backup = spawnGroup('npm', ['run', 'stack:data-backup', '--', '--out', out], { cwd: lane.clone, env: lane.r.STACK_ENV });
      await until(() => {
        if (lane.lockEvents().some((e) => e.event === 'storage_lock_acquired' && /data-backup|backup/.test(e.command ?? ''))) return true;
        const f = path.join(lane.lockFolder(), 'owner.json');
        try { return fs.existsSync(f) && /backup/.test(JSON.parse(fs.readFileSync(f, 'utf8')).command); } catch { return false; }
      }, { timeoutMs: 60_000, intervalMs: 50, what: 'backup storage_lock_acquired' });
      const start = await product('a-serialize-up', ['stack:up'], { timeoutMs: 900_000 });
      const b = await backup.done;
      check(b.code === 0, 'Backup exits 0');
      check(fs.existsSync(path.join(out, 'manifest.json')) && !fs.existsSync(path.join(out, 'INCOMPLETE')), 'Manifest and no INCOMPLETE file');
      const released = lane.lockEvents().filter((e) => e.event === 'storage_lock_released' && /backup/.test(e.command ?? '')).at(-1);
      check(released, 'Backup storage_lock_released logged');
      for (const s of (await lane.services()).filter((x) => ['lti-service', 'cogniate-app'].includes(x.service)))
        check(Date.parse(s.startedAt) >= Date.parse(released.ts), `${s.service} started after the backup released the lock`);
      expectExit(start, 0, 'stack:up after the backup');
      await lane.waitHealthy();
    },
    async 'a-lock-scope'() {
      const report = path.join(lane.clone, 'tests/acceptance/artifacts/m1-vitest-results.json');
      const controlDir = path.join(lane.clone, 'tests/acceptance/artifacts/control');
      fs.rmSync(report, { force: true }); // A stale report must never satisfy this row.
      const earlier = new Set(fs.existsSync(controlDir) ? fs.readdirSync(controlDir) : []);
      const stop = m1HostControl(lane.r);
      const before = lane.lockEvents().length;
      let res;
      try {
        res = await lane.r.npm('a-lock-scope-suite', ['run', 'test:acceptance'], { env: { ...lane.r.STACK_ENV, QA_TASK: 'M1',
          QA_M1_MIGRATION_STAGE: 'storage-lock-scope', QA_GREP: '\\{case:M1-41\\.common\\.a-lock-scope\\}',
          QA_PRODUCT_SHA: ctx.identity.productSha, QA_TEST_SHA: ctx.identity.testSha }, timeoutMs: 1_800_000 });
      } finally { await stop(); }
      expectExit(res, 0, 'test:acceptance with the QA storage case');
      check(fs.existsSync(report), 'The suite wrote its report');
      const tests = JSON.parse(fs.readFileSync(report, 'utf8')).testResults.flatMap((f) => f.assertionResults);
      const t = tests.filter((x) => /\{case:M1-41\.common\.a-lock-scope\}/.test(x.fullName));
      check(t.length === 1 && t[0].status === 'passed', 'The QA storage case passed');
      const actions = fs.readdirSync(controlDir).filter((n) => /^out-m1-.*\.raw\.json$/.test(n) && !earlier.has(n))
        .map((n) => JSON.parse(fs.readFileSync(path.join(controlDir, n), 'utf8')));
      check(actions.length >= 1 && actions.every((a) => a.code === 0 && !/operation_in_progress/.test(a.stdout + a.stderr)), 'Host-control stack:restart exit 0, no operation_in_progress');
      const events = lane.lockEvents().slice(before);
      const pairs = lockPairs(events);
      check(pairs.length >= 3 && pairs.every((p) => p.acquired && p.released), 'Acquire and release pairs for the internal starts and the restart');
      check(pairs.some((p) => /restart/.test(p.command ?? '')), 'The restart took its own lock');
      check(pairsDisjoint(pairs), 'No two lock pairs overlap in time');
      const h = await lane.r.healthz(lane.r.state.urls.lti);
      check(h?.profile === 'default', 'The suite ends in the default profile');
    },
    async 'i-enable-refusal'() {
      const knobs = path.join(lane.clone, '.tmp/compose.knobs.yaml');
      const set = await product('i-enable-knobs', ['stack:restart', '--', 'lti-service', '--env', 'STACK_PROFILE=default', '--env', 'LTI_PROVIDER_SIMULATION=off']);
      expectExit(set, 0, 'stack:restart --env (test knobs)');
      check(fs.existsSync(knobs), 'Test knobs file exists');
      const hash = hashFolder(path.dirname(knobs))['compose.knobs.yaml'];
      const res = await product('i-enable-refusal', ['stack:storage-compat', '--', 'enable']);
      expectExit(res, 1, 'stack:storage-compat -- enable with test knobs');
      check(JSON.stringify(hashFolder(path.dirname(knobs))['compose.knobs.yaml']) === JSON.stringify(hash), 'Knobs file unchanged');
      check(!fs.existsSync(path.join(lane.clone, '.tmp/storage-compat')), '.tmp/storage-compat/ is not made');
      expectExit(await product('i-enable-restore-defaults', ['stack:restart', '--', 'lti-service']), 0, 'restore defaults');
      check(!fs.existsSync(knobs), 'Defaults restored: no knobs file');
      await lane.waitHealthy();
    },
    async 'i-candidate-guard'() {
      expectExit(await product('i-guard-enable', ['stack:storage-compat', '--', 'enable']), 0, 'enable the override');
      const knobs = path.join(lane.clone, '.tmp/compose.knobs.yaml');
      check(fs.readFileSync(knobs, 'utf8').includes('x-cogniate-storage-compat'), 'Marker present');
      try {
        // Harness self-check of §13: the host control refuses m1-restart and m1-profile before any command.
        await hostControlRefusesWithMarker();
        for (const args of [['stack:up'], ['stack:restart', '--', 'lti-service'], ['test:acceptance'], ['e2e:reset', '--', '--yes'],
          ['demo:prepare'], ['stack:data-backup', '--', '--out', lane.newFolder(lane.backups, 'guard')]]) {
          const before = await lane.snapshot();
          const res = await product('i-guard-' + args[0], args);
          expectExit(res, 1, args.join(' '));
          check((res.stdout + res.stderr).includes('stack:storage-compat -- disable'), `${args[0]} names stack:storage-compat -- disable`);
          await lane.assertUnchanged(before, 'candidate guard ' + args[0]);
        }
      } finally { expectExit(await product('i-guard-disable', ['stack:storage-compat', '--', 'disable']), 0, 'disable the override'); }
      check(!fs.existsSync(knobs), 'Override disabled');
    },

    // ------------------------------------------------------------ (d) hygiene and ownership
    async 'd-stale'() {
      await stopped();
      const ids = [hex16(), hex16(), hex16(), hex16()];
      const names = ids.flatMap((id) => ['', '-wal', '-shm'].map((s) => `.lock-probe-${id}.db${s}`));
      await lane.plant(names.map((n, i) => ({ op: 'write', vol: i < 6 ? 'lti' : 'app', path: n, base64: Buffer.from('qa stale').toString('base64') })));
      await up('d-stale-up');
      await noProbeScratch('d-stale');
      await stopped();
      const near = `.lock-probe-${hex16().slice(0, 15)}.db`;
      await lane.plant([{ op: 'write', vol: 'lti', path: near, base64: '' }]);
      try { const res = await refusal('d-stale-near', ['stack:up'], 'unknown_entry'); check((res.stdout + res.stderr).includes(near), 'Names the near-match'); }
      finally { await lane.plant([{ op: 'remove', vol: 'lti', path: near }]); }
    },
    async 'd-unknown'() {
      await stopped();
      for (const op of [{ op: 'write', vol: 'lti', path: 'notes.txt', base64: '' }, { op: 'write', vol: 'lti', path: 'lti.db-journal', base64: '' },
        { op: 'copy', fromVol: 'app', from: 'cogniate.db', vol: 'lti', path: 'cogniate.db' }]) {
        await lane.plant([op]);
        try { await refusal('d-unknown-' + op.path, ['stack:up'], 'unknown_entry'); }
        finally { await lane.plant([{ op: 'remove', vol: 'lti', path: op.path }]); }
      }
    },
    async 'd-symlink'() {
      await stopped();
      const targetName = `d-symlink-target-${hex16()}`;
      fs.writeFileSync(path.join(lane.out, targetName), 'QA scratch target', { mode: 0o600 });
      const targetHash = hashFolder(lane.out)[targetName];
      const hasWal = (await lane.state()).fileset.lti.files['lti.db-wal'].present;
      const hold = `hold-d-symlink-${hex16()}`;
      if (hasWal) await lane.plant([{ op: 'stash', vol: 'lti', names: ['lti.db-wal'], hold }]);
      try {
        await lane.plant([{ op: 'symlink', vol: 'lti', path: 'lti.db-wal', target: `/qa/out/${targetName}` }]);
        const before = await lane.listing();
        await refusal('d-symlink', ['stack:up'], 'unknown_entry');
        const link = (await lane.listing()).lti.entries.find((e) => e.path === 'lti.db-wal');
        check(link?.type === 'symlink' && link.target === `/qa/out/${targetName}`, 'The link is unchanged');
        check(JSON.stringify(hashFolder(lane.out)[targetName]) === JSON.stringify(targetHash), 'Its target is unchanged');
        check(listingDiff(before, await lane.listing()).length === 0, 'Nothing else changed');
        await lane.plant([{ op: 'remove', vol: 'lti', path: 'lti.db-wal' }]);
      } finally { if (hasWal) await lane.plant([{ op: 'unstash', vol: 'lti', names: ['lti.db-wal'], hold }]); }
    },
    async 'd-owner'() {
      await stopped();
      const before = (await lane.listing()).lti.entries.find((e) => e.path === 'lti.db');
      await lane.plant([{ op: 'chown', vol: 'lti', path: 'lti.db', uid: 0, gid: 0 }], { root: true, rootReason: 'd-owner' });
      try {
        const res = await refusal('d-owner', ['stack:up'], 'owner_mismatch');
        check((res.stdout + res.stderr).includes('lti.db'), 'Names lti.db');
        const now = (await lane.listing()).lti.entries.find((e) => e.path === 'lti.db');
        check(now.uid === 0 && now.gid === 0 && now.sha256 === before.sha256, 'Owner and SHA-256 unchanged (no recursive repair)');
      } finally { await lane.plant([{ op: 'chown', vol: 'lti', path: 'lti.db', uid: lane.hostUid, gid: lane.hostGid }], { root: true, rootReason: 'd-owner' }); }
      await up('d-owner-up');
    },
    async 'd-mountpoint'() {
      await stopped();
      await lane.plant(['packages', 'uploads'].map((p) => ({ op: 'chown', vol: 'app', path: p, uid: 0, gid: 0 })), { root: true, rootReason: 'd-mountpoint' });
      const before = await lane.listing();
      await up('d-mountpoint-up');
      await stopped();
      const after = await lane.listing();
      for (const p of ['packages', 'uploads']) {
        const e = after.app.entries.find((x) => x.path === p);
        check(e.uid === lane.hostUid && e.gid === lane.hostGid && e.mode === '0700', `${p} HOST_UID:HOST_GID 0700`);
      }
      const others = listingDiff(before, after).filter((d) => !/(packages|uploads)$/.test(d) && !/(lti|cogniate)\.db(-wal|-shm)?$/.test(d));
      check(others.length === 0, 'Nothing else changed: ' + others.join('; '));
      const file = 'uploads/qa-unsafe-file';
      await lane.plant([{ op: 'write', vol: 'app', path: file, base64: Buffer.from('qa').toString('base64') }]);
      try {
        const sum = (await lane.listing()).app.entries.find((e) => e.path === file).sha256;
        await refusal('d-mountpoint-file', ['stack:up'], 'mountpoint_unsafe');
        check((await lane.listing()).app.entries.find((e) => e.path === file).sha256 === sum, 'The file is unchanged');
      } finally { await lane.plant([{ op: 'remove', vol: 'app', path: file }]); }
      await lane.plant([{ op: 'remove', vol: 'app', path: 'packages' }, { op: 'symlink', vol: 'app', path: 'packages', target: 'uploads' }]);
      try { await refusal('d-mountpoint-symlink', ['stack:up'], 'mountpoint_unsafe'); }
      finally { await lane.plant([{ op: 'remove', vol: 'app', path: 'packages' }, { op: 'mkdir', vol: 'app', path: 'packages', mode: '0700' }]); }
    },
    async 'd-content-folder'() {
      await stopped();
      const uploads = path.join(lane.clone, 'infra/.data/cogniate-app/uploads');
      const hold = path.join(lane.out, `content-hold-${hex16()}`), target = path.join(lane.out, `content-target-${hex16()}`);
      fs.mkdirSync(target, { mode: 0o700 }); fs.writeFileSync(path.join(target, 'qa.txt'), 'qa');
      fs.mkdirSync(hold, { mode: 0o700 }); fs.renameSync(uploads, path.join(hold, 'uploads'));
      fs.symlinkSync(target, uploads);
      try {
        const before = await lane.snapshot();
        const listed = lane.r.state.ledger?.records.length ?? 0;
        const res = await product('d-content-folder', ['stack:up']);
        assertRefuses(res, 'content_path_unsafe', 'stack:up');
        await lane.assertUnchanged(before, 'd-content-folder');
        check((lane.r.state.ledger?.records ?? []).slice(listed).every((x) => x.kind !== 'container'), 'No container was created (before any compose start command)');
        check(fs.lstatSync(uploads).isSymbolicLink() && fs.readlinkSync(uploads) === target, 'The link is unchanged');
        check(fs.readFileSync(path.join(target, 'qa.txt'), 'utf8') === 'qa' && fs.readdirSync(target).length === 1, 'Its target is unchanged');
      } finally { fs.unlinkSync(uploads); fs.renameSync(path.join(hold, 'uploads'), uploads); }
      const content = path.join(lane.clone, 'infra/.data/cogniate-app');
      const moved = path.join(hold, 'cogniate-app');
      check(legacyEmpty(legacySets(lane.clone)), 'No legacy file in the app folder before it is moved');
      fs.renameSync(content, moved);
      await up('d-content-folder-absent');
      for (const rel of ['', 'packages', 'uploads']) {
        const s = fs.lstatSync(path.join(content, rel));
        check(s.isDirectory() && (s.mode & 0o777) === 0o700 && s.uid === lane.hostUid, `infra/.data/cogniate-app/${rel} created with mode 0700`);
      }
    },

    // ------------------------------------------------------------ (f) identity
    async 'f-pairid'() { return identityCase('f-pairid', async () => {
      const other = hex16() + hex16();
      await lane.plant([{ op: 'editjson', vol: 'lti', path: '.storage-identity.json', set: { pairId: other } }]);
      await refusal('f-pairid', ['stack:up'], 'identity_mismatch');
    }); },
    async 'f-identity-missing'() { return identityCase('f-identity-missing', async () => {
      await lane.plant([{ op: 'remove', vol: 'app', path: '.storage-identity.json' }]);
      await refusal('f-identity-missing', ['stack:up'], 'identity_missing');
    }); },
    async 'f-db-without-identity'() { return identityCase('f-db-without-identity', async () => {
      await lane.plant([{ op: 'remove', vol: 'lti', path: '.storage-identity.json' }, { op: 'remove', vol: 'app', path: '.storage-identity.json' }]);
      await refusal('f-db-without-identity', ['stack:up'], 'db_without_identity');
    }); },
    async 'f-project'() {
      await identityCase('f-project', async () => {
        await lane.plant(['lti', 'app'].map((vol) => ({ op: 'editjson', vol, path: '.storage-identity.json', set: { composeProject: 'qa-other-project' } })));
        await refusal('f-project', ['stack:up'], 'identity_project');
      });
      return identityCase('f-project-invalid', async () => {
        await lane.plant([{ op: 'rawwrite', vol: 'lti', path: '.storage-identity.json', text: '{ not json' }]);
        await refusal('f-project-invalid', ['stack:up'], 'identity_invalid');
      });
    },
    async 'f-half-pair'() {
      await identityCase('f-half-pair', async () => {
        await lane.plant([{ op: 'stash', vol: 'app', names: ['cogniate.db', 'cogniate.db-wal', 'cogniate.db-shm'], hold: `hold-f-half-${hex16()}` }]);
        await refusal('f-half-pair', ['stack:up'], 'half_pair');
      });
      return identityCase('f-half-pair-none', async () => {
        await lane.plant([{ op: 'stash', vol: 'app', names: ['cogniate.db', 'cogniate.db-wal', 'cogniate.db-shm'], hold: `hold-f-none-a-${hex16()}` },
          { op: 'stash', vol: 'lti', names: ['lti.db', 'lti.db-wal', 'lti.db-shm'], hold: `hold-f-none-l-${hex16()}` }]);
        await refusal('f-half-pair-none', ['stack:up'], 'no_databases');
      });
    },
    async 'f-originals-back'() { check((ctx.acc['f-originals-back'] ?? []).length >= 7, 'Every (f) case put the original bytes back and started'); },

    // ------------------------------------------------------------ a-first-start-resume (FRESH lane, empty legacy sets)
    async 'a-first-start-resume'() {
      for (const variant of ['partial', 'both-pending']) {
        await quarantine(`a-first-start-${variant}`);
        const setup = await firstStartSetup({ legacyPrecondition: true });
        if (variant === 'partial') {
          await lane.plant([{ op: 'remove', vol: 'app', path: '.storage-identity.json' }]);
          const st = await lane.state();
          const one = st.ids.lti;
          check(one && !st.ids.app, 'One identity remains (lti)');
          check(one.provenance?.kind === 'fresh' && one.generation === 0 && one.firstStart === 'pending' && one.pairId === setup.pairId,
            'It is kind fresh, generation 0, firstStart pending, with the setup pairId');
          check(!st.fileset.lti.files['lti.db'].present && !st.fileset.app.files['cogniate.db'].present, 'No database');
        }
        await up(`a-first-start-${variant}-up`);
        const st = await lane.state();
        assertPair(st.ids, { pairId: setup.pairId, firstStart: 'completed', kind: 'fresh', generation: 0 });
        check(st.fileset.lti.files['lti.db'].present && st.fileset.app.files['cogniate.db'].present, 'Both databases exist');
        add('a-first-start-resume', `${variant}: same pairId ${setup.pairId.slice(0, 8)}…, both completed`);
      }
    },
    async 'e-not-same-import'() {
      await stopped();
      const legacy = new LegacyFixtures(lane.clone);
      const folder = `legacy-src-${hex16()}`;
      await lane.script('copyout', { spec: { vol: 'lti', names: ['lti.db'], folder: folder + '/lti' } });
      await lane.script('copyout', { spec: { vol: 'app', names: ['cogniate.db'], folder: folder + '/app' } });
      legacy.place('lti-service', 'lti.db', path.join(lane.out, folder, 'lti/lti.db'));
      legacy.place('cogniate-app', 'cogniate.db', path.join(lane.out, folder, 'app/cogniate.db'));
      try {
        check((await lane.state()).ids.lti.provenance.kind === 'fresh', 'The pair has kind: fresh');
        await refusal('e-not-same-import', ['stack:up'], 'legacy_conflict');
      } finally { legacy.removeAll(); }
    },

    // ------------------------------------------------------------ drill fixture: backup B and the write after B
    async '@backup-B'() {
      // B's own marker rows exist in the pair at B, so "equals B" has a logical side too.
      if (!(await lane.services()).some((x) => x.running)) await up('before-B-marker');
      state.bMarkers = await lane.writeMarkers('in-b');
      await lane.stopServices('stop-before-B');
      state.B = lane.newFolder(lane.backups, 'B');
      expectExit(await product('backup-B', ['stack:data-backup', '--', '--out', state.B]), 0, 'stack:data-backup B');
      check(!fs.existsSync(path.join(state.B, 'INCOMPLETE')), 'B is complete');
      state.manifestB = readManifest(state.B);
      state.bState = await lane.state();
      state.bBackupId = Object.entries(state.manifestB).find(([k, v]) => /^(backup_?id|backupId)$/i.test(k) && typeof v === 'string')?.[1] ?? null;
      check(state.bBackupId, "B's manifest names its backup id");
      check(logicalShows(await lane.backupLogical(state.B, state.bMarkers), { present: state.bMarkers }), 'B has its own marker rows');
      await postB('b1');
    },
    async 'h-volume-manifest'() {
      const m = state.manifestB, ids = state.bState.ids;
      check(m.source === 'volume', 'source: volume');
      check(m.pairId === ids.lti.pairId && m.generation === ids.lti.generation, 'pairId and generation of the identities');
      check(JSON.stringify(m.legacySources ?? null) === JSON.stringify(ids.lti.legacySources ?? null), 'legacySources of the identities');
      const files = manifestFiles(m), hashes = hashFolder(state.B);
      for (const vol of ['lti', 'app']) for (const [name, f] of Object.entries(state.bState.sets[vol])) {
        if (name === '.storage-identity.json' || f === 'absent') continue;
        const key = `${vol === 'lti' ? 'lti-service' : 'cogniate-app'}/${name}`;
        check(files[key] && files[key].sha256 === f.sha256 && files[key].size === f.size, `Manifest ${key} equals QA's hash of the stopped volume`);
        check(hashes[key]?.sha256 === f.sha256, `Backup file ${key} equals QA's hash`);
      }
    },
    async 'g-damaged'() {
      const cases = [['bytes'], ['missing'], ['backup-id'], ['project'], ['incomplete-manifest', 'manifest_incomplete']];
      for (const [damage, code] of cases) {
        const copy = lane.newFolder(lane.backups, 'damaged-' + damage);
        fs.cpSync(state.B, copy, { recursive: true });
        const mf = path.join(copy, 'manifest.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8'));
        if (damage === 'bytes') fs.appendFileSync(path.join(copy, 'lti-service/lti.db'), Buffer.from([1]));
        if (damage === 'missing') fs.rmSync(path.join(copy, 'cogniate-app/cogniate.db'));
        if (damage === 'backup-id') { const k = Object.keys(m).find((x) => /^(backup_?id|backupId)$/i.test(x)); m[k] = ''; }
        if (damage === 'project') { const k = Object.keys(m).find((x) => /project/i.test(x) && typeof m[x] === 'string'); m[k] = 'qa-other-project'; }
        if (damage === 'incomplete-manifest') delete m.pairId;
        if (['backup-id', 'project', 'incomplete-manifest'].includes(damage)) fs.writeFileSync(mf, JSON.stringify(m));
        const before = await lane.snapshot();
        const res = await product('g-damaged-' + damage, ['stack:data-restore', '--', '--from', copy]);
        expectExit(res, 1, 'restore of a damaged copy');
        check(/no target changed/i.test(res.stdout + res.stderr), '"no target changed"');
        if (code) check(namesCode(res.lines, code), 'Names ' + code);
        const st = await lane.state();
        check(!st.fileset.lti.journal.present && !st.fileset.app.journal.present, 'No journal file');
        await lane.assertUnchanged(before, 'g-damaged ' + damage);
      }
    },
    async 'h-nomanifest'() {
      const noManifest = lane.newFolder(lane.backups, 'nomanifest');
      fs.cpSync(state.B, noManifest, { recursive: true }); fs.rmSync(path.join(noManifest, 'manifest.json'));
      const incomplete = lane.newFolder(lane.backups, 'incomplete');
      fs.cpSync(state.B, incomplete, { recursive: true }); fs.rmSync(path.join(incomplete, 'manifest.json'));
      fs.writeFileSync(path.join(incomplete, 'INCOMPLETE'), 'qa', { mode: 0o600 });
      for (const folder of [noManifest, incomplete]) for (const command of ['stack:data-restore', 'stack:data-import']) {
        const before = await lane.snapshot();
        const res = await product('h-nomanifest-' + command, [command, '--', '--from', folder]);
        expectExit(res, 1, `${command} of ${path.basename(folder)}`);
        await lane.assertUnchanged(before, 'h-nomanifest');
      }
    },
    ...Object.fromEntries(DRILL_POINTS.map((point) => ['g-' + point, () => drill(point)])),
    async 'h-open-journal'() { check((ctx.acc['h-open-journal'] ?? []).length === 1, 'Checked at the staged point'); },
    async 'g-recover-idempotent'() { check((ctx.acc['g-recover-idempotent'] ?? []).length === DRILL_POINTS.length, 'Second recover after every drill'); },
    async '@post-B'() { await postB(hex16().slice(0, 6)); },

    // ------------------------------------------------------------ orphaned writer
    async 'g-orphan-refusal'() {
      const killed = await orphanStart('g-orphan-refusal');
      state.orphan = killed;
      const recordBefore = recordHash(lane.lockFolder());
      const listingBefore = await lane.listing();
      const out = lane.newFolder(lane.backups, 'orphan-backup');
      for (const [label, args] of [['orphan-recover', ['stack:data-restore', '--', '--recover']], ['orphan-up', ['stack:up']],
        ['orphan-backup', ['stack:data-backup', '--', '--out', out]]]) {
        const res = await product(label, args);
        assertRefuses(res, 'storage_writer_active', label);
        check((res.stdout + res.stderr).includes(killed.container.name) || (res.stdout + res.stderr).includes(killed.container.id), 'Names the container');
      }
      check(recordHash(lane.lockFolder()) === recordBefore, 'The lock record is unchanged');
      check(!fs.readdirSync(path.join(lane.clone, '.tmp')).some((n) => n.startsWith(`storage-op.${lane.project}.stale-`)), 'No stale-* folder');
      check(listingDiff(listingBefore, await lane.listing()).length === 0, "QA's file-set listing is unchanged by these commands");
    },
    async 'g-orphan-complete'() {
      await until(async () => (await lane.storageContainers()).length === 0, { timeoutMs: 300_000, intervalMs: 2_000, what: 'orphaned container ends' });
      const res = await recover('orphan-complete-recover');
      expectExit(res, 0, '--recover after the orphan completed');
      check(/nothing to recover/i.test(res.stdout + res.stderr), '"nothing to recover"');
      const reclaimed = res.lines.find((l) => l.event === 'storage_lock_reclaimed');
      check(reclaimed?.owner?.runId === state.orphan.runId, 'storage_lock_reclaimed names the killed command');
      check((await lane.storageContainers()).length === 0, 'No storage container of the lane remains');
      await equalsB({ generationBase: state.before.ids.lti.generation, expectKind: 'restore' });
      await up('orphan-complete-up');
    },
    async 'g-orphan-stopped'() {
      const before = state.before;
      const killed = await orphanStart('g-orphan-stopped');
      const stop = await lane.r.exec('orphan-docker-stop', 'docker', ['stop', killed.container.name], { timeoutMs: 120_000 });
      check(stop.code === 0, 'docker stop of the orphaned container');
      const res = await recover('orphan-stopped-recover');
      expectExit(res, 1, '--recover after docker stop');
      check(res.lines.some((l) => l.event === 'storage_lock_reclaimed' && l.owner?.runId === killed.runId), 'storage_lock_reclaimed');
      check(journalsAre(await lane.state(), 'rolled_back'), 'Verified rolled_back');
      await equalsBefore(before);
      await up('orphan-stopped-up');
    },

    // ------------------------------------------------------------ tamper and quarantine
    async 'g-tamper'() {
      const stop = await product('g-tamper-stop', ['stack:data-restore', '--', '--from', state.B, '--stop-after', 'swapped'], { env: drillEnv() });
      stopCheck(stop, 'swapped');
      const l = await lane.listing();
      const prev = l.lti.entries.find((e) => /^\.previous-[0-9a-f]{32}\/lti\.db$/.test(e.path));
      check(prev, 'A .previous-<opId>/lti.db exists at swapped');
      await lane.plant([{ op: 'flip', vol: 'lti', path: prev.path, offset: 100 }]);
      const multiset = async () => { const x = await lane.listing(); return ['lti', 'app'].flatMap((v) => x[v].entries.filter((e) => e.type === 'file').map((e) => `${path.basename(e.path)}:${e.sha256}`)).sort(); };
      const ms = await multiset();
      const res = await recover('g-tamper-recover');
      expectExit(res, 2, '--recover after the tamper');
      check(journalsAre(await lane.state(), 'rollback_failed'), 'Every journal rollback_failed');
      check(JSON.stringify(await multiset()) === JSON.stringify(ms), 'No file is deleted (multiset of name and SHA-256 equal)');
      const upRes = await product('g-tamper-up', ['stack:up']);
      assertRefuses(upRes, 'rollback_failed', 'stack:up');
      check((upRes.stdout + upRes.stderr).includes('stack:data-quarantine'), 'Names stack:data-quarantine');
      check(!/no target changed/i.test(res.stdout + res.stderr + upRes.stdout + upRes.stderr), 'No output says "no target changed"');
    },
    async 'g-quarantine-in-use'() {
      await stopped();
      const user = await lane.container({ kind: 'storage-volume-user' }, { label: 'qa-volume-user' });
      check(user.code === 0, 'QA storage-volume-user created');
      const userId = user.stdout.trim();
      try {
        const listing = await lane.listing();
        const services = await lane.services();
        const q1 = lane.newFolder(lane.quarantine, 'Q1');
        const res = await product('g-quarantine-in-use', ['stack:data-quarantine', '--', '--out', q1]);
        assertRefuses(res, 'volume_in_use', 'stack:data-quarantine');
        const text = res.stdout + res.stderr;
        check(text.includes(user.name) && text.includes(userId.slice(0, 12)), 'Names the container name and id');
        const p = await lane.presence();
        check(p.ltidb.state === 'labeled' && p.appdb.state === 'labeled', 'Both volumes still exist');
        const nowServices = await lane.services();
        check(services.every((s) => nowServices.some((n) => n.id === s.id)), 'Both service containers still exist');
        check((await lane.docker(['container', 'inspect', userId])).code === 0, 'The QA container still exists');
        coversListing(q1, listing);
      } finally {
        expectExit(await lane.docker(['rm', userId]), 0, 'QA removes its container by id');
        await lane.r.observe('qa-volume-user-removed');
      }
    },
    async 'g-quarantine'() {
      await lane.stopServices('g-quarantine-stop');
      const services = (await lane.services()).filter((s) => ['lti-service', 'cogniate-app'].includes(s.service));
      check(services.length === 2 && services.every((s) => s.state === 'exited'), 'Both service containers exist, exited');
      const allBefore = await allContainerStates(lane);
      const listing = await lane.listing();
      const records = await outsideRecords();
      const q = lane.newFolder(lane.quarantine, 'Q');
      const res = await product('g-quarantine', ['stack:data-quarantine', '--', '--out', q]);
      expectExit(res, 0, 'stack:data-quarantine');
      coversListing(q, listing);
      const allAfter = await allContainerStates(lane);
      for (const s of services) check(!allAfter.some((c) => c.id === s.id), `${s.service} container is gone`);
      const others = allBefore.filter((c) => !services.some((s) => s.id === c.id));
      check(JSON.stringify(others) === JSON.stringify(allAfter), 'Every other container is unchanged (ids and states)');
      const p = await lane.presence();
      check(p.ltidb.state === 'absent' && p.appdb.state === 'absent', 'Neither exact name exists');
      const qj = JSON.parse(fs.readFileSync(path.join(q, 'quarantine.json'), 'utf8'));
      const removedC = qj.removedContainers ?? [], removedV = qj.removedVolumes ?? [];
      check(removedC.length === 2 && services.every((s) => removedC.some((c) => c.id === s.id)), 'quarantine.json lists exactly the two containers');
      check(removedV.length === 2 && ['ltidb', 'appdb'].every((k) => removedV.includes(laneVolumeName(lane.project, k))), 'quarantine.json lists exactly the two volumes');
      check(JSON.stringify(await outsideRecords()) === JSON.stringify(records), 'Legacy files, content folders, Moodle volumes, other volumes and backups unchanged');
    },

    // ------------------------------------------------------------ FRESH lane after quarantine
    async '@legacy-place'() {
      state.legacy = new LegacyFixtures(lane.clone);
      for (const [service, db] of [['lti-service', 'lti.db'], ['cogniate-app', 'cogniate.db']]) state.legacy.place(service, db, path.join(state.B, service, db));
      state.X = lane.newFolder(lane.backups, 'X');
      expectExit(await product('legacy-backup-X', ['stack:data-backup', '--', '--source', 'legacy', '--out', state.X]), 0, 'legacy backup X');
    },
    async 'h-legacy-manifest'() {
      const m = readManifest(state.X), files = manifestFiles(m), sets = legacySets(lane.clone);
      check(m.source === 'legacy', 'source: legacy');
      const listed = Object.keys(files).sort(), wanted = Object.entries(sets).flatMap(([s, l]) => l.map((f) => `${s}/${f.name}`)).sort();
      check(JSON.stringify(listed) === JSON.stringify(wanted), 'The manifest lists every file of the legacy set');
      for (const [service, list] of Object.entries(sets)) for (const f of list)
        check(files[`${service}/${f.name}`].sha256 === f.sha256 && files[`${service}/${f.name}`].size === f.size, `Size and SHA-256 of ${f.name}`);
    },
    async 'h-target-state'() {
      check((ctx.acc['h-target-state'] ?? []).length === 1, 'Point (1) was checked at the staged drill');
      await firstStartSetup({ legacyPrecondition: false }); // restore and import only: no legacy precondition (B-S-23)
      let res = await refusal('h-target-restore', ['stack:data-restore', '--', '--from', state.B], 'restore_target_state');
      check(namesCode(res.lines, 'FIRST_START') || (res.stdout + res.stderr).includes('FIRST_START'), 'Restore names FIRST_START');
      res = await refusal('h-target-import', ['stack:data-import', '--', '--from', state.X], 'import_target_not_fresh');
      check(namesCode(res.lines, 'FIRST_START') || (res.stdout + res.stderr).includes('FIRST_START'), 'Import names FIRST_START');
      await lane.plant([{ op: 'remove', vol: 'lti', path: '.storage-identity.json' }, { op: 'remove', vol: 'app', path: '.storage-identity.json' }]);
      const l = await lane.listing();
      check(freshVolume('lti', l.lti) && freshVolume('app', l.app) && l.presence.ltidb.state === 'labeled', 'FRESH again with labeled, prepared volumes');
    },
    async 'e-fresh-refusal'() {
      const before = await lane.snapshot();
      const res = await product('e-fresh-refusal', ['stack:up']);
      assertRefuses(res, 'legacy_present', 'stack:up');
      const after = await lane.assertUnchanged(before, 'e-fresh-refusal');
      check(freshVolume('lti', after.listing.lti) && freshVolume('app', after.listing.app), 'Volumes stay FRESH');
      check(!(await lane.services()).some((s) => s.running), 'No service starts');
    },
    async 'e-hot-journal'() {
      const journal = path.join(lane.clone, 'infra/.data/lti-service/lti.db-journal');
      fs.writeFileSync(journal, 'qa hot journal', { mode: 0o600, flag: 'wx' });
      try {
        await refusal('e-hot-journal-up', ['stack:up'], 'legacy_hot_journal');
        const out = lane.newFolder(lane.backups, 'hot');
        const res = await product('e-hot-journal-backup', ['stack:data-backup', '--', '--source', 'legacy', '--out', out]);
        assertRefuses(res, 'legacy_hot_journal', 'legacy backup');
        check(!fs.existsSync(path.join(out, 'manifest.json')), 'No manifest');
      } finally { fs.unlinkSync(journal); }
    },
    async 'e-old-layout'() {
      const decoy = await lane.container({ kind: 'storage-decoy', legacyLtiDir: path.join(lane.clone, 'infra/.data/lti-service'), detach: true }, { label: 'qa-decoy' });
      check(decoy.code === 0, 'QA decoy runs');
      const id = decoy.stdout.trim();
      try {
        await refusal('e-old-layout-up', ['stack:up'], 'old_layout_container');
        const out = lane.newFolder(lane.backups, 'old-layout');
        const res = await product('e-old-layout-backup', ['stack:data-backup', '--', '--source', 'legacy', '--out', out]);
        assertRefuses(res, 'old_layout_container', 'legacy backup');
      } finally { await lane.docker(['rm', '-f', id]); await lane.r.observe('qa-decoy-removed'); }
    },
    async 'g-fresh-target'() {
      const stop = await product('g-fresh-target-stop', ['stack:data-restore', '--', '--from', state.B, '--stop-after', 'swapped'], { env: drillEnv() });
      stopCheck(stop, 'swapped');
      expectExit(await recover('g-fresh-target-recover'), 1, '--recover into FRESH');
      const st = await lane.state();
      for (const v of ['lti', 'app']) check(!st.fileset[v].files[v === 'lti' ? 'lti.db' : 'cogniate.db'].present && !st.ids[v], `FRESH again in ${v}`);
      expectExit(await product('g-fresh-target-restore', ['stack:data-restore', '--', '--from', state.B]), 0, 'restore of B into FRESH');
      state.postB = [];
      const now = await equalsB({ generationBase: state.bState.ids.lti.generation, expectKind: 'restore' });
      check(now.ids.lti.pairId === state.bState.ids.lti.pairId, "Identities take B's pairId");
    },
    async '@legacy-remove'() { state.legacy.removeAll(); },
    async 'h-pair-mismatch'() {
      await quarantine('h-pair-mismatch-Q2');
      await up('h-pair-mismatch-up');
      const ids = (await lane.state()).ids;
      check(ids.lti.pairId !== state.bState.ids.lti.pairId, "The new pair's pairId differs from B's");
      await lane.stopServices('h-pair-mismatch-stop');
      await refusal('h-pair-mismatch', ['stack:data-restore', '--', '--from', state.B], 'pair_mismatch');
    },

    // ------------------------------------------------------------ legacy import lane
    async '@legacy-import-lane'() {
      await quarantine('legacy-import-Q3');
      state.legacy = new LegacyFixtures(lane.clone);
      for (const [service, db] of [['lti-service', 'lti.db'], ['cogniate-app', 'cogniate.db']]) state.legacy.place(service, db, path.join(state.B, service, db));
      state.X2 = lane.newFolder(lane.backups, 'X2');
      const res = await product('legacy-backup-X2', ['stack:data-backup', '--', '--source', 'legacy', '--out', state.X2]);
      expectExit(res, 0, 'legacy backup X2');
      state.x2Manifest = readManifest(state.X2);
    },
    async 'e-import-recover'() {
      for (const point of ['staged', 'swapped']) {
        const stop = await product(`e-import-stop-${point}`, ['stack:data-import', '--', '--from', state.X2, '--stop-after', point], { env: drillEnv() });
        stopCheck(stop, point);
        assertRefuses(await product(`e-import-up-${point}`, ['stack:up']), 'journal_open', 'stack:up');
        expectExit(await recover(`e-import-recover-${point}`), 1, '--recover');
        const st = await lane.state();
        check(journalsAre(st, 'rolled_back'), 'Verified rolled_back');
        const l = await lane.listing();
        for (const v of ['lti', 'app']) {
          check(!st.ids[v] && !st.fileset[v].files[v === 'lti' ? 'lti.db' : 'cogniate.db'].present, `FRESH in ${v}`);
          check(!l[v].entries.some((e) => /^\.(restore|previous)-/.test(e.path)), `No .restore-* or .previous-* in ${v}`);
        }
      }
      state.importRes = await product('e-import-final', ['stack:data-import', '--', '--from', state.X2]);
      expectExit(state.importRes, 0, 'the import runs again');
    },
    async 'e-import'() {
      const m = state.x2Manifest, files = manifestFiles(m), sets = legacySets(lane.clone);
      check(m.source === 'legacy', 'manifest source: legacy');
      for (const [service, list] of Object.entries(sets)) for (const f of list)
        check(files[`${service}/${f.name}`]?.sha256 === f.sha256 && files[`${service}/${f.name}`]?.size === f.size, `Manifest lists ${service}/${f.name}`);
      const st = await lane.state();
      check(journalsAre(st, 'committed'), 'Both journals committed');
      for (const [service, vol, db] of [['lti-service', 'lti', 'lti.db'], ['cogniate-app', 'app', 'cogniate.db']])
        check(st.sets[vol][db].sha256 === sets[service].find((f) => f.name === db).sha256, `Before any start, ${db} equals the legacy bytes`);
      const pairId = assertPair(st.ids, { kind: 'import', generation: 1 });
      check(pairId !== state.bState.ids.lti.pairId, 'A new pairId');
      const listed = (st.ids.lti.legacySources ?? []).map((x) => `${x.name}:${x.sha256}`).sort();
      check(listed.length > 0 && JSON.stringify(listed) === JSON.stringify(Object.entries(files).map(([n, f]) => `${path.basename(n)}:${f.sha256}`).sort()),
        'legacySources equal the manifest list');
      state.importIds = st.ids;
    },
    async 'e-kept'() {
      const before = legacySets(lane.clone);
      const res = await up('e-kept-up');
      check(/legacy files are kept for reference and are not used/.test(res.stdout + res.stderr), 'The kept warning');
      check(JSON.stringify(legacySets(lane.clone)) === JSON.stringify(before), 'Legacy files unchanged');
    },
    async 'e-provenance-restore'() {
      await stopped();
      const v = lane.newFolder(lane.backups, 'V');
      expectExit(await product('e-prov-backup', ['stack:data-backup', '--', '--out', v]), 0, 'volume backup');
      const before = (await lane.state()).ids;
      expectExit(await product('e-prov-restore', ['stack:data-restore', '--', '--from', v]), 0, 'restore of it');
      const ids = (await lane.state()).ids;
      check(ids.lti.pairId === before.lti.pairId && ids.lti.generation === before.lti.generation + 1, 'pairId kept, generation + 1');
      check(JSON.stringify(ids.lti.legacySources) === JSON.stringify(before.lti.legacySources), 'legacySources unchanged');
      const res = await up('e-prov-up');
      check(/legacy files are kept for reference and are not used/.test(res.stdout + res.stderr) && !namesCode(res.lines, 'legacy_conflict'), 'Kept warning, no legacy_conflict');
    },
    async 'e-changed-byte'() {
      await stopped();
      const file = path.join(lane.clone, 'infra/.data/lti-service/lti.db');
      const fd = fs.openSync(file, 'r+'); const b = Buffer.alloc(1);
      try {
        fs.readSync(fd, b, 0, 1, 200); b[0] ^= 1; fs.writeSync(fd, b, 0, 1, 200); state.legacy.edited('lti-service', 'lti.db');
        await refusal('e-changed-byte', ['stack:up'], 'legacy_conflict');
      } finally { fs.readSync(fd, b, 0, 1, 200); b[0] ^= 1; fs.writeSync(fd, b, 0, 1, 200); fs.closeSync(fd); state.legacy.edited('lti-service', 'lti.db'); }
    },
    async 'e-added-wal'() {
      await stopped();
      const wal = path.join(lane.clone, 'infra/.data/lti-service/lti.db-wal');
      check(!fs.existsSync(wal), 'lti.db-wal is not in legacySources');
      fs.writeFileSync(wal, 'qa added wal', { mode: 0o600, flag: 'wx' });
      try { await refusal('e-added-wal', ['stack:up'], 'legacy_conflict'); } finally { fs.unlinkSync(wal); }
    },
    async 'e-import-nonfresh'() {
      await stopped();
      await refusal('e-import-nonfresh', ['stack:data-import', '--', '--from', state.X2], 'import_target_not_fresh');
    },
    async 'h-old-manifest'() {
      await stopped();
      const copy = lane.newFolder(lane.backups, 'old-manifest');
      fs.cpSync(state.X2, copy, { recursive: true });
      const mf = path.join(copy, 'manifest.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8'));
      delete m.source; fs.writeFileSync(mf, JSON.stringify(m));
      await refusal('h-old-manifest-restore', ['stack:data-restore', '--', '--from', copy], 'import_target_not_fresh');
      await quarantine('h-old-manifest-Q4');
      expectExit(await product('h-old-manifest-import', ['stack:data-import', '--', '--from', copy]), 0, 'import of the older manifest into FRESH');
    },

    // ------------------------------------------------------------ b-sequence
    async 'b-sequence'() {
      for (let i = 1; i <= 3; i++) {
        await stopped();
        expectExit(await product(`b-sequence-reset-${i}`, ['stack:reset']), 0, 'stack:reset of the QA lane');
        const p = await lane.presence();
        check(p.ltidb.state === 'absent' && p.appdb.state === 'absent', 'A fresh lane after the reset');
        await up(`b-sequence-up-${i}`);
        expectExit(await lane.r.npm(`b-sequence-seed-${i}`, ['run', 'seed'], { timeoutMs: 900_000 }), 0, 'seed');
        lane.loadStack();
        const providers = await lane.lti('GET', '/api/providers');
        check(providers.status === 200, 'GET /api/providers → 200');
        const log = path.join(lane.clone, 'infra/.logs/lti-service.jsonl');
        check(!fs.existsSync(log) || !fs.readFileSync(log, 'utf8').includes('internal_error'), 'No internal_error in the LTI log');
        await lane.stopServices(`b-sequence-stop-${i}`);
        const read = await lane.script('logical', { spec: { markers: [], integrity: true } });
        check(['lti', 'app'].every((v) => JSON.stringify(read[v].integrity) === '["ok"]'), 'integrity_check ok on copies of both databases');
        add('b-sequence', `run ${i}: providers 200, integrity ok`);
      }
      state.legacy = null;
    },

    // ------------------------------------------------------------ e-old-schema (last block)
    async '@old-schema-setup'() {
      const h = ctx.handoff();
      if (!h?.m123Backup || !h?.m123Clone) throw new StorageBlocked("This round's AC-M1-23 backup and clone are not recorded by the migration phase");
      await stopped();
      expectExit(await product('old-schema-reset', ['stack:reset']), 0, 'stack:reset before e-old-schema');
      state.legacy = new LegacyFixtures(lane.clone);
      const manifest = readManifest(h.m123Backup), files = manifestFiles(manifest);
      for (const name of Object.keys(files)) {
        const [service, file] = name.split('/');
        state.legacy.place(service, file, path.join(h.m123Backup, service, file));
      }
      copyCredentials(lane.clone, h.m123Clone);
      lane.r.loadStackFiles();
      state.oldSchema = { manifest, h };
    },
    async 'e-content-missing'() {
      check((ctx.acc['e-content-missing'] ?? []).length === 1, 'The import half was checked before the package copy');
      // Restore half: a volume restore into the OK pair while one referenced package folder is absent.
      await stopped();
      const v = lane.newFolder(lane.backups, 'content-V');
      expectExit(await product('content-backup', ['stack:data-backup', '--', '--out', v]), 0, 'volume backup');
      const folder = state.oldSchema.paths[0];
      const pkg = path.join(lane.clone, 'infra/.data/cogniate-app/packages', folder), hold = path.join(lane.out, `pkg-hold-${hex16()}`);
      fs.mkdirSync(hold, { mode: 0o700 }); fs.renameSync(pkg, path.join(hold, folder));
      try {
        const res = await refusal('content-restore', ['stack:data-restore', '--', '--from', v], 'content_missing');
        const line = res.lines.find((l) => l.event === 'storage_content_check');
        check(line?.result === 'content_missing', 'storage_content_check content_missing');
      } finally { fs.renameSync(path.join(hold, folder), pkg); }
    },
    async 'e-old-schema'() {
      const { h } = state.oldSchema;
      // Import half of e-content-missing: the packages are not copied yet.
      const { values: storageValues, folders: paths } = await storagePaths(path.join(h.m123Backup, 'cogniate-app'));
      check(storageValues.length > 0, 'The AC-M1-23 app database names package folders');
      state.oldSchema.paths = paths;
      const y0 = lane.newFolder(lane.backups, 'Y0');
      expectExit(await product('content-legacy-backup', ['stack:data-backup', '--', '--source', 'legacy', '--out', y0]), 0, 'legacy backup Y0');
      const missing = await refusal('content-import', ['stack:data-import', '--', '--from', y0], 'content_missing');
      const line0 = missing.lines.find((l) => l.event === 'storage_content_check');
      check(line0?.result === 'content_missing', 'storage_content_check content_missing');
      const l = await lane.listing();
      check(freshVolume('lti', l.lti) && freshVolume('app', l.app), 'The target stays FRESH');
      add('e-content-missing', 'import half: content_missing, target FRESH');
      // e-old-schema itself.
      const packages = path.join(lane.clone, 'infra/.data/cogniate-app/packages');
      fs.mkdirSync(packages, { recursive: true, mode: 0o700 });
      for (const p of paths) fs.cpSync(path.join(h.m123Clone, 'infra/.data/cogniate-app/packages', p), path.join(packages, p), { recursive: true });
      const y1 = lane.newFolder(lane.backups, 'Y1');
      expectExit(await product('old-schema-legacy-backup', ['stack:data-backup', '--', '--source', 'legacy', '--out', y1]), 0, 'legacy backup Y1');
      const imp = await product('old-schema-import', ['stack:data-import', '--', '--from', y1]);
      expectExit(imp, 0, 'import into FRESH');
      const line = imp.lines.find((x) => x.event === 'storage_content_check');
      check(line?.result === 'pass' && line.checked === storageValues.length, `storage_content_check pass with checked ${storageValues.length} (QA count)`);
      add('e-old-schema', `content check checked=${line.checked}; QA count of distinct storage_path values=${storageValues.length}`);
      await up('old-schema-up');
      const platforms = await lane.lti('GET', '/api/platforms');
      check(platforms.status === 200 && JSON.stringify(platforms.json).includes(h.m123PlatformId ?? '\u0000'), 'The v10 platform of AC-M1-23 is listed');
      const cookie = await lane.portal('thanh@cogniate.test');
      const conns = await lane.app(cookie, 'GET', '/app-api/connections');
      check(conns.status === 200 && JSON.stringify(conns.json).includes(h.m123ConnectionId ?? '\u0000'), 'The v10 connection is listed');
      await lane.stopServices('old-schema-stop');
      const read = await lane.script('logical', { spec: { markers: [], migrations: true } });
      const candidate = await candidateMigrations(lane);
      for (const [vol, names] of Object.entries(candidate)) {
        check(Array.isArray(read[vol].schemaMigration), `schema_migration of ${vol} is read from stopped copies`);
        const missingNames = names.filter((n) => !read[vol].schemaMigration.includes(n));
        check(missingNames.length === 0, `schema_migration of ${vol} includes the candidate's names (missing: ${missingNames.join(', ')})`);
      }
      add('e-old-schema', `schema_migration includes the candidate's ${candidate.lti.length} lti and ${candidate.app.length} app names`);
    },
  };

  // ---------------------------------------------------------------- row helpers that need `rows`
  async function bOracle(vol) {
    check((await lane.services()).every((s) => !['lti-service', 'cogniate-app'].includes(s.service) || s.running), 'Services run');
    const scratch = `.qa-scratch-${hex16()}`;
    const key = vol === 'lti' ? 'ltidb' : 'appdb';
    // The §11 exception while services run: only inside .qa-scratch-<16 hex>/ of the volume root; QA removes it.
    const answer = await lane.script('oracle', { mode: 'write', volumes: [key], allowWhileRunning: true, lock: true, spec: { scratch } });
    check(answer.verdict === 'LOCK ENFORCED (B refused while A held)', `QA oracle in ${vol}: ${answer.verdict}`);
    check(answer.bWhileHeld?.error?.errcode === 5, 'The contender gets the extended code 5 only');
    check(answer.aBefore?.alive && answer.aAfter?.alive, 'The holder is alive and in its transaction before and after');
    check(answer.positiveControl?.event === 'ACQUIRED', 'Release-positive control succeeds');
    check(answer.scratchRemoved === true, 'The scratch folder is gone');
    check(!(await lane.listing())[vol].entries.some((e) => e.path.startsWith('.qa-scratch-')), 'No scratch folder remains');
    const pf = await product(`b-oracle-${vol}-preflight`, ['stack:up']);
    expectExit(pf, 0, 'a preflight afterwards'); check(preflightOf(pf).summary?.result === 'pass', 'The preflight passes');
  }
  async function identityCase(label, body) {
    await stopped();
    const hold = `orig-${label}-${hex16()}`;
    const names = { lti: ['.storage-identity.json', 'lti.db', 'lti.db-wal', 'lti.db-shm'], app: ['.storage-identity.json', 'cogniate.db', 'cogniate.db-wal', 'cogniate.db-shm'] };
    const original = await lane.state();
    for (const vol of ['lti', 'app']) await lane.script('copyout', { spec: { vol, names: names[vol], folder: `${hold}/${vol}` } });
    try { await body(); }
    finally {
      // Put the original bytes back: remove what is in place now, then copy the held originals in.
      const now = await lane.state();
      const ops = [];
      for (const vol of ['lti', 'app']) for (const name of names[vol]) {
        if (now.fileset[vol].files[name]?.present) ops.push({ op: 'remove', vol, path: name });
      }
      await lane.plant(ops);
      for (const vol of ['lti', 'app']) await lane.plant([{ op: 'unstash', vol, names: names[vol], hold: `${hold}/${vol}` }]);
    }
    const back = await lane.state();
    check(fileSetsEqual(back.sets, original.sets), 'The original bytes are back (SHA-256 equal)');
    const res = await up(`f-back-${label}`);
    check(preflightOf(res).lines.every((l) => l.state === 'OK'), 'State OK');
    add('f-originals-back', `${label}: originals back, stack:up exit 0, state OK`);
  }
  async function drill(point) {
    await stopped();
    const before = state.before ?? await lane.state();
    const env = drillEnv(point === 'rollback-mid' ? { STORAGE_DRILL_FAIL: 'after-swapped' } : {});
    const stop = await product('drill-' + point, ['stack:data-restore', '--', '--from', state.B, '--stop-after', point], { env });
    stopCheck(stop, point);
    assertRefuses(await product('drill-up-' + point, ['stack:up']), 'journal_open', 'stack:up');
    if (point === 'staged') {
      const out = lane.newFolder(lane.backups, 'open-journal');
      const b = await product('h-open-journal', ['stack:data-backup', '--', '--out', out]);
      assertRefuses(b, 'backup_source_not_ok:journal_open', 'stack:data-backup');
      check(!fs.existsSync(path.join(out, 'manifest.json')), 'No manifest is written');
      add('h-open-journal', 'backup_source_not_ok:journal_open, no manifest');
      const res = await refusal('h-target-state-1', ['stack:data-restore', '--', '--from', state.B], 'restore_target_state');
      check((res.stdout + res.stderr).includes('journal_open') && (res.stdout + res.stderr).includes('--recover'), 'Names journal_open and --recover');
      add('h-target-state', 'point (1): restore_target_state naming journal_open and --recover; nothing changes');
    }
    const res = await recover('recover-' + point);
    if (point === 'committed-lti') {
      expectExit(res, 0, '--recover at committed-lti');
      await equalsB({ generationBase: before.ids.lti.generation, expectKind: 'restore' });
      state.postB = null;
    } else {
      expectExit(res, 1, '--recover at ' + point);
      check(journalsAre(await lane.state(), 'rolled_back'), 'A verified rolled_back');
      await equalsBefore(before);
    }
    const snap = await lane.snapshot();
    const again = await recover('recover-again-' + point);
    expectExit(again, 0, 'second --recover');
    check(/nothing to recover/i.test(again.stdout + again.stderr), '"nothing to recover"');
    await lane.assertUnchanged(snap, 'second --recover');
    add('g-recover-idempotent', `${point}: nothing to recover; nothing changes`);
    await up('drill-after-' + point);
    await lane.stopServices('drill-stop-' + point);
    if (point !== 'committed-lti') state.before = await lane.state();
  }
  async function orphanStart(label) {
    await stopped();
    const env = { ...lane.r.STACK_ENV, STORAGE_DRILL: '1', STORAGE_DRILL_PAUSE_SECONDS: '120' };
    const g = spawnGroup('npm', ['run', 'stack:data-restore', '--', '--from', state.B, '--pause-after', 'swapped-lti'], { cwd: lane.clone, env });
    const record = await until(() => { const f = path.join(lane.lockFolder(), 'owner.json'); try { return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return false; } },
      { timeoutMs: 60_000, what: 'restore lock record' });
    await until(() => /storage_drill_pause/.test(g.output().stdout + g.output().stderr) || lane.allLogLines().some((l) => l.event === 'storage_drill_pause'),
      { timeoutMs: 180_000, what: 'storage_drill_pause' });
    check(g.killGroup('SIGKILL'), 'SIGKILL to the whole group');
    await g.done;
    await until(async () => (await groupMembers(g.pgid)).length === 0, { timeoutMs: 10_000, what: 'the group is empty' });
    const active = (await lane.storageContainers()).filter((c) => c.state === 'running');
    check(active.length === 1 && active[0].name.startsWith(`${lane.project}-storage-`), 'The maintenance container still runs');
    lane.r.saveText(`storage/${label}-kill.json`, JSON.stringify({ pgid: g.pgid, record, container: active[0] }, null, 2));
    return { runId: record.runId, container: active[0], pgid: g.pgid };
  }
  async function lockStale() {
    const tmp = path.join(lane.clone, '.tmp');
    const P = lane.project, lockDir = lane.lockFolder();
    // A QA process that ends; its pidStart and pgid are read with LC_ALL=C ps while it is alive.
    const ended = async () => {
      const c = spawnGroup('sleep', ['2']);
      const start = await pidStart(c.pid), pgid = await pgidOf(c.pid);
      check(start && pgid === c.pid, 'Planted values read with LC_ALL=C ps');
      await c.done;
      await until(async () => (await groupMembers(pgid)).length === 0 && (await pidStart(c.pid)) === '', { timeoutMs: 10_000, what: 'ended QA process and empty group' });
      return { pid: c.pid, pgid, start };
    };
    const base = (pid, start, pgid) => ({ formatVersion: 1, project: P, checkout: lane.clone, command: 'qa-planted', runId: hex16(), pid,
      pidStart: start, pgid, acquiredAt: new Date().toISOString(), containers: [] });
    const reclaimed = async (label, planted, hash) => {
      const res = await product(label, ['stack:up']); expectExit(res, 0, label);
      check(res.lines.some((l) => l.event === 'storage_lock_reclaimed' && l.owner?.runId === planted.runId), 'storage_lock_reclaimed names the planted runId');
      check(recordHash(path.join(tmp, `storage-op.${P}.stale-${planted.runId}`)) === hash, 'stale-<runId>/owner.json equals the planted record');
    };
    await stopped();
    // (1) An ended QA process with an empty group.
    const e1 = await ended();
    const r1 = base(e1.pid, e1.start, e1.pgid);
    await reclaimed('a-lock-stale-1', r1, writeRecordFolder(lockDir, r1));
    await stopped();
    // (2) A live QA process with another pidStart and an empty group.
    const live = spawnGroup('sleep', ['300']);
    try {
      const emptyGroup = (await ended()).pgid;
      const start = await pidStart(live.pid);
      const r2 = base(live.pid, start.replace(/\d{4}$/, (y) => String(Number(y) - 1)), emptyGroup);
      check(r2.pidStart !== start, 'Planted pidStart differs');
      await reclaimed('a-lock-stale-2', r2, writeRecordFolder(lockDir, r2));
    } finally { live.killGroup('SIGKILL'); await live.done; }
    await stopped();
    // (3) cand-* and rel-* folders of ended processes with empty groups.
    const e3 = await ended(), e4 = await ended();
    const c3 = base(e3.pid, e3.start, e3.pgid), c4 = base(e4.pid, e4.start, e4.pgid);
    writeRecordFolder(path.join(tmp, `storage-op.${P}.cand-${c3.runId}`), c3);
    writeRecordFolder(path.join(tmp, `storage-op.${P}.rel-${c4.runId}`), c4);
    const res3 = await product('a-lock-stale-3', ['stack:up']); expectExit(res3, 0, 'case 3');
    check(!fs.existsSync(path.join(tmp, `storage-op.${P}.cand-${c3.runId}`)) && !fs.existsSync(path.join(tmp, `storage-op.${P}.rel-${c4.runId}`)), 'Both folders are gone');
    check(res3.lines.filter((l) => l.event === 'storage_lock_cleanup').length >= 1, 'storage_lock_cleanup events');
    await stopped();
    // (4) Group rule: a stub owner and a stub child in their own group; SIGKILL to the owner only.
    const stub = spawnGroup('bash', ['-c', 'sleep 600 & wait']);
    try {
      await until(async () => (await groupMembers(stub.pgid)).length >= 2, { timeoutMs: 10_000, what: 'stub child in the group' });
      const r4 = base(stub.pid, await pidStart(stub.pid), await pgidOf(stub.pid));
      const hash = writeRecordFolder(lockDir, r4);
      process.kill(stub.pid, 'SIGKILL');
      await until(async () => (await pidStart(stub.pid)) === '', { timeoutMs: 10_000, what: 'stub owner ended' });
      check((await groupMembers(r4.pgid)).length >= 1, 'The stub child keeps the group live');
      const res = await product('a-lock-stale-4', ['stack:up'], { timeoutMs: 200_000 });
      const wait = res.lines.find((l) => l.event === 'storage_lock_wait');
      check(wait, 'storage_lock_wait');
      assertRefuses(res, 'operation_in_progress', 'stack:up');
      check((res.stdout + res.stderr).includes(String(r4.pgid)), 'The refusal names the group');
      const refused = res.lines.find((l) => l.event === 'storage_lock_refused' && l.reason === 'operation_in_progress');
      const waited = (Date.parse(refused.ts) - Date.parse(wait.ts)) / 1000;
      check(waited >= 115 && waited <= 125, `120 s ± 5 s after the first wait (${waited.toFixed(1)} s)`);
      check(recordHash(lockDir) === hash, 'The record is unchanged');
      for (const pid of await groupMembers(r4.pgid)) process.kill(pid, 'SIGKILL');
      await until(async () => (await groupMembers(r4.pgid)).length === 0, { timeoutMs: 10_000, what: 'stub child ended' });
      const after = await product('a-lock-stale-4-after', ['stack:up']); expectExit(after, 0, 'after the stub child ends');
      check(after.lines.some((l) => l.event === 'storage_lock_reclaimed' && l.owner?.runId === r4.runId), 'storage_lock_reclaimed');
    } finally { stub.killGroup('SIGKILL'); }
  }
  async function hostControlRefusesWithMarker() {
    const calls = [];
    const dir = path.join(lane.clone, 'tests/acceptance/artifacts/control'); fs.mkdirSync(dir, { recursive: true });
    const stop = m1HostControl(lane.r, async (...args) => { calls.push(args); return { code: 0, stdout: '', stderr: '', durationMs: 0 }; });
    try {
      for (const req of [{ id: 'm1-' + hex16(), action: 'm1-restart', service: 'lti-service' }, { id: 'm1-' + hex16(), action: 'm1-profile', profile: 'default', simulation: 'off' }]) {
        fs.writeFileSync(path.join(dir, `req-${req.id}.json`), JSON.stringify(req));
        await until(() => fs.existsSync(path.join(dir, `ack-${req.id}.json`)), { timeoutMs: 10_000, intervalMs: 25, what: 'host-control answer' });
        const ack = JSON.parse(fs.readFileSync(path.join(dir, `ack-${req.id}.json`), 'utf8'));
        check(ack.code !== 0, `${req.action} refused while the marker is present`);
      }
    } finally { await stop(); }
    check(calls.length === 0, 'The host control ran no command');
    lane.r.record('HARNESS-MARKER-HOSTCTL', 'With the marker present, the host control refuses m1-restart and m1-profile before any command (harness self-check)', 'PASS', []);
  }
  async function outsideRecords() {
    const p = lane.project;
    const vols = await lane.docker(['volume', 'ls', '-q']);
    const names = vols.stdout.split('\n').filter(Boolean).filter((n) => n !== laneVolumeName(p, 'ltidb') && n !== laneVolumeName(p, 'appdb'));
    const inspected = names.length ? JSON.parse((await lane.docker(['volume', 'inspect', ...names])).stdout) : [];
    return {
      legacy: legacySets(lane.clone),
      content: hashFolder(path.join(lane.clone, 'infra/.data/cogniate-app')),
      volumes: inspected.map((v) => ({ Name: v.Name, CreatedAt: v.CreatedAt, Labels: v.Labels, Driver: v.Driver })).sort((a, b) => a.Name.localeCompare(b.Name)),
      backups: hashFolder(lane.backups),
    };
  }
  return rows;
}

// ---------------------------------------------------------------- module helpers

/** QA's hashes of a quarantine copy cover every file of the listing before (same relative path, size and SHA-256). */
export function coversListing(folder, listing) {
  const q = hashFolder(folder);
  for (const vol of ['lti', 'app']) for (const e of listing[vol].entries.filter((x) => x.type === 'file')) {
    const hit = Object.entries(q).find(([name, f]) => (name === e.path || name.endsWith('/' + e.path)) && f.sha256 === e.sha256 && f.size === e.size);
    check(hit, `Quarantine copy holds ${vol}:${e.path} with equal bytes`);
  }
  check(fs.existsSync(path.join(folder, 'quarantine.json')) || fs.existsSync(path.join(folder, 'manifest.json')), 'The copy has its record');
}
async function allContainerStates(lane) {
  const r = await lane.docker(['ps', '-aq', '--no-trunc']);
  const ids = r.stdout.split('\n').filter(Boolean);
  if (!ids.length) return [];
  return JSON.parse((await lane.docker(['container', 'inspect', ...ids])).stdout).map((c) => ({ id: c.Id, state: c.State?.Status })).sort((a, b) => a.id.localeCompare(b.id));
}
/** The distinct package.storage_path values of a copied app database (read from a copy, never the original). */
export async function storagePaths(appFolder) {
  const { DatabaseSync } = await import('node:sqlite');
  const os = await import('node:os');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-storage-paths-'));
  try {
    for (const s of ['', '-wal', '-shm']) if (fs.existsSync(path.join(appFolder, 'cogniate.db' + s))) fs.copyFileSync(path.join(appFolder, 'cogniate.db' + s), path.join(scratch, 'cogniate.db' + s));
    const db = new DatabaseSync(path.join(scratch, 'cogniate.db'));
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
      const table = tables.find((t) => /^packages?$/.test(t));
      if (!table) throw new StorageBlocked('No package table in the copied app database');
      const cols = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
      if (!cols.includes('storage_path')) throw new StorageBlocked('No storage_path column in the package table');
      const values = [...new Set(db.prepare(`SELECT DISTINCT storage_path FROM "${table}" WHERE storage_path IS NOT NULL`).all().map((x) => String(x.storage_path)))].sort();
      const folders = [...new Set(values.map((p) => p.replace(/^packages\//, '').split('/')[0]).filter(Boolean))].sort();
      return { values, folders };
    } finally { db.close(); }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}
/** The candidate's migration file names per service, from the tracked candidate tree of the storage clone. */
export async function candidateMigrations(lane) {
  const r = await lane.run('git', ['ls-files', '--', 'services/lti-service/**/migrations/*.sql', 'services/cogniate-app/**/migrations/*.sql'], { cwd: lane.clone });
  check(r.code === 0, 'git ls-files of the candidate migrations');
  const files = r.stdout.split('\n').filter(Boolean);
  const pick = (service) => files.filter((f) => f.startsWith(`services/${service}/`)).map((f) => path.basename(f)).sort();
  const out = { lti: pick('lti-service'), app: pick('cogniate-app') };
  check(out.lti.length > 0 && out.app.length > 0, 'Candidate migration names found for both services');
  return out;
}
/** e-old-schema credential copy: only the four `.env` values and the four secret files, mode 0600. */
export function copyCredentials(clone, fromClone) {
  const keys = ['LTI_MASTER_KEY', 'APP_MASTER_KEY', 'PORTAL_THANH_PASSWORD', 'PORTAL_QAB_PASSWORD'];
  const read = (file) => fs.readFileSync(file, 'utf8');
  const source = Object.fromEntries(read(path.join(fromClone, '.env')).split('\n').map((l) => /^([A-Z_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]));
  for (const k of keys) if (!(k in source)) throw new StorageBlocked('AC-M1-23 clone .env has no ' + k);
  const envFile = path.join(clone, '.env');
  const lines = read(envFile).split('\n').map((l) => { const m = /^([A-Z_]+)=/.exec(l); return m && keys.includes(m[1]) ? `${m[1]}=${source[m[1]]}` : l; });
  for (const k of keys) if (!lines.some((l) => l.startsWith(k + '='))) throw new StorageBlocked('Storage lane .env has no ' + k);
  fs.writeFileSync(envFile, lines.join('\n'));
  for (const rel of ['infra/.secrets/lti-api-key.cogniate', 'infra/.secrets/lti-api-key.qa-second', 'infra/.secrets/app/lti-api-key', 'infra/.secrets/seed.json']) {
    const target = path.join(clone, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.copyFileSync(path.join(fromClone, rel), target); fs.chmodSync(target, 0o600);
  }
  return keys;
}
export { DRILL_POINTS, sleep, createdNotBefore, defineRows };
