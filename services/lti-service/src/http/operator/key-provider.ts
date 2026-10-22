// LA-ADR-06 D6: status contains version ids and counts only. The shared runner owns the on-demand lease.
import type { FastifyInstance } from 'fastify';
import { KEY_REWRAP_JOB, keyProviderStatus } from '../../jobs/key-rewrap.ts';
import type { OperatorContext } from './index.ts';

export function registerKeyProviderRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.get('/operator/v1/key-provider', async () => keyProviderStatus(ctx.db, ctx.keys));
  app.post('/operator/v1/key-provider/rewrap', async (req, reply) => ctx.audited(req, {
    action: 'key_provider.rewrap', target: { type: 'key_provider', id: null },
  }, (audit) => {
    const runner = ctx.jobs;
    if (!runner) throw new Error('Key re-wrap requires the LTI job runner.');
    // Record acceptance before starting work. An audit failure must not start a run.
    audit.change(() => undefined);
    void runner.runNow(KEY_REWRAP_JOB).catch((err: unknown) => {
      ctx.logger.error('key_rewrap_failed', { trace_id: req.traceId, error: err instanceof Error ? err.name : 'Error' });
    });
    return reply.code(202).send({ job: KEY_REWRAP_JOB, traceId: req.traceId });
  }));
}
