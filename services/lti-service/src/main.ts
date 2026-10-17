// lti-service entry point. Public URL: PUBLIC_LTI_URL (proxy -> :4100). Contract: docs/architecture/contracts/lti-service-api.md
import { join } from 'node:path';
import { createLogger, createOutboundClient, readServiceKnobs } from '@cogniate/shared';
import { loadConfig } from './config.ts';
import { openDb } from './db/index.ts';
import { buildApp } from './http/app.ts';
import { createPlatformKeys } from './lti/jwks.ts';

const SERVICE = 'lti-service';
const config = loadConfig();
const logger = createLogger({ service: SERVICE });
const { active: knobs } = readServiceKnobs(SERVICE);
for (const knob of knobs) logger.warn('test_knob_active', { name: knob.name, value: knob.value });

const db = openDb(join(config.dataDir, 'lti.db'));
const outbound = createOutboundClient({ logger, allowlist: config.outboundAllowlist });
const app = await buildApp({
  db, urls: config.urls, logger, keys: createPlatformKeys(outbound), ltikTtlSeconds: config.ltikTtlSeconds, profile: config.profile, knobs,
  outboundAllowlist: outbound.allowlist,
});
await app.listen({ port: config.port, host: '0.0.0.0' });
logger.info('service_started', {
  node: process.version, port: config.port, public_url: config.urls.lti, profile: config.profile,
  outbound_allowlist: outbound.allowlist, knobs,
});

const stop = (signal: string): void => {
  logger.info('service_stopping', { signal });
  app.close().finally(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 3000).unref();
};
process.once('SIGTERM', () => stop('SIGTERM'));
process.once('SIGINT', () => stop('SIGINT'));
