import { invalidBindingBody, suspendBinding } from './common.ts';
import { disableConnection, getConnection } from '../../domain/connections.ts';
import { revokeOpenGrants } from '../../domain/bindings.ts';
import { transaction } from '../../domain/db.ts';
import { ApiError } from '../../app/api-errors.ts';
import type { AuthorityDeps, AuthorityStrategy } from './types.ts';

export function operatorGrantAuthority(deps: AuthorityDeps): AuthorityStrategy {
  const { db, now } = deps;
  return {
    async bind(c, adapter, body, { traceId }) {
      if (!deps.engine) throw new Error('operatorGrant bind needs the redemption engine');
      const parsed = adapter.parseBindingBody(body, { siteUrl: c.siteUrl, sharedClientId: adapter.sharingOf(c.profile) === 'shared' ? c.snapshot.clientId ?? c.platform?.clientId ?? null : null, purpose: 'initial' });
      if (!parsed.ok) return invalidBindingBody(parsed, deps.channels.textName(c.channel));
      return deps.engine.redeem({ libraryId: c.libraryId, connectionId: c.id, purpose: 'initial', values: parsed.values, traceId });
    },
    async disconnect(c, traceId) {
      transaction(db, () => { disableConnection(db, c.libraryId, c.id, now()); revokeOpenGrants(db, c.id, 'disconnect', now()); });
      const lines = deps.cleanup ? await deps.cleanup.fenceOut(getConnection(db, c.libraryId, c.id)!, traceId) : [];
      if (lines.some((l) => l.result === 'failed')) throw new ApiError('LTI_SERVICE_ERROR', `The LTI service did not switch off every record. The operator repairs it with app:binding suspend. Trace id: ${traceId}`);
    },
    suspend: (c, traceId) => suspendBinding(deps, c, traceId),
    release: (c, traceId) => {
      if (!deps.cleanup) throw new Error('release needs the binding cleanup engine');
      return deps.cleanup.release(c, traceId);
    },
  };
}
