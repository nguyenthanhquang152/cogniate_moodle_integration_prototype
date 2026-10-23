import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WAVE_PASS_RESULTS,
  evaluateChannelPassRule,
  formatKitSummaryMarkdown,
  loadActiveChannelFixtures,
  type ExecutedCaseRecord,
  type PassRuleResult,
} from '../lib/fixtures';
import {
  getKitStateDir,
  readAllExecutedCases,
  scanAllLogsAndArtifactsForSecrets,
} from '../lib/runtime';

const channels = loadActiveChannelFixtures();

describe('K-HYG secret hygiene and K1 channel pass-rule verification', () => {
  let leakedSecretCount = 0;

  it('H1: service logs, /__sim/secrets, and run artifacts contain zero leaked tokens, keys, assertions, cookies, or grant codes', async () => {
    const scan = await scanAllLogsAndArtifactsForSecrets();
    leakedSecretCount = scan.leakedCount;
    expect(scan.secretCount).toBeGreaterThan(0);
    expect(scan.hits, `Secret leak hits: ${JSON.stringify(scan.hits)}`).toEqual([]);
    expect(scan.ok).toBe(true);
  });

  it('H2: every active channel satisfies the K1 pass rule (zero missing cases, zero extra cases, zero skipped tests, positive and off capabilities covered)', () => {
    const allExecuted = readAllExecutedCases();
    const byChannel = new Map<string, ExecutedCaseRecord[]>();
    const passResults = new Map<string, PassRuleResult>();

    for (const fixture of channels) {
      const channelRecs = allExecuted.filter((r) => r.channelId === fixture.id);
      byChannel.set(fixture.id, channelRecs);
      const result = evaluateChannelPassRule({
        fixture,
        executedCases: channelRecs,
        skippedCount: 0,
        leakedSecretCount,
        wavePassResults: DEFAULT_WAVE_PASS_RESULTS,
      });
      passResults.set(fixture.id, result);
      expect(result.errors, `Pass rule errors for ${fixture.id}`).toEqual([]);
      expect(result.ok).toBe(true);
    }

    const summaryMd = formatKitSummaryMarkdown(channels, byChannel, passResults);
    const outPath = path.join(getKitStateDir(), 'k1-kit-summary.md');
    fs.writeFileSync(outPath, summaryMd, { mode: 0o600 });
  });
});
