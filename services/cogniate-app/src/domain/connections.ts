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

export type LmsType = 'moodle' | 'canvas' | 'blackboard';

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
  /** T8: a checked web services token exists (never the token itself). */
  webServices: { siteName: string; release: string } | null;
  /** M1 (app contract §4.2): LMS type, LTI profile and the canonical service origin (= siteUrl unless Canvas sets one). */
  lms: LmsType;
  profile: string;
  serviceUrl: string;
  /** Canvas: the activation ref of the committed binding (history). */
  ltiBindingRef: string | null;
  /** The connection lease (app contract §4.7.1). */
  redeemingAttempt: string | null;
  redeemingSince: number | null;
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
  webServices: r.ws_token_encrypted === null || r.ws_token_encrypted === undefined ? null : { siteName: String(r.ws_site_name ?? ''), release: String(r.ws_release ?? '') },
  lms: (r.lms ?? 'moodle') as LmsType,
  profile: String(r.lti_profile ?? 'standard'),
  serviceUrl: r.service_url === null || r.service_url === undefined ? String(r.site_url) : String(r.service_url),
  ltiBindingRef: r.lti_binding_ref === null || r.lti_binding_ref === undefined ? null : String(r.lti_binding_ref),
  redeemingAttempt: r.redeeming_attempt === null || r.redeeming_attempt === undefined ? null : String(r.redeeming_attempt),
  redeemingSince: r.redeeming_since === null || r.redeeming_since === undefined ? null : Number(r.redeeming_since),
});

export function createConnection(
  db: Db,
  libraryId: string,
  input: { name: string; siteUrl: string; method: ConnectionMethod; lms?: LmsType; profile?: string; serviceUrl?: string | null },
  ref: RefToken | null,
  now: number,
): Connection {
  const id = randomId('con_');
  db.prepare(`INSERT INTO connection (id, library_id, name, site_url, method, status, ref_token_hash, ref_token_encrypted, ref_expires_at, created_at, updated_at,
      lms, lti_profile, service_url)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, libraryId, input.name, input.siteUrl, input.method, ref?.hash ?? null, ref?.encrypted ?? null, ref?.expiresAt ?? null, now, now,
      input.lms ?? 'moodle', input.profile ?? 'standard', input.serviceUrl ?? null);
  return getConnection(db, libraryId, id)!;
}

/** By id in any library: launch routing, the redemption engine and the operator CLIs (never a portal request). */
export function getConnectionAnyLibrary(db: Db, id: string): Connection | undefined {
  const row = db.prepare('SELECT * FROM connection WHERE id = ?').get(id);
  return row ? toConnection(row) : undefined;
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
 * launches (a disabled one does not). Moodle rule only (app contract §6.1 step 2): use routeLaunch.
 */
export function findLaunchConnection(db: Db, platformId: string): Connection | undefined {
  const row = db.prepare("SELECT * FROM connection WHERE lti_platform_id = ? AND lms = 'moodle' AND status IN ('registered', 'connected')").get(platformId);
  return row ? toConnection(row) : undefined;
}

export type LaunchRoute =
  | { ok: true; connection: Connection }
  | { ok: false; reason: 'deployment_not_approved' | 'unknown_platform' };

/**
 * Launch routing (app contract §6.1): (1) an approval of (platform, deployment) whose Canvas or Blackboard connection
 * is registered or connected; (2) a Moodle connection whose lti_platform_id is the platform. If (1) finds nothing but a
 * Canvas or Blackboard connection owns the platform or holds a reservation for the deployment: deployment_not_approved.
 * An approval is the only source of Canvas and Blackboard launch and grade authority.
 */
export function routeLaunch(db: Db, platformId: string, deploymentId: string): LaunchRoute {
  const approved = db.prepare(`SELECT c.* FROM approved_deployment a JOIN connection c ON c.id = a.connection_id
    WHERE a.lti_platform_id = ? AND a.deployment_id = ? AND c.lms IN ('canvas', 'blackboard') AND c.status IN ('registered', 'connected')`).get(platformId, deploymentId);
  if (approved) return { ok: true, connection: toConnection(approved) };
  const moodle = findLaunchConnection(db, platformId);
  if (moodle) return { ok: true, connection: moodle };
  const owner = db.prepare("SELECT 1 FROM connection WHERE lti_platform_id = ? AND lms IN ('canvas', 'blackboard')").get(platformId)
    ?? db.prepare('SELECT 1 FROM connection_deployment WHERE lti_platform_id = ? AND deployment_id = ?').get(platformId, deploymentId);
  return { ok: false, reason: owner ? 'deployment_not_approved' : 'unknown_platform' };
}

/** Data-model §3: the first valid launch from the platform sets `connected`; every launch sets lastLaunchAt. */
export function markLaunched(db: Db, connectionId: string, now: number): void {
  db.prepare(`UPDATE connection SET status = 'connected', last_launch_at = ?, updated_at = CASE WHEN status = 'connected' THEN updated_at ELSE ? END
    WHERE id = ? AND status IN ('registered', 'connected')`).run(now, now, connectionId);
}

/** The connection that owns a platform as lti_platform_id (any library), or undefined: security §2.6 orphan rule. */
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

// ---------------------------------------------------------------- T8: web services token (course shell)

/** Store the checked web services token (encrypted) and what Moodle told about itself. */
export function setWebServices(db: Db, libraryId: string, id: string, ws: { tokenEncrypted: Uint8Array; siteName: string; release: string }, now: number): void {
  db.prepare('UPDATE connection SET ws_token_encrypted = ?, ws_site_name = ?, ws_release = ?, updated_at = ? WHERE id = ? AND library_id = ?')
    .run(ws.tokenEncrypted, ws.siteName, ws.release, now, id, libraryId);
}

/** The web services token of a connection (encrypted), or null when none was saved. */
export function webServicesOf(db: Db, libraryId: string, id: string): { tokenEncrypted: Uint8Array; siteName: string; release: string } | null {
  const r = db.prepare('SELECT ws_token_encrypted, ws_site_name, ws_release FROM connection WHERE id = ? AND library_id = ?').get(id, libraryId);
  if (!r || r.ws_token_encrypted === null) return null;
  return { tokenEncrypted: r.ws_token_encrypted as Uint8Array, siteName: String(r.ws_site_name ?? ''), release: String(r.ws_release ?? '') };
}
