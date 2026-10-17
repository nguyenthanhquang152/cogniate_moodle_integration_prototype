import { randomBytes } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { apiErrorBody } from './errors.ts';
import type { Knob } from './knobs.ts';
import type { Logger } from './logger.ts';
import { redactPath } from './logger.ts';

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(text);
}

export interface HealthBody {
  status: 'ok';
  service: string;
  /** Compose profile: "default" or "acceptance" (local-stack §3). */
  profile: string;
  knobs: Knob[];
  /** Active OUTBOUND_PRIVATE_HOST_ALLOWLIST of the service (T2b: the acceptance profile adds its QA hosts). */
  outbound_allowlist: string[];
}

/** Value of one cookie in a Cookie header, or undefined (exact name match; the value is not decoded). */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

/** Use the caller's x-trace-id if it is a safe token, else make a new one. */
export function traceIdFrom(req: IncomingMessage): string {
  const given = req.headers['x-trace-id'];
  if (typeof given === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(given)) return given;
  return randomBytes(8).toString('hex');
}

export interface HealthServerOptions {
  logger?: Logger;
  knobs?: Knob[];
  profile?: string;
  outboundAllowlist?: string[];
}

/**
 * A minimal server: GET|HEAD /healthz -> 200 {"status":"ok","service":<name>,"knobs":[...]}. Other requests -> 404.
 * It logs one http_request line per request {method, path, status, ms, trace_id}. The path has no query string,
 * and token-like segments are redacted (redactPath). /healthz requests are logged at debug level only, so the
 * container health checks do not fill the logs (B-T1-04).
 * Placeholder for T1. T2 and T4 replace it with the real service.
 */
export function createHealthServer(service: string, options: HealthServerOptions = {}): Server {
  const knobs = options.knobs ?? [];
  const profile = options.profile ?? 'default';
  const outboundAllowlist = options.outboundAllowlist ?? [];
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const started = performance.now();
    const traceId = traceIdFrom(req);
    const path = new URL(req.url ?? '/', 'http://placeholder').pathname;
    res.setHeader('x-trace-id', traceId);
    res.on('finish', () => {
      const level = path === '/healthz' ? 'debug' : 'info';
      options.logger?.log(level, 'http_request', {
        trace_id: traceId, method: req.method, path: redactPath(path), status: res.statusCode, ms: Math.round(performance.now() - started),
      });
    });
    if ((req.method === 'GET' || req.method === 'HEAD') && path === '/healthz') {
      const body: HealthBody = { status: 'ok', service, profile, knobs, outbound_allowlist: outboundAllowlist };
      sendJson(res, 200, body);
      return;
    }
    sendJson(res, 404, apiErrorBody(404, 'NOT_FOUND', `No route for ${req.method ?? 'GET'} ${path}`));
  });
}

/** Listen and resolve with the bound address (port 0 picks a free port). */
export function listen(server: Server, port: number, host: string): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server.address() as AddressInfo);
    });
  });
}

/** Close the servers on SIGTERM / SIGINT (docker stop, Ctrl+C). Each logger gets one service_stopping line. */
export function closeOnSignal(servers: Server[], loggers: Logger[] = []): void {
  const stop = (signal: string): void => {
    for (const logger of loggers) logger.info('service_stopping', { signal });
    for (const s of servers) s.close();
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
}

export function portFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${name} must be a port number, got "${raw}"`);
  }
  return port;
}
