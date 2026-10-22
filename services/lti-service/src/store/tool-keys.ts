// Tool signing keys (security §2.3, contract §2.3): one active RSA 2048 key per tool account, RS256, kid = JWK
// thumbprint. The key provider seals the private JWK, bound to its account and kid (LA-ADR-06 D6). Moved from
// accounts.ts (B-T2a-01).
import type { JsonWebKey } from 'node:crypto';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import type { JWK } from 'jose';
import { calculateJwkThumbprint } from 'jose';
import type { KeyHandle, LocalKeyProvider } from '@cogniate/shared';
import { associatedData, blobKeyVersion, keyProviderFor } from '@cogniate/shared';
import { ApiError } from '../api-errors.ts';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { KeyError } from '../http/key-errors.ts';
import { getAccount } from './accounts.ts';

export interface PublicJwk extends JWK { kid: string; kty: 'RSA'; alg: 'RS256'; use: 'sig'; n: string; e: string }

/** A blob copied to the row of another account or kid does not open (AP-06-25). */
const privateJwkAad = (accountId: string, kid: string) => associatedData('lti', 'tool_key', 'private_jwk_encrypted', accountId, kid);

export const RETIRED_KEEP_MS = 30 * 24 * 3600 * 1000;
export const SIGNING_KEY_PUBLISH_LEAD_S = 86_400;

export type SigningKeyStatus = 'next' | 'active' | 'retired' | 'removed';
export interface SigningKeyRecord {
  kid: string;
  status: SigningKeyStatus;
  publishedAt: number;
  activatedAt: number | null;
  retiredAt: number | null;
  removedAt: number | null;
}

interface SigningKeyRow {
  kid: string; status: SigningKeyStatus; published_at: number; activated_at: number | null;
  retired_at: number | null; removed_at: number | null;
}
const metadata = (r: SigningKeyRow): SigningKeyRecord => ({
  kid: r.kid, status: r.status, publishedAt: r.published_at, activatedAt: r.activated_at,
  retiredAt: r.retired_at, removedAt: r.removed_at,
});

export function requireSigningKeyAccount(db: Db, accountId: string): void {
  if (!getAccount(db, accountId)) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
}

export function listSigningKeys(db: Db, accountId: string): SigningKeyRecord[] {
  requireSigningKeyAccount(db, accountId);
  return (db.prepare(`SELECT kid, status, published_at, activated_at, retired_at, removed_at FROM tool_key
    WHERE tool_account_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'next' THEN 1 WHEN 'retired' THEN 2 ELSE 3 END,
    created_at DESC, kid`).all(accountId) as unknown as SigningKeyRow[]).map(metadata);
}

function signingKey(db: Db, accountId: string, kid: string): SigningKeyRecord {
  requireSigningKeyAccount(db, accountId);
  const row = db.prepare(`SELECT kid, status, published_at, activated_at, retired_at, removed_at FROM tool_key
    WHERE tool_account_id = ? AND kid = ?`).get(accountId, kid) as unknown as SigningKeyRow | undefined;
  if (!row) throw new ApiError('NOT_FOUND', 'Unknown signing key.');
  return metadata(row);
}

const activeKid = (db: Db, accountId: string): string | undefined =>
  (db.prepare("SELECT kid FROM tool_key WHERE tool_account_id = ? AND status = 'active'").get(accountId) as { kid: string } | undefined)?.kid;

/** Check before key generation, then again in the write transaction after async work. */
export function requireNextKeySlot(db: Db, accountId: string): void {
  requireSigningKeyAccount(db, accountId);
  if (db.prepare("SELECT 1 FROM tool_key WHERE tool_account_id = ? AND status = 'next'").get(accountId)) {
    throw new KeyError('SIGNING_KEY_NEXT_EXISTS');
  }
  if (!activeKid(db, accountId)) throw new KeyError('SIGNING_KEY_WRONG_STATE');
}

export interface PreparedToolKey {
  accountId: string;
  kid: string;
  publicJwk: PublicJwk;
  sealedPrivateJwk: Uint8Array;
}

/** Do all async work before a synchronous transaction or audit.change (LA-ADR-06 D4 T2). */
export async function prepareToolKey(keys: KeyHandle, accountId: string): Promise<PreparedToolKey> {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
  const pub = publicKey.export({ format: 'jwk' }) as JWK;
  const kid = await calculateJwkThumbprint({ kty: 'RSA', n: pub.n!, e: pub.e! });
  const publicJwk: PublicJwk = { kty: 'RSA', kid, alg: 'RS256', use: 'sig', n: pub.n!, e: pub.e! };
  const privateJwk = { ...(privateKey.export({ format: 'jwk' }) as JWK), kid, alg: 'RS256', use: 'sig' };
  const sealed = await keyProviderFor(keys).seal(Buffer.from(JSON.stringify(privateJwk), 'utf8'), privateJwkAad(accountId, kid));
  return { accountId, kid, publicJwk, sealedPrivateJwk: sealed.bytes };
}

function insertKey(db: Db, key: PreparedToolKey, status: 'active' | 'next', now: number): void {
  db.prepare(`INSERT INTO tool_key (kid, tool_account_id, public_jwk, private_jwk_encrypted, status, created_at, published_at, activated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(key.kid, key.accountId, JSON.stringify(key.publicJwk), key.sealedPrivateJwk,
    status, now, now, status === 'active' ? now : null);
}

/** Publish the prepared key. It cannot sign until activation. */
export function createNextToolKey(db: Db, key: PreparedToolKey, now = Date.now()): SigningKeyRecord {
  return transaction(db, () => {
    requireNextKeySlot(db, key.accountId);
    insertKey(db, key, 'next', now);
    return signingKey(db, key.accountId, key.kid);
  });
}

export function validatePublishLeadSeconds(seconds: number): number {
  if (!Number.isSafeInteger(seconds) || seconds < 600 || seconds > Number.MAX_SAFE_INTEGER / 1000) {
    throw new Error('SIGNING_KEY_PUBLISH_LEAD_S must be an integer of at least 600 seconds.');
  }
  return seconds;
}

export function activateToolKey(
  db: Db, accountId: string, kid: string, options: { force?: boolean; publishLeadSeconds?: number } = {}, now = Date.now(),
): { kid: string; status: 'active'; activatedAt: number; retired: string } {
  return transaction(db, () => {
    const old = checkToolKeyActivation(db, accountId, kid, options, now);
    db.prepare("UPDATE tool_key SET status = 'retired', retired_at = ? WHERE tool_account_id = ? AND kid = ?").run(now, accountId, old);
    db.prepare("UPDATE tool_key SET status = 'active', activated_at = ? WHERE tool_account_id = ? AND kid = ?").run(now, accountId, kid);
    return { kid, status: 'active', activatedAt: now, retired: old };
  });
}

/** Route preflight; the store repeats it in the transaction for callers outside HTTP. */
export function checkToolKeyActivation(
  db: Db, accountId: string, kid: string, options: { force?: boolean; publishLeadSeconds?: number }, now: number,
): string {
  const lead = validatePublishLeadSeconds(options.publishLeadSeconds ?? SIGNING_KEY_PUBLISH_LEAD_S) * 1000;
  const key = signingKey(db, accountId, kid);
  if (key.status !== 'next') throw new KeyError('SIGNING_KEY_WRONG_STATE');
  if (!options.force && now - key.publishedAt < lead) throw new KeyError('SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH');
  const old = activeKid(db, accountId);
  if (!old) throw new KeyError('SIGNING_KEY_WRONG_STATE');
  return old;
}

export function checkToolKeyRemoval(db: Db, accountId: string, kid: string): void {
  const key = signingKey(db, accountId, kid);
  if (key.status === 'active') throw new KeyError('SIGNING_KEY_ACTIVE');
  if (key.status !== 'retired' && key.status !== 'next') throw new KeyError('SIGNING_KEY_WRONG_STATE');
}

/** Emergency removal keeps the public record for audit and clears the private part at once. */
export function removeToolKey(db: Db, accountId: string, kid: string, now = Date.now()): { kid: string; status: 'removed' } {
  return transaction(db, () => {
    checkToolKeyRemoval(db, accountId, kid);
    db.prepare("UPDATE tool_key SET status = 'removed', removed_at = ?, private_jwk_encrypted = X'' WHERE tool_account_id = ? AND kid = ?")
      .run(now, accountId, kid);
    return { kid, status: 'removed' };
  });
}

/** Bootstrap compatibility. LA-E5-05 moves the CLI to the audited operator API. */
export async function ensureToolKey(db: Db, keys: KeyHandle, accountId: string, rotate = false): Promise<string> {
  requireSigningKeyAccount(db, accountId);
  const active = activeKid(db, accountId);
  if (active && !rotate) return active;
  const key = await prepareToolKey(keys, accountId);
  return transaction(db, () => {
    const current = activeKid(db, accountId);
    if (current && !rotate) return current;
    const now = Date.now();
    if (!current) insertKey(db, key, 'active', now);
    else {
      createNextToolKey(db, key, now);
      activateToolKey(db, accountId, key.kid, { force: true }, now);
    }
    return key.kid;
  });
}

/** Active first, then next, then keys retired in the last 30 days (contract delta §2.3). */
export function publicJwks(db: Db, accountId: string, now = Date.now()): PublicJwk[] {
  const rows = db.prepare(`SELECT public_jwk FROM tool_key WHERE tool_account_id = ?
    AND (status IN ('active', 'next') OR (status = 'retired' AND retired_at > ?))
    ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'next' THEN 1 ELSE 2 END, created_at DESC`)
    .all(accountId, now - RETIRED_KEEP_MS) as Array<{ public_jwk: string }>;
  return rows.map((r) => JSON.parse(r.public_jwk) as PublicJwk);
}

/** PEM (SPKI) of the active tool public key: the "publicKey" field of a platform (contract §8 D8). */
export function activePublicKeyPem(db: Db, accountId: string): string | null {
  const key = publicJwks(db, accountId)[0];
  return key ? (createPublicKey({ key: key as unknown as JsonWebKey, format: 'jwk' }).export({ type: 'spki', format: 'pem' }) as string) : null;
}

/** The decrypted active key stays in memory at most this long (LA-ADR-06 D6; before LA it was decrypted for every signature). */
export const PRIVATE_JWK_CACHE_MS = 10 * 60 * 1000;
// One entry per account: the kid that was active at the last signature. A new active kid misses at once.
const privateJwkCache = new Map<string, { kid: string; provider: LocalKeyProvider; jwk: JWK; expiresAt: number }>();

/** Private JWK of the active key (for T3a signing). A blob that does not open throws (key_open_failed; the API gives 500). */
export function activePrivateJwk(db: Db, keys: KeyHandle, accountId: string, now = Date.now()): JWK | null {
  // Remove every expired entry, also of accounts that stopped signing (at most 10 minutes in memory, D6).
  for (const [id, entry] of privateJwkCache) if (now >= entry.expiresAt) privateJwkCache.delete(id);
  const row = db.prepare("SELECT kid, private_jwk_encrypted FROM tool_key WHERE tool_account_id = ? AND status = 'active'").get(accountId) as
    | { kid: string; private_jwk_encrypted: Uint8Array } | undefined;
  if (!row) return null;
  const provider = keyProviderFor(keys);
  const hit = privateJwkCache.get(accountId);
  if (hit && hit.kid === row.kid && hit.provider === provider && now < hit.expiresAt) return { ...hit.jwk };
  privateJwkCache.delete(accountId);
  const plain = provider.openSync({ bytes: row.private_jwk_encrypted }, privateJwkAad(accountId, row.kid));
  const jwk = JSON.parse(Buffer.from(plain).toString('utf8')) as JWK;
  privateJwkCache.set(accountId, { kid: row.kid, provider, jwk, expiresAt: now + PRIVATE_JWK_CACHE_MS });
  return { ...jwk };
}

/** Key versions of the stored private keys (key provider `ready()`). */
export function toolKeyVersions(db: Db): string[] {
  const rows = db.prepare('SELECT private_jwk_encrypted AS blob FROM tool_key WHERE length(private_jwk_encrypted) > 0').all() as Array<{ blob: Uint8Array }>;
  return [...new Set(rows.map((r) => blobKeyVersion(r.blob)))];
}
