// The acme-lms channel facts as data: the Acme defaults, the profile traits, the scope set, the guard and the generic
// tool rows. Channel files import kernel types only (LA-ADR-01 D1), so the registry views (the computed capabilities
// and legacy flags) are K0 evidence; QA proves the stack (K1-SIM, K2).
import { expect, it } from 'vitest';
import profiles from './lti-profiles.ts';
import manifest from './manifest.ts';

const manual = manifest.setup.bindingFields.filter((f) => f.method === 'manual');
const field = (key: string) => manual.find((f) => f.key === key);

it('the Acme defaults are on the site URL; the issuer defaults to the site URL; no token audience default', () => {
  expect(Object.fromEntries(manual.map((f) => [f.key, 'default' in f ? f.default : undefined]))).toEqual({
    issuer: '{siteUrl}',
    clientId: undefined,
    deploymentId: undefined,
    authenticationEndpoint: '{siteUrl}/lti/auth',
    accessTokenEndpoint: '{siteUrl}/lti/token',
    jwksUrl: '{siteUrl}/lti/jwks.json',
    tokenAudience: undefined,
    grantCode: undefined,
  });
  expect(manual.map((f) => f.key)).toEqual(['issuer', 'clientId', 'deploymentId', 'authenticationEndpoint', 'accessTokenEndpoint', 'jwksUrl', 'tokenAudience', 'grantCode']);
  expect([field('tokenAudience')!.required, field('grantCode')!.required]).toEqual([false, true]);
});

it('one admin-value profile: per-tenant issuer, any-https endpoints, aud from the platform value, exclusive, allowlist', () => {
  expect(profiles).toHaveLength(1);
  expect(profiles[0]).toMatchObject({
    id: 'acme-lms', endpoints: 'admin', issuerKind: 'per-tenant', endpointOrigins: 'any-https', clientAssertionAud: { value: '{platformValue}', form: 'string' },
    sharing: 'exclusive', privacyFloor: 'allowlist', issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null, simulation: false,
    productFamily: 'acme',
  });
  // listOrder above lti-generic (80) and brightspace (90) (load check 7); no wireLms; no platform storage.
  expect(profiles[0].listOrder).toBe(100);
  expect(profiles[0]).not.toHaveProperty('wireLms');
  expect(profiles[0]).not.toHaveProperty('platformStorage');
});

it('no Dynamic Registration: the profile has dynamicRegistration null and the manifest has no dynamic method or field', () => {
  expect(profiles[0].dynamicRegistration).toBeNull();
  expect(manifest.registration).toEqual([
    { method: 'manual', authority: 'operatorGrant', profiles: ['acme-lms'], defaultProfile: 'acme-lms' },
  ]);
  expect(manifest.setup.bindingFields.every((f) => f.method === 'manual')).toBe(true);
});

it('acme is guarded at the registration level; the names and the card', () => {
  expect(manifest.lti.guardedFamilies).toEqual([{ family: 'acme', level: 'registration' }]);
  expect(manifest.lti.toolConfiguration).toBe('channel');
  expect(manifest.names).toEqual({ text: 'Acme LMS', label: 'Acme LMS' });
  expect(manifest.card).toMatchObject({ category: 'LMS Publishing', order: 6 });
});

it('the scope set is the four AGS scopes and no NRPS scope; several deployments; several Deep Linking items', () => {
  expect(manifest.capabilities['registration.scopes']).toEqual([
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
    'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  ]);
  expect(manifest.capabilities).toMatchObject({
    'deployments.multiple': true, 'content.multiple': true, 'launch.windowHint': true, 'launch.topLevelContinue': false,
    'records.reporters': ['lti-ags'], 'records.readBack': true,
  });
});

it('no setup.toolRows: the portal shows the generic tool rows', () => {
  expect(manifest.setup).not.toHaveProperty('toolRows');
});
