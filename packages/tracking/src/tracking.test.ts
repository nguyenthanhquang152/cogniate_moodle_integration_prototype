import { describe, expect, it } from 'vitest';
import {
  agsScore, agsScoreBody, bestAttempt, checkScormCmi, syncResult, finishStatus, formatTimespan, improves, nextRetryAt, outcomeFromStatus, parseTimespan, playStatusText,
  sessionMax, syncDecision, totalTime,
} from './index.ts';
import type { SyncRow } from './index.ts';

describe('ADR-010 mapping (rule 4)', () => {
  it('completed: raw/max if raw exists, else 100/100', () => {
    expect(agsScore('completed', '', '')).toEqual({ scoreGiven: 100, scoreMaximum: 100 });
    expect(agsScore('completed', '80', '100')).toEqual({ scoreGiven: 80, scoreMaximum: 100 });
  });
  it('passed: raw/max (max default 100); 100/100 if no raw', () => {
    expect(agsScore('passed', '90', '')).toEqual({ scoreGiven: 90, scoreMaximum: 100 });
    expect(agsScore('passed', '', '')).toEqual({ scoreGiven: 100, scoreMaximum: 100 });
    expect(agsScore('passed', '45', '50')).toEqual({ scoreGiven: 45, scoreMaximum: 50 });
  });
  it('failed: raw/max; 0/100 if no raw', () => {
    expect(agsScore('failed', '0', '100')).toEqual({ scoreGiven: 0, scoreMaximum: 100 });
    expect(agsScore('failed', '', '')).toEqual({ scoreGiven: 0, scoreMaximum: 100 });
  });
  it('in_progress and not_started: nothing is sent', () => {
    expect(agsScore('in_progress', '50', '100')).toBeNull();
    expect(agsScore('not_started', '', '')).toBeNull();
  });
  it('the score body: Completed + FullyGraded (no Started/InProgress, rule 2)', () => {
    expect(agsScoreBody('5', { scoreGiven: 100, scoreMaximum: 100 })).toEqual({ userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 100, scoreMaximum: 100 });
  });
});

describe('Moodle LMSFinish rule (app contract §7)', () => {
  it('not attempted -> completed (AC-T5-21: LMSInitialize + LMSFinish only)', () => {
    expect(finishStatus('not attempted', '', 70, 'credit')).toBe('completed');
    expect(outcomeFromStatus(finishStatus('not attempted', '', 70, 'credit'))).toBe('completed');
  });
  it('with credit, a mastery score and a raw score decide passed or failed, whatever the status was', () => {
    expect(finishStatus('incomplete', '70', 70, 'credit')).toBe('passed');
    expect(finishStatus('completed', '69.5', 70, 'credit')).toBe('failed');
    expect(finishStatus('failed', '100', 70, 'credit')).toBe('passed');
  });
  it('no mastery, no raw score, or no-credit (preview): the status stays', () => {
    expect(finishStatus('incomplete', '90', null, 'credit')).toBe('incomplete');
    expect(finishStatus('incomplete', '', 70, 'credit')).toBe('incomplete');
    expect(finishStatus('incomplete', '90', 70, 'no-credit')).toBe('incomplete');
  });
  it('lesson_status -> outcome', () => {
    expect(['passed', 'failed', 'completed', 'incomplete', 'browsed', 'not attempted'].map(outcomeFromStatus))
      .toEqual(['passed', 'failed', 'completed', 'in_progress', 'in_progress', 'in_progress']);
  });
});

describe('best result (ADR-010 rule 5, data-model §3)', () => {
  const row = (id: string, status: SyncRow['status'], scoreGiven: number): SyncRow => ({ id, status, scoreGiven, scoreMaximum: 100 });
  it('the first final result always makes a row', () => {
    expect(syncDecision({ scoreGiven: 0, scoreMaximum: 100 }, [])).toEqual({ create: true, supersede: [] });
  });
  it('a row only for a score higher than every pending, sent or conflict row', () => {
    expect(syncDecision({ scoreGiven: 100, scoreMaximum: 100 }, [row('a', 'sent', 100)]).create).toBe(false); // AC-T5-20
    expect(syncDecision({ scoreGiven: 0, scoreMaximum: 100 }, [row('a', 'sent', 100)]).create).toBe(false); // AC-T5-12
    expect(syncDecision({ scoreGiven: 100, scoreMaximum: 100 }, [row('a', 'sent', 0)]).create).toBe(true); // AC-T5-23
    expect(syncDecision({ scoreGiven: 50, scoreMaximum: 100 }, [row('a', 'conflict', 80)]).create).toBe(false);
    expect(syncDecision({ scoreGiven: 50, scoreMaximum: 100 }, [row('a', 'failed', 80), row('b', 'superseded', 90)]).create).toBe(true);
  });
  it('older pending rows with a lower value are superseded', () => {
    expect(syncDecision({ scoreGiven: 90, scoreMaximum: 100 }, [row('a', 'pending', 40), row('b', 'sent', 30), row('c', 'pending', 95)]))
      .toEqual({ create: false, supersede: [] });
    expect(syncDecision({ scoreGiven: 90, scoreMaximum: 100 }, [row('a', 'pending', 40), row('b', 'sent', 30)])).toEqual({ create: true, supersede: ['a'] });
  });
  it('scores compare as given / maximum', () => {
    expect(syncDecision({ scoreGiven: 45, scoreMaximum: 50 }, [{ id: 'a', status: 'sent', scoreGiven: 80, scoreMaximum: 100 }]).create).toBe(true);
  });
  it('the attempt keeps its best outcome; a commit never lowers it', () => {
    const s = (scoreGiven: number) => ({ scoreGiven, scoreMaximum: 100 });
    expect(improves({ outcome: 'not_started', score: null }, { outcome: 'in_progress', score: null })).toBe(true);
    expect(improves({ outcome: 'in_progress', score: null }, { outcome: 'failed', score: s(0) })).toBe(true);
    expect(improves({ outcome: 'failed', score: s(0) }, { outcome: 'passed', score: s(100) })).toBe(true);
    expect(improves({ outcome: 'passed', score: s(100) }, { outcome: 'failed', score: s(0) })).toBe(false);
    expect(improves({ outcome: 'passed', score: s(100) }, { outcome: 'passed', score: s(100) })).toBe(false);
    expect(improves({ outcome: 'passed', score: s(100) }, { outcome: 'in_progress', score: null })).toBe(false);
  });
  it('retry times: 5 s, 30 s, 2 min, 10 min, 30 min, then hourly; failed after 24 h', () => {
    const t0 = 1_000_000;
    expect([1, 2, 3, 4, 5, 6].map((n) => nextRetryAt(t0, n, t0)! - t0)).toEqual([5_000, 30_000, 120_000, 600_000, 1_800_000, 3_600_000]);
    expect(nextRetryAt(t0, 30, t0 + 23.5 * 3_600_000)).toBeNull();
  });
});

describe('CMI value rules (app contract §7)', () => {
  const core = { lesson_status: 'incomplete', lesson_location: 'index', score: { raw: '100', min: '0', max: '100' }, session_time: '0000:00:42.10', exit: 'suspend' };
  it('a full valid commit is normalized', () => {
    const r = checkScormCmi({ core, suspend_data: 'v:2;q:f5f1e28b;p:index;a:1', interactions: [{ id: 'q1', type: 'choice', result: 'correct', time: '00:00:12', correct_responses: [{ pattern: 'a' }] }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cmi.core).toEqual(core);
      expect(r.cmi.interactions[0]).toMatchObject({ id: 'q1', type: 'choice', result: 'correct', objectives: [], latency: '' });
      expect(r.cmi.comments).toBe('');
    }
  });
  it.each([
    [{ core: { ...core, lesson_status: 'done' } }, 'cmi.core.lesson_status'],
    [{ core: { ...core, score: { raw: '101' } } }, 'cmi.core.score.raw'],
    [{ core: { ...core, score: { min: '-1' } } }, 'cmi.core.score.min'],
    [{ core: { ...core, lesson_location: 'x'.repeat(256) } }, 'cmi.core.lesson_location'],
    [{ core, suspend_data: 'x'.repeat(5000) }, 'cmi.suspend_data'],
    [{ core, comments: 'x'.repeat(4097) }, 'cmi.comments'],
    [{ core: { ...core, session_time: '42 seconds' } }, 'cmi.core.session_time'],
    [{ core: { ...core, exit: 'quit' } }, 'cmi.core.exit'],
    [{ core, interactions: Array(251).fill({}) }, 'cmi.interactions'],
    [{ core, interactions: [{ type: 'essay' }] }, 'cmi.interactions.0.type'],
    [{ core, interactions: [{ result: 'great' }] }, 'cmi.interactions.0.result'],
    [{ core, objectives: [{ status: 'done' }] }, 'cmi.objectives.0.status'],
    [{ core: { ...core, lesson_status: 7 } }, 'cmi.core.lesson_status'],
    ['x', 'cmi'],
  ])('%# -> field %s', (cmi, field) => {
    expect(checkScormCmi(cmi)).toEqual({ ok: false, field });
  });
  it('4096 characters of suspend_data are allowed', () => {
    expect(checkScormCmi({ core, suspend_data: 'x'.repeat(4096) }).ok).toBe(true);
  });
});

describe('session time (app contract §7: each session counts once, with its largest session_time)', () => {
  it('parse and format', () => {
    expect(parseTimespan('0000:00:30.00')).toBe(3000);
    expect(parseTimespan('01:02:03.5')).toBe(372350);
    expect(parseTimespan('00:61:00')).toBeNull();
    expect(formatTimespan(6000)).toBe('0000:01:00.00');
  });
  it('the largest value of a session counts, whatever the arrival order (unload after finish adds nothing)', () => {
    let s1 = 0;
    for (const t of ['0000:00:00.00', '0000:00:30.00', '0000:00:12.00', '0000:00:30.00']) s1 = sessionMax(s1, t);
    let s2 = 0;
    for (const t of ['0000:00:30.00', '0000:00:30.00']) s2 = sessionMax(s2, t);
    expect(totalTime([s1, s2])).toBe('0000:01:00.00'); // AC-T5-22
    expect(sessionMax(500, undefined)).toBe(500);
    expect(totalTime([])).toBe('0000:00:00.00');
  });
});

describe('shell status text', () => {
  const base = { outcome: 'passed' as const, scoreGiven: 100, scoreMaximum: 100, preview: false, scoreSync: { status: 'sent' } };
  it('the texts of T5a', () => {
    expect(playStatusText(base)).toBe('Completed — score 100 sent to Moodle');
    expect(playStatusText({ ...base, outcome: 'in_progress', scoreGiven: null, scoreSync: { status: null } })).toBe('In progress');
    expect(playStatusText({ ...base, preview: true })).toBe('Preview — no grade is sent');
    expect(playStatusText({ ...base, outcome: 'failed', scoreGiven: 0 })).toBe('Completed — score 0 sent to Moodle');
    expect(playStatusText({ ...base, scoreSync: { status: 'pending' } })).toBe('Completed — sending score 100 to Moodle');
    expect(playStatusText({ ...base, outcome: 'not_started', scoreSync: { status: null } })).toBe('Not started');
  });
});

describe('grade policy in one place (B-T5a-01): syncResult and bestAttempt', () => {
  const t0 = 1_000_000;
  it('send answers -> row status (ADR-010 rules 8, 9; app contract §10)', () => {
    expect(syncResult({ http: 204 }, 1, t0, t0)).toEqual({ status: 'sent', nextTryAt: null });
    expect(syncResult({ http: 409 }, 1, t0, t0)).toEqual({ status: 'conflict', nextTryAt: null });
    for (const http of [400, 403, 404]) expect(syncResult({ http }, 1, t0, t0)).toEqual({ status: 'failed', nextTryAt: null });
    for (const http of [0, 401, 500, 502, 504]) expect(syncResult({ http }, 1, t0, t0)).toEqual({ status: 'pending', nextTryAt: t0 + 5_000 });
    expect(syncResult({ http: 502 }, 30, t0, t0 + 23.9 * 3_600_000)).toEqual({ status: 'failed', nextTryAt: null }); // 24 h are over
    expect(syncResult({ local: 'no_gradebook_column' }, 1, t0, t0).status).toBe('failed');
    expect(syncResult({ local: 'internal_error' }, 1, t0, t0).status).toBe('failed'); // never a send every 2 s
    expect(syncResult({ http: 502 }, 30, t0 + 23.9 * 3_600_000, t0 + 23.9 * 3_600_000).status).toBe('pending'); // a resend starts a new window
  });
  it('bestAttempt: the final one with the highest score; else the newest in progress; else the newest', () => {
    const a = (outcome: 'passed' | 'failed' | 'in_progress' | 'not_started', scoreGiven: number | null, createdAt: number) => ({ outcome, scoreGiven, scoreMaximum: scoreGiven === null ? null : 100, createdAt });
    expect(bestAttempt([a('failed', 0, 1), a('passed', 100, 2), a('in_progress', null, 3)])?.outcome).toBe('passed');
    expect(bestAttempt([a('passed', 100, 1), a('failed', 0, 2)])?.scoreGiven).toBe(100);
    expect(bestAttempt([a('not_started', null, 1), a('in_progress', null, 2), a('not_started', null, 3)])?.createdAt).toBe(2);
    expect(bestAttempt([a('not_started', null, 1), a('not_started', null, 3)])?.createdAt).toBe(3);
    expect(bestAttempt([])).toBeUndefined();
  });
});
