import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllChannelFixtures, loadSelectedChannelFixtures } from '../lib/fixtures.js';
import {
  appApi,
  ensureKitRunInitialized,
  getSimRecords,
  isK1SimEnabled,
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

const NRPS_SCOPE =
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';

runSuite('K1-NRPS: Names and Role Provisioning Services 2.0 Suite (all selected channels)', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  for (const fixture of fixtures) {
    describe(`channel: ${fixture.id}`, () => {
      let ctx: RegisteredChannelContext;

      beforeAll(async () => {
        ctx = await setupActiveChannelConnection(fixture, 'nrps');
      });

      it(`[${fixture.id}:K1-NRPS:N1] no token request asks for NRPS scope; setup artifact JSON scopes and DR request scopes have the 4 AGS scopes only`, async () => {
        await runKitCase(fixture.id, 'K1-NRPS', 'N1', async () => {
          expect(fixture.capabilities['registration.scopes']).not.toContain(NRPS_SCOPE);
          expect(fixture.capabilities['registration.scopes'].length).toBe(4);

          const { records } = await getSimRecords(0);
          const channelTokenRecords = records.filter(
            (r) => r.kind === 'token' && r.provider === fixture.simProvider,
          );
          for (const rec of channelTokenRecords) {
            expect(String(rec.scope ?? '')).not.toContain(NRPS_SCOPE);
          }

          const tcRes = await appApi(
            `/app-api/connections/${ctx.connectionId}/tool-configuration`,
            { cookie: ctx.cookie, csrf: ctx.csrf },
          );
          expect(tcRes.status).toBe(200);
          const tcJson = tcRes.json as {
            rows?: Array<{ key: string; value: string }>;
            developerKeyJson?: { scopes?: string[] };
          };

          if (fixture.capabilities['setup.artifacts'].includes('developer-key-json')) {
            const jsonRow = tcJson.rows?.find((r) => r.key === 'lti_json');
            if (jsonRow) {
              const parsed = JSON.parse(jsonRow.value) as { scopes?: string[] };
              expect(parsed.scopes).toEqual(fixture.capabilities['registration.scopes']);
              expect(parsed.scopes).not.toContain(NRPS_SCOPE);
            }
          }

          if (fixture.capabilities['registration.dynamic']) {
            const drSc = await registerSimScenario({
              id: `sc-nrps-dr-${fixture.id}-${Date.now()}`,
              provider: fixture.simProvider,
              clientId: `dr-nrps-${fixture.id}-${Date.now()}`,
              deploymentId: fixture.sim.deployments[0],
              siteHost: fixture.sim.siteHost,
              pageHost: fixture.sim.pageHost,
            });
            if (drSc.registration?.openidConfiguration) {
              const previewRes = await ltiApi('/api/registration/dynamic/preview', {
                method: 'POST',
                body: {
                  openidConfigurationUrl: drSc.registration.openidConfiguration,
                  registrationToken: drSc.registration.registrationToken,
                },
              });
              expect(previewRes.status).toBe(200);
              const completeRes = await ltiApi('/api/registration/dynamic/complete', {
                method: 'POST',
                body: {
                  openidConfigurationUrl: drSc.registration.openidConfiguration,
                  registrationToken: drSc.registration.registrationToken,
                  libraryId: `lib-nrps-dr-${fixture.id}-${Date.now()}`,
                  profile: fixture.simProfile,
                  scopes: fixture.capabilities['registration.scopes'],
                },
              });
              expect([200, 201]).toContain(completeRes.status);
              const afterDr = await getSimRecords(0);
              const drRec = afterDr.records
                .filter((r) => r.kind === 'dr' && r.provider === fixture.simProvider)
                .pop();
              if (drRec?.scope) {
                expect(String(drRec.scope)).not.toContain(NRPS_SCOPE);
              }
            }
          }

          recordRedactedEvidence(`nrps-n1-${fixture.id}`, {
            channelId: fixture.id,
            scopesCount: fixture.capabilities['registration.scopes'].length,
            redacted: true,
          });
        });
      });
    });
  }

  describe('global once-per-run NRPS service verification', () => {
    it('[GLOBAL:K1-NRPS:N2] GET /api/memberships answers without personal fields, refuses 1.0 with 403 SERVICE_NOT_AVAILABLE, and propagates 429 Retry-After', async () => {
      await runKitCase('GLOBAL', 'K1-NRPS', 'N2', async () => {
        const genericFixture =
          allFixtures.find((f) => f.capabilities['content.multiple']) ?? fixtures[0];
        const nrpsLibraryId = `lib-nrps-n2-${Date.now()}`;
        const nrpsClientId = `client-nrps-n2-${Date.now()}`;
        const nrpsDeploymentId = genericFixture.sim.deployments[0];

        const createPlat = await ltiApi('/api/platforms', {
          method: 'POST',
          body: {
            libraryId: nrpsLibraryId,
            name: 'NRPS N2 Platform',
            issuer: genericFixture.sim.issuer,
            clientId: nrpsClientId,
            deploymentId: nrpsDeploymentId,
            authEndpoint: genericFixture.sim.authEndpoint,
            tokenEndpoint: genericFixture.sim.tokenEndpoint,
            jwksUrl: genericFixture.sim.jwksUrl,
            profile: genericFixture.simProfile,
            grantedScopes: [...genericFixture.capabilities['registration.scopes'], NRPS_SCOPE],
          },
        });
        expect([200, 201]).toContain(createPlat.status);

        const nrpsCtx: RegisteredChannelContext = {
          fixture: genericFixture,
          libraryId: nrpsLibraryId,
          cookie: '',
          csrf: '',
          connectionId: '',
          platformId: (createPlat.json as { id?: string })?.id ?? '',
          clientId: nrpsClientId,
          deploymentId: nrpsDeploymentId,
          secondaryDeploymentId: genericFixture.sim.deployments[1] ?? 'dep-2',
          courseId: 'course-nrps-n2',
          secondCourseId: 'course-nrps-n2-b',
          resourceSlug: 'fixture',
          secondResourceSlug: 'fixture-2',
        };

        // 1. Happy path without personal fields
        const launchOk = await performSimulatorLaunch(nrpsCtx, {
          roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          members: [
            {
              user_id: 'learner-nrps-1',
              roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
              status: 'Active',
              name: 'Secret Personal Name',
              given_name: 'Secret',
              family_name: 'Name',
              email: 'secret@sim.test',
            },
          ],
        });
        expect([302, 303]).toContain(launchOk.launchRes.status);

        const memRes = await ltiApi('/api/memberships', {
          method: 'GET',
          headers: { authorization: `Bearer ${launchOk.ltik}` },
        });
        expect(memRes.status).toBe(200);
        const memBody = memRes.json as {
          members?: Array<Record<string, unknown>>;
        };
        expect(Array.isArray(memBody.members)).toBe(true);
        expect(memBody.members?.length).toBeGreaterThanOrEqual(1);
        const firstMember = memBody.members![0];
        expect(firstMember.userId ?? firstMember.user_id).toBe('learner-nrps-1');
        expect(firstMember.name).toBeUndefined();
        expect(firstMember.given_name).toBeUndefined();
        expect(firstMember.family_name).toBeUndefined();
        expect(firstMember.email).toBeUndefined();

        // 2. Refuses service_versions: ['1.0'] with 403 SERVICE_NOT_AVAILABLE
        const launchV1 = await performSimulatorLaunch(nrpsCtx, {
          roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          claims: {
            'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': {
              context_memberships_url: `https://${genericFixture.sim.siteHost}/lti/courses/course-1/memberships`,
              service_versions: ['1.0'],
            },
          },
        });
        const v1Res = await ltiApi('/api/memberships', {
          method: 'GET',
          headers: { authorization: `Bearer ${launchV1.ltik}` },
        });
        expect(v1Res.status).toBe(403);
        expect(v1Res.rawBody).toContain('SERVICE_NOT_AVAILABLE');

        // 3. Propagates 429 Retry-After
        const launch429 = await performSimulatorLaunch(nrpsCtx, {
          roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
          nrpsAnswers: [{ status: 429, retryAfter: 45 }],
        });
        const rateLimitRes = await ltiApi('/api/memberships', {
          method: 'GET',
          headers: { authorization: `Bearer ${launch429.ltik}` },
        });
        expect([429, 503]).toContain(rateLimitRes.status);
        expect(rateLimitRes.headers['retry-after']).toBe('45');
      });
    });
  });
});
