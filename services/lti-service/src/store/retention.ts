// Retention cleanup of the LTI service (data-model §2.1, A-T4b2-02):
//   oidc_state            expires_at is past (10 min life)
//   launch                the ltik expired more than 24 h ago
//   registration_session  older than 24 h
// Platforms and service keys are never deleted here (service keys keep their own copy of the launch claims).
import type { RetentionResult } from '@cogniate/shared';
import type { Db } from '../db/index.ts';

export const DAY_MS = 86_400_000;

export function cleanupExpired(db: Db, now: number): RetentionResult[] {
  const run = (table: string, sql: string, at: number): RetentionResult => ({ table, deleted: Number(db.prepare(sql).run(at).changes) });
  return [
    run('oidc_state', 'DELETE FROM oidc_state WHERE expires_at < ?', now),
    run('launch', 'DELETE FROM launch WHERE expires_at < ?', now - DAY_MS),
    run('registration_session', 'DELETE FROM registration_session WHERE created_at < ?', now - DAY_MS),
  ];
}
