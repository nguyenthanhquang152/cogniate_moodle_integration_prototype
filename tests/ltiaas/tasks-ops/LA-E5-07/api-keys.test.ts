// LA-E5-07 acceptance (K1-SIM): API key lifecycle (scopes, two-key cap, expiry bounds, revoke, audit, account close).
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-07). One test per K1-SIM AC; each title starts
// with its AC id. AC-06, AC-09, AC-10 and AC-13 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-07.md; contract delta §1.2, §1.3, §3, §5; LA-ADR-06 D5; BD-A2-09, BD-A2-10, BD-A2-12.
//
// Secret rule: no API key, operator key, ltik, or service key is ever put into an assertion message.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { exportJWK, generateKeyPair } from 'jose';
import { afterAll, beforeAll, it } from 'vitest';
import { publicUrls } from '../../../acceptance/lib/env';
import { httpsRequest } from '../../../acceptance/lib/https';
import {
  ACCOUNT, apiKey, auth, errorCode, hasErrorShape, ltiApi, recordSecret,
} from '../../../acceptance/lib/lti';
import {
  QA_DEPLOYMENT, QA_FIXTURE_DIR, QA_ISSUER, postLaunch, resourceLinkClaims, signRs256, type QaLogin, type QaPlatform,
} from '../../../acceptance/lib/qa-platform';
import { OPERATOR_KEY_RE, TENANT_KEY_RE, operatorApi, operatorAuth, readOperatorKey } from '../LA-E5-01/operator';
import { listAudit } from '../LA-E5-02/audit-client';

const urls = publicUrls();
const runId = crypto.randomBytes(3).toString('hex');
const freshId = (label: string) => `qa2-${label}-${runId}`;

type ApiKeyScope = 'launch' | 'admin';

interface ApiKeyMetadata {
  id: string;
  prefix: string | null;
  label: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  createdBy: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  [field: string]: unknown;
}

interface IssuedApiKeyResponse {
  id: string;
  apiKey: string;
  prefix: string;
  label: string;
  scopes: ApiKeyScope[];
  expiresAt: string | null;
  [field: string]: unknown;
}

const KEY_ID_RE = /^key_[A-Za-z0-9_-]{1,64}$/;
const AGS_LINEITEM_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem';
const AGS_READONLY_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly';

let operatorKey = '';
let cogniateKey = '';
const issuedPlaintextKeys = new Set<string>();
const createdPlatforms: { key: string; id: string }[] = [];

// Recorded across tests for AC-07 and AC-08 audit verification.
let issueTraceId = '';
let issuedKeyIdForAudit = '';
let issuedAccountForAudit = '';
let revokeTraceId = '';
let revokedKeyIdForAudit = '';
let limitRefusedTraceId = '';

const description = (res: { json: unknown }) =>
  String((res.json as { details?: { description?: unknown; field?: unknown } } | null)?.details?.description ?? '') +
  ' ' +
  String((res.json as { details?: { field?: unknown } } | null)?.details?.field ?? '');

function defaultAccountBody(id: string, name = `QA2 Account ${id}`) {
  return {
    id,
    name,
    launchUrl: `${urls.app}/tool/launch`,
    deepLinkingUrl: `${urls.app}/tool/deep-link`,
    registrationUrl: `${urls.app}/tool/register`,
  };
}

async function createFreshAccount(label: string): Promise<string> {
  const id = freshId(label);
  const res = await operatorApi<{ id?: string }>('POST', '/operator/v1/accounts', {
    authorization: operatorAuth(operatorKey),
    body: defaultAccountBody(id),
  });
  assert.equal(res.status, 201, `create fresh account ${id} status`);
  // BD-A2-09 note: if a test volume had any pre-existing active key on the fresh account, revoke it so the account
  // starts with 0 active keys.
  const existing = await listApiKeys(id);
  for (const k of existing) {
    if (k.revokedAt === null) {
      const rev = await revokeApiKey(id, k.id);
      assert.equal(rev.status, 200, `revoke pre-existing key on ${id}`);
    }
  }
  return id;
}

async function listApiKeys(accountId: string): Promise<ApiKeyMetadata[]> {
  const res = await operatorApi<{ apiKeys?: ApiKeyMetadata[] }>(
    'GET',
    `/operator/v1/accounts/${encodeURIComponent(accountId)}/api-keys`,
    { authorization: operatorAuth(operatorKey) },
  );
  assert.equal(res.status, 200, `GET /operator/v1/accounts/${accountId}/api-keys status`);
  assert.ok(Array.isArray(res.json?.apiKeys), `apiKeys is an array for ${accountId}`);
  return res.json!.apiKeys!;
}

async function issueApiKey(
  accountId: string,
  body: { label: string; scopes: ApiKeyScope[]; expiresAt?: string },
) {
  const res = await operatorApi<IssuedApiKeyResponse>(
    'POST',
    `/operator/v1/accounts/${encodeURIComponent(accountId)}/api-keys`,
    { authorization: operatorAuth(operatorKey), body },
  );
  if (res.status === 201 && typeof res.json?.apiKey === 'string') {
    recordSecret('api_key', res.json.apiKey);
    issuedPlaintextKeys.add(res.json.apiKey);
  }
  return res;
}

async function revokeApiKey(accountId: string, keyId: string) {
  return operatorApi<ApiKeyMetadata>(
    'POST',
    `/operator/v1/accounts/${encodeURIComponent(accountId)}/api-keys/${encodeURIComponent(keyId)}/revoke`,
    { authorization: operatorAuth(operatorKey) },
  );
}

/** Registers a QA platform on `accountId` using `adminKey` and returns the platform fixture. */
async function setupAccountPlatform(adminKey: string, accountId: string, label: string): Promise<QaPlatform> {
  const id = `${label}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const kid = `qa-${id}`;
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  fs.mkdirSync(QA_FIXTURE_DIR, { recursive: true });
  const jwksFile = `jwks-${id}.json`;
  fs.writeFileSync(path.join(QA_FIXTURE_DIR, jwksFile), JSON.stringify({ keys: [publicJwk] }));
  const stranger = await generateKeyPair('RS256');
  const clientId = `qa-client-${id}`;
  const jwksUrl = `${QA_ISSUER}/${jwksFile}`;
  const res = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(adminKey),
    body: {
      url: QA_ISSUER,
      name: `QA2 E5-07 ${id}`,
      clientId,
      authenticationEndpoint: `${QA_ISSUER}/auth`,
      accesstokenEndpoint: `${QA_ISSUER}/token`,
      authConfig: { method: 'JWK_SET', key: jwksUrl },
      deploymentIds: [QA_DEPLOYMENT],
    },
  });
  assert.equal(res.status, 201, `register QA platform for ${accountId} status`);
  assert.equal(typeof res.json?.id, 'string', 'platform id is a string');
  const platformId = res.json!.id!;
  createdPlatforms.push({ key: adminKey, id: platformId });
  return {
    clientId,
    platformId,
    kid,
    privateKey,
    publicJwk,
    jwksUrl,
    jwksFile,
    strangerKid: `qa-stranger-${id}`,
    strangerKey: stranger.privateKey,
  };
}

/** Runs OIDC login + resource-link launch on `accountId` with AGS scopes so `services.serviceKey` is minted. */
async function launchWithAgsOnAccount(
  p: QaPlatform,
  accountId: string,
  launchApiKey: string,
): Promise<{ ltik: string; serviceKey: string }> {
  const targetLinkUri = `${urls.lti}/lti/launch/${accountId}?resource=qa-e507`;
  const formBody = new URLSearchParams({
    iss: QA_ISSUER,
    login_hint: 'user-qa2-e507',
    target_link_uri: targetLinkUri,
    lti_message_hint: 'hint-qa2-e507',
    client_id: p.clientId,
    lti_deployment_id: QA_DEPLOYMENT,
  }).toString();
  const loginRes = await httpsRequest(`${urls.lti}/lti/login/${accountId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': String(Buffer.byteLength(formBody)),
    },
    body: formBody,
  });
  assert.equal(loginRes.status, 302, `login on ${accountId} returns 302`);
  const loc = new URL(String(loginRes.headers.location ?? ''));
  const state = loc.searchParams.get('state') ?? '';
  const nonce = loc.searchParams.get('nonce') ?? '';
  const cookie = [loginRes.headers['set-cookie'] ?? []]
    .flat()
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  assert.ok(state && nonce && cookie, `login on ${accountId} produced state, nonce and cookie`);
  recordSecret('state', state);
  recordSecret('nonce', nonce);

  const login: QaLogin = {
    status: loginRes.status,
    location: loc.href,
    state,
    nonce,
    cookie,
    targetLinkUri,
    traceId: String(loginRes.headers['x-trace-id'] ?? ''),
    body: loginRes.body,
  };

  const claims = {
    ...resourceLinkClaims(p, login),
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
      scope: [AGS_LINEITEM_SCOPE, AGS_READONLY_SCOPE],
      lineitems: `${QA_ISSUER}/lineitems`,
    },
  };
  const idTokenJwt = await signRs256(claims, p.privateKey, p.kid);
  const launchRes = await postLaunch({ id_token: idTokenJwt, state }, cookie, accountId);
  assert.equal(launchRes.status, 303, `launch on ${accountId} returns 303`);
  const ltik = launchRes.location ? new URL(launchRes.location).searchParams.get('ltik') ?? '' : '';
  assert.ok(ltik.length > 20, `launch on ${accountId} returned ltik`);
  recordSecret('ltik', ltik);

  const tokRes = await ltiApi<{ services?: { serviceKey?: string } }>('GET', '/api/idtoken', {
    authorization: auth.ltik(launchApiKey, ltik),
  });
  assert.equal(tokRes.status, 200, `GET /api/idtoken on ${accountId} status`);
  const serviceKey = String(tokRes.json?.services?.serviceKey ?? '');
  assert.ok(serviceKey.length > 10, `GET /api/idtoken on ${accountId} returned services.serviceKey`);
  recordSecret('service_key', serviceKey);
  return { ltik, serviceKey };
}

beforeAll(() => {
  operatorKey = readOperatorKey();
  cogniateKey = apiKey(ACCOUNT);
});

afterAll(async () => {
  for (const p of createdPlatforms) {
    try {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(p.id)}`, {
        authorization: auth.bearer(p.key),
      });
    } catch {
      // Best-effort cleanup.
    }
  }
});

it(
  'AC-LA-E5-07-01 after the migration, the existing cogniate key still passes LTIK-AUTH-V2, SERVICE-AUTH-V1 and Bearer calls',
  async () => {
    // 1. Check the backfilled/seeded bootstrap row on cogniate via the operator API (BD-A2-09).
    const keys = await listApiKeys(ACCOUNT);
    const bootstrapRow = keys.find((k) => k.label === 'bootstrap' && k.revokedAt === null);
    assert.ok(bootstrapRow, 'cogniate has an active bootstrap row in GET /operator/v1/accounts/cogniate/api-keys');
    assert.match(bootstrapRow.id, KEY_ID_RE, 'bootstrap key id matches key_<opaque>');
    assert.ok(
      bootstrapRow.prefix === null || (typeof bootstrapRow.prefix === 'string' && bootstrapRow.prefix.length === 8),
      'bootstrap key prefix is null (migration 011 backfill, BD-A2-09) or an 8-char prefix',
    );
    assert.deepEqual(
      [...bootstrapRow.scopes].sort(),
      ['admin', 'launch'],
      'bootstrap key has both launch and admin scopes',
    );
    assert.equal(bootstrapRow.expiresAt, null, 'bootstrap key has no expiry');

    // 2. Bearer call with cogniate key passes (200).
    const bearerRes = await ltiApi('GET', '/api/platforms', {
      authorization: auth.bearer(cogniateKey),
    });
    assert.equal(bearerRes.status, 200, 'cogniate key passes Bearer GET /api/platforms');

    // 3. LTIK-AUTH-V2 call with cogniate key passes (200).
    const platform = await setupAccountPlatform(cogniateKey, ACCOUNT, 'ac01');
    const { ltik, serviceKey } = await launchWithAgsOnAccount(platform, ACCOUNT, cogniateKey);
    const ltikRes = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(cogniateKey, ltik),
    });
    assert.equal(ltikRes.status, 200, 'cogniate key passes LTIK-AUTH-V2 GET /api/idtoken');

    // 4. SERVICE-AUTH-V1 call with cogniate key passes authentication (not 401/403; platform call to qa-platform.test
    //    without a token endpoint returns 502 PLATFORM_ERROR only after SERVICE-AUTH-V1 succeeds).
    const svcRes = await ltiApi('GET', '/api/lineitems', {
      authorization: auth.service(cogniateKey, serviceKey),
    });
    assert.notEqual(svcRes.status, 401, 'cogniate key passes SERVICE-AUTH-V1 authentication (not 401)');
    assert.notEqual(svcRes.status, 403, 'cogniate key passes SERVICE-AUTH-V1 scope check (not 403)');
  },
);

it(
  'AC-LA-E5-07-02 with two active keys, both pass; after revoke of the first, it gives 401 and the second passes',
  async () => {
    const accountId = await createFreshAccount('a2');
    issuedAccountForAudit = accountId;

    const k1 = await issueApiKey(accountId, { label: 'primary', scopes: ['launch', 'admin'] });
    assert.equal(k1.status, 201, 'issue first key returns 201');
    issueTraceId = k1.traceId;
    issuedKeyIdForAudit = String(k1.json?.id ?? '');

    const k2 = await issueApiKey(accountId, { label: 'secondary', scopes: ['launch', 'admin'] });
    assert.equal(k2.status, 201, 'issue second key returns 201');

    const key1Val = String(k1.json!.apiKey);
    const key2Val = String(k2.json!.apiKey);

    // Both active keys pass Bearer GET /api/platforms.
    const r1Before = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(key1Val) });
    const r2Before = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(key2Val) });
    assert.equal(r1Before.status, 200, 'first active key gives 200');
    assert.equal(r2Before.status, 200, 'second active key gives 200');

    // Revoke the first key.
    const rev = await revokeApiKey(accountId, k1.json!.id);
    assert.equal(rev.status, 200, 'revoke first key returns 200');
    assert.equal(typeof rev.json?.revokedAt, 'string', 'revoke response includes revokedAt');
    revokeTraceId = rev.traceId;
    revokedKeyIdForAudit = k1.json!.id;

    // First key now gives 401; second key still gives 200.
    const r1After = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(key1Val) });
    assert.equal(r1After.status, 401, 'revoked first key gives 401');
    assert.equal(hasErrorShape(r1After), true, '401 error body shape');

    const r2After = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(key2Val) });
    assert.equal(r2After.status, 200, 'second active key still gives 200 after first is revoked');
  },
);

it(
  'AC-LA-E5-07-03 a third issue with two active keys gives 409 API_KEY_LIMIT',
  async () => {
    const accountId = await createFreshAccount('a3');
    const k1 = await issueApiKey(accountId, { label: 'slot-1', scopes: ['launch', 'admin'] });
    const k2 = await issueApiKey(accountId, { label: 'slot-2', scopes: ['launch', 'admin'] });
    assert.equal(k1.status, 201, 'first key issued (201)');
    assert.equal(k2.status, 201, 'second key issued (201)');

    const k3 = await issueApiKey(accountId, { label: 'slot-3', scopes: ['launch', 'admin'] });
    assert.equal(k3.status, 409, 'third active key issue returns 409');
    assert.equal(hasErrorShape(k3), true, '409 error body shape');
    assert.equal(errorCode(k3), 'API_KEY_LIMIT', 'error code is API_KEY_LIMIT');
    limitRefusedTraceId = k3.traceId;
  },
);

it(
  'AC-LA-E5-07-04 a key with scopes ["launch"] gets 200 on GET /api/idtoken and 403 API_KEY_SCOPE_MISSING on GET /api/platforms; a key with scopes ["admin"] gets 403 API_KEY_SCOPE_MISSING on GET /api/idtoken',
  async () => {
    const accountId = await createFreshAccount('a4');
    const launchOnlyRes = await issueApiKey(accountId, { label: 'launch-only', scopes: ['launch'] });
    const adminOnlyRes = await issueApiKey(accountId, { label: 'admin-only', scopes: ['admin'] });
    assert.equal(launchOnlyRes.status, 201, 'issue launch-only key status');
    assert.equal(adminOnlyRes.status, 201, 'issue admin-only key status');

    const launchOnlyKey = String(launchOnlyRes.json!.apiKey);
    const adminOnlyKey = String(adminOnlyRes.json!.apiKey);

    // Set up a platform on accountId using the admin-only key (Bearer route -> admin scope).
    const platform = await setupAccountPlatform(adminOnlyKey, accountId, 'ac04');
    const { ltik, serviceKey } = await launchWithAgsOnAccount(platform, accountId, launchOnlyKey);

    // 1. launch-only key gets 200 on GET /api/idtoken (LTIK-AUTH-V2).
    const idTokenWithLaunch = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(launchOnlyKey, ltik),
    });
    assert.equal(idTokenWithLaunch.status, 200, 'launch-only key gets 200 on GET /api/idtoken');

    // 2. launch-only key gets 403 API_KEY_SCOPE_MISSING on GET /api/platforms (Bearer admin route).
    const platformsWithLaunch = await ltiApi('GET', '/api/platforms', {
      authorization: auth.bearer(launchOnlyKey),
    });
    assert.equal(platformsWithLaunch.status, 403, 'launch-only key gets 403 on GET /api/platforms');
    assert.equal(hasErrorShape(platformsWithLaunch), true, '403 error shape');
    assert.equal(errorCode(platformsWithLaunch), 'API_KEY_SCOPE_MISSING', 'code is API_KEY_SCOPE_MISSING');
    assert.match(description(platformsWithLaunch), /admin/i, 'description names needed scope admin');

    // 3. admin-only key gets 403 API_KEY_SCOPE_MISSING on GET /api/idtoken (LTIK-AUTH-V2 launch route).
    const idTokenWithAdmin = await ltiApi('GET', '/api/idtoken', {
      authorization: auth.ltik(adminOnlyKey, ltik),
    });
    assert.equal(idTokenWithAdmin.status, 403, 'admin-only key gets 403 on GET /api/idtoken');
    assert.equal(hasErrorShape(idTokenWithAdmin), true, '403 error shape');
    assert.equal(errorCode(idTokenWithAdmin), 'API_KEY_SCOPE_MISSING', 'code is API_KEY_SCOPE_MISSING');
    assert.match(description(idTokenWithAdmin), /launch/i, 'description names needed scope launch');

    // 4. admin-only key also gets 403 API_KEY_SCOPE_MISSING on SERVICE-AUTH-V1 (launch scope).
    const lineitemsWithAdmin = await ltiApi('GET', '/api/lineitems', {
      authorization: auth.service(adminOnlyKey, serviceKey),
    });
    assert.equal(lineitemsWithAdmin.status, 403, 'admin-only key gets 403 on SERVICE-AUTH-V1 GET /api/lineitems');
    assert.equal(errorCode(lineitemsWithAdmin), 'API_KEY_SCOPE_MISSING', 'code is API_KEY_SCOPE_MISSING');
  },
);

it(
  'AC-LA-E5-07-05 an issue with expiresAt 59 minutes ahead, or 2 years and 1 day ahead, gives 400 INVALID_REQUEST with the field expiresAt',
  async () => {
    const accountId = await createFreshAccount('a5');
    const now = Date.now();
    const min59 = new Date(now + 59 * 60 * 1000).toISOString();
    const twoYearsOneDay = new Date(now + (2 * 365 + 1) * 86_400 * 1000 + 60_000).toISOString();

    for (const [label, badExpiresAt] of [
      ['59 minutes ahead', min59],
      ['2 years + 1 day ahead', twoYearsOneDay],
    ] as const) {
      const res = await issueApiKey(accountId, {
        label: 'bad-expiry',
        scopes: ['launch', 'admin'],
        expiresAt: badExpiresAt,
      });
      assert.equal(res.status, 400, `${label}: returns 400`);
      assert.equal(hasErrorShape(res), true, `${label}: 400 error shape`);
      assert.equal(errorCode(res), 'INVALID_REQUEST', `${label}: error code is INVALID_REQUEST`);
      assert.match(description(res), /expiresAt/, `${label}: error names field expiresAt`);
    }

    // Sanity check: a valid expiry (30 days ahead) succeeds (201).
    const validExpiresAt = new Date(now + 30 * 86_400 * 1000).toISOString();
    const okRes = await issueApiKey(accountId, {
      label: 'valid-30d',
      scopes: ['launch', 'admin'],
      expiresAt: validExpiresAt,
    });
    assert.equal(okRes.status, 201, 'valid 30-day expiresAt returns 201');
    assert.equal(typeof okRes.json?.expiresAt, 'string', 'response has expiresAt string');
  },
);

it(
  'AC-LA-E5-07-07 the issue answer shows apiKey once; GET .../api-keys shows prefix, label, scopes and dates, and never the key or its hash',
  async () => {
    const accountId = await createFreshAccount('a7');
    const issued = await issueApiKey(accountId, { label: 'inspect-key', scopes: ['launch', 'admin'] });
    assert.equal(issued.status, 201, 'POST .../api-keys returns 201');
    const body = issued.json!;
    assert.match(body.id, KEY_ID_RE, 'issue response id matches key_<opaque>');
    assert.match(body.apiKey, TENANT_KEY_RE, 'issue response apiKey matches ltis_<43 base64url chars>');
    const expectedPrefix = body.apiKey.slice('ltis_'.length, 'ltis_'.length + 8);
    assert.equal(body.prefix, expectedPrefix, 'issue response prefix equals the first 8 chars after ltis_');
    assert.equal(body.label, 'inspect-key', 'issue response label');
    assert.deepEqual([...body.scopes].sort(), ['admin', 'launch'], 'issue response scopes');

    const keyHexHash = crypto.createHash('sha256').update(body.apiKey).digest('hex');
    const keyB64Hash = crypto.createHash('sha256').update(body.apiKey).digest('base64');
    const keyB64UrlHash = crypto.createHash('sha256').update(body.apiKey).digest('base64url');
    const secretTail = body.apiKey.slice('ltis_'.length + 8);

    const listRes = await operatorApi<{ apiKeys?: ApiKeyMetadata[] }>(
      'GET',
      `/operator/v1/accounts/${encodeURIComponent(accountId)}/api-keys`,
      { authorization: operatorAuth(operatorKey) },
    );
    assert.equal(listRes.status, 200, 'GET .../api-keys status');
    const row = listRes.json?.apiKeys?.find((k) => k.id === body.id);
    assert.ok(row, 'issued key appears in GET .../api-keys');
    assert.equal(row.prefix, expectedPrefix, 'GET row shows 8-char prefix');
    assert.equal(row.label, 'inspect-key', 'GET row shows label');
    assert.deepEqual([...row.scopes].sort(), ['admin', 'launch'], 'GET row shows scopes');
    assert.equal(typeof row.createdAt, 'string', 'GET row has createdAt');
    assert.equal(typeof row.createdBy, 'string', 'GET row has createdBy');
    assert.equal(row.expiresAt, null, 'GET row has expiresAt: null');
    assert.ok('lastUsedAt' in row, 'GET row has lastUsedAt property');
    assert.equal(row.revokedAt, null, 'GET row has revokedAt: null');
    assert.equal('apiKey' in row, false, 'GET row has no apiKey field');
    assert.equal('hash' in row, false, 'GET row has no hash field');
    assert.equal('api_key_hash' in row, false, 'GET row has no api_key_hash field');

    const rawList = listRes.body;
    assert.equal(TENANT_KEY_RE.test(rawList), false, 'GET .../api-keys raw body contains no ltis_ key');
    assert.equal(rawList.includes(secretTail), false, 'GET .../api-keys raw body contains no key tail');
    assert.equal(rawList.toLowerCase().includes(keyHexHash), false, 'GET .../api-keys raw body contains no SHA-256 hex hash');
    assert.equal(rawList.includes(keyB64Hash), false, 'GET .../api-keys raw body contains no SHA-256 base64 hash');
    assert.equal(rawList.includes(keyB64UrlHash), false, 'GET .../api-keys raw body contains no SHA-256 base64url hash');
  },
);

it(
  'AC-LA-E5-07-08 each issue and revoke writes one audit event (api_key.issue, api_key.revoke) with actor operator:<name> and no key value',
  async () => {
    const issueRes = await listAudit(operatorKey, { action: 'api_key.issue', limit: 200 });
    assert.equal(issueRes.res.status, 200, 'GET /operator/v1/audit?action=api_key.issue status');
    const issueEvents = issueRes.events;

    const okIssue = issueEvents.filter((e) => e.traceId === issueTraceId);
    assert.equal(okIssue.length, 1, 'exactly one api_key.issue event for the AC-02 issue traceId');
    assert.equal(okIssue[0].result, 'ok', 'api_key.issue result is ok');
    assert.equal(okIssue[0].actor.type, 'operator', 'api_key.issue actor.type is operator');
    assert.ok(okIssue[0].actor.id.length > 0, 'api_key.issue actor.id is non-empty operator name');
    assert.equal(okIssue[0].toolAccountId, issuedAccountForAudit, 'api_key.issue toolAccountId matches');
    assert.equal(okIssue[0].target.type, 'api_key', 'api_key.issue target.type is api_key');
    assert.equal(okIssue[0].target.id, issuedKeyIdForAudit, 'api_key.issue target.id matches issued key id');

    const refusedIssue = issueEvents.filter((e) => e.traceId === limitRefusedTraceId);
    assert.equal(refusedIssue.length, 1, 'exactly one api_key.issue event for the refused 3rd issue traceId');
    assert.equal(refusedIssue[0].result, 'refused', 'refused api_key.issue result is refused');
    assert.equal(refusedIssue[0].code, 'API_KEY_LIMIT', 'refused api_key.issue code is API_KEY_LIMIT');

    const revokeRes = await listAudit(operatorKey, { action: 'api_key.revoke', limit: 200 });
    assert.equal(revokeRes.res.status, 200, 'GET /operator/v1/audit?action=api_key.revoke status');
    const revokeEvents = revokeRes.events.filter((e) => e.traceId === revokeTraceId);
    assert.equal(revokeEvents.length, 1, 'exactly one api_key.revoke event for the AC-02 revoke traceId');
    assert.equal(revokeEvents[0].result, 'ok', 'api_key.revoke result is ok');
    assert.equal(revokeEvents[0].actor.type, 'operator', 'api_key.revoke actor.type is operator');
    assert.ok(revokeEvents[0].actor.id.length > 0, 'api_key.revoke actor.id is non-empty operator name');
    assert.equal(revokeEvents[0].toolAccountId, issuedAccountForAudit, 'api_key.revoke toolAccountId matches');
    assert.equal(revokeEvents[0].target.type, 'api_key', 'api_key.revoke target.type is api_key');
    assert.equal(revokeEvents[0].target.id, revokedKeyIdForAudit, 'api_key.revoke target.id matches revoked key id');

    // Secret scan: no key value or operator key appears in any api_key.issue / api_key.revoke audit response.
    const combinedRaw = `${issueRes.res.body}\n${revokeRes.res.body}`;
    assert.equal(TENANT_KEY_RE.test(combinedRaw), false, 'audit events contain no ltis_ key');
    assert.equal(OPERATOR_KEY_RE.test(combinedRaw), false, 'audit events contain no ltio_ key');
    for (const k of issuedPlaintextKeys) {
      const hexHash = crypto.createHash('sha256').update(k).digest('hex');
      assert.equal(combinedRaw.includes(k), false, 'audit events contain no issued plaintext key');
      assert.equal(combinedRaw.toLowerCase().includes(hexHash), false, 'audit events contain no issued key hash');
    }
  },
);

it(
  'AC-LA-E5-07-11 on a fresh account with two API keys, after PATCH /operator/v1/accounts/<id> {status: "closed"}, GET .../api-keys shows revokedAt on both keys',
  async () => {
    const accountId = await createFreshAccount('a11');
    const k1 = await issueApiKey(accountId, { label: 'close-1', scopes: ['launch', 'admin'] });
    const k2 = await issueApiKey(accountId, { label: 'close-2', scopes: ['launch', 'admin'] });
    assert.equal(k1.status, 201, 'first key issued on account to close');
    assert.equal(k2.status, 201, 'second key issued on account to close');

    const beforeClose = await listApiKeys(accountId);
    const activeBefore = beforeClose.filter((k) => k.id === k1.json!.id || k.id === k2.json!.id);
    assert.equal(activeBefore.length, 2, 'both issued keys exist before close');
    assert.equal(activeBefore.every((k) => k.revokedAt === null), true, 'both keys have revokedAt: null before close');

    const closeRes = await operatorApi('PATCH', `/operator/v1/accounts/${encodeURIComponent(accountId)}`, {
      authorization: operatorAuth(operatorKey),
      body: { status: 'closed' },
    });
    assert.equal(closeRes.status, 200, 'PATCH {status: "closed"} returns 200');

    const afterClose = await listApiKeys(accountId);
    const closedKeys = afterClose.filter((k) => k.id === k1.json!.id || k.id === k2.json!.id);
    assert.equal(closedKeys.length, 2, 'both keys are returned in GET .../api-keys after close');
    for (const k of closedKeys) {
      assert.equal(typeof k.revokedAt, 'string', `key ${k.id} has non-null revokedAt after account close`);
      assert.equal(Number.isFinite(Date.parse(String(k.revokedAt))), true, `key ${k.id} revokedAt is ISO timestamp`);
    }

    // BD-A2-12: on a closed account, POST .../api-keys gives 409 ACCOUNT_CLOSED, while idempotent revoke stays allowed (200) and keeps the first revokedAt.
    const firstRevokedAt = closedKeys.find((k) => k.id === k1.json!.id)!.revokedAt;
    const issueOnClosed = await issueApiKey(accountId, { label: 'closed-issue', scopes: ['launch'] });
    assert.equal(issueOnClosed.status, 409, 'POST .../api-keys on closed account returns 409');
    assert.equal(hasErrorShape(issueOnClosed), true, '409 ACCOUNT_CLOSED has standard error shape');
    assert.equal(errorCode(issueOnClosed), 'ACCOUNT_CLOSED', 'POST .../api-keys on closed account code is ACCOUNT_CLOSED');

    const revokeOnClosed = await revokeApiKey(accountId, k1.json!.id);
    assert.equal(revokeOnClosed.status, 200, 'idempotent revoke on closed account returns 200');
    assert.equal(revokeOnClosed.json?.revokedAt, firstRevokedAt, 'idempotent revoke on closed account keeps first revokedAt');

    // Both keys now fail authentication with 401.
    for (const rawKey of [k1.json!.apiKey, k2.json!.apiKey]) {
      const check = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(rawKey) });
      assert.equal(check.status, 401, 'key of closed account returns 401 on GET /api/platforms');
    }
  },
);

it(
  'AC-LA-E5-07-12 a revoked key gives the unknown-key 401 on LTIK-AUTH-V2 and SERVICE-AUTH-V1 as well as on Bearer routes',
  async () => {
    const accountId = await createFreshAccount('a12');
    const keepKeyRes = await issueApiKey(accountId, { label: 'keep-active', scopes: ['launch', 'admin'] });
    const revokeKeyRes = await issueApiKey(accountId, { label: 'to-revoke', scopes: ['launch', 'admin'] });
    assert.equal(keepKeyRes.status, 201, 'keep-active key issued');
    assert.equal(revokeKeyRes.status, 201, 'to-revoke key issued');

    const keepKey = String(keepKeyRes.json!.apiKey);
    const doomedKey = String(revokeKeyRes.json!.apiKey);

    // Mint a valid ltik and serviceKey on accountId while both keys are active.
    const platform = await setupAccountPlatform(keepKey, accountId, 'ac12');
    const { ltik, serviceKey } = await launchWithAgsOnAccount(platform, accountId, keepKey);

    // Confirm doomedKey passes before revocation.
    const preLtik = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(doomedKey, ltik) });
    assert.equal(preLtik.status, 200, 'doomedKey passes LTIK-AUTH-V2 before revoke');

    // Revoke doomedKey.
    const rev = await revokeApiKey(accountId, revokeKeyRes.json!.id);
    assert.equal(rev.status, 200, 'revoke doomedKey returns 200');

    // Compare against an unknown key across all three auth schemes (no hint).
    const unknownKey = `ltis_${crypto.randomBytes(32).toString('base64url')}`;

    const [unkBearer, revBearer] = await Promise.all([
      ltiApi('GET', '/api/platforms', { authorization: auth.bearer(unknownKey) }),
      ltiApi('GET', '/api/platforms', { authorization: auth.bearer(doomedKey) }),
    ]);
    assert.equal(revBearer.status, 401, 'revoked key gives 401 on Bearer route');
    assert.equal(errorCode(revBearer), 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER', 'Bearer 401 code');
    assert.equal(errorCode(revBearer), errorCode(unkBearer), 'revoked Bearer code matches unknown key code');

    const [unkLtik, revLtik] = await Promise.all([
      ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(unknownKey, ltik) }),
      ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(doomedKey, ltik) }),
    ]);
    assert.equal(revLtik.status, 401, 'revoked key gives 401 on LTIK-AUTH-V2 route');
    assert.equal(errorCode(revLtik), 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER', 'LTIK-AUTH-V2 401 code');
    assert.equal(errorCode(revLtik), errorCode(unkLtik), 'revoked LTIK-AUTH-V2 code matches unknown key code');

    const [unkSvc, revSvc] = await Promise.all([
      ltiApi('GET', '/api/lineitems', { authorization: auth.service(unknownKey, serviceKey) }),
      ltiApi('GET', '/api/lineitems', { authorization: auth.service(doomedKey, serviceKey) }),
    ]);
    assert.equal(revSvc.status, 401, 'revoked key gives 401 on SERVICE-AUTH-V1 route');
    assert.equal(errorCode(revSvc), 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER', 'SERVICE-AUTH-V1 401 code');
    assert.equal(errorCode(revSvc), errorCode(unkSvc), 'revoked SERVICE-AUTH-V1 code matches unknown key code');
  },
);
