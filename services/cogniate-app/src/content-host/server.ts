// The content listener (PUBLIC_CONTENT_URL, a different site; sets no cookies). Untrusted boundary (ADR-008):
// this folder imports only domain/attempts*, packages/tracking and packages/shared. T5a adds /pkg/* and /rt/*.
import type { Server } from 'node:http';
import type { Knob, Logger } from '@cogniate/shared';
import { createHealthServer } from '@cogniate/shared';

export const CONTENT_SERVICE_NAME = 'cogniate-content';

export function buildContentServer(deps: { logger?: Logger; knobs?: Knob[]; profile?: string; outboundAllowlist?: string[] } = {}): Server {
  return createHealthServer(CONTENT_SERVICE_NAME, deps);
}
