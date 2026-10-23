import { BASELINE_PROFILE_WIRE_LMS } from '@cogniate/channel-kernel';
import { describe, expect, it } from 'vitest';
import { listProfiles, profileDefinition } from './index.ts';
import { parseProfileSource } from './schema.ts';

const source = Object.fromEntries(Object.entries(profileDefinition('standard')!).filter(([key]) => key !== 'channel' && key !== 'lms'));

describe('platformStorage trait (BD-A1-33)', () => {
  it('enables every Canvas profile and normalizes other absent values to null', () => {
    const fromLogin = { targetFrame: 'from-login', origin: 'authOrigin' };
    for (const p of listProfiles({ simulation: true })) {
      // Open world (N10): the baseline values are frozen; lti-generic sets the Canvas value (LA-E2-03, A2 LA-ADR-05 D1
      // rule 1a); any other new profile is only normalized (null or a value, never absent).
      if (Object.hasOwn(BASELINE_PROFILE_WIRE_LMS, p.id)) expect(p.platformStorage, p.id).toEqual(p.channel === 'canvas' ? fromLogin : null);
      else if (p.id === 'lti-generic') expect(p.platformStorage).toEqual(fromLogin);
      else expect(p.platformStorage, p.id).not.toBeUndefined();
    }
    const absent = { ...source };
    delete absent.platformStorage;
    expect(parseProfileSource(absent, 'moodle').platformStorage).toBeUndefined();
  });

  it.each([
    { targetFrame: 'from-login', origin: 'authOrigin' },
    { targetFrame: '_parent', origin: 'https://storage.example.edu' },
    { targetFrame: 'a'.repeat(64), origin: 'https://storage.example.edu:8443' },
  ])('accepts the declared storage shape %j', (platformStorage) => {
    expect(parseProfileSource({ ...source, platformStorage }, 'moodle').platformStorage).toEqual(platformStorage);
  });

  it.each([
    { targetFrame: '' }, { targetFrame: 'a b' }, { targetFrame: 'a'.repeat(65) },
    { origin: 'http://storage.example.edu' }, { origin: 'https://storage.example.edu/' },
    { origin: 'https://storage.example.edu/path' }, { origin: 'https://storage.example.edu?x=1' },
    { origin: 'https://user@storage.example.edu' }, { origin: 'https://STORAGE.example.edu' },
    { origin: '*' }, { extra: true },
  ])('refuses invalid storage data %j', (overrides) => {
    expect(() => parseProfileSource({ ...source, platformStorage: { targetFrame: 'from-login', origin: 'authOrigin', ...overrides } }, 'moodle')).toThrow(/profile "standard"/);
  });
});
