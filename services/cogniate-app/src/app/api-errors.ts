// The typed list of Cogniate app API codes (contract cogniate-app-api) and the ApiError class bound to it
// (B-T2b-02). The mechanism is generic in @cogniate/shared; the table is the app's own.
import type { ApiErrorOptions } from '@cogniate/shared';
import { ApiErrorBase, defineErrorTable } from '@cogniate/shared';

export { apiErrorBody } from '@cogniate/shared';
export type { ApiErrorBody } from '@cogniate/shared';

/** API codes of the app contract (T4a uses the first part; later tasks use the rest). */
export const APP_API_ERRORS = defineErrorTable({
  INVALID_REQUEST: { status: 400, description: 'The request is not valid.' },
  MASTERY_SCORE_NOT_ALLOWED: { status: 400, description: 'SCORM packages use the mastery score of their manifest.' },
  INVALID_CREDENTIALS: { status: 401, description: 'The email or the password is not correct.' },
  NOT_SIGNED_IN: { status: 401, description: 'Sign in first.' },
  ORIGIN_NOT_ALLOWED: { status: 403, description: 'This request must come from the Cogniate app.' },
  NOT_FOUND: { status: 404, description: 'Not found.' },
  PACKAGE_REJECTED: { status: 422, description: 'The package was rejected. See details.reasons.' },
  INTERNAL_ERROR: { status: 500, description: 'Internal error.' },
  // Later tasks (T4b, T5): listed now so their handlers stay inside one typed table.
  INVALID_CMI: { status: 400, description: 'A CMI value is not valid.' },
  INVALID_PROGRESS: { status: 400, description: 'The progress report is not valid.' },
  PUBLICATION_NOT_AVAILABLE: { status: 400, description: 'The publication is not available.' },
  CONNECTION_NOT_READY: { status: 409, description: 'The connection is not ready.' },
  CONNECTION_NOT_PENDING: { status: 409, description: 'The connection is not pending.' },
  PLATFORM_IN_USE: { status: 409, description: 'This Moodle tool is already registered with Cogniate.' },
  VERSION_NOT_READY: { status: 409, description: 'The course version is not ready.' },
  STALE_SEQUENCE: { status: 409, description: 'The sequence number is not newer than the last one.' },
  SYNC_NOT_RESENDABLE: { status: 409, description: 'Only a failed or conflict score sync can be sent again.' },
  RUNTIME_EXPIRED: { status: 410, description: 'The runtime session expired.' },
  INVALID_PLATFORM_VALUES: { status: 422, description: 'The platform values are not valid.' },
  WS_TOKEN_INVALID: { status: 422, description: 'The web services token is not valid.' },
  WS_FUNCTIONS_MISSING: { status: 422, description: 'The web services token cannot use every function that Cogniate needs.' },
  MBZ_NOT_SUPPORTED: { status: 422, description: 'Only a SCORM 1.2 version can be built as a Moodle backup.' },
  MBZ_BUILD_LIMIT: { status: 409, description: 'This library already has the most builds that may wait or run at the same time.' },
  // M1 (app contract §4.2–§4.9): LMS types, approval grants and capabilities.
  CAPABILITY_NOT_SUPPORTED: { status: 409, alsoStatus: [422], description: 'This connection does not support this feature.' },
  INVALID_SITE_URL: { status: 422, description: 'The site URL is not valid.' },
  PROVIDER_NOT_READY: { status: 409, description: 'This LMS setup is not ready in Cogniate.' },
  GRANT_INVALID: { status: 403, description: 'The approval code is not valid, was used, or expired.' },
  GRANT_MISMATCH: { status: 422, description: 'The values do not match the approval.' },
  GRANT_IN_USE: { status: 409, description: 'Cogniate is already saving this connection.' },
  DEPLOYMENT_IN_USE: { status: 409, description: 'This Blackboard site is already connected to Cogniate.' },
  DEPLOYMENT_FIXED: { status: 409, description: 'This connection already reserved another Blackboard deployment. Disconnect it, then make a new connection.' },
  LTI_SERVICE_ERROR: { status: 502, description: 'The LTI service answered with an error.' },
  MOODLE_WS_ERROR: { status: 502, description: 'Moodle web services did not answer as expected.' },
});

export type AppApiErrorCode = keyof typeof APP_API_ERRORS;

export class ApiError extends ApiErrorBase<AppApiErrorCode> {
  constructor(code: AppApiErrorCode, description?: string, options: ApiErrorOptions = {}) {
    super(APP_API_ERRORS, code, description, options);
  }
}

/** App contract §4.7.3: the one neutral readiness text (the same for every LMS and cause; no public reason field). */
export const PROVIDER_NOT_READY_ACTION = 'Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.';

/** `409 PROVIDER_NOT_READY` with the neutral title (description) and action. The cause goes only to the log. */
export const providerNotReady = (): ApiError => new ApiError('PROVIDER_NOT_READY', undefined, { details: { action: PROVIDER_NOT_READY_ACTION } });
