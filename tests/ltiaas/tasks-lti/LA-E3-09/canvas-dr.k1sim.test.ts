// LA-E3-09 K1-SIM acceptance suite (runs inside the e2e container on the SIM slot).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-09.md (AC-LA-E3-09-01 .. AC-LA-E3-09-05)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D6
// - docs/architecture/ltiaas/build-decisions-A1.md (BD-A1-105, BD-A1-106, BD-A1-107, BD-A1-109)
// - docs/architecture/ltiaas/build-decisions-A2.md (BD-A2-89, BD-A2-93, BD-A2-94, BD-A2-95)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpsRequest } from '../../../acceptance/lib/https';
import { ACCOUNT, apiKey, auth, errorCode, ltiApi, recordSecret } from '../../../acceptance/lib/lti';
import {
  CLOUD,
  canvasClientId,
  canvasDeploymentId,
  canvasGrant,
  canvasLaunch,
  canvasRedeem,
  platformsFor,
  refused,
} from '../../../acceptance/M1/canvas/canvas';
import {
  APP,
  app,
  connPath,
  expectStatus,
  parseForm,
  records,
  session,
  sim,
  unique,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';

const FOUR_AGS_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
] as const;

async function createCanvasDrScenario(
  label: string,
  drPatch: Record<string, unknown> = {},
): Promise<{
  scenarioId: string;
  clientId: string;
  deploymentId: string;
  openidConfiguration: string;
  registrationToken: string;
}> {
  const scenarioId = unique(`e309-dr-${label}`);
  const clientId = canvasClientId();
  const deploymentId = canvasDeploymentId();
  const created = await sim('/scenarios', 'POST', {
    id: scenarioId,
    provider: CLOUD.provider,
    clientId,
    deploymentId,
    siteHost: 'school-a.canvas.sim.test',
    dr: { operation: 'new', ...drPatch },
  });
  expectStatus(created, 201);
  const reg = created.json.registration as {
    openidConfiguration?: string;
    registrationToken?: string;
  };
  const openidConfiguration = String(reg?.openidConfiguration ?? '');
  const registrationToken = String(reg?.registrationToken ?? '');
  expect(openidConfiguration).toContain('https://school-a.canvas.sim.test/');
  expect(registrationToken.length).toBeGreaterThan(5);
  recordSecret('runtime_token', registrationToken);
  return { scenarioId, clientId, deploymentId, openidConfiguration, registrationToken };
}

async function runAppDynamicRegistration(
  registrationUrl: string,
  openidConfiguration: string,
  registrationToken: string,
) {
  const sep = registrationUrl.includes('?') ? '&' : '?';
  const startUrl = `${registrationUrl}${sep}openid_configuration=${encodeURIComponent(openidConfiguration)}&registration_token=${encodeURIComponent(registrationToken)}`;
  const startRes = await httpsRequest(startUrl);
  expect(startRes.status, `DR start failed: ${startRes.body.slice(0, 300)}`).toBe(303);
  const confirmUrl = new URL(String(startRes.headers.location ?? ''), APP).href;
  const confirmGet = await httpsRequest(confirmUrl);
  expectStatus(confirmGet, 200);
  const { action, fields } = parseForm(confirmGet.body);
  const postUrl = new URL(action, confirmUrl).href;
  const confirmPost = await httpsRequest(postUrl, {
    method: 'POST',
    headers: {
      origin: APP,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields).toString(),
  });
  return { startRes, confirmGet, confirmPost };
}

describe('LA-E3-09 K1-SIM: Canvas Dynamic Registration in LTI service (profile rule + staged)', () => {
  let key = '';
  const createdPlatformIds: string[] = [];

  beforeAll(() => {
    key = apiKey(ACCOUNT);
  });

  afterAll(async () => {
    for (const id of createdPlatformIds.splice(0)) {
      await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(id)}`, {
        authorization: auth.bearer(key),
      }).catch(() => undefined);
    }
  });

  it('[SIM] AC-LA-E3-09-01 & AC-LA-E3-09-02: Canvas-shaped simulator Dynamic Registration creates an inactive platform with the session bindingRef, and sends the three Canvas extension members and the four AGS scopes (AP-05-29) {case:LA-E3-09-01}', async () => {
    const dr = await createCanvasDrScenario('ac01-02');
    const bindingRef = `bref-${dr.scenarioId}`;
    const cursor0 = (await records()).cursor;

    const startUrl = `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(dr.openidConfiguration)}&registration_token=${encodeURIComponent(dr.registrationToken)}`;
    const startRes = await httpsRequest(startUrl);
    expect([200, 303]).toContain(startRes.status);
    const locHeader = String(startRes.headers.location ?? '');
    const regIdMatch =
      /registrationId["'=:\s]+([0-9a-fA-F-]{16,64})/.exec(startRes.body) ??
      /registration[_-]?id=([0-9a-fA-F-]{16,64})/i.exec(startRes.body) ??
      /registration[_-]?id=([0-9a-fA-F-]{16,64})/i.exec(locHeader);
    expect(regIdMatch, 'registrationId present in registration start output').not.toBeNull();
    const registrationId = regIdMatch![1]!;

    const completeRes = await ltiApi<{
      platformId?: string;
      active?: boolean;
      html?: string;
    }>('POST', `/api/registrations/${encodeURIComponent(registrationId)}/complete`, {
      authorization: auth.bearer(key),
      body: {
        platformName: `QA4 E3-09 Canvas DR ${dr.scenarioId}`,
        profile: CLOUD.profile,
        bindingRef,
        scopes: [...FOUR_AGS_SCOPES],
      },
    });
    expect(completeRes.status, completeRes.body).toBe(200);
    expect(completeRes.json?.active).toBe(false);
    const platformId = String(completeRes.json?.platformId ?? '');
    expect(platformId).not.toBe('');
    createdPlatformIds.push(platformId);

    // AC-LA-E3-09-01: stored platform is inactive with the session's bindingRef and derived siteUrl/serviceUrl
    const platRes = await ltiApi<{
      id: string;
      active: boolean;
      bindingRef: string | null;
      profile: string;
      url: string;
      siteUrl: string;
      serviceUrl: string;
      clientId: string;
      deploymentIds: string[];
    }>('GET', `/api/platforms/${encodeURIComponent(platformId)}`, {
      authorization: auth.bearer(key),
    });
    expect(platRes.status, platRes.body).toBe(200);
    expect(platRes.json.active).toBe(false);
    expect(platRes.json.bindingRef).toBe(bindingRef);
    expect(platRes.json.profile).toBe(CLOUD.profile);
    expect(platRes.json.url).toBe(CLOUD.issuer);
    expect(platRes.json.siteUrl).toBe(CLOUD.siteA);
    expect(platRes.json.serviceUrl).toBe(CLOUD.siteA);
    expect(platRes.json.clientId).toBe(dr.clientId);
    expect(platRes.json.deploymentIds).toEqual([dr.deploymentId]);

    // AC-LA-E3-09-02: simulator registration request has the 3 Canvas extension members and the 4 AGS scopes
    const simRecs = (await records(cursor0)).records;
    const regRec = simRecs.find(
      (r: Json) => r.kind === 'registration' && r.provider === CLOUD.provider && r.clientId === dr.clientId,
    );
    expect(regRec, 'Simulator recorded registration POST on canvas-sim-cloud').toBeDefined();
    expect(regRec!.toolConfiguration['https://canvas.instructure.com/lti/privacy_level']).toBe('anonymous');
    expect(regRec!.toolConfiguration['https://canvas.instructure.com/lti/tool_id']).toBe('cogniate');
    expect(regRec!.toolConfiguration['https://canvas.instructure.com/lti/vendor']).toBe('Cogniate');
    expect([...(regRec!.scopes as string[])].sort()).toEqual([...FOUR_AGS_SCOPES].sort());
  });

  it('[SIM] AC-LA-E3-09-03: before the grant, learner login to the staged Canvas DR platform is refused with PLATFORM_NOT_ACTIVE; after app:grant issue and redemption, the launch passes (AP-05-29) {case:LA-E3-09-03}', async () => {
    const s = await session('A');
    const dr = await createCanvasDrScenario('ac03');

    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA4 E3-09 Dynamic Canvas'),
      lms: 'canvas',
      profile: CLOUD.profile,
      method: 'dynamic',
      siteUrl: CLOUD.siteA,
    });
    expectStatus(createRes, 201);
    expect(createRes.json.bindingAuthority).toBe('operatorGrant');
    expect(createRes.json.status).toBe('pending');
    expect(typeof createRes.json.registrationUrl).toBe('string');

    const connectionId = String(createRes.json.id);
    const { confirmPost } = await runAppDynamicRegistration(
      String(createRes.json.registrationUrl),
      dr.openidConfiguration,
      dr.registrationToken,
    );
    expectStatus(confirmPost, 200);
    expect(confirmPost.body).toContain(
      'Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code.',
    );

    const stagedConnRes = await app(s, 'GET', connPath(connectionId));
    expectStatus(stagedConnRes, 200);
    expect(stagedConnRes.json.status).toBe('pending');
    expect(stagedConnRes.json.bindingAuthority).toBe('operatorGrant');
    expect(stagedConnRes.json.platform?.clientId).toBe(dr.clientId);
    expect(stagedConnRes.json.platform?.deploymentIds).toEqual([dr.deploymentId]);
    const stagedPlatformId = String(stagedConnRes.json.platform.id);
    createdPlatformIds.push(stagedPlatformId);

    const target = {
      provider: CLOUD.provider,
      clientId: dr.clientId,
      deploymentId: dr.deploymentId,
      serviceHost: 'school-a.canvas.sim.test',
      pageHost: 'school-a.canvas.sim.test',
    };

    // 1. Before the grant, learner login is refused with 403 PLATFORM_NOT_ACTIVE
    const beforeGrant = await canvasLaunch(target);
    refused(beforeGrant.response, 'PLATFORM_NOT_ACTIVE', [403]);

    // 2. Issue operator grant and redeem it to activate the staged Canvas platform
    const grant = await canvasGrant(s, stagedConnRes.json, dr.clientId, dr.deploymentId);
    const redeemRes = await canvasRedeem(s, stagedConnRes.json, dr.clientId, dr.deploymentId, grant);
    expectStatus(redeemRes, 200);
    expect(redeemRes.json.status).toBe('registered');
    expect(redeemRes.json.platform.id).toBe(stagedPlatformId);

    const remoteAfter = await platformsFor(dr.clientId, CLOUD.issuer);
    expect(remoteAfter).toHaveLength(1);
    expect(remoteAfter[0].active).toBe(true);

    // 3. After grant redemption, learner launch passes (303 handoff with ltik)
    const afterGrant = await canvasLaunch(target);
    expect(afterGrant.response.status).toBe(303);
    expect(afterGrant.ltik.length).toBeGreaterThan(20);
  });

  it('[SIM] AC-LA-E3-09-04: configuration whose issuer is not the profile issuer, or with one endpoint that differs from the filled profile value, gives the refusal page with no platform row and no registration request at the simulator (AP-05-30) {case:LA-E3-09-04}', async () => {
    const s = await session('A');

    // (a) Configuration issuer differs from profile issuer
    const wrongIssuerDr = await createCanvasDrScenario('ac04-issuer', {
      issuer: 'https://wrong-canvas.sim.test',
    });
    const cursorA = (await records()).cursor;
    const connA = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA4 E3-09 Wrong Issuer'),
      lms: 'canvas',
      profile: CLOUD.profile,
      method: 'dynamic',
      siteUrl: CLOUD.siteA,
    });
    expectStatus(connA, 201);
    const resA = await runAppDynamicRegistration(
      String(connA.json.registrationUrl),
      wrongIssuerDr.openidConfiguration,
      wrongIssuerDr.registrationToken,
    );
    expect(resA.confirmPost.status).toBeGreaterThanOrEqual(400);
    expect(await platformsFor(wrongIssuerDr.clientId)).toEqual([]);
    const regRecsA = (await records(cursorA)).records.filter(
      (r: Json) => r.kind === 'registration' && r.clientId === wrongIssuerDr.clientId,
    );
    expect(regRecsA).toHaveLength(0);

    // (b) Configuration token_endpoint differs from filled profile value ({serviceUrl}/login/oauth2/token)
    const wrongEndpointDr = await createCanvasDrScenario('ac04-endpoint', {
      tokenEndpoint: 'https://school-a.canvas.sim.test/custom/oauth2/token',
    });
    const cursorB = (await records()).cursor;
    const startB = await httpsRequest(
      `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(wrongEndpointDr.openidConfiguration)}&registration_token=${encodeURIComponent(wrongEndpointDr.registrationToken)}`,
    );
    expect([200, 303]).toContain(startB.status);
    const locB = String(startB.headers.location ?? '');
    const regIdB =
      (/registration[_-]?id=([0-9a-fA-F-]{16,64})/i.exec(locB) ??
        /registrationId["'=:\s]+([0-9a-fA-F-]{16,64})/.exec(startB.body))?.[1] ?? '';
    expect(regIdB).not.toBe('');

    const completeB = await ltiApi('POST', `/api/registrations/${encodeURIComponent(regIdB)}/complete`, {
      authorization: auth.bearer(key),
      body: {
        platformName: `QA4 E3-09 Wrong Endpoint ${wrongEndpointDr.scenarioId}`,
        profile: CLOUD.profile,
        bindingRef: `bref-${wrongEndpointDr.scenarioId}`,
        scopes: [...FOUR_AGS_SCOPES],
      },
    });
    expect(completeB.status).toBe(400);
    expect(errorCode(completeB)).toBe('PLATFORM_URL_NOT_IN_PROFILE');
    expect(await platformsFor(wrongEndpointDr.clientId)).toEqual([]);
    const regRecsB = (await records(cursorB)).records.filter(
      (r: Json) => r.kind === 'registration' && r.clientId === wrongEndpointDr.clientId,
    );
    expect(regRecsB).toHaveLength(0);
  });

  it('[SIM] AC-LA-E3-09-05: live mixed-registry pre-fetch floor on GET /lti/register/:account refuses reserved issuer hosts with ISSUER_RESERVED and other reserved/own/rule-2 hosts with PLATFORM_URL_NOT_IN_PROFILE before any fetch {case:LA-E3-09-05}', async () => {
    const cursor0 = (await records()).cursor;

    // 1. Reserved issuer host -> 400 ISSUER_RESERVED (BD-A2-95 Option Y)
    const reservedIssRes = await httpsRequest(
      `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent('https://canvas.instructure.com/api/lti/security/openid-configuration')}&registration_token=tok`,
    );
    refused(reservedIssRes, 'ISSUER_RESERVED', [400]);

    // 2. Other reserved host (sso.canvaslms.com), own host, and rule-2 host (localhost) -> 400 PLATFORM_URL_NOT_IN_PROFILE
    for (const badUrl of [
      'https://sso.canvaslms.com/api/lti/security/openid-configuration',
      'https://sso.canvas.sim.test/api/lti/security/openid-configuration',
      `${urls.lti}/openid-configuration`,
      'https://localhost/openid-configuration',
    ]) {
      const res = await httpsRequest(
        `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(badUrl)}&registration_token=tok`,
      );
      refused(res, 'PLATFORM_URL_NOT_IN_PROFILE', [400]);
    }

    // 3. http URL and private IP literal -> guarded client FETCH_FAILED (502, BD-A2-94 Option A)
    for (const guardedUrl of [
      'http://school-a.canvas.sim.test/api/lti/security/openid-configuration',
      'https://127.0.0.1/openid-configuration',
    ]) {
      const res = await httpsRequest(
        `${urls.lti}/lti/register/${ACCOUNT}?openid_configuration=${encodeURIComponent(guardedUrl)}&registration_token=tok`,
      );
      refused(res, 'FETCH_FAILED', [502]);
    }

    const configFetches = (await records(cursor0)).records.filter((r: Json) => r.kind === 'openid-configuration');
    expect(configFetches).toHaveLength(0);
  });
});
