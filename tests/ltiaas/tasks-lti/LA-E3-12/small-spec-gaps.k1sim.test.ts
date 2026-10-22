// LA-E3-12 K1-SIM acceptance tests (requires SIM Docker stack).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-12.md (AC-LA-E3-12-01 .. AC-LA-E3-12-05)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D10
// - docs/architecture/ltiaas/adr/LA-ADR-07-security-and-tenancy.md D8
import { describe, expect, it } from 'vitest';
import { ACCOUNT, apiKey, auth, errorCode, hasErrorShape, ltiApi } from '../../../acceptance/lib/lti';
import { ROLE, canvasLaunch, canvasPlatform } from '../../../acceptance/M1/canvas/canvas';
import { LTI, unique } from '../../../acceptance/M1/common/client';

const NRPS_CLAIM = 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice';

describe('LA-E3-12 Small spec gaps (K1-SIM)', () => {
  it('[SIM] AC-LA-E3-12-01: score POST with scoreGiven: null (and no scoreMaximum) gives the same answer as POST without scoreGiven {case:LA-E3-12-01}', async () => {
    const key = apiKey(ACCOUNT);
    const target = await canvasPlatform({ name: unique('QA4 E3-12 ac01') });
    const launched = await canvasLaunch(target, {
      id: unique('ags-e3-12'),
      roles: [ROLE.instructor],
    });
    expect(launched.response.status).toBe(303);
    const authz = auth.ltik(key, launched.ltik);

    const createLi = await ltiApi<Record<string, unknown>>('POST', '/api/lineitems', {
      authorization: authz,
      body: {
        scoreMaximum: 100,
        label: 'QA4 E3-12 Null Score',
        resourceId: unique('res-e3-12'),
      },
    });
    expect(createLi.status).toBe(201);
    const lineItemId = String(createLi.json?.id ?? '');

    const withoutScore = await ltiApi<Record<string, unknown>>(
      'POST',
      `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
      {
        authorization: authz,
        body: {
          userId: 'learner-e3-12-absent',
          activityProgress: 'InProgress',
          gradingProgress: 'PendingManual',
        },
      },
    );
    const withNullScore = await ltiApi<Record<string, unknown>>(
      'POST',
      `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
      {
        authorization: authz,
        body: {
          userId: 'learner-e3-12-null',
          scoreGiven: null,
          activityProgress: 'InProgress',
          gradingProgress: 'PendingManual',
        },
      },
    );
    expect([200, 204].includes(withoutScore.status)).toBe(true);
    expect(withNullScore.status, 'scoreGiven: null gives same HTTP status as absent scoreGiven').toBe(
      withoutScore.status,
    );
  });

  it('[SIM] AC-LA-E3-12-02: GET /api/memberships with service_versions: ["1.0"] returns 403 SERVICE_NOT_AVAILABLE; without service_versions still answers {case:LA-E3-12-02}', async () => {
    const key = apiKey(ACCOUNT);
    const target = await canvasPlatform({ name: unique('QA4 E3-12 ac02') });

    // 1. service_versions: ["1.0"] -> 403 SERVICE_NOT_AVAILABLE
    const v1Launch = await canvasLaunch(target, {
      id: unique('nrps-v1'),
      roles: [ROLE.instructor],
      claims: {
        [NRPS_CLAIM]: {
          context_memberships_url: 'https://canvas.sim.test/api/lti/courses/101/names_and_roles',
          service_versions: ['1.0'],
        },
      },
    });
    expect(v1Launch.response.status).toBe(303);

    const v1Res = await ltiApi<Record<string, unknown>>('GET', '/api/memberships', {
      authorization: auth.ltik(key, v1Launch.ltik),
    });
    expect(v1Res.status).toBe(403);
    expect(hasErrorShape(v1Res.json, 403)).toBe(true);
    expect(errorCode(v1Res.json)).toBe('SERVICE_NOT_AVAILABLE');

    // 2. Claim without service_versions -> still answers
    const noVerLaunch = await canvasLaunch(target, {
      id: unique('nrps-nover'),
      roles: [ROLE.instructor],
      claims: {
        [NRPS_CLAIM]: {
          context_memberships_url: 'https://canvas.sim.test/api/lti/courses/101/names_and_roles',
        },
      },
    });
    expect(noVerLaunch.response.status).toBe(303);
    const noVerRes = await ltiApi<Record<string, unknown>>('GET', '/api/memberships', {
      authorization: auth.ltik(key, noVerLaunch.ltik),
    });
    expect(noVerRes.status !== 403, 'claim without service_versions does not fail with 403 SERVICE_NOT_AVAILABLE').toBe(
      true,
    );
  });

  it('[SIM] AC-LA-E3-12-03, AC-LA-E3-12-04 & AC-LA-E3-12-05: trustedAudiences on POST/PATCH /api/platforms and launch check 5 enforcement {case:LA-E3-12-03}', async () => {
    const key = apiKey(ACCOUNT);
    const adminAuth = auth.bearer(key);
    const target = await canvasPlatform({ name: unique('QA4 E3-12 ac03') });

    // Default trustedAudiences is []
    const getPlat = await ltiApi<Record<string, unknown>>(
      'GET',
      `/api/platforms/${encodeURIComponent(target.platformId)}`,
      { authorization: adminAuth },
    );
    expect(getPlat.status).toBe(200);
    expect(getPlat.json?.trustedAudiences).toEqual([]);

    // AC-LA-E3-12-05: single audience passes as before
    const singleAudLaunch = await canvasLaunch(target, {
      id: unique('aud-single'),
      roles: [ROLE.learner],
    });
    expect(singleAudLaunch.response.status).toBe(303);

    // AC-LA-E3-12-03 (a): aud = [clientId, "https://other.test"] with trustedAudiences = [] fails check 5
    const untrustedLaunch = await canvasLaunch(target, {
      id: unique('aud-untrusted'),
      roles: [ROLE.learner],
      claims: {
        aud: [target.clientId, 'https://other.test'],
        azp: target.clientId,
      },
    });
    expect(untrustedLaunch.response.status).toBe(400);

    // AC-LA-E3-12-04 & AC-LA-E3-12-03 (b): PATCH trustedAudiences = ["https://other.test"], then launch passes
    const patchPlat = await ltiApi<Record<string, unknown>>(
      'PATCH',
      `/api/platforms/${encodeURIComponent(target.platformId)}`,
      {
        authorization: adminAuth,
        body: { trustedAudiences: ['https://other.test'] },
      },
    );
    expect(patchPlat.status).toBe(200);
    expect(patchPlat.json?.trustedAudiences).toEqual(['https://other.test']);

    const trustedLaunch = await canvasLaunch(target, {
      id: unique('aud-trusted'),
      roles: [ROLE.learner],
      claims: {
        aud: [target.clientId, 'https://other.test'],
        azp: target.clientId,
        [`${LTI}version`]: '1.3.0',
      },
    });
    expect(trustedLaunch.response.status).toBe(303);
  });
});
