import type { JsonWebKey } from 'node:crypto';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import type { JWK } from 'jose';
import { calculateJwkThumbprint } from 'jose';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { decrypt, encrypt, newApiKey, sha256Hex } from '../crypto.ts';

export interface ToolAccount {
  id: string;
  name: string;
  launchUrl: string;
  deepLinkingUrl: string;
  registrationUrl: string;
}

interface AccountRow { id: string; name: string; launch_url: string; deep_linking_url: string; registration_url: string }

const toAccount = (r: AccountRow): ToolAccount => ({
  id: r.id, name: r.name, launchUrl: r.launch_url, deepLinkingUrl: r.deep_linking_url, registrationUrl: r.registration_url,
});

export const ACCOUNT_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function getAccount(db: Db, id: string): ToolAccount | null {
  const row = db.prepare('SELECT * FROM tool_account WHERE id = ?').get(id) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

/** The API key resolves to exactly one tool account (only its SHA-256 hash is stored). */
export function findAccountByApiKey(db: Db, apiKey: string): ToolAccount | null {
  if (!/^ltis_[A-Za-z0-9_-]{43}$/.test(apiKey)) return null;
  const row = db.prepare('SELECT * FROM tool_account WHERE api_key_hash = ?').get(sha256Hex(apiKey)) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

export interface EnsureAccountInput {
  id: string;
  name: string;
  appUrl: string; // PUBLIC_APP_URL
  rotateApiKey?: boolean;
}

/** Make the account if missing (or update its name and URLs). Returns the API key only when it was made or rotated. */
export function ensureAccount(db: Db, input: EnsureAccountInput): { account: ToolAccount; created: boolean; apiKey: string | null } {
  if (!ACCOUNT_ID.test(input.id)) throw new Error(`invalid account id: ${input.id}`);
  const urls = {
    launch: `${input.appUrl}/tool/launch`, deep: `${input.appUrl}/tool/deep-link`, reg: `${input.appUrl}/tool/register`,
  };
  return transaction(db, () => {
    const existing = getAccount(db, input.id);
    if (!existing) {
      const apiKey = newApiKey();
      db.prepare(`INSERT INTO tool_account (id, name, api_key_hash, launch_url, deep_linking_url, registration_url, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.id, input.name, sha256Hex(apiKey), urls.launch, urls.deep, urls.reg, Date.now());
      return { account: getAccount(db, input.id)!, created: true, apiKey };
    }
    db.prepare('UPDATE tool_account SET name = ?, launch_url = ?, deep_linking_url = ?, registration_url = ? WHERE id = ?')
      .run(input.name, urls.launch, urls.deep, urls.reg, input.id);
    let apiKey: string | null = null;
    if (input.rotateApiKey) {
      apiKey = newApiKey();
      db.prepare('UPDATE tool_account SET api_key_hash = ? WHERE id = ?').run(sha256Hex(apiKey), input.id);
    }
    return { account: getAccount(db, input.id)!, created: false, apiKey };
  });
}

// ---------------------------------------------------------------- tool signing keys (RS256, 2048 bit)
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
