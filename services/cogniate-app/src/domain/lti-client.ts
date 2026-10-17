// Typed client of the LTI service API (contract lti-service-api §3.8, §3.9) for the app. Rules (app contract §1):
// the API key is read from its file at EACH use (a rotated key works without a restart), every call sends X-Trace-Id,
// and every call goes through the guarded outbound client (security §9; allowlist: the LTI service host).
import { readFileSync } from 'node:fs';
import type { OutboundClient } from '@cogniate/shared';

export interface LtiRegistration {
  url: string;
  familyCode: string;
  version: string;
  supportedScopes: string[];
  supportedMessages: Array<{ type: string; placements?: string[] }>;
  privacyLevel: string;
  operation: 'new' | 'update';
  existingPlatformId: string | null;
}

export interface LtiPlatform {
  id: string;
  url: string;
  clientId: string;
  name: string;
  active: boolean;
  deploymentIds: string[];
  productFamilyCode: string | null;
}

/** An LTI service answer that is not a success (`code` = details.message), or no answer at all (status 0). */
export class LtiServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly description: string;
  /** details.reason of the answer, for example "tool_may_exist" (registration result unknown, A-T3b-01). */
  readonly reason: string | null;
  constructor(status: number, code: string, description: string, reason: string | null = null) {
    super(`${status} ${code}`);
    this.name = 'LtiServiceError';
    this.status = status;
    this.code = code;
    this.description = description;
    this.reason = reason;
  }
}

export interface LtiClientDeps {
  outbound: OutboundClient;
  /** PUBLIC_LTI_URL */
  ltiUrl: string;
  /** Compose: /run/secrets/app/lti-api-key (only this file; infra/.secrets/app/lti-api-key on the host). */
  apiKeyFile: string;
  readKey?: (file: string) => string;
}

export function createLtiClient(deps: LtiClientDeps) {
  const readKey = deps.readKey ?? ((f: string) => readFileSync(f, 'utf8').trim());

  async function call<T>(method: 'GET' | 'POST' | 'PATCH', path: string, traceId: string, body?: unknown): Promise<T> {
    let key: string;
    try {
      key = readKey(deps.apiKeyFile);
    } catch {
      throw new LtiServiceError(0, 'NO_API_KEY', 'The LTI service API key file cannot be read. Run npm run seed.');
    }
    let res;
    try {
      res = await deps.outbound.request(`${deps.ltiUrl}${path}`, {
        method, traceId, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        headers: { authorization: `Bearer ${key}`, 'x-trace-id': traceId, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      });
    } catch {
      throw new LtiServiceError(0, 'LTI_SERVICE_UNREACHABLE', 'The LTI service did not answer.');
    }
    let json: unknown;
    try {
      json = res.json();
    } catch {
      json = undefined;
    }
    if (res.status < 200 || res.status >= 300) {
      const d = (json as { details?: { message?: unknown; description?: unknown; reason?: unknown } } | undefined)?.details;
      throw new LtiServiceError(res.status, typeof d?.message === 'string' ? d.message : `HTTP_${res.status}`, typeof d?.description === 'string' ? d.description : '',
        typeof d?.reason === 'string' ? d.reason : null);
    }
    return json as T;
  }

  return {
    getRegistration: (id: string, traceId: string) => call<LtiRegistration>('GET', `/api/registrations/${encodeURIComponent(id)}`, traceId),
    completeRegistration: (id: string, body: { platformName: string; privacyLevel: string; autoActivate: boolean; updatePlatformId?: string }, traceId: string) =>
      call<{ platformId: string; html: string }>('POST', `/api/registrations/${encodeURIComponent(id)}/complete`, traceId, body),
    createPlatform: (body: Record<string, unknown>, traceId: string) => call<LtiPlatform>('POST', '/api/platforms', traceId, body),
    getPlatform: (id: string, traceId: string) => call<LtiPlatform>('GET', `/api/platforms/${encodeURIComponent(id)}`, traceId),
    findPlatforms: (q: { url: string; clientId: string }, traceId: string) =>
      call<{ platforms: LtiPlatform[] }>('GET', `/api/platforms?${new URLSearchParams(q)}`, traceId).then((r) => r.platforms),
    patchPlatform: (id: string, body: { active?: boolean; name?: string }, traceId: string) => call<LtiPlatform>('PATCH', `/api/platforms/${encodeURIComponent(id)}`, traceId, body),
  };
}

export type LtiClient = ReturnType<typeof createLtiClient>;
