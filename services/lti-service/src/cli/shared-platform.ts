// Shared platform of a shared profile (contract §9.12). Runs INSIDE the lti-service container (the database is there):
//   npm run lti:shared-platform -w services/lti-service -- --account cogniate --profile blackboard --client-id <Application ID> [--name "Cogniate"]
// Makes the shared platform if it does not exist and prints one JSON line {platformId, created}. The same client id
// again: prints the id and changes nothing (exit 0). Another client id: exit 1 with one line. It prints no secret.
// A create logs `platform_created {platform_id, profile}` (§9.4, like the API) to the service log (createCliLogger).
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createCliLogger } from '@cogniate/shared';
import type { Logger } from '@cogniate/shared';
import { loadConfig } from '../config.ts';
import { openDb } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import type { ProfileOptions } from '../profiles/index.ts';
import { provisionSharedPlatform } from '../accounts/shared-platforms.ts';
import { ApiError } from '../api-errors.ts';

export type SharedPlatformResult = { ok: true; platformId: string; created: boolean } | { ok: false; message: string };

/** The rules of contract §9.12 (unit-tested; the CLI below only parses arguments and prints). */
export function ensureSharedPlatform(db: Db, opts: ProfileOptions, input: { account: string; profile: string; clientId: string; name?: string }, logger?: Logger): SharedPlatformResult {
  try {
    const { platform, created } = provisionSharedPlatform(db, opts, input);
    if (created) logger?.info('platform_created', { platform_id: platform.id, profile: platform.profile });
    return { ok: true, platformId: platform.id, created };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.description };
    throw err;
  }
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { account: { type: 'string' }, profile: { type: 'string' }, 'client-id': { type: 'string' }, name: { type: 'string' } } });
  if (!values.account || !values.profile || !values['client-id']) {
    console.error('Usage: shared-platform.ts --account <id> --profile <shared profile> --client-id <Application ID> [--name <name>]');
    process.exit(2);
  }
  const config = loadConfig();
  const db = openDb(join(config.dataDir, 'lti.db'));
  const result = ensureSharedPlatform(db, { simulation: config.simulationProfiles }, {
    account: values.account, profile: values.profile, clientId: values['client-id'], ...(values.name ? { name: values.name } : {}),
  }, createCliLogger({ service: 'lti-service' }));
  db.close();
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log(JSON.stringify({ platformId: result.platformId, created: result.created }));
}
