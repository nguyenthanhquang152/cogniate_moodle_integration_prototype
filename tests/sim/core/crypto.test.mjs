import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSigner, verifyJwt } from './crypto.mjs';

test('HARNESS ONLY: RSA signatures, public-only keys, strict audience shape and dates', () => {
  const signer = makeSigner(), other = makeSigner(), now = Math.floor(Date.now() / 1000);
  const claims = { iss: 'client', sub: 'client', aud: ['https://token.sim.test/token'], iat: now, exp: now + 60 };
  const jwks = { keys: [signer.jwk] };
  assert.equal(signer.jwk.d, undefined);
  assert.equal(Buffer.from(signer.jwk.n, 'base64url').length, 256);
  assert.deepEqual(verifyJwt(signer.sign(claims), jwks, { audience: claims.aud }), claims);
  for (const fault of ['altered-signature', 'unknown-kid', 'none', 'hs256']) {
    assert.throws(() => verifyJwt(signer.sign(claims, fault), jwks), undefined, fault);
  }
  assert.throws(() => verifyJwt(other.sign(claims), jwks));
  assert.throws(() => verifyJwt(signer.sign(claims), jwks, { audience: claims.aud[0] }));
  assert.throws(() => verifyJwt(signer.sign({ ...claims, exp: now - 1 }), jwks));
  assert.throws(() => verifyJwt(signer.sign({ ...claims, iat: now + 60, exp: now + 120 }), jwks));
});
