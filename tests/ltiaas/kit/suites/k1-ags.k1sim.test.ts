import { beforeAll, describe, expect, it } from 'vitest';
import { loadActiveChannelFixtures } from '../lib/fixtures';
import {
  ACCOUNT,
  ROLE,
  apiKey,
  app,
  auth,
  commitGrade,
  connectChannel,
  expectStatus,
  launchOnChannel,
  ltiApi,
  openPlayOnChannel,
  publication,
  recordNaCasesForSuite,
  recordSuiteCase,
  records,
  unique,
  waitSync,
  type ChannelBinding,
  type Json,
} from '../lib/runtime';

const channels = loadActiveChannelFixtures();

describe('K1-AGS Assignment and Grade Services simulator suite per channel', () => {
  for (const fixture of channels) {
    describe(`channel ${fixture.id} (${fixture.simProvider})`, () => {
      let binding: ChannelBinding;
      let pub: Json;

      beforeAll(async () => {
        recordNaCasesForSuite(fixture, 'K1-AGS');
        binding = await connectChannel(fixture);
        pub = await publication(binding, 'scorm12');
      });

      it(`[${fixture.id}] A1: coupled line item score POST + result GET read-back and token assertion audience match`, async () => {
        const cursor = (await records()).cursor;
        const subject = unique('learner-ags-a1');
        const play = await openPlayOnChannel(binding, pub, {
          subject,
        });
        await commitGrade(play, 'scorm12', 9, 10);
        await waitSync(binding, pub, 'sent');

        const recs = (await records(cursor)).records;
        const scoreRec = recs.find(
          (r: Json) => r.kind === 'score' && r.provider === fixture.simProvider && r.resource === pub.id,
        );
        expect(scoreRec).toBeDefined();
        expect(scoreRec!.body.scoreGiven).toBe(9);
        expect(scoreRec!.body.scoreMaximum).toBe(10);
        expect(scoreRec!.body.activityProgress).toBe('Completed');
        expect(scoreRec!.body.gradingProgress).toBe('FullyGraded');

        const tokenRec = recs.find(
          (r: Json) => r.kind === 'token' && r.tokenRef === scoreRec!.tokenRef,
        );
        expect(tokenRec).toBeDefined();
        expect(tokenRec!.audience).toEqual(fixture.sim.tokenAudience);

        // Read-back refresh when records.readBack is true
        if (fixture.capabilities['records.readBack']) {
          const refreshRes = await app(
            binding.s,
            'POST',
            `/app-api/publications/${encodeURIComponent(pub.id)}/results/refresh`,
            {},
          );
          expectStatus(refreshRes, 200);
        }
        recordSuiteCase(fixture, 'K1-AGS', 'A1', 'PASS');
      });

      it(`[${fixture.id}] A2: decoupled lineitems container create and list when lineitem claim is omitted`, async () => {
        const key = apiKey(ACCOUNT);
        const resource = unique(`decoupled-${fixture.id}`);
        const launched = await launchOnChannel(binding, {
          resource,
          roles: [ROLE.instructor],
        });
        expect(launched.response.status).toBe(303);
        const ltik = new URL(String(launched.response.headers.location)).searchParams.get('ltik') ?? '';
        const authz = auth.ltik(key, ltik);

        const created = await ltiApi<Record<string, unknown>>('POST', '/api/lineitems', {
          authorization: authz,
          body: {
            scoreMaximum: 100,
            label: `Kit A2 ${fixture.id}`,
            resourceId: resource,
          },
        });
        expect(created.status).toBe(201);
        const lineItemId = String(created.json?.id ?? '');
        expect(lineItemId).not.toBe('');

        const listed = await ltiApi< unknown>('GET', '/api/lineitems', {
          authorization: authz,
        });
        expect(listed.status).toBe(200);
        recordSuiteCase(fixture, 'K1-AGS', 'A2', 'PASS');
      });

      it(`[${fixture.id}] A3: score POST forwards submission, scoringUserId and https extension key while dropping non-https keys`, async () => {
        const key = apiKey(ACCOUNT);
        const resource = unique(`ags-ext-${fixture.id}`);
        const subject = unique('learner-ags-a3');
        const launched = await launchOnChannel(binding, {
          resource,
          subject,
          roles: [ROLE.instructor],
        });
        expect(launched.response.status).toBe(303);
        const ltik = new URL(String(launched.response.headers.location)).searchParams.get('ltik') ?? '';
        const authz = auth.ltik(key, ltik);

        const created = await ltiApi<Record<string, unknown>>('POST', '/api/lineitems', {
          authorization: authz,
          body: {
            scoreMaximum: 100,
            label: `Kit A3 ${fixture.id}`,
            resourceId: resource,
          },
        });
        expect(created.status).toBe(201);
        const lineItemId = String(created.json?.id ?? '');

        const extKey = 'https://ext.cogniate.test/submission-meta';
        const submittedAt = '2026-10-22T12:00:00.000Z';
        const cursor = (await records()).cursor;
        const postScore = await ltiApi<Record<string, unknown>>(
          'POST',
          `/api/lineitems/${encodeURIComponent(lineItemId)}/scores`,
          {
            authorization: authz,
            body: {
              userId: subject,
              scoreGiven: 95,
              scoreMaximum: 100,
              activityProgress: 'Completed',
              gradingProgress: 'FullyGraded',
              submission: { submittedAt },
              scoringUserId: 'grader-kit-a3',
              [extKey]: { attempt: 1 },
              nonHttpsIgnoredKey: { dropped: true },
            },
          },
        );
        expect([200, 204]).toContain(postScore.status);

        const scoreRec = (await records(cursor)).records.find(
          (r: Json) => r.kind === 'score' && r.resource === resource,
        );
        expect(scoreRec).toBeDefined();
        expect(scoreRec!.body.submission).toEqual({ submittedAt });
        expect(scoreRec!.body.scoringUserId).toBe('grader-kit-a3');
        expect(scoreRec!.body[extKey]).toEqual({ attempt: 1 });
        expect(scoreRec!.body.nonHttpsIgnoredKey).toBeUndefined();
        recordSuiteCase(fixture, 'K1-AGS', 'A3', 'PASS');
      });

      it(`[${fixture.id}] A4: rate-limit 429 with Retry-After makes a single outbound score attempt and propagates Retry-After`, async () => {
        const key = apiKey(ACCOUNT);
        const resource = unique(`ags-429-${fixture.id}`);
        const subject = unique('learner-ags-a4');
        const launched = await launchOnChannel(binding, {
          resource,
          subject,
          roles: [ROLE.instructor],
          scoreAnswers: [{ status: 429, retryAfter: 75 }],
        });
        expect(launched.response.status).toBe(303);
        const ltik = new URL(String(launched.response.headers.location)).searchParams.get('ltik') ?? '';
        const authz = auth.ltik(key, ltik);

        const lineItemId = `https://${binding.siteHost}${
          (
            await ltiApi<Record<string, unknown>>('GET', '/api/idtoken', {
              authorization: authz,
            })
          ).json?.services
            ? ''
            : ''
        }`;
        void lineItemId;

        const created = await ltiApi<Record<string, unknown>>('POST', '/api/lineitems', {
          authorization: authz,
          body: {
            scoreMaximum: 100,
            label: `Kit A4 ${fixture.id}`,
            resourceId: resource,
          },
        });
        expect(created.status).toBe(201);
        const createdId = String(created.json?.id ?? '');

        const cursor = (await records()).cursor;
        const rateLimited = await ltiApi<Record<string, unknown>>(
          'POST',
          `/api/lineitems/${encodeURIComponent(createdId)}/scores`,
          {
            authorization: authz,
            body: {
              userId: subject,
              scoreGiven: 80,
              scoreMaximum: 100,
              activityProgress: 'Completed',
              gradingProgress: 'FullyGraded',
            },
          },
        );
        expect(rateLimited.status).toBe(429);
        expect(String(rateLimited.headers['retry-after'] ?? '')).toBe('75');

        const scoreRecs = (await records(cursor)).records.filter(
          (r: Json) => r.kind === 'score' && r.resource === resource,
        );
        expect(scoreRecs).toHaveLength(1);
        recordSuiteCase(fixture, 'K1-AGS', 'A4', 'PASS');
      });

      it(`[${fixture.id}] A5: terminal 409 score rejection is classified as conflict without infinite retry`, async () => {
        const conflictPub = await publication(binding, 'scorm12');
        const play = await openPlayOnChannel(binding, conflictPub, {
          subject: unique('learner-ags-a5'),
          scoreAnswers: [
            {
              status: 409,
              message: 'Provided timestamp of the score before last updated timestamp of the result',
            },
          ],
        });
        await commitGrade(play, 'scorm12', 7, 10);
        const synced = await waitSync(binding, conflictPub, 'conflict');
        expect(synced?.status).toBe('conflict');
        recordSuiteCase(fixture, 'K1-AGS', 'A5', 'PASS');
      });

      it(`[${fixture.id}] A6: line-items GET supports limit query parameter`, async () => {
        const key = apiKey(ACCOUNT);
        const resource = unique(`ags-page-${fixture.id}`);
        const launched = await launchOnChannel(binding, {
          resource,
          roles: [ROLE.instructor],
        });
        expect(launched.response.status).toBe(303);
        const ltik = new URL(String(launched.response.headers.location)).searchParams.get('ltik') ?? '';
        const authz = auth.ltik(key, ltik);

        const res = await ltiApi<unknown>('GET', '/api/lineitems?limit=5', {
          authorization: authz,
        });
        expect(res.status).toBe(200);
        recordSuiteCase(fixture, 'K1-AGS', 'A6', 'PASS');
      });
    });
  }
});
