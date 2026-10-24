// lti-service entry point. Public URL: PUBLIC_LTI_URL (proxy -> :4100). Contract: docs/architecture/contracts/lti-service-api.md
import { join } from 'node:path';
import type { JobRunner, Logger } from '@cogniate/shared';
import { ConfigRefusedError, JOB_LEASE_MS, createLogger, createOutboundClient, readServiceKnobs } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import type { LtiConfig } from './config.ts';
import { hostPort, loadConfig } from './config.ts';
import type { Db } from './db/index.ts';
import { openDb } from './db/index.ts';
import { buildApp, simulationProfileIds } from './http/app.ts';
import { buildOperatorApp } from './http/operator/index.ts';
import { metricsFor } from './http/metrics.ts';
import type { StartupKeys } from './keys/key-config.ts';
import { loadKeyProvider, readStartupKeys } from './keys/key-config.ts';
import { createPlatformKeys } from './lti/jwks.ts';
import { createAgsClient } from './platform/ags.ts';
import { createNrpsClient } from './platform/nrps.ts';
import { createScoreClock } from './platform/score-clock.ts';
import { createTokenClient } from './platform/token-client.ts';
import { createLtiJobRunner } from './jobs/index.ts';

const SERVICE = 'lti-service';

export interface LtiService {
  config: LtiConfig;
  /** The key handle of the store callers, bound to the loaded key ring (readStartupKeys, BD-A2-77). */
  masterKey: Buffer;
  db: Db;
  logger: Logger;
  app: FastifyInstance;
  operatorApp: FastifyInstance;
  jobs: JobRunner;
  /** Stop both listeners and the runner at once, cut open HTTP requests after HTTP_DRAIN_MS, then close the database. */
  close: () => Promise<void>;
}

/** BD-A2-109: at stop, an in-flight HTTP request gets at most this time; then its connection is destroyed. */
export const HTTP_DRAIN_MS = 3_000;

/**
 * Stop one listener (BD-A2-109): it stops accepting and closes idle keep-alive connections at once. After HTTP_DRAIN_MS
 * it destroys the connections that are still open, so a held handler cannot keep the stop waiting. The code of a cut
 * handler ends with the process (the ADR-011 dead-handler path).
 */
async function closeListener(app: FastifyInstance): Promise<void> {
  const cut = setTimeout(() => app.server.closeAllConnections(), HTTP_DRAIN_MS);
  try { await app.close(); } finally { clearTimeout(cut); }
}

/** Start the service (unit tests call it with their own logger; the entry point below adds the signal handlers). */
export async function startLtiService(options: { logger?: Logger } = {}): Promise<LtiService> {
  const sink = options.logger ?? createLogger({ service: SERVICE });
  let config: LtiConfig;
  let startup: StartupKeys;
  try {
    config = loadConfig();
    // BD-A2-77: one read of the key settings gives the ring and the key handle (a key-ring file alone is enough).
    startup = readStartupKeys(process.env, sink);
  } catch (err) {
    // LA-ADR-06 D12: one config_refused line before any file or port is opened. The entry point exits with code 1.
    if (err instanceof ConfigRefusedError) {
      sink.error('config_refused', { reason: err.reason, message: err.message, ...(err.setting ? { setting: err.setting } : {}) });
    }
    throw err;
  }
  const db = openDb(join(config.dataDir, 'lti.db'));
  const metrics = (await metricsFor(db));
  const logger = metrics.logger(sink);
  const { active: knobs } = readServiceKnobs(SERVICE);
  for (const knob of knobs) logger.warn('test_knob_active', { name: knob.name, value: knob.value });

  // LA-ADR-06 D6: bind the key ring to the key handle before the first store call. Every store caller below gets this
  // Buffer, so it seals with the active ring version.
  const masterKey = startup.handle;
  await loadKeyProvider({ db, logger, masterKey, ring: startup.ring });
  const outbound = createOutboundClient({ logger, allowlist: config.outboundAllowlist });
  // T3a: platform tokens (in memory, contract §4) and the score clock (in memory, floor = start + 2 s).
  // BD-A2-52, BD-A2-54: the token client and the JWKS cache report to the metrics; the cache age is read at scrape time.
  const tokens = createTokenClient({ db, masterKey, outbound, logger, onTokenResult: metrics.tokenResult });
  const keys = createPlatformKeys(outbound, Date.now, metrics.jwksFetch);
  metrics.readJwksAges(keys);
  const ags = createAgsClient({ outbound, tokens, clock: createScoreClock(), logger });
  const app = await buildApp({
    db, urls: config.urls, logger, keys, ltikTtlSeconds: config.ltikTtlSeconds, masterKey, ags, nrps: createNrpsClient({ outbound, tokens, logger }), outbound,
    profile: config.profile, knobs, outboundAllowlist: outbound.allowlist, simulationProfiles: config.simulationProfiles,
  });
  // LA-ADR-06 D3: the operator API on its own listener (no proxy route).
  const jobs = createLtiJobRunner({ db, logger, keys: masterKey });
  const operatorApp = await buildOperatorApp({ db, logger, keys: masterKey, jobs, urls: config.urls, simulationProfiles: config.simulationProfiles });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  await operatorApp.listen({ port: config.operatorPort, host: config.operatorHost });
  logger.info('service_started', {
    node: process.version, port: config.port, public_url: config.urls.lti, profile: config.profile,
    outbound_allowlist: outbound.allowlist, knobs, simulation_profiles: simulationProfileIds(config.simulationProfiles),
    operator_bind: hostPort(config.operatorHost, config.operatorPort),
  });
  jobs.start();

  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => closing ??= (async () => {
    // BD-A2-109: the listeners and the runner stop at the same time. The runner keeps its 60 s grace for a run in
    // flight; HTTP requests do not. The database closes when both are done.
    const results = await Promise.allSettled([jobs.stop(), closeListener(app), closeListener(operatorApp)]);
    db.close();
    // A failed step (the runner or either listener) makes close() reject, so the service exits 1 (A-LA-E5-19-04).
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  })();
  return { config, masterKey, db, logger, app, operatorApp, jobs, close };
}

// BD-A2-31: allow the runner's longest lease, then ten seconds for listeners and database close.
export const SERVICE_EXIT_AFTER_MS = JOB_LEASE_MS + 10_000;

export function createShutdownHandler(service: Pick<LtiService, 'close' | 'logger'>, exit: (code: number) => void = (code) => process.exit(code)): (signal: string) => void {
  let stopping = false;
  return (signal) => {
    if (stopping) return;
    stopping = true;
    service.logger.info('service_stopping', { signal });
    const fallback = setTimeout(() => {
      service.logger.error('service_exit_forced', { after_ms: SERVICE_EXIT_AFTER_MS });
      exit(1);
    }, SERVICE_EXIT_AFTER_MS);
    void service.close().then(() => { clearTimeout(fallback); exit(0); }, () => { clearTimeout(fallback); exit(1); });
  };
}

if (import.meta.main) {
  try {
    const service = await startLtiService();
    const stop = createShutdownHandler(service);
    process.once('SIGTERM', () => stop('SIGTERM'));
    process.once('SIGINT', () => stop('SIGINT'));
  } catch (err) {
    // The config_refused line is already written; a stack trace would add a second line.
    if (!(err instanceof ConfigRefusedError)) throw err;
    process.exitCode = 1;
  }
}
