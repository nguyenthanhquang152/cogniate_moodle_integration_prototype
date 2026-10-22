// Public app ports (LA-ADR-01 D5). Types only: a channel receives capabilities through PortContext.
import type { CapabilityId, ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger, OutboundClient, PublicUrls } from '@cogniate/shared';
import type { LtiClient, LtiProviderProfile, NewPlatform, NewProviderPlatform } from '../clients/lti-client.ts';
import type { Connection, ConnectionStatus } from '../domain/connections.ts';
import type { CourseVersion } from '../domain/courses.ts';
import type { Db } from '../domain/db.ts';
import type { MbzBuild } from '../domain/mbz-builds.ts';
import type { Publication } from '../domain/publications.ts';

export type { LtiProviderProfile } from '../clients/lti-client.ts';
export type ChannelId = string;
export type ChannelText = string;

/** The connection fields that an adapter may read. */
export interface SetupConnection {
  id: string;
  libraryId: string;
  name: string;
  channel: string;
  /** LTI service profile id. */
  profile: string;
  /** Canonical site origin. */
  siteUrl: string;
  /** Canonical service origin (exclusive profile; equals `siteUrl` for self authority and shared profile). */
  serviceUrl: string;
  status: ConnectionStatus;
  /** Exclusive platform of the connection (self authority, exclusive profile), else null. */
  ltiPlatformId: string | null;
}

/** One row of `GET …/tool-configuration` (app contract §4.1, §4.5). */
export interface ToolRow {
  key: string;
  label: string;
  value: string;
}

export interface ToolConfigurationContext {
  urls: PublicUrls;
  libraryName: string;
  /**
   * Shared Application ID from LOCAL data (app contract §4.5): the connection's snapshot `target_client_id`, else
   * the persisted `platform.clientId`; else null. Never read from the LTI service here.
   */
  sharedClientId: string | null;
}

/** The values of a strict `PUT …/platform` body (app contract §4.4) or `POST …/deployments` body (§4.7.2). */
export interface PlatformBodyValues {
  clientId: string;
  deploymentId: string;
  grantCode: string;
  adminValues?: AdminValues;
}

/** Parse result: the values, or the body keys that are unknown, missing or malformed (`422 INVALID_PLATFORM_VALUES`). */
export type PlatformBodyResult = { ok: true; values: PlatformBodyValues } | { ok: false; fields: string[] };

export interface PlatformBodyContext {
  siteUrl: string;
  /** Client id of an existing exclusive platform, for an added deployment. */
  clientId?: string;
  /**
   * Shared profile: the first non-null LOCAL client id (app contract §4.4): the snapshot `target_client_id`, then the
   * persisted `platform.clientId`. Null (an old pending 011 row): only the form of a sent `clientId` is checked.
   */
  sharedClientId: string | null;
}

/**
 * The remote record of one redemption (app contract §4.7.1 "Target"). The kind tells an exclusive platform apart from
 * a deployment of a platform: exclusive profile `initial` makes an exclusive platform; exclusive profile `add_deployment` adds a deployment
 * to the connection's own exclusive platform; shared profile binds one deployment of the shared platform.
 */
export type BindingTarget =
  | {
    kind: 'exclusive_platform';
    profile: string;
    /** Canonical issuer: the profile issuer, or the canonical site URL for `a site-based issuer`. */
    issuer: string;
    clientId: string;
    deploymentId: string;
    siteUrl: string;
    serviceUrl: string;
    /** Known after S1 or S2 (until then the target is found by issuer, client id and profile). */
    platformId: string | null;
  }
  | { kind: 'platform_deployment'; platformId: string; deploymentId: string }
  | { kind: 'shared_deployment'; platformId: string; deploymentId: string; siteUrl: string };

/** Shared platform of a shared profile (from `GET /api/providers` `sharedPlatform`). */
export interface SharedPlatformInfo {
  id: string;
  clientId: string;
  active: boolean;
}

/**
 * Local view of the connection's profile, built from its provider snapshot inside phase 1 (no LTI call, B-M1-03).
 * `issuer` is the saved canonical target issuer (already filled for `a site-based issuer`).
 */
export type ProfileView = Pick<LtiProviderProfile, 'id' | 'issuer' | 'sharing' | 'serviceUrl'> & Partial<LtiProviderProfile>;
export type LocalProfileView = Pick<ProfileView, 'id' | 'issuer'> & Partial<ProfileView>;

export interface InitialTargetContext {
  connection: SetupConnection;
  values: PlatformBodyValues;
  /** The local profile view (app contract §4.7.1 "Target": local data only). */
  profile: LocalProfileView;
  /** Shared profile: the pinned id and client id from the complete snapshot, never a live provider lookup. */
  sharedPlatform: Pick<SharedPlatformInfo, 'id' | 'clientId'> | null;
}

/** S1 request without `active` and `bindingRef` (the engine adds `active: false` and the write-ahead ref). */
export type StagedCreate =
  | { kind: 'platform'; body: NewPlatform | Omit<NewProviderPlatform, 'active' | 'bindingRef'> }
  | { kind: 'deployment'; platformId: string; body: { deploymentId: string; siteUrl?: string } };

export interface CreateRequestContext {
  libraryName: string;
}

export interface AdminValues {
  issuer: string;
  authenticationEndpoint: string;
  accessTokenEndpoint: string;
  jwksUrl: string;
  tokenAudience?: string;
}

/** App-only profile metadata; kept equal to the LTI profile traits (BD-A1-29). */
export interface AppProfileData {
  sharing: 'exclusive' | 'shared';
  serviceUrl: boolean;
  label: string;
  refusedHostSuffixes?: readonly string[];
}

/** Pure setup functions. A rejected input is a result value, never a thrown validation error. */
export interface ConnectionSetup {
  readonly channel: string;
  readonly profiles: Readonly<Record<string, AppProfileData>>;
  sharingOf(profileId: string): AppProfileData['sharing'] | null;
  checkCreate(input: { siteUrl: string; serviceUrl?: string; profile: ProfileView }):
    { ok: true; siteUrl: string; serviceUrl: string } | { ok: false; field: string; rule?: number };
  toolConfiguration(ctx: ToolConfigurationContext): ToolRow[];
  parseBindingBody(body: unknown, ctx: PlatformBodyContext & { purpose: GrantPurpose }): PlatformBodyResult;
  selfCreate?(values: AdminValues & { clientId: string; deploymentId: string }, ctx: CreateRequestContext): StagedCreate;
  initialTarget?(ctx: InitialTargetContext): BindingTarget;
  createRequest?(target: BindingTarget, ctx: CreateRequestContext): StagedCreate;
  extensionRoutes?: readonly ExtensionRoute[];
  publishHooks?: readonly PublishHook[];
  packageExporters?: readonly PackageExporter[];
}

/** The kernel creates this context for each call. A channel must not store it. */
export interface PortContext {
  libraryId: string;
  connectionId: string | null;
  sql: ChannelSql;
  outbound: GuardedClient;
  seal(value: string): Promise<Uint8Array>;
  unseal(blob: Uint8Array): Promise<string>;
  logger: Logger;
  traceId: string;
  now(): number;
}
export type GuardedClient = OutboundClient;

/** The kernel binds :library_id and, when present, :connection_id. */
export interface ChannelSql {
  get<T>(statement: string, params?: Record<string, unknown>): T | undefined;
  all<T>(statement: string, params?: Record<string, unknown>): T[];
  run(statement: string, params?: Record<string, unknown>): { changes: number };
}
export interface ExtensionRoute {
  method: 'GET' | 'PUT' | 'POST';
  path: string;
  capability: CapabilityId;
  legacyCapabilityName?: string;
  handle(input: { body: unknown; query: Record<string, string> }, ctx: PortContext): Promise<{
    status: number; body: unknown; headers?: Record<string, string>;
  }>;
}
export type PublicationView = Readonly<Publication>;
export type CourseVersionView = Readonly<CourseVersion>;
export type ExportBuildView = Readonly<MbzBuild>;

export interface PublishHook {
  option: string;
  capability: CapabilityId;
  afterPublish(publication: PublicationView, ctx: PortContext): Promise<void>;
  dtoFields(publication: PublicationView, ctx: PortContext): Record<string, unknown>;
}
export interface PackageExporter {
  id: string;
  formats: readonly string[];
  start(version: CourseVersionView, ctx: PortContext): Promise<ExportBuildView>;
  latest(version: CourseVersionView, ctx: PortContext): ExportBuildView | null;
  download(version: CourseVersionView, ctx: PortContext): Promise<{ path: string; mediaType: string; filename: string } | null>;
}

export type GrantPurpose = 'initial' | 'add_deployment';

/** One call of the common redemption engine (app contract §4.7.1). */
export interface RedemptionRequest {
  /** The session library. */
  libraryId: string;
  /** The path connection. */
  connectionId: string;
  purpose: GrantPurpose;
  values: PlatformBodyValues;
  traceId: string;
}

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
