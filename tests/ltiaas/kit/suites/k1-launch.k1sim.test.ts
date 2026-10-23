import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadAllChannelFixtures,
  loadSelectedChannelFixtures,
  PROTOCOL_SECURITY_FAULTS,
} from '../lib/fixtures.js';
import {
  ACCOUNT,
  admin,
  AGS,
  appRequest,
  beginLaunch,
  ChannelBinding,
  commitGrade,
  COOKIE,
  denied,
  endConnection,
  ensureKitRunInitialized,
  expectStatus,
  htmlText,
  idToken,
  launchOnChannel,
  logEvents,
  LTI,
  ltiRequest,
  noServiceCalls,
  openPickerOnChannel,
  openPlayOnChannel,
  parseForm,
  preparedLaunch,
  publication,
  PublicationRef,
  records,
  results,
  ROLE_INSTRUCTOR,
  ROLE_LEARNER,
  runKitCase,
  scenario,
  setupChannelBinding,
  uniqueId,
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

          // 2. GET /api/idtoken with LTIK-AUTH-V2 (lti-service-api.md §2.3; lti-service-api-delta.md §1.2, §4)
          const token = await idToken(launched.ltik!);
          expectStatus(token, 200);
          const body = token.json;

          expect(body.platformId).toBe(binding.platformId);
          expect(body.platformCode).toBeTruthy();
          expect(body.deploymentId).toBe(binding.deploymentId);
          expect(body.messageType).toBe('LtiResourceLinkRequest');
          expect(body.version).toBe('1.3.0');
          expect(body.targetLinkUri).toContain(`/tool/launch/${pub.id}`);
          expect(body.user?.id).toBeTruthy();
          expect(Array.isArray(body.roles)).toBe(true);
          expect(body.context?.id).toBeTruthy();
          expect(body.resourceLink?.id).toBeTruthy();
          expect(body.platform?.productFamilyCode).toBe(fixture.sim.family);
          expect(body.services?.ags?.serviceKey).toBeTruthy();
          expect(body.bindingRef?.libraryId).toBe(binding.library);
          expect(body.bindingRef?.connectionId).toBe(binding.connection.id);
          expect(body.bindingRef?.channel).toBe(fixture.id);

          // 3. Site and service origin verification when site.serviceOrigin is true
          if (fixture.capabilities['site.serviceOrigin']) {
            expect(body.services?.ags?.lineitem).toContain(fixture.sim.serviceUrl);
          }
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L2 — Profile-dependent faults unknown-key and wrong-issuer, plus rotated signing key`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L2', async () => {
          // 1. Profile-dependent fault: unknown-key -> 400 INVALID_SIGNATURE
          const cursor1 = (await records()).cursor;
          const unknownKeyRes = await launchOnChannel(binding, {
            resource: pub.id,
            fault: 'unknown-key',
          });
          denied(unknownKeyRes.response, 'INVALID_SIGNATURE', 400);
          await noServiceCalls(cursor1);

          // 2. Profile-dependent fault: wrong-issuer -> 400 INVALID_ISSUER_OR_AUDIENCE
          const cursor2 = (await records()).cursor;
          const wrongIssRes = await launchOnChannel(binding, {
            resource: pub.id,
            fault: 'wrong-issuer',
          });
          denied(wrongIssRes.response, 'INVALID_ISSUER_OR_AUDIENCE', 400);
          await noServiceCalls(cursor2);

          // 3. Rotated signing key (`rotatedKey: true`) succeeds via JWKS refresh
          const rotatedRes = await launchOnChannel(binding, {
            resource: pub.id,
            rotatedKey: true,
          });
          expect(rotatedRes.response.status).toBe(303);
          expect(rotatedRes.ltik).toBeTruthy();
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L3 — Unknown deployment code refused with DEPLOYMENT_NOT_REGISTERED and inactive deployment refused with DEPLOYMENT_NOT_ACTIVE`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L3', async () => {
          // 1. Unregistered deployment -> 403 DEPLOYMENT_NOT_REGISTERED (lti-service-api-delta.md §2.2)
          const cursor1 = (await records()).cursor;
          const unknownDep = await launchOnChannel(binding, {
            resource: pub.id,
            deploymentId: uniqueId('unregistered-dep'),
          });
          denied(unknownDep.response, 'DEPLOYMENT_NOT_REGISTERED', 403);
          await noServiceCalls(cursor1);

          // 2. Inactive deployment -> 403 DEPLOYMENT_NOT_ACTIVE (lti-service-api-delta.md §3.3)
          const inactiveDepId = uniqueId('inactive-dep');
          const addDep = await admin(
            'POST',
            `/api/platforms/${binding.platformId}/deployments`,
            {
              deploymentId: inactiveDepId,
              bindingRef: {
                libraryId: binding.library,
                connectionId: binding.connection.id,
                channel: fixture.id,
              },
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
          const otherFixture = allFixtures.find((f) => f.sim.family !== fixture.sim.family)!;
          const since = Date.now();
          const res = await launchOnChannel(binding, {
            resource: pub.id,
            family: otherFixture.sim.family,
          });

          if (res.response.status === 400) {
            denied(res.response, 'PROVIDER_PROFILE_MISMATCH', 400);
          } else {
            expect(res.response.status).toBe(303);
            const events = logEvents('family_guard_mismatch', since);
            expect(events.length).toBeGreaterThanOrEqual(1);
          }
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L5 — Claim policy: name, given_name, family_name, email, custom, and lis kept or dropped by privacyFloor; launch_claims_minimized logged`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L5', async () => {
          const since = Date.now();
          const launched = await launchOnChannel(binding, {
            resource: pub.id,
            includePii: true,
            extraClaims: {
              [`${LTI}custom`]: { section: 'A1' },
              [`${LTI}lis`]: {
                person_sourcedid: 'sis-person-1',
                course_section_sourcedid: 'sis-course-1',
              },
            },
          });
          expect(launched.response.status).toBe(303);
          const token = await idToken(launched.ltik!);
          expectStatus(token, 200);

          // Personal fields (name, given_name, family_name, email) and LIS are always dropped by default privacy minimization (lti-service-api-delta.md §4)
          expect(token.json.user?.name).toBeUndefined();
          expect(token.json.user?.givenName).toBeUndefined();
          expect(token.json.user?.familyName).toBeUndefined();
          expect(token.json.user?.email).toBeUndefined();
          expect(token.json.lis).toBeUndefined();

          if (fixture.sim.privacyFloor === 'allowlist') {
            expect(token.json.custom).toBeUndefined();
            const minLogs = logEvents('launch_claims_minimized', since);
            expect(minLogs.length).toBeGreaterThanOrEqual(1);
          } else {
            expect(token.json.custom).toEqual({ section: 'A1' });
          }
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L6 — Document target: iframe -> /play/:playId/embedded (auto-continues only when launch.topLevelContinue is true); window -> /play/:playId`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L6', async () => {
          // 1. presentationTarget: 'iframe' -> /play/:playId/embedded (cogniate-app-api-delta.md §8)
          const iframeLaunch = await launchOnChannel(binding, {
            resource: pub.id,
            presentationTarget: 'iframe',
          });
          expect(iframeLaunch.response.status).toBe(303);
          expect(iframeLaunch.location).toMatch(/\/play\/[^/?]+\/embedded\?ltik=/);

          const embeddedPage = await appRequest('GET', iframeLaunch.location, {
            headers: { accept: 'text/html' },
          });
          expect(embeddedPage.status).toBe(200);
          expect(htmlText(embeddedPage.text)).toContain('Open this course in a new tab');
          if (fixture.capabilities['launch.topLevelContinue']) {
            expect(embeddedPage.text).toContain('data-auto-continue="true"');
          } else {
            expect(embeddedPage.text).not.toContain('data-auto-continue="true"');
          }

          // 2. presentationTarget: 'window' -> /play/:playId
          const windowLaunch = await launchOnChannel(binding, {
            resource: pub.id,
            presentationTarget: 'window',
          });
          expect(windowLaunch.response.status).toBe(303);
          expect(windowLaunch.location).toMatch(/\/play\/[^/?]+\?ltik=/);
          expect(windowLaunch.location).not.toContain('/embedded');
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L7 — Launch without context (AP-05-08..11): player opens, AGS lineitem dispatches score, without AGS has no serviceKey and fails dispatch with clear message, same resourceLinkId shares placement, no sub -> 400 MISSING_CLAIM`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L7', async () => {
          const ctxlessPub = await publication(binding, 'scorm12');
          const sharedRlId = uniqueId(`rl-ctxless-${fixture.id}`);
          const learner1 = uniqueId('learner-ctxless-1');
          const learner2 = uniqueId('learner-ctxless-2');

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

          // Verify simulator received the score call on the launch lineitem
          const simRecsAfter1 = await records();
          const scoreRec1 = simRecsAfter1.records.find(
            (r: Record<string, unknown>) =>
              r.kind === 'score' &&
              (r.body as Record<string, unknown> | undefined)?.userId === learner1,
          );
          expect(scoreRec1).toBeDefined();
          expect(scoreRec1!.body.scoreGiven).toBe(8);
          expect(scoreRec1!.body.scoreMaximum).toBe(10);

          // 2. AP-05-11: Second learner without context on the same resourceLinkId shares the placement
          const play2 = await openPlayOnChannel(binding, ctxlessPub, {
            omit: [`${LTI}context`],
            resourceLinkId: sharedRlId,
            subject: learner2,
          });
          const commit2 = await commitGrade(play2, 'scorm12', 9, 10);
          expect(commit2.status).toBe(200);
          await waitSync(binding, ctxlessPub, 'sent');

          const rowsAfterBoth = (await results(binding, ctxlessPub)) as Array<
            Record<string, unknown>
          >;
          const row1 = rowsAfterBoth.find(
            (r) => (r.learner as Record<string, unknown> | undefined)?.subject === learner1,
          );
          const row2 = rowsAfterBoth.find(
            (r) => (r.learner as Record<string, unknown> | undefined)?.subject === learner2,
          );
          expect(row1).toBeDefined();
          expect(row2).toBeDefined();
          expect(row1!.resourceLinkId).toBe(sharedRlId);
          expect(row2!.resourceLinkId).toBe(sharedRlId);

          // 3. AP-05-10: Launch without context and without AGS has no serviceKey and records the clear error message on score commit
          const noAgsRlId = uniqueId(`rl-noags-${fixture.id}`);
          const learnerNoAgs = uniqueId('learner-ctxless-noags');
          const noAgsLaunch = await launchOnChannel(binding, {
            resource: ctxlessPub.id,
            omit: [`${LTI}context`, AGS],
            resourceLinkId: noAgsRlId,
            subject: learnerNoAgs,
          });
          expect(noAgsLaunch.response.status).toBe(303);
          const noAgsToken = await idToken(noAgsLaunch.ltik!);
          expectStatus(noAgsToken, 200);
          expect(noAgsToken.json.context).toBeUndefined();
          expect(noAgsToken.json.services?.ags?.serviceKey).toBeUndefined();

          const cursorBeforeNoAgsCommit = (await records()).cursor;
          const playNoAgs = await openPlayOnChannel(binding, ctxlessPub, {
            omit: [`${LTI}context`, AGS],
            resourceLinkId: noAgsRlId,
            subject: learnerNoAgs,
          });
          const commitNoAgs = await commitGrade(playNoAgs, 'scorm12', 7, 10);
          expect(commitNoAgs.status).toBe(200);

          let noAgsRow: Record<string, unknown> | undefined;
          for (let i = 0; i < 20; i += 1) {
            const currentRows = (await results(binding, ctxlessPub)) as Array<
              Record<string, unknown>
            >;
            noAgsRow = currentRows.find(
              (r) =>
                (r.learner as Record<string, unknown> | undefined)?.subject === learnerNoAgs,
            );
            const syncEntry =
              (noAgsRow?.lastScoreSync as Record<string, unknown> | undefined) ??
              ((noAgsRow?.scoreSyncs as Array<Record<string, unknown>> | undefined)?.[0]);
            if (syncEntry?.lastError) {
              break;
            }
            await new Promise((r) => setTimeout(r, 150));
          }
          const noAgsSync =
            (noAgsRow?.lastScoreSync as Record<string, unknown> | undefined) ??
            ((noAgsRow?.scoreSyncs as Array<Record<string, unknown>> | undefined)?.[0]);
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
          denied(noSub.response, 'MISSING_CLAIM', 400);
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L8 — Roles: learner launch is graded; staff launch is preview; Deep Linking is only for staff`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L8', async () => {
          // 1. Learner launch -> graded play (not preview)
          const learnerPlay = await openPlayOnChannel(binding, pub, {
            roles: [ROLE_LEARNER],
            subject: uniqueId('learner-l8'),
          });
          expect(learnerPlay.playHtml).not.toContain('Preview');

          // 2. Staff launch -> preview play
          const staffPlay = await openPlayOnChannel(binding, pub, {
            roles: [ROLE_INSTRUCTOR],
            subject: uniqueId('staff-l8'),
          });
          expect(htmlText(staffPlay.playHtml)).toContain('Preview');

          // 3. Deep Linking is only for staff: instructor succeeds, learner is refused with 403
          const staffPicker = await openPickerOnChannel(binding);
          expect(staffPicker.status).toBe(200);

          const learnerDl = await launchOnChannel(binding, {
            messageType: 'LtiDeepLinkingRequest',
            roles: [ROLE_LEARNER],
          });
          expect(learnerDl.response.status).toBe(303);
          const learnerPickerPage = await appRequest('GET', learnerDl.location, {
            headers: { accept: 'text/html' },
          });
          expect(learnerPickerPage.status).toBe(403);
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L9 — Two libraries on the same channel stay isolated across courses, launches, and pickers`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L9', async () => {
          const isShared = fixture.capabilities['platform.sharing'] === 'shared';
          const bA = await setupChannelBinding(fixture, {
            library: uniqueId(`lib-l9-a-${fixture.id}`),
            clientId: isShared ? binding.clientId : uniqueId(`c-l9-a-${fixture.id}`),
            deploymentId: uniqueId(`dep-l9-a-${fixture.id}`),
          });
          const bB = await setupChannelBinding(fixture, {
            library: uniqueId(`lib-l9-b-${fixture.id}`),
            clientId: isShared ? binding.clientId : uniqueId(`c-l9-b-${fixture.id}`),
            deploymentId: uniqueId(`dep-l9-b-${fixture.id}`),
          });

          try {
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

            // Launch on connection A targeting pubB is refused with 403
            const crossLaunch = await launchOnChannel(bA, {
              resource: pubB.id,
            });
            expect(crossLaunch.response.status).toBe(303);
            const crossPage = await appRequest('GET', crossLaunch.location, {
              headers: { accept: 'text/html' },
            });
            expect(crossPage.status).toBe(403);
          } finally {
            await endConnection(bA.session, bA.connection.id);
            await endConnection(bB.session, bB.connection.id);
          }
        });
      });

      it(`${fixture.id}:K1-LAUNCH:L10 — Platform storage HTTP level (AP-05-01..07): login without lti_storage_target -> 302, with lti_storage_target -> 200 login page or 302 by profile, and storage-check refusals`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L10', async () => {
          const scPlain = await scenario(fixture.simProvider, {
            clientId: binding.clientId,
            deploymentId: binding.deploymentId,
            resource: pub.id,
          });
          // 1. Login without lti_storage_target -> 302 redirect (AP-05-01; lti-service-api-delta.md §2.1)
          const loginPlain = await beginLaunch(scPlain);
          expect(loginPlain.loginResponse.status).toBe(302);

          // 2. Login with lti_storage_target -> 200 storage relay page when platformStorage is configured, else 302 (AP-05-02..03)
          const scStorage = await scenario(fixture.simProvider, {
            clientId: binding.clientId,
            deploymentId: binding.deploymentId,
            resource: pub.id,
            storageTarget: fixture.sim.platformStorage?.frameName ?? 'platform_storage_frame',
          });
          const loginWithTarget = await ltiRequest('POST', `/lti/login/${ACCOUNT}`, {
            form: scStorage.login,
          });
          if (fixture.sim.platformStorage) {
            expect(loginWithTarget.status).toBe(200);
            expect(loginWithTarget.text).toContain('lti.put_data');
            expect(loginWithTarget.text).toContain(fixture.sim.platformStorage.frameName);
            expect(loginWithTarget.text).toContain(fixture.sim.platformStorage.allowedOrigin);
          } else {
            expect(loginWithTarget.status).toBe(302);
          }

          // 3. Launch without cookie -> 200 storage-check page -> POST /lti/launch/cogniate/storage-check refusals (AP-05-04..07; lti-service-api-delta.md §2.2)
          const prep = await preparedLaunch(scPlain);
          const noCookieLaunch = await ltiRequest('POST', `/lti/launch/${ACCOUNT}`, {
            headers: { accept: 'text/html' },
            form: prep.form.fields,
          });
          expect(noCookieLaunch.status).toBe(200);
          expect(noCookieLaunch.text).toContain('lti.get_data');
          const checkForm = parseForm(noCookieLaunch.text);
          expect(checkForm.action).toContain(`/lti/launch/${ACCOUNT}/storage-check`);

          // 3a. Valid storage-check completes launch with 303
          const validCheck = await ltiRequest('POST', checkForm.action, {
            headers: { accept: 'text/html' },
            form: {
              ...checkForm.fields,
              verifiedState: prep.form.fields.state,
            },
          });
          expect(validCheck.status).toBe(303);

          // 3b. Replaying the same launchToken is refused with 400 STATE_NOT_FOUND
          const replayCheck = await ltiRequest('POST', checkForm.action, {
            headers: { accept: 'text/html' },
            form: {
              ...checkForm.fields,
              verifiedState: prep.form.fields.state,
            },
          });
          denied(replayCheck, 'STATE_NOT_FOUND', 400);

          // 3c. Mismatched verifiedState is refused with 400 STATE_NOT_FOUND
          const prep2 = await preparedLaunch(scPlain);
          const noCookie2 = await ltiRequest('POST', `/lti/launch/${ACCOUNT}`, {
            headers: { accept: 'text/html' },
            form: prep2.form.fields,
          });
          const checkForm2 = parseForm(noCookie2.text);
          const wrongStateCheck = await ltiRequest('POST', checkForm2.action, {
            headers: { accept: 'text/html' },
            form: {
              ...checkForm2.fields,
              verifiedState: 'wrong-state-value',
            },
          });
          denied(wrongStateCheck, 'STATE_NOT_FOUND', 400);

          // 3d. Cookie + storage-check mismatch when state cookie belongs to another login
          const prep3 = await preparedLaunch(scPlain);
          const otherLogin = await beginLaunch(scPlain);
          const wrongCookieLaunch = await ltiRequest('POST', `/lti/launch/${ACCOUNT}`, {
            headers: {
              accept: 'text/html',
              cookie: `${COOKIE}=${otherLogin.stateCookie}`,
            },
            form: prep3.form.fields,
          });
          denied(wrongCookieLaunch, 'STATE_NOT_FOUND', 400);
        });
      });
    });
  }

  describe('GLOBAL:K1-LAUNCH:L-FAULTS — 12 protocol security faults run once per kit run on generic-sim', () => {
    const genericFixture =
      allFixtures.find((f) => f.simProfile === 'lti-1p3-standard') ?? allFixtures[0];
    let faultBinding: ChannelBinding;
    let faultPub: PublicationRef;

    beforeAll(async () => {
      faultBinding = await setupChannelBinding(genericFixture, {
        library: uniqueId('lib-global-faults'),
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
          denied(result.response, expectedCode, 400);
          await noServiceCalls(cursor);
        }
      });
    });
  });
});
