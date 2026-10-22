// The app jobs run in the web process by default, or alone through npm run worker.
import { appendFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import {
  JOB_HEARTBEAT_STALE_MS, createJobRunner, createLogger, createOutboundClient, parseAllowlist, readServiceKnobs,
  type JobRole, type JobRunner, type JobStore, type Logger,
} from '@cogniate/shared';
import { createLtiClient, type LtiClient } from './clients/lti-client.ts';
import { loadConfig, type AppConfig } from './config.ts';
import { openDb, transaction, type Db } from './domain/db.ts';
import { retentionJob } from './domain/retention.ts';
import { ltiAgsReporter } from './drivers/lti-ags/index.ts';
import { createAppJobStore } from './kernel/records/job-store.ts';
import { registerRecordReporters } from './kernel/records/records.ts';
import { createShutdownHandler } from './kernel/records/shutdown.ts';
import { loadAppChannelRegistry } from './kernel/registry.ts';

/** Check both before waiting on an instance id and in the same transaction as a new claim. */
function roleCheckedStore(db: Db, config: AppConfig, logger: Logger, role: JobRole): JobStore {
  const store = createAppJobStore(db);
  let warned = false;
  const allowed = (now: number): boolean => {
    const other = db.prepare('SELECT 1 FROM job_instance WHERE role <> ? AND heartbeat_at > ? LIMIT 1')
      .get(role, now - JOB_HEARTBEAT_STALE_MS);
    if (!other) return true;
    if (config.profile === 'production') return false;
    if (!warned) {
      logger.warn('job_runner_twice', { instance_id: config.jobInstanceId, role });
      warned = true;
    }
    return true;
  };
  const refuse = (): never => {
    // process.exit cannot flush the normal logger's file stream. Keep the refusal in both log sinks first.
    createLogger({ service: logger.service, dir: '', write: (line) => {
      if (process.env.LOG_DIR) appendFileSync(join(process.env.LOG_DIR, `${logger.service}.jsonl`), line);
      writeSync(process.stdout.fd, line);
    } }).error('config_refused', { reason: 'job_runner_twice', instance_id: config.jobInstanceId, role });
    process.exit(1);
  };
  return {
    ...store,
    readInstance(instanceId) {
      if (!allowed(Date.now())) refuse();
      return store.readInstance(instanceId);
    },
    claimInstance(row, staleBefore) {
      // BEGIN IMMEDIATE serializes simultaneous web/worker starts, including different instance ids.
      const result = transaction(db, () => allowed(row.now) ? store.claimInstance(row, staleBefore) : 'refused');
      if (result === 'refused') return refuse();
      return result;
    },
  };
}

/** One job and reporter assembly for both entry points. A disabled web runner still configures record writers. */
export function createAppRunner(options: {
  db: Db; config: AppConfig; logger: Logger; channels: ChannelRegistry; lti: LtiClient; role: JobRole;
}): JobRunner {
  const { db, config, logger, channels, lti, role } = options;
  const runner = createJobRunner({
    store: roleCheckedStore(db, config, logger, role), logger, instanceId: config.jobInstanceId, role,
    onConflict: () => process.exit(1),
  });
  // The one reporter list of the app (kernel/records/types.ts "Add a reporter").
  runner.addQueue(registerRecordReporters(db, [ltiAgsReporter({ db, lti, masterKey: config.masterKey, channels })]));
  runner.addInterval(retentionJob(db));
  return runner;
}

/** No HTTP listener. APP_JOB_RUNNER controls the web entry only; this entry always starts its runner. */
async function startWorker() {
  const env = process.env;
  const config = loadConfig(env);
  const logger = createLogger({ service: 'cogniate-app', dir: env.LOG_DIR });
  const { active: knobs } = readServiceKnobs('cogniate-app', env);
  for (const knob of knobs) logger.warn('test_knob_active', { name: knob.name, value: knob.value });
  const db = openDb(join(config.dataDir, 'cogniate.db'));
  try {
    const channels = await loadAppChannelRegistry(logger);
    const allowlist = parseAllowlist(env.OUTBOUND_PRIVATE_HOST_ALLOWLIST);
    const lti = createLtiClient({
      outbound: createOutboundClient({ logger, allowlist }), ltiUrl: config.urls.lti, apiKeyFile: config.ltiApiKeyFile,
      ...(config.ltiApiUrl ? { apiUrl: config.ltiApiUrl } : {}),
    });
    const runner = createAppRunner({ db, config, logger, channels, lti, role: 'worker' });
    runner.start();
    logger.info('service_started', { role: 'worker', node: process.version, profile: config.profile, outbound_allowlist: allowlist, knobs });
    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => closing ??= (async () => {
      await runner.stop();
      db.close();
    })();
    return { close, runner, db, loggers: [logger] };
  } catch (err) {
    db.close();
    throw err;
  }
}

if (import.meta.main) {
  const worker = await startWorker();
  const stop = createShutdownHandler(worker);
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
}
