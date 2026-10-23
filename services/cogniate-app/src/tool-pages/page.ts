// Server-rendered tool pages (app contract §6): layout with the portal CSS tokens (ADR-008 "Look"), escaping of all
// untrusted text (security §7), and the page headers of security §5. No page sets a cookie or X-Frame-Options.
import { randomBytes } from 'node:crypto';
import { escapeHtml } from '@cogniate/shared';

export { escapeHtml };

/** Fill `{LMS}` in a text template (one text table per page group, with the LMS name as a parameter). */
export const withLms = (text: string, lms: string): string => text.replaceAll('{LMS}', lms);

/** A fresh nonce for one response (script-src 'nonce-…'). */
export const newNonce = (): string => randomBytes(18).toString('base64');

export type ToolPageKind = 'register-form' | 'register-result' | 'error' | 'picker' | 'picker-submit' | 'play' | 'embedded';

export interface ToolPageOptions {
  /** Origin of the connection siteUrl (register pages). */
  site?: string;
  /** M1: origin of the connection site URL (picker and embedded pages; for Moodle the issuer origin). */
  issuer?: string;
  /** Origin of deep_link_return_url (picker auto-submit). */
  returnOrigin?: string;
  /** PUBLIC_CONTENT_URL (player shell runtime frame). */
  content?: string;
  nonce?: string;
}

function need(opts: ToolPageOptions, ...keys: Array<keyof ToolPageOptions>): void {
  for (const k of keys) if (!opts[k]) throw new Error(`${keys.join(' and ')} required`);
}

/**
 * Security §5 Content-Security-Policy per page (main parts):
 *  - GET /tool/register (confirm form):  frame-ancestors {site}; form-action 'self'; script-src 'nonce-…'
 *  - POST /tool/register result:         frame-ancestors {site}; form-action 'none'; script-src 'nonce-…'
 *  - every /tool/* error page:           frame-ancestors https:; form-action 'none' (no form, so any https frame is safe)
 *  - GET /tool/picker/{id}:              frame-ancestors {issuer}; form-action 'self'
 *  - POST /tool/picker/{id} auto-submit: frame-ancestors {issuer}; form-action {return}; script-src 'nonce-…'
 *  - /play/{id}:                         frame-ancestors 'none'; frame-src {content}; script-src 'nonce-…' (+ connect-src 'self')
 *  - /play/{id}/embedded:                frame-ancestors {issuer}; form-action 'none'
 */
export function contentSecurityPolicy(kind: ToolPageKind, opts: ToolPageOptions = {}): string {
  const base = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'";
  const script = () => `script-src 'nonce-${opts.nonce}'`;
  switch (kind) {
    case 'error':
      return `${base}; frame-ancestors https:; form-action 'none'`;
    case 'register-form':
      need(opts, 'site', 'nonce');
      return `${base}; ${script()}; frame-ancestors ${opts.site}; form-action 'self'`;
    case 'register-result':
      need(opts, 'site', 'nonce');
      return `${base}; ${script()}; frame-ancestors ${opts.site}; form-action 'none'`;
    case 'picker':
      need(opts, 'issuer');
      return `${base}; frame-ancestors ${opts.issuer}; form-action 'self'`;
    case 'picker-submit':
      need(opts, 'issuer', 'returnOrigin', 'nonce');
      return `${base}; ${script()}; frame-ancestors ${opts.issuer}; form-action ${opts.returnOrigin}`;
    case 'play':
      need(opts, 'content', 'nonce');
      return `${base}; ${script()}; connect-src 'self'; frame-src ${opts.content}; frame-ancestors 'none'; form-action 'none'`;
    case 'embedded':
      need(opts, 'issuer');
      // M1 (§6.1): the Canvas page adds its top-level continuation script with a nonce.
      return opts.nonce ? `${base}; ${script()}; frame-ancestors ${opts.issuer}; form-action 'none'` : `${base}; frame-ancestors ${opts.issuer}; form-action 'none'`;
  }
}

/** All tool pages: the CSP above, Referrer-Policy same-origin, no-store, nosniff. Never X-Frame-Options or Set-Cookie. */
export function toolPageHeaders(kind: ToolPageKind, opts: ToolPageOptions = {}): Record<string, string> {
  return {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': contentSecurityPolicy(kind, opts),
    'referrer-policy': 'same-origin',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
}

/** Security §5: the 303 of /tool/launch and /tool/deep-link. no-referrer keeps the ltik URL out of the next request. */
export function handoffRedirectHeaders(location: string): Record<string, string> {
  return { location, 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' };
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
fieldset { border: 0; margin: 0 0 16px; padding: 0; display: grid; gap: 8px; } legend { margin-bottom: 8px; color: hsl(var(--muted)); }
.option { display: flex; gap: 12px; align-items: flex-start; border: 1px solid hsl(var(--card-border)); border-radius: var(--radius); padding: 12px; cursor: pointer; }
.option-text { display: grid; gap: 4px; } .title { font-weight: 600; overflow-wrap: anywhere; } .meta { color: hsl(var(--muted)); font-size: 13px; overflow-wrap: anywhere; }
.badge { display: inline-block; border: 1px solid hsl(var(--primary)); color: hsl(var(--primary)); border-radius: 999px; padding: 0 8px; font-size: 12px; font-weight: 600; }
a.button { display: inline-block; text-decoration: none; background: linear-gradient(135deg, hsl(270 70% 65%), hsl(290 70% 60%)); color: #fff;
  border-radius: var(--radius); padding: 10px 22px; font-weight: 600; }
body.shell { display: block; padding: 0; }
.shell-bar { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: center; justify-content: space-between; padding: 10px 20px;
  background: hsl(var(--card)); border-bottom: 1px solid hsl(var(--card-border)); }
.shell-bar h1 { margin: 0; font-size: 17px; overflow-wrap: anywhere; } .shell-bar p { margin: 0; }
.shell-bar a { color: hsl(var(--primary)); font-weight: 600; }
.shell-frame { display: block; width: 100%; height: calc(100vh - 64px); border: 0; background: #fff; }
`;

export function layout(title: string, body: string, nonceScript?: { nonce: string; js: string }, bodyClass?: string): string {
  const script = nonceScript ? `\n<script nonce="${escapeHtml(nonceScript.nonce)}">${nonceScript.js}</script>` : '';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ''}>
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
