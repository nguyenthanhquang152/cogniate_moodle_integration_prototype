// T3a API routes (contract §3.2, §3.5 GET rows, §3.6): POST /api/deeplinking, GET /api/lineitems,
// GET /api/lineitems/:lineItemId, POST and GET /api/lineitems/:lineItemId/scores.
// Auth (contract §1.2): deep linking = LTIK-AUTH-V2 only; line items and scores = LTIK-AUTH-V2 or SERVICE-AUTH-V1.
// `:lineItemId` is a URL-encoded URL: buildApp sets maxParamLength 2048.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createAccountResolver } from '../../accounts/resolver.ts';
import { parseScore } from '../../platform/ags.ts';
import type { RouteContext } from '../context.ts';
import { checkServiceKeyWriteScope } from '../auth.ts';
import { decodeLineItemId, invalid } from '../validation.ts';
import { agsContext, signedDeepLink } from '../service-context.ts';

type Obj = Record<string, unknown>;
const text = z.string().min(1).max(2048);
const limit = z.string().regex(/^[1-9]\d{0,5}$/, 'a whole number >= 1').transform(Number);
const LineItemsQuery = z.object({ resourceLinkId: text.optional(), resourceId: text.optional(), tag: text.optional(), limit: limit.optional(), url: text.optional() });
// ltiaas-0.0.4 tolerance (contract §8 D14): accept user_id as a userId alias; refuse conflicting values.
const ScoresQuery = z.object({ userId: text.optional(), user_id: text.optional(), limit: limit.optional(), url: text.optional() })
  .refine((q) => q.userId === undefined || q.user_id === undefined || q.userId === q.user_id, {
    path: ['user_id'], message: 'user_id must match userId when both are present',
  })
  .transform(({ user_id, ...q }) => ({ ...q, userId: q.userId ?? user_id }));
const parseQuery = <T extends z.ZodType>(schema: T, q: unknown): z.output<T> => {
  const r = schema.safeParse(q ?? {});
  if (!r.success) throw invalid(r.error);
  return defined(r.data as Obj) as z.output<T>;
};
const defined = <T extends Obj>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

type ItemParams = { Params: { lineItemId: string } };
export function registerServiceRoutes(app: FastifyInstance, ctx: RouteContext): void {
  const traceOf = (req: FastifyRequest): string => req.traceId ?? '';
  const resolver = createAccountResolver(ctx.db, ctx.urls.lti);
  app.post('/api/deeplinking', async (req) => {
    const caller = ctx.auth(req, ['ltik']);
    return signedDeepLink(ctx, resolver, caller, req.body);
  });

  app.get('/api/lineitems', async (req) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    return ctx.ags.listLineItems(agsContext(ctx, caller, traceOf(req)), parseQuery(LineItemsQuery, req.query));
  });

  app.get<ItemParams>('/api/lineitems/:lineItemId', async (req) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    return ctx.ags.getLineItem(agsContext(ctx, caller, traceOf(req)), decodeLineItemId(req.params.lineItemId));
  });

  app.post<ItemParams>('/api/lineitems/:lineItemId/scores', async (req, reply) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    const score = parseScore(req.body, ctx.now());
    const ags = agsContext(ctx, caller, traceOf(req));
    const lineItemId = decodeLineItemId(req.params.lineItemId);
    await checkServiceKeyWriteScope(ctx, caller, ags, lineItemId);
    await ctx.ags.postScore(ags, lineItemId, score);
    return reply.code(204).send();
  });

  app.get<ItemParams>('/api/lineitems/:lineItemId/scores', async (req) => {
    const caller = ctx.auth(req, ['ltik', 'service']);
    return ctx.ags.getScores(agsContext(ctx, caller, traceOf(req)), decodeLineItemId(req.params.lineItemId), parseQuery(ScoresQuery, req.query));
  });
}
