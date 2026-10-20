// Browser evidence helpers. Full capabilities go only to the private recorder.
const fields = ['ltik', 'id_token', 'state', 'nonce'];
// Form field → recorded kind. The signed Deep Linking response (form field JWT) is recorded as id_token, as T7 does.
const formFields = [...fields.map((kind) => [kind, kind]), ['JWT', 'id_token']];

/** Keep useful frame route shapes without credentials, query values, fragments or path capabilities. */
export function diagnosticUrl(value) {
  let url;
  try { url = new URL(value); } catch { return '[invalid URL]'; }
  if (url.href === 'about:blank') return 'about:blank';
  if (!['http:', 'https:'].includes(url.protocol)) return '[non-HTTP URL]';
  const pathname = url.pathname
    .replace(/^\/rt\/[^/]+/, '/rt/[runtime_token]')
    .replace(/^\/play\/[^/]+/, '/play/[play_id]')
    .replace(/^\/tool\/picker\/[^/]+/, '/tool/picker/[picker_id]');
  return url.origin + pathname;
}

/** Subscribe before navigation, including requests made before a failing frame wait. */
export function captureBrowserSecrets(context, record) {
  const listener = (request) => {
    let url;
    try { url = new URL(request.url()); } catch { return; }
    for (const kind of fields) for (const value of url.searchParams.getAll(kind)) record(kind, value);
    for (const [kind, pattern] of [
      ['runtime_token', /^\/rt\/([^/]+)/],
      ['play_id', /^\/play\/([^/]+)/],
      ['picker_id', /^\/tool\/picker\/([^/]+)/],
    ]) {
      const value = url.pathname.match(pattern)?.[1];
      if (value) {
        record(kind, value);
        // Scan both URL encoding and the decoded token if an encoded capability is used.
        try { const decoded = decodeURIComponent(value); if (decoded !== value) record(kind, decoded); } catch { /* malformed encoding */ }
      }
    }
    if (request.headers()['content-type']?.split(';')[0].trim() === 'application/x-www-form-urlencoded') {
      const form = new URLSearchParams(request.postData() ?? '');
      for (const [field, kind] of formFields) for (const value of form.getAll(field)) record(kind, value);
    }
  };
  context.on('request', listener);
  return () => context.off('request', listener);
}
