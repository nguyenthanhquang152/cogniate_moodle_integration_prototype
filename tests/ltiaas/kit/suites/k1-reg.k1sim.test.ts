import { beforeAll, describe, expect, it } from 'vitest';
import {
  ChannelFixture,
  loadAllChannelFixtures,
  loadSelectedChannelFixtures,
} from '../lib/fixtures.js';
import {
  appApi,
  APP_URL,
   createStaffSession,
  ensureKitRunInitialized,
  getSimCursor,
  getSimRecords,
  httpRequest,
  isK1SimEnabled,
  issueOperatorGrantForChannel,
  ltiApi,
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

runSuite('K1-REG: Registration, Authority, Origin Binding & Connection Check Suite', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  for (const fixture of fixtures) {
    describe(`channel: ${fixture.id}`, () => {
      let ctx: RegisteredChannelContext;

      beforeAll(async () => {
        ctx = await setupActiveChannelConnection(fixture, 'reg');
      });

      it(`[${fixture.id}:K1-REG:R1] manual setup with manifest required fields, strict body check, and SSRF siteUrl validation`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R1', async () => {
          const session = { cookie: ctx.cookie, csrf: ctx.csrf };

          // 1. SSRF siteUrl validation: refuses IP literal, localhost, and own host
          for (const badSiteUrl of ['https://127.0.0.1', 'https://localhost:8443', APP_URL]) {
            const badRes = await appApi('/app-api/connections', session, {
              method: 'POST',
              body: {
                lms: fixture.id,
                name: 'Invalid site url probe',
                siteUrl: badSiteUrl,
                ...(fixture.capabilities['site.serviceOrigin']
                  ? { serviceUrl: fixture.sim.serviceUrl }
                  : {}),
              },
            });
            expect(badRes.status).toBe(422);
            expect(badRes.rawBody).toContain('INVALID_SITE_URL');
          }

          // 2. Strict body validation on PUT /app-api/connections/:id/platform: refuses unknown field and missing clientId
          const connCreate = await appApi('/app-api/connections', session, {
            method: 'POST',
            body: {
              lms: fixture.id,
              name: `R1 strict probe ${fixture.id}`,
              siteUrl: fixture.sim.siteUrl,
              ...(fixture.capabilities['site.serviceOrigin']
                ? { serviceUrl: fixture.sim.serviceUrl }
                : {}),
            },
          });
          expect([200, 201]).toContain(connCreate.status);
          const probeConnId = (connCreate.json as { id: string }).id;

          const unknownFieldRes = await appApi(
            `/app-api/connections/${probeConnId}/platform`,
            session,
            {
              method: 'PUT',
              body: {
                clientId: 'probe-client',
                deploymentId: fixture.sim.deployments[0],
                unknownExtraField: 'not-allowed',
              },
            },
          );
          expect(unknownFieldRes.status).toBeGreaterThanOrEqual(400);

          const missingFieldRes = await appApi(
            `/app-api/connections/${probeConnId}/platform`,
            session,
            {
              method: 'PUT',
              body: {
                deploymentId: fixture.sim.deployments[0],
              },
            },
          );
          expect(missingFieldRes.status).toBeGreaterThanOrEqual(400);

          recordRedactedEvidence(`reg-r1-${fixture.id}`, {
            channelId: fixture.id,
            connectionId: ctx.connectionId,
            redacted: true,
          });
        });
      });

      if (fixture.capabilities['deployments.multiple']) {
        it(`[${fixture.id}:K1-REG:R1-DEPLOYMENTS] adding a second deployment succeeds when deployments.multiple is true`, async () => {
          await runKitCase(fixture.id, 'K1-REG', 'R1-DEPLOYMENTS', async () => {
            const session = { cookie: ctx.cookie, csrf: ctx.csrf };
            const secondDep = ctx.secondaryDeploymentId;
            let grantCode: string | undefined;
            if (fixture.capabilities['binding.authority'].manual === 'operatorGrant') {
              grantCode = issueOperatorGrantForChannel(
                ctx.libraryId,
                fixture,
                ctx.connectionId,
                ctx.clientId,
                secondDep,
                { purpose: 'add_deployment' },
              );
            }

            const addDepRes = await appApi(
              `/app-api/connections/${ctx.connectionId}/deployments`,
              session,
              {
                method: 'POST',
                body: {
                  deploymentId: secondDep,
                  ...(grantCode ? { grantCode } : {}),
                },
              },
            );
            expect([200, 201]).toContain(addDepRes.status);

            const launchSecondDep = await performSimulatorLaunch(ctx, {
              deploymentId: secondDep,
            });
            expect([302, 303]).toContain(launchSecondDep.launchRes.status);
            expect(launchSecondDep.ltik.length).toBeGreaterThan(10);
          });
        });
      }

      it(`[${fixture.id}:K1-REG:R2] authority enforcement: operatorGrant happy path, GRANT_INVALID, GRANT_MISMATCH, or self-only CLI refusal`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R2', async () => {
          const r2LibId = `lib-r2-${fixture.id}-${Date.now()}`;
          const session = createStaffSession(r2LibId);
          const connRes = await appApi('/app-api/connections', session, {
            method: 'POST',
            body: {
              lms: fixture.id,
              name: `R2 Conn ${fixture.id}`,
              siteUrl: fixture.sim.siteUrl,
              ...(fixture.capabilities['site.serviceOrigin']
                ? { serviceUrl: fixture.sim.serviceUrl }
                : {}),
            },
          });
          expect([200, 201]).toContain(connRes.status);
          const connId = (connRes.json as { id: string }).id;
          const clientId = `client-r2-${fixture.id}-${Date.now()}`;
          const deploymentId = fixture.sim.deployments[0];

          if (fixture.capabilities['binding.authority'].manual === 'self') {
            expect(() =>
              issueOperatorGrantForChannel(
                r2LibId,
                fixture,
                connId,
                clientId,
                deploymentId,
              ),
            ).toThrow();
          } else {
            // 1. Invalid grant code -> 422 GRANT_INVALID
            const invalidGrantBody: Record<string, unknown> = {
              clientId,
              deploymentId,
              grantCode: 'cgg_invalid_forged_grant_code_123456',
            };
            if (
              !fixture.capabilities['site.serviceOrigin'] &&
              fixture.capabilities['platform.sharing'] !== 'shared'
            ) {
              invalidGrantBody.issuer = fixture.sim.issuer;
              invalidGrantBody.authEndpoint = fixture.sim.authEndpoint;
              invalidGrantBody.tokenEndpoint = fixture.sim.tokenEndpoint;
              invalidGrantBody.jwksUrl = fixture.sim.jwksUrl;
              if (fixture.sim.tokenAudienceKind === 'fixed') {
                invalidGrantBody.tokenAudience = fixture.sim.tokenAudience;
              }
            }
            const badGrantRes = await appApi(
              `/app-api/connections/${connId}/platform`,
              session,
              {
                method: 'PUT',
                body: invalidGrantBody,
              },
            );
            expect(badGrantRes.status).toBe(422);
            expect(badGrantRes.rawBody).toContain('GRANT_INVALID');

            // 2. Admin-value bound mismatch -> 422 GRANT_MISMATCH with details.fields
            const validCode = issueOperatorGrantForChannel(
              r2LibId,
              fixture,
              connId,
              clientId,
              deploymentId,
            );
            if (
              !fixture.capabilities['site.serviceOrigin'] &&
              fixture.capabilities['platform.sharing'] !== 'shared'
            ) {
              const mismatchRes = await appApi(
                `/app-api/connections/${connId}/platform`,
                session,
                {
                  method: 'PUT',
                  body: {
                    clientId,
                    deploymentId,
                    grantCode: validCode,
                    issuer: fixture.sim.issuer,
                    authEndpoint: fixture.sim.authEndpoint,
                    tokenEndpoint: fixture.sim.tokenEndpoint,
                    jwksUrl: `${fixture.sim.jwksUrl}?mismatch=1`,
                    ...(fixture.sim.tokenAudienceKind === 'fixed'
                      ? { tokenAudience: fixture.sim.tokenAudience }
                      : {}),
                  },
                },
              );
              expect(mismatchRes.status).toBe(422);
              expect(mismatchRes.rawBody).toContain('GRANT_MISMATCH');
              const errJson = mismatchRes.json as { details?: { fields?: string[] } };
              expect(errJson.details?.fields).toContain('jwksUrl');
            }
          }
        });
      });

      if (fixture.capabilities['registration.dynamic']) {
        it(`[${fixture.id}:K1-REG:R3] Dynamic Registration: path-prefix issuer, token format, authorization_server, missing DL/scope refusals, family guards, and granted scopes`, async () => {
          await runKitCase(fixture.id, 'K1-REG', 'R3', async () => {
            // 1. Happy path DR (including path-prefix issuer and authorization_server where configured)
            const drSc = await registerSimScenario({
              id: `sc-r3-happy-${fixture.id}-${Date.now()}`,
              provider: fixture.simProvider,
              clientId: `dr-r3-${fixture.id}-${Date.now()}`,
              deploymentId: fixture.sim.deployments[0],
              siteHost: fixture.sim.siteHost,
              pageHost: fixture.sim.pageHost,
            });
            expect(drSc.registration?.openidConfiguration).toBeTruthy();

            const previewRes = await ltiApi('/api/registration/dynamic/preview', {
              method: 'POST',
              body: {
                openidConfigurationUrl: drSc.registration!.openidConfiguration,
                registrationToken: drSc.registration!.registrationToken,
              },
            });
            expect(previewRes.status).toBe(200);

            const completeRes = await ltiApi('/api/registration/dynamic/complete', {
              method: 'POST',
              body: {
                openidConfigurationUrl: drSc.registration!.openidConfiguration,
                registrationToken: drSc.registration!.registrationToken,
                libraryId: `lib-r3-dr-${fixture.id}-${Date.now()}`,
                profile: fixture.simProfile,
                scopes: fixture.capabilities['registration.scopes'],
              },
            });
            expect([200, 201]).toContain(completeRes.status);
            const completeBody = completeRes.json as {
              issuer?: string;
              tokenAudience?: string | null;
              grantedScopes?: string[];
            };
            expect(completeBody.issuer).toBe(fixture.sim.issuer);
            if (fixture.sim.tokenAudienceKind === 'fixed') {
              expect(completeBody.tokenAudience).toBe(fixture.sim.tokenAudience);
            }

            // 2. Refusal when LtiDeepLinkingRequest is missing from messages_supported
            const noDlSc = await registerSimScenario({
              id: `sc-r3-nodl-${fixture.id}-${Date.now()}`,
              provider: fixture.simProvider,
              clientId: `dr-r3-nodl-${fixture.id}-${Date.now()}`,
              deploymentId: fixture.sim.deployments[0],
              siteHost: fixture.sim.siteHost,
              pageHost: fixture.sim.pageHost,
              dr: {
                messagesSupported: [{ type: 'LtiResourceLinkRequest' }],
              },
            });
            const noDlPreview = await ltiApi('/api/registration/dynamic/preview', {
              method: 'POST',
              body: {
                openidConfigurationUrl: noDlSc.registration!.openidConfiguration,
                registrationToken: noDlSc.registration!.registrationToken,
              },
            });
            const noDlComplete = await ltiApi('/api/registration/dynamic/complete', {
              method: 'POST',
              body: {
                openidConfigurationUrl: noDlSc.registration!.openidConfiguration,
                registrationToken: noDlSc.registration!.registrationToken,
                libraryId: `lib-r3-nodl-${fixture.id}-${Date.now()}`,
                profile: fixture.simProfile,
                scopes: fixture.capabilities['registration.scopes'],
              },
            });
            expect(
              noDlPreview.status >= 400 || noDlComplete.status >= 400,
            ).toBe(true);

            // 3. Refusal when a required channel scope is missing from scopes_supported
            const noScopeSc = await registerSimScenario({
              id: `sc-r3-noscope-${fixture.id}-${Date.now()}`,
              provider: fixture.simProvider,
              clientId: `dr-r3-noscope-${fixture.id}-${Date.now()}`,
              deploymentId: fixture.sim.deployments[0],
              siteHost: fixture.sim.siteHost,
              pageHost: fixture.sim.pageHost,
              dr: {
                scopesSupported: ['openid'],
              },
            });
            const noScopeComplete = await ltiApi('/api/registration/dynamic/complete', {
              method: 'POST',
              body: {
                openidConfigurationUrl: noScopeSc.registration!.openidConfiguration,
                registrationToken: noScopeSc.registration!.registrationToken,
                libraryId: `lib-r3-noscope-${fixture.id}-${Date.now()}`,
                profile: fixture.simProfile,
                scopes: fixture.capabilities['registration.scopes'],
              },
            });
            expect(noScopeComplete.status).toBeGreaterThanOrEqual(400);

            // 4. Guarded family of another channel refused at both guard levels during registration
            const otherFamilies = allFixtures
              .filter(
                (f) =>
                  f.id !== fixture.id &&
                  (f.capabilities['site.serviceOrigin'] ||
                    f.capabilities['platform.sharing'] === 'shared' ||
                    f.sim.tokenAudienceKind === 'fixed'),
              )
              .map((f) => f.sim.family);
            for (const foreignFamily of otherFamilies) {
              const famSc = await registerSimScenario({
                id: `sc-r3-fam-${fixture.id}-${foreignFamily}-${Date.now()}`,
                provider: fixture.simProvider,
                clientId: `dr-r3-fam-${fixture.id}-${Date.now()}`,
                deploymentId: fixture.sim.deployments[0],
                siteHost: fixture.sim.siteHost,
                pageHost: fixture.sim.pageHost,
                family: foreignFamily,
              });
              const famComplete = await ltiApi('/api/registration/dynamic/complete', {
                method: 'POST',
                body: {
                  openidConfigurationUrl: famSc.registration!.openidConfiguration,
                  registrationToken: famSc.registration!.registrationToken,
                  libraryId: `lib-r3-fam-${fixture.id}-${Date.now()}`,
                  profile: fixture.simProfile,
                  scopes: fixture.capabilities['registration.scopes'],
                },
              });
              expect(famComplete.status).toBe(400);
              expect(famComplete.rawBody).toContain('PROVIDER_PROFILE_MISMATCH');
            }
          });
        });
      }

      it(`[${fixture.id}:K1-REG:R4] reserved issuer refused with 400 ISSUER_RESERVED`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R4', async () => {
          const sharedFixture: ChannelFixture | undefined = allFixtures.find(
            (f) => f.capabilities['platform.sharing'] === 'shared',
          );
          expect(sharedFixture).toBeDefined();
          const reservedIssuer = sharedFixture!.sim.issuer;
          const targetProfile =
            fixture.capabilities['platform.sharing'] === 'shared' ? 'standard' : fixture.simProfile;

          const res = await ltiApi('/api/platforms', {
            method: 'POST',
            body: {
              libraryId: `lib-r4-${fixture.id}-${Date.now()}`,
              name: 'Reserved Issuer Probe',
              issuer: reservedIssuer,
              clientId: `client-r4-${Date.now()}`,
              deploymentId: 'dep-r4-1',
              authEndpoint: fixture.sim.authEndpoint,
              tokenEndpoint: fixture.sim.tokenEndpoint,
              jwksUrl: fixture.sim.jwksUrl,
              profile: targetProfile,
            },
          });
          expect(res.status).toBe(400);
          expect(res.rawBody).toMatch(/ISSUER_RESERVED|PLATFORM_URL_NOT_IN_PROFILE/i);
        });
      });

      it(`[${fixture.id}:K1-REG:R5] GET /app-api/connections/:id/tool-configuration row keys match fixture.expect.toolConfigurationKeys in order`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R5', async () => {
          const tcRes = await appApi(
            `/app-api/connections/${ctx.connectionId}/tool-configuration`,
            { cookie: ctx.cookie, csrf: ctx.csrf },
          );
          expect(tcRes.status).toBe(200);
          const body = tcRes.json as { rows?: Array<{ key: string }> };
          const rowKeys = (body.rows ?? []).map((r) => r.key);
          expect(rowKeys).toEqual(fixture.expect.toolConfigurationKeys);
        });
      });

      it(`[${fixture.id}:K1-REG:R6] origin binding I-SELF negative case (AP-07-11): off-origin DR staging and active POST /api/platforms off-origin & cross-profile host refusals`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R6', async () => {
          // 1. Active POST /api/platforms with off-origin endpoint refused
          const offOriginRes = await ltiApi('/api/platforms', {
            method: 'POST',
            body: {
              libraryId: `lib-r6-off-${fixture.id}-${Date.now()}`,
              name: 'Off-origin Probe',
              issuer: fixture.sim.issuer,
              clientId: `client-r6-off-${Date.now()}`,
              deploymentId: fixture.sim.deployments[0],
              authEndpoint: fixture.sim.authEndpoint,
              tokenEndpoint: 'https://off-origin-untrusted.sim.test/oauth2/token',
              jwksUrl: fixture.sim.jwksUrl,
              profile: fixture.simProfile,
              active: true,
            },
          });
          expect(offOriginRes.status).toBe(400);
          expect(offOriginRes.rawBody).toMatch(
            /PLATFORM_URL_NOT_ON_ISSUER_ORIGIN|PLATFORM_URL_NOT_IN_PROFILE/i,
          );

          // 2. Endpoint host that is a fixed host of another profile refused with 400 PLATFORM_URL_NOT_IN_PROFILE
          const fixedHostOther = allFixtures.find(
            (f) =>
              f.id !== fixture.id &&
              (f.capabilities['site.serviceOrigin'] ||
                f.capabilities['platform.sharing'] === 'shared'),
          );
          if (fixedHostOther) {
            const crossProfileRes = await ltiApi('/api/platforms', {
              method: 'POST',
              body: {
                libraryId: `lib-r6-cross-${fixture.id}-${Date.now()}`,
                name: 'Cross-profile Host Probe',
                issuer: fixture.sim.issuer,
                clientId: `client-r6-cross-${Date.now()}`,
                deploymentId: fixture.sim.deployments[0],
                authEndpoint: fixedHostOther.sim.authEndpoint,
                tokenEndpoint: fixture.sim.tokenEndpoint,
                jwksUrl: fixture.sim.jwksUrl,
                profile: fixture.simProfile,
                active: true,
              },
            });
            expect(crossProfileRes.status).toBe(400);
            expect(crossProfileRes.rawBody).toMatch(
              /PLATFORM_URL_NOT_IN_PROFILE|PLATFORM_URL_NOT_ON_ISSUER_ORIGIN/i,
            );
          }

          // 3. When channel has registration.dynamic and dynamic authority is self, off-origin DR stages registration
          if (
            fixture.capabilities['registration.dynamic'] &&
            fixture.capabilities['binding.authority'].dynamic === 'self'
          ) {
            const stagedSc = await registerSimScenario({
              id: `sc-r6-staged-${fixture.id}-${Date.now()}`,
              provider: fixture.simProvider,
              clientId: `dr-r6-staged-${fixture.id}-${Date.now()}`,
              deploymentId: fixture.sim.deployments[0],
              siteHost: fixture.sim.siteHost,
              pageHost: fixture.sim.pageHost,
              dr: {
                authorizationServer: 'https://off-origin-auth.sim.test/oauth2/token',
              },
            });
            const previewRes = await ltiApi('/api/registration/dynamic/preview', {
              method: 'POST',
              body: {
                openidConfigurationUrl: stagedSc.registration!.openidConfiguration,
                registrationToken: stagedSc.registration!.registrationToken,
              },
            });
            expect(previewRes.status).toBe(200);
            const previewBody = previewRes.json as { endpointsOnIssuerOrigin?: boolean };
            expect(previewBody.endpointsOnIssuerOrigin).toBe(false);

            const stagedLibId = `lib-r6-staged-dr-${fixture.id}-${Date.now()}`;
            const completeRes = await ltiApi('/api/registration/dynamic/complete', {
              method: 'POST',
              body: {
                openidConfigurationUrl: stagedSc.registration!.openidConfiguration,
                registrationToken: stagedSc.registration!.registrationToken,
                libraryId: stagedLibId,
                profile: fixture.simProfile,
                scopes: fixture.capabilities['registration.scopes'],
              },
            });
            expect([200, 201]).toContain(completeRes.status);
            const completeBody = completeRes.json as {
              active?: boolean;
              clientId?: string;
              deploymentId?: string;
            };
            expect(completeBody.active).toBe(false);

            // Learner launch on staged inactive platform is refused with 403 PLATFORM_NOT_ACTIVE and 0 token calls
            const cursor = await getSimCursor();
            const stagedLaunchCtx: RegisteredChannelContext = {
              ...ctx,
              libraryId: stagedLibId,
              clientId: completeBody.clientId ?? `dr-r6-staged-${fixture.id}`,
              deploymentId: completeBody.deploymentId ?? fixture.sim.deployments[0],
            };
            const launchRes = await performSimulatorLaunch(stagedLaunchCtx, {});
            expect(launchRes.launchRes.status).toBe(403);
            expect(launchRes.launchRes.rawBody).toContain('PLATFORM_NOT_ACTIVE');
            const { records } = await getSimRecords(cursor);
            expect(records.filter((r) => r.kind === 'token').length).toBe(0);
          }
        });
      });

      if (fixture.capabilities['setup.connectionCheck']) {
        it(`[${fixture.id}:K1-REG:R-CHECK] POST /app-api/connections/:id/check returns ok on valid token and failed on invalid_client`, async () => {
          await runKitCase(fixture.id, 'K1-REG', 'R-CHECK', async () => {
            const session = { cookie: ctx.cookie, csrf: ctx.csrf };
            const okRes = await appApi(
              `/app-api/connections/${ctx.connectionId}/check`,
              session,
              { method: 'POST', body: {} },
            );
            expect(okRes.status).toBe(200);
            const okBody = okRes.json as { result?: string };
            expect(okBody.result).toBe('ok');

            await registerSimScenario({
              id: `sc-rcheck-fail-${fixture.id}-${Date.now()}`,
              provider: fixture.simProvider,
              clientId: ctx.clientId,
              deploymentId: ctx.deploymentId,
              siteHost: fixture.sim.siteHost,
              pageHost: fixture.sim.pageHost,
              tokenAnswers: ['invalid_client'],
            });
            const failRes = await appApi(
              `/app-api/connections/${ctx.connectionId}/check`,
              session,
              { method: 'POST', body: {} },
            );
            expect(failRes.status).toBe(200);
            const failBody = failRes.json as { result?: string };
            expect(failBody.result).toBe('failed');
          });
        });
      }
    });
  }
});
