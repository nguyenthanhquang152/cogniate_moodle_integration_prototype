import type { ToolAccount } from '../store/accounts.ts';

/** The protocol URLs of one tool account. Only accounts/resolver.ts builds them (LA-ADR-06 D2, BD-A2-49). */
export interface ProtocolUrls {
  /** OIDC login initiation (contract §2.1). */
  login: string;
  /** The redirect URI and the only allowed launch target (contract §2.2). */
  launch: string;
  /** The tool JWKS (contract §2.3). */
  keys: string;
  /** The Dynamic Registration start (contract §2.4). */
  register: string;
}

/** The part of the account resolver that protocol code uses. A route group builds one resolver at registration. */
export interface ProtocolUrlResolver {
  protocolUrls(account: ToolAccount): ProtocolUrls;
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
  const base = new URL(urls.launch);
  return u.origin === base.origin && u.pathname === base.pathname && u.hash === '' && u.username === '' && u.password === '';
}
