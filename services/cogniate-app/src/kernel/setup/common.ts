// Small pieces that every setup adapter and the connection routes share (no I/O).
import type { PublicUrls } from '@cogniate/shared';

/** The tool account of the app in the LTI service (contract §4.1). */
export const TOOL_ACCOUNT = 'cogniate';

/** Tool name in the LMS: `Cogniate (<library name>)`, ASCII only (flows §6a). */
export function toolName(libraryName: string): string {
  const ascii = libraryName.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  return `Cogniate (${ascii || 'Library'})`;
}

/** The protocol URLs of the tool account (all from PUBLIC_LTI_URL). */
export function toolUrls(urls: PublicUrls): { launch: string; login: string; keys: string } {
  return {
    launch: `${urls.lti}/lti/launch/${TOOL_ACCOUNT}`,
    login: `${urls.lti}/lti/login/${TOOL_ACCOUNT}`,
    keys: `${urls.lti}/lti/keys/${TOOL_ACCOUNT}`,
  };
}

/** A value of a strict binding body (app contract §4.4): 1 to 255 printable ASCII characters without spaces. */
export const PRINTABLE_ID = /^[\x21-\x7e]{1,255}$/;
/** An approval code: 43 base64url characters (256 bits). */
export const GRANT_CODE = /^[A-Za-z0-9_-]{43}$/;

export type StrictBodyResult = { ok: true; values: Record<string, string> } | { ok: false; fields: string[] };

/**
 * Strict body rule of app contract §4.4: every key must be listed; every required key must be present; values are
 * trimmed strings of the right form. The answer lists every bad key (unknown, missing or malformed), in body order
 * first, then the missing required keys.
 */
export function parseStrictBody(body: unknown, spec: { required: readonly string[]; optional?: readonly string[] }): StrictBodyResult {
  const optional = spec.optional ?? [];
  const known = new Set([...spec.required, ...optional]);
  const obj = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const bad: string[] = [];
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (!known.has(key)) { bad.push(key); continue; }
    const v = typeof raw === 'string' ? raw.trim() : null;
    const ok = v !== null && (key === 'grantCode' ? GRANT_CODE.test(v) : PRINTABLE_ID.test(v));
    if (!ok) bad.push(key);
    else values[key] = v;
  }
  for (const key of spec.required) if (!(key in obj)) bad.push(key);
  return bad.length > 0 ? { ok: false, fields: [...new Set(bad)] } : { ok: true, values };
}
