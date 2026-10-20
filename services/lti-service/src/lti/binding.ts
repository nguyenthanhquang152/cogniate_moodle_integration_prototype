// The run-time state of a stored platform and deployment (LTI contract §9.1, §9.14): profile, usability, origins.
import type { LmsName, ProfileOptions, ProviderProfile } from '../profiles/index.ts';
import { findProfile, lmsNameOf, profileDefinition } from '../profiles/index.ts';
import type { DeploymentRecord, Platform } from '../store/platforms.ts';

/** The profile of a stored platform at run time, or null when the profile is unknown now (treated as inactive). */
export function platformProfile(p: Platform, opts: ProfileOptions): ProviderProfile | null {
  return findProfile(p.profile, opts);
}

/** A platform takes logins, launches and API calls only when it is active AND its profile is known now. */
export function isPlatformUsable(p: Platform, opts: ProfileOptions): boolean {
  return p.active && platformProfile(p, opts) !== null;
}

/** The LMS name of a stored platform for texts (security §12); a stored unknown profile keeps its LMS name. */
export function platformLmsName(p: Platform | null): LmsName {
  return lmsNameOf(p ? profileDefinition(p.profile) : null);
}

/** The deployment of a launch or service key, or null when the platform has no such row. */
export function deploymentOf(p: Platform, deploymentId: string): DeploymentRecord | null {
  return p.deployments.find((d) => d.deploymentId === deploymentId) ?? null;
}
