#!/usr/bin/env node
// QA-E2E host runner for Slot 8 MOODLE-LIVE gate (tests/ltiaas/GATE-RUN-PLAN.md §5 item 4):
// - LA-E7-09 live Moodle K2 (U1 cards + U2 wizards on default profile + U1/U2 continuity across restarts)
// - LA-E3-05 AC-LA-E3-05-04 and AC-LA-E3-05-11 (Moodle 5.2.4 picker single-select radio & Cancel button Playwright check)
// - LA-E4-03 AC-LA-E4-03-09 browser part (Moodle 5.2.4 HTML & SCORM 1.2 learner launches and lti-ags score sync)
// - LA-E5-22 AC-LA-E5-22-06 / A-LAB-09 (Moodle course shell creation with cgk1-sealed and legacy pre-upgrade ws_token_encrypted blobs)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRunner } from '../../host/core.mjs';
import { secretsInFile, walkFiles } from '../../host/lib.mjs';

const r = createRunner({
  task: 'LA-E7-09-SLOT8',
  defaultProject: 'qa-e2e-la-s8-r1',
  defaultPort: '9543',
  defaultSubnet: '172.21.0.0/16',
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
    r.record(`SLOT8-${phaseName.toUpperCase()}`, `Playwright ${phaseName} execution`, 'FAIL', [
      `exit ${runRes.code}, 0 cases collected`,
    ], [runRes.log]);
  }
  return { ok: allPass, cases, log: runRes.log };
}

function extractProductWsToken(seedRoot) {
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

async function verifyKeysStatusAndEvidence() {
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

  // Copy evidence files from tests/e2e/artifacts/evidence into runner ART/evidence
  const evSrc = path.join(r.CLONE, 'tests', 'e2e', 'artifacts', 'evidence');
  if (fs.existsSync(evSrc)) {
    const evDest = path.join(r.ART, 'evidence');
    fs.mkdirSync(evDest, { recursive: true });
    fs.cpSync(evSrc, evDest, { recursive: true });
    for (const f of walkFiles(evDest)) {
      if (/\.(json|txt|log|jsonl)$/.test(f)) {
        const raw = fs.readFileSync(f, 'utf8');
        fs.writeFileSync(f, r.redact.apply(raw));
      }
    }
  }

  // Secret hygiene scan across logs and runner artifacts
  const capFile = path.join(r.CLONE, 'tests', 'e2e', 'artifacts', 'captured-secrets.jsonl');
  if (fs.existsSync(capFile)) {
    for (const line of fs.readFileSync(capFile, 'utf8').split('\n').filter(Boolean)) {
      try {
        const item = JSON.parse(line);
        if (item.value) r.redact.add(item.value);
      } catch {
        // ignore
      }
    }
  }
  const secretFile = path.join(r.CLONE, 'tests', 'acceptance', 'artifacts', 'captured-secrets.txt');
  if (fs.existsSync(secretFile)) {
    for (const s of secretsInFile(secretFile).items) r.redact.add(s.value);
  }
  for (const f of walkFiles(r.ART).filter((n) => /\.(log|json|txt|jsonl|md|html)$/.test(n))) {
    const text = fs.readFileSync(f, 'utf8');
    const clean = r.redact.apply(text);
    if (clean !== text) fs.writeFileSync(f, clean);
  }
  const scanFiles = [
    ...walkFiles(path.join(r.CLONE, 'infra', '.logs')).filter((f) => f.endsWith('.jsonl')),
    ...walkFiles(r.ART).filter((f) => /\.(log|json|txt|jsonl|md)$/.test(f) && !f.endsWith('captured-secrets.txt')),
  ];
  const hits = [];
  for (const f of scanFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const h = [...r.redact.values].filter((v) => text.includes(v));
    if (h.length) hits.push(`${path.relative(r.CLONE, f)}: ${h.length} hit(s)`);
  }
  r.record(
    'M3-07-S8',
    'Secret scan across all Slot 8 service logs (.jsonl) and evidence artifacts',
    r.pass(hits.length === 0),
    [`scanned ${r.redact.values.size} secrets across ${scanFiles.length} files, hits: ${hits.length}`, ...hits],
  );
}

await r.main(async () => {
  if (!(await setup())) return;
  const p1 = await runPlaywrightPhase('pass1');
  if (!p1.ok) return;
  if (!(await runContinuityAndLegacyU1Step())) return;
  const p2 = await runPlaywrightPhase('pass2');
  const allCases = [...p1.cases, ...p2.cases];
  r.saveText('slot8-case-results.json', JSON.stringify({ pass1: p1.cases, pass2: p2.cases, total: allCases.length }, null, 2));
  if (!p2.ok) return;
  await verifyKeysStatusAndEvidence();
});
