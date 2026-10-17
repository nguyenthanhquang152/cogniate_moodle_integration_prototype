import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SqliteDb } from '@cogniate/shared';
import { openSqlite } from '@cogniate/shared';

export type Db = SqliteDb;
export { transaction } from '@cogniate/shared';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Open lti.db and apply src/db/migrations/*.sql with the shared runner (ADR-006 migration rule: a changed applied
 * migration stops the start). ":memory:" is used by the unit tests.
 */
export function openDb(file: string): Db {
  return openSqlite(file, MIGRATIONS_DIR);
}
