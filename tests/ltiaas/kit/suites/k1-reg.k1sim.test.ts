import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadAllChannelFixtures,
  loadSelectedChannelFixtures,
} from '../lib/fixtures.js';
import {
  admin,
  app,
  buildOperatorGrantCliArgs,
  ChannelBinding,
  cli,
  denied,
  endConnection,
  ensureKitRunInitialized,
  expectStatus,
  fetchSetupArtifactConfig,
  getAlternateDrTokenFormat,
  getReservedIssuerFixtures,
  htmlText,
  issueOperatorGrantForChannel,
  launchOnChannel,
  ltiRequest,
  noServiceCalls,
  publication,
  PublicationRef,
  records,
  runDynamicRegistrationHandshake,
  runKitCase,
  scenario,
  session,
  setupChannelBinding,
  uniqueId,
} from '../lib/runtime.js';

const fixtures = loadSelectedChannelFixtures();
const allFixtures = loadAllChannelFixtures();

describe('K1-REG — Port 2 Registration & Connection Setup across selected channels', () => {
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

      it(`${fixture.id}:K1-REG:R1 — Manual setup with manifest required fields; strict body refuses unknown or missing field; POST /app-api/connections refuses IP literal, localhost, and own host (422 INVALID_SITE_URL)`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R1', async () => {
          const s = binding.session;

          // 1. Setup artifacts check (cogniate-app-api-delta.md §3.6)
          if (fixture.capabilities['setup.artifacts'].length > 0) {
            const artUrl = await fetchSetupArtifactConfig(s, binding.connection.id, 'url');
            expectStatus(artUrl, 200);
            expect(artUrl.json.public_jwk_url).toBeTruthy();

            const artInline = await fetchSetupArtifactConfig(
              s,
              binding.connection.id,
              'inline',
            );
            expectStatus(artInline, 200);
            expect(artInline.json.public_jwk?.kty).toBe('RSA');
          }

          // 2. Strict body validation on PUT /app-api/connections/:id/platform (cogniate-app-api.md §4.4; cogniate-app-api-delta.md §3.4)
          const tempCreated = await app(s, 'POST', '/app-api/connections', {
            name: `Strict R1 ${fixture.id}`,
            lms: fixture.id,
            method: 'manual',
            siteUrl: fixture.sim.siteUrl,
            ...(fixture.simProfile ? { profile: fixture.simProfile } : {}),
            ...(fixture.capabilities['site.serviceOrigin']
              ? { serviceUrl: fixture.sim.serviceUrl }
              : {}),
          });
          expectStatus(tempCreated, 201);
          const tempConnId = (tempCreated.json.connection ?? tempCreated.json).id as string;

          try {
            const unknownFieldRes = await app(
              s,
              'PUT',
              `/app-api/connections/${tempConnId}/platform`,
              {
                clientId: uniqueId('strict-client'),
                deploymentId: fixture.sim.deployments[0],
                unexpectedExtraField: 'not-allowed',
              },
            );
            expectStatus(unknownFieldRes, 422, 'INVALID_PLATFORM_VALUES');

            const missingFieldRes = await app(
              s,
              'PUT',
              `/app-api/connections/${tempConnId}/platform`,
              {
                deploymentId: fixture.sim.deployments[0],
              },
            );
            expectStatus(missingFieldRes, 422, 'INVALID_PLATFORM_VALUES');
          } finally {
            await endConnection(s, tempConnId);
          }

          // 3. Site URL validation: IP literal, localhost, and own host refused with 422 INVALID_SITE_URL (cogniate-app-api-delta.md §3.1)
          for (const badSiteUrl of [
            'https://127.0.0.1',
            'https://localhost',
            'https://app.cogniate.test',
            'https://lti.cogniate.test',
          ]) {
            const badRes = await app(s, 'POST', '/app-api/connections', {
              name: `Bad Site ${fixture.id}`,
              lms: fixture.id,
              method: 'manual',
              siteUrl: badSiteUrl,
              ...(fixture.simProfile ? { profile: fixture.simProfile } : {}),
            });
            expectStatus(badRes, 422, 'INVALID_SITE_URL');
          }
        });
      });

      if (fixture.capabilities['deployments.multiple']) {
        it(`${fixture.id}:K1-REG:R1-DEPLOYMENTS — Adding a second deployment on one registration succeeds when deployments.multiple is true`, async () => {
          await runKitCase(fixture.id, 'K1-REG', 'R1-DEPLOYMENTS', async () => {
            const s = binding.session;
            const secondDep = binding.secondaryDeploymentId;
            const addBody: Record<string, unknown> = {
              deploymentId: secondDep,
            };
            if (fixture.capabilities['binding.authority'].manual === 'operatorGrant') {
              const grant = await issueOperatorGrantForChannel(
                binding.library,
                fixture,
                binding.connection.id,
                binding.clientId,
                secondDep,
                { purpose: 'add_deployment' },
              );
              addBody.grantCode = grant.code;
            }
            // POST /app-api/connections/:id/deployments -> 200 Connection DTO (cogniate-app-api.md §4.7.2; cogniate-app-api-delta.md §3.5)
            const added = await app(
              s,
              'POST',
              `/app-api/connections/${binding.connection.id}/deployments`,
              addBody,
            );
            expectStatus(added, 200);
            const addedConn = added.json.connection ?? added.json;
            expect(addedConn.platform.deploymentIds).toContain(secondDep);

            const secondLaunch = await launchOnChannel(binding, {
              resource: pub.id,
              deploymentId: secondDep,
            });
            expect(secondLaunch.response.status).toBe(303);
          });
        });
      }

      it(`${fixture.id}:K1-REG:R2 — Authority: operatorGrant happy path + 403 GRANT_INVALID + 422 GRANT_MISMATCH (details.fields), or self-only refusal on app:grant issue`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R2', async () => {
          const s = binding.session;
          if (fixture.capabilities['binding.authority'].manual === 'operatorGrant') {
            const created = await app(s, 'POST', '/app-api/connections', {
              name: `R2 Grant ${fixture.id}`,
              lms: fixture.id,
              method: 'manual',
              siteUrl: fixture.sim.siteUrl,
              ...(fixture.simProfile ? { profile: fixture.simProfile } : {}),
              ...(fixture.capabilities['site.serviceOrigin']
                ? { serviceUrl: fixture.sim.serviceUrl }
                : {}),
            });
            expectStatus(created, 201);
            const connId = (created.json.connection ?? created.json).id as string;
            const isShared = fixture.capabilities['platform.sharing'] === 'shared';
            const clientId = isShared
              ? binding.clientId
              : uniqueId(`r2-client-${fixture.id}`);
            const depId = uniqueId(`r2-dep-${fixture.id}`);

            const basePlatformBody: Record<string, unknown> = {
              clientId,
              deploymentId: depId,
            };
            if (!fixture.capabilities['site.serviceOrigin'] && !isShared) {
              basePlatformBody.issuer = fixture.sim.issuer;
              basePlatformBody.authenticationEndpoint = fixture.sim.authEndpoint;
              basePlatformBody.accessTokenEndpoint = fixture.sim.tokenEndpoint;
              basePlatformBody.jwksUrl = fixture.sim.jwksUrl;
              if (fixture.sim.tokenAudienceKind === 'fixed') {
                basePlatformBody.tokenAudience = Array.isArray(fixture.sim.tokenAudience)
                  ? fixture.sim.tokenAudience[0]
                  : fixture.sim.tokenAudience;
              }
            }

            try {
              // 1. Bogus grant code -> 403 GRANT_INVALID (cogniate-app-api.md §4.7.1)
              const badCodeRes = await app(
                s,
                'PUT',
                `/app-api/connections/${connId}/platform`,
                {
                  ...basePlatformBody,
                  grantCode: 'A'.repeat(43),
                },
              );
              expectStatus(badCodeRes, 403, 'GRANT_INVALID');

              // 2. Valid grant redeemed with mismatched deploymentId -> 422 GRANT_MISMATCH with details.fields
              const validGrant = await issueOperatorGrantForChannel(
                binding.library,
                fixture,
                connId,
                clientId,
                depId,
                { purpose: 'initial' },
              );
              const mismatchRes = await app(
                s,
                'PUT',
                `/app-api/connections/${connId}/platform`,
                {
                  ...basePlatformBody,
                  deploymentId: `${depId}-wrong`,
                  grantCode: validGrant.code,
                },
              );
              expectStatus(mismatchRes, 422, 'GRANT_MISMATCH');
              expect(mismatchRes.json?.details?.fields).toContain('deploymentId');

              // 3. Redeem with matching fields -> 200 registered
              const okRes = await app(
                s,
                'PUT',
                `/app-api/connections/${connId}/platform`,
                {
                  ...basePlatformBody,
                  grantCode: validGrant.code,
                },
              );
              expectStatus(okRes, 200);
              expect((okRes.json.connection ?? okRes.json).status).toBe('registered');
            } finally {
              await endConnection(s, connId);
            }
          } else {
            // Self-authority channel: app:grant issue refuses self-authority channels (cogniate-app-api-delta.md §4)
            const args = buildOperatorGrantCliArgs(
              binding.library,
              fixture,
              binding.connection.id,
              binding.clientId,
              binding.deploymentId,
              { purpose: 'initial' },
            );
            const cliRes = await cli('app:grant', args);
            expect(cliRes.exitCode).not.toBe(0);
          }
        });
      });

      if (fixture.capabilities['registration.dynamic']) {
        it(`${fixture.id}:K1-REG:R3 — Dynamic Registration: path-prefix issuer, opaque-bearer or scope-jwt token, authorization_server stored as token audience, refusal on missing DL or scope, family guard at both levels, granted scopes stored`, async () => {
          await runKitCase(fixture.id, 'K1-REG', 'R3', async () => {
            const s = await session('A');

            // 1. Happy-path Dynamic Registration with path-prefix issuer and authorization_server
            const customAuthServer = `${fixture.sim.siteUrl}/oauth2/token-aud`;
            const drCursor = (await records()).cursor;
            const drOk = await runDynamicRegistrationHandshake(s, fixture, {
              issuerPath: '/subpath',
              authorizationServer: customAuthServer,
            });
            try {
              expect(drOk.step).toBe('post');
              expect(drOk.response.status).toBe(200);
              expect(htmlText(drOk.response.text)).toContain(
                'Done. Return to your LMS to finish.',
              );

              const connDetail = await app(
                s,
                'GET',
                `/app-api/connections/${drOk.connection.id}`,
              );
              expectStatus(connDetail, 200);
              const connObj = connDetail.json.connection ?? connDetail.json;
              expect(connObj.status).toBe('registered');
              expect(connObj.platform.issuer).toBe(
                `${fixture.sim.siteUrl}/subpath`,
              );

              // Verify platform record in lti-service stores tokenAudience = authorization_server and simulator recorded scopes
              const platId = connObj.platform.id ?? connObj.platform.platformId;
              const platDetail = await admin('GET', `/api/platforms/${platId}`);
              expectStatus(platDetail, 200);
              expect(
                platDetail.json.tokenAudience ?? platDetail.json.authorizationServer,
              ).toBe(customAuthServer);
              const drRecs = (await records(drCursor)).records.filter(
                (r) => r.kind === 'registration',
              );
              expect(drRecs.length).toBeGreaterThanOrEqual(1);
              const lastReg = drRecs.at(-1)!;
              expect(lastReg.scopes).toEqual(
                expect.arrayContaining(fixture.capabilities['registration.scopes']),
              );
            } finally {
              await endConnection(s, drOk.connection.id);
            }

            // 2. Alternate registration token format (opaque-bearer vs scope-jwt)
            const altFormat = getAlternateDrTokenFormat(fixture);
            const drAlt = await runDynamicRegistrationHandshake(s, fixture, {
              tokenFormat: altFormat,
            });
            try {
              expect(drAlt.step).toBe('post');
              expect(drAlt.response.status).toBe(200);
            } finally {
              await endConnection(s, drAlt.connection.id);
            }

            // 3. Refusal when LtiDeepLinkingRequest is missing from messages_supported
            const drNoDl = await runDynamicRegistrationHandshake(s, fixture, {
              messagesSupported: ['LtiResourceLinkRequest'],
            });
            try {
              expect(drNoDl.response.status).toBe(400);
              expect(drNoDl.response.text).toContain(
                'data-error-code="PLATFORM_CONFIGURATION_INVALID"',
              );
            } finally {
              await endConnection(s, drNoDl.connection.id);
            }

            // 4. Refusal when required AGS scope is missing from scopes_supported
            const drNoScope = await runDynamicRegistrationHandshake(s, fixture, {
              scopesSupported: ['openid'],
            });
            try {
              expect(drNoScope.response.status).toBe(400);
              expect(drNoScope.response.text).toContain(
                'data-error-code="PLATFORM_CONFIGURATION_INVALID"',
              );
            } finally {
              await endConnection(s, drNoScope.connection.id);
            }

            // 5. Family guard at Dynamic Registration (product_family_code mismatch)
            const otherFamily = allFixtures.find(
              (f) => f.sim.family !== fixture.sim.family,
            )!.sim.family;
            const drWrongFamily = await runDynamicRegistrationHandshake(s, fixture, {
              productFamilyCode: otherFamily,
            });
            try {
              if (fixture.simProfile === 'standard') {
                expect(drWrongFamily.response.status).toBe(200);
              } else {
                expect(drWrongFamily.response.status).toBe(400);
                expect(drWrongFamily.response.text).toContain(
                  'data-error-code="PROVIDER_PROFILE_MISMATCH"',
                );
              }
            } finally {
              await endConnection(s, drWrongFamily.connection.id);
            }
          });
        });
      }

      it(`${fixture.id}:K1-REG:R4 — Reserved issuer refused with 400 ISSUER_RESERVED`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R4', async () => {
          const reservedFixtures = getReservedIssuerFixtures(allFixtures, fixture.id);
          for (const reserved of reservedFixtures) {
            // POST /api/platforms with reserved issuer -> 400 ISSUER_RESERVED (lti-service-api-delta.md §2.4)
            const res = await admin('POST', '/api/platforms', {
              name: `Reserved ${reserved.id} on ${fixture.id}`,
              url: reserved.sim.issuer,
              clientId: uniqueId('reserved-client'),
              authenticationEndpoint: fixture.sim.authEndpoint,
              accesstokenEndpoint: fixture.sim.tokenEndpoint,
              authConfig: {
                method: 'JWK_SET',
                key: fixture.sim.jwksUrl,
              },
              profile: fixture.simProfile,
              deploymentIds: [fixture.sim.deployments[0]],
            });
            expect(res.status).toBe(400);
            expect(['ISSUER_RESERVED', 'PLATFORM_URL_NOT_IN_PROFILE']).toContain(
              res.json?.error?.code,
            );
          }
        });
      });

      it(`${fixture.id}:K1-REG:R5 — GET /app-api/connections/:id/tool-configuration row keys match fixture.expect.toolConfigurationKeys in order`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R5', async () => {
          // GET /app-api/connections/:id/tool-configuration (cogniate-app-api.md §4.6; cogniate-app-api-delta.md §3.6)
          const res = await app(
            binding.session,
            'GET',
            `/app-api/connections/${binding.connection.id}/tool-configuration`,
          );
          expectStatus(res, 200);
          const rows = (
            Array.isArray(res.json) ? res.json : res.json.fields
          ) as Array<{ key: string }>;
          const keys = rows.map((f) => f.key);
          expect(keys).toEqual(fixture.expect.toolConfigurationKeys);
        });
      });

      it(`${fixture.id}:K1-REG:R6 — Origin binding I-SELF negative case (AP-07-11): off-origin DR stages registration (endpointsOnIssuerOrigin: false, active: false, operatorGrant, 403 PLATFORM_NOT_ACTIVE); active POST /api/platforms refuses off-origin (400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN) and cross-profile host (400 PLATFORM_URL_NOT_IN_PROFILE)`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R6', async () => {
          // 1. Dynamic Registration off-origin staging (AP-07-11; lti-service-api-delta.md §4.5; cogniate-app-api-delta.md §3.2)
          if (
            fixture.capabilities['registration.dynamic'] &&
            fixture.capabilities['binding.authority'].dynamic === 'self'
          ) {
            const s = await session('A');

            // 1a. Off-origin token_endpoint via /tool/register stages the connection as pending + operatorGrant
            const staged = await runDynamicRegistrationHandshake(s, fixture, {
              secondTokenHost: true,
            });
            try {
              expect(staged.step).toBe('post');
              expect(staged.response.status).toBe(200);
              expect(htmlText(staged.response.text)).toContain(
                'Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code.',
              );

              const connDetail = await app(
                s,
                'GET',
                `/app-api/connections/${staged.connection.id}`,
              );
              expectStatus(connDetail, 200);
              const connObj = connDetail.json.connection ?? connDetail.json;
              expect(connObj.status).toBe('pending');
              expect(connObj.bindingAuthority).toBe('operatorGrant');

              const stagedPlat = connObj.platform;
              const stagedDepId =
                stagedPlat.deploymentId ??
                stagedPlat.deploymentIds?.[0] ??
                fixture.sim.deployments[0];

              // Launch against the staged (inactive) platform is refused with 403 PLATFORM_NOT_ACTIVE and zero outbound calls
              const cursor = (await records()).cursor;
              const unapprovedLaunch = await launchOnChannel(binding, {
                clientId: stagedPlat.clientId,
                deploymentId: stagedDepId,
                resource: pub.id,
              });
              denied(unapprovedLaunch.response, 'PLATFORM_NOT_ACTIVE', 403);
              await noServiceCalls(cursor);

              // Operator grant with --accept-staged --confirm-foreign-hosts activates the staged platform
              const grant = await issueOperatorGrantForChannel(
                String(s.library?.id ?? s.library),
                fixture,
                staged.connection.id,
                stagedPlat.clientId,
                stagedDepId,
                { acceptStaged: true },
              );
              const redeemed = await app(
                s,
                'PUT',
                `/app-api/connections/${staged.connection.id}/platform`,
                {
                  clientId: stagedPlat.clientId,
                  deploymentId: stagedDepId,
                  grantCode: grant.code,
                },
              );
              expectStatus(redeemed, 200);
              expect((redeemed.json.connection ?? redeemed.json).status).toBe(
                'registered',
              );
            } finally {
              await endConnection(s, staged.connection.id);
            }

            // 1b. Direct lti-service GET /lti/register/cogniate + GET /api/registrations/:id + POST /api/registrations/:id/complete
            // with off-origin authorization_server (lti-service-api.md §2.4, §3.8; lti-service-api-delta.md §4.5)
            const offAuthSc = await scenario(fixture.simProvider, {
              dr: {
                authorizationServer: 'https://off-origin-auth.sim.test/oauth2/token',
              },
            });
            const regStartPath = `/lti/register/cogniate?openid_configuration=${encodeURIComponent(
              offAuthSc.registration.openidConfiguration,
            )}&registration_token=${encodeURIComponent(
              offAuthSc.registration.registrationToken,
            )}`;
            const regStartRes = await ltiRequest('GET', regStartPath, {
              headers: { accept: 'text/html' },
            });
            expect(regStartRes.status).toBe(303);
            const redirectUrl = new URL(
              String(regStartRes.headers.location),
              'https://app.cogniate.test',
            );
            const registrationId = redirectUrl.searchParams.get('registrationId');
            expect(registrationId).toBeTruthy();

            const previewRes = await admin(
              'GET',
              `/api/registrations/${registrationId}`,
            );
            expectStatus(previewRes, 200);
            expect(previewRes.json.endpointsOnIssuerOrigin).toBe(false);

            const completeRes = await admin(
              'POST',
              `/api/registrations/${registrationId}/complete`,
              {
                profile: fixture.simProfile,
                scopes: fixture.capabilities['registration.scopes'],
                bindingRef: uniqueId('bref-r6'),
              },
            );
            expectStatus(completeRes, 200);
            expect(completeRes.json.active).toBe(false);
            if (completeRes.json.platformId) {
              await admin('DELETE', `/api/platforms/${completeRes.json.platformId}`);
            }
          }

          // 2. Active POST /api/platforms with off-origin endpoint without confirmForeignHosts refused (lti-service-api-delta.md §2.4)
          const offOriginRes = await admin('POST', '/api/platforms', {
            name: `Off-origin ${fixture.id}`,
            url: `${fixture.sim.issuer}/r6-off-origin`,
            clientId: uniqueId('r6-off-client'),
            authenticationEndpoint: fixture.sim.authEndpoint,
            accesstokenEndpoint: 'https://off-origin-untrusted.sim.test/oauth2/token',
            authConfig: {
              method: 'JWK_SET',
              key: fixture.sim.jwksUrl,
            },
            profile: fixture.simProfile,
            deploymentIds: [fixture.sim.deployments[0]],
            active: true,
          });
          expect(offOriginRes.status).toBe(400);
          expect(['PLATFORM_URL_NOT_ON_ISSUER_ORIGIN', 'PLATFORM_URL_NOT_IN_PROFILE']).toContain(
            offOriginRes.json?.error?.code,
          );

          // 3. Active POST /api/platforms with an endpoint host belonging to another fixed-host profile -> 400 PLATFORM_URL_NOT_IN_PROFILE
          const fixedHostOther = getReservedIssuerFixtures(allFixtures, fixture.id)[0];
          if (fixedHostOther) {
            const crossHostRes = await admin('POST', '/api/platforms', {
              name: `Cross-host ${fixture.id}`,
              url: `${fixture.sim.issuer}/r6-cross-host`,
              clientId: uniqueId('r6-cross-client'),
              authenticationEndpoint: fixedHostOther.sim.authEndpoint,
              accesstokenEndpoint: fixture.sim.tokenEndpoint,
              authConfig: {
                method: 'JWK_SET',
                key: fixture.sim.jwksUrl,
              },
              profile: fixture.simProfile,
              deploymentIds: [fixture.sim.deployments[0]],
              active: true,
            });
            expectStatus(crossHostRes, 400, 'PLATFORM_URL_NOT_IN_PROFILE');
          }
        });
      });

      if (fixture.capabilities['setup.connectionCheck']) {
        it(`${fixture.id}:K1-REG:R-CHECK — Connection check POST /app-api/connections/:id/check returns ok on valid credentials and failed on invalid_client`, async () => {
          await runKitCase(fixture.id, 'K1-REG', 'R-CHECK', async () => {
            const s = binding.session;

            // 1. Valid credentials -> result === 'ok' (cogniate-app-api-delta.md §3.7; lti-service-api-delta.md §2.6)
            const okCheck = await app(
              s,
              'POST',
              `/app-api/connections/${binding.connection.id}/check`,
              {},
            );
            expectStatus(okCheck, 200);
            expect(okCheck.json.result ?? okCheck.json.check?.status).toBe('ok');
            const okDetails = okCheck.json.details ?? okCheck.json.check?.steps;
            expect(okDetails.jwks.ok).toBe(true);
            expect(okDetails.token.ok).toBe(true);

            // 2. Simulator tokenError: 'invalid_client' -> result === 'failed'
            await scenario(fixture.simProvider, {
              clientId: binding.clientId,
              deploymentId: binding.deploymentId,
              tokenError: 'invalid_client',
            });
            try {
              const failCheck = await app(
                s,
                'POST',
                `/app-api/connections/${binding.connection.id}/check`,
                {},
              );
              expectStatus(failCheck, 200);
              expect(failCheck.json.result ?? failCheck.json.check?.status).toBe('failed');
              const failDetails = failCheck.json.details ?? failCheck.json.check?.steps;
              expect(failDetails.token.ok).toBe(false);
              expect(
                failDetails.token.detail ?? failDetails.token.errorCode,
              ).toBeTruthy();
            } finally {
              await scenario(fixture.simProvider, {
                clientId: binding.clientId,
                deploymentId: binding.deploymentId,
                tokenError: null,
              });
            }
          });
        });
      }
    });
  }
});
