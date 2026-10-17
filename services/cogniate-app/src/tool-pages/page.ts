// Server-rendered tool pages (app contract §6): layout with the portal CSS tokens (ADR-008 "Look"), escaping of all
// untrusted text (security §7), and the page headers of security §5. No page sets a cookie or X-Frame-Options.
import { randomBytes } from 'node:crypto';
import { escapeHtml } from '@cogniate/shared';

export { escapeHtml };

/** A fresh nonce for one response (script-src 'nonce-…'). */
export const newNonce = (): string => randomBytes(18).toString('base64');

export type ToolPageKind = 'register-form' | 'register-result' | 'error';

/**
 * Security §5 headers:
 *  - GET /tool/register (confirm form): frame-ancestors {site}; form-action 'self'; script-src 'nonce-…'
 *  - POST /tool/register result:        frame-ancestors {site}; form-action 'none'; script-src 'nonce-…'
 *  - every /tool/* error page:          frame-ancestors https:; form-action 'none' (no form, so any https frame is safe)
 * All: Referrer-Policy same-origin, no-store, nosniff. Never X-Frame-Options, never Set-Cookie.
 */
export function toolPageHeaders(kind: ToolPageKind, opts: { site?: string; nonce?: string } = {}): Record<string, string> {
  let csp: string;
  if (kind === 'error') {
    csp = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors https:; form-action 'none'";
  } else {
    if (!opts.site || !opts.nonce) throw new Error('site and nonce are required');
    const formAction = kind === 'register-form' ? "'self'" : "'none'";
    csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${opts.nonce}'; frame-ancestors ${opts.site}; form-action ${formAction}`;
  }
  return {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': csp,
    'referrer-policy': 'same-origin',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
}

const STYLE = `
:root { --background: 252 20% 5%; --foreground: 0 0% 98%; --card: 252 18% 9%; --card-border: 252 14% 20%; --primary: 270 70% 65%;
  --muted: 252 10% 65%; --radius: .75rem; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: hsl(var(--background)); color: hsl(var(--foreground));
  font: 15px/1.5 "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; padding: 24px; }
main { width: 100%; max-width: 560px; background: hsl(var(--card)); border: 1px solid hsl(var(--card-border)); border-radius: var(--radius); padding: 28px; }
h1 { font-size: 20px; margin: 0 0 16px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0 0 16px; }
dt { color: hsl(var(--muted)); } dd { margin: 0; overflow-wrap: anywhere; }
p { margin: 0 0 12px; } .muted { color: hsl(var(--muted)); font-size: 13px; }
button { background: linear-gradient(135deg, hsl(270 70% 65%), hsl(290 70% 60%)); color: #fff; border: 0; border-radius: var(--radius);
  padding: 10px 22px; font: inherit; font-weight: 600; cursor: pointer; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 13px; }
`;

export function layout(title: string, body: string, nonceScript?: { nonce: string; js: string }): string {
  const script = nonceScript ? `\n<script nonce="${escapeHtml(nonceScript.nonce)}">${nonceScript.js}</script>` : '';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body>
${body}${script}
</body>
</html>
`;
}

/** Error page (app contract §6): the code, the trace id and one action line, with the data-* markers. */
export function errorPage(heading: string, code: string, traceId: string, action: string): string {
  const c = escapeHtml(code);
  const t = escapeHtml(traceId);
  return layout(`Cogniate: ${code}`, `<main data-error-code="${c}" data-trace-id="${t}">
  <h1>${escapeHtml(heading)}</h1>
  <p>Error code: <code>${c}</code></p>
  <p data-error-action>${escapeHtml(action)}</p>
  <p class="muted">Trace id: <code>${t}</code></p>
</main>`);
}
