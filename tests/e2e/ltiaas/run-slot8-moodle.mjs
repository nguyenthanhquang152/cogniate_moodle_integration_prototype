#!/usr/bin/env node
// QA-E2E host runner for Slot 8 MOODLE-LIVE gate (tests/ltiaas/GATE-RUN-PLAN.md §5 item 4):
// - LA-E7-09 live Moodle K2 (U1 cards + U2 wizards on default profile + U1/U2 continuity across restarts)
// - LA-E3-05 AC-LA-E3-05-04 and AC-LA-E3-05-11 (Moodle 5.2.4 picker single-select radio & Cancel button Playwright check)
// - LA-E4-03 AC-LA-E4-03-09 browser part (Moodle 5.2.4 HTML & SCORM 1.2 learner launches and lti-ags score sync)
// - LA-E5-22 AC-LA-E5-22-06 / A-LAB-09 (Moodle course shell creation with cgk1-sealed and legacy pre-upgrade ws_token_encrypted blobs)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunner } from '../../host/core.mjs';
import {
  dockerInspect,
  isSecretCandidate,
  projectResources,
  readEnv,
  readSeed,
  Redactor,
  run,
  secretsInFile,
  walkFiles,
} from '../../host/lib.mjs';

export const SLOT8_DEFAULTS = Object.freeze({
  task: 'LA-E7-09-SLOT8',
  defaultProject: 'qa-e2e-la-s8-r1',
  defaultPort: '9543',
  defaultSubnet: '172.21.0.0/16',
});

export function resolveSlot8Defaults(env = process.env) {
  return {
    project: env.COMPOSE_PROJECT_NAME ?? SLOT8_DEFAULTS.defaultProject,
    publicPort: env.PUBLIC_PORT ?? SLOT8_DEFAULTS.defaultPort,
    stackSubnet: env.STACK_SUBNET ?? SLOT8_DEFAULTS.defaultSubnet,
  };
}

export const SLOT8_HELP = `Usage: COMPOSE_PROJECT_NAME=qa-e2e-la-s8-r<N> PUBLIC_PORT=9543 STACK_SUBNET=172.21.0.0/16 \\
  COURSE_FIXTURES_DIR=/path/to/course-fixtures \\
  node tests/e2e/ltiaas/run-slot8-moodle.mjs --sha <commit> [options]

  --sha <commit>               Commit to verify (from the Lead). Required unless --checkout or --selftest.
  --source <path>              Repo to clone from (default: the repo that holds this script).
  --workdir <path>             Clone folder (default: ~/cogniate-qa-runs/<project>-<sha8>-<time>).
  --checkout <path>            Use an existing clone (no clean-clone guarantee).
  --tests-from <path>          tests/ folder to copy into the clone (default: this tests/).
  --replace-tests              Replace the clone's tests/ with --tests-from (QA test fixes after the SHA).
  --selftest                   Run host-only checks (defaults/help + Redactor planted-secret and clean-log probes; no Docker).
  --help, -h                   Print this usage guide.

Environment defaults & fixture requirement:
  COMPOSE_PROJECT_NAME         Default: ${SLOT8_DEFAULTS.defaultProject} (must match /^qa[234]?-[a-z0-9-]+$/)
  PUBLIC_PORT                  Default: ${SLOT8_DEFAULTS.defaultPort}
  STACK_SUBNET                 Default: ${SLOT8_DEFAULTS.defaultSubnet}
  COURSE_FIXTURES_DIR          Directory containing the two SHA-256 verified course fixture zips
                               (falls back to <source>/docs/raw/data/courses and ~/cogniate-qa-runs/LA/GATE/course-fixtures).
`;

export function extractProductWsToken(seedRoot) {
  const tokens = [];
  const walk = (node, at) => {
    if (Array.isArray(node)) {
      node.forEach((c, i) => walk(c, [...at, String(i)]));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k === 'ltiSeed' || k === 'cmids' || k === 'portal') continue;
      if (typeof v === 'string' && /^[0-9a-f]{32}$/.test(v) && !/pass/i.test(k)) {
        const label = typeof node.service === 'string' ? `service:${node.service}` : [...at, k].join('.');
        tokens.push({ path: label, value: v });
      }
      walk(v, [...at, k]);
    }
  };
  walk(seedRoot, []);
  const prod = tokens.find((t) => !/oracle/i.test(t.path));
  return prod?.value ?? '';
}

export function loadStackSecretsIntoRedactor(cloneDir, redact) {
  const envFile = path.join(cloneDir, '.env');
  const env = readEnv(envFile);
  if (env) {
    for (const [k, v] of Object.entries(env)) {
      if (isSecretCandidate(k, v)) redact.add(v);
    }
  }
  const secretsDir = path.join(cloneDir, 'infra', '.secrets');
  if (fs.existsSync(secretsDir)) {
    for (const file of walkFiles(secretsDir)) {
      for (const item of secretsInFile(file).items) redact.add(item.value);
    }
    const seedFile = path.join(secretsDir, 'seed.json');
    if (fs.existsSync(seedFile)) {
      const seed = readSeed(seedFile);
      if (seed) {
        for (const user of Object.values(seed.users)) redact.add(user.password);
        redact.add(seed.productToken, seed.oracleToken);
      }
      try {
        const rawSeed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
        const prodTok = extractProductWsToken(rawSeed);
        if (prodTok) redact.add(prodTok);
      } catch {
        // ignore malformed seed file
      }
    }
  }
}

export function loadCapturedSecretsIntoRedactor(cloneDir, redact) {
  const jsonlFiles = [
    path.join(cloneDir, 'tests', 'e2e', 'artifacts', 'captured-secrets.jsonl'),
    path.join(cloneDir, 'tests', 'acceptance', 'artifacts', 'm1-secrets.raw.jsonl'),
  ];
  for (const jf of jsonlFiles) {
    if (!fs.existsSync(jf)) continue;
    for (const line of fs.readFileSync(jf, 'utf8').split('\n').filter(Boolean)) {
      try {
        const item = JSON.parse(line);
        if (typeof item === 'string') redact.add(item);
        else if (typeof item?.value === 'string') redact.add(item.value);
      } catch {
        // ignore malformed line
      }
    }
  }
  const secretTxt = path.join(cloneDir, 'tests', 'acceptance', 'artifacts', 'captured-secrets.txt');
  if (fs.existsSync(secretTxt)) {
    for (const s of secretsInFile(secretTxt).items) redact.add(s.value);
  }
}

export function redactSlot8Artifacts(artDir, redact) {
  if (!fs.existsSync(artDir)) {
    return { redactedFileCount: 0, replacementCount: 0, redactedFiles: [] };
  }
  const redactedFiles = [];
  let replacementCount = 0;
  for (const f of walkFiles(artDir).filter((n) => /\.(log|json|txt|jsonl|md|html)$/.test(n))) {
    if (/(captured-secrets|m1-secrets\.raw)\.(txt|jsonl)$/.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    const beforeTags = (text.match(/<redacted:\d+>/g) ?? []).length;
    const clean = redact.apply(text);
    if (clean !== text) {
      const afterTags = (clean.match(/<redacted:\d+>/g) ?? []).length;
      const fileReplacements = Math.max(1, afterTags - beforeTags);
      replacementCount += fileReplacements;
      const rel = path.relative(artDir, f);
      redactedFiles.push({ file: rel, replacements: fileReplacements });
      fs.writeFileSync(f, clean);
    }
  }
  return {
    redactedFileCount: redactedFiles.length,
    replacementCount,
    redactedFiles,
  };
}

/**
 * Scans service logs (`infra/.logs/*.jsonl`) and runner artifacts (`artDir`) using
 * only the public `Redactor` interface (`redact.apply(text)` and `redact.size`).
 */
export function scanSlot8Files({ redact, cloneDir, artDir }) {
  const logsDir = path.join(cloneDir, 'infra', '.logs');
  const scanFiles = [
    ...(fs.existsSync(logsDir) ? walkFiles(logsDir).filter((f) => f.endsWith('.jsonl')) : []),
    ...(fs.existsSync(artDir)
      ? walkFiles(artDir).filter(
          (f) => /\.(log|json|txt|jsonl|md)$/.test(f) && !/(captured-secrets|m1-secrets\.raw)\.(txt|jsonl)$/.test(f),
        )
      : []),
  ];
  const hits = [];
  let hitCount = 0;
  for (const f of scanFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const beforeTags = (text.match(/<redacted:\d+>/g) ?? []).length;
    const applied = redact.apply(text);
    if (applied !== text) {
      const afterTags = (applied.match(/<redacted:\d+>/g) ?? []).length;
      const fileHits = Math.max(1, afterTags - beforeTags);
      hitCount += fileHits;
      const rel = f.startsWith(artDir) ? path.relative(artDir, f) : path.relative(cloneDir, f);
      hits.push(`${rel}: ${fileHits} hit(s)`);
    }
  }
  return {
    ok: hits.length === 0 && redact.size > 0,
    secretCount: redact.size,
    scannedFileCount: scanFiles.length,
    hitCount,
    hits,
  };
}

async function runSelfTest() {
  // 1. Defaults & help verification (B-LA-E7-09-02)
  const resolvedDefaults = resolveSlot8Defaults({});
  assert.equal(resolvedDefaults.project, 'qa-e2e-la-s8-r1');
  assert.equal(resolvedDefaults.publicPort, '9543');
  assert.equal(resolvedDefaults.stackSubnet, '172.21.0.0/16');
  assert.match(SLOT8_HELP, /node tests\/e2e\/ltiaas\/run-slot8-moodle\.mjs/);
  assert.match(SLOT8_HELP, /PUBLIC_PORT=9543/);
  assert.match(SLOT8_HELP, /STACK_SUBNET=172\.21\.0\.0\/16/);
  assert.match(SLOT8_HELP, /COURSE_FIXTURES_DIR/);

  // 2. Planted-secret and clean-log probes through the public Redactor interface (A-LA-E7-09-01, B-LA-E7-09-01, A-LA-E7-09-02)
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slot8-redactor-selftest-'));
  try {
    const tmpClone = path.join(tmpRoot, 'clone');
    const tmpArt = path.join(tmpRoot, 'art');
    fs.mkdirSync(path.join(tmpClone, 'infra', '.logs'), { recursive: true });
    fs.mkdirSync(path.join(tmpClone, 'tests', 'e2e', 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(tmpClone, 'tests', 'acceptance', 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(tmpArt, 'docker-logs'), { recursive: true });
    fs.mkdirSync(path.join(tmpArt, 'evidence'), { recursive: true });

    const plantedWsSecret = 'planted_ws_token_secret_9876543210abcdef';
    const plantedDynRegRef = 'planted_dynreg_ref_token_43chars_abcdefghijk';
    const plantedApiSecret = 'planted_lti_api_secret_1122334455667788';

    fs.writeFileSync(
      path.join(tmpClone, 'tests', 'e2e', 'artifacts', 'captured-secrets.jsonl'),
      `${JSON.stringify({ label: 'ws-token', value: plantedWsSecret })}\n`,
    );
    fs.writeFileSync(
      path.join(tmpClone, 'tests', 'acceptance', 'artifacts', 'm1-secrets.raw.jsonl'),
      `${JSON.stringify({ label: 'moodle-dynreg-ref', value: plantedDynRegRef })}\n`,
    );
    fs.writeFileSync(
      path.join(tmpClone, 'tests', 'acceptance', 'artifacts', 'captured-secrets.txt'),
      `LTI_API_KEY=${plantedApiSecret}\n`,
    );

    // Plant secrets in both a service .jsonl log and a Moodle docker log
    fs.writeFileSync(
      path.join(tmpClone, 'infra', '.logs', 'cogniate-app.jsonl'),
      `${JSON.stringify({ msg: 'leak', token: plantedWsSecret })}\n`,
    );
    fs.writeFileSync(
      path.join(tmpArt, 'docker-logs', 'moodle-probe.log'),
      `GET /admin/tool/lti/startltiadvregistration.php?url=https%3A%2F%2Flti.cogniate.test%2Fregister%3Fref%3D${plantedDynRegRef} 200\n`,
    );
    fs.writeFileSync(path.join(tmpArt, 'evidence', 'clean.json'), JSON.stringify({ ok: true }));

    const redact = new Redactor();
    assert.equal(typeof redact.values, 'undefined', 'Redactor has no public .values property');
    loadCapturedSecretsIntoRedactor(tmpClone, redact);
    assert.equal(redact.size, 3, 'All 3 secrets (captured-secrets.jsonl, m1-secrets.raw.jsonl, captured-secrets.txt) loaded');

    // Probe A: Planted secret in temp logs MUST fail the scan
    const dirtyScan = scanSlot8Files({ redact, cloneDir: tmpClone, artDir: tmpArt });
    assert.equal(dirtyScan.ok, false, 'Planted secret probe must fail scan');
    assert.equal(dirtyScan.hitCount, 2, 'Planted secret probe must count 2 hits');
    assert.equal(dirtyScan.hits.length, 2, 'Planted secret probe must report both files');

    // Probe B: Redacting artifacts and cleaning the service log MUST pass the scan and report redaction counts
    const redactStats = redactSlot8Artifacts(tmpArt, redact);
    assert.equal(redactStats.redactedFileCount, 1, 'redactSlot8Artifacts reports 1 redacted artifact file');
    assert.equal(redactStats.replacementCount, 1, 'redactSlot8Artifacts reports 1 secret replacement');
    assert.deepEqual(redactStats.redactedFiles, [
      { file: path.join('docker-logs', 'moodle-probe.log'), replacements: 1 },
    ]);
    const moodleLogAfterRedact = fs.readFileSync(path.join(tmpArt, 'docker-logs', 'moodle-probe.log'), 'utf8');
    assert.ok(!moodleLogAfterRedact.includes(plantedDynRegRef), 'Moodle registration ref redacted from docker log');
    assert.match(moodleLogAfterRedact, /<redacted:44>/);

    fs.writeFileSync(
      path.join(tmpClone, 'infra', '.logs', 'cogniate-app.jsonl'),
      `${JSON.stringify({ msg: 'clean line', token: '<redacted:40>' })}\n`,
    );
    const cleanScan = scanSlot8Files({ redact, cloneDir: tmpClone, artDir: tmpArt });
    assert.equal(cleanScan.ok, true, 'Clean log probe must pass scan');
    assert.equal(cleanScan.hitCount, 0, 'Clean log probe must report 0 hits');
    assert.deepEqual(cleanScan.hits, []);

    console.log(
      JSON.stringify({
        selftest: 'PASS',
        defaults: resolvedDefaults,
        plantedProbe: dirtyScan,
        redactProbe: redactStats,
        cleanProbe: cleanScan,
      }),
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(SLOT8_HELP);
  process.exit(0);
}

if (process.argv.includes('--selftest')) {
  await runSelfTest();
  process.exit(0);
}

const isDirectEntry =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectEntry) {
  process.env.PUBLIC_PORT ??= SLOT8_DEFAULTS.defaultPort;
  process.env.STACK_SUBNET ??= SLOT8_DEFAULTS.defaultSubnet;

  const r = createRunner({
    task: SLOT8_DEFAULTS.task,
    defaultProject: SLOT8_DEFAULTS.defaultProject,
  });

  const ZIPS = [
    {
      name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip',
      sha256: 'a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7',
    },
    {
      name: 'Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip',
      sha256: '9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d',
    },
  ];

  function copyCourseFixtures() {
    const sources = [
      process.env.COURSE_FIXTURES_DIR,
      path.join(r.SOURCE, 'docs', 'raw', 'data', 'courses'),
      '/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures',
    ].filter(Boolean);
    const dest = path.join(r.CLONE, 'tests', 'fixtures', 'courses');
    fs.mkdirSync(dest, { recursive: true });
    const notes = [];
    let ok = true;
    for (const z of ZIPS) {
      const src = sources.map((d) => path.join(d, z.name)).find((f) => fs.existsSync(f));
      const sha = src ? crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex') : null;
      if (!src || sha !== z.sha256) {
        ok = false;
        notes.push(`${z.name}: ${src ? `SHA-256 ${sha}` : 'not found'}`);
        continue;
      }
      fs.copyFileSync(src, path.join(dest, z.name));
      notes.push(`${z.name}: copied (${sha.slice(0, 12)}…)`);
    }
    r.record('FIXTURES', 'Course fixture zips copied into clone (SHA-256 verified)', r.pass(ok), notes);
    return ok;
  }

  async function setup() {
    const ci = await r.npm('root-npm-ci', ['ci', '--no-audit', '--no-fund'], { timeoutMs: 900_000 });
    const gen = await r.npm('gen-env', ['run', 'gen-env']);
    r.loadStackFiles();
    await r.composeNameGuard();
    if (r.state.abort) return false;
    if (!copyCourseFixtures()) return false;

    const reset = await r.npm('e2e-reset', ['run', 'e2e:reset', '--', '--yes'], { timeoutMs: 1_200_000 });
    r.loadStackFiles();
    const setupOk = ci.code === 0 && gen.code === 0 && reset.code === 0;
    r.record(
      'SETUP',
      'npm ci, gen-env, e2e:reset -- --yes (build, stack:reset, default stack:up, seed, e2e-wait)',
      r.pass(setupOk),
      [`npm ci ${ci.code}, gen-env ${gen.code}, e2e:reset ${reset.code}`],
      [ci.log, gen.log, reset.log],
    );
    await r.checkProject();
    return !r.state.abort && setupOk;
  }

  function collectPlaywrightCases(pwJsonPath) {
    if (!fs.existsSync(pwJsonPath)) return [];
    const doc = JSON.parse(fs.readFileSync(pwJsonPath, 'utf8'));
    const cases = [];
    const walk = (suite, file) => {
      for (const spec of suite.specs ?? []) {
        for (const t of spec.tests ?? []) {
          const res = t.results?.at(-1) ?? {};
          const status = t.status === 'expected' || res.status === 'passed' ? 'PASS' : 'FAIL';
          const err = (res.errors ?? [])
            .map((e) =>
              String(e.message ?? '')
                .replace(/\u001b\[[0-9;]*m/g, '')
                .split('\n')
                .slice(0, 6)
                .join(' '),
            )
            .join(' | ');
          cases.push({
            file: suite.file ?? file ?? '',
            title: spec.title,
            status,
            durationMs: res.duration ?? 0,
            error: err || null,
            annotations: t.annotations ?? [],
          });
        }
      }
      for (const child of suite.suites ?? []) walk(child, child.file ?? file);
    };
    for (const s of doc.suites ?? []) walk(s, s.file ?? '');
    return cases;
  }

  async function runPlaywrightPhase(phaseName, grepPattern) {
    const relArt = `artifacts/moodle-live-${phaseName}`;
    const hostArt = path.join(r.CLONE, 'tests', 'e2e', relArt);
    fs.rmSync(hostArt, { recursive: true, force: true });
    fs.mkdirSync(hostArt, { recursive: true });

    const containerName = `${r.PROJECT}-qa-s8-${phaseName}-${process.pid}`;
    const inside =
      'set -euo pipefail; source infra/scripts/lib.sh; require_running proxy; prepare_e2e; qa_env_args; ' +
      `dc --profile test run --rm --no-deps --name "${containerName}" --build "\${QA_ENV_ARGS[@]+"\${QA_ENV_ARGS[@]}"}" e2e sh -c ` +
      "'npm ci --prefix tests --no-audit --no-fund && cd tests && ./node_modules/.bin/playwright test -c e2e/ltiaas/playwright.moodle-live.config.ts'";

    const runRes = await r.exec(`playwright-${phaseName}`, 'bash', ['-c', inside], {
      env: {
        ...r.STACK_ENV,
        QA_SLOT8_PHASE: phaseName,
        QA_MOODLE_LIVE_ARTIFACT_DIR: `../${relArt}`,
        ...(grepPattern ? { QA_GREP: grepPattern } : {}),
      },
      timeoutMs: 1_200_000,
    });
    // Load captured secrets (including m1-secrets.raw.jsonl) immediately so saveText redacts them
    loadCapturedSecretsIntoRedactor(r.CLONE, r.redact);

    const pwJsonPath = path.join(hostArt, 'playwright.json');
    if (fs.existsSync(pwJsonPath)) {
      r.saveText(`playwright-${phaseName}.json`, fs.readFileSync(pwJsonPath, 'utf8'));
    }
    const evDir = path.join(r.CLONE, 'tests', 'e2e', 'artifacts', 'evidence');
    if (fs.existsSync(evDir)) {
      for (const f of fs.readdirSync(evDir).filter((n) => n.endsWith('.json'))) {
        r.saveText(`evidence-${f}`, fs.readFileSync(path.join(evDir, f), 'utf8'));
      }
    }
    const cases = collectPlaywrightCases(pwJsonPath);
    const allPass = runRes.code === 0 && cases.length > 0 && cases.every((c) => c.status === 'PASS');

    for (const c of cases) {
      const idMatch = /^(S8-\d+)/.exec(c.title);
      const id = idMatch ? idMatch[1] : `SLOT8-${phaseName}`;
      r.record(
        id,
        c.title,
        c.status,
        [`${(c.durationMs / 1000).toFixed(2)}s${c.error ? ` — ${c.error}` : ''}`],
        [runRes.log],
      );
    }
    if (cases.length === 0) {
      r.record(
        `SLOT8-${phaseName.toUpperCase()}`,
        `Playwright ${phaseName} execution`,
        'FAIL',
        [`exit ${runRes.code}, 0 cases collected`],
        [runRes.log],
      );
    }
    return { ok: allPass, cases, log: runRes.log };
  }

  async function runContinuityAndLegacyU1Step() {
    const statePath = path.join(r.CLONE, 'tests', 'e2e', 'artifacts', 'slot8-state.json');
    const seedPath = path.join(r.CLONE, 'infra', '.secrets', 'seed.json');
    if (!fs.existsSync(statePath) || !fs.existsSync(seedPath)) {
      r.record('S8-U1-PREP', 'Inspect cgk1 sealed columns and stage legacy ws_token_encrypted U1 fixture', 'FAIL', [
        'slot8-state.json or infra/.secrets/seed.json missing after pass1',
      ]);
      return false;
    }
    const slot8State = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const connectionId = slot8State.connectionId;
    const productToken = extractProductWsToken(seedData);
    if (productToken) r.redact.add(productToken);

    const inspectAndStageScript = `
      import crypto from 'node:crypto';
      import { DatabaseSync } from 'node:sqlite';
      const dbPath = '/data/cogniate.db';
      const connId = process.env.QA_CONN_ID;
      const token = process.env.QA_WS_TOKEN;
      const masterKeyHex = process.env.APP_MASTER_KEY;
      const db = new DatabaseSync(dbPath);
      const connRow = db.prepare('SELECT id, ws_token_encrypted FROM connection WHERE id = ?').get(connId);
      const refRow = db.prepare('SELECT id, ref_token_encrypted FROM connection WHERE ref_token_encrypted IS NOT NULL AND length(ref_token_encrypted) > 0 LIMIT 1').get();
      const rlRow = db.prepare('SELECT id, service_key_encrypted FROM resource_link WHERE connection_id = ? AND service_key_encrypted IS NOT NULL AND length(service_key_encrypted) > 0 LIMIT 1').get(connId);
      const pkRow = db.prepare('SELECT id, ltik_encrypted FROM picker_session WHERE connection_id = ? AND ltik_encrypted IS NOT NULL AND length(ltik_encrypted) > 0 ORDER BY created_at DESC LIMIT 1').get(connId);
      const headerOf = (b) => b ? Buffer.from(b).subarray(0, 4).toString('ascii') : null;
      const beforeHeaders = {
        ws_token_encrypted: headerOf(connRow?.ws_token_encrypted),
        ref_token_encrypted: headerOf(refRow?.ref_token_encrypted),
        service_key_encrypted: headerOf(rlRow?.service_key_encrypted),
        ltik_encrypted: headerOf(pkRow?.ltik_encrypted),
      };
      // Stage pre-LA legacy unheadered AES-256-GCM blob (iv[12] || tag[16] || ciphertext) for ws_token_encrypted (AC-LA-E5-22-06 / A-LAB-09)
      const key = Buffer.from(masterKeyHex, 'hex');
      const iv = Buffer.from('514153384c45474143594956', 'hex'); // 12 bytes fixed non-"cgk1" IV ("QAS8LEGACYIV")
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
      const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const legacyBlob = Buffer.concat([iv, tag, enc]);
      db.prepare('UPDATE connection SET ws_token_encrypted = ? WHERE id = ?').run(legacyBlob, connId);
      const afterRow = db.prepare('SELECT ws_token_encrypted FROM connection WHERE id = ?').get(connId);
      const afterHeader = headerOf(afterRow?.ws_token_encrypted);
      db.close();
      console.log(JSON.stringify({ ok: true, beforeHeaders, afterWsHeader: afterHeader, legacyBlobLength: legacyBlob.length }));
    `;

    const stageRes = await r.exec(
      'stage-legacy-u1-ws-token',
      'docker',
      [
        'compose',
        '-f',
        'infra/compose.yaml',
        '--env-file',
        '.env',
        'exec',
        '-T',
        '-e',
        `QA_CONN_ID=${connectionId}`,
        '-e',
        `QA_WS_TOKEN=${productToken}`,
        'cogniate-app',
        'node',
        '--input-type=module',
        '-e',
        inspectAndStageScript,
      ],
      { timeoutMs: 60_000 },
    );

    let parsed = null;
    try {
      const lastLine = stageRes.stdout.trim().split('\n').pop() ?? '';
      parsed = JSON.parse(lastLine);
    } catch {
      parsed = null;
    }
    const headersOk =
      parsed?.ok === true &&
      parsed?.beforeHeaders?.ws_token_encrypted === 'cgk1' &&
      parsed?.beforeHeaders?.ref_token_encrypted === 'cgk1' &&
      parsed?.beforeHeaders?.service_key_encrypted === 'cgk1' &&
      parsed?.beforeHeaders?.ltik_encrypted === 'cgk1' &&
      parsed?.afterWsHeader !== 'cgk1';

    r.record(
      'S8-U1-PREP',
      'Verify all 4 cogniate-app encrypted columns start with "cgk1" and stage legacy unheadered ws_token_encrypted blob for AC-LA-E5-22-06',
      r.pass(stageRes.code === 0 && headersOk),
      [JSON.stringify(parsed)],
      [stageRes.log],
    );
    if (!headersOk) return false;

    // Restart lti-service and cogniate-app to verify U1/U2 continuity across service restarts on live Moodle
    const restartLti = await r.npm('restart-lti-service', ['run', 'stack:restart', '--', 'lti-service'], {
      timeoutMs: 300_000,
    });
    const restartApp = await r.npm('restart-cogniate-app', ['run', 'stack:restart', '--', 'cogniate-app'], {
      timeoutMs: 300_000,
    });
    const ltiHealth = await r.waitHealth(
      r.state.urls.lti,
      (b) => b.status === 'ok' && b.profile === 'default' && Array.isArray(b.knobs) && b.knobs.length === 0,
      60_000,
    );
    const appHealth = await r.waitHealth(
      r.state.urls.app,
      (b) => b.status === 'ok' && b.profile === 'default' && Array.isArray(b.knobs) && b.knobs.length === 0,
      60_000,
    );
    const restartOk = restartLti.code === 0 && restartApp.code === 0 && ltiHealth.ok && appHealth.ok;
    r.record(
      'S8-U2-RESTART',
      'Rolling restart of lti-service and cogniate-app on live Moodle stack (U1/U2 continuity)',
      r.pass(restartOk),
      [
        `lti-service restart exit ${restartLti.code} (health ok=${ltiHealth.ok}); cogniate-app restart exit ${restartApp.code} (health ok=${appHealth.ok})`,
      ],
      [restartLti.log, restartApp.log],
    );
    return restartOk;
  }

  async function verifyKeysStatus() {
    const keysStatus = await r.exec(
      'app-keys-status',
      'docker',
      ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env', 'exec', '-T', 'cogniate-app', 'npm', 'run', '-s', 'app:keys', '--', 'status'],
      { timeoutMs: 60_000 },
    );
    r.record(
      'S8-KEYS-STATUS',
      'cogniate-app app:keys status after Pass 2 re-seal',
      r.pass(keysStatus.code === 0 && keysStatus.stdout.includes('sealed values')),
      [keysStatus.stdout.trim().replace(/\s+/g, ' ')],
      [keysStatus.log],
    );
  }

  async function collectAndScanLogsAndEvidence() {
    // 1. Load all stack + suite secrets (including m1-secrets.raw.jsonl) into Redactor first
    loadStackSecretsIntoRedactor(r.CLONE, r.redact);
    loadCapturedSecretsIntoRedactor(r.CLONE, r.redact);

    // 2. Copy evidence files from tests/e2e/artifacts/evidence into runner ART/evidence
    const evSrc = path.join(r.CLONE, 'tests', 'e2e', 'artifacts', 'evidence');
    if (fs.existsSync(evSrc)) {
      const evDest = path.join(r.ART, 'evidence');
      fs.mkdirSync(evDest, { recursive: true });
      fs.cpSync(evSrc, evDest, { recursive: true });
    }

    // 3. Collect docker-logs and service-logs BEFORE scanning so the in-run scan covers docker-logs/ too
    try {
      const { containers } = await projectResources(r.PROJECT);
      for (const c of await dockerInspect(containers)) {
        const service = c.Config?.Labels?.['com.docker.compose.service'] ?? c.Name.replace(/^\//, '');
        const logRes = await run('docker', ['logs', '--timestamps', c.Id], { timeoutMs: 60_000 });
        r.saveText(
          path.join('docker-logs', `${service}-${c.Id.slice(0, 8)}.log`),
          `${logRes.stdout}\n--- stderr\n${logRes.stderr}`,
        );
      }
      const infraLogs = path.join(r.CLONE, 'infra', '.logs');
      if (fs.existsSync(infraLogs)) {
        for (const f of walkFiles(infraLogs)) {
          r.saveText(path.join('service-logs', path.basename(f)), fs.readFileSync(f, 'utf8'));
        }
      }
    } catch (e) {
      r.log(`pre-scan log collection note: ${e.message}`);
    }

    // 4. Redact all runner artifacts with the complete secret set, then scan infra/.logs and r.ART
    const artifactRedaction = redactSlot8Artifacts(r.ART, r.redact);
    const scan = scanSlot8Files({ redact: r.redact, cloneDir: r.CLONE, artDir: r.ART });
    const scanReport = {
      ...scan,
      artifactRedaction,
    };
    r.saveText('slot8-secret-scan.json', JSON.stringify(scanReport, null, 2));
    r.record(
      'M3-07-S8',
      'Secret scan across all Slot 8 service logs (.jsonl), docker-logs, and evidence artifacts',
      r.pass(scan.ok),
      [
        `scanned ${scan.secretCount} secrets across ${scan.scannedFileCount} files, hits: ${scan.hitCount} (pre-redacted ${artifactRedaction.replacementCount} value(s) in ${artifactRedaction.redactedFileCount} artifact file(s))`,
        ...scan.hits,
      ],
    );
  }

  await r.main(async () => {
    try {
      if (!(await setup())) return;
      const p1 = await runPlaywrightPhase('pass1');
      if (!p1.ok) return;
      if (!(await runContinuityAndLegacyU1Step())) return;
      const p2 = await runPlaywrightPhase('pass2');
      const allCases = [...p1.cases, ...p2.cases];
      r.saveText(
        'slot8-case-results.json',
        JSON.stringify({ pass1: p1.cases, pass2: p2.cases, total: allCases.length }, null, 2),
      );
      if (!p2.ok) return;
      await verifyKeysStatus();
    } finally {
      await collectAndScanLogsAndEvidence();
    }
  });
}
