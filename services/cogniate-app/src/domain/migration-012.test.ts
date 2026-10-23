// Supplemental upgrade evidence. Independent populated 011 acceptance remains QA's host route.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { insertAttempt, insertGrant, recordRef, writeApproval, writeReservation } from './bindings.ts';
import { createConnection, getConnectionAnyLibrary, routeLaunch } from './connections.ts';
import type { Db } from './db.ts';
import { MigrationChangedError, openDb } from './db.ts';

const migrations = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const allRows = (db: Db, table: string) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();

function legacy(version: '010' | '011') {
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-migration-'));
  dirs.push(dir);
  const old = join(dir, 'old');
  mkdirSync(old);
  for (const name of readdirSync(migrations).filter((n) => n.slice(0, 3) <= version)) copyFileSync(join(migrations, name), join(old, name));
  const file = join(dir, 'app.db');
  const db = openDb(file, old);
  db.prepare("INSERT INTO library VALUES ('lib_a', 'Library A', 1)").run();
  return { db, file, old };
}

function insertOldConnection(db: Db, id: string, status: string, lms = 'moodle') {
  db.prepare(`INSERT INTO connection (id, library_id, name, site_url, method, status, lti_platform_id, platform_json, created_at, updated_at)
    VALUES (?, 'lib_a', ?, 'https://school.test', 'manual', ?, ?, ?, 1, 1)`)
    .run(id, id, status, status === 'pending' ? null : `plt_${id}`, status === 'pending' ? null : JSON.stringify({
      id: `plt_${id}`, issuer: 'https://issuer.test', clientId: 'client', deploymentIds: ['dA'], productFamilyCode: lms,
    }));
}

describe('additive 012 on populated old schemas', () => {
  it('v10 Moodle rows keep all old bytes and no snapshot after both migrations', () => {
    const legacyDb = legacy('010');
    insertOldConnection(legacyDb.db, 'moodle', 'connected');
    const before = allRows(legacyDb.db, 'connection')[0]!;
    const ledger = allRows(legacyDb.db, 'schema_migration');
    legacyDb.db.close();
    const db = openDb(legacyDb.file);
    expect(allRows(db, 'connection')[0]).toMatchObject(before);
    expect(getConnectionAnyLibrary(db, 'moodle')).toMatchObject({ lms: 'moodle', profile: 'standard', snapshot: { issuer: null, platformId: null, clientId: null } });
    expect(routeLaunch(db, 'plt_moodle', 'dA')).toMatchObject({ ok: true, connection: { id: 'moodle' } });
    expect(allRows(db, 'schema_migration').slice(0, ledger.length)).toEqual(ledger);
    db.close();
  });

  it('011 upgrade preserves grants, attempts, history, approvals, reservations and stored keys; no backfill or repeat migration', () => {
    const { db: oldDb, file, old } = legacy('011');
    for (const lms of ['moodle', 'canvas', 'blackboard']) {
      for (const status of ['pending', 'registered', 'connected', 'disabled']) {
        const id = `${lms}_${status}`;
        insertOldConnection(oldDb, id, status, lms);
        oldDb.prepare('UPDATE connection SET lms = ?, lti_profile = ? WHERE id = ?').run(lms, lms === 'moodle' ? 'standard' : `${lms}-sim`, id);
      }
    }
    const connectionId = 'blackboard_pending';
    const grant = insertGrant(oldDb, { libraryId: 'lib_a', connectionId, lms: 'blackboard', profile: 'blackboard-sim', purpose: 'initial', siteUrl: 'https://school.test', serviceUrl: 'https://school.test', clientId: 'client', deploymentId: 'dA', note: 'fixture', expiresAt: 1000 }, 'fixture-hash', 1);
    const attempt = insertAttempt(oldDb, { connectionId, grantId: grant, purpose: 'initial', profile: 'blackboard-sim', issuer: 'https://issuer.test', clientId: 'client', deploymentId: 'dA', platformId: 'shared_old' }, 1);
    const ref = recordRef(oldDb, { connectionId, attemptId: attempt.attemptId, grantId: grant, action: 'create', platformId: 'shared_old', deploymentId: 'dA' }, 1);
    writeReservation(oldDb, { connectionId, libraryId: 'lib_a', platformId: 'shared_old', deploymentId: 'dA', bindingRef: ref }, 1);
    writeApproval(oldDb, { connectionId: 'canvas_registered', libraryId: 'lib_a', platformId: 'plt_canvas_registered', deploymentId: 'dA', bindingRef: ref, grantId: grant, approvedAt: 1 });
    oldDb.exec(`INSERT INTO package VALUES ('pkg', 'lib_a', 'hash', 1, 1, 'pkg', 1);
      INSERT INTO course VALUES ('course', 'lib_a', 'Course', '', 'v', 'en', 1);
      INSERT INTO course_version VALUES ('version', 'course', 1, 'html', 'pkg', '{}', '{}', 1);
      INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at)
        VALUES ('pub', 'canvas_registered', 'course', 'version', 'available', 1, 1);
      INSERT INTO resource_link (id, connection_id, publication_id, deployment_id, context_id, resource_link_id, context_title, title, service_key_encrypted, created_at, updated_at)
        VALUES ('rl', 'canvas_registered', 'pub', 'dA', 'ctx', 'rl', 'Context', 'Title', X'01020304', 1, 1)`);
    const tables = ['binding_grant', 'binding_attempt', 'binding_ref_history', 'connection_deployment', 'approved_deployment', 'resource_link'];
    const before = new Map(tables.map((table) => [table, allRows(oldDb, table)]));
    const oldConnections = allRows(oldDb, 'connection');
    const ledger = allRows(oldDb, 'schema_migration');
    oldDb.close();
    let db = openDb(file);
    for (const table of tables) expect(allRows(db, table)).toEqual(before.get(table));
    expect(allRows(db, 'connection')).toEqual(oldConnections.map((c) => ({ ...c, target_issuer: null, target_platform_id: null, target_client_id: null })));
    expect(allRows(db, 'schema_migration').slice(0, ledger.length)).toEqual(ledger);
    expect(allRows(db, 'schema_migration')).toHaveLength(ledger.length + 1);
    const fresh = createConnection(db, 'lib_a', { name: 'New', method: 'manual', lms: 'blackboard', profile: 'blackboard-sim', siteUrl: 'https://new.test', snapshot: { issuer: 'https://issuer.test', platformId: 'new_parent', clientId: 'new_client' } }, null, 2);
    const upgraded = allRows(db, 'schema_migration');
    db.close();
    db = openDb(file);
    expect(allRows(db, 'schema_migration')).toEqual(upgraded);
    expect(getConnectionAnyLibrary(db, fresh.id)?.snapshot).toEqual({ issuer: 'https://issuer.test', platformId: 'new_parent', clientId: 'new_client' });
    for (const table of tables) expect(allRows(db, table)).toEqual(before.get(table));
    db.close();
    expect(() => openDb(file, old)).toThrow(MigrationChangedError);
  });
});
