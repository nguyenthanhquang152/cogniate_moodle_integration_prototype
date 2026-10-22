// LA-ADR-06 D3: CLI mutations use the operator listener, never the database.
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';

export class OperatorApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
/** The server may have applied a write before its answer was lost. */
export class OperatorTransportError extends Error {}
export interface OperatorClient {
  request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<{ status: number; body: T }>;
}

export function createOperatorClient(env: NodeJS.ProcessEnv = process.env): OperatorClient {
  const file = env.LTI_OPERATOR_KEY_FILE || '/run/secrets/lti/lti-operator-key';
  const keyError = () => new Error(`Operator key file ${file} is missing or invalid. Run npm run seed again.`);
  let key: string;
  try { key = readFileSync(file, 'utf8').trim(); } catch { throw keyError(); }
  if (!/^ltio_[A-Za-z0-9_-]{43}$/.test(key)) throw keyError();
  const configuredHost = env.OPERATOR_HOST?.trim() || '127.0.0.1';
  // A wildcard listener is reached through loopback from the CLI in the same container.
  const host = configuredHost === '0.0.0.0' ? '127.0.0.1' : configuredHost === '::' ? '::1' : configuredHost;
  if (!isIP(host) && !/^[a-z0-9.-]+$/i.test(host)) throw new Error('OPERATOR_HOST must be an IP address or host name.');
  const port = env.OPERATOR_PORT?.trim() || '4110';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('OPERATOR_PORT must be a whole number from 1 to 65535.');
  const base = `http://${isIP(host) === 6 ? `[${host}]` : host}:${port}`;
  return {
    async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) {
      let response: Response;
      try {
        response = await fetch(`${base}/operator/v1${path}`, {
          method, headers: { authorization: `OPERATOR-AUTH-V1 ${key}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          redirect: 'error', signal: AbortSignal.timeout(10_000),
        });
      } catch { throw new OperatorTransportError(`Cannot reach the operator API at ${base}. Check that lti-service is running.`); }
      if (response.status === 401) throw new Error(`Operator key file ${file} was rejected. Put the current operator key in host file infra/.secrets/lti-operator-key and run npm run seed, or run npm run lti:bootstrap -w services/lti-service -- --account <id> --replace-operator-key (init --replace) to save a replacement safely.`);
      let data: { details?: { message?: string; description?: string } };
      try { data = await response.json() as typeof data; }
      catch { throw new OperatorTransportError(`Operator API returned an invalid JSON response (HTTP ${response.status}).`); }
      if (!response.ok) {
        const code = data?.details?.message ?? 'OPERATOR_API_ERROR';
        throw new OperatorApiError(response.status, code, data?.details?.description ?? `Operator API refused the request (HTTP ${response.status}).`);
      }
      return { status: response.status, body: data as T };
    },
  };
}

/** CLI failures are one stderr line, without a stack or credential. */
export function cliError(error: unknown): string {
  return (error instanceof Error ? error.message : 'CLI request failed.').replace(/[\r\n]+/g, ' ');
}
