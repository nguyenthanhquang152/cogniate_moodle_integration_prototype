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
  buildOperatorGrantNpmArgs,
  CAPABILITY_KEYS,
  ChannelFixture,
  computeExpectedCaseList,
  computeExpectedGlobalCaseList,
  deriveLegacyFlagsFromCapabilities,
  evaluateChannelPassRule,
  ExecutedCaseRecord,
  getChannelsDir,
  isK1SimLevelEnabled,
  K1_SIM_SUITE_FILES,
  listChannelFixtureIds,
  loadAllChannelFixtures,
  loadChannelFixture,
  orderKitSuiteSpecs,
  parseOperatorGrantOutput,
  PROTOCOL_SECURITY_FAULTS,
  resolveKitLevel,
  resolveSelectedChannelIds,
  verifyBilateralCapabilities,
  WaveEvidenceManifest,
} from './lib/fixtures.js';
import {
  deriveCurrentWaveIdFromRun,
  evaluateKitRunPassRule,
  initKitRunLedger,
  isK1SimEnabled,
  issueOperatorGrantForChannel,
  loadWaveEvidenceFromRun,
  readAllExecutedCases,
  recordRedactedEvidence,
  recordSecret,
  recordSkippedCase,
  runKitCase,
  scanAllLogsAndArtifactsForSecrets,
  writeKitRunSummaryArtifacts,
  writeWaveEvidenceToRun,
} from './lib/runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.join(__dirname, 'suites');
const REPO_ROOT = path.resolve(__dirname, '../../..');

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

export function runShippedChannelsAudit(dir: string = getChannelsDir()): ChannelFixture[] {
  const ids = listChannelFixtureIds(dir);
  expect(ids.slice(0, BASELINE_CHANNEL_IDS.length)).toEqual([...BASELINE_CHANNEL_IDS]);
  const fixtures = loadAllChannelFixtures(dir);
  expect(fixtures.length).toBeGreaterThanOrEqual(BASELINE_CHANNEL_IDS.length);

  for (const fixture of fixtures) {
    expect(Object.keys(fixture.capabilities).sort()).toEqual([...CAPABILITY_KEYS].sort());
    const audit = auditFixtureSources(fixture);
    expect(audit.errors).toEqual([]);
    expect(audit.ok).toBe(true);
    const cases = computeExpectedCaseList(fixture);
    expect(cases.length).toBeGreaterThan(0);
  }
  return fixtures;
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

  it('AC-LA-E7-06-03 / TB-12: all discovered channel fixtures have complete 17-key capabilities and verified source citations', () => {
    const fixtures = runShippedChannelsAudit();

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

  it('B-LA-E7-06-06 / LA-E8-01: open-world channel discovery onboards a 6th <id>.json fixture and passes runShippedChannelsAudit with zero shared-list edits', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-canary-channels-'));
    try {
      for (const id of listChannelFixtureIds()) {
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

      // Run the shipped audit function against the 6-file directory
      const audited = runShippedChannelsAudit(tmpDir);
      expect(audited.length).toBe(6);
      expect(audited.map((f) => f.id)).toEqual([...BASELINE_CHANNEL_IDS, 'canary-lms']);

      // Default selection and 'all' selection both include the 6th fixture automatically
      expect(resolveSelectedChannelIds(undefined, tmpDir)).toEqual([
        ...BASELINE_CHANNEL_IDS,
        'canary-lms',
      ]);
      expect(resolveSelectedChannelIds('all', tmpDir)).toEqual([
        ...BASELINE_CHANNEL_IDS,
        'canary-lms',
      ]);
      expect(resolveSelectedChannelIds('canary-lms', tmpDir)).toEqual(['canary-lms']);

      const expectedCases = computeExpectedCaseList(canaryFixture);
      expect(
        expectedCases.some((c) => c.id === 'canary-lms:K1-CAP:C2:setup.connectionCheck'),
      ).toBe(true);
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

    const flippedCap = structuredClone(validInput);
    flippedCap.providerChannelCapabilities['site.serviceOrigin'] = false;
    const flippedRes = verifyBilateralCapabilities(flippedCap);
    expect(flippedRes.ok).toBe(false);
    expect(flippedRes.errors[0]).toContain('site.serviceOrigin');

    const reorderedKeys = structuredClone(validInput);
    reorderedKeys.toolConfigurationKeys.reverse();
    const reorderedRes = verifyBilateralCapabilities(reorderedKeys);
    expect(reorderedRes.ok).toBe(false);
    expect(reorderedRes.errors[0]).toContain('tool-configuration keys mismatch');
  });

  it('AC-LA-E7-06-05 / A-LA-E7-06-01 / B-LA-E7-06-01: coveredBy never falls back to waveEvidence.waveId and verifies referenced suite artifact files on disk', () => {
    const moodle = loadChannelFixture('moodle');
    const runId = 'run-wave-test';
    const records = buildPassingRecordsForChannel(moodle, runId);

    const waveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-wave-verify-'));
    const prevWaveEnv = process.env.LA_WAVE_ID;
    try {
      delete process.env.LA_WAVE_ID;

      // 1. Calling evaluateChannelPassRule with no waveEvidence MUST fail
      const noWaveRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: null,
        runDir: waveDir,
      });
      expect(noWaveRes.ok).toBe(false);
      expect(noWaveRes.errors.some((e) => e.includes('missing wave evidence'))).toBe(true);

      // 2. Omitted currentWaveId (and LA_WAVE_ID unset) with a self-consistent old wave-evidence.json MUST FAIL (never fall back to waveEvidence.waveId!)
      writeWaveEvidenceToRun(
        {
          waveId: 'wave-B1-old',
          suites: {
            T3b: {
              outcome: 'PASS',
              waveId: 'wave-B1-old',
              artifactPath: 'artifacts/T3b/summary.json',
            },
            T7: {
              outcome: 'PASS',
              waveId: 'wave-B1-old',
              artifactPath: 'artifacts/T7/summary.json',
            },
            T8: {
              outcome: 'PASS',
              waveId: 'wave-B1-old',
              artifactPath: 'artifacts/T8/summary.json',
            },
          },
        },
        waveDir,
      );
      const oldManifest = loadWaveEvidenceFromRun({ stateDir: waveDir });
      expect(deriveCurrentWaveIdFromRun({ env: {} as NodeJS.ProcessEnv })).toBeNull();

      const omittedCurrentWaveRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        waveEvidence: oldManifest,
        runDir: waveDir,
      });
      expect(omittedCurrentWaveRes.ok).toBe(false);
      expect(
        omittedCurrentWaveRes.errors.some((e) => e.includes('requires currentWaveId')),
      ).toBe(true);

      // Full-run evaluator also fails when currentWaveId is omitted and LA_WAVE_ID is unset
      const omittedKitRunRes = evaluateKitRunPassRule({
        fixtures: [moodle],
        executedRecords: [
          ...records,
          ...computeExpectedGlobalCaseList().map((g) => ({
            id: g.id,
            channelId: 'GLOBAL',
            suite: g.suite,
            code: g.code,
            outcome: 'PASS' as const,
            runId,
          })),
        ],
        waveEvidence: oldManifest,
        expectedRunId: runId,
        runDir: waveDir,
      });
      expect(omittedKitRunRes.ok).toBe(false);

      // 3. Stale waveId on manifest vs currentWaveId MUST fail
      const staleRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: oldManifest,
        runDir: waveDir,
      });
      expect(staleRes.ok).toBe(false);
      expect(staleRes.errors.some((e) => e.includes('stale wave evidence'))).toBe(true);

      // 4. artifactPath pointing to a missing file on disk MUST fail
      const missingArtifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-wave-no-art-'));
      try {
        writeWaveEvidenceToRun(VALID_WAVE_EVIDENCE, missingArtifactDir, {
          skipArtifactFiles: true,
        });
        const manifestWithoutFiles = loadWaveEvidenceFromRun({
          stateDir: missingArtifactDir,
          currentWaveId: VALID_WAVE_ID,
        });
        const missingFileRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: manifestWithoutFiles,
          runDir: missingArtifactDir,
        });
        expect(missingFileRes.ok).toBe(false);
        expect(
          missingFileRes.errors.some((e) => e.includes('does not exist')),
        ).toBe(true);
      } finally {
        fs.rmSync(missingArtifactDir, { recursive: true, force: true });
      }

      // 5. artifactPath resolving outside the current run folder MUST fail
      const outsideRes = evaluateChannelPassRule({
        fixture: moodle,
        executedRecords: records,
        expectedRunId: runId,
        currentWaveId: VALID_WAVE_ID,
        waveEvidence: {
          waveId: VALID_WAVE_ID,
          suites: {
            ...VALID_WAVE_EVIDENCE.suites,
            T8: {
              outcome: 'PASS',
              waveId: VALID_WAVE_ID,
              artifactPath: '../outside-run-folder.json',
            },
          },
        },
        runDir: waveDir,
      });
      expect(outsideRes.ok).toBe(false);
      expect(
        outsideRes.errors.some((e) => e.includes('resolves outside current run folder')),
      ).toBe(true);

      // 6. artifactPath whose file content reports FAIL or wrong waveId while wave-evidence.json says PASS MUST fail
      const validDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-wave-valid-'));
      try {
        writeWaveEvidenceToRun(VALID_WAVE_EVIDENCE, validDir);
        // Corrupt T8 artifact file to report outcome: FAIL
        const t8ArtifactPath = path.join(validDir, 'artifacts/T8/summary.json');
        fs.writeFileSync(
          t8ArtifactPath,
          JSON.stringify({ suite: 'T8', waveId: VALID_WAVE_ID, outcome: 'FAIL' }),
          'utf8',
        );
        const loadedContradictory = loadWaveEvidenceFromRun({
          stateDir: validDir,
          currentWaveId: VALID_WAVE_ID,
        });
        const contradictoryRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: loadedContradictory,
          runDir: validDir,
        });
        expect(contradictoryRes.ok).toBe(false);
        expect(
          contradictoryRes.errors.some((e) =>
            e.includes('has outcome="FAIL" !== "PASS"'),
          ),
        ).toBe(true);

        // Restore valid T8 artifact file -> PASSES
        fs.writeFileSync(
          t8ArtifactPath,
          JSON.stringify({ suite: 'T8', waveId: VALID_WAVE_ID, outcome: 'PASS' }),
          'utf8',
        );
        const validRes = evaluateChannelPassRule({
          fixture: moodle,
          executedRecords: records,
          expectedRunId: runId,
          currentWaveId: VALID_WAVE_ID,
          waveEvidence: loadedContradictory,
          runDir: validDir,
        });
        expect(validRes.errors).toEqual([]);
        expect(validRes.ok).toBe(true);
      } finally {
        fs.rmSync(validDir, { recursive: true, force: true });
      }
    } finally {
      if (prevWaveEnv === undefined) {
        delete process.env.LA_WAVE_ID;
      } else {
        process.env.LA_WAVE_ID = prevWaveEnv;
      }
      fs.rmSync(waveDir, { recursive: true, force: true });
    }
  });

  it('AC-LA-E7-06-02 / A-LA-E7-06-04 / B-LA-E7-06-04: ledger records FAIL before rethrow, preserves duplicate/retried records, counts SKIPs, rejects stale runId, and rejects unselected/unknown channel records', async () => {
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

      // 2. A subsequent PASS on the same case ID does NOT overwrite the earlier FAIL
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

      // 4. Stale runId record is rejected
      const staleRecords = buildPassingRecordsForChannel(canvas, 'run-old-stale');
      const evalStale = evaluateChannelPassRule({
        fixture: canvas,
        executedRecords: staleRecords,
        expectedRunId: runId,
      });
      expect(evalStale.ok).toBe(false);
      expect(evalStale.staleRunCases.length).toBeGreaterThan(0);

      // 5. Full-run evaluation: passing baseline
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

      // 6. Full-run evaluation MUST reject any record with an unselected or unknown channelId (A-LA-E7-06-04 / B-LA-E7-06-04)
      const withUnexpectedFail = evaluateKitRunPassRule({
        fixtures: [canvas],
        executedRecords: [
          ...buildPassingRecordsForChannel(canvas, runId),
          ...globalPass,
          {
            id: 'unexpected:K1-REG:R99',
            channelId: 'unexpected',
            suite: 'K1-REG',
            code: 'R99',
            outcome: 'FAIL',
            runId,
          },
        ],
        expectedRunId: runId,
        requireH1: true,
      });
      expect(withUnexpectedFail.ok).toBe(false);
      expect(withUnexpectedFail.totalFailed).toBe(1);
      expect(
        withUnexpectedFail.globalErrors.some((e) =>
          e.includes('unexpected channel record: unexpected:K1-REG:R99'),
        ),
      ).toBe(true);

      const withUnselectedChannelPass = evaluateKitRunPassRule({
        fixtures: [canvas],
        executedRecords: [
          ...buildPassingRecordsForChannel(canvas, runId),
          ...globalPass,
          {
            id: 'brightspace:K1-LAUNCH:L1',
            channelId: 'brightspace',
            suite: 'K1-LAUNCH',
            code: 'L1',
            outcome: 'PASS',
            runId,
          },
        ],
        expectedRunId: runId,
        requireH1: true,
      });
      expect(withUnselectedChannelPass.ok).toBe(false);
      expect(
        withUnselectedChannelPass.globalErrors.some((e) =>
          e.includes('unexpected channel record: brightspace:K1-LAUNCH:L1'),
        ),
      ).toBe(true);

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

  it('A-LA-E7-06-05: buildOperatorGrantCliArgs, buildOperatorGrantNpmArgs, and parseOperatorGrantOutput match the app:grant contract (cogniate-app-api.md §4.8; cogniate-app-api-delta.md §4)', async () => {
    const canvas = loadChannelFixture('canvas');
    const blackboard = loadChannelFixture('blackboard');
    const generic = loadChannelFixture('lti-generic');
    const brightspace = loadChannelFixture('brightspace');

    // 1. Full npm command uses workspace @cogniate/cogniate-app (README §2 form (f))
    const npmArgs = buildOperatorGrantNpmArgs(
      'lib-1',
      canvas,
      'conn-1',
      'client-canvas-1',
      'dep-1',
    );
    expect(npmArgs.slice(0, 5)).toEqual([
      '--workspace',
      '@cogniate/cogniate-app',
      'run',
      'app:grant',
      '--',
    ]);

    // 2. Canvas initial grant: --service-url, --client-id, --deployment-id, --purpose initial, --note; NEVER --lms
    const canvasInit = buildOperatorGrantCliArgs(
      'lib-1',
      canvas,
      'conn-1',
      'client-canvas-1',
      'dep-1',
    );
    expect(canvasInit).not.toContain('--lms');
    expect(canvasInit).toContain('--service-url');
    expect(canvasInit[canvasInit.indexOf('--service-url') + 1]).toBe(canvas.sim.serviceUrl);
    expect(canvasInit).toContain('--client-id');
    expect(canvasInit[canvasInit.indexOf('--client-id') + 1]).toBe('client-canvas-1');
    expect(canvasInit).toContain('--purpose');
    expect(canvasInit[canvasInit.indexOf('--purpose') + 1]).toBe('initial');
    expect(canvasInit).toContain('--note');

    // 3. Canvas add_deployment: --client-id, --service-url, --purpose add_deployment, --note; NEVER --lms
    const canvasAddDep = buildOperatorGrantCliArgs(
      'lib-1',
      canvas,
      'conn-1',
      'client-canvas-1',
      'dep-2',
      { purpose: 'add_deployment' },
    );
    expect(canvasAddDep).not.toContain('--lms');
    expect(canvasAddDep).toContain('--client-id');
    expect(canvasAddDep).toContain('--service-url');
    expect(canvasAddDep[canvasAddDep.indexOf('--purpose') + 1]).toBe('add_deployment');
    expect(canvasAddDep).toContain('--note');

    // 4. Blackboard initial grant: --client-id, --note, no --service-url, no --issuer, no --lms
    const bbInit = buildOperatorGrantCliArgs(
      'lib-1',
      blackboard,
      'conn-bb',
      'client-bb',
      'dep-bb',
    );
    expect(bbInit).not.toContain('--lms');
    expect(bbInit).toContain('--client-id');
    expect(bbInit).toContain('--note');
    expect(bbInit).not.toContain('--service-url');
    expect(bbInit).not.toContain('--issuer');

    // 5. lti-generic initial manual grant: admin-bound endpoints + --confirm-foreign-hosts + --note
    const genInit = buildOperatorGrantCliArgs(
      'lib-1',
      generic,
      'conn-gen',
      'client-gen',
      'dep-gen-1',
    );
    expect(genInit).not.toContain('--lms');
    expect(genInit).toContain('--client-id');
    expect(genInit).toContain('--issuer');
    expect(genInit).toContain('--auth-url');
    expect(genInit).toContain('--token-url');
    expect(genInit).toContain('--jwks-url');
    expect(genInit).toContain('--confirm-foreign-hosts');
    expect(genInit).toContain('--note');

    // 6. lti-generic acceptStaged: --accept-staged, --confirm-foreign-hosts, --note
    const genStaged = buildOperatorGrantCliArgs(
      'lib-1',
      generic,
      'conn-gen',
      'client-gen',
      'dep-gen-1',
      { acceptStaged: true },
    );
    expect(genStaged).toContain('--accept-staged');
    expect(genStaged).toContain('--confirm-foreign-hosts');
    expect(genStaged).toContain('--note');
    expect(genStaged).not.toContain('--issuer');

    // 7. brightspace initial manual grant: includes --token-audience and --note
    const bsInit = buildOperatorGrantCliArgs(
      'lib-1',
      brightspace,
      'conn-bs',
      'client-bs',
      brightspace.sim.deployments[0],
    );
    expect(bsInit).toContain('--token-audience');
    expect(bsInit[bsInit.indexOf('--token-audience') + 1]).toBe(
      brightspace.sim.tokenAudience,
    );
    expect(bsInit).toContain('--note');

    // 8. Parse documented operator CLI output (cogniate-app-api.md §4.8: 43-char base64url approval code + grt_ id)
    const sample43Code = 'k7Qp9mXz2vL4nR8tY1wB5cF3hJ6kM0pQ9rS2uV4xZ1a';
    expect(sample43Code.length).toBe(43);
    const sampleCliStdout = [
      'Grant id:        grt_01JABCDEF123456789',
      'Library:         lib-1',
      'Connection:      conn-1',
      'Purpose:         initial',
      'Site URL:        https://canvas.sim.test',
      'Client ID:       client-canvas-1',
      'Deployment ID:   dep-1',
      'Expires at:      2026-04-12T10:15:00Z',
      '',
      'Approval code (shown once):',
      `  ${sample43Code}`,
    ].join('\n');

    const parsed = parseOperatorGrantOutput(sampleCliStdout);
    expect(parsed).toEqual({
      id: 'grt_01JABCDEF123456789',
      code: sample43Code,
    });

    // Also test issueOperatorGrantForChannel with an injected runner
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-grant-runner-'));
    const prevRunDir = process.env.LA_RUN_DIR;
    try {
      process.env.LA_RUN_DIR = tmpDir;
      const issued = await issueOperatorGrantForChannel(
        'lib-1',
        canvas,
        'conn-1',
        'client-canvas-1',
        'dep-1',
        { purpose: 'initial' },
        async (_cmd, passedArgs) => {
          expect(passedArgs).not.toContain('--lms');
          expect(passedArgs).toContain('--note');
          return { exitCode: 0, stdout: sampleCliStdout, stderr: '' };
        },
      );
      expect(issued.id).toBe('grt_01JABCDEF123456789');
      expect(issued.code).toBe(sample43Code);
    } finally {
      if (prevRunDir === undefined) {
        delete process.env.LA_RUN_DIR;
      } else {
        process.env.LA_RUN_DIR = prevRunDir;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Negative probe: output without a 43-char base64url token throws
    expect(() => parseOperatorGrantOutput('Grant id: grt_01J123\ncgg_short')).toThrow(
      /Expected one approval code/,
    );
  });

  it('AC-LA-E7-06-08 / A-LA-E7-06-09: PROTOCOL_SECURITY_FAULTS matches all 12 simulator faults and expected error codes from 20-protocol.test.ts', () => {
    expect(PROTOCOL_SECURITY_FAULTS.length).toBe(12);
    expect(PROTOCOL_SECURITY_FAULTS).toEqual([
      ['altered-signature', 'INVALID_SIGNATURE'],
      ['unknown-key', 'INVALID_SIGNATURE'],
      ['unknown-kid', 'INVALID_SIGNATURE'],
      ['none', 'INVALID_ID_TOKEN'],
      ['hs256', 'INVALID_ID_TOKEN'],
      ['wrong-issuer', 'INVALID_ISSUER_OR_AUDIENCE'],
      ['wrong-audience', 'INVALID_ISSUER_OR_AUDIENCE'],
      ['multi-aud-no-azp', 'INVALID_ISSUER_OR_AUDIENCE'],
      ['multi-aud-wrong-azp', 'INVALID_ISSUER_OR_AUDIENCE'],
      ['expired', 'TOKEN_EXPIRED'],
      ['future-iat', 'TOKEN_EXPIRED'],
      ['wrong-nonce', 'INVALID_NONCE'],
    ]);

    // Cross-check against tests/acceptance/M1/blackboard/20-protocol.test.ts and tests/sim/core/crypto.mjs
    const m1ProtoFile = fs.readFileSync(
      path.join(REPO_ROOT, 'tests/acceptance/M1/blackboard/20-protocol.test.ts'),
      'utf8',
    );
    const simCryptoFile = fs.readFileSync(
      path.join(REPO_ROOT, 'tests/sim/core/crypto.mjs'),
      'utf8',
    );
    const simProviderFile = fs.readFileSync(
      path.join(REPO_ROOT, 'tests/sim/core/provider.mjs'),
      'utf8',
    );
    for (const [fault, expectedCode] of PROTOCOL_SECURITY_FAULTS) {
      expect(m1ProtoFile).toContain(`['${fault}', '${expectedCode}']`);
      expect(
        simCryptoFile.includes(`'${fault}'`) || simProviderFile.includes(`'${fault}'`),
      ).toBe(true);
    }
  });

  it('A-LA-E7-06-10 / B-LA-E7-06-08: resolveKitLevel and isK1SimEnabled accept k0, k1sim, k1-sim, and all consistently across vitest.config.mts and runtime.ts', () => {
    expect(resolveKitLevel({ LA_LEVEL: 'k0' } as unknown as NodeJS.ProcessEnv)).toBe('k0');
    expect(resolveKitLevel({ LA_LEVEL: 'k1sim' } as unknown as NodeJS.ProcessEnv)).toBe(
      'k1sim',
    );
    expect(resolveKitLevel({ LA_LEVEL: 'k1-sim' } as unknown as NodeJS.ProcessEnv)).toBe(
      'k1sim',
    );
    expect(resolveKitLevel({ LA_LEVEL: 'all' } as unknown as NodeJS.ProcessEnv)).toBe(
      'all',
    );
    expect(resolveKitLevel({ QA_TASK: 'K1' } as unknown as NodeJS.ProcessEnv)).toBe(
      'k1sim',
    );
    expect(resolveKitLevel({ QA_TASK: 'LA-E7-06' } as unknown as NodeJS.ProcessEnv)).toBe(
      'k1sim',
    );
    expect(resolveKitLevel({} as unknown as NodeJS.ProcessEnv)).toBe('k0');

    expect(isK1SimLevelEnabled({ LA_LEVEL: 'k0' } as unknown as NodeJS.ProcessEnv)).toBe(
      false,
    );
    expect(
      isK1SimLevelEnabled({ LA_LEVEL: 'k1sim' } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isK1SimLevelEnabled({ LA_LEVEL: 'k1-sim' } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(isK1SimLevelEnabled({ LA_LEVEL: 'all' } as unknown as NodeJS.ProcessEnv)).toBe(
      true,
    );
    expect(isK1SimEnabled({ LA_LEVEL: 'k1sim' } as unknown as NodeJS.ProcessEnv)).toBe(
      true,
    );
    expect(isK1SimEnabled({ LA_LEVEL: 'all' } as unknown as NodeJS.ProcessEnv)).toBe(
      true,
    );

    expect(() =>
      resolveKitLevel({ LA_LEVEL: 'bogus' } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/Unsupported LA_LEVEL=bogus/);
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
      for (let i = 1; i <= 10; i += 1) {
        expect(codes).toContain(`L${i}`);
      }
      expect(codes).not.toContain('L-FAULTS');

      for (const dCode of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']) {
        const dCase = cases.find((c) => c.code === dCode);
        expect(dCase?.expectedStatus).toBe('RUN');
      }

      for (let i = 1; i <= 6; i += 1) {
        expect(cases.find((c) => c.code === `A${i}`)?.expectedStatus).toBe('RUN');
      }

      expect(cases.find((c) => c.code === 'N1')?.expectedStatus).toBe('RUN');
      expect(codes).not.toContain('N2');
    }
  });

  it('A-LA-E7-06-07 / A-LA-E7-06-08 / B-LA-E7-06-02 / B-LA-E7-06-07: runtime and suite files use frozen M1 helpers and documented contracts for A3, L7, C2, R6, C1, D1-D6, and K-HYG', () => {
    const runtimeSrc = fs.readFileSync(path.join(__dirname, 'lib/runtime.ts'), 'utf8');
    // Verify frozen M1 helper imports are used instead of bespoke session/route forgery
    expect(runtimeSrc).toContain("from '../../../acceptance/M1/common/client.js'");
    expect(runtimeSrc).toContain("from '../../../acceptance/M1/common/course.js'");
    expect(runtimeSrc).toContain("from '../../../acceptance/lib/paths.js'");
    expect(runtimeSrc).not.toContain('cogniate_staff_session');
    expect(runtimeSrc).not.toContain('x-service-api-key');

    // Verify C2 guard probe asserts both noServiceCalls(cursor) and logEvents('outbound_request', ...)
    expect(runtimeSrc).toContain('await noServiceCalls(cursor)');
    expect(runtimeSrc).toContain("logEvents('outbound_request'");

    // Verify A3 tests all 5 status mappings including 429 tries === 0 and 409 conflict message
    const agsSrc = fs.readFileSync(path.join(SUITES_DIR, 'k1-ags.k1sim.test.ts'), 'utf8');
    expect(agsSrc).toContain('for (const errStatus of [400, 404, 422])');
    expect(agsSrc).toContain("'has a grade with a newer time'");
    expect(agsSrc).toContain('expect(sync429?.tries).toBe(0)');
    expect(agsSrc).toContain("logEvents('dispatch_throttled'");

    // Verify L7 tests contextless score dispatch, shared resourceLinkId placement, and no-AGS clear message
    const launchSrc = fs.readFileSync(
      path.join(SUITES_DIR, 'k1-launch.k1sim.test.ts'),
      'utf8',
    );
    expect(launchSrc).toContain('commitGrade(play1');
    expect(launchSrc).toContain('expect(row1!.resourceLinkId).toBe(sharedRlId)');
    expect(launchSrc).toContain('expect(row2!.resourceLinkId).toBe(sharedRlId)');
    expect(launchSrc).toContain(
      "'No gradebook column: the activity has no AGS line item.'",
    );

    // Verify R6 tests off-origin staging (endpointsOnIssuerOrigin: false, active: false, PLATFORM_NOT_ACTIVE) and POST /api/platforms refusals
    const regSrc = fs.readFileSync(path.join(SUITES_DIR, 'k1-reg.k1sim.test.ts'), 'utf8');
    expect(regSrc).toContain('expect(previewRes.json.endpointsOnIssuerOrigin).toBe(false)');
    expect(regSrc).toContain('expect(completeRes.json.active).toBe(false)');
    expect(regSrc).toContain("denied(unapprovedLaunch.response, 'PLATFORM_NOT_ACTIVE', 403)");
    expect(regSrc).toContain('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN');
    expect(regSrc).toContain('PLATFORM_URL_NOT_IN_PROFILE');
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
