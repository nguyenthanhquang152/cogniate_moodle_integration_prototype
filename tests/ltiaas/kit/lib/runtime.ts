import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import {
  buildOperatorGrantCliArgs,
  ChannelFixture,
  computeExpectedCaseList,
  computeExpectedGlobalCaseList,
  evaluateChannelPassRule,
  ExecutedCaseRecord,
  isPlainObject,
  KitSuiteName,
  OperatorGrantCliOptions,
  PassRuleEvaluation,
  WaveEvidenceManifest,
} from './fixtures.js';

export const APP_URL = process.env.COGNIATE_APP_URL ?? 'https://app.cogniate.test';
export const LTI_URL = process.env.LTI_SERVICE_URL ?? 'https://lti.cogniate.test';
export const SIM_CONTROL_URL = process.env.LMS_SIM_CONTROL_URL ?? 'http://127.0.0.1:4199';
export const LTI_API_KEY = process.env.LTI_SERVICE_API_KEY ?? 'dev-lti-api-key-change-me';
export const APP_SESSION_SECRET =
  process.env.APP_SESSION_SECRET ?? 'dev-app-session-secret-change-me';

export interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  rawBody: string;
  json: unknown;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string;
  form?: Record<string, string>;
  cookie?: string;
  timeoutMs?: number;
}

export interface RegisteredChannelContext {
  fixture: ChannelFixture;
  libraryId: string;
  cookie: string;
  csrf: string;
  connectionId: string;
  platformId: string;
  clientId: string;
  deploymentId: string;
  secondaryDeploymentId: string;
  courseId: string;
  secondCourseId: string;
  resourceSlug: string;
  secondResourceSlug: string;
}

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

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export function isK1SimEnabled(): boolean {
  const level = (process.env.LA_LEVEL ?? '').toLowerCase();
  if (level === 'k0') {
    return false;
  }
  return Boolean(
    level === 'k1-sim' ||
      process.env.QA_TASK === 'K1' ||
      process.env.QA_TASK === 'LA-E7-06' ||
      process.env.QA_KIT_RUN === '1',
  );
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

export function recordSkippedCase(
  channelId: string,
  suite: KitSuiteName,
  code: string,
  detail?: string,
  options?: { stateDir?: string; runId?: string },
): void {
  recordExecutedCase(
    {
      id: `${channelId}:${suite}:${code}`,
      channelId,
      suite,
      code,
      outcome: 'SKIP',
      detail,
      runId: options?.runId,
    },
    { stateDir: options?.stateDir },
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
  const records: ExecutedCaseRecord[] = [];
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as ExecutedCaseRecord;
      if (rec && typeof rec.id === 'string') {
        records.push(rec);
      }
    } catch {
      // Ignore malformed trailing lines
    }
  }
  return records;
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
  const currentWaveId =
    options?.currentWaveId !== undefined
      ? options.currentWaveId
      : (process.env.LA_WAVE_ID ?? null);

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
  requireH1?: boolean;
}): KitRunPassRuleReport {
  const expectedRunId = input.expectedRunId ?? null;
  const currentWaveId =
    input.currentWaveId !== undefined
      ? input.currentWaveId
      : (input.waveEvidence?.waveId ?? process.env.LA_WAVE_ID ?? null);
  const channels: Record<string, PassRuleEvaluation> = {};
  let totalExpectedRun = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalDuplicates = 0;

  for (const fixture of input.fixtures) {
    const expectedCases = computeExpectedCaseList(fixture);
    const evalResult = evaluateChannelPassRule({
      fixture,
      expectedCases,
      executedRecords: input.executedRecords,
      waveEvidence: input.waveEvidence,
      currentWaveId,
      expectedRunId,
    });
    channels[fixture.id] = evalResult;
    totalExpectedRun += evalResult.expectedRunCount;
    totalPassed += evalResult.executedPassCount;
    totalFailed += evalResult.failedCases.length;
    totalSkipped += evalResult.skippedCount;
    totalDuplicates += evalResult.duplicateOrRetriedCases.length;
  }

  const globalErrors: string[] = [];
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

export function recordSecret(secretValue: string, options?: { stateDir?: string }): void {
  if (!secretValue || secretValue.trim().length < 8) {
    return;
  }
  const filePath = path.join(getKitStateDir(options?.stateDir), 'kit-secrets.raw.jsonl');
  fs.appendFileSync(filePath, `${JSON.stringify({ value: secretValue.trim() })}\n`, 'utf8');
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

export function readLocalRecordedSecrets(stateDir?: string): string[] {
  const dir = getKitStateDir(stateDir);
  const secrets = new Set<string>();
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
        const parsed = JSON.parse(line) as { value?: string };
        if (typeof parsed.value === 'string' && parsed.value.length >= 8) {
          secrets.add(parsed.value);
        }
      } catch {
        // Ignore malformed line
      }
    }
  }
  return [...secrets];
}

export function httpRequest(urlString: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const parsed = new URL(urlString);
  const isHttps = parsed.protocol === 'https:';
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { ...(options.headers ?? {}) };

  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  let payload: string | undefined;
  if (options.rawBody !== undefined) {
    payload = options.rawBody;
  } else if (options.form !== undefined) {
    payload = new URLSearchParams(options.form).toString();
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
  } else if (options.body !== undefined) {
    payload = JSON.stringify(options.body);
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['content-type'] = 'application/json';
    }
  }

  if (payload !== undefined) {
    headers['content-length'] = String(Buffer.byteLength(payload));
  }

  return new Promise((resolve, reject) => {
    const lib = isHttps ? https : http;
    const req = lib.request(
      parsed,
      {
        method,
        headers,
        agent: isHttps ? httpsAgent : undefined,
        timeout: options.timeoutMs ?? 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          let json: unknown = null;
          try {
            json = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            json = null;
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            rawBody,
            json,
          });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out: ${method} ${urlString}`));
    });
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

export function createStaffSession(libraryId: string, userId = 'staff-kit-user'): {
  cookie: string;
  csrf: string;
} {
  const csrf = crypto.randomBytes(16).toString('hex');
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      libraryId,
      role: 'library_admin',
      csrf,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', APP_SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const token = `${payload}.${sig}`;
  recordSecret(token);
  return {
    cookie: `cogniate_staff_session=${token}`,
    csrf,
  };
}

export async function appApi(
  pathname: string,
  session: { cookie: string; csrf: string },
  options: RequestOptions = {},
): Promise<HttpResponse> {
  const headers: Record<string, string> = {
    'x-csrf-token': session.csrf,
    origin: APP_URL,
    ...(options.headers ?? {}),
  };
  return httpRequest(`${APP_URL}${pathname}`, {
    ...options,
    cookie: session.cookie,
    headers,
  });
}

export async function ltiApi(pathname: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const headers: Record<string, string> = {
    'x-service-api-key': LTI_API_KEY,
    ...(options.headers ?? {}),
  };
  return httpRequest(`${LTI_URL}${pathname}`, {
    ...options,
    headers,
  });
}

export async function simControl(
  pathname: string,
  options: RequestOptions = {},
): Promise<HttpResponse> {
  return httpRequest(`${SIM_CONTROL_URL}${pathname}`, options);
}

export async function registerSimScenario(scenario: Record<string, unknown>): Promise<{
  id: string;
  login: Record<string, string>;
  registration?: {
    openidConfiguration: string;
    registrationToken: string;
    tokenFormat: string;
    startUrl: string;
  };
}> {
  const res = await simControl('/__sim/scenarios', {
    method: 'POST',
    body: scenario,
  });
  if (res.status !== 201) {
    throw new Error(
      `Failed to register simulator scenario (${res.status}): ${res.rawBody}`,
    );
  }
  const data = res.json as {
    id: string;
    login: Record<string, string>;
    registration?: {
      openidConfiguration: string;
      registrationToken: string;
      tokenFormat: string;
      startUrl: string;
    };
  };
  if (data.registration?.registrationToken) {
    recordSecret(data.registration.registrationToken);
  }
  return data;
}

export async function getSimRecords(since = 0): Promise<{
  cursor: number;
  records: Array<Record<string, unknown>>;
}> {
  const res = await simControl(`/__sim/records?since=${since}`);
  if (res.status !== 200) {
    throw new Error(`Failed to fetch simulator records (${res.status}): ${res.rawBody}`);
  }
  return res.json as { cursor: number; records: Array<Record<string, unknown>> };
}

export async function getSimCursor(): Promise<number> {
  const data = await getSimRecords(0);
  return data.cursor;
}

export function issueOperatorGrantForChannel(
  libraryId: string,
  fixture: ChannelFixture,
  connectionId: string,
  clientId: string,
  deploymentId: string,
  options: OperatorGrantCliOptions = {},
): string {
  const args = buildOperatorGrantCliArgs(
    libraryId,
    fixture,
    connectionId,
    clientId,
    deploymentId,
    options,
  );
  const out = execFileSync('npm', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env },
  });
  const match = out.match(/cgg_[A-Za-z0-9_-]+/);
  if (!match) {
    throw new Error(`Operator grant CLI did not output a cgg_ code. Output: ${out}`);
  }
  const code = match[0];
  recordSecret(code);
  return code;
}

export async function createPublishedCourse(
  session: { cookie: string; csrf: string },
  title = 'Kit Conformance Course',
): Promise<{ courseId: string; resourceSlug: string }> {
  const createRes = await appApi('/app-api/courses', session, {
    method: 'POST',
    body: {
      title,
      topic: 'Conformance testing',
      outline: [{ title: 'Module 1', lessons: [{ title: 'Lesson 1', content: 'Content' }] }],
    },
  });
  if (createRes.status !== 201 && createRes.status !== 200) {
    throw new Error(`Failed to create course (${createRes.status}): ${createRes.rawBody}`);
  }
  const course = createRes.json as { id: string; resourceSlug?: string };
  const pubRes = await appApi(`/app-api/courses/${course.id}/publish`, session, {
    method: 'POST',
    body: {},
  });
  if (pubRes.status !== 200) {
    throw new Error(`Failed to publish course (${pubRes.status}): ${pubRes.rawBody}`);
  }
  const pubData = pubRes.json as { resourceSlug?: string; course?: { resourceSlug?: string } };
  const resourceSlug =
    pubData.resourceSlug ?? pubData.course?.resourceSlug ?? course.resourceSlug ?? course.id;
  return { courseId: course.id, resourceSlug };
}

export async function setupActiveChannelConnection(
  fixture: ChannelFixture,
  suffix = 'main',
): Promise<RegisteredChannelContext> {
  const libraryId = `lib-kit-${fixture.id}-${suffix}-${crypto.randomBytes(3).toString('hex')}`;
  const session = createStaffSession(libraryId);

  const firstCourse = await createPublishedCourse(session, `Course 1 (${fixture.id})`);
  const secondCourse = await createPublishedCourse(session, `Course 2 (${fixture.id})`);

  const createBody: Record<string, unknown> = {
    lms: fixture.id,
    name: `Kit ${fixture.id} ${suffix}`,
    siteUrl: fixture.sim.siteUrl,
  };
  if (fixture.capabilities['site.serviceOrigin']) {
    createBody.serviceUrl = fixture.sim.serviceUrl;
  }

  const connRes = await appApi('/app-api/connections', session, {
    method: 'POST',
    body: createBody,
  });
  if (connRes.status !== 201 && connRes.status !== 200) {
    throw new Error(
      `Failed to create connection for ${fixture.id} (${connRes.status}): ${connRes.rawBody}`,
    );
  }
  const conn = connRes.json as { id: string };
  const connectionId = conn.id;

  const clientId = `client-kit-${fixture.id}-${suffix}-${crypto.randomBytes(3).toString('hex')}`;
  const deploymentId = fixture.sim.deployments[0];
  const secondaryDeploymentId = fixture.sim.deployments[1] ?? `${deploymentId}-2`;

  if (fixture.capabilities['binding.authority'].manual === 'self') {
    const putBody: Record<string, unknown> = {
      clientId,
      deploymentId,
      issuer: fixture.sim.issuer,
      authEndpoint: fixture.sim.authEndpoint,
      tokenEndpoint: fixture.sim.tokenEndpoint,
      jwksUrl: fixture.sim.jwksUrl,
    };
    const putRes = await appApi(`/app-api/connections/${connectionId}/platform`, session, {
      method: 'PUT',
      body: putBody,
    });
    if (putRes.status !== 200) {
      throw new Error(
        `Failed to bind self manual platform for ${fixture.id} (${putRes.status}): ${putRes.rawBody}`,
      );
    }
  } else {
    const grantCode = issueOperatorGrantForChannel(
      libraryId,
      fixture,
      connectionId,
      clientId,
      deploymentId,
    );
    const putBody: Record<string, unknown> = {
      clientId,
      deploymentId,
      grantCode,
    };
    if (
      !fixture.capabilities['site.serviceOrigin'] &&
      fixture.capabilities['platform.sharing'] !== 'shared'
    ) {
      putBody.issuer = fixture.sim.issuer;
      putBody.authEndpoint = fixture.sim.authEndpoint;
      putBody.tokenEndpoint = fixture.sim.tokenEndpoint;
      putBody.jwksUrl = fixture.sim.jwksUrl;
      if (fixture.sim.tokenAudienceKind === 'fixed') {
        putBody.tokenAudience = Array.isArray(fixture.sim.tokenAudience)
          ? fixture.sim.tokenAudience[0]
          : fixture.sim.tokenAudience;
      }
    }
    const putRes = await appApi(`/app-api/connections/${connectionId}/platform`, session, {
      method: 'PUT',
      body: putBody,
    });
    if (putRes.status !== 200) {
      throw new Error(
        `Failed to redeem operatorGrant platform for ${fixture.id} (${putRes.status}): ${putRes.rawBody}`,
      );
    }
  }

  const getConnRes = await appApi(`/app-api/connections/${connectionId}`, session);
  const fullConn = getConnRes.json as { platformId?: string };
  const platformId = fullConn.platformId ?? '';

  recordRedactedEvidence(`connection-${fixture.id}-${suffix}`, {
    channelId: fixture.id,
    connectionId,
    platformId,
    siteUrl: fixture.sim.siteUrl,
    redacted: true,
  });

  return {
    fixture,
    libraryId,
    cookie: session.cookie,
    csrf: session.csrf,
    connectionId,
    platformId,
    clientId,
    deploymentId,
    secondaryDeploymentId,
    courseId: firstCourse.courseId,
    secondCourseId: secondCourse.courseId,
    resourceSlug: firstCourse.resourceSlug,
    secondResourceSlug: secondCourse.resourceSlug,
  };
}

export async function performSimulatorLaunch(
  ctx: RegisteredChannelContext,
  scenarioOverrides: Record<string, unknown> = {},
): Promise<{
  scenarioId: string;
  loginRes: HttpResponse;
  launchRes: HttpResponse;
  redirectLocation: string;
  ltik: string;
  playOrPickerRes?: HttpResponse;
}> {
  const scenarioId =
    (scenarioOverrides.id as string | undefined) ??
    `sc-${ctx.fixture.id}-${crypto.randomBytes(4).toString('hex')}`;
  const scenarioInput: Record<string, unknown> = {
    id: scenarioId,
    provider: ctx.fixture.simProvider,
    clientId: ctx.clientId,
    deploymentId: ctx.deploymentId,
    siteHost: ctx.fixture.sim.siteHost,
    pageHost: ctx.fixture.sim.pageHost,
    resource: ctx.resourceSlug,
    ...scenarioOverrides,
  };
  const sc = await registerSimScenario(scenarioInput);

  const loginRes = await httpRequest(`${LTI_URL}/lti/login/${ctx.libraryId}`, {
    method: 'POST',
    form: sc.login,
  });
  if (loginRes.status !== 302 && loginRes.status !== 303 && loginRes.status !== 200) {
    return {
      scenarioId,
      loginRes,
      launchRes: loginRes,
      redirectLocation: '',
      ltik: '',
    };
  }

  let authRedirectUrl = loginRes.headers.location ?? '';
  if (!authRedirectUrl && loginRes.status === 200) {
    const match = loginRes.rawBody.match(/https:\/\/[^"'\s<>]+authorize[^"'\s<>]*/i);
    if (match) {
      authRedirectUrl = match[0];
    }
  }
  const setCookieHeader = loginRes.headers['set-cookie'] as string | string[] | undefined;
  const stateCookie = Array.isArray(setCookieHeader)
    ? setCookieHeader.map((c) => c.split(';')[0]).join('; ')
    : typeof setCookieHeader === 'string'
      ? setCookieHeader.split(';')[0]
      : '';

  const simAuthRes = await httpRequest(authRedirectUrl, {
    method: 'GET',
  });
  const formMatch = simAuthRes.rawBody.match(/name="id_token"\s+value="([^"]+)"/);
  const stateMatch = simAuthRes.rawBody.match(/name="state"\s+value="([^"]+)"/);
  if (!formMatch || !stateMatch) {
    return {
      scenarioId,
      loginRes,
      launchRes: simAuthRes,
      redirectLocation: '',
      ltik: '',
    };
  }
  const idToken = formMatch[1];
  const state = stateMatch[1];
  recordSecret(idToken);

  const launchRes = await httpRequest(`${LTI_URL}/lti/launch`, {
    method: 'POST',
    cookie: stateCookie,
    form: { id_token: idToken, state },
  });
  const redirectLocation = launchRes.headers.location ?? '';
  let ltik = '';
  if (redirectLocation) {
    try {
      const locUrl = new URL(redirectLocation, APP_URL);
      ltik = locUrl.searchParams.get('ltik') ?? '';
      if (ltik) {
        recordSecret(ltik);
      }
    } catch {
      ltik = '';
    }
  }

  let playOrPickerRes: HttpResponse | undefined;
  if (redirectLocation && (launchRes.status === 302 || launchRes.status === 303)) {
    const targetUrl = redirectLocation.startsWith('http')
      ? redirectLocation
      : `${APP_URL}${redirectLocation}`;
    playOrPickerRes = await httpRequest(targetUrl, { method: 'GET' });
  }

  return {
    scenarioId,
    loginRes,
    launchRes,
    redirectLocation,
    ltik,
    playOrPickerRes,
  };
}

export function readServiceLogs(service: 'lti-service' | 'cogniate-app' | 'lms-sim'): string {
  const runDir = process.env.LA_RUN_DIR;
  if (runDir) {
    for (const candidate of [
      path.join(runDir, `${service}.log`),
      path.join(runDir, 'logs', `${service}.log`),
    ]) {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf8');
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
]);

export function walkArtifactFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const results: string[] = [];
  const visit = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        if (!EXCLUDED_ARTIFACT_BASENAMES.has(entry.name)) {
          results.push(fullPath);
        }
      }
    }
  };
  visit(rootDir);
  return results.sort();
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
      const res = await httpRequest(url, { method: 'GET' });
      return { status: res.status, json: res.json, rawText: res.rawBody };
    });

  const readLogFn = options.readServiceLogImpl ?? readServiceLogs;
  const artifactRoot =
    options.artifactRoot !== undefined
      ? options.artifactRoot
      : (process.env.LA_RUN_DIR ?? getKitStateDir());

  // 1. Secret dictionary from /__sim/secrets + local private secret store
  let simSecrets: string[] = [];
  try {
    const simSecretRes = await fetchFn(`${SIM_CONTROL_URL}/__sim/secrets`);
    if (
      simSecretRes.status === 200 &&
      isPlainObject(simSecretRes.json) &&
      Array.isArray(simSecretRes.json.values)
    ) {
      simSecrets = (simSecretRes.json.values as unknown[]).filter(
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
  const allSecrets = [...new Set([...simSecrets, ...localSecrets, ...extraSecrets])];
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
