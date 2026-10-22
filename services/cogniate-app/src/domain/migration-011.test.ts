// Migration 011 on a v10 database with rows (ADR-011 §14, data-model §4.2): old connections stay Moodle connections.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { getConnection, routeLaunch } from './connections.ts';
import { openDb } from './db.ts';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });

describe('011_lms_types on a v10 schema with rows', () => {
  it('keeps every old connection a Moodle standard connection that routes by lti_platform_id', () => {
    const dir = mkdtempSync(join(tmpdir(), 'app-mig-'));
    temps.push(dir);
    const v10 = join(dir, 'v10');
    mkdirSync(v10);
    for (const f of readdirSync(MIGRATIONS).filter((n) => n < '011')) copyFileSync(join(MIGRATIONS, f), join(v10, f));
    const file = join(dir, 'cogniate.db');
    let db = openDb(file, v10);
    db.prepare("INSERT INTO library VALUES ('lib_1', 'L', 0)").run();
    db.prepare(`INSERT INTO connection (id, library_id, name, site_url, method, status, lti_platform_id, platform_json, created_at, updated_at)
      VALUES ('con_1', 'lib_1', 'Dev Moodle', 'https://moodle.test', 'dynamic', 'connected', 'plt_1', ?, 0, 0)`)
      .run(JSON.stringify({ id: 'plt_1', issuer: 'https://moodle.test', clientId: 'c', deploymentIds: ['1'], productFamilyCode: 'moodle' }));
    db.prepare("INSERT INTO picker_session (id, connection_id, ltik_encrypted, issuer_origin, deployment_id, context_id, context_title, created_at, expires_at) VALUES ('pck', 'con_1', X'00', 'https://moodle.test', '1', '2', 'C', 0, 1)").run();
    db.close();
    db = openDb(file);
    expect(getConnection(db, 'lib_1', 'con_1')).toMatchObject({ channel: 'moodle', profile: 'standard', serviceUrl: 'https://moodle.test', ltiBindingRef: null, redeemingAttempt: null });
    expect(routeLaunch(db, 'plt_1', '1')).toMatchObject({ ok: true, connection: { id: 'con_1' } });
    expect(db.prepare("SELECT site_origin, issuer_origin FROM picker_session WHERE id = 'pck'").get()).toEqual({ site_origin: null, issuer_origin: 'https://moodle.test' });
    db.close();
  });
});
