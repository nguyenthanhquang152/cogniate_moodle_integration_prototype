import { describe, expect, it } from 'vitest';
import { canSelectContent, isGradedLaunch } from './roles.ts';

const LIS = 'http://purl.imsglobal.org/vocab/lis/v2';

describe('role sets (ADR-011 §10, AC-M1-16)', () => {
  it.each([
    [[`${LIS}/membership#Learner`, `${LIS}/institution/person#Instructor`], true, false],
    [[`${LIS}/membership#Learner`], true, false],
    [[`${LIS}/membership#Learner`, 'http://purl.imsglobal.org/vocab/lti/system/person#TestUser'], true, false],
    [['Learner'], true, false],
    [[`${LIS}/membership#Instructor`], false, true],
    [[`${LIS}/membership/Instructor#TeachingAssistant`], false, true],
    [['Instructor'], false, true],
    [[`${LIS}/institution/person#Administrator`], false, true],
    [[`${LIS}/membership#Learner`, `${LIS}/membership#Instructor`], false, true],
  ])('%j → graded %s, picker %s', (roles, graded, picker) => {
    expect(isGradedLaunch(roles)).toBe(graded);
    expect(canSelectContent(roles)).toBe(picker);
  });

  it('keeps the Moodle cases: a teacher and an admin without enrolment are previews; a learner is graded', () => {
    expect(isGradedLaunch([`${LIS}/membership#Instructor`])).toBe(false);
    expect(isGradedLaunch([`${LIS}/institution/person#Administrator`, `${LIS}/system/person#Administrator`])).toBe(false);
    expect(isGradedLaunch([`${LIS}/membership#Learner`])).toBe(true);
    expect(canSelectContent([`${LIS}/system/person#SysAdmin`])).toBe(true);
    expect(canSelectContent([`${LIS}/membership/Learner#Learner`])).toBe(false);
  });

  it('does not take an institution or other role for a context role', () => {
    expect(isGradedLaunch([`${LIS}/institution/person#Learner`])).toBe(false);
    expect(canSelectContent([`${LIS}/institution/person#Instructor`])).toBe(false);
    expect(canSelectContent([`${LIS}/membership#InstructorX`])).toBe(false);
  });
});
