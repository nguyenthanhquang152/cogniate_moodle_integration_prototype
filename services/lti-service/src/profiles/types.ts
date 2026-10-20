// Provider trust profiles (ADR-011 §6, LTI contract §9.1). A profile is reviewed data: the launch code reads its
// flags and values and never branches on an LMS name. A profile change is an architecture change (ADR revision).

/** LMS of a profile. `null` = `standard` (Moodle and other platforms with admin values). */
export type ProfileLms = 'canvas' | 'blackboard';

/** `exclusive`: one connection owns the platform with all its deployments. `shared`: one platform, one deployment per connection. */
export type ProfileSharing = 'exclusive' | 'shared';

/** Where the site origin of a launch lives (LTI contract §9.4); `null` = the issuer origin (`standard`). */
export type SiteUrlOn = 'platform' | 'deployment' | null;

export interface ProfileFlags {
  /** Deep Linking response JWT has `sub` = client id (F-BB-8). */
  readonly deepLinkingResponseSub: boolean;
  /** Client assertion `aud` = `[token endpoint]` (F-BB-5). */
  readonly clientAssertionAudArray: boolean;
  /** Claim allowlist before the launch is stored (ADR-011 §9). */
  readonly minimizeClaims: boolean;
  /** Launch check 13: service URL claims on the service origin, DL return URL on the site origin. */
  readonly serviceOriginCheck: boolean;
}

export interface ProviderProfile {
  readonly id: string;
  readonly lms: ProfileLms | null;
  /** Human text for `GET /api/providers`; tests must not compare it. */
  readonly label: string;
  readonly sharing: ProfileSharing;
  /**
   * Fixed values or templates. Templates: `{siteUrl}` (platform or deployment site origin), `{serviceUrl}` (Canvas
   * service origin, default `{siteUrl}`), `{clientId}` (inserted with encodeURIComponent). `null` = an admin value
   * (`standard` only, security §2.4 rules).
   */
  readonly issuer: string | null;
  readonly authenticationEndpoint: string | null;
  readonly accesstokenEndpoint: string | null;
  readonly jwksUrl: string | null;
  readonly siteUrlOn: SiteUrlOn;
  /** A separate service URL is allowed on the platform (every Canvas profile). */
  readonly serviceUrl: boolean;
  /** Exists only when simulations are on (LTI contract §9.13). */
  readonly simulation: boolean;
  /** Signed `tool_platform.product_family_code` of this LMS, lower case (launch check 14); `null` for `standard`. */
  readonly productFamily: string | null;
  readonly flags: ProfileFlags;
  /** Site rule 5 (`canvas-self-hosted`): refused host suffixes. The fixed hosts of every profile are refused too. */
  readonly refusedHostSuffixes?: readonly string[];
  /** Research fact ids of the values (ADR-011 §6 "Source"). */
  readonly sources: readonly string[];
}

/** The filled issuer and endpoints of one platform. */
export interface ProfileEndpoints {
  issuer: string;
  authenticationEndpoint: string;
  accesstokenEndpoint: string;
  jwksUrl: string;
}

/** Template values (canonical origins; the client id raw, it is encoded where it is inserted). */
export interface ProfileTemplateValues {
  siteUrl?: string | null;
  serviceUrl?: string | null;
  clientId?: string | null;
}
