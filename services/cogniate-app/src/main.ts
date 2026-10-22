import type { ChannelRegistry } from '@cogniate/channel-kernel';
// cogniate-app entry point. One process, two listeners (ADR-005), and the score sync worker:
//  - app:     PUBLIC_APP_URL     (proxy -> :4200): /app-api/*, /tool/*, /play/* (and the portal, T6)
//  - content: PUBLIC_CONTENT_URL (proxy -> :4201): /pkg/*, /rt/*, /_rt/assets/*; a different site, no cookies (T5a)
//  - worker:  sends score sync rows to the LTI service (T5a; started with the app listener)
import { join } from 'node:path';
import { createOutboundClient, knobString, knobValue, portFromEnv, createJobRunner, startService } from '@cogniate/shared';
import { buildAppApi } from './app/server.ts';
import { createLtiClient } from './clients/lti-client.ts';
import { loadConfig } from './config.ts';
import { CONTENT_SERVICE_NAME, buildContentServer } from './content-host/server.ts';
import { openDb } from './domain/db.ts';
import { prepareStore } from './domain/package-store.ts';
import { retentionJob } from './domain/retention.ts';
import { createAppJobStore } from './kernel/records/job-store.ts';
import { createDispatchQueue } from './kernel/records/outbox.ts';
import { legacyAgsReporter } from './kernel/records/legacy-reporter.ts';
import { loadAppChannelRegistry } from './kernel/registry.ts';
import type { JobRunner } from '@cogniate/shared';

const APP_SERVICE_NAME = 'cogniate-app';
async function startAppService() {
  const config = loadConfig();
  const db = openDb(join(config.dataDir, 'cogniate.db'));
  const store = await prepareStore(config.dataDir);
  // The content listener makes score sync rows; the worker (built with the app listener) sends them.
  let runner: JobRunner | null = null;
  let channels: ChannelRegistry;

  const servers = await startService(APP_SERVICE_NAME, [
    {
      name: APP_SERVICE_NAME,
      port: portFromEnv('PORT', 4200),
      publicUrl: (u) => u.app,
      build: async (deps) => {
        // LA-ADR-01 D4: the channel registry, by folder discovery of the one product root. A load-check failure logs
        // channel_registry_invalid and stops the start. The same registry is passed to both listeners and the worker.
        channels = await loadAppChannelRegistry(deps.logger);
        // All calls to the LTI service go through the guarded client (security §9; allowlist: the LTI service host).
        const outbound = createOutboundClient({ logger: deps.logger, allowlist: deps.outboundAllowlist });
        // The acceptance profile sends the /api/* calls through the transport gate (M3 §3.3, LTI_API_URL).
        const lti = createLtiClient({ outbound, ltiUrl: deps.urls.lti, apiKeyFile: config.ltiApiKeyFile, ...(config.ltiApiUrl ? { apiUrl: config.ltiApiUrl } : {}) });
        runner = createJobRunner({ store: createAppJobStore(db), logger: deps.logger, instanceId: config.jobInstanceId });
        runner.addQueue(createDispatchQueue(db, [legacyAgsReporter({ db, lti, masterKey: config.masterKey })]));
        runner.addInterval(retentionJob(db));
        const app = await buildAppApi({
          channels, db, urls: deps.urls, logger: deps.logger, store, profile: deps.profile, knobs: deps.knobs, outboundAllowlist: deps.outboundAllowlist,
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
      build: (deps) => buildContentServer({
        ...deps, channels, db, dataDir: config.dataDir, playerDir: config.playerDir, onSyncCreated: () => void runner?.kick('record-dispatch'),
      }),
    },
  ], { handleSignals: false });
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => closing ??= (async () => {
    await runner?.stop();
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve());
      server.closeIdleConnections();
    })));
    db.close();
  })();
  return { close, runner, db, servers };
}

const app = await startAppService();
const stop = () => { void app.close().then(() => process.exit(0), () => process.exit(1)); };
// The runner owns its lease-based grace period. A 2 s exit timer could interrupt a score POST.
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
