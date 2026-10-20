// LMS provider adapters of the app (ADR-011 §7, §11; app contract §4.2–§4.5). An adapter is small provider data and
// pure functions: the body of `PUT …/platform`, the tool configuration rows, the binding target and the staged create
// request of a redemption. The common engine (app/redemption.ts) owns every check, the sequencing, the refs and the
// authority; an adapter never calls the LTI service and never writes the database.
import type { Logger, PublicUrls } from '@cogniate/shared';
import type { LtiClient, LtiProviderProfile } from '../clients/lti-client.ts';
import type { Connection, ConnectionMethod, ConnectionStatus } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';

export type { LtiProviderProfile } from '../clients/lti-client.ts';

export type LmsType = 'moodle' | 'canvas' | 'blackboard';
export const LMS_TYPES: readonly LmsType[] = ['moodle', 'canvas', 'blackboard'];

/** LMS name in texts (app contract §6.1). */
export type LmsName = 'Moodle' | 'Canvas' | 'Blackboard';

/** ADR-011 §11. Derived from the LMS type, never stored. */
export interface Capabilities {
  dynamicRegistration: boolean;
  operatorApproval: boolean;
  webServices: boolean;
  courseShell: boolean;
  addDeployment: boolean;
  canvasConfiguration: boolean;
}

/** The connection fields that an adapter may read. */
export interface ProviderConnection {
  id: string;
  libraryId: string;
  name: string;
  lms: LmsType;
  /** LTI service profile id. */
  profile: string;
  /** Canonical site origin. */
  siteUrl: string;
  /** Canonical service origin (Canvas; equals `siteUrl` for Moodle and Blackboard). */
  serviceUrl: string;
  status: ConnectionStatus;
  /** Exclusive platform of the connection (Moodle, Canvas), else null. */
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
  /** Client id of the active shared platform of the connection's profile (Blackboard Application ID), else null. */
  sharedClientId: string | null;
}

/** The values of a strict `PUT …/platform` body (app contract §4.4) or `POST …/deployments` body (§4.7.2). */
export interface PlatformBodyValues {
  clientId: string;
  deploymentId: string;
  grantCode: string;
}

/** Parse result: the values, or the body keys that are unknown, missing or malformed (`422 INVALID_PLATFORM_VALUES`). */
export type PlatformBodyResult = { ok: true; values: PlatformBodyValues } | { ok: false; fields: string[] };

export interface PlatformBodyContext {
  /** Client id of the active shared platform of the connection's profile, else null. */
  sharedClientId: string | null;
}

/**
 * The remote record of one redemption (app contract §4.7.1 "Target"). The kind tells an exclusive platform apart from
 * a deployment of a platform: Canvas `initial` makes an exclusive platform; Canvas `add_deployment` adds a deployment
 * to the connection's own exclusive platform; Blackboard binds one deployment of the shared platform.
 */
export type BindingTarget =
  | {
    kind: 'exclusive_platform';
    profile: string;
    /** Canonical issuer: the profile issuer, or the canonical site URL for `canvas-self-hosted`. */
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

export interface InitialTargetContext {
  connection: ProviderConnection;
  values: PlatformBodyValues;
  /** The connection's profile row of `GET /api/providers` (LTI contract §9.3). */
  profile: LtiProviderProfile;
  /** The active shared platform of a shared profile, else null. */
  sharedPlatform: SharedPlatformInfo | null;
}

/** S1 request without `active` and `bindingRef` (the engine adds `active: false` and the write-ahead ref). */
export type StagedCreate =
  | {
    kind: 'platform';
    body: { profile: string; clientId: string; name: string; siteUrl: string; serviceUrl?: string; deploymentIds: string[] };
  }
  | { kind: 'deployment'; platformId: string; body: { deploymentId: string; siteUrl?: string } };

export interface CreateRequestContext {
  libraryName: string;
}

export interface ProviderAdapter {
  readonly lms: LmsType;
  /** Name in texts. */
  readonly lmsName: LmsName;
  /** `GET /app-api/lms-providers` label. */
  readonly label: string;
  readonly methods: readonly ConnectionMethod[];
  readonly capabilities: Capabilities;
  /** Profile when `POST /app-api/connections` has none. */
  readonly defaultProfile: string;
  /** `POST /app-api/connections` accepts `serviceUrl` (Canvas). */
  readonly acceptsServiceUrl: boolean;
  /** Site rule 5 refused host suffixes of a profile (`canvas-self-hosted`), else null. */
  siteRuleSuffixes(profileId: string): readonly string[] | null;
  /** App label of a profile id of this LMS (`GET /app-api/lms-providers`), or null when the adapter does not offer it. */
  profileLabel(profileId: string): string | null;
  /** Tool configuration rows (app contract §4.1, §4.5), in order. */
  toolConfiguration(ctx: ToolConfigurationContext): ToolRow[];
  /** Strict `PUT …/platform` body. Absent for Moodle (the unchanged §4 body). */
  parsePlatformBody?(body: unknown, ctx: PlatformBodyContext): PlatformBodyResult;
  /** The target of an `initial` redemption. Absent for Moodle. */
  initialTarget?(ctx: InitialTargetContext): BindingTarget;
  /** The S1 create of a target (`active` and `bindingRef` are added by the engine). Absent for Moodle. */
  createRequest?(target: BindingTarget, ctx: CreateRequestContext): StagedCreate;
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
 * Deps of the provider route modules (Canvas configuration and deployments). `redeem` is the ONLY way to bind: it
 * runs phase 1, the LTI steps, phase 2 and the compensation, and throws the contract ApiError on any refusal. It
 * also answers a finalized repeat (§4.4, §4.7.2) without a grant check or an LTI call.
 */
export interface ProviderRouteDeps {
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
