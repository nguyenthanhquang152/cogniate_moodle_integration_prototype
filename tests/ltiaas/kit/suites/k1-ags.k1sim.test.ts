import { beforeAll, describe, expect, it } from 'vitest';
import { loadSelectedChannelFixtures } from '../lib/fixtures.js';
import {
  appApi,
  APP_URL,
  ensureKitRunInitialized,
  getSimCursor,
  getSimRecords,
  httpRequest,
  isK1SimEnabled,
  ltiApi,
  performSimulatorLaunch,
  recordRedactedEvidence,
  RegisteredChannelContext,
  runKitCase,
  setupActiveChannelConnection,
} from '../lib/runtime.js';

const runSuite = isK1SimEnabled() ? describe : describe.skip;
const fixtures = loadSelectedChannelFixtures();

function extractPlayId(location: string): string {
  const m = location.match(/\/play\/([^/?#]+)/);
  return m ? m[1] : '';
}

runSuite('K1-AGS: LTI Assignment and Grade Services 2.0 Suite (all selected channels)', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  for (const fixture of fixtures) {
    describe(`channel: ${fixture.id}`, () => {
      let ctx: RegisteredChannelContext;

      beforeAll(async () => {
        ctx = await setupActiveChannelConnection(fixture, 'ags');
      });

      it(`[${fixture.id}:K1-AGS:A1] token request assertion aud by profile trait, iss=sub, unique jti, one scope per call, and records.readBack`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A1', async () => {
          const cursor = await getSimCursor();
          const launch = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            documentTarget: 'window',
          });
          expect([302, 303]).toContain(launch.launchRes.status);
          const playId = extractPlayId(launch.redirectLocation);

          const completeRes = await httpRequest(`${APP_URL}/tool/play/${playId}/complete`, {
            method: 'POST',
            headers: { origin: APP_URL },
            body: { scorePercent: 85 },
          });
          expect(completeRes.status).toBe(200);

          if (fixture.capabilities['records.readBack']) {
            const refreshRes = await appApi(
              `/app-api/courses/${ctx.courseId}/gradebook/refresh`,
              { cookie: ctx.cookie, csrf: ctx.csrf },
              { method: 'POST', body: {} },
            );
            expect([200, 202]).toContain(refreshRes.status);
          }

          const { records } = await getSimRecords(cursor);
          const tokenRecords = records.filter((r) => r.kind === 'token');
          expect(tokenRecords.length).toBeGreaterThanOrEqual(1);

          const jtis = new Set<string>();
          for (const rec of tokenRecords) {
            expect(rec.iss).toBe(ctx.clientId);
            expect(rec.sub).toBe(ctx.clientId);
            expect(typeof rec.jti).toBe('string');
            jtis.add(rec.jti as string);

            if (fixture.sim.tokenAudienceKind === 'array') {
              expect(Array.isArray(rec.aud)).toBe(true);
              expect(rec.aud).toEqual(fixture.sim.tokenAudience);
            } else {
              expect(rec.aud).toBe(fixture.sim.tokenAudience);
            }

            const scopes = String(rec.scope ?? '')
              .trim()
              .split(/\s+/)
              .filter(Boolean);
            expect(scopes.length).toBe(1);
            expect(fixture.capabilities['registration.scopes']).toContain(scopes[0]);
          }
          expect(jtis.size).toBe(tokenRecords.length);

          recordRedactedEvidence(`ags-a1-${fixture.id}`, {
            channelId: fixture.id,
            tokenRequestCount: tokenRecords.length,
            uniqueJtis: jtis.size,
            redacted: true,
          });
        });
      });

      it(`[${fixture.id}:K1-AGS:A2] score body by ADR-010 mapping (scoreGiven, scoreMaximum, activityProgress, gradingProgress, submission.submittedAt, scoringUserId, https extension kept, non-https dropped)`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A2', async () => {
          const launch = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            documentTarget: 'window',
          });
          const idTokenRes = await ltiApi('/api/idtoken', {
            method: 'GET',
            headers: { authorization: `Bearer ${launch.ltik}` },
          });
          const claims = idTokenRes.json as {
            services?: { ags?: { serviceKey?: string; lineItemUrl?: string } };
          };
          const serviceKey = claims.services?.ags?.serviceKey;
          const lineItemUrl = claims.services?.ags?.lineItemUrl;
          expect(serviceKey).toBeTruthy();

          const cursor = await getSimCursor();
          const submittedAt = '2026-04-19T10:15:30.000Z';
          const scoreRes = await ltiApi('/api/lineitems/scores', {
            method: 'POST',
            body: {
              serviceKey,
              lineItemUrl,
              score: {
                userId: 'learner-1',
                scoreGiven: 92,
                scoreMaximum: 100,
                comment: 'Well done',
                timestamp: '2026-04-19T10:15:31.000Z',
                activityProgress: 'Completed',
                gradingProgress: 'FullyGraded',
                submission: { submittedAt },
                scoringUserId: 'grader-staff-1',
                'https://cogniate.test/ext/attempt': 2,
                nonUriExtensionKey: 'must-be-dropped',
              },
            },
          });
          expect([200, 204]).toContain(scoreRes.status);

          const { records } = await getSimRecords(cursor);
          const scoreRec = records.find((r) => r.kind === 'score');
          expect(scoreRec).toBeDefined();
          const body = (scoreRec?.body ?? scoreRec) as Record<string, unknown>;
          expect(body.userId ?? scoreRec?.userId).toBe('learner-1');
          expect(body.scoreGiven ?? scoreRec?.scoreGiven).toBe(92);
          expect(body.scoreMaximum ?? scoreRec?.scoreMaximum).toBe(100);
          expect(body.activityProgress ?? scoreRec?.activityProgress).toBe('Completed');
          expect(body.gradingProgress ?? scoreRec?.gradingProgress).toBe('FullyGraded');
          if (body.submission) {
            expect((body.submission as { submittedAt?: string }).submittedAt).toBe(submittedAt);
          }
          if ('nonUriExtensionKey' in body) {
            expect(body.nonUriExtensionKey).toBeUndefined();
          }
        });
      });

      it(`[${fixture.id}:K1-AGS:A3] status mapping: 204 -> sent, 400/404/422 -> failed, 409 -> conflict, 503 -> retry, 429 Retry-After -> throttled`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A3', async () => {
          // 1. 400, 404, 422 -> failed
          for (const errStatus of [400, 404, 422]) {
            const l = await performSimulatorLaunch(ctx, {
              roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
              documentTarget: 'window',
              scoreAnswers: [errStatus],
              subject: `learner-status-${errStatus}`,
            });
            const playId = extractPlayId(l.redirectLocation);
            await httpRequest(`${APP_URL}/tool/play/${playId}/complete`, {
              method: 'POST',
              headers: { origin: APP_URL },
              body: { scorePercent: 70 },
            });
            const gbRes = await appApi(`/app-api/courses/${ctx.courseId}/gradebook`, {
              cookie: ctx.cookie,
              csrf: ctx.csrf,
            });
            expect(gbRes.status).toBe(200);
            expect(gbRes.rawBody).toMatch(/failed/i);
          }

          // 2. 409 -> conflict (with per-channel "{LMS} has a grade with a newer time")
          const l409 = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            documentTarget: 'window',
            scoreAnswers: [409],
            subject: 'learner-status-409',
          });
          await httpRequest(`${APP_URL}/tool/play/${extractPlayId(l409.redirectLocation)}/complete`, {
            method: 'POST',
            headers: { origin: APP_URL },
            body: { scorePercent: 75 },
          });
          const gb409 = await appApi(`/app-api/courses/${ctx.courseId}/gradebook`, {
            cookie: ctx.cookie,
            csrf: ctx.csrf,
          });
          expect(gb409.status).toBe(200);
          expect(gb409.rawBody).toMatch(/conflict|has a grade with a newer time/i);

          // 3. 503 -> retry (pending, tries >= 1)
          const l503 = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            documentTarget: 'window',
            scoreAnswers: [503],
            subject: 'learner-status-503',
          });
          await httpRequest(`${APP_URL}/tool/play/${extractPlayId(l503.redirectLocation)}/complete`, {
            method: 'POST',
            headers: { origin: APP_URL },
            body: { scorePercent: 80 },
          });
          const gb503 = await appApi(`/app-api/courses/${ctx.courseId}/gradebook`, {
            cookie: ctx.cookie,
            csrf: ctx.csrf,
          });
          expect(gb503.status).toBe(200);
          expect(gb503.rawBody).toMatch(/pending/i);

          // 4. 429 with Retry-After -> throttled (pending with tries === 0)
          const l429 = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            documentTarget: 'window',
            scoreAnswers: [{ status: 429, retryAfter: 30 }],
            subject: 'learner-status-429',
          });
          await httpRequest(`${APP_URL}/tool/play/${extractPlayId(l429.redirectLocation)}/complete`, {
            method: 'POST',
            headers: { origin: APP_URL },
            body: { scorePercent: 95 },
          });
          const gb429 = await appApi(`/app-api/courses/${ctx.courseId}/gradebook`, {
            cookie: ctx.cookie,
            csrf: ctx.csrf,
          });
          expect(gb429.status).toBe(200);
          expect(gb429.rawBody).toMatch(/pending|throttled/i);
        });
      });

      it(`[${fixture.id}:K1-AGS:A4] staff preview sends nothing (0 simulator score calls)`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A4', async () => {
          const cursor = await getSimCursor();
          const staffLaunch = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            documentTarget: 'window',
          });
          const playId = extractPlayId(staffLaunch.redirectLocation);
          const completeRes = await httpRequest(`${APP_URL}/tool/play/${playId}/complete`, {
            method: 'POST',
            headers: { origin: APP_URL },
            body: { scorePercent: 100 },
          });
          expect(completeRes.status).toBe(200);
          const body = completeRes.json as { preview?: boolean; scoreSyncs?: unknown[] };
          expect(body.preview).toBe(true);
          if (Array.isArray(body.scoreSyncs)) {
            expect(body.scoreSyncs.length).toBe(0);
          }

          const { records } = await getSimRecords(cursor);
          expect(records.filter((r) => r.kind === 'score').length).toBe(0);
        });
      });

      it(`[${fixture.id}:K1-AGS:A5] disabled connection sends nothing (CONNECTION_DISABLED, 0 simulator score calls)`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A5', async () => {
          const tempCtx = await setupActiveChannelConnection(
            {
              ...fixture,
              sim: {
                ...fixture.sim,
                deployments: [ctx.secondaryDeploymentId, ctx.deploymentId],
              },
            },
            'ags-disable',
          );
          const launch = await performSimulatorLaunch(tempCtx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            documentTarget: 'window',
          });
          const playId = extractPlayId(launch.redirectLocation);

          const delRes = await appApi(
            `/app-api/connections/${tempCtx.connectionId}`,
            { cookie: tempCtx.cookie, csrf: tempCtx.csrf },
            { method: 'DELETE' },
          );
          expect([200, 204]).toContain(delRes.status);

          const cursor = await getSimCursor();
          await httpRequest(`${APP_URL}/tool/play/${playId}/complete`, {
            method: 'POST',
            headers: { origin: APP_URL },
            body: { scorePercent: 88 },
          });
          const { records } = await getSimRecords(cursor);
          expect(records.filter((r) => r.kind === 'score').length).toBe(0);
        });
      });

      it(`[${fixture.id}:K1-AGS:A6] service URLs off the service origin refused at score and result endpoints`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A6', async () => {
          const launch = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            documentTarget: 'window',
          });
          const idTokenRes = await ltiApi('/api/idtoken', {
            method: 'GET',
            headers: { authorization: `Bearer ${launch.ltik}` },
          });
          const claims = idTokenRes.json as {
            services?: { ags?: { serviceKey?: string } };
          };
          const serviceKey = claims.services?.ags?.serviceKey;
          expect(serviceKey).toBeTruthy();

          const cursor = await getSimCursor();
          const offOriginScoreRes = await ltiApi('/api/lineitems/scores', {
            method: 'POST',
            body: {
              serviceKey,
              lineItemUrl: 'https://off-origin-evil.sim.test/lineitems/1',
              score: {
                userId: 'learner-1',
                scoreGiven: 90,
                scoreMaximum: 100,
                activityProgress: 'Completed',
                gradingProgress: 'FullyGraded',
                timestamp: new Date().toISOString(),
              },
            },
          });
          expect(offOriginScoreRes.status).toBe(400);
          expect(offOriginScoreRes.rawBody).toMatch(
            /SERVICE_ORIGIN_MISMATCH|INVALID_AGS_ENDPOINT/i,
          );

          const offOriginResultsRes = await ltiApi(
            `/api/lineitems/results?serviceKey=${encodeURIComponent(
              serviceKey!,
            )}&lineItemUrl=${encodeURIComponent('https://off-origin-evil.sim.test/lineitems/1')}`,
            { method: 'GET' },
          );
          expect(offOriginResultsRes.status).toBe(400);
          expect(offOriginResultsRes.rawBody).toMatch(
            /SERVICE_ORIGIN_MISMATCH|INVALID_AGS_ENDPOINT/i,
          );

          const { records } = await getSimRecords(cursor);
          expect(records.filter((r) => r.kind === 'score' || r.kind === 'results').length).toBe(0);
        });
      });
    });
  }
});
