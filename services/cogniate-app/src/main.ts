// cogniate-app entry point. One process, two listeners (ADR-005):
//  - app:     PUBLIC_APP_URL     (proxy -> :4200): /app-api/*, later tool pages and the portal
//  - content: PUBLIC_CONTENT_URL (proxy -> :4201): a different site, sets no cookies (T5a)
import { join } from 'node:path';
import { createOutboundClient, knobValue, portFromEnv, startService } from '@cogniate/shared';
import { buildAppApi } from './app/server.ts';
import { loadConfig } from './config.ts';
import { CONTENT_SERVICE_NAME, buildContentServer } from './content-host/server.ts';
import { openDb } from './domain/db.ts';
import { createLtiClient } from './domain/lti-client.ts';
import { prepareStore } from './domain/package-store.ts';

const APP_SERVICE_NAME = 'cogniate-app';
const config = loadConfig();
const db = openDb(join(config.dataDir, 'cogniate.db'));
const store = await prepareStore(config.dataDir);

await startService(APP_SERVICE_NAME, [
  {
    name: APP_SERVICE_NAME,
    port: portFromEnv('PORT', 4200),
    publicUrl: (u) => u.app,
    build: async (deps) => {
      // All calls to the LTI service go through the guarded client (security §9; allowlist: the LTI service host).
      const outbound = createOutboundClient({ logger: deps.logger, allowlist: deps.outboundAllowlist });
      const lti = createLtiClient({ outbound, ltiUrl: deps.urls.lti, apiKeyFile: config.ltiApiKeyFile });
      const app = await buildAppApi({
        db, urls: deps.urls, logger: deps.logger, store, profile: deps.profile, knobs: deps.knobs, outboundAllowlist: deps.outboundAllowlist,
        masterKey: config.masterKey, lti, refTtlSeconds: deps.knobValues.REF_TTL_SECONDS ?? knobValue('REF_TTL_SECONDS'),
      });
      await app.ready();
      return app.server;
    },
  },
  { name: CONTENT_SERVICE_NAME, port: portFromEnv('CONTENT_PORT', 4201), publicUrl: (u) => u.content, build: (deps) => buildContentServer(deps) },
]);
