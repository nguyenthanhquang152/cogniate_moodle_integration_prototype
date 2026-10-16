import { describe, expect, it } from 'vitest';
import { KNOB_REGISTRY, knobValue, readServiceKnobs } from './knobs.ts';

describe('knob registry', () => {
  it('has the T1 knobs with the contract defaults (24 h)', () => {
    expect(KNOB_REGISTRY.LTIK_TTL_SECONDS).toMatchObject({ service: 'lti-service', default: 86_400 });
    expect(KNOB_REGISTRY.REF_TTL_SECONDS).toMatchObject({ service: 'cogniate-app', default: 86_400 });
  });
});

describe('readServiceKnobs', () => {
  it('is empty by default and uses the defaults', () => {
    expect(readServiceKnobs('lti-service', {})).toEqual({ values: { LTIK_TTL_SECONDS: 86_400 }, active: [] });
  });

  it('reports a non-default value as active, only for its own service', () => {
    const env = { LTIK_TTL_SECONDS: '5', REF_TTL_SECONDS: '7' };
    expect(readServiceKnobs('lti-service', env)).toEqual({ values: { LTIK_TTL_SECONDS: 5 }, active: [{ name: 'LTIK_TTL_SECONDS', value: '5' }] });
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
