import { expect, it } from 'vitest';
import { findProfile, listProfiles, profileEndpoints, reservedIssuerOrigins, siteRulesFor } from './index.ts';
import { checkSiteUrl } from '@cogniate/shared';

it('defines the reviewed hosted endpoints, flags and simulation gate in registry order', () => {
  const rows = [
    ['canvas-cloud-production', 'https://canvas.instructure.com', 'https://sso.canvaslms.com'],
    ['canvas-cloud-beta', 'https://canvas.beta.instructure.com', 'https://sso.beta.canvaslms.com'],
    ['canvas-cloud-test', 'https://canvas.test.instructure.com', 'https://sso.test.canvaslms.com'],
    ['canvas-sim-cloud', 'https://canvas.sim.test', 'https://sso.canvas.sim.test'],
  ];
  for (const [id, issuer, sso] of rows) {
    const profile = findProfile(id!, { simulation: true })!;
    expect(profile).toMatchObject({
      issuer, authenticationEndpoint: `${sso}/api/lti/authorize_redirect`, jwksUrl: `${sso}/api/lti/security/jwks`,
      accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', lms: 'canvas', privacyFloor: 'allowlist', sharing: 'exclusive', siteUrlOn: 'platform', serviceUrl: true, productFamily: 'canvas',
      flags: { deepLinkingResponseSub: false, serviceOriginCheck: true },
      clientAssertionAud: { value: '{tokenEndpoint}', form: 'string' }, dynamicRegistration: null,
    });
    expect(profile.sources.length).toBeGreaterThan(0);
  }
  // Open world: the baseline real profiles first; every new real profile follows (lti-generic since LA-E2-03).
  const real = listProfiles({ simulation: false });
  expect(real.slice(0, 6).map((p) => p.id)).toEqual(['standard', 'canvas-cloud-production', 'canvas-cloud-beta', 'canvas-cloud-test', 'canvas-self-hosted', 'blackboard']);
  expect(real.map((p) => p.id)).toContain('lti-generic');
  expect(real.some((p) => p.simulation)).toBe(false);
  // Open world (N10, BD-A1-95): a new channel may add simulation profiles after the baseline ones. Check membership,
  // the relative order of the baseline simulations and the LA-ADR-01 D4 rule, not a fixed tail.
  const all = listProfiles({ simulation: true });
  const allIds = all.map((p) => p.id);
  expect(allIds.filter((id) => ['blackboard-sim', 'canvas-sim-cloud'].includes(id))).toEqual(['blackboard-sim', 'canvas-sim-cloud']);
  for (let i = 1; i < all.length; i++) {
    const [before, after] = [all[i - 1]!, all[i]!];
    const rank = Number(before.simulation) - Number(after.simulation) || before.listOrder - after.listOrder || (before.id < after.id ? -1 : 1);
    expect(rank, `${before.id} before ${after.id}`).toBeLessThan(0);
  }
  expect(findProfile('canvas-sim-cloud', { simulation: false })).toBeNull();
  expect(reservedIssuerOrigins({ simulation: false })).toContain('https://canvas.instructure.com');
  expect(reservedIssuerOrigins({ simulation: false })).not.toContain('https://canvas.sim.test');
});

it('keeps self-hosted issuer/auth/keys on the site and token on the separate service', () => {
  const profile = findProfile('canvas-self-hosted', { simulation: false })!;
  expect(profileEndpoints(profile, { siteUrl: 'https://canvas.school.edu', serviceUrl: 'https://api.school.edu' })).toEqual({
    issuer: 'https://canvas.school.edu', authenticationEndpoint: 'https://canvas.school.edu/api/lti/authorize_redirect',
    jwksUrl: 'https://canvas.school.edu/api/lti/security/jwks', accesstokenEndpoint: 'https://api.school.edu/login/oauth2/token',
  });
  expect(profileEndpoints(profile, { siteUrl: 'https://canvas.school.edu' }).accesstokenEndpoint).toBe('https://canvas.school.edu/login/oauth2/token');
  const rules = siteRulesFor(profile, ['https://app.cogniate.test'], { simulation: true });
  expect(checkSiteUrl('https://school.instructure.com', rules)).toMatchObject({ ok: false, rule: 5 });
  expect(checkSiteUrl('https://sso.canvas.sim.test', rules)).toMatchObject({ ok: false, rule: 5 });
});
