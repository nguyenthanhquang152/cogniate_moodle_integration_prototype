// LA-ADR-06 D6: status contains version ids and counts only. The shared runner owns the on-demand lease.
import type { FastifyInstance } from 'fastify';
import type { JobRunner } from '@cogniate/shared';
import { ApiError } from '../../api-errors.ts';
import { KEY_REWRAP_JOB, keyProviderStatus } from '../../jobs/key-rewrap.ts';
import type { OperatorContext } from './index.ts';

export function registerKeyProviderRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.get('/operator/v1/key-provider', async () => keyProviderStatus(ctx.db, ctx.keys));
  app.post('/operator/v1/key-provider/rewrap', async (req, reply) => ctx.audited(req, {
    action: 'key_provider.rewrap', target: { type: 'key_provider', id: null },
  }, (audit) => {
    const runner = ctx.jobs;
    if (!runner || runner.state() !== 'active') {
      throw new ApiError('NOT_READY', undefined, { details: { reasons: ['job_runner_not_active'], retryAfter: 30 } });
    }
    const requireFreeLease = () => {
      const held = ctx.db.prepare('SELECT 1 FROM job_lease WHERE name = ? AND owner IS NOT NULL AND lease_until > ?')
        .get(KEY_REWRAP_JOB, ctx.now());
      if (held) throw new ApiError('JOB_RUNNING');
    };
    requireFreeLease();
    // Record acceptance before starting work. An audit failure must not start a run.
    audit.change(requireFreeLease);
    // The additive runner option joins request and run traces. Older runners ignore it; the runbook also supports
    // finding the end event by action and since, so mixed-version deployments can still read the outcome.
    const trigger: { runNow(name: string, options?: { traceId: string }): ReturnType<JobRunner['runNow']> } = runner;
    void trigger.runNow(KEY_REWRAP_JOB, { traceId: req.traceId }).catch((err: unknown) => {
      ctx.logger.error('key_rewrap_failed', { trace_id: req.traceId, error: err instanceof Error ? err.name : 'Error' });
    });
    return reply.code(202).send({ job: KEY_REWRAP_JOB, traceId: req.traceId });
  }));
}
