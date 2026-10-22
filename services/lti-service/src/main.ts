// lti-service entry point. Public URL: PUBLIC_LTI_URL (proxy -> :4100). Contract: docs/architecture/contracts/lti-service-api.md
import { join } from 'node:path';
import type { JobRunner, Logger } from '@cogniate/shared';
import { JOB_LEASE_MS, createLogger, createOutboundClient, readServiceKnobs } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import type { LtiConfig } from './config.ts';
import { hostPort, loadConfig } from './config.ts';
import type { Db } from './db/index.ts';
import { openDb } from './db/index.ts';
import { buildApp, simulationProfileIds } from './http/app.ts';
import { buildOperatorApp } from './http/operator/index.ts';
import { loadKeyProvider } from './keys/key-config.ts';
import { createPlatformKeys } from './lti/jwks.ts';
import { createAgsClient } from './platform/ags.ts';
import { createNrpsClient } from './platform/nrps.ts';
import { createScoreClock } from './platform/score-clock.ts';
import { createTokenClient } from './platform/token-client.ts';
import { createLtiJobRunner } from './jobs/index.ts';

const SERVICE = 'lti-service';

export interface LtiService {
  config: LtiConfig;
  db: Db;
  logger: Logger;
  app: FastifyInstance;
  operatorApp: FastifyInstance;
  jobs: JobRunner;
  /** Drain the runner, close both listeners, then the database. */
  close: () => Promise<void>;
}

/** Start the service (unit tests call it with their own logger; the entry point below adds the signal handlers). */
export async function startLtiService(options: { logger?: Logger } = {}): Promise<LtiService> {
  const config = loadConfig();
  const logger = options.logger ?? createLogger({ service: SERVICE });
  const { active: knobs } = readServiceKnobs(SERVICE);
  for (const knob of knobs) logger.warn('test_knob_active', { name: knob.name, value: knob.value });

  const db = openDb(join(config.dataDir, 'lti.db'));
  // LA-ADR-06 D6: bind the key ring to config.masterKey before the first store call. Every store caller below gets
  // this Buffer, so it seals with the active ring version.
  await loadKeyProvider({ db, logger, masterKey: config.masterKey });
  const outbound = createOutboundClient({ logger, allowlist: config.outboundAllowlist });
  // T3a: platform tokens (in memory, contract §4) and the score clock (in memory, floor = start + 2 s).
  const tokens = createTokenClient({ db, masterKey: config.masterKey, outbound, logger });
  const ags = createAgsClient({ outbound, tokens, clock: createScoreClock(), logger });
  const app = await buildApp({
    db, urls: config.urls, logger, keys: createPlatformKeys(outbound), ltikTtlSeconds: config.ltikTtlSeconds, masterKey: config.masterKey, ags, nrps: createNrpsClient({ outbound, tokens, logger }), outbound,
    profile: config.profile, knobs, outboundAllowlist: outbound.allowlist, simulationProfiles: config.simulationProfiles,
  });
  // LA-ADR-06 D3: the operator API on its own listener (no proxy route).
  const operatorApp = await buildOperatorApp({ db, logger, keys: config.masterKey, urls: config.urls, simulationProfiles: config.simulationProfiles });
  const jobs = createLtiJobRunner({ db, logger });
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
    await jobs.stop();
    await Promise.allSettled([app.close(), operatorApp.close()]);
    db.close();
  })();
  return { config, db, logger, app, operatorApp, jobs, close };
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
  const service = await startLtiService();
  const stop = createShutdownHandler(service);
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
}
