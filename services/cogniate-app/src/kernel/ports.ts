/**
 * Public channel contract (LA-ADR-01 D5). Implement P2 in app.ts; P5–P7 get a per-call PortContext.
 * Types only: internal route dependencies live in kernel/setup/deps.ts and are not channel capabilities.
 * BD-A1-20/28: all context fields are required unless marked optional; callers and K0 fixtures fill them.
 */
import type { CapabilityId } from '@cogniate/channel-kernel';
import type { Logger, OutboundClient, PublicUrls } from '@cogniate/shared';

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
  status: 'pending' | 'registered' | 'connected' | 'disabled';
  /** Exclusive platform of the connection (self authority, exclusive profile), else null. */
  ltiPlatformId: string | null;
}

/** One row of `GET …/tool-configuration` (app contract §4.1, §4.5). */
export interface ToolRow {
  key: string;
  label: string;
  value: string;
}

/** Protocol URLs selected by the kernel; adapters do not construct account paths. */
export interface ToolUrls {
  /** OIDC login initiation URL. */
  readonly login: string;
  /** LTI launch and deep-link target URL. */
  readonly launch: string;
  /** Public signing-key set URL. */
  readonly keys: string;
  /** Dynamic registration URL before its reference query. */
  readonly register: string;
  /** Canonical public LTI origin for artifact domain values. */
  readonly ltiOrigin: string;
}

export interface ToolConfigurationContext {
  /** Tool account and URLs resolved by the kernel for this call (BD-A1-40). */
  toolAccountId: string;
  /** Kernel-built protocol URLs; do not reconstruct them. */
  toolUrls: ToolUrls;
  /** Public application origins for this call. */
  urls: PublicUrls;
  /** The current library display name. */
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

/**
 * Values or all unknown, missing and malformed body keys (422 INVALID_PLATFORM_VALUES).
 * reason:'origin' is only for URL-origin failures; core owns both frozen error descriptions (BD-A1-35).
 */
export type PlatformBodyResult = { ok: true; values: PlatformBodyValues } | { ok: false; fields: string[]; reason?: 'origin' };

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
export interface ProfileView {
  id: string;
  issuer: string | null;
  sharing: 'exclusive' | 'shared';
  serviceUrl: boolean;
  authenticationEndpoint?: string | null;
  accesstokenEndpoint?: string | null;
  jwksUrl?: string | null;
  sharedPlatform?: SharedPlatformInfo | null;
  label?: string;
  simulation?: boolean;
  siteUrlOn?: 'platform' | 'deployment' | null;
  lms?: string | null;
}
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
  | { kind: 'platform'; body: {
      url: string; clientId: string; name: string; authenticationEndpoint: string; accesstokenEndpoint: string;
      authConfig: { method: 'JWK_SET'; key: string }; deploymentIds: string[];
    } | {
      profile: string; url?: string; clientId: string; name: string; siteUrl: string; serviceUrl?: string; deploymentIds: string[];
    } }
  | { kind: 'deployment'; platformId: string; body: { deploymentId: string; siteUrl?: string } };

export interface CreateRequestContext {
  /** Tool account and URLs resolved by the kernel for this call (BD-A1-40). */
  toolAccountId: string;
  /** Kernel-built protocol URLs; do not reconstruct them. */
  toolUrls: ToolUrls;
  /** The library name used for the staged platform name. */
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
  /** Must equal the LTI profile sharing trait. */
  sharing: 'exclusive' | 'shared';
  /** Whether create accepts a separate service origin; must equal the LTI trait. */
  serviceUrl: boolean;
  /** App-only label in the frozen provider-list response. */
  label: string;
  /** Optional site-rule-5 suffixes; must equal the LTI profile data. */
  refusedHostSuffixes?: readonly string[];
}

/**
 * Pure setup functions: no database or LTI call. Validation refusals are result values, never thrown errors.
 * Every adapter needs channel, profiles, sharingOf, checkCreate, toolConfiguration and parseBindingBody.
 * BD-A1-20/28: manual + self requires selfCreate; operatorGrant requires initialTarget and createRequest.
 * A true extension capability requires its corresponding P5, P6 or P7 implementation.
 */
export interface ConnectionSetup {
  /** The owning manifest id. */
  readonly channel: string;
  /** Offered profiles; traits match lti-profiles.ts and cover all manifest registrations. */
  readonly profiles: Readonly<Record<string, AppProfileData>>;
  /** Return the offered profile sharing trait, or null when it is not offered. */
  sharingOf(profileId: string): AppProfileData['sharing'] | null;
  /** Apply channel rules after kernel method, profile and site checks; rule is the failed site-rule number. */
  checkCreate(input: { siteUrl: string; serviceUrl?: string; profile: ProfileView }):
    { ok: true; siteUrl: string; serviceUrl: string } | { ok: false; field: string; rule?: number };
  /** Return the ordered, frozen rows shown to an administrator. */
  toolConfiguration(ctx: ToolConfigurationContext): ToolRow[];
  /** Strictly collect initial or add_deployment values; origin reason is only for a URL-origin failure (BD-A1-35). */
  parseBindingBody(body: unknown, ctx: PlatformBodyContext & { purpose: GrantPurpose }): PlatformBodyResult;
  /** Required for manual + self: stage a platform from typed admin values without a grant. */
  selfCreate?(values: AdminValues & { clientId: string; deploymentId: string }, ctx: CreateRequestContext): StagedCreate;
  /** Required for operatorGrant: select the target using local snapshot values only. */
  initialTarget?(ctx: InitialTargetContext): BindingTarget;
  /** Required for operatorGrant: stage the target; the engine adds active:false and its binding ref. */
  createRequest?(target: BindingTarget, ctx: CreateRequestContext): StagedCreate;
  /** P5 handlers required when setup artifacts or siteApi.token capabilities are enabled. */
  extensionRoutes?: readonly ExtensionRoute[];
  /** P6 hooks required when publish.createCourse is enabled. */
  publishHooks?: readonly PublishHook[];
  /** P7 exporters required for every advertised export.packages member. */
  packageExporters?: readonly PackageExporter[];
}

/** The kernel creates this context for each call. A channel must not store it. */
export interface PortContext {
  /** Bound session library; every SQL statement must contain :library_id. */
  libraryId: string;
  /** Bound connection, or null for a course-version exporter. */
  connectionId: string | null;
  /** Scoped storage access; never a raw database handle. */
  sql: ChannelSql;
  /** The shared SSRF-guarded outbound client. */
  outbound: GuardedClient;
  /** Asynchronously encrypt an extension secret through the kernel key owner. */
  seal(value: string): Promise<Uint8Array>;
  /** Asynchronously decrypt a sealed extension secret. */
  unseal(blob: Uint8Array): Promise<string>;
  /** The call logger; never include secret values. */
  logger: Logger;
  /** Correlation id for this call. */
  traceId: string;
  /** Kernel clock in epoch milliseconds. */
  now(): number;
  /** Public origins, resolved for this call. */
  urls: PublicUrls;
  /** The signed-in library name used in setup artifacts. */
  libraryName: string;
  /** The tool account selected by the kernel. */
  toolAccountId: string;
  /** Protocol URLs resolved by the kernel; never build an account path in a channel. */
  toolUrls: ToolUrls;
  /** Active key first; public RSA members only. */
  publicToolKeys(): Promise<{ ok: true; keys: PublicJwk[] } | { ok: false }>;
}
export interface PublicJwk { kty: string; kid: string; alg: string; use: string; n: string; e: string }
export type GuardedClient = OutboundClient;

/** The kernel binds :library_id and, when present, :connection_id. */
export interface ChannelSql {
  /** Read one row or undefined; refuses a missing scope parameter. */
  get<T>(statement: string, params?: Record<string, unknown>): T | undefined;
  /** Read all rows with the bound library and optional connection. */
  all<T>(statement: string, params?: Record<string, unknown>): T[];
  /** Write with bound scope and return the changed-row count. */
  run(statement: string, params?: Record<string, unknown>): { changes: number };
}
export interface ExtensionRoute {
  /** HTTP method under the connection route. */
  method: 'GET' | 'PUT' | 'POST';
  /** Frozen legacy suffix or x/<name>; the kernel mounts it once. */
  path: string;
  /** Capability checked before invoking the handler. */
  capability: CapabilityId;
  /** Frozen details.capability value for a refused legacy route. */
  legacyCapabilityName?: string;
  /** Run after ownership and capability checks; return success or an error the kernel renders. */
  handle(input: { body: unknown; query: Record<string, string> }, ctx: PortContext): Promise<
    { status: number; body: unknown; headers?: Record<string, string> } |
    { error: { status: number; code: string; message: string; details?: Record<string, unknown> } }>;
}
/** Read-only publication fields needed by a publish hook. Extension state is read through scoped SQL. */
export interface PublicationView {
  readonly id: string;
  readonly connectionId: string;
  readonly courseId: string;
  readonly courseTitle: string;
  readonly courseVariant: string;
  readonly courseLang: string;
  readonly siteUrl: string;
  readonly channel: string;
}
/** Version and checked package metadata for a course-version exporter. */
export interface CourseVersionView {
  readonly id: string;
  readonly courseId: string;
  readonly version: number;
  readonly format: string;
  readonly packageId: string;
  readonly title: string;
  readonly variant: string;
  readonly lang: string;
  readonly packageSha256: string;
}
/** Frozen build response: times are ISO strings, and downloadUrl is present only for a ready build. */
export interface ExportBuildView {
  readonly buildId: string;
  readonly courseId: string;
  readonly versionId: string;
  readonly status: 'queued' | 'running' | 'ready' | 'failed';
  readonly step: string | null;
  readonly reason: string | null;
  readonly bytes: number | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly finishedAt: string | null;
  readonly downloadUrl: string | null;
}
/** Only exporters receive the confined file queue. */
export interface ExporterContext extends PortContext { buildQueue: BuildQueue }
export interface BuildQueue {
  /** Atomically write a request; the kernel sets buildId and the configured build knobs. */
  submit(buildId: string, request: Record<string, unknown>): Promise<void>;
  /** Read a bounded JSON status file; absent or invalid data is null. */
  status(buildId: string): Promise<unknown | null>;
  /** Read the bounded runner heartbeat file. */
  runner(): Promise<unknown | null>;
  /** Whether this library's request is still waiting in the queue; no file content is read. */
  pending(buildId: string): Promise<boolean>;
}

export interface PublishHook {
  /** Frozen request flag that selects this hook. */
  option: string;
  /** Capability checked before publication changes. */
  capability: CapabilityId;
  /** Validate the flag value before any write; return field names on refusal. */
  parseOptions(value: unknown): { ok: true; options: unknown } | { ok: false; fields: string[] };
  /** Run the selected action after the core publication write with parsed options. */
  afterPublish(publication: PublicationView, options: unknown, ctx: PortContext): Promise<void>;
  /** Return only frozen extension DTO names allowed by legacy-wire.ts. */
  dtoFields(publication: PublicationView, ctx: PortContext): Record<string, unknown>;
}
export interface PackageExporter {
  /** Export kind advertised by the manifest and fixed download wire table. */
  id: string;
  /** Accepted course package formats. */
  formats: readonly string[];
  /** Reserve or return a build for this library and version. */
  start(version: CourseVersionView, ctx: ExporterContext): Promise<ExportBuildView>;
  /** Refresh runner state and return the latest build, or null. */
  latest(version: CourseVersionView, ctx: ExporterContext): Promise<ExportBuildView | null>;
  /** Return an artifact id or null; the kernel confines and streams the file. */
  download(version: CourseVersionView, ctx: ExporterContext): Promise<{ artifact: string; mediaType: string; filename: string } | null>;
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

