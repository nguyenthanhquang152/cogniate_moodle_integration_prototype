// HARNESS ONLY: QA's AC-M1-41 oracles on synthetic values and host temporary folders. No Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StorageBlocked, StorageFail } from './storage-docker.mjs';
import {
  LegacyFixtures, assertPair, assertRefuses, dbFileSets, fileSets, fileSetsEqual, freshVolume, groupMembers, hashFolder, jsonLines,
  legacyEmpty, legacySets, listingDiff, lockPairs, logicalShows, manifestDbSets, manifestFiles, namesCode, nothingChanged,
  pairsDisjoint, pidStart, pgidOf, preflightOf, recordHash, spawnGroup, until, writeRecordFolder,
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
