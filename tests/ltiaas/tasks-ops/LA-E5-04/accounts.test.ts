// LA-E5-04 acceptance (K1-SIM): tenant model — account status, tool URLs, claimPolicy, shared platforms, account resolver.
// Runs in the e2e container on the acceptance profile (QA_TASK=LA-E5-04). One test per K1-SIM AC; each title starts
// with its AC id. AC-10, AC-11 and AC-12 are Author UNIT tests.
// Source: docs/architecture/ltiaas/tasks/LA-E5-04.md; contract delta §1.1, §1.3, §1.5, §3, §5; LA-ADR-06 D2.
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
  ACCOUNT, SECOND_ACCOUNT, apiKey, auth, errorCode, hasErrorShape, ltiApi, recordSecret,
} from '../../../acceptance/lib/lti';
import {
  QA_DEPLOYMENT, QA_FIXTURE_DIR, QA_ISSUER, postLaunch, resourceLinkClaims, signRs256, type QaLogin, type QaPlatform,
} from '../../../acceptance/lib/qa-platform';
import { OPERATOR_KEY_RE, TENANT_KEY_RE, operatorApi, operatorAuth, readOperatorKey } from '../LA-E5-01/operator';
import { listAudit } from '../LA-E5-02/audit-client';
import { ltiBootstrap } from './host-bootstrap';

const urls = publicUrls();
const runId = crypto.randomBytes(3).toString('hex');
const freshId = (label: string) => `qa2-${label}-${runId}`;

interface ProtocolUrls {
  login: string;
  launch: string;
  keys: string;
  register: string;
}

interface AccountRow {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'closed';
  launchUrl: string;
  deepLinkingUrl: string;
  registrationUrl: string;
  publicBaseUrl?: string | null;
  limits?: Record<string, unknown> | null;
  claimPolicy?: Record<string, unknown> | null;
  serviceKeyWriteScope?: string;
  createdAt: string;
  statusChangedAt: string;
  protocolUrls: ProtocolUrls;
  [field: string]: unknown;
}

let operatorKey = '';
let cogniateKey = '';
let secondKey = '';
let accA = '';
let accB = '';
const createdPlatforms: { key: string; id: string }[] = [];

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

function checkProtocolUrls(accountId: string, actual: ProtocolUrls | undefined, label: string) {
  assert.ok(actual && typeof actual === 'object', `${label}: protocolUrls is present`);
  assert.deepEqual(
    actual,
    {
      login: `${urls.lti}/lti/login/${accountId}`,
      launch: `${urls.lti}/lti/launch/${accountId}`,
      keys: `${urls.lti}/lti/keys/${accountId}`,
      register: `${urls.lti}/lti/register/${accountId}`,
    },
    `${label}: protocolUrls in path mode`,
  );
}

/** Issues or rotates an API key for `accountId` so the test can register a platform on that account. */
async function ensureAccountApiKey(accountId: string, name: string): Promise<string> {
  // If LA-E5-07 is present, POST /operator/v1/accounts/:id/api-keys issues a key directly; in B1 before LA-E5-07,
  // QA form (d) (`lti:bootstrap --rotate-api-key`) writes infra/.secrets/lti-api-key.<id>.
  const viaApi = await operatorApi<{ apiKey?: string }>('POST', `/operator/v1/accounts/${encodeURIComponent(accountId)}/api-keys`, {
    authorization: operatorAuth(operatorKey),
    body: { label: 'qa2-e504', scopes: ['launch', 'admin'] },
  });
  if (viaApi.status === 201 && typeof viaApi.json?.apiKey === 'string') {
    recordSecret('api_key', viaApi.json.apiKey);
    return viaApi.json.apiKey;
  }
  const boot = await ltiBootstrap(accountId, name, { rotateApiKey: true });
  assert.equal(boot.cliCode, 0, `lti:bootstrap for ${accountId} exits 0`);
  assert.equal(boot.keyFileWritten, true, `lti:bootstrap wrote infra/.secrets/lti-api-key.${accountId}`);
  return apiKey(accountId);
}

/** Registers a QA platform on `accountId` using `accountKey` and returns the platform fixture. */
async function setupAccountPlatform(accountKey: string, accountId: string, label: string): Promise<QaPlatform> {
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
    authorization: auth.bearer(accountKey),
    body: {
      url: QA_ISSUER,
      clientId,
      name: `QA platform ${accountId} ${id}`,
      authenticationEndpoint: `${QA_ISSUER}/auth`,
      accesstokenEndpoint: `${QA_ISSUER}/token`,
      authConfig: { method: 'JWK_SET', key: jwksUrl },
      deploymentIds: [QA_DEPLOYMENT],
    },
  });
  assert.equal(res.status, 201, `POST /api/platforms for ${accountId}: status ${res.status}`);
  const platformId = String(res.json?.id ?? '');
  createdPlatforms.push({ key: accountKey, id: platformId });
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

/** Performs an OIDC login + resource-link launch on `/lti/login/:accountId` and `/lti/launch/:accountId`. */
async function launchForAccount(p: QaPlatform, accountId: string) {
  const targetLinkUri = `${urls.lti}/lti/launch/${accountId}?resource=qa`;
  const body = new URLSearchParams({
    iss: QA_ISSUER,
    login_hint: 'qa-user-1',
    target_link_uri: targetLinkUri,
    client_id: p.clientId,
    lti_deployment_id: QA_DEPLOYMENT,
    lti_message_hint: 'qa-hint',
  }).toString();
  const loginRes = await httpsRequest(`${urls.lti}/lti/login/${accountId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) },
    body,
  });
  assert.equal(loginRes.status, 302, `POST /lti/login/${accountId} status ${loginRes.status}`);
  const loc = new URL(String(loginRes.headers.location ?? ''));
  const state = loc.searchParams.get('state') ?? '';
  const nonce = loc.searchParams.get('nonce') ?? '';
  const cookie = [loginRes.headers['set-cookie'] ?? []]
    .flat()
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
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
  const token = await signRs256(resourceLinkClaims(p, login), p.privateKey, p.kid);
  const res = await postLaunch({ id_token: token, state }, cookie, accountId);
  const ltik = res.location ? new URL(res.location).searchParams.get('ltik') ?? '' : '';
  if (ltik) recordSecret('ltik', ltik);
  return { res, ltik };
}

beforeAll(() => {
  operatorKey = readOperatorKey();
  assert.ok(OPERATOR_KEY_RE.test(operatorKey), 'infra/.secrets/lti-operator-key has valid operator key format');
  cogniateKey = apiKey(ACCOUNT);
  secondKey = apiKey(SECOND_ACCOUNT);
  assert.ok(TENANT_KEY_RE.test(cogniateKey), 'cogniate API key has valid format');
  assert.ok(TENANT_KEY_RE.test(secondKey), 'qa-second API key has valid format');
  accA = freshId('acc-a');
  accB = freshId('acc-b');
});

afterAll(async () => {
  // Always ensure qa-second is active even if a test failed mid-flight.
  await operatorApi('PATCH', `/operator/v1/accounts/${SECOND_ACCOUNT}`, {
    authorization: operatorAuth(operatorKey),
    body: { status: 'active' },
  }).catch(() => undefined);

  for (const p of createdPlatforms.splice(0)) {
    await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(p.id)}`, {
      authorization: auth.bearer(p.key),
    }).catch(() => undefined);
  }
});

it('AC-LA-E5-04-01 POST /operator/v1/accounts for two new account ids both give 201 with status active, path-mode protocolUrls and one account.create event each; a repeat gives 409 ACCOUNT_ALREADY_EXISTS', async () => {
  for (const id of [accA, accB]) {
    const res = await operatorApi<AccountRow>('POST', '/operator/v1/accounts', {
      authorization: operatorAuth(operatorKey),
      body: defaultAccountBody(id),
    });
    assert.equal(res.status, 201, `POST /operator/v1/accounts (${id}) status ${res.status} (${errorCode(res) ?? 'ok'})`);
    assert.ok(res.json, `POST /operator/v1/accounts (${id}) returned JSON`);
    assert.equal(res.json.id, id);
    assert.equal(res.json.status, 'active', `${id}: status is active`);
    assert.equal(res.json.launchUrl, `${urls.app}/tool/launch`);
    checkProtocolUrls(id, res.json.protocolUrls, id);
    assert.equal(
      Object.keys(res.json).some((k) => /apiKey|api_key|hash|secret/i.test(k)),
      false,
      `${id}: Account response never contains a key or hash`,
    );

    // Contract delta §3: POST /operator/v1/accounts also makes the first active signing key.
    const jwks = await httpsRequest(`${urls.lti}/lti/keys/${id}`);
    assert.equal(jwks.status, 200, `GET /lti/keys/${id} status`);
    const keys = (JSON.parse(jwks.body) as { keys?: { kid?: string }[] }).keys ?? [];
    assert.ok(keys.length >= 1 && typeof keys[0].kid === 'string', `${id}: has an active signing key in JWKS`);

    const audit = await listAudit(operatorKey, { action: 'account.create', toolAccountId: id, limit: 50 });
    assert.equal(audit.res.status, 200, `GET /operator/v1/audit for ${id} account.create`);
    const hits = audit.events.filter((e) => e.traceId === res.traceId && e.result === 'ok');
    assert.equal(hits.length, 1, `exactly one ok account.create event for ${id}`);
    assert.equal(hits[0].target.type, 'account');
    assert.equal(hits[0].target.id, id);
  }

  const repeat = await operatorApi('POST', '/operator/v1/accounts', {
    authorization: operatorAuth(operatorKey),
    body: defaultAccountBody(accA),
  });
  assert.equal(repeat.status, 409, 'repeat POST /operator/v1/accounts status');
  assert.equal(errorCode(repeat), 'ACCOUNT_ALREADY_EXISTS', 'repeat POST /operator/v1/accounts code');
  assert.ok(hasErrorShape(repeat), 'repeat POST /operator/v1/accounts error shape');
});

it('AC-LA-E5-04-02 on a fresh account, after PATCH {launchUrl: "https://tool-b.test/launch"}, a resource link launch redirects (303) to https://tool-b.test/launch?...&ltik=...; cogniate still redirects to {PUBLIC_APP_URL}/tool/launch', async () => {
  const keyA = await ensureAccountApiKey(accA, `QA2 Account ${accA}`);
  const platformA = await setupAccountPlatform(keyA, accA, 'e504-ac02-a');
  const platformCog = await setupAccountPlatform(cogniateKey, ACCOUNT, 'e504-ac02-cog');

  const patchRes = await operatorApi<AccountRow>('PATCH', `/operator/v1/accounts/${encodeURIComponent(accA)}`, {
    authorization: operatorAuth(operatorKey),
    body: { launchUrl: 'https://tool-b.test/launch' },
  });
  assert.equal(patchRes.status, 200, `PATCH launchUrl status ${patchRes.status}`);
  assert.equal(patchRes.json?.launchUrl, 'https://tool-b.test/launch');

  const launchedA = await launchForAccount(platformA, accA);
  assert.equal(launchedA.res.status, 303, `launch of ${accA}: status 303`);
  const locA = new URL(launchedA.res.location);
  assert.equal(`${locA.origin}${locA.pathname}`, 'https://tool-b.test/launch', `${accA} redirects to https://tool-b.test/launch`);
  assert.equal(locA.searchParams.get('resource'), 'qa', `${accA} launch preserves resource query`);
  assert.ok((locA.searchParams.get('ltik') ?? '').length >= 16, `${accA} launch carries ltik`);

  const launchedCog = await launchForAccount(platformCog, ACCOUNT);
  assert.equal(launchedCog.res.status, 303, 'launch of cogniate: status 303');
  const locCog = new URL(launchedCog.res.location);
  assert.equal(`${locCog.origin}${locCog.pathname}`, `${urls.app}/tool/launch`, 'cogniate still redirects to {PUBLIC_APP_URL}/tool/launch');
  assert.ok((locCog.searchParams.get('ltik') ?? '').length >= 16, 'cogniate launch carries ltik');
});

it('AC-LA-E5-04-03 launchUrl values http://x.test, https://u:p@x.test/a, https://x.test/a#f and a URL on the content host each give 400 INVALID_REQUEST naming launchUrl; the account does not change', async () => {
  const before = await operatorApi<AccountRow>('GET', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(before.status, 200, 'GET account before invalid launchUrl probes');
  const originalLaunchUrl = before.json?.launchUrl;

  const invalidUrls: Array<[string, string]> = [
    ['http scheme', 'http://x.test'],
    ['user info', 'https://u:p@x.test/a'],
    ['fragment', 'https://x.test/a#f'],
    ['content host', `${urls.content}/launch`],
    ['lti host', `${urls.lti}/launch`],
  ];

  for (const [label, badUrl] of invalidUrls) {
    const res = await operatorApi('PATCH', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
      authorization: operatorAuth(operatorKey),
      body: { launchUrl: badUrl },
    });
    assert.equal(res.status, 400, `${label} (${badUrl}): status 400`);
    assert.equal(errorCode(res), 'INVALID_REQUEST', `${label} (${badUrl}): code INVALID_REQUEST`);
    assert.ok(hasErrorShape(res), `${label} (${badUrl}): error body shape`);
    assert.match(description(res), /launchUrl/, `${label} (${badUrl}): error names field launchUrl`);
  }

  const after = await operatorApi<AccountRow>('GET', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(after.status, 200, 'GET account after invalid launchUrl probes');
  assert.equal(after.json?.launchUrl, originalLaunchUrl, 'launchUrl did not change after refused PATCH calls');
});

it('AC-LA-E5-04-04 PATCH {publicBaseUrl: "https://t.test"} gives 400 INVALID_REQUEST with the field publicBaseUrl', async () => {
  const res = await operatorApi('PATCH', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
    body: { publicBaseUrl: 'https://t.test' },
  });
  assert.equal(res.status, 400, 'PATCH publicBaseUrl status');
  assert.equal(errorCode(res), 'INVALID_REQUEST', 'PATCH publicBaseUrl code');
  assert.ok(hasErrorShape(res), 'PATCH publicBaseUrl error shape');
  assert.match(description(res), /publicBaseUrl/, 'error names field publicBaseUrl');

  const check = await operatorApi<AccountRow>('GET', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(check.status, 200);
  checkProtocolUrls(accB, check.json?.protocolUrls, 'still in path mode after refused publicBaseUrl');
});

it('AC-LA-E5-04-05 after PATCH /operator/v1/accounts/qa-second {status: "suspended"}, GET /api/idtoken with a valid qa-second ltik gives 403 TOOL_ACCOUNT_SUSPENDED; cogniate calls still pass; after status: "active" the call passes again', async () => {
  const pSecond = await setupAccountPlatform(secondKey, SECOND_ACCOUNT, 'e504-ac05-sec');
  const pCog = await setupAccountPlatform(cogniateKey, ACCOUNT, 'e504-ac05-cog');
  const { ltik: secondLtik } = await launchForAccount(pSecond, SECOND_ACCOUNT);
  const { ltik: cogLtik } = await launchForAccount(pCog, ACCOUNT);
  assert.ok(secondLtik && cogLtik, 'both qa-second and cogniate launches produced ltiks');

  const preCheck = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(secondKey, secondLtik) });
  assert.equal(preCheck.status, 200, 'pre-suspend GET /api/idtoken for qa-second gives 200');

  try {
    const suspendRes = await operatorApi<AccountRow>('PATCH', `/operator/v1/accounts/${SECOND_ACCOUNT}`, {
      authorization: operatorAuth(operatorKey),
      body: { status: 'suspended' },
    });
    assert.equal(suspendRes.status, 200, 'PATCH qa-second status=suspended gives 200');
    assert.equal(suspendRes.json?.status, 'suspended');

    const suspendedIdToken = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(secondKey, secondLtik) });
    assert.equal(suspendedIdToken.status, 403, 'suspended qa-second GET /api/idtoken status');
    assert.equal(errorCode(suspendedIdToken), 'TOOL_ACCOUNT_SUSPENDED', 'suspended qa-second GET /api/idtoken code');
    assert.ok(hasErrorShape(suspendedIdToken), 'suspended qa-second GET /api/idtoken error shape');

    const suspendedPlatforms = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(secondKey) });
    assert.equal(suspendedPlatforms.status, 403, 'suspended qa-second Bearer GET /api/platforms status');
    assert.equal(errorCode(suspendedPlatforms), 'TOOL_ACCOUNT_SUSPENDED', 'suspended qa-second Bearer GET /api/platforms code');

    // Control: cogniate calls still pass while qa-second is suspended.
    const cogIdToken = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(cogniateKey, cogLtik) });
    assert.equal(cogIdToken.status, 200, 'cogniate GET /api/idtoken still gives 200');
    const cogPlatforms = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(cogniateKey) });
    assert.equal(cogPlatforms.status, 200, 'cogniate GET /api/platforms still gives 200');
  } finally {
    const restoreRes = await operatorApi<AccountRow>('PATCH', `/operator/v1/accounts/${SECOND_ACCOUNT}`, {
      authorization: operatorAuth(operatorKey),
      body: { status: 'active' },
    });
    assert.equal(restoreRes.status, 200, 'restore PATCH qa-second status=active gives 200');
    assert.equal(restoreRes.json?.status, 'active');
  }

  const afterRestore = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(secondKey, secondLtik) });
  assert.equal(afterRestore.status, 200, 'after status=active, qa-second GET /api/idtoken gives 200 again');
});

it('AC-LA-E5-04-06 a PATCH that changes status writes one account.status event; a PATCH of name writes one account.update event', async () => {
  const statusPatch = await operatorApi<AccountRow>('PATCH', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
    body: { status: 'suspended' },
  });
  assert.equal(statusPatch.status, 200, 'PATCH status=suspended status');
  assert.equal(statusPatch.json?.status, 'suspended');

  const statusRestore = await operatorApi<AccountRow>('PATCH', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
    body: { status: 'active' },
  });
  assert.equal(statusRestore.status, 200, 'PATCH status=active status');

  const namePatch = await operatorApi<AccountRow>('PATCH', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
    body: { name: `QA2 Renamed ${runId}` },
  });
  assert.equal(namePatch.status, 200, 'PATCH name status');
  assert.equal(namePatch.json?.name, `QA2 Renamed ${runId}`);

  const statusEvents = await listAudit(operatorKey, { action: 'account.status', toolAccountId: accB, limit: 50 });
  assert.equal(statusEvents.res.status, 200, 'GET /operator/v1/audit?action=account.status');
  const suspendHit = statusEvents.events.filter((e) => e.traceId === statusPatch.traceId);
  assert.equal(suspendHit.length, 1, 'exactly one account.status event for the suspend PATCH');
  assert.equal(suspendHit[0].target.type, 'account');
  assert.equal(suspendHit[0].target.id, accB);
  assert.equal(suspendHit[0].result, 'ok');

  const restoreHit = statusEvents.events.filter((e) => e.traceId === statusRestore.traceId);
  assert.equal(restoreHit.length, 1, 'exactly one account.status event for the restore PATCH');

  const updateEvents = await listAudit(operatorKey, { action: 'account.update', toolAccountId: accB, limit: 50 });
  assert.equal(updateEvents.res.status, 200, 'GET /operator/v1/audit?action=account.update');
  const nameHit = updateEvents.events.filter((e) => e.traceId === namePatch.traceId);
  assert.equal(nameHit.length, 1, 'exactly one account.update event for the name PATCH');
  assert.equal(nameHit[0].target.type, 'account');
  assert.equal(nameHit[0].target.id, accB);
  assert.equal(nameHit[0].result, 'ok');
});

it('AC-LA-E5-04-07 on a fresh account, PATCH {claimPolicy: {mode: "allowlist", keep: {names: false, email: false, custom: false, lis: false}}} gives 200 and GET shows it; an unknown mode gives 400 INVALID_REQUEST', async () => {
  const validPolicy = {
    mode: 'allowlist',
    keep: { names: false, email: false, custom: false, lis: false },
  };
  const patchOk = await operatorApi<AccountRow>('PATCH', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
    body: { claimPolicy: validPolicy },
  });
  assert.equal(patchOk.status, 200, `PATCH valid claimPolicy status ${patchOk.status}`);
  assert.deepEqual(patchOk.json?.claimPolicy, validPolicy, 'PATCH answer includes the new claimPolicy');

  const getOk = await operatorApi<AccountRow>('GET', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
  });
  assert.equal(getOk.status, 200, 'GET account after valid claimPolicy');
  assert.deepEqual(getOk.json?.claimPolicy, validPolicy, 'GET answer shows the stored claimPolicy');

  const badPolicy = {
    mode: 'invalid-mode',
    keep: { names: false, email: false, custom: false, lis: false },
  };
  const patchBad = await operatorApi('PATCH', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
    body: { claimPolicy: badPolicy },
  });
  assert.equal(patchBad.status, 400, 'PATCH unknown claimPolicy.mode status');
  assert.equal(errorCode(patchBad), 'INVALID_REQUEST', 'PATCH unknown claimPolicy.mode code');
  assert.ok(hasErrorShape(patchBad), 'PATCH unknown claimPolicy.mode error shape');

  const getAfterBad = await operatorApi<AccountRow>('GET', `/operator/v1/accounts/${encodeURIComponent(accB)}`, {
    authorization: operatorAuth(operatorKey),
  });
  assert.deepEqual(getAfterBad.json?.claimPolicy, validPolicy, 'stored claimPolicy is unchanged after refused PATCH');
});

it('AC-LA-E5-04-08 (form (d)) on a fresh account made by lti:bootstrap, the printed apiKey gives 200 on GET /api/platforms; after PATCH {status: "closed"} the same key gives 401, one account.status event exists, and a later PATCH gives 409 ACCOUNT_CLOSED', async () => {
  const closeId = freshId('close');
  const boot = await ltiBootstrap(closeId, `QA2 Close Account ${closeId}`);
  assert.equal(boot.cliCode, 0, `lti:bootstrap for ${closeId} exits 0`);
  assert.equal(boot.keyCount, 1, 'lti:bootstrap printed one new API key');
  assert.equal(boot.keyFileWritten, true, `lti:bootstrap wrote infra/.secrets/lti-api-key.${closeId}`);

  const freshKey = apiKey(closeId);
  assert.ok(TENANT_KEY_RE.test(freshKey), 'fresh account API key has ltis_ + 43 base64url format');

  const beforeClose = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(freshKey) });
  assert.equal(beforeClose.status, 200, 'fresh account API key gives 200 on GET /api/platforms before close');

  const closeRes = await operatorApi<AccountRow>('PATCH', `/operator/v1/accounts/${encodeURIComponent(closeId)}`, {
    authorization: operatorAuth(operatorKey),
    body: { status: 'closed' },
  });
  assert.equal(closeRes.status, 200, `PATCH status=closed status ${closeRes.status}`);
  assert.equal(closeRes.json?.status, 'closed', 'account status is closed');

  const afterClose = await ltiApi('GET', '/api/platforms', { authorization: auth.bearer(freshKey) });
  assert.equal(afterClose.status, 401, 'closed account API key gives 401 on GET /api/platforms');
  assert.ok(hasErrorShape(afterClose), '401 response has standard error shape');

  const statusAudit = await listAudit(operatorKey, { action: 'account.status', toolAccountId: closeId, limit: 50 });
  assert.equal(statusAudit.res.status, 200, 'GET /operator/v1/audit?action=account.status for closed account');
  const closeHits = statusAudit.events.filter((e) => e.traceId === closeRes.traceId && e.result === 'ok');
  assert.equal(closeHits.length, 1, 'exactly one ok account.status event for the close PATCH');

  for (const body of [{ name: 'Cannot rename closed account' }, { status: 'active' }]) {
    const laterPatch = await operatorApi('PATCH', `/operator/v1/accounts/${encodeURIComponent(closeId)}`, {
      authorization: operatorAuth(operatorKey),
      body,
    });
    assert.equal(laterPatch.status, 409, `later PATCH (${JSON.stringify(body)}) on closed account gives 409`);
    assert.equal(errorCode(laterPatch), 'ACCOUNT_CLOSED', `later PATCH (${JSON.stringify(body)}) gives ACCOUNT_CLOSED`);
    assert.ok(hasErrorShape(laterPatch), '409 ACCOUNT_CLOSED has standard error shape');
  }
});

it('AC-LA-E5-04-09 POST /operator/v1/accounts/<fresh account>/shared-platforms {profile: "blackboard-sim", clientId} gives 201 and writes one platform.create_shared event; the same call again gives 200 with the same platform; another clientId gives 409 SHARED_PLATFORM_EXISTS', async () => {
  const clientId = `qa2-bb-${runId}`;
  const first = await operatorApi<{ id?: string; profile?: string; clientId?: string }>(
    'POST',
    `/operator/v1/accounts/${encodeURIComponent(accB)}/shared-platforms`,
    {
      authorization: operatorAuth(operatorKey),
      body: { profile: 'blackboard-sim', clientId, name: 'QA2 Shared Blackboard' },
    },
  );
  assert.equal(first.status, 201, `first POST shared-platforms status ${first.status} (${errorCode(first) ?? 'ok'})`);
  const platformId = String(first.json?.id ?? '');
  assert.match(platformId, /^plt_/, 'created shared platform id starts with plt_');
  assert.equal(first.json?.profile, 'blackboard-sim');
  assert.equal(first.json?.clientId, clientId);

  const audit = await listAudit(operatorKey, { action: 'platform.create_shared', toolAccountId: accB, limit: 50 });
  assert.equal(audit.res.status, 200, 'GET /operator/v1/audit?action=platform.create_shared');
  const createHits = audit.events.filter((e) => e.traceId === first.traceId && e.result === 'ok');
  assert.equal(createHits.length, 1, 'first call wrote one ok platform.create_shared event');
  assert.equal(createHits[0].target.type, 'platform');
  assert.equal(createHits[0].target.id, platformId);

  const second = await operatorApi<{ id?: string; profile?: string; clientId?: string }>(
    'POST',
    `/operator/v1/accounts/${encodeURIComponent(accB)}/shared-platforms`,
    {
      authorization: operatorAuth(operatorKey),
      body: { profile: 'blackboard-sim', clientId, name: 'QA2 Shared Blackboard' },
    },
  );
  assert.equal(second.status, 200, 'repeat POST shared-platforms with same clientId gives 200');
  assert.equal(second.json?.id, platformId, 'repeat POST returns the same platform id');
  assert.equal(second.json?.clientId, clientId);

  const conflict = await operatorApi(
    'POST',
    `/operator/v1/accounts/${encodeURIComponent(accB)}/shared-platforms`,
    {
      authorization: operatorAuth(operatorKey),
      body: { profile: 'blackboard-sim', clientId: `${clientId}-other`, name: 'Other BB' },
    },
  );
  assert.equal(conflict.status, 409, 'POST shared-platforms with another clientId gives 409');
  assert.equal(errorCode(conflict), 'SHARED_PLATFORM_EXISTS', 'code is SHARED_PLATFORM_EXISTS');
  assert.ok(hasErrorShape(conflict), '409 SHARED_PLATFORM_EXISTS has standard error shape');
});
