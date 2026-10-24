// Types of wave-producer.mjs (AC-LA-E7-06-05 wave evidence producer).
export interface WaveSuiteDefinition {
  kind: 'host-summary' | 'e2e-summary';
  runner: string;
  task?: string;
  requiredIds?: readonly string[];
  specDir?: string;
  specFiles?: readonly string[];
  allowedSkipFiles?: readonly string[];
}
export const WAVE_SUITES: Readonly<Record<'T3b' | 'T7' | 'T8', WaveSuiteDefinition>>;
export interface WaveSpecEntry {
  suite: string;
  file: string;
  kind?: string;
  task?: string;
}
export function specFileTitles(text: string): string[];
export function judgeWaveSource(
  spec: WaveSpecEntry,
  options?: { repoRoot?: string },
): { outcome: 'PASS' | 'FAIL'; notes: string[]; sha: string | null; runId: string | null };
export function writeWaveEvidence(input: {
  specs: WaveSpecEntry[];
  runDir: string;
  waveId: string;
  repoRoot?: string;
}): {
  ok: boolean;
  notes: string[];
  manifest: { waveId: string; suites: Record<string, { outcome: string; waveId: string; artifactPath: string }> };
};
