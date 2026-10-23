import { beforeAll, describe, expect, it } from 'vitest';
import {
  CONNECTION_GUARDED_CAPABILITIES,
  isCapabilityPositive,
  loadActiveChannelFixtures,
  verifyBilateralCapabilities,
  type CapabilityId,
} from '../lib/fixtures';
import {
  app,
  connectChannel,
  connPath,
  expectStatus,
  httpsRequest,
  launchOnChannel,
  loadKernelManifestCapabilitiesMap,
  publication,
  recordNaCasesForSuite,
  recordSuiteCase,
  runCapabilityGuardProbe,
  verifySetupArtifactPositiveIfSupported,
  type ChannelBinding,
  type Json,
} from '../lib/runtime';

const channels = loadActiveChannelFixtures();

describe('K1-CAP capability parity, off-capability guards, and disconnect simulator suite per channel', () => {
  let manifestCapsByChannel: Map<string, Record<CapabilityId, unknown>>;

  beforeAll(async () => {
    manifestCapsByChannel = await loadKernelManifestCapabilitiesMap();
  });

  for (const fixture of channels) {
    describe(`channel ${fixture.id} (${fixture.simProvider})`, () => {
      let binding: ChannelBinding;

      beforeAll(async () => {
        recordNaCasesForSuite(fixture, 'K1-CAP');
        binding = await connectChannel(fixture);
      });

      it(`[${fixture.id}] C1: bilateral capability equality across manifest, channel fixture, GET /app-api/lms-providers, GET /app-api/connections/:id, legacyFlags, and tool-configuration keys`, async () => {
        const manifestCaps = manifestCapsByChannel.get(fixture.id);
        expect(manifestCaps, `manifest capabilities loaded for ${fixture.id}`).toBeDefined();

        const providersRes = await app(binding.s, 'GET', '/app-api/lms-providers');
        expectStatus(providersRes, 200);
        const list = (providersRes.json?.lms ?? []) as Json[];
        const providerEntry = list.find(
          (entry) => entry.channel === fixture.id || entry.lms === fixture.id,
        );
        expect(providerEntry, `provider entry found for ${fixture.id}`).toBeDefined();

        const connRes = await app(binding.s, 'GET', connPath(binding.connection.id));
        expectStatus(connRes, 200);

        const cfgRes = await app(
          binding.s,
          'GET',
          `${connPath(binding.connection.id)}/tool-configuration`,
        );
        expectStatus(cfgRes, 200);
        const rows = (
          Array.isArray(cfgRes.json)
            ? cfgRes.json
            : (cfgRes.json?.rows ?? cfgRes.json?.fields ?? [])
        ) as Array<{ key: string }>;
        const toolKeys = rows.map((r) => r.key);

        const bilateral = verifyBilateralCapabilities({
          fixture,
          manifestCapabilities: manifestCaps!,
          providerChannelCapabilities: providerEntry!.channelCapabilities as Record<string, unknown>,
          providerLegacyFlags: providerEntry!.capabilities as Record<string, unknown>,
          connectionChannelCapabilities: connRes.json.channelCapabilities as Record<string, unknown>,
          connectionLegacyFlags: connRes.json.capabilities as Record<string, unknown>,
          toolConfigurationKeys: toolKeys,
        });
        expect(bilateral.errors).toEqual([]);
        expect(bilateral.ok).toBe(true);

        await verifySetupArtifactPositiveIfSupported(binding);
        recordSuiteCase(fixture, 'K1-CAP', 'C1', 'PASS');
      });

      for (const spec of CONNECTION_GUARDED_CAPABILITIES) {
        const isOff = !isCapabilityPositive(fixture.capabilities[spec.capability]);
        const isExcluded =
          Boolean(fixture.notBuilt[spec.capability]) || Boolean(fixture.coveredBy[spec.capability]);
        if (isOff && !isExcluded) {
          it(`[${fixture.id}] C2:${spec.capability}: guarded endpoint for off capability ${spec.capability} returns 409 CAPABILITY_NOT_SUPPORTED (${spec.legacyCapability}) with zero simulator service calls`, async () => {
            await runCapabilityGuardProbe(binding, spec);
            recordSuiteCase(fixture, 'K1-CAP', `C2:${spec.capability}`, 'PASS');
          });
        }
      }

      it(`[${fixture.id}] C3: disconnect connection refuses subsequent launch`, async () => {
        const tempBinding = await connectChannel(fixture);
        const pub = await publication(tempBinding, 'scorm12');

        const delRes = await app(tempBinding.s, 'DELETE', connPath(tempBinding.connection.id));
        expect([200, 204]).toContain(delRes.status);

        const launched = await launchOnChannel(tempBinding, {
          resource: pub.id,
          resourceLinkId: pub.id,
        });
        if (launched.response.status === 303) {
          const handoff = await httpsRequest(String(launched.response.headers.location));
          expect(handoff.status).toBe(403);
        } else {
          expect(launched.response.status).toBeGreaterThanOrEqual(400);
        }
        recordSuiteCase(fixture, 'K1-CAP', 'C3', 'PASS');
      });
    });
  }
});
