// Registration sessions (contract §2.4, §3.8, data-model §1). Every lookup includes the tool account (security §8).
// The key provider seals the registration token, bound to its account and session id (LA-ADR-06 D6).
import { randomBytes } from 'node:crypto';
import type { KeyHandle } from '@cogniate/shared';
import { keyProviderFor } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { REGISTRATION_TOKEN_COLUMN, sealedVersionCounts } from '../keys/sealed-columns.ts';

export type RegistrationOperation = 'new' | 'update';
export type PrivacyLevel = 'public' | 'name_only' | 'email_only' | 'anonymous';

export interface RegistrationSession {
  id: string;
  toolAccountId: string;
  openidConfigurationUrl: string;
  registrationToken: string | null;
  platformConfiguration: Record<string, unknown>;
  operation: RegistrationOperation;
  existingPlatformId: string | null;
  privacyLevel: PrivacyLevel;
  passthrough: Record<string, string>;
  status: 'open' | 'completing' | 'completed';
  platformId: string | null;
  expiresAt: number;
}

const KEEP_MS = 24 * 3600 * 1000; // contract §6

interface Row {
  id: string; tool_account_id: string; openid_configuration_url: string; registration_token_encrypted: Uint8Array | null;
  platform_configuration: string; operation: RegistrationOperation; existing_platform_id: string | null; privacy_level: PrivacyLevel;
  passthrough_params: string; status: RegistrationSession['status']; platform_id: string | null; expires_at: number;
}

const tokenAad = REGISTRATION_TOKEN_COLUMN.aad;

export function createRegistrationSession(
  db: Db,
  keys: KeyHandle,
  input: Omit<RegistrationSession, 'id' | 'status' | 'platformId'>,
  now: number,
): RegistrationSession {
  db.prepare('DELETE FROM registration_session WHERE created_at < ?').run(now - KEEP_MS);
  const session: RegistrationSession = { ...input, id: `reg_${randomBytes(16).toString('base64url')}`, status: 'open', platformId: null };
  const sealedToken = session.registrationToken
    ? keyProviderFor(keys).sealSync(Buffer.from(session.registrationToken, 'utf8'), tokenAad(session.toolAccountId, session.id)).bytes
    : null;
  db.prepare(`INSERT INTO registration_session (id, tool_account_id, openid_configuration_url, registration_token_encrypted, platform_configuration,
      operation, existing_platform_id, privacy_level, passthrough_params, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`)
    .run(session.id, session.toolAccountId, session.openidConfigurationUrl, sealedToken,
      JSON.stringify(session.platformConfiguration), session.operation, session.existingPlatformId, session.privacyLevel,
      JSON.stringify(session.passthrough), session.expiresAt, now);
  return session;
}

/** The session of this account, if it exists and has not expired (an expired session is "not found"). */
export function getRegistrationSession(db: Db, keys: KeyHandle, accountId: string, id: string, now: number): RegistrationSession | null {
  const row = db.prepare('SELECT * FROM registration_session WHERE id = ? AND tool_account_id = ? AND expires_at > ?').get(id, accountId, now) as Row | undefined;
  if (!row) return null;
  return {
    id: row.id, toolAccountId: row.tool_account_id, openidConfigurationUrl: row.openid_configuration_url,
    registrationToken: row.registration_token_encrypted
      ? Buffer.from(keyProviderFor(keys).openSync({ bytes: row.registration_token_encrypted }, tokenAad(row.tool_account_id, row.id))).toString('utf8')
      : null,
    platformConfiguration: JSON.parse(row.platform_configuration) as Record<string, unknown>, operation: row.operation,
    existingPlatformId: row.existing_platform_id, privacyLevel: row.privacy_level, passthrough: JSON.parse(row.passthrough_params) as Record<string, string>,
    status: row.status, platformId: row.platform_id, expiresAt: row.expires_at,
  };
}

/** Atomically move open -> completing (one complete at a time). False if the session is not open. */
export function claimRegistrationSession(db: Db, accountId: string, id: string): boolean {
  return Number(db.prepare("UPDATE registration_session SET status = 'completing' WHERE id = ? AND tool_account_id = ? AND status = 'open'").run(id, accountId).changes) === 1;
}

/** completing -> open again (the platform call failed; the admin may try again). */
export function releaseRegistrationSession(db: Db, accountId: string, id: string): void {
  db.prepare("UPDATE registration_session SET status = 'open' WHERE id = ? AND tool_account_id = ? AND status = 'completing'").run(id, accountId);
}

export function completeRegistrationSession(db: Db, accountId: string, id: string, platformId: string, now: number): void {
  // The registration token is single use: drop the encrypted copy (A-T3b-03).
  db.prepare("UPDATE registration_session SET status = 'completed', platform_id = ?, completed_at = ?, registration_token_encrypted = NULL WHERE id = ? AND tool_account_id = ?")
    .run(platformId, now, id, accountId);
}

/** Key versions of the stored registration tokens (key provider `ready()`). */
export function registrationTokenVersions(db: Db): string[] {
  return [...sealedVersionCounts(db, [REGISTRATION_TOKEN_COLUMN]).keys()];
}
