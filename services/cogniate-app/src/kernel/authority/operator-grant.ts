import { invalidBindingBody, suspendBinding } from './common.ts';
import { disableConnection, getConnection } from '../../domain/connections.ts';
import { revokeOpenGrants } from '../../domain/bindings.ts';
import { transaction } from '../../domain/db.ts';
import { ApiError } from '../../app/api-errors.ts';
import { stagedRegistration } from '../../app/binding-targets.ts';
import { GRANT_CODE, PRINTABLE_ID } from '@cogniate/channel-kernel/setup';
import type { PlatformBodyResult } from '../ports.ts';
import type { AuthorityDeps, AuthorityStrategy } from './types.ts';

const STAGED_KEYS = ['clientId', 'deploymentId', 'grantCode'] as const;

/**
 * The strict body after a staged Dynamic Registration (app API delta §3.4): `{ clientId, deploymentId, grantCode }`.
 * The admin values come from the grant's bound values, which the operator took from the staged platform.
 */
function parseStagedBody(body: unknown): PlatformBodyResult {
  if (body !== null && body !== undefined && (typeof body !== 'object' || Array.isArray(body))) return { ok: false, fields: ['body'] };
  const sent = (body ?? {}) as Record<string, unknown>;
  const bad: string[] = [];
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(sent)) {
    const v = typeof raw === 'string' ? raw.trim() : null;
    if (!(STAGED_KEYS as readonly string[]).includes(key) || v === null || !(key === 'grantCode' ? GRANT_CODE : PRINTABLE_ID).test(v)) bad.push(key);
    else values[key] = v;
  }
  for (const key of STAGED_KEYS) if (!(key in sent)) bad.push(key);
  return bad.length > 0 ? { ok: false, fields: bad } : { ok: true, values: { clientId: values.clientId!, deploymentId: values.deploymentId!, grantCode: values.grantCode! } };
}

export function operatorGrantAuthority(deps: AuthorityDeps): AuthorityStrategy {
  const { db, now } = deps;
  return {
    async bind(c, adapter, body, { traceId }) {
      if (!deps.engine) throw new Error('operatorGrant bind needs the redemption engine');
      const parsed = stagedRegistration(c)
        ? parseStagedBody(body)
        : adapter.parseBindingBody(body, { siteUrl: c.siteUrl, sharedClientId: adapter.sharingOf(c.profile) === 'shared' ? c.snapshot.clientId ?? c.platform?.clientId ?? null : null, purpose: 'initial' });
      if (!parsed.ok) return invalidBindingBody(parsed, deps.channels.textName(c.channel));
      return deps.engine.redeem({ libraryId: c.libraryId, connectionId: c.id, purpose: 'initial', values: parsed.values, traceId });
    },
    async disconnect(c, traceId) {
      transaction(db, () => { disableConnection(db, c.libraryId, c.id, now()); revokeOpenGrants(db, c.id, 'disconnect', now()); });
      const lines = deps.cleanup ? await deps.cleanup.fenceOut(getConnection(db, c.libraryId, c.id)!, traceId) : [];
      if (lines.some((l) => l.result === 'failed')) throw new ApiError('LTI_SERVICE_ERROR', `The LTI service did not switch off every record. The operator repairs it with app:binding suspend. Trace id: ${traceId}`);
    },
    suspend: (c, traceId, record) => suspendBinding(deps, c, traceId, record),
    release: (c, traceId, record) => {
      if (!deps.cleanup) throw new Error('release needs the binding cleanup engine');
      return deps.cleanup.release(c, traceId, record);
    },
  };
}
