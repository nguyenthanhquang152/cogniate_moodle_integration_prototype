import { STATUS_CODES } from 'node:http';

/** An API error with a stable code. `extra` adds fields to `details` (contract cogniate-app-api §1). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly description: string;
  readonly extra: Record<string, unknown>;
  constructor(status: number, code: string, description: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.description = description;
    this.extra = extra;
  }
}

export interface ApiErrorBody {
  status: number;
  error: string;
  details: { message: string; description: string; [field: string]: unknown };
}

/** { status, error: <HTTP reason phrase>, details: { message: <code>, description, ...extra } } */
export function apiErrorBody(status: number, code: string, description: string, extra: Record<string, unknown> = {}): ApiErrorBody {
  return { status, error: STATUS_CODES[status] ?? 'Error', details: { ...extra, message: code, description } };
}
