// Operator API client for the QA-2 task suites (LA-E5-01 onward). Black-box: plain HTTP from the e2e container to the
// operator listener (tasks README §2 form (h)). Facts: contract delta §1.2 (scheme, key format), §1.3 (codes),
// §3 (paths and shapes); LA-ADR-06 D3 (listener, key file). Later QA-2 tasks import this file; they do not copy it.
//
// Secret rule: an operator key is never put into an assertion message, a log line or an artifact. Use `assert.ok`
// with a fixed message (Vitest prints the values of a failed `expect`).
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { ApiResult } from '../../../acceptance/lib/lti';
import { LOGS_DIR, SECRETS_DIR } from '../../../acceptance/lib/paths';

/** Operator listener of the acceptance profile (LA-ADR-06 D3). */
export const OPERATOR_URL = (process.env.QA_OPERATOR_URL ?? 'http://lti-service:4110').replace(/\/+$/, '');
/** Written by `stack:up` (`lti:operator init --if-none`) and by the `--replace` procedure (operability §6.4). */
export const OPERATOR_KEY_FILE = path.join(SECRETS_DIR, 'lti-operator-key');
/** Contract delta §1.2: `ltio_` + 43 base64url characters. */
export const OPERATOR_KEY_RE = /^ltio_[A-Za-z0-9_-]{43}$/;
/** Tenant API key format, unchanged (LA-ADR-06 D5): `ltis_` + 43 base64url characters. */
export const TENANT_KEY_RE = /^ltis_[A-Za-z0-9_-]{43}$/;
export const INVALID_OPERATOR_AUTH = 'INVALID_OPERATOR_AUTHORIZATION_HEADER';

export const operatorAuth = (key: string) => `OPERATOR-AUTH-V1 ${key}`;

/** A key of the right format that the service never issued. */
export const unknownOperatorKey = () => `ltio_${crypto.randomBytes(32).toString('base64url')}`;
export const unknownTenantKey = () => `ltis_${crypto.randomBytes(32).toString('base64url')}`;

/** The operator key of the key file (trimmed). The caller checks the format with OPERATOR_KEY_RE. */
export function readOperatorKey(): string {
  return fs.readFileSync(OPERATOR_KEY_FILE, 'utf8').trim();
}

/** One HTTP request to the operator listener. No redirects. Same result shape as `ltiApi` (lib/lti.ts). */
export function operatorApi<T = unknown>(
  method: string,
  pathAndQuery: string,
  { authorization, body, timeoutMs = 15_000 }: { authorization?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  const url = new URL(`${OPERATOR_URL}${pathAndQuery}`);
  const headers: Record<string, string> = { accept: 'application/json' };
  if (authorization !== undefined) headers.authorization = authorization;
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(Buffer.byteLength(payload));
  }
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: url.hostname, port: url.port || 80, path: `${url.pathname}${url.search}`, method, headers, agent: false, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          const text = raw.toString('utf8');
          let json: unknown = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: text, raw, json: json as T, traceId: String(res.headers['x-trace-id'] ?? '') });
        });
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error(`Timeout after ${timeoutMs} ms: ${url.origin}${url.pathname}`), { code: 'QA_TIMEOUT' })));
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

/** Operator key metadata of `GET /operator/v1/operator-keys` (contract delta §3). */
export interface OperatorKeyRow {
  id: string;
  operator: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  [field: string]: unknown;
}

export async function listOperatorKeys(key: string): Promise<{ res: ApiResult<{ operatorKeys?: OperatorKeyRow[] }>; rows: OperatorKeyRow[] }> {
  const res = await operatorApi<{ operatorKeys?: OperatorKeyRow[] }>('GET', '/operator/v1/operator-keys', { authorization: operatorAuth(key) });
  return { res, rows: Array.isArray(res.json?.operatorKeys) ? res.json.operatorKeys : [] };
}

export interface IssuedOperatorKey {
  id: string;
  operatorKey: string;
  operator: string;
  expiresAt: string;
}

export function issueOperatorKey(key: string, body: { operator: string; expiresAt?: string }) {
  return operatorApi<IssuedOperatorKey>('POST', '/operator/v1/operator-keys', { authorization: operatorAuth(key), body });
}

export function revokeOperatorKey(key: string, id: string) {
  return operatorApi<Record<string, unknown>>('POST', `/operator/v1/operator-keys/${encodeURIComponent(id)}/revoke`, { authorization: operatorAuth(key) });
}

/** The forms in which a stored hash of `value` could leak: SHA-256 as hex, base64 and base64url. */
export function hashForms(value: string): string[] {
  const digest = crypto.createHash('sha256').update(value).digest();
  return [digest.toString('hex'), digest.toString('base64'), digest.toString('base64url')];
}

/** Names of the service log files (infra/.logs/*.jsonl) that contain any of the values. Values never leave this function. */
export function logFilesContaining(values: string[]): string[] {
  if (!fs.existsSync(LOGS_DIR)) return [];
  const wanted = values.filter((v) => v.length >= 16);
  return fs
    .readdirSync(LOGS_DIR)
    .filter((f) => f.endsWith('.jsonl') || f.endsWith('.log'))
    .filter((f) => {
      const text = fs.readFileSync(path.join(LOGS_DIR, f), 'utf8');
      return wanted.some((v) => text.includes(v));
    });
}
