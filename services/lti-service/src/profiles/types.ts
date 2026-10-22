import type { ProfileSource } from '@cogniate/channel-kernel';

export type { ProfileFlags, ProfileSharing, ProfileSource, SiteUrlOn } from '@cogniate/channel-kernel';

export interface ProviderProfile extends ProfileSource {
  /** Normalized by the registry: an omitted source trait is null. */
  readonly platformStorage: NonNullable<ProfileSource['platformStorage']> | null;
  /** The channel whose folder holds this profile. Never supplied by the profile source. */
  readonly channel: string;
  /** Legacy provider-list field. Derived from wireLms or the channel id. */
  readonly lms: string | null;
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
