import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

const base = {
  PUBLIC_MOODLE_URL: 'https://moodle.test',
  PUBLIC_LTI_URL: 'https://lti.cogniate.test',
  PUBLIC_APP_URL: 'https://app.cogniate.test',
  PUBLIC_CONTENT_URL: 'https://content.cogniate-content.test',
  APP_MASTER_KEY: '0'.repeat(64),
};

describe('loadConfig: LTI_API_URL (M3 §3.3, acceptance only)', () => {
  it.each([
    ['unset, no profile', {}],
    ['unset, default', { STACK_PROFILE: 'default' }],
    ['empty (what compose sets in default), default', { STACK_PROFILE: 'default', LTI_API_URL: '' }],
    ['unset, acceptance', { STACK_PROFILE: 'acceptance' }],
  ])('%s: no override, the /api/* calls go directly to PUBLIC_LTI_URL', (_label, env) => {
    const config = loadConfig({ ...base, ...env });
    expect(config.ltiApiUrl).toBeNull();
    expect(config.urls.lti).toBe('https://lti.cogniate.test');
  });

  it('acceptance: the transport gate origin is used', () => {
    const config = loadConfig({ ...base, STACK_PROFILE: 'acceptance', LTI_API_URL: 'https://lti-gate.test' });
    expect(config.profile).toBe('acceptance');
    expect(config.ltiApiUrl).toBe('https://lti-gate.test');
  });

  it.each([
    ['no profile (default)', undefined],
    ['empty profile (default)', ''],
    ['default', 'default'],
    ['another profile', 'production'],
  ])('%s: a set LTI_API_URL is refused, so the API key never goes to another origin', (_label, profile) => {
    expect(() => loadConfig({ ...base, STACK_PROFILE: profile, LTI_API_URL: 'https://lti-gate.test' }))
      .toThrow(/LTI_API_URL is only for the acceptance profile/);
  });

  it.each([
    ['http', 'http://lti-gate.test'],
    ['trailing slash', 'https://lti-gate.test/'],
    ['path', 'https://lti-gate.test/api'],
    ['not a URL', 'lti-gate.test'],
  ])('acceptance: rejects %s', (_label, value) => {
    expect(() => loadConfig({ ...base, STACK_PROFILE: 'acceptance', LTI_API_URL: value }))
      .toThrow('LTI_API_URL must be an https origin without path or trailing slash.');
  });
});
