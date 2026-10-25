import { describe, expect, it } from 'vitest';
import type { CapabilityInput } from './capabilities.ts';
import { CAPABILITY_IDS, computeCapabilities } from './capabilities.ts';
import { legacyProjection } from './legacy-wire.ts';
import { fillText } from './text.ts';

const input = (over: Partial<CapabilityInput> = {}): CapabilityInput => ({
  registration: [
    { method: 'dynamic', authority: 'self', profiles: ['p-dr'] },
    { method: 'manual', authority: 'operatorGrant', profiles: ['p-dr', 'p-manual'] },
  ],
  capabilities: { 'setup.artifacts': ['developer-key-json'], 'records.reporters': ['lti-ags'] },
  setup: {},
  ...over,
});

describe('computeCapabilities (D3 sources)', () => {
  it('gives every catalog id in catalog order; absent manifest values are false or empty', () => {
    const set = computeCapabilities(input());
    expect(Object.keys(set)).toEqual(CAPABILITY_IDS.filter((id) => id !== 'platform.sharing' && id !== 'site.serviceOrigin'));
    expect(set).toMatchObject({
      'registration.dynamic': true, 'binding.authority': { dynamic: 'self', manual: 'operatorGrant' }, 'registration.scopes': [],
      'deployments.multiple': false, 'setup.artifacts': ['developer-key-json'], 'records.reporters': ['lti-ags'], 'setup.connectionCheck': false,
    });
  });

  it('registration.dynamic needs a dynamic method and a profile of that method that allows Dynamic Registration', () => {
    expect(computeCapabilities(input({ registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['p'] }] }))['registration.dynamic']).toBe(false);
    expect(computeCapabilities(input(), { id: 'p-dr' })['registration.dynamic']).toBe(true);
    expect(computeCapabilities(input(), { id: 'p-dr', dynamicRegistration: { issuerRule: 'origin' } })['registration.dynamic']).toBe(true);
    expect(computeCapabilities(input(), { id: 'p-dr', dynamicRegistration: null })['registration.dynamic']).toBe(false);
    expect(computeCapabilities(input(), { id: 'p-manual' })['registration.dynamic']).toBe(false);
  });

  it('platform.sharing and site.serviceOrigin come only from the profile traits', () => {
    expect(computeCapabilities(input(), { sharing: 'shared', serviceUrl: true })).toMatchObject({ 'platform.sharing': 'shared', 'site.serviceOrigin': true });
    expect(computeCapabilities(input(), { sharing: 'exclusive', serviceUrl: false })).toMatchObject({ 'platform.sharing': 'exclusive', 'site.serviceOrigin': false });
  });

  it('the legacy projection maps the six M1 flags', () => {
    expect(legacyProjection(computeCapabilities(input({ capabilities: { 'siteApi.token': true, 'publish.createCourse': true, 'deployments.multiple': true } })))).toEqual({
      dynamicRegistration: true, operatorApproval: true, webServices: true, courseShell: true, addDeployment: true, canvasConfiguration: false,
    });
  });
});

describe('fillText', () => {
  it('fills {LMS}, {tool} and {site}; a placeholder without a value stays', () => {
    expect(fillText('Open {LMS} at {site} and find "{tool}" ($& stays).', { LMS: 'Moodle', tool: 'Cogniate (A $1 Library)' }))
      .toBe('Open Moodle at {site} and find "Cogniate (A $1 Library)" ($& stays).');
  });
});
