// Signing-key lifecycle (LA-ADR-06 D7). Key generation and sealing finish before audit.change.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import { readSigningKeyPublishLeadSeconds } from '../../keys/key-config.ts';
import { requireWritableAccount } from '../../store/accounts.ts';
import type { SigningKeyRecord } from '../../store/tool-keys.ts';
import {
  activateToolKey, checkToolKeyActivation, checkToolKeyRemoval, createNextToolKey, listSigningKeys, prepareToolKey,
  removeToolKey, requireNextKeySlot, validatePublishLeadSeconds,
} from '../../store/tool-keys.ts';
import { invalid } from '../validation.ts';
import type { OperatorContext } from './index.ts';

const ActivateBody = z.object({ force: z.boolean().optional() });
const RetireBody = z.object({ immediate: z.literal(true) });
const iso = (ms: number | null): string | null => ms === null ? null : new Date(ms).toISOString();
const toApi = (key: SigningKeyRecord) => ({
  kid: key.kid, status: key.status, publishedAt: iso(key.publishedAt), activatedAt: iso(key.activatedAt),
  retiredAt: iso(key.retiredAt), removedAt: iso(key.removedAt),
});
const base = '/operator/v1/accounts/:id/signing-keys';
type AccountParams = { Params: { id: string } };
type KeyParams = { Params: { id: string; kid: string } };

export function registerSigningKeyRoutes(app: FastifyInstance, ctx: OperatorContext, opts: { publishLeadSeconds?: number } = {}): void {
  const publishLeadSeconds = opts.publishLeadSeconds === undefined
    ? readSigningKeyPublishLeadSeconds() : validatePublishLeadSeconds(opts.publishLeadSeconds);
  const log = (accountId: string, kid: string, status: string, traceId: string) =>
    ctx.logger.info('signing_key_changed', { tool_account_id: accountId, kid, status, trace_id: traceId });

  app.get<AccountParams>(base, async (req) => ({ signingKeys: listSigningKeys(ctx.db, req.params.id).map(toApi) }));

  app.post<AccountParams>(base, async (req, reply) => ctx.audited(req, {
    action: 'signing_key.create', toolAccountId: req.params.id, target: { type: 'signing_key', id: null },
  }, async (audit) => {
    requireWritableAccount(ctx.db, req.params.id);
    requireNextKeySlot(ctx.db, req.params.id);
    const prepared = await prepareToolKey(ctx.keys, req.params.id);
    // Another request can use the slot during the await. Refuse before audit.change (D4 T3).
    requireWritableAccount(ctx.db, req.params.id);
    requireNextKeySlot(ctx.db, req.params.id);
    const key = audit.change(() => {
      requireWritableAccount(ctx.db, req.params.id);
      return createNextToolKey(ctx.db, prepared, ctx.now());
    },
      (created) => ({ target: { type: 'signing_key', id: created.kid }, details: { status: created.status } }));
    log(req.params.id, key.kid, key.status, req.traceId);
    return reply.code(201).send({ kid: key.kid, status: key.status, publishedAt: iso(key.publishedAt) });
  }));

  app.post<KeyParams>(`${base}/:kid/activate`, async (req) => ctx.audited(req, {
    action: 'signing_key.activate', toolAccountId: req.params.id, target: { type: 'signing_key', id: req.params.kid },
  }, (audit) => {
    requireWritableAccount(ctx.db, req.params.id);
    const parsed = ActivateBody.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const force = parsed.data.force ?? false;
    const now = ctx.now();
    const options = { force, publishLeadSeconds };
    checkToolKeyActivation(ctx.db, req.params.id, req.params.kid, options, now);
    const key = audit.change(() => {
      requireWritableAccount(ctx.db, req.params.id);
      return activateToolKey(ctx.db, req.params.id, req.params.kid, options, now);
    },
      (activated) => ({ details: { forced: force, retired: activated.retired } }));
    if (key.retired !== null) log(req.params.id, key.retired, 'retired', req.traceId);
    log(req.params.id, key.kid, key.status, req.traceId);
    return { ...key, activatedAt: iso(key.activatedAt) };
  }));

  app.post<KeyParams>(`${base}/:kid/retire`, async (req) => ctx.audited(req, {
    action: 'signing_key.retire', toolAccountId: req.params.id, target: { type: 'signing_key', id: req.params.kid },
  }, (audit) => {
    const parsed = RetireBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError('INVALID_REQUEST',
        'retire needs {"immediate": true} (removes the key at once). A key becomes retired when the next key is activated.',
        { details: { field: 'immediate' } });
    }
    checkToolKeyRemoval(ctx.db, req.params.id, req.params.kid);
    const key = audit.change(() => removeToolKey(ctx.db, req.params.id, req.params.kid, ctx.now()));
    log(req.params.id, key.kid, key.status, req.traceId);
    return key;
  }));
}
