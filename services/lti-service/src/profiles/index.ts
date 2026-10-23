// The ONE provider profile registry (ADR-011 §6, LTI contract §9.1, §9.3). Provider data lives in one file per LMS
// (standard.ts, canvas.ts, blackboard.ts); this module only orders, finds and fills them.
import { fixedHostsOf, originHost } from '@cogniate/shared';
import type { SiteRuleInput } from '@cogniate/shared';
import { BLACKBOARD_PROFILES } from './blackboard.ts';
import { CANVAS_PROFILES } from './canvas.ts';
import { STANDARD_PROFILE_ID, STANDARD_PROFILES } from './standard.ts';
import type { ProfileEndpoints, ProfileTemplateValues, ProviderProfile } from './types.ts';

export type { ProfileEndpoints, ProfileFlags, ProfileLms, ProfileSharing, ProfileTemplateValues, ProviderProfile, SiteUrlOn } from './types.ts';
export { STANDARD_PROFILE_ID };

export interface ProfileOptions {
  /** Simulation profiles are on (LTI contract §9.13). */
  simulation: boolean;
}

/** On only when the service profile is `acceptance` AND `LTI_PROVIDER_SIMULATION=on` (LTI contract §9.13). */
export function simulationEnabled(serviceProfile: string, env: Record<string, string | undefined>): boolean {
  return serviceProfile === 'acceptance' && env.LTI_PROVIDER_SIMULATION === 'on';
}

/**
 * Every known profile in the order of LTI contract §9.3: standard, the Canvas profiles, blackboard, then the
 * simulation profiles blackboard-sim and canvas-sim-cloud (only when they are on).
 */
export function listProfiles(opts: ProfileOptions): readonly ProviderProfile[] {
  const real = [...STANDARD_PROFILES, ...CANVAS_PROFILES, ...BLACKBOARD_PROFILES].filter((p) => !p.simulation);
  if (!opts.simulation) return real;
  return [...real, ...BLACKBOARD_PROFILES.filter((p) => p.simulation), ...CANVAS_PROFILES.filter((p) => p.simulation)];
}

/** The profile with this id, or null (an unknown id, or a simulation id while simulations are off). */
export function findProfile(id: string, opts: ProfileOptions): ProviderProfile | null {
  return listProfiles(opts).find((p) => p.id === id) ?? null;
}

/**
 * A profile by id whatever the simulation setting. Only for structure (sharing, flags, LMS name) of a STORED row:
 * every run-time permission uses findProfile, so a simulation row while simulations are off is inactive.
 */
export function profileDefinition(id: string): ProviderProfile | null {
  return listProfiles({ simulation: true }).find((p) => p.id === id) ?? null;
}

export const isStandardProfile = (p: ProviderProfile): boolean => p.id === STANDARD_PROFILE_ID;
export const isSharedProfile = (p: ProviderProfile): boolean => p.sharing === 'shared';

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

/**
 * Reserved issuer origins (LTI contract §9.1): the fixed issuer origin of every profile other than `standard`
 * (`https://blackboard.com`, the Canvas cloud issuers, and the simulation issuers when they are on).
 */
export function reservedIssuerOrigins(opts: ProfileOptions): string[] {
  const out = new Set<string>();
  for (const p of listProfiles(opts)) {
    if (isStandardProfile(p) || p.issuer === null || p.issuer.startsWith('{')) continue;
    out.add(new URL(p.issuer).origin);
  }
  return [...out];
}

/** The profile whose fixed issuer has this origin (error page texts before a platform is known, security §12). */
export function profileOfFixedIssuer(issuerOrigin: string, opts: ProfileOptions): ProviderProfile | null {
  return listProfiles(opts).find((p) => !isStandardProfile(p) && p.issuer !== null && !p.issuer.startsWith('{') && new URL(p.issuer).origin === issuerOrigin) ?? null;
}

export type LmsName = 'Moodle' | 'Canvas' | 'Blackboard';

/** The LMS name in texts (security §12): Canvas profiles → Canvas, Blackboard profiles → Blackboard, else Moodle. */
export function lmsNameOf(p: ProviderProfile | null): LmsName {
  return p?.lms === 'canvas' ? 'Canvas' : p?.lms === 'blackboard' ? 'Blackboard' : 'Moodle';
}

/** The LMS name of a signed product family (check 14 page text), or null for any other value. */
export function lmsNameOfFamily(family: string): LmsName | null {
  const f = family.toLowerCase();
  return f === 'canvas' ? 'Canvas' : f === 'blackboardlearn' ? 'Blackboard' : null;
}

/** Site rule input of the shared site-rule function for one profile (rules 3 to 5). */
export function siteRulesFor(p: ProviderProfile, ownOrigins: readonly string[], opts: ProfileOptions): SiteRuleInput {
  return {
    ownHosts: ownOrigins.map(originHost),
    profileFixedHosts: profileFixedHosts(p),
    ...(p.refusedHostSuffixes ? { selfHosted: { refusedSuffixes: p.refusedHostSuffixes, allFixedHosts: allFixedHosts(opts) } } : {}),
  };
}
