import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../domain/db.ts';
import { upsertResourceLink } from '../../domain/launch.ts';
import { platformPartition } from '../../drivers/lti-ags/partition.ts';
import { externalKey } from './placements.ts';
import { seedAttempt, seedBase, seedLink } from './records.testkit.ts';

const migrations = fileURLToPath(new URL('../../domain/migrations/', import.meta.url));
const migration = '014_learning_records.sql';
describe('records migration', () => {
  it('AC-LA-E4-02-01: backfills every source column, partition branch, and equal-time insertion order without changing legacy rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'record-migration-'));
    let db: ReturnType<typeof openDb> | undefined;
    try {
      for (const file of readdirSync(migrations).filter((f) => f < migration)) copyFileSync(join(migrations, file), join(dir, file));
      db = openDb(join(dir, 'app.db'), dir);
      seedBase(db);
      const contexts = ['context', '', 'quote"\\\n\t', 'context'];
      const partitions = ['platform', 'shared:deployment', 'released:deployment', 'fallback'];
      for (let i = 0; i < 4; i++) {
        const con = i === 0 ? 'con' : ['shared', 'released', 'fallback'][i - 1]!;
        if (i) {
          db.prepare(`INSERT INTO connection (id, library_id, name, site_url, method, status, channel, binding_authority,
            target_platform_id, created_at, updated_at) VALUES (?, 'lib', 'Shared', 'https://school.test', 'manual', 'disabled',
            'blackboard', 'operatorGrant', ?, 0, 0)`).run(con, i === 2 ? 'released' : null);
          db.prepare(`INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at)
            VALUES (?, ?, 'crs', 'ver', 'available', 0, 0)`).run(`pub_${i}`, con);
        }
        if (i === 1) db.exec(`INSERT INTO connection_deployment (lti_platform_id, deployment_id, connection_id, library_id, created_at, updated_at)
          VALUES ('shared', 'deployment', 'shared', 'lib', 0, 0)`);
        seedLink(db, `rl_${i}`, con, i === 0 ? 'pub' : `pub_${i}`, contexts[i]);
        seedAttempt(db, String(i), `rl_${i}`);
        db.prepare("UPDATE attempt SET outcome = 'passed' WHERE id = ?").run(`att_${i}`);
        for (const [n, status] of ['pending', 'sent', 'conflict', 'failed', 'superseded'].entries()) {
          // Reverse ids expose accidental id sorting when created_at is equal.
          db.prepare(`INSERT INTO score_sync (id, attempt_id, resource_link_id, user_sub, payload, score_given, score_maximum,
            status, tries, created_at, next_try_at, sent_at, last_error, resent_at, send_started_at, delivery_uncertain, confirmation_after, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 100, ?, ?, 1000, ?, ?, ?, ?, ?, ?, ?, 2000)`)
            .run(`sync_${i}_${9 - n}`, `att_${i}`, `rl_${i}`, String(i), JSON.stringify({ userId: String(i), scoreGiven: n * 20 }),
              n * 20, status, n, status === 'pending' ? 1800 : null, status === 'sent' ? 1500 : null,
              n ? `error ${n}` : null, n % 2 ? 1400 : null, n % 2 ? 1600 : null, n % 2, n === 0 ? 1700 : null);
        }
      }
      const before = db.prepare('SELECT * FROM score_sync ORDER BY rowid').all();
      const links = db.prepare('SELECT * FROM resource_link ORDER BY id').all();
      db.close(); db = undefined;
      copyFileSync(join(migrations, migration), join(dir, migration));
      db = openDb(join(dir, 'app.db'), dir);
      const dispatches = db.prepare('SELECT * FROM record_dispatch ORDER BY seq').all();
      expect(dispatches).toHaveLength(before.length);
      const state = ['id', 'payload', 'score_given', 'score_maximum', 'status', 'tries', 'created_at', 'next_try_at', 'sent_at',
        'last_error', 'resent_at', 'send_started_at', 'delivery_uncertain', 'confirmation_after', 'updated_at'];
      for (const [index, old] of before.entries()) {
        const d = dispatches[index]!;
        for (const column of state) expect(d[column], `${old.id}.${column}`).toEqual(old[column]);
        expect(d).toMatchObject({ seq: index + 1, reporter: 'lti-ags', placement_id: old.resource_link_id, learner_subject: old.user_sub,
          lease_owner: null, lease_until: null, not_before: null, partition_key: partitions[Number(old.user_sub)] });
        const record = db.prepare('SELECT * FROM learning_record WHERE id = ?').get(`rec_${String(old.id).slice(5)}`);
        expect(record).toEqual({ id: `rec_${String(old.id).slice(5)}`, attempt_id: old.attempt_id, placement_id: old.resource_link_id,
          learner_subject: old.user_sub, course_version_id: 'ver', kind: 'final', outcome: 'passed', score_given: old.score_given,
          score_maximum: old.score_maximum, occurred_at: old.created_at, created_at: old.created_at, started_at: null, submitted_at: null });
      }
      for (const [i, rl] of links.entries()) {
        expect(db.prepare('SELECT * FROM placement WHERE id = ?').get(String(rl.id))).toEqual({ id: rl.id, connection_id: rl.connection_id,
          publication_id: rl.publication_id, external_key: JSON.stringify(['deployment', contexts[i], rl.resource_link_id]),
          graded: 1, created_at: rl.created_at, updated_at: rl.updated_at });
        expect(platformPartition(db, String(rl.id))).toBe(partitions[i]);
      }
      expect(db.prepare('SELECT * FROM score_sync ORDER BY rowid').all()).toEqual(before);
      const launch = upsertResourceLink(db, { connectionId: 'con', publicationId: 'pub', deploymentId: 'deployment', contextId: 'context',
        resourceLinkId: 'rl_0', contextTitle: 'Changed', title: 'Changed', lineItemId: null, sealServiceKey: null }, 3000);
      expect(launch).toEqual({ id: 'rl_0', created: false, rebound: null });
      expect(db.prepare('SELECT count(*) AS n FROM placement').get()!.n).toBe(links.length);
    } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  it('AC-LA-E4-02-02: one runtime key encoder equals SQLite json_array for empty and escaped strings', () => {
    const db = openDb(':memory:');
    try {
      for (const parts of [['d', '', 'r'], ['"\\\n\t\b\f\r', 'é 😀', '\u0000\u0001/'], ['deployment', 'context', 'resource']] as const) {
        expect(externalKey(parts[0], parts[1], parts[2])).toBe(db.prepare('SELECT json_array(?, ?, ?) AS value').get(...parts)!.value);
      }
    } finally { db.close(); }
  });
});
