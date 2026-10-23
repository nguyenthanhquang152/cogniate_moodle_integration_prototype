import { ApiError } from '../api-errors.ts';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import type { ProfileOptions } from '../profiles/index.ts';
import { findProfile, isSharedProfile, profileEndpoints } from '../profiles/index.ts';
import { requireWritableAccount } from './accounts.ts';
import { createPlatform, findSharedPlatform } from './platforms.ts';

export interface SharedPlatformInput { account: string; profile: string; clientId: string; name?: string }

/** Preflight before audit.change; the store repeats it in its transaction. */
export function checkSharedPlatform(db: Db, opts: ProfileOptions, input: SharedPlatformInput) {
  requireWritableAccount(db, input.account);
  const profile = findProfile(input.profile, opts);
  if (!profile) throw new ApiError('UNKNOWN_PROFILE', `Unknown provider profile: ${input.profile} (UNKNOWN_PROFILE).`);
  if (!isSharedProfile(profile)) throw new ApiError('INVALID_REQUEST', `Profile ${profile.id} is not a shared profile.`);
  if (!/^[\x21-\x7e]{1,255}$/.test(input.clientId)) throw new ApiError('INVALID_REQUEST', 'The client id must be 1 to 255 printable ASCII characters without spaces.');
  const existing = findSharedPlatform(db, input.account, profile.id);
  if (existing && existing.clientId !== input.clientId) {
    throw new ApiError('SHARED_PLATFORM_EXISTS', `A ${profile.id} shared platform with another client id exists (${existing.id}). Nothing changed.`);
  }
  return { profile, existing };
}

/** Shared by the operator endpoint and the direct CLI, until LA-E5-05 moves the CLI to HTTP. */
export function provisionSharedPlatform(db: Db, opts: ProfileOptions, input: SharedPlatformInput) {
  return transaction(db, () => {
    const { profile, existing } = checkSharedPlatform(db, opts, input);
    if (existing) return { platform: existing, created: false };
    const e = profileEndpoints(profile, { clientId: input.clientId });
    const platform = createPlatform(db, input.account, {
      issuer: e.issuer, clientId: input.clientId, name: input.name ?? 'Cogniate', authEndpoint: e.authenticationEndpoint, tokenEndpoint: e.accesstokenEndpoint,
      jwksUrl: e.jwksUrl, deploymentIds: [], active: true, profile: profile.id, shared: true,
    });
    return { platform, created: true };
  });
}
