import { describe, expect, it } from 'vitest';
import { fillTemplate, findProfile, listProfiles, lmsNameOf, profileEndpoints, profileFixedHosts, reservedIssuerOrigins, simulationEnabled } from './index.ts';

describe('profile registry', () => {
  it('is on for simulations only with profile acceptance AND LTI_PROVIDER_SIMULATION=on (LTI contract §9.13)', () => {
    expect(simulationEnabled('acceptance', { LTI_PROVIDER_SIMULATION: 'on' })).toBe(true);
    expect(simulationEnabled('acceptance', {})).toBe(false);
    expect(simulationEnabled('default', { LTI_PROVIDER_SIMULATION: 'on' })).toBe(false);
    expect(simulationEnabled('default', {})).toBe(false);
  });

  it('lists simulation profiles last and only when they are on', () => {
    const off = listProfiles({ simulation: false }).map((p) => p.id);
    const on = listProfiles({ simulation: true }).map((p) => p.id);
    expect(off[0]).toBe('standard');
    expect(off).not.toContain('blackboard-sim');
    expect(on.slice(off.length)[0]).toBe('blackboard-sim');
    expect(findProfile('blackboard-sim', { simulation: false })).toBeNull();
    expect(findProfile('nope', { simulation: true })).toBeNull();
  });

  it('has the exact Blackboard values of ADR-011 §6', () => {
    const bb = findProfile('blackboard', { simulation: false })!;
    expect(bb).toMatchObject({
      lms: 'blackboard', privacyFloor: 'allowlist', sharing: 'shared', issuer: 'https://blackboard.com', siteUrlOn: 'deployment', serviceUrl: false, productFamily: 'blackboardlearn',
      authenticationEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oidcauth',
      accesstokenEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken',
      jwksUrl: 'https://developer.blackboard.com/api/v1/management/applications/{clientId}/jwks.json',
      flags: { deepLinkingResponseSub: true, serviceOriginCheck: true },
      clientAssertionAud: { value: '{tokenEndpoint}', form: 'array' }, dynamicRegistration: null,
    });
    expect(profileEndpoints(bb, { clientId: 'a/b c' }).jwksUrl).toBe('https://developer.blackboard.com/api/v1/management/applications/a%2Fb%20c/jwks.json');
    expect(profileFixedHosts(bb)).toEqual(['blackboard.com', 'developer.blackboard.com']);
    expect(lmsNameOf(bb)).toBe('Blackboard');
    expect(lmsNameOf(findProfile('standard', { simulation: false }))).toBe('Moodle');
  });

  it('reserves the fixed issuer origins of non-standard profiles; simulation issuers only when on', () => {
    expect(reservedIssuerOrigins({ simulation: false })).toContain('https://blackboard.com');
    expect(reservedIssuerOrigins({ simulation: false })).not.toContain('https://blackboard.sim.test');
    expect(reservedIssuerOrigins({ simulation: true })).toContain('https://blackboard.sim.test');
  });

  it('fills {serviceUrl} with the site URL when none is set and refuses a missing value', () => {
    expect(fillTemplate('{serviceUrl}/login/oauth2/token', { siteUrl: 'https://s.example.edu' })).toBe('https://s.example.edu/login/oauth2/token');
    expect(() => fillTemplate('{siteUrl}/x', {})).toThrow(/siteUrl/);
  });
});
