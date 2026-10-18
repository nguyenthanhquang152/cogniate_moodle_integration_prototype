// Request validation helper shared by the route groups (B-T3b-03: no route file imports another).
import type { z } from 'zod';
import { ApiError } from '../api-errors.ts';

/** Fastify decoded the path parameter once. Accept one SDK encoding layer, then apply the unchanged URL guard. */
export function decodeLineItemId(value: string): string {
  if (!/^https%3a%2f%2f/i.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ApiError('INVALID_LINE_ITEM_ID');
  }
}

/** 400 INVALID_REQUEST that names the first bad field. */
export function invalid(error: z.ZodError): ApiError {
  const issue = error.issues[0];
  const field = issue && issue.path.length ? issue.path.join('.') : 'body';
  return new ApiError('INVALID_REQUEST', `Invalid field: ${field}.`);
}
