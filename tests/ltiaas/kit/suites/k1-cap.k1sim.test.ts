import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CONNECTION_GUARDED_CAPABILITIES,
  isConnectionGuardedOff,
  LEGACY_FLAG_KEYS,
  loadSelectedChannelFixtures,
  verifyBilateralCapabilities,
} from '../lib/fixtures.js';
import {
  app,
  ChannelBinding,
  denied,
  endConnection,
  ensureKitRunInitialized,
  expectStatus,
  launchOnChannel,
  NEGATIVE_GUARD_SPECS,
  newDeploymentId,
  publication,
  PublicationRef,
  runCapabilityGuardProbe,
  runKitCase,
  setupChannelBinding,
  uniqueId,
} from '../lib/runtime.js';

const fixtures = loadSelectedChannelFixtures();

describe('K1-CAP — Capability Matrix, Bilateral Equality, Negative Guards & Disconnect across selected channels', () => {
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

      it(`${fixture.id}:K1-CAP:C1 — channel-level channelCapabilities of the registry entry (GET /app-api/lms-providers) and the full set of the connection DTO equal the fixture in both directions; six legacy flags; tool configuration keys`, async () => {
        await runKitCase(fixture.id, 'K1-CAP', 'C1', async () => {
          const s = binding.session;

          // 1. GET /app-api/lms-providers -> { lms: [...] }: one entry per channel of the registry with the
          // channel-level channelCapabilities and the six legacy flags (cogniate-app-api.md §4.3;
          // cogniate-app-api-delta.md §2). This entry is the public projection of the channel manifest.
          const providersRes = await app(s, 'GET', '/app-api/lms-providers');
          expectStatus(providersRes, 200);
          expect(Array.isArray(providersRes.json.lms)).toBe(true);
          const providerEntries = (providersRes.json.lms as Array<Record<string, unknown>>).filter(
            (p) => p.lms === fixture.id,
          );
          expect(providerEntries.length).toBe(1);
          const providerEntry = providerEntries[0];
          expect(providerEntry.channel).toBe(fixture.id);
          const providerFlags = providerEntry.capabilities as Record<string, unknown> | undefined;
          const providerLegacyFlags: Record<string, unknown> = {};
          for (const flag of LEGACY_FLAG_KEYS) {
            providerLegacyFlags[flag] = providerFlags?.[flag];
          }

          // 2. GET /app-api/connections/:id -> flat Connection DTO with channelCapabilities and the six
          // legacy flags in `capabilities` (cogniate-app-api-delta.md §1)
          const connRes = await app(s, 'GET', `/app-api/connections/${binding.connection.id}`);
          expectStatus(connRes, 200);
          const connObj = connRes.json as Record<string, unknown>;
          expect(connObj.channel).toBe(fixture.id);
          const connFlags = connObj.capabilities as Record<string, unknown> | undefined;
          const connLegacyFlags: Record<string, unknown> = {};
          for (const flag of LEGACY_FLAG_KEYS) {
            connLegacyFlags[flag] = connFlags?.[flag];
          }

          // 3. GET /app-api/connections/:id/tool-configuration -> array of { key, label, value } rows
          // (cogniate-app-api.md §4.1; cogniate-app-api-delta.md §3.3)
          const toolCfgRes = await app(
            s,
            'GET',
            `/app-api/connections/${binding.connection.id}/tool-configuration`,
          );
          expectStatus(toolCfgRes, 200);
          expect(Array.isArray(toolCfgRes.json)).toBe(true);
          const toolKeys = (toolCfgRes.json as Array<{ key: string }>).map((row) => row.key);

          // 4. Both capability maps against the fixture, both directions (AC-LA-E7-06-04): the registry
          // entry has no profile, so it holds the channel-level keys only (no profile-level trait, LA-ADR-01
          // D3); the connection DTO holds every key for its selected profile. A missing map is passed as it
          // is and fails the comparator.
          const bilateral = verifyBilateralCapabilities({
            fixture,
            providerChannelCapabilities: providerEntry.channelCapabilities as Record<string, unknown>,
            providerLegacyFlags,
            connectionChannelCapabilities: connObj.channelCapabilities as Record<string, unknown>,
            connectionLegacyFlags: connLegacyFlags,
            toolConfigurationKeys: toolKeys,
          });
          expect(bilateral.errors).toEqual([]);
          expect(bilateral.ok).toBe(true);
        });
      });

      for (const cap of CONNECTION_GUARDED_CAPABILITIES) {
        if (fixture.notBuilt?.[cap]) {
          continue;
        }
        if (isConnectionGuardedOff(cap, fixture.capabilities[cap])) {
          const spec = NEGATIVE_GUARD_SPECS[cap];
          if (spec) {
            it(`${fixture.id}:K1-CAP:C2:${cap} — Negative capability guard for ${cap}: route/UI refuses action when capability is false/empty`, async () => {
              await runKitCase(fixture.id, 'K1-CAP', `C2:${cap}`, async () => {
                await runCapabilityGuardProbe(binding, spec);
              });
            });
          }
        }
      }

      it(`${fixture.id}:K1-CAP:C3 — Disconnect disables connection or deployment (PLATFORM_NOT_ACTIVE / DEPLOYMENT_NOT_ACTIVE) while leaving other connections on the channel working`, async () => {
        await runKitCase(fixture.id, 'K1-CAP', 'C3', async () => {
          const isShared = fixture.capabilities['platform.sharing'] === 'shared';
          const b1 = await setupChannelBinding(fixture, {
            library: 'A',
            clientId: isShared ? binding.clientId : uniqueId(`c3-1-${fixture.id}`),
            deploymentId: newDeploymentId(fixture, `dep-c3-1-${fixture.id}`),
          });
          const b2 = await setupChannelBinding(fixture, {
            library: 'B',
            clientId: isShared ? binding.clientId : uniqueId(`c3-2-${fixture.id}`),
            deploymentId: newDeploymentId(fixture, `dep-c3-2-${fixture.id}`),
          });

          try {
            const pub1 = await publication(b1, 'scorm12');
            const pub2 = await publication(b2, 'scorm12');

            // DELETE /app-api/connections/:id disconnects b1 -> 204 and status='disabled' (cogniate-app-api.md §4)
            const delRes = await app(
              b1.session,
              'DELETE',
              `/app-api/connections/${b1.connection.id}`,
            );
            expectStatus(delRes, 204);
            const afterConn = await app(
              b1.session,
              'GET',
              `/app-api/connections/${b1.connection.id}`,
            );
            expectStatus(afterConn, 200);
            expect((afterConn.json.connection ?? afterConn.json).status).toBe(
              'disabled',
            );

            // Launch on disconnected b1 is refused with 403 PLATFORM_NOT_ACTIVE (exclusive) or DEPLOYMENT_NOT_ACTIVE (shared)
            const launch1 = await launchOnChannel(b1, { resource: pub1.id });
            const expectedCode = isShared
              ? 'DEPLOYMENT_NOT_ACTIVE'
              : 'PLATFORM_NOT_ACTIVE';
            denied(launch1.response, expectedCode, 403);

            // Launch on b2 on the same channel still succeeds
            const launch2 = await launchOnChannel(b2, { resource: pub2.id });
            expect(launch2.response.status).toBe(303);
          } finally {
            await endConnection(b1.session, b1.connection.id);
            await endConnection(b2.session, b2.connection.id);
          }
        });
      });
    });
  }
});
