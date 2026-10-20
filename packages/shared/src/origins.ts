// Canonical origins and site rules (ADR-011 §6, LTI contract §9.1, app contract §4.2). ONE implementation for the LTI
// service and the Cogniate app: both services canonicalize and check every site URL, Canvas service URL and
// self-hosted issuer with these functions, so the two services always agree.
import { isIP } from 'node:net';

/** Site rules of ADR-011 §6: 1 form, 2 host name, 3 own service host, 4 fixed provider host, 5 hosted Canvas host. */
export type SiteRule = 1 | 2 | 3 | 4 | 5;

export type CanonicalOrigin = { ok: true; origin: string } | { ok: false; rule: 1 };
export type SiteUrlCheck = { ok: true; origin: string } | { ok: false; rule: SiteRule };

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

/**
 * `https://` + lower-case ASCII host (IDN as punycode) + `:port` only when the port is not 443; no path, no trailing
 * `/`. Refused (rule 1): another scheme, user info, a path other than `/`, a query or a fragment (also an empty `?`
 * or `#`), and an input that is not an absolute URL. The input is not trimmed.
 */
export function canonicalOrigin(input: string): CanonicalOrigin {
  if (!SCHEME.test(input) || input.includes('?') || input.includes('#') || input.includes('\\')) return { ok: false, rule: 1 };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, rule: 1 };
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hostname === '') return { ok: false, rule: 1 };
  if (url.pathname !== '/' && url.pathname !== '') return { ok: false, rule: 1 };
  return { ok: true, origin: url.origin };
}

/** The host name of a canonical origin, without port and without IPv6 brackets. */
export function originHost(origin: string): string {
  return new URL(origin).hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

/** The lower-case host name of a URL, or null when it does not parse. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The fixed hosts of a provider profile (ADR-011 §6): the hosts of its fixed issuer and of its fixed auth, JWKS and
 * token URLs. A value built from `{siteUrl}` or `{serviceUrl}` (or `null`, an admin value) has no fixed host. A
 * `{clientId}` in a path does not change the host.
 */
export function fixedHostsOf(values: ReadonlyArray<string | null>): string[] {
  const hosts = new Set<string>();
  for (const v of values) {
    if (v === null || v.startsWith('{')) continue;
    const h = hostOf(v);
    if (h) hosts.add(h);
  }
  return [...hosts];
}

export interface SiteRuleInput {
  /** Rule 3: the hosts of PUBLIC_LTI_URL, PUBLIC_APP_URL and PUBLIC_CONTENT_URL. */
  ownHosts: readonly string[];
  /** Rule 4: the fixed hosts of the profile (any port). */
  profileFixedHosts: readonly string[];
  /** Rule 5 (canvas-self-hosted only): refused host suffixes, and the fixed hosts of every profile. */
  selfHosted?: { refusedSuffixes: readonly string[]; allFixedHosts: readonly string[] };
}

/**
 * Site rules 1 to 5 (ADR-011 §6) on a site URL or service URL of a profile other than `standard`. The first failed
 * rule is returned. On success the canonical origin is returned. No network access (rule 6: never fetched here).
 */
export function checkSiteUrl(input: string, rules: SiteRuleInput): SiteUrlCheck {
  const canonical = canonicalOrigin(input);
  if (!canonical.ok) return canonical;
  const host = originHost(canonical.origin);
  // Rule 2: a DNS name with at least one dot; no IP literal, no localhost. A trailing dot is refused too, so that
  // "lti.cogniate.test." cannot pass rules 3 and 4 as another spelling of a refused host.
  if (isIP(host) !== 0 || !host.includes('.') || host.endsWith('.') || host === 'localhost' || host.endsWith('.localhost')) return { ok: false, rule: 2 };
  const lower = (list: readonly string[]) => list.map((h) => h.toLowerCase());
  if (lower(rules.ownHosts).includes(host)) return { ok: false, rule: 3 };
  if (lower(rules.profileFixedHosts).includes(host)) return { ok: false, rule: 4 };
  if (rules.selfHosted) {
    if (rules.selfHosted.refusedSuffixes.some((s) => host.endsWith(s.toLowerCase()))) return { ok: false, rule: 5 };
    if (lower(rules.selfHosted.allFixedHosts).includes(host)) return { ok: false, rule: 5 };
  }
  return { ok: true, origin: canonical.origin };
}
