// The line item URL rule (contract §3.4, security §8). It runs before any outbound call, so a tool can only name
// URLs of its own launch: same origin as the claim URL, path inside the claim path, and every query parameter of the
// claim URL with the same value (Moodle: type_id, which stops a key of tool A from naming tool B in the same course).

const isHttps = (u: URL): boolean => u.protocol === 'https:' && u.username === '' && u.password === '' && u.hash === '';

/**
 * A-T3a-01, contract §3.4 rule 4: the platform web server decodes the path (nginx: %2F -> /) and then resolves dot
 * segments, so a path that LOOKS inside the claim path can reach another course. Refuse, before any outbound call, a raw
 * path with %2F, %5C, %2E, %25, %3F or %23 (any letter case), a backslash, or a "." / ".." segment (also after decoding).
 */
export function hasPathTrick(rawUrl: string): boolean {
  const afterScheme = rawUrl.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*/, '');
  const path = afterScheme.split(/[?#]/, 1)[0] ?? '';
  if (/%(2f|5c|2e|25|3f|23)/i.test(path) || path.includes('\\')) return true;
  let decoded = path;
  for (let i = 0; i < 3; i += 1) {
    if (decoded.split('/').some((seg) => seg === '.' || seg === '..')) return true;
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return true; // a broken escape: refuse
    }
    if (next === decoded) break;
    decoded = next;
  }
  return decoded.includes('\\') || decoded.split('/').some((seg) => seg === '.' || seg === '..');
}

/**
 * True if `candidate` is allowed for the claim URL (AGS `lineitems` or `lineitem`, NRPS `context_memberships_url`).
 * The path must equal the claim path or continue it after a "/" (so ".../lineitems" does not allow ".../lineitemsX").
 */
export function isAllowedServiceUrl(candidate: string, claimUrl: string): boolean {
  if (hasPathTrick(candidate)) return false;
  let c: URL;
  let base: URL;
  try {
    c = new URL(candidate);
    base = new URL(claimUrl);
  } catch {
    return false;
  }
  if (!isHttps(c) || !isHttps(base) || c.origin !== base.origin) return false;
  const basePath = base.pathname.replace(/\/+$/, '');
  if (c.pathname !== basePath && !c.pathname.startsWith(`${basePath}/`)) return false;
  for (const [name, value] of base.searchParams) if (!c.searchParams.getAll(name).includes(value) || c.searchParams.getAll(name).length !== 1) return false;
  return true;
}

/** The URL to check line item ids against: the AGS `lineitems` URL, else the `lineitem` URL of the launch. */
export function agsBaseUrl(agsClaim: Record<string, unknown> | null | undefined): string | null {
  if (!agsClaim) return null;
  if (typeof agsClaim.lineitems === 'string') return agsClaim.lineitems;
  if (typeof agsClaim.lineitem === 'string') return agsClaim.lineitem;
  return null;
}

/** Line item URL + "/scores" (or "/results") added to the path, before the query (contract §3.4, Moodle ?type_id=). */
export function lineItemSubUrl(lineItemUrl: string, sub: 'scores' | 'results'): string {
  const u = new URL(lineItemUrl);
  u.pathname = `${u.pathname.replace(/\/+$/, '')}/${sub}`;
  return u.href;
}

/** Add query parameters to a URL and keep the ones it has (for example type_id). Undefined values are skipped. */
export function withQuery(url: string, params: Record<string, string | number | undefined>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
  return u.href;
}
