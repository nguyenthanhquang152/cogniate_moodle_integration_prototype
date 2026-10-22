// Service keys (contract §3.3, data-model §1). A key lets the app call AGS / NRPS for one activity without an ltik
// (SERVICE-AUTH-V1), for example for score retries after the ltik expired (ADR-010).
import type { KeyHandle } from '@cogniate/shared';
import { LEGACY_KEY_VERSION, keyProviderFor, sha256Hex } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';

export interface ServiceKeyScope {
  toolAccountId: string;
  platformId: string;
  deploymentId: string;
  contextId: string;
  resourceLinkId: string;
}

export interface ServiceKeyRecord extends ServiceKeyScope {
  /** M1: the deployment binding generation of this key value (LTI contract §9.14); 0 for every old row. */
  bindingGeneration: number;
  /** AGS claim (`https://purl.imsglobal.org/spec/lti-ags/claim/endpoint`) of the latest launch, or null. */
  agsClaim: Record<string, unknown> | null;
  /** NRPS claim of the latest launch, or null. */
  nrpsClaim: Record<string, unknown> | null;
}

/**
 * Derivation version of the keys that this code issues (column `derivation_version`). `legacy` keeps every key value
 * of today (LA-ADR-06 D6). A new derivation version is an incident step only: it changes each activity's key at its
 * next launch.
 */
const DERIVATION_VERSION = LEGACY_KEY_VERSION;

/**
 * The key for one scope: the key provider's `mac('service-key', version, input)`, base64url (43 characters). The same
 * scope always gives the same key; without the key ring nobody can compute it. A new platform id gives a new key.
 * The version `legacy` is today's HMAC-SHA256 with a subkey of LTI_MASTER_KEY, byte for byte.
 * M1 (§9.14): generation 0 keeps today's HMAC input byte for byte; a generation above 0 is part of the input, so
 * each binding of a shared deployment has other key values. LA-E5-15: epoch 0 also keeps that input; only a
 * re-issue after revocation appends an epoch part.
 */
export function deriveServiceKey(keys: KeyHandle, scope: ServiceKeyScope, bindingGeneration = 0, version = DERIVATION_VERSION, issueEpoch = 0): string {
  if (!Number.isSafeInteger(issueEpoch) || issueEpoch < 0) throw new Error('Invalid service key issue epoch');
  const parts = [scope.toolAccountId, scope.platformId, scope.deploymentId, scope.contextId, scope.resourceLinkId];
  if (bindingGeneration > 0) parts.push(`generation=${bindingGeneration}`);
  if (issueEpoch > 0) parts.push(`epoch=${issueEpoch}`);
  const input = parts.map((p) => `${p.length}:${p}`).join('|');
  return Buffer.from(keyProviderFor(keys).macSync('service-key', version, Buffer.from(input, 'utf8'))).toString('base64url');
}

/**
 * Issue (or re-issue) the key of a launch and refresh the stored AGS / NRPS claims (contract §3.3: a later launch of
 * the same activity by any user returns the same key). A revoked row gets a new value at the next launch.
 */
export function issueServiceKey(
  db: Db,
  keys: KeyHandle,
  input: Omit<ServiceKeyRecord, 'bindingGeneration'> & { bindingGeneration?: number },
  now: number,
): { serviceKey: string } {
  const generation = input.bindingGeneration ?? 0;
  const ags = input.agsClaim ? JSON.stringify(input.agsClaim) : null;
  const nrps = input.nrpsClaim ? JSON.stringify(input.nrpsClaim) : null;
  // Read the epoch and replace the hash in one synchronous transaction. A second launch must see the new epoch.
  return transaction(db, () => {
    const existing = db.prepare(`SELECT key_hash, revoked_at, issue_epoch FROM service_key
      WHERE tool_account_id = ? AND platform_id = ? AND deployment_id = ? AND context_id = ? AND resource_link_id = ?`)
      .get(input.toolAccountId, input.platformId, input.deploymentId, input.contextId, input.resourceLinkId) as
      { key_hash: string; revoked_at: number | null; issue_epoch: number } | undefined;
    const epoch = existing ? existing.issue_epoch + (existing.revoked_at === null ? 0 : 1) : 0;
    const serviceKey = deriveServiceKey(keys, input, generation, DERIVATION_VERSION, epoch);
    const hash = sha256Hex(serviceKey);
    if (existing) {
      db.prepare(`UPDATE service_key SET key_hash = ?, binding_generation = ?, derivation_version = ?, issue_epoch = ?,
        revoked_at = NULL, ags_claim = ?, nrps_claim = ?, updated_at = ? WHERE key_hash = ?`)
        .run(hash, generation, DERIVATION_VERSION, epoch, ags, nrps, now, existing.key_hash);
    } else {
      db.prepare(`INSERT INTO service_key (key_hash, tool_account_id, platform_id, deployment_id, context_id, resource_link_id, ags_claim, nrps_claim, created_at, updated_at, binding_generation, derivation_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(hash, input.toolAccountId, input.platformId, input.deploymentId, input.contextId, input.resourceLinkId, ags, nrps, now, now, generation, DERIVATION_VERSION);
    }
    return { serviceKey };
  });
}

/** The key must belong to the account of the API key and must not be revoked (security §8). */
export function findServiceKey(db: Db, accountId: string, serviceKey: string): ServiceKeyRecord | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(serviceKey)) return null;
  const row = db.prepare('SELECT * FROM service_key WHERE key_hash = ? AND tool_account_id = ? AND revoked_at IS NULL').get(sha256Hex(serviceKey), accountId) as
    | { tool_account_id: string; platform_id: string; deployment_id: string; context_id: string; resource_link_id: string; ags_claim: string | null; nrps_claim: string | null; binding_generation: number }
    | undefined;
  if (!row) return null;
  return {
    toolAccountId: row.tool_account_id, platformId: row.platform_id, deploymentId: row.deployment_id, contextId: row.context_id,
    resourceLinkId: row.resource_link_id, bindingGeneration: Number(row.binding_generation),
    agsClaim: row.ags_claim ? (JSON.parse(row.ags_claim) as Record<string, unknown>) : null,
    nrpsClaim: row.nrps_claim ? (JSON.parse(row.nrps_claim) as Record<string, unknown>) : null,
  };
}

/** Key versions that derive the stored service keys (key provider `ready()`): a version leaves the ring only at 0 rows. */
export function serviceKeyVersions(db: Db): string[] {
  return (db.prepare('SELECT DISTINCT derivation_version AS v FROM service_key').all() as Array<{ v: string }>).map((r) => r.v);
}

/** Revoke every key of a platform (T3c: DELETE /api/platforms/:id). */
export function revokeServiceKeys(db: Db, platformId: string, now: number): number {
  return Number(db.prepare('UPDATE service_key SET revoked_at = ? WHERE platform_id = ? AND revoked_at IS NULL').run(now, platformId).changes);
}

export interface ServiceKeyFilter {
  platformId: string;
  deploymentId?: string;
  contextId?: string;
  resourceLinkId?: string;
}

/** Tenant and operator revoke: every optional field narrows the account and platform scope. */
export function revokeScopedServiceKeys(db: Db, accountId: string, filter: ServiceKeyFilter, now: number): number {
  const where = ['tool_account_id = ?', 'platform_id = ?', 'revoked_at IS NULL'];
  const args: Array<string | number> = [now, accountId, filter.platformId];
  for (const [column, value] of [['deployment_id', filter.deploymentId], ['context_id', filter.contextId], ['resource_link_id', filter.resourceLinkId]]) {
    if (value !== undefined) { where.push(`${column} = ?`); args.push(value); }
  }
  return Number(db.prepare(`UPDATE service_key SET revoked_at = ? WHERE ${where.join(' AND ')}`).run(...args).changes);
}
