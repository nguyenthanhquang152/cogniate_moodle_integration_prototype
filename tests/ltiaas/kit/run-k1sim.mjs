#!/usr/bin/env node
// LA-E7-06 K1-SIM host runner: one fresh SIM lane, the whole kit once (every discovered channel fixture).
// Built on the shared QA host core (tests/host/core.mjs): preflight (fresh lane, port, subnet), a new
// `git clone --no-hardlinks` of --sha, H1 project guard, label-scoped teardown, redaction, summary.
//
// In-container step: the same steps as infra/scripts/qa-suite.sh acceptance (acceptance profile, e2e run, default
// profile restored at exit), with two differences only: the e2e run also gets LA_RUN_DIR and LA_WAVE_ID (qa-suite.sh
// forwards QA_* only), and it runs the kit README command (tests/ltiaas/kit/README.md §3)
//   LA_RUN_DIR=<run dir> QA_KIT_CHANNELS=all QA_TASK=K1 npm --prefix tests run acceptance:api
// in /repo, plus a JSON reporter file for the per-test record. No UI suite runs.
//
// Wave evidence (AC-LA-E7-06-05): LA_K1_WAVE_SPEC names the frozen-suite result files (T3b, T7, T8). The runner checks
// each file and writes `<run dir>/wave/<suite>/result.json` ({ suite, waveId, outcome }, plus the source file and its
// SHA-256) and `<run dir>/wave-evidence.json`. A file that does not show a clean PASS gives outcome FAIL.
//
// Host actions for the kit (M1 `cli()` and `host('m1-restart')`): app:grant / app:binding / lti:shared-platform through
// `docker compose exec`, and `npm run stack:restart -- <service>` (tasks README §2 form (l)).
//
// Usage (from a checkout that holds this script):
//   COMPOSE_PROJECT_NAME=qa4-la-k1-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
//   LA_K1_WAVE_SPEC=<spec.json> LA_WAVE_ID=<wave id> \
//   node tests/ltiaas/kit/run-k1sim.mjs --sha <commit> --source <repo> --workdir <new folder>
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../host/core.mjs';
import { createHostControl } from '../../host/host-control.mjs';
import { readTestReports, run, walkFiles } from '../../host/lib.mjs';

const r = createRunner({ task: 'LA-E7-06-K1', defaultProject: 'qa4-la-k1-r1' });
const CONTROL = () => path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'control');
const ALLOWED_SCRIPTS = new Set(['app:grant', 'app:binding', 'lti:shared-platform']);
const WAVE_ID = process.env.LA_WAVE_ID ?? '';
const WAVE_SPEC = process.env.LA_K1_WAVE_SPEC ?? '';
// Optional: a kit tree (tests/ltiaas/kit) to copy over the clone's kit before the run; its git tree hash is recorded.
const KIT_FROM = process.env.LA_K1_KIT_FROM ?? '';
// Private kit files that never leave the run clone (lib/runtime.ts EXCLUDED_ARTIFACT_BASENAMES and M1 raw secrets).
const PRIVATE_FILE = /(^|[/\\])(kit-secrets(\.raw)?\.jsonl|m1-secrets\.raw\.jsonl|captured-secrets[^/\\]*|[^/\\]*\.raw\.[^/\\]+)$/;

function sanitizeArgs(rawArgs) {
  if (!Array.isArray(rawArgs) || rawArgs.length > 40) return null;
  for (const arg of rawArgs) if (typeof arg !== 'string' || arg.includes('\0') || arg.length > 512) return null;
  return rawArgs;
}

async function handleM1Cli(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  const script = String(req.script ?? '');
  if (!ALLOWED_SCRIPTS.has(script)) return { code: 2 };
  const args = sanitizeArgs(req.args);
  if (args === null) return { code: 2 };
  const service = script.startsWith('lti:') ? 'lti-service' : 'cogniate-app';
  const composeArgs = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'exec', '-T', '--workdir', '/repo',
    '-e', 'NPM_CONFIG_UPDATE_NOTIFIER=false', service, 'npm', 'run', script, '-w', `services/${service}`, '--', ...args];
  const res = await run('docker', composeArgs, { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 60_000 });
  for (const secret of res.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g) ?? []) r.redact.add(secret);
  const out = `out-${req.id}.raw.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(res), { mode: 0o600 });
  r.saveText(path.join('host-actions', `m1-cli-${req.id}.log`),
    `$ docker ${composeArgs.join(' ')}\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`);
  return { code: 0, out };
}

async function handleM1Restart(req) {
  if (!/^[\w-]{1,64}$/.test(String(req.id)) || !r.state.h1Verified) return { code: 2 };
  if (!['cogniate-app', 'lti-service'].includes(req.service)) return { code: 2 };
  const res = await run('npm', ['run', 'stack:restart', '--', req.service], {
    cwd: r.CLONE, env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 180_000,
  });
  const out = `out-${req.id}.raw.json`;
  fs.writeFileSync(path.join(CONTROL(), out), JSON.stringify(res), { mode: 0o600 });
  r.saveText(path.join('host-actions', `m1-restart-${req.id}.log`),
    `$ npm run stack:restart -- ${req.service}\nexit: ${res.code}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}\n`);
  return { code: 0, out };
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// One frozen-suite result file -> PASS only when it shows a clean pass.
function judgeWaveSource(spec) {
  const notes = [];
  let s;
  try { s = JSON.parse(fs.readFileSync(spec.file, 'utf8')); } catch (e) { return { outcome: 'FAIL', notes: [`unreadable: ${e.message}`] }; }
  if (s.abort) notes.push(`abort: ${s.abort}`);
  if (spec.kind === 'host-summary') {
    const values = Object.values(s.aggregate ?? {});
    if (values.length === 0) notes.push('no aggregate results');
    if (values.some((v) => v !== 'PASS')) notes.push(`non-PASS ids: ${Object.entries(s.aggregate).filter(([, v]) => v !== 'PASS').map(([k]) => k).join(', ')}`);
    if (spec.requireIdPrefix && !Object.keys(s.aggregate ?? {}).some((k) => k.startsWith(spec.requireIdPrefix))) {
      notes.push(`no result id starts with ${spec.requireIdPrefix}`);
    }
    if (spec.task && s.task !== spec.task) notes.push(`task ${s.task} !== ${spec.task}`);
  } else if (spec.kind === 'e2e-summary') {
    const runs = Array.isArray(s.runs) ? s.runs : [];
    if (runs.length === 0) notes.push('no runs');
    for (const x of runs) if (x.exit !== 0 || x.fail !== 0 || x.timedOut) notes.push(`run ${x.run}: exit ${x.exit}, fail ${x.fail}, timedOut ${x.timedOut}`);
  } else notes.push(`unknown kind ${spec.kind}`);
  return { outcome: notes.length === 0 ? 'PASS' : 'FAIL', notes, sha: s.sha ?? null, runId: s.runId ?? null };
}

function writeWaveEvidence(runDirHost) {
  const specs = JSON.parse(fs.readFileSync(WAVE_SPEC, 'utf8'));
  const manifest = { waveId: WAVE_ID, suites: {} };
  const notes = [];
  for (const spec of specs) {
    const verdict = judgeWaveSource(spec);
    const rel = path.join('wave', spec.suite, 'result.json');
    const file = path.join(runDirHost, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      suite: spec.suite, waveId: WAVE_ID, outcome: verdict.outcome,
      source: { file: spec.file, sha256: sha256(spec.file), runId: verdict.runId, productSha: verdict.sha, kind: spec.kind },
      checks: verdict.notes,
    }, null, 2));
    manifest.suites[spec.suite] = { outcome: verdict.outcome, waveId: WAVE_ID, artifactPath: rel };
    notes.push(`${spec.suite}: ${verdict.outcome} from ${spec.file} (run ${verdict.runId}, product ${verdict.sha})${verdict.notes.length ? ' — ' + verdict.notes.join('; ') : ''}`);
  }
  fs.writeFileSync(path.join(runDirHost, 'wave-evidence.json'), JSON.stringify(manifest, null, 2));
  return { ok: Object.values(manifest.suites).every((x) => x.outcome === 'PASS'), notes };
}

const IN_CONTAINER = `set -euo pipefail
source infra/scripts/lib.sh
storage_compat_guard
require_env
run_name="\${COMPOSE_PROJECT_NAME}-qa-k1-$$"
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  docker rm -f "$run_name" >/dev/null 2>&1 || true
  echo "k1: restoring the default profile (stack-up.sh)..."
  if ! STACK_PROFILE=default "$INFRA_DIR/scripts/stack-up.sh" >/dev/null; then
    echo "WARNING: the default profile was not restored." >&2
    [[ $rc -ne 0 ]] || rc=1
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
echo "k1: starting the acceptance profile (STACK_PROFILE=acceptance stack-up.sh)..."
STACK_PROFILE=acceptance "$INFRA_DIR/scripts/stack-up.sh"
apply_profile acceptance
require_running proxy
warn_knobs
prepare_e2e
qa_env_args
status=0
dc --profile test run --rm --name "$run_name" --build "\${QA_ENV_ARGS[@]+"\${QA_ENV_ARGS[@]}"}" -e LA_RUN_DIR -e LA_WAVE_ID e2e sh -c \\
  'npm ci --prefix tests --no-audit --no-fund && npm --prefix tests run acceptance:api -- --reporter=verbose --reporter=json --outputFile.json=/repo/tests/acceptance/artifacts/vitest-results.json' || status=$?
exit "$status"
`;

async function overlayKit() {
  const dest = path.join(r.CLONE, 'tests', 'ltiaas', 'kit');
  if (KIT_FROM) {
    const from = path.resolve(KIT_FROM);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(from, dest, {
      recursive: true,
      filter: (src) => !/(^|[/\\])(node_modules|\.tmp|\.vite)([/\\]|$)/.test(path.relative(from, src)),
    });
  }
  const add = await run('git', ['add', '-A', 'tests/ltiaas/kit'], { cwd: r.CLONE });
  const tree = await run('git', ['write-tree', '--prefix=tests/ltiaas/kit/'], { cwd: r.CLONE });
  const head = await run('git', ['rev-parse', 'HEAD:tests/ltiaas/kit'], { cwd: r.CLONE });
  const kitTree = tree.stdout.trim();
  r.timings.kitTree = kitTree;
  r.record('KIT', `Kit tree in the clone: ${kitTree}`, r.pass(add.code === 0 && tree.code === 0 && Boolean(kitTree)), [
    KIT_FROM ? `copied from ${path.resolve(KIT_FROM)}` : 'kit of the SHA (no copy)',
    `kit tree ${kitTree}; kit tree at the SHA ${head.stdout.trim()}`,
  ]);
}

async function setup() {
  const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
  const gen = await r.npm('gen-env', ['run', 'gen-env']);
  r.loadStackFiles();
  await r.composeNameGuard();
  if (r.state.abort) return false;
  const up = await r.npm('stack-up', ['run', 'stack:up'], { timeoutMs: 900_000 });
  const seed = up.code === 0 ? await r.npm('seed', ['run', 'seed'], { timeoutMs: 900_000 }) : null;
  r.loadStackFiles();
  await r.checkProject();
  const ok = ci.code === 0 && gen.code === 0 && up.code === 0 && seed?.code === 0;
  r.record('SETUP', `K1 stack (${r.PROJECT}): npm ci, gen-env, stack:up, seed`, r.pass(ok),
    [`npm ci ${ci.code}, gen-env ${gen.code}, stack:up ${up.code}, seed ${seed?.code ?? 'not run'}`],
    [ci.log, gen.log, up.log, seed?.log].filter(Boolean));
  return !r.state.abort && ok;
}

// Secrets captured by the kit and the M1 helpers go to the redactor before any file is copied out.
function learnPrivateSecrets(dirs) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of walkFiles(dir)) {
      if (!PRIVATE_FILE.test(path.relative(dir, f)) || !/\.jsonl?$/.test(f)) continue;
      for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
        try {
          const v = JSON.parse(line);
          const value = typeof v === 'string' ? v : v?.value;
          if (typeof value === 'string' && value.length >= 8) r.redact.add(value);
        } catch { /* not a secret line */ }
      }
    }
  }
}

function copyPublic(fromDir, toRel) {
  if (!fs.existsSync(fromDir)) return 0;
  let n = 0;
  for (const f of walkFiles(fromDir)) {
    const rel = path.relative(fromDir, f);
    if (PRIVATE_FILE.test(rel) || rel.startsWith(`control${path.sep}`)) continue;
    if (!/\.(json|jsonl|md|txt|log)$/.test(rel)) continue;
    r.saveText(path.join(toRel, rel), fs.readFileSync(f, 'utf8'));
    n += 1;
  }
  return n;
}

await r.main(async () => {
  if (!WAVE_ID || !WAVE_SPEC) {
    r.record('WAVE', 'LA_WAVE_ID and LA_K1_WAVE_SPEC are set', 'FAIL', [`LA_WAVE_ID="${WAVE_ID}", LA_K1_WAVE_SPEC="${WAVE_SPEC}"`]);
    return;
  }
  const runDirName = `kit-run-${path.basename(r.ART)}`;
  const runDirHost = path.join(r.CLONE, 'tests', '.tmp', runDirName);
  const runDirContainer = `/repo/tests/.tmp/${runDirName}`;
  await overlayKit();
  if (!(await setup())) return;

  fs.mkdirSync(runDirHost, { recursive: true });
  const wave = writeWaveEvidence(runDirHost);
  r.record('WAVE', `Wave evidence ${WAVE_ID} written for the kit (coveredBy: T3b, T7, T8)`, r.pass(wave.ok), wave.notes);

  const artifacts = path.join(r.CLONE, 'tests', 'acceptance', 'artifacts');
  fs.rmSync(artifacts, { recursive: true, force: true });
  fs.mkdirSync(path.join(artifacts, 'control'), { recursive: true });
  const control = createHostControl(r, { 'm1-cli': handleM1Cli, 'm1-restart': handleM1Restart });
  const stop = control.start();
  const t0 = Date.now();
  let res;
  try {
    res = await r.exec('k1-in-container', 'bash', ['-c', IN_CONTAINER], {
      env: { ...r.STACK_ENV, QA_TASK: 'K1', QA_KIT_CHANNELS: 'all', LA_RUN_DIR: runDirContainer, LA_WAVE_ID: WAVE_ID },
      timeoutMs: 3_600_000,
    });
  } finally {
    const log = stop();
    r.record('HOSTCTL', 'Host actions asked for by the kit (m1-cli, m1-restart)', 'PASS', log.length ? log : ['none']);
  }
  r.timings.k1InContainerMs = Date.now() - t0;

  learnPrivateSecrets([runDirHost, artifacts]);
  const copiedRun = copyPublic(runDirHost, 'kit-run');
  const copiedArt = copyPublic(artifacts, 'container-k1');
  const tests = readTestReports(artifacts);
  const failed = tests.filter((t) => t.status === 'FAIL');
  const skipped = tests.filter((t) => t.status === 'SKIP');
  let summary = null;
  try { summary = JSON.parse(fs.readFileSync(path.join(runDirHost, 'k1-kit-summary.json'), 'utf8')); } catch { /* recorded below */ }
  r.record('SUITE', 'Kit K1-SIM run (README §3 command in the e2e container): exit 0, every test passed, none skipped',
    r.pass(res.code === 0 && tests.length > 0 && failed.length === 0 && skipped.length === 0), [
      `exit ${res.code}${res.timedOut ? ' (TIMEOUT)' : ''}; vitest tests ${tests.length}; failed ${failed.length}; skipped ${skipped.length}; in-container ${Math.round(r.timings.k1InContainerMs / 1000)} s`,
      ...failed.map((t) => `failed: ${t.title}`),
      `kit run files copied: ${copiedRun}; container artifacts copied: ${copiedArt}`,
    ], [res.log, 'kit-run', 'container-k1']);
  r.record('PASSRULE', 'Kit pass rule (k1-kit-summary.json from evaluateKitRunPassRule)', r.pass(Boolean(summary?.ok)), summary
    ? [`ok ${summary.ok}; expected RUN ${summary.totalExpectedRun}; passed ${summary.totalPassed}; failed ${summary.totalFailed}; skipped ${summary.totalSkipped}; duplicates ${summary.totalDuplicates}; wave ${summary.currentWaveId}`,
      ...Object.entries(summary.channels ?? {}).map(([id, ev]) => `${id}: ${ev.ok ? 'PASS' : 'FAIL'} expected ${ev.expectedRunCount}, passed ${ev.executedPassCount}, failed ${ev.failedCases.length}, missing ${ev.missingCases.length}, extra ${ev.extraCases.length}`),
      ...(summary.globalErrors ?? []).map((e) => `global: ${e}`)]
    : ['k1-kit-summary.json missing']);
});
