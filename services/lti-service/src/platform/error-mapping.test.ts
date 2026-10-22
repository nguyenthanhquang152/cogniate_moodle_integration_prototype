import type { OutboundResponse } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import { describe, expect, it } from 'vitest';
import { platformRateLimitError, platformResponseError, platformRetryAfter } from './error-mapping.ts';

const NOW = Date.UTC(2026, 9, 22, 10, 0, 0);

describe('platform Retry-After (AC-LA-E5-14-06)', () => {
  it.each([
    ['7200', 3600], ['0', 1], ['120', 120], [' 120 ', 120],
    [undefined, 60], ['', 60], ['unreadable', 60], ['1.5', 60], ['-1', 60],
    ['Infinity', 60], ['90, 120', 60], ['9'.repeat(400), 60],
  ])('normalizes %s to %i seconds', (value, seconds) => {
    expect(platformRetryAfter(value, NOW)).toBe(seconds);
  });

  it('reads an HTTP date as a wait from the current clock', () => {
    expect(platformRetryAfter(new Date(NOW + 90_000).toUTCString(), NOW)).toBe(90);
    expect(platformRetryAfter(new Date(NOW + 90_000).toUTCString(), NOW + 500)).toBe(90);
    expect(platformRetryAfter(new Date(NOW + 7200_000).toUTCString(), NOW)).toBe(3600);
    expect(platformRetryAfter(new Date(NOW - 60_000).toUTCString(), NOW)).toBe(1);
  });

  it('reads the two old HTTP date forms as GMT', () => {
    expect(platformRetryAfter('Thursday, 22-Oct-26 10:01:30 GMT', NOW)).toBe(90);
    expect(platformRetryAfter('Thu Oct 22 10:01:30 2026', NOW)).toBe(90);
  });

  it('uses the default for dates that cannot be read', () => {
    expect(platformRetryAfter('Thu, 22 Oct 2026 99:00:00 GMT', NOW)).toBe(60);
  });
});

function response(status: number, text: string, retryAfter?: string): OutboundResponse {
  const body = Buffer.from(text);
  return { status, headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter }, body, text: () => text, json: () => JSON.parse(text) as unknown };
}

describe('platform throttle errors', () => {
  it.each([429, 403])('maps %i with a safe error and one warning', (status) => {
    const lines: unknown[] = [];
    const logger = createLogger({ service: 'lti-service', dir: '', write: (line) => lines.push(JSON.parse(line)) });
    const error = platformResponseError(response(status, 'student@example.test: Rate Limit Exceeded', '120'), {
      echoMessage: false, context: { logger, platformId: 'platform-1', traceId: 'trace-1' },
    });
    expect(error.body()).toMatchObject({ status: 429, details: { message: 'PLATFORM_RATE_LIMITED', retryAfter: 120 } });
    expect(error.details).toEqual({ retryAfter: 120 });
    expect(lines).toEqual([expect.objectContaining({
      level: 'warn', event: 'platform_rate_limited', trace_id: 'trace-1', platform_id: 'platform-1', status, retry_after_s: 120,
    })]);
    expect(JSON.stringify({ error: error.body(), lines })).not.toContain('student@example.test');
  });

  it('recognizes 429 regardless of its body and uses the default wait', () => {
    expect(platformRateLimitError(response(429, ''))).toMatchObject({ code: 'PLATFORM_RATE_LIMITED', details: { retryAfter: 60 } });
  });

  it.each([
    [403, 'Forbidden'], [403, 'rate limit exceeded'], [500, 'Rate Limit Exceeded'], [200, 'Rate Limit Exceeded'],
  ])('does not treat %i with %s as throttling', (status, body) => {
    expect(platformRateLimitError(response(status, body))).toBeUndefined();
  });
});
