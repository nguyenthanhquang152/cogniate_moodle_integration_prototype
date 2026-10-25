import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clientAssertionAudTrait,
  distinctDrAudience,
  drFamilyGuardRefusedAtComplete,
  isAnyHttpsChannel,
  loadAllChannelFixtures,
  loadSelectedChannelFixtures,
  selectFamilyGuardProbes,
  selectProtocolControlFixture,
  verifyStoredClientAssertionAud,
} from '../lib/fixtures.js';
import {
  admin,
  app,
  APP_ORIGIN,
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
  logEvents,
  ltiRequest,
  noServiceCalls,
  poll,
  publication,
  PublicationRef,
  records,
  retryAfterMs,
  runDynamicRegistrationHandshake,
  runKitCase,
  scenario,
  session,
  newDeploymentId,
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

          // 3. Site URL validation: IP literal, localhost, and own host refused with 422 INVALID_SITE_URL. The site rules
          // apply to every channel except the legacy manual-self channel (cogniate-app-api.md §4.2 and delta §3.1 keep
          // that channel's create unchanged); in fixture terms, the channel whose manual method keeps `self` (load check 6).
          if (fixture.capabilities['binding.authority'].manual !== 'self') {
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

            // 1. Happy-path Dynamic Registration with the simulator issuer (the generic issuer has a path; the
            // tests/sim DR option is `issuer`) and an authorization_server
            // authorization_server = the token URL: it becomes the platform clientAssertionAud, and a value that is not
            // the token URL on the issuer origin would break I-SELF (LA-ADR-02 D5 items 4 and 10).
            const tokenUrl = fixture.sim.tokenEndpoint;
            const drCursor = (await records()).cursor;
            const drOk = await runDynamicRegistrationHandshake(s, fixture, {
              authorizationServer: tokenUrl,
            });
            try {
              expect(drOk.step).toBe('post');
              expect(drOk.response.status).toBe(200);
              expect(htmlText(drOk.response.text)).toContain('Done.');

              // The DR authority of the channel decides the state (cogniate-app-api.md §6 `POST /tool/register`:
              // `registered`; cogniate-app-api-delta.md §5: an operatorGrant DR stays `pending` until a grant).
              const connDetail = await app(
                s,
                'GET',
                `/app-api/connections/${drOk.connection.id}`,
              );
              expectStatus(connDetail, 200);
              const connObj = connDetail.json.connection ?? connDetail.json;
              // Staged when the DR authority is operatorGrant, or when I-SELF fails because the token host is not on the
              // issuer origin (LA-ADR-02 D5 item 10; cogniate-app-api-delta.md §5); else registered and active.
              const staged =
                fixture.capabilities['binding.authority'].dynamic === 'operatorGrant' ||
                new URL(fixture.sim.tokenEndpoint).origin !== new URL(fixture.sim.issuer).origin;
              if (staged) {
                expect(connObj.status).toBe('pending');
                expect(connObj.bindingAuthority).toBe('operatorGrant');
              } else {
                expect(connObj.status).toBe('registered');
              }
              expect(connObj.platform.issuer).toBe(fixture.sim.issuer);

              // The stored audience (LA-ADR-02 D5 item 4; lti-service-api-delta §4.5): `authorization_server` becomes the
              // platform `clientAssertionAud`. The profile trait decides the check (verifyStoredClientAssertionAud): a
              // {platformValue} profile stores exactly the supplied value; a {tokenEndpoint} profile may store none.
              const platId = connObj.platform.id ?? connObj.platform.platformId;
              const platDetail = await admin('GET', `/api/platforms/${platId}`);
              expectStatus(platDetail, 200);
              const storedAud = verifyStoredClientAssertionAud(fixture, tokenUrl, platDetail.json);
              expect(storedAud.error ?? '').toBe('');
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

            // 1b. A distinct, non-default audience on a {platformValue} profile (LA-ADR-02 D2 trait; D5 items 4 and 10): the
            // value is stored exactly, and an audience that is not the token URL breaks I-SELF, so the registration is
            // staged (pending + operatorGrant, inactive platform; cogniate-app-api-delta.md §5).
            if (clientAssertionAudTrait(fixture) === '{platformValue}') {
              const audience = distinctDrAudience(fixture, uniqueId(`aud-${fixture.id}`));
              expect(audience).not.toBe(tokenUrl);
              const drAud = await runDynamicRegistrationHandshake(s, fixture, { authorizationServer: audience });
              try {
                expect(drAud.step).toBe('post');
                expect(drAud.response.status).toBe(200);
                expect(htmlText(drAud.response.text)).toContain(
                  'Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code.',
                );
                const audDetail = await app(s, 'GET', `/app-api/connections/${drAud.connection.id}`);
                expectStatus(audDetail, 200);
                const audConn = audDetail.json.connection ?? audDetail.json;
                expect(audConn.status).toBe('pending');
                expect(audConn.bindingAuthority).toBe('operatorGrant');
                const audPlatId = audConn.platform.id ?? audConn.platform.platformId;
                const audPlat = await admin('GET', `/api/platforms/${audPlatId}`);
                expectStatus(audPlat, 200);
                expect(audPlat.json.active).toBe(false);
                const audStored = verifyStoredClientAssertionAud(fixture, audience, audPlat.json);
                expect(audStored.error ?? '').toBe('');
              } finally {
                await endConnection(s, drAud.connection.id);
              }
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

            // 3–4. Capability checks (LA-ADR-02 D5 item 5; AC-LA-E2-02-05): a configuration without
            // LtiDeepLinkingRequest in messages_supported, or without a channel scope in scopes_supported, gets a refusal
            // page and no registration request. The contract names no code for these two refusals, so the oracle is an
            // error page (status >= 400, `data-error-code`, security.md §2.2), no "Done." text, and no new simulator
            // `registration` record.
            const capabilityRefusals: Array<[string, Record<string, unknown>]> = [
              ['no LtiDeepLinkingRequest', { messagesSupported: ['LtiResourceLinkRequest'] }],
              ['no channel scope', { scopesSupported: ['openid'] }],
            ];
            for (const [label, drPatch] of capabilityRefusals) {
              const refusalCursor = (await records()).cursor;
              const refused = await runDynamicRegistrationHandshake(s, fixture, drPatch);
              try {
                expect(refused.response.status, label).toBeGreaterThanOrEqual(400);
                expect(refused.response.text, label).toMatch(/data-error-code="[A-Z_]+"/);
                expect(htmlText(refused.response.text), label).not.toContain('Done.');
                const regRecs = (await records(refusalCursor)).records.filter((r) => r.kind === 'registration');
                expect(regRecs, label).toEqual([]);
              } finally {
                await endConnection(s, refused.connection.id);
              }
            }

            // 5. Family guard at Dynamic Registration, both guard levels: a configuration whose product_family_code is
            // guarded by another channel (any level) gets the PROVIDER_PROFILE_MISMATCH page (cogniate-app-api-delta.md
            // §5 `/tool/register`; LA-ADR-01 D6). The families come from the declared guard data (expect.guardedFamilies);
            // the simulator option `family` sets the configuration's product_family_code (tests/sim/core/dr.mjs).
            const guardProbes = selectFamilyGuardProbes(fixture, allFixtures).probes.filter(
              (p) => p.foreignFamilyCategory !== 'unguarded',
            );
            expect(guardProbes.length).toBeGreaterThanOrEqual(1);
            for (const probe of guardProbes) {
              const familyCursor = (await records()).cursor;
              const familySince = Date.now();
              const drWrongFamily = await runDynamicRegistrationHandshake(
                s,
                fixture,
                {},
                {},
                { family: probe.foreignFamily },
              );
              try {
                if (drFamilyGuardRefusedAtComplete(fixture, probe, allFixtures)) {
                  // Recorded deviation at a8bbac53 (Architect A1 ruling BD-A1-121; fix planned for LG): a family that
                  // another channel guards at the registration level, on a connection whose DR start rule also lets
                  // the owner channel pass. Exact answer: start 303 to the app confirm page; confirm page 200;
                  // `complete` 400 INVALID_REQUEST with reason `family=<family>` (LTI log registration_rejected); the
                  // app page REGISTRATION_FAILED 502 (app log registration_confirm_rejected, lti_code
                  // INVALID_REQUEST); no registration request at the simulator; no platform; the connection stays
                  // pending with last error REGISTRATION_FAILED.
                  const label = `family ${probe.foreignFamily} (BD-A1-121)`;
                  const reason = `family=${probe.foreignFamily}`;
                  expect(drWrongFamily.start.status, label).toBe(303);
                  expect(
                    new URL(String(drWrongFamily.start.headers?.location), APP_ORIGIN).pathname,
                    label,
                  ).toBe('/tool/register');
                  expect(drWrongFamily.step, label).toBe('post');
                  expect(drWrongFamily.getPage?.status, label).toBe(200);
                  expect(drWrongFamily.response.status, label).toBe(502);
                  expect(drWrongFamily.response.text, label).toContain('data-error-code="REGISTRATION_FAILED"');
                  await poll(
                    async () =>
                      logEvents(
                        'registration_rejected',
                        familySince,
                        { code: 'INVALID_REQUEST', detail: reason },
                        'lti-service',
                      ),
                    (events) => events.length >= 1,
                    10_000,
                    200,
                  );
                  await poll(
                    async () =>
                      logEvents(
                        'registration_confirm_rejected',
                        familySince,
                        { code: 'REGISTRATION_FAILED', lti_code: 'INVALID_REQUEST' },
                        'cogniate-app',
                      ),
                    (events) => events.length >= 1,
                    10_000,
                    200,
                  );
                  const regRecs = (await records(familyCursor)).records.filter((r) => r.kind === 'registration');
                  expect(regRecs, label).toEqual([]);
                  const refusedDetail = await app(s, 'GET', `/app-api/connections/${drWrongFamily.connection.id}`);
                  expectStatus(refusedDetail, 200);
                  const refusedConn = refusedDetail.json.connection ?? refusedDetail.json;
                  expect(refusedConn.status, label).toBe('pending');
                  expect(refusedConn.lastError?.code, label).toBe('REGISTRATION_FAILED');
                  expect(refusedConn.platform ?? null, label).toBeNull();
                } else {
                  expect(drWrongFamily.response.status).toBeGreaterThanOrEqual(400);
                  expect(drWrongFamily.response.text).toContain(
                    'data-error-code="PROVIDER_PROFILE_MISMATCH"',
                  );
                }
              } finally {
                await endConnection(s, drWrongFamily.connection.id);
              }
            }
          });
        });
      }

      it(`${fixture.id}:K1-REG:R4 — Reserved issuer refused with 400 ISSUER_RESERVED`, async () => {
        await runKitCase(fixture.id, 'K1-REG', 'R4', async () => {
          // The reserved-issuer rule belongs to the profiles that take an issuer and endpoints (lti-service-api-delta
          // §4.6.1 rule 3, "as for standard"): the channel's own profile when it takes admin endpoints, else the
          // generic path (the protocol-control fixture). A `standard`-shaped profile (manual `self`) checks the issuer
          // origin of each endpoint first, so its endpoints sit on the reserved issuer's origin.
          const adminPath = isAnyHttpsChannel(fixture) || fixture.capabilities['binding.authority'].manual === 'self'
            ? fixture
            : selectProtocolControlFixture(allFixtures);
          const reservedFixtures = getReservedIssuerFixtures(allFixtures, adminPath.id);
          expect(reservedFixtures.length).toBeGreaterThanOrEqual(1);
          for (const reserved of reservedFixtures) {
            const endpointBase =
              adminPath.capabilities['binding.authority'].manual === 'self'
                ? new URL(reserved.sim.issuer).origin
                : null;
            const res = await admin('POST', '/api/platforms', {
              name: `Reserved ${reserved.id} on ${adminPath.id}`,
              url: reserved.sim.issuer,
              clientId: uniqueId('reserved-client'),
              authenticationEndpoint: endpointBase ? `${endpointBase}/kit/auth` : adminPath.sim.authEndpoint,
              accesstokenEndpoint: endpointBase ? `${endpointBase}/kit/token` : adminPath.sim.tokenEndpoint,
              authConfig: {
                method: 'JWK_SET',
                key: endpointBase ? `${endpointBase}/kit/jwks` : adminPath.sim.jwksUrl,
              },
              profile: adminPath.simProfile,
              deploymentIds: [adminPath.sim.deployments[0]],
            });
            expect(res.status).toBe(400);
            expect(['ISSUER_RESERVED', 'PLATFORM_URL_NOT_IN_PROFILE']).toContain(
              res.json?.details?.message,
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
          // The I-SELF origin-binding rules belong to profiles with `endpointOrigins: any-https` (TEST-STRATEGY §2.4 R6;
          // LA-ADR-02 D2a). A channel whose own profile is fixed or issuer-bound runs R6 on the generic path (the
          // protocol-control fixture), so the case keeps its meaning on every channel.
          const target = isAnyHttpsChannel(fixture) ? fixture : selectProtocolControlFixture(allFixtures);
          const targetBinding: ChannelBinding =
            target === fixture
              ? binding
              : { ...binding, fixture: target, siteHost: target.sim.siteHost, pageHost: target.sim.pageHost };
          // 1. Dynamic Registration off-origin staging (AP-07-11; lti-service-api-delta.md §4.5; cogniate-app-api-delta.md §3.2)
          if (
            target.capabilities['registration.dynamic'] &&
            target.capabilities['binding.authority'].dynamic === 'self'
          ) {
            const s = await session('A');

            // 1a. Off-origin token_endpoint via /tool/register stages the connection as pending + operatorGrant
            const staged = await runDynamicRegistrationHandshake(s, target, {
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
                target.sim.deployments[0];

              // Launch against the staged (inactive) platform is refused with 403 PLATFORM_NOT_ACTIVE and zero outbound calls
              const cursor = (await records()).cursor;
              const unapprovedLaunch = await launchOnChannel(targetBinding, {
                clientId: stagedPlat.clientId,
                deploymentId: stagedDepId,
                resource: pub.id,
              });
              denied(unapprovedLaunch.response, 'PLATFORM_NOT_ACTIVE', 403);
              await noServiceCalls(cursor);

              // Operator grant with --accept-staged --confirm-foreign-hosts activates the staged platform
              const grant = await issueOperatorGrantForChannel(
                String(s.library?.id ?? s.library),
                target,
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
            const offAuthSc = await scenario(target.simProvider, {
              clientId: uniqueId(`dr-off-${target.id}`),
              deploymentId: newDeploymentId(target, 'dr-off-dep'),
              siteHost: target.sim.siteHost,
              dr: {
                authorizationServer: 'https://off-origin-auth.sim.test/oauth2/token',
              },
            });
            const regStartPath = `/lti/register/cogniate?openid_configuration=${encodeURIComponent(
              offAuthSc.registration.openidConfiguration,
            )}&registration_token=${encodeURIComponent(
              offAuthSc.registration.registrationToken,
            )}`;
            let regStartRes = await ltiRequest('GET', regStartPath, {
              headers: { accept: 'text/html' },
            });
            for (let attempt = 0; regStartRes.status === 429 && attempt < 3; attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, retryAfterMs(regStartRes as never)));
              regStartRes = await ltiRequest('GET', regStartPath, {
                headers: { accept: 'text/html' },
              });
            }
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
                profile: target.simProfile,
                scopes: target.capabilities['registration.scopes'],
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
            name: `Off-origin ${target.id}`,
            url: `${target.sim.issuer}/r6-off-origin`,
            clientId: uniqueId('r6-off-client'),
            authenticationEndpoint: target.sim.authEndpoint,
            accesstokenEndpoint: 'https://off-origin-untrusted.sim.test/oauth2/token',
            authConfig: {
              method: 'JWK_SET',
              key: target.sim.jwksUrl,
            },
            profile: target.simProfile,
            deploymentIds: [target.sim.deployments[0]],
            active: true,
          });
          expect(offOriginRes.status).toBe(400);
          expect(['PLATFORM_URL_NOT_ON_ISSUER_ORIGIN', 'PLATFORM_URL_NOT_IN_PROFILE']).toContain(
            offOriginRes.json?.details?.message,
          );

          // 3. Active POST /api/platforms with an endpoint host belonging to another fixed-host profile -> 400 PLATFORM_URL_NOT_IN_PROFILE
          const fixedHostOther = getReservedIssuerFixtures(allFixtures, target.id)[0];
          if (fixedHostOther) {
            const crossHostRes = await admin('POST', '/api/platforms', {
              name: `Cross-host ${target.id}`,
              url: `${target.sim.issuer}/r6-cross-host`,
              clientId: uniqueId('r6-cross-client'),
              authenticationEndpoint: fixedHostOther.sim.authEndpoint,
              accesstokenEndpoint: target.sim.tokenEndpoint,
              authConfig: {
                method: 'JWK_SET',
                key: target.sim.jwksUrl,
              },
              profile: target.simProfile,
              deploymentIds: [target.sim.deployments[0]],
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

            // 2. The simulator token endpoint answers invalid_client (tests/sim option `tokenAnswers`, persistent) for a
            // second connection of this channel (one check per platform and deployment per minute, lti-service-api-delta
            // §2.6) -> result 'failed', details.token.ok false, details.token.detail 'invalid_client'.
            const isShared = fixture.capabilities['platform.sharing'] === 'shared';
            const bad = await setupChannelBinding(fixture, {
              library: 'A',
              clientId: isShared ? binding.clientId : uniqueId(`c-check-${fixture.id}`),
              deploymentId: newDeploymentId(fixture, `dep-check-${fixture.id}`),
            });
            try {
              await scenario(fixture.simProvider, {
                clientId: bad.clientId,
                deploymentId: bad.deploymentId,
                siteHost: bad.siteHost,
                pageHost: bad.pageHost,
                tokenAnswers: [{ status: 400, error: 'invalid_client', persistent: true }],
              });
              const failCheck = await app(
                bad.session,
                'POST',
                `/app-api/connections/${bad.connection.id}/check`,
                {},
              );
              expectStatus(failCheck, 200);
              expect(failCheck.json.result).toBe('failed');
              expect(failCheck.json.details.token.ok).toBe(false);
              expect(failCheck.json.details.token.detail).toBe('invalid_client');
            } finally {
              await endConnection(bad.session, bad.connection.id);
            }
          });
        });
      }
    });
  }
});
