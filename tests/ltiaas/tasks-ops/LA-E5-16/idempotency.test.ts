// LA-E5-16 acceptance (K1-SIM): Idempotency-Key on POST /api/lineitems, POST /api/platforms, POST /api/platforms/:id/deployments.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-16). One test per K1-SIM AC; each title starts
// with its AC id. AC-04 and AC-06 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-16.md; contract delta §1.3, §4.9, §7; LA-ADR-06 D9.
//
// Secret rule: no API key, operator key, ltik, or service key is ever put into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterAll, beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import {
  ACCOUNT, SECOND_ACCOUNT, type ApiResult, apiKey, auth, errorCode, hasErrorShape, ltiApi, recordSecret,
} from '../../../acceptance/lib/lti';
import { QA_DEPLOYMENT, QA_ISSUER } from '../../../acceptance/lib/qa-platform';
import { TENANT_KEY_RE } from '../LA-E5-01/operator';

const urls = publicUrls();
const enc = encodeURIComponent;
const runId = crypto.randomBytes(3).toString('hex');

async function ltiIdemApi<T = unknown>(
  method: string,
  pathAndQuery: string,
  {
    authorization,
    idempotencyKey,
    body,
  }: { authorization?: string; idempotencyKey?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (authorization !== undefined) headers.authorization = authorization;
  if (idempotencyKey !== undefined) headers['idempotency-key'] = idempotencyKey;
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(Buffer.byteLength(payload));
  }
  const res = await httpsRequest(`${urls.lti}${pathAndQuery}`, { method, headers, body: payload });
  let json: unknown = null;
  try {
    json = res.body ? JSON.parse(res.body) : null;
  } catch {
    json = null;
  }
  return { ...res, json: json as T, traceId: String(res.headers['x-trace-id'] ?? '') };
}

const CANVAS_PROFILE = 'canvas-sim-cloud';
const CANVAS_SITE = 'https://school-a.canvas.sim.test';
const CANVAS_SERVICE_HOST = 'school-a.canvas.sim.test';
const CANVAS_PAGE_HOST = 'canvas.school-a.sim.test';

interface SimRecord {
  kind: string;
  host?: string;
  method?: string;
  path?: string;
  resource?: string;
  body?: Record<string, unknown>;
  [field: string]: unknown;
}

let cogniateKey = '';
let secondKey = '';
let simLtik = '';
let lineitemsIdemKey = '';
let sharedTenantIdemKey = '';
let cogniateIdemPlatformId = '';
let standardPlatformBody: Record<string, unknown> = {};
const createdPlatforms: { key: string; id: string }[] = [];

const description = (res: { json: unknown }) =>
  String((res.json as { details?: { description?: unknown; field?: unknown } } | null)?.details?.description ?? '') +
  ' ' +
  String((res.json as { details?: { field?: unknown } } | null)?.details?.field ?? '');

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

async function simRecords(since = 0): Promise<{ cursor: number; records: SimRecord[] }> {
  const res = await simControl(`/records?since=${since}`);
  assert.equal(res.status, 200, 'GET /__sim/records status');
  return res.json as unknown as { cursor: number; records: SimRecord[] };
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

async function setupCanvasLaunchForLineitems(): Promise<string> {
  const clientId = `10000${crypto.randomInt(100_000_000, 999_999_999)}`;
  const deploymentId = `7:e516-${runId}`;
  const reg = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(cogniateKey),
    body: {
      profile: CANVAS_PROFILE,
      clientId,
      name: `QA2 E5-16 Canvas ${runId}`,
      siteUrl: CANVAS_SITE,
      deploymentIds: [deploymentId],
    },
  });
  assert.equal(reg.status, 201, 'register canvas-sim-cloud platform for lineitems status');
  const platformId = String(reg.json?.id ?? '');
  createdPlatforms.push({ key: cogniateKey, id: platformId });

  const scenarioId = `sc-e516-${runId}`;
  const created = await simControl('/scenarios', 'POST', {
    id: scenarioId,
    provider: CANVAS_PROFILE,
    clientId,
    deploymentId,
    siteHost: CANVAS_SERVICE_HOST,
    pageHost: CANVAS_PAGE_HOST,
    contextId: `ctx-e516-${runId}`,
    resourceLinkId: `rl-e516-${runId}`,
    resource: `res-e516-${runId}`,
    subject: 'learner-1',
  });
  assert.equal(created.status, 201, 'create simulator scenario for lineitems');
  const rawLogin = (created.json?.login ?? {}) as Record<string, string | null>;
  const loginFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawLogin)) {
    if (typeof v === 'string') loginFields[k] = v;
  }
  const loginRes = await formPost(`${urls.lti}/lti/login/${ACCOUNT}`, loginFields);
  assert.equal(loginRes.status, 302, 'OIDC login redirect');
  const location = String(loginRes.headers.location ?? '');
  const cookie =
    [loginRes.headers['set-cookie'] ?? []]
      .flat()
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  const authRes = await httpsRequest(location);
  assert.equal(authRes.status, 200, 'simulator authorize status');
  const { action, fields } = parseHtmlForm(authRes.body);
  recordSecret('id_token', fields.id_token);
  recordSecret('state', fields.state);
  const launchRes = await formPost(action, fields, cookie);
  assert.equal(launchRes.status, 303, 'LTI launch redirect status');
  const ltik = launchRes.headers.location ? new URL(String(launchRes.headers.location)).searchParams.get('ltik') ?? '' : '';
  assert.ok(ltik.length > 0, 'ltik present');
  recordSecret('ltik', ltik);
  return ltik;
}

beforeAll(async () => {
  cogniateKey = apiKey(ACCOUNT);
  secondKey = apiKey(SECOND_ACCOUNT);
  assert.ok(TENANT_KEY_RE.test(cogniateKey), 'cogniate API key format');
  assert.ok(TENANT_KEY_RE.test(secondKey), 'qa-second API key format');
  simLtik = await setupCanvasLaunchForLineitems();
});

afterAll(async () => {
  for (const p of createdPlatforms) {
    try {
      await ltiApi('DELETE', `/api/platforms/${enc(p.id)}`, { authorization: auth.bearer(p.key) });
    } catch {
      // ignore cleanup errors
    }
  }
});

it('AC-LA-E5-16-01 Two POST /api/lineitems calls with the same Idempotency-Key and body give the same status and body, and the simulator records one line item create', async () => {
  // Invalid Idempotency-Key grammar (outside [A-Za-z0-9_-]{1,64}) returns 400 INVALID_REQUEST naming the header.
  for (const badKey of ['bad key with spaces', 'a'.repeat(65)]) {
    const badRes = await ltiIdemApi('POST', '/api/lineitems', {
      authorization: auth.ltik(cogniateKey, simLtik),
      idempotencyKey: badKey,
      body: { scoreMaximum: 100, label: `Bad key ${runId}`, resourceId: `res-bad-${runId}` },
    });
    assert.equal(badRes.status, 400, `invalid Idempotency-Key (${badKey.length} chars) returns 400`);
    assert.equal(errorCode(badRes), 'INVALID_REQUEST');
    assert.equal(hasErrorShape(badRes), true);
    assert.match(description(badRes), /Idempotency-Key|idempotency/i, '400 INVALID_REQUEST names Idempotency-Key');
  }

  lineitemsIdemKey = `idem_lineitem_${runId}`;
  const body = {
    scoreMaximum: 100,
    label: `QA2 Idem Lineitem ${runId}`,
    resourceId: `res-idem-1-${runId}`,
    tag: 'grade',
  };

  const beforeCursor = (await simRecords()).cursor;
  const first = await ltiIdemApi<{ id?: string; label?: string; scoreMaximum?: number }>('POST', '/api/lineitems', {
    authorization: auth.ltik(cogniateKey, simLtik),
    idempotencyKey: lineitemsIdemKey,
    body,
  });
  assert.equal(first.status, 201, 'first POST /api/lineitems status is 201');
  assert.equal(typeof first.json?.id, 'string', 'first POST /api/lineitems returns id');

  const second = await ltiIdemApi<{ id?: string; label?: string; scoreMaximum?: number }>('POST', '/api/lineitems', {
    authorization: auth.ltik(cogniateKey, simLtik),
    idempotencyKey: lineitemsIdemKey,
    body,
  });
  assert.equal(second.status, first.status, 'second POST /api/lineitems returns the same status (201)');
  assert.deepEqual(second.json, first.json, 'second POST /api/lineitems returns the exact same body');

  const afterRecords = (await simRecords(beforeCursor)).records.filter(
    (r) => r.kind === 'ags' && r.method === 'POST' && r.body?.resourceId === body.resourceId,
  );
  assert.equal(afterRecords.length, 1, 'simulator records exactly one line item create for the two identical calls');
});

it('AC-LA-E5-16-02 The same key with another body gives 422 IDEMPOTENCY_KEY_REUSED, and the simulator records no second call', async () => {
  assert.ok(lineitemsIdemKey, 'precondition: AC-01 set lineitemsIdemKey');
  const beforeCursor = (await simRecords()).cursor;

  const reused = await ltiIdemApi('POST', '/api/lineitems', {
    authorization: auth.ltik(cogniateKey, simLtik),
    idempotencyKey: lineitemsIdemKey,
    body: {
      scoreMaximum: 50,
      label: `QA2 Different Body ${runId}`,
      resourceId: `res-idem-diff-${runId}`,
      tag: 'grade',
    },
  });
  assert.equal(reused.status, 422, 'reused Idempotency-Key with different body returns 422');
  assert.equal(errorCode(reused), 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(hasErrorShape(reused), true);

  const agsCalls = (await simRecords(beforeCursor)).records.filter((r) => r.kind === 'ags');
  assert.equal(agsCalls.length, 0, 'simulator records no second AGS call on 422 IDEMPOTENCY_KEY_REUSED');
});

it('AC-LA-E5-16-03 Two POST /api/platforms calls with the same key and body give the same platform id, and GET /api/platforms lists one platform', async () => {
  sharedTenantIdemKey = `idem_platform_${runId}`;
  const clientId = `qa-idem-plt-${runId}`;
  standardPlatformBody = {
    url: QA_ISSUER,
    name: `QA2 Idem Platform ${runId}`,
    clientId,
    authenticationEndpoint: `${QA_ISSUER}/auth`,
    accesstokenEndpoint: `${QA_ISSUER}/token`,
    authConfig: { method: 'JWK_SET', key: `${QA_ISSUER}/.well-known/jwks.json` },
    deploymentIds: [QA_DEPLOYMENT],
  };

  const first = await ltiIdemApi<{ id?: string; clientId?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(cogniateKey),
    idempotencyKey: sharedTenantIdemKey,
    body: standardPlatformBody,
  });
  assert.equal(first.status, 201, 'first POST /api/platforms status is 201');
  assert.equal(typeof first.json?.id, 'string', 'first POST /api/platforms returns platform id');
  cogniateIdemPlatformId = first.json!.id!;
  createdPlatforms.push({ key: cogniateKey, id: cogniateIdemPlatformId });

  const second = await ltiIdemApi<{ id?: string; clientId?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(cogniateKey),
    idempotencyKey: sharedTenantIdemKey,
    body: standardPlatformBody,
  });
  assert.equal(second.status, 201, 'second POST /api/platforms with same Idempotency-Key and body returns 201');
  assert.equal(second.json?.id, cogniateIdemPlatformId, 'both calls return the exact same platform id');
  assert.deepEqual(second.json, first.json, 'both calls return the same platform body');

  const list = await ltiApi<{ platforms?: { id: string; clientId: string }[] }>(
    'GET',
    `/api/platforms?url=${enc(QA_ISSUER)}&clientId=${enc(clientId)}`,
    { authorization: auth.bearer(cogniateKey) },
  );
  assert.equal(list.status, 200, 'GET /api/platforms status');
  const matching = (list.json?.platforms ?? []).filter((p) => p.clientId === clientId);
  assert.equal(matching.length, 1, 'GET /api/platforms lists exactly one platform for that issuer/clientId');
  assert.equal(matching[0].id, cogniateIdemPlatformId);

  // Also verify POST /api/platforms/:id/deployments with Idempotency-Key (contract delta §4.9).
  const depIdemKey = `idem_dep_${runId}`;
  const depBody = { deploymentId: `dep-idem-${runId}` };
  const dep1 = await ltiIdemApi('POST', `/api/platforms/${enc(cogniateIdemPlatformId)}/deployments`, {
    authorization: auth.bearer(cogniateKey),
    idempotencyKey: depIdemKey,
    body: depBody,
  });
  assert.equal(dep1.status, 201, 'first POST /api/platforms/:id/deployments status is 201');
  const dep2 = await ltiIdemApi('POST', `/api/platforms/${enc(cogniateIdemPlatformId)}/deployments`, {
    authorization: auth.bearer(cogniateKey),
    idempotencyKey: depIdemKey,
    body: depBody,
  });
  assert.equal(dep2.status, 201, 'second POST /api/platforms/:id/deployments with same Idempotency-Key returns 201');
  assert.deepEqual(dep2.json, dep1.json, 'second deployment call returns the stored response');

  const depReused = await ltiIdemApi('POST', `/api/platforms/${enc(cogniateIdemPlatformId)}/deployments`, {
    authorization: auth.bearer(cogniateKey),
    idempotencyKey: depIdemKey,
    body: { deploymentId: `dep-other-${runId}` },
  });
  assert.equal(depReused.status, 422, 'reused Idempotency-Key on deployments with another body returns 422');
  assert.equal(errorCode(depReused), 'IDEMPOTENCY_KEY_REUSED');
});

it('AC-LA-E5-16-05 The same key used by account qa-second does not see the record of account cogniate (its call runs and creates its own object)', async () => {
  assert.ok(sharedTenantIdemKey && cogniateIdemPlatformId, 'precondition: AC-03 created cogniate platform with sharedTenantIdemKey');

  // Use the exact same Idempotency-Key (and even a different or same body) under qa-second:
  // if qa-second saw cogniate's record, a different body would return 422 IDEMPOTENCY_KEY_REUSED and the same body would
  // return cogniate's platform id without creating a platform on qa-second.
  const secondClientId = `qa-idem-second-${runId}`;
  const secondRes = await ltiIdemApi<{ id?: string; clientId?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(secondKey),
    idempotencyKey: sharedTenantIdemKey,
    body: {
      ...standardPlatformBody,
      name: `QA2 Second Account Platform ${runId}`,
      clientId: secondClientId,
    },
  });
  assert.equal(secondRes.status, 201, 'qa-second POST /api/platforms with the same Idempotency-Key runs and returns 201');
  const secondPlatformId = String(secondRes.json?.id ?? '');
  assert.ok(secondPlatformId.length > 0, 'qa-second platform id is present');
  assert.notEqual(secondPlatformId, cogniateIdemPlatformId, 'qa-second creates its own distinct platform object');
  createdPlatforms.push({ key: secondKey, id: secondPlatformId });

  const listSecond = await ltiApi<{ platforms?: { id: string; clientId: string }[] }>(
    'GET',
    `/api/platforms?url=${enc(QA_ISSUER)}&clientId=${enc(secondClientId)}`,
    { authorization: auth.bearer(secondKey) },
  );
  assert.equal(listSecond.status, 200, 'GET /api/platforms on qa-second status');
  const found = (listSecond.json?.platforms ?? []).filter((p) => p.id === secondPlatformId);
  assert.equal(found.length, 1, 'qa-second owns the newly created platform');
});

it('AC-LA-E5-16-07 A request without the header behaves as before (M1 and T3c create calls unchanged)', async () => {
  // 1. Without Idempotency-Key, two POST /api/lineitems calls both execute and the simulator records two creates.
  const beforeCursor = (await simRecords()).cursor;
  const liBody1 = {
    scoreMaximum: 100,
    label: `QA2 No Header 1 ${runId}`,
    resourceId: `res-nohdr-1-${runId}`,
  };
  const liBody2 = {
    scoreMaximum: 100,
    label: `QA2 No Header 2 ${runId}`,
    resourceId: `res-nohdr-2-${runId}`,
  };
  const li1 = await ltiApi<{ id?: string }>('POST', '/api/lineitems', {
    authorization: auth.ltik(cogniateKey, simLtik),
    body: liBody1,
  });
  const li2 = await ltiApi<{ id?: string }>('POST', '/api/lineitems', {
    authorization: auth.ltik(cogniateKey, simLtik),
    body: liBody2,
  });
  assert.equal(li1.status, 201, 'first POST /api/lineitems without header returns 201');
  assert.equal(li2.status, 201, 'second POST /api/lineitems without header returns 201');
  const agsCreates = (await simRecords(beforeCursor)).records.filter((r) => r.kind === 'ags' && r.method === 'POST');
  assert.equal(agsCreates.length, 2, 'simulator records two line item creates when Idempotency-Key is omitted');

  // 2. Without Idempotency-Key, a duplicate POST /api/platforms with the same (url, clientId) returns 409 PLATFORM_ALREADY_EXISTS.
  const dupClientId = `qa-nohdr-plt-${runId}`;
  const pltBody = {
    url: QA_ISSUER,
    name: `QA2 No Header Platform ${runId}`,
    clientId: dupClientId,
    authenticationEndpoint: `${QA_ISSUER}/auth`,
    accesstokenEndpoint: `${QA_ISSUER}/token`,
    authConfig: { method: 'JWK_SET', key: `${QA_ISSUER}/.well-known/jwks.json` },
    deploymentIds: [QA_DEPLOYMENT],
  };
  const plt1 = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(cogniateKey),
    body: pltBody,
  });
  assert.equal(plt1.status, 201, 'first POST /api/platforms without header returns 201');
  if (plt1.json?.id) createdPlatforms.push({ key: cogniateKey, id: plt1.json.id });

  const plt2 = await ltiApi('POST', '/api/platforms', {
    authorization: auth.bearer(cogniateKey),
    body: pltBody,
  });
  assert.equal(plt2.status, 409, 'duplicate POST /api/platforms without Idempotency-Key returns 409');
  assert.equal(errorCode(plt2), 'PLATFORM_ALREADY_EXISTS');
  assert.equal(hasErrorShape(plt2), true);
});
