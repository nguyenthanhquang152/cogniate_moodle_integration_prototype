// Mock session (contract cogniate-app-api §2): POST/DELETE /app-api/session, GET /app-api/me.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../domain/db.ts';
import { createSession, deleteSession, findSession, findUserByEmail, SESSION_TTL_SECONDS } from '../domain/libraries.ts';
import type { SignedIn } from '../domain/libraries.ts';
import { dummyHash, verifyPassword } from '../domain/passwords.ts';
import { ApiError } from './errors.ts';

export const SESSION_COOKIE = '__Host-cog_session';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; Secure; HttpOnly; SameSite=Lax`;
}

export const CLEAR_SESSION_COOKIE = `${SESSION_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;

/** Value of one cookie in a Cookie header, or undefined. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

/** The signed-in user of the request, from the session cookie, or undefined. */
export function sessionOf(db: Db, cookieHeader: string | undefined, now: number): { token: string; signedIn: SignedIn } | undefined {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token || !TOKEN.test(token)) return undefined;
  const signedIn = findSession(db, token, now);
  return signedIn ? { token, signedIn } : undefined;
}

const Login = z.object({ email: z.string().min(1).max(254), password: z.string().min(1).max(1024) });

export function registerSessionRoutes(api: FastifyInstance, deps: { db: Db; now: () => number }): void {
  api.post('/session', { config: { public: true } }, async (req, reply) => {
    const body = Login.safeParse(req.body);
    if (!body.success) throw new ApiError(400, 'INVALID_REQUEST', 'Send JSON { "email", "password" }.');
    const user = findUserByEmail(deps.db, body.data.email);
    // Check a hash also for an unknown email, so both cases take the same time.
    const ok = await verifyPassword(body.data.password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'The email or the password is not correct.');
    const { token } = createSession(deps.db, user.id, deps.now());
    return reply.code(204).header('set-cookie', sessionCookie(token)).send();
  });

  api.delete('/session', async (req, reply) => {
    if (req.auth) deleteSession(deps.db, req.auth.token);
    return reply.code(204).header('set-cookie', CLEAR_SESSION_COOKIE).send();
  });

  api.get('/me', async (req) => {
    const { user, library } = req.auth!.signedIn;
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, library: { id: library.id, name: library.name } };
  });
}
