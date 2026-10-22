import type { JobInstanceRow, JobLeaseRow, JobRunner, JobStore, KeyHandle, Logger } from '@cogniate/shared';
import { createJobRunner } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { auditRetentionDays, auditRetentionJob } from './audit-retention.ts';
import { retentionJob } from './retention.ts';
import { signingKeyCleanupJob } from './signing-key-cleanup.ts';
import { keyRewrapJob } from './key-rewrap.ts';

/** The runner creates no schema. Migration 013 supplies both tables. Every ownership check is one SQL write. */
export function createLtiJobStore(db: Db): JobStore {
  return {
    readInstance(instanceId) {
      return db.prepare(`SELECT instance_id AS instanceId, boot_id AS bootId, role,
        started_at AS startedAt, heartbeat_at AS heartbeatAt FROM job_instance WHERE instance_id = ?`)
        .get(instanceId) as unknown as JobInstanceRow | undefined ?? null;
    },
    claimInstance(row, staleBefore) {
      return Number(db.prepare(`INSERT INTO job_instance (instance_id, boot_id, role, started_at, heartbeat_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(instance_id) DO UPDATE SET boot_id = excluded.boot_id, role = excluded.role,
          started_at = excluded.started_at, heartbeat_at = excluded.heartbeat_at
        WHERE job_instance.heartbeat_at <= ?`).run(row.instanceId, row.bootId, row.role, row.now, row.now, staleBefore).changes) === 1;
    },
    heartbeat(instanceId, bootId, now) {
      return Number(db.prepare('UPDATE job_instance SET heartbeat_at = ? WHERE instance_id = ? AND boot_id = ?').run(now, instanceId, bootId).changes) === 1;
    },
    removeInstance(instanceId, bootId) {
      db.prepare('DELETE FROM job_instance WHERE instance_id = ? AND boot_id = ?').run(instanceId, bootId);
    },
    readJobLease(name) {
      return db.prepare(`SELECT name, owner, lease_until AS leaseUntil, last_run_at AS lastRunAt,
        last_result AS lastResult FROM job_lease WHERE name = ?`).get(name) as unknown as JobLeaseRow | undefined ?? null;
    },
    takeJobLease(name, owner, now, until) {
      return Number(db.prepare(`INSERT INTO job_lease (name, owner, lease_until) VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET owner = excluded.owner, lease_until = excluded.lease_until
        WHERE job_lease.owner IS NULL OR job_lease.lease_until IS NULL OR job_lease.lease_until <= ?`)
        .run(name, owner, until, now).changes) === 1;
    },
    endJobLease(name, owner, at, result) {
      db.prepare('UPDATE job_lease SET owner = NULL, lease_until = NULL, last_run_at = ?, last_result = ? WHERE name = ? AND owner = ?')
        .run(at, result, name, owner);
    },
  };
}

export function createLtiJobRunner(options: { db: Db; logger: Logger; keys?: KeyHandle; now?: () => number; env?: Record<string, string | undefined> }): JobRunner {
  const env = options.env ?? process.env;
  const auditDays = auditRetentionDays(env.AUDIT_RETENTION_DAYS);
  const runner = createJobRunner({ store: createLtiJobStore(options.db), logger: options.logger,
    instanceId: env.JOB_INSTANCE_ID ?? 'lti-1', now: options.now ?? Date.now });
  runner.addInterval(retentionJob(options.db));
  runner.addInterval(auditRetentionJob(options.db, auditDays));
  runner.addInterval(signingKeyCleanupJob(options.db));
  if (options.keys) runner.addInterval(keyRewrapJob(options.db, options.keys));
  return runner;
}
