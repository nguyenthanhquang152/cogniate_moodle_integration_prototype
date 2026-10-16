// Dev seed helper (npm run seed:lti-manual). Runs INSIDE the lti-service container. Registers a platform through the
// public API (POST {PUBLIC_LTI_URL}/api/platforms, Bearer API key), so the seed uses the same path as a real client.
// stdin: {"apiKey": "...", "platform": { url, clientId, name, authenticationEndpoint, accesstokenEndpoint, authConfig, deploymentIds }}
// Idempotent: on 409 it finds the platform by (url, clientId), and makes sure it is active and has the deployment ids.
// Prints one JSON line: {platformId, created}.
import { readFileSync } from 'node:fs';
import { loadPublicUrls } from '@cogniate/shared';

interface PlatformView { id: string; active: boolean; deploymentIds: string[] }

const input = JSON.parse(readFileSync(0, 'utf8')) as { apiKey: string; platform: { url: string; clientId: string; deploymentIds: string[] } & Record<string, unknown> };
const base = `${loadPublicUrls().lti}/api/platforms`;
const headers = { authorization: `Bearer ${input.apiKey}`, 'content-type': 'application/json' };

async function call(method: string, url: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text();
  return { status: res.status, json: text ? (JSON.parse(text) as unknown) : null };
}

const created = await call('POST', base, input.platform);
if (created.status === 201) {
  console.log(JSON.stringify({ platformId: (created.json as PlatformView).id, created: true }));
  process.exit(0);
}
if (created.status !== 409) {
  console.error(`POST /api/platforms answered ${created.status}: ${JSON.stringify(created.json)}`);
  process.exit(1);
}
const q = new URLSearchParams({ url: input.platform.url, clientId: input.platform.clientId });
const list = await call('GET', `${base}?${q}`);
const existing = (list.json as { platforms: PlatformView[] }).platforms[0];
if (!existing) {
  console.error('409 from POST, but the platform was not found');
  process.exit(1);
}
const wanted = [...new Set([...existing.deploymentIds, ...input.platform.deploymentIds])];
if (!existing.active || wanted.length !== existing.deploymentIds.length) {
  const patched = await call('PATCH', `${base}/${existing.id}`, { active: true, deploymentIds: wanted });
  if (patched.status !== 200) {
    console.error(`PATCH answered ${patched.status}`);
    process.exit(1);
  }
}
console.log(JSON.stringify({ platformId: existing.id, created: false }));
