// Tool signing keys (security §2.3, contract §2.3): one active RSA 2048 key per tool account, RS256, kid = JWK
// thumbprint. The private JWK is stored encrypted with LTI_MASTER_KEY (AES-256-GCM). Moved from accounts.ts (B-T2a-01).
import type { JsonWebKey } from 'node:crypto';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import type { JWK } from 'jose';
import { calculateJwkThumbprint } from 'jose';
import { decrypt, encrypt } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';

export interface PublicJwk extends JWK { kid: string; kty: 'RSA'; alg: 'RS256'; use: 'sig'; n: string; e: string }

/** Make the active key if the account has none (or a new one with rotate). Returns the active kid. */
export async function ensureToolKey(db: Db, masterKey: Buffer, accountId: string, rotate = false): Promise<string> {
  const active = db.prepare("SELECT kid FROM tool_key WHERE tool_account_id = ? AND status = 'active'").get(accountId) as { kid: string } | undefined;
  if (active && !rotate) return active.kid;
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
  const pub = publicKey.export({ format: 'jwk' }) as JWK;
  const kid = await calculateJwkThumbprint({ kty: 'RSA', n: pub.n!, e: pub.e! });
  const publicJwk: PublicJwk = { kty: 'RSA', kid, alg: 'RS256', use: 'sig', n: pub.n!, e: pub.e! };
  const privateJwk = { ...(privateKey.export({ format: 'jwk' }) as JWK), kid, alg: 'RS256', use: 'sig' };
  transaction(db, () => {
    db.prepare("UPDATE tool_key SET status = 'retired' WHERE tool_account_id = ? AND status = 'active'").run(accountId);
    db.prepare(`INSERT INTO tool_key (kid, tool_account_id, public_jwk, private_jwk_encrypted, status, created_at)
                VALUES (?, ?, ?, ?, 'active', ?)`).run(kid, accountId, JSON.stringify(publicJwk), encrypt(masterKey, JSON.stringify(privateJwk)), Date.now());
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

/** Private JWK of the active key (for T3a signing). */
export function activePrivateJwk(db: Db, masterKey: Buffer, accountId: string): JWK | null {
  const row = db.prepare("SELECT private_jwk_encrypted FROM tool_key WHERE tool_account_id = ? AND status = 'active'").get(accountId) as { private_jwk_encrypted: Uint8Array } | undefined;
  return row ? (JSON.parse(decrypt(masterKey, row.private_jwk_encrypted)) as JWK) : null;
}
