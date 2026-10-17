// Seed the mock portal users (T4a): run inside the cogniate-app container by infra/scripts/seed.sh.
// stdin:  {"users":[{"email","name","role","library","password"}]}   (passwords come from .env)
// stdout: {"users":{"<email>":{"id","email","name","role","library":{"id","name"}}}}   (no password)
// Idempotent: a library is found by name, a user by email; the password hash changes only if the password did.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { loadConfig } from '../config.ts';
import { openDb } from '../domain/db.ts';
import { ensureLibrary, findUserByEmail, upsertUser } from '../domain/libraries.ts';
import { verifyPassword } from '../domain/passwords.ts';

const Input = z.object({
  users: z.array(z.object({
    email: z.string().email(),
    name: z.string().min(1).max(200),
    role: z.string().min(1).max(40),
    library: z.string().min(1).max(200),
    password: z.string().min(8).max(1024),
  })).min(1),
});

const input = Input.parse(JSON.parse(readFileSync(0, 'utf8')));
const db = openDb(join(loadConfig().dataDir, 'cogniate.db'));
const out: Record<string, unknown> = {};
for (const u of input.users) {
  const now = Date.now();
  const library = ensureLibrary(db, u.library, now);
  const existing = findUserByEmail(db, u.email);
  const same = existing !== undefined && existing.libraryId === library.id && existing.name === u.name && existing.role === u.role
    && (await verifyPassword(u.password, existing.passwordHash));
  const user = same ? existing : await upsertUser(db, { email: u.email, name: u.name, role: u.role, libraryId: library.id, password: u.password }, now);
  out[user.email] = { id: user.id, email: user.email, name: user.name, role: user.role, library };
}
db.close();
process.stdout.write(`${JSON.stringify({ users: out })}\n`);
