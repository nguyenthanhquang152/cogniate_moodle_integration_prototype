import type { Logger } from '@cogniate/shared';
import type { LtiClient } from '../../clients/lti-client.ts';
import type { Connection } from '../../domain/connections.ts';
import type { Db } from '../../domain/db.ts';
import type { BindingCleanup, CleanupLine } from '../../app/binding-cleanup.ts';
import type { RedemptionEngine } from '../../app/redemption.ts';
import type { ConnectionSetup } from '../ports.ts';

export interface AuthorityDeps {
  db: Db;
  lti: LtiClient;
  logger: Logger;
  now(): number;
  cleanup?: BindingCleanup;
  engine?: RedemptionEngine;
}
export interface BindContext { libraryName: string; traceId: string }
export interface AuthorityStrategy {
  bind(c: Connection, adapter: ConnectionSetup, body: unknown, ctx: BindContext): Promise<Connection>;
  disconnect(c: Connection, traceId: string): Promise<void>;
  suspend(c: Connection, traceId: string): Promise<CleanupLine[]>;
  release(c: Connection, traceId: string): ReturnType<BindingCleanup['release']>;
}
