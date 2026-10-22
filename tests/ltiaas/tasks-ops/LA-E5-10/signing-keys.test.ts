// LA-E5-10 acceptance (K1-SIM): signing-key lifecycle (`next` -> `active` -> `retired` -> `removed`) and A-T0-16.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-10). One test per K1-SIM AC; each title starts
// with its AC id. AC-05, AC-07, AC-10, AC-11, AC-12 and AC-13 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-10.md; contract delta §1.3, §2.3, §3, §5; LA-ADR-06 D7 (AP-06-27..32).
//
// Secret rule: no API key, operator key, ltik, service key or raw JWT is ever put into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import { ACCOUNT, apiKey, auth, errorCode, hasErrorShape, ltiApi, recordSecret } from '../../../acceptance/lib/lti';
import { AGS, expectStatus, formPost, idToken, launch, records, sim, type Json } from '../../../acceptance/M1/common/client';
import { OPERATOR_KEY_RE, TENANT_KEY_RE, operatorApi, operatorAuth, readOperatorKey } from '../LA-E5-01/operator';
import { listAudit } from '../LA-E5-02/audit-client';

const urls = publicUrls();
const runId = crypto.randomBytes(4).toString('hex');
const DEPLOYMENT_ID = `qa2-e510-d-${runId}`;
const SITE_HOST = 'learn-a.blackboard.sim.test';
const SITE_URL = `https://${SITE_HOST}`;

const SCOPES = {
  lineitem: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  readonly: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  score: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  result: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
} as const;

interface SigningKeyRow {
  kid: string;
  status: 'next' | 'active' | 'retired' | 'removed';
  publishedAt: string | null;
  activatedAt: string | null;
  retiredAt: string | null;
  removedAt: string | null;
  [field: string]: unknown;
}

let operatorKey = '';
let cogniateKey = '';
let kidA = '';
let kidB = '';
let createTraceId = '';
let refusedNextTraceId = '';
let refusedEarlyActivateTraceId = '';
let forceActivateTraceId = '';
let refusedRetireActiveTraceId = '';
let retireTraceId = '';

// Saved during AC-01 while key A is active, then used in AC-06 after key B is force-activated.
let preRotationLaunch: {
  serviceKey: string;
  lineItemId: string;
  userId: string;
  resource: string;
} | null = null;

function jwtHeaderKid(jwt: string): string {
  const parts = String(jwt ?? '').split('.');
  assert.equal(parts.length, 3, 'value has 3 JWT segments');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { kid?: unknown; alg?: unknown };
  assert.equal(header.alg, 'RS256', 'JWT header alg is RS256');
  assert.equal(typeof header.kid, 'string', 'JWT header has string kid');
  return String(header.kid);
}

async function readPublicJwks(account = ACCOUNT): Promise<{ keys: { kid: string; [k: string]: unknown }[]; cacheControl: string }> {
  const res = await httpsRequest(`${urls.lti}/lti/keys/${account}`);
  assert.equal(res.status, 200, `GET /lti/keys/${account} status`);
  const parsed = JSON.parse(res.body) as { keys?: { kid: string }[] };
  assert.ok(Array.isArray(parsed.keys), 'JWKS response has keys array');
  for (const k of parsed.keys) {
    assert.equal(
      Object.keys(k).some((f) => ['d', 'p', 'q', 'dp', 'dq', 'qi'].includes(f)),
      false,
      'JWKS entry contains only public fields',
    );
  }
  return {
    keys: parsed.keys,
    cacheControl: String(res.headers['cache-control'] ?? ''),
  };
}

async function listSigningKeys(account = ACCOUNT): Promise<SigningKeyRow[]> {
  const res = await operatorApi<{ signingKeys?: SigningKeyRow[] }>(
    'GET',
    `/operator/v1/accounts/${encodeURIComponent(account)}/signing-keys`,
    { authorization: operatorAuth(operatorKey) },
  );
  assert.equal(res.status, 200, `GET /operator/v1/accounts/${account}/signing-keys status`);
  assert.ok(Array.isArray(res.json?.signingKeys), 'response has signingKeys array');
  return res.json!.signingKeys!;
}

/** Ensures the `blackboard-sim` shared platform and our test deployment exist on `cogniate`. */
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

/** Reads the simulator's captured secrets (`/__sim/secrets`), returning the set of strings seen so far. */
async function simSecrets(): Promise<Set<string>> {
  const res = await sim('/secrets');
  expectStatus(res, 200);
  const values = Array.isArray(res.json?.values) ? (res.json.values as string[]) : [];
  return new Set(values);
}

/**
 * Finds the client_assertion JWT added to `/__sim/secrets` after `before` (its payload has `iss === sub === "qa-bb-app"`),
 * and returns its protected header `kid`.
 */
async function latestClientAssertionKid(before: Set<string>): Promise<string> {
  const after = await simSecrets();
  const added = [...after].filter((v) => !before.has(v) && v.split('.').length === 3);
  const assertions = added.filter((jwt) => {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')) as { iss?: unknown; sub?: unknown };
      return payload.iss === 'qa-bb-app' && payload.sub === 'qa-bb-app';
    } catch {
      return false;
    }
  });
  assert.ok(assertions.length >= 1, `simulator captured a new client_assertion JWT (added JWTs: ${added.length})`);
  const jwt = assertions.at(-1)!;
  recordSecret('id_token', jwt);
  return jwtHeaderKid(jwt);
}

/** Runs a teacher Deep Linking launch on `cogniate`, signs a Deep Linking response via `/api/deeplinking`, and posts it to the simulator. */
async function signAndReturnDeepLink(label: string): Promise<{ kid: string; target: string }> {
  const resource = `qa2-dl-${label}-${runId}`;
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
          title: `QA2 DL ${label}`,
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
  const kid = jwtHeaderKid(jwt);

  const cursor = (await records()).cursor;
  const postRes = await formPost(target, { JWT: jwt });
  assert.equal(postRes.status, 200, `simulator accepted Deep Linking response (${label}) signed with kid ${kid}`);
  const dlRecords = (await records(cursor)).records.filter((r: Json) => r.kind === 'deep-link');
  assert.equal(dlRecords.length, 1, `simulator recorded one deep-link event (${label})`);
  return { kid, target };
}

/** Launches a learner session with a specific AGS scope list so its platform token request misses the token cache. */
async function launchLearnerWithScopes(label: string, scopes: string[]) {
  const resource = `qa2-rl-${label}-${runId}`;
  const lineitems = `${SITE_URL}/learn/api/public/v1/lti/courses/course-1/lineItems`;
  const lineitem = `${lineitems}/${encodeURIComponent(resource)}`;
  const launched = await launch({
    deploymentId: DEPLOYMENT_ID,
    siteHost: SITE_HOST,
    resource,
    resourceLinkId: resource,
    contextId: `ctx-${label}-${runId}`,
    subject: `user-${label}-${runId}`,
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

beforeAll(async () => {
  operatorKey = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(operatorKey), 'infra/.secrets/lti-operator-key has valid operator key format');
  cogniateKey = apiKey(ACCOUNT);
  assert.ok(TENANT_KEY_RE.test(cogniateKey), 'cogniate API key has valid format');

  await ensureSimulatorDeployment();

  const initialJwks = await readPublicJwks(ACCOUNT);
  assert.ok(initialJwks.keys.length >= 1, 'cogniate JWKS has at least one key before rotation');
  kidA = initialJwks.keys[0].kid;

  const initialRows = await listSigningKeys(ACCOUNT);
  const activeRows = initialRows.filter((r) => r.status === 'active');
  assert.equal(activeRows.length, 1, 'cogniate has exactly one active signing key');
  assert.equal(activeRows[0].kid, kidA, 'first JWKS key equals the active signing key A');

  // If a previous interrupted run left a `next` key, retire it immediately so AC-01 starts with no `next` key.
  for (const r of initialRows.filter((k) => k.status === 'next')) {
    await operatorApi('POST', `/operator/v1/accounts/${ACCOUNT}/signing-keys/${encodeURIComponent(r.kid)}/retire`, {
      authorization: operatorAuth(operatorKey),
      body: { immediate: true },
    });
  }
});

it('AC-LA-E5-10-01 after POST /operator/v1/accounts/cogniate/signing-keys (next key B, active key A), GET /lti/keys/cogniate lists A first and B second; a Deep Linking response JWT and a client assertion still have header kid = A', async () => {
  const createRes = await operatorApi<SigningKeyRow>('POST', `/operator/v1/accounts/${ACCOUNT}/signing-keys`, {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(createRes.status, 201, `POST /operator/v1/accounts/cogniate/signing-keys status ${createRes.status}`);
  kidB = String(createRes.json?.kid ?? '');
  createTraceId = createRes.traceId;
  assert.ok(kidB && kidB !== kidA, 'new next signing key B has a distinct kid');
  assert.equal(createRes.json?.status, 'next', 'new key B has status "next"');
  assert.ok(typeof createRes.json?.publishedAt === 'string', 'new key B has publishedAt');

  const jwks = await readPublicJwks(ACCOUNT);
  assert.ok(jwks.keys.length >= 2, 'GET /lti/keys/cogniate has at least A and B');
  assert.equal(jwks.keys[0].kid, kidA, 'JWKS lists active key A first');
  assert.equal(jwks.keys[1].kid, kidB, 'JWKS lists next key B second');
  assert.match(jwks.cacheControl, /public/, 'JWKS Cache-Control includes public');
  assert.match(jwks.cacheControl, /max-age=300/, 'JWKS Cache-Control keeps max-age=300');

  // Deep Linking response JWT still uses kid = A while B is next.
  const dl = await signAndReturnDeepLink('ac01');
  assert.equal(dl.kid, kidA, 'Deep Linking response JWT has header kid = A while B is next');

  // Client assertion on a simulator token request still uses kid = A while B is next.
  const learner = await launchLearnerWithScopes('ac01', [SCOPES.readonly]);
  const secretsBefore = await simSecrets();
  const cursor = (await records()).cursor;
  const lineitemsRes = await ltiApi('GET', '/api/lineitems', {
    authorization: auth.ltik(cogniateKey, learner.ltik),
  });
  assert.equal(lineitemsRes.status, 200, `GET /api/lineitems status ${lineitemsRes.status}`);
  const tokRecords = (await records(cursor)).records.filter((r: Json) => r.kind === 'token');
  assert.equal(tokRecords.length, 1, 'simulator received one token request for AC-01');
  const assertionKid = await latestClientAssertionKid(secretsBefore);
  assert.equal(assertionKid, kidA, 'client_assertion JWT has header kid = A while B is next');

  // Prepare the AC-06 learner launch while A is still the active key (with a distinct scope set so AC-06's score POST
  // after B is activated triggers a fresh token request signed with B).
  preRotationLaunch = await launchLearnerWithScopes('ac06-pre', [SCOPES.score, SCOPES.result]);
});

it('AC-LA-E5-10-02 a second POST .../signing-keys while B is next gives 409 SIGNING_KEY_NEXT_EXISTS', async () => {
  assert.ok(kidB, 'AC-01 created next key B');
  const secondCreate = await operatorApi('POST', `/operator/v1/accounts/${ACCOUNT}/signing-keys`, {
    authorization: operatorAuth(operatorKey),
  });
  refusedNextTraceId = secondCreate.traceId;
  assert.equal(secondCreate.status, 409, 'second POST .../signing-keys status');
  assert.equal(errorCode(secondCreate), 'SIGNING_KEY_NEXT_EXISTS', 'second POST .../signing-keys code');
  assert.ok(hasErrorShape(secondCreate), '409 SIGNING_KEY_NEXT_EXISTS error shape');
});

it('AC-LA-E5-10-03 activate B before the lead time gives 409 SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH', async () => {
  assert.ok(kidB, 'AC-01 created next key B');
  const earlyActivate = await operatorApi(
    'POST',
    `/operator/v1/accounts/${ACCOUNT}/signing-keys/${encodeURIComponent(kidB)}/activate`,
    {
      authorization: operatorAuth(operatorKey),
      body: {},
    },
  );
  refusedEarlyActivateTraceId = earlyActivate.traceId;
  assert.equal(earlyActivate.status, 409, 'early activate without force status');
  assert.equal(
    errorCode(earlyActivate),
    'SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH',
    'early activate without force code',
  );
  assert.ok(hasErrorShape(earlyActivate), '409 SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH error shape');

  const jwks = await readPublicJwks(ACCOUNT);
  assert.equal(jwks.keys[0].kid, kidA, 'A stays first in JWKS after refused early activation');
  assert.equal(jwks.keys[1].kid, kidB, 'B stays second in JWKS after refused early activation');
});

it('AC-LA-E5-10-04 activate B with {force: true} makes new Deep Linking responses and client assertions use kid = B; the JWKS lists B first and A second; the audit event has details.forced: true', async () => {
  assert.ok(kidB, 'AC-01 created next key B');
  const activateRes = await operatorApi<{ kid?: string; status?: string; activatedAt?: string; retired?: string }>(
    'POST',
    `/operator/v1/accounts/${ACCOUNT}/signing-keys/${encodeURIComponent(kidB)}/activate`,
    {
      authorization: operatorAuth(operatorKey),
      body: { force: true },
    },
  );
  forceActivateTraceId = activateRes.traceId;
  assert.equal(activateRes.status, 200, `force activate B status ${activateRes.status} (${errorCode(activateRes) ?? 'ok'})`);
  assert.equal(activateRes.json?.kid, kidB, 'activate answer kid is B');
  assert.equal(activateRes.json?.status, 'active', 'activate answer status is active');
  assert.equal(activateRes.json?.retired, kidA, 'activate answer retired is A');
  assert.ok(typeof activateRes.json?.activatedAt === 'string', 'activate answer has activatedAt');

  const jwks = await readPublicJwks(ACCOUNT);
  assert.ok(jwks.keys.length >= 2, 'JWKS lists B and retired A');
  assert.equal(jwks.keys[0].kid, kidB, 'JWKS lists B first (active)');
  assert.equal(jwks.keys[1].kid, kidA, 'JWKS lists A second (retired within 30 days)');

  const dl = await signAndReturnDeepLink('ac04');
  assert.equal(dl.kid, kidB, 'new Deep Linking response JWT has header kid = B');

  const learner = await launchLearnerWithScopes('ac04', [SCOPES.lineitem, SCOPES.readonly]);
  const secretsBefore = await simSecrets();
  const cursor = (await records()).cursor;
  const createLineItem = await ltiApi('POST', '/api/lineitems', {
    authorization: auth.ltik(cogniateKey, learner.ltik),
    body: { label: `QA2 AC-04 ${runId}`, scoreMaximum: 10 },
  });
  assert.equal(createLineItem.status, 201, `POST /api/lineitems status ${createLineItem.status}`);
  const tokRecords = (await records(cursor)).records.filter((r: Json) => r.kind === 'token');
  assert.equal(tokRecords.length, 1, 'simulator received one token request for AC-04');
  const assertionKid = await latestClientAssertionKid(secretsBefore);
  assert.equal(assertionKid, kidB, 'new client_assertion JWT has header kid = B');

  const audit = await listAudit(operatorKey, { action: 'signing_key.activate', toolAccountId: ACCOUNT, limit: 50 });
  assert.equal(audit.res.status, 200, 'GET /operator/v1/audit?action=signing_key.activate');
  const hits = audit.events.filter((e) => e.traceId === forceActivateTraceId && e.result === 'ok');
  assert.equal(hits.length, 1, 'one ok signing_key.activate audit event');
  assert.equal(hits[0].target.type, 'signing_key');
  assert.equal(hits[0].target.id, kidB);
  assert.equal(hits[0].details?.forced, true, 'signing_key.activate audit event has details.forced: true');
});

it('AC-LA-E5-10-06 simulator: a learner launch with A active, then activation of B (force), then the score POST of that launchs service key succeeds; a teacher Deep Linking response signed with B is accepted', async () => {
  assert.ok(preRotationLaunch, 'learner launch was recorded while A was active');
  const { serviceKey, lineItemId, userId, resource } = preRotationLaunch;

  const secretsBefore = await simSecrets();
  const cursor = (await records()).cursor;
  const scoreRes = await ltiApi(
    'POST',
    `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
    {
      authorization: auth.service(cogniateKey, serviceKey),
      body: {
        userId,
        scoreGiven: 9,
        scoreMaximum: 10,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
      },
    },
  );
  assert.equal(scoreRes.status, 204, `score POST with pre-rotation serviceKey status ${scoreRes.status}`);

  const simRecs = (await records(cursor)).records;
  const scoreHits = simRecs.filter((r: Json) => r.kind === 'score' && r.resource === resource);
  assert.equal(scoreHits.length, 1, 'simulator recorded the score POST');
  assert.equal(scoreHits[0].body?.scoreGiven, 9, 'simulator recorded scoreGiven = 9');
  const assertionKid = await latestClientAssertionKid(secretsBefore);
  assert.equal(assertionKid, kidB, 'token request for the score POST signed its client_assertion with kid = B');

  const dl = await signAndReturnDeepLink('ac06');
  assert.equal(dl.kid, kidB, 'teacher Deep Linking response is signed with kid = B and accepted by the simulator');
});

it('AC-LA-E5-10-08 POST .../signing-keys/<active kid>/retire {immediate: true} gives 409 SIGNING_KEY_ACTIVE; on a retired key it gives 200 {status: "removed"}, and the key leaves the JWKS at once', async () => {
  assert.ok(kidA && kidB, 'kidA (retired) and kidB (active) exist');

  const retireActive = await operatorApi(
    'POST',
    `/operator/v1/accounts/${ACCOUNT}/signing-keys/${encodeURIComponent(kidB)}/retire`,
    {
      authorization: operatorAuth(operatorKey),
      body: { immediate: true },
    },
  );
  refusedRetireActiveTraceId = retireActive.traceId;
  assert.equal(retireActive.status, 409, 'retire of active key B status');
  assert.equal(errorCode(retireActive), 'SIGNING_KEY_ACTIVE', 'retire of active key B code');
  assert.ok(hasErrorShape(retireActive), '409 SIGNING_KEY_ACTIVE error shape');

  const retireRetired = await operatorApi<{ kid?: string; status?: string }>(
    'POST',
    `/operator/v1/accounts/${ACCOUNT}/signing-keys/${encodeURIComponent(kidA)}/retire`,
    {
      authorization: operatorAuth(operatorKey),
      body: { immediate: true },
    },
  );
  retireTraceId = retireRetired.traceId;
  assert.equal(retireRetired.status, 200, `retire of retired key A status ${retireRetired.status}`);
  assert.equal(retireRetired.json?.kid, kidA, 'retire answer kid is A');
  assert.equal(retireRetired.json?.status, 'removed', 'retire answer status is removed');

  const jwks = await readPublicJwks(ACCOUNT);
  assert.equal(jwks.keys.some((k) => k.kid === kidA), false, 'removed key A left GET /lti/keys/cogniate at once');
  assert.equal(jwks.keys[0]?.kid, kidB, 'active key B remains first in GET /lti/keys/cogniate');

  const rows = await listSigningKeys(ACCOUNT);
  const rowA = rows.find((r) => r.kid === kidA);
  assert.ok(rowA, 'GET /operator/v1/accounts/cogniate/signing-keys still lists row A for audit');
  assert.equal(rowA.status, 'removed', 'row A has status "removed"');
  assert.ok(typeof rowA.removedAt === 'string', 'row A has removedAt');
});

it('AC-LA-E5-10-09 each create, activate and retire writes one audit event (signing_key.create, signing_key.activate, signing_key.retire)', async () => {
  const expectedOk: Array<[string, string, string]> = [
    [createTraceId, 'signing_key.create', kidB],
    [forceActivateTraceId, 'signing_key.activate', kidB],
    [retireTraceId, 'signing_key.retire', kidA],
  ];

  for (const [traceId, action, targetKid] of expectedOk) {
    assert.ok(traceId, `${action}: recorded traceId`);
    const audit = await listAudit(operatorKey, { action, toolAccountId: ACCOUNT, limit: 100 });
    assert.equal(audit.res.status, 200, `GET /operator/v1/audit?action=${action} status`);
    const hits = audit.events.filter((e) => e.traceId === traceId);
    assert.equal(hits.length, 1, `exactly one ${action} event for trace ${traceId}`);
    const ev = hits[0];
    assert.equal(ev.action, action);
    assert.equal(ev.toolAccountId, ACCOUNT);
    assert.equal(ev.target.type, 'signing_key');
    assert.equal(ev.target.id, targetKid);
    assert.equal(ev.result, 'ok');
    assert.equal(ev.code, null);
  }

  // Also verify that each refused signing-key call in AC-02, AC-03 and AC-08 wrote one refused audit event.
  const expectedRefused: Array<[string, string, string]> = [
    [refusedNextTraceId, 'signing_key.create', 'SIGNING_KEY_NEXT_EXISTS'],
    [refusedEarlyActivateTraceId, 'signing_key.activate', 'SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH'],
    [refusedRetireActiveTraceId, 'signing_key.retire', 'SIGNING_KEY_ACTIVE'],
  ];

  for (const [traceId, action, code] of expectedRefused) {
    const audit = await listAudit(operatorKey, { action, toolAccountId: ACCOUNT, limit: 100 });
    assert.equal(audit.res.status, 200);
    const hits = audit.events.filter((e) => e.traceId === traceId);
    assert.equal(hits.length, 1, `exactly one refused ${action} event for trace ${traceId}`);
    assert.equal(hits[0].result, 'refused');
    assert.equal(hits[0].code, code);
  }
});
