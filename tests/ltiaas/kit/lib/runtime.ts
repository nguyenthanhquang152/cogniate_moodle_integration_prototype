import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import {
  admin,
  AGS,
  APP,
  app,
  beginLaunch as rawBeginLaunch,
  cli as rawCli,
  connPath,
  denied,
  DL,
  expectStatus,
  formPost,
  HostResult,
  httpsRequest,
  idToken,
  Json,
  launch,
  logEvents,
  LTI,
  noServiceCalls,
  NRPS,
  parseForm,
  poll,
  preparedLaunch as rawPreparedLaunch,
  records,
  rememberSecret,
  service,
  session as rawSession,
  sharedPlatform,
  sim,
  unique,
  urls,
} from '../../../acceptance/M1/common/client.js';
import {
  commitGrade as rawCommitGrade,
  fixtureZip,
  openPlay,
  pick as rawPick,
  publication as rawPublication,
  results,
  returnDeepLink as rawReturnDeepLink,
  waitSync,
} from '../../../acceptance/M1/common/course.js';
import {
  appApi,
  createCourse,
  Session,
  uploadVersion,
} from '../../../acceptance/lib/app.js';
import { readLog } from '../../../acceptance/lib/logs.js';
import {
  ACCOUNT,
  apiKey,
  auth,
  capturedSecrets,
  errorCode,
  hasErrorShape,
  ltiApi,
  visibleText,
} from '../../../acceptance/lib/lti.js';
import { artifactsDir, LOGS_DIR } from '../../../acceptance/lib/paths.js';
import {
  buildOperatorGrantCliArgs,
  buildOperatorGrantNpmArgs,
  CapabilityKey,
  ChannelFixture,
  computeExpectedCaseList,
  computeExpectedGlobalCaseList,
  evaluateChannelPassRule,
  ExecutedCaseRecord,
  isK1SimLevelEnabled,
  isPlainObject,
  KitSuiteName,
  OperatorGrantCliOptions,
  parseOperatorGrantOutput,
  PassRuleEvaluation,
  resolveKitLevel,
  verifyWaveSuiteArtifact,
  WaveEvidenceManifest,
} from './fixtures.js';

export type KitSession = Session & { library: Json };
export type PublicationRef = Json;

export const APP_ORIGIN = APP;
export const LTI_ORIGIN = urls.lti;
export const COOKIE = '__Host-lti_state';
export const ROLE_LEARNER = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
export const ROLE_INSTRUCTOR =
  'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';
export const uniqueId = unique;
export const htmlText = visibleText;

// Wraps M1 session() (M1/common/client.ts:62; cogniate-app-api.md §2) accepting 'A' | 'B' or library label
export async function session(library: 'A' | 'B' | string = 'A'): Promise<KitSession> {
  const key: 'A' | 'B' =
    library === 'B' || String(library).includes('-b-') ? 'B' : 'A';
  return rawSession(key);
}

// Wraps M1 cli() (M1/common/client.ts:106) exposing both `code` and `exitCode`
export async function cli(
  script: 'app:grant' | 'app:binding' | 'lti:shared-platform',
  args: string[],
): Promise<HostResult & { exitCode: number }> {
  const res = await rawCli(script, args);
  return { ...res, exitCode: res.code };
}

// Wraps M1 publication() (M1/common/course.ts:25; cogniate-app-api.md §5)
export async function publication(
  binding: Json,
  format: 'html' | 'scorm12' = 'scorm12',
  options?: { title?: string },
): Promise<Json> {
  const pub = await rawPublication(binding, format);
  if (options?.title) {
    pub.title = options.title;
  }
  return pub;
}

// Wraps M1 commitGrade() (M1/common/course.ts:58; cogniate-app-api.md §6.3) returning { status: 200 }
export async function commitGrade(
  play: Json,
  format: string,
  raw: number,
  maximum: number,
  complete = true,
): Promise<{ status: number }> {
  await rawCommitGrade(play, format, raw, maximum, complete);
  return { status: 200 };
}

// Wraps M1 pick() (M1/common/course.ts:100; cogniate-app-api-delta.md §5) exposing parsed form action & JWT
export async function pick(pickerUrl: string, publicationId: string) {
  const response = await rawPick(pickerUrl, publicationId);
  const parsed = parseForm(response.body);
  return {
    ...response,
    action: parsed.action,
    jwt: parsed.fields.JWT ?? '',
  };
}

// Wraps M1 returnDeepLink() (M1/common/course.ts:106) exposing status alongside response & jwt
export async function returnDeepLink(page: { body: string }) {
  const ret = await rawReturnDeepLink(page);
  return {
    ...ret,
    status: ret.response.status,
  };
}

// Wraps M1 beginLaunch() (M1/common/client.ts:148; lti-service-api.md §2.1)
export async function beginLaunch(patch: Json = {}, loginPatch: Json = {}) {
  const started = await rawBeginLaunch(patch, loginPatch);
  return {
    ...started,
    loginResponse: started.login,
    stateCookie: started.cookie,
  };
}

// Wraps M1 preparedLaunch() (M1/common/client.ts:171; lti-service-api.md §2.2) exposing parsed form
export async function preparedLaunch(patch: Json = {}) {
  const started = await beginLaunch(patch);
  expectStatus(started.login, 302);
  const authorize = await httpsRequest(started.location);
  expectStatus(authorize, 200);
  const form = parseForm(authorize.body);
  rememberSecret(form.fields.id_token);
  rememberSecret(form.fields.state);
  return {
    started,
    form,
    submit: () => formPost(form.action, form.fields, started.cookie),
  };
}

export function decodeJwt(token: string): { header: Json; payload: Json } {
  const parts = String(token ?? '').split('.');
  if (parts.length < 2) {
    throw new Error(`Invalid JWT token: ${token}`);
  }
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Json;
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Json;
  return { header, payload };
}

// Registers a simulator scenario via POST /__sim/scenarios (M1/common/client.ts:49, 151)
export async function scenario(provider: string, patch: Json = {}): Promise<Json> {
  const created = await sim('/scenarios', 'POST', {
    id: unique('scenario'),
    provider,
    ...patch,
  });
  expectStatus(created, 201);
  if (created.json?.registration?.registrationToken) {
    rememberSecret(String(created.json.registration.registrationToken));
  }
  return created.json;
}

// Disconnects a channel connection via DELETE /app-api/connections/:id (cogniate-app-api.md §4.9)
export async function endConnection(s: Session, connectionId: string): Promise<void> {
  await app(s, 'DELETE', connPath(connectionId)).catch(() => null);
}

// Performs an HTTPS request against the Cogniate App origin (APP) using the frozen httpsRequest helper
export async function appRequest(
  method: string,
  pathOrUrl: string,
  options: {
    headers?: Record<string, string>;
    form?: Record<string, string> | Array<[string, string]>;
    cookie?: string;
  } = {},
) {
  const targetUrl = new URL(pathOrUrl, APP).href;
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }
  let body: string | undefined;
  if (options.form !== undefined) {
    body = new URLSearchParams(options.form as Record<string, string>).toString();
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
  }
  const res = await httpsRequest(targetUrl, { method, headers, body });
  return { ...res, text: res.body };
}

// Performs an HTTPS request against the LTI Service origin (urls.lti) using the frozen httpsRequest helper
export async function ltiRequest(
  method: string,
  pathOrUrl: string,
  options: {
    headers?: Record<string, string>;
    form?: Record<string, string>;
    cookie?: string;
  } = {},
) {
  const targetUrl = new URL(pathOrUrl, urls.lti).href;
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }
  let body: string | undefined;
  if (options.form !== undefined) {
    body = new URLSearchParams(options.form).toString();
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
  }
  const res = await httpsRequest(targetUrl, { method, headers, body });
  return { ...res, text: res.body };
}

export {
  ACCOUNT,
  admin,
  AGS,
  apiKey,
  APP,
  app,
  appApi,
  artifactsDir,
  auth,
  buildOperatorGrantCliArgs,
  buildOperatorGrantNpmArgs,
  capturedSecrets,
  connPath,
  createCourse,
  denied,
  DL,
  errorCode,
  expectStatus,
  fixtureZip,
  formPost,
  hasErrorShape,
  httpsRequest,
  idToken,
  isK1SimLevelEnabled,
  launch,
  logEvents,
  LOGS_DIR,
  LTI,
  ltiApi,
  noServiceCalls,
  NRPS,
  openPlay,
  parseForm,
  parseOperatorGrantOutput,
  poll,
  readLog,
  records,
  rememberSecret,
  resolveKitLevel,
  results,
  service,
  sharedPlatform,
  sim,
  unique,
  uploadVersion,
  urls,
  verifyWaveSuiteArtifact,
  visibleText,
  waitSync,
};
export type { HostResult, Json, Session };

export const SIM_CONTROL_URL = process.env.LMS_SIM_CONTROL_URL ?? 'http://127.0.0.1:4199';

export interface KitRunMeta {
  runId: string;
  startedAt: string;
  channels: string[];
}

export interface SecretScanHit {
  source: string;
  secretPrefix: string;
}

export interface SecretScanResult {
  ok: boolean;
  secretCount: number;
  leakedCount: number;
  hits: SecretScanHit[];
  missingInputs: string[];
  scannedSources: string[];
}

export interface SecretScanOptions {
  artifactRoot?: string | null;
  fetchImpl?: (url: string) => Promise<{ status: number; json: unknown; rawText?: string }>;
  readServiceLogImpl?: (service: 'lti-service' | 'cogniate-app' | 'lms-sim') => string;
  additionalSecrets?: string[];
}

export interface KitRunPassRuleReport {
  ok: boolean;
  runId: string | null;
  currentWaveId: string | null;
  channels: Record<string, PassRuleEvaluation>;
  globalErrors: string[];
  totalExpectedRun: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuplicates: number;
}

export interface ChannelBinding {
  s: KitSession;
  session: KitSession;
  fixture: ChannelFixture;
  library: string;
  connection: {
    id: string;
    name?: string;
    lms: string;
    siteUrl: string;
    serviceUrl?: string | null;
    registrationUrl?: string;
    bindingAuthority?: string;
    status?: string;
    platform?: Json;
  };
  clientId: string;
  deploymentId: string;
  secondaryDeploymentId: string;
  platformId: string;
  issuer: string;
  siteHost: string;
  pageHost: string;
  grantId?: string;
  grantCode?: string;
}

// Uses the shared resolveKitLevel() parser from ./fixtures.ts so vitest.config.mts
// and suite runtime guards accept the exact same LA_LEVEL values ('k0', 'k1sim', 'k1-sim', 'all').
export function isK1SimEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isK1SimLevelEnabled(env);
}

export function getKitStateDir(overrideDir?: string): string {
  const dir =
    overrideDir ?? process.env.LA_RUN_DIR ?? path.resolve(process.cwd(), '.tmp/kit-run');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function initKitRunLedger(options?: {
  stateDir?: string;
  runId?: string;
  channels?: string[];
}): KitRunMeta {
  const dir = getKitStateDir(options?.stateDir);
  const runId =
    options?.runId ?? process.env.LA_KIT_RUN_ID ?? `kit-run-${crypto.randomUUID()}`;
  const meta: KitRunMeta = {
    runId,
    startedAt: new Date().toISOString(),
    channels: options?.channels ?? [],
  };
  fs.writeFileSync(path.join(dir, 'kit-run-meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'kit-executed-cases.jsonl'), '', 'utf8');
  const evidenceDir = path.join(dir, 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, 'kit-run-init.json'),
    JSON.stringify({ runId, startedAt: meta.startedAt, redacted: true }, null, 2),
    'utf8',
  );
  return meta;
}

export function ensureKitRunInitialized(options?: {
  stateDir?: string;
  runId?: string;
  channels?: string[];
}): KitRunMeta {
  const dir = getKitStateDir(options?.stateDir);
  const metaPath = path.join(dir, 'kit-run-meta.json');
  const targetRunId = options?.runId ?? process.env.LA_KIT_RUN_ID;
  if (fs.existsSync(metaPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as KitRunMeta;
      if (existing && typeof existing.runId === 'string') {
        if (!targetRunId || existing.runId === targetRunId) {
          return existing;
        }
      }
    } catch {
      // Re-initialize below if unreadable
    }
  }
  return initKitRunLedger(options);
}

export function getActiveKitRunId(stateDir?: string): string {
  const meta = ensureKitRunInitialized({ stateDir });
  return meta.runId;
}

export function resetKitStateForRun(runId?: string, stateDir?: string): string {
  const meta = initKitRunLedger({ stateDir, runId });
  return meta.runId;
}

export function recordExecutedCase(
  record: ExecutedCaseRecord,
  options?: { stateDir?: string },
): void {
  const dir = getKitStateDir(options?.stateDir);
  const runId = record.runId ?? getActiveKitRunId(dir);
  const entry: ExecutedCaseRecord = {
    ...record,
    runId,
    timestamp: record.timestamp ?? new Date().toISOString(),
  };
  const filePath = path.join(dir, 'kit-executed-cases.jsonl');
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
}

export function recordCaseExecution(
  channelId: string,
  suite: KitSuiteName,
  code: string,
  outcome: 'PASS' | 'FAIL' | 'SKIP',
  detail?: string,
  stateDir?: string,
  runId?: string,
): ExecutedCaseRecord {
  const activeRunId = runId ?? getActiveKitRunId(stateDir);
  const record: ExecutedCaseRecord = {
    id: `${channelId}:${suite}:${code}`,
    channelId,
    suite,
    code,
    outcome,
    runId: activeRunId,
    timestamp: new Date().toISOString(),
    ...(detail ? { detail } : {}),
  };
  recordExecutedCase(record, { stateDir });
  return record;
}

export function recordSkippedCase(
  channelId: string,
  suite: KitSuiteName,
  code: string,
  detail?: string,
  options?: { stateDir?: string; runId?: string },
): void {
  recordCaseExecution(
    channelId,
    suite,
    code,
    'SKIP',
    detail,
    options?.stateDir,
    options?.runId,
  );
}

export async function runKitCase(
  channelId: string,
  suite: KitSuiteName,
  code: string,
  fn: () => Promise<void> | void,
  options?: { stateDir?: string; runId?: string },
): Promise<void> {
  const id = `${channelId}:${suite}:${code}`;
  try {
    await fn();
    recordExecutedCase(
      {
        id,
        channelId,
        suite,
        code,
        outcome: 'PASS',
        runId: options?.runId,
      },
      { stateDir: options?.stateDir },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    recordExecutedCase(
      {
        id,
        channelId,
        suite,
        code,
        outcome: 'FAIL',
        detail,
        runId: options?.runId,
      },
      { stateDir: options?.stateDir },
    );
    throw err;
  }
}

export async function runAndRecordCase(
  channelId: string,
  suite: KitSuiteName,
  code: string,
  fn: () => Promise<void> | void,
  stateDir?: string,
): Promise<void> {
  return runKitCase(channelId, suite, code, fn, { stateDir });
}

export function readAllExecutedCases(options?: { stateDir?: string }): ExecutedCaseRecord[] {
  const filePath = path.join(getKitStateDir(options?.stateDir), 'kit-executed-cases.jsonl');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const lines = fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const recordsList: ExecutedCaseRecord[] = [];
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as ExecutedCaseRecord;
      if (rec && typeof rec.id === 'string') {
        recordsList.push(rec);
      }
    } catch {
      // Ignore malformed trailing lines
    }
  }
  return recordsList;
}

export function readExecutedCaseRecords(stateDir?: string): ExecutedCaseRecord[] {
  return readAllExecutedCases({ stateDir });
}

// Derives the current wave identity ONLY from the current run input or LA_WAVE_ID env.
// NEVER falls back to waveEvidence.waveId (which would let a stale manifest self-certify).
export function deriveCurrentWaveIdFromRun(options?: {
  currentWaveId?: string | null;
  env?: NodeJS.ProcessEnv;
}): string | null {
  if (options?.currentWaveId !== undefined) {
    return options.currentWaveId;
  }
  const env = options?.env ?? process.env;
  const fromEnv = env.LA_WAVE_ID?.trim();
  return fromEnv ? fromEnv : null;
}

export function writeWaveEvidenceToRun(
  manifest: WaveEvidenceManifest,
  stateDir?: string,
  options?: { skipArtifactFiles?: boolean },
): string {
  const dir = getKitStateDir(stateDir);
  const filePath = path.join(dir, 'wave-evidence.json');
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
  if (!options?.skipArtifactFiles && isPlainObject(manifest.suites)) {
    for (const [suiteName, entry] of Object.entries(manifest.suites)) {
      if (
        entry &&
        typeof entry.artifactPath === 'string' &&
        entry.artifactPath.trim().length > 0
      ) {
        const resolved = path.resolve(dir, entry.artifactPath);
        const rel = path.relative(dir, resolved);
        if (!rel.startsWith('..') && !path.isAbsolute(rel) && !fs.existsSync(resolved)) {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(
            resolved,
            JSON.stringify(
              {
                suite: suiteName,
                waveId: entry.waveId,
                outcome: entry.outcome,
              },
              null,
              2,
            ),
            'utf8',
          );
        }
      }
    }
  }
  return filePath;
}

export function loadWaveEvidenceFromRun(options?: {
  stateDir?: string;
  filePath?: string;
  currentWaveId?: string | null;
}): WaveEvidenceManifest {
  const dir = getKitStateDir(options?.stateDir);
  const filePath =
    options?.filePath ??
    process.env.LA_WAVE_EVIDENCE_FILE ??
    path.join(dir, 'wave-evidence.json');
  const currentWaveId = deriveCurrentWaveIdFromRun({
    currentWaveId: options?.currentWaveId,
  });

  if (!fs.existsSync(filePath)) {
    return {
      waveId: currentWaveId,
      suites: {},
      error: `wave evidence file not found at ${filePath}`,
    };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WaveEvidenceManifest>;
    if (!isPlainObject(parsed) || !isPlainObject(parsed.suites)) {
      return {
        waveId: currentWaveId,
        suites: {},
        error: `wave evidence file at ${filePath} is missing a "suites" object`,
      };
    }
    return {
      waveId: typeof parsed.waveId === 'string' ? parsed.waveId : null,
      suites: parsed.suites as WaveEvidenceManifest['suites'],
    };
  } catch (err) {
    return {
      waveId: currentWaveId,
      suites: {},
      error: `wave evidence file unreadable at ${filePath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

export function evaluateKitRunPassRule(input: {
  fixtures: ChannelFixture[];
  executedRecords: ExecutedCaseRecord[];
  waveEvidence?: WaveEvidenceManifest | null;
  currentWaveId?: string | null;
  expectedRunId?: string | null;
  runDir?: string | null;
  requireH1?: boolean;
}): KitRunPassRuleReport {
  const expectedRunId = input.expectedRunId ?? null;
  // Derive currentWaveId ONLY from input.currentWaveId or process.env.LA_WAVE_ID (never waveEvidence.waveId).
  const currentWaveId = deriveCurrentWaveIdFromRun({
    currentWaveId: input.currentWaveId,
  });
  const runDir = input.runDir !== undefined ? input.runDir : (process.env.LA_RUN_DIR ?? null);

  const channels: Record<string, PassRuleEvaluation> = {};
  let totalExpectedRun = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalDuplicates = 0;
  const globalErrors: string[] = [];

  // Reject any record whose channelId is neither 'GLOBAL' nor in the selected fixtures set.
  const selectedChannelIds = new Set(input.fixtures.map((f) => f.id));
  for (const rec of input.executedRecords) {
    if (rec.channelId !== 'GLOBAL' && !selectedChannelIds.has(rec.channelId)) {
      globalErrors.push(
        `unexpected channel record: ${rec.id} (channelId="${
          rec.channelId
        }" is not in selected channels [${[...selectedChannelIds].join(', ')}], outcome=${
          rec.outcome
        })`,
      );
      if (rec.outcome === 'FAIL') {
        totalFailed += 1;
      }
      if (rec.outcome === 'SKIP') {
        totalSkipped += 1;
      }
      if (expectedRunId && rec.runId !== expectedRunId) {
        globalErrors.push(
          `stale unselected channel record: ${rec.id} (runId="${String(
            rec.runId,
          )}" !== "${expectedRunId}")`,
        );
      }
    }
  }

  for (const fixture of input.fixtures) {
    const expectedCases = computeExpectedCaseList(fixture);
    const evalResult = evaluateChannelPassRule({
      fixture,
      expectedCases,
      executedRecords: input.executedRecords,
      waveEvidence: input.waveEvidence,
      currentWaveId,
      expectedRunId,
      runDir,
    });
    channels[fixture.id] = evalResult;
    totalExpectedRun += evalResult.expectedRunCount;
    totalPassed += evalResult.executedPassCount;
    totalFailed += evalResult.failedCases.length;
    totalSkipped += evalResult.skippedCount;
    totalDuplicates += evalResult.duplicateOrRetriedCases.length;
  }

  const expectedGlobals = computeExpectedGlobalCaseList().filter((g) =>
    input.requireH1 === false ? g.code !== 'H1' : true,
  );
  const globalRecords = input.executedRecords.filter((r) => r.channelId === 'GLOBAL');
  const expectedGlobalMap = new Map(expectedGlobals.map((g) => [g.id, g]));
  const globalById = new Map<string, ExecutedCaseRecord[]>();

  for (const rec of globalRecords) {
    if (expectedRunId && rec.runId !== expectedRunId) {
      globalErrors.push(
        `stale global run record: ${rec.id} (runId="${String(
          rec.runId,
        )}" !== "${expectedRunId}")`,
      );
    }
    if (rec.outcome === 'SKIP') {
      totalSkipped += 1;
      globalErrors.push(`skipped global case: ${rec.id}`);
    }
    if (rec.outcome === 'FAIL') {
      totalFailed += 1;
      globalErrors.push(
        `failed global case: ${rec.id}${rec.detail ? ` (${rec.detail})` : ''}`,
      );
    }
    const list = globalById.get(rec.id) ?? [];
    list.push(rec);
    globalById.set(rec.id, list);
  }

  for (const [id, recs] of globalById.entries()) {
    if (!expectedGlobalMap.has(id) && id !== 'GLOBAL:K-HYG:H1') {
      globalErrors.push(`extra global case: ${id}`);
    }
    if (recs.length > 1) {
      totalDuplicates += 1;
      globalErrors.push(
        `duplicate/retried global case: ${id} (recorded ${recs.length} times: ${recs
          .map((r) => r.outcome)
          .join(' -> ')})`,
      );
    }
  }

  for (const exp of expectedGlobals) {
    totalExpectedRun += 1;
    const recs = globalById.get(exp.id);
    if (!recs || recs.length === 0) {
      globalErrors.push(`missing global case: ${exp.id}`);
    } else if (
      recs.length === 1 &&
      recs[0].outcome === 'PASS' &&
      (!expectedRunId || recs[0].runId === expectedRunId)
    ) {
      totalPassed += 1;
    }
  }

  const allChannelsOk = Object.values(channels).every((c) => c.ok);
  const ok = allChannelsOk && globalErrors.length === 0;

  return {
    ok,
    runId: expectedRunId,
    currentWaveId,
    channels,
    globalErrors,
    totalExpectedRun,
    totalPassed,
    totalFailed,
    totalSkipped,
    totalDuplicates,
  };
}

export function writeKitRunSummaryArtifacts(
  report: KitRunPassRuleReport,
  options?: { stateDir?: string },
): { mdPath: string; jsonPath: string } {
  const dir = getKitStateDir(options?.stateDir);
  const jsonPath = path.join(dir, 'k1-kit-summary.json');
  const mdPath = path.join(dir, 'k1-kit-summary.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const lines: string[] = [
    '# K1-SIM Channel Conformance Kit Summary',
    '',
    `- Run ID: \`${report.runId ?? 'none'}\``,
    `- Wave ID: \`${report.currentWaveId ?? 'none'}\``,
    `- Overall Status: **${report.ok ? 'PASS' : 'FAIL'}**`,
    `- Total Expected RUN: ${report.totalExpectedRun}`,
    `- Total Passed: ${report.totalPassed}`,
    `- Total Failed: ${report.totalFailed}`,
    `- Total Skipped: ${report.totalSkipped}`,
    `- Total Retried/Duplicate: ${report.totalDuplicates}`,
    '',
    '| Channel | Expected RUN | Passed | Failed | Skipped | Duplicates | Missing | Extra | Illegal N/A | Uncovered +Cap | Missing C2 | Status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const [channelId, ev] of Object.entries(report.channels)) {
    lines.push(
      `| ${channelId} | ${ev.expectedRunCount} | ${ev.executedPassCount} | ${
        ev.failedCases.length
      } | ${ev.skippedCount} | ${ev.duplicateOrRetriedCases.length} | ${
        ev.missingCases.length
      } | ${ev.extraCases.length} | ${ev.illegalNaCases.length} | ${
        ev.uncoveredPositiveCapabilities.length
      } | ${ev.missingNegativeGuards.length} | ${ev.ok ? 'PASS' : 'FAIL'} |`,
    );
  }

  if (report.globalErrors.length > 0) {
    lines.push('', '## Global Errors', '');
    for (const err of report.globalErrors) {
      lines.push(`- ${err}`);
    }
  }

  for (const [channelId, ev] of Object.entries(report.channels)) {
    if (ev.errors.length > 0) {
      lines.push('', `## Errors for \`${channelId}\``, '');
      for (const err of ev.errors) {
        lines.push(`- ${err}`);
      }
    }
  }

  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
  return { mdPath, jsonPath };
}

export function getFromM1CapturedSecrets(): string[] {
  try {
    return capturedSecrets()
      .map((s) => s.value)
      .filter((v): v is string => typeof v === 'string' && v.trim().length >= 8);
  } catch {
    return [];
  }
}

export function recordSecret(secretValue: string, options?: { stateDir?: string }): void {
  if (!secretValue || secretValue.trim().length < 8) {
    return;
  }
  const filePath = path.join(getKitStateDir(options?.stateDir), 'kit-secrets.raw.jsonl');
  fs.appendFileSync(filePath, `${JSON.stringify({ value: secretValue.trim() })}\n`, 'utf8');
}

export function persistCapturedSecrets(extraSecrets: string[] = [], stateDir?: string): void {
  const dir = getKitStateDir(stateDir);
  const filePath = path.join(dir, 'kit-secrets.raw.jsonl');
  for (const s of [...getFromM1CapturedSecrets(), ...extraSecrets]) {
    if (typeof s === 'string' && s.trim().length >= 8) {
      fs.appendFileSync(filePath, `${JSON.stringify({ value: s.trim() })}\n`, 'utf8');
    }
  }
}

export function readLocalRecordedSecrets(stateDir?: string): string[] {
  const dir = getKitStateDir(stateDir);
  const secrets = new Set<string>(stateDir ? [] : getFromM1CapturedSecrets());
  for (const fileName of ['kit-secrets.raw.jsonl', 'kit-secrets.jsonl', 'm1-secrets.raw.jsonl']) {
    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const lines = fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { value?: string; secret?: string } | string;
        if (typeof parsed === 'string' && parsed.length >= 8) {
          secrets.add(parsed);
        } else if (isPlainObject(parsed)) {
          const val = parsed.value ?? parsed.secret;
          if (typeof val === 'string' && val.length >= 8) {
            secrets.add(val);
          }
        }
      } catch {
        // Ignore malformed line
      }
    }
  }
  return [...secrets];
}

export function readCapturedSecrets(stateDir?: string): string[] {
  return readLocalRecordedSecrets(stateDir);
}

export function recordRedactedEvidence(
  name: string,
  payload: Record<string, unknown>,
  options?: { stateDir?: string },
): string {
  const dir = path.join(getKitStateDir(options?.stateDir), 'evidence');
  fs.mkdirSync(dir, { recursive: true });
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(dir, `${safeName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
}

// Issues an operator approval grant via the frozen M1 CLI helper `cli('app:grant', args)`
// (tests/acceptance/M1/common/client.ts:106-123; cogniate-app-api.md §4.8; cogniate-app-api-delta.md §4).
export async function issueOperatorGrantForChannel(
  libraryId: string,
  fixture: ChannelFixture,
  connectionId: string,
  clientId: string,
  deploymentId: string,
  options: OperatorGrantCliOptions = {},
  runner: (
    command: 'app:grant',
    args: string[],
  ) => Promise<{ code?: number; exitCode?: number; stdout: string; stderr: string }> = cli,
): Promise<{ id: string; code: string; args: string[] }> {
  const args = buildOperatorGrantCliArgs(
    libraryId,
    fixture,
    connectionId,
    clientId,
    deploymentId,
    options,
  );
  const res = await runner('app:grant', args);
  const status = res.exitCode ?? res.code ?? 1;
  if (status !== 0) {
    throw new Error(
      `app:grant issue failed for ${fixture.id} (${status}): ${res.stderr} ${res.stdout}`,
    );
  }
  const { id, code } = parseOperatorGrantOutput(res.stdout);
  recordSecret(code);
  persistCapturedSecrets([code]);
  return { id, code, args };
}

// Sets up an active channel connection and LTI 1.3 platform binding using the frozen M1
// session/app helpers (tests/acceptance/M1/common/client.ts:62-97; cogniate-app-api.md §2, §4.4, §4.6;
// cogniate-app-api-delta.md §3.1, §3.3).
export async function setupChannelBinding(
  fixture: ChannelFixture,
  options: {
    library?: 'A' | 'B' | string;
    clientId?: string;
    deploymentId?: string;
    secondaryDeploymentId?: string;
    name?: string;
  } = {},
): Promise<ChannelBinding> {
  const sKey: 'A' | 'B' = options.library === 'B' ? 'B' : 'A';
  // POST /app-api/session -> __Host-cog_session (tests/acceptance/M1/common/client.ts:62; cogniate-app-api.md §2)
  const s = await session(sKey);
  const library = String(s.library?.id ?? options.library ?? 'A');
  const clientId = options.clientId ?? unique(`client-${fixture.id}`);
  const deploymentId = options.deploymentId ?? fixture.sim.deployments[0];
  const secondaryDeploymentId =
    options.secondaryDeploymentId ?? fixture.sim.deployments[1] ?? `${deploymentId}-b`;

  const createBody: Record<string, unknown> = {
    name: options.name ?? `K1 ${fixture.id}`,
    lms: fixture.id,
    method: 'manual',
    siteUrl: fixture.sim.siteUrl,
  };
  if (fixture.capabilities['site.serviceOrigin']) {
    createBody.serviceUrl = fixture.sim.serviceUrl;
  }

  // POST /app-api/connections (cogniate-app-api.md §4.4; cogniate-app-api-delta.md §3.1)
  const created = await app(s, 'POST', '/app-api/connections', createBody);
  expectStatus(created, 201);
  const connection = (created.json.connection ?? created.json) as ChannelBinding['connection'];

  let grantId: string | undefined;
  let grantCode: string | undefined;
  const platformBody: Record<string, unknown> = {
    clientId,
    deploymentId,
  };

  if (
    !fixture.capabilities['site.serviceOrigin'] &&
    fixture.capabilities['platform.sharing'] !== 'shared'
  ) {
    platformBody.issuer = fixture.sim.issuer;
    platformBody.authUrl = fixture.sim.authEndpoint;
    platformBody.tokenUrl = fixture.sim.tokenEndpoint;
    platformBody.jwksUrl = fixture.sim.jwksUrl;
    if (fixture.sim.tokenAudienceKind === 'fixed') {
      platformBody.tokenAudience = Array.isArray(fixture.sim.tokenAudience)
        ? fixture.sim.tokenAudience[0]
        : fixture.sim.tokenAudience;
    }
  }

  if (fixture.capabilities['binding.authority'].manual === 'operatorGrant') {
    const grant = await issueOperatorGrantForChannel(
      library,
      fixture,
      connection.id,
      clientId,
      deploymentId,
      { purpose: 'initial' },
    );
    grantId = grant.id;
    grantCode = grant.code;
    platformBody.approvalCode = grant.code;
  }

  // PUT /app-api/connections/:id/platform (cogniate-app-api.md §4.6; cogniate-app-api-delta.md §3.3)
  const redeemed = await app(
    s,
    'PUT',
    `/app-api/connections/${connection.id}/platform`,
    platformBody,
  );
  expectStatus(redeemed, 200);
  const redeemedConn = (redeemed.json.connection ?? redeemed.json) as ChannelBinding['connection'];
  const redeemedPlat = (redeemed.json.platform ?? redeemedConn.platform ?? {}) as Json;

  const binding: ChannelBinding = {
    s,
    session: s,
    fixture,
    library,
    connection: redeemedConn,
    clientId,
    deploymentId,
    secondaryDeploymentId,
    platformId: String(redeemedPlat.platformId ?? redeemedPlat.id ?? ''),
    issuer: String(redeemedPlat.issuer ?? fixture.sim.issuer),
    siteHost: fixture.sim.siteHost,
    pageHost: fixture.sim.pageHost,
    grantId,
    grantCode,
  };

  recordRedactedEvidence(`binding-${fixture.id}-${connection.id}`, {
    channelId: fixture.id,
    connectionId: connection.id,
    platformId: binding.platformId,
    issuer: binding.issuer,
    redacted: true,
  });

  return binding;
}

// Performs an OIDC third-party login + form_post launch on `/lti/login/cogniate` and `/lti/launch/cogniate`
// via the frozen M1 launch helper (tests/acceptance/M1/common/client.ts:137-170; lti-service-api.md §2.1-2.2).
export async function launchOnChannel(
  binding: ChannelBinding,
  patch: Record<string, unknown> = {},
) {
  const res = await launch({
    provider: binding.fixture.simProvider,
    clientId: binding.clientId,
    deploymentId: binding.deploymentId,
    siteHost: binding.siteHost,
    pageHost: binding.pageHost,
    ...patch,
  });
  const location = String(res.response.headers.location ?? '');
  return { ...res, location };
}

// Opens a learner/staff play session via `openPlay` (tests/acceptance/M1/common/course.ts:41-56)
// and handles `/play/:playId/embedded` vs `/play/:playId` document targets (cogniate-app-api-delta.md §8).
export async function openPlayOnChannel(
  binding: ChannelBinding,
  pub: PublicationRef,
  patch: Record<string, unknown> = {},
) {
  const res = await openPlay(binding, pub, {
    provider: binding.fixture.simProvider,
    clientId: binding.clientId,
    deploymentId: binding.deploymentId,
    siteHost: binding.siteHost,
    pageHost: binding.pageHost,
    ...patch,
  });
  const location = String(res.result.response.headers.location ?? '');
  const playHtml = String(res.shell?.body ?? '');
  if (res.runtimeToken) {
    recordSecret(String(res.runtimeToken));
  }
  if (res.result?.ltik) {
    recordSecret(String(res.result.ltik));
  }
  return {
    ...res,
    ltik: String(res.result?.ltik ?? ''),
    attemptToken: String(res.runtimeToken ?? ''),
    html: playHtml,
    playHtml,
    location,
  };
}

// Launches a Deep Linking request and opens `/tool/picker/:pickerId`
// (tests/acceptance/M1/common/course.ts:89-99; cogniate-app-api.md §6.1; cogniate-app-api-delta.md §5).
export async function openPickerOnChannel(
  binding: ChannelBinding,
  patch: Record<string, unknown> = {},
) {
  const launched = await launchOnChannel(binding, {
    messageType: 'LtiDeepLinkingRequest',
    roles: [ROLE_INSTRUCTOR],
    ...patch,
  });
  expect(launched.response.status).toBe(303);
  const page = await appRequest('GET', launched.location, {
    headers: { accept: 'text/html' },
  });
  return {
    pickerUrl: launched.location,
    ltik: launched.ltik,
    status: page.status,
    html: page.text,
  };
}

// Executes the 1EdTech LTI Dynamic Registration handshake on `/tool/register`
// (cogniate-app-api-delta.md §3.2; lti-service-api-delta.md §5).
export async function runDynamicRegistrationHandshake(
  s: KitSession,
  fixture: ChannelFixture,
  drPatch: Record<string, unknown> = {},
  connectionPatch: Record<string, unknown> = {},
) {
  // POST /app-api/connections with method: 'dynamic' (cogniate-app-api-delta.md §3.1)
  const created = await app(s, 'POST', '/app-api/connections', {
    name: `K1 DR ${fixture.id}`,
    lms: fixture.id,
    method: 'dynamic',
    siteUrl: fixture.sim.siteUrl,
    ...(fixture.capabilities['site.serviceOrigin']
      ? { serviceUrl: fixture.sim.serviceUrl }
      : {}),
    ...connectionPatch,
  });
  expectStatus(created, 201);
  const connection = (created.json.connection ?? created.json) as {
    id: string;
    status: string;
    registrationUrl: string;
  };
  expect(connection.registrationUrl).toContain('/tool/register?token=');

  const sc = await scenario(fixture.simProvider, {
    dr: drPatch,
  });
  if (sc.registration?.registrationToken) {
    recordSecret(String(sc.registration.registrationToken));
  }

  const regUrl = new URL(connection.registrationUrl, APP);
  regUrl.searchParams.set('openid_configuration', sc.registration.openidConfiguration);
  if (sc.registration.registrationToken) {
    regUrl.searchParams.set('registration_token', sc.registration.registrationToken);
  }

  // Step 1: GET /tool/register -> confirmation page (cogniate-app-api-delta.md §3.2)
  const getPage = await appRequest('GET', `${regUrl.pathname}${regUrl.search}`, {
    headers: { accept: 'text/html' },
  });
  if (getPage.status !== 200 || !getPage.text.includes('name="previewToken"')) {
    return {
      connection,
      sc,
      step: 'get' as const,
      response: getPage,
    };
  }

  const form = parseForm(getPage.text);
  // Step 2: POST /tool/register with previewToken -> completes registration
  const postPage = await appRequest('POST', form.action, {
    headers: {
      accept: 'text/html',
      origin: APP_ORIGIN,
    },
    form: form.fields,
  });
  return {
    connection,
    sc,
    step: 'post' as const,
    getPage,
    response: postPage,
  };
}

// Fetches setup artifact JSON (`GET /app-api/connections/:id/canvas-configuration?jwk=...`,
// cogniate-app-api.md §4.7; cogniate-app-api-delta.md §3.6).
export async function fetchSetupArtifactConfig(
  s: KitSession,
  connectionId: string,
  jwkMode: 'url' | 'inline',
) {
  return app(
    s,
    'GET',
    `/app-api/connections/${connectionId}/canvas-configuration?jwk=${jwkMode}`,
  );
}

// Selects the alternate Dynamic Registration token format (`opaque-bearer` vs `moodle-scope-jwt`)
// for a channel fixture (lti-service-api-delta.md §5).
export function getAlternateDrTokenFormat(fixture: ChannelFixture): string {
  return fixture.sim.family === 'moodle_lms' ? 'opaque-bearer' : 'moodle-scope-jwt';
}

// Returns fixtures whose issuer or host is reserved/fixed relative to `currentFixtureId`
// (lti-service-api-delta.md §3.1).
export function getReservedIssuerFixtures(
  allFixtures: ChannelFixture[],
  currentFixtureId: string,
): ChannelFixture[] {
  return allFixtures.filter(
    (f) =>
      f.id !== currentFixtureId &&
      (f.capabilities['platform.sharing'] === 'shared' ||
        f.sim.issuer.startsWith('https://canvas.')),
  );
}

export interface CapabilityGuardSpec {
  capability: CapabilityKey;
  expectedErrorCode: string;
  expectedStatus: number;
}

export const NEGATIVE_GUARD_SPECS: Record<string, CapabilityGuardSpec> = {
  'registration.dynamic': {
    capability: 'registration.dynamic',
    expectedErrorCode: 'CAPABILITY_NOT_SUPPORTED',
    expectedStatus: 422,
  },
  'deployments.multiple': {
    capability: 'deployments.multiple',
    expectedErrorCode: 'CAPABILITY_NOT_SUPPORTED',
    expectedStatus: 409,
  },
  'setup.artifacts': {
    capability: 'setup.artifacts',
    expectedErrorCode: 'CAPABILITY_NOT_SUPPORTED',
    expectedStatus: 409,
  },
  'siteApi.token': {
    capability: 'siteApi.token',
    expectedErrorCode: 'CAPABILITY_NOT_SUPPORTED',
    expectedStatus: 409,
  },
  'publish.createCourse': {
    capability: 'publish.createCourse',
    expectedErrorCode: 'CAPABILITY_NOT_SUPPORTED',
    expectedStatus: 409,
  },
  'setup.connectionCheck': {
    capability: 'setup.connectionCheck',
    expectedErrorCode: 'CAPABILITY_NOT_SUPPORTED',
    expectedStatus: 409,
  },
  'content.ungraded': {
    capability: 'content.ungraded',
    expectedErrorCode: 'PLACEMENT_NOT_GRADED',
    expectedStatus: 403,
  },
};

// Probes a negative capability guard and verifies BOTH no-network oracles:
// 1. simulator /__sim/records cursor does not advance (`noServiceCalls(cursor)`)
// 2. zero `outbound_request` log events in `lti-service` and `cogniate-app` (`logEvents(...)`).
export async function runCapabilityGuardProbe(
  binding: ChannelBinding,
  spec: CapabilityGuardSpec,
): Promise<void> {
  const s = binding.session;
  const connId = binding.connection.id;
  const cursor = (await records()).cursor;
  const since = Date.now();

  switch (spec.capability) {
    case 'registration.dynamic': {
      // POST /app-api/connections with method: 'dynamic' -> 422 CAPABILITY_NOT_SUPPORTED (cogniate-app-api-delta.md §3.1)
      const res = await app(s, 'POST', '/app-api/connections', {
        name: `No DR ${binding.fixture.id}`,
        lms: binding.fixture.id,
        method: 'dynamic',
        siteUrl: binding.fixture.sim.siteUrl,
      });
      expectStatus(res, 422, 'CAPABILITY_NOT_SUPPORTED');
      expect(res.json?.details?.capability).toBe('dynamicRegistration');
      break;
    }
    case 'deployments.multiple': {
      // POST /app-api/connections/:id/deployments -> 409 CAPABILITY_NOT_SUPPORTED (cogniate-app-api-delta.md §3.5)
      const res = await app(s, 'POST', `/app-api/connections/${connId}/deployments`, {
        deploymentId: binding.secondaryDeploymentId,
      });
      expectStatus(res, 409, 'CAPABILITY_NOT_SUPPORTED');
      expect(res.json?.details?.capability).toBe('addDeployment');
      break;
    }
    case 'setup.artifacts': {
      // GET /app-api/connections/:id/canvas-configuration -> 409 CAPABILITY_NOT_SUPPORTED (cogniate-app-api-delta.md §3.6)
      const res = await app(
        s,
        'GET',
        `/app-api/connections/${connId}/canvas-configuration?jwk=url`,
      );
      expectStatus(res, 409, 'CAPABILITY_NOT_SUPPORTED');
      expect(res.json?.details?.capability).toBe('canvasConfiguration');
      break;
    }
    case 'siteApi.token': {
      // PUT /app-api/connections/:id/web-services -> 409 CAPABILITY_NOT_SUPPORTED (cogniate-app-api-delta.md §3.6)
      const res = await app(s, 'PUT', `/app-api/connections/${connId}/web-services`, {
        token: 'unused-token-12345678',
      });
      expectStatus(res, 409, 'CAPABILITY_NOT_SUPPORTED');
      expect(res.json?.details?.capability).toBe('webServices');
      break;
    }
    case 'publish.createCourse': {
      // POST /app-api/publications with createMoodleCourse -> 409 CAPABILITY_NOT_SUPPORTED (cogniate-app-api-delta.md §3.6)
      const course = await createCourse(s, unique('Guard Course Shell'));
      const zipPath = fixtureZip('scorm12');
      const uploaded = await uploadVersion(s, course.id, zipPath);
      expectStatus(uploaded, 201);
      const res = await app(s, 'POST', '/app-api/publications', {
        courseId: course.id,
        versionId: uploaded.json.id,
        connectionId: connId,
        title: 'Guard Course Shell',
        createMoodleCourse: {
          fullname: 'Should Not Create',
          shortname: 'SNC1',
          categoryId: 1,
        },
      });
      expectStatus(res, 409, 'CAPABILITY_NOT_SUPPORTED');
      expect(res.json?.details?.capability).toBe('courseShell');
      break;
    }
    case 'setup.connectionCheck': {
      // POST /app-api/connections/:id/check -> 409 CAPABILITY_NOT_SUPPORTED (cogniate-app-api-delta.md §3.7)
      const res = await app(s, 'POST', `/app-api/connections/${connId}/check`, {});
      expectStatus(res, 409, 'CAPABILITY_NOT_SUPPORTED');
      expect(res.json?.details?.capability).toBe('setup.connectionCheck');
      break;
    }
    case 'content.ungraded': {
      // GET /tool/picker/:pickerId when accept_lineitem=false -> 403 PLACEMENT_NOT_GRADED (cogniate-app-api-delta.md §5)
      const launched = await launchOnChannel(binding, {
        messageType: 'LtiDeepLinkingRequest',
        roles: [ROLE_INSTRUCTOR],
        acceptLineitem: false,
      });
      expect(launched.response.status).toBe(303);
      const afterLaunchCursor = (await records()).cursor;
      const afterLaunchSince = Date.now();
      const pickerPage = await appRequest('GET', launched.location, {
        headers: { accept: 'text/html' },
      });
      expect(pickerPage.status).toBe(403);
      expect(pickerPage.text).toContain('data-error-code="PLACEMENT_NOT_GRADED"');
      await noServiceCalls(afterLaunchCursor);
      expect(logEvents('outbound_request', afterLaunchSince, {}, 'lti-service')).toEqual([]);
      expect(logEvents('outbound_request', afterLaunchSince, {}, 'cogniate-app')).toEqual([]);
      return;
    }
    default:
      throw new Error(`Unsupported capability guard probe: ${spec.capability}`);
  }

  await noServiceCalls(cursor);
  expect(logEvents('outbound_request', since, {}, 'lti-service')).toEqual([]);
  expect(logEvents('outbound_request', since, {}, 'cogniate-app')).toEqual([]);
}

// Reads service logs from LOGS_DIR (<service>.jsonl per tests/acceptance/lib/paths.ts and logs.ts)
// or LA_RUN_DIR when overridden in host-only tests.
export function readServiceLogs(serviceName: 'lti-service' | 'cogniate-app' | 'lms-sim'): string {
  const candidates: string[] = [path.join(LOGS_DIR, `${serviceName}.jsonl`)];
  const runDir = process.env.LA_RUN_DIR;
  if (runDir) {
    candidates.unshift(
      path.join(runDir, `${serviceName}.jsonl`),
      path.join(runDir, 'logs', `${serviceName}.jsonl`),
      path.join(runDir, `${serviceName}.log`),
      path.join(runDir, 'logs', `${serviceName}.log`),
    );
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf8');
      if (content.trim().length > 0) {
        return content;
      }
    }
  }
  return '';
}

const EXCLUDED_ARTIFACT_BASENAMES = new Set([
  'kit-secrets.raw.jsonl',
  'kit-secrets.jsonl',
  'm1-secrets.raw.jsonl',
  'lti-service.log',
  'cogniate-app.log',
  'lms-sim.log',
  'lti-service.jsonl',
  'cogniate-app.jsonl',
  'lms-sim.jsonl',
]);

export function walkArtifactFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const resultsList: string[] = [];
  const visit = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        if (!EXCLUDED_ARTIFACT_BASENAMES.has(entry.name)) {
          resultsList.push(fullPath);
        }
      }
    }
  };
  visit(rootDir);
  return resultsList.sort();
}

export function scanTextForSecrets(
  text: string,
  secrets: string[],
  sourceLabel: string,
): Array<{ source: string; preview: string }> {
  const leaks: Array<{ source: string; preview: string }> = [];
  for (const secret of secrets) {
    if (!secret || secret.length < 8) {
      continue;
    }
    if (text.includes(secret)) {
      leaks.push({
        source: sourceLabel,
        preview: `${secret.slice(0, 4)}...[len=${secret.length}]`,
      });
    }
  }
  return leaks;
}

export async function scanAllLogsAndArtifactsForSecrets(
  options: SecretScanOptions = {},
): Promise<SecretScanResult> {
  const missingInputs: string[] = [];
  const hits: SecretScanHit[] = [];
  const sources: Array<{ name: string; content: string }> = [];

  const fetchFn =
    options.fetchImpl ??
    (async (url: string) => {
      const res = await fetch(url);
      const rawText = await res.text();
      let json: unknown = null;
      try {
        json = rawText ? JSON.parse(rawText) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json, rawText };
    });

  const readLogFn = options.readServiceLogImpl ?? readServiceLogs;
  const artifactRoot =
    options.artifactRoot !== undefined
      ? options.artifactRoot
      : (process.env.LA_RUN_DIR ?? getKitStateDir());

  // 1. Secret dictionary from /__sim/secrets + local private secret store
  let simSecretList: string[] = [];
  try {
    const simSecretRes = await fetchFn(`${SIM_CONTROL_URL}/__sim/secrets`);
    if (
      simSecretRes.status === 200 &&
      isPlainObject(simSecretRes.json) &&
      Array.isArray(simSecretRes.json.values)
    ) {
      simSecretList = (simSecretRes.json.values as unknown[]).filter(
        (s): s is string => typeof s === 'string' && s.trim().length >= 8,
      );
    } else {
      missingInputs.push('sim:secrets');
    }
  } catch {
    missingInputs.push('sim:secrets');
  }

  const localSecrets = artifactRoot ? readLocalRecordedSecrets(artifactRoot) : [];
  const extraSecrets = (options.additionalSecrets ?? []).filter(
    (s) => typeof s === 'string' && s.trim().length >= 8,
  );
  const allSecrets = [...new Set([...simSecretList, ...localSecrets, ...extraSecrets])];
  if (allSecrets.length === 0 && !missingInputs.includes('sim:secrets')) {
    missingInputs.push('sim:secrets');
  }

  // 2. Service logs (lti-service, cogniate-app, lms-sim)
  for (const svc of ['lti-service', 'cogniate-app', 'lms-sim'] as const) {
    let content = '';
    try {
      content = readLogFn(svc);
    } catch {
      content = '';
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      missingInputs.push(`service:${svc}`);
    } else {
      sources.push({ name: `service:${svc}`, content });
    }
  }

  // 3. Simulator /__sim/records
  try {
    const simRecordsRes = await fetchFn(`${SIM_CONTROL_URL}/__sim/records?since=0`);
    if (
      simRecordsRes.status === 200 &&
      isPlainObject(simRecordsRes.json) &&
      Array.isArray(simRecordsRes.json.records) &&
      simRecordsRes.json.records.length > 0
    ) {
      sources.push({
        name: 'sim:records',
        content: JSON.stringify(simRecordsRes.json.records),
      });
    } else {
      missingInputs.push('sim:records');
    }
  } catch {
    missingInputs.push('sim:records');
  }

  // 4. Redacted evidence tree (recursive walk)
  if (!artifactRoot || !fs.existsSync(artifactRoot)) {
    missingInputs.push('artifact:redacted-evidence');
  } else {
    const artifactFiles = walkArtifactFiles(artifactRoot);
    let redactedEvidenceFileCount = 0;
    for (const fullPath of artifactFiles) {
      const rel = path.relative(artifactRoot, fullPath);
      const base = path.basename(fullPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      sources.push({ name: `artifact:${rel}`, content });
      const isInternalLedgerFile =
        base === 'kit-executed-cases.jsonl' ||
        base === 'kit-run-meta.json' ||
        base === 'wave-evidence.json' ||
        base === 'k1-kit-summary.md' ||
        base === 'k1-kit-summary.json';
      if (!isInternalLedgerFile && content.trim().length > 0) {
        redactedEvidenceFileCount += 1;
      }
    }
    if (redactedEvidenceFileCount === 0) {
      missingInputs.push('artifact:redacted-evidence');
    }
  }

  // Scan every collected source against every secret
  for (const src of sources) {
    if (!src.content) {
      continue;
    }
    for (const secret of allSecrets) {
      if (src.content.includes(secret)) {
        hits.push({
          source: src.name,
          secretPrefix: `${secret.slice(0, 6)}...`,
        });
      }
    }
  }

  return {
    ok: missingInputs.length === 0 && hits.length === 0,
    secretCount: allSecrets.length,
    leakedCount: hits.length,
    hits,
    missingInputs,
    scannedSources: sources.map((s) => s.name),
  };
}
