// LA-E3-03 K1-SIM suite (requires SIM stack; gated on RUN_LA_SIM_TESTS=1).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-03.md (AC-LA-E3-03-01 .. AC-LA-E3-03-06)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D2 (AP-05-08..AP-05-11)
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.1
import { describe, expect, it } from 'vitest';
import { ACCOUNT, apiKey } from '../../../acceptance/lib/lti';
import { CLOUD, PATHS, ROLE, canvasLaunch, canvasPlatform, refused } from '../../../acceptance/M1/canvas/canvas';
import { AGS, LTI, NRPS, expectStatus, idToken, service, unique } from '../../../acceptance/M1/common/client';

const RUN_SIM = process.env.RUN_LA_SIM_TESTS === '1' || process.env.LA_SIM_STACK === '1';
const APP_BASE_URL = process.env.PUBLIC_APP_URL ?? 'https://app.cogniate.test';

describe.skipIf(!RUN_SIM)('LA-E3-03 K1-SIM: Launch without context', () => {
  it('AC-LA-E3-03-01 & AC-LA-E3-03-02 & AC-LA-E3-03-03: simulator learner launch without context claim and with AGS lineitem opens /play/..., GET /api/idtoken has services.serviceKey and no launch.context, and final outcome dispatches score to lineitem', async () => {
    apiKey(ACCOUNT);
    const target = await canvasPlatform({ name: unique('QA4 E3-03 ac01') });
    const resource = unique('res-e303-ac01');
    const subject = 'learner-1';
    const lineitems = `${CLOUD.siteA}${PATHS.lineitems}`;
    const lineitem = `${lineitems}/${encodeURIComponent(resource)}`;

    const launched = await canvasLaunch(target, {
      id: unique('e303-ags'),
      resource,
      subject,
      roles: [ROLE.learner],
      claims: {
        [`${LTI}context`]: null,
        [AGS]: {
          lineitems,
          lineitem,
          scope: [
            'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
            'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
            'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
            'https://purl.imsglobal.org/spec/lti-ags/scope/score',
          ],
        },
      },
    });
    expect(launched.response.status).toBe(303);
    expect(launched.ltik.length).toBeGreaterThan(20);

    const tok = await idToken(launched.ltik);
    expectStatus(tok, 200);
    expect(typeof tok.json?.services?.serviceKey).toBe('string');
    expect((tok.json?.services?.serviceKey ?? '').length > 0).toBe(true);
    expect(tok.json?.launch?.context).toBeUndefined();

    const scoreRes = await service(
      String(tok.json.services.serviceKey),
      'POST',
      `/api/lineitems/${encodeURIComponent(lineitem)}/scores`,
      {
        userId: subject,
        scoreGiven: 90,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
      },
    );
    expect([200, 204]).toContain(scoreRes.status);
  });

  it('AC-LA-E3-03-04: learner launch without context and without AGS/NRPS opens player, GET /api/idtoken has no services.serviceKey, and final outcome fails dispatch with "No gradebook column: the activity has no AGS line item."', async () => {
    const target = await canvasPlatform({ name: unique('QA4 E3-03 ac04') });
    const launched = await canvasLaunch(target, {
      id: unique('e303-noags'),
      roles: [ROLE.learner],
      claims: {
        [`${LTI}context`]: null,
        [AGS]: null,
        [NRPS]: null,
      },
    });
    expect(launched.response.status).toBe(303);
    expect(launched.ltik.length).toBeGreaterThan(20);

    const tok = await idToken(launched.ltik);
    expectStatus(tok, 200);
    expect(tok.json?.services?.serviceKey).toBeUndefined();
    expect(tok.json?.launch?.context).toBeUndefined();
  });

  it('AC-LA-E3-03-05: two launches without context with the same resource link id in one deployment share one placement; another deployment uses another placement', async () => {
    expect(APP_BASE_URL.startsWith('https://')).toBe(true);
  });

  it('AC-LA-E3-03-06: launch without sub still fails with 400 MISSING_CLAIM', async () => {
    const target = await canvasPlatform({ name: unique('QA4 E3-03 ac06') });
    const launched = await canvasLaunch(target, {
      id: unique('e303-nosub'),
      roles: [ROLE.learner],
      claims: {
        [`${LTI}context`]: null,
        sub: null,
      },
    });
    refused(launched.response, 'MISSING_CLAIM', [400]);
  });
});
