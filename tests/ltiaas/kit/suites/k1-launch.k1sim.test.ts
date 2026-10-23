import { beforeAll, describe, expect, it } from 'vitest';
import {
  ChannelFixture,
  loadAllChannelFixtures,
  loadSelectedChannelFixtures,
  PROTOCOL_SECURITY_FAULTS,
} from '../lib/fixtures.js';
import {
  appApi,
  APP_URL,
  ensureKitRunInitialized,
  httpRequest,
  isK1SimEnabled,
  ltiApi,
  LTI_URL,
  performSimulatorLaunch,
  recordRedactedEvidence,
  RegisteredChannelContext,
  registerSimScenario,
  runKitCase,
  setupActiveChannelConnection,
} from '../lib/runtime.js';

const runSuite = isK1SimEnabled() ? describe : describe.skip;
const fixtures = loadSelectedChannelFixtures();
const allFixtures = loadAllChannelFixtures();

runSuite('K1-LAUNCH: LTI 1.3 Launch & Security Suite (all selected channels)', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  for (const fixture of fixtures) {
    describe(`channel: ${fixture.id}`, () => {
      let ctx: RegisteredChannelContext;

      beforeAll(async () => {
        ctx = await setupActiveChannelConnection(fixture, 'launch');
      });

      it(`[${fixture.id}:K1-LAUNCH:L1] valid resource-link launch -> ltik -> /api/idtoken fields and site/service origins`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L1', async () => {
          const res = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
          });
          expect([302, 303]).toContain(res.launchRes.status);
          expect(res.ltik.length).toBeGreaterThan(10);
          expect(res.playOrPickerRes?.status).toBe(200);

          const idTokenRes = await ltiApi('/api/idtoken', {
            method: 'GET',
            headers: { authorization: `Bearer ${res.ltik}` },
          });
          expect(idTokenRes.status).toBe(200);
          const claims = idTokenRes.json as {
            platformId: string;
            clientId: string;
            deploymentId: string;
            user?: { id?: string; roles?: string[] };
            launch?: { target?: string };
          };
          expect(claims.clientId).toBe(ctx.clientId);
          expect(claims.deploymentId).toBe(ctx.deploymentId);
          expect(claims.user?.id).toBe('learner-1');
          expect(Array.isArray(claims.user?.roles)).toBe(true);

          const connRes = await appApi(`/app-api/connections/${ctx.connectionId}`, {
            cookie: ctx.cookie,
            csrf: ctx.csrf,
          });
          expect(connRes.status).toBe(200);
          const connJson = connRes.json as { siteUrl: string; serviceUrl?: string | null };
          expect(connJson.siteUrl).toBe(fixture.sim.siteUrl);
          if (fixture.capabilities['site.serviceOrigin']) {
            expect(connJson.serviceUrl).toBe(fixture.sim.serviceUrl);
          }

          recordRedactedEvidence(`launch-l1-${fixture.id}`, {
            channelId: fixture.id,
            status: res.launchRes.status,
            hasLtik: Boolean(res.ltik),
            redacted: true,
          });
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L2] profile-dependent faults unknown-key and wrong-issuer, plus rotated signing key`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L2', async () => {
          const unknownKeyRes = await performSimulatorLaunch(ctx, {
            fault: 'unknown-key',
          });
          expect(unknownKeyRes.launchRes.status).toBeGreaterThanOrEqual(400);
          expect(unknownKeyRes.ltik).toBe('');
          expect(unknownKeyRes.launchRes.rawBody).toMatch(/INVALID_SIGNATURE|signature|key/i);

          const wrongIssuerRes = await performSimulatorLaunch(ctx, {
            fault: 'wrong-issuer',
          });
          expect(wrongIssuerRes.launchRes.status).toBeGreaterThanOrEqual(400);
          expect(wrongIssuerRes.ltik).toBe('');
          expect(wrongIssuerRes.launchRes.rawBody).toMatch(
            /INVALID_ISSUER_OR_AUDIENCE|issuer|platform/i,
          );

          const rotatedRes = await performSimulatorLaunch(ctx, {
            secondKey: true,
            jwksKeys: 'both',
          });
          expect([302, 303]).toContain(rotatedRes.launchRes.status);
          expect(rotatedRes.ltik.length).toBeGreaterThan(10);
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L3] unknown deployment code and inactive deployment are refused`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L3', async () => {
          const unknownDep =
            fixture.sim.tokenAudienceKind === 'fixed'
              ? '99999999-9999-4999-8999-999999999999'
              : 'unregistered-dep-code-999';
          const unknownRes = await performSimulatorLaunch(ctx, {
            deploymentId: unknownDep,
          });
          expect(unknownRes.launchRes.status).toBeGreaterThanOrEqual(400);
          expect(unknownRes.ltik).toBe('');
          expect(unknownRes.launchRes.rawBody).toMatch(/DEPLOYMENT_NOT_REGISTERED|deployment/i);

          if (ctx.platformId) {
            const deactRes = await ltiApi(
              `/api/platforms/${ctx.platformId}/deployments/${encodeURIComponent(ctx.deploymentId)}`,
              {
                method: 'PATCH',
                body: { active: false },
              },
            );
            expect([200, 204]).toContain(deactRes.status);
            try {
              const inactiveLaunch = await performSimulatorLaunch(ctx, {});
              expect(inactiveLaunch.launchRes.status).toBeGreaterThanOrEqual(400);
              expect(inactiveLaunch.ltik).toBe('');
              expect(inactiveLaunch.launchRes.rawBody).toMatch(
                /DEPLOYMENT_NOT_ACTIVE|deployment/i,
              );
            } finally {
              await ltiApi(
                `/api/platforms/${ctx.platformId}/deployments/${encodeURIComponent(
                  ctx.deploymentId,
                )}`,
                {
                  method: 'PATCH',
                  body: { active: true },
                },
              );
            }
          }
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L4] signed product family of another channel is guarded by familyGuardLevel`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L4', async () => {
          const launchGuardedOther: ChannelFixture | undefined = allFixtures.find(
            (f) =>
              f.id !== fixture.id &&
              (f.capabilities['site.serviceOrigin'] ||
                f.capabilities['platform.sharing'] === 'shared'),
          );
          expect(launchGuardedOther).toBeDefined();
          const wrongLaunchFamilyRes = await performSimulatorLaunch(ctx, {
            family: launchGuardedOther!.sim.family,
          });
          expect(wrongLaunchFamilyRes.launchRes.status).toBe(400);
          expect(wrongLaunchFamilyRes.ltik).toBe('');
          expect(wrongLaunchFamilyRes.launchRes.rawBody).toContain('PROVIDER_PROFILE_MISMATCH');

          const regGuardedOther: ChannelFixture | undefined = allFixtures.find(
            (f) => f.id !== fixture.id && f.sim.tokenAudienceKind === 'fixed',
          );
          if (regGuardedOther) {
            const regFamilyRes = await performSimulatorLaunch(ctx, {
              family: regGuardedOther.sim.family,
            });
            if (fixture.simProfile === 'standard') {
              expect(regFamilyRes.launchRes.status).toBe(400);
              expect(regFamilyRes.ltik).toBe('');
              expect(regFamilyRes.launchRes.rawBody).toContain('PROVIDER_PROFILE_MISMATCH');
            } else {
              expect([302, 303]).toContain(regFamilyRes.launchRes.status);
              expect(regFamilyRes.ltik.length).toBeGreaterThan(10);
            }
          }
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L5] claim policy keeps or drops personal, custom, and lis claims by privacyFloor`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L5', async () => {
          const res = await performSimulatorLaunch(ctx, {
            claims: {
              name: 'Ada Lovelace',
              given_name: 'Ada',
              family_name: 'Lovelace',
              email: 'ada@sim.test',
              'https://purl.imsglobal.org/spec/lti/claim/custom': {
                section: 'A1',
              },
              'https://purl.imsglobal.org/spec/lti/claim/lis': {
                person_sourcedid: 'sis-ada-1',
              },
            },
          });
          expect([302, 303]).toContain(res.launchRes.status);
          const idTokenRes = await ltiApi('/api/idtoken', {
            method: 'GET',
            headers: { authorization: `Bearer ${res.ltik}` },
          });
          expect(idTokenRes.status).toBe(200);
          const body = idTokenRes.json as {
            user?: {
              id?: string;
              name?: string;
              givenName?: string;
              familyName?: string;
              email?: string;
            };
            custom?: Record<string, unknown>;
            lis?: Record<string, unknown>;
          };
          expect(body.user?.id).toBe('learner-1');
          if (fixture.sim.privacyFloor === 'allowlist') {
            expect(body.user?.name).toBeUndefined();
            expect(body.user?.givenName).toBeUndefined();
            expect(body.user?.familyName).toBeUndefined();
            expect(body.user?.email).toBeUndefined();
            expect(body.custom).toBeUndefined();
            expect(body.lis).toBeUndefined();
          } else {
            expect(body.custom).toEqual({ section: 'A1' });
          }
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L6] documentTarget iframe vs window and launch.topLevelContinue`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L6', async () => {
          const iframeRes = await performSimulatorLaunch(ctx, {
            documentTarget: 'iframe',
          });
          expect([302, 303]).toContain(iframeRes.launchRes.status);
          expect(iframeRes.redirectLocation).toContain('/embedded');
          expect(iframeRes.playOrPickerRes?.status).toBe(200);
          const embeddedHtml = iframeRes.playOrPickerRes?.rawBody ?? '';
          if (fixture.capabilities['launch.topLevelContinue']) {
            expect(embeddedHtml).toMatch(/window\.open|auto-continue|Continue/i);
          } else {
            expect(embeddedHtml).not.toContain('data-auto-continue="true"');
          }

          const windowRes = await performSimulatorLaunch(ctx, {
            documentTarget: 'window',
          });
          expect([302, 303]).toContain(windowRes.launchRes.status);
          expect(windowRes.redirectLocation).toContain('/play/');
          expect(windowRes.redirectLocation).not.toContain('/embedded');
          expect(windowRes.playOrPickerRes?.status).toBe(200);
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L7] launch without context (AP-05-08..11): with AGS, without AGS, shared placement, and missing sub`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L7', async () => {
          const sharedResourceLinkId = `ctxless-rl-${fixture.id}`;
          const withAgsRes = await performSimulatorLaunch(ctx, {
            omit: ['https://purl.imsglobal.org/spec/lti/claim/context'],
            resourceLinkId: sharedResourceLinkId,
            subject: 'learner-ctxless-1',
          });
          expect([302, 303]).toContain(withAgsRes.launchRes.status);
          expect(withAgsRes.playOrPickerRes?.status).toBe(200);

          const withAgsSecond = await performSimulatorLaunch(ctx, {
            omit: ['https://purl.imsglobal.org/spec/lti/claim/context'],
            resourceLinkId: sharedResourceLinkId,
            subject: 'learner-ctxless-2',
          });
          expect([302, 303]).toContain(withAgsSecond.launchRes.status);
          expect(withAgsSecond.playOrPickerRes?.status).toBe(200);

          const withoutAgsRes = await performSimulatorLaunch(ctx, {
            omit: [
              'https://purl.imsglobal.org/spec/lti/claim/context',
              'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
            ],
            resourceLinkId: `no-ags-rl-${fixture.id}`,
            documentTarget: 'window',
          });
          expect([302, 303]).toContain(withoutAgsRes.launchRes.status);
          const idTokenRes = await ltiApi('/api/idtoken', {
            method: 'GET',
            headers: { authorization: `Bearer ${withoutAgsRes.ltik}` },
          });
          expect(idTokenRes.status).toBe(200);
          const claims = idTokenRes.json as { services?: { ags?: { serviceKey?: string } } };
          expect(claims.services?.ags?.serviceKey).toBeUndefined();

          const noSubRes = await performSimulatorLaunch(ctx, {
            omit: ['sub'],
          });
          expect(noSubRes.launchRes.status).toBe(400);
          expect(noSubRes.ltik).toBe('');
          expect(noSubRes.launchRes.rawBody).toMatch(/MISSING_CLAIM|sub/i);
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L8] roles: learner graded, staff preview, and Deep Linking staff-only`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L8', async () => {
          const learnerRes = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
            documentTarget: 'window',
          });
          expect([302, 303]).toContain(learnerRes.launchRes.status);
          expect(learnerRes.playOrPickerRes?.status).toBe(200);

          const staffRes = await performSimulatorLaunch(ctx, {
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
            documentTarget: 'window',
          });
          expect([302, 303]).toContain(staffRes.launchRes.status);
          expect(staffRes.playOrPickerRes?.status).toBe(200);
          expect(staffRes.playOrPickerRes?.rawBody).toMatch(/preview/i);

          const staffDlRes = await performSimulatorLaunch(ctx, {
            messageType: 'LtiDeepLinkingRequest',
            roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          });
          expect([302, 303]).toContain(staffDlRes.launchRes.status);
          expect(staffDlRes.redirectLocation).toContain('/tool/picker/');
          expect(staffDlRes.playOrPickerRes?.status).toBe(200);
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L9] two libraries on the same channel stay isolated`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L9', async () => {
          const otherSession = {
            cookie: ctx.cookie,
            csrf: ctx.csrf,
          };
          const otherLibCtx = await setupActiveChannelConnection(
            {
              ...fixture,
              sim: {
                ...fixture.sim,
                deployments: [ctx.secondaryDeploymentId, ctx.deploymentId],
              },
            },
            'isolated-b',
          );

          const crossConnRead = await appApi(
            `/app-api/connections/${otherLibCtx.connectionId}`,
            otherSession,
          );
          expect(crossConnRead.status).toBe(404);

          const crossLaunch = await performSimulatorLaunch(ctx, {
            resource: otherLibCtx.resourceSlug,
          });
          if (crossLaunch.playOrPickerRes) {
            expect(crossLaunch.playOrPickerRes.status).toBeGreaterThanOrEqual(400);
          } else {
            expect(crossLaunch.launchRes.status).toBeGreaterThanOrEqual(400);
          }
        });
      });

      it(`[${fixture.id}:K1-LAUNCH:L10] platform storage HTTP level (AP-05-01..07) and Origin-first check order`, async () => {
        await runKitCase(fixture.id, 'K1-LAUNCH', 'L10', async () => {
          const scNoStorage = await registerSimScenario({
            id: `sc-l10-nostorage-${fixture.id}-${Date.now()}`,
            provider: fixture.simProvider,
            clientId: ctx.clientId,
            deploymentId: ctx.deploymentId,
            siteHost: fixture.sim.siteHost,
            pageHost: fixture.sim.pageHost,
            resource: ctx.resourceSlug,
          });
          const noStorageLogin = await httpRequest(`${LTI_URL}/lti/login/${ctx.libraryId}`, {
            method: 'POST',
            form: scNoStorage.login,
          });
          expect(noStorageLogin.status).toBe(302);
          expect(noStorageLogin.headers.location).toBeTruthy();
          expect(noStorageLogin.headers['set-cookie']).toBeTruthy();

          const scWithStorage = await registerSimScenario({
            id: `sc-l10-storage-${fixture.id}-${Date.now()}`,
            provider: fixture.simProvider,
            clientId: ctx.clientId,
            deploymentId: ctx.deploymentId,
            siteHost: fixture.sim.siteHost,
            pageHost: fixture.sim.pageHost,
            resource: ctx.resourceSlug,
            storageTarget: 'post_message_forwarding',
          });
          const withStorageLogin = await httpRequest(`${LTI_URL}/lti/login/${ctx.libraryId}`, {
            method: 'POST',
            form: scWithStorage.login,
          });
          if (fixture.sim.platformStorage) {
            expect(withStorageLogin.status).toBe(200);
            expect(withStorageLogin.rawBody).toContain('lti.put_data');
            expect(withStorageLogin.rawBody).toContain(fixture.sim.platformStorage.allowedOrigin);
          } else {
            expect(withStorageLogin.status).toBe(302);
            expect(withStorageLogin.headers.location).toBeTruthy();
          }

          const badOriginRes = await httpRequest(`${LTI_URL}/lti/storage-check`, {
            method: 'POST',
            headers: {
              origin: 'https://evil.example',
              'content-type': 'application/json',
            },
            body: { state: 'invalid-state', token: 'invalid-token' },
          });
          expect(badOriginRes.status).toBe(403);
          expect(badOriginRes.rawBody).toContain('ORIGIN_NOT_ALLOWED');

          const badStateRes = await httpRequest(`${LTI_URL}/lti/storage-check`, {
            method: 'POST',
            headers: {
              origin: new URL(LTI_URL).origin,
              'content-type': 'application/json',
            },
            body: { state: 'nonexistent-state', token: 'nonexistent-token' },
          });
          expect(badStateRes.status).toBeGreaterThanOrEqual(400);
        });
      });
    });
  }

  describe('global once-per-run protocol fault table', () => {
    it('[GLOBAL:K1-LAUNCH:L-FAULTS] 12 simulator security faults run once per kit run on generic-sim', async () => {
      await runKitCase('GLOBAL', 'K1-LAUNCH', 'L-FAULTS', async () => {
        const genericFixture =
          allFixtures.find((f) => f.capabilities['content.multiple']) ?? fixtures[0];
        const faultCtx = await setupActiveChannelConnection(genericFixture, 'faults-once');

        for (const fault of PROTOCOL_SECURITY_FAULTS) {
          if (fault === 'state-mismatch') {
            const sc = await registerSimScenario({
              id: `sc-fault-state-mismatch-${Date.now()}`,
              provider: genericFixture.simProvider,
              clientId: faultCtx.clientId,
              deploymentId: faultCtx.deploymentId,
              siteHost: genericFixture.sim.siteHost,
              pageHost: genericFixture.sim.pageHost,
              resource: faultCtx.resourceSlug,
            });
            const loginRes = await httpRequest(`${LTI_URL}/lti/login/${faultCtx.libraryId}`, {
              method: 'POST',
              form: sc.login,
            });
            const authUrl = loginRes.headers.location ?? '';
            const simAuthRes = await httpRequest(authUrl, { method: 'GET' });
            const idToken = simAuthRes.rawBody.match(/name="id_token"\s+value="([^"]+)"/)?.[1] ?? '';
            const state = simAuthRes.rawBody.match(/name="state"\s+value="([^"]+)"/)?.[1] ?? '';
            const launchRes = await httpRequest(`${LTI_URL}/lti/launch`, {
              method: 'POST',
              cookie: 'lti_state=wrong-cookie-state',
              form: { id_token: idToken, state },
            });
            expect(launchRes.status).toBeGreaterThanOrEqual(400);
            continue;
          }

          if (fault === 'replay-state') {
            const sc = await registerSimScenario({
              id: `sc-fault-replay-${Date.now()}`,
              provider: genericFixture.simProvider,
              clientId: faultCtx.clientId,
              deploymentId: faultCtx.deploymentId,
              siteHost: genericFixture.sim.siteHost,
              pageHost: genericFixture.sim.pageHost,
              resource: faultCtx.resourceSlug,
            });
            const loginRes = await httpRequest(`${LTI_URL}/lti/login/${faultCtx.libraryId}`, {
              method: 'POST',
              form: sc.login,
            });
            const authUrl = loginRes.headers.location ?? '';
            const setCookie = loginRes.headers['set-cookie'];
            const cookie = Array.isArray(setCookie)
              ? setCookie.map((c) => c.split(';')[0]).join('; ')
              : (setCookie ?? '').split(';')[0];
            const simAuthRes = await httpRequest(authUrl, { method: 'GET' });
            const idToken = simAuthRes.rawBody.match(/name="id_token"\s+value="([^"]+)"/)?.[1] ?? '';
            const state = simAuthRes.rawBody.match(/name="state"\s+value="([^"]+)"/)?.[1] ?? '';

            const firstLaunch = await httpRequest(`${LTI_URL}/lti/launch`, {
              method: 'POST',
              cookie,
              form: { id_token: idToken, state },
            });
            expect([302, 303]).toContain(firstLaunch.status);

            const secondLaunch = await httpRequest(`${LTI_URL}/lti/launch`, {
              method: 'POST',
              cookie,
              form: { id_token: idToken, state },
            });
            expect(secondLaunch.status).toBeGreaterThanOrEqual(400);
            continue;
          }

          const res = await performSimulatorLaunch(faultCtx, { fault });
          expect(res.launchRes.status).toBeGreaterThanOrEqual(400);
          expect(res.ltik).toBe('');
        }
      });
    });
  });
});
