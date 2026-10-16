import type { PublicUrls } from '@cogniate/shared';

/** {PUBLIC_LTI_URL}/lti/launch/{toolAccountId}: the redirect URI and the only allowed launch target. */
export function launchUri(urls: PublicUrls, accountId: string): string {
  return `${urls.lti}/lti/launch/${encodeURIComponent(accountId)}`;
}

export function loginUri(urls: PublicUrls, accountId: string): string {
  return `${urls.lti}/lti/login/${encodeURIComponent(accountId)}`;
}

/**
 * Security §2.1 rule 4 and §2.2 check 12: the target starts with {PUBLIC_LTI_URL}/lti/launch/{toolAccountId}.
 * Implemented as "same origin and the exact path", so ".../launch/cogniate-evil" or ".../launch/cogniate/x" fail.
 * A query is allowed (for example ?resource=seed); a fragment or user info is not.
 */
export function isOwnLaunchTarget(value: unknown, urls: PublicUrls, accountId: string): boolean {
  if (typeof value !== 'string') return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  const base = new URL(launchUri(urls, accountId));
  return u.origin === base.origin && u.pathname === base.pathname && u.hash === '' && u.username === '' && u.password === '';
}
