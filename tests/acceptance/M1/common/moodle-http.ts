// Public Moodle/browser protocol over verified HTTPS, for the migration oracle.
// This is not browser/cookie interoperability evidence.
import { seed, type MoodleUser } from '../../lib/seed';
import { loadState } from '../../lib/lti';
import { APP, assert, expectStatus, httpsRequest, idToken, rememberSecret, urls, type Json } from './client';

const decode = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&#39;', "'");
function inputs(html: string) {
  const result: Record<string, string> = {};
  for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([a-z_-]+)\s*=\s*["']([^"']*)["']/gi)].map((m) => [m[1].toLowerCase(), decode(m[2])]));
    if (attrs.name) result[attrs.name] = attrs.value ?? '';
  }
  return result;
}
export async function moodleHttpPlay(user: MoodleUser = seed().users.cg_student) {
  const cookies = new Map<string, Map<string, string>>();
  const allowed = new Set([urls.moodle, urls.lti, urls.app]);
  const request = async (url: string, method = 'GET', fields?: Record<string, string>) => {
    const u = new URL(url); assert.ok(allowed.has(u.origin), 'Moodle launch stays on configured origins');
    const jar = cookies.get(u.origin) ?? new Map(); cookies.set(u.origin, jar);
    const response = await httpsRequest(url, { method, headers: {
      cookie: [...jar].map(([key, value]) => key + '=' + value).join('; '),
      ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    }, body: fields ? new URLSearchParams(fields).toString() : undefined });
    for (const raw of [response.headers['set-cookie'] ?? []].flat()) {
      const pair = raw.split(';')[0], at = pair.indexOf('=');
      const key = pair.slice(0, at), value = pair.slice(at + 1);
      if (/Max-Age=0/i.test(raw)) jar.delete(key);
      else { jar.set(key, value); rememberSecret(value); }
    }
    return response;
  };
  const page = await request(urls.moodle + '/login/index.php'); expectStatus(page, 200);
  const token = inputs(page.body).logintoken; assert.ok(token, 'Moodle logintoken exists');
  const login = await request(urls.moodle + '/login/index.php', 'POST', { logintoken: token, username: user.username, password: user.password });
  assert.ok([200, 302, 303].includes(login.status));
  if (login.headers.location) await request(new URL(String(login.headers.location), urls.moodle).href);
  const state = loadState('T5') as Json;
  const cmid = state.cmids?.['Cogniate SCORM']; assert.ok(cmid, 'T5a baseline activity exists');
  let url = `${urls.moodle}/mod/lti/launch.php?id=${cmid}&triggerview=0`, response = await request(url);
  let ltik = '';
  for (let hop = 0; hop < 20; hop++) {
    if (response.headers.location) {
      url = new URL(String(response.headers.location), url).href;
      const found = new URL(url).searchParams.get('ltik');
      if (found) { ltik = found; rememberSecret(found); }
      response = await request(url);
      if (/\/play\/ply_[^/]+$/.test(new URL(url).pathname)) break;
      continue;
    }
    const form = [...response.body.matchAll(/<form\b[^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/gi)]
      .map((m) => ({ action: decode(m[1]), fields: inputs(m[2]) }))
      .find((f) => f.fields.login_hint || f.fields.id_token);
    assert.ok(form, 'Moodle/OIDC auto-submit form exists');
    if (form.fields.id_token) rememberSecret(form.fields.id_token);
    url = new URL(form.action, url).href;
    response = await request(url, 'POST', form.fields);
  }
  expectStatus(response, 200); assert.ok(ltik, 'Signed Moodle launch produced an ltik');
  const playId = new URL(url).pathname.split('/')[2]; assert.match(playId, /^ply_/);
  const normalized = await idToken(ltik); expectStatus(normalized, 200);
  const runtimeUrl = response.body.match(/src="(https:[^"]+\/rt\/[^"]+)"/)?.[1];
  assert.ok(runtimeUrl, 'Moodle player runtime iframe exists');
  const runtimeToken = new URL(decode(runtimeUrl)).pathname.split('/')[2]; rememberSecret(runtimeToken);
  const rt = await httpsRequest(`${urls.content}/rt/${runtimeToken}/state`); expectStatus(rt, 200);
  return { token: normalized.json, ltik, playId, runtimeToken, state: JSON.parse(rt.body), shell: response };
}
