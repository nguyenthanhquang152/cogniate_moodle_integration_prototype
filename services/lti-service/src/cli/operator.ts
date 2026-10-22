// lti:operator (LA-ADR-06 D3 "Trust bootstrap"). Runs INSIDE the lti-service container (the database is there):
//   npm run lti:operator -- init --name <operator> [--if-none | --replace]
// The only command that writes an operator key directly to lti.db; every other change goes through the operator API.
//   init             makes the first operator key; when an active key exists: exit 1, one line, nothing changes
//   init --if-none   when an active key exists: exit 0, the line "operator key exists", nothing changes
//                    (stack scripts use it, so a second run on the same volume works; --name is needed only for a new key)
//   init --replace   (key file lost) revokes every operator key and makes a new one, in one transaction
// A new key is printed once, as the only stdout line. infra/scripts/lti-bootstrap.sh writes it to
// infra/.secrets/lti-operator-key.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from '../config.ts';
import { openDb } from '../db/index.ts';
import type { Db } from '../db/index.ts';
import type { InitMode } from '../store/operator-keys.ts';
import { OPERATOR_NAME, hasActiveOperatorKey, initOperatorKey } from '../store/operator-keys.ts';

export const USAGE = 'Usage: lti:operator init --name <operator> [--if-none | --replace]';

export interface CliResult { code: number; stdout: string[]; stderr: string[] }

type Parsed = { ok: true; mode: InitMode; name: string | null } | { ok: false; message: string };

export function parseOperatorArgs(args: string[]): Parsed {
  let values: { name?: string | undefined; 'if-none': boolean; replace: boolean };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args, allowPositionals: true,
      options: { name: { type: 'string' }, 'if-none': { type: 'boolean', default: false }, replace: { type: 'boolean', default: false } },
    }));
  } catch (err) {
    return { ok: false, message: `${(err as Error).message} ${USAGE}` };
  }
  if (positionals.length !== 1 || positionals[0] !== 'init') return { ok: false, message: USAGE };
  if (values['if-none'] && values.replace) return { ok: false, message: `Use --if-none or --replace, not both. ${USAGE}` };
  const mode: InitMode = values.replace ? 'replace' : values['if-none'] ? 'if-none' : 'refuse';
  const name = values.name ?? null;
  if (name !== null && !OPERATOR_NAME.test(name)) {
    return { ok: false, message: 'The operator name must be 1 to 64 characters: letters, digits and . _ @ - (first a letter or a digit).' };
  }
  if (name === null && mode !== 'if-none') return { ok: false, message: `--name is required. ${USAGE}` };
  return { ok: true, mode, name };
}

/** `init` on an open database (unit-tested; the entry point below only opens the database and prints). */
export function runInit(db: Db, mode: InitMode, name: string | null, now: number): CliResult {
  if (name === null) {
    // --if-none without --name: it can only report an active key.
    if (hasActiveOperatorKey(db, now)) return { code: 0, stdout: ['operator key exists'], stderr: [] };
    return { code: 2, stdout: [], stderr: [`No active operator key: --name is required to make one. ${USAGE}`] };
  }
  const result = initOperatorKey(db, { operator: name, mode }, now);
  if (result.result === 'issued') return { code: 0, stdout: [result.operatorKey], stderr: [] };
  if (mode === 'if-none') return { code: 0, stdout: ['operator key exists'], stderr: [] };
  return {
    code: 1, stdout: [],
    stderr: ['An active operator key exists. Nothing changed. Use --if-none to keep it, or --replace to revoke every operator key and make a new one.'],
  };
}

// exitCode, not exit(): the process ends after stdout is flushed (the key line goes to a pipe).
if (import.meta.main) {
  const parsed = parseOperatorArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exitCode = 2;
  } else {
    const config = loadConfig();
    const db = openDb(join(config.dataDir, 'lti.db'));
    const result = runInit(db, parsed.mode, parsed.name, Date.now());
    db.close();
    for (const line of result.stdout) console.log(line);
    for (const line of result.stderr) console.error(line);
    process.exitCode = result.code;
  }
}
