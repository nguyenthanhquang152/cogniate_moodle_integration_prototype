// Connections (app contract §4, data-model §2): one Moodle site per connection, per library. Repository: the only SQL
// for this table. Every lookup takes the library id, except the ref lookup of the register page (the ref is the
// capability; security §6).
import { connectionBehaviourClass } from '@cogniate/channel-kernel';
import type { BindingAuthority, ChannelRegistry, PlatformSharing } from '@cogniate/channel-kernel';
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
  /** T8: a checked web services token exists (never the token itself). */
  webServices: { siteName: string; release: string } | null;
  /** The channel id, which never changes. */
  channel: string;
  /** How binding is approved: the LMS administrator (self) or an operator approval code (operatorGrant). */
  bindingAuthority: BindingAuthority;
  profile: string;
  serviceUrl: string;
  /** Canvas: the activation ref of the committed binding (history). */
  ltiBindingRef: string | null;
  /** The connection lease (app contract §4.7.1). */
  redeemingAttempt: string | null;
  redeemingSince: number | null;
  /** M1 B-M1-03 (migration 012): the provider snapshot, written once at create; never in the DTO. */
  snapshot: ProviderSnapshot;
}

/**
 * The provider snapshot of a Canvas or Blackboard connection (data model §4.3, app contract §4.7.3): written once by
 * POST /app-api/connections from its one GET /api/providers answer. All null for Moodle and for a row of an 011 build.
 */
export interface ProviderSnapshot {
  /** Canonical issuer of the provider target (Canvas profile issuer or canonical site; Blackboard shared issuer). */
  issuer: string | null;
  /** Blackboard: the shared platform id at create. */
  platformId: string | null;
  /** Blackboard: the shared client id at create. */
  clientId: string | null;
}

/** A complete snapshot: Canvas `issuer`; Blackboard all three fields. */
export interface CompleteSnapshot {
  issuer: string;
  platformId: string | null;
  clientId: string | null;
}

/** App contract §4.7.3: the complete snapshot of a Canvas or Blackboard connection, else null (a partial row counts as missing). */
export function completeSnapshot(c: Pick<Connection, 'snapshot'>, sharing: PlatformSharing): CompleteSnapshot | null {
  const { issuer, platformId, clientId } = c.snapshot;
  if (sharing === 'exclusive') return issuer !== null ? { issuer, platformId: null, clientId: null } : null;
  return issuer !== null && platformId !== null && clientId !== null ? { issuer, platformId, clientId } : null;
}

const NO_SNAPSHOT: ProviderSnapshot = { issuer: null, platformId: null, clientId: null };

export interface RefToken {
  hash: string;
  encrypted: Uint8Array;
  expiresAt: number;
}

/** The connection already has a platform, or the platform belongs to another connection (unique key). */
export class PlatformTakenError extends Error {}

// Never read connection.lms; it is a frozen behaviour class (LA-ADR-04 D4).
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
  channel: String(r.channel), bindingAuthority: r.binding_authority as BindingAuthority,
  profile: String(r.lti_profile ?? 'standard'),
  serviceUrl: r.service_url === null || r.service_url === undefined ? String(r.site_url) : String(r.service_url),
  ltiBindingRef: r.lti_binding_ref === null || r.lti_binding_ref === undefined ? null : String(r.lti_binding_ref),
  redeemingAttempt: r.redeeming_attempt === null || r.redeeming_attempt === undefined ? null : String(r.redeeming_attempt),
  redeemingSince: r.redeeming_since === null || r.redeeming_since === undefined ? null : Number(r.redeeming_since),
  snapshot: {
    issuer: r.target_issuer === null || r.target_issuer === undefined ? null : String(r.target_issuer),
    platformId: r.target_platform_id === null || r.target_platform_id === undefined ? null : String(r.target_platform_id),
    clientId: r.target_client_id === null || r.target_client_id === undefined ? null : String(r.target_client_id),
  },
});

export function createConnection(
  db: Db,
  libraryId: string,
  input: { name: string; siteUrl: string; method: ConnectionMethod; channel: string; profile?: string; serviceUrl?: string | null; snapshot?: ProviderSnapshot },
  ref: RefToken | null,
  now: number,
  channels: ChannelRegistry,
  sharingOf: (profile: string) => PlatformSharing | null,
): Connection {
  const registration = channels.channel(input.channel)?.registration.find((r) => r.method === input.method);
  if (!registration) throw new Error(`createConnection: channel "${input.channel}" offers no method "${input.method}"`);
  const profile = input.profile ?? registration.defaultProfile;
  if (!registration.profiles.includes(profile)) throw new Error(`createConnection: channel "${input.channel}" method "${input.method}" offers no profile "${profile}"`);
  const sharing = sharingOf(profile);
  if (!sharing) throw new Error(`createConnection: channel "${input.channel}" has no sharing data for profile "${profile}"`);
  const id = randomId('con_');
  // The snapshot is part of this one INSERT (written once; no UPDATE path exists, app contract §4.7.3).
  const snap = input.snapshot ?? NO_SNAPSHOT;
  const legacyClass = connectionBehaviourClass(input.channel, registration.authority, sharing);
  db.prepare(`INSERT INTO connection (id, library_id, name, site_url, method, status, ref_token_hash, ref_token_encrypted, ref_expires_at, created_at, updated_at,
      lms, channel, binding_authority, lti_profile, service_url, target_issuer, target_platform_id, target_client_id)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, libraryId, input.name, input.siteUrl, input.method, ref?.hash ?? null, ref?.encrypted ?? null, ref?.expiresAt ?? null, now, now,
      legacyClass, input.channel, registration.authority, profile, input.serviceUrl ?? null, snap.issuer, snap.platformId, snap.clientId);
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
 * A staged Dynamic Registration (LA-ADR-02 D5 item 10; A1 BD-A1-90): the configuration broke I-SELF, so the LTI service
 * made the platform inactive. In ONE statement: the authority changes once from `self` to `operatorGrant`, the frozen
 * `lms` takes the behaviour class of that authority (LA-ADR-04 D4 rules 1, 2, 5), and the connection keeps the staged
 * platform (platform_json, target_issuer) for the grant; the registration link stops working. The connection stays
 * pending. False when the guard (pending, self) does not hold; then nothing changes.
 */
export function stageRegistration(db: Db, connectionId: string, channel: string, platform: PlatformInfo, now: number): boolean {
  const changed = db.prepare(`UPDATE connection SET binding_authority = 'operatorGrant', lms = ?, platform_json = ?, target_issuer = ?, ref_token_hash = NULL,
    ref_token_encrypted = NULL, ref_expires_at = NULL, last_error_code = NULL, last_error_lti_code = NULL, last_error_trace_id = NULL, last_error_at = NULL,
    updated_at = ? WHERE id = ? AND status = 'pending' AND binding_authority = 'self'`)
    .run(connectionBehaviourClass(channel, 'operatorGrant', 'exclusive'), JSON.stringify(platform), platform.issuer, now, connectionId).changes;
  return Number(changed) === 1;
}

/**
 * Security §8: at launch, platform.id -> connection -> library. Only a registered or connected connection takes
 * launches (a disabled one does not). Moodle rule only (app contract §6.1 step 2): use routeLaunch.
 */
export function findLaunchConnection(db: Db, platformId: string): Connection | undefined {
  const row = db.prepare("SELECT * FROM connection WHERE lti_platform_id = ? AND binding_authority = 'self' AND status IN ('registered', 'connected')").get(platformId);
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
    WHERE a.lti_platform_id = ? AND a.deployment_id = ? AND c.binding_authority = 'operatorGrant' AND c.status IN ('registered', 'connected')`).get(platformId, deploymentId);
  if (approved) return { ok: true, connection: toConnection(approved) };
  const self = findLaunchConnection(db, platformId);
  if (self) return { ok: true, connection: self };
  const owner = db.prepare("SELECT 1 FROM connection WHERE lti_platform_id = ? AND binding_authority = 'operatorGrant'").get(platformId)
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
