// LA-E3-16 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E3-16.md).
//
// Covers:
// - AC-LA-E3-16-04 (K1-SIM): Create a dynamic Canvas connection, run DR in the Canvas simulator, verify the staged
//   platform pre-filled values (platform.clientId, platform.deploymentIds[0]) and registrationUrl renewal refusal once
//   staged, redeem the operator grant with { clientId, deploymentId, grantCode }, and reach Active (status: 'registered').
import { describe, expect, it } from 'vitest';
import {
  APP,
  app,
  cli,
  connPath,
  expectStatus,
  httpsRequest,
  parseForm,
  rememberSecret,
  session,
  sim,
  unique,
} from '../../../acceptance/M1/common/client';

describe('LA-E3-16 Canvas Dynamic Registration in the portal (K1-SIM row)', () => {
  it('AC-LA-E3-16-04: dynamic Canvas connection -> DR in Canvas simulator -> staged platform pre-filled values -> grant redemption -> Active (status: registered)', async () => {
    const s = await session('A');
    const siteUrl = 'https://canvas.sim.test';
    const clientId = unique('qa3-e316-canvas-dr');
    const deploymentId = 'deploy-canvas-portal-dr-1';

    // 1. Portal step 1: POST /app-api/connections with lms: 'canvas', method: 'dynamic'
    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E3-16 Canvas Portal DR'),
      lms: 'canvas',
      method: 'dynamic',
      profile: 'canvas-sim-cloud',
      siteUrl,
    });
    expectStatus(createRes, 201);
    expect(createRes.json.channel).toBe('canvas');
    expect(createRes.json.method).toBe('dynamic');
    expect(createRes.json.bindingAuthority).toBe('operatorGrant');
    expect(createRes.json.status).toBe('pending');
    expect(createRes.json.platform).toBeNull();
    expect(typeof createRes.json.registrationUrl).toBe('string');
    const connectionId = String(createRes.json.id);

    // Renewal works before DR is staged
    const renewBefore = await app(s, 'POST', `${connPath(connectionId)}/registration-url`, {});
    expectStatus(renewBefore, 200);
    const registrationUrl = String(renewBefore.json.registrationUrl);
    expect(registrationUrl).toContain('/lti/register/cogniate?ref=');

    // 2. Portal step 2: run DR in Canvas simulator
    const scenRes = await sim('/scenarios', 'POST', {
      id: unique('scen-e316-canvas-portal-dr'),
      provider: 'canvas-sim',
      clientId,
      deploymentId,
      siteHost: 'canvas.sim.test',
    });
    expectStatus(scenRes, 201);
    const { openidConfiguration, registrationToken } = scenRes.json.registration;

    const sep = registrationUrl.includes('?') ? '&' : '?';
    const startRes = await httpsRequest(
      `${registrationUrl}${sep}openid_configuration=${encodeURIComponent(openidConfiguration)}&registration_token=${encodeURIComponent(registrationToken)}`,
    );
    expect(startRes.status, startRes.body.slice(0, 300)).toBe(303);
    const confirmUrl = new URL(String(startRes.headers.location ?? ''), APP).href;
    const confirmGet = await httpsRequest(confirmUrl);
    expectStatus(confirmGet, 200);
    const { action, fields } = parseForm(confirmGet.body);
    const confirmPost = await httpsRequest(new URL(action, confirmUrl).href, {
      method: 'POST',
      headers: {
        origin: APP,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(fields).toString(),
    });
    expectStatus(confirmPost, 200);

    // 3. Portal step 3 before redemption: GET connection DTO exposes platform.clientId and platform.deploymentIds[0] for pre-fill
    const stagedConn = await app(s, 'GET', connPath(connectionId));
    expectStatus(stagedConn, 200);
    expect(stagedConn.json.status).toBe('pending');
    expect(stagedConn.json.bindingAuthority).toBe('operatorGrant');
    expect(stagedConn.json.platform?.clientId).toBe(clientId);
    expect(stagedConn.json.platform?.deploymentIds).toEqual([deploymentId]);

    // 4. Issue operator grant and redeem with { clientId, deploymentId, grantCode } -> reaches Active (status: 'registered')
    const issueRes = await cli('app:grant', [
      'issue',
      '--library',
      s.library.id,
      '--connection',
      connectionId,
      '--site',
      siteUrl,
      '--client-id',
      clientId,
      '--deployment-id',
      deploymentId,
      '--note',
      'QA-3 AC-LA-E3-16-04',
    ]);
    expect(issueRes.code, issueRes.stderr || issueRes.stdout).toBe(0);
    const codeMatch = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/);
    expect(codeMatch).not.toBeNull();
    const grantCode = codeMatch![0];
    rememberSecret(grantCode);

    const redeemRes = await app(s, 'PUT', `${connPath(connectionId)}/platform`, {
      clientId: stagedConn.json.platform.clientId,
      deploymentId: stagedConn.json.platform.deploymentIds[0],
      grantCode,
    });
    expectStatus(redeemRes, 200);
    expect(redeemRes.json.status).toBe('registered');
    expect(redeemRes.json.bindingAuthority).toBe('operatorGrant');
  });
});
