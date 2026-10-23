import { describe, expect, it } from 'vitest';
import { URLS } from '../testkit.ts';
import type { AnyHttpsRules } from './platform-rules.ts';
import { allFixedHosts, listProfiles, profileDefinition, siteRulesFor } from '../profiles/index.ts';
import type { ConfigurationRule } from './registration.ts';
import {
  PLATFORM_CONFIG_CLAIM, REGISTRATION_SCOPES, TOOL_CONFIG_CLAIM, buildRegistrationRequest, claimsFor, configurationUrlFits, endpointsOnIssuerOrigin, fixedRuleOf,
  grantedScopesOf, operationFromToken, parseOpenIdConfiguration, parseRegistrationResponse, supportsDeepLinking,
} from './registration.ts';

const protocolUrls = { login: `${URLS.lti}/lti/login/cogniate`, launch: `${URLS.lti}/lti/launch/cogniate`, keys: `${URLS.lti}/lti/keys/cogniate`, register: `${URLS.lti}/lti/register/cogniate` };

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
  it('sends the requested scopes in request order (LA-E3-06)', () => {
    const scopes = [REGISTRATION_SCOPES[3], REGISTRATION_SCOPES[0], REGISTRATION_SCOPES[2], REGISTRATION_SCOPES[1]];
    const r = buildRegistrationRequest({ protocolUrls, clientName: 'Scopes', privacyLevel: 'anonymous', scopes });
    expect(r.scope).toBe(scopes.join(' '));
  });

  it('has the ADR-009 fields; default message is deep linking in ContentArea', () => {
    const r = buildRegistrationRequest({ protocolUrls, clientName: 'Cogniate (Thanh)', privacyLevel: 'anonymous' });
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

  it('LA-ADR-05 D6: the extension members of the chosen profile join the tool configuration claim', () => {
    const extensions = { 'https://lms.example/lti/tool_id': 'cogniate', 'https://lms.example/lti/vendor': 'Cogniate' };
    const r = buildRegistrationRequest({ protocolUrls, clientName: 'x', privacyLevel: 'anonymous', extensions });
    expect(r[TOOL_CONFIG_CLAIM]).toMatchObject({ domain: new URL(URLS.lti).host, claims: ['iss', 'sub'], ...extensions });
    expect(Object.keys(buildRegistrationRequest({ protocolUrls, clientName: 'x', privacyLevel: 'anonymous' })[TOOL_CONFIG_CLAIM] as object))
      .toEqual(['domain', 'target_link_uri', 'claims', 'messages']);
  });

  it.each([
    ['anonymous', ['iss', 'sub']],
    ['name_only', ['iss', 'sub', 'name', 'given_name', 'family_name']],
    ['email_only', ['iss', 'sub', 'email']],
    ['public', ['iss', 'sub', 'name', 'given_name', 'family_name', 'email']],
  ] as const)('privacy %s -> claims %j', (level, claims) => {
    expect(claimsFor(level)).toEqual(claims);
    const r = buildRegistrationRequest({ protocolUrls, clientName: 'x', privacyLevel: level });
    expect((r[TOOL_CONFIG_CLAIM] as { claims: string[] }).claims).toEqual(claims);
  });

  it('parses the platform answer: client_id and the deployment id', () => {
    expect(parseRegistrationResponse({ client_id: 'abc', [TOOL_CONFIG_CLAIM]: { deployment_id: '7' } })).toEqual({ clientId: 'abc', deploymentId: '7' });
    expect(parseRegistrationResponse({ client_id: 'abc', [TOOL_CONFIG_CLAIM]: { deployment_id: 7 } })).toEqual({ clientId: 'abc', deploymentId: '7' });
    expect(parseRegistrationResponse({ client_id: 'abc' })).toBeNull();
    expect(parseRegistrationResponse({ [TOOL_CONFIG_CLAIM]: { deployment_id: '7' } })).toBeNull();
  });
});

describe('Dynamic Registration rule table per profile (LA-ADR-02 D5, AC-LA-E2-02-01)', () => {
  const HOSTS: AnyHttpsRules = { ownHosts: ['lti.cogniate.test'], reservedHosts: ['sso.canvaslms.com', 'canvas.instructure.com'], reservedIssuerOrigins: ['https://canvas.instructure.com'] };
  const STANDARD: ConfigurationRule = { issuerRules: [{ issuerRule: 'path-prefix', configurationPath: '/mod/lti/openid-configuration.php' }], endpointOrigins: 'issuer', hosts: HOSTS };
  const GENERIC: ConfigurationRule = { issuerRules: [{ issuerRule: 'path-prefix' }], endpointOrigins: 'any-https', hosts: HOSTS };
  const G = 'https://lms.school.test/sakai';
  const generic = (extra: Record<string, unknown> = {}) => ({
    ...MOODLE_CONFIG, issuer: G, authorization_endpoint: `${G}/auth`, token_endpoint: `${G}/token`, jwks_uri: `${G}/jwks`, registration_endpoint: `${G}/register`, ...extra,
  });
  const moodleIn = (base: string) => ({
    ...MOODLE_CONFIG, issuer: base, authorization_endpoint: `${base}/mod/lti/auth.php`, token_endpoint: `${base}/mod/lti/token.php`,
    jwks_uri: `${base}/mod/lti/certs.php`, registration_endpoint: `${base}/mod/lti/openid-registration.php`,
  });

  it('item 1: path-prefix takes an issuer with a path; configurationPath pins the configuration URL (LA-IC-03)', () => {
    expect(parseOpenIdConfiguration(`${G}/.well-known/openid-configuration`, generic(), GENERIC)).toMatchObject({ issuer: G });
    expect(parseOpenIdConfiguration('https://lms.school.test/other/config', generic(), GENERIC)).toEqual({ code: 'ISSUER_MISMATCH', detail: 'issuer_not_configuration_origin' });
    const sub = 'https://school.test/moodle';
    expect(parseOpenIdConfiguration(`${sub}/mod/lti/openid-configuration.php`, moodleIn(sub), STANDARD)).toMatchObject({ issuer: sub });
    expect(parseOpenIdConfiguration(CONFIG_URL, MOODLE_CONFIG, STANDARD)).toMatchObject({ issuer: 'https://moodle.test' });
    expect(parseOpenIdConfiguration('https://moodle.test/pluginfile.php/1/config.json', MOODLE_CONFIG, STANDARD))
      .toEqual({ code: 'ISSUER_MISMATCH', detail: 'configuration_path_mismatch' });
    // The origin rule of today has no path.
    expect(parseOpenIdConfiguration(`${sub}/mod/lti/openid-configuration.php`, moodleIn(sub))).toMatchObject({ code: 'ISSUER_MISMATCH' });
  });

  it('item 2: issuer keeps every endpoint on the issuer origin; any-https takes other hosts but no reserved or own host', () => {
    const offOrigin = generic({ token_endpoint: 'https://auth.idp.test/token' });
    expect(parseOpenIdConfiguration(`${G}/config`, offOrigin, { ...GENERIC, endpointOrigins: 'issuer' })).toEqual({ code: 'INVALID_OPENID_CONFIGURATION', detail: 'not_on_issuer_origin=token_endpoint' });
    expect(parseOpenIdConfiguration(`${G}/config`, offOrigin, GENERIC)).toMatchObject({ tokenEndpoint: 'https://auth.idp.test/token' });
    expect(parseOpenIdConfiguration(`${G}/config`, generic({ token_endpoint: 'https://sso.canvaslms.com:8443/token' }), GENERIC))
      .toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'reserved_host=token_endpoint' });
    expect(parseOpenIdConfiguration(`${G}/config`, generic({ jwks_uri: 'https://lti.cogniate.test/jwks' }), GENERIC))
      .toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'site_rule_3=jwks_uri' });
    expect(parseOpenIdConfiguration(`${G}/config`, generic({ registration_endpoint: 'http://lms.school.test/register' }), GENERIC))
      .toEqual({ code: 'INVALID_OPENID_CONFIGURATION', detail: 'not_https=registration_endpoint' });
    // §4.6.1 order: rule 2 (endpoints), rule 3 (reserved issuer), rule 1 (issuer).
    const canvasIssuer = generic({ issuer: 'https://canvas.instructure.com' });
    expect(parseOpenIdConfiguration('https://canvas.instructure.com/config', canvasIssuer, GENERIC)).toEqual({ code: 'ISSUER_RESERVED', detail: 'issuer_reserved' });
    expect(parseOpenIdConfiguration('https://canvas.instructure.com/config', { ...canvasIssuer, jwks_uri: 'https://sso.canvaslms.com/jwks' }, GENERIC))
      .toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'reserved_host=jwks_uri' });
    const reservedIssuer = generic({ issuer: 'https://sso.canvaslms.com/x', token_endpoint: 'https://lms.school.test/t' });
    expect(parseOpenIdConfiguration('https://sso.canvaslms.com/x/config', reservedIssuer, GENERIC)).toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'site_rule_4=issuer' });
  });

  it('items 4 and 10: authorization_server is the platform audience; I-SELF holds only with everything on the issuer origin', () => {
    const read = (body: Record<string, unknown>) => {
      const c = parseOpenIdConfiguration(`${G}/config`, body, GENERIC);
      if ('code' in c) throw new Error(c.detail);
      return c;
    };
    expect(read(generic()).authorizationServer).toBeNull();
    expect(endpointsOnIssuerOrigin(read(generic()))).toBe(true);
    expect(endpointsOnIssuerOrigin(read(generic({ authorization_server: `${G}/token` })))).toBe(true);
    expect(read(generic({ authorization_server: 'https://auth.idp.test' })).authorizationServer).toBe('https://auth.idp.test');
    expect(endpointsOnIssuerOrigin(read(generic({ authorization_server: 'https://auth.idp.test' })))).toBe(false);
    expect(endpointsOnIssuerOrigin(read(generic({ token_endpoint: 'https://auth.idp.test/token' })))).toBe(false);
    expect(endpointsOnIssuerOrigin(read(generic({ registration_endpoint: 'https://register.idp.test/r' })))).toBe(false);
  });

  it('items 5 and 7: the configuration offers Deep Linking; the answer scope is the granted scope list', () => {
    const read = (messages: unknown) => parseOpenIdConfiguration(CONFIG_URL, { ...MOODLE_CONFIG, [PLATFORM_CONFIG_CLAIM]: { messages_supported: messages } });
    const withDl = read([{ type: 'LtiDeepLinkingRequest' }]);
    const without = read([{ type: 'LtiResourceLinkRequest' }]);
    if ('code' in withDl || 'code' in without) throw new Error('parse');
    expect([supportsDeepLinking(withDl), supportsDeepLinking(without)]).toEqual([true, false]);
    expect(grantedScopesOf({ client_id: 'c', scope: ' a  b a ' })).toEqual(['a', 'b']);
    expect(grantedScopesOf({ client_id: 'c' })).toBeNull();
    expect(grantedScopesOf({ client_id: 'c', scope: 7 })).toBeNull();
  });
});

// ---------------------------------------------------------------- LA-E3-09: the `profile` issuer rule (LA-ADR-05 D6)

describe('the profile issuer rule (LA-ADR-05 D6, A2 BD-A2-89)', () => {
  const OWN = [URLS.lti, URLS.app, URLS.content];
  const ruleFor = (id: string) => {
    const p = profileDefinition(id)!;
    return fixedRuleOf(p, siteRulesFor(p, OWN, { simulation: true }), allFixedHosts({ simulation: true }));
  };
  // Open world (N10): every loaded profile with the profile rule, whatever its channel.
  const FIXED = listProfiles({ simulation: true }).filter((p) => p.dynamicRegistration?.issuerRule === 'profile').map((p) => ruleFor(p.id));
  const ONLY_FIXED: ConfigurationRule = { issuerRules: [], endpointOrigins: 'issuer', fixedRules: FIXED };
  const SITE = 'https://school.instructure.com';
  const URL_AT = (origin: string) => `${origin}/api/lti/security/openid-configuration`;
  const SSO = 'https://sso.canvaslms.com';
  const cloud = (extra: Record<string, unknown> = {}) => ({
    ...MOODLE_CONFIG, issuer: 'https://canvas.instructure.com', authorization_endpoint: `${SSO}/api/lti/authorize_redirect`, jwks_uri: `${SSO}/api/lti/security/jwks`,
    token_endpoint: `${SITE}/login/oauth2/token`, registration_endpoint: `${SITE}/api/lti/registrations`,
    [PLATFORM_CONFIG_CLAIM]: { product_family_code: 'canvas', messages_supported: [{ type: 'LtiDeepLinkingRequest' }] }, ...extra,
  });
  const SELF = 'https://canvas.school.edu';
  const selfHosted = (extra: Record<string, unknown> = {}) => cloud({
    issuer: SELF, authorization_endpoint: `${SELF}/api/lti/authorize_redirect`, jwks_uri: `${SELF}/api/lti/security/jwks`,
    token_endpoint: 'https://api.school.edu/login/oauth2/token', registration_endpoint: `${SELF}/api/lti/registrations`, ...extra,
  });

  it('passes with the profile issuer and the filled values; the site and service origins come from the configuration', () => {
    expect(FIXED.map((r) => r.profile)).toEqual(expect.arrayContaining(['canvas-cloud-production', 'canvas-self-hosted']));
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud(), ONLY_FIXED)).toMatchObject({
      issuer: 'https://canvas.instructure.com', fixed: { profile: 'canvas-cloud-production', siteUrl: SITE, serviceUrl: SITE }, adminRule: false,
    });
    // A separate service origin: the token endpoint origin, with the same site rules.
    const api = 'https://school-api.instructure.com';
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ token_endpoint: `${api}/login/oauth2/token`, registration_endpoint: `${api}/api/lti/registrations` }), ONLY_FIXED))
      .toMatchObject({ fixed: { profile: 'canvas-cloud-production', siteUrl: SITE, serviceUrl: api } });
    // Self-hosted: the issuer is the site origin.
    expect(parseOpenIdConfiguration(URL_AT(SELF), selfHosted(), ONLY_FIXED))
      .toMatchObject({ issuer: SELF, fixed: { profile: 'canvas-self-hosted', siteUrl: SELF, serviceUrl: 'https://api.school.edu' } });
  });

  it('AP-05-30: an issuer that is not the profile issuer, or one endpoint that differs from the filled value, is refused', () => {
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ issuer: 'https://lms.example.edu' }), ONLY_FIXED)).toEqual({ code: 'ISSUER_MISMATCH', detail: 'issuer_not_profile_issuer' });
    expect(parseOpenIdConfiguration(URL_AT(SELF), selfHosted({ issuer: `${SELF}/x` }), ONLY_FIXED)).toEqual({ code: 'ISSUER_MISMATCH', detail: 'issuer_not_profile_issuer' });
    for (const [name, value] of [
      ['authorization_endpoint', `${SSO}/api/lti/authorize`], ['jwks_uri', `${SITE}/api/lti/security/jwks`], ['token_endpoint', `${SITE}/login/oauth2/token/`],
    ] as const) {
      expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ [name]: value }), ONLY_FIXED), name).toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: `not_profile_value=${name}` });
    }
    // The beta issuer with the production endpoints: the beta rule names the problem.
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ issuer: 'https://canvas.beta.instructure.com' }), ONLY_FIXED))
      .toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'not_profile_value=authorization_endpoint' });
    // The service origin passes the site rules (here rule 4: the fixed sso host); the registration endpoint stays on the site or service origin.
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ token_endpoint: `${SSO}/login/oauth2/token` }), ONLY_FIXED)).toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'site_rule_4=token_endpoint' });
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ registration_endpoint: 'https://other.example.edu/api/lti/registrations' }), ONLY_FIXED))
      .toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'not_on_site_origin=registration_endpoint' });
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ registration_endpoint: `http://school.instructure.com/api/lti/registrations` }), ONLY_FIXED))
      .toEqual({ code: 'INVALID_OPENID_CONFIGURATION', detail: 'not_https=registration_endpoint' });
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ jwks_uri: undefined }), ONLY_FIXED)).toEqual({ code: 'INVALID_OPENID_CONFIGURATION', detail: 'missing=jwks_uri' });
  });

  it('BD-A2-89: the configuration URL gives the site; on a fixed endpoint host it proves none; elsewhere the site rules refuse it', () => {
    expect(parseOpenIdConfiguration(URL_AT(SSO), cloud({ registration_endpoint: `${SSO}/api/lti/registrations` }), ONLY_FIXED))
      .toMatchObject({ fixed: { profile: 'canvas-cloud-production', siteUrl: null, serviceUrl: SITE } });
    expect(parseOpenIdConfiguration(URL_AT('https://canvas.instructure.com'), cloud(), ONLY_FIXED)).toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'site_rule_4=configuration_url' });
    expect(parseOpenIdConfiguration(URL_AT('https://sso.test.canvaslms.com'), cloud(), ONLY_FIXED)).toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'site_rule_4=configuration_url' });
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ token_endpoint: 'https://sso.beta.canvaslms.com/login/oauth2/token' }), ONLY_FIXED))
      .toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'site_rule_4=token_endpoint' });
    expect(parseOpenIdConfiguration(URL_AT(SELF), selfHosted({ issuer: 'https://school.instructure.com' }), { ...ONLY_FIXED, fixedRules: [ruleFor('canvas-self-hosted')] }))
      .toEqual({ code: 'ISSUER_MISMATCH', detail: 'issuer_not_profile_issuer' });
    expect(parseOpenIdConfiguration(URL_AT(SITE), selfHosted({ issuer: SITE }), { ...ONLY_FIXED, fixedRules: [ruleFor('canvas-self-hosted')] }))
      .toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'site_rule_5=configuration_url' });
  });

  it('AC-LA-E3-09-05: before the fetch, the URL must be https on an allowed site or on a fixed endpoint host of the profile', () => {
    const production = ruleFor('canvas-cloud-production');
    const self = ruleFor('canvas-self-hosted');
    expect([URL_AT(SITE), URL_AT(SSO), URL_AT('https://school-api.instructure.com')].map((u) => configurationUrlFits(u, production))).toEqual([true, true, true]);
    for (const refused of [
      URL_AT('https://canvas.instructure.com'), `http://school.instructure.com/x`, 'https://10.1.2.3/x', URL_AT('https://localhost'), `${URLS.lti}/x`,
      'https://user@school.instructure.com/x', `${URL_AT(SITE)}#f`, 'not a url',
    ]) expect(configurationUrlFits(refused, production), refused).toBe(false);
    expect([URL_AT(SELF), URL_AT(SITE), URL_AT(SSO)].map((u) => configurationUrlFits(u, self))).toEqual([true, false, false]);
    // BD-A2-89: the fixed hosts of every loaded profile (the twins too) are no site; only the profile's own endpoint hosts are fetched.
    const beta = ruleFor('canvas-cloud-beta');
    expect([URL_AT('https://canvas.instructure.com'), URL_AT(SSO), URL_AT('https://sso.beta.canvaslms.com'), URL_AT('https://developer.blackboard.com')]
      .map((u) => configurationUrlFits(u, beta))).toEqual([false, false, true, false]);
    expect(configurationUrlFits(URL_AT('https://sso.beta.canvaslms.com'), production)).toBe(false);
  });

  it('with admin-value rules loaded: the profile rule is tried first; an admin configuration keeps its own result and problem', () => {
    const MIXED: ConfigurationRule = { issuerRules: [{ issuerRule: 'origin' }], endpointOrigins: 'issuer', fixedRules: FIXED };
    expect(parseOpenIdConfiguration(CONFIG_URL, MOODLE_CONFIG, MIXED)).toMatchObject({ issuer: 'https://moodle.test', fixed: null, adminRule: true });
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud(), MIXED)).toMatchObject({ fixed: { profile: 'canvas-cloud-production' }, adminRule: false });
    // A configuration that passes both kinds of rule (everything on the self-hosted site): both are reported.
    const allOnSite = selfHosted({ token_endpoint: `${SELF}/login/oauth2/token` });
    expect(parseOpenIdConfiguration(URL_AT(SELF), allOnSite, MIXED)).toMatchObject({ fixed: { profile: 'canvas-self-hosted', serviceUrl: SELF }, adminRule: true });
    // Problems: the admin problem for an admin configuration; the problem of the profile whose fixed issuer the configuration names.
    expect(parseOpenIdConfiguration(CONFIG_URL, { ...MOODLE_CONFIG, token_endpoint: 'https://auth.idp.test/token' }, MIXED))
      .toEqual({ code: 'INVALID_OPENID_CONFIGURATION', detail: 'not_on_issuer_origin=token_endpoint' });
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ jwks_uri: `${SSO}/jwks` }), MIXED)).toEqual({ code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: 'not_profile_value=jwks_uri' });
    expect(parseOpenIdConfiguration(URL_AT(SITE), cloud({ issuer: 'https://lms.example.edu' }), MIXED)).toEqual({ code: 'ISSUER_MISMATCH', detail: 'issuer_not_configuration_origin' });
  });
});
