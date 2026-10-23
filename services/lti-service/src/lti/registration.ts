// Dynamic registration rules (contract §2.4, §3.8, security §2.4, §2.5, ADR-009). Pure functions: the route
// (http/routes/registration.ts) does the network calls.
import type { ProtocolUrls } from './target.ts';
import type { PrivacyLevel, RegistrationOperation } from '../store/registrations.ts';
import type { AnyHttpsRules } from './platform-rules.ts';
import { endpointHostProblem, isHttpsUrl, issuerSiteProblem } from './platform-rules.ts';

export const PRIVACY_LEVELS: readonly PrivacyLevel[] = ['public', 'name_only', 'email_only', 'anonymous'];
export const DEFAULT_PRIVACY: PrivacyLevel = 'anonymous';
export const PLATFORM_CONFIG_CLAIM = 'https://purl.imsglobal.org/spec/lti-platform-configuration';
export const TOOL_CONFIG_CLAIM = 'https://purl.imsglobal.org/spec/lti-tool-configuration';

/** ADR-009: the services the tool asks for. */
export const REGISTRATION_SCOPES = [
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
  'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
] as const;

/** ADR-009 claims per privacy level. Moodle sets "share name / email" from them (Never without them). */
export function claimsFor(level: PrivacyLevel): string[] {
  const base = ['iss', 'sub'];
  const name = ['name', 'given_name', 'family_name'];
  switch (level) {
    case 'anonymous': return base;
    case 'name_only': return [...base, ...name];
    case 'email_only': return [...base, 'email'];
    case 'public': return [...base, ...name, 'email'];
  }
}

export interface OpenIdConfiguration {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  registrationEndpoint: string;
  productFamilyCode: string;
  version: string;
  scopesSupported: string[];
  messagesSupported: Array<{ type: string; placements?: string[] }>;
  /** The token audience of the platform (`authorization_server`), when present (LA-ADR-02 D5 item 4). */
  authorizationServer: string | null;
  /** The configuration as the platform sent it (`raw=true`). */
  raw: Record<string, unknown>;
}

export type ConfigurationProblem = { code: 'INVALID_OPENID_CONFIGURATION' | 'ISSUER_MISMATCH' | 'PLATFORM_URL_NOT_IN_PROFILE' | 'ISSUER_RESERVED'; detail: string };

/** The issuer rule of a Dynamic Registration profile (LA-ADR-02 D2 trait `dynamicRegistration`). */
export interface IssuerRule {
  issuerRule: 'origin' | 'path-prefix' | 'profile';
  configurationPath?: string;
}

/**
 * The configuration rule of one profile, or the loosest rule of every DR profile (the start page; LA-ADR-02 D5).
 * The configuration passes when ANY issuer rule passes. `profile` (fixed endpoints, A2's Canvas DR) is not built
 * here, so it never passes.
 */
export interface ConfigurationRule {
  issuerRules: readonly IssuerRule[];
  endpointOrigins: 'issuer' | 'any-https';
  /** For `any-https`: the hosts that the configuration must not use (contract delta §4.5, §4.6.1 rules 1 and 2). */
  hosts?: AnyHttpsRules;
}

/** Today's Moodle rule (security §2.4): the issuer is the configuration URL origin, every endpoint on that origin. */
export const ORIGIN_RULE: ConfigurationRule = { issuerRules: [{ issuerRule: 'origin' }], endpointOrigins: 'issuer' };

const isIssuerUrl = (v: string): boolean => isHttpsUrl(v) && !/[?#]/.test(v);

/** Null when an issuer rule passes, else the safe detail of ISSUER_MISMATCH. */
function issuerRuleProblem(configUrl: string, issuer: string, rules: readonly IssuerRule[]): string | null {
  const prefix = isIssuerUrl(issuer) && configUrl.startsWith(`${issuer}/`);
  for (const rule of rules) {
    if (rule.issuerRule === 'origin' && issuer === new URL(configUrl).origin) return null;
    // D5 item 1: the configuration URL starts with the issuer and "/"; with configurationPath it is exactly issuer + path.
    if (rule.issuerRule === 'path-prefix' && prefix && (rule.configurationPath === undefined || configUrl === `${issuer}${rule.configurationPath}`)) return null;
  }
  // LA-IC-03: the issuer fits, but the configuration is at another path of the site.
  return prefix && rules.some((r) => r.issuerRule === 'path-prefix') ? 'configuration_path_mismatch' : 'issuer_not_configuration_origin';
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Security §2.4 with the profile rule (LA-ADR-02 D5 items 1 and 2). The issuer follows an issuer rule. With
 * `endpointOrigins: issuer` every endpoint URL is https on the issuer origin. With `any-https` the rules of §4.6.1 run
 * in its order: each endpoint host passes rule 2 (PLATFORM_URL_NOT_IN_PROFILE), the issuer origin is not reserved
 * (rule 3, ISSUER_RESERVED), and the issuer passes rule 1. Returns the parsed configuration, or the problem (code +
 * safe detail). The default rule is today's Moodle rule.
 */
export function parseOpenIdConfiguration(configUrl: string, body: unknown, rule: ConfigurationRule = ORIGIN_RULE): OpenIdConfiguration | ConfigurationProblem {
  if (!isObj(body)) return { code: 'INVALID_OPENID_CONFIGURATION', detail: 'not_json_object' };
  if (typeof body.issuer !== 'string' || body.issuer === '') return { code: 'INVALID_OPENID_CONFIGURATION', detail: 'missing=issuer' };
  const issuerProblem = issuerRuleProblem(configUrl, body.issuer, rule.issuerRules);
  if (issuerProblem) return { code: 'ISSUER_MISMATCH', detail: issuerProblem };
  const origin = new URL(body.issuer).origin;
  const endpoints = {
    authorization_endpoint: body.authorization_endpoint, token_endpoint: body.token_endpoint, jwks_uri: body.jwks_uri, registration_endpoint: body.registration_endpoint,
  };
  for (const [name, value] of Object.entries(endpoints)) {
    if (typeof value !== 'string' || value === '') return { code: 'INVALID_OPENID_CONFIGURATION', detail: `missing=${name}` };
    if (rule.endpointOrigins === 'issuer') {
      if (!isHttpsUrl(value) || new URL(value).origin !== origin) return { code: 'INVALID_OPENID_CONFIGURATION', detail: `not_on_issuer_origin=${name}` };
      continue;
    }
    if (!isHttpsUrl(value)) return { code: 'INVALID_OPENID_CONFIGURATION', detail: `not_https=${name}` };
    const host = rule.hosts ? endpointHostProblem(value, rule.hosts) : null;
    if (host !== null) return { code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: `${host === 'reserved host' ? 'reserved_host' : `site_rule_${host}`}=${name}` };
  }
  if (rule.endpointOrigins === 'any-https' && rule.hosts) {
    if (rule.hosts.reservedIssuerOrigins.includes(origin)) return { code: 'ISSUER_RESERVED', detail: 'issuer_reserved' };
    const site = issuerSiteProblem(body.issuer, rule.hosts);
    if (site !== null) return { code: 'PLATFORM_URL_NOT_IN_PROFILE', detail: `site_rule_${site}=issuer` };
  }
  const platform = isObj(body[PLATFORM_CONFIG_CLAIM]) ? (body[PLATFORM_CONFIG_CLAIM] as Obj) : {};
  return {
    issuer: body.issuer,
    authorizationEndpoint: endpoints.authorization_endpoint as string,
    tokenEndpoint: endpoints.token_endpoint as string,
    jwksUri: endpoints.jwks_uri as string,
    registrationEndpoint: endpoints.registration_endpoint as string,
    productFamilyCode: typeof platform.product_family_code === 'string' ? platform.product_family_code : '',
    version: typeof platform.version === 'string' ? platform.version : '',
    scopesSupported: strings(body.scopes_supported),
    messagesSupported: (Array.isArray(platform.messages_supported) ? platform.messages_supported : [])
      .filter(isObj).filter((m) => typeof m.type === 'string')
      .map((m) => ({ type: m.type as string, ...(Array.isArray(m.placements) ? { placements: strings(m.placements) } : {}) })),
    authorizationServer: typeof body.authorization_server === 'string' && body.authorization_server !== '' ? body.authorization_server : null,
    raw: body,
  };
}

/**
 * I-SELF for a configuration (LA-ADR-02 D2a; contract delta §4.5 `endpointsOnIssuerOrigin`): the auth, token, JWKS and
 * registration endpoints are on the issuer origin, and `authorization_server` is absent or the token URL.
 */
export function endpointsOnIssuerOrigin(config: OpenIdConfiguration): boolean {
  const origin = new URL(config.issuer).origin;
  const onOrigin = [config.authorizationEndpoint, config.tokenEndpoint, config.jwksUri, config.registrationEndpoint].every((url) => new URL(url).origin === origin);
  return onOrigin && (config.authorizationServer === null || config.authorizationServer === config.tokenEndpoint);
}

/** D5 item 5: the tool adds content with Deep Linking, so the platform must support the Deep Linking request. */
export const supportsDeepLinking = (config: OpenIdConfiguration): boolean => config.messagesSupported.some((m) => m.type === 'LtiDeepLinkingRequest');

/**
 * Security §2.5: Moodle's registration token says the operation. `scope = reg-update` and `sub = <type id>`: update of
 * that tool; `scope = reg`: a new tool. Anything else: null (the caller refuses the registration).
 */
export function operationFromToken(payload: Obj): { operation: RegistrationOperation; typeId: string | null } | null {
  if (payload.scope === 'reg') return { operation: 'new', typeId: null };
  if (payload.scope === 'reg-update' && (typeof payload.sub === 'string' || typeof payload.sub === 'number') && String(payload.sub) !== '') {
    return { operation: 'update', typeId: String(payload.sub) };
  }
  return null;
}

export interface RegistrationMessage {
  type: string;
  placements?: string[];
  label?: string;
  target_link_uri?: string;
}

/** The registration request of ADR-009 (sent at `complete` to the platform registration endpoint). */
export function buildRegistrationRequest(input: {
  protocolUrls: ProtocolUrls;
  clientName: string;
  privacyLevel: PrivacyLevel;
  messages?: RegistrationMessage[];
  scopes?: readonly string[];
}): Obj {
  const launch = input.protocolUrls.launch;
  const messages = (input.messages ?? [{ type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] }])
    .map((m) => ({ type: m.type, target_link_uri: m.target_link_uri ?? launch, label: m.label ?? 'Cogniate', ...(m.placements ? { placements: m.placements } : {}) }));
  return {
    application_type: 'web',
    response_types: ['id_token'],
    grant_types: ['implicit', 'client_credentials'],
    initiate_login_uri: input.protocolUrls.login,
    redirect_uris: [launch],
    jwks_uri: input.protocolUrls.keys,
    token_endpoint_auth_method: 'private_key_jwt',
    client_name: input.clientName,
    scope: (input.scopes ?? REGISTRATION_SCOPES).join(' '),
    [TOOL_CONFIG_CLAIM]: {
      domain: new URL(input.protocolUrls.launch).host,
      target_link_uri: launch,
      claims: claimsFor(input.privacyLevel),
      messages,
    },
  };
}

/** The platform answer of a registration: the client id and the deployment id (Moodle: the tool type id). */
export function parseRegistrationResponse(body: unknown): { clientId: string; deploymentId: string } | null {
  if (!isObj(body) || typeof body.client_id !== 'string' || body.client_id === '') return null;
  const tool = isObj(body[TOOL_CONFIG_CLAIM]) ? (body[TOOL_CONFIG_CLAIM] as Obj) : {};
  const dep = tool.deployment_id;
  if ((typeof dep !== 'string' && typeof dep !== 'number') || String(dep) === '') return null;
  return { clientId: body.client_id, deploymentId: String(dep) };
}

/** D5 item 7: the `scope` of the registration answer (space separated), or null when the platform sends none. */
export function grantedScopesOf(body: unknown): string[] | null {
  if (!isObj(body) || typeof body.scope !== 'string') return null;
  return [...new Set(body.scope.split(/\s+/).filter(Boolean))];
}

/** GET /api/registrations/:id body (contract §3.8; E2 adds endpointsOnIssuerOrigin, delta §4.5). */
export function registrationView(config: OpenIdConfiguration, session: { privacyLevel: PrivacyLevel; operation: RegistrationOperation; existingPlatformId: string | null }, raw: boolean): Obj {
  return {
    url: config.issuer,
    familyCode: config.productFamilyCode,
    version: config.version,
    supportedScopes: config.scopesSupported,
    supportedMessages: config.messagesSupported,
    privacyLevel: session.privacyLevel,
    operation: session.operation,
    existingPlatformId: session.existingPlatformId,
    endpointsOnIssuerOrigin: endpointsOnIssuerOrigin(config),
    ...(raw ? { raw: config.raw } : {}),
  };
}

/** The page that the tool returns in the registration frame: Moodle closes the dialog on this message. */
export const REGISTRATION_CLOSE_HTML = "<script>(window.opener || window.parent).postMessage({subject:'org.imsglobal.lti.close'}, '*');</script>";
