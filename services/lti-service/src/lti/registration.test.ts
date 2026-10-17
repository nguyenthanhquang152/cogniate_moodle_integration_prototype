import { describe, expect, it } from 'vitest';
import { URLS } from '../testkit.ts';
import { PLATFORM_CONFIG_CLAIM, TOOL_CONFIG_CLAIM, buildRegistrationRequest, claimsFor, operationFromToken, parseOpenIdConfiguration, parseRegistrationResponse } from './registration.ts';

const CONFIG_URL = 'https://moodle.test/mod/lti/openid-configuration.php';
const MOODLE_CONFIG = {
  issuer: 'https://moodle.test',
  token_endpoint: 'https://moodle.test/mod/lti/token.php',
  jwks_uri: 'https://moodle.test/mod/lti/certs.php',
  authorization_endpoint: 'https://moodle.test/mod/lti/auth.php',
  registration_endpoint: 'https://moodle.test/mod/lti/openid-registration.php',
  scopes_supported: ['https://purl.imsglobal.org/spec/lti-ags/scope/score', 'openid'],
  [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'moodle', version: '5.2.4 (Build: 20261005)', messages_supported: [{ type: 'LtiResourceLinkRequest' }, { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] }] },
};

describe('openid configuration rules (security §2.4)', () => {
  it('reads the Moodle configuration', () => {
    const c = parseOpenIdConfiguration(CONFIG_URL, MOODLE_CONFIG);
    expect(c).toMatchObject({
      issuer: 'https://moodle.test', registrationEndpoint: 'https://moodle.test/mod/lti/openid-registration.php', productFamilyCode: 'moodle', version: '5.2.4 (Build: 20261005)',
      messagesSupported: [{ type: 'LtiResourceLinkRequest' }, { type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] }],
    });
  });

  it.each([
    ['issuer of another origin', { ...MOODLE_CONFIG, issuer: 'https://qa-platform.test' }, 'ISSUER_MISMATCH'],
    ['issuer with a path', { ...MOODLE_CONFIG, issuer: 'https://moodle.test/x' }, 'ISSUER_MISMATCH'],
    ['token endpoint on another host', { ...MOODLE_CONFIG, token_endpoint: 'https://evil.test/token' }, 'INVALID_OPENID_CONFIGURATION'],
    ['registration endpoint over http', { ...MOODLE_CONFIG, registration_endpoint: 'http://moodle.test/r' }, 'INVALID_OPENID_CONFIGURATION'],
    ['no jwks_uri', { ...MOODLE_CONFIG, jwks_uri: undefined }, 'INVALID_OPENID_CONFIGURATION'],
    ['not an object', ['x'], 'INVALID_OPENID_CONFIGURATION'],
  ])('refuses %s', (_n, body, code) => expect(parseOpenIdConfiguration(CONFIG_URL, body)).toMatchObject({ code }));
});

describe('operation from the registration token (security §2.5)', () => {
  it('reg -> new; reg-update + sub -> update of that type; anything else -> null', () => {
    expect(operationFromToken({ scope: 'reg', sub: 'abc' })).toEqual({ operation: 'new', typeId: null });
    expect(operationFromToken({ scope: 'reg-update', sub: '7' })).toEqual({ operation: 'update', typeId: '7' });
    expect(operationFromToken({ scope: 'reg-update', sub: 7 })).toEqual({ operation: 'update', typeId: '7' });
    expect(operationFromToken({ scope: 'reg-update' })).toBeNull();
    expect(operationFromToken({ scope: 'other' })).toBeNull();
  });
});

describe('registration request (ADR-009)', () => {
  it('has the ADR-009 fields; default message is deep linking in ContentArea', () => {
    const r = buildRegistrationRequest({ urls: URLS, accountId: 'cogniate', clientName: 'Cogniate (Thanh)', privacyLevel: 'anonymous' });
    expect(r).toEqual({
      application_type: 'web', response_types: ['id_token'], grant_types: ['implicit', 'client_credentials'],
      initiate_login_uri: `${URLS.lti}/lti/login/cogniate`, redirect_uris: [`${URLS.lti}/lti/launch/cogniate`], jwks_uri: `${URLS.lti}/lti/keys/cogniate`,
      token_endpoint_auth_method: 'private_key_jwt', client_name: 'Cogniate (Thanh)',
      scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
      [TOOL_CONFIG_CLAIM]: {
        domain: new URL(URLS.lti).host, target_link_uri: `${URLS.lti}/lti/launch/cogniate`, claims: ['iss', 'sub'],
        messages: [{ type: 'LtiDeepLinkingRequest', target_link_uri: `${URLS.lti}/lti/launch/cogniate`, label: 'Cogniate', placements: ['ContentArea'] }],
      },
    });
  });

  it.each([
    ['anonymous', ['iss', 'sub']],
    ['name_only', ['iss', 'sub', 'name', 'given_name', 'family_name']],
    ['email_only', ['iss', 'sub', 'email']],
    ['public', ['iss', 'sub', 'name', 'given_name', 'family_name', 'email']],
  ] as const)('privacy %s -> claims %j', (level, claims) => {
    expect(claimsFor(level)).toEqual(claims);
    const r = buildRegistrationRequest({ urls: URLS, accountId: 'cogniate', clientName: 'x', privacyLevel: level });
    expect((r[TOOL_CONFIG_CLAIM] as { claims: string[] }).claims).toEqual(claims);
  });

  it('parses the platform answer: client_id and the deployment id', () => {
    expect(parseRegistrationResponse({ client_id: 'abc', [TOOL_CONFIG_CLAIM]: { deployment_id: '7' } })).toEqual({ clientId: 'abc', deploymentId: '7' });
    expect(parseRegistrationResponse({ client_id: 'abc', [TOOL_CONFIG_CLAIM]: { deployment_id: 7 } })).toEqual({ clientId: 'abc', deploymentId: '7' });
    expect(parseRegistrationResponse({ client_id: 'abc' })).toBeNull();
    expect(parseRegistrationResponse({ [TOOL_CONFIG_CLAIM]: { deployment_id: '7' } })).toBeNull();
  });
});
