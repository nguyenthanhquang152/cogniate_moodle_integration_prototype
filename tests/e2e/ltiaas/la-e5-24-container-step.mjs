#!/usr/bin/env node
// In-container helper for LA-E5-24 pilot backup and restore drill.
// Runs inside the e2e container (`dc --profile test run --rm --no-deps ... e2e node tests/e2e/ltiaas/la-e5-24-container-step.mjs`)
// so it can reach the internal operator listeners (`http://lti-service:4110`, `http://cogniate-app:4210`),
// the simulator (`https://lms-sim.test`), and the public HTTPS endpoints (`PUBLIC_LTI_URL`, `PUBLIC_APP_URL`, `PUBLIC_CONTENT_URL`).
// Uses Node built-ins only.
//
// Secret rule: no operator key, API key, master key, ltik, runtime token, or password is ever placed in an assertion message or shared JSON.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  OPERATOR_KEY_RE,
  buildDrillMarkerAccount,
  makeHtmlCourseZipBuffer,
  redactPlayId,
  sanitizeUrlForError,
  verifyDrillMarkerAbsent,
} from './la-e5-24-drill.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const ARTIFACTS_DIR = path.join(REPO_ROOT, 'tests', 'acceptance', 'artifacts');
const STATE_FILE = path.join(ARTIFACTS_DIR, 'la-e5-24-state.json');
const POST_BACKUP_FILE = path.join(ARTIFACTS_DIR, 'la-e5-24-post-backup-write.json');
const POST_RESTORE_FILE = path.join(ARTIFACTS_DIR, 'la-e5-24-post-restore.json');
const SECRETS_FILE = path.join(ARTIFACTS_DIR, 'captured-secrets.jsonl');

const OPERATOR_URL = (process.env.QA_OPERATOR_URL ?? 'http://lti-service:4110').replace(/\/+$/, '');
const APP_OPERATOR_URL = (process.env.QA_APP_OPERATOR_URL ?? 'http://cogniate-app:4210').replace(/\/+$/, '');
const PUBLIC_LTI_URL = (process.env.PUBLIC_LTI_URL ?? 'https://lti.cogniate.test:9443').replace(/\/+$/, '');
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL ?? 'https://app.cogniate.test:9443').replace(/\/+$/, '');
const PUBLIC_CONTENT_URL = (process.env.PUBLIC_CONTENT_URL ?? 'https://content.cogniate.test:9443').replace(/\/+$/, '');
const SIM_BASE_URL = 'https://lms-sim.test/__sim';
const MOODLE_SIM_ISSUER = 'https://moodle.sim.test';

const { values: opt } = parseArgs({
  options: {
    step: { type: 'string' },
    'run-id': { type: 'string' },
  },
});

function rootCaPem() {
  const certPath = path.join(REPO_ROOT, 'infra', '.certs', 'root.crt');
  if (fs.existsSync(certPath)) return fs.readFileSync(certPath, 'utf8');
  if (process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(process.env.NODE_EXTRA_CA_CERTS)) {
    return fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS, 'utf8');
  }
  throw new Error(`Missing root CA at ${certPath}`);
}

function readOperatorKey() {
  const p = path.join(REPO_ROOT, 'infra', '.secrets', 'lti-operator-key');
  const key = fs.readFileSync(p, 'utf8').trim();
  assert.match(key, OPERATOR_KEY_RE, 'operator key format matches ltio_<43 base64url>');
  rememberSecret('operator_key', key);
  return key;
}

const rememberedSecrets = new Set();

function rememberSecret(label, value) {
  if (typeof value !== 'string' || value.length < 8) return;
  rememberedSecrets.add(value);
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true, mode: 0o700 });
  fs.appendFileSync(SECRETS_FILE, `${JSON.stringify({ label, value })}\n`, { mode: 0o600 });
}

function scrubRememberedSecrets(text) {
  let out = String(text ?? '');
  const sorted = [...rememberedSecrets].sort((a, b) => b.length - a.length);
  for (const s of sorted) {
    out = out.replaceAll(s, '[REDACTED]');
  }
  return out;
}

function portalUser(email) {
  const seedFile = path.join(REPO_ROOT, 'infra', '.secrets', 'seed.json');
  const raw = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  const found = [];
  const walk = (n) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (typeof n.email === 'string' && typeof n.password === 'string') {
        found.push({ email: n.email, password: n.password });
      }
      Object.values(n).forEach(walk);
    }
  };
  walk(raw.portal ?? raw);
  const user = found.find((u) => u.email === email);
  assert.ok(user, `seed.json contains portal user ${email}`);
  rememberSecret('portal_password', user.password);
  return user;
}

function rawRequest(urlStr, { method = 'GET', headers = {}, body, timeoutMs = 20_000 } = {}) {
  const u = new URL(urlStr);
  const isHttps = u.protocol === 'https:';
  const reqHeaders = { ...headers };
  let payload;
  if (body !== undefined) {
    if (Buffer.isBuffer(body)) {
      payload = body;
    } else if (typeof body === 'string') {
      payload = Buffer.from(body, 'utf8');
    } else {
      payload = Buffer.from(JSON.stringify(body), 'utf8');
      if (!reqHeaders['content-type']) reqHeaders['content-type'] = 'application/json';
    }
    reqHeaders['content-length'] = String(payload.length);
  }
  const client = isHttps ? https : http;
  const options = {
    protocol: u.protocol,
    hostname: u.hostname,
    port: u.port || (isHttps ? 443 : 80),
    path: `${u.pathname}${u.search}`,
    method,
    headers: reqHeaders,
    agent: false,
    timeout: timeoutMs,
    ...(isHttps ? { ca: rootCaPem(), servername: u.hostname } : {}),
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const text = raw.toString('utf8');
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: text,
          raw,
          json,
        });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`Timeout after ${timeoutMs} ms: ${sanitizeUrlForError(u)}`)));
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function operatorRequest(method, pathAndQuery, operatorKey, body) {
  const headers = { accept: 'application/json' };
  if (operatorKey) headers.authorization = `OPERATOR-AUTH-V1 ${operatorKey}`;
  return rawRequest(`${OPERATOR_URL}${pathAndQuery}`, { method, headers, body });
}

function appRequest(method, pathAndQuery, { cookie, body } = {}) {
  const headers = { accept: 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (method !== 'GET') headers.origin = PUBLIC_APP_URL;
  return rawRequest(`${PUBLIC_APP_URL}${pathAndQuery}`, { method, headers, body });
}

async function signInPortal(email = 'thanh@cogniate.test') {
  const user = portalUser(email);
  const res = await appRequest('POST', '/app-api/session', {
    body: { email: user.email, password: user.password },
  });
  assert.equal(res.status, 204, `POST /app-api/session status ${res.status}`);
  const setCookie = [res.headers['set-cookie'] ?? []].flat().find((c) => c.startsWith('__Host-cog_session='));
  assert.ok(setCookie, 'Session cookie set on sign-in');
  const cookie = setCookie.split(';')[0];
  rememberSecret('session_cookie', cookie);
  return cookie;
}

async function uploadCourseZip(cookie, courseId, zipBuf, filename = 'drill-course.zip') {
  const boundary = `----qaDrill${Date.now().toString(16)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="package"; filename="${filename}"\r\nContent-Type: application/zip\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const payload = Buffer.concat([head, zipBuf, tail]);
  const res = await rawRequest(`${PUBLIC_APP_URL}/app-api/courses/${encodeURIComponent(courseId)}/versions`, {
    method: 'POST',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      cookie,
      origin: PUBLIC_APP_URL,
      accept: 'application/json',
    },
    body: payload,
    timeoutMs: 60_000,
  });
  assert.equal(res.status, 201, `POST /app-api/courses/:id/versions status ${res.status}`);
  return res.json;
}

async function checkReadinessAndHealth() {
  const ltiPublicReady = await rawRequest(`${PUBLIC_LTI_URL}/readyz`);
  assert.equal(ltiPublicReady.status, 200, `GET ${PUBLIC_LTI_URL}/readyz status`);
  assert.equal(ltiPublicReady.json?.status, 'ready', 'LTI public /readyz status is "ready"');

  const ltiOperatorReady = await rawRequest(`${OPERATOR_URL}/readyz`);
  assert.equal(ltiOperatorReady.status, 200, `GET ${OPERATOR_URL}/readyz status`);
  assert.equal(ltiOperatorReady.json?.status, 'ready', 'LTI operator /readyz status is "ready"');

  const appHealth = await rawRequest(`${PUBLIC_APP_URL}/healthz`);
  assert.equal(appHealth.status, 200, `GET ${PUBLIC_APP_URL}/healthz status`);
  assert.equal(appHealth.json?.status, 'ok', 'App /healthz status is "ok"');

  const appOperatorReady = await rawRequest(`${APP_OPERATOR_URL}/readyz`);
  assert.equal(appOperatorReady.status, 200, `GET ${APP_OPERATOR_URL}/readyz status`);
  assert.equal(appOperatorReady.json?.status, 'ready', 'App operator /readyz status is "ready"');

  return {
    ltiPublicReady: ltiPublicReady.json,
    ltiOperatorReady: ltiOperatorReady.json,
    appHealth: appHealth.json,
    appOperatorReady: appOperatorReady.json,
  };
}

function parseHtmlForm(html) {
  const decode = (s) =>
    s
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
  const action = html.match(/<form\b[^>]*\baction="([^"]+)"/i)?.[1];
  assert.ok(action, 'HTML form action found');
  const fields = Object.fromEntries(
    [...html.matchAll(/<input\b[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]*)"/gi)].map((m) => [m[1], decode(m[2])]),
  );
  return { action: decode(action), fields };
}

async function stepPreBackup(runId) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const operatorKey = readOperatorKey();
  const readiness = await checkReadinessAndHealth();

  // Seed a Moodle-sim manual connection + HTML course + publication before backup so the restored stack
  // already holds a complete connection, platform key pair, and published course package for AC-LA-E5-24-05.
  const cookie = await signInPortal();
  const connName = `Drill Moodle Sim ${runId}`;
  const clientId = `drill-moodle-client-${runId}`;
  const deploymentId = '1';

  const createConn = await appRequest('POST', '/app-api/connections', {
    cookie,
    body: {
      name: connName,
      siteUrl: MOODLE_SIM_ISSUER,
      method: 'manual',
      lms: 'moodle',
      profile: 'standard',
    },
  });
  assert.equal(createConn.status, 201, `POST /app-api/connections status ${createConn.status}`);
  const connectionId = String(createConn.json.id);

  const bindPlatform = await appRequest('PUT', `/app-api/connections/${encodeURIComponent(connectionId)}/platform`, {
    cookie,
    body: {
      issuer: MOODLE_SIM_ISSUER,
      clientId,
      deploymentId,
      authenticationEndpoint: `${MOODLE_SIM_ISSUER}/mod/lti/auth.php`,
      accessTokenEndpoint: `${MOODLE_SIM_ISSUER}/mod/lti/token.php`,
      jwksUrl: `${MOODLE_SIM_ISSUER}/mod/lti/certs.php`,
    },
  });
  assert.equal(bindPlatform.status, 200, `PUT /app-api/connections/:id/platform status ${bindPlatform.status}`);
  assert.equal(bindPlatform.json?.status, 'registered', 'Moodle-sim connection is registered');

  const createCourseRes = await appRequest('POST', '/app-api/courses', {
    cookie,
    body: { title: `Drill Pre-Backup HTML Course ${runId}` },
  });
  assert.equal(createCourseRes.status, 201, `POST /app-api/courses status ${createCourseRes.status}`);
  const courseId = String(createCourseRes.json.id);

  const versionJson = await uploadCourseZip(
    cookie,
    courseId,
    makeHtmlCourseZipBuffer(`Drill Pre-Backup HTML Course ${runId}`),
  );
  const versionId = String(versionJson.version?.id ?? versionJson.id);

  const pubRes = await appRequest('POST', '/app-api/publications', {
    cookie,
    body: { connectionId, courseId },
  });
  assert.equal(pubRes.status, 201, `POST /app-api/publications status ${pubRes.status}`);
  const publicationId = String(pubRes.json.id);

  // Query GET /operator/v1/key-provider for AC-LA-E5-24-02.
  const kpRes = await operatorRequest('GET', '/operator/v1/key-provider', operatorKey);
  assert.equal(kpRes.status, 200, `GET /operator/v1/key-provider status ${kpRes.status}`);
  assert.ok(kpRes.json && typeof kpRes.json.kind === 'string', 'key-provider response has kind');
  assert.ok(typeof kpRes.json.activeVersion === 'string', 'key-provider response has activeVersion');
  assert.ok(Array.isArray(kpRes.json.versions) && kpRes.json.versions.length > 0, 'key-provider response has versions');

  const acctsRes = await operatorRequest('GET', '/operator/v1/accounts', operatorKey);
  assert.equal(acctsRes.status, 200, `GET /operator/v1/accounts status ${acctsRes.status}`);
  const preBackupAccounts = (acctsRes.json?.accounts ?? []).map((a) => a.id);
  const drillAccountId = `drill-${runId}`;
  assert.equal(preBackupAccounts.includes(drillAccountId), false, `${drillAccountId} absent before backup`);

  const state = {
    runId,
    drillAccountId,
    connectionId,
    clientId,
    deploymentId,
    courseId,
    versionId,
    publicationId,
    keyProviderStatus: kpRes.json,
    preBackupAccounts,
    readiness,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  process.stdout.write(`${scrubRememberedSecrets(JSON.stringify({ ok: true, step: 'pre-backup', state }))}\n`);
}

async function stepPostBackupWrite(runId) {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const effectiveRunId = runId ?? state.runId;
  const operatorKey = readOperatorKey();
  const payload = buildDrillMarkerAccount(effectiveRunId, PUBLIC_APP_URL);

  const createRes = await operatorRequest('POST', '/operator/v1/accounts', operatorKey, payload);
  assert.equal(createRes.status, 201, `POST /operator/v1/accounts status ${createRes.status} (AC-LA-E5-24-03)`);
  assert.equal(createRes.json?.id, payload.id, 'Created account id matches drill-<runId>');
  assert.equal(createRes.json?.status, 'active', 'Created drill marker account is active');

  const listRes = await operatorRequest('GET', '/operator/v1/accounts', operatorKey);
  assert.equal(listRes.status, 200, `GET /operator/v1/accounts status ${listRes.status}`);
  const accountIds = (listRes.json?.accounts ?? []).map((a) => a.id);
  assert.ok(accountIds.includes(payload.id), `GET /operator/v1/accounts includes ${payload.id} before restore`);

  const out = {
    ok: true,
    step: 'post-backup-write',
    createdStatus: createRes.status,
    createdAccount: createRes.json,
    accountIdsBeforeRestore: accountIds,
  };
  fs.writeFileSync(POST_BACKUP_FILE, JSON.stringify(out, null, 2), { mode: 0o600 });
  process.stdout.write(`${scrubRememberedSecrets(JSON.stringify(out))}\n`);
}

async function stepPostRestoreVerify(runId) {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const effectiveRunId = runId ?? state.runId;
  const drillAccountId = `drill-${effectiveRunId}`;
  const operatorKey = readOperatorKey();

  // 1. AC-LA-E5-24-04: Readiness and health checks + absence of drill-<runId>.
  const readiness = await checkReadinessAndHealth();
  const listRes = await operatorRequest('GET', '/operator/v1/accounts', operatorKey);
  assert.equal(listRes.status, 200, `GET /operator/v1/accounts status ${listRes.status}`);
  const absenceCheck = verifyDrillMarkerAbsent(listRes.json?.accounts ?? [], drillAccountId);

  const directGet = await operatorRequest(
    'GET',
    `/operator/v1/accounts/${encodeURIComponent(drillAccountId)}`,
    operatorKey,
  );
  assert.equal(directGet.status, 404, `GET /operator/v1/accounts/${drillAccountId} returns 404 after restore`);

  // 2. AC-LA-E5-24-05: Simulator learner launch reaches the player, and one final score reaches the simulator.
  const cursorBeforeRes = await rawRequest(`${SIM_BASE_URL}/records?since=0`);
  assert.equal(cursorBeforeRes.status, 200, 'GET /__sim/records?since=0');
  const cursorBefore = Number(cursorBeforeRes.json?.cursor ?? 0);

  const scenarioId = `sc-drill-${effectiveRunId}`;
  const learnerSub = `learner-drill-${effectiveRunId}`;
  const resourceLinkId = `rl-drill-${effectiveRunId}`;
  const scRes = await rawRequest(`${SIM_BASE_URL}/scenarios`, {
    method: 'POST',
    body: {
      id: scenarioId,
      provider: 'moodle-sim',
      issuer: MOODLE_SIM_ISSUER,
      clientId: state.clientId,
      deploymentId: state.deploymentId,
      siteHost: 'moodle.sim.test',
      pageHost: 'moodle.sim.test',
      resource: state.publicationId,
      resourceLinkId,
      subject: learnerSub,
    },
  });
  assert.equal(scRes.status, 201, `POST /__sim/scenarios status ${scRes.status}`);

  const loginFields = Object.fromEntries(
    Object.entries(scRes.json?.login ?? {}).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
  );
  const loginRes = await rawRequest(`${PUBLIC_LTI_URL}/lti/login/cogniate`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(loginFields).toString(),
  });
  assert.equal(loginRes.status, 302, `POST /lti/login/cogniate status ${loginRes.status}`);
  const stateCookie =
    [loginRes.headers['set-cookie'] ?? []]
      .flat()
      .map((c) => String(c).split(';')[0])
      .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  assert.ok(stateCookie, 'LTI login set __Host-lti_state_* cookie');

  const authRedirectUrl = String(loginRes.headers.location ?? '');
  assert.ok(authRedirectUrl.startsWith('https://moodle.sim.test/'), 'LTI login redirects to moodle.sim.test auth');
  const authorizeRes = await rawRequest(authRedirectUrl);
  assert.equal(authorizeRes.status, 200, 'Simulator OIDC auth endpoint returned 200');
  const form = parseHtmlForm(authorizeRes.body);
  rememberSecret('id_token', form.fields.id_token);
  rememberSecret('state', form.fields.state);

  const launchRes = await rawRequest(form.action, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: stateCookie,
    },
    body: new URLSearchParams(form.fields).toString(),
  });
  assert.equal(launchRes.status, 303, `POST /lti/launch/cogniate status ${launchRes.status}`);
  const handoffLocation = String(launchRes.headers.location ?? '');
  const ltik = new URL(handoffLocation).searchParams.get('ltik') ?? '';
  rememberSecret('ltik', ltik);

  const handoffRes = await rawRequest(handoffLocation);
  assert.equal(handoffRes.status, 303, `GET /tool/launch handoff status ${handoffRes.status}`);
  const playUrl = new URL(String(handoffRes.headers.location ?? ''), PUBLIC_APP_URL);
  assert.match(playUrl.pathname, /^\/play\/ply_/, 'Handoff redirects to /play/ply_<id>');
  const playId = playUrl.pathname.split('/')[2];
  rememberSecret('play_id', playId);

  const shellRes = await rawRequest(`${PUBLIC_APP_URL}/play/${playId}`);
  assert.equal(shellRes.status, 200, `GET /play/:playId status ${shellRes.status}`);
  const runtimeUrl = shellRes.body.match(/src="(https:[^"]+\/rt\/[^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  assert.ok(runtimeUrl, 'Player shell contains runtime iframe URL');
  const runtimeToken = new URL(runtimeUrl).pathname.split('/')[2];
  rememberSecret('runtime_token', runtimeToken);

  // Verify the runtime page (/rt/:token), runtime state (/rt/:token/state), and restored course package content page (/pkg/:pkgId/index.html) load in the player runtime (200).
  const runtimePageRes = await rawRequest(runtimeUrl);
  assert.equal(runtimePageRes.status, 200, 'Player runtime page /rt/:token loads (200)');
  assert.ok(runtimePageRes.body.includes('id="cogniate-package"'), 'Runtime page contains package iframe');

  const rtStateRes = await rawRequest(`${PUBLIC_CONTENT_URL}/rt/${runtimeToken}/state`);
  assert.equal(rtStateRes.status, 200, 'GET /rt/:token/state status 200');
  const rtState = rtStateRes.json;

  const packageEntryUrl = `${PUBLIC_CONTENT_URL}${rtState.packageBaseUrl}${rtState.launchPath}`;
  const packageHtmlRes = await rawRequest(packageEntryUrl);
  assert.equal(packageHtmlRes.status, 200, 'Restored course package index.html loads in player runtime');
  assert.ok(packageHtmlRes.body.includes('data-cog-quiz="q0"'), 'Restored course HTML contains quiz questions');

  // Commit 9/10 correct answers (score 90 / 100, Completed).
  const commitBody = {
    kind: 'html',
    event: 'progress',
    sessionId: rtState.sessionId,
    seq: Number(rtState.lastSeq) + 1,
    progress: {
      seenPages: ['index'],
      answers: Object.fromEntries(Array.from({ length: 10 }, (_, n) => [`q${n}`, n < 9 ? '1' : '0'])),
    },
  };
  const commitRes = await rawRequest(`${PUBLIC_CONTENT_URL}/rt/${runtimeToken}/commit`, {
    method: 'POST',
    body: commitBody,
  });
  assert.equal(commitRes.status, 200, `POST /rt/:token/commit status ${commitRes.status}`);

  // Poll simulator for the final AGS score record.
  let scoreRecord = null;
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const recRes = await rawRequest(`${SIM_BASE_URL}/records?since=${cursorBefore}`);
    assert.equal(recRes.status, 200, 'GET /__sim/records');
    const records = recRes.json?.records ?? [];
    scoreRecord = records.find((r) => r.kind === 'score' && r.resource === state.publicationId);
    if (scoreRecord) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(scoreRecord, 'Final score reached the simulator after restore (AC-LA-E5-24-05)');
  assert.deepEqual(
    [scoreRecord.body?.scoreGiven, scoreRecord.body?.scoreMaximum],
    [90, 100],
    'Simulator received score 90/100',
  );
  assert.equal(scoreRecord.body?.activityProgress, 'Completed', 'activityProgress === Completed');
  assert.equal(scoreRecord.body?.gradingProgress, 'FullyGraded', 'gradingProgress === FullyGraded');

  // Verify Cogniate portal results row shows status === 'sent'.
  const cookie = await signInPortal();
  let syncStatus = null;
  const portalDeadline = Date.now() + 15_000;
  while (Date.now() < portalDeadline) {
    const res = await appRequest('GET', `/app-api/publications/${encodeURIComponent(state.publicationId)}/results`, {
      cookie,
    });
    assert.equal(res.status, 200, 'GET /app-api/publications/:id/results');
    const row = (res.json?.rows ?? []).find((r) => r.learner?.sub === learnerSub);
    const sent = row?.scoreSyncs?.find((s) => s.status === 'sent');
    if (sent) {
      syncStatus = sent.status;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.equal(syncStatus, 'sent', 'Portal publication results show score sync status "sent"');

  // Capture simulator secrets for the host runner's secret scan.
  const simSecRes = await rawRequest(`${SIM_BASE_URL}/secrets`);
  if (simSecRes.status === 200 && Array.isArray(simSecRes.json?.values)) {
    for (const v of simSecRes.json.values) rememberSecret('sim_secret', v);
  }

  const out = {
    ok: true,
    step: 'post-restore-verify',
    readiness,
    absenceCheck,
    directGetDrillAccountStatus: directGet.status,
    launchAndScore: {
      scenarioId,
      ...redactPlayId(playId),
      packageHtmlStatus: packageHtmlRes.status,
      commitStatus: commitRes.status,
      simulatorScore: {
        scoreGiven: scoreRecord.body?.scoreGiven,
        scoreMaximum: scoreRecord.body?.scoreMaximum,
        activityProgress: scoreRecord.body?.activityProgress,
        gradingProgress: scoreRecord.body?.gradingProgress,
      },
      portalSyncStatus: syncStatus,
    },
  };
  fs.writeFileSync(POST_RESTORE_FILE, JSON.stringify(out, null, 2), { mode: 0o600 });
  process.stdout.write(`${scrubRememberedSecrets(JSON.stringify(out))}\n`);
}

try {
  if (opt.step === 'pre-backup') {
    assert.ok(opt['run-id'], '--run-id is required for --step pre-backup');
    await stepPreBackup(opt['run-id']);
  } else if (opt.step === 'post-backup-write') {
    await stepPostBackupWrite(opt['run-id']);
  } else if (opt.step === 'post-restore-verify') {
    await stepPostRestoreVerify(opt['run-id']);
  } else {
    console.error('Usage: node la-e5-24-container-step.mjs --step <pre-backup|post-backup-write|post-restore-verify> [--run-id <id>]');
    process.exit(2);
  }
} catch (err) {
  process.stderr.write(`${scrubRememberedSecrets(err?.stack ?? String(err))}\n`);
  process.exit(1);
}
