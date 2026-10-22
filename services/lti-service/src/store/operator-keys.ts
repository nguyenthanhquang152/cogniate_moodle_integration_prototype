// Operator keys of the operator listener (LA-ADR-06 D3, contract delta §1.2, §3). One key per person. A key is shown
// once; only its SHA-256 hash is stored. The tenant API key grammar (ltis_) and this grammar (ltio_) never share a
// lookup: findActiveOperatorKey accepts only ltio_ keys, findAccountByApiKey only ltis_ keys.
import { randomId, randomToken, sha256Hex } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { insertAuditEvent } from './audit.ts';

/** Key format: "ltio_" + 43 base64url characters. */
export const OPERATOR_KEY = /^ltio_[A-Za-z0-9_-]{43}$/;
/** Operator name: the audit actor is operator:<name>. Letters, digits and . _ @ - (1 to 64 characters). */
export const OPERATOR_NAME = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,63}$/;

const HOUR_MS = 3600 * 1000;
export const OPERATOR_KEY_DEFAULT_TTL_MS = 90 * 24 * HOUR_MS;

/** The latest allowed expiry: the same time one calendar year later (UTC). */
export function operatorKeyMaxExpiry(now: number): number {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.getTime();
}

/** expiresAt must be 1 hour to 1 year from now (contract delta §3). */
export function operatorKeyExpiryInRange(expiresAt: number, now: number): boolean {
  return expiresAt >= now + HOUR_MS && expiresAt <= operatorKeyMaxExpiry(now);
}

export interface OperatorKeyRecord {
  id: string;
  operator: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

interface OperatorKeyRow {
  id: string; operator: string; created_at: number; expires_at: number; last_used_at: number | null; revoked_at: number | null;
}

// The hash never leaves this module.
const COLUMNS = 'id, operator, created_at, expires_at, last_used_at, revoked_at';

const toRecord = (r: OperatorKeyRow): OperatorKeyRecord => ({
  id: r.id, operator: r.operator, createdAt: r.created_at, expiresAt: r.expires_at, lastUsedAt: r.last_used_at, revokedAt: r.revoked_at,
});

/** Active = not revoked and not expired. */
export function isActiveOperatorKey(key: OperatorKeyRecord, now: number): boolean {
  return key.revokedAt === null && now < key.expiresAt;
}

export function listOperatorKeys(db: Db): OperatorKeyRecord[] {
  return (db.prepare(`SELECT ${COLUMNS} FROM operator_key ORDER BY created_at, id`).all() as unknown as OperatorKeyRow[]).map(toRecord);
}

export function getOperatorKey(db: Db, id: string): OperatorKeyRecord | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM operator_key WHERE id = ?`).get(id) as OperatorKeyRow | undefined;
  return row ? toRecord(row) : null;
}

/** Make a key. The caller checks the name and the expiry range. Returns the key once. */
export function issueOperatorKey(db: Db, input: { operator: string; expiresAt: number }, now: number): { record: OperatorKeyRecord; operatorKey: string } {
  const operatorKey = `ltio_${randomToken()}`;
  const id = randomId('opk_');
  db.prepare('INSERT INTO operator_key (id, operator, key_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, input.operator, sha256Hex(operatorKey), now, input.expiresAt);
  return { record: getOperatorKey(db, id)!, operatorKey };
}

/**
 * The active key record of a presented key, or null (wrong format, unknown, revoked or expired: the caller gives the
 * same 401 for each). An accepted key gets last_used_at = now.
 */
export function findActiveOperatorKey(db: Db, operatorKey: string, now: number): OperatorKeyRecord | null {
  if (!OPERATOR_KEY.test(operatorKey)) return null;
  const row = db.prepare(`SELECT ${COLUMNS} FROM operator_key WHERE key_hash = ?`).get(sha256Hex(operatorKey)) as OperatorKeyRow | undefined;
  if (!row || !isActiveOperatorKey(toRecord(row), now)) return null;
  db.prepare('UPDATE operator_key SET last_used_at = ? WHERE id = ?').run(now, row.id);
  return { ...toRecord(row), lastUsedAt: now };
}

/** Revoke one key. A revoked key keeps its first revoked_at. Null: unknown id. */
export function revokeOperatorKey(db: Db, id: string, now: number): OperatorKeyRecord | null {
  db.prepare('UPDATE operator_key SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(now, id);
  return getOperatorKey(db, id);
}

export type InitMode = 'refuse' | 'if-none' | 'replace';

export type InitResult =
  | { result: 'issued'; record: OperatorKeyRecord; operatorKey: string; revoked: number }
  | { result: 'exists' };

/**
 * `lti:operator init` (LA-ADR-06 D3 "Trust bootstrap"): the only direct database write of an operator key. One
 * transaction. When an active key exists: `refuse` and `if-none` change nothing and return `exists`; `replace`
 * revokes every key that is not revoked, then makes the new key. The new key expires after 90 days. A new key writes
 * one audit event `operator_key.issue` with actor system:bootstrap (contract delta §5), in the same transaction.
 */
export function initOperatorKey(db: Db, input: { operator: string; mode: InitMode }, now: number): InitResult {
  if (!OPERATOR_NAME.test(input.operator)) throw new Error(`invalid operator name: ${input.operator}`);
  return transaction(db, () => {
    let revoked = 0;
    if (input.mode === 'replace') {
      revoked = Number(db.prepare('UPDATE operator_key SET revoked_at = ? WHERE revoked_at IS NULL').run(now).changes);
    } else if (hasActiveOperatorKey(db, now)) {
      return { result: 'exists' } as const;
    }
    const issued = issueOperatorKey(db, { operator: input.operator, expiresAt: now + OPERATOR_KEY_DEFAULT_TTL_MS }, now);
    insertAuditEvent(db, {
      actor: { type: 'system', id: 'bootstrap' }, toolAccountId: null, traceId: null, clientIp: null, action: 'operator_key.issue',
      target: { type: 'operator_key', id: issued.record.id }, result: 'ok', details: { operator: input.operator, replaced: input.mode === 'replace', revoked },
    }, now);
    return { result: 'issued', revoked, ...issued } as const;
  });
}

export function hasActiveOperatorKey(db: Db, now: number): boolean {
  return db.prepare('SELECT 1 FROM operator_key WHERE revoked_at IS NULL AND expires_at > ? LIMIT 1').get(now) !== undefined;
}
