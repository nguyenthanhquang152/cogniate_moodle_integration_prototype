// Platform storage pages (LA-ADR-05 D1). Request values enter only the escaped JSON block.
import { randomToken, sha256Hex } from '@cogniate/shared';

export interface StorageLoginData {
  authUrl: string;
  state: string;
  target: string;
  origin: string;
}

/** JSON inside a script element must not contain an HTML close tag or a JavaScript line separator. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

const LOGIN_SCRIPT = `(() => {
  const data = JSON.parse(document.getElementById('lti-storage-data').textContent);
  if (window.parent === window) {
    window.location.replace(data.authUrl);
    return;
  }
  let finished = false;
  let timer;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    window.removeEventListener('message', receive);
    window.location.replace(data.authUrl);
  };
  const receive = (event) => {
    const reply = event.data;
    if (event.origin !== data.origin || !reply || typeof reply !== 'object' || Array.isArray(reply)
      || reply.subject !== 'lti.put_data.response' || reply.message_id !== data.messageId || 'error' in reply) return;
    finish();
  };
  window.addEventListener('message', receive);
  timer = setTimeout(finish, 1500);
  try {
    const target = data.target === '_parent' ? window.parent : window.parent.frames[data.target];
    if (!target) { finish(); return; }
    target.postMessage({ subject: 'lti.put_data', message_id: data.messageId, key: data.key, value: data.state }, data.origin);
  } catch { finish(); }
})();`;

/** A new CSP nonce and message id for each answer; the redirect URL is supplied by the one login builder. */
export function storageLoginPage(data: StorageLoginData): { status: 200; headers: Record<string, string>; html: string } {
  const nonce = randomToken();
  const json = scriptJson({ ...data, key: `cog_state_${sha256Hex(data.state)[0]}`, messageId: randomToken() });
  return {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors https:; form-action 'none'; base-uri 'none'`,
    },
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Cogniate sign-in</title></head>
<body>
<script id="lti-storage-data" type="application/json">${json}</script>
<script nonce="${nonce}">${LOGIN_SCRIPT}</script>
</body>
</html>
`,
  };
}
