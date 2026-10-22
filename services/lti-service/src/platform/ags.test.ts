import { describe, expect, it } from 'vitest';
import { parseScore, urlKeyedMembers } from './ags.ts';

const SCORE = { userId: '5', activityProgress: 'Completed', gradingProgress: 'FullyGraded' };
const EXTENSION = 'https://platform.test/submission';

describe('AGS score extras (LA-E3-11)', () => {
  it('treats a null scoreGiven as absent, with or without scoreMaximum (LA-E3-12)', () => {
    for (const maximum of [{}, { scoreMaximum: 100 }]) {
      const absent = parseScore({ ...SCORE, ...maximum });
      const ungraded = parseScore({ ...SCORE, ...maximum, scoreGiven: null });
      expect(ungraded).toEqual(absent);
      expect(ungraded).not.toHaveProperty('scoreGiven');
    }
    expect(parseScore({ ...SCORE, scoreGiven: 0, scoreMaximum: 100 }).scoreGiven).toBe(0);
  });

  it('accepts optional submission times and scoring user IDs without changing their values', () => {
    const submission = { startedAt: '2026-10-23T01:02:03.123456+07:00', submittedAt: '2026-10-23T02:03:04Z' };
    expect(parseScore({ ...SCORE, submission, scoringUserId: 'grader-7' }))
      .toEqual({ ...SCORE, submission, scoringUserId: 'grader-7' });
    expect(parseScore({ ...SCORE, submission: {} }).submission).toEqual({});
    expect(parseScore({ ...SCORE, submission: { submittedAt: submission.submittedAt } }).submission)
      .toEqual({ submittedAt: submission.submittedAt });
  });

  it.each([
    { submission: null }, { submission: [] }, { submission: '2026-10-23' },
    { submission: { startedAt: 42 } }, { submission: { submittedAt: null } },
    { submission: { startedAt: 'yesterday' } }, { submission: { submittedAt: '2026-02-30T01:02:03Z' } },
    { scoringUserId: 7 }, { scoringUserId: null },
  ])('refuses invalid optional fields: %j', (extra) => {
    expect(() => parseScore({ ...SCORE, ...extra })).toThrow(/INVALID_REQUEST/);
  });

  it('accepts eight URL-keyed members and refuses a ninth (AC-03)', () => {
    const members = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`https://platform.test/ext/${i}`, { i }]));
    expect(parseScore({ ...SCORE, ...members })).toEqual({ ...SCORE, ...members });
    expect(() => parseScore({ ...SCORE, ...members, [EXTENSION]: null })).toThrow(/INVALID_REQUEST/);
  });

  it('measures the JSON value as UTF-8 bytes, including JSON quoting and escapes (AC-03)', () => {
    for (const value of ['a'.repeat(4094), 'é'.repeat(2047), '\n'.repeat(2047)]) {
      expect(Buffer.byteLength(JSON.stringify(value))).toBe(4096);
      expect(parseScore({ ...SCORE, [EXTENSION]: value })[EXTENSION]).toBe(value);
      expect(() => parseScore({ ...SCORE, [EXTENSION]: `${value}a` })).toThrow(/INVALID_REQUEST/);
    }
  });

  it('B-LA-E3-11-01: the refusal states the byte limit; 2048 "é" serialize to 4098 bytes', () => {
    const value = 'é'.repeat(2048);
    expect(Buffer.byteLength(JSON.stringify(value))).toBe(4098);
    expect(() => parseScore({ ...SCORE, [EXTENSION]: value })).toThrow(expect.objectContaining({
      code: 'INVALID_REQUEST',
      description: `Invalid field: ${EXTENSION} must serialize to at most 4096 UTF-8 bytes of JSON, including quotes and escapes.`,
    }));
  });

  it.each([null, false, 17, { nested: ['a', null, true] }])('keeps each JSON extension value: %j', (value) => {
    expect(parseScore({ ...SCORE, [EXTENSION]: value })[EXTENSION]).toEqual(value);
  });
});

describe('AGS extension keys', () => {
  it('keeps absolute HTTPS keys and drops all other unknown members', () => {
    const accepted = { [EXTENSION]: { nested: true }, 'HTTPS://platform.test/ns#member': null };
    const dropped = Object.fromEntries([
      'unknown', '/relative', '//platform.test/ext', 'http://platform.test/ext', 'urn:extension',
      'https:platform.test/ext', 'https:///platform.test/ext', 'https://', 'https://?a=b',
      ' https://platform.test/ext', 'https://platform.test/ext\n', 'https://platform.test\\ext',
    ].map((key) => [key, 'x'.repeat(5000)]));
    expect(urlKeyedMembers({ ...accepted, ...dropped })).toEqual(accepted);
    expect(parseScore({ ...SCORE, ...accepted, ...dropped })).toEqual({ ...SCORE, ...accepted });
  });
});
