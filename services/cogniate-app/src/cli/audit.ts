import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { listAuditEvents } from '../app/audit.ts';
import type { AuditFilter } from '../app/audit.ts';

interface CommandResult { exitCode: 0 | 1; lines: string[] }

const USAGE = 'app:audit list [--connection <id>] [--action <name>] [--since <ISO date-time>] [--limit <1-500>]';
export const AUDIT_HELP = [
  `Usage: ${USAGE}`,
  'Prints the app audit events, newest first, one JSON line for each event. The command only reads.',
  '  --connection <id>  only the events of this connection',
  '  --action <name>    only the events with this action, for example grant.issue',
  '  --since <time>     only the events at or after this ISO 8601 date-time with an offset, for example 2026-10-22T00:00:00Z',
  '  --limit <n>        at most n events, from 1 to 500 (default 100)',
  'The database is cogniate.db in DATA_DIR (default /data/cogniate.db).',
];

/** BD-A2-59 (Lead call, for A2): one fixed sentence with the fix for each code. A message never echoes input. */
export const AUDIT_REFUSALS = {
  arguments_invalid: `Use: ${USAGE}. Run app:audit --help for the options.`,
  connection_invalid: 'Give --connection a connection id that is not empty.',
  action_invalid: 'Give --action an action name that is not empty, for example grant.issue.',
  limit_invalid: 'Give --limit a whole number from 1 to 500.',
  since_invalid: 'Give --since an ISO 8601 date-time with an offset, for example 2026-10-22T00:00:00Z.',
  audit_read_failed: 'Cannot read the audit table in cogniate.db in DATA_DIR (default /data/cogniate.db): the file is missing, '
    + 'cannot be read, or is not migrated. Run the command in the cogniate-app container, or set DATA_DIR to the folder of the app database.',
} as const;
type AuditRefusalCode = keyof typeof AUDIT_REFUSALS;

/** Read only: no migrations, operator runtime, key files or audit insert for this command. */
export function runAuditCli(argv: string[], env: NodeJS.ProcessEnv = process.env): CommandResult {
  const traceId = randomBytes(16).toString('hex');
  const refuse = (reason: AuditRefusalCode): CommandResult => ({
    exitCode: 1, lines: [JSON.stringify({ event: 'audit_list_refused', reason, message: AUDIT_REFUSALS[reason], traceId })],
  });
  let filter: AuditFilter;
  try {
    const { positionals, values } = parseArgs({
      args: argv, allowPositionals: true, strict: true,
      options: {
        connection: { type: 'string' }, action: { type: 'string' }, since: { type: 'string' }, limit: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
    if (values.help) return { exitCode: 0, lines: AUDIT_HELP };
    if (positionals.length !== 1 || positionals[0] !== 'list') return refuse('arguments_invalid');
    if (values.connection !== undefined && values.connection.trim() === '') return refuse('connection_invalid');
    if (values.action !== undefined && values.action.trim() === '') return refuse('action_invalid');
    const limit = values.limit ?? '100';
    if (!/^[1-9][0-9]*$/.test(limit) || Number(limit) > 500) return refuse('limit_invalid');
    if (values.since !== undefined && !z.iso.datetime({ offset: true }).safeParse(values.since).success) return refuse('since_invalid');
    filter = {
      limit: Number(limit), connectionId: values.connection, action: values.action,
      since: values.since === undefined ? undefined : Date.parse(values.since),
    };
  } catch { return refuse('arguments_invalid'); }

  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(join(env.DATA_DIR || '/data', 'cogniate.db'), { readOnly: true });
    return { exitCode: 0, lines: listAuditEvents(db, filter).events.map((event) => JSON.stringify(event)) };
  } catch { return refuse('audit_read_failed'); }
  finally { db?.close(); }
}

if (import.meta.main) {
  const result = runAuditCli(process.argv.slice(2));
  for (const line of result.lines) (result.exitCode === 0 ? process.stdout : process.stderr).write(`${line}\n`);
  process.exitCode = result.exitCode;
}
