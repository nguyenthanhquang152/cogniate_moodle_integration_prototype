import { describe, expect, it } from 'vitest';
import { KNOB_REGISTRY, knobString, knobValue, readServiceKnobs } from './knobs.ts';

describe('knob registry', () => {
  it('has the T1 knobs with the contract defaults (24 h)', () => {
    expect(KNOB_REGISTRY.LTIK_TTL_SECONDS).toMatchObject({ service: 'lti-service', default: 86_400 });
    expect(KNOB_REGISTRY.REF_TTL_SECONDS).toMatchObject({ service: 'cogniate-app', default: 86_400 });
  });
});

describe('readServiceKnobs', () => {
  it('is empty by default and uses the defaults', () => {
    expect(readServiceKnobs('lti-service', {})).toEqual({ values: { LTIK_TTL_SECONDS: 86_400 }, strings: {}, active: [] });
  });

  it('reports a non-default value as active, only for its own service', () => {
    const env = { LTIK_TTL_SECONDS: '5', REF_TTL_SECONDS: '7' };
    expect(readServiceKnobs('lti-service', env)).toEqual({ values: { LTIK_TTL_SECONDS: 5 }, strings: {}, active: [{ name: 'LTIK_TTL_SECONDS', value: '5' }] });
    expect(readServiceKnobs('cogniate-app', env).active).toEqual([{ name: 'REF_TTL_SECONDS', value: '7' }]);
  });

  it('does not report a knob that is set to its default', () => {
    expect(readServiceKnobs('lti-service', { LTIK_TTL_SECONDS: '86400' }).active).toEqual([]);
  });

  it.each(['abc', '-5', '1.5', '0', String(31 * 86_400)])('rejects %s', (raw) => {
    expect(() => readServiceKnobs('lti-service', { LTIK_TTL_SECONDS: raw })).toThrow(/LTIK_TTL_SECONDS must be/);
  });
});

describe('knobValue', () => {
  it('returns the default or the parsed value', () => {
    expect(knobValue('REF_TTL_SECONDS', {})).toBe(86_400);
    expect(knobValue('REF_TTL_SECONDS', { REF_TTL_SECONDS: '5' })).toBe(5);
  });
});

describe('string knobs (T8: BUILD_RUNNER_FAIL_AT)', () => {
  it('the default is inactive; an allowed value is active; another value stops the service', () => {
    const def = readServiceKnobs('cogniate-app', {});
    expect([def.strings.BUILD_RUNNER_FAIL_AT, def.values.BUILD_RUNNER_HOLD, def.active]).toEqual(['', 0, []]);
    const set = readServiceKnobs('cogniate-app', { BUILD_RUNNER_FAIL_AT: 'backup', BUILD_RUNNER_HOLD: '1' });
    expect(set.strings.BUILD_RUNNER_FAIL_AT).toBe('backup');
    expect(set.active).toEqual([{ name: 'BUILD_RUNNER_HOLD', value: '1' }, { name: 'BUILD_RUNNER_FAIL_AT', value: 'backup' }]);
    expect(() => readServiceKnobs('cogniate-app', { BUILD_RUNNER_FAIL_AT: 'rm -rf' })).toThrow(/BUILD_RUNNER_FAIL_AT must be one of start, course, scorm, backup, copy/);
    expect(() => readServiceKnobs('cogniate-app', { BUILD_RUNNER_HOLD: '2' })).toThrow(/between 0 and 1/);
    expect(knobString('BUILD_RUNNER_FAIL_AT', {})).toBe('');
  });
});
