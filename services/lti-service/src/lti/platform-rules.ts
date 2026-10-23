// Platform URL rules (security §2.4), one pure function for the platforms API (T2a) and dynamic registration (T3b),
// and the M1 profile rules of the platform and deployment endpoints (LTI contract §9.4 to §9.6, §9.15).
import { checkSiteUrl, hostOf } from '@cogniate/shared';
import type { SiteRule, SiteRuleInput } from '@cogniate/shared';
import { ApiError } from '../api-errors.ts';

export interface PlatformUrls {
  url: string;
  authenticationEndpoint: string;
  accesstokenEndpoint: string;
  jwksUrl: string;
}

export const isHttpsUrl = (v: string): boolean => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.username === '' && u.password === '' && u.hash === '';
  } catch {
    return false;
  }
};

/**
 * Every URL is https (no user info, no fragment), and the auth, token and JWKS URLs are on the issuer origin
 * (Moodle: auth.php, token.php, certs.php under wwwroot). Throws 400 INVALID_REQUEST or PLATFORM_URL_NOT_ON_ISSUER_ORIGIN.
 * `fields` names the request fields in the error text (platforms API: authConfig.key for the JWKS URL).
 */
export function checkPlatformUrls(p: PlatformUrls, fields: Record<keyof PlatformUrls, string> = { url: 'url', authenticationEndpoint: 'authenticationEndpoint', accesstokenEndpoint: 'accesstokenEndpoint', jwksUrl: 'jwksUrl' }): void {
  for (const key of ['url', 'authenticationEndpoint', 'accesstokenEndpoint', 'jwksUrl'] as const) {
    if (!isHttpsUrl(p[key])) throw new ApiError('INVALID_REQUEST', `Invalid field: ${fields[key]} must be an https URL.`);
  }
  const origin = new URL(p.url).origin;
  for (const key of ['authenticationEndpoint', 'accesstokenEndpoint', 'jwksUrl'] as const) {
    if (new URL(p[key]).origin !== origin) throw new ApiError('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN', `${fields[key]} is not on the issuer origin.`);
  }
}

/** The hosts and origins that the `any-https` rules refuse (contract delta §4.6.1). */
export interface AnyHttpsRules {
  /** Site rule 3: the hosts of the own public URLs. */
  ownHosts: readonly string[];
  /** The fixed hosts and fixed-issuer hosts of every loaded profile, any port (A-LAD-01). */
  reservedHosts: readonly string[];
  /** The reserved issuer origins (LTI contract §9.1). */
  reservedIssuerOrigins: readonly string[];
}

const ENDPOINTS = ['authenticationEndpoint', 'accesstokenEndpoint', 'jwksUrl'] as const;

/**
 * Contract delta §4.6.1 rule 2 for one https endpoint URL: null, the failed site rule (2 or 3), or `reserved host` (a
 * fixed host or fixed-issuer host of any loaded profile, any port). Also used by Dynamic Registration (§4.5).
 */
export function endpointHostProblem(value: string, rules: AnyHttpsRules): 2 | 3 | 'reserved host' | null {
  const site = checkSiteUrl(new URL(value).origin, { ownHosts: rules.ownHosts, profileFixedHosts: [] });
  if (!site.ok) return site.rule as 2 | 3;
  return rules.reservedHosts.map((h) => h.toLowerCase()).includes(hostOf(value)!) ? 'reserved host' : null;
}

/**
 * Contract delta §4.6.1 rule 1 for an issuer: https, no user info, no query, no fragment; a path is allowed. Its origin
 * passes site rules 1 to 3 and is not a fixed host of any loaded profile (rule 4 of the shared function). Null = passes.
 */
export function issuerSiteProblem(value: string, rules: AnyHttpsRules): SiteRule | null {
  let issuer: URL;
  try { issuer = new URL(value); } catch { return 1; }
  if (issuer.protocol !== 'https:' || issuer.username !== '' || issuer.password !== '' || /[?#\\]/.test(value)) return 1;
  const site = checkSiteUrl(issuer.origin, { ownHosts: rules.ownHosts, profileFixedHosts: rules.reservedHosts });
  return site.ok ? null : site.rule;
}

/**
 * Contract delta §4.6.1 for a profile with `endpointOrigins: any-https` (LA-ADR-02 D2, D2a), in the rule order of
 * rule 5: rule 2 (endpoints), rule 3 (reserved issuer), rule 1 (issuer), rule 7 (I-SELF). The issuer may have a path.
 * A staged create (inactive, with a bindingRef) may have endpoints and an assertion audience off the issuer origin.
 * No URL is fetched here; later calls use the guarded client (rule 4).
 */
export function checkAnyHttpsPlatform(p: PlatformUrls, staged: boolean, rules: AnyHttpsRules,
  fields: Record<keyof PlatformUrls, string>): void {
  // Rule 2: each endpoint is https; its host passes site rules 2 and 3 and is not a reserved host.
  for (const key of ENDPOINTS) {
    if (!isHttpsUrl(p[key])) throw new ApiError('INVALID_REQUEST', `Invalid field: ${fields[key]} must be an https URL.`);
    const problem = endpointHostProblem(p[key], rules);
    if (problem === 'reserved host') throw new ApiError('PLATFORM_URL_NOT_IN_PROFILE', `${fields[key]} is on a reserved host of a hosted LMS profile.`);
    if (problem !== null) throw new ApiError('PLATFORM_URL_NOT_IN_PROFILE', `${fields[key]} breaks rule ${problem} of the site rules.`);
  }
  // Rule 3: the issuer origin is not a reserved issuer origin. A value that does not parse fails rule 1 next.
  let origin: string | null = null;
  try { origin = new URL(p.url).origin; } catch { /* rule 1 */ }
  if (origin !== null && rules.reservedIssuerOrigins.includes(origin)) throw new ApiError('ISSUER_RESERVED', 'This issuer belongs to a hosted LMS profile. Use that profile.');
  // Rule 1.
  const rule = issuerSiteProblem(p.url, rules);
  if (rule !== null) throw new ApiError('INVALID_SITE_URL', `Invalid field: ${fields.url} breaks rule ${rule} of the site rules.`, { details: { rule, field: fields.url } });
  // Rule 7 (I-SELF): an active platform keeps every endpoint on the issuer origin. The audience: checkActiveAudience.
  if (staged) return;
  for (const key of ENDPOINTS) {
    if (new URL(p[key]).origin !== origin) throw new ApiError('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN', `${fields[key]} is not on the issuer origin. ${STAGED_HINT}`);
  }
}

const STAGED_HINT = 'A value off the issuer origin needs a staged create (active false, with a bindingRef).';

/**
 * LA-ADR-02 D2a, A1 BD-A1-82: an active admin platform of any profile has `clientAssertionAud` absent or equal to its
 * token URL, else 400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN. A staged create (inactive, with a bindingRef) is exempt.
 */
export function checkActiveAudience(p: { accesstokenEndpoint: string; clientAssertionAud?: string | undefined }, staged: boolean): void {
  if (staged || p.clientAssertionAud === undefined || p.clientAssertionAud === p.accesstokenEndpoint) return;
  throw new ApiError('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN', `clientAssertionAud is not the accesstokenEndpoint on the issuer origin. ${STAGED_HINT}`);
}

// ---------------------------------------------------------------- M1: provider profiles (LTI contract §9.4 to §9.6)

/** Site rule check of one field (shared function, ADR-011 §6). Throws 400 INVALID_SITE_URL naming the rule. */
export function checkProfileSiteUrl(field: 'siteUrl' | 'serviceUrl', value: string, rules: SiteRuleInput): string {
  const r = checkSiteUrl(value, rules);
  if (!r.ok) throw new ApiError('INVALID_SITE_URL', `Invalid field: ${field} breaks rule ${r.rule} of the site rules.`, { details: { rule: r.rule, field } });
  return r.origin;
}

/** A binding ref (contract §9.15): 1 to 64 characters [A-Za-z0-9_-]. */
export const BINDING_REF = /^[A-Za-z0-9_-]{1,64}$/;

/** A deployment id (contract §9.5): 1 to 255 printable ASCII characters, no space. */
export const DEPLOYMENT_ID = /^[\x21-\x7e]{1,255}$/;

/**
 * The rotation rule of contract §9.15: a request with `ifBindingRef` (also `null`) must send a new `bindingRef` that
 * differs from it. Checked before the condition. Throws 400 INVALID_REQUEST, field bindingRef.
 */
export function checkRotation(body: { bindingRef?: string; ifBindingRef?: string | null }): void {
  if (body.ifBindingRef === undefined) return;
  if (body.bindingRef === undefined || body.bindingRef === body.ifBindingRef) throw new ApiError('INVALID_REQUEST', 'Invalid field: bindingRef (a conditional change must write a new bindingRef).');
}
