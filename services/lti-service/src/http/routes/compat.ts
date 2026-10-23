// T3c: /api/deeplinking/form and /message (§3.2), line item POST/PUT/DELETE (§3.5),
// /api/memberships (§3.7), and OAuth stubs (§3.10 of the LTI service contract).
// Protocol work stays in lti/; guarded service calls stay in platform/.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import { createAccountResolver } from '../../accounts/resolver.ts';
import { CLAIM } from '../../lti/checks.ts';
import { deepLinkingForm } from '../../lti/deep-linking.ts';
import type { LineItemInput } from '../../platform/ags.ts';
import { urlKeyedMembers } from '../../platform/ags.ts';
import type { RouteContext } from '../context.ts';
import { checkServiceKeyWriteScope } from '../auth.ts';
import { agsContext, claimObject, deploymentIdOf, platformOf, signedDeepLink } from '../service-context.ts';
import { decodeLineItemId, invalid } from '../validation.ts';

const text = z.string().min(1).max(2048);
const LineItemBody = z.object({
  label: z.string().min(1).max(255).refine((s) => s.trim().length > 0), scoreMaximum: z.number().positive(),
  resourceLinkId: z.string().max(2048).nullable().optional(), resourceId: z.string().max(2048).nullable().optional(), tag: z.string().max(2048).nullable().optional(),
  startDateTime: z.iso.datetime({ offset: true }).or(z.literal('')).nullable().optional(), endDateTime: z.iso.datetime({ offset: true }).or(z.literal('')).nullable().optional(),
  gradesReleased: z.boolean().optional(),
});
const MembershipsQuerySchema = z.object({
  role: text.optional(), limit: z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).optional(),
  resourceLinkId: text.optional(), url: z.string().max(2048).optional(),
});
const parseItem = (body: unknown): LineItemInput => {
  const parsed = LineItemBody.safeParse(body);
  if (!parsed.success) throw invalid(parsed.error);
  return { ...parsed.data, ...urlKeyedMembers(body as Record<string, unknown>) };
};
type ItemParams = { Params: { lineItemId: string } };

export function registerCompatRoutes(app: FastifyInstance, ctx: RouteContext): void {
  const resolver = createAccountResolver(ctx.db, ctx.urls.lti);
  app.post('/api/deeplinking/message', async (req) => signedDeepLink(ctx, resolver, ctx.auth(req, ['ltik']), req.body));
  app.post('/api/deeplinking/form', async (req) => {
    const response = await signedDeepLink(ctx, resolver, ctx.auth(req, ['ltik']), req.body);
    return { form: deepLinkingForm(response) };
  });
  app.post('/api/lineitems', async (req, reply) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    return reply.code(201).send(await ctx.ags.createLineItem(agsContext(ctx, caller, req.traceId), parseItem(req.body)));
  });
  app.put<ItemParams>('/api/lineitems/:lineItemId', async (req, reply) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    const ags = agsContext(ctx, caller, req.traceId);
    const lineItemId = decodeLineItemId(req.params.lineItemId);
    const item = parseItem(req.body);
    await checkServiceKeyWriteScope(ctx, caller, ags, lineItemId);
    return reply.code(201).send(await ctx.ags.updateLineItem(ags, lineItemId, item));
  });
  app.delete<ItemParams>('/api/lineitems/:lineItemId', async (req, reply) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    const ags = agsContext(ctx, caller, req.traceId);
    const lineItemId = decodeLineItemId(req.params.lineItemId);
    await checkServiceKeyWriteScope(ctx, caller, ags, lineItemId);
    await ctx.ags.deleteLineItem(ags, lineItemId);
    return reply.code(204).send();
  });
  app.get('/api/memberships', async (req) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    const platform = platformOf(ctx, caller);
    const parsed = MembershipsQuerySchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      if (parsed.error.issues.some((i) => i.path[0] === 'url')) throw new ApiError('INVALID_URL_PARAMETER');
      throw invalid(parsed.error);
    }
    return ctx.nrps.listMemberships({
      platform, traceId: req.traceId, deploymentId: deploymentIdOf(caller),
      nrpsClaim: caller.launch ? claimObject(caller.launch.claims[CLAIM.nrps]) : caller.serviceKey?.nrpsClaim ?? null,
    }, parsed.data);
  });
  for (const path of ['/api/oauth/:platformId/access_token', '/api/oauth/:platformId/access_token/refresh']) {
    app.post(path, async (req) => {
      ctx.auth(req, ['bearer']);
      throw new ApiError('NOT_IMPLEMENTED', `OAuth2 is not implemented. Trace id: ${req.traceId}`);
    });
  }
}
