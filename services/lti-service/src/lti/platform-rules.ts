// Platform URL rules (security §2.4), one pure function for the platforms API (T2a) and dynamic registration (T3b),
// and the M1 profile rules of the platform and deployment endpoints (LTI contract §9.4 to §9.6, §9.15).
import { checkSiteUrl } from '@cogniate/shared';
import type { SiteRuleInput } from '@cogniate/shared';
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
