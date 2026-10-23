// LA-E3-15 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E3-15.md, LA-ADR-05 D6, LA-IC-14,
// and BD-A1-106 / BD-A1-107).
//
// Covers:
// - AC-LA-E3-15-03 (K1-SIM): GET /app-api/lms-providers lists Canvas methods ["manual", "dynamic"], and a Canvas DR
//   on the Canvas simulator provider ends with complete answering active: false, the connection showing authority
//   operatorGrant and status pending, and a learner launch getting PLATFORM_NOT_ACTIVE.
// - AC-LA-E3-15-04 (K1-SIM): POST /app-api/connections {lms: "canvas", method: "dynamic", ...} gives 201 with
//   authority operatorGrant; app:grant issue refuses --accept-staged (bound_values_not_allowed, BD-A1-107); app:grant
//   issue without bound values and redemption activate the staged platform, and a learner launch and score pass.
import { describe, expect, it } from 'vitest';
import {
  APP,
  admin,
  app,
  cli,
  connPath,
  expectStatus,
  httpsRequest,
  parseForm,
  records,
  rememberSecret,
  session,
  sim,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';
import { commitGrade, publication, waitSync } from '../../../acceptance/M1/common/course';
import { CLOUD, canvasLaunch, canvasPlay, hostOf } from '../../../acceptance/M1/canvas/canvas';

describe('LA-E3-15 Canvas Dynamic Registration, staged with an operator grant (K1-SIM rows)', () => {
  let sharedState: {
    s: Json;
    connectionId: string;
    siteUrl: string;
    clientId: string;
    deploymentId: string;
    stagedPlatformId: string;
  } | null = null;

  it('AC-LA-E3-15-03: GET /app-api/lms-providers lists Canvas methods ["manual", "dynamic"], and Canvas DR stages platform with active: false while learner launch gets PLATFORM_NOT_ACTIVE', async () => {
    const s = await session('A');

    const providersRes = await app(s, 'GET', '/app-api/lms-providers');
    expectStatus(providersRes, 200);
    const providers = (providersRes.json.lms ?? providersRes.json.providers ?? providersRes.json) as Json[];
    const canvasProv = providers.find((p) => p.channel === 'canvas' || p.id === 'canvas' || p.lms === 'canvas');
    expect(canvasProv).toBeDefined();
    expect(canvasProv!.methods).toEqual(['manual', 'dynamic']);

    const siteUrl = CLOUD.siteA;
    const siteHost = hostOf(siteUrl);
    const clientId = unique('qa3-e315-canvas-dr');
    const deploymentId = 'deploy-canvas-dr-1';

    const createRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E3-15 Canvas DR'),
      lms: 'canvas',
      method: 'dynamic',
      profile: CLOUD.profile,
      siteUrl,
    });
    expectStatus(createRes, 201);
    expect(createRes.json.channel).toBe('canvas');
    expect(createRes.json.bindingAuthority).toBe('operatorGrant');
    expect(createRes.json.status).toBe('pending');
    expect(typeof createRes.json.registrationUrl).toBe('string');
    const connectionId = String(createRes.json.id);
    const registrationUrl = String(createRes.json.registrationUrl);

    const scenRes = await sim('/scenarios', 'POST', {
      id: unique('scen-e315-canvas-dr'),
      provider: CLOUD.provider,
      clientId,
      deploymentId,
      siteHost,
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
    expect(confirmPost.body).toContain(
      'Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code.',
    );

    const stagedConn = await app(s, 'GET', connPath(connectionId));
    expectStatus(stagedConn, 200);
    expect(stagedConn.json.status).toBe('pending');
    expect(stagedConn.json.bindingAuthority).toBe('operatorGrant');
    expect(stagedConn.json.platform?.clientId).toBe(clientId);
    expect(stagedConn.json.platform?.deploymentIds).toEqual([deploymentId]);
    const stagedPlatformId = String(stagedConn.json.platform.id);

    const pltRes = await admin('GET', `/api/platforms/${encodeURIComponent(stagedPlatformId)}`);
    expectStatus(pltRes, 200);
    expect(pltRes.json.active).toBe(false);

    // Learner launch against staged Canvas platform gets PLATFORM_NOT_ACTIVE
    const launchRes = await canvasLaunch({
      provider: CLOUD.provider,
      clientId,
      deploymentId,
      serviceHost: siteHost,
      pageHost: siteHost,
    });
    expect(launchRes.response.status).toBe(403);
    expect(launchRes.response.body).toContain('PLATFORM_NOT_ACTIVE');

    sharedState = { s, connectionId, siteUrl, clientId, deploymentId, stagedPlatformId };
  });

  it('AC-LA-E3-15-04: POST /app-api/connections {lms: "canvas", method: "dynamic"} stores operatorGrant, refuses --accept-staged (BD-A1-107), and grant redemption without bound values activates staged platform so learner launch and score pass', async () => {
    expect(sharedState, 'AC-LA-E3-15-03 must succeed first').not.toBeNull();
    const { s, connectionId, siteUrl, clientId, deploymentId, stagedPlatformId } = sharedState!;
    const siteHost = hostOf(siteUrl);

    // BD-A1-107: app:grant issue refuses --accept-staged on a fixed-endpoint staged Canvas connection
    const refusedStaged = await cli('app:grant', [
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
      '--accept-staged',
      '--note',
      'QA-3 BD-A1-107 negative',
    ]);
    expect(refusedStaged.code).not.toBe(0);
    expect(refusedStaged.stderr + refusedStaged.stdout).toContain('fixed endpoints');

    // Issue grant without bound values and redeem with { clientId, deploymentId, grantCode }
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
      'QA-3 AC-LA-E3-15-04',
    ]);
    expect(issueRes.code, issueRes.stderr || issueRes.stdout).toBe(0);
    const codeMatch = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/);
    expect(codeMatch).not.toBeNull();
    const grantCode = codeMatch![0];
    rememberSecret(grantCode);

    const redeemRes = await app(s, 'PUT', `${connPath(connectionId)}/platform`, {
      clientId,
      deploymentId,
      grantCode,
    });
    expectStatus(redeemRes, 200);
    expect(redeemRes.json.status).toBe('registered');
    expect(redeemRes.json.bindingAuthority).toBe('operatorGrant');
    expect(redeemRes.json.platform.id).toBe(stagedPlatformId);

    const pltRes = await admin('GET', `/api/platforms/${encodeURIComponent(stagedPlatformId)}`);
    expectStatus(pltRes, 200);
    expect(pltRes.json.active).toBe(true);

    // Learner launch and score pass
    const binding = {
      s,
      connection: redeemRes.json,
      clientId,
      deploymentId,
      provider: CLOUD.provider,
      serviceHost: siteHost,
      pageHost: siteHost,
    };
    const pub = await publication(binding, 'scorm12');
    const cursor = (await records()).cursor;
    const play = await canvasPlay(binding, pub);
    await commitGrade(play, 'scorm12', 9, 10);
    await waitSync(binding, pub, 'sent');
    const recs = (await records(cursor)).records;
    const scoreRec = recs.find((r: Json) => r.kind === 'score' && r.resource === pub.id);
    expect(scoreRec).toBeDefined();
    expect(scoreRec!.body.scoreGiven).toBe(9);
  });
});
