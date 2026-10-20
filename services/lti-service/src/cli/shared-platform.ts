// Shared platform of a shared profile (contract §9.12). Runs INSIDE the lti-service container (the database is there):
//   npm run lti:shared-platform -w services/lti-service -- --account cogniate --profile blackboard --client-id <Application ID> [--name "Cogniate"]
// Makes the shared platform if it does not exist and prints one JSON line {platformId, created}. The same client id
// again: prints the id and changes nothing (exit 0). Another client id: exit 1 with one line. It prints no secret.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../config.ts';
import { openDb } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import type { ProfileOptions } from '../profiles/index.ts';
import { findProfile, isSharedProfile, profileEndpoints } from '../profiles/index.ts';
import { getAccount } from '../store/accounts.ts';
import { SharedPlatformExistsError, createPlatform, findSharedPlatform } from '../store/platforms.ts';

export type SharedPlatformResult = { ok: true; platformId: string; created: boolean } | { ok: false; message: string };

/** The rules of contract §9.12 (unit-tested; the CLI below only parses arguments and prints). */
export function ensureSharedPlatform(db: Db, opts: ProfileOptions, input: { account: string; profile: string; clientId: string; name?: string }): SharedPlatformResult {
  if (!getAccount(db, input.account)) return { ok: false, message: `Unknown tool account: ${input.account}.` };
  const profile = findProfile(input.profile, opts);
  if (!profile) return { ok: false, message: `Unknown provider profile: ${input.profile} (UNKNOWN_PROFILE).` };
  if (!isSharedProfile(profile)) return { ok: false, message: `Profile ${profile.id} is not a shared profile.` };
  if (!/^[\x21-\x7e]{1,255}$/.test(input.clientId)) return { ok: false, message: 'The client id must be 1 to 255 printable ASCII characters without spaces.' };
  const existing = findSharedPlatform(db, input.account, profile.id);
  if (existing) {
    if (existing.clientId === input.clientId) return { ok: true, platformId: existing.id, created: false };
    return { ok: false, message: `A ${profile.id} shared platform with another client id exists (${existing.id}). Nothing changed.` };
  }
  const e = profileEndpoints(profile, { clientId: input.clientId });
  try {
    const p = createPlatform(db, input.account, {
      issuer: e.issuer, clientId: input.clientId, name: input.name ?? 'Cogniate', authEndpoint: e.authenticationEndpoint, tokenEndpoint: e.accesstokenEndpoint,
      jwksUrl: e.jwksUrl, deploymentIds: [], active: true, profile: profile.id, shared: true,
    });
    return { ok: true, platformId: p.id, created: true };
  } catch (err) {
    if (err instanceof SharedPlatformExistsError) return { ok: false, message: `A ${profile.id} shared platform exists. Run the command again.` };
    throw err;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { account: { type: 'string' }, profile: { type: 'string' }, 'client-id': { type: 'string' }, name: { type: 'string' } } });
  if (!values.account || !values.profile || !values['client-id']) {
    console.error('Usage: shared-platform.ts --account <id> --profile <shared profile> --client-id <Application ID> [--name <name>]');
    process.exit(2);
  }
  const config = loadConfig();
  const db = openDb(join(config.dataDir, 'lti.db'));
  const result = ensureSharedPlatform(db, { simulation: config.simulationProfiles }, {
    account: values.account, profile: values.profile, clientId: values['client-id'], ...(values.name ? { name: values.name } : {}),
  });
  db.close();
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log(JSON.stringify({ platformId: result.platformId, created: result.created }));
}
