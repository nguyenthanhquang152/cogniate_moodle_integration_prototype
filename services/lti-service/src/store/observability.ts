// Read-only operational queries of the SQLite adapter.
import type { Db } from '../db/index.ts';

export function ping(db: Db) {
  return db.prepare('SELECT 1').get();
}

export function appliedMigrations(db: Db) {
  return db.prepare('SELECT name, sha256 FROM schema_migration').all();
}

export function accountExists(db: Db, value: string) {
  return db.prepare('SELECT id FROM tool_account WHERE id = ?').get(value);
}

export function platformExists(db: Db, value: string) {
  return db.prepare('SELECT id FROM platform WHERE id = ?').get(value);
}

export function signingKeyAges(db: Db) {
  return db.prepare(`SELECT tool_account_id, status, MIN(created_at) AS created_at
        FROM tool_key WHERE status != 'removed' GROUP BY tool_account_id, status`).all();
}

export function apiKeyExpiries(db: Db) {
  return db.prepare(`SELECT tool_account_id, MIN(expires_at) AS expires_at FROM api_key
        WHERE revoked_at IS NULL AND expires_at IS NOT NULL GROUP BY tool_account_id`).all();
}

export function operatorKeyExpiry(db: Db) {
  return db.prepare('SELECT MIN(expires_at) AS expires_at FROM operator_key WHERE revoked_at IS NULL AND expires_at IS NOT NULL').get();
}

export function activePlatformJwks(db: Db) {
  return db.prepare('SELECT id, jwks_url FROM platform WHERE active = 1 ORDER BY id').all();
}
