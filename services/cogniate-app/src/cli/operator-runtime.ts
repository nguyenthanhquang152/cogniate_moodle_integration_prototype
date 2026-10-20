// Shared setup of the operator CLIs (app:grant, app:binding): the app database, the LTI client (the same API URL as
// the app: the transport gate in the `acceptance` profile), a logger on the app log, and the cleanup engine.
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { createLogger, createOutboundClient, parseAllowlist } from '@cogniate/shared';
import { createBindingCleanup } from '../app/binding-cleanup.ts';
import { createOperator } from '../app/operator.ts';
import { createLtiClient } from '../clients/lti-client.ts';
import { loadConfig } from '../config.ts';
import { openDb } from '../domain/db.ts';

export function operatorRuntime() {
  const config = loadConfig();
  const db = openDb(join(config.dataDir, 'cogniate.db'));
  const logger = createLogger({ service: 'cogniate-app' });
  const outbound = createOutboundClient({ logger, allowlist: parseAllowlist(process.env.OUTBOUND_PRIVATE_HOST_ALLOWLIST) });
  const lti = createLtiClient({ outbound, ltiUrl: config.urls.lti, apiKeyFile: config.ltiApiKeyFile, ...(config.ltiApiUrl ? { apiUrl: config.ltiApiUrl } : {}) });
  const cleanup = createBindingCleanup({ db, lti, logger, now: Date.now });
  const operator = createOperator({ db, lti, logger, cleanup, now: Date.now });
  return { db, operator, traceId: randomBytes(16).toString('hex') };
}

/** Print the lines and exit with the command's code. */
export function finish(result: { exitCode: 0 | 1; lines: string[] }, close: () => void): never {
  close();
  for (const line of result.lines) (result.exitCode === 0 ? console.log : console.error)(line);
  process.exit(result.exitCode);
}
