import { htmlEscape, json } from './runtime.mjs';

function required(condition, message) {
  if (!condition) throw new Error(message);
}

export function createStorageHandlers(runtime, config, activeScenarioFor) {
  function storageScript() {
    return `<script>
(function() {
  window.addEventListener('message', async function(event) {
    if (!event.origin || !event.origin.startsWith('https://') || !event.source) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.subject !== 'lti.put_data' && data.subject !== 'lti.get_data') return;
    if (typeof data.message_id !== 'string' || !data.message_id || typeof data.key !== 'string' || !data.key) return;
    try {
      const res = await fetch('/__storage', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-storage-origin': event.origin },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const payload = await res.json();
        event.source.postMessage(payload.response, payload.targetOrigin);
      }
    } catch {}
  });
})();
</script>`;
  }

  function storageFrame() {
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      body: `<!doctype html><meta charset="utf-8"><title>QA LMS storage frame</title>${storageScript()}`,
    };
  }

  function storageMessage(request) {
    const senderOrigin = String(request.headers['x-storage-origin'] ?? request.headers.origin ?? '');
    required(
      senderOrigin.startsWith('https://')
        && senderOrigin !== 'https://*'
        && senderOrigin !== `https://${request.host}`,
      'Storage sender origin must be an https:// tool origin distinct from the auth host',
    );
    const data = JSON.parse(request.body || '{}');
    required(data && typeof data === 'object', 'Storage message body must be a JSON object');
    required(
      data.subject === 'lti.put_data' || data.subject === 'lti.get_data',
      'Storage message subject must be "lti.put_data" or "lti.get_data"',
    );
    required(typeof data.message_id === 'string' && data.message_id.length > 0, 'Storage message_id must be a non-empty string');
    required(typeof data.key === 'string' && data.key.length > 0, 'Storage key must be a non-empty string');

    const partitionKey = `${config.id}::${senderOrigin}`;
    let originStore = runtime.storage.get(partitionKey);
    if (!originStore) {
      originStore = new Map();
      runtime.storage.set(partitionKey, originStore);
    }

    if (data.subject === 'lti.put_data') {
      required(typeof data.value === 'string', 'Storage value must be a string');
      originStore.set(data.key, data.value);
      const response = { subject: 'lti.put_data.response', message_id: data.message_id };
      runtime.record('storage', {
        provider: config.id,
        host: request.host,
        op: 'lti.put_data',
        origin: senderOrigin,
        messageId: data.message_id,
        key: data.key,
      });
      return json(200, { targetOrigin: senderOrigin, response, ...response });
    }

    const value = originStore.get(data.key);
    const response = {
      subject: 'lti.get_data.response',
      message_id: data.message_id,
      ...(value !== undefined ? { value } : {}),
    };
    runtime.record('storage', {
      provider: config.id,
      host: request.host,
      op: 'lti.get_data',
      origin: senderOrigin,
      messageId: data.message_id,
      key: data.key,
      hit: value !== undefined,
    });
    return json(200, { targetOrigin: senderOrigin, response, ...response });
  }

  function renderFrame(request) {
    const target = new URL(request.url.searchParams.get('url'));
    required(target.protocol === 'https:' && target.hostname.endsWith('.test'), 'Frame target must be an https://*.test URL');
    const explicitScenarioId = request.url.searchParams.get('scenario') ?? target.searchParams.get('login_hint');
    const frameScenario = explicitScenarioId && runtime.scenarios.get(explicitScenarioId)?.provider === config.id
      ? runtime.scenarios.get(explicitScenarioId)
      : activeScenarioFor();
    const activeStorage = request.url.searchParams.get('storage')
      ?? target.searchParams.get('lti_storage_target')
      ?? frameScenario?.storageTarget
      ?? null;
    if (!activeStorage) {
      return {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        body: `<!doctype html><title>QA LMS frame</title><iframe title="LTI tool" src="${htmlEscape(target.href)}" style="width:100%;height:90vh"></iframe>`,
      };
    }
    const siblingFrame = activeStorage === '_parent'
      ? ''
      : `<iframe name="${htmlEscape(activeStorage)}" src="https://${htmlEscape(config.auth.host)}/__storage" style="display:none"></iframe>`;
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      body: `<!doctype html><title>QA LMS frame</title>${siblingFrame}<iframe title="LTI tool" src="${htmlEscape(target.href)}" style="width:100%;height:90vh"></iframe>${storageScript()}`,
    };
  }

  return { storageScript, storageFrame, storageMessage, renderFrame };
}
