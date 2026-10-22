// The common grant redemption engine (app contract §4.7.1, ADR-011 §4a). ONE engine for every binding: Canvas
// `PUT …/platform` (initial), Canvas `POST …/deployments` (add_deployment) and Blackboard `PUT …/platform` (initial).
//
//   phase 1 (one BEGIN IMMEDIATE transaction): grant, connection, snapshot, values, lease, reservation -> attempt + lease
//   S0 before EVERY LTI call: the lease holds this attempt with >= 6 s left (and, before V/S1-S3, grant and state)
//   V (Blackboard initial only): provider read, then cancellation-first readiness decision
//   S1 staged create (inactive, write-ahead ref c) | S2 read + adoption rule (A1-A3) | S3 conditional activation (ref a)
//   phase 2 (one BEGIN IMMEDIATE transaction): lease, grant, state, S3 ok -> approval + redeemed
//   otherwise: compensation (only our own activation ref, write-ahead ref x), cancel
//
// No database transaction is open during an LTI call; every call has the normal 5 s timeout of the outbound client.
// Authority comes ONLY from the approval that phase 2 writes (§6.1).
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger, PublicUrls } from '@cogniate/shared';
import type { LtiClient, LtiPlatform } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { Attempt, Grant } from '../domain/bindings.ts';
import {
  LEASE_MIN_REMAINING_MS, LEASE_MS, attemptsOfConnection, approvalOf, clearLease, endAttempt, getAttempt, getGrant, grantByCode, insertAttempt, leaseLive, markGrantRedeemed,
  recordRef, refRow, reservationOf, reservationOfConnection, setAttemptPlatform, setReservationRef, takeLease, writeApproval, writeReservation,
} from '../domain/bindings.ts';
import type { Connection, PlatformInfo } from '../domain/connections.ts';
import { setupOf } from '../kernel/setup.ts';
import { completeSnapshot, getConnection, getConnectionAnyLibrary } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { transaction } from '../domain/db.ts';
import type { BindingTarget, GrantPurpose, PlatformBodyValues, RedemptionRequest } from '../kernel/ports.ts';
import { ApiError, providerNotReady } from './api-errors.ts';
import type { LocalTarget, ReadinessCause } from './binding-targets.ts';
import { localTarget, s1ReadinessCause, sharedReadiness, stagedCall } from './binding-targets.ts';

export interface RedemptionEngine {
  /** Redeem a grant (or answer a finalized repeat). Throws the contract ApiError on any refusal. */
  redeem(request: RedemptionRequest): Promise<Connection>;
}

export interface RedemptionDeps {
  urls: PublicUrls;
  channels: ChannelRegistry;
  db: Db;
  lti: LtiClient;
  logger: Logger;
  now: () => number;
}

const startState = (purpose: GrantPurpose, c: Connection): boolean =>
  purpose === 'initial' ? c.status === 'pending' : c.status === 'registered' || c.status === 'connected';
const stateError = (purpose: GrantPurpose) => new ApiError(purpose === 'initial' ? 'CONNECTION_NOT_PENDING' : 'CONNECTION_NOT_READY');

type CancelReason = 'revoked' | 'replaced' | 'taken_over' | 'connection_changed';

/** A record that S2 read: its ref and whether it is active (Canvas initial: the platform; else the deployment row). */
interface ReadRecord { platformId: string; ref: string | null; active: boolean; platform: LtiPlatform }

class LtiFailure extends Error {
  readonly failure: unknown;
  constructor(failure: unknown) {
    super('lti failure');
    this.failure = failure;
  }
}

export function createRedemptionEngine(deps: RedemptionDeps): RedemptionEngine {
  const { db, lti, logger: log, now, channels } = deps;

  const reject = (reason: string, connectionId: string, traceId: string, err: ApiError): never => {
    log.warn('grant_rejected', { trace_id: traceId, reason, connection_id: connectionId });
    throw err;
  };
  const notReady = (c: Connection, cause: ReadinessCause, traceId: string): never => {
    log.warn('provider_not_ready', { trace_id: traceId, connection_id: c.id, profile: c.profile, cause });
    throw providerNotReady();
  };

  /** Finalized repeats (§4.4, §4.7.2): no grant check, no LTI call. */
  function finalizedRepeat(c: Connection, purpose: GrantPurpose, values: PlatformBodyValues): boolean {
    if (purpose === 'add_deployment') {
      return c.ltiPlatformId !== null && approvalOf(db, c.ltiPlatformId, values.deploymentId)?.connectionId === c.id;
    }
    const p = c.platform;
    return (c.status === 'registered' || c.status === 'connected') && p !== null && (attemptsOfConnection(db, c.id).some((a) => a.state === 'committed' && a.targetKind === 'shared_deployment') || p.clientId === values.clientId)
      && p.deploymentIds.includes(values.deploymentId);
  }

  /** Phase 1 (§4.7.1): checks 1 to 7 in order; on success the attempt, the lease and the Blackboard reservation. */
  function phase1(req: RedemptionRequest): { connection: Connection; attempt: Attempt; grant: Grant; resolved: LocalTarget } {
    return transaction(db, () => {
      const t = now();
      const connection = getConnection(db, req.libraryId, req.connectionId);
      if (!connection) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
      const invalid = (reason: string) => reject(reason, connection.id, req.traceId, new ApiError('GRANT_INVALID', 'This approval code is not valid, was used, or expired.'));
      // 1. form and hash
      const grant = grantByCode(db, req.values.grantCode);
      if (!grant) return invalid('not_found');
      // 2. revoked, redeemed, expired (expiry is checked here only)
      if (grant.revokedAt !== null) return invalid('revoked');
      if (grant.redeemedAt !== null) return invalid('redeemed');
      if (t >= grant.expiresAt) return invalid('expired');
      // 3. library, connection, purpose
      if (grant.libraryId !== req.libraryId) return invalid('other_library');
      if (grant.connectionId !== connection.id) return invalid('other_connection');
      if (grant.purpose !== req.purpose) return invalid('purpose');
      // 4. start state
      if (!startState(req.purpose, connection)) throw stateError(req.purpose);
      // 4a. Only initial needs a complete snapshot; old registered rows can add deployments without it.
      const adapter = setupOf(channels, connection.channel);
      const sharing = adapter?.sharingOf(connection.profile);
      const snapshot = req.purpose === 'initial' && sharing ? completeSnapshot(connection, sharing) : null;
      if (req.purpose === 'initial' && !snapshot) return notReady(connection, 'no_snapshot', req.traceId);
      const resolved = localTarget(connection, req.purpose, req.values, snapshot, adapter);
      // 5. values
      const target = resolved.target;
      if (grant.channel !== connection.channel || grant.profile !== connection.profile || grant.siteUrl !== connection.siteUrl || grant.serviceUrl !== connection.serviceUrl) {
        return reject('mismatch', connection.id, req.traceId, new ApiError('GRANT_MISMATCH', 'The values do not match the approval.', { details: { fields: ['connection'] } }));
      }
      const clientId = resolved.clientId;
      const fields = [...(grant.clientId !== clientId ? ['clientId'] : []), ...(grant.deploymentId !== req.values.deploymentId ? ['deploymentId'] : [])];
      if (fields.length > 0) return reject('mismatch', connection.id, req.traceId, new ApiError('GRANT_MISMATCH', 'The values do not match the approval.', { details: { fields } }));
      // 6. the connection lease (also for a replacement grant)
      if (leaseLive(connection, t)) throw new ApiError('GRANT_IN_USE', 'Cogniate is already saving this connection. Wait a moment, then reload the page.');
      // 7. Blackboard reservation: free, ours (retry) or of a disabled connection of the same library (move); one per connection.
      if (target.kind === 'shared_deployment') {
        const own = reservationOfConnection(db, connection.id);
        if (own && (own.platformId !== target.platformId || own.deploymentId !== target.deploymentId)) throw new ApiError('DEPLOYMENT_FIXED');
        const held = reservationOf(db, target.platformId, target.deploymentId);
        if (held && held.connectionId !== connection.id) {
          const holder = getConnectionAnyLibrary(db, held.connectionId);
          if (!(holder && holder.status === 'disabled' && holder.libraryId === connection.libraryId)) throw new ApiError('DEPLOYMENT_IN_USE');
        }
      }
      const attempt = insertAttempt(db, {
        connectionId: connection.id, grantId: grant.id, purpose: req.purpose, targetKind: target.kind,
        profile: connection.profile, issuer: resolved.issuer, clientId,
        deploymentId: req.values.deploymentId, platformId: target.kind === 'exclusive_platform' ? target.platformId : target.platformId,
      }, t);
      takeLease(db, connection.id, attempt.attemptId, connection.redeemingAttempt, t);
      if (target.kind === 'shared_deployment') {
        writeReservation(db, { platformId: target.platformId, deploymentId: target.deploymentId, connectionId: connection.id, libraryId: connection.libraryId, bindingRef: attempt.attemptId }, t);
      }
      return { connection, attempt, grant, resolved };
    });
  }

  return {
    async redeem(req) {
      const traceId = req.traceId;
      const connection = getConnection(db, req.libraryId, req.connectionId);
      if (!connection) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
      if (finalizedRepeat(connection, req.purpose, req.values)) return connection;
      const committed = phase1(req);
      const { attempt, grant, resolved } = committed;
      // A refusal or rollback must never produce this event. No LTI request has run yet.
      log.info('grant_attempt_started', { trace_id: traceId, grant_id: grant.id, connection_id: connection.id, attempt_id: attempt.attemptId, purpose: attempt.purpose });
      return runAttempt(committed.connection, attempt, grant, resolved, traceId);
    },
  };

  /** S0 (§4.7.1): one short transaction before every LTI call. */
  function s0(c: Connection, attempt: Attempt, grantId: string, kind: 'step' | 'compensate'): 'ok' | 'stop' | 'taken_over' | 'lease_lost' {
    return transaction(db, () => {
      const t = now();
      const fresh = getConnectionAnyLibrary(db, c.id)!;
      if (fresh.redeemingAttempt !== attempt.attemptId) return fresh.redeemingAttempt !== null ? 'taken_over' : 'lease_lost';
      if (fresh.redeemingSince === null || fresh.redeemingSince + LEASE_MS - t < LEASE_MIN_REMAINING_MS) return 'lease_lost';
      if (kind === 'step') {
        const g = getGrant(db, grantId)!;
        if (g.revokedAt !== null || !startState(attempt.purpose, fresh)) return 'stop';
      }
      return 'ok';
    });
  }

  async function runAttempt(c: Connection, attempt: Attempt, grant: Grant, resolved: LocalTarget, traceId: string): Promise<Connection> {
    const target = resolved.target;
    const create = stagedCall({ db, lti, urls: deps.urls }, c, target, traceId, setupOf(channels, c.channel)!);
    let platformId: string | null = target.kind === 'exclusive_platform' ? target.platformId : target.platformId;
    let activationRef: string | null = null; // ref `a` of a successful S3
    const fail = (err: unknown): never => {
      // LTI failure (§4.7.1): no more calls, lease cleared, attempt failed, 502; the grant stays unredeemed.
      transaction(db, () => { clearLease(db, c.id, attempt.attemptId); endAttempt(db, attempt.attemptId, 'failed', now()); });
      if (err instanceof LtiServiceError && err.code === 'INVALID_SITE_URL') throw new ApiError('INVALID_SITE_URL', 'The LTI service refused the site URL.');
      throw new ApiError('LTI_SERVICE_ERROR', `The LTI service answered ${err instanceof LtiServiceError ? `${err.status || 'nothing'} (${err.code})` : 'nothing'}. Trace id: ${traceId}`);
    };
    const leaseStop = (state: 'taken_over' | 'lease_lost'): never => {
      if (state === 'taken_over') {
        transaction(db, () => endAttempt(db, attempt.attemptId, 'cancelled', now()));
        log.warn('grant_redemption_cancelled', { trace_id: traceId, grant_id: grant.id, connection_id: c.id, reason: 'taken_over' });
        throw new ApiError('GRANT_INVALID', 'This approval code is not valid, was used, or expired.');
      }
      return fail(new Error('lease lost'));
    };
    const inUse = (): never => {
      transaction(db, () => { clearLease(db, c.id, attempt.attemptId); endAttempt(db, attempt.attemptId, 'cancelled', now()); });
      throw target.kind === 'shared_deployment'
        ? new ApiError('DEPLOYMENT_IN_USE')
        : new ApiError('PLATFORM_IN_USE', 'This Canvas developer key is already connected to Cogniate. Make a new developer key for this library, or ask your Cogniate operator.');
    };
    const call = async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        throw new LtiFailure(err);
      }
    };
    // Every V result, including failure, and each readiness answer of S1 passes this one ordered decision.
    const afterReadiness = (result: { kind: 'matched' } | { kind: 'failed'; error: unknown } | { kind: 'not_ready'; cause: ReadinessCause }): void => {
      const cancellation = transaction(db, (): CancelReason | null => {
        const fresh = getConnectionAnyLibrary(db, c.id)!;
        const g = getGrant(db, grant.id)!;
        let reason: CancelReason | null = null;
        if (fresh.redeemingAttempt !== attempt.attemptId) reason = 'taken_over';
        else if (!startState(attempt.purpose, fresh)) reason = 'connection_changed';
        else if (g.revokedAt !== null) reason = g.revokedReason === 'replaced' ? 'replaced' : 'revoked';
        if (reason !== null || result.kind !== 'matched') {
          if (reason !== 'taken_over') clearLease(db, c.id, attempt.attemptId);
          endAttempt(db, attempt.attemptId, reason === null ? 'failed' : 'cancelled', now());
        }
        return reason;
      });
      if (cancellation !== null) {
        log.warn('grant_redemption_cancelled', { trace_id: traceId, grant_id: grant.id, connection_id: c.id, reason: cancellation });
        if (cancellation === 'connection_changed') throw stateError(attempt.purpose);
        throw new ApiError('GRANT_INVALID', 'This approval code is not valid, was used, or expired.');
      }
      if (result.kind === 'not_ready') return notReady(c, result.cause, traceId);
      if (result.kind === 'failed') {
        const err = result.error;
        throw new ApiError('LTI_SERVICE_ERROR', `The LTI service answered ${err instanceof LtiServiceError ? `${err.status || 'nothing'} (${err.code})` : 'nothing'}. Trace id: ${traceId}`);
      }
    };

    try {
      let expected: string | null = null;
      let stop = false;
      // ---------------------------------------------------------------- V (Blackboard initial only)
      if (target.kind === 'shared_deployment' && attempt.purpose === 'initial') {
        const guard = s0(c, attempt, grant.id, 'step');
        if (guard === 'taken_over' || guard === 'lease_lost') return leaseStop(guard);
        if (guard === 'stop') stop = true;
        else {
          let result: Parameters<typeof afterReadiness>[0];
          try {
            const rows = await lti.getProviders(traceId, { singleAttempt: true });
            const cause = sharedReadiness(rows.find((p) => p.id === c.profile), completeSnapshot(c, 'shared')!);
            result = cause ? { kind: 'not_ready', cause } : { kind: 'matched' };
          } catch (error) {
            result = { kind: 'failed', error };
          }
          afterReadiness(result);
        }
      }
      // ---------------------------------------------------------------- S1 staged create
      const g1 = s0(c, attempt, grant.id, 'step');
      if (g1 === 'taken_over' || g1 === 'lease_lost') return leaseStop(g1);
      if (g1 === 'stop') stop = true;
      let goS2 = false;
      if (!stop) {
        const ref = recordRef(db, { connectionId: c.id, attemptId: attempt.attemptId, grantId: grant.id, action: 'create', platformId, deploymentId: attempt.deploymentId }, now());
        try {
          const created = await create(ref);
          platformId = created.platformId;
          setAttemptPlatform(db, attempt.attemptId, platformId);
          expected = ref;
        } catch (err) {
          const readinessCause = s1ReadinessCause(target, attempt.purpose, err);
          if (readinessCause) afterReadiness({ kind: 'not_ready', cause: readinessCause });
          else if (err instanceof LtiServiceError && err.status === 409 && (err.code === 'PLATFORM_ALREADY_EXISTS' || err.code === 'DEPLOYMENT_ALREADY_EXISTS')) goS2 = true;
          else return fail(err);
        }
      }
      // ---------------------------------------------------------------- S2 / S3 (at most two activations)
      for (let round = 0; !stop && round < 2; round += 1) {
        if (goS2 || round > 0) {
          const g2 = s0(c, attempt, grant.id, 'step');
          if (g2 === 'taken_over' || g2 === 'lease_lost') return leaseStop(g2);
          if (g2 === 'stop') { stop = true; break; }
          const rec = await call(() => readTarget(target, platformId, attempt, traceId));
          if (!rec && target.kind === 'exclusive_platform' && platformId === null) {
            // S1 conflicted, but the one qualified lookup found no adoptable record (including a standard
            // collision). Recheck local cancellation/lease state; never make an unqualified fallback call.
            const guard = s0(c, attempt, grant.id, 'step');
            if (guard === 'taken_over' || guard === 'lease_lost') return leaseStop(guard);
            if (guard === 'stop') { stop = true; break; }
            return inUse();
          }
          if (!rec) return fail(new Error('target vanished'));
          platformId = rec.platformId;
          setAttemptPlatform(db, attempt.attemptId, platformId);
          if (!adoptable(c, attempt, target, rec)) return inUse();
          expected = rec.ref;
        }
        const g3 = s0(c, attempt, grant.id, 'step');
        if (g3 === 'taken_over' || g3 === 'lease_lost') return leaseStop(g3);
        if (g3 === 'stop') { stop = true; break; }
        const a = recordRef(db, { connectionId: c.id, attemptId: attempt.attemptId, grantId: grant.id, action: 'activate', platformId, deploymentId: attempt.deploymentId }, now());
        try {
          await activate(target, platformId!, attempt.deploymentId, a, expected, traceId);
          activationRef = a;
          break;
        } catch (err) {
          if (err instanceof LtiServiceError && err.status === 409 && err.code === 'BINDING_REF_MISMATCH') {
            if (round === 1) {
              transaction(db, () => { clearLease(db, c.id, attempt.attemptId); endAttempt(db, attempt.attemptId, 'cancelled', now()); });
              throw new ApiError('GRANT_IN_USE', 'Cogniate is already saving this connection. Wait a moment, then reload the page.');
            }
            continue;
          }
          return fail(err);
        }
      }
      // ---------------------------------------------------------------- phase 2
      const outcome = phase2(c, attempt, grant, target, platformId, activationRef, resolved);
      if (outcome.ok) {
        log.info('grant_redeemed', { trace_id: traceId, grant_id: grant.id, connection_id: c.id, purpose: attempt.purpose, platform_id: platformId, deployment_id: attempt.deploymentId, attempt_id: attempt.attemptId });
        return outcome.connection;
      }
      if (activationRef !== null) await compensate(c, attempt, grant, target, platformId!, activationRef, traceId);
      transaction(db, () => { clearLease(db, c.id, attempt.attemptId); endAttempt(db, attempt.attemptId, 'cancelled', now()); });
      log.warn('grant_redemption_cancelled', { trace_id: traceId, grant_id: grant.id, connection_id: c.id, reason: outcome.reason });
      if (outcome.reason === 'connection_changed') throw stateError(attempt.purpose);
      throw new ApiError('GRANT_INVALID', 'This approval code is not valid, was used, or expired.');
    } catch (err) {
      if (err instanceof LtiFailure) return fail(err.failure);
      throw err;
    }
  }

  /** S2: read the remote record of the target. Null when it is absent. */
  async function readTarget(target: BindingTarget, platformId: string | null, attempt: Attempt, traceId: string): Promise<ReadRecord | null> {
    if (target.kind === 'exclusive_platform') {
      // The single target lookup of §4.7.1 Terms (issuer, client id, profile).
      const p = platformId
        ? await lti.getPlatform(platformId, traceId, { singleAttempt: true }).catch((err: unknown) => { if (err instanceof LtiServiceError && err.status === 404) return null; throw err; })
        : (await lti.findPlatforms({ url: target.issuer, clientId: target.clientId, profile: target.profile }, traceId, { singleAttempt: true }))[0] ?? null;
      return p ? { platformId: p.id, ref: p.bindingRef, active: p.active, platform: p } : null;
    }
    const p = await lti.getPlatform(target.platformId, traceId, { singleAttempt: true }).catch((err: unknown) => { if (err instanceof LtiServiceError && err.status === 404) return null; throw err; });
    const d = p?.deployments.find((x) => x.deploymentId === attempt.deploymentId);
    return p && d ? { platformId: p.id, ref: d.bindingRef, active: d.active, platform: p } : null;
  }

  /** The adoption rule (§4.7.1, rows A1 to A3) on exactly the grant values. */
  function adoptable(c: Connection, attempt: Attempt, target: BindingTarget, rec: ReadRecord): boolean {
    if (target.kind === 'exclusive_platform') {
      const p = rec.platform;
      const same = p.profile === target.profile && p.url === target.issuer && p.clientId === target.clientId && p.siteUrl === target.siteUrl
        && (p.serviceUrl ?? p.siteUrl) === target.serviceUrl && p.deployments.some((d) => d.deploymentId === target.deploymentId);
      if (!same) return false;
    }
    const row = refRow(db, rec.ref);
    // A1: the current ref was written by THIS attempt.
    if (row && row.attemptId === attempt.attemptId) return true;
    // The A2 / A3 condition.
    const condition = target.kind === 'exclusive_platform'
      ? db.prepare('SELECT 1 FROM connection WHERE lti_platform_id = ?').get(rec.platformId) === undefined
      : target.kind === 'platform_deployment'
        ? approvalOf(db, rec.platformId, attempt.deploymentId) === undefined
        : reservationOf(db, rec.platformId, attempt.deploymentId)?.connectionId === c.id;
    if (!condition) return false;
    // A2: an OLDER ref of this connection (committed at or before this attempt's phase 1).
    if (row && row.connectionId === c.id && row.seq <= attempt.historyFloor) return true;
    // A3: an inactive record with any other ref (or none).
    return !rec.active;
  }

  /** S3: the conditional activation (a new binding of a shared deployment sends its site URL). */
  async function activate(target: BindingTarget, platformId: string, deploymentId: string, ref: string, expected: string | null, traceId: string): Promise<void> {
    if (target.kind === 'exclusive_platform') {
      await lti.patchPlatform(platformId, { active: true, bindingRef: ref, ifBindingRef: expected }, traceId);
    } else {
      await lti.patchDeployment(platformId, deploymentId, {
        active: true, bindingRef: ref, ifBindingRef: expected, ...(target.kind === 'shared_deployment' ? { siteUrl: target.siteUrl } : {}),
      }, traceId);
    }
  }

  /** Phase 2 (§4.7.1). On success the approval and the connection change commit together. */
  function phase2(c: Connection, attempt: Attempt, grant: Grant, target: BindingTarget, platformId: string | null, activationRef: string | null, resolved: LocalTarget)
    : { ok: true; connection: Connection } | { ok: false; reason: CancelReason } {
    return transaction(db, () => {
      const t = now();
      const fresh = getConnectionAnyLibrary(db, c.id)!;
      const g = getGrant(db, grant.id)!;
      if (fresh.redeemingAttempt !== attempt.attemptId) return { ok: false, reason: 'taken_over' };
      if (!startState(attempt.purpose, fresh)) return { ok: false, reason: 'connection_changed' };
      if (g.revokedAt !== null || g.redeemedAt !== null) return { ok: false, reason: g.revokedReason === 'replaced' ? 'replaced' : 'revoked' };
      if (activationRef === null || platformId === null) return { ok: false, reason: 'revoked' };
      markGrantRedeemed(db, g.id, t);
      clearLease(db, c.id, attempt.attemptId);
      writeApproval(db, { platformId, deploymentId: attempt.deploymentId, connectionId: c.id, libraryId: c.libraryId, bindingRef: activationRef, grantId: g.id, approvedAt: t });
      if (target.kind === 'exclusive_platform') {
        const info: PlatformInfo = { id: platformId, issuer: target.issuer, clientId: target.clientId, deploymentIds: [attempt.deploymentId], productFamilyCode: resolved.productFamilyCode };
        db.prepare(`UPDATE connection SET status = 'registered', lti_platform_id = ?, lti_binding_ref = ?, platform_json = ?, ref_token_hash = NULL, ref_token_encrypted = NULL,
          ref_expires_at = NULL, last_error_code = NULL, last_error_lti_code = NULL, last_error_trace_id = NULL, last_error_at = NULL, updated_at = ? WHERE id = ?`)
          .run(platformId, activationRef, JSON.stringify(info), t, c.id);
      } else if (target.kind === 'shared_deployment') {
        setReservationRef(db, c.id, activationRef, t);
        const info: PlatformInfo = { id: platformId, issuer: attempt.issuer, clientId: attempt.clientId, deploymentIds: [attempt.deploymentId], productFamilyCode: resolved.productFamilyCode };
        db.prepare(`UPDATE connection SET status = 'registered', platform_json = ?, last_error_code = NULL, last_error_lti_code = NULL, last_error_trace_id = NULL,
          last_error_at = NULL, updated_at = ? WHERE id = ?`).run(JSON.stringify(info), t, c.id);
      } else {
        const info = fresh.platform;
        if (info && !info.deploymentIds.includes(attempt.deploymentId)) info.deploymentIds = [...info.deploymentIds, attempt.deploymentId];
        db.prepare('UPDATE connection SET platform_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(info), t, c.id);
      }
      endAttempt(db, attempt.attemptId, 'committed', t);
      return { ok: true, connection: getConnectionAnyLibrary(db, c.id)! };
    });
  }

  /** Compensation (§4.7.1): switch off only the record that still carries our activation ref, with a new ref. */
  async function compensate(c: Connection, attempt: Attempt, grant: Grant, target: BindingTarget, platformId: string, activationRef: string, traceId: string): Promise<void> {
    if (s0(c, attempt, grant.id, 'compensate') !== 'ok') return; // the cleanup owners handle the record
    const x = recordRef(db, { connectionId: c.id, attemptId: attempt.attemptId, grantId: grant.id, action: 'compensate', platformId, deploymentId: attempt.deploymentId }, now());
    const fields = { platform_id: platformId, deployment_id: attempt.deploymentId };
    try {
      if (target.kind === 'exclusive_platform') await lti.patchPlatform(platformId, { active: false, bindingRef: x, ifBindingRef: activationRef }, traceId);
      else await lti.patchDeployment(platformId, attempt.deploymentId, { active: false, bindingRef: x, ifBindingRef: activationRef }, traceId);
      log.warn('deployment_orphan_deactivated', { trace_id: traceId, ...fields });
    } catch (err) {
      // 409 or 404: another request changed the record after S3; nothing to switch off.
      if (err instanceof LtiServiceError && (err.status === 409 || err.status === 404)) return;
      const error = err instanceof LtiServiceError ? err.code : err instanceof Error ? err.name : 'Error';
      log.error('grant_compensation_failed', { trace_id: traceId, grant_id: grant.id, ...fields, error });
      log.error('deployment_orphan_deactivate_failed', { trace_id: traceId, ...fields, error });
    }
  }
}

/** Test seam: the attempt row (unit tests read attempt states). */
export const attemptOf = (db: Db, attemptId: string) => getAttempt(db, attemptId);
