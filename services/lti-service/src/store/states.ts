import type { Db } from '../db/index.ts';

export const STATE_TTL_MS = 10 * 60 * 1000;

export interface StateRecord {
  stateHash: string;
  toolAccountId: string;
  platformId: string;
  nonce: string;
  targetLinkUri: string;
  expiresAt: number;
  /** M1: the `lti_deployment_id` of the login request, for check 9 (null when the login had none). */
  loginDeploymentId: string | null;
}

export function saveState(db: Db, rec: StateRecord, now: number): void {
  db.prepare(`INSERT INTO oidc_state (state_hash, tool_account_id, platform_id, nonce, target_link_uri, expires_at, login_deployment_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)`).run(rec.stateHash, rec.toolAccountId, rec.platformId, rec.nonce, rec.targetLinkUri, rec.expiresAt, rec.loginDeploymentId);
  // Retention (contract §6): states live 10 min; old rows are removed on the way.
  db.prepare('DELETE FROM oidc_state WHERE expires_at < ?').run(now - 3600_000);
}

/**
 * Checks 1 and 3 in ONE statement (T2a design note): the state must exist for this account, be unused and not
 * expired; it is marked used in the same statement, so a parallel second POST cannot use it again.
 * Returns null when check 1 fails.
 */
export function consumeState(db: Db, accountId: string, stateHash: string, now: number): StateRecord | null {
  const row = db.prepare(`UPDATE oidc_state SET used_at = ?
                          WHERE state_hash = ? AND tool_account_id = ? AND used_at IS NULL AND expires_at > ?
                          RETURNING state_hash, tool_account_id, platform_id, nonce, target_link_uri, expires_at, login_deployment_id`)
    .get(now, stateHash, accountId, now) as
    | { state_hash: string; tool_account_id: string; platform_id: string; nonce: string; target_link_uri: string; expires_at: number; login_deployment_id: string | null }
    | undefined;
  if (!row) return null;
  return { stateHash: row.state_hash, toolAccountId: row.tool_account_id, platformId: row.platform_id, nonce: row.nonce,
    targetLinkUri: row.target_link_uri, expiresAt: row.expires_at, loginDeploymentId: row.login_deployment_id };
}
