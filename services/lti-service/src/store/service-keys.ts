// Service keys (contract §3.3, data-model §1). A key lets the app call AGS / NRPS for one activity without an ltik
// (SERVICE-AUTH-V1), for example for score retries after the ltik expired (ADR-010).
import { createHmac } from 'node:crypto';
import { sha256Hex } from '@cogniate/shared';
import type { Db } from '../db/index.ts';

export interface ServiceKeyScope {
  toolAccountId: string;
  platformId: string;
  deploymentId: string;
  contextId: string;
  resourceLinkId: string;
}

export interface ServiceKeyRecord extends ServiceKeyScope {
  /** AGS claim (`https://purl.imsglobal.org/spec/lti-ags/claim/endpoint`) of the latest launch, or null. */
  agsClaim: Record<string, unknown> | null;
  /** NRPS claim of the latest launch, or null. */
  nrpsClaim: Record<string, unknown> | null;
}

const SUBKEY_LABEL = 'cogniate-lti/service-key/v1';

/**
 * The key for one scope: HMAC-SHA256 with a subkey of the master key, base64url (43 characters). The same scope
 * always gives the same key; without the master key nobody can compute it. A new platform id gives a new key.
 */
export function deriveServiceKey(masterKey: Buffer, scope: ServiceKeyScope): string {
  const subkey = createHmac('sha256', masterKey).update(SUBKEY_LABEL).digest();
  const input = [scope.toolAccountId, scope.platformId, scope.deploymentId, scope.contextId, scope.resourceLinkId].map((p) => `${p.length}:${p}`).join('|');
  return createHmac('sha256', subkey).update(input).digest('base64url');
}

/**
 * Issue (or re-issue) the key of a launch and refresh the stored AGS / NRPS claims (contract §3.3: a later launch of
 * the same activity by any user returns the same key). A revoked key is not re-activated.
 */
export function issueServiceKey(
  db: Db,
  masterKey: Buffer,
  input: ServiceKeyRecord,
  now: number,
): { serviceKey: string } | { revoked: true } {
  const serviceKey = deriveServiceKey(masterKey, input);
  const hash = sha256Hex(serviceKey);
  const existing = db.prepare('SELECT revoked_at FROM service_key WHERE key_hash = ?').get(hash) as { revoked_at: number | null } | undefined;
  if (existing?.revoked_at) return { revoked: true };
  const ags = input.agsClaim ? JSON.stringify(input.agsClaim) : null;
  const nrps = input.nrpsClaim ? JSON.stringify(input.nrpsClaim) : null;
  if (existing) {
    db.prepare('UPDATE service_key SET ags_claim = ?, nrps_claim = ?, updated_at = ? WHERE key_hash = ?').run(ags, nrps, now, hash);
  } else {
    db.prepare(`INSERT INTO service_key (key_hash, tool_account_id, platform_id, deployment_id, context_id, resource_link_id, ags_claim, nrps_claim, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(hash, input.toolAccountId, input.platformId, input.deploymentId, input.contextId, input.resourceLinkId, ags, nrps, now, now);
  }
  return { serviceKey };
}

/** The key must belong to the account of the API key and must not be revoked (security §8). */
export function findServiceKey(db: Db, accountId: string, serviceKey: string): ServiceKeyRecord | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(serviceKey)) return null;
  const row = db.prepare('SELECT * FROM service_key WHERE key_hash = ? AND tool_account_id = ? AND revoked_at IS NULL').get(sha256Hex(serviceKey), accountId) as
    | { tool_account_id: string; platform_id: string; deployment_id: string; context_id: string; resource_link_id: string; ags_claim: string | null; nrps_claim: string | null }
    | undefined;
  if (!row) return null;
  return {
    toolAccountId: row.tool_account_id, platformId: row.platform_id, deploymentId: row.deployment_id, contextId: row.context_id,
    resourceLinkId: row.resource_link_id,
    agsClaim: row.ags_claim ? (JSON.parse(row.ags_claim) as Record<string, unknown>) : null,
    nrpsClaim: row.nrps_claim ? (JSON.parse(row.nrps_claim) as Record<string, unknown>) : null,
  };
}

/** Revoke every key of a platform (T3c: DELETE /api/platforms/:id). */
export function revokeServiceKeys(db: Db, platformId: string, now: number): number {
  return Number(db.prepare('UPDATE service_key SET revoked_at = ? WHERE platform_id = ? AND revoked_at IS NULL').run(now, platformId).changes);
}
