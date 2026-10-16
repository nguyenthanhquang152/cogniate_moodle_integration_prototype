import { describe, expect, it } from 'vitest';
import type { LaunchRecord } from '../store/launches.ts';
import type { Platform } from '../store/platforms.ts';
import { moodleClaims } from '../testkit.ts';
import { CLAIM } from './checks.ts';
import { toIdToken } from './idtoken.ts';

const platform: Platform = {
  id: 'plt_1', toolAccountId: 'cogniate', issuer: 'https://moodle.test', clientId: 'c', name: 'Moodle seed', authEndpoint: '', tokenEndpoint: '',
  jwksUrl: '', productFamilyCode: null, active: true, deploymentIds: ['1'],
};
const launch = (claims: Record<string, unknown>, messageType = 'LtiResourceLinkRequest'): LaunchRecord =>
  ({ id: 'l', toolAccountId: 'cogniate', platformId: 'plt_1', deploymentId: '1', messageType, claims, expiresAt: 0 });

describe('toIdToken', () => {
  it('maps name and email only when present, and the AGS line item', () => {
    const t = toIdToken(launch(moodleClaims({ email: 'a@b', name: 'A B', given_name: 'A', family_name: 'B',
      [CLAIM.ags]: { scope: [], lineitems: 'https://moodle.test/l', lineitem: 'https://moodle.test/l/7' }, [CLAIM.nrps]: { context_memberships_url: 'x' } })), platform);
    expect(t.user).toMatchObject({ email: 'a@b', name: 'A B', givenName: 'A', familyName: 'B' });
    expect(t.services).toMatchObject({ assignmentAndGrades: { available: true, lineItemId: 'https://moodle.test/l/7' }, namesAndRoles: { available: true } });
  });

  it('omits resourceLink and adds deepLinkingSettings for a deep-linking launch', () => {
    const t = toIdToken(launch(moodleClaims({ [CLAIM.messageType]: 'LtiDeepLinkingRequest',
      [CLAIM.deepLinkingSettings]: { deep_link_return_url: 'https://moodle.test/r', accept_types: ['ltiResourceLink'], accept_multiple: false } }), 'LtiDeepLinkingRequest'), platform);
    const l = t.launch as Record<string, unknown>;
    expect(l.resourceLink).toBeUndefined();
    expect(l.deepLinkingSettings).toEqual({ acceptTypes: ['ltiResourceLink'], acceptMultiple: false });
    expect(t.services).toMatchObject({ deepLinking: { available: true } });
  });

  it('uses the registration name when the token has no tool_platform', () => {
    const t = toIdToken(launch(moodleClaims({ [CLAIM.toolPlatform]: undefined })), platform);
    expect(t.platform).toMatchObject({ name: 'Moodle seed', productFamilyCode: '' });
  });
});
