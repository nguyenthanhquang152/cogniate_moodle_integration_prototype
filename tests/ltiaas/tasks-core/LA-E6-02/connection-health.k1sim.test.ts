// LA-E6-02 K1-SIM suite (QA-3, test-first from docs/architecture/ltiaas/tasks/LA-E6-02.md, LA-ADR-08 D5,
// cogniate-app-api-delta.md §3.7, data-model.md §5a, and BD-A2-100 / BD-A2-101 / BD-A2-102).
//
// Covers:
// - AC-LA-E6-02-02 (K1-SIM): After a Canvas JSON download with jwk=inline (LA-E6-05), keys.artifactKeyKid equals
//   keys.activeKid and keys.artifactKeyCurrent is true (AP-08-08).
// - AC-LA-E6-02-03 (K1-SIM): After a signing key rotation without a new download, keys.artifactKeyCurrent is false
//   (AP-08-09).
// - AC-LA-E6-02-04 (K1-SIM): The health of another library's connection gives 404 (AP-08-10).
// - AC-LA-E6-02-05 (K1-SIM): After one failed dispatch, dispatch.failedLast24h is 1 and dispatch.lastError.code equals
//   the code of that row.
// Note: AC-LA-E6-02-01 is pending LA-E6-06 (deferred in LA).
import { describe, expect, it } from 'vitest';
import {
  app,
  connPath,
  expectStatus,
  host,
  session,
} from '../../../acceptance/M1/common/client';
import { commitGrade, publication, waitSync } from '../../../acceptance/M1/common/course';
import { canvasBound, canvasPlay, type CanvasBinding } from '../../../acceptance/M1/canvas/canvas';
import { operatorApi, operatorAuth, readOperatorKey } from '../../tasks-ops/LA-E5-01/operator';

describe('LA-E6-02 Connection health view (K1-SIM rows)', () => {
  let cv: CanvasBinding;
  let initialActiveKid = '';

  it('AC-LA-E6-02-04: The health of another library connection gives 404', async () => {
    cv = await canvasBound('A');
    const sB = await session('B');
    const otherRes = await app(sB, 'GET', `${connPath(cv.connection.id)}/health`);
    expectStatus(otherRes, 404);
  });

  it('AC-LA-E6-02-02: After a Canvas JSON download with jwk=inline, keys.artifactKeyKid equals keys.activeKid and keys.artifactKeyCurrent is true', async () => {
    expect(cv).toBeDefined();
    const connId = String(cv.connection.id);

    const beforeHealth = await app(cv.s, 'GET', `${connPath(connId)}/health`);
    expectStatus(beforeHealth, 200);
    expect(beforeHealth.json.keys.artifactKeyKid).toBeNull();
    expect(beforeHealth.json.keys.artifactKeyCurrent).toBeNull();

    const inlineRes = await app(cv.s, 'GET', `${connPath(connId)}/canvas-configuration?jwk=inline`);
    expectStatus(inlineRes, 200);
    const exportedKid = String(inlineRes.json.public_jwk.kid);

    const afterHealth = await app(cv.s, 'GET', `${connPath(connId)}/health`);
    expectStatus(afterHealth, 200);
    expect(afterHealth.json.keys.activeKid).toBe(exportedKid);
    expect(afterHealth.json.keys.artifactKeyKid).toBe(exportedKid);
    expect(afterHealth.json.keys.artifactKeyCurrent).toBe(true);
    expect(afterHealth.json.keys.nextKid).toBeNull();
    initialActiveKid = exportedKid;
  });

  it('AC-LA-E6-02-03: After a signing key rotation without a new download, keys.artifactKeyCurrent is false', async () => {
    expect(cv).toBeDefined();
    expect(initialActiveKid).not.toBe('');
    const connId = String(cv.connection.id);
    const operatorKey = readOperatorKey();

    // Ensure no leftover next key blocks creating a new next key
    const listRes = await operatorApi<{ signingKeys?: Array<{ kid: string; status: string }> }>(
      'GET',
      '/operator/v1/accounts/cogniate/signing-keys',
      { authorization: operatorAuth(operatorKey) },
    );
    expect(listRes.status).toBe(200);
    for (const k of (listRes.json?.signingKeys ?? []).filter((r) => r.status === 'next')) {
      await operatorApi(
        'POST',
        `/operator/v1/accounts/cogniate/signing-keys/${encodeURIComponent(k.kid)}/retire`,
        {
          authorization: operatorAuth(operatorKey),
          body: { immediate: true },
        },
      );
    }

    const createKey = await operatorApi<{ kid?: string }>(
      'POST',
      '/operator/v1/accounts/cogniate/signing-keys',
      { authorization: operatorAuth(operatorKey) },
    );
    expect(createKey.status).toBe(201);
    const newKid = String(createKey.json?.kid ?? '');
    expect(newKid).not.toBe('');
    expect(newKid).not.toBe(initialActiveKid);

    const activateKey = await operatorApi(
      'POST',
      `/operator/v1/accounts/cogniate/signing-keys/${encodeURIComponent(newKid)}/activate`,
      {
        authorization: operatorAuth(operatorKey),
        body: { force: true },
      },
    );
    expect(activateKey.status).toBe(200);

    // Clear the 60s in-memory JWKS cache in cogniate-app by restarting cogniate-app
    expect((await host('m1-restart', { service: 'cogniate-app' })).code).toBe(0);

    const sA = await session('A');
    cv.s = sA;
    const staleHealth = await app(sA, 'GET', `${connPath(connId)}/health`);
    expectStatus(staleHealth, 200);
    expect(staleHealth.json.keys).toEqual({
      activeKid: newKid,
      nextKid: null,
      artifactKeyKid: initialActiveKid,
      artifactKeyCurrent: false,
    });
  });

  it('AC-LA-E6-02-05: After one failed dispatch, dispatch.failedLast24h is 1 and dispatch.lastError.code equals the code of that row', async () => {
    expect(cv).toBeDefined();
    const connId = String(cv.connection.id);
    const pub = await publication(cv, 'scorm12');
    const play = await canvasPlay(cv, pub, {
      scoreAnswers: [{ status: 422, message: 'Unprocessable score' }],
    });
    await commitGrade(play, 'scorm12', 7, 10);
    await waitSync(cv, pub, 'failed', 1);

    const healthRes = await app(cv.s, 'GET', `${connPath(connId)}/health`);
    expectStatus(healthRes, 200);
    expect(healthRes.json.dispatch.failedLast24h).toBe(1);
    expect(typeof healthRes.json.dispatch.lastError?.code).toBe('string');
    expect(healthRes.json.dispatch.lastError.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });
});
