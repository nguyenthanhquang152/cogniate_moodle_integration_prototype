import { randomId } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import type { AuditTarget } from './audit.ts';

export const IDEMPOTENCY_TTL_MS = 24 * 3600_000;
export const IDEMPOTENCY_RUNNING_MS = 60_000;
export interface RequestFingerprint {
  toolAccountId: string;
  key: string;
  method: string;
  route: string;
  /**
   * Canonical JSON of the resolved target (BD-A2-56), in column `params`. Bearer routes: the decoded path parameters.
   * Line items: the credential's `{ platformId, deploymentId, contextId, lineItemsUrl }`.
   */
  params: string;
  bodyHash: string;
}
export interface IdempotencyClaim { toolAccountId: string; key: string; owner: string }
export interface StoredAnswer {
  status: number;
  /** The serialized response, without request headers or credentials. */
  body: string;
  target: AuditTarget | null;
  code: string | null;
}
/** `running.endsAt`: the time when the running claim stops blocking the key (BD-A2-58 `retryAfter`). */
export type ClaimResult = { kind: 'claimed'; claim: IdempotencyClaim } | { kind: 'replay'; answer: StoredAnswer }
  | { kind: 'reused' } | { kind: 'running'; endsAt: number };
interface Row {
  method: string; route: string; params: string; body_hash: string; state: 'running' | 'completed';
  status: number; body: string; target_type: string | null; target_id: string | null; code: string | null; created_at: number;
}

/** BD-A2-57: a final answer is a 2xx, or a 4xx other than 429. Only a final answer is stored and replayed. */
export function isFinalStatus(status: number): boolean {
  return (status >= 200 && status < 300) || (status >= 400 && status < 500 && status !== 429);
}

/** One synchronous transaction arbitrates competing requests, including requests on separate connections. */
export function claimIdempotency(db: Db, input: RequestFingerprint, now: number): ClaimResult {
  return transaction(db, () => {
    const row = db.prepare('SELECT * FROM idempotency_record WHERE tool_account_id = ? AND key = ?')
      .get(input.toolAccountId, input.key) as Row | undefined;
    const age = row ? now - row.created_at : Infinity;
    const valid = row?.state === 'running' ? age <= IDEMPOTENCY_RUNNING_MS : age < IDEMPOTENCY_TTL_MS;
    if (row && valid) {
      if (row.method !== input.method || row.route !== input.route || row.params !== input.params || row.body_hash !== input.bodyHash) return { kind: 'reused' };
      if (row.state === 'running') return { kind: 'running', endsAt: row.created_at + IDEMPOTENCY_RUNNING_MS };
      return { kind: 'replay', answer: {
        status: row.status, body: row.body, target: row.target_type === null ? null : { type: row.target_type, id: row.target_id }, code: row.code,
      } };
    }
    const claim = { toolAccountId: input.toolAccountId, key: input.key, owner: randomId('idem_') };
    // Expired records are replaced here; deleting unrelated old rows is the later cleanup job's work.
    db.prepare(`INSERT INTO idempotency_record (tool_account_id, key, method, route, params, body_hash, owner, state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)
      ON CONFLICT (tool_account_id, key) DO UPDATE SET method = excluded.method, route = excluded.route,
        params = excluded.params, body_hash = excluded.body_hash, owner = excluded.owner, state = 'running',
        status = NULL, body = NULL, target_type = NULL, target_id = NULL, code = NULL, created_at = excluded.created_at`)
      .run(input.toolAccountId, input.key, input.method, input.route, input.params, input.bodyHash, claim.owner, now);
    return { kind: 'claimed', claim };
  });
}

/** The owner check prevents a slow, abandoned request from overwriting its successor. */
export function completeIdempotency(db: Db, claim: IdempotencyClaim, answer: StoredAnswer): boolean {
  if (!isFinalStatus(answer.status)) throw new RangeError('Only final answers (2xx, or 4xx other than 429) can be stored for idempotency');
  return db.prepare(`UPDATE idempotency_record SET state = 'completed', status = ?, body = ?, target_type = ?, target_id = ?, code = ?
    WHERE tool_account_id = ? AND key = ? AND owner = ? AND state = 'running'`)
    .run(answer.status, answer.body, answer.target?.type ?? null, answer.target?.id ?? null, answer.code,
      claim.toolAccountId, claim.key, claim.owner).changes > 0;
}

/** A request without a final answer frees its own claim only. Its retry must not replay a 5xx or a 429. */
export function abandonIdempotency(db: Db, claim: IdempotencyClaim): void {
  db.prepare("DELETE FROM idempotency_record WHERE tool_account_id = ? AND key = ? AND owner = ? AND state = 'running'")
    .run(claim.toolAccountId, claim.key, claim.owner);
}
