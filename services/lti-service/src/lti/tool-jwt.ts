// JWTs that the tool signs (security §2.3): Deep Linking response and the client assertion of the token request.
// Moodle decodes with leeway 0, so a tool clock that is a little ahead would fail: iat = now - 30 s, exp = now + 300 s.
import type { JWTPayload } from 'jose';
import { SignJWT, importJWK } from 'jose';
import type { Db } from '../db/index.ts';
import { activePrivateJwk } from '../store/tool-keys.ts';

export const JWT_IAT_BACKDATE_S = 30;
export const JWT_EXPIRES_IN_S = 300;

/** Sign claims with the active RS256 key of the tool account (header kid = its JWK thumbprint). */
export async function signToolJwt(db: Db, masterKey: Buffer, accountId: string, claims: JWTPayload, nowMs: number): Promise<string> {
  const jwk = activePrivateJwk(db, masterKey, accountId);
  if (!jwk || typeof jwk.kid !== 'string') throw new Error(`tool account ${accountId} has no active signing key`);
  const key = await importJWK(jwk, 'RS256');
  const now = Math.floor(nowMs / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })
    .setIssuedAt(now - JWT_IAT_BACKDATE_S)
    .setExpirationTime(now + JWT_EXPIRES_IN_S)
    .sign(key);
}
