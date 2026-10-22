import type { createAccountResolver } from '../accounts/resolver.ts';

export type ProtocolUrls = ReturnType<ReturnType<typeof createAccountResolver>['protocolUrls']>;

/** {PUBLIC_LTI_URL}/lti/launch/{toolAccountId}: the redirect URI and the only allowed launch target. */
export function launchUri(urls: Pick<ProtocolUrls, 'launch'>): string {
  return urls.launch;
}

export function loginUri(urls: Pick<ProtocolUrls, 'login'>): string {
  return urls.login;
}

/**
 * Security §2.1 rule 4 and §2.2 check 12: the target starts with {PUBLIC_LTI_URL}/lti/launch/{toolAccountId}.
 * Implemented as "same origin and the exact path", so ".../launch/cogniate-evil" or ".../launch/cogniate/x" fail.
 * A query is allowed (for example ?resource=seed); a fragment or user info is not.
 */
export function isOwnLaunchTarget(value: unknown, urls: Pick<ProtocolUrls, 'launch'>): boolean {
  if (typeof value !== 'string') return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  const base = new URL(launchUri(urls));
  return u.origin === base.origin && u.pathname === base.pathname && u.hash === '' && u.username === '' && u.password === '';
}
