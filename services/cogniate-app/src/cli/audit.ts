import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { listAuditEvents } from '../app/audit.ts';
import type { AuditFilter } from '../app/audit.ts';

interface CommandResult { exitCode: 0 | 1; lines: string[] }

/** Read only: no migrations, operator runtime, key files or audit insert for this command. */
export function runAuditCli(argv: string[], env: NodeJS.ProcessEnv = process.env): CommandResult {
  const traceId = randomBytes(16).toString('hex');
  const refuse = (reason: string): CommandResult => ({
    exitCode: 1, lines: [JSON.stringify({ event: 'audit_list_refused', reason, traceId })],
  });
  let filter: AuditFilter;
  try {
    const { positionals, values } = parseArgs({
      args: argv, allowPositionals: true, strict: true,
      options: { connection: { type: 'string' }, action: { type: 'string' }, since: { type: 'string' }, limit: { type: 'string' } },
    });
    if (positionals.length !== 1 || positionals[0] !== 'list') return refuse('usage: app:audit list [--connection <id>] [--action <a>] [--since <ISO>] [--limit <1..500>]');
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
