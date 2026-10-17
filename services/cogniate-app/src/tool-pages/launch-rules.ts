// Pure launch rules (app contract §6, security §4). No I/O: unit-tested on their own.
import { createHmac } from 'node:crypto';

/** A ltik is an opaque 43-character base64url string (lti-service contract §1.2). */
export const LTIK = /^[A-Za-z0-9_-]{43}$/;

const PUBLICATION_ID = /^pub_[A-Za-z0-9_-]{1,64}$/;
const STAFF_ROLE_SUFFIXES = ['#Instructor', '#ContentDeveloper', '#Administrator'] as const;

/**
 * Picker role rule (T4b2 design note, app contract §6): a role that ends with #Instructor, #ContentDeveloper or
 * #Administrator (LIS membership, institution or system roles). The same rule marks a launch as a preview.
 */
export function hasStaffRole(roles: readonly string[]): boolean {
  return roles.some((role) => STAFF_ROLE_SUFFIXES.some((suffix) => role.endsWith(suffix)));
}

/**
 * Security §4 "signed target": the publication id is the `resource` query of the SIGNED launch.target, and only if
 * that target is a launch URL of the LTI service. The `resource` query of the app URL is never read.
 * Returns null for any other target (no resource, two resources, a foreign host, a bad id).
 */
export function publicationFromTarget(target: string, ltiUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  if (url.origin !== new URL(ltiUrl).origin || !url.pathname.startsWith('/lti/launch/')) return null;
  const values = url.searchParams.getAll('resource');
  return values.length === 1 && PUBLICATION_ID.test(values[0]!) ? values[0]! : null;
}

/** "Back to Moodle": the launch return URL only if it is https on the platform origin (no javascript:, no other host). */
export function safeReturnUrl(returnUrl: string | undefined, issuerOrigin: string): string | null {
  if (!returnUrl) return null;
  try {
    const u = new URL(returnUrl);
    return u.protocol === 'https:' && u.origin === issuerOrigin && u.username === '' && u.password === '' ? u.href : null;
  } catch {
    return null;
  }
}

/** The https origin of a URL, or null. */
export function httpsOrigin(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * The runtime token of a play session (the content origin path /rt/{token}). Derived from the play id with
 * APP_MASTER_KEY, so the shell can show it again on reload while the table keeps only its SHA-256 hash, and the
 * content origin URL does not show the play id.
 */
export function runtimeTokenFor(masterKey: Buffer, playId: string): string {
  return createHmac('sha256', masterKey).update(`runtime-token:${playId}`).digest('base64url');
}
