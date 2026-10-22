// Tool signing keys (security §2.3, contract §2.3): one active RSA 2048 key per tool account, RS256, kid = JWK
// thumbprint. The key provider seals the private JWK, bound to its account and kid (LA-ADR-06 D6). Moved from
// accounts.ts (B-T2a-01).
import type { JsonWebKey } from 'node:crypto';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import type { JWK } from 'jose';
import { calculateJwkThumbprint } from 'jose';
import type { KeyHandle, LocalKeyProvider } from '@cogniate/shared';
import { associatedData, blobKeyVersion, keyProviderFor } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';

export interface PublicJwk extends JWK { kid: string; kty: 'RSA'; alg: 'RS256'; use: 'sig'; n: string; e: string }

/** A blob copied to the row of another account or kid does not open (AP-06-25). */
const privateJwkAad = (accountId: string, kid: string) => associatedData('lti', 'tool_key', 'private_jwk_encrypted', accountId, kid);

/** Make the active key if the account has none (or a new one with rotate). Returns the active kid. */
export async function ensureToolKey(db: Db, keys: KeyHandle, accountId: string, rotate = false): Promise<string> {
  const active = db.prepare("SELECT kid FROM tool_key WHERE tool_account_id = ? AND status = 'active'").get(accountId) as { kid: string } | undefined;
  if (active && !rotate) return active.kid;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
  const pub = publicKey.export({ format: 'jwk' }) as JWK;
  const kid = await calculateJwkThumbprint({ kty: 'RSA', n: pub.n!, e: pub.e! });
  const publicJwk: PublicJwk = { kty: 'RSA', kid, alg: 'RS256', use: 'sig', n: pub.n!, e: pub.e! };
  const privateJwk = { ...(privateKey.export({ format: 'jwk' }) as JWK), kid, alg: 'RS256', use: 'sig' };
  const sealed = keyProviderFor(keys).sealSync(Buffer.from(JSON.stringify(privateJwk), 'utf8'), privateJwkAad(accountId, kid));
  transaction(db, () => {
    db.prepare("UPDATE tool_key SET status = 'retired' WHERE tool_account_id = ? AND status = 'active'").run(accountId);
    db.prepare(`INSERT INTO tool_key (kid, tool_account_id, public_jwk, private_jwk_encrypted, status, created_at)
                VALUES (?, ?, ?, ?, 'active', ?)`).run(kid, accountId, JSON.stringify(publicJwk), sealed.bytes, Date.now());
  });
  return kid;
}

const RETIRED_KEEP_MS = 30 * 24 * 3600 * 1000;

/** Public keys only: the active key and keys retired in the last 30 days (contract §2.3). */
export function publicJwks(db: Db, accountId: string, now = Date.now()): PublicJwk[] {
  const rows = db.prepare(`SELECT public_jwk, status, created_at FROM tool_key WHERE tool_account_id = ?
                           ORDER BY status = 'active' DESC, created_at DESC`).all(accountId) as Array<{ public_jwk: string; status: string; created_at: number }>;
  return rows.filter((r) => r.status === 'active' || now - r.created_at < RETIRED_KEEP_MS).map((r) => JSON.parse(r.public_jwk) as PublicJwk);
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
