// Pure setup contract helpers (BD-A1-40). No configuration, network or storage access.
/** Tool name in the LMS: `Cogniate (<library name>)`, ASCII only (flows §6a). */
export function toolName(libraryName: string): string {
  const ascii = libraryName.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  return `Cogniate (${ascii || 'Library'})`;
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
