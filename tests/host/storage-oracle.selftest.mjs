// HARNESS ONLY: QA's AC-M1-41 oracles on synthetic values and host temporary folders. No Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StorageBlocked, StorageFail } from './storage-docker.mjs';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  LegacyFixtures, assertPair, assertRefuses, clockSample, dbFileSets, fileSets, fileSetsEqual, freshVolume, groupMembers, hashFolder, jsonLines,
  legacyEmpty, legacySets, listingDiff, lockPairs, logicalShows, manifestDbSets, manifestFiles, namesCode, nothingChanged,
  pairsDisjoint, pidStart, pgidOf, preflightOf, readJsonl, recordHash, serializeVerdict, spawnGroup, timeMs, until, waitForRun, writeRecordFolder,
} from './storage-oracle.mjs';

const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-oracle-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const entry = (p, extra = {}) => ({ path: p, type: 'file', uid: 501, gid: 20, mode: '0600', size: 1, sha256: 'a', ...extra });
const present = (entries) => ({ state: 'present', entries: [{ path: '.', type: 'dir', uid: 501, gid: 20, mode: '0700' }, ...entries] });
const labeled = (created) => ({ state: 'labeled', record: { CreatedAt: created } });

test('HARNESS ONLY: refusals need exit 1 and the code in a JSON line', () => {
  const out = '{"event":"storage_preflight_summary","result":"fail","reasons":["unknown_entry"]}\nplain text unknown_entry\n';
  assert.deepEqual(jsonLines(out).length, 1);
  assert.equal(namesCode(jsonLines('{"reason":"backup_source_not_ok:journal_open"}'), 'backup_source_not_ok'), true, 'code:detail form');
  assert.doesNotThrow(() => assertRefuses({ code: 1, stdout: out, stderr: '' }, 'unknown_entry'));
  assert.throws(() => assertRefuses({ code: 0, stdout: out, stderr: '' }, 'unknown_entry'), StorageFail);
  assert.throws(() => assertRefuses({ code: 1, stdout: 'unknown_entry only as text', stderr: '' }, 'unknown_entry'), StorageFail, 'Text alone is not the JSON output');
  assert.throws(() => assertRefuses({ code: 1, stdout: '{"reason":"unknown_entry_x"}', stderr: '' }, 'unknown_entry'), StorageFail, 'No near-match');
});

test('HARNESS ONLY: preflightOf takes the check pass by mode, not the last summary (report, check, mark-started)', () => {
  // The three passes of a first stack:up, in output order (ADR-012 §5; shapes of the 9cdd768 a-fresh log).
  const pass = (mode, runId, ts, state) => [...['lti', 'app'].map((folder) => JSON.stringify({ event: 'storage_preflight', ts, runId, mode,
    project: 'qa-x', folder, path: `/check/${folder === 'lti' ? 'lti-service' : 'cogniate-app'}`, fsType: 'ext4', state, result: 'pass', reason: null })),
  JSON.stringify({ event: 'storage_preflight_summary', ts, runId, mode, result: 'pass', reasons: [] })];
  const report = pass('report', 'a'.repeat(16), '2026-10-21T07:40:08.947Z', 'FRESH');
  const chk = pass('check', 'b'.repeat(16), '2026-10-21T07:40:09.248Z', 'FRESH');
  const marked = pass('mark-started', 'c'.repeat(16), '2026-10-21T07:40:39.035Z', 'OK');
  const out = (...parts) => ({ code: 0, stdout: ['Building the portal.', ...parts.flat(), 'Stack healthy in 31 s'].join('\n'), stderr: '' });

  const first = preflightOf(out(report, chk, marked));
  assert.equal(first.summary.mode, 'check');
  assert.equal(first.summary.runId, 'b'.repeat(16), 'The check runId, not the mark-started runId');
  assert.equal(first.summary.ts, '2026-10-21T07:40:09.248Z');
  assert.deepEqual(first.checkLines.map((l) => l.folder), ['lti', 'app']);
  assert.ok(first.checkLines.every((l) => l.mode === 'check' && l.runId === 'b'.repeat(16)));
  assert.equal(first.lines.length, 6, 'lines keeps every storage_preflight line');
  assert.deepEqual(first.runIds, ['a'.repeat(16), 'b'.repeat(16), 'c'.repeat(16)]);
  assert.equal(preflightOf(out(report, chk)).summary.runId, 'b'.repeat(16), 'Second start: report, then check');
  assert.equal(preflightOf(out(chk)).summary.runId, 'b'.repeat(16), 'stack:restart: check only');
  assert.equal(preflightOf(out(marked, chk, report)).summary.runId, 'b'.repeat(16), 'Not by position');

  const noCheck = preflightOf(out(report, marked));
  assert.equal(noCheck.summary, null, 'A missing check is never replaced by another mode');
  assert.deepEqual(noCheck.checkLines, []);
  const failed = preflightOf(out(report, chk.map((l) => l.replace('"result":"pass"', '"result":"fail"')), marked));
  assert.equal(failed.summary.result, 'fail', 'A failed check stays failed when mark-started passes');
  const foreign = preflightOf(out(chk.slice(0, 1).map((l) => l.replace('b'.repeat(16), 'd'.repeat(16))), chk.slice(1)));
  assert.deepEqual(foreign.checkLines.map((l) => l.folder), ['app'], 'Only the folder lines of the selected check');
  assert.throws(() => preflightOf(out(chk, pass('check', 'e'.repeat(16), '2026-10-21T07:40:10.000Z', 'FRESH'))), StorageFail, 'Two checks are ambiguous');
});

test('HARNESS ONLY: "nothing changes" — listings, service containers, and §11 item 5 for absent volumes', () => {
  const services = [{ id: 'c1', name: 'qa-lti-service-1', startedAt: 's', created: 'c' }];
  const base = { lti: present([entry('lti.db')]), app: present([entry('cogniate.db'), { path: 'packages', type: 'dir', uid: 501, gid: 20, mode: '0700' }]) };
  const pres = { ltidb: labeled('2026-10-21T10:00:00Z'), appdb: labeled('2026-10-21T10:00:00Z') };
  const same = nothingChanged({ beforeListing: base, afterListing: base, beforePresence: pres, afterPresence: pres, beforeServices: services, afterServices: services, startSecond: 0 });
  assert.deepEqual(same, []);
  const changed = { ...base, lti: present([entry('lti.db', { sha256: 'b' })]) };
  assert.equal(nothingChanged({ beforeListing: base, afterListing: changed, beforePresence: pres, afterPresence: pres, beforeServices: services, afterServices: services, startSecond: 0 }).length, 2);
  const recreated = [{ ...services[0], startedAt: 's2' }];
  assert.ok(nothingChanged({ beforeListing: base, afterListing: base, beforePresence: pres, afterPresence: pres, beforeServices: services, afterServices: recreated, startSecond: 0 })
    .some((d) => /recreated/.test(d)));
  // Absent before; Compose made a labeled FRESH volume in the start second → allowed.
  const absent = { state: 'absent', entries: [] };
  const start = Date.UTC(2026, 9, 21, 10, 0, 0) / 1000;
  const ok = nothingChanged({ beforeListing: { lti: absent, app: absent }, afterListing: { lti: present([]), app: present([]) },
    beforePresence: { ltidb: { state: 'absent' }, appdb: { state: 'absent' } }, afterPresence: { ltidb: labeled('2026-10-21T10:00:00Z'), appdb: labeled('2026-10-21T10:00:01Z') },
    beforeServices: [], afterServices: [], startSecond: start });
  assert.deepEqual(ok, []);
  const early = nothingChanged({ beforeListing: { lti: absent, app: absent }, afterListing: { lti: present([]), app: present([]) },
    beforePresence: { ltidb: { state: 'absent' }, appdb: { state: 'absent' } }, afterPresence: { ltidb: labeled('2026-10-21T09:59:59Z'), appdb: { state: 'unsafe', record: {} } },
    beforeServices: [], afterServices: [], startSecond: start });
  assert.deepEqual(early.length, 2, 'An earlier creation second and an unlabeled appearance both fail');
  const notFresh = nothingChanged({ beforeListing: { lti: absent, app: absent }, afterListing: { lti: present([entry('lti.db')]), app: present([]) },
    beforePresence: { ltidb: { state: 'absent' }, appdb: { state: 'absent' } }, afterPresence: { ltidb: labeled('2026-10-21T10:00:00Z'), appdb: labeled('2026-10-21T10:00:00Z') },
    beforeServices: [], afterServices: [], startSecond: start });
  assert.ok(notFresh.some((d) => /not FRESH/.test(d)));
  assert.equal(freshVolume('app', present([{ path: 'packages', type: 'dir' }, { path: 'uploads', type: 'dir' }])), true);
  assert.equal(freshVolume('lti', present([{ path: 'packages', type: 'dir' }])), false, 'Mountpoints only in appdb');
  assert.deepEqual(listingDiff(base, base), []);
});

test('HARNESS ONLY: pair identities, file sets and the "equals B" database sets', () => {
  const id = (role, extra = {}) => ({ formatVersion: 1, role, pairId: 'f'.repeat(32), generation: 0, firstStart: 'pending', composeProject: 'qa-x', provenance: { kind: 'fresh' }, ...extra });
  assert.equal(assertPair({ lti: id('lti'), app: id('app') }, { kind: 'fresh', generation: 0, firstStart: 'pending', composeProject: 'qa-x' }), 'f'.repeat(32));
  assert.throws(() => assertPair({ lti: id('lti'), app: id('app', { pairId: 'e'.repeat(32) }) }), StorageFail);
  assert.throws(() => assertPair({ lti: id('lti'), app: null }), StorageFail);
  assert.throws(() => assertPair({ lti: id('lti'), app: id('app') }, { firstStart: 'completed' }), StorageFail);
  const fsA = { lti: { files: { 'lti.db': { present: true, size: 3, sha256: 'x' }, 'lti.db-wal': { present: false }, 'lti.db-shm': { present: false }, '.storage-identity.json': { present: true, size: 1, sha256: 'i' } } },
    app: { files: { 'cogniate.db': { present: true, size: 4, sha256: 'y' }, 'cogniate.db-wal': { present: true, size: 2, sha256: 'w' }, 'cogniate.db-shm': { present: false }, '.storage-identity.json': { present: true, size: 1, sha256: 'j' } } } };
  const sets = fileSets(fsA);
  assert.equal(sets.lti['lti.db-wal'], 'absent', '"absent" is a value');
  const manifest = { formatVersion: 1, files: [{ name: 'lti-service/lti.db', size: 3, sha256: 'd'.repeat(64) }, { name: 'not-a-db', size: 1, sha256: 'x'.repeat(64) }] };
  assert.deepEqual(Object.keys(manifestFiles(manifest)), ['lti-service/lti.db']);
  const m = { files: [{ name: 'lti-service/lti.db', size: 3, sha256: 'a'.repeat(64) }, { name: 'cogniate-app/cogniate.db', size: 4, sha256: 'b'.repeat(64) }] };
  const b = manifestDbSets(m);
  assert.equal(b.app['cogniate.db-wal'], 'absent');
  const inPlace = dbFileSets(fileSets({ lti: { files: { 'lti.db': { present: true, size: 3, sha256: 'a'.repeat(64) }, 'lti.db-wal': { present: false }, 'lti.db-shm': { present: false } } },
    app: { files: { 'cogniate.db': { present: true, size: 4, sha256: 'b'.repeat(64) }, 'cogniate.db-wal': { present: false }, 'cogniate.db-shm': { present: false } } } }));
  assert.equal(fileSetsEqual(inPlace, b), true);
  const withUnlisted = JSON.parse(JSON.stringify(inPlace)); withUnlisted.app['cogniate.db-wal'] = { size: 1, sha256: 'c', type: 'file' };
  assert.equal(fileSetsEqual(withUnlisted, b), false, 'An unlisted sidecar in place is not "equals B"');
  assert.equal(logicalShows({ lti: { markers: { p: 1 } }, app: { markers: { c: 0 } } }, { present: [{ vol: 'lti', value: 'p' }], absent: [{ vol: 'app', value: 'c' }] }), true);
  assert.equal(logicalShows({ lti: { markers: { p: 0 } }, app: { markers: {} } }, { present: [{ vol: 'lti', value: 'p' }] }), false);
});

test('HARNESS ONLY: legacy sets; QA removes only its own unchanged copies and never another legacy file', (t) => {
  const clone = tmp(t), src = path.join(clone, 'src.db');
  fs.writeFileSync(src, 'legacy bytes');
  assert.equal(legacyEmpty(legacySets(clone)), true, 'Absent folders are empty sets');
  const legacy = new LegacyFixtures(clone);
  const placed = legacy.place('lti-service', 'lti.db', src);
  assert.equal(placed.size, 12);
  assert.deepEqual(legacySets(clone)['lti-service'].map((f) => f.name), ['lti.db']);
  fs.writeFileSync(path.join(clone, 'infra/.data/cogniate-app-not-legacy'), 'x');
  legacy.removeAll();
  assert.equal(legacyEmpty(legacySets(clone)), true);
  const second = new LegacyFixtures(clone);
  second.place('cogniate-app', 'cogniate.db', src);
  fs.writeFileSync(path.join(clone, 'infra/.data/cogniate-app/cogniate.db-wal'), 'not QA');
  assert.throws(() => second.removeAll(), StorageBlocked, 'A legacy entry that QA did not place blocks; it stays');
  assert.ok(fs.existsSync(path.join(clone, 'infra/.data/cogniate-app/cogniate.db-wal')));
  const third = new LegacyFixtures(clone);
  third.place('lti-service', 'lti.db', src);
  fs.appendFileSync(path.join(clone, 'infra/.data/lti-service/lti.db'), 'changed outside QA');
  assert.throws(() => third.removeAll(), StorageBlocked, 'A changed QA copy is not removed');
  assert.throws(() => new LegacyFixtures(clone).place('lti-service', 'lti.db', src), StorageBlocked, 'Never overwrites a legacy file');
});

test('HARNESS ONLY: lock records and process groups use LC_ALL=C ps; a detached group can be killed and seen empty', async (t) => {
  const dir = tmp(t);
  const start = await pidStart(process.pid);
  assert.match(start, /^[A-Z][a-z]{2} [A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2} \d{4}$/, 'LC_ALL=C lstart form');
  const g = spawnGroup('bash', ['-c', 'sleep 30 & wait']);
  await until(async () => (await groupMembers(g.pgid)).length >= 2, { timeoutMs: 5000, what: 'two members' });
  assert.equal(await pgidOf(g.pid), g.pid, 'Its own process group');
  assert.equal(g.killGroup('SIGKILL'), true);
  await g.done;
  await until(async () => (await groupMembers(g.pgid)).length === 0, { timeoutMs: 5000, what: 'empty group' });
  assert.equal(await pidStart(g.pid), '', 'An ended pid has no lstart');
  const hash = writeRecordFolder(path.join(dir, 'storage-op.qa-x.lock'), { runId: '0123456789abcdef', pid: 1 });
  assert.equal(recordHash(path.join(dir, 'storage-op.qa-x.lock')), hash);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'storage-op.qa-x.lock')), ['owner.json'], 'No .tmp left');
  assert.throws(() => writeRecordFolder(path.join(dir, 'storage-op.qa-x.lock'), {}), 'The folder appears once');
});

test('HARNESS ONLY: a-lock-scope pairs per runId must not overlap', () => {
  const ev = (event, runId, ts, command = 'stack:up') => ({ event, runId, ts, command });
  const pairs = lockPairs([ev('storage_lock_acquired', 'a', '2026-10-21T10:00:00Z'), ev('storage_lock_released', 'a', '2026-10-21T10:00:10Z'),
    ev('storage_lock_acquired', 'b', '2026-10-21T10:00:11Z', 'stack:restart'), ev('storage_lock_released', 'b', '2026-10-21T10:00:20Z', 'stack:restart')]);
  assert.equal(pairs.length, 2); assert.equal(pairsDisjoint(pairs), true);
  assert.equal(pairsDisjoint([{ acquired: '2026-10-21T10:00:00Z', released: '2026-10-21T10:00:10Z' }, { acquired: '2026-10-21T10:00:05Z', released: '2026-10-21T10:00:12Z' }]), false);
});

test('HARNESS ONLY: QA hashes a backup folder itself', (t) => {
  const dir = tmp(t);
  fs.mkdirSync(path.join(dir, 'lti-service')); fs.writeFileSync(path.join(dir, 'lti-service/lti.db'), 'x');
  fs.symlinkSync('/etc/hosts', path.join(dir, 'link'));
  const h = hashFolder(dir);
  assert.equal(h['lti-service/lti.db'].size, 1); assert.equal(h.link.type, 'symlink');
});

// ---------------------------------------------------------------- a-serialize oracle (storage repair triage revision 4 §3.1)

const PG = 4242, T = Date.parse('2026-10-21T11:32:15.000Z');
const iso = (ms) => new Date(ms).toISOString();
const nano = (ms) => iso(ms).replace('Z', '123456Z'); // Docker form: nanoseconds
const ev = (event, runId, ms, extra = {}) => JSON.stringify({ event, ts: iso(ms), project: 'qa-x-st', command: 'stack:data-backup', runId, pid: PG, pgid: PG,
  owner: null, reason: null, waitedMs: 0, container: null, ...extra });
const sample = ({ o = 0, u = 1 } = {}) => ({ ok: true, h1: 1000, h2: 1000 + 2 * u, engineText: 'x', engine: 1000 + u + o, o, u });
/** A lock log with an older part before the offset, the run X after it, and services started 200 ms after X released. */
function scene({ pre = [], post, startOffsetMs = 200, samples = [sample(), sample()], waitLines = [], startedAt } = {}) {
  const head = pre.map((l) => l + '\n').join('');
  const body = (post ?? [ev('storage_lock_acquired', 'X', T), ev('storage_lock_released', 'X', T + 1000)]).map((l) => l + '\n').join('');
  const start = nano(T + 1000 + startOffsetMs);
  return { log: head + body, offset: Buffer.byteLength(head), pgid: PG, waitLines, samples, startedAt: startedAt ?? { 'lti-service': start, 'cogniate-app': start } };
}
const verdict = (input) => serializeVerdict(input);

test('HARNESS ONLY: V1 a-serialize: the backup run is identified by its pgid after the offset; PASS needs the own command and a later start', () => {
  const ok = verdict(scene({ waitLines: [{ event: 'storage_lock_wait', owner: { runId: 'X', pgid: PG } }] }));
  assert.deepEqual([ok.verdict, ok.selectedRunId, ok.cause], ['PASS', 'X', null]);
  assert.ok(ok.clock.margins['lti-service'].marginToHiMs > 0 && ok.clock.lo <= ok.clock.hi, 'Offsets, uncertainty and margins are recorded');
  assert.deepEqual(verdict(scene()).notes, ['no wait observed'], 'A missing wait line is allowed and recorded');
  // V1-1, V1-1b: a release with command null, or another command: the schema FAIL, with the run selected.
  for (const command of [null, '', 'stack:up']) {
    const v = verdict(scene({ post: [ev('storage_lock_acquired', 'X', T), ev('storage_lock_released', 'X', T + 1000, { command })] }));
    assert.deepEqual([v.verdict, v.selectedRunId, v.cause], ['FAIL', 'X', 'release event without the backup command (ADR-012 §7)'], String(command));
  }
  const nullAcquire = verdict(scene({ post: [ev('storage_lock_acquired', 'X', T, { command: null }), ev('storage_lock_released', 'X', T + 1000, { command: null })] }));
  assert.equal(nullAcquire.cause, 'release event without the backup command (ADR-012 §7)', 'Two null commands are never equal');
  // V1-2, V1-11: no release of X (a release of another run with the backup command, or only an older release before the offset).
  assert.equal(verdict(scene({ post: [ev('storage_lock_acquired', 'X', T), ev('storage_lock_released', 'Y', T + 1000, { pgid: 7 })] })).cause, 'no release for the backup run');
  assert.equal(verdict(scene({ pre: [ev('storage_lock_released', 'X', T - 5000)], post: [ev('storage_lock_acquired', 'X', T)] })).cause, 'no release for the backup run');
  // V1-3: X released before the start; a later release Z of another run with the backup command after it: PASS on X.
  const v3 = verdict(scene({ post: [ev('storage_lock_acquired', 'X', T), ev('storage_lock_released', 'X', T + 1000), ev('storage_lock_acquired', 'Z', T + 2000, { pgid: 9 }), ev('storage_lock_released', 'Z', T + 3000, { pgid: 9 })] }));
  assert.deepEqual([v3.verdict, v3.selectedRunId], ['PASS', 'X']);
  // V1-4: X released after a start: FAIL on time.
  assert.equal(verdict(scene({ startOffsetMs: -500 })).cause, 'service started before the backup released the lock');
  // V1-6: an older pair W before the offset (also with the same pgid), released before the start; X released after it.
  const v6 = verdict(scene({ pre: [ev('storage_lock_acquired', 'W', T - 9000), ev('storage_lock_released', 'W', T - 8000)], startOffsetMs: -500 }));
  assert.deepEqual([v6.cause, v6.selectedRunId], ['service started before the backup released the lock', 'X']);
  // V1-8: zero or two acquire events with the spawned pgid after the offset.
  assert.equal(verdict(scene({ post: [ev('storage_lock_acquired', 'X', T, { pgid: 5 }), ev('storage_lock_released', 'X', T + 1000)] })).cause, 'backup run not identified');
  assert.equal(verdict(scene({ post: [ev('storage_lock_acquired', 'X', T), ev('storage_lock_acquired', 'X2', T + 1), ev('storage_lock_released', 'X', T + 1000)] })).cause, 'backup run not identified');
  // V1-9: stack:up waited on another run (runId or pgid).
  assert.equal(verdict(scene({ waitLines: [{ event: 'storage_lock_wait', owner: { runId: 'Y', pgid: PG } }] })).cause, 'stack:up waited on another run');
  assert.equal(verdict(scene({ waitLines: [{ event: 'storage_lock_wait', owner: { runId: 'X', pgid: 1 } }] })).cause, 'stack:up waited on another run');
  // V1-10: a margin inside the uncertainty; an engine offset of +2 s that hides a start 1 s before the release.
  assert.equal(verdict(scene({ startOffsetMs: 5, samples: [sample({ u: 10 }), sample({ u: 10 })] })).cause, 'clock uncertainty');
  const hidden = verdict(scene({ samples: [sample({ o: 2000, u: 1 }), sample({ o: 2000, u: 1 })], startedAt: { 'lti-service': nano(T + 1000 + 2000 - 1000), 'cogniate-app': nano(T + 1000 + 2000 - 1000) } }));
  assert.equal(hidden.cause, 'service started before the backup released the lock');
  assert.equal(verdict(scene({ samples: [sample({ o: 2000 }), sample({ o: 2000 })], startedAt: { 'lti-service': nano(T + 1000 + 2100), 'cogniate-app': nano(T + 1000 + 2100) } })).verdict, 'PASS');
  // V1-13: a lock log shorter than its offset; V1-14: two releases of X; V1-15: one failed clock sample.
  const s13 = scene(); assert.equal(verdict({ ...s13, offset: Buffer.byteLength(s13.log) + 1 }).cause, 'lock log truncated');
  assert.equal(verdict(scene({ post: [ev('storage_lock_acquired', 'X', T), ev('storage_lock_released', 'X', T + 1000), ev('storage_lock_released', 'X', T + 1001)] })).cause, 'more than one release for the backup run');
  assert.equal(verdict(scene({ samples: [sample(), { ok: false, error: 'exit 1' }] })).cause, 'clock not measured');
  assert.equal(verdict(scene({ samples: [sample()] })).cause, 'clock not measured');
  assert.equal(verdict(scene({ startedAt: { 'lti-service': nano(T + 2000) } })).cause, 'no StartedAt for cogniate-app');
});

test('HARNESS ONLY: V1-7 the wait ends only on a sign of the spawned pgid; an older acquire and record of W never end it', async () => {
  const pre = ev('storage_lock_acquired', 'W', T - 9000) + '\n', offset = Buffer.byteLength(pre);
  let log = pre, record = { runId: 'W', pgid: 77, command: 'stack:data-backup' }, polls = 0, clock = 0;
  const readLog = () => { polls++; if (polls === 4) log += ev('storage_lock_acquired', 'X', T) + '\n'; return log; };
  const waited = await waitForRun({ readLog, readRecord: () => record, offset, pgid: PG, timeoutMs: 60_000, now: () => clock, sleep: async () => { clock += 50; } });
  assert.deepEqual([waited, polls], [{ by: 'event' }, 4], 'Not before the sign of this run');
  polls = 0; log = pre;
  const viaRecord = await waitForRun({ readLog: () => log, readRecord: () => (++polls >= 3 ? { runId: 'X', pgid: PG } : record), offset, pgid: PG, now: () => clock, sleep: async () => { clock += 50; } });
  assert.deepEqual(viaRecord, { by: 'record' });
  clock = 0;
  assert.equal(await waitForRun({ readLog: () => pre, readRecord: () => record, offset, pgid: PG, timeoutMs: 1000, now: () => clock, sleep: async () => { clock += 100; } }), null, 'Deadline: not identified');
  assert.equal(await waitForRun({ readLog: () => pre + ev('storage_lock_acquired', 'X', T, { pgid: 1 }) + '\n', readRecord: () => null, offset, pgid: PG, timeoutMs: 200, now: () => clock, sleep: async () => { clock += 100; } }), null, 'Another pgid never ends it');
});

test('HARNESS ONLY: clock samples and RFC 3339 times keep sub-millisecond precision; a failed engine read is not a sample', async () => {
  // The fraction below the millisecond is kept (within the binary precision of an epoch millisecond number, about 0.0003 ms).
  assert.ok(Math.abs(timeMs('2026-10-21T11:32:16.117395837Z') - Date.parse('2026-10-21T11:32:16.117Z') - 0.395837) < 0.001, 'No flooring below the millisecond');
  assert.ok(Math.abs(timeMs('2026-10-21T13:32:16.5+02:00') - Date.parse('2026-10-21T11:32:16.500Z')) < 1e-6);
  assert.equal(timeMs('not a time'), null);
  let n = 0;
  const s = await clockSample(async () => ({ code: 0, stdout: '2026-10-21T11:32:16.117395837Z\n' }), () => (n++ === 0 ? Date.parse('2026-10-21T11:32:16.100Z') : Date.parse('2026-10-21T11:32:16.110Z')));
  assert.deepEqual([s.ok, s.u], [true, 5]); assert.ok(Math.abs(s.o - 12.395837) < 0.001);
  assert.equal((await clockSample(async () => ({ code: 1, stdout: '', stderr: 'down' }))).ok, false);
  assert.equal((await clockSample(async () => { throw new Error('no docker'); })).ok, false);
});

// ---------------------------------------------------------------- V1-12: the row's exact spawn path, with a fail-closed Docker stub

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** The V1-12 decision over one probe: the identity premise of §3.1 holds through the npm hop. */
export function judgeBackupSpawn({ events, calls, exit, lockLeft, pgid }) {
  const problems = [];
  const acquires = events.filter((e) => e.event === 'storage_lock_acquired');
  if (acquires.length !== 1) problems.push(`${acquires.length} storage_lock_acquired events`);
  const a = acquires[0];
  if (a && a.pgid !== pgid) problems.push(`acquire pgid ${a.pgid} is not the spawned pgid ${pgid}`);
  if (a && a.command !== 'stack:data-backup') problems.push(`acquire command ${JSON.stringify(a.command)} is not stack:data-backup`);
  if (!calls.length) problems.push('no Docker call reached the stub');
  else if (!(calls[0].lockHeld && a && calls[0].lockLogBytes >= a.endByte)) problems.push('the first Docker call came before the acquire event');
  if (calls.some((c) => c.answer !== 97)) problems.push('the stub answered a call with success');
  if (exit === 0) problems.push('the command exited 0 although Docker refused');
  if (lockLeft) problems.push('a lock folder remains');
  return problems;
}
test('HARNESS ONLY: V1-12 npm run stack:data-backup through spawnGroup: one acquire with the spawned pgid and the own command; no real Docker', async (t) => {
  const head = spawnSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  assert.equal(head.status, 0, 'BLOCKED (precondition not made): V1-12 needs the git checkout of the candidate');
  const candidate = head.stdout.trim();
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-v1-12-'))); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const copy = path.join(dir, 'copy'), stubDir = path.join(dir, 'stub'), callsFile = path.join(dir, 'stub-calls.jsonl'), out = path.join(dir, 'out');
  fs.mkdirSync(copy); fs.mkdirSync(stubDir);
  // The tracked package.json and infra/ of the candidate SHA (committed bytes only; no .env).
  assert.equal(spawnSync('git', ['-C', REPO, 'archive', '--format=tar', '--output', path.join(dir, 'c.tar'), candidate, 'package.json', 'infra']).status, 0);
  assert.equal(spawnSync('tar', ['-xf', path.join(dir, 'c.tar'), '-C', copy]).status, 0);
  assert.equal(fs.existsSync(path.join(copy, '.env')), false);
  const project = 'qa-v112-' + crypto.randomBytes(3).toString('hex');
  const lockDir = path.join(copy, '.tmp', `storage-op.${project}.lock`), lockLog = path.join(copy, 'infra/.logs/storage-lock.jsonl');
  fs.writeFileSync(path.join(stubDir, 'docker'), `#!${process.execPath}
const fs = require('node:fs');
const size = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };
fs.appendFileSync(${JSON.stringify(callsFile)}, JSON.stringify({ argv: process.argv.slice(2), lockHeld: fs.existsSync(${JSON.stringify(lockDir)}), lockLogBytes: size(${JSON.stringify(lockLog)}), answer: 97 }) + '\\n');
process.stderr.write('qa fail-closed docker stub: refused\\n');
process.exit(97);
`, { mode: 0o700 });
  // The row's environment rule: no npm_* variable (in any case), a qa- project; npm's own temporary files stay in this probe.
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/i.test(k))), COMPOSE_PROJECT_NAME: project,
    PUBLIC_PORT: '8443', STACK_SUBNET: '172.31.250.0/24', PATH: stubDir + path.delimiter + process.env.PATH, TMPDIR: dir };
  assert.ok(!Object.keys(env).some((k) => /^npm_/i.test(k)), 'No npm_* environment key');
  // Probe-only configuration, apart from the archived candidate files: a scratch .npmrc turns off npm's network checks.
  const npmrc = path.join(copy, '.npmrc'), npmrcLines = ['update-notifier=false', 'fund=false', 'audit=false'];
  const archived = spawnSync('tar', ['-tf', path.join(dir, 'c.tar')], { encoding: 'utf8' }).stdout.split('\n');
  assert.ok(!archived.some((n) => /(^|\/)\.npmrc$/.test(n)), 'The candidate archive has no .npmrc');
  fs.writeFileSync(npmrc, npmrcLines.join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  assert.equal(fs.lstatSync(npmrc).mode & 0o7777, 0o600);
  const homeRc = path.join(os.homedir(), '.npmrc'), homeBefore = fs.existsSync(homeRc) ? crypto.createHash('sha256').update(fs.readFileSync(homeRc)).digest('hex') : null;
  const notifier = spawnSync('npm', ['config', 'get', 'update-notifier'], { env, cwd: copy, encoding: 'utf8' }).stdout.trim();
  assert.equal(notifier, 'false', 'npm reads the scratch .npmrc');
  const which = spawnSync('/bin/sh', ['-c', 'command -v docker'], { env, encoding: 'utf8' });
  assert.equal(which.stdout.trim(), path.join(stubDir, 'docker'), 'docker resolves to the fail-closed stub first on PATH');
  const npmVersion = spawnSync('npm', ['--version'], { env, cwd: copy, encoding: 'utf8' }).stdout.trim();
  const g = spawnGroup('npm', ['run', 'stack:data-backup', '--', '--out', out], { cwd: copy, env });
  const timer = setTimeout(() => g.killGroup('SIGKILL'), 90_000);
  const done = await g.done; clearTimeout(timer);
  const text = fs.existsSync(lockLog) ? fs.readFileSync(lockLog, 'utf8') : '';
  let at = 0; const events = text.split('\n').filter(Boolean).map((line) => { at += Buffer.byteLength(line) + 1; return { ...JSON.parse(line), endByte: at }; });
  const calls = readJsonl(callsFile);
  const homeAfter = fs.existsSync(homeRc) ? crypto.createHash('sha256').update(fs.readFileSync(homeRc)).digest('hex') : null;
  assert.equal(homeAfter, homeBefore, 'The real user npm configuration is unchanged');
  t.diagnostic(JSON.stringify({ candidate, npmVersion, argv: ['npm', 'run', 'stack:data-backup', '--', '--out', '<probe>/out'], probeConfig: { file: '<copy>/.npmrc', lines: npmrcLines, mode: '0600' },
    project, exit: done.code, events: events.map((e) => e.event), stubCalls: calls.length, stubAnswers: [...new Set(calls.map((c) => c.answer))] }));
  assert.deepEqual(judgeBackupSpawn({ events, calls, exit: done.code, lockLeft: fs.existsSync(lockDir), pgid: g.pgid }), [], done.stdout + done.stderr);
  // The decision discriminates: another acquire command, a pgid premise that fails through the hop, a success answer.
  const good = { events, calls, exit: done.code, lockLeft: false, pgid: g.pgid };
  assert.ok(judgeBackupSpawn({ ...good, events: events.map((e) => ({ ...e, command: e.event === 'storage_lock_acquired' ? 'stack:up' : e.command })) }).length);
  assert.ok(judgeBackupSpawn({ ...good, pgid: g.pgid + 1 }).length);
  assert.ok(judgeBackupSpawn({ ...good, calls: [{ ...calls[0], answer: 0 }] }).length);
  assert.ok(judgeBackupSpawn({ ...good, calls: [{ ...calls[0], lockLogBytes: 0 }] }).length);
});
