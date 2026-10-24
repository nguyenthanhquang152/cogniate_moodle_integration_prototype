import type { IntervalJob, JobRunner, JobStore, KeyHandle, Logger } from '@cogniate/shared';
import { createJobRunner } from '@cogniate/shared';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
import { readSigningKeyPublishLeadSeconds } from '../keys/key-config.ts';
import { accountPurgeJob, closedAccountRetentionDays } from './account-purge.ts';
import { apiKeyExpiryJob } from './api-key-expiry.ts';
import { auditRetentionDays, auditRetentionJob } from './audit-retention.ts';
import { idempotencyCleanupJob } from './idempotency-cleanup.ts';
import { retentionJob } from './retention.ts';
import { signingKeyCleanupJob } from './signing-key-cleanup.ts';
import { signingKeyRotateDays, signingKeyRotationJob } from './signing-key-rotation.ts';
import { keyRewrapJob } from './key-rewrap.ts';

/** The async store port supplies the runner's lease operations. */
export function createLtiJobStore(db: StoreSource): JobStore { return storeFor(db).jobs; }

/** The runner and the names and intervals of its jobs (GET /operator/v1/jobs, LA-E5-20). */
export interface LtiJobRunner extends JobRunner {
  readonly jobs: ReadonlyArray<Pick<IntervalJob, 'name' | 'everyMs'>>;
}

/** Keys are required so every LTI runner has the on-demand key-rewrap job. Settings are read before any job starts. */
export function createLtiJobRunner(options: { db: StoreSource; logger: Logger; keys: KeyHandle; now?: () => number; env?: Record<string, string | undefined> }): LtiJobRunner {
  const env = options.env ?? process.env;
  const auditDays = auditRetentionDays(env.AUDIT_RETENTION_DAYS);
  const closedDays = closedAccountRetentionDays(env.CLOSED_ACCOUNT_RETENTION_DAYS);
  const rotation = { rotateDays: signingKeyRotateDays(env.SIGNING_KEY_ROTATE_DAYS), publishLeadSeconds: readSigningKeyPublishLeadSeconds(env) };
  const runner = createJobRunner({ store: createLtiJobStore(options.db), logger: options.logger,
    instanceId: env.JOB_INSTANCE_ID ?? 'lti-1', now: options.now ?? Date.now });
  const jobs = [
    retentionJob(options.db),
    auditRetentionJob(options.db, auditDays),
    signingKeyCleanupJob(options.db),
    keyRewrapJob(options.db, options.keys),
    apiKeyExpiryJob(options.db),
    idempotencyCleanupJob(options.db),
    signingKeyRotationJob(options.db, options.keys, rotation),
    accountPurgeJob(options.db, closedDays),
  ];
  for (const job of jobs) runner.addInterval(job);
  return Object.assign(runner, { jobs: jobs.map(({ name, everyMs }) => ({ name, everyMs })) });
}
