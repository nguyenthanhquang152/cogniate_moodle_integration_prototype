// Platform errors -> API errors (contract §1.3). The description never holds a token; a platform message is short
// and without control characters. It is data, not HTML: pages and the portal escape it when they show it (B-T3a-03).
import type { Logger, OutboundResponse } from '@cogniate/shared';
import { OutboundError } from '@cogniate/shared';
import { ApiError } from '../api-errors.ts';
import { retryAfterSeconds } from '../http/retry-after.ts';

const HTTP_DATE_FORMATS = [
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/i,
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2} \d{2}:\d{2}:\d{2} GMT$/i,
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( \d|\d{2}) \d{2}:\d{2}:\d{2} \d{4}$/i,
];

/** Retry-After uses whole seconds or an HTTP date. Never ask a caller to wait less than 1 s or more than 1 h. */
export function platformRetryAfter(value: string | undefined, now = Date.now()): number {
  const text = value?.trim();
  if (!text) return retryAfterSeconds(undefined);
  if (/^\d+$/.test(text)) return retryAfterSeconds(Math.min(3600, Number(text)));
  // Date.parse also accepts values such as "1.5". Only the three HTTP date forms are dates here.
  if (!HTTP_DATE_FORMATS.some((format) => format.test(text))) return retryAfterSeconds(undefined);
  // The old asctime form has no zone; HTTP dates always use GMT.
  const date = Date.parse(/GMT$/i.test(text) ? text : `${text} GMT`);
  return retryAfterSeconds((date - now) / 1000);
}

export interface PlatformErrorContext {
  logger: Logger;
  platformId: string;
  traceId: string;
}

/** Map and log a throttle answer once, without copying the platform body into the error or the log. */
export function platformRateLimitError(res: OutboundResponse, context?: PlatformErrorContext, now = Date.now()): ApiError | undefined {
  if (res.status !== 429 && !(res.status === 403 && res.body.includes('Rate Limit Exceeded'))) return undefined;
  const retryAfter = platformRetryAfter(res.headers['retry-after'], now);
  const error = new ApiError('PLATFORM_RATE_LIMITED', undefined, { details: { retryAfter } });
  context?.logger.warn('platform_rate_limited', {
    trace_id: context.traceId, platform_id: context.platformId, status: res.status, retry_after_s: retryAfter,
  });
  return error;
}

/** A short, safe text of a platform answer (at most 200 characters). */
export function shortPlatformMessage(body: Buffer | string): string {
  // eslint-disable-next-line no-control-regex
  const text = (typeof body === 'string' ? body : body.toString('utf8')).replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
}

/**
 * A platform HTTP answer that is not a success: 409 -> PLATFORM_CONFLICT, 400/404/422 -> PLATFORM_REJECTED_REQUEST
 * (M1: a 422 is a permanent refusal too, ADR-011 §9), throttling -> PLATFORM_RATE_LIMITED, else PLATFORM_ERROR.
 */
export function platformResponseError(res: OutboundResponse, { echoMessage = true, context }: { echoMessage?: boolean; context?: PlatformErrorContext } = {}): ApiError {
  const throttled = platformRateLimitError(res, context);
  if (throttled) return throttled;
  if (res.status === 409) return new ApiError('PLATFORM_CONFLICT', 'The platform answered 409: it has a newer value (for example a grade with a newer time).');
  if (res.status === 400 || res.status === 404 || res.status === 422) {
    const msg = echoMessage ? shortPlatformMessage(res.body) : '';
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
