// NRPS 2.0 membership service; contract §3.7. Only identifiers, roles and status leave this client.
import type { Logger, OutboundClient } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import { z } from 'zod';
import { ApiError } from '../api-errors.ts';
import { isAllowedServiceUrl, withQuery } from '../lti/service-url.ts';
import type { Platform } from '../store/platforms.ts';
import { badPlatformDataError, outboundFailureError, platformResponseError } from './error-mapping.ts';
import { parseLinkHeader } from './link-header.ts';
import type { TokenClient } from './token-client.ts';

export const NRPS_SCOPE = 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';
const Memberships = z.object({
  id: z.string(),
  context: z.object({ id: z.string(), label: z.string().optional(), title: z.string().optional() }),
  members: z.array(z.object({
    user_id: z.string(), roles: z.array(z.string()), status: z.enum(['Active', 'Inactive', 'Deleted']).default('Active'),
  })),
});

export interface NrpsContext {
  platform: Platform;
  nrpsClaim: Record<string, unknown> | null;
  traceId: string;
}

export interface MembershipsQuery { role?: string; limit?: number; resourceLinkId?: string; url?: string }

export function createNrpsClient(deps: { outbound: OutboundClient; tokens: TokenClient; logger?: Logger }) {
  const logger = deps.logger ?? createLogger({ service: 'lti-service' });
  return {
    async listMemberships(ctx: NrpsContext, q: MembershipsQuery) {
      const base = ctx.nrpsClaim?.context_memberships_url;
      if (typeof base !== 'string' || !base) throw new ApiError('SERVICE_NOT_AVAILABLE', 'The launch has no NRPS URL.');
      // Check the raw URL before parsing it or asking for a platform token.
      const candidate = q.url ?? base;
      if (!isAllowedServiceUrl(candidate, base)) throw new ApiError('INVALID_URL_PARAMETER');
      // NRPS accepts both a short role name and a full URI. Pass either unchanged (NRPS §2.4.1).
      const url = q.url ?? withQuery(base, { role: q.role, limit: q.limit, rlid: q.resourceLinkId });
      const token = await deps.tokens.getToken(ctx.platform, [NRPS_SCOPE], ctx.traceId);
      let res;
      try {
        res = await deps.outbound.request(url, {
          method: 'GET', traceId: ctx.traceId,
          headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json' },
        });
      } catch (err) { throw outboundFailureError(err); }
      // Roster errors must not echo personal data.
      if (res.status < 200 || res.status >= 300) throw platformResponseError(res, { echoMessage: false, context: { logger, platformId: ctx.platform.id, traceId: ctx.traceId } });
      let json: unknown;
      try { json = res.json(); } catch { throw badPlatformDataError('memberships are not JSON'); }
      const parsed = Memberships.safeParse(json);
      if (!parsed.success) throw badPlatformDataError('memberships have an invalid shape');
      const data = parsed.data;
      const next = parseLinkHeader(res.headers.link).next;
      return {
        id: data.id, context: data.context,
        members: data.members.map((m) => ({ userId: m.user_id, roles: m.roles, status: m.status })),
        ...(next === undefined ? {} : { next }),
      };
    },
  };
}

export type NrpsClient = ReturnType<typeof createNrpsClient>;
