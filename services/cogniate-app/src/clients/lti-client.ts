// Typed client of the LTI service API (contract lti-service-api §3.8, §3.9) for the app. It is a client of another
// service, not a repository, so it lives in clients/ (B-T4b1-02). Rules (app contract §1):
//  - the API key is read from its file at EACH use (a rotated key works without a restart);
//  - every call sends X-Trace-Id and goes through the guarded outbound client (security §9; allowlist: the LTI host);
//  - every answer is parsed with zod: an answer that does not match the contract is an error (502 in the app API).
import { readFileSync } from 'node:fs';
import type { OutboundClient } from '@cogniate/shared';
import { z } from 'zod';

const Registration = z.object({
  url: z.string(),
  familyCode: z.string().nullish().transform((v) => v ?? ''),
  version: z.string().nullish().transform((v) => v ?? ''),
  supportedScopes: z.array(z.string()),
  supportedMessages: z.array(z.object({ type: z.string(), placements: z.array(z.string()).optional() })),
  privacyLevel: z.string(),
  operation: z.enum(['new', 'update']),
  existingPlatformId: z.string().nullable(),
});
export type LtiRegistration = z.infer<typeof Registration>;

const Platform = z.object({
  id: z.string().min(1),
  url: z.string(),
  clientId: z.string(),
  name: z.string(),
  active: z.boolean(),
  deploymentIds: z.array(z.string()),
  productFamilyCode: z.string().nullish().transform((v) => v ?? null),
});
export type LtiPlatform = z.infer<typeof Platform>;

const Completed = z.object({ platformId: z.string().min(1), html: z.string() });

/** One profile of `GET /api/providers` (LTI contract §9.3). */
const ProviderProfile = z.object({
  id: z.string().min(1),
  lms: z.enum(['canvas', 'blackboard']).nullable(),
  label: z.string(),
  sharing: z.enum(['exclusive', 'shared']),
  issuer: z.string().nullable(),
  authenticationEndpoint: z.string().nullable(),
  accesstokenEndpoint: z.string().nullable(),
  jwksUrl: z.string().nullable(),
  siteUrlOn: z.enum(['platform', 'deployment']).nullable(),
  serviceUrl: z.boolean(),
  simulation: z.boolean(),
  sharedPlatform: z.object({ id: z.string().min(1), clientId: z.string(), active: z.boolean() }).nullable(),
});
export type LtiProviderProfile = z.infer<typeof ProviderProfile>;
const Providers = z.object({ profiles: z.array(ProviderProfile) });

/** The public tool JWKS (`GET /lti/keys/{account}`, LTI contract §2.3): public members only. */
const ToolKeys = z.object({
  keys: z.array(z.object({ kty: z.literal('RSA'), kid: z.string().min(1), alg: z.literal('RS256'), use: z.literal('sig'), n: z.string().min(1), e: z.string().min(1) })),
});
export type LtiToolKey = z.infer<typeof ToolKeys>['keys'][number];

/** GET /api/idtoken (contract §3.1): only the fields that the app reads. Absent values are omitted by the service. */
const IdToken = z.object({
  user: z.object({ id: z.string().min(1), roles: z.array(z.string()) }),
  platform: z.object({ id: z.string().min(1), url: z.string(), deploymentId: z.string().min(1) }),
  launch: z.object({
    type: z.string(),
    target: z.string(),
    context: z.object({ id: z.string(), label: z.string().optional(), title: z.string().optional() }).optional(),
    resourceLink: z.object({ id: z.string(), title: z.string().optional() }).optional(),
    presentation: z.object({ documentTarget: z.string().optional(), returnUrl: z.string().optional() }).optional(),
  }),
  services: z.object({
    assignmentAndGrades: z.object({ available: z.boolean(), lineItemId: z.string().optional() }).optional(),
    serviceKey: z.string().optional(),
  }).optional(),
});
export type LtiIdToken = z.infer<typeof IdToken>;

/** One Deep Linking content item (flows §6b: the app sends exactly this shape). */
export interface ContentItem {
  type: 'ltiResourceLink';
  title: string;
  url: string;
  lineItem: { scoreMaximum: number; label: string; resourceId: string; tag: string };
}
const DeepLinkingAnswer = z.object({ message: z.string().min(1), target: z.string().min(1) });
const NoContent = z.undefined();
const LineItems = z.object({ lineItems: z.array(z.object({ id: z.string().min(1), resourceLinkId: z.string().optional() })) });
const Results = z.object({ scores: z.array(z.object({ userId: z.string().optional(), resultScore: z.number().nullish(), resultMaximum: z.number().nullish() })) });

/** POST /api/platforms body (contract §3.9). */
export interface NewPlatform {
  url: string;
  clientId: string;
  name: string;
  authenticationEndpoint: string;
  accesstokenEndpoint: string;
  authConfig: { method: 'JWK_SET'; key: string };
  deploymentIds: string[];
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

/** Safe log fields of a failed LTI call (codes only, never the description; B-T4b1-01). */
export function ltiErrorFields(err: unknown): { lti_status: number; lti_code: string; lti_reason: string | null } | Record<string, never> {
  return err instanceof LtiServiceError ? { lti_status: err.status, lti_code: err.code, lti_reason: err.reason } : {};
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

  /** Auth (contract §1.2): `ltik` -> LTIK-AUTH-V2; `serviceKey` -> SERVICE-AUTH-V1; else Bearer. */
  async function call<S extends z.ZodType>(schema: S, method: 'GET' | 'POST' | 'PATCH', path: string, traceId: string, body?: unknown, ltik?: string, serviceKey?: string, timeoutMs?: number): Promise<z.output<S>> {
    let key: string;
    try {
      key = readKey(deps.apiKeyFile);
    } catch {
      throw new LtiServiceError(0, 'NO_API_KEY', 'The LTI service API key file cannot be read. Run npm run seed.');
    }
    const authorization = ltik !== undefined ? `LTIK-AUTH-V2 ${key}:${ltik}` : serviceKey !== undefined ? `SERVICE-AUTH-V1 ${key}:${serviceKey}` : `Bearer ${key}`;
    let res;
    try {
      res = await deps.outbound.request(`${deps.ltiUrl}${path}`, {
        method, traceId, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        headers: { authorization, 'x-trace-id': traceId, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
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
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new LtiServiceError(res.status, 'INVALID_LTI_ANSWER', 'The LTI service answer does not match the contract.');
    return parsed.data;
  }

  const id = encodeURIComponent;
  return {
    getRegistration: (regId: string, traceId: string) => call(Registration, 'GET', `/api/registrations/${id(regId)}`, traceId),
    completeRegistration: (regId: string, body: { platformName: string; privacyLevel: string; autoActivate: boolean }, traceId: string) =>
      // Give the LTI service's 5 s Moodle call time to return its uncertain-registration result (P1).
      call(Completed, 'POST', `/api/registrations/${id(regId)}/complete`, traceId, body, undefined, undefined, 15_000),
    createPlatform: (body: NewPlatform, traceId: string) => call(Platform, 'POST', '/api/platforms', traceId, body),
    getPlatform: (platformId: string, traceId: string) => call(Platform, 'GET', `/api/platforms/${id(platformId)}`, traceId),
    patchPlatform: (platformId: string, body: { active?: boolean; name?: string }, traceId: string) => call(Platform, 'PATCH', `/api/platforms/${id(platformId)}`, traceId, body),
    /** Provider profiles (LTI contract §9.3, M1). */
    getProviders: (traceId: string) => call(Providers, 'GET', '/api/providers', traceId).then((r) => r.profiles),
    /** Public tool keys of the tool account (LTI contract §2.3); the first key is the active one (Canvas inline JWK). */
    getToolKeys: (account: string, traceId: string) => call(ToolKeys, 'GET', `/lti/keys/${id(account)}`, traceId).then((r) => r.keys),
    /** The launch behind a ltik (T4b2 handoff). */
    getIdToken: (ltik: string, traceId: string) => call(IdToken, 'GET', '/api/idtoken', traceId, undefined, ltik),
    /** The signed Deep Linking response for one content item (flows §6b). */
    deepLinking: (ltik: string, contentItems: ContentItem[], traceId: string) =>
      call(DeepLinkingAnswer, 'POST', '/api/deeplinking', traceId, { contentItems }, ltik),
    /** One AGS score (app contract §10), SERVICE-AUTH-V1: works after the ltik expired. 204 on success. */
    postScore: (serviceKey: string, lineItemId: string, body: object, traceId: string) =>
      call(NoContent, 'POST', `/api/lineitems/${id(lineItemId)}/scores`, traceId, body, undefined, serviceKey),
    /** AGS results of one learner ("Refresh from Moodle", contract §3.6 GET .../scores), SERVICE-AUTH-V1. */
    getResults: (serviceKey: string, lineItemId: string, userId: string, traceId: string) =>
      call(Results, 'GET', `/api/lineitems/${id(lineItemId)}/scores?${new URLSearchParams({ userId })}`, traceId, undefined, undefined, serviceKey).then((r) => r.scores),
    /** The line items of a resource link (ADR-010 rule 1: used when the launch had no line item). */
    findLineItems: (serviceKey: string, resourceLinkId: string, traceId: string) =>
      call(LineItems, 'GET', `/api/lineitems?${new URLSearchParams({ resourceLinkId })}`, traceId, undefined, undefined, serviceKey).then((r) => r.lineItems),
  };
}

export type LtiClient = ReturnType<typeof createLtiClient>;
