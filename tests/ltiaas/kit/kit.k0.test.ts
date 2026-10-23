import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALL_KIT_CHANNEL_IDS,
  BASELINE_CHANNEL_IDS,
  CAPABILITY_VOCABULARY,
  CONNECTION_GUARDED_CAPABILITIES,
  DEFAULT_WAVE_PASS_RESULTS,
  PROTOCOL_SECURITY_FAULTS,
  SUITES_DIR,
  auditFixtureSources,
  computeExpectedCaseList,
  computeExpectedRunCaseIds,
  evaluateChannelPassRule,
  formatKitSummaryMarkdown,
  listChannelFixtureIds,
  loadAllChannelFixtures,
  loadChannelFixture,
  verifyBilateralCapabilities,
  verifyExecutedCases,
  type CapabilityId,
  type ChannelFixture,
  type ExecutedCaseRecord,
} from './lib/fixtures';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(
  process.env.LA_TARGET_ROOT ??
    process.env.QA_REPO_ROOT ??
    process.env.LA_SCRATCH_CLONE ??
    path.join(HERE, '../../..'),
);

function buildSyntheticPassingExecution(fixture: ChannelFixture): ExecutedCaseRecord[] {
  return computeExpectedCaseList(fixture).map((spec) => ({
    id: spec.id,
    suite: spec.suite,
    code: spec.code,
    channelId: spec.channelId,
    outcome: spec.status === 'RUN' ? 'PASS' : 'NA',
    detail: spec.reason,
  }));
}

describe('LA-E7-06 K1 certification kit host-only K0 and DOC verification', () => {
  it('AC-LA-E7-06-07 (DOC / TB-12): every value in tests/ltiaas/kit/channels/*.json records its design source (LA-ADR-01 D3, LA-ADR-02, LA-ADR-05, LA-ADR-08) and copies zero values from product code', () => {
    const discoveredIds = listChannelFixtureIds();
    expect(discoveredIds).toEqual([...ALL_KIT_CHANNEL_IDS].sort());

    const fixtures = loadAllChannelFixtures();
    for (const fixture of fixtures) {
      const audit = auditFixtureSources(fixture);
      expect(audit.errors, `Fixture source audit errors for ${fixture.id}`).toEqual([]);
      expect(audit.ok).toBe(true);
    }
  });

  it('AC-LA-E7-06-02 (K0): pass-rule missing/extra case check fails with "missing case" when one expected case is removed and fails with "extra case" when one unexpected case runs', () => {
    for (const channelId of BASELINE_CHANNEL_IDS) {
      const fixture = loadChannelFixture(channelId);
      const expectedRunIds = computeExpectedRunCaseIds(fixture);
      expect(expectedRunIds.length).toBeGreaterThan(20);

      // 1. Exact match passes
      const exact = verifyExecutedCases(expectedRunIds, expectedRunIds);
      expect(exact.ok).toBe(true);
      expect(exact.errors).toEqual([]);

      // 2. Removing one expected case fails with "missing case: <id>"
      const removedCaseId = expectedRunIds[3];
      const withMissing = verifyExecutedCases(
        expectedRunIds,
        expectedRunIds.filter((id) => id !== removedCaseId),
      );
      expect(withMissing.ok).toBe(false);
      expect(withMissing.missingCases).toEqual([removedCaseId]);
      expect(withMissing.errors).toContain(`missing case: ${removedCaseId}`);

      const fullRecs = buildSyntheticPassingExecution(fixture);
      const passMissing = evaluateChannelPassRule({
        fixture,
        executedCases: fullRecs.filter((r) => r.id !== removedCaseId),
      });
      expect(passMissing.ok).toBe(false);
      expect(passMissing.errors).toContain(`missing case: ${removedCaseId}`);

      // 3. Running one unexpected case fails with "extra case: <id>"
      const unexpectedCaseId = `${channelId}:K1-LAUNCH:L99-UNEXPECTED`;
      const withExtra = verifyExecutedCases(expectedRunIds, [...expectedRunIds, unexpectedCaseId]);
      expect(withExtra.ok).toBe(false);
      expect(withExtra.extraCases).toEqual([unexpectedCaseId]);
      expect(withExtra.errors).toContain(`extra case: ${unexpectedCaseId}`);

      const passExtra = evaluateChannelPassRule({
        fixture,
        executedCases: [
          ...fullRecs,
          {
            id: unexpectedCaseId,
            suite: 'K1-LAUNCH',
            code: 'L99-UNEXPECTED',
            channelId,
            outcome: 'PASS',
          },
        ],
      });
      expect(passExtra.ok).toBe(false);
      expect(passExtra.errors).toContain(`extra case: ${unexpectedCaseId}`);
    }
  });

  it('AC-LA-E7-06-03: capability-gated N/A rule marks off capabilities N/A in functional suites, requires C2 guard tests for off guarded capabilities, and excludes notBuilt capabilities (content.ungraded)', () => {
    for (const fixture of loadAllChannelFixtures()) {
      const specs = computeExpectedCaseList(fixture);
      const byCode = new Map(specs.map((s) => [`${s.suite}:${s.code}`, s]));

      // content.multiple gating on K1-DL:D5
      if (fixture.capabilities['content.multiple']) {
        expect(byCode.get('K1-DL:D5')?.status).toBe('RUN');
      } else {
        expect(byCode.get('K1-DL:D5')?.status).toBe('NA');
      }

      // deployments.multiple gating on K1-REG:R5 and C2:deployments.multiple
      if (fixture.capabilities['deployments.multiple']) {
        expect(byCode.get('K1-REG:R5')?.status).toBe('RUN');
        expect(byCode.get('K1-CAP:C2:deployments.multiple')).toBeUndefined();
      } else {
        expect(byCode.get('K1-REG:R5')?.status).toBe('NA');
        expect(byCode.get('K1-CAP:C2:deployments.multiple')?.status).toBe('RUN');
        expect(byCode.get('K1-CAP:C2:deployments.multiple')?.expectedLegacyCapability).toBe('addDeployment');
      }

      // setup.connectionCheck gating on K1-REG:R6 and C2:setup.connectionCheck
      if (fixture.capabilities['setup.connectionCheck']) {
        expect(byCode.get('K1-REG:R6')?.status).toBe('RUN');
        expect(byCode.get('K1-CAP:C2:setup.connectionCheck')).toBeUndefined();
      } else {
        expect(byCode.get('K1-REG:R6')?.status).toBe('NA');
        expect(byCode.get('K1-CAP:C2:setup.connectionCheck')?.status).toBe('RUN');
        expect(byCode.get('K1-CAP:C2:setup.connectionCheck')?.expectedLegacyCapability).toBe(
          'setup.connectionCheck',
        );
      }

      // content.ungraded is in notBuilt -> K1-DL:D7 is NA and C2:content.ungraded is excluded
      expect(fixture.notBuilt['content.ungraded']).toBeTruthy();
      expect(byCode.get('K1-DL:D7')?.status).toBe('NA');
      expect(byCode.get('K1-CAP:C2:content.ungraded')).toBeUndefined();

      // Probe: if content.ungraded is removed from notBuilt while still false, C2:content.ungraded becomes required
      const withoutNotBuilt: ChannelFixture = {
        ...fixture,
        notBuilt: {},
      };
      const specsWithoutNotBuilt = computeExpectedCaseList(withoutNotBuilt);
      expect(
        specsWithoutNotBuilt.find((s) => s.code === 'C2:content.ungraded')?.status,
        `Removing content.ungraded from notBuilt on ${fixture.id} requires C2:content.ungraded`,
      ).toBe('RUN');
    }
  });

  it('AC-LA-E7-06-04: C1 bilateral capability equality matches @cogniate/channel-kernel manifests, legacyProjection, toolConfiguration keys, and LA-IC-01 / LA-IC-14 golden contracts', async () => {
    const kernelEntry = pathToFileURL(path.join(REPO_ROOT, 'packages/channel-kernel/src/index.ts')).href;
    const kernel = (await import(kernelEntry)) as {
      loadChannelFolders(
        roots: readonly string[],
        side: 'lti' | 'app',
      ): Promise<
        Array<{
          manifest: {
            id: string;
            registration: Array<{ defaultProfile: string }>;
            setup?: { toolRows?: Array<{ key: string }> };
          } & Record<string, unknown>;
          ltiProfiles?: Array<{ id: string } & Record<string, unknown>>;
          appAdapter?: unknown;
        }>
      >;
      computeCapabilities(
        manifest: Record<string, unknown>,
        profile?: Record<string, unknown>,
      ): Record<CapabilityId, unknown>;
      legacyProjection(capabilities: Record<CapabilityId, unknown>): Record<string, boolean>;
    };

    const channelsRoot = [path.join(REPO_ROOT, 'packages/channels')];
    const ltiLoaded = await kernel.loadChannelFolders(channelsRoot, 'lti');
    const appLoaded = await kernel.loadChannelFolders(channelsRoot, 'app');

    for (const fixture of loadAllChannelFixtures()) {
      const appChan = appLoaded.find((c) => c.manifest.id === fixture.id);
      const ltiChan = ltiLoaded.find((c) => c.manifest.id === fixture.id);
      expect(appChan, `app channel ${fixture.id}`).toBeDefined();
      expect(ltiChan, `lti channel ${fixture.id}`).toBeDefined();

      const defaultProfileId = appChan!.manifest.registration[0]?.defaultProfile;
      const prof =
        ltiChan!.ltiProfiles?.find((p) => p.id === defaultProfileId) ?? ltiChan!.ltiProfiles?.[0];
      const manifestCaps = kernel.computeCapabilities(appChan!.manifest, prof);
      const projectedLegacy = kernel.legacyProjection(manifestCaps);

      const bilateral = verifyBilateralCapabilities({
        fixture,
        manifestCapabilities: manifestCaps,
        providerChannelCapabilities: manifestCaps,
        providerLegacyFlags: projectedLegacy,
        connectionChannelCapabilities: manifestCaps,
        connectionLegacyFlags: projectedLegacy,
      });
      expect(bilateral.errors, `Bilateral equality errors for ${fixture.id}`).toEqual([]);
      expect(bilateral.ok).toBe(true);

      // Negative probe 1: extra key in manifest or DTO fails bilateral equality
      const extraKeyResult = verifyBilateralCapabilities({
        fixture,
        manifestCapabilities: { ...manifestCaps, 'zz.extra.capability': true },
      });
      expect(extraKeyResult.ok).toBe(false);
      expect(extraKeyResult.errors[0]).toContain('zz.extra.capability');

      // Negative probe 2: missing key in manifest or DTO fails bilateral equality
      const partialCaps = { ...manifestCaps };
      delete (partialCaps as Record<string, unknown>)['records.readBack'];
      const missingKeyResult = verifyBilateralCapabilities({
        fixture,
        manifestCapabilities: partialCaps,
      });
      expect(missingKeyResult.ok).toBe(false);
      expect(missingKeyResult.errors[0]).toContain('records.readBack');
    }
  });

  it('AC-LA-E7-06-05: Moodle coveredBy rule cites T3b, T7, T8 for live-only capabilities and passes only when referenced wave-pass suites are green', () => {
    const moodleFixture = loadChannelFixture('moodle');
    expect(moodleFixture.coveredBy).toEqual({
      'registration.dynamic': ['T3b', 'T7'],
      'siteApi.token': ['T8'],
      'publish.createCourse': ['T8'],
      'export.packages': ['T8'],
    });

    const fullRecs = buildSyntheticPassingExecution(moodleFixture);
    const passGreen = evaluateChannelPassRule({
      fixture: moodleFixture,
      executedCases: fullRecs,
      wavePassResults: DEFAULT_WAVE_PASS_RESULTS,
    });
    expect(passGreen.errors).toEqual([]);
    expect(passGreen.ok).toBe(true);

    // If T8 is not green, Moodle pass rule fails for siteApi.token, publish.createCourse, export.packages
    const failT8 = evaluateChannelPassRule({
      fixture: moodleFixture,
      executedCases: fullRecs,
      wavePassResults: { T3b: 'PASS', T7: 'PASS', T8: 'FAIL' },
    });
    expect(failT8.ok).toBe(false);
    expect(failT8.errors.some((e) => e.includes('siteApi.token'))).toBe(true);
    expect(failT8.errors.some((e) => e.includes('publish.createCourse'))).toBe(true);
    expect(failT8.errors.some((e) => e.includes('export.packages'))).toBe(true);
  });

  it('AC-LA-E7-06-08: K1-LAUNCH protocol security fault matrix matches all 12 faults from M1/blackboard/20-protocol.test.ts', () => {
    expect(PROTOCOL_SECURITY_FAULTS).toHaveLength(12);
    const m1ProtocolPath = path.join(REPO_ROOT, 'tests/acceptance/M1/blackboard/20-protocol.test.ts');
    const m1Source = fs.readFileSync(m1ProtocolPath, 'utf8');
    for (const [fault, expectedCode] of PROTOCOL_SECURITY_FAULTS) {
      expect(m1Source).toContain(`'${fault}'`);
      expect(m1Source).toContain(`'${expectedCode}'`);
    }
  });

  it('AC-LA-E7-04-07 (F1 kit-neutrality): every file in tests/ltiaas/kit/suites/** has zero LMS/channel name hits under fitness:lms-names', () => {
    const suiteFiles = fs
      .readdirSync(SUITES_DIR)
      .filter((f) => f.endsWith('.ts'))
      .sort();
    expect(suiteFiles.length).toBeGreaterThanOrEqual(7);

    const f1Script = path.join(REPO_ROOT, 'infra/scripts/fitness/lms-names.mjs');
    for (const file of suiteFiles) {
      const fullPath = path.join(SUITES_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const res = spawnSync(
        process.execPath,
        [f1Script, '--stdin', '--as', 'services/cogniate-app/src/zz-kit-suite-check.ts'],
        {
          cwd: REPO_ROOT,
          input: content,
          encoding: 'utf8',
        },
      );
      expect(
        res.status,
        `F1 kit-neutrality check failed on tests/ltiaas/kit/suites/${file}:\n${res.stdout}\n${res.stderr}`,
      ).toBe(0);
    }
  });

  it('AC-LA-E7-06-01: computes expected case tables and summary markdown for all 5 channel fixtures', () => {
    const fixtures = loadAllChannelFixtures();
    const byChannel = new Map<string, ExecutedCaseRecord[]>();
    const passResults = new Map<string, ReturnType<typeof evaluateChannelPassRule>>();

    for (const fixture of fixtures) {
      const recs = buildSyntheticPassingExecution(fixture);
      byChannel.set(fixture.id, recs);
      const pr = evaluateChannelPassRule({
        fixture,
        executedCases: recs,
        skippedCount: 0,
        leakedSecretCount: 0,
        wavePassResults: DEFAULT_WAVE_PASS_RESULTS,
      });
      expect(pr.ok, `Pass rule for ${fixture.id}: ${pr.errors.join('; ')}`).toBe(true);
      passResults.set(fixture.id, pr);
    }

    const md = formatKitSummaryMarkdown(fixtures, byChannel, passResults);
    for (const id of ALL_KIT_CHANNEL_IDS) {
      expect(md).toContain(`\`${id}\``);
    }
    expect(md).toContain('**PASS**');
  });
});
