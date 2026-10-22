import type { FastifyInstance } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import { RateLimitPatchSchema, patchRateLimitSettings } from '../../store/settings.ts';
import { invalid } from '../validation.ts';
import type { OperatorContext } from './index.ts';

export function registerRateLimitRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.get('/operator/v1/rate-limits', async () => ctx.limiter.view());
  app.patch('/operator/v1/rate-limits', async (req) => {
    const settings = await ctx.audited(req, { action: 'settings.rate_limits', target: { type: 'service_setting', id: 'rate_limits' } }, (audit) => {
      const parsed = RateLimitPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        if (issue?.code === 'unrecognized_keys') throw new ApiError('INVALID_REQUEST', `Invalid field: ${[...issue.path, issue.keys[0]].join('.')}.`);
        throw invalid(parsed.error);
      }
      const fields = [
        ...Object.keys(parsed.data.classes ?? {}).map((name) => `classes.${name}`),
        ...(parsed.data.registrationSessionsPerAddress !== undefined ? ['registrationSessionsPerAddress'] : []),
      ];
      return audit.change(() => patchRateLimitSettings(ctx.db, parsed.data), () => ({ details: { fields, ...parsed.data } }));
    });
    // Publish only after the transaction and its audit event commit. Address hooks do no database reads.
    ctx.limiter.replaceSettings(settings);
    return ctx.limiter.view();
  });
}
