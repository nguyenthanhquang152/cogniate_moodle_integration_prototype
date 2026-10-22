import type { SQLInputValue } from 'node:sqlite';
import type { Logger, OutboundClient } from '@cogniate/shared';
import { decrypt, encrypt } from '@cogniate/shared';
import type { Db } from '../domain/db.ts';
import type { ChannelSql, PortContext } from './ports.ts';

/** Ignore quoted values and comments when looking for the required scope parameter. */
function parameters(statement: string): Set<string> {
  const sql = statement.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]/g, ' ');
  return new Set(sql.match(/[:@$][A-Za-z_][A-Za-z0-9_]*/g) ?? []);
}

/** A bound handle, without a way to change the library or the connection of the call. */
export function createChannelSql(db: Db, libraryId: string, connectionId: string | null): ChannelSql {
  function prepare(statement: string, params: Record<string, unknown> = {}) {
    const names = parameters(statement);
    if (!names.has(':library_id')) throw new Error('channel_sql_unscoped');
    const bound: Record<string, SQLInputValue> = {};
    for (const [key, value] of Object.entries(params)) {
      const name = /^[:@$]/.test(key) ? key : `:${key}`;
      if (/^[:@$](library_id|connection_id)$/.test(name)) continue;
      if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint' && !(value instanceof Uint8Array)) {
        throw new TypeError('channel_sql_invalid_parameter');
      }
      bound[name] = value;
    }
    for (const name of names) {
      if (/^[:@$]library_id$/.test(name)) bound[name] = libraryId;
      if (/^[:@$]connection_id$/.test(name)) bound[name] = connectionId;
    }
    return { query: db.prepare(statement), bound };
  }
  return Object.freeze({
    get<T>(statement: string, params?: Record<string, unknown>): T | undefined {
      const { query, bound } = prepare(statement, params);
      return query.get(bound) as T | undefined;
    },
    all<T>(statement: string, params?: Record<string, unknown>): T[] {
      const { query, bound } = prepare(statement, params);
      return query.all(bound) as T[];
    },
    run(statement: string, params?: Record<string, unknown>): { changes: number } {
      const { query, bound } = prepare(statement, params);
      return { changes: Number(query.run(bound).changes) };
    },
  });
}

export interface PortContextDeps {
  db: Db;
  masterKey: Buffer;
  outbound: OutboundClient;
  logger: Logger;
  now(): number;
}

/** Construct a new context for one port call; keys and the raw database stay in the kernel. */
export function createPortContext(deps: PortContextDeps, libraryId: string, connectionId: string | null, traceId: string): PortContext {
  return Object.freeze({
    libraryId, connectionId, traceId,
    sql: createChannelSql(deps.db, libraryId, connectionId),
    outbound: deps.outbound,
    seal: async (value: string) => encrypt(deps.masterKey, value),
    unseal: async (blob: Uint8Array) => decrypt(deps.masterKey, blob),
    logger: deps.logger,
    now: deps.now,
  });
}
