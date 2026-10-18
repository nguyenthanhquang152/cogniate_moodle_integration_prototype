// Commit transport (app contract §7, T5-spike, verified in Chromium):
//  - commit and finish: fetch with keepalive and JSON, to the runtime's own origin (no CORS, no cookies);
//  - pagehide: ONE navigator.sendBeacon (text/plain) with event "unload", and no extra fetch (both would arrive);
//  - no state by postMessage (it is lost when the window closes).
// seq starts after RuntimeState.lastSeq, so a reload of the runtime page in the same session is not stale.
import type { ScormCmi } from '@cogniate/tracking';

/** Browsers limit keepalive and beacon bodies to about 64 KB; stay under 60 KB. */
export const MAX_BODY_CHARS = 60_000;

export type CommitEvent = 'commit' | 'finish' | 'unload';

export interface TransportDeps {
  url: string;
  sessionId: string;
  lastSeq: number;
  fetch: (url: string, init: RequestInit) => Promise<unknown>;
  sendBeacon: (url: string, data: string) => boolean;
}

/** The JSON body; if it is too large, the oldest interactions are left out (suspend_data is at most 4096 chars). */
export function commitBody(event: CommitEvent, sessionId: string, seq: number, cmi: ScormCmi): string {
  const body = { kind: 'scorm12', event, sessionId, seq, cmi };
  let text = JSON.stringify(body);
  while (text.length > MAX_BODY_CHARS && body.cmi.interactions.length > 0) {
    body.cmi = { ...body.cmi, interactions: body.cmi.interactions.slice(1) };
    text = JSON.stringify(body);
  }
  return text;
}

export function createTransport(deps: TransportDeps) {
  let seq = deps.lastSeq;
  let unloaded = false;
  return {
    /** LMSCommit / LMSFinish. */
    send(event: 'commit' | 'finish', cmi: ScormCmi): void {
      seq += 1;
      deps.fetch(deps.url, {
        method: 'POST', keepalive: true, credentials: 'omit', headers: { 'content-type': 'application/json' }, body: commitBody(event, deps.sessionId, seq, cmi),
      }).catch(() => undefined); // the next commit carries the full CMI again
    },
    /** pagehide: one beacon per page load. */
    unload(cmi: ScormCmi): void {
      if (unloaded) return;
      unloaded = true;
      seq += 1;
      deps.sendBeacon(deps.url, commitBody('unload', deps.sessionId, seq, cmi));
    },
    seq: () => seq,
  };
}
