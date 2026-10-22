export const FILES: readonly ['G1', 'G2', 'G3', 'G4'];
export const G1_LMS_PROVIDERS_AND_CONNECTIONS: RegExp[];

export interface Difference {
  file?: string;
  path: string;
  kind: 'changed' | 'added' | 'removed';
  old: unknown;
  new: unknown;
  explainedBy?: string | null;
}

export interface ExpectedDeltaChange {
  file: 'G1' | 'G2' | 'G3' | 'G4' | string;
  path: string;
  value?: unknown;
  rule?: 'present' | 'removed' | 'string' | 'boolean' | 'number' | 'object' | 'array';
}

export interface ExpectedDelta {
  id: string;
  approval?: string;
  changes: ExpectedDeltaChange[];
}

export interface CompareResult {
  ok: boolean;
  differences: Array<Difference & { file: string; explainedBy: string | null }>;
  missing: Array<ExpectedDeltaChange & { id: string }>;
}

export function diff(oldValue: unknown, newValue: unknown, path?: string, out?: Difference[]): Difference[];
export function pathMatches(pattern: string, path: string): boolean;
export function compareCaptures(
  base: Record<string, unknown>,
  candidate: Record<string, unknown>,
  expected?: ExpectedDelta[],
): CompareResult;
export function report(result: { differences: Array<Difference & { file: string }>; missing: Array<ExpectedDeltaChange & { id: string }> }): string[];
export function loadCapture(dir: string): Record<string, unknown>;
export function loadExpectedDelta(item: string, expectedDir?: string): ExpectedDelta;
export function differingPaths(reportText: string): string[];
export function captureDocuments(captureDir: string): string[];

export const cliBinding: {
  compare: (baseline: string, capture: string, expectedDelta?: string) => { cmd: string; args: string[] };
  differingPaths: (reportText: string) => string[];
  documents: (captureDir: string) => string[];
};
