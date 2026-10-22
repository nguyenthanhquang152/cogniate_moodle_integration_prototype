import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger } from '@cogniate/shared';
import type { LtiClient } from '../../clients/lti-client.ts';
import type { Connection } from '../../domain/connections.ts';
import type { Db } from '../../domain/db.ts';
import type { BindingCleanup, CleanupLine } from '../../app/binding-cleanup.ts';
import type { RedemptionEngine } from '../../app/redemption.ts';
import type { ConnectionSetup, CreateRequestContext } from '../ports.ts';

export interface AuthorityDeps {
  channels: ChannelRegistry;
  db: Db;
  lti: LtiClient;
  logger: Logger;
  now(): number;
  cleanup?: BindingCleanup;
  engine?: RedemptionEngine;
}
export interface BindContext extends CreateRequestContext { traceId: string }
export interface AuthorityStrategy {
  bind(c: Connection, adapter: ConnectionSetup, body: unknown, ctx: BindContext): Promise<Connection>;
  disconnect(c: Connection, traceId: string): Promise<void>;
  /** `record` runs inside the transaction of the local change (the audit event of app:binding, LA-ADR-06 D4 rule 4). */
  suspend(c: Connection, traceId: string, record?: () => void): Promise<CleanupLine[]>;
  /** `record` runs inside the transaction of the local change, only when the release changes local rows. */
  release(c: Connection, traceId: string, record?: () => void): ReturnType<BindingCleanup['release']>;
}
