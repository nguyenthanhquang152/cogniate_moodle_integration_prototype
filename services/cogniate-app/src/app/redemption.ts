// The common grant redemption engine (app contract §4.7.1, ADR-011 §4a): phase 1, the connection lease, the
// write-ahead ref history, staged creates, the adoption rule, the conditional activation, phase 2 and the
// compensation. Used by Canvas and Blackboard `PUT …/platform` and by Canvas `POST …/deployments`.
import type { Connection } from '../domain/connections.ts';
import type { RedemptionRequest } from '../providers/types.ts';
import { ApiError } from './api-errors.ts';

export interface RedemptionEngine {
  /** Redeem a grant (or answer a finalized repeat). Throws the contract ApiError on any refusal. */
  redeem(request: RedemptionRequest): Promise<Connection>;
}

/** FOUNDATION CHECKPOINT: the engine is not implemented yet; every redemption is refused. */
export function createRedemptionEngine(): RedemptionEngine {
  return {
    async redeem() {
      throw new ApiError('INTERNAL_ERROR', 'Grant redemption is not available yet.');
    },
  };
}
