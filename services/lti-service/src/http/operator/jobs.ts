// LA-E5-20 (LA-ADR-06 D11 "On-demand runs", BD-A2-69): list the jobs of the runner and start one on demand. The
// answers follow the re-wrap route (BD-A2-50): 503 with no event when the runner is not active; else one job.run event.
import type { FastifyInstance } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import { createLtiJobStore } from '../../jobs/index.ts';
import type { OperatorContext } from './index.ts';

const iso = (ms: number | null | undefined): string | null => (ms === null || ms === undefined ? null : new Date(ms).toISOString());

export function registerJobRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  const store = createLtiJobStore(ctx.db);
  app.get('/operator/v1/jobs', async () => ({
    jobs: await Promise.all((ctx.jobs?.jobs ?? []).map(async ({ name, everyMs }) => {
      const lease = await store.readJobLease(name);
      return { name, everyMs, lastRunAt: iso(lease?.lastRunAt), lastResult: lease?.lastResult ?? null };
    })),
  }));

  app.post<{ Params: { name: string } }>('/operator/v1/jobs/:name/run', async (req, reply) => {
    const runner = ctx.jobs;
    const name = runner?.jobs.find((job) => job.name === req.params.name)?.name ?? null;
    // An unknown name is operator input: the event keeps no target id for it.
    return ctx.audited(req, { action: 'job.run', target: { type: 'job', id: name } }, (audit) => {
      if (!runner || runner.state() !== 'active') {
        throw new ApiError('NOT_READY', undefined, { details: { reasons: ['job_runner_not_active'], retryAfter: 30 } });
      }
      if (!name) throw new ApiError('NOT_FOUND', 'Unknown job.');
      const requireFreeLease = () => {
        const held = ctx.db.prepare('SELECT 1 FROM job_lease WHERE name = ? AND owner IS NOT NULL AND lease_until > ?').get(name, ctx.now());
        if (held) throw new ApiError('JOB_RUNNING');
      };
      requireFreeLease();
      // Record acceptance before the run starts. The request, the job_run line and the job's events share one trace id.
      audit.change(requireFreeLease);
      void runner.runNow(name, { traceId: req.traceId }).catch((err: unknown) => {
        ctx.logger.error('job_run_request_failed', { trace_id: req.traceId, job: name, error: err instanceof Error ? err.name : 'Error' });
      });
      return reply.code(202).send({ job: name, traceId: req.traceId });
    });
  });
}
