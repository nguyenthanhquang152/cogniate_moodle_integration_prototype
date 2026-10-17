// Connections (app contract §4, data-model §2): one Moodle site per connection, per library. Repository: the only SQL
// for this table. Every lookup takes the library id, except the ref lookup of the register page (the ref is the
// capability; security §6).
import { randomId } from '@cogniate/shared';
import type { Db } from './db.ts';

export type ConnectionMethod = 'dynamic' | 'manual';
export type ConnectionStatus = 'pending' | 'registered' | 'connected' | 'disabled';

export interface PlatformInfo {
  id: string;
  issuer: string;
  clientId: string;
  deploymentIds: string[];
  productFamilyCode: string | null;
}

/** The last failed connect attempt of a pending connection (B-T4b1-01). Codes only. */
export interface ConnectError {
  code: string;
  ltiCode: string | null;
  traceId: string;
  at: number;
}

export interface Connection {
  id: string;
  libraryId: string;
  name: string;
  siteUrl: string;
  method: ConnectionMethod;
  status: ConnectionStatus;
  ltiPlatformId: string | null;
  platform: PlatformInfo | null;
  refTokenHash: string | null;
  refTokenEncrypted: Uint8Array | null;
  refExpiresAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastLaunchAt: number | null;
  lastError: ConnectError | null;
}

export interface RefToken {
  hash: string;
  encrypted: Uint8Array;
  expiresAt: number;
}

/** The connection already has a platform, or the platform belongs to another connection (unique key). */
export class PlatformTakenError extends Error {}

const toConnection = (r: Record<string, unknown>): Connection => ({
  id: String(r.id), libraryId: String(r.library_id), name: String(r.name), siteUrl: String(r.site_url), method: r.method as ConnectionMethod,
  status: r.status as ConnectionStatus, ltiPlatformId: r.lti_platform_id === null ? null : String(r.lti_platform_id),
  platform: r.platform_json === null ? null : (JSON.parse(String(r.platform_json)) as PlatformInfo),
  refTokenHash: r.ref_token_hash === null ? null : String(r.ref_token_hash),
  refTokenEncrypted: r.ref_token_encrypted === null ? null : (r.ref_token_encrypted as Uint8Array),
  refExpiresAt: r.ref_expires_at === null ? null : Number(r.ref_expires_at), createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
  lastLaunchAt: r.last_launch_at === null ? null : Number(r.last_launch_at),
  lastError: r.last_error_code === null || r.last_error_code === undefined ? null : {
    code: String(r.last_error_code), ltiCode: r.last_error_lti_code === null ? null : String(r.last_error_lti_code),
    traceId: String(r.last_error_trace_id), at: Number(r.last_error_at),
  },
});

export function createConnection(
  db: Db,
  libraryId: string,
  input: { name: string; siteUrl: string; method: ConnectionMethod },
  ref: RefToken | null,
  now: number,
): Connection {
  const id = randomId('con_');
  db.prepare(`INSERT INTO connection (id, library_id, name, site_url, method, status, ref_token_hash, ref_token_encrypted, ref_expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`)
    .run(id, libraryId, input.name, input.siteUrl, input.method, ref?.hash ?? null, ref?.encrypted ?? null, ref?.expiresAt ?? null, now, now);
  return getConnection(db, libraryId, id)!;
}

/** Newest first. */
export function listConnections(db: Db, libraryId: string): Connection[] {
  return db.prepare('SELECT * FROM connection WHERE library_id = ? ORDER BY created_at DESC, id').all(libraryId).map(toConnection);
}

export function getConnection(db: Db, libraryId: string, id: string): Connection | undefined {
  const row = db.prepare('SELECT * FROM connection WHERE id = ? AND library_id = ?').get(id, libraryId);
  return row ? toConnection(row) : undefined;
}

/** The register page: the connection of a ref hash (any library), with its library name. */
export function findByRefHash(db: Db, refHash: string): (Connection & { libraryName: string }) | undefined {
  const row = db.prepare('SELECT c.*, l.name AS library_name FROM connection c JOIN library l ON l.id = c.library_id WHERE c.ref_token_hash = ?').get(refHash);
  return row ? { ...toConnection(row), libraryName: String(row.library_name) } : undefined;
}

/** A new registration URL (the old ref stops working). Only for a pending connection. */
export function replaceRef(db: Db, libraryId: string, id: string, ref: RefToken, now: number): boolean {
  return Number(db.prepare(`UPDATE connection SET ref_token_hash = ?, ref_token_encrypted = ?, ref_expires_at = ?, updated_at = ?
    WHERE id = ? AND library_id = ? AND status = 'pending'`).run(ref.hash, ref.encrypted, ref.expiresAt, now, id, libraryId).changes) === 1;
}

/**
 * Registration done (dynamic or manual): store the platform, set `registered`, use up the ref. A platform that another
 * connection holds, or a connection that is not pending, gives PlatformTakenError.
 */
export function markRegistered(db: Db, connectionId: string, platform: PlatformInfo, now: number): void {
  const other = db.prepare('SELECT id FROM connection WHERE lti_platform_id = ? AND id <> ?').get(platform.id, connectionId);
  if (other) throw new PlatformTakenError('platform belongs to another connection');
  const changed = db.prepare(`UPDATE connection SET status = 'registered', lti_platform_id = ?, platform_json = ?, ref_token_hash = NULL,
    ref_token_encrypted = NULL, ref_expires_at = NULL, last_error_code = NULL, last_error_lti_code = NULL, last_error_trace_id = NULL,
    last_error_at = NULL, updated_at = ? WHERE id = ? AND status = 'pending'`)
    .run(platform.id, JSON.stringify(platform), now, connectionId).changes;
  if (Number(changed) !== 1) throw new PlatformTakenError('connection is not pending');
}

/**
 * Security §8: at launch, platform.id -> connection -> library. Only a registered or connected connection takes
 * launches (a disabled one does not).
 */
export function findLaunchConnection(db: Db, platformId: string): Connection | undefined {
  const row = db.prepare("SELECT * FROM connection WHERE lti_platform_id = ? AND status IN ('registered', 'connected')").get(platformId);
  return row ? toConnection(row) : undefined;
}

/** Data-model §3: the first valid launch from the platform sets `connected`; every launch sets lastLaunchAt. */
export function markLaunched(db: Db, connectionId: string, now: number): void {
  db.prepare(`UPDATE connection SET status = 'connected', last_launch_at = ?, updated_at = CASE WHEN status = 'connected' THEN updated_at ELSE ? END
    WHERE id = ? AND status IN ('registered', 'connected')`).run(now, now, connectionId);
}

/** The connection that owns a platform (any library), or undefined: security §2.6 orphan rule. */
export function platformOwner(db: Db, platformId: string): string | undefined {
  const row = db.prepare('SELECT id FROM connection WHERE lti_platform_id = ?').get(platformId);
  return row ? String(row.id) : undefined;
}

/** Store the last failed connect attempt (B-T4b1-01). Only a pending connection changes. */
export function recordConnectError(db: Db, connectionId: string, error: ConnectError): void {
  db.prepare(`UPDATE connection SET last_error_code = ?, last_error_lti_code = ?, last_error_trace_id = ?, last_error_at = ?
    WHERE id = ? AND status = 'pending'`).run(error.code, error.ltiCode, error.traceId, error.at, connectionId);
}

export function disableConnection(db: Db, libraryId: string, id: string, now: number): void {
  db.prepare(`UPDATE connection SET status = 'disabled', ref_token_hash = NULL, ref_token_encrypted = NULL, ref_expires_at = NULL, updated_at = ?
    WHERE id = ? AND library_id = ?`).run(now, id, libraryId);
}
