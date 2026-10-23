// The Canvas embedded page continuation (app contract §6.1 "Canvas embedded page"): Canvas sends
// documentTarget = iframe for every launch, so for a Canvas connection /play/{playId}/embedded runs a small nonce script
// that continues to the player when the page is the top-level page. play.ts adds the nonce and the CSP script-src.

/** Script body only; the shared page renderer supplies its nonce and matching CSP. */
export function canvasEmbeddedScript(playPath: string): string {
  // JSON quoting plus HTML-sensitive escapes prevent a path from ending its enclosing script element.
  const target = JSON.stringify(playPath).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `if (window.top === window) { window.location.replace(${target}); }`;
}
