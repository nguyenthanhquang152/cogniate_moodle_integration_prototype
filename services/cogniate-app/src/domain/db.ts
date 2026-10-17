import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SqliteDb } from '@cogniate/shared';
import { openSqlite } from '@cogniate/shared';

export type Db = SqliteDb;
export { MigrationChangedError, transaction } from '@cogniate/shared';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Open cogniate.db and apply src/domain/migrations/*.sql with the shared runner (ADR-006 migration rule: a changed
 * applied migration stops the start; B-T4a-01). ":memory:" is for unit tests. Only the repositories here use SQL.
 */
export function openDb(file: string, migrationsDir = MIGRATIONS_DIR): Db {
  return openSqlite(file, migrationsDir);
}
