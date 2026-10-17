import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes as base64url: 43 characters (session token, capability token). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** A random id with a type prefix (contract cogniate-app-api §1): prefix + 16 random bytes (128 bits) as base64url. */
export function randomId(prefix: string): string {
  return `${prefix}${randomBytes(16).toString('base64url')}`;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time string compare (different lengths are unequal). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** AES-256-GCM (ADR-006): iv(12) | tag(16) | ciphertext. `key` is 32 bytes (the service master key). */
export function encrypt(key: Buffer, plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

export function decrypt(key: Buffer, blob: Uint8Array): string {
  const buf = Buffer.from(blob);
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}
