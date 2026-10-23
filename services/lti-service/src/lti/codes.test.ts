import { describe, expect, it } from 'vitest';
import { reservedIssuerLmsNames } from '../profiles/index.ts';
import { harness, testProfileRegistry } from '../testkit.ts';
import { lmsNameFor, protocolAction } from './codes.ts';

const action = 'This address belongs to a hosted LMS. Connect it as Canvas or Blackboard in the Cogniate portal.';

describe('reserved-issuer owner names (BD-A1-31)', () => {
  it('keeps the baseline action and registration page text byte for byte', async () => {
    expect(protocolAction('ISSUER_RESERVED')).toBe(action);
    const issuer = 'https://blackboard.com';
    // The endpoints are on another host: with an any-https DR profile loaded, a reserved endpoint host is refused first
    // (contract delta §4.6.1 rule 2 before rule 3).
    const site = 'https://lms.school.test';
    const h = await harness({ outbound: () => ({ status: 200, body: {
      issuer, authorization_endpoint: `${site}/auth`, token_endpoint: `${site}/token`, jwks_uri: `${site}/jwks`, registration_endpoint: `${site}/register`,
    } }) });
    try {
      // LA-IC-03: the standard rule needs the configuration at the issuer + /mod/lti/openid-configuration.php.
      const page = await h.app.inject({ method: 'GET', url: `/lti/register/cogniate?openid_configuration=${encodeURIComponent(`${issuer}/mod/lti/openid-configuration.php`)}` });
      expect(page.statusCode).toBe(400);
      expect(page.body).toContain('data-error-code="ISSUER_RESERVED"');
      expect(page.body).toContain(`<p data-error-action>${action}</p>`);
    } finally { await h.app.close(); h.db.close(); }
  });

  it('uses each reserved issuer owner once in profile order, including new channels', async () => {
    const registry = await testProfileRegistry();
    const profiles = { registry, simulation: true };
    expect(reservedIssuerLmsNames(profiles)).toBe('Canvas, Blackboard or your LMS');
    expect(protocolAction('ISSUER_RESERVED', undefined, profiles)).toBe('This address belongs to a hosted LMS. Connect it as Canvas, Blackboard or your LMS in the Cogniate portal.');
    const onlyNew = { ...registry, listProfiles: (simulation: boolean) => registry.listProfiles(simulation).filter((p) => p.channel === 'zz') };
    expect(reservedIssuerLmsNames({ registry: onlyNew, simulation: false })).toBe('your LMS');
    // B-LA-E1-10-03: one rule for the name; ISSUER_RESERVED ignores the given name.
    expect(lmsNameFor('ISSUER_RESERVED', 'Other', profiles)).toBe('Canvas, Blackboard or your LMS');
    expect(protocolAction('ISSUER_RESERVED', 'Other', profiles)).toBe(protocolAction('ISSUER_RESERVED', undefined, profiles));
    expect(lmsNameFor('UNKNOWN_PLATFORM', 'Other', profiles)).toBe('Other');
    expect(lmsNameFor('UNKNOWN_PLATFORM', undefined, profiles)).toBe('Moodle');
    const noFixed = { ...registry, listProfiles: (simulation: boolean) => registry.listProfiles(simulation).filter((p) => p.endpoints === 'admin') };
    expect(reservedIssuerLmsNames({ registry: noFixed, simulation: false })).toBe('');
  });
});
