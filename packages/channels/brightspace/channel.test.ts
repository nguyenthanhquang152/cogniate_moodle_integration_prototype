// LA-E2-05: the brightspace channel facts (LA-ADR-02 D4) as data: the D2L defaults, the profile traits, the scope set,
// the guard and the D2L tool rows. Channel files import kernel types only (LA-ADR-01 D1), so the registry views (the
// computed capabilities and legacy flags, AC-LA-E2-05-03, -09) are K0 evidence; QA proves the stack (K1-SIM, K2).
import { expect, it } from 'vitest';
import profiles from './lti-profiles.ts';
import manifest from './manifest.ts';

const manual = manifest.setup.bindingFields.filter((f) => f.method === 'manual');
const field = (key: string) => manual.find((f) => f.key === key);

it('AC-LA-E2-05-02: the D2L defaults are constants; the issuer defaults to the site URL', () => {
  expect(Object.fromEntries(manual.map((f) => [f.key, 'default' in f ? f.default : undefined]))).toEqual({
    issuer: '{siteUrl}',
    clientId: undefined,
    deploymentId: undefined,
    authenticationEndpoint: '{siteUrl}/d2l/lti/authenticate',
    accessTokenEndpoint: 'https://auth.brightspace.com/core/connect/token',
    jwksUrl: '{siteUrl}/d2l/.well-known/jwks',
    tokenAudience: 'https://api.brightspace.com/auth/token',
    grantCode: undefined,
  });
  expect(manual.map((f) => f.key)).toEqual(['issuer', 'clientId', 'deploymentId', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl', 'tokenAudience', 'grantCode']);
  expect([field('tokenAudience')!.required, field('grantCode')!.required]).toEqual([false, true]);
});

it('AC-LA-E2-05-02: one admin-value profile: per-tenant issuer, any-https endpoints, aud from the platform value, exclusive, allowlist', () => {
  expect(profiles).toHaveLength(1);
  expect(profiles[0]).toMatchObject({
    id: 'brightspace', endpoints: 'admin', issuerKind: 'per-tenant', endpointOrigins: 'any-https', clientAssertionAud: { value: '{platformValue}', form: 'string' },
    sharing: 'exclusive', privacyFloor: 'allowlist', issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null, simulation: false,
  });
  // No platform storage until a live check.
  expect(profiles[0]).not.toHaveProperty('platformStorage');
});

it('LA-E2-06: the profile allows Dynamic Registration with the path-prefix issuer rule and an opaque Bearer token', () => {
  expect(profiles[0].dynamicRegistration).toEqual({ issuerRule: 'path-prefix', registrationToken: 'opaque-bearer' });
  expect(profiles[0].dynamicRegistration).not.toHaveProperty('configurationPath');
});

it('LA-E2-06: dynamic (authority self, always staged by I-SELF) and manual with an operator grant; desire2learn is guarded at the registration level', () => {
  expect(manifest.registration).toEqual([
    { method: 'dynamic', authority: 'self', profiles: ['brightspace'], defaultProfile: 'brightspace' },
    { method: 'manual', authority: 'operatorGrant', profiles: ['brightspace'], defaultProfile: 'brightspace' },
  ]);
  // I-SELF always fails for this profile: its endpoints may be on any https host, so a registration is staged.
  expect(profiles[0].endpointOrigins).toBe('any-https');
  expect(manifest.lti.guardedFamilies).toEqual([{ family: 'desire2learn', level: 'registration' }]);
  expect(manifest.names).toEqual({ text: 'Brightspace', label: 'D2L Brightspace' });
});

it('AC-LA-E2-05-09 (manifest part): the scope set is the four AGS scopes and no NRPS scope; several deployments', () => {
  expect(manifest.capabilities['registration.scopes']).toEqual([
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
    'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  ]);
  expect(manifest.capabilities).toMatchObject({ 'deployments.multiple': true, 'launch.windowHint': true, 'launch.topLevelContinue': false, 'records.reporters': ['lti-ags'] });
});

it('the nine D2L tool rows, in the order of the Register Tool form, use only kernel placeholders (no protocol path)', () => {
  const rows = manifest.setup.toolRows;
  expect(rows.map((r) => [r.key, r.value])).toEqual([
    ['tool_name', '{toolName}'], ['domain', '{ltiHost}'], ['redirect_urls', '{launchUrl}'], ['openid_connect_login_url', '{loginUrl}'],
    ['target_link_uri', '{launchUrl}'], ['keyset_url', '{keysUrl}'], ['extensions', 'Assignment and Grade Services, Deep Linking'],
    ['roles', 'Send institution role'], ['privacy', 'Do not send name or e-mail.'],
  ]);
  expect(rows.every((r) => r.label.length > 0 && !r.value.includes('/'))).toBe(true);
});

it('LA-E2-06: a staged Dynamic Registration asks only for the ids and the approval code (no admin value, no default)', () => {
  const dynamic = manifest.setup.bindingFields.filter((f) => f.method === 'dynamic');
  expect(dynamic).toEqual([
    { key: 'clientId', label: 'Client ID', kind: 'id', required: true, method: 'dynamic' },
    { key: 'deploymentId', label: 'Deployment ID', kind: 'id', required: true, method: 'dynamic' },
    { key: 'grantCode', label: 'Approval code', kind: 'grantCode', required: true, method: 'dynamic' },
  ]);
  expect(manifest.setup.bindingFields.every((f) => f.method === 'manual' || f.method === 'dynamic')).toBe(true);
});
