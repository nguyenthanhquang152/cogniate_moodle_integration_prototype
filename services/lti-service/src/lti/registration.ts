// Dynamic registration rules (contract §2.4, §3.8, security §2.4, §2.5, ADR-009). Pure functions: the route
// (http/routes/registration.ts) does the network calls.
import type { PublicUrls } from '@cogniate/shared';
import type { PrivacyLevel, RegistrationOperation } from '../store/registrations.ts';
import { isHttpsUrl } from './platform-rules.ts';
import { launchUri, loginUri } from './target.ts';

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
  /** The configuration as the platform sent it (`raw=true`). */
  raw: Record<string, unknown>;
}

export type ConfigurationProblem = { code: 'INVALID_OPENID_CONFIGURATION' | 'ISSUER_MISMATCH'; detail: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Security §2.4: the configuration `issuer` must equal the origin of the configuration URL, and every endpoint URL in
 * it must be an https URL on that origin. Returns the parsed configuration, or the problem (code + safe detail).
 */
export function parseOpenIdConfiguration(configUrl: string, body: unknown): OpenIdConfiguration | ConfigurationProblem {
  if (!isObj(body)) return { code: 'INVALID_OPENID_CONFIGURATION', detail: 'not_json_object' };
  const origin = new URL(configUrl).origin;
  if (typeof body.issuer !== 'string' || body.issuer === '') return { code: 'INVALID_OPENID_CONFIGURATION', detail: 'missing=issuer' };
  if (body.issuer !== origin) return { code: 'ISSUER_MISMATCH', detail: 'issuer_not_configuration_origin' };
  const endpoints = {
    authorization_endpoint: body.authorization_endpoint, token_endpoint: body.token_endpoint, jwks_uri: body.jwks_uri, registration_endpoint: body.registration_endpoint,
  };
  for (const [name, value] of Object.entries(endpoints)) {
    if (typeof value !== 'string' || value === '') return { code: 'INVALID_OPENID_CONFIGURATION', detail: `missing=${name}` };
    if (!isHttpsUrl(value) || new URL(value).origin !== origin) return { code: 'INVALID_OPENID_CONFIGURATION', detail: `not_on_issuer_origin=${name}` };
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
    raw: body,
  };
}

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
  urls: PublicUrls;
  accountId: string;
  clientName: string;
  privacyLevel: PrivacyLevel;
  messages?: RegistrationMessage[];
}): Obj {
  const launch = launchUri(input.urls, input.accountId);
  const messages = (input.messages ?? [{ type: 'LtiDeepLinkingRequest', placements: ['ContentArea'] }])
    .map((m) => ({ type: m.type, target_link_uri: m.target_link_uri ?? launch, label: m.label ?? 'Cogniate', ...(m.placements ? { placements: m.placements } : {}) }));
  return {
    application_type: 'web',
    response_types: ['id_token'],
    grant_types: ['implicit', 'client_credentials'],
    initiate_login_uri: loginUri(input.urls, input.accountId),
    redirect_uris: [launch],
    jwks_uri: `${input.urls.lti}/lti/keys/${encodeURIComponent(input.accountId)}`,
    token_endpoint_auth_method: 'private_key_jwt',
    client_name: input.clientName,
    scope: REGISTRATION_SCOPES.join(' '),
    [TOOL_CONFIG_CLAIM]: {
      domain: new URL(input.urls.lti).host,
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

/** GET /api/registrations/:id body (contract §3.8). */
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
    ...(raw ? { raw: config.raw } : {}),
  };
}

/** The page that the tool returns in the registration frame: Moodle closes the dialog on this message. */
export const REGISTRATION_CLOSE_HTML = "<script>(window.opener || window.parent).postMessage({subject:'org.imsglobal.lti.close'}, '*');</script>";
