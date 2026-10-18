// The typed list of LTI service API codes (contract lti-service-api §1.3) and the ApiError class bound to it
// (B-T2a-02, B-T2b-02). The mechanism is generic in @cogniate/shared; the table is the service's own.
import type { ApiErrorOptions } from '@cogniate/shared';
import { ApiErrorBase, defineErrorTable } from '@cogniate/shared';

export { apiErrorBody } from '@cogniate/shared';
export type { ApiErrorBody } from '@cogniate/shared';

/** Contract §1.3, in table order. */
export const API_ERRORS = defineErrorTable({
  INVALID_REQUEST: { status: 400, description: 'The request is not valid.' },
  INVALID_LINE_ITEM_ID: { status: 400, description: 'The line item id does not match the line items URL of the launch.' },
  INVALID_URL_PARAMETER: { status: 400, description: 'The url parameter does not match the service URL of the launch.' },
  INVALID_CONTENT_ITEM: { status: 400, description: 'A content item is not valid.' },
  INVALID_DEEP_LINK_RETURN_URL: { status: 400, description: 'The Deep Linking return URL must use https on the platform issuer origin, without user info or a fragment.' },
  UNSUPPORTED_AUTH_METHOD: { status: 400, description: 'Only authConfig.method JWK_SET is supported.' },
  PLATFORM_URL_NOT_ON_ISSUER_ORIGIN: { status: 400, description: 'A platform endpoint is not on the issuer origin.' },
  INVALID_AUTHORIZATION_HEADER: { status: 401, description: 'Missing or unsupported Authorization header for this endpoint.' },
  INVALID_LTIK_AUTH_AUTHORIZATION_HEADER: { status: 401, description: 'Invalid or expired ltik.' },
  INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER: { status: 401, description: 'Invalid service key.' },
  SERVICE_NOT_AVAILABLE: { status: 403, description: 'This service is not available in this launch.' },
  PLATFORM_NOT_ACTIVE: { status: 403, description: 'The platform is not active.' },
  NOT_FOUND: { status: 404, description: 'Not found.' },
  UNREGISTERED_PLATFORM: { status: 404, description: 'Unknown platform id.' },
  REGISTRATION_NOT_FOUND: { status: 404, description: 'Unknown or expired registration.' },
  REGISTRATION_ALREADY_COMPLETED: { status: 409, description: 'The registration is already completed.' },
  REGISTRATION_UPDATE_NOT_ALLOWED: { status: 409, description: 'This registration cannot update that platform.' },
  PLATFORM_ALREADY_EXISTS: { status: 409, description: 'A platform with this issuer and client id exists.' },
  PLATFORM_CONFLICT: { status: 409, description: 'The platform answered 409.' },
  PLATFORM_REJECTED_REQUEST: { status: 400, alsoStatus: [404], description: 'The platform rejected the request.' },
  NOT_IMPLEMENTED: { status: 501, description: 'Not implemented.' },
  PLATFORM_ERROR: { status: 502, description: 'The platform answered with an error.' },
  PLATFORM_TIMEOUT: { status: 504, description: 'The platform did not answer in time.' },
  INTERNAL_ERROR: { status: 500, description: 'Internal error.' },
});

export type ApiErrorCode = keyof typeof API_ERRORS;

export class ApiError extends ApiErrorBase<ApiErrorCode> {
  constructor(code: ApiErrorCode, description?: string, options: ApiErrorOptions = {}) {
    super(API_ERRORS, code, description, options);
  }
}
