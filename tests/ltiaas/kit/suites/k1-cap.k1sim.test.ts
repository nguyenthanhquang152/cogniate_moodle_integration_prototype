import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CONNECTION_GUARDED_CAPABILITIES,
  isConnectionGuardedOff,
  LEGACY_FLAG_KEYS,
  loadChannelManifestCapabilities,
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

      it(`${fixture.id}:K1-CAP:C1 — Bilateral capability equality across manifest, fixture, GET /app-api/lms-providers, GET /app-api/connections/:id, legacyFlags, and toolConfigurationKeys`, async () => {
        await runKitCase(fixture.id, 'K1-CAP', 'C1', async () => {
          const s = binding.session;

          // 1. GET /app-api/lms-providers -> { lms: [...] } with entry.lms, entry.channel, entry.channelCapabilities, and legacy flags (cogniate-app-api.md §4.5; cogniate-app-api-delta.md §2)
          const providersRes = await app(s, 'GET', '/app-api/lms-providers');
          expectStatus(providersRes, 200);
          const providerEntry = (
            providersRes.json.lms as Array<Record<string, unknown>>
          ).find((p) => p.lms === fixture.id);
          expect(providerEntry).toBeDefined();

          const providerLegacyFlags: Record<string, unknown> = {};
          for (const flag of LEGACY_FLAG_KEYS) {
            providerLegacyFlags[flag] = (
              providerEntry!.capabilities as Record<string, unknown>
            )[flag];
          }

          // 2. GET /app-api/connections/:id -> flat Connection DTO with channelCapabilities + capabilities (cogniate-app-api.md §4.2; cogniate-app-api-delta.md §1, §2)
          const connRes = await app(
            s,
            'GET',
            `/app-api/connections/${binding.connection.id}`,
          );
          expectStatus(connRes, 200);
          const connObj = (connRes.json.connection ?? connRes.json) as Record<
            string,
            unknown
          >;
          const connLegacyFlags: Record<string, unknown> = {};
          for (const flag of LEGACY_FLAG_KEYS) {
            connLegacyFlags[flag] = (
              connObj.capabilities as Record<string, unknown>
            )[flag];
          }

          // 3. GET /app-api/connections/:id/tool-configuration -> array of { key, label, value } rows (cogniate-app-api.md §4.6; cogniate-app-api-delta.md §3.6)
          const toolCfgRes = await app(
            s,
            'GET',
            `/app-api/connections/${binding.connection.id}/tool-configuration`,
          );
          expectStatus(toolCfgRes, 200);
          const toolRows = (
            Array.isArray(toolCfgRes.json)
              ? toolCfgRes.json
              : toolCfgRes.json.fields
          ) as Array<{ key: string }>;
          const toolKeys = toolRows.map((f) => f.key);

          // 4. Canonical channel capabilities (LA-ADR-01 §D6)
          const manifestCapabilities = loadChannelManifestCapabilities(fixture);

          const providerChannelCapabilities =
            (providerEntry!.channelCapabilities as
              | Record<string, unknown>
              | undefined) ??
            ((providerEntry!.channel as Record<string, unknown> | undefined)
              ?.capabilities as Record<string, unknown>) ??
            {};
          const connectionChannelCapabilities =
            (connObj.channelCapabilities as
              | Record<string, unknown>
              | undefined) ??
            ((connObj.channel as Record<string, unknown> | undefined)
              ?.capabilities as Record<string, unknown>) ??
            {};

          const bilateral = verifyBilateralCapabilities({
            fixture,
            manifestCapabilities,
            providerChannelCapabilities,
            providerLegacyFlags,
            connectionChannelCapabilities,
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
            deploymentId: uniqueId(`dep-c3-1-${fixture.id}`),
          });
          const b2 = await setupChannelBinding(fixture, {
            library: 'B',
            clientId: isShared ? binding.clientId : uniqueId(`c3-2-${fixture.id}`),
            deploymentId: uniqueId(`dep-c3-2-${fixture.id}`),
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
