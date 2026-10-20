// Independent QA oracle. Node crypto only; keys never leave this process.
import { createHmac, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
export function makeSigner() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `sim-${randomBytes(12).toString('base64url')}`;
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
  return {
    jwk,
    sign(claims, fault) {
      const header = { alg: 'RS256', typ: 'JWT', kid };
      if (fault === 'unknown-kid') header.kid = 'unknown-simulator-key';
      if (fault === 'none') header.alg = 'none';
      if (fault === 'hs256') header.alg = 'HS256';
      const input = `${encode(header)}.${encode(claims)}`;
      if (fault === 'none') return `${input}.`;
      if (fault === 'hs256') {
        return `${input}.${createHmac('sha256', Buffer.from(jwk.n, 'base64url')).update(input).digest('base64url')}`;
      }
      const signature = sign('RSA-SHA256', Buffer.from(input), privateKey);
      if (fault === 'altered-signature') signature[0] ^= 1;
      return `${input}.${signature.toString('base64url')}`;
    },
  };
}

export function verifyJwt(token, jwks, { issuer, audience, now = Math.floor(Date.now() / 1000), requireNonce = false } = {}) {
  if (typeof token !== 'string') throw new Error('JWT missing');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('JWT encoding');
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { throw new Error('JWT JSON'); }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('JWT algorithm');
  if (header.crit || header.jku || header.jwk || header.x5u) throw new Error('JWT unsupported header');
  const key = jwks.keys?.find((candidate) => candidate.kid === header.kid && candidate.kty === 'RSA'
    && (!candidate.alg || candidate.alg === 'RS256') && (!candidate.use || candidate.use === 'sig'));
  if (!key || key.d) throw new Error('JWT key');
  if (!verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error('JWT signature');
  if (issuer !== undefined && claims.iss !== issuer) throw new Error('JWT issuer');
  if (audience !== undefined && JSON.stringify(claims.aud) !== JSON.stringify(audience)) throw new Error('JWT audience');
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)
    || claims.iat > now + 5 || claims.exp <= now || claims.exp <= claims.iat
    || claims.exp - claims.iat > 3600) throw new Error('JWT dates');
  if (requireNonce && (typeof claims.nonce !== 'string' || !claims.nonce)) throw new Error('JWT nonce');
  return claims;
}
