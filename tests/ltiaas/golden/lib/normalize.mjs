// Golden normalization (LA-E0-03 AC-05; TEST-STRATEGY §4.6). Pure functions, Node built-ins only.
// Order of the rules for each value: drop list, secrets, times, ids. Keys are sorted, so the output and the order
// of first use of each id are the same for the same input. QA never widens these rules to hide a difference
// (TEST-STRATEGY §4.6): a real difference needs an expected-delta file of its LA-IC id.

/** The drop list. One reason per entry. `when(parent)` limits an entry to one kind of object. */
export const DROP = [
  { key: 'jti', reason: 'JWT id: a new random value for each token (RFC 7519 §4.1.7)' },
  { key: 'nonce', reason: 'OIDC and Deep Linking nonce: a new random value for each message' },
  { key: 'iat', reason: 'JWT issue time: the clock of the run' },
  { key: 'exp', reason: 'JWT expiry time: the clock of the run' },
  { key: 'timestamp', when: (parent) => Object.hasOwn(parent, 'scoreGiven'), reason: 'AGS score timestamp: the clock of the run' },
];

/** Keys whose values are secrets or single-use tokens. They become `<redacted:length>`. */
export const SECRET_KEYS = new Set([
  'access_token', 'apiKey', 'approvalCode', 'assertion', 'authorization', 'client_assertion', 'code', 'cookie', 'grantCode',
  'id_token', 'JWT', 'jwt', 'ltik', 'password', 'refresh_token', 'registrationToken', 'runtimeToken', 'serviceKey', 'state',
  'token',
]);
/** Keys whose values are generated ids in any form (for example a 16-hex simulator token reference). */
export const ID_KEYS = new Set(['kid', 'tokenRef', 'traceId', 'trace_id', 'requestId']);
/** Public key material of a JWK (`kty` present): the key of the stack, new on each fresh stack. */
export const JWK_MATERIAL = ['n', 'e', 'x', 'y'];
/** Query parameters whose values are secrets or single-use tokens (inside URL strings). */
export const SECRET_PARAMS = ['ltik', 'state', 'id_token', 'code', 'ref', 'token', 'nonce'];

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const JWT = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
const RANDOM_43 = /^[A-Za-z0-9_-]{43}$/;
/**
 * Generated ids inside any string, in this order: UUIDs; prefixed app and service ids (`con_…`, `plt_…`: a short
 * lower-case prefix, `_`, then 12 or more letters, digits, `_` or `-` with at least one capital or digit); hex suffixes
 * of QA unique names (`label-<12 hex>`); long hex values (32 or more).
 */
const ID_PATTERNS = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g,
  /\b[a-z]{2,6}_(?=[A-Za-z0-9_-]*[A-Z0-9])[A-Za-z0-9_-]{12,}(?![A-Za-z0-9_-])/g,
  /(?<=-)[0-9a-f]{12}(?![0-9a-f])/g,
  /\b[0-9a-f]{32,}\b/g,
];

export function createContext() {
  return { ids: new Map(), dropped: new Map(), secrets: 0 };
}
const placeholder = (ctx, id) => {
  if (!ctx.ids.has(id)) ctx.ids.set(id, `<id:${ctx.ids.size + 1}>`);
  return ctx.ids.get(id);
};
const redact = (ctx, value) => { ctx.secrets++; return `<redacted:${String(value).length}>`; };

/** One string value: secret by pattern, time, then ids (also inside URLs and texts). */
export function normalizeString(value, ctx) {
  if (JWT.test(value) || RANDOM_43.test(value)) return redact(ctx, value);
  if (ISO_TIME.test(value)) return '<t>';
  let text = value;
  if (/^https?:\/\//.test(text) && text.includes('?')) {
    try {
      const url = new URL(text);
      let changed = false;
      for (const name of SECRET_PARAMS) {
        if (url.searchParams.has(name)) { url.searchParams.set(name, redact(ctx, url.searchParams.get(name))); changed = true; }
      }
      if (changed) text = url.href.replace(/%3Credacted%3A(\d+)%3E/g, '<redacted:$1>');
    } catch { /* not a URL: keep the text */ }
  }
  for (const pattern of ID_PATTERNS) text = text.replace(pattern, (id) => placeholder(ctx, id));
  return text;
}

/** The normalized copy of a JSON value: keys sorted, drop list applied, secrets, times and ids replaced. */
export function normalize(value, ctx = createContext()) {
  if (Array.isArray(value)) return value.map((item) => normalize(item, ctx));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const rule = DROP.find((d) => d.key === key && (!d.when || d.when(value)));
      if (rule) { ctx.dropped.set(key, (ctx.dropped.get(key) ?? 0) + 1); continue; }
      const item = value[key];
      if (typeof value.kty === 'string' && JWK_MATERIAL.includes(key) && typeof item === 'string') out[key] = `<public-key:${item.length}>`;
      else if (ID_KEYS.has(key) && typeof item === 'string' && item) out[key] = placeholder(ctx, item);
      else if (SECRET_KEYS.has(key) && item !== null && item !== undefined && item !== '') out[key] = redact(ctx, typeof item === 'string' ? item : JSON.stringify(item));
      else out[key] = normalize(item, ctx);
    }
    return out;
  }
  if (typeof value === 'string') return normalizeString(value, ctx);
  return value;
}

/** Normalizes one golden file: `{ section: value }`. One id map per file, so the placeholders are file-local. */
export function normalizeFile(sections) {
  const ctx = createContext();
  const data = normalize(sections, ctx);
  return { data, stats: { ids: ctx.ids.size, secrets: ctx.secrets, dropped: Object.fromEntries([...ctx.dropped].sort()) } };
}

/**
 * K-HYG style scan: the files must not contain any of the raw secret values (length 8 or more), any JWT, or any
 * 43-character random value. Returns the hits as { file, kind } (never the value).
 */
export function secretScan(files, secrets = []) {
  const hits = [];
  const values = [...new Set(secrets.filter((s) => typeof s === 'string' && s.length >= 8))];
  for (const [file, text] of files) {
    for (const value of values) if (text.includes(value)) hits.push({ file, kind: 'captured secret value' });
    if (/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text)) hits.push({ file, kind: 'JWT' });
    if (/"[A-Za-z0-9_-]{43}"/.test(text)) hits.push({ file, kind: '43-character random value' });
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) hits.push({ file, kind: 'private key' });
  }
  return hits;
}
