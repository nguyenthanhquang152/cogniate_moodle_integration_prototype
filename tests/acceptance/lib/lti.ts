// LTI service helpers for QA tests (T2 onward): seed values, API calls, evidence recorders.
// Source: tasks/T2.md (ltiSeed, lti.apiKeyFiles), contract lti-service-api.md §1.2, §1.3, §5.
import fs from 'node:fs';
import path from 'node:path';
import { publicUrls } from './env';
import { httpsRequest, type HttpResult } from './https';
import { readLog, type LogEntry } from './logs';
import { artifactsDir, REPO_ROOT, SECRETS_DIR, SEED_FILE } from './paths';

export const ACCOUNT = 'cogniate';
export const SECOND_ACCOUNT = 'qa-second';
export const LTI_CLAIM = 'https://purl.imsglobal.org/spec/lti/claim/';

const urls = publicUrls();
export const LAUNCH_URL = `${urls.lti}/lti/launch/${ACCOUNT}`;
export const LOGIN_URL = `${urls.lti}/lti/login/${ACCOUNT}`;
export const SEED_TARGET = `${urls.lti}/lti/launch/${ACCOUNT}?resource=seed`;

// ---------------------------------------------------------------- seed.json (T2 keys)

function rawSeed(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as Record<string, unknown>;
}

export interface LtiSeed {
  typeId: number;
  clientId: string;
  deploymentId: string;
  cmids: Record<string, number>;
  platformId: string;
}

/** `ltiSeed` written by `npm run seed:lti-manual` (T2 scope). */
export function ltiSeed(): LtiSeed {
  const s = rawSeed().ltiSeed as Record<string, unknown> | undefined;
  if (!s) throw new Error('seed.json has no "ltiSeed" (run npm run seed:lti-manual).');
  return {
    typeId: Number(s.typeId),
    clientId: String(s.clientId),
    deploymentId: String(s.deploymentId),
    cmids: Object.fromEntries(Object.entries((s.cmids ?? {}) as Record<string, unknown>).map(([k, v]) => [k, Number(v)])),
    platformId: String(s.platformId),
  };
}

/** API key of a tool account, from the file that seed.json `lti.apiKeyFiles` names (fallback: infra/.secrets). */
export function apiKey(account: string): string {
  const files = ((rawSeed().lti as Record<string, unknown> | undefined)?.apiKeyFiles ?? {}) as unknown;
  let named: string | undefined;
  if (Array.isArray(files)) {
    const hit = files.find((f) => f && typeof f === 'object' && (f as Record<string, unknown>).account === account) as
      | Record<string, unknown>
      | undefined;
    named = hit ? String(hit.path ?? hit.file) : undefined;
  } else if (files && typeof files === 'object') {
    const v = (files as Record<string, unknown>)[account];
    named = typeof v === 'string' ? v : undefined;
  }
  const candidates = [
    named && path.isAbsolute(named) ? named : undefined,
    named ? path.join(REPO_ROOT, named) : undefined,
    named ? path.join(SECRETS_DIR, path.basename(named)) : undefined,
    path.join(SECRETS_DIR, `lti-api-key.${account}`),
  ].filter((c): c is string => Boolean(c));
  const file = candidates.find((c) => fs.existsSync(c));
  if (!file) throw new Error(`No API key file for account "${account}" (tried ${candidates.join(', ')}).`);
  const key = fs.readFileSync(file, 'utf8').trim();
  recordSecret('api_key', key);
  return key;
}

// ---------------------------------------------------------------- API calls

export const auth = {
  ltik: (key: string, ltik: string) => `LTIK-AUTH-V2 ${key}:${ltik}`,
  service: (key: string, serviceKey: string) => `SERVICE-AUTH-V1 ${key}:${serviceKey}`,
  bearer: (key: string) => `Bearer ${key}`,
};

export interface ApiResult<T = unknown> extends HttpResult {
  json: T;
  traceId: string;
}

export async function ltiApi<T = unknown>(
  method: string,
  pathAndQuery: string,
  { authorization, body }: { authorization?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (authorization !== undefined) headers.authorization = authorization;
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(Buffer.byteLength(payload));
  }
  const res = await httpsRequest(`${urls.lti}${pathAndQuery}`, { method, headers, body: payload });
  let json: unknown = null;
  try {
    json = res.body ? JSON.parse(res.body) : null;
  } catch {
    json = null;
  }
  return { ...res, json: json as T, traceId: String(res.headers['x-trace-id'] ?? '') };
}

/** Error body shape of contract §1.3. */
export function errorCode(res: ApiResult): string | undefined {
  const j = res.json as { status?: number; error?: string; details?: { message?: string; description?: string } } | null;
  return j?.details?.message;
}

export function hasErrorShape(res: ApiResult): boolean {
  const j = res.json as { status?: unknown; error?: unknown; details?: { message?: unknown; description?: unknown } } | null;
  return (
    j !== null &&
    j.status === res.status &&
    typeof j.error === 'string' &&
    typeof j.details?.message === 'string' &&
    typeof j.details?.description === 'string'
  );
}

// ---------------------------------------------------------------- evidence recorders

const SECRETS_FILE = () => path.join(artifactsDir('acceptance'), 'captured-secrets.jsonl');
const ERRORS_FILE = () => path.join(artifactsDir('acceptance'), 'captured-error-pages.jsonl');

/** Remember a secret value. AC-T2-16 later checks that no log contains it. The file stays in git-ignored artifacts. */
export function recordSecret(kind: 'ltik' | 'id_token' | 'state' | 'api_key' | 'service_key' | 'nonce', value: string | undefined): void {
  if (!value || value.length < 8) return;
  fs.appendFileSync(SECRETS_FILE(), `${JSON.stringify({ kind, value })}\n`);
}

export function capturedSecrets(): { kind: string; value: string }[] {
  if (!fs.existsSync(SECRETS_FILE())) return [];
  return fs.readFileSync(SECRETS_FILE(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { kind: string; value: string });
}

export interface ErrorPage {
  test: string;
  endpoint: 'login' | 'launch';
  status: number;
  code: string;
  traceId: string;
  pageShowsTraceId: boolean;
}

/** Remember an HTML error page. AC-T2-30 later matches it with its log event. */
export function recordErrorPage(page: ErrorPage): void {
  fs.appendFileSync(ERRORS_FILE(), `${JSON.stringify(page)}\n`);
}

export function capturedErrorPages(): ErrorPage[] {
  if (!fs.existsSync(ERRORS_FILE())) return [];
  return fs.readFileSync(ERRORS_FILE(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as ErrorPage);
}

// ---------------------------------------------------------------- logs

export async function waitForEvent(
  service: string,
  predicate: (e: LogEntry) => boolean,
  timeoutMs = 8_000,
): Promise<LogEntry | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const hit = readLog(service).entries.map((e) => e.entry).find(predicate);
      if (hit) return hit;
    } catch {
      // the file is not there yet
    }
    if (Date.now() > deadline) return undefined;
    await new Promise((r) => setTimeout(r, 250));
  }
}

export function eventsSince(service: string, sinceMs: number, predicate: (e: LogEntry) => boolean = () => true): LogEntry[] {
  try {
    return readLog(service).entries.map((e) => e.entry).filter((e) => Date.parse(String(e.ts)) >= sinceMs && predicate(e));
  } catch {
    return [];
  }
}

/** `sink_hit` lines of the evil.test sink since a time (local-stack §3). */
export function sinkHitsSince(sinceMs: number): LogEntry[] {
  return eventsSince('sink', sinceMs, (e) => e.event === 'sink_hit');
}

/** Hosts in log events can carry a port. */
export function hostIs(e: LogEntry, host: string): boolean {
  const h = String(e.host ?? '');
  return h === host || h.split(':')[0] === host.split(':')[0];
}

// ---------------------------------------------------------------- HTML error pages (security §2.2, T2a scope)

export interface PageResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

const attr = (body: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(body)?.[1];
const header = (h: PageResponse['headers'], name: string) => {
  const v = h[name] ?? h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};

/**
 * Checks an HTML error page of the protocol endpoints and records it (AC-T2-30). Returns a list of problems
 * (empty = the page is right): status, no redirect, data-error-code = code, data-trace-id = X-Trace-Id.
 */
export function checkErrorPage(
  res: PageResponse,
  code: string,
  { statuses = [400, 401], test, endpoint }: { statuses?: number[]; test: string; endpoint: 'login' | 'launch' },
): string[] {
  const problems: string[] = [];
  const traceId = header(res.headers, 'x-trace-id') ?? '';
  const pageCode = attr(res.body, 'data-error-code');
  const pageTrace = attr(res.body, 'data-trace-id');
  if (!statuses.includes(res.status)) problems.push(`status ${res.status}, want ${statuses.join(' or ')}`);
  if (header(res.headers, 'location')) problems.push(`has a Location header (${header(res.headers, 'location')})`);
  if (pageCode !== code) problems.push(`data-error-code = ${pageCode ?? 'missing'}, want ${code}`);
  if (!traceId) problems.push('no X-Trace-Id header');
  if (pageTrace !== traceId) problems.push(`data-trace-id = ${pageTrace ?? 'missing'}, X-Trace-Id = ${traceId || 'missing'}`);
  recordErrorPage({ test, endpoint, status: res.status, code: pageCode ?? '', traceId, pageShowsTraceId: Boolean(traceId) && res.body.includes(traceId) });
  return problems;
}

// ---------------------------------------------------------------- run window (AC-T2-30 counts "in the whole T2b run")

/** Start time of a task run in this artifacts folder. The first caller sets it; later callers read it. */
export function runStart(task: string): number {
  const file = path.join(artifactsDir('acceptance'), `run-start-${task}.txt`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, String(Date.now() - 1_000));
  return Number(fs.readFileSync(file, 'utf8'));
}

/** Expected `check` values of `launch_check_failed` per error code (security §2.2). */
export const CHECK_OF_CODE: Record<string, string[]> = {
  INVALID_STATE: ['1', '2'],
  STATE_COOKIE_MISSING: ['2'],
  INVALID_ID_TOKEN: ['4'],
  INVALID_ISSUER_OR_AUDIENCE: ['5'],
  INVALID_SIGNATURE: ['6'],
  TOKEN_EXPIRED: ['7'],
  INVALID_NONCE: ['8'],
  UNKNOWN_DEPLOYMENT: ['9'],
  UNSUPPORTED_MESSAGE_TYPE: ['10'],
  MISSING_CLAIM: ['11'],
  INVALID_TARGET_LINK_URI: ['12'],
  PLATFORM_ERROR: ['oidc_error'],
};

// ---------------------------------------------------------------- state shared by the spec files of one task run

export function saveState(task: string, patch: Record<string, unknown>): Record<string, unknown> {
  const file = path.join(artifactsDir('acceptance'), `state-${task}.json`);
  const next = { ...loadState(task), ...patch };
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return next;
}

export function loadState(task: string): Record<string, unknown> {
  const file = path.join(artifactsDir('acceptance'), `state-${task}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
}

export const DL_CLAIM = 'https://purl.imsglobal.org/spec/lti-dl/claim/';
