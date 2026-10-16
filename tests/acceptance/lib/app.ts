// Cogniate app API client for QA tests (T4a onward). Source: contract cogniate-app-api.md §1–§3.
// Writes send Origin = PUBLIC_APP_URL unless a test sets another value (or none) on purpose.
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { publicUrls } from './env';
import { httpsRequest, type HttpResult, rootCaPem } from './https';
import { SEED_FILE } from './paths';

const urls = publicUrls();
export const APP = urls.app;
export const SESSION_COOKIE = '__Host-cog_session';

export interface PortalUser {
  email: string;
  password: string;
}

/** Portal users from seed.json `portal.users` (found by shape: objects with `email` and `password`). */
export function portalUser(email: string): PortalUser {
  const raw = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as Record<string, unknown>;
  const found: PortalUser[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>;
      if (typeof o.email === 'string' && typeof o.password === 'string') found.push({ email: o.email, password: o.password });
      Object.values(o).forEach(walk);
    }
  };
  walk(raw.portal ?? raw);
  const user = found.find((u) => u.email === email);
  if (!user) throw new Error(`seed.json portal.users has no ${email}`);
  return user;
}

export const THANH = 'thanh@cogniate.test';
export const QA_B = 'qa-b@cogniate.test';

export interface AppResult<T = unknown> extends HttpResult {
  json: T;
  traceId: string;
}

function parse<T>(res: HttpResult): AppResult<T> {
  let json: unknown = null;
  try {
    json = res.body ? JSON.parse(res.body) : null;
  } catch {
    json = null;
  }
  return { ...res, json: json as T, traceId: String(res.headers['x-trace-id'] ?? '') };
}

export async function appApi<T = unknown>(
  method: string,
  pathAndQuery: string,
  { cookie, origin = APP, body }: { cookie?: string; origin?: string | null; body?: unknown } = {},
): Promise<AppResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (origin !== null && method !== 'GET') headers.origin = origin;
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(Buffer.byteLength(payload));
  }
  return parse<T>(await httpsRequest(`${APP}${pathAndQuery}`, { method, headers, body: payload, timeoutMs: 30_000 }));
}

export interface Session {
  cookie: string;
  setCookie: string;
}

/** POST /app-api/session. Throws unless 204 with the session cookie. */
export async function signIn(email: string, password?: string): Promise<Session> {
  const res = await appApi('POST', '/app-api/session', { body: { email, password: password ?? portalUser(email).password } });
  const setCookie = [res.headers['set-cookie'] ?? []].flat().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (res.status !== 204 || !setCookie) throw new Error(`sign-in of ${email} failed: HTTP ${res.status} ${res.body.slice(0, 200)}`);
  return { cookie: setCookie.split(';')[0], setCookie };
}

export interface Course {
  id: string;
  title: string;
}

export async function createCourse(session: Session, title: string): Promise<Course> {
  const res = await appApi<Course>('POST', '/app-api/courses', { cookie: session.cookie, body: { title } });
  if (res.status !== 201) throw new Error(`create course failed: HTTP ${res.status} ${res.body.slice(0, 200)}`);
  return res.json;
}

/**
 * POST /app-api/courses/:id/versions as multipart/form-data with a file from disk (streamed). If the server answers
 * before the upload ends (for example a size limit) and closes the connection, the answer is still returned.
 */
export function uploadVersion(
  session: Session,
  courseId: string,
  file: string,
  { fields = {}, origin = APP, timeoutMs = 300_000 }: { fields?: Record<string, string>; origin?: string | null; timeoutMs?: number } = {},
): Promise<AppResult<Record<string, unknown>>> {
  const boundary = `----qa${Date.now().toString(16)}`;
  const parts = Object.entries(fields).map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join('');
  const head = Buffer.from(`${parts}--${boundary}\r\nContent-Disposition: form-data; name="package"; filename="${path.basename(file).replace(/"/g, '')}"\r\nContent-Type: application/zip\r\n\r\n`);
  const tailPart = Buffer.from(`\r\n--${boundary}--\r\n`);
  const size = head.length + fs.statSync(file).size + tailPart.length;
  const u = new URL(`${APP}/app-api/courses/${encodeURIComponent(courseId)}/versions`);
  return new Promise((resolve, reject) => {
    let started = false; // the server began its answer; a later write error (EPIPE, reset) must not hide it
    const headers: Record<string, string> = {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(size),
      cookie: session.cookie,
      accept: 'application/json',
    };
    if (origin !== null) headers.origin = origin;
    const req = https.request(
      { hostname: u.hostname, port: u.port || 443, path: u.pathname, method: 'POST', headers, ca: rootCaPem(), servername: u.hostname, agent: false, timeout: timeoutMs },
      (res) => {
        started = true;
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(parse({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') })));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error(`upload timeout after ${timeoutMs} ms`)));
    req.on('error', (e) => {
      if (!started) reject(e);
    });
    req.write(head);
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('end', () => req.end(tailPart));
    stream.pipe(req, { end: false });
  });
}
