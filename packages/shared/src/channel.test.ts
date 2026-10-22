import { expect, it } from 'vitest';
import * as channel from '@cogniate/shared/channel';

it('exports exactly the 23 pure helpers approved in BD-A2-11', () => {
  // Pin the public package entry, so a new capability needs an explicit security review.
  expect(Object.keys(channel).sort()).toEqual([
    'randomId', 'randomToken', 'sha256Hex', 'safeEqual', 'escapeHtml',
    'ApiErrorBase', 'apiErrorBody', 'defineErrorTable', 'redact', 'redactPath', 'redactString', 'OutboundError',
    'canonicalOrigin', 'checkSiteUrl', 'hostOf', 'originHost', 'fixedHostsOf',
    'ADMIN_ROLES', 'canSelectContent', 'hasAdminRole', 'hasContextLearnerRole', 'hasContextStaffRole', 'isGradedLaunch',
  ].sort());
});
