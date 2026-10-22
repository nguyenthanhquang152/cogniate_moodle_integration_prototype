import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createAccountResolver } from '../../accounts/resolver.ts';
import { AccountLimitsSchema, AccountStatusSchema, ClaimPolicySchema, toolUrlSchema } from '../../accounts/validation.ts';
import { ApiError } from '../../api-errors.ts';
import type { ToolAccount } from '../../store/accounts.ts';
import { ACCOUNT_ID, createAccount, getAccount, listAccounts, requireWritableAccount, updateAccount } from '../../store/accounts.ts';
import { createFirstToolKey, prepareToolKey } from '../../store/tool-keys.ts';
import { invalid } from '../validation.ts';
import type { OperatorContext } from './index.ts';

const ListQuery = z.object({
  status: AccountStatusSchema.optional(), cursor: z.string().regex(ACCOUNT_ID).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export function registerAccountRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  const toolUrl = toolUrlSchema(ctx.urls);
  const fields = {
    name: z.string().trim().min(1).max(255), launchUrl: toolUrl, deepLinkingUrl: toolUrl, registrationUrl: toolUrl,
    limits: AccountLimitsSchema.nullable().optional(), claimPolicy: ClaimPolicySchema.nullable().optional(),
    publicBaseUrl: z.null().optional(),
  };
  const Create = z.object({ id: z.string().regex(ACCOUNT_ID), ...fields }).strict();
  const Patch = z.object({ ...fields, status: AccountStatusSchema, serviceKeyWriteScope: z.enum(['context', 'resource-link']) }).partial().strict();
  const resolver = createAccountResolver(ctx.db, ctx.urls.lti);
  const view = (account: ToolAccount) => ({ ...account, createdAt: new Date(account.createdAt).toISOString(),
    statusChangedAt: new Date(account.statusChangedAt).toISOString(), protocolUrls: resolver.protocolUrls(account) });

  app.get('/operator/v1/accounts', async (req) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) throw invalid(parsed.error);
    const { status, cursor, limit } = parsed.data;
    const page = listAccounts(ctx.db, { limit, ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) });
    return { ...page, accounts: page.accounts.map(view) };
  });
  app.get<{ Params: { id: string } }>('/operator/v1/accounts/:id', async (req) => {
    const account = getAccount(ctx.db, req.params.id);
    if (!account) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
    return view(account);
  });

  app.post('/operator/v1/accounts', async (req, reply) => {
    const id = z.object({ id: z.string().regex(ACCOUNT_ID) }).safeParse(req.body);
    const accountId = id.success ? id.data.id : null;
    return ctx.audited(req, { action: 'account.create', target: { type: 'account', id: accountId }, toolAccountId: accountId }, async (audit) => {
      const parsed = Create.safeParse(req.body);
      if (!parsed.success) throw invalid(parsed.error);
      const input = parsed.data;
      if (getAccount(ctx.db, input.id)) throw new ApiError('ACCOUNT_ALREADY_EXISTS');
      const key = await prepareToolKey(ctx.keys, input.id);
      const now = ctx.now();
      const account = audit.change(() => {
        // The store repeats the id check after async preparation, while this transaction owns the writer lock.
        const created = createAccount(ctx.db, input, now);
        createFirstToolKey(ctx.db, key, now);
        return created;
      }, () => ({ details: { fields: Object.keys(input), kid: key.kid } }));
      return reply.code(201).send(view(account));
    });
  });

  app.patch<{ Params: { id: string } }>('/operator/v1/accounts/:id', async (req) => {
    const current = getAccount(ctx.db, req.params.id);
    const parsed = Patch.safeParse(req.body);
    const changedStatus = parsed.success && parsed.data.status !== undefined && parsed.data.status !== current?.status;
    return ctx.audited(req, { action: changedStatus ? 'account.status' : 'account.update',
      target: { type: 'account', id: req.params.id }, toolAccountId: req.params.id }, (audit) => {
      const writable = requireWritableAccount(ctx.db, req.params.id);
      if (!parsed.success) throw invalid(parsed.error);
      const account = audit.change(() => updateAccount(ctx.db, writable.id, parsed.data, ctx.now()), () => ({
        details: { fields: Object.keys(parsed.data), ...(changedStatus ? { status: parsed.data.status } : {}) },
      }));
      if (changedStatus) ctx.logger.info('account_status_changed', { tool_account_id: account.id, status: account.status, trace_id: req.traceId });
      return view(account);
    });
  });
}
