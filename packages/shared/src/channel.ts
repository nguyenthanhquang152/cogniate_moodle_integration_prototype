// Pure helpers for channel server code (BD-A2-11). Capabilities come from PortContext.
export { randomId, randomToken, sha256Hex, safeEqual } from './crypto.ts';
export { escapeHtml } from './html.ts';
export { ApiErrorBase, apiErrorBody, defineErrorTable } from './errors.ts';
export { redact, redactPath, redactString } from './logger.ts';
export { OutboundError } from './outbound.ts';
export { canonicalOrigin, checkSiteUrl, hostOf, originHost, fixedHostsOf } from './origins.ts';
export { ADMIN_ROLES, canSelectContent, hasAdminRole, hasContextLearnerRole, hasContextStaffRole, isGradedLaunch } from './roles.ts';
