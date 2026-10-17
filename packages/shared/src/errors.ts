// API error mechanism for every Cogniate HTTP API (ADR-008 `errors`, B-T2b-02). Generic: each service keeps its own
// typed code table (lti-service: contract lti-service-api §1.3; cogniate-app: its contract) and an ApiError subclass
// bound to that table, so a code that is not in the table does not compile.
//   const MY_ERRORS = defineErrorTable({ NOT_FOUND: { status: 404, description: 'Not found.' } });
//   class ApiError extends ApiErrorBase<keyof typeof MY_ERRORS> { constructor(code, description?, options?) { super(MY_ERRORS, code, description, options); } }
import { STATUS_CODES } from 'node:http';

export interface ApiErrorSpec {
  status: number;
  /** Other allowed statuses (for example PLATFORM_REJECTED_REQUEST keeps the platform's 400 or 404). */
  alsoStatus?: readonly number[];
  /** Default description. A handler may give a more exact one (for example the field name). */
  description: string;
}

export type ApiErrorTable = Record<string, ApiErrorSpec>;

/** Identity helper that checks the table shape and keeps the literal code keys. */
export function defineErrorTable<const T extends ApiErrorTable>(table: T): T {
  return table;
}

export interface ApiErrorBody {
  status: number;
  error: string;
  details: { message: string; description: string; [field: string]: unknown };
}

/**
 * { status, error: <HTTP reason phrase>, details: { message: <code>, description, ...extra } }. `message` and
 * `description` always win over extra fields. Never put a token or a stack in it.
 */
export function apiErrorBody(status: number, code: string, description: string, extra: Record<string, unknown> = {}): ApiErrorBody {
  return { status, error: STATUS_CODES[status] ?? 'Error', details: { ...extra, message: code, description } };
}

export interface ApiErrorOptions {
  /** Another status that the table allows for this code. */
  status?: number;
  /** Extra fields in `details` (for example `reasons` and `action` of a rejected package, or `field`). */
  details?: Record<string, unknown>;
}

/** Base class of the service ApiError classes. The error handlers check `instanceof ApiErrorBase`. */
export class ApiErrorBase<C extends string = string> extends Error {
  readonly code: C;
  readonly status: number;
  readonly description: string;
  readonly details: Record<string, unknown>;

  constructor(table: ApiErrorTable, code: C, description?: string, options: ApiErrorOptions = {}) {
    super(code);
    const spec = table[code];
    if (!spec) throw new Error(`unknown API error code ${code}`);
    const status = options.status ?? spec.status;
    if (status !== spec.status && !(spec.alsoStatus ?? []).includes(status)) throw new Error(`status ${status} is not allowed for ${code}`);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.description = description ?? spec.description;
    this.details = options.details ?? {};
  }

  body(): ApiErrorBody {
    return apiErrorBody(this.status, this.code, this.description, this.details);
  }
}
