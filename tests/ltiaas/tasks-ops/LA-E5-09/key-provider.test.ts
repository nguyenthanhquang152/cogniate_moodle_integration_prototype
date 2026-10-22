// LA-E5-09 acceptance (K1-SIM): Key provider status, re-wrap job, legacy refusal.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-09). One test per K1-SIM AC; each title starts
// with its AC id. AC-06, AC-07 and AC-08 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-09.md; LA-ADR-06 D6, D11 (AP-06-24, AP-06-33); contract delta §3, §5;
// operability §6.3; BD-A2-03, BD-A2-04.
//
// Secret rule: no API key, operator key, master key, ltik, service key or raw JWT is ever put into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { CONTROL_DIR, hostAction, type HostAction } from '../../../acceptance/lib/host-control';
import { ACCOUNT, apiKey, auth, ltiApi, recordSecret } from '../../../acceptance/lib/lti';
import { LOGS_DIR, SECRETS_DIR } from '../../../acceptance/lib/paths';
import { AGS, expectStatus, formPost, idToken, launch, records, type Json } from '../../../acceptance/M1/common/client';
import { OPERATOR_KEY_RE, TENANT_KEY_RE, operatorApi, operatorAuth, readOperatorKey } from '../LA-E5-01/operator';
import { listAudit } from '../LA-E5-02/audit-client';

const urls = publicUrls();
const runId = crypto.randomBytes(4).toString('hex');
const DEPLOYMENT_ID = `qa2-e509-d-${runId}`;
const SITE_HOST = 'learn-a.blackboard.sim.test';
const SITE_URL = `https://${SITE_HOST}`;
const LTI_LOG_FILE = path.join(LOGS_DIR, 'lti-service.jsonl');

const SCOPES = {
  lineitem: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  readonly: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  score: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  result: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
} as const;

interface KeyVersionStatus {
  id: string;
  state: 'active' | 'decrypt-only';
  sealedCount: number;
  derivedCount: number;
}

interface KeyProviderStatus {
  kind: string;
  activeVersion: string;
  versions: KeyVersionStatus[];
}

interface SigningKeyRow {
  kid: string;
  status: 'next' | 'active' | 'retired' | 'removed';
  publishedAt: string | null;
  activatedAt: string | null;
  retiredAt: string | null;
  removedAt: string | null;
}

interface ServiceLogLine {
  msg?: string;
  event?: string;
  job?: string;
  result?: string;
  ms?: number;
  counts?: Record<string, unknown>;
  trace_id?: string;
  traceId?: string;
  [field: string]: unknown;
}

type KeyringAction = HostAction & {
  action: 'qa2-e509-write-keyring-and-restart' | 'qa2-e509-restore-keyring';
};

type KeyringActionResult = {
  activeVersion: string;
  restartExit: number;
  healthOk: boolean;
};

let operatorKey = '';
let cogniateKey = '';
let legacyDerivedAfterLaunch = 0;
let logLinesBeforeRewrap = 0;
let auditIdsBeforeRewrap = new Set<string>();
let rewrapRequestTraceId = '';

// Saved during AC-01 while only LTI_MASTER_KEY ("legacy") is active, then used in AC-04 after re-wrap to "k2".
let preRewrapLaunch: {
  ltik: string;
  serviceKey: string;
  lineItemId: string;
  userId: string;
  resource: string;
} | null = null;

function readLtiLogLines(): ServiceLogLine[] {
  if (!fs.existsSync(LTI_LOG_FILE)) return [];
  const raw = fs.readFileSync(LTI_LOG_FILE, 'utf8');
  const out: ServiceLogLine[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') out.push(parsed as ServiceLogLine);
    } catch {
      // Ignore non-JSON lines if any.
    }
  }
  return out;
}

async function pollFor<T>(
  label: string,
  fn: () => Promise<T | null> | T | null,
  { timeoutMs = 15_000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await fn();
    if (found !== null) return found;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const finalFound = await fn();
  if (finalFound !== null) return finalFound;
  assert.fail(`Timed out after ${timeoutMs} ms waiting for ${label}`);
}

async function getKeyProviderStatus(): Promise<KeyProviderStatus> {
  const res = await operatorApi<KeyProviderStatus>('GET', '/operator/v1/key-provider', {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(res.status, 200, `GET /operator/v1/key-provider status ${res.status}`);
  assert.ok(res.json && typeof res.json === 'object', 'key-provider response is an object');
  assert.ok(Array.isArray(res.json.versions), 'key-provider response has versions array');
  return res.json;
}

async function ensureSimulatorDeployment() {
  const providers = await ltiApi<{ profiles?: { id: string; sharedPlatform?: { id: string; clientId: string } | null }[] }>(
    'GET',
    '/api/providers',
    { authorization: auth.bearer(cogniateKey) },
  );
  assert.equal(providers.status, 200, 'GET /api/providers status');
  let platformId = providers.json?.profiles?.find((p) => p.id === 'blackboard-sim')?.sharedPlatform?.id ?? '';
  if (!platformId) {
    const created = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
      authorization: auth.bearer(cogniateKey),
      body: { profile: 'blackboard-sim', clientId: 'qa-bb-app', name: 'QA2 Blackboard Sim' },
    });
    assert.ok(created.status === 201 || created.status === 200, `create blackboard-sim platform status ${created.status}`);
    platformId = String(created.json?.id ?? '');
  }
  assert.match(platformId, /^plt_/, 'blackboard-sim platformId exists');

  const depRes = await ltiApi('POST', `/api/platforms/${encodeURIComponent(platformId)}/deployments`, {
    authorization: auth.bearer(cogniateKey),
    body: { deploymentId: DEPLOYMENT_ID, siteUrl: SITE_URL },
  });
  assert.ok(depRes.status === 201 || depRes.status === 409, `create deployment ${DEPLOYMENT_ID} status ${depRes.status}`);
}

async function launchLearnerWithScopes(label: string, scopes: string[]) {
  const resource = `qa2-e509-rl-${label}-${runId}`;
  const lineitems = `${SITE_URL}/learn/api/public/v1/lti/courses/course-1/lineItems`;
  const lineitem = `${lineitems}/${encodeURIComponent(resource)}`;
  const launched = await launch({
    deploymentId: DEPLOYMENT_ID,
    siteHost: SITE_HOST,
    resource,
    resourceLinkId: resource,
    contextId: `ctx-e509-${label}-${runId}`,
    subject: `user-e509-${label}-${runId}`,
    claims: {
      [AGS]: { lineitems, lineitem, scope: scopes },
    },
  });
  assert.equal(launched.response.status, 303, `learner launch (${label}) status 303`);
  const tok = await idToken(launched.ltik);
  expectStatus(tok, 200);
  const serviceKey = String(tok.json?.services?.serviceKey ?? '');
  const lineItemId = String(tok.json?.services?.assignmentAndGrades?.lineItemId ?? lineitem);
  const userId = String(tok.json?.user?.id ?? '');
  assert.ok(serviceKey && lineItemId && userId, `learner launch (${label}) produced serviceKey, lineItemId and userId`);
  return { ltik: launched.ltik, serviceKey, lineItemId, userId, resource };
}

async function signAndReturnDeepLink(label: string) {
  const resource = `qa2-e509-dl-${label}-${runId}`;
  const dlLaunch = await launch({
    deploymentId: DEPLOYMENT_ID,
    siteHost: SITE_HOST,
    resource,
    messageType: 'LtiDeepLinkingRequest',
    roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
  });
  assert.equal(dlLaunch.response.status, 303, `Deep Linking launch (${label}) status 303`);
  assert.ok(dlLaunch.ltik, `Deep Linking launch (${label}) returned ltik`);

  const dlRes = await ltiApi<{ message?: string; target?: string }>('POST', '/api/deeplinking', {
    authorization: auth.ltik(cogniateKey, dlLaunch.ltik),
    body: {
      contentItems: [
        {
          type: 'ltiResourceLink',
          title: `QA2 E509 DL ${label}`,
          url: `${urls.lti}/lti/launch/${ACCOUNT}?resource=${encodeURIComponent(resource)}`,
        },
      ],
    },
  });
  assert.equal(dlRes.status, 200, `POST /api/deeplinking (${label}) status ${dlRes.status}`);
  const jwt = String(dlRes.json?.message ?? '');
  const target = String(dlRes.json?.target ?? '');
  assert.ok(jwt && target, `POST /api/deeplinking (${label}) returned message and target`);
  recordSecret('id_token', jwt);

  const cursor = (await records()).cursor;
  const postRes = await formPost(target, { JWT: jwt });
  assert.equal(postRes.status, 200, `simulator accepted Deep Linking response (${label})`);
  const dlRecords = (await records(cursor)).records.filter((r: Json) => r.kind === 'deep-link');
  assert.equal(dlRecords.length, 1, `simulator recorded one deep-link event (${label})`);
}

beforeAll(async () => {
  operatorKey = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(operatorKey), 'infra/.secrets/lti-operator-key has valid operator key format');
  cogniateKey = apiKey(ACCOUNT);
  assert.ok(TENANT_KEY_RE.test(cogniateKey), 'cogniate API key has valid format');

  await ensureSimulatorDeployment();

  // Ensure cogniate has no waiting `next` signing key before AC-02 creates one.
  const keysRes = await operatorApi<{ signingKeys?: SigningKeyRow[] }>(
    'GET',
    `/operator/v1/accounts/${ACCOUNT}/signing-keys`,
    { authorization: operatorAuth(operatorKey) },
  );
  assert.equal(keysRes.status, 200);
  for (const row of (keysRes.json?.signingKeys ?? []).filter((k) => k.status === 'next')) {
    await operatorApi('POST', `/operator/v1/accounts/${ACCOUNT}/signing-keys/${encodeURIComponent(row.kid)}/retire`, {
      authorization: operatorAuth(operatorKey),
      body: { immediate: true },
    });
  }
});

it('AC-LA-E5-09-01 on a stack with only LTI_MASTER_KEY, GET /operator/v1/key-provider shows kind: local-keyring, activeVersion: legacy, and one version legacy with derivedCount equal to the number of service keys', async () => {
  const before = await getKeyProviderStatus();
  assert.equal(before.kind, 'local-keyring', 'key provider kind is local-keyring');
  assert.equal(before.activeVersion, 'legacy', 'activeVersion is legacy when only LTI_MASTER_KEY is configured');
  assert.equal(before.versions.length, 1, 'exactly one key version ("legacy") is present');

  const vLegacyBefore = before.versions[0];
  assert.equal(vLegacyBefore.id, 'legacy', 'version id is legacy');
  assert.equal(vLegacyBefore.state, 'active', 'legacy version state is active');
  assert.equal(typeof vLegacyBefore.sealedCount, 'number', 'sealedCount is a number');
  assert.ok(vLegacyBefore.sealedCount >= 2, 'sealedCount includes at least the seeded tool_key rows');
  assert.equal(typeof vLegacyBefore.derivedCount, 'number', 'derivedCount is a number');
  assert.ok(vLegacyBefore.derivedCount >= 0, 'derivedCount >= 0');

  // Issue one new service key via a learner launch and verify derivedCount grows by 1 (derivedCount === number of service keys).
  preRewrapLaunch = await launchLearnerWithScopes('ac01-pre', [SCOPES.score, SCOPES.result]);

  const after = await getKeyProviderStatus();
  assert.equal(after.kind, 'local-keyring');
  assert.equal(after.activeVersion, 'legacy');
  assert.equal(after.versions.length, 1);
  const vLegacyAfter = after.versions[0];
  assert.equal(vLegacyAfter.id, 'legacy');
  assert.equal(
    vLegacyAfter.derivedCount,
    vLegacyBefore.derivedCount + 1,
    'derivedCount of legacy increased by 1 when 1 new service_key row was issued',
  );
  legacyDerivedAfterLaunch = vLegacyAfter.derivedCount;
});

it('AC-LA-E5-09-02 after QA writes infra/.secrets/lti/keyring.json = {active: "k2", keys: {legacy: <LTI_MASTER_KEY>, k2: <new>}} and restarts the LTI service, activeVersion is k2; after POST .../signing-keys, sealedCount of k2 grows by 1 (AP-06-24)', async () => {
  const act = await hostAction(
    { action: 'qa2-e509-write-keyring-and-restart' } as KeyringAction,
    180_000,
  );
  assert.equal(act.code, 0, 'host action qa2-e509-write-keyring-and-restart succeeded');
  assert.ok(act.out, 'host action returned output file');
  const hostRes = JSON.parse(fs.readFileSync(path.join(CONTROL_DIR(), act.out), 'utf8')) as KeyringActionResult;
  assert.equal(hostRes.restartExit, 0, 'stack:restart -- lti-service exited 0');
  assert.equal(hostRes.healthOk, true, 'lti-service /healthz is ok after keyring restart');

  // BD-A2-03: the e2e container must never see infra/.secrets/lti/keyring.json (covered by empty tmpfs).
  assert.equal(
    fs.existsSync(path.join(SECRETS_DIR, 'lti', 'keyring.json')),
    false,
    'e2e container cannot see infra/.secrets/lti/keyring.json (tmpfs hide rule)',
  );

  const beforeSignKey = await getKeyProviderStatus();
  assert.equal(beforeSignKey.kind, 'local-keyring');
  assert.equal(beforeSignKey.activeVersion, 'k2', 'activeVersion is k2 after restart with keyring.json');

  const k2Before = beforeSignKey.versions.find((v) => v.id === 'k2');
  const legacyBefore = beforeSignKey.versions.find((v) => v.id === 'legacy');
  assert.ok(k2Before, 'versions includes k2');
  assert.ok(legacyBefore, 'versions includes legacy');
  assert.equal(k2Before.state, 'active', 'k2 state is active');
  assert.equal(legacyBefore.state, 'decrypt-only', 'legacy state is decrypt-only');
  assert.equal(k2Before.sealedCount, 0, 'k2 sealedCount starts at 0 before any new blob is sealed');
  assert.ok(legacyBefore.sealedCount >= 2, 'legacy sealedCount still holds the existing tool_key blobs');
  assert.equal(legacyBefore.derivedCount, legacyDerivedAfterLaunch, 'legacy derivedCount is unchanged after restart');

  // Create a new next signing key on cogniate; it must be sealed with active version k2.
  const createKey = await operatorApi<SigningKeyRow>('POST', `/operator/v1/accounts/${ACCOUNT}/signing-keys`, {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(createKey.status, 201, `POST /operator/v1/accounts/cogniate/signing-keys status ${createKey.status}`);
  assert.equal(createKey.json?.status, 'next', 'created signing key has status "next"');

  const afterSignKey = await getKeyProviderStatus();
  const k2After = afterSignKey.versions.find((v) => v.id === 'k2');
  const legacyAfter = afterSignKey.versions.find((v) => v.id === 'legacy');
  assert.ok(k2After && legacyAfter);
  assert.equal(
    k2After.sealedCount,
    k2Before.sealedCount + 1,
    'sealedCount of k2 grew by 1 after POST .../signing-keys',
  );
  assert.equal(legacyAfter.sealedCount, legacyBefore.sealedCount, 'sealedCount of legacy did not change on new key create');
});

it('AC-LA-E5-09-03 POST /operator/v1/key-provider/rewrap gives 202 {job: "key-rewrap", traceId}; when the job ends, sealedCount of every version except k2 is 0, and derivedCount of legacy is unchanged (AP-06-24)', async () => {
  const beforeRewrap = await getKeyProviderStatus();
  const totalSealedBefore = beforeRewrap.versions.reduce((sum, v) => sum + v.sealedCount, 0);
  const legacyBefore = beforeRewrap.versions.find((v) => v.id === 'legacy');
  assert.ok(legacyBefore && legacyBefore.sealedCount > 0, 'legacy has sealed blobs before rewrap');

  logLinesBeforeRewrap = readLtiLogLines().length;
  const auditBefore = await listAudit(operatorKey, { action: 'key_provider.rewrap', limit: 100 });
  assert.equal(auditBefore.res.status, 200);
  auditIdsBeforeRewrap = new Set(auditBefore.events.map((e) => e.id));

  const rewrapRes = await operatorApi<{ job?: string; traceId?: string }>('POST', '/operator/v1/key-provider/rewrap', {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(rewrapRes.status, 202, `POST /operator/v1/key-provider/rewrap status ${rewrapRes.status}`);
  assert.equal(rewrapRes.json?.job, 'key-rewrap', '202 response has job: "key-rewrap"');
  assert.equal(typeof rewrapRes.json?.traceId, 'string', '202 response has string traceId');
  assert.ok((rewrapRes.json?.traceId ?? '').length > 0, '202 response has non-empty traceId');
  rewrapRequestTraceId = String(rewrapRes.json?.traceId ?? rewrapRes.traceId);

  const afterRewrap = await pollFor(
    'key-rewrap completion (every non-k2 version has sealedCount === 0)',
    async () => {
      const status = await getKeyProviderStatus();
      const nonActiveRemaining = status.versions.some((v) => v.id !== 'k2' && v.sealedCount !== 0);
      return nonActiveRemaining ? null : status;
    },
    { timeoutMs: 15_000, intervalMs: 200 },
  );

  for (const v of afterRewrap.versions) {
    if (v.id === 'k2') {
      assert.equal(v.sealedCount, totalSealedBefore, 'k2 sealedCount now holds all sealed blobs');
    } else {
      assert.equal(v.sealedCount, 0, `sealedCount of non-active version ${v.id} is 0 after re-wrap`);
    }
  }

  const legacyAfter = afterRewrap.versions.find((v) => v.id === 'legacy');
  assert.ok(legacyAfter, 'legacy version remains in status while derivedCount > 0');
  assert.equal(
    legacyAfter.derivedCount,
    legacyBefore.derivedCount,
    'derivedCount of legacy is unchanged after re-wrap',
  );
});

it('AC-LA-E5-09-04 after the re-wrap, a learner launch, a Deep Linking response, a token request and a score POST with an existing service key all pass (AP-06-24)', async () => {
  assert.ok(preRewrapLaunch, 'AC-01 recorded a pre-rewrap learner launch and serviceKey');

  // 1. Learner launch after re-wrap.
  const postLaunch = await launchLearnerWithScopes('ac04-post', [SCOPES.lineitem, SCOPES.readonly]);
  assert.ok(postLaunch.ltik && postLaunch.serviceKey, 'learner launch after re-wrap succeeded');

  // 2. Deep Linking response after re-wrap (signs with the re-wrapped active tool_key).
  await signAndReturnDeepLink('ac04-post');

  // 3. Token request after re-wrap (triggered via GET /api/lineitems with the fresh scope set).
  const tokCursor = (await records()).cursor;
  const lineitemsRes = await ltiApi('GET', '/api/lineitems', {
    authorization: auth.ltik(cogniateKey, postLaunch.ltik),
  });
  assert.equal(lineitemsRes.status, 200, `GET /api/lineitems after re-wrap status ${lineitemsRes.status}`);
  const tokRecords = (await records(tokCursor)).records.filter((r: Json) => r.kind === 'token');
  assert.equal(tokRecords.length, 1, 'simulator recorded one new token request after re-wrap');

  // 4. Score POST with an existing service key (created before the keyring rotation and re-wrap).
  const scoreCursor = (await records()).cursor;
  const scoreRes = await ltiApi(
    'POST',
    `/api/lineitems/${encodeURIComponent(preRewrapLaunch.lineItemId)}/scores`,
    {
      authorization: auth.service(cogniateKey, preRewrapLaunch.serviceKey),
      body: {
        userId: preRewrapLaunch.userId,
        scoreGiven: 9,
        scoreMaximum: 10,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
      },
    },
  );
  assert.equal(scoreRes.status, 204, `score POST with existing service key status ${scoreRes.status}`);
  const scoreHits = (await records(scoreCursor)).records.filter(
    (r: Json) => r.kind === 'score' && r.resource === preRewrapLaunch!.resource,
  );
  assert.equal(scoreHits.length, 1, 'simulator recorded the score POST for the existing service key');
  assert.equal(scoreHits[0].body?.scoreGiven, 9, 'simulator recorded scoreGiven = 9');
});

it('AC-LA-E5-09-05 the re-wrap writes one job_run {job: "key-rewrap"} line and two key_provider.rewrap audit events (request; job end with counts) (AP-06-33, contract delta §5)', async () => {
  assert.ok(rewrapRequestTraceId, 'AC-03 recorded rewrapRequestTraceId');

  const jobRunEntry = await pollFor(
    'job_run {job: "key-rewrap"} in lti-service.jsonl',
    () => {
      const runs = readLtiLogLines()
        .slice(logLinesBeforeRewrap)
        .filter((line) => (line.msg === 'job_run' || line.event === 'job_run') && line.job === 'key-rewrap');
      return runs.length >= 1 ? runs : null;
    },
    { timeoutMs: 10_000, intervalMs: 200 },
  );
  assert.equal(jobRunEntry.length, 1, 're-wrap wrote exactly one job_run {job: "key-rewrap"} log line');
  const runLine = jobRunEntry[0];
  assert.equal(runLine.job, 'key-rewrap');
  assert.equal(runLine.result, 'ok', 'job_run result is ok');
  assert.equal(typeof runLine.ms, 'number', 'job_run has numeric ms');
  assert.ok(runLine.counts && typeof runLine.counts === 'object', 'job_run has counts object');

  const newRewrapEvents = await pollFor(
    'two key_provider.rewrap audit events',
    async () => {
      const audit = await listAudit(operatorKey, { action: 'key_provider.rewrap', limit: 100 });
      assert.equal(audit.res.status, 200);
      const fresh = audit.events.filter((e) => !auditIdsBeforeRewrap.has(e.id));
      return fresh.length >= 2 ? fresh : null;
    },
    { timeoutMs: 10_000, intervalMs: 200 },
  );

  assert.equal(
    newRewrapEvents.length,
    2,
    `expected 2 key_provider.rewrap audit events (request + job end), got ${newRewrapEvents.length}`,
  );
  for (const ev of newRewrapEvents) {
    assert.equal(ev.action, 'key_provider.rewrap');
    assert.equal(ev.target.type, 'key_provider');
    assert.equal(ev.result, 'ok');
  }

  const hasJobEndShape = (details: Record<string, unknown> | null): boolean => {
    if (!details || typeof details !== 'object') return false;
    return typeof details.outcome === 'string' && typeof details.rewrapped === 'number';
  };

  const requestEvent = newRewrapEvents.find((e) => e.actor.type === 'operator' && !hasJobEndShape(e.details));
  const jobEndEvent = newRewrapEvents.find((e) => hasJobEndShape(e.details));
  assert.ok(requestEvent, 'one key_provider.rewrap audit event records the operator request');
  assert.ok(jobEndEvent, 'one key_provider.rewrap audit event records the job end with outcome and counts (BD-A2-36/42)');
  assert.notEqual(requestEvent.id, jobEndEvent.id, 'request and job-end audit events are distinct rows');

  // BD-A2-50: the 202 traceId is the traceId of both the request audit event, the job-end audit event, and the job_run log line.
  assert.equal(requestEvent.traceId, rewrapRequestTraceId, 'request audit event traceId equals 202 traceId (BD-A2-50)');
  assert.equal(jobEndEvent.traceId, rewrapRequestTraceId, 'job-end audit event traceId equals 202 traceId (BD-A2-50)');
  assert.equal(
    runLine.trace_id ?? runLine.traceId,
    rewrapRequestTraceId,
    'job_run log line trace_id equals 202 traceId (BD-A2-50)',
  );

  // Runbook §6.3 step 6: GET /operator/v1/audit?action=key_provider.rewrap&traceId=<traceId> returns both events.
  const byTrace = await listAudit(operatorKey, {
    action: 'key_provider.rewrap',
    traceId: rewrapRequestTraceId,
    limit: 10,
  });
  assert.equal(byTrace.res.status, 200, 'GET /operator/v1/audit?action=key_provider.rewrap&traceId=... returns 200');
  assert.equal(byTrace.events.length, 2, 'traceId filter returns both the request and job-end key_provider.rewrap events');

  // BD-A2-36/42/43: job-end event has result: "ok", code: null, details: { outcome: "complete", rewrapped, skippedChanged, notReached, unreadable, legacyBlobsRefused: true }.
  assert.equal(jobEndEvent.result, 'ok', 'job-end event result is ok (BD-A2-42)');
  assert.equal(jobEndEvent.code, null, 'job-end event code is null (BD-A2-42)');
  const endDetails = jobEndEvent.details as Record<string, unknown>;
  assert.equal(endDetails.outcome, 'complete', 'job-end details.outcome is "complete"');
  assert.equal(typeof endDetails.rewrapped, 'number', 'job-end details.rewrapped is a number');
  assert.ok((endDetails.rewrapped as number) >= 2, 'job-end details.rewrapped >= 2');
  assert.equal(endDetails.skippedChanged, 0, 'job-end details.skippedChanged is 0');
  assert.equal(endDetails.notReached, 0, 'job-end details.notReached is 0');
  assert.equal(endDetails.unreadable, 0, 'job-end details.unreadable is 0');
  assert.equal(
    endDetails.legacyBlobsRefused,
    true,
    'job-end details.legacyBlobsRefused is true when no legacy blob remains (BD-A2-36/43)',
  );
});
