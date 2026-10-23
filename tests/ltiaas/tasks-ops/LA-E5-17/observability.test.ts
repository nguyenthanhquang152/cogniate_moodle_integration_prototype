// LA-E5-17 acceptance (K1-SIM): metrics, /readyz, production /healthz, tenant id in http_request logs.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-17). One test per K1-SIM AC; each title starts
// with its AC id. AC-04 and AC-05 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-17.md; operability.md §4.2, §4.4, §5; contract delta §2.5; LA-ADR-06 D10.
//
// Secret rule: no API key, operator key, ltik, or service key is ever put into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import {
  ACCOUNT, apiKey, auth, eventsSince, ltiApi, recordSecret,
} from '../../../acceptance/lib/lti';
import {
  postLaunch, qaLogin, resourceLinkClaims, setupQaPlatform, signRs256, type QaPlatform,
} from '../../../acceptance/lib/qa-platform';
import {
  checkAcceptanceOutboundAllowlist, loadSimAllowlist,
} from '../../golden/lib/compare.mjs';
import { OPERATOR_URL, TENANT_KEY_RE } from '../LA-E5-01/operator';

const urls = publicUrls();
const enc = encodeURIComponent;
const runId = crypto.randomBytes(3).toString('hex');
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../../..');
const G1_GOLDEN_FILE = path.join(
  REPO_ROOT,
  'tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json',
);

let cogniateKey = '';
let qaPlatform: QaPlatform | null = null;

beforeAll(async () => {
  cogniateKey = apiKey(ACCOUNT);
  assert.ok(TENANT_KEY_RE.test(cogniateKey), 'cogniate API key format');
  qaPlatform = await setupQaPlatform(cogniateKey, `e517-${runId}`);
});

afterAll(async () => {
  if (qaPlatform?.platformId) {
    try {
      await ltiApi('DELETE', `/api/platforms/${enc(qaPlatform.platformId)}`, {
        authorization: auth.bearer(cogniateKey),
      });
    } catch {
      // ignore cleanup errors
    }
  }
});

it('AC-LA-E5-17-01 GET http://lti-service:4110/metrics from the e2e container (acceptance profile) gives 200 OpenMetrics text with at least lti_http_requests_total, lti_rate_limited_total, lti_launch_total and lti_ready', async () => {
  assert.ok(qaPlatform, 'precondition: qaPlatform registered');
  // Trigger one launch so launch and HTTP counters are populated.
  const login = await qaLogin(qaPlatform);
  assert.equal(login.status, 302, 'OIDC login redirect');
  const idToken = await signRs256(resourceLinkClaims(qaPlatform, login), qaPlatform.privateKey, qaPlatform.kid);
  const launch = await postLaunch({ id_token: idToken, state: login.state }, login.cookie);
  assert.equal(launch.status, 303, 'LTI launch redirect');

  const res = await httpsRequest(`${OPERATOR_URL}/metrics`);
  assert.equal(res.status, 200, 'GET http://lti-service:4110/metrics status is 200');
  const contentType = String(res.headers['content-type'] ?? '');
  assert.match(
    contentType,
    /^(text\/plain|application\/openmetrics-text)\b/i,
    `expected OpenMetrics/Prometheus text content-type, got ${contentType}`,
  );

  const requiredMetrics = [
    'lti_http_requests_total',
    'lti_rate_limited_total',
    'lti_launch_total',
    'lti_ready',
    'lti_audit_events_total',
    'lti_jwks_cache_age_seconds',
  ];
  for (const metricName of requiredMetrics) {
    assert.match(
      res.body,
      new RegExp(`(^|\\n)(# HELP |# TYPE )?${metricName}\\b`),
      `/metrics output contains ${metricName}`,
    );
  }
  assert.match(res.body, /(^|\n)lti_ready(?:\{[^}]*\})?\s+1(\.0+)?(\s|$)/, 'lti_ready gauge is 1');
  assert.match(
    res.body,
    new RegExp(`(^|\\n)lti_jwks_cache_age_seconds\\{[^}]*platform_id="${qaPlatform.platformId}"[^}]*\\}`),
    'BD-A2-54: lti_jwks_cache_age_seconds series present for active stored platform after JWKS fetch',
  );
});

it('AC-LA-E5-17-02 GET https://lti.cogniate.test/metrics through the proxy gives 404', async () => {
  const res = await httpsRequest(`${urls.lti}/metrics`);
  assert.equal(res.status, 404, 'public proxy GET /metrics returns 404');
});

it('AC-LA-E5-17-03 Public GET /readyz gives 200 {"status":"ready"} with no reasons field', async () => {
  const pubRes = await httpsRequest(`${urls.lti}/readyz`);
  assert.equal(pubRes.status, 200, 'public GET /readyz returns 200');
  const pubJson = JSON.parse(pubRes.body) as Record<string, unknown>;
  assert.deepEqual(pubJson, { status: 'ready' }, 'public GET /readyz body is exactly {"status":"ready"}');
  assert.equal(Object.hasOwn(pubJson, 'reasons'), false, 'public GET /readyz has no reasons field');

  // Also check operator listener GET /readyz returns 200 with status: "ready".
  const opRes = await httpsRequest(`${OPERATOR_URL}/readyz`);
  assert.equal(opRes.status, 200, 'operator GET http://lti-service:4110/readyz returns 200');
  const opJson = JSON.parse(opRes.body) as Record<string, unknown>;
  assert.equal(opJson.status, 'ready', 'operator GET /readyz status is ready');
});

it('AC-LA-E5-17-06 In the acceptance profile, GET /healthz is equal to the E0 golden G1 (no field change)', async () => {
  assert.equal(fs.existsSync(G1_GOLDEN_FILE), true, `G1 golden file exists at ${G1_GOLDEN_FILE}`);
  const g1 = JSON.parse(fs.readFileSync(G1_GOLDEN_FILE, 'utf8')) as {
    acceptance: {
      ltiHealth: {
        knobs: unknown[];
        outbound_allowlist: string[];
        profile: string;
        service: string;
        simulation_profiles: string[];
        status: string;
      };
    };
  };
  const expected = g1.acceptance.ltiHealth;

  const res = await httpsRequest(`${urls.lti}/healthz`);
  assert.equal(res.status, 200, 'GET /healthz returns 200');
  const actual = JSON.parse(res.body) as Record<string, unknown>;

  // Exact same top-level field set as G1.acceptance.ltiHealth (no field change).
  assert.deepEqual(
    Object.keys(actual).sort(),
    Object.keys(expected).sort(),
    'GET /healthz field set equals G1.acceptance.ltiHealth',
  );
  assert.equal(actual.status, expected.status, 'healthz.status equals G1');
  assert.equal(actual.service, expected.service, 'healthz.service equals G1');
  assert.equal(actual.profile, expected.profile, 'healthz.profile equals G1');
  assert.deepEqual(actual.knobs, expected.knobs, 'healthz.knobs equals G1');

  // outbound_allowlist equals G1 directly or satisfies the LA-IC-16 golden compare rule (tests/sim/hosts.json).
  const simHosts = loadSimAllowlist();
  const allowlistCheck = checkAcceptanceOutboundAllowlist(
    expected.outbound_allowlist,
    actual.outbound_allowlist as string[],
    simHosts,
  );
  assert.equal(
    allowlistCheck.ok,
    true,
    `healthz.outbound_allowlist matches G1 (under LA-IC-16): ${allowlistCheck.reason ?? 'ok'}`,
  );

  // simulation_profiles preserves all baseline G1 entries in order (and any LA-IC-04 channel additions).
  assert.ok(Array.isArray(actual.simulation_profiles), 'simulation_profiles is an array');
  assert.deepEqual(
    (actual.simulation_profiles as string[]).slice(0, expected.simulation_profiles.length),
    expected.simulation_profiles,
    'simulation_profiles preserves G1 baseline entries in order',
  );
});

it('AC-LA-E5-17-07 An http_request line for /lti/login/cogniate has tool_account_id: "cogniate"; no metric label and no log field holds a name, e-mail or sub', async () => {
  assert.ok(qaPlatform, 'precondition: qaPlatform registered');
  const since = Date.now() - 200;
  const subMarker = `sub-pii-${runId}`;
  const nameMarker = `Learner Name PII ${runId}`;
  const emailMarker = `learner.pii.${runId}@example.invalid`;

  const login = await qaLogin(qaPlatform);
  assert.equal(login.status, 302, 'POST /lti/login/cogniate returns 302');
  assert.ok(login.traceId.length > 0, 'POST /lti/login/cogniate returns X-Trace-Id');

  const claims = {
    ...resourceLinkClaims(qaPlatform, login),
    sub: subMarker,
    name: nameMarker,
    given_name: `GivenPII-${runId}`,
    family_name: `FamilyPII-${runId}`,
    email: emailMarker,
  };
  const token = await signRs256(claims, qaPlatform.privateKey, qaPlatform.kid);
  recordSecret('id_token', token);
  const launch = await postLaunch({ id_token: token, state: login.state }, login.cookie);
  assert.equal(launch.status, 303, 'POST /lti/launch/cogniate returns 303');

  // BD-A2-61: also send a request to an unknown path containing personal values; path must log as "<unmatched>"
  // and the personal values in the raw URL must never reach the log.
  const unmatchedRes = await httpsRequest(
    `${urls.lti}/unknown-route/${enc(subMarker)}/${enc(emailMarker)}?name=${enc(nameMarker)}`,
  );
  assert.equal(unmatchedRes.status, 404, 'unknown route returns 404');
  const unmatchedTraceId = String(unmatchedRes.headers['x-trace-id'] ?? '');

  // Wait briefly for JSONL log flush.
  await new Promise((r) => setTimeout(r, 600));

  const loginLogs = eventsSince(
    'lti-service',
    since,
    (e) =>
      e.event === 'http_request' &&
      (e.trace_id === login.traceId ||
        e.path === '/lti/login/:account' ||
        String(e.path ?? '').startsWith(`/lti/login/${ACCOUNT}`)),
  );
  assert.ok(loginLogs.length >= 1, 'found http_request log line for /lti/login/cogniate');
  const exactLoginLog = loginLogs.find((e) => e.trace_id === login.traceId) ?? loginLogs[0];
  assert.equal(
    exactLoginLog.tool_account_id,
    ACCOUNT,
    'http_request line for /lti/login/cogniate has tool_account_id: "cogniate"',
  );
  assert.equal(
    exactLoginLog.path,
    '/lti/login/:account',
    'BD-A2-61: http_request.path is the Fastify route template (/lti/login/:account), not the raw URL',
  );

  if (unmatchedTraceId) {
    const unmatchedLog = eventsSince(
      'lti-service',
      since,
      (e) => e.event === 'http_request' && e.trace_id === unmatchedTraceId,
    )[0];
    assert.ok(unmatchedLog, 'found http_request log line for unmatched 404 request');
    assert.equal(unmatchedLog.path, '<unmatched>', 'BD-A2-61: unmatched 404 http_request.path is "<unmatched>"');
  }

  // Check all recent lti-service log entries: no log field or value holds name, email, or sub.
  const recentLogs = eventsSince('lti-service', since);
  assert.ok(recentLogs.length >= 2, 'recent lti-service log lines captured');
  for (const entry of recentLogs) {
    const serialized = JSON.stringify(entry);
    assert.equal(serialized.includes(subMarker), false, 'log entry never contains learner sub value');
    assert.equal(serialized.includes(nameMarker), false, 'log entry never contains learner name value');
    assert.equal(serialized.includes(emailMarker), false, 'log entry never contains learner email value');
    assert.equal(Object.hasOwn(entry, 'email'), false, 'log entry has no email field');
    assert.equal(Object.hasOwn(entry, 'sub'), false, 'log entry has no sub field');
  }

  // Check /metrics: no metric label or value holds a name, e-mail or sub.
  const metricsRes = await httpsRequest(`${OPERATOR_URL}/metrics`);
  assert.equal(metricsRes.status, 200, 'GET /metrics returns 200');
  assert.equal(metricsRes.body.includes(subMarker), false, '/metrics never contains learner sub value');
  assert.equal(metricsRes.body.includes(nameMarker), false, '/metrics never contains learner name value');
  assert.equal(metricsRes.body.includes(emailMarker), false, '/metrics never contains learner email value');
  assert.equal(/\b(name|email|sub)\s*=/.test(metricsRes.body), false, '/metrics has no name, email, or sub label');
});
