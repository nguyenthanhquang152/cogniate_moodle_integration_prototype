// The content listener (PUBLIC_CONTENT_URL, a different site; sets no cookies, sends no CORS headers). Untrusted
// boundary (ADR-008): this folder imports only domain/attempts*, packages/tracking and packages/shared.
//   GET  /pkg/{packageId}/{path}     package files (security §7): MIME allowlist, nosniff, Range, path checks
//   GET  /rt/{runtimeToken}          runtime page; GET .../state RuntimeState; POST .../commit (app contract §7)
//   GET  /_rt/assets/{file}          runtime JS and CSS (apps/player build)
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import type { Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import type { Knob, Logger, PublicUrls } from '@cogniate/shared';
import { apiErrorBody, escapeHtml, sha256Hex } from '@cogniate/shared';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../domain/attempts.ts';
import type { ChannelRegistry, RuntimeSession } from '../domain/attempts.ts';
import { applyCommit, findRuntimeSession, packageStoragePath, runtimeState } from '../domain/attempts.ts';

export const CONTENT_SERVICE_NAME = 'cogniate-content';

export interface ContentServerDeps {
  channels: ChannelRegistry;
  logger: Logger;
  urls: PublicUrls;
  profile: string;
  knobs: Knob[];
  outboundAllowlist: string[];
  db: Db;
  /** DATA_DIR/packages (package.storage_path is relative to DATA_DIR). */
  dataDir: string;
  /** apps/player build folder (runtime.js, runtime.css). */
  playerDir: string;
  now?: () => number;
  /** A commit made a score sync row: the worker sends it at once. */
  onSyncCreated?: (syncId: string) => void;
}

/** App contract §7 MIME allowlist; anything else is application/octet-stream. */
export const MIME_TYPES: ReadonlyMap<string, string> = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.htm', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'], ['.xml', 'application/xml'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.gif', 'image/gif'], ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'], ['.mp4', 'video/mp4'], ['.webm', 'video/webm'], ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'], ['.ogg', 'audio/ogg'],
  ['.woff', 'font/woff'], ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf'], ['.otf', 'font/otf'], ['.txt', 'text/plain; charset=utf-8'],
  ['.vtt', 'text/vtt; charset=utf-8'], ['.pdf', 'application/pdf'],
]);
export const mimeType = (path: string): string => MIME_TYPES.get(extname(path).toLowerCase()) ?? 'application/octet-stream';

const PACKAGE_ID = /^pkg_[A-Za-z0-9_-]{22}$/;
const RUNTIME_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ASSET = /^[a-z0-9-]+\.(js|css)$/;
const TRACE_ID = /^[A-Za-z0-9-]{16,64}$/;
/** Raw path tricks (security §7 "Raw .. paths give 400 or 404"): encoded dot, slash, backslash or NUL, a backslash, a dot segment. */
const RAW_TRICK = /%2e|%2f|%5c|%00|\\|(^|\/)\.{1,2}(\/|$)/i;

/**
 * The checked file path of a package request, or null. `rest` is the decoded wildcard. Every segment must be a
 * normal name (no empty, `.` or `..` segment, no backslash, NUL or control character).
 */
export function packageFilePath(packageDir: string, rest: string): string | null {
  const segments = rest.split('/');
  const bad = (s: string) => s === '' || s === '.' || s === '..' || s.includes('\\') || [...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);
  if (segments.some(bad)) return null;
  const root = resolve(packageDir);
  const file = resolve(root, ...segments);
  return file.startsWith(root + sep) ? file : null;
}

/** One `bytes=a-b` range of a file of `size` bytes: [start, end] inclusive, 'unsatisfiable', or null (no range / ignored). */
export function parseRange(header: string | undefined, size: number): [number, number] | 'unsatisfiable' | null {
  if (header === undefined) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null; // several ranges or bad syntax: send the whole file
  let start: number;
  let end: number;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start > end || start >= size ? 'unsatisfiable' : [start, end];
}

const NOT_FOUND_HTML = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found</title></head><body><p>Not found.</p></body></html>';

/** The runtime page. `data-lms-name` on the body: the `{LMS}` text name of the player texts (LA-ADR-01 D12). */
const runtimePage = (lmsName: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="robots" content="noindex">
<title>Cogniate course runtime</title>
<link rel="stylesheet" href="/_rt/assets/runtime.css">
<script type="module" src="/_rt/assets/runtime.js"></script>
</head>
<body data-lms-name="${escapeHtml(lmsName)}">
<p id="cogniate-runtime-message" role="status" hidden></p>
<iframe id="cogniate-package" title="Course content"></iframe>
</body>
</html>
`;

/** The content listener app (tests use inject). */
export async function buildContentApp(deps: ContentServerDeps): Promise<FastifyInstance> {
  const { db, urls, logger: log } = deps;
  const now = deps.now ?? Date.now;
  // Bodies stay under 60 KB (keepalive and beacon limit about 64 KB, app contract §7).
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, return503OnClosing: false });
  app.decorateRequest('traceId', '');

  app.addHook('onRequest', async (req, reply) => {
    const given = req.headers['x-trace-id'];
    req.traceId = typeof given === 'string' && TRACE_ID.test(given) ? given : sha256Hex(`${process.hrtime.bigint()}${Math.random()}`).slice(0, 32);
    reply.header('x-trace-id', req.traceId);
  });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'same-origin');
    reply.removeHeader('set-cookie');
  });
  app.addHook('onResponse', async (req, reply) => {
    // BD-A1-62 (app API delta §8): the route template (no ids, no query), or "<unmatched>"; never the raw path.
    const path = req.routeOptions.url ?? '<unmatched>';
    log.log(path === '/healthz' ? 'debug' : 'info', 'http_request', { trace_id: req.traceId, method: req.method, path, status: reply.statusCode, ms: Math.round(reply.elapsedTime) });
  });
  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send(apiErrorBody(413, 'INVALID_REQUEST', 'The body is larger than 64 KB.'));
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) return reply.code(400).send(apiErrorBody(400, 'INVALID_REQUEST', 'The request cannot be read.'));
    log.error('internal_error', { trace_id: req.traceId, method: req.method, path: req.routeOptions.url ?? 'unknown', error: err.name });
    return reply.code(500).send(apiErrorBody(500, 'INTERNAL_ERROR', `Internal error. Trace id: ${req.traceId}`));
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).type('text/html; charset=utf-8').send(NOT_FOUND_HTML));
  // sendBeacon posts text/plain (app contract §7): the body is the JSON text.
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => done(null, body));

  app.get('/healthz', async () => ({
    status: 'ok', service: CONTENT_SERVICE_NAME, profile: deps.profile, outbound_allowlist: deps.outboundAllowlist, knobs: deps.knobs,
  }));

  // ---------------------------------------------------------------- package files (security §7)
  app.get<{ Params: { packageId: string; '*': string } }>('/pkg/:packageId/*', async (req, reply) => {
    const rawPath = (req.raw.url ?? '').split('?')[0] ?? '';
    if (RAW_TRICK.test(rawPath)) return reply.code(400).type('text/plain; charset=utf-8').send('Bad path.');
    const { packageId } = req.params;
    const storage = PACKAGE_ID.test(packageId) ? packageStoragePath(db, packageId) : undefined;
    const notFound = () => reply.code(404).type('text/html; charset=utf-8').send(NOT_FOUND_HTML);
    if (!storage) return notFound();
    const packageDir = join(deps.dataDir, storage);
    const file = packageFilePath(packageDir, req.params['*']);
    if (!file) return notFound();
    let size: number;
    try {
      const st = await lstat(file);
      // Check the path again on every serve: a regular file inside the package folder (no symlink, no folder).
      if (!st.isFile() || !(await realpath(file)).startsWith((await realpath(packageDir)) + sep)) return notFound();
      size = st.size;
    } catch {
      return notFound();
    }
    reply.headers({
      'content-type': mimeType(file), 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=300',
      // CSP checks every ancestor: the runtime (content origin) and the shell (app origin) (ADR-004, A-T0-01).
      'content-security-policy': `frame-ancestors ${urls.content} ${urls.app}`,
    });
    const range = parseRange(typeof req.headers.range === 'string' ? req.headers.range : undefined, size);
    if (range === 'unsatisfiable') return reply.code(416).header('content-range', `bytes */${size}`).send();
    if (range === null) return reply.code(200).header('content-length', size).send(createReadStream(file));
    const [start, end] = range;
    return reply.code(206).headers({ 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 }).send(createReadStream(file, { start, end }));
  });

  // ---------------------------------------------------------------- runtime (app contract §7)
  type TokenParams = { Params: { token: string } };
  /** A runtime token with no live session: unknown (404), or expired (410, with the `{LMS}` text name of its channel). */
  type NoSession = { expired: false } | { expired: true; lmsName: string };
  /** The live session of a runtime token, or why there is none. */
  const sessionOf = (req: FastifyRequest<TokenParams>): RuntimeSession | NoSession => {
    if (!RUNTIME_TOKEN.test(req.params.token)) return { expired: false };
    const s = findRuntimeSession(db, sha256Hex(req.params.token), deps.channels);
    if (!s) return { expired: false };
    return s.expiresAt <= now() ? { expired: true, lmsName: s.lmsName } : s;
  };
  const live = (s: RuntimeSession | NoSession): s is RuntimeSession => !('expired' in s);
  // LA-IC-19 (BD-A1-57): the 410 text names the channel of the session; a Moodle session keeps the M1 bytes.
  const tokenError = (reply: FastifyReply, s: NoSession) => s.expired
    ? reply.code(410).send(apiErrorBody(410, 'RUNTIME_EXPIRED', `The runtime session expired. Open the activity again in ${s.lmsName}.`))
    : reply.code(404).send(apiErrorBody(404, 'NOT_FOUND', 'Unknown runtime token.'));

  app.get<TokenParams>('/rt/:token', async (req, reply) => {
    const s = sessionOf(req);
    if (!live(s)) return reply.code(404).type('text/html; charset=utf-8').send(NOT_FOUND_HTML);
    return reply.code(200).headers({
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
      // A-T5a-02: packages share this origin; each launch clears the cookies that a package script may have set.
      'clear-site-data': '"cookies"',
      'content-security-policy': `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors ${urls.app}`,
    }).send(runtimePage(s.lmsName));
  });

  app.get<TokenParams>('/rt/:token/state', async (req, reply) => {
    const s = sessionOf(req);
    if (!live(s)) return tokenError(reply, s);
    return reply.code(200).header('cache-control', 'no-store').send(runtimeState(db, s));
  });

  app.post<TokenParams>('/rt/:token/commit', async (req, reply) => {
    const s = sessionOf(req);
    if (!live(s)) return tokenError(reply, s);
    let body: unknown = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = undefined;
      }
    }
    const result = applyCommit(db, s, body, now());
    if (!result.ok) {
      log.warn('commit_rejected', { trace_id: req.traceId, code: result.code, field: result.field });
      return reply.code(result.status).send(apiErrorBody(result.status, result.code, `Commit not accepted (${result.field}).`, { field: result.field }));
    }
    log.info('commit_accepted', { trace_id: req.traceId, session_id: s.sessionId, seq: result.seq, commit_event: result.event, ...(result.stale ? { stale: true } : {}) });
    if (result.syncId !== null) deps.onSyncCreated?.(result.syncId);
    return reply.code(200).header('cache-control', 'no-store').send({
      accepted: true, outcome: result.outcome, ...(result.scoreGiven !== null ? { scoreGiven: result.scoreGiven, scoreMaximum: result.scoreMaximum } : {}),
    });
  });

  // ---------------------------------------------------------------- runtime assets (apps/player build)
  app.get<{ Params: { file: string } }>('/_rt/assets/:file', async (req, reply) => {
    if (!ASSET.test(req.params.file)) return reply.code(404).type('text/html; charset=utf-8').send(NOT_FOUND_HTML);
    let data: Buffer;
    try {
      data = await readFile(join(deps.playerDir, req.params.file));
    } catch {
      return reply.code(404).type('text/plain; charset=utf-8').send('The player is not built. Run npm run build (or npm run dev:web).');
    }
    return reply.code(200).headers({ 'content-type': mimeType(req.params.file), 'cache-control': 'no-cache' }).send(data);
  });

  await app.ready();
  return app;
}

export async function buildContentServer(deps: ContentServerDeps): Promise<Server> {
  return (await buildContentApp(deps)).server;
}
