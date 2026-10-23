// Drivers of the storage repair (triage revision 4 §9 step 7, §9.1). `fullRounds` is the round loop of the run-m1.mjs
// full mode: the same phases, order, variables and result files, plus one new QA_M1_WINDOW_START per round. The
// diagnostic call runs the migration child, then the storage child only when every run-or-stop condition holds.
// Both drivers take the child spawn as a parameter (Lead R2-03: a behavior-neutral seam; a self-test records it).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FULL_PHASES } from './m1-phases.mjs';
import { privateWrite, readRegular } from './storage-fixture-script.mjs';
import { WINDOW_FORM, checkHandoff } from './storage-handoff.mjs';

/** The full-mode rounds. `childRun(args, environment, resultFile)` resolves the rows of one child. */
export async function fullRounds({ childRun, scratch, baseProject, args, print, onRound }) {
  const runs = [];
  for (let round = 1; round <= 2; round++) {
    const rows = [];
    // The migration phase records this round's AC-M1-23 backup and clone for e-old-schema (ids only, no secret).
    const handoff = path.join(scratch, `round-${round}-handoff.json`);
    let windowStart = null;
    for (const phase of FULL_PHASES) {
      print(`Starting M1 round ${round}, ${phase}; one stack at a time.`);
      const resultFile = path.join(scratch, `round-${round}-${phase}.json`);
      // The storage phase has its own fresh clone and its own lane (project name), ADR-012 §13.
      const lane = phase === 'storage' ? { COMPOSE_PROJECT_NAME: `${baseProject}-st` } : {};
      // §9.1: this round's window start, taken immediately before its migration child; its storage child gets the same value.
      if (phase === 'migration') windowStart = new Date().toISOString();
      const window = phase === 'migration' || phase === 'storage' ? { QA_M1_WINDOW_START: windowStart } : {};
      rows.push(...await childRun(['--phase', phase, ...args], { QA_M1_RESULTS_FILE: resultFile, QA_M1_HANDOFF_FILE: handoff, ...lane, ...window }, resultFile));
    }
    onRound(round, rows); runs.push(rows);
  }
  return runs;
}

/** The migration scan points that migrationRun publishes (§7.4), and the configDiff scratch removals (site #14). */
export const MIGRATION_SCAN_POINTS = ['migration after the private backup',
  ...['bytes', 'missing', 'backup-id', 'project'].map((damage) => `migration after the damage copy ${damage}`), 'migration phase end'];
export const CONFIG_DIFF_REMOVALS = { point: 'scratch removal compat-config', count: 4 };

/** null when `windowEnd` is a valid time in the exact ISO form and still in the future; else the cause. */
export function windowCause(windowEnd, nowMs) {
  if (typeof windowEnd !== 'string' || !WINDOW_FORM.test(windowEnd) || new Date(Date.parse(windowEnd)).toISOString() !== windowEnd) return 'the window end is missing or invalid';
  return Date.parse(windowEnd) > nowMs ? null : 'the granted window has ended';
}
const readJson = (file) => JSON.parse(readRegular(file).bytes.toString('utf8'));
/**
 * The run-or-stop rule (Lead B-SR-02). null when the storage child may start; else the cause. It reads only results
 * that the migration child published, and the handoff check with s = the time of this check.
 */
export function stopCause({ migration, files, windowStart, windowEnd, runRoot, baseProject, productSha, migrationIds, artifactsDir, now, hostUid }) {
  // (a) the migration child exits 0, and its result file lists the 12 migration rows, each PASS.
  if (migration.code !== 0) return `migration child exit ${migration.code}`;
  let rows;
  try { rows = readJson(files.migrationResults); } catch (e) { return `migration result file unreadable (${e.code ?? e.message})`; }
  const ids = Array.isArray(rows) ? rows.map((row) => row.id).sort() : [];
  if (JSON.stringify(ids) !== JSON.stringify([...migrationIds].sort())) return `migration results do not list exactly the ${migrationIds.length} migration rows`;
  const notPass = rows.find((row) => row.status !== 'PASS');
  if (notPass) return `migration row ${notPass.id} is ${notPass.status}`;
  // (b) the handoff check of §9.1, with s = the time of this check.
  const bound = checkHandoff({ file: files.handoff, windowStart, runRoot, project: `${baseProject}-st`, productSha, s: now(), hostUid });
  if (!bound.ok) return bound.cause;
  // (c) every migration scan point has zero hits, so no correction was made or refused (IN-3: published records).
  let scans;
  try { scans = readJson(files.migrationScans); } catch (e) { return `migration scan record unreadable (${e.code ?? e.message})`; }
  if (scans?.complete !== true || !Array.isArray(scans.points)) return 'migration scan record is not complete';
  for (const point of MIGRATION_SCAN_POINTS) if (scans.points.filter((p) => p.point === point).length !== 1) return `migration scan point not published once: ${point}`;
  if (scans.points.filter((p) => p.point === CONFIG_DIFF_REMOVALS.point).length !== CONFIG_DIFF_REMOVALS.count) return 'migration configDiff scratch removals not published';
  const dirty = scans.points.find((p) => p.failed !== false || p.hits?.length || p.corrections?.length || p.refusals?.length || p.problems?.length);
  if (dirty) return `migration scan point ${dirty.point}: ${dirty.refusals?.length ? 'refused correction' : 'scan hit or correction'}`;
  // (d) the migration child's owned cleanup succeeded; (e) its ADR-012 §15 ownership record is unambiguous.
  const art = path.join(artifactsDir, path.basename(bound.m123Clone));
  let summary, ownership;
  try { summary = readJson(path.join(art, 'summary.json')); } catch { return 'migration cleanup record unreadable'; }
  const teardown = (summary.results ?? []).filter((r) => r.id === 'TEARDOWN');
  if (!teardown.length || teardown.some((r) => r.status !== 'PASS')) return 'migration owned cleanup did not pass';
  try { ownership = readJson(path.join(art, 'lane-ownership.json')); } catch { return 'migration ownership record unreadable'; }
  if ((ownership.ledgerErrors ?? ['missing']).length || (ownership.kept ?? ['missing']).length || (ownership.failed ?? ['missing']).length)
    return 'migration ownership record is not unambiguous';
  // (f) the granted exclusive window is still valid.
  return windowCause(windowEnd, now());
}
async function outcome(fn) {
  try { return { ok: true, value: (await fn()) ?? null }; } catch (e) { return { ok: false, error: String(e?.message ?? e) }; }
}
/**
 * The diagnostic call (§9 step 7). A necessary check, never an authorization: the caller needs a Lead-granted
 * exclusive Docker window with fresh G1 and W1–W3 records and owned lanes; `windowEnd` is the end of that grant.
 * Order: a new folder D (0700, random suffix), the window start w, the migration child; then the run-or-stop rule;
 * then the storage child, or "storage NOT RUN: <cause>". The owned teardown and the strict W4 always run last.
 */
export async function diagnosticRun({ root, runRoot, windowEnd, baseProject, productSha, args, migrationIds, artifactsDir,
  spawnChild, teardown, w4, now = Date.now, hostUid = process.getuid(), print = () => {} }) {
  const record = { windowEnd, D: null, w: null, migration: null, storage: 'NOT RUN', cause: null, storageChild: null, teardown: null, w4: null };
  try {
    const early = windowCause(windowEnd, now());
    if (early) { record.migration = 'NOT RUN'; record.cause = `storage NOT RUN: ${early}`; return record; }
    const D = path.join(root, `qa-m1-diagnostic-${crypto.randomBytes(8).toString('hex')}`);
    fs.mkdirSync(D, { mode: 0o700 }); fs.chmodSync(D, 0o700); // a new empty folder: the mode is explicit
    const st = fs.lstatSync(D);
    if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o7777) !== 0o700 || st.uid !== hostUid) throw new Error('D is not a new 0700 folder of the host user');
    record.D = D;
    const files = { handoff: path.join(D, 'handoff.json'), migrationResults: path.join(D, 'migration-results.json'),
      migrationScans: path.join(D, 'migration-scans.json'), storageResults: path.join(D, 'storage-results.json') };
    // w: after D is made and immediately before the migration child starts. The clock first passes D's birth time, so
    // that w (in milliseconds) is not earlier than D's raw birth time (IN-2; no tolerance, no flooring).
    while (Date.now() <= st.birthtimeMs) await new Promise((resolve) => setTimeout(resolve, 1));
    record.w = new Date().toISOString();
    print(`Diagnostic: migration child, window start ${record.w}.`);
    const m = await spawnChild(['--phase', 'migration', ...args],
      { QA_M1_RESULTS_FILE: files.migrationResults, QA_M1_HANDOFF_FILE: files.handoff, QA_M1_WINDOW_START: record.w, QA_M1_SCAN_FILE: files.migrationScans });
    record.migration = { code: m.code };
    const cause = stopCause({ migration: m, files, windowStart: record.w, windowEnd, runRoot, baseProject, productSha, migrationIds, artifactsDir, now, hostUid });
    if (cause) { record.cause = `storage NOT RUN: ${cause}`; print(record.cause); return record; }
    print('Diagnostic: storage child.');
    record.storage = 'RUN';
    const s = await spawnChild(['--phase', 'storage', ...args],
      { QA_M1_RESULTS_FILE: files.storageResults, QA_M1_HANDOFF_FILE: files.handoff, QA_M1_WINDOW_START: record.w, COMPOSE_PROJECT_NAME: `${baseProject}-st` });
    record.storageChild = { code: s.code };
    return record;
  } finally {
    record.teardown = await outcome(() => teardown({ D: record.D, record }));
    record.w4 = await outcome(() => w4({ D: record.D, record }));
    if (record.D) privateWrite(path.join(record.D, 'diagnostic.json'), Buffer.from(JSON.stringify(record, null, 2)));
  }
}
