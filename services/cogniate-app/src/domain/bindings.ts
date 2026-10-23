// Approval grants, redemption attempts, the write-ahead binding ref history, connection leases, Blackboard
// reservations and approvals (app contract §4.7, §4.8, §4.9; data-model §4.2). Repository: the only SQL for these
// tables. Grants, attempts and history rows are never deleted (audit and fence records).
import { randomBytes } from 'node:crypto';
import { randomId, sha256Hex } from '@cogniate/shared';
import type { Db } from './db.ts';

export const LEASE_MS = 60_000;
/** S0: at least this much of the lease must remain before an LTI call (app contract §4.7.1). */
export const LEASE_MIN_REMAINING_MS = 6_000;

export type GrantPurpose = 'initial' | 'add_deployment';
export type RevokedReason = 'operator' | 'replaced' | 'disconnect' | 'suspend';

export interface Grant {
  id: string;
  libraryId: string;
  connectionId: string;
  lms: string;
  profile: string;
  purpose: GrantPurpose;
  siteUrl: string;
  serviceUrl: string;
  clientId: string;
  deploymentId: string;
  note: string;
  createdAt: number;
  expiresAt: number;
  redeemedAt: number | null;
  revokedAt: number | null;
  revokedReason: RevokedReason | null;
}

const toGrant = (r: Record<string, unknown>): Grant => ({
  id: String(r.id), libraryId: String(r.library_id), connectionId: String(r.connection_id), lms: String(r.lms), profile: String(r.lti_profile),
  purpose: r.purpose as GrantPurpose, siteUrl: String(r.site_url), serviceUrl: String(r.service_url), clientId: String(r.client_id),
  deploymentId: String(r.deployment_id), note: String(r.note), createdAt: Number(r.created_at), expiresAt: Number(r.expires_at),
  redeemedAt: r.redeemed_at === null ? null : Number(r.redeemed_at), revokedAt: r.revoked_at === null ? null : Number(r.revoked_at),
  revokedReason: r.revoked_reason === null ? null : (r.revoked_reason as RevokedReason),
});

export type NewGrant = Omit<Grant, 'id' | 'createdAt' | 'redeemedAt' | 'revokedAt' | 'revokedReason'>;

/** Store a grant (only the SHA-256 of the code). Returns the grant id. */
export function insertGrant(db: Db, input: NewGrant, codeHash: string, now: number): string {
  const id = randomId('grt_');
  db.prepare(`INSERT INTO binding_grant (id, code_hash, library_id, connection_id, lms, lti_profile, purpose, site_url, service_url, client_id, deployment_id,
      note, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, codeHash, input.libraryId, input.connectionId, input.lms, input.profile, input.purpose, input.siteUrl, input.serviceUrl, input.clientId,
      input.deploymentId, input.note, now, input.expiresAt);
  return id;
}

export function grantByCode(db: Db, code: string): Grant | undefined {
  const r = db.prepare('SELECT * FROM binding_grant WHERE code_hash = ?').get(sha256Hex(code));
  return r ? toGrant(r) : undefined;
}

export function getGrant(db: Db, id: string): Grant | undefined {
  const r = db.prepare('SELECT * FROM binding_grant WHERE id = ?').get(id);
  return r ? toGrant(r) : undefined;
}

export function grantsOfConnection(db: Db, connectionId: string): Grant[] {
  return db.prepare('SELECT * FROM binding_grant WHERE connection_id = ? ORDER BY created_at, rowid').all(connectionId).map(toGrant);
}

/** Revoke one unredeemed grant. False when it is redeemed or already revoked. */
export function revokeGrant(db: Db, id: string, reason: RevokedReason, now: number): boolean {
  return Number(db.prepare('UPDATE binding_grant SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND redeemed_at IS NULL AND revoked_at IS NULL')
    .run(now, reason, id).changes) === 1;
}

/** Revoke every unredeemed grant of a connection (optionally of one purpose). Returns the count. */
export function revokeOpenGrants(db: Db, connectionId: string, reason: RevokedReason, now: number, purpose?: GrantPurpose): number {
  const sql = `UPDATE binding_grant SET revoked_at = ?, revoked_reason = ? WHERE connection_id = ? AND redeemed_at IS NULL AND revoked_at IS NULL${purpose ? ' AND purpose = ?' : ''}`;
  return Number(db.prepare(sql).run(now, reason, connectionId, ...(purpose ? [purpose] : [])).changes);
}

export function markGrantRedeemed(db: Db, id: string, now: number): void {
  db.prepare('UPDATE binding_grant SET redeemed_at = ? WHERE id = ?').run(now, id);
}

// ---------------------------------------------------------------- attempts

export type AttemptState = 'open' | 'committed' | 'cancelled' | 'failed' | 'abandoned';

export interface Attempt {
  attemptId: string;
  seq: number;
  connectionId: string;
  grantId: string;
  purpose: GrantPurpose;
  profile: string;
  issuer: string;
  clientId: string;
  deploymentId: string;
  platformId: string | null;
  historyFloor: number;
  state: AttemptState;
  startedAt: number;
  endedAt: number | null;
}

const toAttempt = (r: Record<string, unknown>): Attempt => ({
  attemptId: String(r.attempt_id), seq: Number(r.seq), connectionId: String(r.connection_id), grantId: String(r.grant_id), purpose: r.purpose as GrantPurpose,
  profile: String(r.lti_profile), issuer: String(r.issuer), clientId: String(r.client_id), deploymentId: String(r.deployment_id),
  platformId: r.lti_platform_id === null ? null : String(r.lti_platform_id), historyFloor: Number(r.history_floor), state: r.state as AttemptState,
  startedAt: Number(r.started_at), endedAt: r.ended_at === null ? null : Number(r.ended_at),
});

export function insertAttempt(
  db: Db,
  input: { connectionId: string; grantId: string; purpose: GrantPurpose; profile: string; issuer: string; clientId: string; deploymentId: string; platformId: string | null },
  now: number,
): Attempt {
  const attemptId = randomId('att_');
  const seq = Number((db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM binding_attempt').get() as { m: number }).m) + 1;
  const floor = Number((db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM binding_ref_history').get() as { m: number }).m);
  db.prepare(`INSERT INTO binding_attempt (attempt_id, seq, connection_id, grant_id, purpose, lti_profile, issuer, client_id, deployment_id, lti_platform_id,
      history_floor, state, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`)
    .run(attemptId, seq, input.connectionId, input.grantId, input.purpose, input.profile, input.issuer, input.clientId, input.deploymentId, input.platformId, floor, now);
  return getAttempt(db, attemptId)!;
}

export function getAttempt(db: Db, attemptId: string): Attempt | undefined {
  const r = db.prepare('SELECT * FROM binding_attempt WHERE attempt_id = ?').get(attemptId);
  return r ? toAttempt(r) : undefined;
}

export function attemptsOfConnection(db: Db, connectionId: string): Attempt[] {
  return db.prepare('SELECT * FROM binding_attempt WHERE connection_id = ? ORDER BY seq').all(connectionId).map(toAttempt);
}

export function attemptsOfGrant(db: Db, grantId: string): Attempt[] {
  return db.prepare('SELECT * FROM binding_attempt WHERE grant_id = ? ORDER BY seq').all(grantId).map(toAttempt);
}

export function setAttemptPlatform(db: Db, attemptId: string, platformId: string): void {
  db.prepare('UPDATE binding_attempt SET lti_platform_id = ? WHERE attempt_id = ? AND lti_platform_id IS NULL').run(platformId, attemptId);
}

/** End an attempt (only an open one changes). */
export function endAttempt(db: Db, attemptId: string, state: Exclude<AttemptState, 'open'>, now: number): void {
  db.prepare("UPDATE binding_attempt SET state = ?, ended_at = ? WHERE attempt_id = ? AND state = 'open'").run(state, now, attemptId);
}

// ---------------------------------------------------------------- ref history (write-ahead)

export type RefAction = 'create' | 'activate' | 'compensate' | 'fence_out' | 'revoke_cleanup';

export interface RefRow {
  seq: number;
  ref: string;
  connectionId: string;
  attemptId: string | null;
  grantId: string | null;
  action: RefAction;
}

/** 22 random characters [A-Za-z0-9_-] (132 bits). */
export const newRef = (): string => randomBytes(17).toString('base64url').slice(0, 22);

/**
 * Commit a new ref to the history BEFORE the call that carries it (write-ahead). Each ref is new and unique; the
 * UNIQUE constraint refuses a repeat, so a value can never be used twice.
 */
export function recordRef(
  db: Db,
  input: { connectionId: string; attemptId: string | null; grantId: string | null; action: RefAction; platformId: string | null; deploymentId: string | null },
  now: number,
): string {
  const ref = newRef();
  db.prepare(`INSERT INTO binding_ref_history (ref, connection_id, attempt_id, grant_id, action, lti_platform_id, deployment_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(ref, input.connectionId, input.attemptId, input.grantId, input.action, input.platformId, input.deploymentId, now);
  return ref;
}

export function refRow(db: Db, ref: string | null): RefRow | undefined {
  if (ref === null) return undefined;
  const r = db.prepare('SELECT * FROM binding_ref_history WHERE ref = ?').get(ref);
  return r ? {
    seq: Number(r.seq), ref: String(r.ref), connectionId: String(r.connection_id), attemptId: r.attempt_id === null ? null : String(r.attempt_id),
    grantId: r.grant_id === null ? null : String(r.grant_id), action: r.action as RefAction,
  } : undefined;
}

// ---------------------------------------------------------------- connection lease

export const leaseLive = (c: { redeemingAttempt: string | null; redeemingSince: number | null }, now: number): boolean =>
  c.redeemingAttempt !== null && c.redeemingSince !== null && now - c.redeemingSince < LEASE_MS;

/** Take the lease for an attempt; an older open attempt that held an expired lease becomes `abandoned`. */
export function takeLease(db: Db, connectionId: string, attemptId: string, previous: string | null, now: number): void {
  if (previous !== null && previous !== attemptId) endAttempt(db, previous, 'abandoned', now);
  db.prepare('UPDATE connection SET redeeming_attempt = ?, redeeming_since = ? WHERE id = ?').run(attemptId, now, connectionId);
}

/** Clear the lease only if it still holds this attempt. */
export function clearLease(db: Db, connectionId: string, attemptId: string): void {
  db.prepare('UPDATE connection SET redeeming_attempt = NULL, redeeming_since = NULL WHERE id = ? AND redeeming_attempt = ?').run(connectionId, attemptId);
}

// ---------------------------------------------------------------- Blackboard reservations

export interface Reservation {
  platformId: string;
  deploymentId: string;
  connectionId: string;
  libraryId: string;
  bindingRef: string | null;
}

const toReservation = (r: Record<string, unknown>): Reservation => ({
  platformId: String(r.lti_platform_id), deploymentId: String(r.deployment_id), connectionId: String(r.connection_id), libraryId: String(r.library_id),
  bindingRef: r.binding_ref === null ? null : String(r.binding_ref),
});

export function reservationOf(db: Db, platformId: string, deploymentId: string): Reservation | undefined {
  const r = db.prepare('SELECT * FROM connection_deployment WHERE lti_platform_id = ? AND deployment_id = ?').get(platformId, deploymentId);
  return r ? toReservation(r) : undefined;
}

export function reservationOfConnection(db: Db, connectionId: string): Reservation | undefined {
  const r = db.prepare('SELECT * FROM connection_deployment WHERE connection_id = ?').get(connectionId);
  return r ? toReservation(r) : undefined;
}

/** Phase 1 only: insert the reservation, or move it from a disabled connection of the same library (or keep our own). */
export function writeReservation(db: Db, r: Omit<Reservation, 'bindingRef'> & { bindingRef: string }, now: number): void {
  db.prepare(`INSERT INTO connection_deployment (lti_platform_id, deployment_id, connection_id, library_id, binding_ref, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (lti_platform_id, deployment_id) DO UPDATE SET connection_id = excluded.connection_id, library_id = excluded.library_id,
      binding_ref = excluded.binding_ref, updated_at = excluded.updated_at`)
    .run(r.platformId, r.deploymentId, r.connectionId, r.libraryId, r.bindingRef, now, now);
}

export function setReservationRef(db: Db, connectionId: string, ref: string, now: number): void {
  db.prepare('UPDATE connection_deployment SET binding_ref = ?, updated_at = ? WHERE connection_id = ?').run(ref, now, connectionId);
}

/** Release only: delete the reservation of exactly this connection. */
export function deleteReservationOfConnection(db: Db, connectionId: string): void {
  db.prepare('DELETE FROM connection_deployment WHERE connection_id = ?').run(connectionId);
}

// ---------------------------------------------------------------- approvals

export interface Approval {
  platformId: string;
  deploymentId: string;
  connectionId: string;
  libraryId: string;
  bindingRef: string;
  grantId: string;
  approvedAt: number;
}

const toApproval = (r: Record<string, unknown>): Approval => ({
  platformId: String(r.lti_platform_id), deploymentId: String(r.deployment_id), connectionId: String(r.connection_id), libraryId: String(r.library_id),
  bindingRef: String(r.binding_ref), grantId: String(r.grant_id), approvedAt: Number(r.approved_at),
});

export function approvalOf(db: Db, platformId: string, deploymentId: string): Approval | undefined {
  const r = db.prepare('SELECT * FROM approved_deployment WHERE lti_platform_id = ? AND deployment_id = ?').get(platformId, deploymentId);
  return r ? toApproval(r) : undefined;
}

export function approvalsOfConnection(db: Db, connectionId: string): Approval[] {
  return db.prepare('SELECT * FROM approved_deployment WHERE connection_id = ? ORDER BY approved_at, rowid').all(connectionId).map(toApproval);
}

export function platformHasApproval(db: Db, platformId: string): boolean {
  return db.prepare('SELECT 1 FROM approved_deployment WHERE lti_platform_id = ?').get(platformId) !== undefined;
}

/**
 * Phase 2 only: write the approval. A row of a DISABLED connection for the same key (the Blackboard same-library move)
 * is replaced in the same transaction; any other existing row makes the insert fail (primary key).
 */
export function writeApproval(db: Db, a: Approval): void {
  db.prepare(`DELETE FROM approved_deployment WHERE lti_platform_id = ? AND deployment_id = ?
    AND connection_id IN (SELECT id FROM connection WHERE status = 'disabled')`).run(a.platformId, a.deploymentId);
  db.prepare(`INSERT INTO approved_deployment (lti_platform_id, deployment_id, connection_id, library_id, binding_ref, grant_id, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(a.platformId, a.deploymentId, a.connectionId, a.libraryId, a.bindingRef, a.grantId, a.approvedAt);
}

/** Release only: delete the approvals of exactly this connection. */
export function deleteApprovalsOfConnection(db: Db, connectionId: string): void {
  db.prepare('DELETE FROM approved_deployment WHERE connection_id = ?').run(connectionId);
}
