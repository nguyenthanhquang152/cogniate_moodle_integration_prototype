// Platform URL rules (security §2.4), one pure function for the platforms API (T2a) and dynamic registration (T3b).
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
