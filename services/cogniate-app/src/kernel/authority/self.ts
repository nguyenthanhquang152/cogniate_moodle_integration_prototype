import { LEGACY_SELF_BINDING_TEXT } from '@cogniate/channel-kernel';
import type { LtiPlatform } from '../../clients/lti-client.ts';
import { LtiServiceError } from '../../clients/lti-client.ts';
import { PlatformTakenError, disableConnection, getConnection, markRegistered } from '../../domain/connections.ts';
import { ApiError } from '../../app/api-errors.ts';
import { deactivateOrphan, invalidBindingBody, ltiFailure, platformInfo, suspendBinding } from './common.ts';
import type { AuthorityDeps, AuthorityStrategy } from './types.ts';

export function selfAuthority(deps: AuthorityDeps): AuthorityStrategy {
  const { db, lti, logger, now } = deps;
  return {
    async bind(c, adapter, body, ctx) {
      const { traceId } = ctx;
      if (c.method !== 'manual') throw new ApiError('CONNECTION_NOT_PENDING', 'Only a pending manual connection takes platform values.');
      const parsed = adapter.parseBindingBody(body, { siteUrl: c.siteUrl, sharedClientId: null, purpose: 'initial' });
      if (!parsed.ok) return invalidBindingBody(parsed, deps.channels.textName(c.channel));
      if (!adapter.selfCreate || !parsed.values.adminValues) throw new ApiError('CAPABILITY_NOT_SUPPORTED');
      const v = { ...parsed.values.adminValues, clientId: parsed.values.clientId, deploymentId: parsed.values.deploymentId };
      if (c.status !== 'pending') {
        // A repeat of the call that registered this connection: 200 with its own platform, nothing changes (AC-T4-36 (3)).
        const own = c.platform;
        const repeat = c.status !== 'disabled' && own !== null && own.issuer === v.issuer && own.clientId === v.clientId && own.deploymentIds.includes(v.deploymentId);
        if (repeat) return c;
        throw new ApiError('CONNECTION_NOT_PENDING', 'This connection already has a platform.');
      }
      let platform: LtiPlatform;
      try {
        const staged = adapter.selfCreate(v, ctx);
        if (staged.kind !== 'platform' || !('authConfig' in staged.body)) throw new Error('self authority needs an admin-value platform');
        platform = await lti.createPlatform(staged.body, traceId);
      } catch (err) {
        // An existing platform (the dev seed, another library's tool, an orphan) is never adopted (security §2.6).
        if (err instanceof LtiServiceError && err.code === 'PLATFORM_ALREADY_EXISTS') {
          throw new ApiError('PLATFORM_IN_USE', LEGACY_SELF_BINDING_TEXT.collision);
        }
        // M1: a hosted LMS issuer cannot be a Moodle platform (LTI contract §9.2 ISSUER_RESERVED).
        if (err instanceof LtiServiceError && err.code === 'ISSUER_RESERVED') {
          throw new ApiError('INVALID_PLATFORM_VALUES', LEGACY_SELF_BINDING_TEXT.reserved, { details: { fields: ['issuer'] } });
        }
        // A 4xx that the user can fix becomes the app's own 422 (app contract §1).
        if (err instanceof LtiServiceError && (err.code === 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN' || err.code === 'INVALID_REQUEST')) {
          throw new ApiError('INVALID_PLATFORM_VALUES', err.description || 'The LTI service did not accept these values.', { details: { fields: [] } });
        }
        return ltiFailure(err, traceId);
      }
      try {
        markRegistered(db, c.id, platformInfo(platform), now());
      } catch (err) {
        if (!(err instanceof PlatformTakenError)) throw err;
        // The connection changed while the platform was made (for example a second PUT): the new platform is an orphan.
        await deactivateOrphan({ db, lti, logger }, platform.id, traceId);
        throw new ApiError('CONNECTION_NOT_PENDING', 'This connection already has a platform.');
      }
      return getConnection(db, c.libraryId, c.id)!;
    },
    async disconnect(c, traceId) {
      if (c.ltiPlatformId) await lti.patchPlatform(c.ltiPlatformId, { active: false }, traceId).catch((err: unknown) => ltiFailure(err, traceId));
      disableConnection(db, c.libraryId, c.id, now());
    },
    suspend: (c, traceId) => suspendBinding(deps, c, traceId),
    release: (c, traceId) => {
      if (!deps.cleanup) throw new Error('release needs the binding cleanup engine');
      return deps.cleanup.release(c, traceId);
    },
  };
}
