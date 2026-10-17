import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';

// Mock login only (the real Cogniate platform owns sign-in). scrypt, 16-byte salt, 32-byte key.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;

const scrypt = (password: string, salt: Buffer, keyLen: number, options: ScryptOptions): Promise<Buffer> =>
  new Promise((resolve, reject) => scryptCb(password, salt, keyLen, options, (err, key) => (err ? reject(err) : resolve(key))));

/** "scrypt$N$r$p$<salt base64url>$<key base64url>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  const salt = Buffer.from(parts[4]!, 'base64url');
  const want = Buffer.from(parts[5]!, 'base64url');
  if (![n, r, p].every(Number.isInteger) || want.length === 0 || n > 1 << 20) return false;
  const got = await scrypt(password, salt, want.length, { N: n, r, p, maxmem: 256 * n * r + 1024 * 1024 });
  return timingSafeEqual(got, want);
}

let dummy: Promise<string> | undefined;
/** A hash to check against when the email is unknown, so both cases take the same time. */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'));
  return dummy;
}
