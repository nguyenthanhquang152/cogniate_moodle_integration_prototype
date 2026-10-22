// API-key issue and revoke (LA-ADR-06 D5). The operator gets each secret once; list and audit contain metadata only.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import { requireWritableAccount } from '../../store/accounts.ts';
import type { ApiKeyRecord } from '../../store/api-keys.ts';
import { getApiKey, issueApiKey, listApiKeys, requireApiKeyAccount, requireApiKeySlot, revokeApiKey, validateApiKeyIssue } from '../../store/api-keys.ts';
import { invalid } from '../validation.ts';
import type { OperatorContext } from './index.ts';

const IssueBody = z.object({
  label: z.string().min(1).max(128),
  scopes: z.array(z.enum(['launch', 'admin'])).min(1).max(2),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});
const iso = (ms: number | null): string | null => ms === null ? null : new Date(ms).toISOString();
const toApi = (key: ApiKeyRecord) => ({
  id: key.id, prefix: key.prefix, label: key.label, scopes: key.scopes, createdAt: iso(key.createdAt), createdBy: key.createdBy,
  expiresAt: iso(key.expiresAt), lastUsedAt: iso(key.lastUsedAt), revokedAt: iso(key.revokedAt),
});
const base = '/operator/v1/accounts/:id/api-keys';

export function registerApiKeyRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.get<{ Params: { id: string } }>(base, async (req) => ({ apiKeys: listApiKeys(ctx.db, req.params.id).map(toApi) }));

  app.post<{ Params: { id: string } }>(base, async (req, reply) => ctx.audited(req, {
    action: 'api_key.issue', toolAccountId: req.params.id, target: { type: 'api_key', id: null },
  }, (audit) => {
    requireWritableAccount(ctx.db, req.params.id);
    const parsed = IssueBody.safeParse(req.body);
    if (!parsed.success) throw invalid(parsed.error);
    const now = ctx.now();
    const input = { label: parsed.data.label, scopes: parsed.data.scopes, createdBy: `operator:${ctx.operator(req).operator}`,
      expiresAt: parsed.data.expiresAt === undefined ? null : Date.parse(parsed.data.expiresAt) };
    validateApiKeyIssue(input, now);
    requireApiKeySlot(ctx.db, req.params.id, now);
    const { record, apiKey } = audit.change(() => {
      requireWritableAccount(ctx.db, req.params.id);
      return issueApiKey(ctx.db, req.params.id, input, now);
    },
      (issued) => ({ target: { type: 'api_key', id: issued.record.id }, details: { label: issued.record.label, scopes: issued.record.scopes, expiresAt: iso(issued.record.expiresAt) } }));
    ctx.logger.info('api_key_issued', { tool_account_id: req.params.id, api_key_id: record.id });
    return reply.code(201).send({ id: record.id, apiKey, prefix: record.prefix, label: record.label, scopes: record.scopes, expiresAt: iso(record.expiresAt) });
  }));

  app.post<{ Params: { id: string; keyId: string } }>(`${base}/:keyId/revoke`, async (req) => ctx.audited(req, {
    action: 'api_key.revoke', toolAccountId: req.params.id, target: { type: 'api_key', id: req.params.keyId },
  }, (audit) => {
    requireApiKeyAccount(ctx.db, req.params.id);
    if (!getApiKey(ctx.db, req.params.id, req.params.keyId)) throw new ApiError('NOT_FOUND', 'Unknown API key.');
    const key = audit.change(() => revokeApiKey(ctx.db, req.params.id, req.params.keyId, ctx.now())!);
    ctx.logger.info('api_key_revoked', { tool_account_id: req.params.id, api_key_id: key.id });
    return toApi(key);
  }));
}
