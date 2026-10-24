import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadAllChannelFixtures,
  loadSelectedChannelFixtures,
  selectProtocolControlFixture,
} from '../lib/fixtures.js';
import {
  admin,
  ChannelBinding,
  commitGrade,
  endConnection,
  ensureKitRunInitialized,
  expectStatus,
  fetchSetupArtifactConfig,
  host,
  idToken,
  launchOnChannel,
  openPlayOnChannel,
  publication,
  PublicationRef,
  records,
  ROLE_INSTRUCTOR,
  ROLE_LEARNER,
  runDynamicRegistrationHandshake,
  runKitCase,
  service,
  session,
  setupChannelBinding,
  uniqueId,
  waitSync,
} from '../lib/runtime.js';

const fixtures = loadSelectedChannelFixtures();
const allFixtures = loadAllChannelFixtures();

const NRPS_SCOPE =
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';
const NRPS_CLAIM =
  'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice';

describe('K1-NRPS — Port 5 Names & Role Provisioning Services across selected channels', () => {
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

      it(`${fixture.id}:K1-NRPS:N1 — No token request asks for NRPS scope; setup artifact JSON scopes and DR request scopes have the 4 AGS scopes only`, async () => {
        await runKitCase(fixture.id, 'K1-NRPS', 'N1', async () => {
          // 1. Trigger a normal learner play + grade sync with cold token cache and verify zero token requests ask for NRPS scope
          expect((await host('m1-restart', { service: 'lti-service' })).code).toBe(0);
          const cursor = (await records()).cursor;
          const play = await openPlayOnChannel(binding, pub, {
            roles: [ROLE_LEARNER],
            subject: uniqueId(`learner-n1-${fixture.id}`),
          });
          await commitGrade(play, 'scorm12', 10, 10);
          await waitSync(binding, pub, 'sent');

          const simRecs = await records(cursor);
          const tokenRecs = simRecs.records.filter(
            (r: Record<string, unknown>) => r.kind === 'token',
          );
          expect(tokenRecs.length).toBeGreaterThanOrEqual(1);
          for (const tr of tokenRecs) {
            const scopes = Array.isArray(tr.scopes)
              ? (tr.scopes as string[])
              : String(tr.scope ?? '')
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean);
            expect(scopes).not.toContain(NRPS_SCOPE);
          }

          // 2. Fixture registration.scopes has the 4 AGS scopes only and never NRPS
          expect(fixture.capabilities['registration.scopes']).not.toContain(
            NRPS_SCOPE,
          );
          expect(fixture.capabilities['registration.scopes'].length).toBe(4);

          // 3. Setup artifact JSON scopes (when setup.artifacts is non-empty) has the 4 AGS scopes only
          if (fixture.capabilities['setup.artifacts'].length > 0) {
            const artRes = await fetchSetupArtifactConfig(
              binding.session,
              binding.connection.id,
              'url',
            );
            expectStatus(artRes, 200);
            expect(artRes.json.scopes).toEqual(
              fixture.capabilities['registration.scopes'],
            );
            expect(artRes.json.scopes).not.toContain(NRPS_SCOPE);
          }

          // 4. Dynamic Registration client registration request (when registration.dynamic is true) requests only the 4 AGS scopes
          if (fixture.capabilities['registration.dynamic']) {
            const s = await session('A');
            const drCursor = (await records()).cursor;
            const dr = await runDynamicRegistrationHandshake(s, fixture);
            try {
              expect(dr.step).toBe('post');
              expect(dr.response.status).toBe(200);
              const drRecs = await records(drCursor);
              const regReq = drRecs.records.find(
                (r: Record<string, unknown>) =>
                  r.kind === 'registration' || r.kind === 'dynamic-registration',
              );
              expect(regReq).toBeDefined();
              const requestedScopes = Array.isArray(regReq!.scopes)
                ? (regReq!.scopes as string[])
                : String(
                    regReq!.scope ??
                      (regReq!.body as Record<string, unknown> | undefined)
                        ?.scope ??
                      '',
                  )
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean);
              expect(requestedScopes).not.toContain(NRPS_SCOPE);
              for (const agsScope of fixture.capabilities['registration.scopes']) {
                expect(requestedScopes).toContain(agsScope);
              }
            } finally {
              await endConnection(s, dr.connection.id);
            }
          }
        });
      });
    });
  }

  describe('GLOBAL:K1-NRPS:N2 — GET /api/memberships answers for NRPS launch without personal fields, refuses 1.0, and propagates 429 Retry-After', () => {
    const genericFixture = selectProtocolControlFixture(allFixtures);
    let nrpsBinding: ChannelBinding;
    let nrpsPub: PublicationRef;

    beforeAll(async () => {
      nrpsBinding = await setupChannelBinding(genericFixture, {
        library: 'A',
      });
      nrpsPub = await publication(nrpsBinding, 'scorm12');
    });

    afterAll(async () => {
      if (nrpsBinding) {
        await endConnection(nrpsBinding.session, nrpsBinding.connection.id);
      }
    });

    it('GLOBAL:K1-NRPS:N2 — exercises GET /api/memberships with NRPS 2.0, refuses service_versions: ["1.0"], and propagates 429 Retry-After', async () => {
      await runKitCase('GLOBAL', 'K1-NRPS', 'N2', async () => {
        const nrpsUrl = `${genericFixture.sim.serviceUrl}/nrps/memberships/ctx-1`;

        // Enable NRPS scope on the protocol-control platform for the N2 service-layer test
        await admin('PATCH', `/api/platforms/${nrpsBinding.platformId}`, {
          scopes: [
            ...genericFixture.capabilities['registration.scopes'],
            NRPS_SCOPE,
          ],
        });

        // 1. Launch with NRPS 2.0 claim -> GET /api/memberships returns members without personal fields (lti-service-api.md §3.3; lti-service-api-delta.md §4.4)
        const launched = await launchOnChannel(nrpsBinding, {
          resource: nrpsPub.id,
          roles: [ROLE_INSTRUCTOR],
          claims: {
            [NRPS_CLAIM]: {
              context_memberships_url: nrpsUrl,
              service_versions: ['2.0'],
            },
          },
        });
        expect(launched.response.status).toBe(303);
        const tok = await idToken(launched.ltik!);
        expectStatus(tok, 200);
        expect(tok.json.services?.namesAndRoles?.available).toBe(true);
        const nrpsKey = (tok.json.services?.serviceKey ??
          tok.json.services?.nrps?.serviceKey) as string;
        expect(nrpsKey).toBeTruthy();

        const memRes = await service(nrpsKey, 'GET', '/api/memberships');
        expectStatus(memRes, 200);
        expect(Array.isArray(memRes.json.members)).toBe(true);
        expect(memRes.json.members.length).toBeGreaterThanOrEqual(1);
        for (const m of memRes.json.members as Array<Record<string, unknown>>) {
          expect(m.userId).toBeTruthy();
          expect(Array.isArray(m.roles)).toBe(true);
          expect(m.name).toBeUndefined();
          expect(m.email).toBeUndefined();
          expect(m.givenName).toBeUndefined();
          expect(m.familyName).toBeUndefined();
        }

        // 2. Launch with service_versions: ['1.0'] only -> refuses or marks namesAndRoles unavailable
        const launched10 = await launchOnChannel(nrpsBinding, {
          resource: nrpsPub.id,
          roles: [ROLE_INSTRUCTOR],
          claims: {
            [NRPS_CLAIM]: {
              context_memberships_url: nrpsUrl,
              service_versions: ['1.0'],
            },
          },
        });
        expect(launched10.response.status).toBe(303);
        const tok10 = await idToken(launched10.ltik!);
        expectStatus(tok10, 200);
        const key10 =
          tok10.json.services?.serviceKey ??
          tok10.json.services?.nrps?.serviceKey;
        if (key10) {
          const res10 = await service(key10, 'GET', '/api/memberships');
          expect(res10.status).toBeGreaterThanOrEqual(400);
        } else {
          expect(tok10.json.services?.namesAndRoles?.available).toBe(false);
        }

        // 3. Upstream 429 with Retry-After is propagated by GET /api/memberships
        const launched429 = await launchOnChannel(nrpsBinding, {
          resource: nrpsPub.id,
          roles: [ROLE_INSTRUCTOR],
          nrpsAnswers: [{ status: 429, retryAfter: 45 }],
          claims: {
            [NRPS_CLAIM]: {
              context_memberships_url: nrpsUrl,
              service_versions: ['2.0'],
            },
          },
        });
        expect(launched429.response.status).toBe(303);
        const tok429 = await idToken(launched429.ltik!);
        expectStatus(tok429, 200);
        const nrpsKey429 = (tok429.json.services?.serviceKey ??
          tok429.json.services?.nrps?.serviceKey) as string;
        const res429 = await service(nrpsKey429, 'GET', '/api/memberships');
        expect(res429.status).toBe(429);
        expect(
          String(
            res429.headers['retry-after'] ??
              res429.json?.details?.retryAfter ??
              res429.json?.error?.details?.retryAfter ??
              '',
          ),
        ).toContain('45');
      });
    });
  });
});
