import type { Server } from 'node:http';
import type { Knob, Logger } from '@cogniate/shared';
import { createHealthServer } from '@cogniate/shared';

export const SERVICE_NAME = 'lti-service';

/** T1 placeholder: only GET /healthz. T2 adds the LTI endpoints and the API. */
export function buildServer(deps: { logger?: Logger; knobs?: Knob[] } = {}): Server {
  return createHealthServer(SERVICE_NAME, deps);
}
