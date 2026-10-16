// Set ONE top-level key of infra/.secrets/seed.json (mode 600, atomic). Keeps every other key.
// stdin: the JSON value. Usage: node infra/scripts/seed-json-set.mjs <seed.json> <key>
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const [file, key] = process.argv.slice(2);
if (!file || !key) throw new Error('usage: seed-json-set.mjs <seed.json> <key>');
const seed = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
seed[key] = JSON.parse(readFileSync(0, 'utf8'));
const tmp = `${file}.tmp`;
writeFileSync(tmp, `${JSON.stringify(seed, null, 2)}\n`, { mode: 0o600 });
chmodSync(tmp, 0o600);
renameSync(tmp, file);
