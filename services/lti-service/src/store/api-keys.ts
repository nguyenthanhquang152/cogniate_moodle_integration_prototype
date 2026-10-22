// API keys (LA-ADR-06 D5). Only SHA-256 hashes are stored. A key value is returned once, when issued.
import { randomId, sha256Hex } from '@cogniate/shared';
import { ApiError } from '../api-errors.ts';
import { newApiKey } from '../crypto.ts';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { KeyError } from '../http/key-errors.ts';

export const API_KEY = /^ltis_[A-Za-z0-9_-]{43}$/;
export const API_KEY_LAST_USE_MS = 60_000;
export type ApiKeyScope = 'launch' | 'admin';
export interface ApiKeyRecord {
  id: string;
  toolAccountId: string;
  /** Null for a migrated hash: its original prefix is not known. */
  prefix: string | null;
  label: string;
  scopes: ApiKeyScope[];
  createdAt: number;
  createdBy: string;
  expiresAt: number | null;
  lastUsedAt: number | null;
  revokedAt: number | null;
}
interface ApiKeyRow {
  id: string; tool_account_id: string; prefix: string | null; label: string; scopes: string;
  created_at: number; created_by: string; expires_at: number | null; last_used_at: number | null; revoked_at: number | null;
}
const COLUMNS = 'id, tool_account_id, prefix, label, scopes, created_at, created_by, expires_at, last_used_at, revoked_at';
const toRecord = (r: ApiKeyRow): ApiKeyRecord => ({
  id: r.id, toolAccountId: r.tool_account_id, prefix: r.prefix, label: r.label, scopes: JSON.parse(r.scopes) as ApiKeyScope[],
  createdAt: r.created_at, createdBy: r.created_by, expiresAt: r.expires_at, lastUsedAt: r.last_used_at, revokedAt: r.revoked_at,
});

export function requireApiKeyAccount(db: Db, accountId: string): void {
  if (!db.prepare('SELECT id FROM tool_account WHERE id = ?').get(accountId)) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
}

export function listApiKeys(db: Db, accountId: string): ApiKeyRecord[] {
  requireApiKeyAccount(db, accountId);
  return (db.prepare(`SELECT ${COLUMNS} FROM api_key WHERE tool_account_id = ? ORDER BY created_at, id`).all(accountId) as unknown as ApiKeyRow[]).map(toRecord);
}

export function getApiKey(db: Db, accountId: string, id: string): ApiKeyRecord | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM api_key WHERE tool_account_id = ? AND id = ?`).get(accountId, id) as ApiKeyRow | undefined;
  return row ? toRecord(row) : null;
}

/** The latest expiry is the same UTC time two calendar years later. */
export function apiKeyMaxExpiry(now: number): number {
  const date = new Date(now);
  date.setUTCFullYear(date.getUTCFullYear() + 2);
  return date.getTime();
}
export function apiKeyExpiryInRange(expiresAt: number, now: number): boolean {
  return Number.isSafeInteger(expiresAt) && expiresAt >= now + 3600_000 && expiresAt <= apiKeyMaxExpiry(now);
}

export interface IssueApiKeyInput {
  label: string;
  scopes: readonly ApiKeyScope[];
  createdBy: string;
  expiresAt?: number | null;
}

export function validateApiKeyIssue(input: IssueApiKeyInput, now: number): void {
  if (!input.label.trim() || input.label.length > 128) throw new ApiError('INVALID_REQUEST', 'Invalid field: label.');
  if (!input.scopes.length || input.scopes.some((scope) => scope !== 'launch' && scope !== 'admin') || new Set(input.scopes).size !== input.scopes.length) {
    throw new ApiError('INVALID_REQUEST', 'Invalid field: scopes.');
  }
  if (input.expiresAt !== null && input.expiresAt !== undefined && !apiKeyExpiryInRange(input.expiresAt, now)) {
    throw new ApiError('INVALID_REQUEST', 'Invalid field: expiresAt. It must be 1 hour to 2 years from now.');
  }
}

/** A slot is occupied only by a key that is not revoked and not expired. */
export function requireApiKeySlot(db: Db, accountId: string, now: number): void {
  requireApiKeyAccount(db, accountId);
  const count = db.prepare(`SELECT count(*) AS n FROM api_key WHERE tool_account_id = ?
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`).get(accountId, now)!.n as number;
  if (count >= 2) throw new KeyError('API_KEY_LIMIT');
}

export function issueApiKey(db: Db, accountId: string, input: IssueApiKeyInput, now: number): { record: ApiKeyRecord; apiKey: string } {
  validateApiKeyIssue(input, now);
  return transaction(db, () => {
    requireApiKeySlot(db, accountId, now);
    const apiKey = newApiKey();
    const id = randomId('key_');
    const scopes = (['launch', 'admin'] as const).filter((scope) => input.scopes.includes(scope));
    db.prepare(`INSERT INTO api_key (id, tool_account_id, prefix, hash, label, scopes, created_at, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, apiKey.slice(5, 13), sha256Hex(apiKey), input.label,
      JSON.stringify(scopes), now, input.createdBy, input.expiresAt ?? null);
    return { record: getApiKey(db, accountId, id)!, apiKey };
  });
}

// The database row is always read, so a revoke or expiry takes effect on the next call. Cache only the write time.
const lastUse = new WeakMap<Db, Map<string, number>>();

/** Validate and record use. Wrong format, unknown, expired and revoked all return null; auth_failure shares this lookup. */
export function useApiKey(db: Db, apiKey: string, now: number): ApiKeyRecord | null {
  if (!API_KEY.test(apiKey)) return null;
  const row = db.prepare(`SELECT ${COLUMNS} FROM api_key WHERE hash = ? AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > ?)`).get(sha256Hex(apiKey), now) as ApiKeyRow | undefined;
  if (!row) return null;
  let times = lastUse.get(db);
  if (!times) { times = new Map(); lastUse.set(db, times); }
  for (const [id, at] of times) if (now - at >= API_KEY_LAST_USE_MS) times.delete(id);
  const cached = times.get(row.id);
  if (row.last_used_at === null || (cached === undefined && now - row.last_used_at >= API_KEY_LAST_USE_MS)) {
    // The SQL condition also prevents duplicate writes from two service processes.
    const changed = db.prepare(`UPDATE api_key SET last_used_at = ? WHERE id = ?
      AND (last_used_at IS NULL OR last_used_at <= ?)`).run(now, row.id, now - API_KEY_LAST_USE_MS);
    if (changed.changes) row.last_used_at = now;
  }
  times.set(row.id, row.last_used_at ?? now);
  return toRecord(row);
}

/** Unknown or cross-account ids return null. Repeated revoke keeps the first timestamp. */
export function revokeApiKey(db: Db, accountId: string, id: string, now: number): ApiKeyRecord | null {
  requireApiKeyAccount(db, accountId);
  db.prepare('UPDATE api_key SET revoked_at = ? WHERE tool_account_id = ? AND id = ? AND revoked_at IS NULL').run(now, accountId, id);
  return getApiKey(db, accountId, id);
}

/** Called inside the account-close transaction. Revoke expired keys too; keep prior revoke timestamps. */
export function revokeAccountApiKeys(db: Db, accountId: string, now: number): number {
  return Number(db.prepare('UPDATE api_key SET revoked_at = ? WHERE tool_account_id = ? AND revoked_at IS NULL').run(now, accountId).changes);
}

/** The temporary CLI bridge rotates every active key, regardless of label (BD-A2-10). */
export function revokeActiveAccountApiKeys(db: Db, accountId: string, now: number): number {
  return Number(db.prepare(`UPDATE api_key SET revoked_at = ? WHERE tool_account_id = ? AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > ?)`).run(now, accountId, now).changes);
}
