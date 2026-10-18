// lti-service entry point. Public URL: PUBLIC_LTI_URL (proxy -> :4100). Contract: docs/architecture/contracts/lti-service-api.md
import { join } from 'node:path';
import { createLogger, createOutboundClient, readServiceKnobs, startRetention } from '@cogniate/shared';
import { loadConfig } from './config.ts';
import { openDb } from './db/index.ts';
import { buildApp } from './http/app.ts';
import { createPlatformKeys } from './lti/jwks.ts';
import { createAgsClient } from './platform/ags.ts';
import { createNrpsClient } from './platform/nrps.ts';
import { createScoreClock } from './platform/score-clock.ts';
import { createTokenClient } from './platform/token-client.ts';
import { cleanupExpired } from './store/retention.ts';

const SERVICE = 'lti-service';
const config = loadConfig();
const logger = createLogger({ service: SERVICE });
const { active: knobs } = readServiceKnobs(SERVICE);
for (const knob of knobs) logger.warn('test_knob_active', { name: knob.name, value: knob.value });

const db = openDb(join(config.dataDir, 'lti.db'));
const outbound = createOutboundClient({ logger, allowlist: config.outboundAllowlist });
// T3a: platform tokens (in memory, contract §4) and the score clock (in memory, floor = start + 2 s).
const tokens = createTokenClient({ db, masterKey: config.masterKey, outbound, logger });
const ags = createAgsClient({ outbound, tokens, clock: createScoreClock() });
const app = await buildApp({
  db, urls: config.urls, logger, keys: createPlatformKeys(outbound), ltikTtlSeconds: config.ltikTtlSeconds, masterKey: config.masterKey, ags, nrps: createNrpsClient({ outbound, tokens }), outbound,
  profile: config.profile, knobs, outboundAllowlist: outbound.allowlist,
});
await app.listen({ port: config.port, host: '0.0.0.0' });
logger.info('service_started', {
  node: process.version, port: config.port, public_url: config.urls.lti, profile: config.profile,
  outbound_allowlist: outbound.allowlist, knobs,
});
// Retention (data-model §2.1): at start and every 10 min.
const retention = startRetention({ logger, run: () => cleanupExpired(db, Date.now()) });

const stop = (signal: string): void => {
  logger.info('service_stopping', { signal });
  retention.stop();
  app.close().finally(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 3000).unref();
};
process.once('SIGTERM', () => stop('SIGTERM'));
process.once('SIGINT', () => stop('SIGINT'));
