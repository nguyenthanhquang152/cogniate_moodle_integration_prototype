import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { QueueJob } from '@cogniate/shared';
import type { QueueStoreFixture } from '@cogniate/shared/jobs.testkit';
import { openDb, type Db } from '../../domain/db.ts';
import { createAppJobStore } from './job-store.ts';
import { ltiAgsPolicy } from '../../drivers/lti-ags/index.ts';
import { createDispatchQueue, type DispatchItem } from './outbox.ts';
import { upsertPlacement } from './placements.ts';
import type { RecordReporter } from './types.ts';

/** A reporter with the lti-ags policy and log names, one fixed partition and the given transport. */
export function testReporter(deliver: RecordReporter['deliver'], partition = 'fixture-platform'): RecordReporter {
  return { ...ltiAgsPolicy, partitionKey: () => partition, deliver };
}

export function seedBase(db: Db): void {
  db.exec(`INSERT INTO library (id, name, created_at) VALUES ('lib', 'Library', 0);
    INSERT INTO course (id, library_id, title, summary, variant, lang, created_at) VALUES ('crs', 'lib', 'Course', '', 'default', 'en', 0);
    INSERT INTO package (id, library_id, sha256, total_bytes, file_count, storage_path, created_at) VALUES ('pkg', 'lib', 'x', 1, 1, 'p', 0);
    INSERT INTO course_version (id, course_id, version, format, package_id, validation_report, tracking_profile, created_at)
      VALUES ('ver', 'crs', 1, 'scorm12', 'pkg', '{}', '{}', 0);
    INSERT INTO connection (id, library_id, name, site_url, method, status, lti_platform_id, channel, binding_authority, created_at, updated_at)
      VALUES ('con', 'lib', 'Connection', 'https://school.test', 'manual', 'connected', 'platform', 'moodle', 'self', 0, 0);
    INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at)
      VALUES ('pub', 'con', 'crs', 'ver', 'available', 0, 0);`);
}

export function seedLink(db: Db, id: string, connection = 'con', publication = 'pub', context = 'context'): void {
  db.prepare(`INSERT INTO resource_link (id, connection_id, publication_id, deployment_id, context_id, resource_link_id,
    context_title, title, created_at, updated_at) VALUES (?, ?, ?, 'deployment', ?, ?, 'Course', 'Activity', 100, 200)`)
    .run(id, connection, publication, context, id);
}

export function seedAttempt(db: Db, key: string, placement: string, preview = false): void {
  db.prepare(`INSERT INTO attempt (id, resource_link_id, user_sub, course_version_id, preview, outcome, created_at, updated_at)
    VALUES (?, ?, ?, 'ver', ?, 'in_progress', 0, 0)`).run(`att_${key}`, placement, key, preview ? 1 : 0);
}

/** Keep the old worker fixture's values while using the migrated tables. */
export function seedLegacyDispatch(db: Db, row: { id: string; attemptId: string; tries: number; createdAt: number; nextTryAt: number }): void {
  const a = db.prepare('SELECT * FROM attempt WHERE id = ?').get(row.attemptId)!;
  upsertPlacement(db, String(a.resource_link_id));
  db.prepare(`INSERT INTO learning_record (id, attempt_id, placement_id, learner_subject, course_version_id, kind, outcome,
    score_given, score_maximum, occurred_at, created_at) SELECT ?, id, resource_link_id, user_sub, course_version_id,
    'final', outcome, score_given, score_maximum, ?, ? FROM attempt WHERE id = ?`).run(`rec_${row.id}`, row.createdAt, row.createdAt, row.attemptId);
  db.prepare(`INSERT INTO record_dispatch (seq, id, record_id, reporter, placement_id, learner_subject, partition_key, payload,
    score_given, score_maximum, status, tries, created_at, next_try_at, updated_at)
    SELECT (SELECT COALESCE(MAX(seq), 0) + 1 FROM record_dispatch), ?, ?, 'lti-ags', resource_link_id, user_sub, 'fixture-platform', '{}', score_given, score_maximum,
    'pending', ?, ?, ?, 0 FROM attempt WHERE id = ?`)
    .run(row.id, `rec_${row.id}`, row.tries, row.createdAt, row.nextTryAt, row.attemptId);
}

/** App migration and shipped outbox, with one real SQLite connection per runner. */
export function recordsFixture(): QueueStoreFixture & { db: Db } {
  const dir = mkdtempSync(join(tmpdir(), 'app-records-'));
  const file = join(dir, 'app.db');
  const connections: Db[] = [];
  const open = () => { const db = openDb(file); connections.push(db); return db; };
  const db = open();
  seedBase(db);
  let sequence = 0;
  const keys = new Set<string>();
  const num = (v: unknown) => v === null ? null : Number(v);
  return {
    db, confirmationDelayMs: 5000,
    store: () => createAppJobStore(open()),
    queueJob: (send) => createDispatchQueue(open(), [testReporter(async (row, ctx) => {
      if (ctx.beginSend() !== 'started') return null;
      await send(row.id);
      return { kind: 'accepted' };
    })]) as QueueJob<unknown>,
    itemId: (item) => (item as DispatchItem).id,
    addRow(row) {
      if (!keys.has(row.key)) {
        seedLink(db, `rl_${row.key}`);
        upsertPlacement(db, `rl_${row.key}`);
        seedAttempt(db, row.key, `rl_${row.key}`);
        keys.add(row.key);
      }
      const id = `sync_${++sequence}`;
      db.prepare(`INSERT INTO learning_record (id, attempt_id, placement_id, learner_subject, course_version_id, kind, outcome,
        score_given, score_maximum, occurred_at, created_at) VALUES (?, ?, ?, ?, 'ver', 'final', 'completed', ?, 1, ?, ?)`)
        .run(`rec_${sequence}`, `att_${row.key}`, `rl_${row.key}`, row.key, row.score, Date.now(), Date.now());
      db.prepare(`INSERT INTO record_dispatch (seq, id, record_id, reporter, placement_id, learner_subject, partition_key, payload,
        score_given, score_maximum, status, created_at, updated_at, next_try_at, lease_owner, lease_until, send_started_at)
        VALUES ((SELECT COALESCE(MAX(seq), 0) + 1 FROM record_dispatch), ?, ?, 'lti-ags', ?, ?, ?, '{}', ?, 1, 'pending', ?, ?, ?, ?, ?, ?)`)
        .run(id, `rec_${sequence}`, `rl_${row.key}`, row.key, row.partition, row.score, Date.now(), Date.now(), row.nextTryAt,
          row.leaseOwner ?? null, row.leaseUntil ?? null, row.sendStartedAt ?? null);
      return id;
    },
    readRow(id) {
      const r = db.prepare('SELECT * FROM record_dispatch WHERE id = ?').get(id)!;
      return { status: String(r.status), tries: Number(r.tries), nextTryAt: num(r.next_try_at),
        leaseOwner: r.lease_owner === null ? null : String(r.lease_owner), leaseUntil: num(r.lease_until),
        sendStartedAt: num(r.send_started_at), deliveryUncertain: r.delivery_uncertain === 1, confirmationAfter: num(r.confirmation_after) };
    },
    close() { for (const connection of connections) connection.close(); rmSync(dir, { recursive: true, force: true }); },
  };
}
