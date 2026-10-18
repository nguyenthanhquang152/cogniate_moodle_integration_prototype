// Platform errors -> API errors (contract §1.3). The description never holds a token; a platform message is short
// and without control characters. It is data, not HTML: pages and the portal escape it when they show it (B-T3a-03).
import type { OutboundResponse } from '@cogniate/shared';
import { OutboundError } from '@cogniate/shared';
import { ApiError } from '../api-errors.ts';

/** A short, safe text of a platform answer (at most 200 characters). */
export function shortPlatformMessage(body: Buffer | string): string {
  // eslint-disable-next-line no-control-regex
  const text = (typeof body === 'string' ? body : body.toString('utf8')).replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
}

/** A platform HTTP answer that is not a success: 409 -> PLATFORM_CONFLICT, 400/404 -> PLATFORM_REJECTED_REQUEST, else PLATFORM_ERROR. */
export function platformResponseError(res: OutboundResponse, includeMessage = true): ApiError {
  if (res.status === 409) return new ApiError('PLATFORM_CONFLICT', 'The platform answered 409: it has a newer value (for example a grade with a newer time).');
  if (res.status === 400 || res.status === 404) {
    const msg = includeMessage ? shortPlatformMessage(res.body) : '';
    return new ApiError('PLATFORM_REJECTED_REQUEST', `The platform answered ${res.status}${msg ? `: ${msg}` : '.'}`, { status: res.status });
  }
  return new ApiError('PLATFORM_ERROR', `The platform answered ${res.status}.`);
}

/** An outbound call that got no accepted answer: timeout -> PLATFORM_TIMEOUT, else PLATFORM_ERROR. */
export function outboundFailureError(err: unknown): ApiError {
  if (err instanceof OutboundError && err.reason === 'timeout') return new ApiError('PLATFORM_TIMEOUT', 'The platform did not answer in 5 s.');
  if (err instanceof OutboundError) return new ApiError('PLATFORM_ERROR', `The platform call failed (${err.reason}).`);
  return new ApiError('PLATFORM_ERROR', 'The platform call failed.');
}

/** The platform answered 2xx, but with data that we cannot use. */
export function badPlatformDataError(what: string): ApiError {
  return new ApiError('PLATFORM_ERROR', `The platform sent invalid data (${what}).`);
}
