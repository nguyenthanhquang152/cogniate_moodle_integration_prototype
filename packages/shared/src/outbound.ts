/**
 * Guarded outbound HTTP client (security §9). Every outbound call of the services goes through it.
 *  - https only, no redirects (a 3xx is refused), 5 s timeout, 1 MB response limit.
 *  - The private-IP check runs INSIDE the lookup that the connection uses (no second lookup), so a DNS answer
 *    that changes between check and connect (DNS rebinding) cannot reach a blocked address. Every address of
 *    the answer is checked; one blocked address blocks the call.
 *  - Hosts in the allowlist may resolve to blocked ranges (dev: the Moodle host behind the stack proxy).
 *  - Every attempt logs exactly one event (security §9): outbound_request {host, method, status, ms} when an HTTP
 *    response was accepted, else outbound_blocked {host, method, reason}. The first terminal outcome of an attempt
 *    wins: it clears the timer and logs; later socket events of the same attempt log nothing (A-T2a-01).
 *  - Own https.Agent: no global agent and no environment proxy, so the guarded lookup always sees the target host.
 */
import { lookup as dnsLookup } from 'node:dns';
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import type { Logger } from './logger.ts';

export type OutboundBlockReason = 'not_https' | 'private_ip' | 'redirect' | 'timeout' | 'too_large' | 'dns_error' | 'network_error';

export class OutboundError extends Error {
  readonly reason: OutboundBlockReason;
  readonly host: string;
  constructor(reason: OutboundBlockReason, host: string, message: string) {
    super(message);
    this.name = 'OutboundError';
    this.reason = reason;
    this.host = host;
  }
}

// ---------------------------------------------------------------- blocked ranges (security §9)
const V4_BLOCKED: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32],
];
const V6_BLOCKED: ReadonlyArray<readonly [string, number]> = [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96],
  // Defence in depth beyond the security §9 list (A-T2a-04): IPv4-compatible ::a.b.c.d, 6to4, old site-local.
  ['::', 96], ['2002::', 16], ['fec0::', 10],
];

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => ((acc << 8) | Number(part)) >>> 0, 0);
}

/** IPv6 text -> 128-bit BigInt. Handles "::" and an embedded IPv4 tail. */
function v6ToBigInt(ip: string): bigint {
  let text = ip.toLowerCase().split('%')[0]!;
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const v = v4ToInt(tail[1]!);
    text = `${text.slice(0, -tail[1]!.length)}${(v >>> 16).toString(16)}:${(v & 0xffff).toString(16)}`;
  }
  const [head, rest] = text.split('::') as [string, string | undefined];
  const left = head ? head.split(':') : [];
  const right = rest !== undefined && rest !== '' ? rest.split(':') : [];
  const fill = rest === undefined ? [] : new Array<string>(8 - left.length - right.length).fill('0');
  return [...left, ...fill, ...right].reduce((acc, part) => (acc << 16n) | BigInt(parseInt(part || '0', 16)), 0n);
}

function inV4(ip: string, [base, bits]: readonly [string, number]): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
}

function inV6(value: bigint, [base, bits]: readonly [string, number]): boolean {
  const mask = bits === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - bits)) - 1n);
  return (value & mask) === (v6ToBigInt(base) & mask);
}

/** True if the address is in a blocked range. IPv4-mapped IPv6 (::ffff:a.b.c.d) is checked as IPv4. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return V4_BLOCKED.some((r) => inV4(address, r));
  if (family === 6) {
    const value = v6ToBigInt(address);
    if (value >> 32n === 0xffffn) {
      const v4 = Number(value & 0xffffffffn);
      return isBlockedAddress([v4 >>> 24, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255].join('.'));
    }
    return V6_BLOCKED.some((r) => inV6(value, r));
  }
  return true; // not an IP address: never connect to it
}

// ---------------------------------------------------------------- client
export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

const systemResolver: Resolver = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses.map((a) => ({ address: a.address, family: a.family === 6 ? 6 : 4 })));
    });
  });

export interface OutboundOptions {
  logger: Logger;
  /** Host names that may resolve to blocked ranges (OUTBOUND_PRIVATE_HOST_ALLOWLIST). */
  allowlist?: string[];
  timeoutMs?: number;
  maxBytes?: number;
  /** For tests: a fake DNS. */
  resolver?: Resolver;
  /** For tests: the low-level request function (default node:https request). */
  requestImpl?: (options: RequestOptions, onResponse: (res: IncomingMessage) => void) => ClientRequest;
}

export interface OutboundRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  traceId?: string;
  /** Override this request's deadline without changing the client's default or other guards. */
  timeoutMs?: number;
  /** Default: retry GET once on a network error. False leaves retry ownership with the caller. */
  retryNetworkError?: boolean;
}

export interface OutboundResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
  text(): string;
  json(): unknown;
}

export interface OutboundClient {
  readonly allowlist: readonly string[];
  request(url: string, req?: OutboundRequest): Promise<OutboundResponse>;
}

const BLOCKED_CODE = 'EOUTBOUNDBLOCKED';

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((h) => h.trim().toLowerCase()).filter((h) => h !== '');
}

export function createOutboundClient(options: OutboundOptions): OutboundClient {
  const allowlist = (options.allowlist ?? []).map((h) => h.toLowerCase());
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const resolver = options.resolver ?? systemResolver;
  const agent = new HttpsAgent({ keepAlive: true, maxSockets: 16 });
  const requestImpl = options.requestImpl ?? ((opts, cb) => httpsRequest({ ...opts, agent }, cb));
  const log = options.logger;

  /** The lookup that the connection uses. It checks every address of the answer. */
  const guardedLookup = (allowed: boolean): LookupFunction => (hostname, lookupOptions, callback) => {
    resolver(hostname).then(
      (addresses) => {
        if (addresses.length === 0) return callback(Object.assign(new Error('no address'), { code: BLOCKED_CODE, reason: 'dns_error' }), '', 4);
        if (!allowed && addresses.some((a) => isBlockedAddress(a.address))) {
          return callback(Object.assign(new Error('private address'), { code: BLOCKED_CODE, reason: 'private_ip' }), '', 4);
        }
        if (lookupOptions.all) return (callback as unknown as (e: null, a: ResolvedAddress[]) => void)(null, addresses);
        return callback(null, addresses[0]!.address, addresses[0]!.family);
      },
      () => callback(Object.assign(new Error('dns error'), { code: BLOCKED_CODE, reason: 'dns_error' }), '', 4),
    );
  };

  const once = (url: URL, req: OutboundRequest): Promise<OutboundResponse> => {
    const override = req.timeoutMs;
    const requestTimeoutMs = override === undefined || Number.isNaN(override) || override <= 0 ? timeoutMs : Math.min(60_000, Math.max(1, override));
    const host = url.hostname.toLowerCase();
    const method = req.method ?? 'GET';
    const started = performance.now();
    const ms = () => Math.round(performance.now() - started);
    const traceField = req.traceId ? { trace_id: req.traceId } : {};
    const blocked = (reason: OutboundBlockReason, message: string): OutboundError => {
      log.warn('outbound_blocked', { ...traceField, host, method, reason });
      return new OutboundError(reason, host, message);
    };
    if (url.protocol !== 'https:') return Promise.reject(blocked('not_https', 'only https is allowed'));
    const allowed = allowlist.includes(host);
    const literal = host.replace(/^\[|\]$/g, '');
    if (isIP(literal) && !allowed && isBlockedAddress(literal)) return Promise.reject(blocked('private_ip', 'private address'));

    return new Promise<OutboundResponse>((resolve, reject) => {
      let settled = false;
      /** The first terminal outcome of this attempt: clear the timer, log ONE event, reject. Later calls do nothing. */
      const fail = (reason: OutboundBlockReason, message: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(blocked(reason, message));
      };
      const headers: Record<string, string> = { ...(req.headers ?? {}) };
      if (req.body !== undefined) headers['content-length'] = String(Buffer.byteLength(req.body));
      const r = requestImpl({
        protocol: 'https:', hostname: literal, port: url.port || 443, path: `${url.pathname}${url.search}`,
        method, headers, lookup: guardedLookup(allowed), servername: isIP(literal) ? undefined : literal,
      }, (res) => {
        if (settled) { res.destroy(); return; }
        const status = res.statusCode ?? 0;
        // fail() before destroy(): the socket error that destroy() causes then finds the attempt settled.
        if (status >= 300 && status < 400) { fail('redirect', `redirect ${status} refused`); res.destroy(); return; }
        const declared = Number(res.headers['content-length'] ?? '0');
        if (declared > maxBytes) { fail('too_large', 'response too large'); res.destroy(); return; }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) { fail('too_large', 'response too large'); res.destroy(); return; }
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          log.info('outbound_request', { ...traceField, host, method, status, ms: ms() });
          const body = Buffer.concat(chunks);
          resolve({ status, headers: res.headers, body, text: () => body.toString('utf8'), json: () => JSON.parse(body.toString('utf8')) as unknown });
        });
        res.on('error', () => fail('network_error', 'response error'));
      });
      // Request callbacks are always asynchronous, so `timer` exists before fail() or 'end' can run.
      const timer = setTimeout(() => { fail('timeout', `no answer in ${requestTimeoutMs} ms`); r.destroy(); }, requestTimeoutMs);
      r.on('error', (err: NodeJS.ErrnoException & { reason?: OutboundBlockReason }) => {
        if (err.code === BLOCKED_CODE && err.reason) fail(err.reason, err.message);
        else fail('network_error', err.code ?? 'network error');
      });
      if (req.body !== undefined) r.write(req.body);
      r.end();
    });
  };

  return {
    allowlist,
    async request(rawUrl, req = {}) {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        log.warn('outbound_blocked', { ...(req.traceId ? { trace_id: req.traceId } : {}), host: '', method: req.method ?? 'GET', reason: 'not_https' });
        throw new OutboundError('not_https', '', 'invalid URL');
      }
      try {
        return await once(url, req);
      } catch (err) {
        // One retry on a network error, for GET only (contract §4). Blocked calls are never retried.
        if (req.retryNetworkError !== false && err instanceof OutboundError && err.reason === 'network_error' && (req.method ?? 'GET') === 'GET') return once(url, req);
        throw err;
      }
    },
  };
}
