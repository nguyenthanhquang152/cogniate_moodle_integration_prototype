// The Canvas embedded page continuation (app contract §6.1 "Canvas embedded page"): Canvas sends
// documentTarget = iframe for every launch, so for a Canvas connection /play/{playId}/embedded runs a small nonce script
// that continues to the player when the page is the top-level page. play.ts adds the nonce and the CSP script-src.
// Owner after the foundation handoff: the Canvas implementer.
//
// FOUNDATION STUB: no script (the static page of Moodle and Blackboard).

/** The script body for the embedded page of `playPath` (`/play/{playId}`), or null for the static page. */
export function canvasEmbeddedScript(_playPath: string): string | null {
  return null;
}
