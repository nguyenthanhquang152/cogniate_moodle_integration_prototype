import type { Db } from '../db/index.ts';
import type { LtiStore } from './port.ts';
import { createSqliteLtiStore } from './sqlite.ts';
export type { LtiStore } from './port.ts';
export { createSqliteLtiStore } from './sqlite.ts';

/**
 * LG must move these per-process states before running more than one instance:
 * the score clock, platform token cache, platform JWKS cache, and rate-limit buckets.
 * LA keeps these states in memory and keeps SQLite as the storage engine (D13 item 4).
 */

/** Existing SQLite composition and test fixtures may supply a handle; a new engine supplies LtiStore directly. */
export type StoreSource = LtiStore | Db;
const adapters = new WeakMap<Db, LtiStore>();
export function storeFor(source: StoreSource): LtiStore {
  if ('accounts' in source) return source;
  let store = adapters.get(source);
  if (!store) { store = createSqliteLtiStore(source); adapters.set(source, store); }
  return store;
}
