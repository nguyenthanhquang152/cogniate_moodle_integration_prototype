import type { RecordReporter } from './types.ts';
import { registerRecordReporters } from './records.ts';
import { ltiAgsPolicy } from '../../drivers/lti-ags/index.ts';
import { describe, expect, it } from 'vitest';
import type { TrackingProfile } from '@cogniate/package-inspector';
import { applyCommit, findRuntimeSession } from '../../domain/attempts.ts';
import { openDb } from '../../domain/db.ts';
import { publicationResults } from '../../domain/results.ts';
import { TEST_CHANNELS } from '../../testkit.ts';
import { upsertPlacement } from './placements.ts';
import { seedAttempt, seedBase, seedLink, testReporter } from './records.testkit.ts';

function fixture(preview = false, format: 'html' | 'scorm12' = 'scorm12', context = 'context') {
  const db = openDb(':memory:'); seedBase(db); seedLink(db, 'rl', 'con', 'pub', context); upsertPlacement(db, 'rl'); seedAttempt(db, 'user', 'rl', preview);
  registerRecordReporters(db, [testReporter(async () => { throw new Error('No sends in commit tests'); })]);
  const profile: TrackingProfile = { format, launchPath: 'index.html', pages: ['index.html', 'page.html'], menuPage: null,
    questionIds: [], masteryScore: 70, minDwellMs: 0 };
  db.prepare('UPDATE course_version SET format = ?, tracking_profile = ?').run(format, JSON.stringify(profile));
  db.exec(`INSERT INTO play_session (id, attempt_id, runtime_token_hash, session_id, roles, created_at, expires_at)
    VALUES ('play', 'att_user', 'token', 'session', '[]', 0, 999999)`);
  let seq = 0;
  return { db, commit(data: Record<string, unknown>, now = 1000) {
    return applyCommit(db, findRuntimeSession(db, 'token', TEST_CHANNELS)!, { kind: format, sessionId: 'session', seq: ++seq, ...data }, now);
  } };
}

describe('final records', () => {
  it('AC-LA-E4-02-03: T5a best-result sequence keeps the golden dispatch rows and writes immutable facts only on improvement', () => {
    const { db, commit } = fixture();
    try {
      const score = (raw: number, status = 'passed') => commit({ event: 'commit', cmi: { core: { lesson_status: status,
        score: { raw: String(raw), min: '0', max: '100' }, session_time: '0000:00:01.00' } } });
      expect(score(0, 'incomplete')).toMatchObject({ ok: true, syncId: null });
      expect(score(40, 'failed')).toMatchObject({ ok: true, scoreGiven: 40 });
      expect(score(80)).toMatchObject({ ok: true, scoreGiven: 80 });
      expect(score(80)).toMatchObject({ ok: true, syncId: null });
      expect(score(30, 'failed')).toMatchObject({ ok: true, syncId: null, scoreGiven: 80 });
      const rows = db.prepare('SELECT status, score_given, score_maximum, tries, payload FROM record_dispatch ORDER BY seq').all();
      expect(rows).toEqual([40, 80].map((n) => ({ status: n === 40 ? 'superseded' : 'pending', score_given: n, score_maximum: 100, tries: 0,
        payload: JSON.stringify({ userId: 'user', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: n, scoreMaximum: 100 }) })));
      expect(db.prepare("SELECT kind, outcome, score_given FROM learning_record WHERE kind = 'final' ORDER BY score_given").all())
        .toEqual([{ kind: 'final', outcome: 'failed', score_given: 40 }, { kind: 'final', outcome: 'passed', score_given: 80 }]);
      expect(db.prepare('SELECT * FROM score_sync').all()).toEqual([]);
    } finally { db.close(); }
  });

  it('AC-LA-E4-02-03: T5b HTML completion and repeated unload keep one golden dispatch; previews keep none', () => {
    for (const preview of [false, true]) {
      const { db, commit } = fixture(preview, 'html');
      try {
        expect(commit({ event: 'progress', progress: { seenPages: ['index.html'], answers: {} } })).toMatchObject({ ok: true, syncId: null });
        expect(commit({ event: 'progress', progress: { seenPages: ['index.html', 'page.html'], answers: {} } })).toMatchObject({ ok: true, outcome: 'completed' });
        expect(commit({ event: 'unload', progress: { seenPages: ['index.html', 'page.html'], answers: {} } })).toMatchObject({ ok: true, syncId: null });
        expect(db.prepare('SELECT status, score_given, score_maximum FROM record_dispatch').all()).toEqual(preview ? [] : [{ status: 'pending', score_given: 100, score_maximum: 100 }]);
        expect(db.prepare("SELECT count(*) AS n FROM learning_record WHERE kind = 'final'").get()!.n).toBe(preview ? 0 : 1);
        if (preview) expect(db.prepare('SELECT count(*) AS n FROM learning_record').get()!.n).toBe(0);
      } finally { db.close(); }
    }
  });

  it('AC-LA-E4-02-11: a placement without context shows the course name dash', () => {
    const { db } = fixture(false, 'scorm12', '');
    try { expect(publicationResults(db, { connectionId: 'con', courseId: 'crs' }, TEST_CHANNELS)[0]!.activity.contextTitle).toBe('—'); }
    finally { db.close(); }
  });
});

/** The records of the attempt in write order (one commit writes started, progressed, submitted, final). */
function recordsOf(db: ReturnType<typeof openDb>) {
  return db.prepare(`SELECT kind, outcome, score_given, started_at, submitted_at, occurred_at FROM learning_record
    ORDER BY occurred_at, CASE kind WHEN 'started' THEN 0 WHEN 'progressed' THEN 1 WHEN 'submitted' THEN 2 ELSE 3 END`).all();
}
const rec = (kind: string, outcome: string, score: number | null, at: number, startedAt: number, submittedAt: number | null) =>
  ({ kind, outcome, score_given: score, started_at: startedAt, submitted_at: submittedAt, occurred_at: at });

describe('progress records (LA-E4-04)', () => {
  it('AC-LA-E4-04-01, AC-LA-E4-04-03: a SCORM attempt from launch to a final result writes started, progressed, submitted and final', () => {
    const { db, commit } = fixture();
    try {
      const cmi = (core: Record<string, unknown>) => ({ cmi: { core: { session_time: '0000:00:01.00', ...core } } });
      commit({ event: 'commit', ...cmi({ lesson_status: 'incomplete', lesson_location: 'p1' }) }, 1000);
      // Trigger: only session values changed (session_time, exit), so the progress did not change.
      commit({ event: 'commit', ...cmi({ lesson_status: 'incomplete', lesson_location: 'p1', session_time: '0000:00:09.00', exit: 'suspend' }) }, 2000);
      commit({ event: 'commit', ...cmi({ lesson_status: 'incomplete', lesson_location: 'p2' }) }, 3000);
      commit({ event: 'finish', ...cmi({ lesson_status: 'passed', lesson_location: 'p2', score: { raw: '80', max: '100' } }) }, 4000);
      commit({ event: 'unload', ...cmi({ lesson_status: 'passed', lesson_location: 'p2', score: { raw: '80', max: '100' }, session_time: '0000:00:30.00' }) }, 5000);
      commit({ event: 'commit', ...cmi({ lesson_status: 'passed', lesson_location: 'p2', score: { raw: '90', max: '100' } }) }, 6000);
      expect(recordsOf(db)).toEqual([
        rec('started', 'in_progress', null, 1000, 1000, null), rec('progressed', 'in_progress', null, 1000, 1000, null),
        rec('progressed', 'in_progress', null, 3000, 1000, null),
        rec('progressed', 'passed', 80, 4000, 1000, 4000), rec('submitted', 'passed', 80, 4000, 1000, 4000), rec('final', 'passed', 80, 4000, 1000, 4000),
        rec('progressed', 'passed', 90, 6000, 1000, 4000), rec('final', 'passed', 90, 6000, 1000, 4000),
      ]);
      // Progress kinds create no dispatch row (AC-LA-E4-04-02 is proved on the simulator; this is its unit side).
      expect(db.prepare('SELECT r.kind, d.score_given, d.status FROM record_dispatch d JOIN learning_record r ON r.id = d.record_id ORDER BY d.seq').all())
        .toEqual([{ kind: 'final', score_given: 80, status: 'superseded' }, { kind: 'final', score_given: 90, status: 'pending' }]);
    } finally { db.close(); }
  });

  it('AC-LA-E4-04-01, AC-LA-E4-04-03: an HTML attempt writes one record set; a repeated unload writes none', () => {
    const { db, commit } = fixture(false, 'html');
    try {
      commit({ event: 'progress', progress: { seenPages: ['index.html'], answers: {} } }, 1000);
      commit({ event: 'progress', progress: { seenPages: ['index.html', 'page.html'], answers: {} } }, 2000);
      commit({ event: 'unload', progress: { seenPages: ['index.html', 'page.html'], answers: {} } }, 3000);
      expect(recordsOf(db)).toEqual([
        rec('started', 'in_progress', null, 1000, 1000, null), rec('progressed', 'in_progress', null, 1000, 1000, null),
        rec('progressed', 'completed', 100, 2000, 1000, 2000), rec('submitted', 'completed', 100, 2000, 1000, 2000), rec('final', 'completed', 100, 2000, 1000, 2000),
      ]);
      expect(db.prepare('SELECT count(*) AS n FROM record_dispatch').get()!.n).toBe(1);
    } finally { db.close(); }
  });

  it('AC-LA-E4-04-01: a resumed session of the same attempt writes no second started record', () => {
    const { db, commit } = fixture();
    try {
      commit({ event: 'commit', cmi: { core: { lesson_status: 'incomplete', lesson_location: 'p1' } } }, 1000);
      db.exec(`INSERT INTO play_session (id, attempt_id, runtime_token_hash, session_id, roles, created_at, expires_at)
        VALUES ('play2', 'att_user', 'token2', 'session2', '[]', 0, 999999)`);
      const resumed = findRuntimeSession(db, 'token2', TEST_CHANNELS)!;
      applyCommit(db, resumed, { kind: 'scorm12', sessionId: 'session2', seq: 1, event: 'commit',
        cmi: { core: { lesson_status: 'incomplete', lesson_location: 'p3', exit: 'suspend' } } }, 2000);
      expect(recordsOf(db)).toEqual([rec('started', 'in_progress', null, 1000, 1000, null), rec('progressed', 'in_progress', null, 1000, 1000, null),
        rec('progressed', 'in_progress', null, 2000, 1000, null)]);
    } finally { db.close(); }
  });

  it('AC-LA-E4-04-03: an attempt that started and was submitted before progress records existed uses the nearest known times', () => {
    const { db, commit } = fixture();
    try {
      // State of an older release: stored CMI, a final best result and the final record that migration 014 copied.
      db.prepare(`UPDATE attempt SET created_at = 100, outcome = 'passed', score_given = 60, score_maximum = 100, cmi_or_progress = ?`)
        .run(JSON.stringify({ core: { lesson_status: 'passed', lesson_location: 'p1', score: { raw: '60', min: '', max: '100' }, session_time: '', exit: '' },
          suspend_data: '', comments: '', interactions: [], objectives: [] }));
      db.exec(`INSERT INTO learning_record (id, attempt_id, placement_id, learner_subject, course_version_id, kind, outcome, score_given, score_maximum, occurred_at, created_at)
        VALUES ('rec_old', 'att_user', 'rl', 'user', 'ver', 'final', 'passed', 60, 100, 500, 500)`);
      commit({ event: 'commit', cmi: { core: { lesson_status: 'passed', lesson_location: 'p2', score: { raw: '75', max: '100' } } } }, 2000);
      expect(recordsOf(db).filter((r) => r.occurred_at === 2000)).toEqual([rec('progressed', 'passed', 75, 2000, 100, 500), rec('final', 'passed', 75, 2000, 100, 500)]);
    } finally { db.close(); }
  });

  /** A final attempt of an older release with no learning record (its score never made a score sync to copy). */
  function legacyFinal(db: ReturnType<typeof openDb>) {
    db.prepare(`UPDATE attempt SET created_at = 100, updated_at = 500, outcome = 'passed', score_given = 60, score_maximum = 100, cmi_or_progress = ?`)
      .run(JSON.stringify({ core: { lesson_status: 'passed', lesson_location: 'p1', score: { raw: '60', min: '', max: '100' }, session_time: '', exit: '' },
        suspend_data: '', comments: '', interactions: [], objectives: [] }));
  }
  const scorm = (location: string, raw: string) => ({ event: 'commit', cmi: { core: { lesson_status: 'passed', lesson_location: location, score: { raw, max: '100' } } } });

  it('AC-LA-E4-04-05: a legacy final attempt without records takes its stored updated_at as the submission time, and keeps it', () => {
    const { db, commit } = fixture();
    try {
      legacyFinal(db);
      commit(scorm('p2', '75'), 2000);
      commit(scorm('p3', '80'), 3000);
      expect(recordsOf(db)).toEqual([
        rec('submitted', 'passed', 60, 500, 100, 500),
        rec('progressed', 'passed', 75, 2000, 100, 500), rec('final', 'passed', 75, 2000, 100, 500),
        rec('progressed', 'passed', 80, 3000, 100, 500), rec('final', 'passed', 80, 3000, 100, 500),
      ]);
      expect(db.prepare("SELECT created_at FROM learning_record WHERE kind = 'submitted'").all()).toEqual([{ created_at: 2000 }]);
      expect(db.prepare('SELECT r.kind FROM record_dispatch d JOIN learning_record r ON r.id = d.record_id').all()).toEqual([{ kind: 'final' }, { kind: 'final' }]);
    } finally { db.close(); }
  });

  it('AC-LA-E4-04-05: the first commit writes the legacy submission even when it changes nothing else', () => {
    const { db, commit } = fixture();
    try {
      legacyFinal(db);
      // Same progress and score: no progressed or final record, but the commit moves updated_at to 2000.
      commit(scorm('p1', '60'), 2000);
      expect(db.prepare('SELECT updated_at FROM attempt').get()).toEqual({ updated_at: 2000 });
      commit(scorm('p2', '60'), 3000);
      expect(recordsOf(db)).toEqual([rec('submitted', 'passed', 60, 500, 100, 500), rec('progressed', 'passed', 60, 3000, 100, 500)]);
    } finally { db.close(); }
  });

  it('previews write no progress record', () => {
    const { db, commit } = fixture(true);
    try {
      commit({ event: 'finish', cmi: { core: { lesson_status: 'passed', score: { raw: '80', max: '100' } } } }, 1000);
      expect(db.prepare('SELECT count(*) AS n FROM learning_record').get()!.n).toBe(0);
    } finally { db.close(); }
  });
});

it('B-LA-E4-02-01/02, B-LA-E4-03-02: one registration call; the reporter instance prepares, partitions and delivers', async () => {
  const { createLogger } = await import('@cogniate/shared');
  const { db, commit } = fixture();
  const delivered: unknown[] = [];
  const reporter: RecordReporter = { ...ltiAgsPolicy,
    prepare: () => ({ neutral: 'payload' }), partitionKey: () => 'chosen-partition',
    async deliver(row, ctx) { delivered.push(row); expect(ctx.beginSend()).toBe('started'); return { kind: 'accepted' }; },
  };
  const job = registerRecordReporters(db, [reporter]);
  try {
    commit({ event: 'finish', cmi: { core: { lesson_status: 'passed', score: { raw: '80', max: '100' } } } });
    const [item] = await job.due(1000, 10);
    expect(item?.partitionKey).toBe('chosen-partition');
    expect(await job.lease(item!, 'a/boot', 61_000, 1000)).toBe(true);
    await job.run(item!, { instanceId: 'a', bootId: 'boot', leaseOwner: 'a/boot', now: () => 1000,
      logger: createLogger({ service: 'test', write: () => {} }), signal: new AbortController().signal, traceId: 'trace' });
    expect(delivered).toEqual([{ id: item!.id, reporter: 'lti-ags', partitionKey: 'chosen-partition', placementId: 'rl',
      learnerSubject: 'user', payload: { neutral: 'payload' }, tries: 0, createdAt: 1000, retryFrom: 1000, confirmationAfter: null }]);
    expect(db.prepare('SELECT status FROM record_dispatch WHERE id = ?').get(item!.id)!.status).toBe('sent');
  } finally { db.close(); }
});
