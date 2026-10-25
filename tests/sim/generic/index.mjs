import { createProvider } from '../core/provider.mjs';

// Clean-room 1EdTech LTI 1.3 / LTI Advantage generic platform and Moodle-shaped fixtures (LA-ADR-02 D2, D5, D7).
// No production profile or validator is imported.
const genericSitePaths = {
  lineitems: '/lti/courses/course-1/lineitems',
  nrps: '/lti/courses/course-1/memberships',
  dlReturn: '/lti/deep-link/return',
};

// Generic 1EdTech LTI 1.3 provider: issuer with a path prefix (/lti), token endpoint on a second host
// (token.generic.sim.test) as well as same-host (generic.sim.test), and multiple deployments on one registration.
export const generic = {
  id: 'generic-sim',
  issuer: 'https://generic.sim.test/lti',
  family: 'generic',
  deployments: ['deploy-generic-1', 'deploy-generic-2', 'deploy-generic-3'],
  auth: { host: 'generic.sim.test', path: '/lti/oidc/auth', methods: ['GET', 'POST'] },
  jwks: { host: 'generic.sim.test', path: '/lti/jwks.json' },
  token: { hosts: ['token.generic.sim.test', 'generic.sim.test'], path: '/lti/oauth2/token', audience: 'string' },
  dr: {
    hosts: ['generic.sim.test', 'school-b.generic.sim.test'],
    configPaths: ['/lti/.well-known/openid-configuration', '/.well-known/openid-configuration'],
    registrationPaths: ['/lti/register'],
    tokenFormat: 'opaque-bearer',
    defaultTokenHost: 'generic.sim.test',
    secondTokenHost: 'token.generic.sim.test',
  },
  sites: ['generic.sim.test', 'school-b.generic.sim.test'].map((host) => ({ host, ...genericSitePaths })),
  pageHosts: [],
  dlData: 'claim',
  dlSubject: false,
  dlWindowHint: true,
  documentTarget: 'window',
};

// Moodle-shaped LTI 1.3 configuration where the issuer is the site origin (https://moodle.sim.test)
// and all LTI endpoints live under /mod/lti/*.php on the same origin.
export const moodleSim = {
  id: 'moodle-sim',
  issuer: 'https://moodle.sim.test',
  family: 'moodle',
  deployments: ['1', '2'],
  auth: { host: 'moodle.sim.test', path: '/mod/lti/auth.php', methods: ['GET', 'POST'] },
  jwks: { host: 'moodle.sim.test', path: '/mod/lti/certs.php' },
  token: { hosts: ['moodle.sim.test'], path: '/mod/lti/token.php', audience: 'string' },
  dr: {
    hosts: ['moodle.sim.test'],
    configPaths: ['/mod/lti/openid-configuration.php', '/.well-known/openid-configuration'],
    registrationPaths: ['/mod/lti/openid-registration.php'],
    tokenFormat: 'moodle-scope-jwt',
    defaultTokenHost: 'moodle.sim.test',
  },
  sites: [{
    host: 'moodle.sim.test',
    lineitems: '/mod/lti/services.php/2/lineitems',
    nrps: '/mod/lti/services.php/CourseSection/2/bindings/1/memberships',
    dlReturn: '/mod/lti/contentitem_return.php',
  }],
  pageHosts: [],
  dlData: 'claim',
  dlSubject: false,
  dlWindowHint: false,
  documentTarget: 'window',
};

export function createProviders(runtime) {
  return [generic, moodleSim].map((config) => createProvider(runtime, config));
}
