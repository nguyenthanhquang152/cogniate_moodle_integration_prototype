// UNIT AC-LA-E1-06-01/-02: copies of populated pre-011, 011 and 012 fixture schemas.
// Seed with old SQL, never with the current writers: a writer change must not change an upgrade fixture.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from './db.ts';
import { MigrationChangedError, openDb } from './db.ts';

const migrations = fileURLToPath(new URL('./migrations/', import.meta.url));
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const rows = (db: Db, table: string) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();

function fixture(version: '010' | '011' | '012') {
  const dir = mkdtempSync(join(tmpdir(), 'channel-migration-'));
  dirs.push(dir);
  const old = join(dir, 'old');
  mkdirSync(old);
  for (const name of readdirSync(migrations).filter((name) => name.slice(0, 3) <= version)) copyFileSync(join(migrations, name), join(old, name));
  const source = join(dir, 'source.db');
  const db = openDb(source, old);
  db.exec("INSERT INTO library VALUES ('lib_fixture', 'Library', 1)");
  let seq = 0;
  for (const lms of version === '010' ? ['moodle'] : ['moodle', 'canvas', 'blackboard']) {
    for (const status of ['pending', 'registered', 'connected', 'disabled']) {
      const id = `${lms}_${status}`;
      db.prepare(`INSERT INTO connection (id, library_id, name, site_url, method, status, lti_platform_id, platform_json, created_at, updated_at)
        VALUES (?, 'lib_fixture', ?, 'https://school.test', 'manual', ?, ?, ?, 1, 2)`)
        .run(id, id, status, status === 'pending' ? null : `plt_${id}`, status === 'pending' ? null : JSON.stringify({ id: `plt_${id}`, issuer: 'https://school.test', clientId: id, deploymentIds: ['d'], productFamilyCode: lms }));
      if (version === '010') continue;
      db.prepare('UPDATE connection SET lms = ?, lti_profile = ? WHERE id = ?').run(lms, lms === 'moodle' ? 'standard' : `${lms}-sim`, id);
      if (version === '012' && lms !== 'moodle') {
        db.prepare('UPDATE connection SET target_issuer = ?, target_platform_id = ?, target_client_id = ? WHERE id = ?')
          .run('https://issuer.test', lms === 'blackboard' ? 'shared' : null, lms === 'blackboard' ? 'client' : null, id);
      }
      if (lms === 'moodle') continue;
      for (const purpose of lms === 'canvas' ? ['initial', 'add_deployment'] : ['initial']) {
        seq++;
        db.prepare(`INSERT INTO binding_grant (id, code_hash, library_id, connection_id, lms, lti_profile, purpose, site_url,
          service_url, client_id, deployment_id, note, created_at, expires_at) VALUES (?, ?, 'lib_fixture', ?, ?, ?, ?, 'https://school.test',
          'https://school.test', 'client', 'd', 'fixture', 1, 1000)`)
          .run(`grt_${seq}`, `hash_${seq}`, id, lms, `${lms}-sim`, purpose);
        db.prepare(`INSERT INTO binding_attempt (attempt_id, seq, connection_id, grant_id, purpose, lti_profile, issuer, client_id,
          deployment_id, lti_platform_id, history_floor, state, started_at) VALUES (?, ?, ?, ?, ?, ?, 'https://issuer.test', 'client', 'd', ?, 0, ?, 1)`)
          .run(`att_${seq}`, seq, id, `grt_${seq}`, purpose, `${lms}-sim`, lms === 'blackboard' ? 'shared' : null,
            ['open', 'committed', 'cancelled', 'failed', 'abandoned'][seq % 5]!);
      }
    }
  }
  const before = { connections: rows(db, 'connection'), ledger: rows(db, 'schema_migration'),
    attempts: version === '010' ? [] : rows(db, 'binding_attempt'), grants: version === '010' ? [] : rows(db, 'binding_grant') };
  db.close();
  const copy = join(dir, 'upgraded.db');
  copyFileSync(source, copy);
  return { old, copy, source, before };
}

describe('013 channel migration', () => {
  it.each(['010', '011', '012'] as const)('backfills a copy of the populated %s fixture and keeps all old values', (version) => {
    const { copy, source, old, before } = fixture(version);
    let db = openDb(copy);
    const connections = rows(db, 'connection');
    expect(connections).toHaveLength(before.connections.length);
    for (const [index, row] of connections.entries()) {
      expect(row).toMatchObject(before.connections[index]!);
      expect(row.channel).toBe(row.lms);
      expect(row.binding_authority).toBe(row.lms === 'moodle' ? 'self' : 'operatorGrant');
    }
    expect(rows(db, 'binding_attempt')).toEqual(before.attempts.map((row) => ({ ...row,
      target_kind: String(row.connection_id).startsWith('blackboard_') ? 'shared_deployment' : row.purpose === 'add_deployment' ? 'platform_deployment' : 'exclusive_platform',
    })));
    expect(rows(db, 'binding_grant')).toEqual(before.grants.map((row) => ({ ...row, bound_values: null })));
    const ledger = rows(db, 'schema_migration');
    expect(ledger.slice(0, before.ledger.length)).toEqual(before.ledger);
    expect(ledger.find((row) => String(row.name).startsWith('013_'))?.name).toBe('013_channel_kernel.sql');
    db.close();
    db = openDb(copy);
    expect(rows(db, 'schema_migration')).toEqual(ledger);
    expect(rows(db, 'connection')).toEqual(connections);
    db.close();
    const unchanged = openDb(source, old);
    expect(rows(unchanged, 'connection')).toEqual(before.connections);
    unchanged.close();
  });

  it('a 012 build refuses a database with the 013 ledger', () => {
    const { copy, old } = fixture('012');
    const db = openDb(copy);
    db.close();
    expect(() => openDb(copy, old)).toThrow(MigrationChangedError);
  });
});
