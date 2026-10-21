// HARNESS ONLY: the drivers of the storage repair (triage revision 4 §9 step 7, §9.1) with recorded or stub children.
// No real migration or storage child, no Docker. V8-5: the full-mode rounds (Lead R2-03 seam); V8-6: the diagnostic
// run-or-stop rule (Lead B-SR-02) with each stop cause, and the owned teardown and strict W4 that always run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeHandoff } from './m1-migration.mjs';
import { FULL_PHASES } from './m1-phases.mjs';
import { CONFIG_DIFF_REMOVALS, MIGRATION_SCAN_POINTS, diagnosticRun, fullRounds, windowCause } from './storage-diagnostic.mjs';
import { WINDOW_FORM } from './storage-handoff.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567', TEST_SHA = 'f'.repeat(40), BASE = 'qa-multi-r1';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const twoMsAfter = async (raw) => { while (Date.now() < raw + 2) await pause(1); };
const tmp = (t) => { const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-drivers-'))); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

test('HARNESS ONLY: V8-5 the full mode: one fresh handoff path and one new QA_M1_WINDOW_START per round; phases, order and variables unchanged', async (t) => {
  const scratch = tmp(t), args = ['--sha', SHA, '--test-sha', TEST_SHA, '--source', '/q/source'];
  const calls = [], rounds = [];
  let lastEnd = 0;
  const childRun = async (childArgs, env, resultFile) => {
    calls.push({ args: childArgs, env, resultFile, at: Date.now(), prevEnd: lastEnd, handoffBefore: fs.existsSync(env.QA_M1_HANDOFF_FILE) });
    if (childArgs[1] === 'migration') writeHandoff({ CLONE: '/q/clone' }, '/q/backup', env.QA_M1_HANDOFF_FILE);
    await pause(3); lastEnd = Date.now(); await pause(3); // B-SR-04: the end of a child and the next window start are 2 ms or more apart
    return [{ id: childArgs[1] }];
  };
  const runs = await fullRounds({ childRun, scratch, baseProject: BASE, args, print: () => {}, onRound: (round, rows) => rounds.push([round, rows.length]) });
  assert.deepEqual(rounds, [[1, 5], [2, 5]]); assert.equal(runs.length, 2);
  assert.deepEqual(calls.map((c) => c.args), [1, 2].flatMap(() => FULL_PHASES.map((phase) => ['--phase', phase, ...args])), 'The phases, their order and the arguments');
  const windows = [];
  for (const round of [1, 2]) {
    const mine = calls.slice((round - 1) * FULL_PHASES.length, round * FULL_PHASES.length);
    const handoff = path.join(scratch, `round-${round}-handoff.json`);
    for (const [i, c] of mine.entries()) {
      const phase = FULL_PHASES[i], windowed = phase === 'migration' || phase === 'storage';
      const want = { QA_M1_RESULTS_FILE: path.join(scratch, `round-${round}-${phase}.json`), QA_M1_HANDOFF_FILE: handoff,
        ...(phase === 'storage' ? { COMPOSE_PROJECT_NAME: `${BASE}-st` } : {}), ...(windowed ? { QA_M1_WINDOW_START: c.env.QA_M1_WINDOW_START } : {}) };
      assert.deepEqual(c.env, want, `round ${round} ${phase}: the variables`);
      assert.equal(c.resultFile, want.QA_M1_RESULTS_FILE);
    }
    const m = mine[FULL_PHASES.indexOf('migration')], s = mine[FULL_PHASES.indexOf('storage')];
    assert.match(m.env.QA_M1_WINDOW_START, WINDOW_FORM);
    assert.equal(s.env.QA_M1_WINDOW_START, m.env.QA_M1_WINDOW_START, 'The storage child gets the same window start');
    const w = Date.parse(m.env.QA_M1_WINDOW_START);
    assert.ok(m.prevEnd > 0 && m.prevEnd < w && w <= m.at, `w is after the previous child ended and before the migration child (${m.prevEnd} < ${w} <= ${m.at})`);
    assert.equal(m.handoffBefore, false, 'The handoff path is absent before the migration child');
    windows.push({ w, handoff });
  }
  assert.notEqual(windows[0].handoff, windows[1].handoff, 'Round 2 has another handoff path');
  assert.ok(windows[1].w > windows[0].w, 'and a later window start');
});

const MIGRATION_IDS = ['M1-23.common.baseline', 'M1-23.common.backup', 'M1-23.common.backup-running', 'M1-23.common.upgrade', 'M1-30.common.postwrite',
  'M1-30.common.reject-bytes', 'M1-30.common.reject-missing', 'M1-30.common.reject-backup-id', 'M1-30.common.reject-project', 'M1-30.common.restore',
  'M1-30.common.rollback', 'M1-41.common.j-migration'];
const cleanPoint = (point) => ({ point, at: new Date().toISOString(), problems: [], hits: [], corrections: [], refusals: [], failed: false });
/**
 * A stub migration child: it makes this window's clone and backup root after w, writes the handoff, its results, its
 * scan records and its core.mjs teardown records; `fault` breaks one condition of the run-or-stop rule.
 */
function migrationStub(root, fault) {
  return async (env) => {
    const w = Date.parse(env.QA_M1_WINDOW_START);
    await twoMsAfter(w);
    const clone = path.join(root, `${BASE}-${SHA.slice(0, 8)}-2026-10-21T14-00-00-000Z`); fs.mkdirSync(clone);
    await twoMsAfter(fs.lstatSync(clone).birthtimeMs);
    const backupRoot = path.join(root, 'qa-m1-private-backup-Xy34Zw'); fs.mkdirSync(backupRoot, { mode: 0o700 }); fs.chmodSync(backupRoot, 0o700);
    fs.mkdirSync(path.join(backupRoot, 'original'), { mode: 0o700 });
    fs.writeFileSync(path.join(backupRoot, 'original/manifest.json'), JSON.stringify({ composeProject: BASE }), { mode: 0o600 });
    await twoMsAfter(fs.lstatSync(backupRoot).birthtimeMs);
    writeHandoff({ CLONE: clone }, path.join(backupRoot, 'original'), env.QA_M1_HANDOFF_FILE);
    if (fault === 'handoff') fs.chmodSync(env.QA_M1_HANDOFF_FILE, 0o644);
    fs.writeFileSync(env.QA_M1_RESULTS_FILE, JSON.stringify(MIGRATION_IDS.map((id) => ({ id, status: fault === 'row' && id.endsWith('restore') ? 'FAIL' : 'PASS' }))), { mode: 0o600 });
    const points = [...MIGRATION_SCAN_POINTS, ...Array(CONFIG_DIFF_REMOVALS.count).fill(CONFIG_DIFF_REMOVALS.point)].map(cleanPoint);
    if (fault === 'hit') Object.assign(points[1], { failed: true, hits: [{ area: 'qa-m1-private-backup-Xy34Zw', path: 'bytes/lti.db', mode: '0644' }], corrections: [{ path: 'bytes/lti.db' }] });
    if (fault === 'refused') Object.assign(points[2], { failed: true, hits: [{ path: 'x' }], refusals: [{ path: 'x', reason: 'another device or inode' }] });
    if (fault !== 'no-scans') fs.writeFileSync(env.QA_M1_SCAN_FILE, JSON.stringify({ phase: 'migration', complete: fault !== 'incomplete', points }), { mode: 0o600 });
    const art = path.join(root, 'artifacts', path.basename(clone)); fs.mkdirSync(art, { recursive: true });
    fs.writeFileSync(path.join(art, 'summary.json'), JSON.stringify({ results: [{ id: 'TEARDOWN', status: 'PASS' }] }));
    fs.writeFileSync(path.join(art, 'lane-ownership.json'), JSON.stringify({ ledgerErrors: fault === 'ownership' ? ['listing failed'] : [], kept: [], failed: [] }));
    if (fault === 'expire') await pause(80);
    return { code: fault === 'exit' ? 1 : 0, stdout: '', stderr: '' };
  };
}
async function diagnose(t, opts = {}) {
  const { fault = null } = opts, root = tmp(t), calls = [], ran = { teardown: 0, w4: 0 };
  const windowEnd = 'windowEnd' in opts ? opts.windowEnd : new Date(Date.now() + (fault === 'expire' ? 60 : 600_000)).toISOString();
  const record = await diagnosticRun({ root, runRoot: root, windowEnd,
    baseProject: BASE, productSha: SHA, args: ['--sha', SHA, '--test-sha', TEST_SHA, '--source', '/q/source'], migrationIds: MIGRATION_IDS,
    artifactsDir: path.join(root, 'artifacts'),
    spawnChild: async (args, env) => { calls.push({ args, env, at: Date.now() }); return args[1] === 'migration' ? migrationStub(root, fault)(env) : { code: 0, stdout: '', stderr: '' }; },
    teardown: async ({ D }) => { ran.teardown++; ran.teardownD = D; }, w4: async ({ D }) => { ran.w4++; ran.w4D = D; } });
  return { record, calls, ran, root };
}

test('HARNESS ONLY: V8-6 the diagnostic starts the storage child only when every run-or-stop condition holds; teardown and W4 always run', async (t) => {
  const good = await diagnose(t);
  assert.deepEqual([good.record.storage, good.record.cause, good.calls.map((c) => c.args[1])], ['RUN', null, ['migration', 'storage']]);
  const D = good.record.D;
  assert.match(path.basename(D), /^qa-m1-diagnostic-[0-9a-f]{16}$/, 'IN-1: a new folder D with a random suffix');
  assert.equal(fs.lstatSync(D).mode & 0o7777, 0o700);
  assert.ok(fs.lstatSync(D).birthtimeMs <= Date.parse(good.record.w) && Date.parse(good.record.w) <= good.calls[0].at, 'w after D and before the migration child');
  const [m, s] = good.calls;
  assert.deepEqual(Object.keys(m.env).sort(), ['QA_M1_HANDOFF_FILE', 'QA_M1_RESULTS_FILE', 'QA_M1_SCAN_FILE', 'QA_M1_WINDOW_START']);
  assert.equal(path.dirname(m.env.QA_M1_HANDOFF_FILE), D, 'One handoff in D');
  assert.deepEqual([s.env.QA_M1_HANDOFF_FILE, s.env.QA_M1_WINDOW_START, s.env.COMPOSE_PROJECT_NAME], [m.env.QA_M1_HANDOFF_FILE, m.env.QA_M1_WINDOW_START, `${BASE}-st`]);
  assert.deepEqual([good.ran.teardown, good.ran.w4, good.ran.teardownD], [1, 1, D]);
  const written = JSON.parse(fs.readFileSync(path.join(D, 'diagnostic.json'), 'utf8'));
  assert.equal(fs.lstatSync(path.join(D, 'diagnostic.json')).mode & 0o7777, 0o600);
  assert.deepEqual([written.storage, written.teardown.ok, written.w4.ok], ['RUN', true, true]);
  const stops = {
    row: 'storage NOT RUN: migration row M1-30.common.restore is FAIL',
    exit: 'storage NOT RUN: migration child exit 1',
    hit: 'storage NOT RUN: migration scan point migration after the damage copy bytes: scan hit or correction',
    refused: 'storage NOT RUN: migration scan point migration after the damage copy missing: refused correction',
    handoff: 'storage NOT RUN: handoff check failed: handoff file: mode 644 is not 0600',
    ownership: 'storage NOT RUN: migration ownership record is not unambiguous',
    expire: 'storage NOT RUN: the granted window has ended',
    'no-scans': 'storage NOT RUN: migration scan record unreadable (ENOENT)',
    incomplete: 'storage NOT RUN: migration scan record is not complete',
  };
  for (const [fault, cause] of Object.entries(stops)) {
    const run = await diagnose(t, { fault });
    assert.deepEqual([run.record.storage, run.record.cause], ['NOT RUN', cause], fault);
    assert.deepEqual(run.calls.map((c) => c.args[1]), ['migration'], `${fault}: no storage child starts`);
    assert.deepEqual([run.ran.teardown, run.ran.w4], [1, 1], `${fault}: the owned teardown and strict W4 run`);
    assert.equal(JSON.parse(fs.readFileSync(path.join(run.record.D, 'diagnostic.json'), 'utf8')).cause, cause);
  }
  for (const windowEnd of [undefined, 'tomorrow', new Date(Date.now() - 1000).toISOString(), '+010000-01-01T00:00:00.000Z']) {
    const run = await diagnose(t, { windowEnd });
    assert.equal(run.record.migration, 'NOT RUN', String(windowEnd));
    assert.deepEqual([run.calls.length, run.ran.teardown, run.ran.w4], [0, 1, 1], 'No child without a valid window; teardown and W4 still run');
  }
  assert.equal(windowCause(new Date(Date.now() + 60_000).toISOString(), Date.now()), null);
  const failingW4 = await diagnosticRun({ root: tmp(t), runRoot: '/q', windowEnd: null, baseProject: BASE, productSha: SHA, args: [], migrationIds: MIGRATION_IDS, artifactsDir: '/q',
    spawnChild: async () => assert.fail('no child'), teardown: async () => {}, w4: async () => { throw new Error('W4 found a change'); } });
  assert.deepEqual(failingW4.w4, { ok: false, error: 'W4 found a change' }, 'A W4 failure is recorded, never a PASS');
});
