import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  auditFixtureSources,
  BASELINE_CHANNEL_IDS,
  BilateralEqualityInput,
  buildOperatorGrantCliArgs,
  CAPABILITY_KEYS,
  ChannelFixture,
  computeExpectedCaseList,
  computeExpectedGlobalCaseList,
  deriveLegacyFlagsFromCapabilities,
  evaluateChannelPassRule,
  ExecutedCaseRecord,
  K1_SIM_SUITE_FILES,
  listChannelFixtureIds,
  loadAllChannelFixtures,
  loadChannelFixture,
  orderKitSuiteSpecs,
  resolveSelectedChannelIds,
  verifyBilateralCapabilities,
  WaveEvidenceManifest,
} from './lib/fixtures.js';
import {
  evaluateKitRunPassRule,
  initKitRunLedger,
  loadWaveEvidenceFromRun,
  readAllExecutedCases,
  recordRedactedEvidence,
  recordSecret,
  recordSkippedCase,
  runKitCase,
  scanAllLogsAndArtifactsForSecrets,
  writeKitRunSummaryArtifacts,
} from './lib/runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.join(__dirname, 'suites');

const VALID_WAVE_ID = 'wave-B4-test';
const VALID_WAVE_EVIDENCE: WaveEvidenceManifest = {
  waveId: VALID_WAVE_ID,
  suites: {
    T3b: {
      outcome: 'PASS',
      waveId: VALID_WAVE_ID,
      artifactPath: 'artifacts/T3b/summary.json',
    },
    T7: {
      outcome: 'PASS',
      waveId: VALID_WAVE_ID,
      artifactPath: 'artifacts/T7/summary.json',
    },
    T8: {
      outcome: 'PASS',
      waveId: VALID_WAVE_ID,
      artifactPath: 'artifacts/T8/summary.json',
    },
  },
};

function buildPassingRecordsForChannel(
  fixture: ChannelFixture,
  runId = 'run-k0-1',
): ExecutedCaseRecord[] {
  return computeExpectedCaseList(fixture)
    .filter((c) => c.expectedStatus === 'RUN')
    .map((c) => ({
      id: c.id,
      channelId: fixture.id,
      suite: c.suite,
      code: c.code,
      outcome: 'PASS' as const,
      runId,
    }));
}

describe('LA-E7-06 K0: Channel Certification Kit Self-Tests', () => {
  it('AC-LA-E7-06-01 / F1: zero LMS-name or lti-generic tokens in tests/ltiaas/kit/suites/**', () => {
    const bannedRegex =
      /(moodle|canvas|blackboard|brightspace|sakai|schoology|d2l|instructure|anthology|lti-generic)/i;
    const files = fs.readdirSync(SUITES_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBe(7);

    const hits: string[] = [];
    for (const file of files) {
      const fullPath = path.join(SUITES_DIR, file);
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        const m = line.match(bannedRegex);
        if (m) {
          hits.push(`${file}:${idx + 1}: matched "${m[0]}" in \`${line.trim()}\``);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('AC-LA-E7-06-03 / TB-12: all 5 channel fixtures have complete 17-key capabilities and verified source citations', () => {
    const ids = listChannelFixtureIds();
    expect(ids).toEqual([...BASELINE_CHANNEL_IDS]);
    const fixtures = loadAllChannelFixtures();
    expect(fixtures.length).toBe(5);

    for (const fixture of fixtures) {
      expect(Object.keys(fixture.capabilities).sort()).toEqual([...CAPABILITY_KEYS].sort());
      const audit = auditFixtureSources(fixture);
      expect(audit.errors).toEqual([]);
      expect(audit.ok).toBe(true);
    }

    // Negative probe: missing source citation fails auditFixtureSources
    const broken = structuredClone(fixtures[0]);
    delete broken.sources['capabilities.site.serviceOrigin'];
    const brokenAudit = auditFixtureSources(broken);
    expect(brokenAudit.ok).toBe(false);
    expect(brokenAudit.errors.some((e) => e.includes('capabilities.site.serviceOrigin'))).toBe(
      true,
    );

    // Negative probe: legacyFlags mismatch against LA-ADR-01 §D11 derivation fails auditFixtureSources
    const badLegacy = structuredClone(fixtures[0]);
    badLegacy.expect.legacyFlags.dynamicRegistration =
      !badLegacy.expect.legacyFlags.dynamicRegistration;
    const badLegacyAudit = auditFixtureSources(badLegacy);
    expect(badLegacyAudit.ok).toBe(false);
    expect(badLegacyAudit.errors.some((e) => e.includes('dynamicRegistration'))).toBe(true);
  });

  it('B-LA-E7-06-06 / LA-E8-01: open-world channel discovery onboards a 6th <id>.json fixture with zero shared-list edits', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-canary-channels-'));
    try {
      for (const id of BASELINE_CHANNEL_IDS) {
        const src = path.join(__dirname, 'channels', `${id}.json`);
        fs.copyFileSync(src, path.join(tmpDir, `${id}.json`));
      }
      const baseGeneric = loadChannelFixture('lti-generic', tmpDir);
      const canaryFixture: ChannelFixture = {
        ...structuredClone(baseGeneric),
        id: 'canary-lms',
        simProvider: 'canary-sim',
        simProfile: 'canary-lms',
      };
      canaryFixture.capabilities['content.multiple'] = false;
      canaryFixture.capabilities['setup.connectionCheck'] = false;
      canaryFixture.expect.legacyFlags = deriveLegacyFlagsFromCapabilities(
        'canary-lms',
        canaryFixture.capabilities,
      );
      fs.writeFileSync(
        path.join(tmpDir, 'canary-lms.json'),
        JSON.stringify(canaryFixture, null, 2),
        'utf8',
      );

      const discoveredIds = listChannelFixtureIds(tmpDir);
      expect(discoveredIds).toEqual([...BASELINE_CHANNEL_IDS, 'canary-lms']);

      const allLoaded = loadAllChannelFixtures(tmpDir);
      expect(allLoaded.map((f) => f.id)).toEqual([...BASELINE_CHANNEL_IDS, 'canary-lms']);

      expect(resolveSelectedChannelIds(undefined, tmpDir)).toEqual([...BASELINE_CHANNEL_IDS]);
      expect(resolveSelectedChannelIds('all', tmpDir)).toEqual([
        ...BASELINE_CHANNEL_IDS,
        'canary-lms',
      ]);
      expect(resolveSelectedChannelIds('canary-lms', tmpDir)).toEqual(['canary-lms']);

      const audit = auditFixtureSources(canaryFixture);
      expect(audit.errors).toEqual([]);
      expect(audit.ok).toBe(true);

      const expectedCases = computeExpectedCaseList(canaryFixture);
      expect(expectedCases.some((c) => c.id === 'canary-lms:K1-CAP:C2:setup.connectionCheck')).toBe(
        true,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('AC-LA-E7-06-04 / A-LA-E7-06-02 / B-LA-E7-06-03: C1 bilateral equality rejects missing, null, or array API capability maps and detects mismatches', () => {
    const canvas = loadChannelFixture('canvas');
    const validInput: BilateralEqualityInput = {
      fixture: canvas,
      manifestCapabilities: structuredClone(canvas.capabilities) as unknown as Record<
        string,
        unknown
      >,
      providerChannelCapabilities: structuredClone(canvas.capabilities) as unknown as Record<
        string,
        unknown
      >,
      providerLegacyFlags: structuredClone(canvas.expect.legacyFlags) as unknown as Record<
        string,
        unknown
      >,
      connectionChannelCapabilities: structuredClone(canvas.capabilities) as unknown as Record<
        string,
        unknown
      >,
      connectionLegacyFlags: structuredClone(canvas.expect.legacyFlags) as unknown as Record<
        string,
        unknown
      >,
      toolConfigurationKeys: [...canvas.expect.toolConfigurationKeys],
    };

    expect(verifyBilateralCapabilities(validInput)).toEqual({ ok: true, errors: [] });

    // Every required object field must fail when undefined, null, or an array
    const objectFields = [
      'manifestCapabilities',
      'providerChannelCapabilities',
      'providerLegacyFlags',
      'connectionChannelCapabilities',
      'connectionLegacyFlags',
    ] as const;

    for (const field of objectFields) {
      for (const badValue of [undefined, null, []]) {
        const res = verifyBilateralCapabilities({
          ...validInput,
          [field]: badValue as unknown as Record<string, unknown>,
        });
        expect(res.ok).toBe(false);
        expect(res.errors.some((e) => e.includes(`missing or invalid ${field} object`))).toBe(
          true,
        );
      }
    }

    // toolConfigurationKeys must fail when undefined, null, or non-string array
    for (const badKeys of [undefined, null, {}, [123]]) {
      const res = verifyBilateralCapabilities({
        ...validInput,
        toolConfigurationKeys: badKeys as unknown as string[],
      });
      expect(res.ok).toBe(false);
      expect(
        res.errors.some((e) => e.includes('missing or invalid toolConfigurationKeys array')),
      ).toBe(true);
    }

    // Flipping one capability value fails
    const flippedCap = structuredClone(validInput);
    flippedCap.providerChannelCapabilities['site.serviceOrigin'] = false;
    const flippedRes = verifyBilateralCapabilities(flippedCap);
    expect(flippedRes.ok).toBe(false);
    expect(flippedRes.errors[0]).toContain('site.serviceOrigin');

    // Reordering toolConfigurationKeys fails
    const reorderedKeys = structuredClone(validInput);
    reorderedKeys.toolConfigurationKeys.reverse();
    const reorderedRes = verifyBilateralCapabilities(reorderedKeys);
    expect(reorderedRes.ok).toBe(false);
    expect(reorderedRes.errors[0]).toContain('tool-configuration keys mismatch');
  });

  it('AC-LA-E7-06-05 / A-LA-E7-06-01 / B-LA-E7-06-01: coveredBy never defaults to PASS and requires current-wave disk evidence', () => {
    const moodle = loadChannelFixture('moodle');
    const runId = 'run-wave-test';
    const records = buildPassingRecordsForChannel(moodle, runId);

    // 1. Calling evaluateChannelPassRule with no waveEvidence MUST fail (never invent PASS)
    const noWaveRes = evaluateChannelPassRule({
      fixture: moodle,
      executedRecords: records,
      expectedRunId: runId,
      currentWaveId: VALID_WAVE_ID,
      waveEvidence: null,
    });
    expect(noWaveRes.ok).toBe(false);
    expect(noWaveRes.errors.some((e) => e.includes('missing wave evidence'))).toBe(true);

    // 2. Loading from a directory without wave-evidence.json MUST fail
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-no-wave-'));
    try {
      const missingManifest = loadWaveEvidenceFromRun({
        stateDir: emptyDir,
        currentWaveId: VALID_WAVE_ID,
      });
      expect(missingManifest.error).toContain('wave evidence file not found');
      const resFromDiskMissing = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: missingManifest,
      });
      expect(resFromDiskMissing.ok).toBe(false);
      expect(resFromDiskMissing.errors.some((e) => e.includes('missing wave evidence'))).toBe(
        true,
      );

      // 3. Stale waveId on manifest or suite entry MUST fail
      const staleManifest: WaveEvidenceManifest = {
        waveId: 'wave-B1-old',
        suites: VALID_WAVE_EVIDENCE.suites,
      };
      const staleRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: staleManifest,
      });
      expect(staleRes.ok).toBe(false);
      expect(staleRes.errors.some((e) => e.includes('stale wave evidence'))).toBe(true);

      // 4. PENDING or FAIL outcome in wave-evidence.json MUST fail
      for (const badOutcome of ['PENDING', 'FAIL'] as const) {
        const badManifest: WaveEvidenceManifest = {
          waveId: VALID_WAVE_ID,
          suites: {
            ...VALID_WAVE_EVIDENCE.suites,
            T8: {
              outcome: badOutcome,
              waveId: VALID_WAVE_ID,
              artifactPath: 'artifacts/T8/summary.json',
            },
          },
        };
        const badRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: badManifest,
        });
        expect(badRes.ok).toBe(false);
        expect(
          badRes.errors.some((e) =>
            e.includes(badOutcome === 'PENDING' ? 'pending wave suite' : 'failed wave suite'),
          ),
        ).toBe(true);
      }

      // 5. Valid wave-evidence.json on disk for current wave PASSES
      const waveFile = path.join(emptyDir, 'wave-evidence.json');
      fs.writeFileSync(waveFile, JSON.stringify(VALID_WAVE_EVIDENCE, null, 2), 'utf8');
      const loadedValid = loadWaveEvidenceFromRun({
        stateDir: emptyDir,
        currentWaveId: VALID_WAVE_ID,
      });
      const validRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: loadedValid,
      });
      expect(validRes.errors).toEqual([]);
      expect(validRes.ok).toBe(true);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('AC-LA-E7-06-02 / A-LA-E7-06-04 / B-LA-E7-06-04: ledger records FAIL before rethrow, preserves duplicate/retried FAIL->PASS records, counts SKIPs, and rejects stale runId', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-ledger-test-'));
    try {
      const runId = 'run-ledger-active';
      initKitRunLedger({ stateDir: tmpDir, runId, channels: ['canvas'] });
      const canvas = loadChannelFixture('canvas');

      // 1. runKitCase records FAIL when the test body throws
      await expect(
        runKitCase(
          'canvas',
          'K1-LAUNCH',
          'L1',
          async () => {
            throw new Error('simulated L1 assertion failure');
          },
          { stateDir: tmpDir, runId },
        ),
      ).rejects.toThrow('simulated L1 assertion failure');

      // 2. A subsequent PASS on the same case ID does NOT overwrite the earlier FAIL in readAllExecutedCases
      await runKitCase(
        'canvas',
        'K1-LAUNCH',
        'L1',
        async () => {
          // passes on retry
        },
        { stateDir: tmpDir, runId },
      );

      const allRecs = readAllExecutedCases({ stateDir: tmpDir });
      const l1Recs = allRecs.filter((r) => r.id === 'canvas:K1-LAUNCH:L1');
      expect(l1Recs.map((r) => r.outcome)).toEqual(['FAIL', 'PASS']);

      // Fill remaining expected cases as PASS
      const rest = buildPassingRecordsForChannel(canvas, runId).filter(
        (r) => r.id !== 'canvas:K1-LAUNCH:L1',
      );
      const evalWithRetry = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: [...l1Recs, ...rest],
        expectedRunId: runId,
      });
      expect(evalWithRetry.ok).toBe(false);
      expect(evalWithRetry.failedCases).toContain('canvas:K1-LAUNCH:L1');
      expect(evalWithRetry.duplicateOrRetriedCases).toContain('canvas:K1-LAUNCH:L1');

      // 3. Skipped case is counted in skippedCount and fails
      recordSkippedCase('canvas', 'K1-DL', 'D1', 'skipped in test', {
        stateDir: tmpDir,
        runId,
      });
      const withSkip = [
        ...buildPassingRecordsForChannel(canvas, runId).filter(
          (r) => r.id !== 'canvas:K1-DL:D1',
        ),
        ...readAllExecutedCases({ stateDir: tmpDir }).filter(
          (r) => r.id === 'canvas:K1-DL:D1',
        ),
      ];
      const evalSkip = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: withSkip,
        expectedRunId: runId,
      });
      expect(evalSkip.ok).toBe(false);
      expect(evalSkip.skippedCount).toBe(1);
      expect(evalSkip.errors.some((e) => e.includes('skipped case: canvas:K1-DL:D1'))).toBe(true);

      // 4. Stale runId record is rejected
      const staleRecords = buildPassingRecordsForChannel(canvas, 'run-old-stale');
      const evalStale = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: staleRecords,
        expectedRunId: runId,
      });
      expect(evalStale.ok).toBe(false);
      expect(evalStale.staleRunCases.length).toBeGreaterThan(0);

      // 5. Missing case, extra case, and illegal N/A fail closed
      const missingOne = buildPassingRecordsForChannel(canvas, runId).slice(1);
      const evalMissing = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: missingOne,
        expectedRunId: runId,
      });
      expect(evalMissing.ok).toBe(false);
      expect(evalMissing.missingCases).toEqual(['canvas:K1-LAUNCH:L1']);

      const withExtra = [
        ...buildPassingRecordsForChannel(canvas, runId),
        {
          id: 'canvas:K1-LAUNCH:L999',
          channelId: 'canvas',
          suite: 'K1-LAUNCH' as const,
          code: 'L999',
          outcome: 'PASS' as const,
          runId,
        },
      ];
      const evalExtra = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: withExtra,
        expectedRunId: runId,
      });
      expect(evalExtra.ok).toBe(false);
      expect(evalExtra.extraCases).toEqual(['canvas:K1-LAUNCH:L999']);

      // Illegal N/A when gatedByCapability is missing or capability is true
      const customExpected = computeExpectedCaseList(canvas);
      customExpected.push({
        id: 'canvas:K1-REG:R-ILLEGAL-NA',
        channelId: 'canvas',
        suite: 'K1-REG',
        code: 'R-ILLEGAL-NA',
        description: 'Illegal NA without false capability',
        expectedStatus: 'NA',
        gatedByCapability: 'registration.dynamic', // true on canvas!
      });
      const evalIllegalNa = evaluateChannelPassRule({
        fixture: canvas,
        expectedCases: customExpected,
        executedRecords: buildPassingRecordsForChannel(canvas, runId),
        expectedRunId: runId,
      });
      expect(evalIllegalNa.ok).toBe(false);
      expect(evalIllegalNa.illegalNaCases.length).toBe(1);

      // 6. Full-run evaluation & summary artifact emission
      const globalPass: ExecutedCaseRecord[] = computeExpectedGlobalCaseList().map((g) => ({
        id: g.id,
        channelId: 'GLOBAL',
        suite: g.suite,
        code: g.code,
        outcome: 'PASS',
        runId,
      }));
      const fullReport = evaluateKitRunPassRule({
        fixtures: [canvas],
        executedRecords: [...buildPassingRecordsForChannel(canvas, runId), ...globalPass],
        expectedRunId: runId,
        requireH1: true,
      });
      expect(fullReport.ok).toBe(true);
      const { mdPath, jsonPath } = writeKitRunSummaryArtifacts(fullReport, {
        stateDir: tmpDir,
      });
      expect(fs.existsSync(mdPath)).toBe(true);
      expect(fs.existsSync(jsonPath)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('A-LA-E7-06-04 / B-LA-E7-06-04: KitSuiteSequencer deterministically orders k-hyg.k1sim.test.ts strictly last', () => {
    const shuffled = [
      '/repo/tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-nrps.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-dl.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-reg.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-ags.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-launch.k1sim.test.ts',
      '/repo/tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts',
    ];
    const ordered = orderKitSuiteSpecs(shuffled, (p) => p);
    expect(ordered.map((p) => path.basename(p))).toEqual(
      K1_SIM_SUITE_FILES.map((p) => path.basename(p)),
    );
    expect(path.basename(ordered[ordered.length - 1])).toBe('k-hyg.k1sim.test.ts');
  });

  it('A-LA-E7-06-05: buildOperatorGrantCliArgs passes --service-url and --client-id across initial, add_deployment, and acceptStaged flows', () => {
    const canvas = loadChannelFixture('canvas');
    const blackboard = loadChannelFixture('blackboard');
    const generic = loadChannelFixture('lti-generic');
    const brightspace = loadChannelFixture('brightspace');

    // Canvas initial grant: --service-url (never --service) and --client-id
    const canvasInit = buildOperatorGrantCliArgs(
      'lib-1',
      canvas,
      'conn-1',
      'client-canvas-1',
      'dep-1',
    );
    expect(canvasInit).toContain('--service-url');
    expect(canvasInit).not.toContain('--service');
    expect(canvasInit[canvasInit.indexOf('--service-url') + 1]).toBe(canvas.sim.serviceUrl);
    expect(canvasInit).toContain('--client-id');
    expect(canvasInit[canvasInit.indexOf('--client-id') + 1]).toBe('client-canvas-1');

    // Canvas add_deployment: still includes --client-id and --service-url plus --purpose add_deployment
    const canvasAddDep = buildOperatorGrantCliArgs(
      'lib-1',
      canvas,
      'conn-1',
      'client-canvas-1',
      'dep-2',
      { purpose: 'add_deployment' },
    );
    expect(canvasAddDep).toContain('--client-id');
    expect(canvasAddDep[canvasAddDep.indexOf('--client-id') + 1]).toBe('client-canvas-1');
    expect(canvasAddDep).toContain('--service-url');
    expect(canvasAddDep).toContain('--purpose');
    expect(canvasAddDep[canvasAddDep.indexOf('--purpose') + 1]).toBe('add_deployment');

    // Blackboard initial grant: --client-id, no --service-url, no --issuer
    const bbInit = buildOperatorGrantCliArgs('lib-1', blackboard, 'conn-bb', 'client-bb', 'dep-bb');
    expect(bbInit).toContain('--client-id');
    expect(bbInit).not.toContain('--service-url');
    expect(bbInit).not.toContain('--issuer');

    // lti-generic initial manual grant: admin-bound endpoints + --confirm-foreign-hosts
    const genInit = buildOperatorGrantCliArgs(
      'lib-1',
      generic,
      'conn-gen',
      'client-gen',
      'dep-gen-1',
    );
    expect(genInit).toContain('--client-id');
    expect(genInit).toContain('--issuer');
    expect(genInit).toContain('--auth-url');
    expect(genInit).toContain('--token-url');
    expect(genInit).toContain('--jwks-url');
    expect(genInit).toContain('--confirm-foreign-hosts');

    // lti-generic add_deployment: includes --client-id and --purpose add_deployment, omits admin endpoint flags
    const genAddDep = buildOperatorGrantCliArgs(
      'lib-1',
      generic,
      'conn-gen',
      'client-gen',
      'dep-gen-2',
      { purpose: 'add_deployment' },
    );
    expect(genAddDep).toContain('--client-id');
    expect(genAddDep[genAddDep.indexOf('--client-id') + 1]).toBe('client-gen');
    expect(genAddDep).toContain('--purpose');
    expect(genAddDep).not.toContain('--issuer');

    // lti-generic acceptStaged: includes --client-id, --accept-staged, --confirm-foreign-hosts
    const genStaged = buildOperatorGrantCliArgs(
      'lib-1',
      generic,
      'conn-gen',
      'client-gen',
      'dep-gen-1',
      { acceptStaged: true },
    );
    expect(genStaged).toContain('--client-id');
    expect(genStaged).toContain('--accept-staged');
    expect(genStaged).toContain('--confirm-foreign-hosts');
    expect(genStaged).not.toContain('--issuer');

    // brightspace initial manual grant: includes --token-audience
    const bsInit = buildOperatorGrantCliArgs(
      'lib-1',
      brightspace,
      'conn-bs',
      'client-bs',
      brightspace.sim.deployments[0],
    );
    expect(bsInit).toContain('--token-audience');
    expect(bsInit[bsInit.indexOf('--token-audience') + 1]).toBe(brightspace.sim.tokenAudience);

    // brightspace add_deployment: includes --client-id and --purpose add_deployment
    const bsAddDep = buildOperatorGrantCliArgs(
      'lib-1',
      brightspace,
      'conn-bs',
      'client-bs',
      brightspace.sim.deployments[1],
      { purpose: 'add_deployment' },
    );
    expect(bsAddDep).toContain('--client-id');
    expect(bsAddDep).toContain('--purpose');
  });

  it('A-LA-E7-06-06 / A-LA-E7-06-07 / B-LA-E7-06-02: case catalog has L1..L10 per channel, L-FAULTS and N2 once per run, and D5/D6 on every channel', () => {
    const globals = computeExpectedGlobalCaseList();
    expect(globals.map((g) => g.id)).toEqual([
      'GLOBAL:K1-LAUNCH:L-FAULTS',
      'GLOBAL:K1-NRPS:N2',
      'GLOBAL:K-HYG:H1',
    ]);

    for (const fixture of loadAllChannelFixtures()) {
      const cases = computeExpectedCaseList(fixture);
      const codes = cases.map((c) => c.code);
      // L1..L10 per channel, and L-FAULTS is NOT per channel
      for (let i = 1; i <= 10; i += 1) {
        expect(codes).toContain(`L${i}`);
      }
      expect(codes).not.toContain('L-FAULTS');

      // D1..D8 per channel are all RUN (including D5 and D6)
      for (const dCode of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']) {
        const dCase = cases.find((c) => c.code === dCode);
        expect(dCase?.expectedStatus).toBe('RUN');
      }

      // A1..A6 per channel are all RUN
      for (let i = 1; i <= 6; i += 1) {
        expect(cases.find((c) => c.code === `A${i}`)?.expectedStatus).toBe('RUN');
      }

      // N1 per channel is RUN; N2 is global
      expect(cases.find((c) => c.code === 'N1')?.expectedStatus).toBe('RUN');
      expect(codes).not.toContain('N2');
    }
  });

  it('AC-LA-E7-06-06 / A-LA-E7-06-03 / B-LA-E7-06-05: K-HYG secret scanner fails on missing inputs and catches leaks in logs, /__sim/records, and nested artifacts', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-hyg-scan-'));
    try {
      const plantedSecret = 'super-secret-bearer-token-xyz987654321';
      recordSecret(plantedSecret, { stateDir: tmpDir });
      recordRedactedEvidence('nested/sub/clean-evidence', { ok: true }, { stateDir: tmpDir });

      const cleanFetch = async (url: string) => {
        if (url.endsWith('/__sim/secrets')) {
          return { status: 200, json: { values: [plantedSecret] } };
        }
        if (url.includes('/__sim/records')) {
          return { status: 200, json: { cursor: 1, records: [{ kind: 'auth', ok: true }] } };
        }
        return { status: 404, json: null };
      };
      const cleanLogs = () => 'INFO: service started cleanly with redacted logs';

      // 1. All inputs present and clean -> PASS
      const cleanScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: cleanFetch,
        readServiceLogImpl: cleanLogs,
      });
      expect(cleanScan.missingInputs).toEqual([]);
      expect(cleanScan.hits).toEqual([]);
      expect(cleanScan.ok).toBe(true);

      // 2. Missing service log -> FAIL
      const missingLogScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: cleanFetch,
        readServiceLogImpl: (svc) => (svc === 'lti-service' ? '' : 'INFO: ok'),
      });
      expect(missingLogScan.ok).toBe(false);
      expect(missingLogScan.missingInputs).toContain('service:lti-service');

      // 3. Missing /__sim/records -> FAIL
      const missingRecordsScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: async (url) =>
          url.endsWith('/__sim/secrets')
            ? { status: 200, json: { values: [plantedSecret] } }
            : { status: 500, json: null },
        readServiceLogImpl: cleanLogs,
      });
      expect(missingRecordsScan.ok).toBe(false);
      expect(missingRecordsScan.missingInputs).toContain('sim:records');

      // 4. Missing /__sim/secrets -> FAIL
      const missingSecretsScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: async (url) =>
          url.includes('/__sim/records')
            ? { status: 200, json: { cursor: 1, records: [{ kind: 'auth' }] } }
            : { status: 500, json: null },
        readServiceLogImpl: cleanLogs,
      });
      expect(missingSecretsScan.ok).toBe(false);
      expect(missingSecretsScan.missingInputs).toContain('sim:secrets');

      // 5. Missing redacted evidence tree -> FAIL
      const emptyArtifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-hyg-empty-'));
      try {
        const missingEvidenceScan = await scanAllLogsAndArtifactsForSecrets({
          artifactRoot: emptyArtifactDir,
          fetchImpl: cleanFetch,
          readServiceLogImpl: cleanLogs,
        });
        expect(missingEvidenceScan.ok).toBe(false);
        expect(missingEvidenceScan.missingInputs).toContain('artifact:redacted-evidence');
      } finally {
        fs.rmSync(emptyArtifactDir, { recursive: true, force: true });
      }

      // 6. Planted leak in service log -> FAIL with hit in service:cogniate-app
      const leakInLogScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: cleanFetch,
        readServiceLogImpl: (svc) =>
          svc === 'cogniate-app' ? `WARN leaked ${plantedSecret} in log` : 'INFO: clean',
      });
      expect(leakInLogScan.ok).toBe(false);
      expect(leakInLogScan.hits).toEqual([
        { source: 'service:cogniate-app', secretPrefix: `${plantedSecret.slice(0, 6)}...` },
      ]);

      // 7. Planted leak in /__sim/records -> FAIL with hit in sim:records
      const leakInSimRecordsScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: async (url) =>
          url.endsWith('/__sim/secrets')
            ? { status: 200, json: { values: [plantedSecret] } }
            : {
                status: 200,
                json: { cursor: 1, records: [{ kind: 'debug', raw: plantedSecret }] },
              },
        readServiceLogImpl: cleanLogs,
      });
      expect(leakInSimRecordsScan.ok).toBe(false);
      expect(leakInSimRecordsScan.hits).toEqual([
        { source: 'sim:records', secretPrefix: `${plantedSecret.slice(0, 6)}...` },
      ]);

      // 8. Planted leak in nested subdirectory evidence/deep/redacted.json -> FAIL with hit in artifact
      const nestedDir = path.join(tmpDir, 'evidence', 'deep');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(
        path.join(nestedDir, 'redacted.json'),
        JSON.stringify({ note: `accidental leak ${plantedSecret}` }),
        'utf8',
      );
      const leakInArtifactScan = await scanAllLogsAndArtifactsForSecrets({
        artifactRoot: tmpDir,
        fetchImpl: cleanFetch,
        readServiceLogImpl: cleanLogs,
      });
      expect(leakInArtifactScan.ok).toBe(false);
      expect(
        leakInArtifactScan.hits.some((h) => h.source.includes('evidence/deep/redacted.json')),
      ).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
