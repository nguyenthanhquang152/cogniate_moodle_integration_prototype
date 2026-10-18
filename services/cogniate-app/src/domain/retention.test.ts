import { encrypt } from '@cogniate/shared';
import { describe, expect, it } from 'vitest';
import { TEST_MASTER_KEY } from '../testkit.ts';
import { openDb } from './db.ts';
import { DAY_MS, cleanupExpired } from './retention.ts';

describe('retention cleanup (data-model §2.1, A-T4b2-02)', () => {
  it('deletes old handoffs, pickers and play sessions; keeps session time and unclaimed picks', () => {
    const db = openDb(':memory:');
    const now = 100 * DAY_MS;
    db.exec(`INSERT INTO library VALUES ('lib_1', 'L', 0);
      INSERT INTO connection (id, library_id, name, site_url, method, status, created_at, updated_at) VALUES ('con_1', 'lib_1', 'M', 'https://moodle.test', 'manual', 'connected', 0, 0);
      INSERT INTO course VALUES ('crs_1', 'lib_1', 'C', '', 'scorm', 'en', 0);
      INSERT INTO package VALUES ('pkg_1', 'lib_1', 'x', 1, 1, 'packages/pkg_1', 0);
      INSERT INTO course_version VALUES ('ver_1', 'crs_1', 1, 'scorm12', 'pkg_1', '{}', '{}', 0);
      INSERT INTO publication VALUES ('pub_1', 'con_1', 'crs_1', 'ver_1', 'available', 0, 0);
      INSERT INTO resource_link (id, connection_id, publication_id, deployment_id, context_id, resource_link_id, context_title, title, created_at, updated_at)
        VALUES ('rl_1', 'con_1', 'pub_1', '1', '2', '3', 'c', 't', 0, 0);
      INSERT INTO attempt (id, resource_link_id, user_sub, course_version_id, preview, created_at, updated_at) VALUES ('att_1', 'rl_1', '5', 'ver_1', 0, 0, 0);`);
    const ins = db.prepare('INSERT INTO handoff VALUES (?, ?)');
    ins.run('old', now - 2 * DAY_MS - 1); // expired (used + 24 h) more than 24 h ago
    ins.run('new', now - 2 * DAY_MS + 60_000);
    const pick = db.prepare(`INSERT INTO picker_session (id, connection_id, ltik_encrypted, issuer_origin, deployment_id, context_id, context_title, created_at, expires_at, used_at, publication_id, resource_link_id)
      VALUES (?, 'con_1', ?, 'https://moodle.test', '1', '2', 'c', 0, ?, ?, ?, ?)`);
    pick.run('p-unused-old', encrypt(TEST_MASTER_KEY, 'l'), now - DAY_MS - 1, null, null, null);
    pick.run('p-linked-old', encrypt(TEST_MASTER_KEY, 'l'), now - DAY_MS - 1, 1, 'pub_1', 'rl_1');
    pick.run('p-unclaimed-old', encrypt(TEST_MASTER_KEY, 'l'), now - DAY_MS - 1, 1, 'pub_1', null);
    pick.run('p-fresh', encrypt(TEST_MASTER_KEY, 'l'), now + 1000, null, null, null);
    const play = db.prepare(`INSERT INTO play_session (id, attempt_id, runtime_token_hash, session_id, roles, created_at, expires_at, max_session_time_cs) VALUES (?, 'att_1', ?, 's', '[]', 0, ?, ?)`);
    play.run('ps-old', 'h1', now - DAY_MS - 1, 3000);
    play.run('ps-new', 'h2', now + 1000, 500);

    expect(cleanupExpired(db, now)).toEqual([{ table: 'handoff', deleted: 1 }, { table: 'picker_session', deleted: 2 }, { table: 'play_session', deleted: 1 }]);
    expect(db.prepare('SELECT ltik_hash FROM handoff').all().map((r) => r.ltik_hash)).toEqual(['new']);
    const left = db.prepare('SELECT id, length(ltik_encrypted) AS n FROM picker_session ORDER BY id').all();
    expect(left.map((r) => r.id)).toEqual(['p-fresh', 'p-unclaimed-old']);
    expect([Number(left[0]!.n) > 0, Number(left[1]!.n)]).toEqual([true, 0]); // the kept old pick has no ltik
    expect(db.prepare('SELECT archived_session_time_cs AS a FROM attempt').get()!.a).toBe(3000);
    expect(cleanupExpired(db, now).every((r) => r.deleted === 0)).toBe(true); // nothing twice
  });
});
