// Capability catalog (LA-ADR-01 D3). The kernel owns the catalog: a channel cannot invent a capability. A new
// capability is a kernel change with a test (an ADR revision). Each capability has ONE rule that computes its value
// (the "source"); a manifest may set only the capabilities whose source is the manifest.

export type RegistrationMethod = 'dynamic' | 'manual';
/** Binding authority of a method (D7). `verifiedAdminLaunch` is reserved (LA-ADR-08, Could): not accepted in LA. */
export type BindingAuthority = 'self' | 'operatorGrant';
export type PlatformSharing = 'exclusive' | 'shared';

/** The full capability set of a channel (and of one of its profiles). Keys are capability ids, in catalog order. */
export interface CapabilitySet {
  'registration.dynamic': boolean;
  'binding.authority': Partial<Record<RegistrationMethod, BindingAuthority>>;
  'registration.scopes': readonly string[];
  /** Profile trait `sharing`: absent when no profile is given. */
  'platform.sharing'?: PlatformSharing;
  'deployments.multiple': boolean;
  /** Profile trait `serviceUrl`: absent when no profile is given. */
  'site.serviceOrigin'?: boolean;
  'setup.artifacts': readonly string[];
  'siteApi.token': boolean;
  'publish.createCourse': boolean;
  'export.packages': readonly string[];
  'content.multiple': boolean;
  'content.ungraded': boolean;
  'launch.windowHint': boolean;
  'launch.topLevelContinue': boolean;
  'records.reporters': readonly string[];
  'records.readBack': boolean;
  'setup.connectionCheck': boolean;
}

export type CapabilityId = keyof CapabilitySet;

/** Where the value of a capability comes from (D3 column "Source"). */
export type CapabilitySource =
  | 'manifest' // manifest `capabilities`
  | 'registration' // manifest `registration` (methods and authorities), plus the profile trait for `registration.dynamic`
  | 'profile' // an LTI profile trait
  | 'setup'; // manifest `setup`

export interface CapabilitySpec {
  kind: 'boolean' | 'list' | 'sharing' | 'authorityMap';
  source: CapabilitySource;
}

/** The catalog, in the order of the D3 table. The order is also the key order of every computed set. */
export const CAPABILITY_CATALOG: Readonly<Record<CapabilityId, CapabilitySpec>> = {
  'registration.dynamic': { kind: 'boolean', source: 'registration' },
  'binding.authority': { kind: 'authorityMap', source: 'registration' },
  'registration.scopes': { kind: 'list', source: 'manifest' },
  'platform.sharing': { kind: 'sharing', source: 'profile' },
  'deployments.multiple': { kind: 'boolean', source: 'manifest' },
  'site.serviceOrigin': { kind: 'boolean', source: 'profile' },
  'setup.artifacts': { kind: 'list', source: 'manifest' },
  'siteApi.token': { kind: 'boolean', source: 'manifest' },
  'publish.createCourse': { kind: 'boolean', source: 'manifest' },
  'export.packages': { kind: 'list', source: 'manifest' },
  'content.multiple': { kind: 'boolean', source: 'manifest' },
  'content.ungraded': { kind: 'boolean', source: 'manifest' },
  'launch.windowHint': { kind: 'boolean', source: 'manifest' },
  'launch.topLevelContinue': { kind: 'boolean', source: 'manifest' },
  'records.reporters': { kind: 'list', source: 'manifest' },
  'records.readBack': { kind: 'boolean', source: 'manifest' },
  'setup.connectionCheck': { kind: 'boolean', source: 'setup' },
};

export const CAPABILITY_IDS = Object.keys(CAPABILITY_CATALOG) as readonly CapabilityId[];

/** The capability ids that a manifest may set in `capabilities` (source `manifest`). */
export type ManifestCapabilityId =
  | 'registration.scopes' | 'deployments.multiple' | 'setup.artifacts' | 'siteApi.token' | 'publish.createCourse'
  | 'export.packages' | 'content.multiple' | 'content.ungraded' | 'launch.windowHint' | 'launch.topLevelContinue'
  | 'records.reporters' | 'records.readBack';

/** Manifest `capabilities`: absent = false or empty (D2). */
export type ManifestCapabilities = Partial<Pick<CapabilitySet, ManifestCapabilityId>>;

/**
 * The profile traits that a capability rule reads. The LTI profile definition and a `GET /api/providers` row both fit.
 * `dynamicRegistration` is the E2 trait (LA-ADR-02 D2): `null` = the profile does not allow Dynamic Registration;
 * absent = no limit (the E1 profiles do not have the trait yet).
 */
export interface ProfileTraits {
  id?: string;
  sharing?: PlatformSharing;
  serviceUrl?: boolean;
  dynamicRegistration?: unknown;
}

/** The manifest parts that the capability rules read. */
export interface CapabilityInput {
  registration: ReadonlyArray<{ method: RegistrationMethod; authority: BindingAuthority; profiles: readonly string[] }>;
  capabilities: ManifestCapabilities;
  setup: { connectionCheck?: boolean };
}

/** Compute the capability set of a channel; with a profile, also its profile capabilities (D3 "Source"). */
export function computeCapabilities(input: CapabilityInput, profile?: ProfileTraits): CapabilitySet {
  const m = input.capabilities;
  const dynamic = input.registration.find((r) => r.method === 'dynamic');
  const profileAllowsDynamic = profile === undefined
    || ((profile.id === undefined || (dynamic?.profiles.includes(profile.id) ?? false)) && profile.dynamicRegistration !== null);
  return {
    'registration.dynamic': dynamic !== undefined && profileAllowsDynamic,
    'binding.authority': Object.fromEntries(input.registration.map((r) => [r.method, r.authority])),
    'registration.scopes': [...(m['registration.scopes'] ?? [])],
    ...(profile?.sharing !== undefined ? { 'platform.sharing': profile.sharing } : {}),
    'deployments.multiple': m['deployments.multiple'] ?? false,
    ...(profile?.serviceUrl !== undefined ? { 'site.serviceOrigin': profile.serviceUrl } : {}),
    'setup.artifacts': [...(m['setup.artifacts'] ?? [])],
    'siteApi.token': m['siteApi.token'] ?? false,
    'publish.createCourse': m['publish.createCourse'] ?? false,
    'export.packages': [...(m['export.packages'] ?? [])],
    'content.multiple': m['content.multiple'] ?? false,
    'content.ungraded': m['content.ungraded'] ?? false,
    'launch.windowHint': m['launch.windowHint'] ?? false,
    'launch.topLevelContinue': m['launch.topLevelContinue'] ?? false,
    'records.reporters': [...(m['records.reporters'] ?? [])],
    'records.readBack': m['records.readBack'] ?? false,
    'setup.connectionCheck': input.setup.connectionCheck ?? false,
  };
}

/** A load-check failure: a stable reason code and a detail for the operator (no secret). */
export interface CheckProblem {
  reason: string;
  detail: string;
}

/**
 * Load check 4 on one manifest `capabilities` object: every id is in the catalog, has source `manifest` and a value of
 * its kind; `publish.createCourse` needs `siteApi.token`. Returns the first failure, or null.
 */
export function capabilityProblem(capabilities: Readonly<Record<string, unknown>>): CheckProblem | null {
  for (const [id, value] of Object.entries(capabilities)) {
    const spec = (CAPABILITY_CATALOG as Readonly<Record<string, CapabilitySpec>>)[id];
    if (spec === undefined) return { reason: 'capability_unknown', detail: id };
    if (spec.source !== 'manifest') return { reason: 'capability_not_manifest', detail: `${id} comes from ${spec.source}` };
    const ok = spec.kind === 'boolean' ? typeof value === 'boolean'
      : Array.isArray(value) && value.every((v) => typeof v === 'string' && v.length > 0);
    if (!ok) return { reason: 'capability_value', detail: `${id} must be a ${spec.kind === 'boolean' ? 'boolean' : 'list of strings'}` };
  }
  if (capabilities['publish.createCourse'] === true && capabilities['siteApi.token'] !== true) {
    return { reason: 'create_course_needs_site_api_token', detail: 'publish.createCourse needs siteApi.token' };
  }
  return null;
}
