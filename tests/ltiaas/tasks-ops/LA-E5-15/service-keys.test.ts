// LA-E5-15 acceptance (K1-SIM): service key revoke, re-issue epoch, write scope.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-15). One test per K1-SIM AC; each title starts
// with its AC id. AC-04 is an Author UNIT test.
// Source: docs/architecture/ltiaas/tasks/LA-E5-15.md; contract delta §1.3, §3, §4.8, §5; LA-ADR-06 D8; LA-ADR-07 D7; BD-A2-47.
//
// Secret rule: no API key, operator key, ltik, or service key is ever put into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterAll, beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import {
  ACCOUNT, apiKey, auth, errorCode, hasErrorShape, ltiApi, recordSecret,
} from '../../../acceptance/lib/lti';
import { OPERATOR_KEY_RE, TENANT_KEY_RE, operatorApi, operatorAuth, readOperatorKey } from '../LA-E5-01/operator';
import { listAudit } from '../LA-E5-02/audit-client';

const urls = publicUrls();
const enc = encodeURIComponent;
const runId = crypto.randomBytes(3).toString('hex');
const freshId = (label: string) => `qa2-${label}-${runId}`;

const CANVAS_PROFILE = 'canvas-sim-cloud';
const CANVAS_SITE = 'https://school-a.canvas.sim.test';
const CANVAS_SERVICE_HOST = 'school-a.canvas.sim.test';
const CANVAS_PAGE_HOST = 'canvas.school-a.sim.test';

interface IdTokenResponse {
  services?: {
    assignmentAndGrades?: {
      available?: boolean;
      lineItemId?: string;
    };
    serviceKey?: string;
  };
}

interface RevokeResponse {
  revoked: number;
}

let operatorKey = '';
let cogniateKey = '';
const createdPlatforms: { key: string; id: string }[] = [];

// Shared state across ordered AC-01..AC-03 and AC-07 audit verification.
let simPlatformId = '';
let simClientId = '';
let simDeploymentId = '';
let rlA = '';
let rlB = '';
let resA = '';
let resB = '';
let ctxMain = '';
let serviceKeyA = '';
let serviceKeyB = '';
let lineitemA = '';
let lineitemB = '';
const successfulRevokeTraceIds: string[] = [];

function defaultAccountBody(id: string, name = `QA2 Account ${id}`) {
  return {
    id,
    name,
    launchUrl: `${urls.app}/tool/launch`,
    deepLinkingUrl: `${urls.app}/tool/deep-link`,
    registrationUrl: `${urls.app}/tool/register`,
  };
}

function scoreBody(userId = 'learner-1', scoreGiven = 85, scoreMaximum = 100) {
  return {
    userId,
    scoreGiven,
    scoreMaximum,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    timestamp: new Date().toISOString(),
  };
}

async function simControl(path: string, method = 'GET', body?: unknown) {
  const res = await httpsRequest(`https://lms-sim.test/__sim${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(res.body) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { ...res, json };
}

function parseHtmlForm(body: string) {
  const decode = (s: string) =>
    s
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
  const action = body.match(/<form\b[^>]*\baction="([^"]+)"/i)?.[1];
  assert.ok(action, 'HTML form action present');
  const fields = Object.fromEntries(
    [...body.matchAll(/<input\b[^>]*\bname="([^"]+)"[^>]*\bvalue="([^"]*)"/gi)].map((m) => [m[1], decode(m[2])]),
  );
  return { action: decode(action), fields };
}

async function formPost(url: string, fields: Record<string, string>, cookie?: string) {
  const body = new URLSearchParams(fields).toString();
  return httpsRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': String(Buffer.byteLength(body)),
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
}

async function registerCanvasSimPlatform(label: string) {
  const clientId = `10000${crypto.randomInt(100_000_000, 999_999_999)}`;
  const deploymentId = `7:${label}-${runId}`;
  const res = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(cogniateKey),
    body: {
      profile: CANVAS_PROFILE,
      clientId,
      name: `QA2 E5-15 ${label} ${runId}`,
      siteUrl: CANVAS_SITE,
      deploymentIds: [deploymentId],
    },
  });
  assert.equal(res.status, 201, `register canvas-sim-cloud platform ${label} status`);
  assert.equal(typeof res.json?.id, 'string', 'platform id is a string');
  const platformId = res.json!.id!;
  createdPlatforms.push({ key: cogniateKey, id: platformId });
  return { platformId, clientId, deploymentId };
}

async function launchCanvasLearner(opts: {
  clientId: string;
  deploymentId: string;
  contextId: string;
  resourceLinkId: string;
  resource: string;
  subject?: string;
}): Promise<{ ltik: string; serviceKey: string; lineItemId: string }> {
  const scenarioId = `sc-${opts.resourceLinkId}-${crypto.randomBytes(3).toString('hex')}`;
  const scenario = {
    id: scenarioId,
    provider: CANVAS_PROFILE,
    clientId: opts.clientId,
    deploymentId: opts.deploymentId,
    siteHost: CANVAS_SERVICE_HOST,
    pageHost: CANVAS_PAGE_HOST,
    contextId: opts.contextId,
    resourceLinkId: opts.resourceLinkId,
    resource: opts.resource,
    subject: opts.subject ?? 'learner-1',
  };
  const created = await simControl('/scenarios', 'POST', scenario);
  assert.equal(created.status, 201, `create simulator scenario ${scenarioId} status`);
  const rawLogin = (created.json?.login ?? {}) as Record<string, string | null>;
  const loginFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawLogin)) {
    if (typeof v === 'string') loginFields[k] = v;
  }
  const loginRes = await formPost(`${urls.lti}/lti/login/${ACCOUNT}`, loginFields);
  assert.equal(loginRes.status, 302, 'OIDC login redirect status');
  const location = String(loginRes.headers.location ?? '');
  const cookie =
    [loginRes.headers['set-cookie'] ?? []]
      .flat()
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  const authRes = await httpsRequest(location);
  assert.equal(authRes.status, 200, 'simulator authorize response status');
  const { action, fields } = parseHtmlForm(authRes.body);
  recordSecret('id_token', fields.id_token);
  recordSecret('state', fields.state);
  const launchRes = await formPost(action, fields, cookie);
  assert.equal(launchRes.status, 303, 'LTI launch redirect status');
  const ltik = launchRes.headers.location ? new URL(String(launchRes.headers.location)).searchParams.get('ltik') ?? '' : '';
  assert.ok(ltik.length > 0, 'launch redirect carries ltik');
  recordSecret('ltik', ltik);

  const idt = await ltiApi<IdTokenResponse>('GET', '/api/idtoken', {
    authorization: auth.ltik(cogniateKey, ltik),
  });
  assert.equal(idt.status, 200, 'GET /api/idtoken status');
  const serviceKey = String(idt.json?.services?.serviceKey ?? '');
  const lineItemId = String(idt.json?.services?.assignmentAndGrades?.lineItemId ?? '');
  assert.match(serviceKey, /^[A-Za-z0-9_-]{43}$/, 'serviceKey is 43 base64url characters');
  assert.ok(lineItemId.startsWith(`https://${CANVAS_SERVICE_HOST}/`), 'lineItemId is on the simulator service host');
  recordSecret('service_key', serviceKey);
  return { ltik, serviceKey, lineItemId };
}

beforeAll(() => {
  operatorKey = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(operatorKey), 'infra/.secrets/lti-operator-key has valid operator key format');
  cogniateKey = apiKey(ACCOUNT);
  assert.ok(TENANT_KEY_RE.test(cogniateKey), 'cogniate API key has valid format');
});

afterAll(async () => {
  // Always ensure cogniate stays on default serviceKeyWriteScope: "context".
  try {
    await operatorApi('PATCH', `/operator/v1/accounts/${enc(ACCOUNT)}`, {
      authorization: operatorAuth(operatorKey),
      body: { serviceKeyWriteScope: 'context' },
    });
  } catch {
    // ignore cleanup errors if stack not running
  }
  for (const p of createdPlatforms) {
    try {
      await ltiApi('DELETE', `/api/platforms/${enc(p.id)}`, { authorization: auth.bearer(p.key) });
    } catch {
      // ignore cleanup errors
    }
  }
});

it('AC-LA-E5-15-01 POST /api/service-keys/revoke {platformId} with an admin key gives 200 { revoked: n } with n >= 1; a score POST with a revoked service key gives the same 401 as an unknown service key', async () => {
  // BD-A2-47: unknown platformId returns 404 UNREGISTERED_PLATFORM.
  const unknownPlatform = await ltiApi('POST', '/api/service-keys/revoke', {
    authorization: auth.bearer(cogniateKey),
    body: { platformId: `plt_unknown_${runId}` },
  });
  assert.equal(unknownPlatform.status, 404, 'unknown platformId returns 404');
  assert.equal(errorCode(unknownPlatform), 'UNREGISTERED_PLATFORM');
  assert.equal(hasErrorShape(unknownPlatform), true);

  const p1 = await registerCanvasSimPlatform('p1');
  const launch1 = await launchCanvasLearner({
    clientId: p1.clientId,
    deploymentId: p1.deploymentId,
    contextId: `ctx-p1-${runId}`,
    resourceLinkId: `rl-p1-${runId}`,
    resource: `res-p1-${runId}`,
  });

  // Control: score POST with the freshly minted service key succeeds (204).
  const beforeRevoke = await ltiApi('POST', `/api/lineitems/${enc(launch1.lineItemId)}/scores`, {
    authorization: auth.service(cogniateKey, launch1.serviceKey),
    body: scoreBody('learner-1', 80, 100),
  });
  assert.equal(beforeRevoke.status, 204, 'score POST before revoke returns 204');

  // Revoke all service keys of platform p1.
  const revokeRes = await ltiApi<RevokeResponse>('POST', '/api/service-keys/revoke', {
    authorization: auth.bearer(cogniateKey),
    body: { platformId: p1.platformId },
  });
  assert.equal(revokeRes.status, 200, 'POST /api/service-keys/revoke {platformId} returns 200');
  assert.equal(typeof revokeRes.json?.revoked, 'number', 'revoked count is a number');
  assert.ok(revokeRes.json!.revoked >= 1, `expected revoked >= 1, got ${revokeRes.json!.revoked}`);
  if (revokeRes.traceId) successfulRevokeTraceIds.push(revokeRes.traceId);

  // BD-A2-47: repeating the revoke when no active service key matches returns 200 { revoked: 0 }.
  const repeatRevoke = await ltiApi<RevokeResponse>('POST', '/api/service-keys/revoke', {
    authorization: auth.bearer(cogniateKey),
    body: { platformId: p1.platformId },
  });
  assert.equal(repeatRevoke.status, 200, 'repeat revoke with no matching active keys returns 200');
  assert.equal(repeatRevoke.json?.revoked, 0, 'repeat revoke returns revoked: 0');
  if (repeatRevoke.traceId) successfulRevokeTraceIds.push(repeatRevoke.traceId);

  // Score POST with the revoked service key gives the exact same 401 and errorCode as an unknown service key.
  const unknownServiceKey = `unknown_${'a'.repeat(35)}`;
  const withRevoked = await ltiApi('POST', `/api/lineitems/${enc(launch1.lineItemId)}/scores`, {
    authorization: auth.service(cogniateKey, launch1.serviceKey),
    body: scoreBody('learner-1', 85, 100),
  });
  const withUnknown = await ltiApi('POST', `/api/lineitems/${enc(launch1.lineItemId)}/scores`, {
    authorization: auth.service(cogniateKey, unknownServiceKey),
    body: scoreBody('learner-1', 85, 100),
  });
  assert.equal(withRevoked.status, 401, 'revoked service key returns 401');
  assert.equal(withUnknown.status, 401, 'unknown service key returns 401');
  assert.equal(errorCode(withRevoked), 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
  assert.equal(
    errorCode(withRevoked),
    errorCode(withUnknown),
    'revoked service key gives the same 401 errorCode as an unknown service key',
  );
  assert.equal(hasErrorShape(withRevoked), true);
});

it('AC-LA-E5-15-02 A revoke with resourceLinkId revokes only that resource link; the service key of another resource link of the same platform still gets 2xx on a score POST', async () => {
  const p2 = await registerCanvasSimPlatform('p2');
  simPlatformId = p2.platformId;
  simClientId = p2.clientId;
  simDeploymentId = p2.deploymentId;
  ctxMain = `ctx-p2-${runId}`;
  rlA = `rl-a-${runId}`;
  rlB = `rl-b-${runId}`;
  resA = `res-a-${runId}`;
  resB = `res-b-${runId}`;

  const launchA = await launchCanvasLearner({
    clientId: simClientId,
    deploymentId: simDeploymentId,
    contextId: ctxMain,
    resourceLinkId: rlA,
    resource: resA,
  });
  const launchB = await launchCanvasLearner({
    clientId: simClientId,
    deploymentId: simDeploymentId,
    contextId: ctxMain,
    resourceLinkId: rlB,
    resource: resB,
  });
  serviceKeyA = launchA.serviceKey;
  serviceKeyB = launchB.serviceKey;
  lineitemA = launchA.lineItemId;
  lineitemB = launchB.lineItemId;
  assert.notEqual(serviceKeyA, serviceKeyB, 'resource links A and B have distinct service keys');

  // Revoke only resourceLinkId: rlA on platform p2.
  const revokeA = await ltiApi<RevokeResponse>('POST', '/api/service-keys/revoke', {
    authorization: auth.bearer(cogniateKey),
    body: { platformId: simPlatformId, resourceLinkId: rlA },
  });
  assert.equal(revokeA.status, 200, 'revoke with resourceLinkId returns 200');
  assert.equal(revokeA.json?.revoked, 1, 'revoke with resourceLinkId revokes exactly 1 row');
  if (revokeA.traceId) successfulRevokeTraceIds.push(revokeA.traceId);

  // Resource link A's service key is now revoked (401).
  const postA = await ltiApi('POST', `/api/lineitems/${enc(lineitemA)}/scores`, {
    authorization: auth.service(cogniateKey, serviceKeyA),
    body: scoreBody('learner-1', 75, 100),
  });
  assert.equal(postA.status, 401, 'revoked resource link A service key returns 401');
  assert.equal(errorCode(postA), 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');

  // Resource link B's service key on the same platform still gets 2xx (204) on a score POST.
  const postB = await ltiApi('POST', `/api/lineitems/${enc(lineitemB)}/scores`, {
    authorization: auth.service(cogniateKey, serviceKeyB),
    body: scoreBody('learner-1', 88, 100),
  });
  assert.ok(postB.status >= 200 && postB.status < 300, `resource link B score POST returns 2xx (got ${postB.status})`);
  assert.equal(postB.status, 204);
});

it('AC-LA-E5-15-03 After a revoke, the next learner launch of the same resource link shows a services.serviceKey in GET /api/idtoken that differs from the revoked value, and a score POST with it gives 2xx', async () => {
  assert.ok(simPlatformId && rlA && serviceKeyA, 'precondition: AC-02 revoked rlA');

  // Next learner launch of the same resource link rlA.
  const relaunchA = await launchCanvasLearner({
    clientId: simClientId,
    deploymentId: simDeploymentId,
    contextId: ctxMain,
    resourceLinkId: rlA,
    resource: resA,
  });
  assert.notEqual(
    relaunchA.serviceKey,
    serviceKeyA,
    're-issued serviceKey after revoke differs from the revoked value (issue_epoch incremented)',
  );

  // Score POST with the newly issued serviceKey succeeds with 2xx (204).
  const postNewA = await ltiApi('POST', `/api/lineitems/${enc(lineitemA)}/scores`, {
    authorization: auth.service(cogniateKey, relaunchA.serviceKey),
    body: scoreBody('learner-1', 92, 100),
  });
  assert.ok(postNewA.status >= 200 && postNewA.status < 300, `re-issued serviceKey score POST returns 2xx (got ${postNewA.status})`);
  assert.equal(postNewA.status, 204);

  // Old revoked serviceKeyA remains 401.
  const postOldA = await ltiApi('POST', `/api/lineitems/${enc(lineitemA)}/scores`, {
    authorization: auth.service(cogniateKey, serviceKeyA),
    body: scoreBody('learner-1', 92, 100),
  });
  assert.equal(postOldA.status, 401, 'old revoked serviceKey still returns 401');
});

it('AC-LA-E5-15-05 On a fresh account (Q-LAB-04), with serviceKeyWriteScope: resource-link, a score POST with the service key of resource link A to the line item of resource link B gives 403 SERVICE_KEY_SCOPE; the same POST to A own lineitem gives 2xx', async () => {
  // 1. Verify on a fresh account (Q-LAB-04) that serviceKeyWriteScope: "resource-link" is stored and returned by the operator API.
  const freshAcc = freshId('e515-scope');
  const createRes = await operatorApi<{ id?: string; serviceKeyWriteScope?: string }>('POST', '/operator/v1/accounts', {
    authorization: operatorAuth(operatorKey),
    body: defaultAccountBody(freshAcc),
  });
  assert.equal(createRes.status, 201, `create fresh account ${freshAcc} status`);
  const patchFresh = await operatorApi<{ serviceKeyWriteScope?: string }>(
    'PATCH',
    `/operator/v1/accounts/${enc(freshAcc)}`,
    {
      authorization: operatorAuth(operatorKey),
      body: { serviceKeyWriteScope: 'resource-link' },
    },
  );
  assert.equal(patchFresh.status, 200, `PATCH ${freshAcc} serviceKeyWriteScope status`);
  assert.equal(patchFresh.json?.serviceKeyWriteScope, 'resource-link', 'fresh account serviceKeyWriteScope is resource-link');

  // 2. Because lms-sim (tests/sim/server.mjs:173 and tests/sim/core/provider.mjs:23,123) binds OIDC redirect_uri and
  // OAuth2 JWKS verification to /lti/launch/cogniate and /lti/keys/cogniate, we exercise the full simulator AGS
  // GET + score POST flow with serviceKeyWriteScope: "resource-link" on cogniate and restore "context" in finally
  // (tasks README §2 form (h) restore rule).
  const pScope = await registerCanvasSimPlatform('p-scope');
  const ctxScope = `ctx-scope-${runId}`;
  const rlScopeA = `rl-scope-a-${runId}`;
  const rlScopeB = `rl-scope-b-${runId}`;
  const resScopeA = `res-scope-a-${runId}`;
  const resScopeB = `res-scope-b-${runId}`;

  const launchScopeA = await launchCanvasLearner({
    clientId: pScope.clientId,
    deploymentId: pScope.deploymentId,
    contextId: ctxScope,
    resourceLinkId: rlScopeA,
    resource: resScopeA,
  });
  const launchScopeB = await launchCanvasLearner({
    clientId: pScope.clientId,
    deploymentId: pScope.deploymentId,
    contextId: ctxScope,
    resourceLinkId: rlScopeB,
    resource: resScopeB,
  });

  // Ensure lineitemScopeB in lms-sim carries resourceLinkId: rlScopeB when lti-service performs its guarded AGS GET.
  const putLineitemB = await ltiApi('PUT', `/api/lineitems/${enc(launchScopeB.lineItemId)}`, {
    authorization: auth.ltik(cogniateKey, launchScopeB.ltik),
    body: {
      scoreMaximum: 100,
      label: `RL B ${runId}`,
      resourceId: resScopeB,
      resourceLinkId: rlScopeB,
    },
  });
  assert.ok(putLineitemB.status === 200 || putLineitemB.status === 201, `PUT lineitemB status ${putLineitemB.status}`);

  const patchCogniate = await operatorApi<{ serviceKeyWriteScope?: string }>(
    'PATCH',
    `/operator/v1/accounts/${enc(ACCOUNT)}`,
    {
      authorization: operatorAuth(operatorKey),
      body: { serviceKeyWriteScope: 'resource-link' },
    },
  );
  assert.equal(patchCogniate.status, 200, 'set cogniate serviceKeyWriteScope to resource-link');
  assert.equal(patchCogniate.json?.serviceKeyWriteScope, 'resource-link');

  try {
    // Score POST with service key of resource link A to the line item of resource link B -> 403 SERVICE_KEY_SCOPE.
    const crossPost = await ltiApi('POST', `/api/lineitems/${enc(launchScopeB.lineItemId)}/scores`, {
      authorization: auth.service(cogniateKey, launchScopeA.serviceKey),
      body: scoreBody('learner-1', 70, 100),
    });
    assert.equal(crossPost.status, 403, 'cross-resource-link score POST with SERVICE-AUTH-V1 returns 403');
    assert.equal(errorCode(crossPost), 'SERVICE_KEY_SCOPE');
    assert.equal(hasErrorShape(crossPost), true);

    // Line item PUT and DELETE with service key A on resource link B's line item also return 403 SERVICE_KEY_SCOPE.
    const crossPut = await ltiApi('PUT', `/api/lineitems/${enc(launchScopeB.lineItemId)}`, {
      authorization: auth.service(cogniateKey, launchScopeA.serviceKey),
      body: { scoreMaximum: 100, label: 'Should fail', resourceId: resScopeB, resourceLinkId: rlScopeB },
    });
    assert.equal(crossPut.status, 403, 'cross-resource-link line item PUT returns 403');
    assert.equal(errorCode(crossPut), 'SERVICE_KEY_SCOPE');

    // Score POST with service key of resource link A to A's own lineitem -> 2xx (204).
    const ownPost = await ltiApi('POST', `/api/lineitems/${enc(launchScopeA.lineItemId)}/scores`, {
      authorization: auth.service(cogniateKey, launchScopeA.serviceKey),
      body: scoreBody('learner-1', 95, 100),
    });
    assert.ok(ownPost.status >= 200 && ownPost.status < 300, `own lineitem score POST returns 2xx (got ${ownPost.status})`);
    assert.equal(ownPost.status, 204);
  } finally {
    const restore = await operatorApi<{ serviceKeyWriteScope?: string }>(
      'PATCH',
      `/operator/v1/accounts/${enc(ACCOUNT)}`,
      {
        authorization: operatorAuth(operatorKey),
        body: { serviceKeyWriteScope: 'context' },
      },
    );
    assert.equal(restore.status, 200, 'restore cogniate serviceKeyWriteScope to context');
    assert.equal(restore.json?.serviceKeyWriteScope, 'context');
  }
});

it('AC-LA-E5-15-06 With resource-link, an LTIK-AUTH-V2 score POST to any line item of the course behaves as before (no SERVICE_KEY_SCOPE)', async () => {
  const pLtik = await registerCanvasSimPlatform('p-ltik');
  const ctxLtik = `ctx-ltik-${runId}`;
  const rlLtikA = `rl-ltik-a-${runId}`;
  const rlLtikB = `rl-ltik-b-${runId}`;
  const resLtikA = `res-ltik-a-${runId}`;
  const resLtikB = `res-ltik-b-${runId}`;

  const launchA = await launchCanvasLearner({
    clientId: pLtik.clientId,
    deploymentId: pLtik.deploymentId,
    contextId: ctxLtik,
    resourceLinkId: rlLtikA,
    resource: resLtikA,
  });
  const launchB = await launchCanvasLearner({
    clientId: pLtik.clientId,
    deploymentId: pLtik.deploymentId,
    contextId: ctxLtik,
    resourceLinkId: rlLtikB,
    resource: resLtikB,
  });

  const putB = await ltiApi('PUT', `/api/lineitems/${enc(launchB.lineItemId)}`, {
    authorization: auth.ltik(cogniateKey, launchB.ltik),
    body: {
      scoreMaximum: 100,
      label: `RL B LTIK ${runId}`,
      resourceId: resLtikB,
      resourceLinkId: rlLtikB,
    },
  });
  assert.ok(putB.status === 200 || putB.status === 201, `PUT lineitemB status ${putB.status}`);

  const patchCogniate = await operatorApi<{ serviceKeyWriteScope?: string }>(
    'PATCH',
    `/operator/v1/accounts/${enc(ACCOUNT)}`,
    {
      authorization: operatorAuth(operatorKey),
      body: { serviceKeyWriteScope: 'resource-link' },
    },
  );
  assert.equal(patchCogniate.status, 200, 'set cogniate serviceKeyWriteScope to resource-link');

  try {
    // Using LTIK-AUTH-V2 from launch A to post a score to resource link B's line item in the same course -> 204 (no SERVICE_KEY_SCOPE).
    const ltikPost = await ltiApi('POST', `/api/lineitems/${enc(launchB.lineItemId)}/scores`, {
      authorization: auth.ltik(cogniateKey, launchA.ltik),
      body: scoreBody('learner-1', 89, 100),
    });
    assert.ok(ltikPost.status >= 200 && ltikPost.status < 300, `LTIK-AUTH-V2 score POST returns 2xx (got ${ltikPost.status})`);
    assert.equal(ltikPost.status, 204);
  } finally {
    const restore = await operatorApi<{ serviceKeyWriteScope?: string }>(
      'PATCH',
      `/operator/v1/accounts/${enc(ACCOUNT)}`,
      {
        authorization: operatorAuth(operatorKey),
        body: { serviceKeyWriteScope: 'context' },
      },
    );
    assert.equal(restore.status, 200, 'restore cogniate serviceKeyWriteScope to context');
    assert.equal(restore.json?.serviceKeyWriteScope, 'context');
  }
});

it('AC-LA-E5-15-07 A key with scopes ["launch"] on POST /api/service-keys/revoke gives 403 API_KEY_SCOPE_MISSING; every successful revoke (tenant or operator route) writes one service_key.revoke audit event', async () => {
  // 1. Issue a ["launch"]-only key on a fresh account so we never touch cogniate's 2-key cap.
  const accLaunch = freshId('e515-launch');
  const createAcc = await operatorApi('POST', '/operator/v1/accounts', {
    authorization: operatorAuth(operatorKey),
    body: defaultAccountBody(accLaunch),
  });
  assert.equal(createAcc.status, 201, 'create fresh account for launch-only key');

  const existingKeys = await operatorApi<{ apiKeys?: { id: string; revokedAt: string | null }[] }>(
    'GET',
    `/operator/v1/accounts/${enc(accLaunch)}/api-keys`,
    { authorization: operatorAuth(operatorKey) },
  );
  for (const k of existingKeys.json?.apiKeys ?? []) {
    if (k.revokedAt === null) {
      await operatorApi('POST', `/operator/v1/accounts/${enc(accLaunch)}/api-keys/${enc(k.id)}/revoke`, {
        authorization: operatorAuth(operatorKey),
      });
    }
  }

  const issuedLaunch = await operatorApi<{ apiKey?: string }>(
    'POST',
    `/operator/v1/accounts/${enc(accLaunch)}/api-keys`,
    {
      authorization: operatorAuth(operatorKey),
      body: { label: 'launch-only', scopes: ['launch'] },
    },
  );
  assert.equal(issuedLaunch.status, 201, 'issue launch-only API key');
  const launchOnlyKey = String(issuedLaunch.json?.apiKey ?? '');
  recordSecret('api_key', launchOnlyKey);

  const scopeRefused = await ltiApi('POST', '/api/service-keys/revoke', {
    authorization: auth.bearer(launchOnlyKey),
    body: { platformId: simPlatformId || 'plt_any' },
  });
  assert.equal(scopeRefused.status, 403, 'launch-only key on POST /api/service-keys/revoke returns 403');
  assert.equal(errorCode(scopeRefused), 'API_KEY_SCOPE_MISSING');
  assert.equal(hasErrorShape(scopeRefused), true);

  // 2. Also exercise the operator revoke route POST /operator/v1/accounts/:id/service-keys/revoke on rlB (from AC-02).
  assert.ok(simPlatformId && rlB, 'precondition: simPlatformId and rlB exist from AC-02');
  const opRevoke = await operatorApi<RevokeResponse>(
    'POST',
    `/operator/v1/accounts/${enc(ACCOUNT)}/service-keys/revoke`,
    {
      authorization: operatorAuth(operatorKey),
      body: { platformId: simPlatformId, resourceLinkId: rlB },
    },
  );
  assert.equal(opRevoke.status, 200, 'operator POST /operator/v1/accounts/:id/service-keys/revoke returns 200');
  assert.equal(opRevoke.json?.revoked, 1, 'operator revoke revokes rlB (revoked: 1)');
  if (opRevoke.traceId) successfulRevokeTraceIds.push(opRevoke.traceId);

  // 3. Verify that every successful revoke (tenant and operator routes) wrote exactly one service_key.revoke audit event.
  assert.ok(successfulRevokeTraceIds.length >= 4, 'at least 4 successful revokes recorded across AC-01, AC-02, AC-07');
  const { events } = await listAudit(operatorKey, {
    toolAccountId: ACCOUNT,
    action: 'service_key.revoke',
    limit: 200,
  });
  for (const traceId of successfulRevokeTraceIds) {
    const matches = events.filter((e) => e.traceId === traceId);
    assert.equal(
      matches.length,
      1,
      `expected exactly 1 service_key.revoke audit event for traceId ${traceId}`,
    );
    assert.equal(matches[0].result, 'ok');
    assert.equal(matches[0].toolAccountId, ACCOUNT);
    assert.equal(matches[0].targetType, 'service_key');
  }
});
