import { describe, expect, it } from 'vitest';
import { createScorm12Api } from './api.ts';
import { flattenSaved, toCommitCmi } from './cmi-shape.ts';

const readOnly = { studentId: '5', studentName: '', credit: 'credit' as const, entry: 'ab-initio', totalTime: '0000:01:00.00', masteryScore: '70', launchData: '' };

function make(saved: Map<string, string> = new Map()) {
  const commits: Array<Map<string, string>> = [];
  const finishes: Array<Map<string, string>> = [];
  const r = createScorm12Api({ saved, readOnly, onCommit: (v) => commits.push(new Map(v)), onFinish: (v) => finishes.push(new Map(v)) });
  const call = <K extends keyof typeof r.api>(fn: K, ...args: unknown[]) => {
    const ret = (r.api[fn] as (...a: unknown[]) => string)(...args);
    return [ret, r.api.LMSGetLastError()];
  };
  return { ...r, call, commits, finishes };
}

describe('SCORM 1.2 API: the call table of app contract §8', () => {
  it('before LMSInitialize: GetValue "" 301, SetValue/Commit/Finish "false" 301 (the package probe)', () => {
    const { call } = make();
    expect(call('LMSGetValue', 'cmi.core.lesson_status')).toEqual(['', '301']);
    expect(call('LMSSetValue', 'cmi.suspend_data', 'x')).toEqual(['false', '301']);
    expect(call('LMSCommit', '')).toEqual(['false', '301']);
    expect(call('LMSFinish', '')).toEqual(['false', '301']);
  });
  it('LMSInitialize("") -> "true" 0; again in the session -> "false" 101; a non-empty argument -> 201', () => {
    const fresh = make();
    expect(fresh.call('LMSInitialize', 'x')).toEqual(['false', '201']);
    expect(fresh.call('LMSInitialize', '')).toEqual(['true', '0']);
    expect(fresh.call('LMSInitialize', '')).toEqual(['false', '101']);
    expect(fresh.call('LMSCommit', 'x')).toEqual(['false', '201']);
    expect(fresh.call('LMSFinish', 'x')).toEqual(['false', '201']);
  });
  it('after LMSFinish every call answers 101, also LMSInitialize (one session per page load)', () => {
    const { call } = make();
    call('LMSInitialize', '');
    expect(call('LMSFinish', '')).toEqual(['true', '0']);
    expect(call('LMSGetValue', 'cmi.core.lesson_status')).toEqual(['', '101']);
    expect(call('LMSSetValue', 'cmi.core.lesson_status', 'passed')).toEqual(['false', '101']);
    expect(call('LMSCommit', '')).toEqual(['false', '101']);
    expect(call('LMSFinish', '')).toEqual(['false', '101']);
    expect(call('LMSInitialize', '')).toEqual(['false', '101']);
  });
  it('LMSCommit and LMSFinish give the values to the transport', () => {
    const m = make();
    m.call('LMSInitialize', '');
    m.call('LMSSetValue', 'cmi.suspend_data', 'qa-resume');
    m.call('LMSCommit', '');
    m.call('LMSFinish', '');
    expect(m.commits[0]!.get('cmi.suspend_data')).toBe('qa-resume');
    expect(m.finishes).toHaveLength(1);
  });
  it('error strings and diagnostics', () => {
    const { api, call } = make();
    expect(api.LMSGetErrorString('301')).toBe('Not initialized');
    call('LMSGetValue', 'cmi.core.lesson_status');
    expect(api.LMSGetDiagnostic('')).toBe('Not initialized');
    expect(api.LMSGetErrorString('999')).toBe('');
  });
});

describe('SCORM 1.2 API: data model and error codes (AC-T5-05)', () => {
  const open = (saved?: Map<string, string>) => {
    const m = make(saved);
    m.call('LMSInitialize', '');
    return m;
  };
  it('read-only values from RuntimeState', () => {
    const { call } = open();
    expect(call('LMSGetValue', 'cmi.core.student_id')).toEqual(['5', '0']);
    expect(call('LMSGetValue', 'cmi.student_data.mastery_score')).toEqual(['70', '0']);
    expect(call('LMSGetValue', 'cmi.core.entry')).toEqual(['ab-initio', '0']);
    expect(call('LMSGetValue', 'cmi.core.total_time')).toEqual(['0000:01:00.00', '0']);
    expect(call('LMSGetValue', 'cmi.core.lesson_mode')).toEqual(['normal', '0']);
    expect(call('LMSGetValue', 'cmi.core.credit')).toEqual(['credit', '0']);
    expect(call('LMSGetValue', 'cmi.core.lesson_status')).toEqual(['not attempted', '0']);
    expect(call('LMSGetValue', 'cmi.core._children')[0]).toContain('lesson_status');
  });
  it('201 unknown element; 202 _children and 203 _count of a non-array; 401 student_preference', () => {
    const { call } = open();
    expect(call('LMSGetValue', 'cmi.foo')).toEqual(['', '201']);
    expect(call('LMSSetValue', 'cmi.foo', 'x')).toEqual(['false', '201']);
    expect(call('LMSGetValue', 'cmi.suspend_data._children')).toEqual(['', '202']);
    expect(call('LMSGetValue', 'cmi.core.lesson_status._count')).toEqual(['', '203']);
    expect(call('LMSGetValue', 'cmi.student_preference.audio')).toEqual(['', '401']);
    expect(call('LMSSetValue', 'cmi.student_preference.audio', '1')).toEqual(['false', '401']);
  });
  it('402 keyword, 403 read only, 404 write only, 405 bad value (incl. "not attempted")', () => {
    const { call } = open();
    expect(call('LMSSetValue', 'cmi.interactions._count', '1')).toEqual(['false', '402']);
    expect(call('LMSSetValue', 'cmi.core.student_id', 'x')).toEqual(['false', '403']);
    expect(call('LMSGetValue', 'cmi.core.session_time')).toEqual(['', '404']);
    expect(call('LMSGetValue', 'cmi.core.exit')).toEqual(['', '404']);
    expect(call('LMSSetValue', 'cmi.core.lesson_status', 'done')).toEqual(['false', '405']);
    expect(call('LMSSetValue', 'cmi.core.lesson_status', 'not attempted')).toEqual(['false', '405']);
    expect(call('LMSSetValue', 'cmi.core.score.raw', '101')).toEqual(['false', '405']);
    expect(call('LMSSetValue', 'cmi.suspend_data', 'x'.repeat(4097))).toEqual(['false', '405']);
    expect(call('LMSSetValue', 'cmi.core.session_time', '30 s')).toEqual(['false', '405']);
  });
  it('arrays: the next index only (n <= _count), nested too; _count grows; interactions are write only', () => {
    const { call } = open();
    expect(call('LMSSetValue', 'cmi.interactions.1.id', 'q2')).toEqual(['false', '201']);
    expect(call('LMSSetValue', 'cmi.interactions.0.id', 'q1')).toEqual(['true', '0']);
    expect(call('LMSSetValue', 'cmi.interactions.0.type', 'choice')).toEqual(['true', '0']);
    expect(call('LMSSetValue', 'cmi.interactions.0.correct_responses.1.pattern', 'a')).toEqual(['false', '201']);
    expect(call('LMSSetValue', 'cmi.interactions.0.correct_responses.0.pattern', 'a')).toEqual(['true', '0']);
    expect(call('LMSGetValue', 'cmi.interactions._count')).toEqual(['1', '0']);
    expect(call('LMSGetValue', 'cmi.interactions.0.correct_responses._count')).toEqual(['1', '0']);
    expect(call('LMSGetValue', 'cmi.interactions.0.id')).toEqual(['', '404']);
    expect(call('LMSSetValue', 'cmi.objectives.0.id', 'o1')).toEqual(['true', '0']);
    expect(call('LMSGetValue', 'cmi.objectives.0.id')).toEqual(['o1', '0']);
    expect(call('LMSSetValue', 'cmi.interactions.0.result', 'great')).toEqual(['false', '405']);
  });
  it('a package-derived name such as "toString" is never a plain-object lookup (A-T4a-07)', () => {
    const { call } = open();
    expect(call('LMSGetValue', 'toString')).toEqual(['', '201']);
    expect(call('LMSGetValue', 'cmi.__proto__')).toEqual(['', '201']);
    expect(call('LMSSetValue', 'cmi.objectives.0.id', 'toString')).toEqual(['true', '0']);
  });
  it('saved values come back (resume) and the commit body has the nested shape of contract §7', () => {
    const saved = flattenSaved({ core: { lesson_status: 'incomplete', lesson_location: 'index', exit: 'suspend', session_time: '0000:00:10.00' }, suspend_data: 'qa-resume',
      interactions: [{ id: 'q1', type: 'choice', result: 'correct', correct_responses: [{ pattern: 'a' }] }] });
    expect(saved.has('cmi.core.exit')).toBe(false);
    const m = open(saved);
    expect(m.call('LMSGetValue', 'cmi.suspend_data')).toEqual(['qa-resume', '0']);
    expect(m.call('LMSGetValue', 'cmi.core.lesson_status')).toEqual(['incomplete', '0']);
    m.call('LMSSetValue', 'cmi.core.session_time', '0000:00:30.00');
    const body = toCommitCmi(m.values());
    expect(body.core).toEqual({ lesson_status: 'incomplete', lesson_location: 'index', score: { raw: '', min: '', max: '' }, session_time: '0000:00:30.00', exit: '' });
    expect(body.interactions).toEqual([{ id: 'q1', type: 'choice', result: 'correct', time: '', weighting: '', student_response: '', latency: '', objectives: [], correct_responses: [{ pattern: 'a' }] }]);
  });
});
