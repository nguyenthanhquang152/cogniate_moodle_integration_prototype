import type { ChannelRegistry } from '@cogniate/channel-kernel';
// cogniate-app entry point. One process, two listeners (ADR-005), and the score sync worker:
//  - app:     PUBLIC_APP_URL     (proxy -> :4200): /app-api/*, /tool/*, /play/* (and the portal, T6)
//  - content: PUBLIC_CONTENT_URL (proxy -> :4201): /pkg/*, /rt/*, /_rt/assets/*; a different site, no cookies (T5a)
//  - worker:  sends score sync rows to the LTI service (T5a; started with the app listener)
//  - operator: GET /metrics and GET /readyz on OPERATOR_HOST:OPERATOR_PORT (default 127.0.0.1:4210; no proxy route)
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { ConfigRefusedError, createLogger, createOutboundClient, knobString, knobValue, portFromEnv, startService } from '@cogniate/shared';
import { appMetricsFor, buildOperatorListener, operatorListenerConfig, type OperatorListenerConfig } from './app/metrics.ts';
import { buildAppApi } from './app/server.ts';
import { createLtiClient } from './clients/lti-client.ts';
import { loadAppKeyProvider } from './app/sealing.ts';
import { loadConfig, type AppConfig } from './config.ts';
import { CONTENT_SERVICE_NAME, buildContentServer } from './content-host/server.ts';
import { openDb } from './domain/db.ts';
import { prepareStore } from './domain/package-store.ts';
import { createAppRunner } from './worker-main.ts';
import { loadAppChannelRegistry } from './kernel/registry.ts';
import { createShutdownHandler, stopService } from './kernel/records/shutdown.ts';
import type { JobRunner, Logger } from '@cogniate/shared';

const APP_SERVICE_NAME = 'cogniate-app';
async function startAppService(operator: OperatorListenerConfig, config: AppConfig) {
  const db = openDb(join(config.dataDir, 'cogniate.db'));
  // LA-E5-22: bind the app key ring to the master-key handle before any request can seal or open a value.
  const keys = await loadAppKeyProvider({ db, masterKey: config.masterKey, ring: config.keyRing, logger: createLogger({ service: APP_SERVICE_NAME, dir: process.env.LOG_DIR }) });
  const store = await prepareStore(config.dataDir);
  // LA-E4-07: one metrics registry for the database; the app listener's logger feeds its log-event series.
  const metrics = appMetricsFor(db);
  // The content listener makes score sync rows; the worker (built with the app listener) sends them.
  let runner: JobRunner | null = null;
  let channels: ChannelRegistry;
  const loggers: Logger[] = [];

  const servers = await startService(APP_SERVICE_NAME, [
    {
      name: APP_SERVICE_NAME,
      port: portFromEnv('PORT', 4200),
      publicUrl: (u) => u.app,
      build: async (deps) => {
        loggers.push(deps.logger);
        const logger = metrics.logger(deps.logger);
        // LA-ADR-01 D4: the channel registry, by folder discovery of the one product root. A load-check failure logs
        // channel_registry_invalid and stops the start. The same registry is passed to both listeners and the worker.
        channels = await loadAppChannelRegistry(logger);
        metrics.useChannels(channels);
        // All calls to the LTI service go through the guarded client (security §9; allowlist: the LTI service host).
        const outbound = createOutboundClient({ logger, allowlist: deps.outboundAllowlist });
        // The acceptance profile sends the /api/* calls through the transport gate (M3 §3.3, LTI_API_URL).
        const lti = createLtiClient({ outbound, ltiUrl: deps.urls.lti, apiKeyFile: config.ltiApiKeyFile, ...(config.ltiApiUrl ? { apiUrl: config.ltiApiUrl } : {}) });
        runner = createAppRunner({ db, config, logger, channels, lti, role: 'web' });
        // Send series exist only in the process that runs the job runner (a standalone worker exposes none in LA).
        if (config.jobRunner) metrics.countSends();
        const app = await buildAppApi({
          channels, db, urls: deps.urls, logger, store, profile: deps.profile, knobs: deps.knobs, outboundAllowlist: deps.outboundAllowlist,
          masterKey: config.masterKey, lti, refTtlSeconds: deps.knobValues.REF_TTL_SECONDS ?? knobValue('REF_TTL_SECONDS'),
          pickerTtlSeconds: deps.knobValues.PICKER_TTL_SECONDS ?? knobValue('PICKER_TTL_SECONDS'),
          playTtlSeconds: deps.knobValues.PLAY_TTL_SECONDS ?? knobValue('PLAY_TTL_SECONDS'), playerDir: config.playerDir, kickSync: () => void runner?.kick('record-dispatch'),
          // T8: builds go to the host-side Build Runner through its queue folder; the knobs travel in each request.
          buildQueueDir: config.buildQueueDir,
          buildKnobs: { hold: (deps.knobValues.BUILD_RUNNER_HOLD ?? knobValue('BUILD_RUNNER_HOLD')) === 1, failAt: deps.knobStrings.BUILD_RUNNER_FAIL_AT ?? knobString('BUILD_RUNNER_FAIL_AT') },
          outbound,
        });
        if (config.jobRunner) runner.start();
        await app.ready();
        return app.server;
      },
    },
    {
      name: CONTENT_SERVICE_NAME,
      port: portFromEnv('CONTENT_PORT', 4201),
      publicUrl: (u) => u.content,
      build: (deps) => {
        loggers.push(deps.logger);
        return buildContentServer({
          ...deps, channels, db, dataDir: config.dataDir, playerDir: config.playerDir, onSyncCreated: () => void runner?.kick('record-dispatch'),
        });
      },
    },
  ], { handleSignals: false });
  // BD-A2-88 D3: /readyz also checks that the app key ring has every key version in use (LA-E5-22).
  const operatorApp = buildOperatorListener({ db, metrics, keys });
  await operatorApp.listen({ host: operator.host, port: operator.port });
  const bound = operatorApp.server.address() as AddressInfo;
  loggers[0]?.info('operator_listener_started', { operator_bind: bound.family === 'IPv6' ? `[${bound.address}]:${bound.port}` : `${bound.address}:${bound.port}` });
  let closing: Promise<void> | undefined;
  // BD-A2-109: listeners stop at once, in-flight requests are cut after 3 s, only the runner drains.
  const close = (): Promise<void> => closing ??= stopService({ servers: [...servers, operatorApp.server], runner, closeDb: () => db.close() });
  return { close, runner, db, servers, loggers };
}

/** LA-ADR-06 D12: a refused setting gives one config_refused line and exit code 1, before any file or port is opened. */
function startSettings(): { operator: OperatorListenerConfig; config: AppConfig } | null {
  const logger = createLogger({ service: APP_SERVICE_NAME, dir: process.env.LOG_DIR });
  try {
    return { operator: operatorListenerConfig(), config: loadConfig(process.env, logger) };
  } catch (err) {
    if (!(err instanceof ConfigRefusedError)) throw err;
    logger.error('config_refused', { reason: err.reason, message: err.message, ...(err.setting ? { setting: err.setting } : {}) });
    process.exitCode = 1;
    return null;
  }
}

const settings = startSettings();
if (settings) {
  const app = await startAppService(settings.operator, settings.config);
  const stop = createShutdownHandler(app);
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));
}
