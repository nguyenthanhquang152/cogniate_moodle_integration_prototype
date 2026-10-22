// Bootstrap a tool account (contract §7). Runs INSIDE the lti-service container (the database is there):
//   node src/cli/bootstrap.ts --account cogniate --name "Cogniate" [--rotate-api-key] [--rotate-signing-key]
// Prints one JSON line: {account, created, kid, apiKey}. apiKey is set only when the key was made or rotated
// (it is shown once; only its hash is stored). Use infra/scripts/lti-bootstrap.sh (npm run lti:bootstrap) from the
// host: it writes infra/.secrets/lti-api-key.<account> (mode 600).
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../config.ts';
import { openDb } from '../db/index.ts';
import { loadKeyProvider } from '../keys/key-config.ts';
import { ensureAccount } from '../store/accounts.ts';
import { ensureToolKey } from '../store/tool-keys.ts';

export interface BootstrapInput { account: string; name?: string | undefined; rotateApiKey: boolean; rotateSigningKey: boolean }
export interface BootstrapResult { account: string; created: boolean; kid: string; apiKey: string | null }

/** The bootstrap steps on the database of DATA_DIR (unit tests call it; the entry point below parses and prints). */
export async function runBootstrap(input: BootstrapInput): Promise<BootstrapResult> {
  const config = loadConfig();
  const db = openDb(join(config.dataDir, 'lti.db'));
  try {
    // LA-ADR-06 D6: bind the key ring before the first store call, so a new signing key uses the active ring version.
    await loadKeyProvider({ db, masterKey: config.masterKey });
    const { account, created, apiKey } = ensureAccount(db, {
      id: input.account, name: input.name ?? input.account, appUrl: config.urls.app, rotateApiKey: input.rotateApiKey,
    });
    const kid = await ensureToolKey(db, config.masterKey, account.id, input.rotateSigningKey);
    return { account: account.id, created, kid, apiKey };
  } finally {
    db.close();
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      account: { type: 'string' }, name: { type: 'string' },
      'rotate-api-key': { type: 'boolean', default: false }, 'rotate-signing-key': { type: 'boolean', default: false },
    },
  });
  if (!values.account) {
    console.error('Usage: bootstrap.ts --account <id> [--name <name>] [--rotate-api-key] [--rotate-signing-key]');
    process.exit(2);
  }
  const result = await runBootstrap({
    account: values.account, name: values.name, rotateApiKey: values['rotate-api-key'], rotateSigningKey: values['rotate-signing-key'],
  });
  console.log(JSON.stringify(result));
}
