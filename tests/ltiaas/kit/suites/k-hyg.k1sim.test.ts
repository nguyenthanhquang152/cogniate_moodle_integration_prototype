import { beforeAll, describe, expect, it } from 'vitest';
import {
  computeExpectedCaseList,
  evaluateChannelPassRule,
  loadSelectedChannelFixtures,
} from '../lib/fixtures.js';
import {
  ensureKitRunInitialized,
  evaluateKitRunPassRule,
  getActiveKitRunId,
  isK1SimEnabled,
  loadWaveEvidenceFromRun,
  readAllExecutedCases,
  recordExecutedCase,
  recordRedactedEvidence,
  runKitCase,
  scanAllLogsAndArtifactsForSecrets,
  writeKitRunSummaryArtifacts,
} from '../lib/runtime.js';

const runSuite = isK1SimEnabled() ? describe : describe.skip;
const fixtures = loadSelectedChannelFixtures();

runSuite('K-HYG: Secret Hygiene & Pass-Rule Verification Suite (runs last)', () => {
  beforeAll(() => {
    ensureKitRunInitialized({ channels: fixtures.map((f) => f.id) });
  });

  it('[GLOBAL:K-HYG:H1] secret scan across service logs, /__sim/records, and recursive redacted evidence tree finds 0 leaks', async () => {
    await runKitCase('GLOBAL', 'K-HYG', 'H1', async () => {
      recordRedactedEvidence('hyg-pre-scan', {
        suite: 'K-HYG',
        channels: fixtures.map((f) => f.id),
        redacted: true,
      });
      const scan = await scanAllLogsAndArtifactsForSecrets();
      expect(scan.missingInputs).toEqual([]);
      expect(scan.secretCount).toBeGreaterThan(0);
      expect(scan.hits).toEqual([]);
      expect(scan.leakedCount).toBe(0);
      expect(scan.ok).toBe(true);
    });
  });

  for (const fixture of fixtures) {
    it(`[${fixture.id}:K-HYG:H2] pass rule & N/A rule verification: executed cases === expected RUN cases, 0 skips, 0 retries, wave evidence verified`, async () => {
      const activeRunId = getActiveKitRunId();
      const h2Id = `${fixture.id}:K-HYG:H2`;
      const waveEvidence = loadWaveEvidenceFromRun();
      const currentWaveId = process.env.LA_WAVE_ID ?? waveEvidence.waveId;
      const priorRecords = readAllExecutedCases();
      const syntheticRecords = [
        ...priorRecords,
        {
          id: h2Id,
          channelId: fixture.id,
          suite: 'K-HYG' as const,
          code: 'H2',
          outcome: 'PASS' as const,
          runId: activeRunId,
        },
      ];

      const evalResult = evaluateChannelPassRule({
        fixture,
        expectedCases: computeExpectedCaseList(fixture),
        executedRecords: syntheticRecords,
        waveEvidence,
        currentWaveId,
        expectedRunId: activeRunId,
      });

      if (!evalResult.ok) {
        recordExecutedCase({
          id: h2Id,
          channelId: fixture.id,
          suite: 'K-HYG',
          code: 'H2',
          outcome: 'FAIL',
          runId: activeRunId,
          detail: evalResult.errors.join('; '),
        });
      } else {
        recordExecutedCase({
          id: h2Id,
          channelId: fixture.id,
          suite: 'K-HYG',
          code: 'H2',
          outcome: 'PASS',
          runId: activeRunId,
        });
      }

      expect(evalResult.errors).toEqual([]);
      expect(evalResult.failedCases).toEqual([]);
      expect(evalResult.duplicateOrRetriedCases).toEqual([]);
      expect(evalResult.staleRunCases).toEqual([]);
      expect(evalResult.missingCases).toEqual([]);
      expect(evalResult.extraCases).toEqual([]);
      expect(evalResult.illegalNaCases).toEqual([]);
      expect(evalResult.uncoveredPositiveCapabilities).toEqual([]);
      expect(evalResult.missingNegativeGuards).toEqual([]);
      expect(evalResult.skippedCount).toBe(0);
      expect(evalResult.ok).toBe(true);
    });
  }

  it('[GLOBAL:K-HYG:SUMMARY] emits k1-kit-summary.md and k1-kit-summary.json and enforces full-run certification', () => {
    const activeRunId = getActiveKitRunId();
    const waveEvidence = loadWaveEvidenceFromRun();
    const currentWaveId = process.env.LA_WAVE_ID ?? waveEvidence.waveId;
    const allRecords = readAllExecutedCases();

    const report = evaluateKitRunPassRule({
      fixtures,
      executedRecords: allRecords,
      waveEvidence,
      currentWaveId,
      expectedRunId: activeRunId,
      requireH1: true,
    });

    // Always write summary artifacts before asserting so failure details are preserved on disk.
    writeKitRunSummaryArtifacts(report);

    expect(report.globalErrors).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
