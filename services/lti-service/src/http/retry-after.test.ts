import { ApiErrorBase, createLogger } from '@cogniate/shared';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../api-errors.ts';
import { installApiBasics } from './app.ts';
import { retryAfterSeconds } from './retry-after.ts';

describe('Retry-After seconds (BD-A2-16)', () => {
  it.each([
    [120, 120], [7200, 3600], [0, 1], [-20, 1], [1.2, 2],
    [NaN, 60], [Infinity, 60], [-Infinity, 60], [undefined, 60], [null, 60], ['120', 60],
  ])('normalizes %s to %i', (value, seconds) => {
    expect(retryAfterSeconds(value)).toBe(seconds);
  });
});

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

async function errorResponse(error: ApiErrorBase) {
  const app = Fastify();
  apps.push(app);
  installApiBasics(app, createLogger({ service: 'lti-service', dir: '', write: () => {} }));
  app.get('/error', () => { throw error; });
  return app.inject('/error');
}

describe('API error Retry-After header and body', () => {
  it.each([
    [7200, 3600], [0, 1], [12.1, 13], [NaN, 60], ['unreadable', 60], [undefined, 60],
  ])('sends the same bounded wait for %s', async (value, seconds) => {
    const details = Object.freeze({ retryAfter: value, field: 'keep' });
    const error = new ApiError('PLATFORM_RATE_LIMITED', undefined, { details });
    const response = await errorResponse(error);
    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe(String(seconds));
    expect(response.json()).toEqual({
      status: 429, error: 'Too Many Requests',
      details: { retryAfter: seconds, field: 'keep', message: 'PLATFORM_RATE_LIMITED', description: 'The platform asked us to wait before another request.' },
    });
    expect(error.details).toBe(details);
  });

  it('uses the same rule for a code and status outside the current catalog', async () => {
    const error = new ApiErrorBase({ NOT_READY: { status: 503, description: 'Try later.' } }, 'NOT_READY', undefined, { details: { retryAfter: 90 } });
    const response = await errorResponse(error);
    expect(response.statusCode).toBe(503);
    expect(response.headers['retry-after']).toBe('90');
    expect(response.json()).toEqual({ status: 503, error: 'Service Unavailable', details: { message: 'NOT_READY', description: 'Try later.', retryAfter: 90 } });
  });

  it('leaves an error without a wait unchanged', async () => {
    const error = new ApiError('PLATFORM_ERROR');
    const response = await errorResponse(error);
    expect(response.statusCode).toBe(502);
    expect(response.headers['retry-after']).toBeUndefined();
    expect(response.json()).toEqual(error.body());
  });
});
