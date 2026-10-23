import { familyGuardVerdict, STANDARD_PROFILE_ID, type ChannelRegistry } from '@cogniate/channel-kernel';
import type { Logger } from '@cogniate/shared';
import type { LtiIdToken } from '../clients/lti-client.ts';
import type { Connection } from '../domain/connections.ts';
import { routeLaunch } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { httpsOrigin } from '../tool-pages/launch-rules.ts';

/** The site and service origins of a launch (LTI contract §9.9); a launch from before M1 has the issuer origin. */
function launchOrigins(token: LtiIdToken): { site: string | null; service: string | null } {
  const issuer = httpsOrigin(token.platform.url);
  const site = token.platform.siteUrl ?? issuer;
  return { site, service: token.platform.serviceUrl ?? site };
}

export type ConnectionCheck = { ok: true; connection: Connection; site: string } | { ok: false; code: 'UNKNOWN_PLATFORM'; reason: string; fields: Record<string, unknown> };

/**
 * App contract §6.1 in order: routing (approval or Moodle lti_platform_id), the site check, the LMS check. Pure on
 * the database; the caller logs the reason with its fields and shows the UNKNOWN_PLATFORM page.
 */
export function checkLaunchConnection(db: Db, token: LtiIdToken, channels: ChannelRegistry, logger?: Pick<Logger, 'info'>, traceId?: string): ConnectionCheck {
  const route = routeLaunch(db, token.platform.id, token.platform.deploymentId);
  if (!route.ok) {
    return { ok: false, code: 'UNKNOWN_PLATFORM', reason: route.reason,
      fields: route.reason === 'deployment_not_approved' ? { platform_id: token.platform.id, deployment_id: token.platform.deploymentId } : {} };
  }
  const c = route.connection;
  const { site, service } = launchOrigins(token);
  if (!site || site !== c.siteUrl || service !== c.serviceUrl) {
    return { ok: false, code: 'UNKNOWN_PLATFORM', reason: 'site_mismatch',
      fields: { expected_site: c.siteUrl, launch_site: site, expected_service: c.serviceUrl, launch_service: service } };
  }
  const profileChannel = channels.channelOfProfile(token.platform.profile ?? STANDARD_PROFILE_ID);
  const verdict = familyGuardVerdict(channels, token.platform.productFamilyCode, profileChannel, 'launch');
  if (profileChannel !== c.channel || verdict.kind === 'refuse') {
    return { ok: false, code: 'UNKNOWN_PLATFORM', reason: 'lms_mismatch', fields: { connection_lms: c.channel, family: token.platform.productFamilyCode ?? null } };
  }
  if (verdict.kind === 'log') logger?.info('family_guard_mismatch', { trace_id: traceId, platform_id: token.platform.id, family: verdict.family });
  return { ok: true, connection: c, site: c.siteUrl };
}

