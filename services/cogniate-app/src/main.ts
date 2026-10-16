// cogniate-app entry point: app listener (PUBLIC_APP_URL, :4200) and content listener (PUBLIC_CONTENT_URL, :4201).
import { portFromEnv, startService } from '@cogniate/shared';
import { APP_SERVICE_NAME, CONTENT_SERVICE_NAME, buildAppServer, buildContentServer } from './servers.ts';

await startService(APP_SERVICE_NAME, [
  { name: APP_SERVICE_NAME, port: portFromEnv('PORT', 4200), publicUrl: (u) => u.app, build: (deps) => buildAppServer(deps) },
  { name: CONTENT_SERVICE_NAME, port: portFromEnv('CONTENT_PORT', 4201), publicUrl: (u) => u.content, build: (deps) => buildContentServer(deps) },
]);
