import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchRefused, runFamilyGuardCase, runPlatformStorageCase } from '../lib/cases.js';
import {
  collectContextlessPlacementObservation,
  loadAllChannelFixtures,
  loadSelectedChannelFixtures,
  PROTOCOL_SECURITY_FAULTS,
  selectProtocolControlFixture,
  verifyContextlessSharedPlacement,
} from '../lib/fixtures.js';
import {
  ACCOUNT,
  admin,
  APP_ORIGIN,
  AGS,
  app,
  appRequest,
  ChannelBinding,
  commitGrade,
  denied,
  endConnection,
  ensureKitRunInitialized,
  expectStatus,
  idToken,
  launchOnChannel,
  liveKitCaseIo,
  logEvents,
  LTI,
  newDeploymentId,
  noServiceCalls,
  NRPS,
  openPickerOnChannel,
  openPlayOnChannel,
  poll,
  publication,
  PublicationRef,
  records,
  results,
  ROLE_INSTRUCTOR,
  ROLE_LEARNER,
  runKitCase,
  setupChannelBinding,
  uniqueId,
  urls,
  waitSync,
} from '../lib/runtime.js';

const fixtures = loadSelectedChannelFixtures();
const allFixtures = loadAllChannelFixtures();

describe('K1-LAUNCH — Port 1 Launch & Session across selected channels', () => {
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

      it(`${fixture.id}:K1-LAUNCH:L1 — Valid resource-link launch -> ltik -> /api/idtoken fields and site/service origins`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L1', async () => {
          // 1. Valid resource-link launch -> 303 redirect with ltik (lti-service-api.md §2.1-2.2)
          const launched = await launchOnChannel(binding, {
            resource: pub.id,
          });
          expect(launched.response.status).toBe(303);
          expect(launched.ltik).toBeTruthy();

          // 2. GET /api/idtoken with LTIK-AUTH-V2 (lti-service-api.md §3.1; lti-service-api-delta.md §4.1)
          const token = await idToken(launched.ltik!);
          expectStatus(token, 200);
          const body = token.json;

          expect(body.ltiVersion).toBe('1.3.0');
          expect(body.user?.id).toBeTruthy();
          expect(Array.isArray(body.user?.roles)).toBe(true);
          expect(body.platform?.id).toBe(binding.platformId);
          expect(body.platform?.clientId).toBe(binding.clientId);
          expect(body.platform?.deploymentId).toBe(binding.deploymentId);
          expect(body.platform?.productFamilyCode).toBe(
            fixture.sim.family,
          );
          expect(body.platform?.siteUrl).toBe(fixture.sim.siteUrl);
          expect(body.platform?.profile).toBe(fixture.simProfile);
          expect(body.launch?.type).toBe('LtiResourceLinkRequest');
          expect(body.launch?.target).toContain(pub.id);
          expect(body.launch?.context?.id).toBeTruthy();
          expect(body.launch?.resourceLink?.id).toBeTruthy();
          expect(body.services?.serviceKey).toBeTruthy();

          // 3. Site and service origin verification when site.serviceOrigin is true
          if (fixture.capabilities['site.serviceOrigin']) {
            expect(body.platform?.serviceUrl).toBe(fixture.sim.serviceUrl);
            expect(body.services?.assignmentAndGrades?.lineItemId).toContain(
              fixture.sim.serviceUrl,
            );
          }
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L2 — Profile-dependent faults unknown-key and wrong-issuer`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L2', async () => {
          // 1. Profile-dependent fault: unknown-key -> 400 INVALID_SIGNATURE
          const cursor1 = (await records()).cursor;
          const unknownKeyRes = await launchOnChannel(binding, {
            resource: pub.id,
            fault: 'unknown-key',
          });
          launchRefused(unknownKeyRes.response, 'INVALID_SIGNATURE');
          await noServiceCalls(cursor1);

          // 2. Profile-dependent fault: wrong-issuer -> 400 INVALID_ISSUER_OR_AUDIENCE
          const cursor2 = (await records()).cursor;
          const wrongIssRes = await launchOnChannel(binding, {
            resource: pub.id,
            fault: 'wrong-issuer',
          });
          launchRefused(wrongIssRes.response, 'INVALID_ISSUER_OR_AUDIENCE');
          await noServiceCalls(cursor2);
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L3 — Unknown deployment code refused with UNKNOWN_DEPLOYMENT and inactive deployment refused with DEPLOYMENT_NOT_ACTIVE`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L3', async () => {
          // 1. Unregistered deployment -> UNKNOWN_DEPLOYMENT (lti-service-api.md §2.1, §2.2)
          const cursor1 = (await records()).cursor;
          const unknownDep = await launchOnChannel(binding, {
            resource: pub.id,
            deploymentId: newDeploymentId(fixture, 'unregistered-dep'),
          });
          denied(unknownDep.response, 'UNKNOWN_DEPLOYMENT');
          await noServiceCalls(cursor1);

          // 2. Inactive deployment -> 403 DEPLOYMENT_NOT_ACTIVE (lti-service-api.md §3.7)
          const inactiveDepId = newDeploymentId(fixture, 'inactive-dep');
          const addDep = await admin(
            'POST',
            `/api/platforms/${binding.platformId}/deployments`,
            {
              deploymentId: inactiveDepId,
              ...(fixture.capabilities['platform.sharing'] === 'shared'
                ? { siteUrl: fixture.sim.siteUrl }
                : {}),
            },
          );
          expectStatus(addDep, 201);
          const patchDep = await admin(
            'PATCH',
            `/api/platforms/${binding.platformId}/deployments/${encodeURIComponent(inactiveDepId)}`,
            { active: false },
          );
          expectStatus(patchDep, 200);

          const cursor2 = (await records()).cursor;
          const inactiveRes = await launchOnChannel(binding, {
            resource: pub.id,
            deploymentId: inactiveDepId,
          });
          denied(inactiveRes.response, 'DEPLOYMENT_NOT_ACTIVE', 403);
          await noServiceCalls(cursor2);
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L4 — Signed product family of another channel: launch-guarded family refused (400 PROVIDER_PROFILE_MISMATCH); registration-guarded family refused on standard or logged as family_guard_mismatch`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L4', async () => {
          // Probes and expected outcomes come from the declared guard levels of all fixtures
          // (expect.guardedFamilies; LA-ADR-01 D6) before any launch is sent (lib/cases.ts).
          const report = await runFamilyGuardCase(
            {
              target: fixture,
              allFixtures,
              platformId: binding.platformId,
              resourceId: pub.id,
            },
            { ...liveKitCaseIo(), launch: (patch) => launchOnChannel(binding, patch) },
          );
          expect(report.probes.length).toBeGreaterThanOrEqual(2);
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L5 — Claim policy: name, given_name, family_name, email, custom, and lis kept or dropped by privacyFloor; launch_claims_minimized logged`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L5', async () => {
          const since = Date.now();
          const piiMarker = uniqueId('PII');
          const launched = await launchOnChannel(binding, {
            resource: pub.id,
            claims: {
              name: piiMarker,
              given_name: piiMarker,
              family_name: piiMarker,
              email: `${piiMarker}@example.test`,
              [`${LTI}custom`]: { section: 'A1' },
              [`${LTI}lis`]: {
                person_sourcedid: 'sis-person-1',
                course_section_sourcedid: 'sis-course-1',
              },
            },
          });
          expect(launched.response.status).toBe(303);
          const raw = await idToken(launched.ltik!, true);
          expectStatus(raw, 200);
          const token = await idToken(launched.ltik!);
          expectStatus(token, 200);

          if (fixture.sim.privacyFloor === 'allowlist') {
            expect(JSON.stringify(raw.json).includes(piiMarker)).toBe(false);
            expect(token.json.user?.name).toBeUndefined();
            expect(token.json.user?.givenName).toBeUndefined();
            expect(token.json.user?.familyName).toBeUndefined();
            expect(token.json.user?.email).toBeUndefined();
            expect(token.json.launch?.custom).toEqual({});
            const minLogs = logEvents(
              'launch_claims_minimized',
              since,
              { platform_id: binding.platformId },
              'lti-service',
            );
            expect(minLogs.length).toBeGreaterThanOrEqual(1);
          } else {
            expect(token.json.user?.name).toBe(piiMarker);
            expect(token.json.launch?.custom).toEqual({ section: 'A1' });
          }
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L6 — Document target: iframe -> /play/:playId/embedded (auto-continues only when launch.topLevelContinue is true); window -> /play/:playId`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L6', async () => {
          // 1. document_target: 'iframe' -> /play/:playId/embedded (cogniate-app-api-delta.md §8)
          const iframeLaunch = await launchOnChannel(binding, {
            resource: pub.id,
            claims: {
              [`${LTI}launch_presentation`]: { document_target: 'iframe' },
            },
          });
          expect(iframeLaunch.response.status).toBe(303);
          const iframeHandoff = await appRequest('GET', iframeLaunch.location, {
            headers: { accept: 'text/html' },
          });
          expect(iframeHandoff.status).toBe(303);
          // The handoff Location may be absolute; compare its path (resolved against the app origin, as M1 openPlay does)
          const embeddedTarget = new URL(String(iframeHandoff.headers.location ?? ''), APP_ORIGIN).href;
          expect(new URL(embeddedTarget).pathname).toMatch(/^\/play\/ply_[^/?]+\/embedded$/);

          const embeddedPage = await appRequest('GET', embeddedTarget, {
            headers: { accept: 'text/html' },
          });
          expect(embeddedPage.status).toBe(200);
          expect(embeddedPage.text).toContain('Open in a new window');
          if (fixture.capabilities['launch.topLevelContinue']) {
            expect(/<script\b/i.test(embeddedPage.text)).toBe(true);
          } else {
            expect(/<script\b/i.test(embeddedPage.text)).toBe(false);
          }

          // 2. document_target: 'window' -> /play/:playId
          const windowLaunch = await launchOnChannel(binding, {
            resource: pub.id,
            claims: {
              [`${LTI}launch_presentation`]: { document_target: 'window' },
            },
          });
          expect(windowLaunch.response.status).toBe(303);
          const windowHandoff = await appRequest('GET', windowLaunch.location, {
            headers: { accept: 'text/html' },
          });
          expect(windowHandoff.status).toBe(303);
          const windowTarget = new URL(String(windowHandoff.headers.location ?? ''), APP_ORIGIN).pathname;
          expect(windowTarget).toMatch(/^\/play\/ply_[^/?]+$/);
          expect(windowTarget).not.toContain('/embedded');
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L7 — Launch without context (AP-05-08..11): player opens, AGS lineitem dispatches score, without AGS has no serviceKey and fails dispatch with clear message, same resourceLinkId shares placement, no sub -> 400 MISSING_CLAIM`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L7', async () => {
          const ctxlessPub = await publication(binding, 'scorm12');
          const sharedRlId = uniqueId(`rl-ctxless-${fixture.id}`);
          const learner1 = uniqueId('learner-ctxless-1');
          const learner2 = uniqueId('learner-ctxless-2');
          const cursorBeforeL7 = (await records()).cursor;

          // 1. AP-05-08 & AP-05-09: Launch without context claim + with AGS lineitem opens player and dispatches score
          const play1 = await openPlayOnChannel(binding, ctxlessPub, {
            omit: [`${LTI}context`],
            resourceLinkId: sharedRlId,
            subject: learner1,
          });
          expect(play1.playId).toBeTruthy();

          const commit1 = await commitGrade(play1, 'scorm12', 8, 10);
          expect(commit1.status).toBe(200);
          await waitSync(binding, ctxlessPub, 'sent');

          // 2. AP-05-11: Second learner without context on the same resourceLinkId shares the placement
          const play2 = await openPlayOnChannel(binding, ctxlessPub, {
            omit: [`${LTI}context`],
            resourceLinkId: sharedRlId,
            subject: learner2,
          });
          const commit2 = await commitGrade(play2, 'scorm12', 9, 10);
          expect(commit2.status).toBe(200);

          // Poll until each learner's own row has a sent sync (no unqualified waitSync)
          const rowsAfterBoth = await poll(
            async () => results(binding, ctxlessPub),
            (rows) =>
              [learner1, learner2].every((sub) =>
                rows.some(
                  (r) =>
                    r.learner?.sub === sub &&
                    (r.scoreSyncs ?? []).some((s: { status?: string }) => s.status === 'sent'),
                ),
              ),
            20_000,
          );

          // One placement: the publication's resource links (GET /app-api/publications/:id
          // stats.activities, cogniate-app-api.md §5), read before the no-AGS launches below.
          const pubDto = await app(binding.session, 'GET', `/app-api/publications/${ctxlessPub.id}`);
          expectStatus(pubDto, 200);

          // The only final comparison: rows name one internal placement (`activity.resourceLinkId`,
          // never compared with the launch resource_link.id), one row per learner, one placement,
          // sent syncs, and each score call goes to that learner's launch line item.
          const placementCheck = verifyContextlessSharedPlacement(
            collectContextlessPlacementObservation({
              rows: rowsAfterBoth,
              publication: pubDto.json,
              idToken1: play1.token,
              idToken2: play2.token,
              simRecords: (await records(cursorBeforeL7)).records,
              learner1,
              learner2,
              publicationId: ctxlessPub.id,
            }),
          );
          expect(placementCheck.errors).toEqual([]);
          expect(placementCheck.ok).toBe(true);

          // 3. AP-05-10: Launch without context and without AGS (and without NRPS, so the service key rule of
          // lti-service-api.md §3.1 "when AGS or NRPS is available" gives none) records the clear error message
          const noAgsRlId = uniqueId(`rl-noags-${fixture.id}`);
          const learnerNoAgs = uniqueId('learner-ctxless-noags');
          const noAgsLaunch = await launchOnChannel(binding, {
            resource: ctxlessPub.id,
            omit: [`${LTI}context`, AGS, NRPS],
            resourceLinkId: noAgsRlId,
            subject: learnerNoAgs,
          });
          expect(noAgsLaunch.response.status).toBe(303);
          const noAgsToken = await idToken(noAgsLaunch.ltik!);
          expectStatus(noAgsToken, 200);
          expect(noAgsToken.json.launch?.context).toBeUndefined();
          expect(noAgsToken.json.services?.serviceKey).toBeUndefined();
          expect(
            noAgsToken.json.services?.assignmentAndGrades?.available,
          ).toBe(false);

          const cursorBeforeNoAgsCommit = (await records()).cursor;
          const playNoAgs = await openPlayOnChannel(binding, ctxlessPub, {
            omit: [`${LTI}context`, AGS, NRPS],
            resourceLinkId: noAgsRlId,
            subject: learnerNoAgs,
          });
          const commitNoAgs = await commitGrade(playNoAgs, 'scorm12', 7, 10);
          expect(commitNoAgs.status).toBe(200);

          const noAgsRows = await poll(
            async () =>
              (await results(binding, ctxlessPub)) as Array<{
                learner?: { sub?: string };
                scoreSyncs?: Array<{ status?: string; lastError?: string }>;
              }>,
            (rows) => {
              const row = rows.find((r) => r.learner?.sub === learnerNoAgs);
              return Boolean(row?.scoreSyncs?.[0]?.lastError);
            },
            20_000,
          );
          const noAgsRow = noAgsRows.find(
            (r) => r.learner?.sub === learnerNoAgs,
          );
          const noAgsSync = noAgsRow?.scoreSyncs?.[0];
          expect(noAgsSync).toBeDefined();
          expect(noAgsSync?.lastError).toBe(
            'No gradebook column: the activity has no AGS line item.',
          );
          await noServiceCalls(cursorBeforeNoAgsCommit);

          // 4. Launch without sub -> 400 MISSING_CLAIM
          const noSub = await launchOnChannel(binding, {
            resource: ctxlessPub.id,
            omit: ['sub'],
          });
          launchRefused(noSub.response, 'MISSING_CLAIM');
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L8 — Roles: learner launch is graded; staff launch is preview; Deep Linking is only for staff`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L8', async () => {
          // 1. Learner launch -> graded play (preview === false)
          const learnerPlay = await openPlayOnChannel(binding, pub, {
            roles: [ROLE_LEARNER],
            subject: uniqueId('learner-l8'),
          });
          const learnerStatus = await appRequest(
            'GET',
            `/app-api/play/${learnerPlay.playId}/status`,
          );
          expect(learnerStatus.status).toBe(200);
          expect(JSON.parse(learnerStatus.text).preview).toBe(false);

          // 2. Staff launch -> preview play (preview === true)
          const staffPlay = await openPlayOnChannel(binding, pub, {
            roles: [ROLE_INSTRUCTOR],
            subject: uniqueId('staff-l8'),
          });
          const staffStatus = await appRequest(
            'GET',
            `/app-api/play/${staffPlay.playId}/status`,
          );
          expect(staffStatus.status).toBe(200);
          expect(JSON.parse(staffStatus.text).preview).toBe(true);

          // 3. Deep Linking is only for staff: instructor succeeds, learner is refused with 403 ROLE_NOT_ALLOWED
          const staffPicker = await openPickerOnChannel(binding);
          expect(staffPicker.status).toBe(200);

          const learnerPicker = await openPickerOnChannel(binding, {
            roles: [ROLE_LEARNER],
          });
          expect(learnerPicker.status).toBe(403);
          expect(learnerPicker.html).toContain('ROLE_NOT_ALLOWED');
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L9 — Two libraries on the same channel stay isolated across courses, launches, and pickers`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L9', async () => {
          const isShared = fixture.capabilities['platform.sharing'] === 'shared';
          const bA = await setupChannelBinding(fixture, {
            library: 'A',
            clientId: isShared ? binding.clientId : uniqueId(`c-l9-a-${fixture.id}`),
            deploymentId: newDeploymentId(fixture, `dep-l9-a-${fixture.id}`),
          });
          const bB = await setupChannelBinding(fixture, {
            library: 'B',
            clientId: isShared ? binding.clientId : uniqueId(`c-l9-b-${fixture.id}`),
            deploymentId: newDeploymentId(fixture, `dep-l9-b-${fixture.id}`),
          });

          try {
            // Assert the two bindings belong to distinct libraries before testing isolation
            expect(bA.library).not.toBe(bB.library);

            const pubA = await publication(bA, 'scorm12', {
              title: `OnlyForLibA-${bA.library}`,
            });
            const pubB = await publication(bB, 'scorm12', {
              title: `OnlyForLibB-${bB.library}`,
            });

            // Picker in library A shows pubA and not pubB
            const pickerA = await openPickerOnChannel(bA);
            expect(pickerA.status).toBe(200);
            expect(pickerA.html).toContain(pubA.id);
            expect(pickerA.html).not.toContain(pubB.id);

            // Launch on connection A targeting pubB is refused with 404 PUBLICATION_NOT_IN_CONNECTION
            const crossLaunch = await launchOnChannel(bA, {
              resource: pubB.id,
            });
            expect(crossLaunch.response.status).toBe(303);
            const crossPage = await appRequest('GET', crossLaunch.location, {
              headers: { accept: 'text/html' },
            });
            denied(crossPage, 'PUBLICATION_NOT_IN_CONNECTION', 404);

            // Library A cannot read Library B's publication results
            const foreignResults = await app(
              bA.session,
              'GET',
              `/app-api/publications/${pubB.id}/results`,
            );
            expectStatus(foreignResults, 404, 'NOT_FOUND');
          } finally {
            await endConnection(bA.session, bA.connection.id);
            await endConnection(bB.session, bB.connection.id);
          }
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L10 — Platform storage HTTP level (AP-05-01..07): login without lti_storage_target -> 302, with lti_storage_target -> 200 login page or 302 by profile, and storage-check refusals`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L10', async () => {
          // HTTP-level platform storage (AP-05-01, -02, -04, -05, -07; lti-service-api-delta §2.1, §2.2):
          // the auth URL and the check come from the one JSON block of each page; the storage
          // check posts {check, value} with the LTI Origin (lib/cases.ts runPlatformStorageCase).
          const report = await runPlatformStorageCase(
            {
              fixture,
              launchPatch: {
                provider: fixture.simProvider,
                clientId: binding.clientId,
                deploymentId: binding.deploymentId,
                siteHost: binding.siteHost,
                pageHost: binding.pageHost,
                resource: pub.id,
              },
              ltiUrl: urls.lti,
              account: ACCOUNT,
            },
            liveKitCaseIo(),
          );
          expect(report.storagePath).toBe(Boolean(fixture.sim.platformStorage));
        });
      });
    });
  }

  describe('GLOBAL:K1-LAUNCH:L-FAULTS — 12 protocol security faults run once per kit run on generic-sim', () => {
    const genericFixture = selectProtocolControlFixture(allFixtures);
    let faultBinding: ChannelBinding;
    let faultPub: PublicationRef;

    beforeAll(async () => {
      faultBinding = await setupChannelBinding(genericFixture, {
        library: 'A',
      });
      faultPub = await publication(faultBinding, 'scorm12');
    });

    afterAll(async () => {
      if (faultBinding) {
        await endConnection(faultBinding.session, faultBinding.connection.id);
      }
    });

    it('GLOBAL:K1-LAUNCH:L-FAULTS — refuses all 12 protocol security faults with HTTP 400 and exact error codes', async () => {
      await runKitCase('GLOBAL', 'K1-LAUNCH', 'L-FAULTS', async () => {
        // Control launch succeeds before fault loop
        const control = await launchOnChannel(faultBinding, {
          resource: faultPub.id,
        });
        expect(control.response.status).toBe(303);

        // Run all 12 protocol security faults (AC-LA-E7-06-08; 20-protocol.test.ts)
        for (const [fault, expectedCode] of PROTOCOL_SECURITY_FAULTS) {
          const cursor = (await records()).cursor;
          const result = await launchOnChannel(faultBinding, {
            resource: faultPub.id,
            fault,
          });
          launchRefused(result.response, expectedCode);
          await noServiceCalls(cursor);
        }
      });
    });
  });
});
