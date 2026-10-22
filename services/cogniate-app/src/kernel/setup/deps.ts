// Internal route dependencies. Channel modules may import only ports.ts.
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger, PublicUrls } from '@cogniate/shared';
import type { Db } from '../../domain/db.ts';
import type { Connection } from '../../domain/connections.ts';
import type { LtiClient } from '../../clients/lti-client.ts';
import type { RedemptionRequest } from '../ports.ts';

/**
 * Deps of the provider route modules (configuration and deployments). `redeem` is the ONLY way to bind: it
 * runs phase 1, the LTI steps, phase 2 and the compensation, and throws the contract ApiError on any refusal. It
 * also answers a finalized repeat (§4.4, §4.7.2) without a grant check or an LTI call.
 */
export interface SetupRouteDeps {
  channels: ChannelRegistry;
  db: Db;
  urls: PublicUrls;
  masterKey: Buffer;
  lti: LtiClient;
  logger: Logger;
  now: () => number;
  redeem: (request: RedemptionRequest) => Promise<Connection>;
  /** The connection DTO of app contract §4.2. */
  connectionDto: (connection: Connection, libraryName: string) => unknown;
}
