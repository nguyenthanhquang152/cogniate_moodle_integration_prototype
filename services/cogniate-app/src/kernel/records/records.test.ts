import type { RecordReporter } from './types.ts';
import { configureRecordReporters } from './records.ts';
import { ltiAgsPolicy } from '../../drivers/lti-ags/index.ts';
import { describe, expect, it } from 'vitest';
import type { TrackingProfile } from '@cogniate/package-inspector';
import { applyCommit, findRuntimeSession } from '../../domain/attempts.ts';
import { openDb } from '../../domain/db.ts';
import { publicationResults } from '../../domain/results.ts';
import { TEST_CHANNELS } from '../../testkit.ts';
import { upsertPlacement } from './placements.ts';
import { seedAttempt, seedBase, seedLink } from './records.testkit.ts';

function fixture(preview = false, format: 'html' | 'scorm12' = 'scorm12', context = 'context') {
  const db = openDb(':memory:'); seedBase(db); seedLink(db, 'rl', 'con', 'pub', context); upsertPlacement(db, 'rl'); seedAttempt(db, 'user', 'rl', preview);
  configureRecordReporters(db, [{ ...ltiAgsPolicy, async deliver() { throw new Error('No sends in commit tests'); } }]);
  const profile: TrackingProfile = { format, launchPath: 'index.html', pages: ['index.html', 'page.html'], menuPage: null,
    questionIds: [], masteryScore: 70, minDwellMs: 0 };
  db.prepare('UPDATE course_version SET format = ?, tracking_profile = ?').run(format, JSON.stringify(profile));
  db.exec(`INSERT INTO play_session (id, attempt_id, runtime_token_hash, session_id, roles, created_at, expires_at)
    VALUES ('play', 'att_user', 'token', 'session', '[]', 0, 999999)`);
  let seq = 0;
  return { db, commit(data: Record<string, unknown>) {
    return applyCommit(db, findRuntimeSession(db, 'token', TEST_CHANNELS)!, { kind: format, sessionId: 'session', seq: ++seq, ...data }, 1000);
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
      expect(db.prepare('SELECT kind, outcome, score_given FROM learning_record ORDER BY score_given').all())
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
        expect(db.prepare('SELECT count(*) AS n FROM learning_record').get()!.n).toBe(preview ? 0 : 1);
      } finally { db.close(); }
    }
  });

  it('AC-LA-E4-02-11: a placement without context shows the course name dash', () => {
    const { db } = fixture(false, 'scorm12', '');
    try { expect(publicationResults(db, { connectionId: 'con', courseId: 'crs' }, TEST_CHANNELS)[0]!.activity.contextTitle).toBe('—'); }
    finally { db.close(); }
  });
});

it('B-LA-E4-02-01/02: one registered reporter instance prepares and delivers through the neutral port', async () => {
  const { createDispatchQueue } = await import('./outbox.ts');
  const { createLogger } = await import('@cogniate/shared');
  const { db, commit } = fixture();
  const delivered: unknown[] = [];
  const reporter: RecordReporter = { ...ltiAgsPolicy,
    prepare: () => ({ neutral: 'payload' }), partitionKey: () => 'chosen-partition',
    async deliver(row, ctx) { delivered.push(row); expect(ctx.beginSend()).toBe('started'); return { kind: 'accepted' }; },
  };
  const reporters = [reporter];
  configureRecordReporters(db, reporters);
  const job = createDispatchQueue(db, reporters);
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
