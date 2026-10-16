import type { WriteStream } from 'node:fs';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** One log line: { ts, level, service, event, trace_id?, ...fields }. Event names are fixed strings (snake_case). */
export interface LogLine {
  ts: string;
  level: LogLevel;
  service: string;
  event: string;
  trace_id?: string;
  [field: string]: unknown;
}

export interface Logger {
  readonly service: string;
  log(level: LogLevel, event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  service: string;
  /** Folder for <service>.jsonl. Default: env LOG_DIR. No folder: stdout only. */
  dir?: string | undefined;
  /** Line sink for tests. Default: stdout. */
  write?: (line: string) => void;
  now?: () => Date;
}

/** Field names whose values never go into a log line (README §9.8). T2 extends the list and adds URL rules. */
const REDACT_KEYS = new Set([
  'authorization', 'cookie', 'set-cookie', 'password', 'token', 'access_token', 'id_token', 'ltik', 'jwt',
  'client_assertion', 'registration_token', 'api_key', 'service_key', 'ref',
]);

export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = REDACT_KEYS.has(key.toLowerCase()) ? '[redacted]' : value;
  }
  return out;
}

/** JSON-lines logger. Each line goes to stdout and, if a folder is set, to <dir>/<service>.jsonl (append). */
export function createLogger(options: LoggerOptions): Logger {
  const { service } = options;
  const dir = options.dir ?? process.env.LOG_DIR;
  const write = options.write ?? ((line: string) => process.stdout.write(line));
  const now = options.now ?? (() => new Date());
  let file: WriteStream | undefined;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    file = createWriteStream(join(dir, `${service}.jsonl`), { flags: 'a' });
  }
  const log = (level: LogLevel, event: string, fields: Record<string, unknown> = {}): void => {
    const line: LogLine = { ts: now().toISOString(), level, service, event, ...redact(fields) };
    const text = `${JSON.stringify(line)}\n`;
    write(text);
    file?.write(text);
  };
  return {
    service,
    log,
    info: (event, fields) => log('info', event, fields),
    warn: (event, fields) => log('warn', event, fields),
    error: (event, fields) => log('error', event, fields),
  };
}
