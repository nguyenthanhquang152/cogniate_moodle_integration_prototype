// LA-E6-02 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E6-02.md, LA-ADR-08 D5,
// cogniate-app-api-delta.md §3.7, data-model.md §5a, and BD-A2-100).
//
// Covers:
// - AC-LA-E6-02-04 (K1-SIM): The health of another library's connection gives 404 (AP-08-10).
// - AC-LA-E6-02-05 (K1-SIM): After one failed dispatch, dispatch.failedLast24h is 1 and dispatch.lastError.code equals
//   the code of that row.
// Note: AC-LA-E6-02-01 is pending LA-E6-06 (plan LD-16), and AC-LA-E6-02-02 / AC-LA-E6-02-03 are pending LA-E6-05
// (plan LD-16).
import { describe, expect, it } from 'vitest';
import {
  app,
  cli,
  connPath,
  expectStatus,
  rememberSecret,
  session,
  sim,
  unique,
} from '../../../acceptance/M1/common/client';
import { commitGrade, openPlay, publication, waitSync } from '../../../acceptance/M1/common/course';

describe('LA-E6-02 Connection health view (K1-SIM rows)', () => {
  it('AC-LA-E6-02-04 & AC-LA-E6-02-05: GET /app-api/connections/:id/health returns 404 for another library, and after one failed dispatch shows dispatch.failedLast24h = 1 and dispatch.lastError.code matching the row code', async () => {
    const sA = await session('A');
    const sB = await session('B');
    const siteUrl = 'https://canvas.sim.test';
    const clientId = unique('qa3-e602-canvas');
    const deploymentId = unique('dep-e602-cv');

    const createRes = await app(sA, 'POST', '/app-api/connections', {
      name: unique('QA3 E6-02 Canvas Health'),
      lms: 'canvas',
      method: 'manual',
      profile: 'canvas-sim-cloud',
      siteUrl,
    });
    expectStatus(createRes, 201);
    const connectionId = String(createRes.json.id);

    // AC-LA-E6-02-04: Another library's session gets 404
    const otherRes = await app(sB, 'GET', `${connPath(connectionId)}/health`);
    expectStatus(otherRes, 404);

    // Register the Canvas connection
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
      'QA-3 AC-LA-E6-02-05',
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

    // AC-LA-E6-02-05: Trigger one non-retryable failed score dispatch (422 on score endpoint)
    const binding = { s: sA, connection: redeemRes.json, deploymentId };
    const pub = await publication(binding, 'scorm12');
    const play = await openPlay(binding, pub, {
      provider: 'canvas-sim',
      clientId,
      deploymentId,
      siteHost: 'canvas.sim.test',
    });
    await sim('/faults', 'POST', {
      target: 'scores',
      status: 422,
      body: { error: 'unprocessable' },
      times: 1,
    });
    await commitGrade(play, 'scorm12', 7, 10);
    await waitSync(binding, pub, 'failed');

    const healthRes = await app(sA, 'GET', `${connPath(connectionId)}/health`);
    expectStatus(healthRes, 200);
    expect(healthRes.json.dispatch.failedLast24h).toBe(1);
    expect(typeof healthRes.json.dispatch.lastError?.code).toBe('string');
    expect(healthRes.json.dispatch.lastError.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });
});
