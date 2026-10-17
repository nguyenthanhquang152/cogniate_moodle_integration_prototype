// HTTPS helpers. Every call names its trust store explicitly (default: the stack root CA),
// so a test never depends on NODE_EXTRA_CA_CERTS by accident.
import fs from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import https from 'node:https';
import path from 'node:path';
import tls from 'node:tls';
import { CERTS_DIR } from './paths';

export const ROOT_CA_FILE = path.join(CERTS_DIR, 'root.crt');

export function rootCaFile(): string {
  if (fs.existsSync(ROOT_CA_FILE)) return ROOT_CA_FILE;
  const extra = process.env.NODE_EXTRA_CA_CERTS;
  if (extra && fs.existsSync(extra)) return extra;
  throw new Error(`Stack root CA not found at ${ROOT_CA_FILE}, and NODE_EXTRA_CA_CERTS is not set.`);
}

export function rootCaPem(): string {
  return fs.readFileSync(rootCaFile(), 'utf8');
}

export interface HttpResult {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Trust store. Default: the stack root CA only. */
  ca?: string | string[];
  /** Send this request path as it is (no URL normalization of `../` or `%2e%2e/`), like `curl --path-as-is`. */
  rawPath?: string;
  timeoutMs?: number;
}

/** One HTTPS request. No redirects are followed. Rejects with the Node error (err.code) on TLS failure. */
export function httpsRequest(url: string, opts: HttpOptions = {}): Promise<HttpResult> {
  const u = new URL(url);
  const timeoutMs = opts.timeoutMs ?? 15_000;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: 'https:',
        hostname: u.hostname,
        port: u.port || 443,
        path: opts.rawPath ?? `${u.pathname}${u.search}`,
        method: opts.method ?? 'GET',
        headers: opts.headers,
        ca: opts.ca ?? rootCaPem(),
        servername: u.hostname,
        agent: false,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }),
        );
        res.on('error', reject);
      },
    );
    req.on('timeout', () =>
      req.destroy(Object.assign(new Error(`Timeout after ${timeoutMs} ms: ${u.origin}${u.pathname}`), { code: 'QA_TIMEOUT' })),
    );
    req.on('error', reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

export interface PeerInfo {
  /** True only if the chain verifies against `ca` AND the certificate matches the host name. */
  authorized: boolean;
  authorizationError?: string;
  subjectAltName: string;
  validTo: string;
}

export function tlsPeer(url: string, ca: string | string[] = rootCaPem()): Promise<PeerInfo> {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: u.hostname, port: Number(u.port || 443), servername: u.hostname, ca, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        resolve({
          authorized: socket.authorized,
          authorizationError: socket.authorizationError ? String(socket.authorizationError) : undefined,
          subjectAltName: cert.subjectaltname ?? '',
          validTo: cert.valid_to,
        });
        socket.end();
      },
    );
    socket.setTimeout(15_000, () => socket.destroy(new Error(`TLS timeout: ${u.host}`)));
    socket.on('error', reject);
  });
}
