import type { FastifyReply } from 'fastify';

/** One wait rule for API errors and protocol pages (LA-ADR-06 D1, BD-A2-16). Round up to avoid an early retry. */
export function retryAfterSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.min(3600, Math.ceil(value))) : 60;
}

/** Set the header from seconds already normalized by retryAfterSeconds. */
export function setRetryAfter(reply: FastifyReply, seconds: number): void {
  reply.header('Retry-After', String(seconds));
}
