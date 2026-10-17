// Bootstrap a tool account (contract §7). Runs INSIDE the lti-service container (the database is there):
//   node src/cli/bootstrap.ts --account cogniate --name "Cogniate" [--rotate-api-key] [--rotate-signing-key]
// Prints one JSON line: {account, created, kid, apiKey}. apiKey is set only when the key was made or rotated
// (it is shown once; only its hash is stored). Use infra/scripts/lti-bootstrap.sh (npm run lti:bootstrap) from the
// host: it writes infra/.secrets/lti-api-key.<account> (mode 600).
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from '../config.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { ensureToolKey } from '../store/tool-keys.ts';

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
const config = loadConfig();
const db = openDb(join(config.dataDir, 'lti.db'));
const { account, created, apiKey } = ensureAccount(db, {
  id: values.account, name: values.name ?? values.account, appUrl: config.urls.app, rotateApiKey: values['rotate-api-key'],
});
const kid = await ensureToolKey(db, config.masterKey, account.id, values['rotate-signing-key']);
db.close();
console.log(JSON.stringify({ account: account.id, created, kid, apiKey }));
