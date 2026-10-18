// AC-T7-13 helpers: /healthz of the three origins, and test_knob_active events in infra/.logs/*.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { httpsRequest } from '../../acceptance/lib/https';
import { readLog } from '../../acceptance/lib/logs';
import { LOGS_DIR } from '../../acceptance/lib/paths';
import { urls } from './e2e';

export const ORIGINS = () => [urls.lti, urls.app, urls.content];

export async function healthOf(origin: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await httpsRequest(`${origin}/healthz`, { timeoutMs: 10_000 });
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(res.body) as Record<string, unknown>;
  } catch {
    body = { raw: res.body.slice(0, 200) };
  }
  return { status: res.status, body };
}

export function logFiles(): string[] {
  if (!fs.existsSync(LOGS_DIR)) return [];
  return fs.readdirSync(LOGS_DIR).filter((n) => n.endsWith('.jsonl')).map((n) => path.join(LOGS_DIR, n));
}

export function knobEvents(): string[] {
  const hits: string[] = [];
  for (const f of logFiles()) {
    for (const e of readLog(path.basename(f, '.jsonl')).entries) if (e.entry.event === 'test_knob_active') hits.push(`${path.basename(f)}:${e.line} ${e.raw.slice(0, 200)}`);
  }
  return hits;
}
