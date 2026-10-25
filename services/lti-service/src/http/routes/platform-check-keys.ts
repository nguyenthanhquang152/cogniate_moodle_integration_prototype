// The key list rule of the connection check (LA-E6-01 fix round 1; Codex Reviewer-A A-LA-E6-01-01 and Reviewer-B
// B-LA-E6-01-01, BLOCKER): a non-empty keys array alone is not a usable key set.

/**
 * A usable key list: at least one entry, and every entry is a JSON object with a non-empty string `kty`. One bad entry
 * makes the whole list unusable, as for the launch key fetch (lti/jwks.ts), which refuses such a set.
 */
export function isKeyList(keys: unknown): keys is Record<string, unknown>[] {
  return Array.isArray(keys) && keys.length > 0 && keys.every((key) => key !== null && typeof key === 'object' && !Array.isArray(key)
    && typeof (key as { kty?: unknown }).kty === 'string' && (key as { kty: string }).kty !== '');
}
