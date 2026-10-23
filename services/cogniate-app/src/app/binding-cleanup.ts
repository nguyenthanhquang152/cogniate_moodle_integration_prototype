// The cleanup owners of app contract §4.7.1: the fence-out of a disconnect or `app:binding suspend` (§4.7.2, §4.9),
// the grant cleanup of `app:grant revoke` (§4.8) and `app:binding release` (§4.9). ONE engine with the redemption:
// every write is a compare-and-set on the ref that was read, with a new write-ahead ref; records are found through the
// saved attempt targets and the ref history, so a pending connection without a platform id is covered too.
import type { Logger } from '@cogniate/shared';
import type { LtiClient, LtiPlatform } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { Attempt, Grant } from '../domain/bindings.ts';
import {
  approvalOf, attemptsOfConnection, attemptsOfGrant, deleteApprovalsOfConnection, deleteReservationOfConnection, getAttempt, leaseLive,
  recordRef, refRow,
} from '../domain/bindings.ts';
import type { Connection } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { transaction } from '../domain/db.ts';

export type CleanupResult = 'fenced' | 'absent' | 'not_owned' | 'failed' | 'deleted' | 'kept_inactive';
/** A refused release: the binding is still active, or a redemption may still run (stable audit codes). */
export type ReleaseRefusal = 'binding_active' | 'redemption_running';

export interface CleanupLine {
  platformId: string | null;
  deploymentId: string | null;
  result: CleanupResult;
}

export interface CleanupDeps {
  db: Db;
  lti: LtiClient;
  logger: Logger;
  now: () => number;
}

/** A remote record: an exclusive platform (Canvas, Moodle) or one deployment of a platform (Blackboard, Canvas added). */
interface RecordKey {
  kind: 'platform' | 'deployment';
  platformId: string | null;
  deploymentId: string | null;
  /** Canvas initial target before its platform id is known (§4.7.1 Terms). */
  lookup?: { url: string; clientId: string; profile: string };
}

interface ReadState { platform: LtiPlatform; ref: string | null; active: boolean }

const keyOf = (r: RecordKey) => `${r.kind}|${r.platformId ?? ''}|${r.deploymentId ?? ''}|${r.lookup ? `${r.lookup.url}|${r.lookup.clientId}|${r.lookup.profile}` : ''}`;

function dedupe(list: RecordKey[]): RecordKey[] {
  const seen = new Map<string, RecordKey>();
  for (const r of list) if (!seen.has(keyOf(r))) seen.set(keyOf(r), r);
  return [...seen.values()];
}

/** Fence an added deployment through its exclusive platform, to stop all launches of the connection. */
function fenceRecordOf(a: Attempt): RecordKey {
  if (a.targetKind === 'shared_deployment') return { kind: 'deployment', platformId: a.platformId, deploymentId: a.deploymentId };
  if (a.platformId) return { kind: 'platform', platformId: a.platformId, deploymentId: null };
  return { kind: 'platform', platformId: null, deploymentId: null, lookup: { url: a.issuer, clientId: a.clientId, profile: a.profile } };
}

/** Revoke only the added deployment; the platform and its approved deployments belong to earlier grants. */
function revokeRecordOf(a: Attempt): RecordKey {
  return a.targetKind === 'platform_deployment'
    ? { kind: 'deployment', platformId: a.platformId, deploymentId: a.deploymentId }
    : fenceRecordOf(a);
}

/**
 * Committed platforms and reservations are attempt targets, including interrupted attempts.
 * The suspend tests in redemption.test.ts cover shared reservations and deduplicated initial/add platform targets.
 */
export function fenceRecords(db: Db, c: Connection): RecordKey[] {
  return dedupe(attemptsOfConnection(db, c.id).map(fenceRecordOf));
}

export function createBindingCleanup(deps: CleanupDeps) {
  const { db, lti, logger: log, now } = deps;

  async function readRecord(r: RecordKey, traceId: string): Promise<ReadState | null> {
    let platform: LtiPlatform | null;
    if (r.platformId) {
      try {
        platform = await lti.getPlatform(r.platformId, traceId);
      } catch (err) {
        if (err instanceof LtiServiceError && err.status === 404) return null;
        throw err;
      }
    } else {
      platform = r.lookup ? (await lti.findPlatforms(r.lookup, traceId))[0] ?? null : null;
    }
    if (!platform) return null;
    if (r.kind === 'platform') return { platform, ref: platform.bindingRef, active: platform.active };
    const d = platform.deployments.find((x) => x.deploymentId === r.deploymentId);
    return d ? { platform, ref: d.bindingRef, active: d.active } : null;
  }

  async function switchOff(r: RecordKey, platformId: string, ref: string, expected: string | null, traceId: string): Promise<void> {
    if (r.kind === 'platform') await lti.patchPlatform(platformId, { active: false, bindingRef: ref, ifBindingRef: expected }, traceId);
    else await lti.patchDeployment(platformId, r.deploymentId!, { active: false, bindingRef: ref, ifBindingRef: expected }, traceId);
  }

  const owned = (c: Connection, ref: string | null): boolean => refRow(db, ref)?.connectionId === c.id;

  /** Fence-out of one record (§4.7.2 steps 2 and 3): read, act only on an owned record, one retry after a mismatch. */
  async function fenceOne(c: Connection, r: RecordKey, traceId: string): Promise<CleanupLine> {
    let platformId = r.platformId;
    try {
      for (let round = 0; round < 2; round += 1) {
        const state = await readRecord(r, traceId);
        if (!state) return { platformId, deploymentId: r.deploymentId, result: 'absent' };
        platformId = state.platform.id;
        if (!owned(c, state.ref)) return { platformId, deploymentId: r.deploymentId, result: 'not_owned' };
        const s = recordRef(db, { connectionId: c.id, attemptId: null, grantId: null, action: 'fence_out', platformId, deploymentId: r.deploymentId }, now());
        try {
          await switchOff(r, platformId, s, state.ref, traceId);
          return { platformId, deploymentId: r.deploymentId, result: 'fenced' };
        } catch (err) {
          if (err instanceof LtiServiceError && err.status === 409 && err.code === 'BINDING_REF_MISMATCH') continue;
          if (err instanceof LtiServiceError && err.status === 404) return { platformId, deploymentId: r.deploymentId, result: 'absent' };
          throw err;
        }
      }
    } catch {
      return { platformId, deploymentId: r.deploymentId, result: 'failed' };
    }
    return { platformId, deploymentId: r.deploymentId, result: 'failed' };
  }

  /** Fence-out of a connection (DELETE and suspend). Moodle: platform `active: false`, unconditional (unchanged). */
  async function fenceOut(c: Connection, traceId: string): Promise<CleanupLine[]> {
    if (c.bindingAuthority === 'self') {
      if (!c.ltiPlatformId) return [];
      try {
        await lti.patchPlatform(c.ltiPlatformId, { active: false }, traceId);
        return [{ platformId: c.ltiPlatformId, deploymentId: null, result: 'fenced' }];
      } catch (err) {
        return [{ platformId: c.ltiPlatformId, deploymentId: null, result: err instanceof LtiServiceError && err.status === 404 ? 'absent' : 'failed' }];
      }
    }
    const lines: CleanupLine[] = [];
    for (const r of fenceRecords(db, c)) {
      const line = await fenceOne(c, r, traceId);
      lines.push(line);
      log.warn('binding_fenced', { trace_id: traceId, connection_id: c.id, platform_id: line.platformId, deployment_id: line.deploymentId, result: line.result });
    }
    return lines;
  }

  /**
   * Grant cleanup of `app:grant revoke` (§4.8): every distinct target of this grant's attempts whose current ref was
   * written by an attempt of THIS grant and that has no approval is switched off. Never an approved deployment or the
   * platform of a registered connection. Returns null when an attempt of the grant holds a live lease.
   */
  async function revokeCleanup(grant: Grant, c: Connection, traceId: string): Promise<CleanupLine[] | null> {
    const attempts = attemptsOfGrant(db, grant.id);
    if (leaseLive(c, now()) && attempts.some((a) => a.attemptId === c.redeemingAttempt)) return null;
    const targets = dedupe(attempts.map(revokeRecordOf));
    const lines: CleanupLine[] = [];
    for (const r of targets) {
      let line: CleanupLine;
      let platformId = r.platformId;
      try {
        const state = await readRecord(r, traceId);
        if (!state) line = { platformId, deploymentId: r.deploymentId, result: 'absent' };
        else {
          platformId = state.platform.id;
          const row = refRow(db, state.ref);
          const byThisGrant = row !== undefined && row.attemptId !== null && getAttempt(db, row.attemptId)?.grantId === grant.id;
          const deploymentId = r.deploymentId ?? grant.deploymentId;
          if (!byThisGrant || approvalOf(db, platformId, deploymentId)) line = { platformId, deploymentId: r.deploymentId, result: 'not_owned' };
          else {
            const s = recordRef(db, { connectionId: c.id, attemptId: null, grantId: grant.id, action: 'revoke_cleanup', platformId, deploymentId: r.deploymentId }, now());
            try {
              await switchOff(r, platformId, s, state.ref, traceId);
              line = { platformId, deploymentId: r.deploymentId, result: 'fenced' };
            } catch (err) {
              line = { platformId, deploymentId: r.deploymentId, result: err instanceof LtiServiceError && err.status === 409 ? 'not_owned' : 'failed' };
            }
          }
        }
      } catch {
        line = { platformId, deploymentId: r.deploymentId, result: 'failed' };
      }
      lines.push(line);
      log.warn('grant_cleanup', { trace_id: traceId, grant_id: grant.id, platform_id: line.platformId, deployment_id: line.deploymentId, result: line.result });
    }
    return lines;
  }

  /**
   * `app:binding release` (§4.9). Preconditions first (nothing changes on a failure): disabled, no live lease, and no
   * OWNED active record. Then per record: absent / not_owned / Moodle DELETE / Canvas conditional DELETE (`deleted`) /
   * Blackboard `kept_inactive`. Only when no line failed: delete ONLY this connection's reservation and approvals.
   */
  /**
   * `code` names a refusal (the binding or a redemption still runs); null is an LTI read failure, not a refusal.
   * `record` runs inside the transaction that deletes the local rows (the audit event of the command).
   */
  async function release(c: Connection, traceId: string, record?: () => void): Promise<{ ok: false; code: ReleaseRefusal | null; message: string } | { ok: true; lines: CleanupLine[]; failed: boolean }> {
    if (c.status !== 'disabled') return { ok: false, code: 'binding_active', message: 'binding still active; run suspend first' };
    if (leaseLive(c, now())) {
      const wait = Math.ceil((c.redeemingSince! + 60_000 - now()) / 1000);
      return { ok: false, code: 'redemption_running', message: `a redemption may still run; retry after ${wait} s` };
    }
    const records: RecordKey[] = c.bindingAuthority === 'self'
      ? (c.ltiPlatformId ? [{ kind: 'platform', platformId: c.ltiPlatformId, deploymentId: null }] : [])
      : fenceRecords(db, c);
    // A `self` connection owns its lti_platform_id (no refs).
    const isOwned = (s: ReadState) => (c.bindingAuthority === 'self' ? true : owned(c, s.ref));
    const reads = new Map<string, ReadState | null>();
    for (const r of records) {
      let s: ReadState | null;
      try {
        s = await readRecord(r, traceId);
      } catch {
        return { ok: false, code: null, message: 'the LTI service did not answer; run release again' };
      }
      if (s && isOwned(s) && s.active) return { ok: false, code: 'binding_active', message: 'binding still active; run suspend first' };
      reads.set(keyOf(r), s);
    }
    const lines: CleanupLine[] = [];
    for (const r of records) {
      const s = reads.get(keyOf(r)) ?? null;
      let line: CleanupLine;
      if (!s) line = { platformId: r.platformId, deploymentId: r.deploymentId, result: 'absent' };
      else if (!isOwned(s)) line = { platformId: s.platform.id, deploymentId: r.deploymentId, result: 'not_owned' };
      else if (r.kind === 'deployment') line = { platformId: s.platform.id, deploymentId: r.deploymentId, result: 'kept_inactive' };
      else line = await deleteOwned(c, r, s, traceId);
      lines.push(line);
      log.warn('binding_released', { trace_id: traceId, connection_id: c.id, platform_id: line.platformId, deployment_id: line.deploymentId, result: line.result });
    }
    const failed = lines.some((l) => l.result === 'failed');
    if (!failed) transaction(db, () => { deleteReservationOfConnection(db, c.id); deleteApprovalsOfConnection(db, c.id); record?.(); });
    return { ok: true, lines, failed };
  }

  /** Release of an owned inactive exclusive platform: Moodle unconditional, Canvas conditional on the read ref. */
  async function deleteOwned(c: Connection, r: RecordKey, s: ReadState, traceId: string): Promise<CleanupLine> {
    const platformId = s.platform.id;
    try {
      await lti.deletePlatform(platformId, c.bindingAuthority === 'self' ? null : s.ref, traceId);
      return { platformId, deploymentId: r.deploymentId, result: 'deleted' };
    } catch (err) {
      if (err instanceof LtiServiceError && err.status === 404) return { platformId, deploymentId: r.deploymentId, result: 'absent' };
      if (err instanceof LtiServiceError && err.status === 409 && err.code === 'BINDING_REF_MISMATCH') {
        try {
          const again = await readRecord(r, traceId);
          if (!again) return { platformId, deploymentId: r.deploymentId, result: 'absent' };
          if (!owned(c, again.ref)) return { platformId, deploymentId: r.deploymentId, result: 'not_owned' };
        } catch { /* failed below */ }
      }
      return { platformId, deploymentId: r.deploymentId, result: 'failed' };
    }
  }

  return { fenceOut, revokeCleanup, release };
}

export type BindingCleanup = ReturnType<typeof createBindingCleanup>;
