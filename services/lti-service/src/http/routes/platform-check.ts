// Connection check (A2 LA-ADR-08 D4; contract delta §2.6): fetch the platform JWKS and request one access token with our
// client assertion, both through the guarded client. The check reads no course or user data, and it never caches or
// returns the token. It runs only for an active platform and deployment, so the assertion goes only to a token endpoint
// that the binding proved or that an operator grant bound (A-LAD-01, LA-ADR-07 rule A6; security delta §9).
import type { OutboundClient, OutboundResponse } from '@cogniate/shared';
import { OutboundError } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import { createTokenClient } from '../../platform/token-client.ts';
import { isSharedProfile, profileDefinition } from '../../profiles/index.ts';
import { withAudit } from '../../store/audit.ts';
import type { Platform } from '../../store/platforms.ts';
import { findDeployment, getPlatform } from '../../store/platforms.ts';
import type { RouteContext } from '../context.ts';
import { invalid } from '../validation.ts';

/** One check per platform and deployment per minute (contract delta §2.6). */
export const CHECK_INTERVAL_MS = 60_000;
const AGS_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/';
const CheckBody = z.object({ deploymentId: z.string().min(1).max(2048).optional() }).strict();

export interface PlatformCheck {
  checkedAt: string;
  jwks: { ok: boolean; keys?: number; detail?: string };
  token: { ok: boolean; scope?: string; detail?: string };
  platform: { active: boolean; deploymentActive: boolean };
  limits: 'shared-application' | null;
}

type CheckContext = Pick<RouteContext, 'db' | 'masterKey' | 'outbound' | 'logger' | 'now' | 'profiles'>;

/** The outbound reason of a refused or failed request (security §9). */
const outboundReason = (err: unknown): string => err instanceof OutboundError ? err.reason : 'network_error';

/** One granted AGS scope: `lineitem.readonly` when granted (null = no limit), else `score`; null when neither is granted. */
export function checkScope(platform: Pick<Platform, 'grantedScopes'>): string | null {
  const granted = platform.grantedScopes;
  return [`${AGS_SCOPE}lineitem.readonly`, `${AGS_SCOPE}score`].find((scope) => granted === null || granted.includes(scope)) ?? null;
}

/** The key count of the platform JWKS, or why it cannot be read. */
async function checkJwks(ctx: CheckContext, platform: Platform, traceId: string): Promise<PlatformCheck['jwks']> {
  let res: OutboundResponse;
  try {
    res = await ctx.outbound.request(platform.jwksUrl, { method: 'GET', traceId, headers: { accept: 'application/json' } });
  } catch (err) {
    return { ok: false, detail: outboundReason(err) };
  }
  if (res.status !== 200) return { ok: false, detail: `http_${res.status}` };
  let keys: unknown;
  try {
    keys = (res.json() as { keys?: unknown } | null)?.keys;
  } catch {
    keys = undefined;
  }
  return Array.isArray(keys) && keys.length > 0 ? { ok: true, keys: keys.length } : { ok: false, detail: 'invalid_jwks' };
}

/** The class of a refused token answer: the OAuth error `invalid_client` or `invalid_scope`, else the HTTP status. */
function tokenAnswerClass(res: OutboundResponse): string {
  try {
    const error = (res.json() as { error?: unknown } | null)?.error;
    if (error === 'invalid_client' || error === 'invalid_scope') return error;
  } catch {
    // Not JSON: the status is the class.
  }
  return `http_${res.status}`;
}

/** One token request with one granted AGS scope. */
async function checkToken(ctx: CheckContext, platform: Platform, deploymentId: string, traceId: string): Promise<PlatformCheck['token']> {
  const scope = checkScope(platform);
  // BD-A2-98: no token request; `invalid_scope` stays the platform's OAuth error.
  if (scope === null) return { ok: false, detail: 'no_granted_scope' };
  // A token client of its own: it builds the client assertion as for every token request, its cache ends with this
  // check (the shared cache never gets the token), and the recorded answer gives the class of a refusal.
  let answer: OutboundResponse | undefined;
  let failure: unknown;
  const recording: OutboundClient = {
    allowlist: ctx.outbound.allowlist,
    async request(url, req) {
      try {
        answer = await ctx.outbound.request(url, req);
        return answer;
      } catch (err) {
        failure = err;
        throw err;
      }
    },
  };
  const tokens = createTokenClient({ db: ctx.db, masterKey: ctx.masterKey, outbound: recording, logger: ctx.logger, now: ctx.now, profiles: ctx.profiles });
  try {
    await tokens.getToken(platform, [scope], traceId, { deploymentId });
    return { ok: true, scope };
  } catch (err) {
    if (failure !== undefined) return { ok: false, scope, detail: outboundReason(failure) };
    if (answer === undefined) throw err;
    return { ok: false, scope, detail: answer.status === 200 ? 'invalid_token_response' : tokenAnswerClass(answer) };
  }
}

export function registerPlatformCheckRoutes(app: FastifyInstance, ctx: CheckContext & Pick<RouteContext, 'auth'>): void {
  // The time of the last check per account, platform and deployment. A check drops the entries older than the interval.
  const lastCheck = new Map<string, number>();
  app.post<{ Params: { id: string } }>('/api/platforms/:id/check', async (req) => {
    const caller = ctx.auth(req, ['bearer']);
    return withAudit(ctx.db, ctx.now, {
      actor: caller.actor, toolAccountId: caller.account.id, traceId: req.traceId, clientIp: req.ip,
      action: 'platform.check', target: { type: 'platform', id: req.params.id },
    }, async (audit) => {
      const parsed = CheckBody.safeParse(req.body ?? {});
      if (!parsed.success) throw invalid(parsed.error);
      const platform = getPlatform(ctx.db, caller.account.id, req.params.id);
      if (!platform) throw new ApiError('UNREGISTERED_PLATFORM', 'Unknown platform id.');
      // A staged (inactive) platform is never checked: its token endpoint is not proven yet.
      if (!platform.active) throw new ApiError('PLATFORM_NOT_ACTIVE');
      // BD-A2-98: no deploymentId = the first active deployment; an unknown id is 404, a known inactive one 403.
      if (parsed.data.deploymentId !== undefined && !findDeployment(platform, parsed.data.deploymentId)) throw new ApiError('UNKNOWN_DEPLOYMENT');
      const deploymentId = parsed.data.deploymentId ?? platform.deploymentIds[0];
      if (deploymentId === undefined || !platform.deploymentIds.includes(deploymentId)) throw new ApiError('DEPLOYMENT_NOT_ACTIVE');
      const now = ctx.now();
      for (const [key, at] of lastCheck) if (now - at >= CHECK_INTERVAL_MS) lastCheck.delete(key);
      const key = JSON.stringify([caller.account.id, platform.id, deploymentId]);
      const previous = lastCheck.get(key);
      if (previous !== undefined) {
        const retryAfter = Math.ceil((CHECK_INTERVAL_MS - (now - previous)) / 1000);
        throw new ApiError('RATE_LIMITED', `One check per platform and deployment per minute. Retry after ${retryAfter} s.`, { details: { retryAfter } });
      }
      lastCheck.set(key, now);
      const [jwks, token] = await Promise.all([checkJwks(ctx, platform, req.traceId), checkToken(ctx, platform, deploymentId, req.traceId)]);
      const profile = profileDefinition(platform.profile, ctx.profiles);
      const answer: PlatformCheck = {
        checkedAt: new Date(ctx.now()).toISOString(), jwks, token, platform: { active: true, deploymentActive: true },
        // For a shared platform the token proves the vendor application, not the school (ADR-011 R-M-14).
        limits: profile !== null && isSharedProfile(profile) ? 'shared-application' : null,
      };
      // The shared redaction hides every field named "token", so the token result is logged as token_result
      // (tokenResult in the audit details). Neither holds a token or an assertion.
      ctx.logger.info('platform_check', { trace_id: req.traceId, platform_id: platform.id, jwks, token_result: token });
      return audit.change(() => answer, () => ({ details: { deploymentId, jwks, tokenResult: token } }));
    });
  });
}
