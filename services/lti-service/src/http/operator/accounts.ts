import { storeFor } from '../../store/index.ts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAccountResolver } from '../../accounts/resolver.ts';
import { AccountLimitsSchema, AccountStatusSchema, ClaimPolicySchema, toolUrlSchema } from '../../accounts/validation.ts';
import { ApiError } from '../../api-errors.ts';
import type { ToolAccount } from '../../store/accounts.ts';
import { ACCOUNT_ID } from '../../store/accounts.ts';
import { prepareToolKey } from '../../store/tool-keys.ts';
import { invalid } from '../validation.ts';
import type { OperatorContext } from './index.ts';

const ListQuery = z.object({
  status: AccountStatusSchema.optional(), cursor: z.string().regex(ACCOUNT_ID).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

const URL_RULE = 'Use an https URL with no user info, fragment or surrounding spaces, at most 2048 characters, outside the LTI and content hosts.';
const FIELD_RULES: Record<string, string> = {
  id: 'Use 1 to 63 lower-case letters, digits or hyphens, starting with a letter or digit.',
  launchUrl: URL_RULE, deepLinkingUrl: URL_RULE, registrationUrl: URL_RULE,
  publicBaseUrl: 'Use null; host mode is not available.',
  status: 'Use active, suspended or closed.',
  autoRotate: 'Use true or false.',
  claimPolicy: 'Send an explicit allowlist or passthrough policy with all keep flags; null is only a stored legacy marker.',
};
function invalidAccount(error: z.ZodError): ApiError {
  const field = String(error.issues[0]?.path[0] ?? 'body');
  const rule = FIELD_RULES[field];
  return rule ? new ApiError('INVALID_REQUEST', `${invalid(error).description} ${rule}`, { details: { field, rule } }) : invalid(error);
}

export function registerAccountRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  const toolUrl = toolUrlSchema(ctx.urls);
  const fields = {
    name: z.string().trim().min(1).max(255), launchUrl: toolUrl, deepLinkingUrl: toolUrl, registrationUrl: toolUrl,
    limits: AccountLimitsSchema.nullable().optional(), claimPolicy: ClaimPolicySchema.optional(),
    publicBaseUrl: z.null().optional(),
  };
  const Create = z.object({ id: z.string().regex(ACCOUNT_ID), ...fields }).strict();
  const Patch = z.object({
    ...fields, status: AccountStatusSchema, serviceKeyWriteScope: z.enum(['context', 'resource-link']), autoRotate: z.boolean(),
  }).partial().strict();
  const resolver = createAccountResolver(ctx.db, ctx.urls.lti);
  const view = (account: ToolAccount) => ({ ...account, createdAt: new Date(account.createdAt).toISOString(),
    statusChangedAt: new Date(account.statusChangedAt).toISOString(), protocolUrls: resolver.protocolUrls(account) });

  app.get('/operator/v1/accounts', async (req) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) throw invalidAccount(parsed.error);
    const { status, cursor, limit } = parsed.data;
    const page = (await storeFor(ctx.db).accounts.listAccounts({ limit, ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) }));
    return { ...page, accounts: page.accounts.map(view) };
  });
  app.get<{ Params: { id: string } }>('/operator/v1/accounts/:id', async (req) => {
    const account = (await storeFor(ctx.db).accounts.getAccount(req.params.id));
    if (!account) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
    return (await view(account));
  });

  app.post('/operator/v1/accounts', async (req, reply) => {
    const id = z.object({ id: z.string().regex(ACCOUNT_ID) }).safeParse(req.body);
    const accountId = id.success ? id.data.id : null;
    return (await ctx.audited(req, { action: 'account.create', target: { type: 'account', id: accountId }, toolAccountId: accountId }, async (audit) => {
      const parsed = Create.safeParse(req.body);
      if (!parsed.success) throw invalidAccount(parsed.error);
      const input = parsed.data;
      if ((await storeFor(ctx.db).accounts.getAccount(input.id))) throw new ApiError('ACCOUNT_ALREADY_EXISTS');
      const key = await prepareToolKey(ctx.keys, input.id);
      const now = ctx.now();
      const account = (await audit.createAccount(input, key, now));
      ctx.logger.info('signing_key_changed', { tool_account_id: account.id, kid: key.kid, status: 'active' });
      return reply.code(201).send((await view(account)));
    }));
  });

  app.patch<{ Params: { id: string } }>('/operator/v1/accounts/:id', async (req) => {
    const parsed = Patch.safeParse(req.body);
    return (await ctx.audited(req, { action: 'account.update',
      target: { type: 'account', id: req.params.id }, toolAccountId: req.params.id,
      details: { fields: req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? Object.keys(req.body) : [] } }, async (audit) => {
      const writable = (await storeFor(ctx.db).accounts.requireWritableAccount(req.params.id));
      if (!parsed.success) throw invalidAccount(parsed.error);
      const { account, changedStatus } = (await audit.updateAccount(writable.id, parsed.data, ctx.now()));
      if (changedStatus) ctx.logger.info('account_status_changed', { tool_account_id: account.id, status: account.status, trace_id: req.traceId });
      return (await view(account));
    }));
  });
}
