import { describe, expect, it } from 'vitest';
import { reservedIssuerLmsNames } from '../profiles/index.ts';
import { harness, testProfileRegistry } from '../testkit.ts';
import { protocolAction } from './codes.ts';

const action = 'This address belongs to a hosted LMS. Connect it as Canvas or Blackboard in the Cogniate portal.';

describe('reserved-issuer owner names (BD-A1-31)', () => {
  it('keeps the baseline action and registration page text byte for byte', async () => {
    expect(protocolAction('ISSUER_RESERVED')).toBe(action);
    const issuer = 'https://blackboard.com';
    const h = await harness({ outbound: () => ({ status: 200, body: {
      issuer, authorization_endpoint: `${issuer}/auth`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`, registration_endpoint: `${issuer}/register`,
    } }) });
    try {
      const page = await h.app.inject({ method: 'GET', url: `/lti/register/cogniate?openid_configuration=${encodeURIComponent(`${issuer}/config`)}` });
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
    const noFixed = { ...registry, listProfiles: (simulation: boolean) => registry.listProfiles(simulation).filter((p) => p.endpoints === 'admin') };
    expect(reservedIssuerLmsNames({ registry: noFixed, simulation: false })).toBe('');
  });
});
