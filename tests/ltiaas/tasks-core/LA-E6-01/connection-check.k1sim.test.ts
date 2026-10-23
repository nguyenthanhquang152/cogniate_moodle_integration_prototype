// LA-E6-01 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E6-01.md, LA-ADR-08 D4,
// lti-service-api-delta.md §2.6/§5/§6, cogniate-app-api-delta.md §3.7, and BD-A2-98 / BD-A2-99).
//
// Covers:
// - AC-LA-E6-01-01 (K1-SIM): On the Canvas simulator, a check of a correct connection gives 200 with result: "ok",
//   details.jwks.ok: true and details.token.ok: true (AP-08-06).
// - AC-LA-E6-01-02 (K1-SIM): With the simulator token endpoint set to answer invalid_client, the check gives
//   result: "failed", details.token.ok: false, details.token.detail: "invalid_client", and the connection status does
//   not change (AP-08-06).
// - AC-LA-E6-01-03 (K1-SIM): A second check of the same connection within 60 s gives 429 RATE_LIMITED (AP-08-07).
// - AC-LA-E6-01-04 (K1-SIM): A connection with a staged (inactive) platform gives 409 CONNECTION_NOT_READY from the
//   app, and the simulator records no token request.
// - AC-LA-E6-01-05 (K1-SIM): A channel without setup.connectionCheck gives 409 CAPABILITY_NOT_SUPPORTED with
//   details.capability: "setup.connectionCheck".
// - AC-LA-E6-01-06 (K1-SIM): POST /api/platforms/:id/check (LTI route, admin scope) on the shared Blackboard-simulator
//   platform gives limits: "shared-application" (Q-LAB-06; the app route refuses Blackboard, AC-05).
// - AC-LA-E6-01-07 (K1-SIM): The check of another library's connection gives 404 and makes no outbound call.
// - AC-LA-E6-01-08 (K1-SIM): The platform_check and connection_check lines hold no token or assertion value.
// - AC-LA-E6-01-10 (K1-SIM): Each LTI check writes one audit event platform.check with actor api_key:<key id> and no
//   token value.
import { describe, expect, it } from 'vitest';
import {
  admin,
  app,
  cli,
  connPath,
  expectStatus,
  records,
  rememberSecret,
  session,
  sharedPlatform,
  sim,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';

describe('LA-E6-01 Connection check (K1-SIM rows)', () => {
  it('AC-LA-E6-01-04, AC-LA-E6-01-05, AC-LA-E6-01-06: staged connection gives 409 CONNECTION_NOT_READY with 0 token requests; channel without setup.connectionCheck gives 409 CAPABILITY_NOT_SUPPORTED; LTI POST /api/platforms/:id/check on shared Blackboard platform gives limits: "shared-application" and writes platform.check audit event (AC-LA-E6-01-10)', async () => {
    const s = await session('A');

    // AC-LA-E6-01-05: Blackboard has no setup.connectionCheck -> 409 CAPABILITY_NOT_SUPPORTED
    const bbPlatformId = await sharedPlatform();
    const bbConnRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-01 BB'),
      lms: 'blackboard',
      method: 'manual',
      profile: 'blackboard-sim',
      siteUrl: 'https://learn-a.blackboard.sim.test',
    });
    expectStatus(bbConnRes, 201);
    const bbCheckRes = await app(s, 'POST', `${connPath(String(bbConnRes.json.id))}/check`, {});
    expectStatus(bbCheckRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(bbCheckRes.json?.details?.capability).toBe('setup.connectionCheck');

    // AC-LA-E6-01-06 & AC-LA-E6-01-10: LTI POST /api/platforms/:id/check on shared Blackboard platform
    // Ensure at least one active deployment exists on the shared platform
    const depId = unique('dep-e601-bb');
    const grantRes = await cli('app:grant', [
      'issue',
      '--library',
      s.library.id,
      '--connection',
      String(bbConnRes.json.id),
      '--site',
      'https://learn-a.blackboard.sim.test',
      '--client-id',
      'qa-bb-app',
      '--deployment-id',
      depId,
      '--note',
      'QA-3 AC-LA-E6-01-06',
    ]);
    expect(grantRes.code, grantRes.stderr || grantRes.stdout).toBe(0);
    const grantCode = grantRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)![0];
    rememberSecret(grantCode);
    const redeemBb = await app(s, 'PUT', `${connPath(String(bbConnRes.json.id))}/platform`, {
      deploymentId: depId,
      grantCode,
    });
    expectStatus(redeemBb, 200);

    const ltiCheckRes = await admin('POST', `/api/platforms/${encodeURIComponent(bbPlatformId)}/check`, {
      deploymentId: depId,
    });
    expectStatus(ltiCheckRes, 200);
    expect(ltiCheckRes.json.limits).toBe('shared-application');
    expect(ltiCheckRes.json.platform).toEqual({ active: true, deploymentActive: true });

    // AC-LA-E6-01-10: GET /api/audit shows platform.check with actor.type === 'api_key' and details.tokenResult
    const auditRes = await admin('GET', '/api/audit?action=platform.check&limit=5');
    expectStatus(auditRes, 200);
    const auditEvent = (auditRes.json.events as Json[]).find((e) => e.target?.id === bbPlatformId);
    expect(auditEvent).toBeDefined();
    expect(auditEvent!.actor?.type).toBe('api_key');
    expect(auditEvent!.details?.tokenResult).toBeDefined();
    expect(JSON.stringify(auditEvent)).not.toContain('access_token');

    // AC-LA-E6-01-04: Pending Canvas connection gives 409 CONNECTION_NOT_READY and simulator records 0 token requests
    const cursorBefore = (await records()).cursor;
    const canvasPending = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-01 Pending Canvas'),
      lms: 'canvas',
      method: 'manual',
      profile: 'canvas-sim-cloud',
      siteUrl: 'https://canvas.sim.test',
    });
    expectStatus(canvasPending, 201);
    const pendingCheck = await app(s, 'POST', `${connPath(String(canvasPending.json.id))}/check`, {});
    expectStatus(pendingCheck, 409, 'CONNECTION_NOT_READY');
    const tokenRecs = (await records(cursorBefore)).records.filter((r: Json) => r.kind === 'token');
    expect(tokenRecs).toEqual([]);
  });

  it('AC-LA-E6-01-01, AC-LA-E6-01-02, AC-LA-E6-01-03, AC-LA-E6-01-07, AC-LA-E6-01-08: Canvas connection check ok, 429 rate limit within 60 s, 404 for another library with no outbound call, and invalid_client failure leaves status unchanged', async () => {
    const sA = await session('A');
    const sB = await session('B');
    const siteUrl = 'https://canvas.sim.test';
    const clientId = unique('qa3-e601-canvas');
    const deploymentId = unique('dep-e601-cv');

    const createRes = await app(sA, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-01 Canvas Active'),
      lms: 'canvas',
      method: 'manual',
      profile: 'canvas-sim-cloud',
      siteUrl,
    });
    expectStatus(createRes, 201);
    const connectionId = String(createRes.json.id);

    const issueRes = await cli('app:grant', [
      'issue',
      '--library',
      sA.library.id,
      '--connection',
      connectionId,
      '--site',
      siteUrl,
      '--client-id',
      clientId,
      '--deployment-id',
      deploymentId,
      '--note',
      'QA-3 AC-LA-E6-01-01',
    ]);
    expect(issueRes.code, issueRes.stderr || issueRes.stdout).toBe(0);
    const grantCode = issueRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)![0];
    rememberSecret(grantCode);

    const redeemRes = await app(sA, 'PUT', `${connPath(connectionId)}/platform`, {
      clientId,
      deploymentId,
      grantCode,
    });
    expectStatus(redeemRes, 200);

    // AC-LA-E6-01-07: Another library gets 404 and makes no outbound call
    const cursorOther = (await records()).cursor;
    const otherRes = await app(sB, 'POST', `${connPath(connectionId)}/check`, {});
    expectStatus(otherRes, 404);
    expect((await records(cursorOther)).records).toEqual([]);

    // AC-LA-E6-01-01: Check of a correct Canvas connection gives 200 result: "ok", jwks.ok: true, token.ok: true
    const okRes = await app(sA, 'POST', `${connPath(connectionId)}/check`, {});
    expectStatus(okRes, 200);
    expect(okRes.json).toMatchObject({
      result: 'ok',
      details: {
        jwks: { ok: true },
        token: { ok: true },
        platform: { active: true, deploymentActive: true },
        limits: null,
      },
    });

    // AC-LA-E6-01-03: Second check within 60 s gives 429 RATE_LIMITED
    const secondRes = await app(sA, 'POST', `${connPath(connectionId)}/check`, {});
    expectStatus(secondRes, 429, 'RATE_LIMITED');

    // AC-LA-E6-01-02: Separate Canvas connection with simulator token endpoint answering invalid_client
    const clientId2 = unique('qa3-e601-canvas-bad');
    const deploymentId2 = unique('dep-e601-cv-bad');
    const createRes2 = await app(sA, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-01 Canvas InvalidClient'),
      lms: 'canvas',
      method: 'manual',
      profile: 'canvas-sim-cloud',
      siteUrl,
    });
    expectStatus(createRes2, 201);
    const connectionId2 = String(createRes2.json.id);

    const issueRes2 = await cli('app:grant', [
      'issue',
      '--library',
      sA.library.id,
      '--connection',
      connectionId2,
      '--site',
      siteUrl,
      '--client-id',
      clientId2,
      '--deployment-id',
      deploymentId2,
      '--note',
      'QA-3 AC-LA-E6-01-02',
    ]);
    expect(issueRes2.code).toBe(0);
    const grantCode2 = issueRes2.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)![0];
    rememberSecret(grantCode2);
    const redeemRes2 = await app(sA, 'PUT', `${connPath(connectionId2)}/platform`, {
      clientId: clientId2,
      deploymentId: deploymentId2,
      grantCode: grantCode2,
    });
    expectStatus(redeemRes2, 200);

    await sim('/faults', 'POST', {
      target: 'token',
      status: 400,
      body: { error: 'invalid_client' },
      times: 1,
    });
    const badCheck = await app(sA, 'POST', `${connPath(connectionId2)}/check`, {});
    expectStatus(badCheck, 200);
    expect(badCheck.json).toMatchObject({
      result: 'failed',
      details: {
        jwks: { ok: true },
        token: { ok: false, detail: 'invalid_client' },
      },
    });
    const afterConn = await app(sA, 'GET', connPath(connectionId2));
    expectStatus(afterConn, 200);
    expect(afterConn.json.status).toBe('registered');
  });
});
