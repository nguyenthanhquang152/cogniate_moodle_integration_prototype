// Libraries, users and sessions (mock login, contract cogniate-app-api §2). Repository: the only SQL for these tables.
import { randomId, randomToken, sha256Hex } from '@cogniate/shared';
import type { Db } from './db.ts';
import { hashPassword } from './passwords.ts';

export interface Library {
  id: string;
  name: string;
}

export interface User {
  id: string;
  libraryId: string;
  email: string;
  name: string;
  role: string;
}

export interface SignedIn {
  user: User;
  library: Library;
}

/** Session life: 8 h (Max-Age=28800). Not sliding. */
export const SESSION_TTL_SECONDS = 28800;

const normEmail = (email: string): string => email.trim().toLowerCase();

const toUser = (r: Record<string, unknown>): User => ({
  id: String(r.id), libraryId: String(r.library_id), email: String(r.email), name: String(r.name), role: String(r.role),
});

/** Find a library by name, or make it (seed). */
export function ensureLibrary(db: Db, name: string, now: number): Library {
  const row = db.prepare('SELECT id, name FROM library WHERE name = ? ORDER BY created_at LIMIT 1').get(name);
  if (row) return { id: String(row.id), name: String(row.name) };
  const lib = { id: randomId('lib_'), name };
  db.prepare('INSERT INTO library (id, name, created_at) VALUES (?, ?, ?)').run(lib.id, lib.name, now);
  return lib;
}

/** Make or update a user by email (seed). The password hash is always replaced. */
export async function upsertUser(
  db: Db,
  input: { email: string; name: string; role: string; libraryId: string; password: string },
  now: number,
): Promise<User> {
  const email = normEmail(input.email);
  const hash = await hashPassword(input.password);
  const row = db.prepare('SELECT id FROM app_user WHERE email = ?').get(email);
  if (row) {
    db.prepare('UPDATE app_user SET name = ?, role = ?, library_id = ?, password_hash = ? WHERE id = ?')
      .run(input.name, input.role, input.libraryId, hash, String(row.id));
    db.prepare('DELETE FROM app_session WHERE user_id = ?').run(String(row.id)); // a new password ends old sessions
    return { id: String(row.id), libraryId: input.libraryId, email, name: input.name, role: input.role };
  }
  const user: User = { id: randomId('usr_'), libraryId: input.libraryId, email, name: input.name, role: input.role };
  db.prepare('INSERT INTO app_user (id, library_id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(user.id, user.libraryId, user.email, user.name, user.role, hash, now);
  return user;
}

export function findUserByEmail(db: Db, email: string): (User & { passwordHash: string }) | undefined {
  const row = db.prepare('SELECT * FROM app_user WHERE email = ?').get(normEmail(email));
  return row ? { ...toUser(row), passwordHash: String(row.password_hash) } : undefined;
}

/** New session. Returns the cookie value; the table keeps only its SHA-256. Expired rows are removed here. */
export function createSession(db: Db, userId: string, now: number): { token: string; expiresAt: number } {
  db.prepare('DELETE FROM app_session WHERE expires_at <= ?').run(now);
  const token = randomToken();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  db.prepare('INSERT INTO app_session (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256Hex(token), userId, now, expiresAt);
  return { token, expiresAt };
}

export function findSession(db: Db, token: string, now: number): SignedIn | undefined {
  const row = db.prepare(`
    SELECT u.*, l.name AS library_name FROM app_session s
    JOIN app_user u ON u.id = s.user_id JOIN library l ON l.id = u.library_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256Hex(token), now);
  if (!row) return undefined;
  const user = toUser(row);
  return { user, library: { id: user.libraryId, name: String(row.library_name) } };
}

export function deleteSession(db: Db, token: string): void {
  db.prepare('DELETE FROM app_session WHERE token_hash = ?').run(sha256Hex(token));
}
