// API error shape and the one typed list of LTI service API codes (contract lti-service-api §1.3, ADR-008 `errors`).
// A handler throws `new ApiError('<CODE>')`; a code that is not in the list does not compile.
import { STATUS_CODES } from 'node:http';

export interface ApiErrorSpec {
  status: number;
  /** Other allowed statuses (PLATFORM_REJECTED_REQUEST keeps the platform's 400 or 404). */
  alsoStatus?: readonly number[];
  /** Default description. A handler may give a more exact one (for example the field name). */
  description: string;
}

/** Contract §1.3, in table order. */
export const API_ERRORS = {
  INVALID_REQUEST: { status: 400, description: 'The request is not valid.' },
  INVALID_LINE_ITEM_ID: { status: 400, description: 'The line item id does not match the line items URL of the launch.' },
  INVALID_URL_PARAMETER: { status: 400, description: 'The url parameter does not match the service URL of the launch.' },
  INVALID_CONTENT_ITEM: { status: 400, description: 'A content item is not valid.' },
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
} as const satisfies Record<string, ApiErrorSpec>;

export type ApiErrorCode = keyof typeof API_ERRORS;

export interface ApiErrorBody {
  status: number;
  error: string;
  details: { message: string; description: string; [field: string]: unknown };
}

/** { status, error: <HTTP reason phrase>, details: { message: <code>, description, ...extra } }. Never a token or a stack. */
export function apiErrorBody(status: number, code: string, description: string, extra: Record<string, unknown> = {}): ApiErrorBody {
  return { status, error: STATUS_CODES[status] ?? 'Error', details: { ...extra, message: code, description } };
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly description: string;
  constructor(code: ApiErrorCode, description?: string, options: { status?: number } = {}) {
    super(code);
    const spec: ApiErrorSpec = API_ERRORS[code];
    const status = options.status ?? spec.status;
    if (status !== spec.status && !(spec.alsoStatus ?? []).includes(status)) throw new Error(`status ${status} is not allowed for ${code}`);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.description = description ?? spec.description;
  }

  body(): ApiErrorBody {
    return apiErrorBody(this.status, this.code, this.description);
  }
}
