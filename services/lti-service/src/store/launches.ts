import { randomBytes } from 'node:crypto';
import type { Db } from '../db/index.ts';
import { randomToken, sha256Hex } from '@cogniate/shared';

export interface LaunchRecord {
  id: string;
  toolAccountId: string;
  platformId: string;
  deploymentId: string;
  messageType: string;
  claims: Record<string, unknown>;
  expiresAt: number;
  /** M1: site origin of the launch deployment (null in rows from before M1: the issuer origin). */
  siteOrigin: string | null;
  /** M1: service origin of the launch deployment (null: the site origin). */
  serviceOrigin: string | null;
  /** M1: deployment binding generation at launch time (LTI contract §9.14). */
  bindingGeneration: number;
}

const KEEP_AFTER_EXPIRY_MS = 24 * 3600 * 1000;

type NewLaunch = Omit<LaunchRecord, 'id' | 'expiresAt' | 'siteOrigin' | 'serviceOrigin' | 'bindingGeneration'>
  & Partial<Pick<LaunchRecord, 'siteOrigin' | 'serviceOrigin' | 'bindingGeneration'>>;

/** Store a validated launch and return its new ltik (only the hash is stored). */
export function createLaunch(db: Db, input: NewLaunch, ttlSeconds: number, now: number): { launch: LaunchRecord; ltik: string } {
  const ltik = randomToken();
  const launch: LaunchRecord = {
    ...input, siteOrigin: input.siteOrigin ?? null, serviceOrigin: input.serviceOrigin ?? null, bindingGeneration: input.bindingGeneration ?? 0,
    id: `lch_${randomBytes(12).toString('base64url')}`, expiresAt: now + ttlSeconds * 1000,
  };
  db.prepare(`INSERT INTO launch (id, tool_account_id, platform_id, deployment_id, message_type, claims, ltik_hash, expires_at, created_at,
              site_origin, service_origin, binding_generation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(launch.id, launch.toolAccountId, launch.platformId, launch.deploymentId, launch.messageType, JSON.stringify(launch.claims),
      sha256Hex(ltik), launch.expiresAt, now, launch.siteOrigin, launch.serviceOrigin, launch.bindingGeneration);
  // Retention (contract §6): a launch is kept 24 h after its ltik expires.
  db.prepare('DELETE FROM launch WHERE expires_at < ?').run(now - KEEP_AFTER_EXPIRY_MS);
  return { launch, ltik };
}

/** The ltik must belong to the account of the API key and must not be expired. */
export function findLaunchByLtik(db: Db, accountId: string, ltik: string, now: number): LaunchRecord | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ltik)) return null;
  const row = db.prepare('SELECT * FROM launch WHERE ltik_hash = ? AND tool_account_id = ? AND expires_at > ?').get(sha256Hex(ltik), accountId, now) as
    | { id: string; tool_account_id: string; platform_id: string; deployment_id: string; message_type: string; claims: string; expires_at: number;
      site_origin: string | null; service_origin: string | null; binding_generation: number }
    | undefined;
  if (!row) return null;
  return { id: row.id, toolAccountId: row.tool_account_id, platformId: row.platform_id, deploymentId: row.deployment_id,
    messageType: row.message_type, claims: JSON.parse(row.claims) as Record<string, unknown>, expiresAt: row.expires_at,
    siteOrigin: row.site_origin, serviceOrigin: row.service_origin, bindingGeneration: Number(row.binding_generation) };
}
