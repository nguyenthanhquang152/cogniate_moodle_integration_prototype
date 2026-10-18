// T7 E2E core: run state on disk, evidence folder, captured secrets, step timings.
// Why state on disk: each scenario step is its own Playwright test (one row per step in the report), and Playwright
// starts a new worker after a failed test. So a step reads what the earlier steps made from tests/e2e/artifacts/state.json.
import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { publicUrls } from '../../acceptance/lib/env';
import { artifactsDir } from '../../acceptance/lib/paths';

export const urls = publicUrls();
export const ART = artifactsDir('e2e');
export const EVIDENCE = path.join(ART, 'evidence');
const STATE_FILE = path.join(ART, 'state.json');
const SECRETS_FILE = path.join(ART, 'captured-secrets.jsonl');

export const LIBRARY_A = "Thanh's Library";
export const LIBRARY_B = 'QA Library B';
export const TOOL_A = `Cogniate (${LIBRARY_A})`;
export const TOOL_B = `Cogniate (${LIBRARY_B})`;
export const CONNECTION_A = 'Dev Moodle';
export const CONNECTION_B = 'Dev Moodle B';
export const COURSE_SCORM = 'AI Website Sprint — SCORM';
export const COURSE_HTML = 'AI Website Sprint — HTML';
export const COURSE_B_HTML = 'AI Website Sprint — HTML (QA Library B)';
export const SHELL_DONE_100 = 'Completed — score 100 sent to Moodle';

export interface Activity {
  /** Moodle activity name (the picker fills it with the course title). */
  name: string;
  cmid: number;
  courseId: number;
}

export interface LaunchRecord {
  user: string;
  activity: string;
  finalUrl: string;
  topLevel: boolean;
  hasOpener: boolean;
  msToPlay: number;
}

export interface E2EState {
  runId: string;
  startedAt: string;
  connectionA?: string;
  connectionB?: string;
  typeIdA?: number;
  typeIdB?: number;
  courses?: Record<string, string>;
  publications?: Record<string, string>;
  activities?: Record<string, Activity>;
  /** Picker option titles per pick, keyed by step (A4-scorm, A4-html, B4, B5). */
  pickers?: Record<string, string[]>;
  launches?: LaunchRecord[];
  /** Seconds from course completion to the grade in the QA oracle, keyed by `<user> <activity>`. */
  gradeLatency?: Record<string, number>;
  /** A captured learner launch form for C1 (id_token + state) and the state cookie that the tool login set. */
  replay?: { id_token: string; state: string; cookie: string; firstStatus: number };
  /** Moodle label differences from moodle-steps.json (AC-T7-14), and other findings to list in qa.md. */
  labelDiffs?: string[];
  findings?: string[];
  connectionStatus?: Record<string, string>;
  timings?: Record<string, number>;
  done?: Record<string, boolean>;
}

export function loadState(): E2EState {
  if (!fs.existsSync(STATE_FILE)) return { runId: '', startedAt: '' };
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as E2EState;
}

/** Shallow merge; object-valued keys (courses, activities, …) are merged one level deep. Arrays are replaced. */
export function saveState(patch: Partial<E2EState>): E2EState {
  const cur = loadState() as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    const old = cur[k];
    cur[k] = v && typeof v === 'object' && !Array.isArray(v) && old && typeof old === 'object' && !Array.isArray(old) ? { ...old, ...v } : v;
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(cur, null, 2));
  return cur as unknown as E2EState;
}

export function resetState(): E2EState {
  for (const f of [STATE_FILE, SECRETS_FILE]) fs.rmSync(f, { force: true });
  fs.rmSync(EVIDENCE, { recursive: true, force: true });
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const runId = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
  return saveState({ runId, startedAt: new Date().toISOString(), done: {}, timings: {}, labelDiffs: [], findings: [], launches: [] });
}

export function appendList(key: 'labelDiffs' | 'findings', ...items: string[]): void {
  const cur = loadState()[key] ?? [];
  saveState({ [key]: [...new Set([...cur, ...items])] });
}

export function markDone(step: string): void {
  saveState({ done: { [step]: true } });
}

/** Fails the test early with a clear reason when an earlier step did not finish. */
export function need<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null || value === '') throw new Error(`Needs ${what} from an earlier step (that step failed or did not run).`);
  return value;
}

export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    saveState({ timings: { [name]: Math.round((Date.now() - t0) / 100) / 10 } });
  }
}

// ---------------------------------------------------------------- evidence

/** Full-page screenshot into tests/e2e/artifacts/evidence/<name>.png, also attached to the test report. */
export async function shot(page: Page, name: string, testInfo?: TestInfo): Promise<string> {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const file = path.join(EVIDENCE, `${name.replace(/[^\w.-]+/g, '_')}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(async () => page.screenshot({ path: file }));
  if (testInfo) await testInfo.attach(name, { path: file, contentType: 'image/png' });
  return path.relative(ART, file);
}

export function writeEvidence(name: string, data: unknown): string {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const file = path.join(EVIDENCE, name);
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return path.relative(ART, file);
}

export function note(testInfo: TestInfo, type: string, description: string): void {
  testInfo.annotations.push({ type, description });
}

// ---------------------------------------------------------------- captured secrets (Scenario C2)

export type SecretKind = 'ltik' | 'id_token' | 'service_key' | 'runtime_token' | 'api_key' | 'state' | 'registration_ref';

/** Remembers a secret value seen in the real flow. C2 greps the service logs for each one. Git-ignored file. */
export function recordSecret(kind: SecretKind, value: string | null | undefined, where: string): void {
  if (!value || value.length < 8) return;
  fs.appendFileSync(SECRETS_FILE, `${JSON.stringify({ kind, value, where })}\n`);
}

export function capturedSecrets(): { kind: SecretKind; value: string; where: string }[] {
  if (!fs.existsSync(SECRETS_FILE)) return [];
  const seen = new Set<string>();
  return fs
    .readFileSync(SECRETS_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { kind: SecretKind; value: string; where: string })
    .filter((s) => (seen.has(`${s.kind}:${s.value}`) ? false : (seen.add(`${s.kind}:${s.value}`), true)));
}

/** Evidence form of a secret: the first 6 characters and the length only (tasks README §6). */
export function masked(value: string): string {
  return `${value.slice(0, 6)}…(${value.length})`;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls `fn` until `ok(value)` or the deadline; returns the last value. */
export async function pollUntil<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs: number, everyMs = 2_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let v: T;
    try {
      v = await fn();
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await sleep(everyMs);
      continue;
    }
    if (ok(v) || Date.now() > deadline) return v;
    await sleep(everyMs);
  }
}
