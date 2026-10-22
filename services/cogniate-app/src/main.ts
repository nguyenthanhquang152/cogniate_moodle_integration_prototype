// cogniate-app entry point. One process, two listeners (ADR-005), and the score sync worker:
//  - app:     PUBLIC_APP_URL     (proxy -> :4200): /app-api/*, /tool/*, /play/* (and the portal, T6)
//  - content: PUBLIC_CONTENT_URL (proxy -> :4201): /pkg/*, /rt/*, /_rt/assets/*; a different site, no cookies (T5a)
//  - worker:  sends score sync rows to the LTI service (T5a; started with the app listener)
import { join } from 'node:path';
import { createOutboundClient, knobString, knobValue, portFromEnv, startRetention, startService } from '@cogniate/shared';
import { buildAppApi } from './app/server.ts';
import { createLtiClient } from './clients/lti-client.ts';
import { createMoodleWsClient } from './clients/moodle-ws.ts';
import { loadConfig } from './config.ts';
import { CONTENT_SERVICE_NAME, buildContentServer } from './content-host/server.ts';
import { openDb } from './domain/db.ts';
import { prepareStore } from './domain/package-store.ts';
import { cleanupExpired } from './domain/retention.ts';
import { loadAppChannelRegistry } from './kernel/registry.ts';
import type { ScoreSyncWorker } from './worker/score-sync.ts';
import { createScoreSyncWorker } from './worker/score-sync.ts';

const APP_SERVICE_NAME = 'cogniate-app';
const config = loadConfig();
const db = openDb(join(config.dataDir, 'cogniate.db'));
const store = await prepareStore(config.dataDir);
// The content listener makes score sync rows; the worker (built with the app listener) sends them.
let worker: ScoreSyncWorker | null = null;

await startService(APP_SERVICE_NAME, [
  {
    name: APP_SERVICE_NAME,
    port: portFromEnv('PORT', 4200),
    publicUrl: (u) => u.app,
    build: async (deps) => {
      // LA-ADR-01 D4: the channel registry, by folder discovery of the one product root. A load-check failure logs
      // channel_registry_invalid and stops the start. No route reads the registry yet (LA-E1-06 passes it on).
      await loadAppChannelRegistry(deps.logger);
      // All calls to the LTI service go through the guarded client (security §9; allowlist: the LTI service host).
      const outbound = createOutboundClient({ logger: deps.logger, allowlist: deps.outboundAllowlist });
      // The acceptance profile sends the /api/* calls through the transport gate (M3 §3.3, LTI_API_URL).
      const lti = createLtiClient({ outbound, ltiUrl: deps.urls.lti, apiKeyFile: config.ltiApiKeyFile, ...(config.ltiApiUrl ? { apiUrl: config.ltiApiUrl } : {}) });
      worker = createScoreSyncWorker({ db, lti, logger: deps.logger, masterKey: config.masterKey, now: Date.now });
      const app = await buildAppApi({
        db, urls: deps.urls, logger: deps.logger, store, profile: deps.profile, knobs: deps.knobs, outboundAllowlist: deps.outboundAllowlist,
        masterKey: config.masterKey, lti, refTtlSeconds: deps.knobValues.REF_TTL_SECONDS ?? knobValue('REF_TTL_SECONDS'),
        pickerTtlSeconds: deps.knobValues.PICKER_TTL_SECONDS ?? knobValue('PICKER_TTL_SECONDS'),
        playTtlSeconds: deps.knobValues.PLAY_TTL_SECONDS ?? knobValue('PLAY_TTL_SECONDS'), playerDir: config.playerDir, kickSync: () => void worker?.kick(),
        // T8: builds go to the host-side Build Runner through its queue folder; the knobs travel in each request.
        buildQueueDir: config.buildQueueDir,
        buildKnobs: { hold: (deps.knobValues.BUILD_RUNNER_HOLD ?? knobValue('BUILD_RUNNER_HOLD')) === 1, failAt: deps.knobStrings.BUILD_RUNNER_FAIL_AT ?? knobString('BUILD_RUNNER_FAIL_AT') },
        moodleWs: createMoodleWsClient({ outbound }),
      });
      worker.start();
      // Retention (data-model §2.1): at start and every 10 min.
      startRetention({ logger: deps.logger, run: () => cleanupExpired(db, Date.now()) });
      await app.ready();
      return app.server;
    },
  },
  {
    name: CONTENT_SERVICE_NAME,
    port: portFromEnv('CONTENT_PORT', 4201),
    publicUrl: (u) => u.content,
    build: (deps) => buildContentServer({
      ...deps, db, dataDir: config.dataDir, playerDir: config.playerDir, onSyncCreated: () => void worker?.kick(),
    }),
  },
]);
