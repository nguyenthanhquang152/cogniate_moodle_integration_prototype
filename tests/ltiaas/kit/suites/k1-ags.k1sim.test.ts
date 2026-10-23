import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSelectedChannelFixtures } from '../lib/fixtures.js';
import {
  AGS,
  app,
  ChannelBinding,
  commitGrade,
  decodeJwt,
  endConnection,
  ensureKitRunInitialized,
  expectStatus,
  idToken,
  launchOnChannel,
  logEvents,
  noServiceCalls,
  openPlayOnChannel,
  publication,
  PublicationRef,
  records,
  results,
  ROLE_INSTRUCTOR,
  ROLE_LEARNER,
  runKitCase,
  service,
  setupChannelBinding,
  uniqueId,
  waitSync,
} from '../lib/runtime.js';

const fixtures = loadSelectedChannelFixtures();

describe('K1-AGS — Port 4 Assignment & Grade Services across selected channels', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  for (const fixture of fixtures) {
    describe(`channel: ${fixture.id}`, () => {
      let binding: ChannelBinding;
      let pub: PublicationRef;

      beforeAll(async () => {
        binding = await setupChannelBinding(fixture);
        pub = await publication(binding, 'scorm12');
      });

      afterAll(async () => {
        if (binding) {
          await endConnection(binding.session, binding.connection.id);
        }
      });

      it(`${fixture.id}:K1-AGS:A1 — Token request assertion aud by profile trait (string, array, or platformValue), iss = sub, unique jti, one scope per call, and records.readBack refresh`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A1', async () => {
          const cursor = (await records()).cursor;
          const learner = uniqueId(`learner-a1-${fixture.id}`);
          const play = await openPlayOnChannel(binding, pub, {
            roles: [ROLE_LEARNER],
            subject: learner,
          });
          // POST /play/:playId/scorm12/commit -> waitSync (M1/common/course.ts:58-85; cogniate-app-api.md §6.3)
          const commitRes = await commitGrade(play, 'scorm12', 9, 10);
          expect(commitRes.status).toBe(200);
          await waitSync(binding, pub, 'sent');

          // If records.readBack is true, trigger POST /app-api/publications/:id/results/refresh (cogniate-app-api-delta.md §6)
          if (fixture.capabilities['records.readBack']) {
            const refreshRes = await app(
              binding.session,
              'POST',
              `/app-api/publications/${pub.id}/results/refresh`,
              {},
            );
            expectStatus(refreshRes, 200);
            expect(refreshRes.json.refresh.status).toBe('ok');
          }

          const simRecs = await records(cursor);
          const tokenRecs = simRecs.records.filter(
            (r: Record<string, unknown>) => r.kind === 'token',
          );
          expect(tokenRecs.length).toBeGreaterThanOrEqual(1);

          const seenJtis = new Set<string>();
          for (const tr of tokenRecs) {
            const jwt = decodeJwt(tr.clientAssertion as string);
            const payload = jwt.payload as Record<string, unknown>;

            expect(payload.iss).toBe(binding.clientId);
            expect(payload.sub).toBe(binding.clientId);
            expect(typeof payload.jti).toBe('string');
            expect(seenJtis.has(payload.jti as string)).toBe(false);
            seenJtis.add(payload.jti as string);

            // Token audience shape matches profile trait (string, array, or fixed)
            if (fixture.sim.tokenAudienceKind === 'array') {
              expect(Array.isArray(payload.aud)).toBe(true);
              expect(payload.aud).toEqual(fixture.sim.tokenAudience);
            } else {
              expect(typeof payload.aud).toBe('string');
              expect(payload.aud).toBe(fixture.sim.tokenAudience);
            }

            // Exactly one scope per token call, and within registration.scopes
            const scopeStr = String(tr.scope ?? '').trim();
            const scopes = scopeStr.split(/\s+/).filter(Boolean);
            expect(scopes.length).toBe(1);
            expect(fixture.capabilities['registration.scopes']).toContain(scopes[0]);
          }
        });
      });

      it(`${fixture.id}:K1-AGS:A2 — Score body by ADR-010 mapping (scoreGiven, scoreMaximum, activityProgress, gradingProgress, submission.submittedAt, scoringUserId, https extension kept, non-https key dropped)`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A2', async () => {
          const launched = await launchOnChannel(binding, {
            resource: pub.id,
            roles: [ROLE_LEARNER],
            subject: uniqueId(`learner-a2-${fixture.id}`),
          });
          expect(launched.response.status).toBe(303);
          const tok = await idToken(launched.ltik!);
          expectStatus(tok, 200);
          const serviceKey = tok.json.services.ags.serviceKey as string;
          const lineitemUrl = tok.json.services.ags.lineitem as string;

          const cursor = (await records()).cursor;
          const submittedAt = new Date().toISOString();
          const extKey = 'https://cogniate.test/ext/attempt-meta';

          // POST /api/scores with SERVICE-AUTH-V1 (lti-service-api.md §4.2; lti-service-api-delta.md §1.2)
          const scoreRes = await service(serviceKey, 'POST', '/api/scores', {
            lineitemUrl,
            score: {
              userId: tok.json.user.id,
              scoreGiven: 85,
              scoreMaximum: 100,
              comment: 'Well done',
              timestamp: submittedAt,
              activityProgress: 'Completed',
              gradingProgress: 'FullyGraded',
              scoringUserId: 'grader-1',
              submission: {
                submittedAt,
              },
              [extKey]: { attempt: 1 },
              nonUrlExtensionKey: 'must-be-dropped',
            },
          });
          expectStatus(scoreRes, 200);
          expect(scoreRes.json.lmsStatus).toBe(204);

          const simRecs = await records(cursor);
          const scoreRec = simRecs.records.find(
            (r: Record<string, unknown>) => r.kind === 'score',
          );
          expect(scoreRec).toBeDefined();
          expect(scoreRec!.contentType).toContain(
            'application/vnd.ims.lis.v1.score+json',
          );
          expect(scoreRec!.body.userId).toBe(tok.json.user.id);
          expect(scoreRec!.body.scoreGiven).toBe(85);
          expect(scoreRec!.body.scoreMaximum).toBe(100);
          expect(scoreRec!.body.activityProgress).toBe('Completed');
          expect(scoreRec!.body.gradingProgress).toBe('FullyGraded');
          expect(scoreRec!.body.scoringUserId).toBe('grader-1');
          expect(scoreRec!.body.submission?.submittedAt).toBe(submittedAt);
          expect(scoreRec!.body[extKey]).toEqual({ attempt: 1 });
          expect(scoreRec!.body.nonUrlExtensionKey).toBeUndefined();
        });
      });

      it(`${fixture.id}:K1-AGS:A3 — AGS status mapping: 204 -> sent, 400/404/422 -> failed, 409 -> conflict with channel message, 503 -> retry, 429 Retry-After -> throttled with tries=0`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A3', async () => {
          // 1. 204 -> sent
          const pub204 = await publication(binding, 'scorm12');
          const learner204 = uniqueId('learner-a3-204');
          const play204 = await openPlayOnChannel(binding, pub204, {
            roles: [ROLE_LEARNER],
            subject: learner204,
          });
          await commitGrade(play204, 'scorm12', 10, 10);
          const rows204 = (await waitSync(binding, pub204, 'sent')) as Array<
            Record<string, unknown>
          >;
          const row204 = rows204.find(
            (r) => (r.learner as Record<string, unknown> | undefined)?.subject === learner204,
          );
          expect(row204).toBeDefined();
          const sync204 =
            (row204!.lastScoreSync as Record<string, unknown> | undefined) ??
            ((row204!.scoreSyncs as Array<Record<string, unknown>> | undefined)?.[0]);
          expect(sync204?.status).toBe('sent');

          // 2. 400, 404, 422 -> failed
          for (const errStatus of [400, 404, 422]) {
            const pubErr = await publication(binding, 'scorm12');
            const learnerErr = uniqueId(`learner-a3-${errStatus}`);
            const playErr = await openPlayOnChannel(binding, pubErr, {
              roles: [ROLE_LEARNER],
              subject: learnerErr,
              scoreAnswers: [errStatus],
            });
            await commitGrade(playErr, 'scorm12', 5, 10);
            const rowsErr = (await waitSync(binding, pubErr, 'failed')) as Array<
              Record<string, unknown>
            >;
            const rowErr = rowsErr.find(
              (r) =>
                (r.learner as Record<string, unknown> | undefined)?.subject === learnerErr,
            );
            expect(rowErr).toBeDefined();
            const syncErr =
              (rowErr!.lastScoreSync as Record<string, unknown> | undefined) ??
              ((rowErr!.scoreSyncs as Array<Record<string, unknown>> | undefined)?.[0]);
            expect(syncErr?.status).toBe('failed');
          }

          // 3. 409 -> conflict with channel message ("<Channel> has a grade with a newer time. Use the gradebook in <Channel> to change it.")
          const pub409 = await publication(binding, 'scorm12');
          const learner409 = uniqueId('learner-a3-409');
          const play409 = await openPlayOnChannel(binding, pub409, {
            roles: [ROLE_LEARNER],
            subject: learner409,
            scoreAnswers: [
              {
                status: 409,
                message: 'A grade with a newer timestamp already exists',
              },
            ],
          });
          await commitGrade(play409, 'scorm12', 6, 10);
          const rows409 = (await waitSync(binding, pub409, 'conflict')) as Array<
            Record<string, unknown>
          >;
          const row409 = rows409.find(
            (r) => (r.learner as Record<string, unknown> | undefined)?.subject === learner409,
          );
          expect(row409).toBeDefined();
          const sync409 =
            (row409!.lastScoreSync as Record<string, unknown> | undefined) ??
            ((row409!.scoreSyncs as Array<Record<string, unknown>> | undefined)?.[0]);
          expect(sync409?.status).toBe('conflict');
          expect(String(sync409?.lastError ?? '')).toContain(
            'has a grade with a newer time',
          );

          // 4. 503 -> pending retry (tries >= 1)
          const pub503 = await publication(binding, 'scorm12');
          const learner503 = uniqueId('learner-a3-503');
          const play503 = await openPlayOnChannel(binding, pub503, {
            roles: [ROLE_LEARNER],
            subject: learner503,
            scoreAnswers: [503],
          });
          await commitGrade(play503, 'scorm12', 7, 10);
          const rows503 = (await waitSync(binding, pub503, 'pending')) as Array<
            Record<string, unknown>
          >;
          const row503 = rows503.find(
            (r) => (r.learner as Record<string, unknown> | undefined)?.subject === learner503,
          );
          expect(row503).toBeDefined();
          const sync503 =
            (row503!.lastScoreSync as Record<string, unknown> | undefined) ??
            ((row503!.scoreSyncs as Array<Record<string, unknown>> | undefined)?.[0]);
          expect(sync503?.status).toBe('pending');
          expect(Number(sync503?.tries ?? 0)).toBeGreaterThanOrEqual(1);

          // 5. 429 with Retry-After: 60 -> throttled pending with tries === 0 and no immediate retry
          const pub429 = await publication(binding, 'scorm12');
          const learner429 = uniqueId('learner-a3-429');
          const since429 = Date.now();
          const cursor429 = (await records()).cursor;
          const play429 = await openPlayOnChannel(binding, pub429, {
            roles: [ROLE_LEARNER],
            subject: learner429,
            scoreAnswers: [{ status: 429, retryAfter: 60 }],
          });
          await commitGrade(play429, 'scorm12', 8, 10);

          let sync429: Record<string, unknown> | undefined;
          let throttleEvents: Array<Record<string, unknown>> = [];
          for (let i = 0; i < 20; i += 1) {
            const currentRows = (await results(binding, pub429)) as Array<
              Record<string, unknown>
            >;
            const row429 = currentRows.find(
              (r) =>
                (r.learner as Record<string, unknown> | undefined)?.subject === learner429,
            );
            sync429 =
              (row429?.lastScoreSync as Record<string, unknown> | undefined) ??
              ((row429?.scoreSyncs as Array<Record<string, unknown>> | undefined)?.[0]);
            throttleEvents = logEvents('dispatch_throttled', since429);
            if (sync429 && throttleEvents.length > 0) {
              break;
            }
            await new Promise((r) => setTimeout(r, 150));
          }
          expect(sync429).toBeDefined();
          expect(sync429?.status).toBe('pending');
          expect(sync429?.tries).toBe(0);
          expect(throttleEvents.length).toBeGreaterThanOrEqual(1);

          const recs429 = await records(cursor429);
          const scoreCalls429 = recs429.records.filter(
            (r: Record<string, unknown>) =>
              r.kind === 'score' &&
              (r.body as Record<string, unknown> | undefined)?.userId === learner429,
          );
          expect(scoreCalls429.length).toBe(1);
        });
      });

      it(`${fixture.id}:K1-AGS:A4 — Staff preview sends no score (scoreSyncs empty, 0 simulator score calls)`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A4', async () => {
          const previewPub = await publication(binding, 'scorm12');
          const staffPlay = await openPlayOnChannel(binding, previewPub, {
            roles: [ROLE_INSTRUCTOR],
            subject: uniqueId('staff-a4'),
          });
          const cursor = (await records()).cursor;
          const commitRes = await commitGrade(staffPlay, 'scorm12', 10, 10);
          expect(commitRes.status).toBe(200);

          const rows = await results(binding, previewPub);
          expect(rows).toEqual([]);
          await noServiceCalls(cursor);
        });
      });

      it(`${fixture.id}:K1-AGS:A5 — Disabled connection sends no score (pending outbox row marked CONNECTION_DISABLED, 0 simulator score calls)`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A5', async () => {
          const isShared = fixture.capabilities['platform.sharing'] === 'shared';
          const bTemp = await setupChannelBinding(fixture, {
            library: uniqueId(`lib-a5-${fixture.id}`),
            clientId: isShared ? binding.clientId : uniqueId(`c-a5-${fixture.id}`),
            deploymentId: uniqueId(`dep-a5-${fixture.id}`),
          });
          try {
            const pubTemp = await publication(bTemp, 'scorm12');
            const playTemp = await openPlayOnChannel(bTemp, pubTemp, {
              roles: [ROLE_LEARNER],
              subject: uniqueId('learner-a5'),
            });

            // Disconnect connection before committing grade (cogniate-app-api.md §4.9)
            const delRes = await app(
              bTemp.session,
              'DELETE',
              `/app-api/connections/${bTemp.connection.id}`,
            );
            expectStatus(delRes, 200);

            const cursor = (await records()).cursor;
            await commitGrade(playTemp, 'scorm12', 9, 10);

            const rows = (await waitSync(bTemp, pubTemp, 'failed')) as Array<
              Record<string, unknown>
            >;
            expect(rows.length).toBe(1);
            const syncRow =
              (rows[0].lastScoreSync as Record<string, unknown> | undefined) ??
              ((rows[0].scoreSyncs as Array<Record<string, unknown>> | undefined)?.[0]);
            expect(String(syncRow?.lastError ?? '')).toMatch(/disabled|disconnected/i);
            await noServiceCalls(cursor);
          } finally {
            await endConnection(bTemp.session, bTemp.connection.id);
          }
        });
      });

      it(`${fixture.id}:K1-AGS:A6 — Service URLs off the service origin refused at score and result endpoints (400 SERVICE_ORIGIN_MISMATCH / INVALID_AGS_ENDPOINT)`, async () => {
        await runKitCase(fixture.id, 'K1-AGS', 'A6', async () => {
          const launched = await launchOnChannel(binding, {
            resource: pub.id,
            roles: [ROLE_LEARNER],
            subject: uniqueId('learner-a6'),
          });
          expect(launched.response.status).toBe(303);
          const tok = await idToken(launched.ltik!);
          expectStatus(tok, 200);
          const serviceKey = tok.json.services.ags.serviceKey as string;

          const cursor = (await records()).cursor;
          const offOriginLineitem = 'https://evil-ags-origin.sim.test/ags/lineitems/1';

          // 1. POST /api/scores with off-origin lineitemUrl refused with 400 (lti-service-api-delta.md §7)
          const badScore = await service(serviceKey, 'POST', '/api/scores', {
            lineitemUrl: offOriginLineitem,
            score: {
              userId: tok.json.user.id,
              scoreGiven: 10,
              scoreMaximum: 10,
              timestamp: new Date().toISOString(),
              activityProgress: 'Completed',
              gradingProgress: 'FullyGraded',
            },
          });
          expect(badScore.status).toBe(400);
          expect(['SERVICE_ORIGIN_MISMATCH', 'INVALID_AGS_ENDPOINT']).toContain(
            badScore.json?.error?.code,
          );

          // 2. GET /api/results with off-origin lineitemUrl refused with 400
          const badResults = await service(
            serviceKey,
            'GET',
            `/api/results?lineitemUrl=${encodeURIComponent(offOriginLineitem)}`,
          );
          expect(badResults.status).toBe(400);
          expect(['SERVICE_ORIGIN_MISMATCH', 'INVALID_AGS_ENDPOINT']).toContain(
            badResults.json?.error?.code,
          );

          await noServiceCalls(cursor);
        });
      });
    });
  }
});
