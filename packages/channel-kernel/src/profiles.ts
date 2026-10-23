// Provider trust profiles (ADR-011 §6, LTI contract §9.1). A profile is reviewed data: the launch code reads its
// flags and values and never branches on an LMS name. A profile change is an architecture change (ADR revision).

/** `exclusive`: one connection owns the platform with all its deployments. `shared`: one platform, one deployment per connection. */
export type ProfileSharing = 'exclusive' | 'shared';

/** Where the site origin of a launch lives (LTI contract §9.4); `null` = the issuer origin (`standard`). */
export type SiteUrlOn = 'platform' | 'deployment' | null;

export interface ProfileFlags {
  /** Deep Linking response JWT has `sub` = client id (F-BB-8). */
  readonly deepLinkingResponseSub: boolean;
  /** Client assertion `aud` = `[token endpoint]` (F-BB-5). */
  readonly clientAssertionAudArray: boolean;
  /** Launch check 13: service URL claims on the service origin, DL return URL on the site origin. */
  readonly serviceOriginCheck: boolean;
}

/** Profile data from a channel folder. The loader derives channel ownership and the provider-list lms value. */
export interface ProfileSource {
  readonly id: string;
  /** Admin endpoints are supplied at registration and stored as null here; fixed endpoints are values or templates. */
  readonly endpoints: 'admin' | 'fixed';
  /** The minimum claim filter; none is limited to PRIVACY_FLOOR_NONE_PROFILES and unknown values must minimize. */
  readonly privacyFloor: 'allowlist' | 'none';
  /** Client-side storage (LA-ADR-05 D1): absent means null. The registry supplies null for omitted values. */
  readonly platformStorage?: {
    /** from-login reads lti_storage_target; otherwise _parent or a frame name, 1 to 64 letters, digits, _ or -. */
    readonly targetFrame: string;
    /** authOrigin uses the authentication endpoint origin; otherwise a canonical https origin without a path. */
    readonly origin: string;
  } | null;
  /** LA-ADR-02 D2: `fixed` = one vendor issuer for every tenant; `per-tenant` = a `{siteUrl}` template or an admin value. */
  readonly issuerKind?: 'per-tenant' | 'fixed';
  /** LA-ADR-02 D2: where admin endpoints may be; `null` for fixed endpoints. */
  readonly endpointOrigins?: 'issuer' | 'any-https' | null;
  /** LA-ADR-02 D2: the client assertion `aud`: the token URL or the stored platform value, as a string or a one-item array. */
  readonly clientAssertionAud?: { readonly value: '{tokenEndpoint}' | '{platformValue}'; readonly form: 'string' | 'array' };
  /** LA-ADR-02 D2: add the `deployment_id` claim to the client assertion (R1 C-18). */
  readonly assertionDeploymentId?: boolean;
  /** LA-ADR-02 D2: the Dynamic Registration rule; `null` = no Dynamic Registration. */
  readonly dynamicRegistration?: {
    readonly issuerRule: 'origin' | 'path-prefix' | 'profile';
    /** The configuration URL must equal the issuer plus this path. */
    readonly configurationPath?: string;
    /** `scope-jwt`: a JWT with the scope claim `reg` or `reg-update`, verified with the platform JWKS; `opaque-bearer`: only sent back. */
    readonly registrationToken: 'scope-jwt' | 'opaque-bearer';
  } | null;
  /** Frozen compatibility value, allowed only on the baseline profiles. */
  readonly wireLms?: string | null;
  /** Real profiles precede simulations; each group sorts by this integer, then id. New profiles follow the baseline values. */
  readonly listOrder: number;
  /** Human text for `GET /api/providers`; tests must not compare it. */
  readonly label: string;
  readonly sharing: ProfileSharing;
  /**
   * Fixed values or templates. Templates: `{siteUrl}` (platform or deployment site origin), `{serviceUrl}` (Canvas
   * service origin, default `{siteUrl}`), `{clientId}` (inserted with encodeURIComponent). All four values are null
   * when endpoints is admin; registration validates the supplied values with the security §2.4 rules.
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
  /** Product family metadata for this profile; it does not define a guard. Guard ownership and level come from the manifest. */
  readonly productFamily: string | null;
  readonly flags: ProfileFlags;
  /** Site rule 5 (`canvas-self-hosted`): refused host suffixes. The fixed hosts of every profile are refused too. */
  readonly refusedHostSuffixes?: readonly string[];
  /** Research fact ids of the values (ADR-011 §6 "Source"). */
  readonly sources: readonly string[];
}

