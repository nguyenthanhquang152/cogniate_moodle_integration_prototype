// LA-E5-06 K1-SIM acceptance suite (runs inside the e2e container on the SIM slot).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E5-06.md (AC-LA-E5-06-01 .. AC-LA-E5-06-07, AC-LA-E5-06-10)
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md D1 rules 2, 5, 6; D2 rule 5
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §1.3, §1.5, §2.1-§2.4, §3
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpsRequest } from '../../../acceptance/lib/https';
import { ACCOUNT, apiKey, auth, ltiApi, recordSecret } from '../../../acceptance/lib/lti';
import {
  expectStatus,
  formPost,
  parseForm,
  records,
  sim,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';

const PUBLIC_LTI_URL = urls.lti.replace(/\/$/, '');
const PUBLIC_APP_URL = urls.app.replace(/\/$/, '');
const OPERATOR_BASE_URL = (process.env.LTI_OPERATOR_URL ?? 'http://lti-service:4110').replace(/\/$/, '');
const MOODLE_SIM_ISSUER = 'https://moodle.sim.test';

function readOperatorKey(): string {
  if (process.env.LTI_OPERATOR_KEY?.trim()) {
    return process.env.LTI_OPERATOR_KEY.trim();
  }
  const candidates = [
    process.env.LTI_OPERATOR_KEY_FILE ?? '',
    '/repo/infra/.secrets/lti-operator-key',
    path.resolve(process.cwd(), 'infra/.secrets/lti-operator-key'),
    path.resolve(process.cwd(), '../infra/.secrets/lti-operator-key'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      const val = fs.readFileSync(c, 'utf8').trim();
      if (val) {
        recordSecret('api_key', val);
        return val;
      }
    }
  }
  throw new Error(`Operator key file not found in: ${candidates.join(', ')}`);
}

interface OperatorAccount {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'closed';
  launchUrl: string;
  deepLinkingUrl: string;
  registrationUrl: string;
  protocolUrls: {
    login: string;
    launch: string;
    keys: string;
    register: string;
  };
}

async function operatorRequest(
  method: string,
  routePath: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
  const res = await fetch(`${OPERATOR_BASE_URL}${routePath}`, {
    method,
    headers: {
      Authorization: `OPERATOR-AUTH-V1 ${readOperatorKey()}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // non-JSON
  }
  return { status: res.status, json, text };
}

async function createFreshAccountWithApiKey(suffix: string): Promise<{
  account: OperatorAccount;
  apiKey: string;
}> {
  const accountId = `qa-e506-${suffix}-${crypto.randomBytes(3).toString('hex')}`;
  const createRes = await operatorRequest('POST', '/operator/v1/accounts', {
    id: accountId,
    name: `QA E5-06 ${suffix}`,
    launchUrl: `${PUBLIC_APP_URL}/lti/launch`,
    deepLinkingUrl: `${PUBLIC_APP_URL}/lti/deep-linking`,
    registrationUrl: `${PUBLIC_APP_URL}/lti/registration`,
  });
  expect(createRes.status, `POST /operator/v1/accounts (${accountId}) => ${createRes.text}`).toBe(201);

  const keyRes = await operatorRequest('POST', `/operator/v1/accounts/${accountId}/api-keys`, {
    label: `qa-e506-${suffix}`,
    scopes: ['launch', 'admin'],
  });
  expect(keyRes.status, `POST /operator/v1/accounts/${accountId}/api-keys => ${keyRes.text}`).toBe(201);
  const issuedKey = String(keyRes.json.apiKey ?? '');
  expect(issuedKey.length).toBeGreaterThan(10);
  recordSecret('api_key', issuedKey);

  return {
    account: createRes.json as unknown as OperatorAccount,
    apiKey: issuedKey,
  };
}

async function createMoodleSimPlatform(
  bearerKey: string,
  clientId: string,
  deploymentId = '1',
): Promise<string> {
  const res = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(bearerKey),
    body: {
      profile: 'standard',
      name: `QA E5-06 Moodle Sim (${clientId})`,
      url: MOODLE_SIM_ISSUER,
      clientId,
      authenticationEndpoint: `${MOODLE_SIM_ISSUER}/mod/lti/auth.php`,
      accesstokenEndpoint: `${MOODLE_SIM_ISSUER}/mod/lti/token.php`,
      authConfig: {
        method: 'JWK_SET',
        key: `${MOODLE_SIM_ISSUER}/mod/lti/certs.php`,
      },
      deploymentIds: [deploymentId],
    },
  });
  expect(res.status, `POST /api/platforms (${clientId}) => ${res.body}`).toBe(201);
  return String(res.json?.id ?? '');
}

async function createMoodleDrScenario(label: string): Promise<{
  scenarioId: string;
  openidConfiguration: string;
  registrationToken: string;
}> {
  const scenarioId = unique(`e506-dr-${label}`);
  const created = await sim('/scenarios', 'POST', {
    id: scenarioId,
    provider: 'moodle-sim',
    clientId: unique(`e506-dr-client-${label}`),
    deploymentId: '1',
    siteHost: 'moodle.sim.test',
    dr: { operation: 'new' },
  });
  expectStatus(created, 201);
  const reg = created.json.registration as {
    openidConfiguration?: string;
    registrationToken?: string;
  };
  const openidConfiguration =
    reg?.openidConfiguration ??
    `${MOODLE_SIM_ISSUER}/mod/lti/openid-configuration.php?scenario=${encodeURIComponent(scenarioId)}`;
  const registrationToken = String(reg?.registrationToken ?? '');
  expect(registrationToken.split('.').length).toBe(3);
  recordSecret('runtime_token', registrationToken);
  return { scenarioId, openidConfiguration, registrationToken };
}

describe('LA-E5-06 K1-SIM: Protocol wiring (resolver, status pages, session cap)', () => {
  let cogniateKey = '';
  let cogniatePlatformId = '';
  const cogniateClientId = unique('sim-e506-cog');
  const cogniateDeploymentId = '1';
  const createdAccounts: string[] = [];

  beforeAll(async () => {
    cogniateKey = apiKey(ACCOUNT);
    cogniatePlatformId = await createMoodleSimPlatform(
      cogniateKey,
      cogniateClientId,
      cogniateDeploymentId,
    );
  });

  afterAll(async () => {
    if (cogniatePlatformId && cogniateKey) {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(cogniatePlatformId)}`, {
        authorization: auth.bearer(cogniateKey),
      }).catch(() => undefined);
    }
    for (const accountId of createdAccounts.splice(0)) {
      await operatorRequest('PATCH', `/operator/v1/accounts/${accountId}`, {
        status: 'closed',
      }).catch(() => undefined);
    }
  });

  it('AC-LA-E5-06-01: suspended account login gives 403 TOOL_ACCOUNT_SUSPENDED and no Set-Cookie; cogniate launch still passes', async () => {
    const { account, apiKey: acctKey } = await createFreshAccountWithApiKey('ac01');
    createdAccounts.push(account.id);
    const clientId = unique('sim-e506-ac01');
    await createMoodleSimPlatform(acctKey, clientId, '1');

    const suspendRes = await operatorRequest('PATCH', `/operator/v1/accounts/${account.id}`, {
      status: 'suspended',
    });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.json.status).toBe('suspended');

    // Login on the suspended account returns 403 page TOOL_ACCOUNT_SUSPENDED and no Set-Cookie
    const loginParams = new URLSearchParams({
      iss: MOODLE_SIM_ISSUER,
      login_hint: 'student-1',
      target_link_uri: account.launchUrl,
      client_id: clientId,
      lti_deployment_id: '1',
    });
    const suspLoginRes = await httpsRequest(
      `${PUBLIC_LTI_URL}/lti/login/${account.id}?${loginParams.toString()}`,
    );
    expect(suspLoginRes.status).toBe(403);
    expect(suspLoginRes.body).toContain('data-error-code="TOOL_ACCOUNT_SUSPENDED"');
    expect(suspLoginRes.body).toContain('This Cogniate tool is switched off. Ask your Cogniate admin.');
    expect(suspLoginRes.headers['set-cookie']).toBeUndefined();

    // Meanwhile, cogniate launch still passes
    const cogSc = await sim('/scenarios', 'POST', {
      id: unique('e506-cog-ac01'),
      provider: 'moodle-sim',
      clientId: cogniateClientId,
      deploymentId: cogniateDeploymentId,
      siteHost: 'moodle.sim.test',
    });
    expectStatus(cogSc, 201);
    const cogLogin = await formPost(`${PUBLIC_LTI_URL}/lti/login/cogniate`, cogSc.json.login);
    expect(cogLogin.status).toBe(302);
    const cogCookie =
      [cogLogin.headers['set-cookie'] ?? []]
        .flat()
        .map((c) => String(c).split(';')[0] ?? '')
        .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
    expect(cogCookie).toMatch(/^__Host-lti_state_/);

    const authorize = await httpsRequest(String(cogLogin.headers.location ?? ''));
    expectStatus(authorize, 200);
    const { action, fields } = parseForm(authorize.body);
    recordSecret('id_token', fields.id_token);
    recordSecret('state', fields.state);

    const cogLaunch = await formPost(action, fields, cogCookie);
    expect(cogLaunch.status).toBe(303);
    const ltik = new URL(String(cogLaunch.headers.location ?? '')).searchParams.get('ltik') ?? '';
    expect(ltik.length).toBeGreaterThan(20);
    recordSecret('ltik', ltik);
  });

  it('AC-LA-E5-06-02: suspended account GET /lti/register/:account gives 403 TOOL_ACCOUNT_SUSPENDED and simulator records no configuration fetch', async () => {
    const { account } = await createFreshAccountWithApiKey('ac02');
    createdAccounts.push(account.id);

    const suspendRes = await operatorRequest('PATCH', `/operator/v1/accounts/${account.id}`, {
      status: 'suspended',
    });
    expect(suspendRes.status).toBe(200);

    const dr = await createMoodleDrScenario('ac02');
    const cursor0 = (await records()).cursor;

    const regParams = new URLSearchParams({
      openid_configuration: dr.openidConfiguration,
      registration_token: dr.registrationToken,
    });
    const regRes = await httpsRequest(
      `${PUBLIC_LTI_URL}/lti/register/${account.id}?${regParams.toString()}`,
    );
    expect(regRes.status).toBe(403);
    expect(regRes.body).toContain('data-error-code="TOOL_ACCOUNT_SUSPENDED"');
    expect(regRes.body).toContain('This Cogniate tool is switched off. Ask your Cogniate admin.');

    const simRecs = (await records(cursor0)).records;
    const configFetches = simRecs.filter((r: Json) => r.kind === 'openid-configuration');
    expect(configFetches).toHaveLength(0);
  });

  it('AC-LA-E5-06-03: suspended account GET /lti/keys/:account gives 200 with keys', async () => {
    const { account } = await createFreshAccountWithApiKey('ac03');
    createdAccounts.push(account.id);

    const suspendRes = await operatorRequest('PATCH', `/operator/v1/accounts/${account.id}`, {
      status: 'suspended',
    });
    expect(suspendRes.status).toBe(200);

    const keysRes = await httpsRequest(`${PUBLIC_LTI_URL}/lti/keys/${account.id}`);
    expect(keysRes.status).toBe(200);
    const jwks = JSON.parse(keysRes.body) as { keys?: Array<{ kty: string; kid: string }> };
    expect(Array.isArray(jwks.keys)).toBe(true);
    expect(jwks.keys!.length).toBeGreaterThanOrEqual(1);
    expect(jwks.keys![0]?.kty).toBe('RSA');
  });

  it('AC-LA-E5-06-04: closed account login gives 404 UNKNOWN_TOOL_ACCOUNT and GET /lti/keys/:account gives 404', async () => {
    const { account, apiKey: acctKey } = await createFreshAccountWithApiKey('ac04');
    createdAccounts.push(account.id);
    const clientId = unique('sim-e506-ac04');
    await createMoodleSimPlatform(acctKey, clientId, '1');

    const closeRes = await operatorRequest('PATCH', `/operator/v1/accounts/${account.id}`, {
      status: 'closed',
    });
    expect(closeRes.status).toBe(200);
    expect(closeRes.json.status).toBe('closed');

    const loginParams = new URLSearchParams({
      iss: MOODLE_SIM_ISSUER,
      login_hint: 'student-1',
      target_link_uri: account.launchUrl,
      client_id: clientId,
      lti_deployment_id: '1',
    });
    const loginRes = await httpsRequest(
      `${PUBLIC_LTI_URL}/lti/login/${account.id}?${loginParams.toString()}`,
    );
    expect(loginRes.status).toBe(404);
    expect(loginRes.body).toContain('data-error-code="UNKNOWN_TOOL_ACCOUNT"');

    const keysRes = await httpsRequest(`${PUBLIC_LTI_URL}/lti/keys/${account.id}`);
    expect(keysRes.status).toBe(404);
  });

  it('AC-LA-E5-06-05 & AC-LA-E5-06-06: 4th open registration session on an account gives 409 REGISTRATION_SESSION_LIMIT with no outbound fetch, while a second account still opens a session (200)', async () => {
    const { account: acctA } = await createFreshAccountWithApiKey('ac05a');
    const { account: acctB } = await createFreshAccountWithApiKey('ac06b');
    createdAccounts.push(acctA.id, acctB.id);

    const patchLimits = await operatorRequest('PATCH', '/operator/v1/rate-limits', {
      registrationSessionsPerAddress: 3,
      classes: {
        registration: { ratePerMinute: 100, burst: 100 },
      },
    });
    expect(patchLimits.status, `PATCH /operator/v1/rate-limits => ${patchLimits.text}`).toBe(200);
    expect(patchLimits.json.registrationSessionsPerAddress).toBe(3);

    try {
      const dr = await createMoodleDrScenario('ac05');
      const regParams = new URLSearchParams({
        openid_configuration: dr.openidConfiguration,
        registration_token: dr.registrationToken,
      });

      const cursor0 = (await records()).cursor;

      // Open 3 sessions on acctA
      for (let i = 1; i <= 3; i += 1) {
        const res = await httpsRequest(
          `${PUBLIC_LTI_URL}/lti/register/${acctA.id}?${regParams.toString()}`,
        );
        expect(res.status, `Session ${i} on ${acctA.id} should return 200`).toBe(200);
      }

      const recsAfter3 = (await records(cursor0)).records;
      const configFetchesAfter3 = recsAfter3.filter(
        (r: Json) => r.kind === 'openid-configuration',
      ).length;
      expect(configFetchesAfter3).toBe(3);

      // 4th open session on acctA gives 409 REGISTRATION_SESSION_LIMIT and makes no outbound fetch
      const fourthRes = await httpsRequest(
        `${PUBLIC_LTI_URL}/lti/register/${acctA.id}?${regParams.toString()}`,
      );
      expect(fourthRes.status).toBe(409);
      expect(fourthRes.body).toContain('data-error-code="REGISTRATION_SESSION_LIMIT"');
      expect(fourthRes.body).toContain(
        'Too many registrations are open. Wait one hour, or finish the open registration in',
      );

      const recsAfter4 = (await records(cursor0)).records;
      const configFetchesAfter4 = recsAfter4.filter(
        (r: Json) => r.kind === 'openid-configuration',
      ).length;
      expect(configFetchesAfter4, 'No outbound configuration fetch for the 4th session').toBe(
        configFetchesAfter3,
      );

      // AC-LA-E5-06-06: In the same minute, registration start on a second fresh account from the same address still opens a session (200)
      const secondAcctRes = await httpsRequest(
        `${PUBLIC_LTI_URL}/lti/register/${acctB.id}?${regParams.toString()}`,
      );
      expect(secondAcctRes.status).toBe(200);
    } finally {
      // Restore registrationSessionsPerAddress and the registration limit
      const restoreRes = await operatorRequest('PATCH', '/operator/v1/rate-limits', {
        registrationSessionsPerAddress: null,
        classes: {
          registration: null,
        },
      });
      expect(restoreRes.status).toBe(200);
    }
  });

  it('AC-LA-E5-06-07: Moodle-shaped simulator Dynamic Registration of cogniate sends initiate_login_uri, redirect_uris, jwks_uri and target_link_uri equal to protocolUrls of cogniate', async () => {
    const acctRes = await operatorRequest('GET', '/operator/v1/accounts/cogniate');
    expect(acctRes.status).toBe(200);
    const cogniateAcct = acctRes.json as unknown as OperatorAccount;
    expect(cogniateAcct.protocolUrls).toEqual({
      login: `${PUBLIC_LTI_URL}/lti/login/cogniate`,
      launch: `${PUBLIC_LTI_URL}/lti/launch/cogniate`,
      keys: `${PUBLIC_LTI_URL}/lti/keys/cogniate`,
      register: `${PUBLIC_LTI_URL}/lti/register/cogniate`,
    });

    const dr = await createMoodleDrScenario('ac07');
    const cursor0 = (await records()).cursor;

    const regParams = new URLSearchParams({
      openid_configuration: dr.openidConfiguration,
      registration_token: dr.registrationToken,
    });
    const startRes = await httpsRequest(
      `${PUBLIC_LTI_URL}/lti/register/cogniate?${regParams.toString()}`,
    );
    expect(startRes.status).toBe(200);
    const locHeader = String(startRes.headers.location ?? '');
    const regIdMatch =
      /registrationId["'=:\s]+([0-9a-fA-F-]{16,64})/.exec(startRes.body) ??
      /registration[_-]?id=([0-9a-fA-F-]{16,64})/i.exec(startRes.body) ??
      /registration[_-]?id=([0-9a-fA-F-]{16,64})/i.exec(locHeader);
    expect(regIdMatch, 'registrationId present in registration start output').not.toBeNull();
    const registrationId = regIdMatch![1]!;

    const completeRes = await ltiApi<{
      platformId?: string;
      platform?: { id?: string };
    }>('POST', `/api/registrations/${encodeURIComponent(registrationId)}/complete`, {
      authorization: auth.bearer(cogniateKey),
      body: {
        toolName: 'Cogniate E5-06 DR Check',
        autoActivate: true,
      },
    });
    expect([200, 201]).toContain(completeRes.status);
    const createdPlatformId = completeRes.json?.platformId ?? completeRes.json?.platform?.id;

    try {
      const simRecs = (await records(cursor0)).records;
      const regRec = simRecs.find(
        (r: Json) => r.kind === 'registration' && r.provider === 'moodle-sim',
      );
      expect(regRec, 'Simulator recorded registration POST on moodle-sim').toBeDefined();

      expect(regRec!.initiateLoginUri).toBe(cogniateAcct.protocolUrls.login);
      expect(regRec!.redirectUris).toEqual([cogniateAcct.protocolUrls.launch]);
      expect(regRec!.jwksUri).toBe(cogniateAcct.protocolUrls.keys);
      expect(regRec!.toolConfiguration?.target_link_uri).toBe(cogniateAcct.launchUrl);
    } finally {
      if (createdPlatformId) {
        await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(createdPlatformId)}`, {
          authorization: auth.bearer(cogniateKey),
        }).catch(() => undefined);
      }
    }
  });

  it('AC-LA-E5-06-10: for a suspended account, POST /lti/launch/<account> with a valid state gives 403 TOOL_ACCOUNT_SUSPENDED, no 303 and no ltik', async () => {
    const { account, apiKey: acctKey } = await createFreshAccountWithApiKey('ac10');
    createdAccounts.push(account.id);
    const clientId = unique('sim-e506-ac10');
    await createMoodleSimPlatform(acctKey, clientId, '1');

    // Step 1: Login while the account is still active so a valid state row and state cookie exist
    const scRes = await sim('/scenarios', 'POST', {
      id: unique('e506-ac10'),
      provider: 'moodle-sim',
      clientId,
      deploymentId: '1',
      siteHost: 'moodle.sim.test',
    });
    expectStatus(scRes, 201);

    const loginFields: Record<string, string> = {
      ...scRes.json.login,
      target_link_uri: account.launchUrl,
    };
    const loginRes = await formPost(`${PUBLIC_LTI_URL}/lti/login/${account.id}`, loginFields);
    expect(loginRes.status).toBe(302);
    const cookiePair =
      [loginRes.headers['set-cookie'] ?? []]
        .flat()
        .map((c) => String(c).split(';')[0] ?? '')
        .find((c) => c.startsWith('__Host-lti_state_')) ?? '';
    expect(cookiePair).toMatch(/^__Host-lti_state_/);

    const authorize = await httpsRequest(String(loginRes.headers.location ?? ''));
    expectStatus(authorize, 200);
    const { fields } = parseForm(authorize.body);
    recordSecret('id_token', fields.id_token);
    recordSecret('state', fields.state);

    // Step 2: Suspend the account before POST /lti/launch/<account>
    const suspendRes = await operatorRequest('PATCH', `/operator/v1/accounts/${account.id}`, {
      status: 'suspended',
    });
    expect(suspendRes.status).toBe(200);

    // Step 3: POST /lti/launch/<account> with the valid state and signed id_token
    const launchRes = await formPost(
      `${PUBLIC_LTI_URL}/lti/launch/${account.id}`,
      fields,
      cookiePair,
    );
    expect(launchRes.status).toBe(403);
    expect(launchRes.status).not.toBe(303);
    expect(launchRes.headers.location).toBeUndefined();
    expect(launchRes.body).toContain('data-error-code="TOOL_ACCOUNT_SUSPENDED"');
    expect(launchRes.body).toContain('This Cogniate tool is switched off. Ask your Cogniate admin.');
    expect(launchRes.body).not.toContain('ltik=');
  });
});
