// lti-service entry point. Public URL: PUBLIC_LTI_URL (proxy -> :4100).
import { portFromEnv, startService } from '@cogniate/shared';
import { SERVICE_NAME, buildServer } from './servers.ts';

await startService(SERVICE_NAME, [
  { name: SERVICE_NAME, port: portFromEnv('PORT', 4100), publicUrl: (u) => u.lti, build: (deps) => buildServer(deps) },
]);
