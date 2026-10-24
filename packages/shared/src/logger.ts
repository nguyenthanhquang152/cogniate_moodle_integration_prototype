import { randomBytes } from 'node:crypto';
import type { WriteStream } from 'node:fs';
import { appendFileSync, createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** One log line: { ts, level, service, event, trace_id, ...fields }. Event names are fixed strings (snake_case). */
export interface LogLine {
  ts: string;
  level: LogLevel;
  service: string;
  event: string;
  trace_id: string;
  [field: string]: unknown;
}

export interface Logger {
  readonly service: string;
  /** Trace id of this process start. Lifecycle lines (no request) use it. */
  readonly bootTraceId: string;
  log(level: LogLevel, event: string, fields?: Record<string, unknown>): void;
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  service: string;
  /** Folder for <service>.jsonl. Default: env LOG_DIR. No folder: stdout only. */
  dir?: string | undefined;
  /** Lowest level that is written. Default: env LOG_LEVEL, else "info". */
  level?: LogLevel | undefined;
  /** Line sink for tests. Default: stdout. */
  write?: (line: string) => void;
  now?: () => Date;
}

/** One boot trace id per process: every logger of the process shares it (H7: lifecycle lines). */
export const BOOT_TRACE_ID = `boot-${randomBytes(6).toString('hex')}`;

// Key names that hold secrets (README security §11). Compared after normalising: lower case, no "_" or "-".
// So "apiKey", "api_key" and "API-KEY" all match "apikey".
const SECRET_KEYS = new Set([
  'storagevalue', // LTI postMessage storage values are credentials (LA-E3-02).
  'authorization', 'proxyauthorization', 'cookie', 'setcookie', 'password', 'passwd', 'secret', 'token', 'jwt',
  'ltik', 'ref', 'apikey', 'servicekey', 'masterkey', 'privatekey', 'idtoken', 'accesstoken', 'refreshtoken',
  'registrationtoken', 'runtimetoken', 'clientassertion', 'key',
]);
// Any key that ends with one of these is a secret too (for example "ltiMasterKey", "wsToken", "dbPassword").
const SECRET_SUFFIXES = ['token', 'secret', 'password', 'key', 'assertion', 'cookie'];
// Secret-looking values inside strings.
const VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[redacted-jwt]'],
  [/\b(Bearer|LTIK-AUTH-V2|SERVICE-AUTH-V1|OPERATOR-AUTH-V1)\s+[^\s"']+/gi, '$1 [redacted]'],
  [/\b(ltik|ref|token|wstoken|registration_token|access_token|id_token)=[^&\s"']+/gi, '$1=[redacted]'],
  [/\bltis_[A-Za-z0-9_-]{8,}/g, '[redacted-api-key]'],
  // Operator key (LA-ADR-06 D3): any value that starts with ltio_ and has more characters.
  [/\bltio_[A-Za-z0-9_-]+/g, '[redacted-operator-key]'],
];
const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

function isSecretKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[_-]/g, '');
  return SECRET_KEYS.has(k) || SECRET_SUFFIXES.some((s) => k.endsWith(s));
}

export function redactString(value: string): string {
  let out = value;
  for (const [re, repl] of VALUE_PATTERNS) out = out.replace(re, repl);
  return out;
}

function redactValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSecretKey(k) ? REDACTED : redactValue(v, depth + 1);
  }
  return out;
}

/**
 * Logger for a short CLI run (the operator commands): the same lines and the same <dir>/<service>.jsonl as the
 * service, but with a synchronous append. A CLI exits right after its last line, and the async file stream of
 * createLogger can lose that line. Stdout keeps only the command output; with no folder the lines go to stderr.
 */
export function createCliLogger(options: Omit<LoggerOptions, 'write'>): Logger {
  const dir = options.dir ?? process.env.LOG_DIR;
  const file = dir ? join(dir, `${options.service}.jsonl`) : null;
  if (dir) mkdirSync(dir, { recursive: true });
  return createLogger({
    ...options,
    dir: '', // no async stream: the write below is the only sink
    write: (line) => {
      if (file) appendFileSync(file, line);
      else process.stderr.write(line);
    },
  });
}

/** Redact secret keys (any depth, camelCase or snake_case) and secret-looking string values. */
export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  return redactValue(fields, 0) as Record<string, unknown>;
}

/**
 * Path for logs: no query string (never logged), and path segments that look like capability ids or tokens
 * (20 or more URL-safe characters, for example /rt/{runtimeToken}) become ":redacted".
 */
export function redactPath(pathname: string): string {
  return pathname.split('?')[0]!.split('/').map((seg) => (/^[A-Za-z0-9_~.-]{20,}$/.test(seg) ? ':redacted' : seg)).join('/');
}

function levelFrom(raw: string | undefined): LogLevel {
  return raw && raw in LEVELS ? (raw as LogLevel) : 'info';
}

/** JSON-lines logger. Each line goes to stdout and, if a folder is set, to <dir>/<service>.jsonl (append). */
export function createLogger(options: LoggerOptions): Logger {
  const { service } = options;
  const dir = options.dir ?? process.env.LOG_DIR;
  const min = LEVELS[options.level ?? levelFrom(process.env.LOG_LEVEL)];
  const write = options.write ?? ((line: string) => process.stdout.write(line));
  const now = options.now ?? (() => new Date());
  let file: WriteStream | undefined;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    file = createWriteStream(join(dir, `${service}.jsonl`), { flags: 'a' });
  }
  const log = (level: LogLevel, event: string, fields: Record<string, unknown> = {}): void => {
    if (LEVELS[level] < min) return;
    const { trace_id: traceId, ...rest } = fields;
    const line: LogLine = {
      ts: now().toISOString(), level, service, event,
      trace_id: typeof traceId === 'string' && traceId !== '' ? traceId : BOOT_TRACE_ID,
      ...redact(rest),
    };
    const text = `${JSON.stringify(line)}\n`;
    write(text);
    file?.write(text);
  };
  return {
    service,
    bootTraceId: BOOT_TRACE_ID,
    log,
    debug: (event, fields) => log('debug', event, fields),
    info: (event, fields) => log('info', event, fields),
    warn: (event, fields) => log('warn', event, fields),
    error: (event, fields) => log('error', event, fields),
  };
}
