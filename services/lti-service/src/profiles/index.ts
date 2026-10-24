// The LTI profile registry loads channel folders once, before the service accepts requests (LA-ADR-01 D4, D6).
import { fileURLToPath } from 'node:url';
import { RegistryError, STANDARD_PROFILE_ID, loadChannelFolders } from '@cogniate/channel-kernel';
import { createLogger, fixedHostsOf, originHost } from '@cogniate/shared';
import type { Logger, SiteRuleInput } from '@cogniate/shared';
import { buildProfileRegistry } from './registry.ts';
import type { ProfileRegistry } from './registry.ts';
import type { ProfileEndpoints, ProfileTemplateValues, ProviderProfile } from './types.ts';

export type { ProfileEndpoints, ProfileFlags, ProfileSharing, ProfileSource, ProfileTemplateValues, ProviderProfile, SiteUrlOn } from './types.ts';
export type { ProfileRegistry } from './registry.ts';
export { STANDARD_PROFILE_ID, buildProfileRegistry };

/** Product code has one fixed root. Tests may pass an extra root to loadProfileRegistry. */
export const CHANNEL_ROOT = fileURLToPath(new URL('../../../../packages/channels/', import.meta.url));

export async function loadProfileRegistry(roots: readonly string[], logger: Logger): Promise<ProfileRegistry> {
  try {
    return buildProfileRegistry(await loadChannelFolders(roots, 'lti'));
  } catch (err) {
    if (err instanceof RegistryError) {
      logger.error('channel_registry_invalid', { channel: err.channel, reason: err.reason, check: err.check, detail: err.detail });
    }
    throw err;
  }
}

const registry = await loadProfileRegistry([CHANNEL_ROOT], createLogger({ service: 'lti-service' }));

export interface ProfileOptions {
  /** Simulation profiles are on (LTI contract §9.13). */
  simulation: boolean;
  /** A test registry supplied by the caller. Product code uses the discovered registry. */
  registry?: ProfileRegistry;
}

const registryOf = (opts: ProfileOptions): ProfileRegistry => opts.registry ?? registry;

/** On only when the service profile is `acceptance` AND `LTI_PROVIDER_SIMULATION=on` (LTI contract §9.13). */
export function simulationEnabled(serviceProfile: string, env: Record<string, string | undefined>): boolean {
  return serviceProfile === 'acceptance' && env.LTI_PROVIDER_SIMULATION === 'on';
}

/**
 * Every known profile in the order of LTI contract §9.3: standard, the Canvas profiles, blackboard, then the
 * simulation profiles blackboard-sim and canvas-sim-cloud (only when they are on).
 */
export function listProfiles(opts: ProfileOptions): readonly ProviderProfile[] {
  return registryOf(opts).listProfiles(opts.simulation);
}

/** The profile with this id, or null (an unknown id, or a simulation id while simulations are off). */
export function findProfile(id: string, opts: ProfileOptions): ProviderProfile | null {
  return listProfiles(opts).find((p) => p.id === id) ?? null;
}

/**
 * A profile by id whatever the simulation setting. Only for structure (sharing, flags, LMS name) of a STORED row:
 * every run-time permission uses findProfile, so a simulation row while simulations are off is inactive.
 */
export function profileDefinition(id: string, opts: ProfileOptions = { simulation: true }): ProviderProfile | null {
  return registryOf(opts).listProfiles(true).find((p) => p.id === id) ?? null;
}

/** Compatibility helper for callers that move to the trait in LA-E1-10. */
export const isStandardProfile = (p: ProviderProfile): boolean => p.endpoints === 'admin';
export const isSharedProfile = (p: ProviderProfile): boolean => p.sharing === 'shared';

export const channelRegistry = (opts: ProfileOptions) => registryOf(opts).channels(opts.simulation);

/** Fill `{siteUrl}`, `{serviceUrl}` (default: the site URL) and `{clientId}` (encoded) in a profile value. */
export function fillTemplate(value: string, v: ProfileTemplateValues): string {
  return value.replace(/\{(siteUrl|serviceUrl|clientId)\}/g, (_m, name: string) => {
    const filled = name === 'siteUrl' ? v.siteUrl : name === 'serviceUrl' ? (v.serviceUrl ?? v.siteUrl) : (v.clientId ? encodeURIComponent(v.clientId) : null);
    if (!filled) throw new Error(`profile template value {${name}} is missing`);
    return filled;
  });
}

/** The issuer and endpoints of a profile other than `standard`, filled with the platform values. */
export function profileEndpoints(p: ProviderProfile, v: ProfileTemplateValues): ProfileEndpoints {
  if (p.issuer === null || p.authenticationEndpoint === null || p.accesstokenEndpoint === null || p.jwksUrl === null) {
    throw new Error(`profile ${p.id} has admin values; it has no fixed endpoints`);
  }
  return {
    issuer: fillTemplate(p.issuer, v), authenticationEndpoint: fillTemplate(p.authenticationEndpoint, v),
    accesstokenEndpoint: fillTemplate(p.accesstokenEndpoint, v), jwksUrl: fillTemplate(p.jwksUrl, v),
  };
}

/** Fixed hosts of a profile (ADR-011 §6): hosts of its fixed issuer, auth, JWKS and token URLs. */
export function profileFixedHosts(p: ProviderProfile): string[] {
  return fixedHostsOf([p.issuer, p.authenticationEndpoint, p.accesstokenEndpoint, p.jwksUrl]);
}

export function allFixedHosts(opts: ProfileOptions): string[] {
  return [...new Set(listProfiles(opts).flatMap(profileFixedHosts))];
}

/** Profiles with a reserved issuer, in registry order. Admin values and site templates are not reserved. */
function reservedIssuerProfiles(opts: ProfileOptions): readonly ProviderProfile[] {
  return listProfiles(opts).filter((p) => p.endpoints === 'fixed' && p.issuer !== null && !p.issuer.startsWith('{'));
}

/** Reserved issuer origins (LTI contract §9.1), including simulation issuers only when they are on. */
export function reservedIssuerOrigins(opts: ProfileOptions): string[] {
  return [...new Set(reservedIssuerProfiles(opts).map((p) => new URL(p.issuer!).origin))];
}

/** Text names of the reserved-issuer owners, once per channel in profile order (BD-A1-31). */
export function reservedIssuerLmsNames(opts: ProfileOptions = { simulation: true }): string {
  const channels = channelRegistry(opts);
  const owners = [...new Set(reservedIssuerProfiles(opts).map((p) => p.channel))];
  const names = owners.map((owner) => channels.textName(owner));
  const last = names.pop() ?? '';
  return names.length === 0 ? last : `${names.join(', ')} or ${last}`;
}

/** The profile whose fixed issuer has this origin (error page texts before a platform is known, security §12). */
export function profileOfFixedIssuer(issuerOrigin: string, opts: ProfileOptions): ProviderProfile | null {
  return reservedIssuerProfiles(opts).find((p) => new URL(p.issuer!).origin === issuerOrigin) ?? null;
}

export type LmsName = string;

/** The manifest text name of the profile owner, with the standard channel as fallback (security §12). */
export function lmsNameOf(p: ProviderProfile | null, opts: ProfileOptions = { simulation: true }): LmsName {
  return registryOf(opts).channels(true).textName(p?.channel ?? null);
}

/** The LMS name of a signed product family (check 14 page text), or null for any other value. */
export function lmsNameOfFamily(family: string, opts: ProfileOptions = { simulation: true }): LmsName | null {
  const channels = registryOf(opts).channels(true);
  const owner = channels.ownerOfFamily(family);
  return owner === null ? null : channels.textName(owner);
}

/** Site rule input of the shared site-rule function for one profile (rules 3 to 5). */
export function siteRulesFor(p: ProviderProfile, ownOrigins: readonly string[], opts: ProfileOptions): SiteRuleInput {
  return {
    ownHosts: ownOrigins.map(originHost),
    profileFixedHosts: profileFixedHosts(p),
    ...(p.refusedHostSuffixes ? { selfHosted: { refusedSuffixes: p.refusedHostSuffixes, allFixedHosts: allFixedHosts(opts) } } : {}),
  };
}
