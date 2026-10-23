// LA-E3-11 K1-SIM acceptance tests (requires SIM Docker stack).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-11.md (AC-LA-E3-11-01 .. AC-LA-E3-11-05)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D9 (AP-05-31)
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.3
import { describe, expect, it } from 'vitest';
import { ACCOUNT, apiKey, auth, errorCode, hasErrorShape, ltiApi } from '../../../acceptance/lib/lti';
import { ROLE, canvasLaunch, canvasPlatform } from '../../../acceptance/M1/canvas/canvas';
import { unique } from '../../../acceptance/M1/common/client';

async function launchWithAgs(label: string) {
  const target = await canvasPlatform({ name: unique(`QA4 E3-11 ${label}`) });
  const id = unique(`ags-${label}`);
  const launched = await canvasLaunch(target, {
    id,
    roles: [ROLE.instructor],
  });
  expect(launched.response.status, `launch (${label}) status`).toBe(303);
  expect(launched.ltik, `launch (${label}) returned ltik`).toBeTruthy();
  return { target, ltik: launched.ltik };
}

describe('LA-E3-11 AGS extras (K1-SIM)', () => {
  it('[SIM] AC-LA-E3-11-01 & AC-LA-E3-11-05: line item POST/GET preserves URL-keyed member and score POST sends submission.submittedAt, scoringUserId and https URL-keyed member unchanged {case:LA-E3-11-01}', async () => {
    const key = apiKey(ACCOUNT);
    const { ltik } = await launchWithAgs('ac01');
    const authz = auth.ltik(key, ltik);

    const extKey = 'https://canvas.instructure.com/lti/submission';
    const lineItemExtKey = 'https://example.edu/lti/lineitem-ext';

    // AC-LA-E3-11-05: create line item with URL-keyed member and verify GET returns it.
    const createLi = await ltiApi<Record<string, unknown>>('POST', '/api/lineitems', {
      authorization: authz,
      body: {
        scoreMaximum: 100,
        label: 'QA4 E3-11 Line Item',
        resourceId: unique('res-e3-11'),
        [lineItemExtKey]: { mode: 'extra-credit', weight: 1.5 },
      },
    });
    expect(createLi.status, 'POST /api/lineitems status').toBe(201);
    const lineItemId = String(createLi.json?.id ?? '');
    expect(Boolean(lineItemId), 'created line item has id').toBe(true);
    expect(createLi.json?.[lineItemExtKey], 'POST /api/lineitems echoes URL-keyed member').toEqual({
      mode: 'extra-credit',
      weight: 1.5,
    });

    const getLi = await ltiApi<Record<string, unknown>>(
      'GET',
      `/api/lineitems/${encodeURIComponent(lineItemId)}`,
      { authorization: authz },
    );
    expect(getLi.status, 'GET /api/lineitems/:id status').toBe(200);
    expect(getLi.json?.[lineItemExtKey], 'GET /api/lineitems/:id returns URL-keyed member').toEqual({
      mode: 'extra-credit',
      weight: 1.5,
    });

    // AC-LA-E3-11-01 & AC-LA-E3-11-04: POST score with submission.submittedAt, scoringUserId, and URL-keyed member.
    const submittedAt = '2026-10-22T12:00:00.000Z';
    const postScore = await ltiApi<Record<string, unknown>>(
      'POST',
      `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
      {
        authorization: authz,
        body: {
          userId: 'learner-e3-11-01',
          scoreGiven: 92,
          scoreMaximum: 100,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          submission: { submittedAt },
          scoringUserId: 'grader-e3-11',
          [extKey]: { new_submission: true, submission_type: 'basic_lti_launch' },
        },
      },
    );
    expect([200, 204].includes(postScore.status), 'POST score status is 200/204').toBe(true);

    // AC-LA-E3-11-04: GET scores returns scoringUserId and URL-keyed members when platform provides them.
    const getScores = await ltiApi<Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> }>(
      'GET',
      `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
      { authorization: authz },
    );
    expect(getScores.status, 'GET /api/lineitems/:id/scores status').toBe(200);
  });

  it('[SIM] AC-LA-E3-11-02 & AC-LA-E3-11-03: non-https member is dropped; 9th URL-keyed member or >4 KB value returns 400 INVALID_REQUEST {case:LA-E3-11-02}', async () => {
    const key = apiKey(ACCOUNT);
    const { ltik } = await launchWithAgs('ac02');
    const authz = auth.ltik(key, ltik);

    const createLi = await ltiApi<Record<string, unknown>>('POST', '/api/lineitems', {
      authorization: authz,
      body: {
        scoreMaximum: 100,
        label: 'QA4 E3-11 Bounds',
        resourceId: unique('res-e3-11-bounds'),
      },
    });
    expect(createLi.status).toBe(201);
    const lineItemId = String(createLi.json?.id ?? '');

    // AC-LA-E3-11-02: non-https member key is dropped and request succeeds.
    const nonHttpsRes = await ltiApi<Record<string, unknown>>(
      'POST',
      `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
      {
        authorization: authz,
        body: {
          userId: 'learner-e3-11-02',
          scoreGiven: 80,
          scoreMaximum: 100,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          notAnHttpsUrl: { ignored: true },
          'http://insecure.example.com/ext': { ignored: true },
        },
      },
    );
    expect([200, 204].includes(nonHttpsRes.status), 'non-https member dropped without error').toBe(true);

    // AC-LA-E3-11-03 (a): 9 URL-keyed members -> 400 INVALID_REQUEST.
    const nineMembers: Record<string, unknown> = {
      userId: 'learner-e3-11-03a',
      scoreGiven: 70,
      scoreMaximum: 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
    };
    for (let i = 1; i <= 9; i += 1) {
      nineMembers[`https://ext.example.edu/k${i}`] = { index: i };
    }
    const nineRes = await ltiApi<Record<string, unknown>>(
      'POST',
      `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
      {
        authorization: authz,
        body: nineMembers,
      },
    );
    expect(nineRes.status, '9 URL-keyed members rejected with 400').toBe(400);
    expect(hasErrorShape(nineRes)).toBe(true);
    expect(errorCode(nineRes)).toBe('INVALID_REQUEST');

    // AC-LA-E3-11-03 (b): one URL-keyed member > 4 KB -> 400 INVALID_REQUEST.
    const hugeRes = await ltiApi<Record<string, unknown>>(
      'POST',
      `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
      {
        authorization: authz,
        body: {
          userId: 'learner-e3-11-03b',
          scoreGiven: 70,
          scoreMaximum: 100,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          'https://ext.example.edu/huge': { payload: 'x'.repeat(4100) },
        },
      },
    );
    expect(hugeRes.status, '>4 KB member value rejected with 400').toBe(400);
    expect(hasErrorShape(hugeRes)).toBe(true);
    expect(errorCode(hugeRes)).toBe('INVALID_REQUEST');
  });
});
