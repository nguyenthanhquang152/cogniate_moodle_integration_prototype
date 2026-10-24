// Wave evidence producer (AC-LA-E7-06-05; TEST-STRATEGY §2.6 `coveredBy`). Pure functions, no runner start:
// `run-k1sim.mjs` and the kit K0 checks import the same code.
//
// A wave spec names one frozen-suite result file per suite. The producer gives PASS for a suite only when the file
// shows a complete clean run of that suite: the right runner (suite identity), every required case or test present
// and PASS, counts that agree with the rows, no abort. The required sets are not operator input; they come from the
// frozen runners and spec files (cited in WAVE_SUITES; kit K0 compares them with those files).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Host phases that every complete run of the shared host core records (tests/host/core.mjs).
const HOST_PHASES = ['PRE', 'CLONE', 'H1', 'SETUP', 'SUITE', 'TEARDOWN'];

export const WAVE_SUITES = Object.freeze({
  // T3b runs in the T2 host runner (tests/host/run-t2.mjs, `--tasks` with T3a,T3b): EXPECT.T3b.
  T3b: Object.freeze({
    kind: 'host-summary',
    task: 'T2',
    runner: 'tests/host/run-t2.mjs',
    requiredIds: Object.freeze([
      'AC-T3-01', 'AC-T3-02', 'AC-T3-03', 'AC-T3-04', 'AC-T3-05', 'AC-T3-25', 'AC-T3-26', 'AC-T3-28', 'AC-T3-29', 'AC-T3-30',
    ]),
  }),
  // T7 runs in the e2e host runner (tests/e2e/host/run-t7.mjs): `npm run test:e2e` over the top-level spec files of
  // tests/e2e. demo-check.spec.ts (AC-T7-15) runs only in the demo pass (QA_E2E_DEMO=1; tests/e2e/README.md), so a
  // scenario run shows it as SKIP; that is the only allowed skip.
  T7: Object.freeze({
    kind: 'e2e-summary',
    runner: 'tests/e2e/host/run-t7.mjs',
    specDir: 'tests/e2e',
    specFiles: Object.freeze([
      '0-start.spec.ts', '1-scenario-a.spec.ts', '2-scenario-b.spec.ts', '3-scenario-c.spec.ts', '9-end.spec.ts',
      'demo-check.spec.ts',
    ]),
    allowedSkipFiles: Object.freeze(['demo-check.spec.ts']),
  }),
  // T8 host runner (tests/host/run-t8.mjs), default passes main,races,hold,fail,runner-race: MAIN (AC ids), the knob
  // passes AC-T8-03 and AC-T8-07, the audit passes C-T8-01 and C-T8-02.
  T8: Object.freeze({
    kind: 'host-summary',
    task: 'T8',
    runner: 'tests/host/run-t8.mjs',
    requiredIds: Object.freeze([
      'AC-T8-02', 'AC-T8-03', 'AC-T8-04', 'AC-T8-05', 'AC-T8-06', 'AC-T8-07', 'AC-T8-08', 'AC-T8-09', 'AC-T8-10',
      'C-T8-01', 'C-T8-02',
    ]),
  }),
});

// The test titles of one Playwright spec file: the first argument of each top-level `test(...)` call.
export function specFileTitles(text) {
  const pattern = /^\s*test(?:\.serial)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gm;
  return [...text.matchAll(pattern)].map((m) => m[2].replace(/\\(.)/g, '$1'));
}

function judgeHostSummary(s, def) {
  const notes = [];
  if (s.task !== def.task) notes.push(`suite identity: task "${s.task}" is not "${def.task}" (${def.runner})`);
  if (s.abort) notes.push(`abort: ${s.abort}`);
  const aggregate = s.aggregate && typeof s.aggregate === 'object' ? s.aggregate : {};
  const results = Array.isArray(s.results) ? s.results : [];
  if (Object.keys(aggregate).length === 0) notes.push('no aggregate results');
  if (results.length === 0) notes.push('no per-check results');
  for (const [id, value] of Object.entries(aggregate)) {
    if (value !== 'PASS') notes.push(`${id}: ${value}`);
  }
  for (const id of [...HOST_PHASES, ...def.requiredIds]) {
    if (!(id in aggregate)) notes.push(`missing required id ${id}`);
  }
  // The aggregate is the worst result per id (tests/host/core.mjs): every result row of a PASS id is PASS, and the
  // ids of the two lists agree.
  const resultIds = new Set(results.map((x) => x?.id));
  for (const x of results) {
    if (!(x?.id in aggregate)) notes.push(`inconsistent: result ${x?.id} has no aggregate entry`);
    else if (aggregate[x.id] === 'PASS' && x.status !== 'PASS') notes.push(`inconsistent: ${x.id} aggregate PASS, result ${x.status}`);
  }
  for (const id of Object.keys(aggregate)) {
    if (!resultIds.has(id)) notes.push(`inconsistent: aggregate ${id} has no result row`);
  }
  return notes;
}

function judgeE2eSummary(s, def, repoRoot) {
  const notes = [];
  if (s.abort) notes.push(`abort: ${s.abort}`);
  if (Array.isArray(s.steps)) {
    for (const step of s.steps) if (step?.ok !== true) notes.push(`step not ok: ${step?.name}`);
  }
  const expected = new Map();
  for (const file of def.specFiles) {
    let text;
    try {
      text = fs.readFileSync(path.join(repoRoot, def.specDir, file), 'utf8');
    } catch (e) {
      notes.push(`frozen spec file ${def.specDir}/${file} not readable: ${e.message}`);
      continue;
    }
    expected.set(file, specFileTitles(text));
  }
  const runs = Array.isArray(s.runs) ? s.runs : [];
  if (runs.length === 0) notes.push('no runs');
  for (const x of runs) {
    const label = `run ${x?.run}`;
    if (x?.exit !== 0 || x?.fail !== 0 || x?.timedOut !== false) {
      notes.push(`${label}: exit ${x?.exit}, fail ${x?.fail}, timedOut ${x?.timedOut}`);
    }
    const rows = Array.isArray(x?.tests) ? x.tests : [];
    if (rows.length === 0) {
      notes.push(`${label}: no test rows`);
      continue;
    }
    const count = (status) => rows.filter((t) => t?.status === status).length;
    if (x.pass !== count('PASS') || x.fail !== count('FAIL') || x.skip !== count('SKIP') || rows.length !== x.pass + x.fail + x.skip) {
      notes.push(`${label}: inconsistent counts (pass ${x.pass}, fail ${x.fail}, skip ${x.skip}; rows ${rows.length}: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('SKIP')} SKIP)`);
    }
    for (const t of rows) {
      if (!expected.has(t?.file)) {
        notes.push(`${label}: suite identity: ${t?.file} is not a T7 spec file`);
        continue;
      }
      const skipAllowed = def.allowedSkipFiles.includes(t.file);
      if (t.status !== 'PASS' && !(skipAllowed && t.status === 'SKIP')) {
        notes.push(`${label}: ${t.file} "${String(t.title).slice(0, 60)}" is ${t.status}`);
      }
    }
    // Complete: the rows are exactly the tests of the frozen spec files.
    for (const [file, titles] of expected) {
      const got = rows.filter((t) => t?.file === file).map((t) => String(t.title)).sort();
      const want = [...titles].sort();
      if (got.length !== want.length || got.some((title, i) => title !== want[i])) {
        notes.push(`${label}: ${file}: ${got.length} of ${want.length} expected tests, or other titles`);
      }
    }
  }
  return notes;
}

/**
 * Judges one wave source. `spec` = { suite, file } (optional `kind` and `task` must agree with WAVE_SUITES).
 * `repoRoot` holds the frozen spec files (T7).
 */
export function judgeWaveSource(spec, { repoRoot = process.cwd() } = {}) {
  const def = WAVE_SUITES[spec?.suite];
  if (!def) return { outcome: 'FAIL', notes: [`unsupported suite ${spec?.suite} (supported: ${Object.keys(WAVE_SUITES).join(', ')})`], sha: null, runId: null };
  const specNotes = [];
  if (spec.kind !== undefined && spec.kind !== def.kind) specNotes.push(`spec kind ${spec.kind} is not ${def.kind}`);
  if (spec.task !== undefined && spec.task !== def.task) specNotes.push(`spec task ${spec.task} is not ${def.task}`);
  let s;
  try {
    s = JSON.parse(fs.readFileSync(spec.file, 'utf8'));
  } catch (e) {
    return { outcome: 'FAIL', notes: [...specNotes, `unreadable: ${e.message}`], sha: null, runId: null };
  }
  if (!s || typeof s !== 'object') return { outcome: 'FAIL', notes: [...specNotes, 'not a JSON object'], sha: null, runId: null };
  const notes = [...specNotes, ...(def.kind === 'host-summary' ? judgeHostSummary(s, def) : judgeE2eSummary(s, def, repoRoot))];
  if (typeof s.runId !== 'string' || !s.runId) notes.push('no runId');
  if (typeof s.sha !== 'string' || !/^[0-9a-f]{40}$/.test(s.sha)) notes.push('no product sha');
  return { outcome: notes.length === 0 ? 'PASS' : 'FAIL', notes, sha: s.sha ?? null, runId: s.runId ?? null };
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * Writes `<runDir>/wave/<suite>/result.json` for each spec entry and `<runDir>/wave-evidence.json`.
 * `specs` = the parsed wave spec (an array). A suite may appear once.
 */
export function writeWaveEvidence({ specs, runDir, waveId, repoRoot = process.cwd() }) {
  const manifest = { waveId, suites: {} };
  const notes = [];
  if (!Array.isArray(specs) || specs.length === 0) throw new Error('wave spec: a non-empty array is required');
  for (const spec of specs) {
    if (manifest.suites[spec.suite]) throw new Error(`wave spec: suite ${spec.suite} appears twice`);
    const verdict = judgeWaveSource(spec, { repoRoot });
    const rel = path.join('wave', String(spec.suite), 'result.json');
    const file = path.join(runDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let digest = null;
    try {
      digest = sha256(spec.file);
    } catch {
      // unreadable source: the verdict already says FAIL
    }
    fs.writeFileSync(file, JSON.stringify({
      suite: spec.suite, waveId, outcome: verdict.outcome,
      source: { file: spec.file, sha256: digest, runId: verdict.runId, productSha: verdict.sha, kind: WAVE_SUITES[spec.suite]?.kind ?? null },
      checks: verdict.notes,
    }, null, 2));
    manifest.suites[spec.suite] = { outcome: verdict.outcome, waveId, artifactPath: rel };
    notes.push(`${spec.suite}: ${verdict.outcome} from ${spec.file} (run ${verdict.runId}, product ${verdict.sha})${verdict.notes.length ? ' — ' + verdict.notes.join('; ') : ''}`);
  }
  fs.writeFileSync(path.join(runDir, 'wave-evidence.json'), JSON.stringify(manifest, null, 2));
  return { ok: Object.values(manifest.suites).every((x) => x.outcome === 'PASS'), notes, manifest };
}
