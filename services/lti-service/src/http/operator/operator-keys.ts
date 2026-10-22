// Operator keys (contract delta §3 "Operators"): list, issue (the key is shown once), revoke. `lti:operator init`
// makes the first key (cli/operator.ts); every other operator-key change goes through these routes.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import type { OperatorKeyRecord } from '../../store/operator-keys.ts';
import {
  OPERATOR_KEY_DEFAULT_TTL_MS, OPERATOR_NAME, getOperatorKey, issueOperatorKey, listOperatorKeys, operatorKeyExpiryInRange, revokeOperatorKey,
} from '../../store/operator-keys.ts';
import { invalid } from '../validation.ts';
import type { OperatorContext } from './index.ts';

const IssueBody = z.object({
  operator: z.string().regex(OPERATOR_NAME),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

/** The public view of a key: never the key or its hash. */
const toApi = (k: OperatorKeyRecord) => ({
  id: k.id, operator: k.operator, createdAt: iso(k.createdAt), expiresAt: iso(k.expiresAt), lastUsedAt: iso(k.lastUsedAt), revokedAt: iso(k.revokedAt),
});

export function registerOperatorKeyRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.get('/operator/v1/operator-keys', async () => ({ operatorKeys: listOperatorKeys(ctx.db).map(toApi) }));

  app.post('/operator/v1/operator-keys', async (req, reply) => ctx.audited(req, { action: 'operator_key.issue', target: { type: 'operator_key', id: null } }, (audit) => {
    const parsed = IssueBody.safeParse(req.body ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const now = ctx.now();
    const expiresAt = parsed.data.expiresAt === undefined ? now + OPERATOR_KEY_DEFAULT_TTL_MS : Date.parse(parsed.data.expiresAt);
    if (!operatorKeyExpiryInRange(expiresAt, now)) {
      throw new ApiError('INVALID_REQUEST', 'Invalid field: expiresAt. It must be 1 hour to 1 year from now.');
    }
    // The event names the new key and its operator, never the key.
    const { record, operatorKey } = audit.change(() => issueOperatorKey(ctx.db, { operator: parsed.data.operator, expiresAt }, now),
      (issued) => ({ target: { type: 'operator_key', id: issued.record.id }, details: { operator: issued.record.operator, expiresAt: iso(issued.record.expiresAt) } }));
    return reply.code(201).send({ id: record.id, operatorKey, operator: record.operator, expiresAt: iso(record.expiresAt) });
  }));

  app.post<{ Params: { id: string } }>('/operator/v1/operator-keys/:id/revoke', async (req) =>
    ctx.audited(req, { action: 'operator_key.revoke', target: { type: 'operator_key', id: req.params.id } }, (audit) => {
      if (req.params.id === ctx.operator(req).keyId) throw new ApiError('OPERATOR_KEY_IN_USE');
      if (!getOperatorKey(ctx.db, req.params.id)) throw new ApiError('NOT_FOUND', 'Unknown operator key.');
      return toApi(audit.change(() => revokeOperatorKey(ctx.db, req.params.id, ctx.now())!, (revoked) => ({ details: { operator: revoked.operator } })));
    }));
}
