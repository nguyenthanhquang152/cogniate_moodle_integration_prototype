// LA-ADR-06 D7: run at start, then daily. LA-E5-19 registers this module with the shared job runner.
import type { IntervalJob } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { RETIRED_KEEP_MS } from '../store/tool-keys.ts';

export function signingKeyCleanupJob(db: Db): IntervalJob {
  return {
    name: 'signing-key-cleanup', everyMs: 24 * 3600 * 1000, runAtStart: true,
    async run(ctx) {
      const now = ctx.now();
      const { removed, cleared } = transaction(db, () => {
        const removed = db.prepare(`UPDATE tool_key SET status = 'removed', removed_at = ?
          WHERE status = 'retired' AND retired_at <= ? RETURNING kid, tool_account_id`)
          .all(now, now - RETIRED_KEEP_MS) as Array<{ kid: string; tool_account_id: string }>;
        // Also clear old rows that migration 009 marked removed. Keep their original removed_at.
        const cleared = Number(db.prepare("UPDATE tool_key SET private_jwk_encrypted = X'' WHERE status = 'removed' AND length(private_jwk_encrypted) > 0").run().changes);
        return { removed, cleared };
      });
      for (const key of removed) ctx.logger.info('signing_key_changed', { ...key, status: 'removed' });
      return { result: 'ok', counts: { removed: removed.length, cleared } };
    },
  };
}
