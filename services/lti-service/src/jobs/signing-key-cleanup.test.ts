import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JobContext, SqliteDb } from '@cogniate/shared';
import { applyMigrations, openSqlite } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { listSigningKeys, publicJwks } from '../store/tool-keys.ts';
import { capturingLogger } from '../testkit.ts';
import { signingKeyCleanupJob } from './signing-key-cleanup.ts';

const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-10-22T10:00:00Z');
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const temps: string[] = [];
const databases: SqliteDb[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  for (const temp of temps.splice(0)) rmSync(temp, { recursive: true, force: true });
});
function temp() { const dir = mkdtempSync(join(tmpdir(), 'signing-key-')); temps.push(dir); return dir; }
function context(now: number): JobContext {
  return { instanceId: 'unit', bootId: 'unit', leaseOwner: 'unit/unit', traceId: 'unit', now: () => now,
    logger: capturingLogger().logger, signal: new AbortController().signal };
}
const pub = (kid: string) => ({ kid, kty: 'RSA', alg: 'RS256', use: 'sig', n: 'unit', e: 'AQAB' });

describe('signing-key-cleanup', () => {
  it('AC-LA-E5-10-11: remove at 30 days, keep at 29 days, preserve public data and make repeat runs harmless', async () => {
    const db = openDb(join(temp(), 'lti.db')); databases.push(db);
    ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.test' });
    const insert = db.prepare(`INSERT INTO tool_key (kid, tool_account_id, public_jwk, private_jwk_encrypted,
      status, created_at, published_at, activated_at, retired_at) VALUES (?, 'cogniate', ?, ?, ?, ?, ?, ?, ?)`);
    for (const [kid, status, retiredAt] of [['expired', 'retired', T0 - 30 * DAY], ['young', 'retired', T0 - 29 * DAY], ['active', 'active', null], ['next', 'next', null]] as const) {
      insert.run(kid, JSON.stringify(pub(kid)), Buffer.from('sealed-fixture'), status, T0 - 60 * DAY, T0 - 60 * DAY,
        status === 'next' ? null : T0 - 60 * DAY, retiredAt);
    }
    const before = db.prepare('SELECT * FROM tool_key WHERE kid != ? ORDER BY kid').all('expired');
    const job = signingKeyCleanupJob(db);
    expect([job.name, job.runAtStart, job.everyMs]).toEqual(['signing-key-cleanup', true, DAY]);
    expect(await job.run(context(T0))).toEqual({ result: 'ok', counts: { removed: 1, cleared: 1 } });
    expect(db.prepare('SELECT status, removed_at, length(private_jwk_encrypted) AS bytes, public_jwk FROM tool_key WHERE kid = ?').get('expired'))
      .toEqual({ status: 'removed', removed_at: T0, bytes: 0, public_jwk: JSON.stringify(pub('expired')) });
    expect(db.prepare('SELECT * FROM tool_key WHERE kid != ? ORDER BY kid').all('expired')).toEqual(before);
    expect(await job.run(context(T0 + 1000))).toEqual({ result: 'ok', counts: { removed: 0, cleared: 0 } });
    expect(listSigningKeys(db, 'cogniate').find((key) => key.kid === 'expired')?.removedAt).toBe(T0);
  });

  it('AC-LA-E5-10-10/12: migration keeps the old public set; first cleanup clears migrated removed blobs', async () => {
    const root = temp(); const oldMigrations = join(root, 'migrations'); mkdirSync(oldMigrations);
    for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql') && name < '009')) {
      copyFileSync(join(MIGRATIONS, file), join(oldMigrations, file));
    }
    const db = openSqlite(join(root, 'lti.db'), oldMigrations); databases.push(db);
    ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.test' });
    const insert = db.prepare(`INSERT INTO tool_key (kid, tool_account_id, public_jwk, private_jwk_encrypted, status, created_at)
      VALUES (?, 'cogniate', ?, ?, ?, ?)`);
    for (const [kid, status, age] of [['active', 'active', 60], ['recent', 'retired', 10], ['old', 'retired', 40], ['boundary', 'retired', 30]] as const) {
      insert.run(kid, JSON.stringify(pub(kid)), Buffer.from('sealed-fixture'), status, T0 - age * DAY);
    }
    const before = db.prepare(`SELECT public_jwk FROM tool_key WHERE tool_account_id = 'cogniate'
      AND (status = 'active' OR created_at > ?) ORDER BY status = 'active' DESC, created_at DESC`).all(T0 - 30 * DAY)
      .map((row) => JSON.parse(String(row.public_jwk)));
    // Only the SQL clock is replaced. The real migration runner applies and checksums the SQL file.
    db.function('unixepoch', { varargs: true }, () => T0 / 1000);
    applyMigrations(db, MIGRATIONS);
    expect(publicJwks(db, 'cogniate', T0)).toEqual(before);
    const records = listSigningKeys(db, 'cogniate');
    expect(records.find((key) => key.kid === 'active')).toMatchObject({ publishedAt: T0 - 60 * DAY, activatedAt: T0 - 60 * DAY });
    expect(records.find((key) => key.kid === 'recent')).toMatchObject({ status: 'retired', retiredAt: T0 });
    for (const kid of ['old', 'boundary']) {
      expect(records.find((key) => key.kid === kid)).toMatchObject({ status: 'removed', removedAt: T0 });
      expect(db.prepare('SELECT length(private_jwk_encrypted) AS bytes FROM tool_key WHERE kid = ?').get(kid)?.bytes).toBeGreaterThan(0);
    }
    expect(await signingKeyCleanupJob(db).run(context(T0 + 1))).toEqual({ result: 'ok', counts: { removed: 0, cleared: 2 } });
    expect(db.prepare("SELECT length(private_jwk_encrypted) AS bytes, removed_at FROM tool_key WHERE status = 'removed'").all())
      .toEqual([{ bytes: 0, removed_at: T0 }, { bytes: 0, removed_at: T0 }]);
    expect(publicJwks(db, 'cogniate', T0 + 1)).toEqual(before);
  });
});
