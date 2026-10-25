import { createProvider } from '../core/provider.mjs';

// Clean-room D2L Brightspace LTI 1.3 / LTI Advantage fixture constants (LA-ADR-02 D3, D4, D7; R2 §5.4).
// No production profile or validator is imported.
// Primary facts:
// - Token endpoint on central OAuth2 host (auth.brightspace.sim.test/core/connect/token).
// - Client assertion audience is https://api.brightspace.sim.test/auth/token (different from the token URL).
// - product_family_code is "desire2learn".
// - Deployment IDs are UUIDs, with multiple deployments per registration.
export const BRIGHTSPACE_TOKEN_AUDIENCE = 'https://api.brightspace.sim.test/auth/token';

export const BRIGHTSPACE_DEPLOYMENTS = [
  '8f3d9a10-4b2c-4e8a-9c1d-2f5a6b7c8d90',
  '1c4e7b20-5a3d-4f9b-8d2e-3a6b7c8d9e01',
  '7a9b3c40-6d4e-4a1c-9e3f-4b7c8d9e0f12',
];

const brightspaceSitePaths = {
  lineitems: '/d2l/api/lti/ags/2.0/deployments/8f3d9a10-4b2c-4e8a-9c1d-2f5a6b7c8d90/orgunits/6606/lineitems',
  nrps: '/d2l/api/lti/nrps/2.0/deployment/8f3d9a10-4b2c-4e8a-9c1d-2f5a6b7c8d90/orgunit/6606/memberships',
  dlReturn: '/d2l/lti/deeplink/return',
};

export const brightspace = {
  id: 'brightspace-sim',
  issuer: 'https://brightspace.sim.test',
  family: 'desire2learn',
  deployments: BRIGHTSPACE_DEPLOYMENTS,
  deploymentFormat: 'uuid',
  auth: { host: 'brightspace.sim.test', path: '/d2l/lti/authenticate', methods: ['GET', 'POST'] },
  jwks: { host: 'brightspace.sim.test', path: '/d2l/.well-known/jwks' },
  token: {
    hosts: ['auth.brightspace.sim.test'],
    path: '/core/connect/token',
    audience: BRIGHTSPACE_TOKEN_AUDIENCE,
  },
  dr: {
    hosts: ['brightspace.sim.test', 'school-b.brightspace.sim.test'],
    configPaths: ['/d2l/.well-known/openid-configuration', '/.well-known/openid-configuration'],
    registrationPaths: ['/d2l/lti/register'],
    tokenFormat: 'opaque-bearer',
    defaultTokenHost: 'auth.brightspace.sim.test',
    authorizationServer: BRIGHTSPACE_TOKEN_AUDIENCE,
  },
  sites: ['brightspace.sim.test', 'school-b.brightspace.sim.test'].map((host) => ({ host, ...brightspaceSitePaths })),
  pageHosts: [],
  dlData: 'claim',
  dlSubject: false,
  dlWindowHint: true,
  documentTarget: 'iframe',
};

export function createProviders(runtime) {
  return [createProvider(runtime, brightspace)];
}
