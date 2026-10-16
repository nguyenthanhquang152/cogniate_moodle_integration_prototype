// Reads the service JSON log files infra/.logs/<service>.jsonl (hook H7).
import fs from 'node:fs';
import path from 'node:path';
import { LOGS_DIR } from './paths';

export const REQUIRED_LOG_FIELDS = ['ts', 'level', 'service', 'event', 'trace_id'] as const;

export interface LogEntry {
  ts?: unknown;
  level?: unknown;
  service?: unknown;
  event?: unknown;
  trace_id?: unknown;
  [key: string]: unknown;
}

export interface LogRead {
  file: string;
  entries: { line: number; raw: string; entry: LogEntry }[];
  /** Line numbers (1-based) that are not a JSON object. A partial last line is not counted. */
  badLines: number[];
}

export function logFile(service: string): string {
  return path.join(LOGS_DIR, `${service}.jsonl`);
}

export function readLog(service: string): LogRead {
  const file = logFile(service);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const endsComplete = text.endsWith('\n');
  const result: LogRead = { file, entries: [], badLines: [] };
  lines.forEach((raw, i) => {
    if (raw.trim() === '') return;
    const isLast = i === lines.length - 1;
    try {
      const entry = JSON.parse(raw) as unknown;
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('not an object');
      result.entries.push({ line: i + 1, raw, entry: entry as LogEntry });
    } catch {
      if (!(isLast && !endsComplete)) result.badLines.push(i + 1);
    }
  });
  return result;
}

export async function waitForLog(
  service: string,
  predicate: (entry: LogEntry, raw: string) => boolean,
  timeoutMs = 10_000,
): Promise<{ entry: LogEntry; raw: string } | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (fs.existsSync(logFile(service))) {
      const hit = readLog(service).entries.find((e) => predicate(e.entry, e.raw));
      if (hit) return { entry: hit.entry, raw: hit.raw };
    }
    if (Date.now() > deadline) return undefined;
    await new Promise((r) => setTimeout(r, 250));
  }
}
