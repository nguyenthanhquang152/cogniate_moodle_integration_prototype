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
  logEvents,
  records,
  rememberSecret,
  session,
  sharedPlatform,
  sim,
  unique,
  type Json,
} from '../../../acceptance/M1/common/client';
import { CLOUD, canvasBound } from '../../../acceptance/M1/canvas/canvas';
import { operatorApi, operatorAuth, readOperatorKey } from '../../tasks-ops/LA-E5-01/operator';

describe('LA-E6-01 Connection check (K1-SIM rows)', () => {
  let activeCanvasConnId = '';
  let bbPlatformId = '';
  let bbDepId = '';

  it('AC-LA-E6-01-01: On the Canvas simulator, a check of a correct connection gives 200 with result: "ok", details.jwks.ok: true and details.token.ok: true', async () => {
    const cv = await canvasBound('A');
    activeCanvasConnId = String(cv.connection.id);
    const scenRes = await sim('/scenarios', 'POST', {
      id: unique('scen-e601-ok'),
      provider: CLOUD.provider,
      clientId: cv.clientId,
      deploymentId: cv.deploymentId,
      siteHost: cv.serviceHost,
    });
    expectStatus(scenRes, 201);

    const okRes = await app(cv.s, 'POST', `${connPath(activeCanvasConnId)}/check`, {});
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
  });

  it('AC-LA-E6-01-03: A second check of the same connection within 60 s gives 429 RATE_LIMITED', async () => {
    const sA = await session('A');
    expect(activeCanvasConnId).not.toBe('');
    const secondRes = await app(sA, 'POST', `${connPath(activeCanvasConnId)}/check`, {});
    expectStatus(secondRes, 429, 'RATE_LIMITED');
  });

  it('AC-LA-E6-01-02: With the simulator token endpoint set to answer invalid_client, the check gives result: "failed", details.token.ok: false, details.token.detail: "invalid_client", and the connection status does not change', async () => {
    const cvBad = await canvasBound('A');
    const connId = String(cvBad.connection.id);
    const scenRes = await sim('/scenarios', 'POST', {
      id: unique('scen-e601-bad-client'),
      provider: CLOUD.provider,
      clientId: cvBad.clientId,
      deploymentId: cvBad.deploymentId,
      siteHost: cvBad.serviceHost,
      tokenAnswers: [{ status: 400, error: 'invalid_client', persistent: true }],
    });
    expectStatus(scenRes, 201);

    const badCheck = await app(cvBad.s, 'POST', `${connPath(connId)}/check`, {});
    expectStatus(badCheck, 200);
    expect(badCheck.json).toMatchObject({
      result: 'failed',
      details: {
        jwks: { ok: true },
        token: { ok: false, detail: 'invalid_client' },
      },
    });
    const afterConn = await app(cvBad.s, 'GET', connPath(connId));
    expectStatus(afterConn, 200);
    expect(afterConn.json.status).toBe('registered');
  });

  it('AC-LA-E6-01-04: A connection with a staged (inactive) platform gives 409 CONNECTION_NOT_READY from the app, and the simulator records no token request', async () => {
    const s = await session('A');
    const cursorBefore = (await records()).cursor;
    const canvasPending = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-01 Pending Canvas'),
      lms: 'canvas',
      method: 'manual',
      profile: CLOUD.profile,
      siteUrl: CLOUD.siteA,
    });
    expectStatus(canvasPending, 201);
    const pendingCheck = await app(s, 'POST', `${connPath(String(canvasPending.json.id))}/check`, {});
    expectStatus(pendingCheck, 409, 'CONNECTION_NOT_READY');
    const tokenRecs = (await records(cursorBefore)).records.filter((r: Json) => r.kind === 'token');
    expect(tokenRecs).toEqual([]);
  });

  it('AC-LA-E6-01-05: A channel without setup.connectionCheck gives 409 CAPABILITY_NOT_SUPPORTED with details.capability: "setup.connectionCheck"', async () => {
    const s = await session('A');
    bbPlatformId = await sharedPlatform();
    const bbConnRes = await app(s, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-01 BB'),
      lms: 'blackboard',
      method: 'manual',
      profile: 'blackboard-sim',
      siteUrl: 'https://learn-a.blackboard.sim.test',
    });
    expectStatus(bbConnRes, 201);
    const bbConnId = String(bbConnRes.json.id);

    const bbCheckRes = await app(s, 'POST', `${connPath(bbConnId)}/check`, {});
    expectStatus(bbCheckRes, 409, 'CAPABILITY_NOT_SUPPORTED');
    expect(bbCheckRes.json?.details?.capability).toBe('setup.connectionCheck');

    // Redeem a deployment on the Blackboard shared platform for AC-06 and AC-10
    bbDepId = unique('dep-e601-bb');
    const grantRes = await cli('app:grant', [
      'issue',
      '--library',
      s.library.id,
      '--connection',
      bbConnId,
      '--site',
      'https://learn-a.blackboard.sim.test',
      '--client-id',
      'qa-bb-app',
      '--deployment-id',
      bbDepId,
      '--note',
      'QA-3 AC-LA-E6-01-06',
    ]);
    expect(grantRes.code, grantRes.stderr || grantRes.stdout).toBe(0);
    const grantCode = grantRes.stdout.match(/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/)![0];
    rememberSecret(grantCode);
    const redeemBb = await app(s, 'PUT', `${connPath(bbConnId)}/platform`, {
      deploymentId: bbDepId,
      grantCode,
    });
    expectStatus(redeemBb, 200);
  });

  it('AC-LA-E6-01-06: POST /api/platforms/:id/check on the shared Blackboard-simulator platform gives limits: "shared-application"', async () => {
    expect(bbPlatformId).not.toBe('');
    expect(bbDepId).not.toBe('');
    const scenRes = await sim('/scenarios', 'POST', {
      id: unique('scen-e601-bb'),
      provider: 'blackboard-sim',
      clientId: 'qa-bb-app',
      deploymentId: bbDepId,
      siteHost: 'learn-a.blackboard.sim.test',
    });
    expectStatus(scenRes, 201);

    const ltiCheckRes = await admin('POST', `/api/platforms/${encodeURIComponent(bbPlatformId)}/check`, {
      deploymentId: bbDepId,
    });
    expectStatus(ltiCheckRes, 200);
    expect(ltiCheckRes.json.limits).toBe('shared-application');
    expect(ltiCheckRes.json.platform).toEqual({ active: true, deploymentActive: true });
    expect(ltiCheckRes.json.jwks?.ok).toBe(true);
    expect(ltiCheckRes.json.token?.ok).toBe(true);
  });

  it('AC-LA-E6-01-07: The check of another library connection gives 404 and makes no outbound call', async () => {
    const sB = await session('B');
    expect(activeCanvasConnId).not.toBe('');
    const cursorOther = (await records()).cursor;
    const otherRes = await app(sB, 'POST', `${connPath(activeCanvasConnId)}/check`, {});
    expectStatus(otherRes, 404);
    expect((await records(cursorOther)).records).toEqual([]);
  });

  it('AC-LA-E6-01-08: The platform_check and connection_check log lines hold token_result without any token or assertion value', async () => {
    const ltiLines = logEvents('platform_check', 0, {}, 'lti-service');
    const appLines = logEvents('connection_check', 0, {}, 'cogniate-app');
    expect(ltiLines.length).toBeGreaterThanOrEqual(2);
    expect(appLines.length).toBeGreaterThanOrEqual(2);
    for (const line of [...ltiLines, ...appLines]) {
      const raw = JSON.stringify(line);
      expect(raw).not.toContain('access_token');
      expect(raw).not.toContain('client_assertion');
      expect(raw).not.toContain('[REDACTED]');
      expect(line.token_result).toBeDefined();
    }
  });

  it('AC-LA-E6-01-10: Each LTI check writes one audit event platform.check with actor api_key:<key id> and no token value', async () => {
    const operatorKey = readOperatorKey();
    const auditRes = await operatorApi<{ events?: Json[] }>(
      'GET',
      '/operator/v1/audit?action=platform.check&limit=10',
      { authorization: operatorAuth(operatorKey) },
    );
    expect(auditRes.status).toBe(200);
    const events = auditRes.json?.events ?? [];
    expect(events.length).toBeGreaterThanOrEqual(2);
    const bbEvent = events.find((e) => e.target?.id === bbPlatformId);
    expect(bbEvent).toBeDefined();
    expect(bbEvent!.actor?.type).toBe('api_key');
    expect(typeof bbEvent!.actor?.id).toBe('string');
    expect(bbEvent!.details?.tokenResult).toBeDefined();
    expect(JSON.stringify(bbEvent)).not.toContain('access_token');
    expect(JSON.stringify(bbEvent)).not.toContain('[REDACTED]');
  });
});
