import type { Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Knob } from './knobs.ts';
import type { Logger } from './logger.ts';

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
