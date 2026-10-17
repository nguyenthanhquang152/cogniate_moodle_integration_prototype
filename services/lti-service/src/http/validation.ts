// Request validation helper shared by the route groups (B-T3b-03: no route file imports another).
import type { z } from 'zod';
import { ApiError } from '../api-errors.ts';

/** 400 INVALID_REQUEST that names the first bad field. */
export function invalid(error: z.ZodError): ApiError {
  const issue = error.issues[0];
  const field = issue && issue.path.length ? issue.path.join('.') : 'body';
  return new ApiError('INVALID_REQUEST', `Invalid field: ${field}.`);
}
