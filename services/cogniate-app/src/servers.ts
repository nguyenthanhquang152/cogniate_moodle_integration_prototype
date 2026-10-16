import type { Server } from 'node:http';
import type { Knob, Logger } from '@cogniate/shared';
import { createHealthServer } from '@cogniate/shared';

export const APP_SERVICE_NAME = 'cogniate-app';
export const CONTENT_SERVICE_NAME = 'cogniate-content';

type Deps = { logger?: Logger; knobs?: Knob[]; profile?: string };

/**
 * T1 placeholder. Two listeners in one process:
 *  - app:     PUBLIC_APP_URL     (proxy -> :4200)
 *  - content: PUBLIC_CONTENT_URL (proxy -> :4201), a different site, sets no cookies
 * T4 replaces both with the real app API, tool pages and content host.
 */
export function buildAppServer(deps: Deps = {}): Server {
  return createHealthServer(APP_SERVICE_NAME, deps);
}

export function buildContentServer(deps: Deps = {}): Server {
  return createHealthServer(CONTENT_SERVICE_NAME, deps);
}
