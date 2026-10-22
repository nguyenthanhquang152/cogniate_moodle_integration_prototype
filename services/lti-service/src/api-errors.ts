// The typed list of LTI service API codes (contract lti-service-api §1.3) and the ApiError class bound to it
// (B-T2a-02, B-T2b-02). The mechanism is generic in @cogniate/shared; the table is the service's own.
import type { ApiErrorOptions } from '@cogniate/shared';
import { ApiErrorBase, defineErrorTable } from '@cogniate/shared';
import { KEY_ERRORS } from './http/key-errors.ts';

export { apiErrorBody } from '@cogniate/shared';
export type { ApiErrorBody } from '@cogniate/shared';

/** Contract §1.3, in table order, then the LA codes (contract delta §1.3). */
export const API_ERRORS = defineErrorTable({
  ...KEY_ERRORS,
  INVALID_REQUEST: { status: 400, description: 'The request is not valid.' },
  INVALID_LINE_ITEM_ID: { status: 400, description: 'The line item id does not match the line items URL of the launch.' },
  INVALID_URL_PARAMETER: { status: 400, description: 'The url parameter does not match the service URL of the launch.' },
  INVALID_CONTENT_ITEM: { status: 400, description: 'A content item is not valid.' },
  INVALID_DEEP_LINK_RETURN_URL: { status: 400, description: 'The Deep Linking return URL must use https on the site origin of the launch, without user info or a fragment.' },
  UNSUPPORTED_AUTH_METHOD: { status: 400, description: 'Only authConfig.method JWK_SET is supported.' },
  PLATFORM_URL_NOT_ON_ISSUER_ORIGIN: { status: 400, description: 'A platform endpoint is not on the issuer origin.' },
  // M1 (contract §9.2)
  UNKNOWN_PROFILE: { status: 400, description: 'Unknown provider profile.' },
  ISSUER_RESERVED: { status: 400, description: 'This issuer belongs to a hosted LMS profile.' },
  INVALID_SITE_URL: { status: 400, description: 'The site URL breaks a site rule.' },
  PLATFORM_URL_NOT_IN_PROFILE: { status: 400, description: 'A platform URL is not the value of its provider profile.' },
  INVALID_AUTHORIZATION_HEADER: { status: 401, description: 'Missing or unsupported Authorization header for this endpoint.' },
  INVALID_LTIK_AUTH_AUTHORIZATION_HEADER: { status: 401, description: 'Invalid or expired ltik.' },
  INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER: { status: 401, description: 'Invalid service key.' },
  SERVICE_NOT_AVAILABLE: { status: 403, description: 'This service is not available in this launch.' },
  PLATFORM_NOT_ACTIVE: { status: 403, description: 'The platform is not active.' },
  DEPLOYMENT_NOT_ACTIVE: { status: 403, description: 'The deployment is not active.' },
  NOT_FOUND: { status: 404, description: 'Not found.' },
  UNREGISTERED_PLATFORM: { status: 404, description: 'Unknown platform id.' },
  UNKNOWN_DEPLOYMENT: { status: 404, description: 'Unknown deployment id.' },
  REGISTRATION_NOT_FOUND: { status: 404, description: 'Unknown or expired registration.' },
  REGISTRATION_ALREADY_COMPLETED: { status: 409, description: 'The registration is already completed.' },
  REGISTRATION_UPDATE_NOT_ALLOWED: { status: 409, description: 'This registration cannot update that platform.' },
  PLATFORM_ALREADY_EXISTS: { status: 409, description: 'A platform with this issuer and client id exists.' },
  SHARED_PLATFORM_EXISTS: { status: 409, description: 'This account already has a platform with this shared profile.' },
  SHARED_PLATFORM_DEPLOYMENTS: { status: 409, description: 'The deployments of a shared platform change only through the deployment endpoints.' },
  SHARED_PLATFORM_IN_USE: { status: 409, description: 'This shared platform has an active deployment.' },
  DEPLOYMENT_ALREADY_EXISTS: { status: 409, description: 'The platform has this deployment id.' },
  BINDING_REF_MISMATCH: { status: 409, description: 'The binding ref is not the stored one. Nothing changed.' },
  PLATFORM_CONFLICT: { status: 409, description: 'The platform answered 409.' },
  PLATFORM_REJECTED_REQUEST: { status: 400, alsoStatus: [404, 422], description: 'The platform rejected the request.' },
  NOT_IMPLEMENTED: { status: 501, description: 'Not implemented.' },
  PLATFORM_ERROR: { status: 502, description: 'The platform answered with an error.' },
  PLATFORM_TIMEOUT: { status: 504, description: 'The platform did not answer in time.' },
  INTERNAL_ERROR: { status: 500, description: 'Internal error.' },
  // LA (contract delta §1.3)
  INVALID_OPERATOR_AUTHORIZATION_HEADER: { status: 401, description: 'Missing or invalid operator key.' },
  OPERATOR_KEY_IN_USE: { status: 409, description: 'An operator cannot revoke the key of its own request.' },
  TOOL_ACCOUNT_SUSPENDED: { status: 403, description: 'This tool account is suspended.' },
  ACCOUNT_ALREADY_EXISTS: { status: 409, description: 'This tool account already exists.' },
  ACCOUNT_CLOSED: { status: 409, description: 'This tool account is closed and cannot change.' },
  PLATFORM_RATE_LIMITED: { status: 429, description: 'The platform asked us to wait before another request.' },
  RATE_LIMITED: { status: 429, description: 'Too many requests.' },
  IDEMPOTENCY_KEY_REUSED: { status: 422, description: 'This Idempotency-Key was used in the last 24 hours for a request with another route, path id, target (platform, deployment or course) or body. Use a new key for a new request.' },
  // BD-A2-58: details.retryAfter = seconds until the 60 s claim of the running request ends.
  IDEMPOTENCY_IN_PROGRESS: { status: 409, description: 'A request with this Idempotency-Key is still running. Retry after the time in Retry-After.' },
});

export type ApiErrorCode = keyof typeof API_ERRORS;

export class ApiError extends ApiErrorBase<ApiErrorCode> {
  constructor(code: ApiErrorCode, description?: string, options: ApiErrorOptions = {}) {
    super(API_ERRORS, code, description, options);
  }
}
