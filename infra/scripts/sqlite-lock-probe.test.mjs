// Unit tests of the storage preflight (ADR-012 §3–§6) on host temp folders (run: npm run test:infra).
// Host folders stand in for the two volumes: the state table, the preparation, the initialization and the lock probe
// are the same code. The host filesystem enforces SQLite locks here; the negative case uses the selftest scenario.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, it } from 'node:test';
import {
  IDENTITY, JOURNAL, allowedType, classifyJournals, evaluateState, main, newIdentity, probeFolder, readFolder, writeJsonDurable,
} from './sqlite-lock-probe.mjs';

const UID = process.getuid();
const GID = process.getgid();
const temps = [];
afterEach(() => { for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true }); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-test-')); temps.push(d); return d; };
function pair() {
  const root = tmp();
  const lti = path.join(root, 'lti'); const app = path.join(root, 'app');
  fs.mkdirSync(lti); fs.mkdirSync(app);
  return { root, lti, app };
}
const state = (p, project = 'p1', over = {}) => evaluateState({ lti: readFolder(p.lti, 'lti'), app: readFolder(p.app, 'app') }, { project, hostUid: UID, hostGid: GID, ...over }).state;
const id = (role, over = {}) => ({ ...newIdentity({ project: 'p1', role, pairId: 'a'.repeat(32) }), ...over });
const journal = (opId, st) => ({ formatVersion: 1, operation: 'restore', opId, backupId: null, manifestSha256: null, pairIdBefore: null, generationBefore: null, state: st, before: [], after: [], identityBefore: null, updatedAt: 'x' });
const touch = (dir, name, body = '') => fs.writeFileSync(path.join(dir, name), body);
const write = (dir, name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
const run = async (argv) => {
  const lines = [];
  const code = await main(argv, { env: { ...process.env, HOST_UID: String(UID), HOST_GID: String(GID) }, emit: (ls) => lines.push(...ls) });
  return { code, lines, summary: lines.find((l) => l.event === 'storage_preflight_summary') };
};
const args = (mode, p, extra = []) => [mode, '--run-id', '0123456789abcdef', '--project', 'p1', '--folder', `lti=${p.lti}`, '--folder', `app=${p.app}`, ...extra];

describe('allowed direct children (§3)', () => {
  it('names, types and the role of each database', () => {
    assert.equal(allowedType('lti', 'lti.db'), 'file');
    assert.equal(allowedType('lti', 'lti.db-wal'), 'file');
    assert.equal(allowedType('lti', 'cogniate.db'), null); // only in its own volume
    assert.equal(allowedType('app', 'cogniate.db-shm'), 'file');
    assert.equal(allowedType('app', 'lti.db'), null);
    assert.equal(allowedType('lti', `${IDENTITY}.tmp`), 'file');
    assert.equal(allowedType('lti', `.restore-${'a'.repeat(32)}`), 'dir');
    assert.equal(allowedType('lti', `.restore-${'a'.repeat(31)}`), null);
    assert.equal(allowedType('lti', `.lock-probe-${'b'.repeat(16)}.db-wal`), 'file');
    assert.equal(allowedType('lti', `.qa-scratch-${'c'.repeat(16)}`), 'dir');
    assert.equal(allowedType('app', 'packages'), 'mountpoint');
    assert.equal(allowedType('lti', 'packages'), null);
    assert.equal(allowedType('lti', 'lti.db-journal'), null);
  });
});

describe('journal classification (§8 recovery table)', () => {
  const X = '1'.repeat(32); const Y = '2'.repeat(32);
  const cases = [
    [null, null, 'R0'], [journal(X, 'committed'), null, 'R0'], [journal(X, 'rolled_back'), journal(Y, 'committed'), 'R0'],
    [journal(X, 'prepared'), null, 'R1'], [journal(X, 'prepared'), journal(Y, 'rolled_back'), 'R1'],
    [journal(X, 'prepared'), journal(X, 'prepared'), 'R2'], [journal(X, 'staged'), journal(X, 'rolled_back'), 'R2'],
    [journal(X, 'swapped'), journal(X, 'staged'), 'R3'], [journal(X, 'rolling_back'), journal(X, 'swapped'), 'R3'], [journal(X, 'committed'), journal(X, 'swapping'), 'R3'],
    [journal(X, 'committed'), journal(X, 'swapped'), 'R4'],
    [journal(X, 'rollback_failed'), journal(X, 'swapped'), 'R5'],
    [journal(X, 'staged'), null, 'R6'], [null, journal(X, 'prepared'), 'R6'], [journal(X, 'prepared'), journal(Y, 'prepared'), 'R6'], [{ invalid: true }, null, 'R6'],
  ];
  for (const [l, a, row] of cases) {
    it(`lti ${l?.state ?? (l?.invalid ? 'invalid' : 'absent')} / app ${a?.state ?? 'absent'} → ${row}`, () => assert.equal(classifyJournals(l, a).row, row));
  }
});

describe('start-state table (§6): the first matching row', () => {
  it('FRESH: empty volumes (mountpoints allowed); rows 13 and 18', () => {
    const p = pair();
    assert.equal(state(p), 'FRESH');
    fs.mkdirSync(path.join(p.app, 'packages'));
    assert.equal(state(p), 'FRESH');
    write(p.lti, JOURNAL, journal('1'.repeat(32), 'rolled_back'));
    assert.equal(state(p), 'FRESH');
    write(p.lti, JOURNAL, journal('1'.repeat(32), 'committed'));
    assert.equal(state(p), 'state_unclassified'); // a committed journal with no identity
  });
  it('rows 1–3 come first (journal gate), also with a broken identity', () => {
    const p = pair();
    write(p.lti, IDENTITY, { broken: true });
    write(p.lti, JOURNAL, journal('1'.repeat(32), 'rollback_failed'));
    assert.equal(state(p), 'rollback_failed');
    write(p.lti, JOURNAL, journal('1'.repeat(32), 'swapped'));
    assert.equal(state(p), 'journal_inconsistent'); // app journal absent next to an open lti journal of a swap
    write(p.app, JOURNAL, journal('1'.repeat(32), 'staged'));
    assert.equal(state(p), 'journal_open');
  });
  it('row 4 unknown_entry (also a symbolic link and a wrong type); row 5 mountpoints; row 6 owners', () => {
    const p = pair();
    touch(p.lti, 'lti.db-journal');
    assert.equal(state(p), 'unknown_entry');
    fs.rmSync(path.join(p.lti, 'lti.db-journal'));
    fs.symlinkSync('/etc/hosts', path.join(p.lti, 'lti.db'));
    assert.equal(state(p), 'unknown_entry');
    fs.rmSync(path.join(p.lti, 'lti.db'));
    fs.mkdirSync(path.join(p.lti, IDENTITY));
    assert.equal(state(p), 'unknown_entry');
    fs.rmSync(path.join(p.lti, IDENTITY), { recursive: true });
    fs.mkdirSync(path.join(p.app, 'uploads'));
    touch(path.join(p.app, 'uploads'), 'x');
    assert.equal(state(p), 'mountpoint_unsafe');
    fs.rmSync(path.join(p.app, 'uploads'), { recursive: true });
    fs.symlinkSync(p.lti, path.join(p.app, 'uploads'));
    assert.equal(state(p), 'mountpoint_unsafe');
    fs.rmSync(path.join(p.app, 'uploads'));
    touch(p.lti, 'lti.db');
    assert.equal(state(p, 'p1', { hostUid: UID + 1 }), 'owner_mismatch');
  });
  it('rows 7–12: identity_invalid, identity_project, identity_mismatch, FRESH_INIT_PARTIAL, identity_missing, db_without_identity', () => {
    const p = pair();
    write(p.lti, IDENTITY, { ...id('lti'), role: 'app' });
    assert.equal(state(p), 'identity_invalid');
    write(p.lti, IDENTITY, id('lti'));
    assert.equal(state(p, 'other'), 'identity_project');
    write(p.app, IDENTITY, id('app', { generation: 1 }));
    assert.equal(state(p), 'identity_mismatch');
    fs.rmSync(path.join(p.app, IDENTITY));
    assert.equal(state(p), 'FRESH_INIT_PARTIAL');
    write(p.lti, IDENTITY, id('lti', { firstStart: 'completed' }));
    assert.equal(state(p), 'identity_missing');
    fs.rmSync(path.join(p.lti, IDENTITY));
    touch(p.app, 'cogniate.db');
    assert.equal(state(p), 'db_without_identity');
  });
  it('rows 14–17: FIRST_START, half_pair, no_databases, OK', () => {
    const p = pair();
    write(p.lti, IDENTITY, id('lti')); write(p.app, IDENTITY, id('app'));
    assert.equal(state(p), 'FIRST_START');
    touch(p.lti, 'lti.db');
    assert.equal(state(p), 'FIRST_START');
    touch(p.app, 'cogniate.db');
    assert.equal(state(p), 'OK'); // both pending, both databases: check completes them
    fs.rmSync(path.join(p.app, 'cogniate.db'));
    write(p.lti, IDENTITY, id('lti', { firstStart: 'completed' }));
    assert.equal(state(p), 'half_pair');
    fs.rmSync(path.join(p.lti, 'lti.db'));
    assert.equal(state(p), 'no_databases');
  });
});

describe('the lock probe (§5 steps 7–10)', () => {
  it('pass with a live holder and a positive release; no scratch left', async () => {
    const d = tmp();
    const r = await probeFolder(d, 'abcdefabcdefabcd');
    assert.equal(r.result, 'pass', JSON.stringify(r));
    assert.equal(typeof r.waits.busyMs, 'number');
    assert.deepEqual(fs.readdirSync(d), []);
  });
  it('no-hold → lock_not_enforced; holder-dies → probe_error; no scratch left', async () => {
    const d = tmp();
    assert.equal((await probeFolder(d, 'abcdefabcdefabce', { scenario: 'no-hold' })).reason, 'lock_not_enforced');
    assert.equal((await probeFolder(d, 'abcdefabcdefabcf', { scenario: 'holder-dies' })).reason, 'probe_error');
    assert.deepEqual(fs.readdirSync(d), []);
  });
});

describe('modes (main)', () => {
  it('usage errors exit 2', async () => {
    assert.equal((await run(['check'])).code, 2);
    assert.equal((await run(['report', '--run-id', 'xyz', '--project', 'p', '--folder', 'lti=/a', '--folder', 'app=/b'])).code, 2);
    assert.equal((await run(['report', '--run-id', '0123456789abcdef', '--project', 'p', '--prepare', '--folder', 'lti=/a', '--folder', 'app=/b'])).code, 2);
    assert.equal((await run(['probe', '--run-id', '0123456789abcdef'])).code, 2);
  });
  it('check --prepare on a FRESH pair: mountpoints 0700, two pending fresh identities with one pairId, then FIRST_START', async () => {
    const p = pair();
    const r = await run(args('check', p, ['--prepare']));
    assert.equal(r.code, 0, JSON.stringify(r.lines));
    assert.equal(r.lines[0].state, 'FRESH');
    assert.equal(fs.statSync(path.join(p.app, 'packages')).mode & 0o777, 0o700);
    assert.equal(fs.statSync(p.lti).mode & 0o777, 0o700);
    const a = JSON.parse(fs.readFileSync(path.join(p.lti, IDENTITY), 'utf8'));
    const b = JSON.parse(fs.readFileSync(path.join(p.app, IDENTITY), 'utf8'));
    assert.equal(a.pairId, b.pairId);
    assert.deepEqual([a.role, b.role, a.generation, a.firstStart, a.provenance.kind], ['lti', 'app', 0, 'pending', 'fresh']);
    assert.equal((await run(args('check', p, ['--prepare']))).lines[0].state, 'FIRST_START');
  });
  it('FRESH_INIT_PARTIAL: check writes the missing identity with the same pairId', async () => {
    const p = pair();
    await run(args('check', p, ['--prepare']));
    const pairId = JSON.parse(fs.readFileSync(path.join(p.lti, IDENTITY), 'utf8')).pairId;
    fs.rmSync(path.join(p.app, IDENTITY));
    const r = await run(args('check', p, ['--prepare']));
    assert.equal(r.lines[0].state, 'FRESH_INIT_PARTIAL');
    assert.equal(JSON.parse(fs.readFileSync(path.join(p.app, IDENTITY), 'utf8')).pairId, pairId);
  });
  it('OK with pending identities → check completes them; mark-started refuses a pair that is not OK', async () => {
    const p = pair();
    await run(args('check', p, ['--prepare']));
    assert.equal((await run(args('mark-started', p))).code, 1);
    touch(p.lti, 'lti.db'); touch(p.app, 'cogniate.db');
    const r = await run(args('check', p, ['--prepare']));
    assert.equal(r.lines[0].state, 'OK');
    assert.equal(JSON.parse(fs.readFileSync(path.join(p.app, IDENTITY), 'utf8')).firstStart, 'completed');
  });
  it('check removes probe scratch and .tmp leftovers; the journal gate refuses before any change', async () => {
    const p = pair();
    await run(args('check', p, ['--prepare']));
    touch(p.lti, '.lock-probe-0000000000000000.db'); touch(p.lti, `${IDENTITY}.tmp`);
    assert.equal((await run(args('check', p, ['--prepare']))).code, 0);
    assert.deepEqual(fs.readdirSync(p.lti).sort(), [IDENTITY]);
    write(p.lti, JOURNAL, journal('1'.repeat(32), 'prepared'));
    const before = fs.readdirSync(p.app).sort();
    const r = await run(args('check', p, ['--prepare']));
    assert.equal(r.code, 1);
    assert.deepEqual(r.summary.reasons, ['journal_open']);
    assert.deepEqual(fs.readdirSync(p.app).sort(), before);
  });
  it('report: per-folder lines, identity lines (legacySources), a summary; refusal codes fail with the entry', async () => {
    const p = pair();
    await run(args('check', p, ['--prepare']));
    const r = await run(args('report', p));
    assert.equal(r.code, 0);
    assert.deepEqual(r.lines.map((l) => l.event), ['storage_preflight', 'storage_preflight', 'storage_report_identity', 'storage_report_identity', 'storage_preflight_summary']);
    assert.deepEqual(r.lines[2].legacySources, []);
    touch(p.app, 'stray.txt');
    const bad = await run(args('report', p));
    assert.deepEqual([bad.code, bad.summary.reasons], [1, ['unknown_entry:app:stray.txt']]);
  });
  it('a root-step failure is reported after the drop: a fixed §6 code of the step-1 snapshot first, then prepare_failed; nothing written', { skip: UID === 0 }, async () => {
    const env = { ...process.env, HOST_UID: String(UID + 1), HOST_GID: String(GID) }; // chown to another user fails: EPERM
    const go = async (p) => {
      const lines = [];
      const code = await main(args('check', p, ['--prepare']), { env, emit: (ls) => lines.push(...ls) });
      return { code, summary: lines.find((l) => l.event === 'storage_preflight_summary'), state: lines[0].state };
    };
    const p = pair();
    touch(p.lti, 'lti.db');
    const r = await go(p);
    assert.equal(r.code, 1);
    assert.deepEqual(r.summary.reasons, ['owner_mismatch:lti:lti.db', 'prepare_failed:lti: EPERM', 'prepare_failed:app: EPERM']);
    assert.equal(r.state, 'owner_mismatch');
    const empty = pair();
    const e = await go(empty);
    assert.deepEqual([e.code, e.state, e.summary.reasons], [1, null, ['prepare_failed:lti: EPERM', 'prepare_failed:app: EPERM']]);
    assert.deepEqual([fs.readdirSync(empty.lti), fs.readdirSync(empty.app)], [[], []]);
  });
  it('writeJsonDurable leaves no .tmp file', () => {
    const d = tmp();
    writeJsonDurable(d, IDENTITY, { a: 1 });
    assert.deepEqual(fs.readdirSync(d), [IDENTITY]);
  });
  it('selftest: three scenarios ok in an empty folder; a non-empty folder is a usage error', async () => {
    const d = tmp();
    const r = await run(['selftest', '--run-id', '0123456789abcdef', '--folder', `self=${d}`]);
    assert.equal(r.code, 0);
    assert.deepEqual(r.lines.map((l) => [l.scenario, l.observed, l.ok]), [['normal', 'pass', true], ['no-hold', 'lock_not_enforced', true], ['holder-dies', 'probe_error', true]]);
    touch(d, 'x');
    assert.equal((await run(['selftest', '--run-id', '0123456789abcdef', '--folder', `self=${d}`])).code, 2);
  });
  it('a real WAL database in a folder is reported as present (OK after both exist)', async () => {
    const p = pair();
    await run(args('check', p, ['--prepare']));
    for (const [dir, name] of [[p.lti, 'lti.db'], [p.app, 'cogniate.db']]) { const db = new DatabaseSync(path.join(dir, name)); db.exec('PRAGMA journal_mode=WAL; CREATE TABLE t(x)'); db.close(); }
    assert.equal((await run(args('report', p))).lines[0].state, 'OK');
  });
});
