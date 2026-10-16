/**
 * Test helpers (unit tests only; no network). A fake platform with its own RSA key, a fake outbound client that
 * serves the platform JWKS, and an app built on an in-memory database.
 */
import type { JWK } from 'jose';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import type { CryptoKey } from 'jose';
import type { Logger, OutboundClient, PublicUrls } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import type { Db } from './db/index.ts';
import { openDb } from './db/index.ts';
import { buildApp } from './http/app.ts';
import { CLAIM } from './lti/checks.ts';
import { createPlatformKeys } from './lti/jwks.ts';
import { ensureAccount, ensureToolKey } from './store/accounts.ts';
import type { Platform } from './store/platforms.ts';
import { createPlatform } from './store/platforms.ts';

export const URLS: PublicUrls = {
  moodle: 'https://moodle.test', lti: 'https://lti.cogniate.test', app: 'https://app.cogniate.test', content: 'https://content.cogniate-content.test',
};
export const MASTER_KEY = Buffer.alloc(32, 7);
export const ISSUER = URLS.moodle;
export const CLIENT_ID = 'client-abc';
export const LAUNCH = `${URLS.lti}/lti/launch/cogniate`;

export interface PlatformKey { kid: string; privateKey: CryptoKey; publicJwk: JWK }

export async function makeKey(kid: string): Promise<PlatformKey> {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  return { kid, privateKey, publicJwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' } };
}

export function capturingLogger(): { logger: Logger; lines: Array<Record<string, unknown>> } {
  const lines: Array<Record<string, unknown>> = [];
  return { lines, logger: createLogger({ service: 'lti-service', level: 'debug', write: (l) => lines.push(JSON.parse(l) as Record<string, unknown>) }) };
}

/** Fake outbound client: serves { keys } for any URL and counts the calls. */
export function fakeOutbound(getKeys: () => JWK[]): OutboundClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    allowlist: [],
    async request(url) {
      calls.push(url);
      const body = Buffer.from(JSON.stringify({ keys: getKeys() }));
      return { status: 200, headers: {}, body, text: () => body.toString(), json: () => JSON.parse(body.toString()) as unknown };
    },
  };
}

/** Standard resource-link claims as Moodle sends them (spike §5d). */
export function moodleClaims(over: Record<string, unknown> = {}, nowS = Math.floor(Date.now() / 1000)): Record<string, unknown> {
  return {
    iss: ISSUER, aud: CLIENT_ID, sub: '5', iat: nowS, exp: nowS + 60, nonce: 'n',
    [CLAIM.deploymentId]: '1', [CLAIM.messageType]: 'LtiResourceLinkRequest', [CLAIM.version]: '1.3.0',
    [CLAIM.targetLinkUri]: `${LAUNCH}?resource=seed`, [CLAIM.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    [CLAIM.resourceLink]: { id: '3', title: 'Seed activity', description: '' },
    [CLAIM.context]: { id: '2', label: 'COGNIATE-DEV-101', title: 'Cogniate Dev Course 101', type: ['CourseSection'] },
    [CLAIM.toolPlatform]: { product_family_code: 'moodle', version: '2026042004', guid: 'g', name: 'moodle', description: 'Dev' },
    [CLAIM.launchPresentation]: { locale: 'en', document_target: 'window', return_url: `${URLS.moodle}/mod/lti/return.php?x=1` },
    ...over,
  };
}

export async function sign(key: PlatformKey, claims: Record<string, unknown>, header: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT(claims as Record<string, unknown>).setProtectedHeader({ alg: 'RS256', kid: key.kid, ...header }).sign(key.privateKey);
}

export interface Harness {
  db: Db;
  platform: Platform;
  apiKey: string;
  otherApiKey: string;
  key: PlatformKey;
  outbound: ReturnType<typeof fakeOutbound>;
  lines: Array<Record<string, unknown>>;
  clock: { now: number };
  app: Awaited<ReturnType<typeof buildApp>>;
}

/** Accounts cogniate + qa-second, one platform of cogniate, and the app. */
export async function harness(opts: { ltikTtlSeconds?: number } = {}): Promise<Harness> {
  const db = openDb(':memory:');
  const a = ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  const b = ensureAccount(db, { id: 'qa-second', name: 'QA second', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'cogniate');
  await ensureToolKey(db, MASTER_KEY, 'qa-second');
  const platform = createPlatform(db, 'cogniate', {
    issuer: ISSUER, clientId: CLIENT_ID, name: 'Moodle', authEndpoint: `${ISSUER}/mod/lti/auth.php`, tokenEndpoint: `${ISSUER}/mod/lti/token.php`,
    jwksUrl: `${ISSUER}/mod/lti/certs.php`, deploymentIds: ['1'], active: true,
  });
  const key = await makeKey('moodle-kid-1');
  const outbound = fakeOutbound(() => [key.publicJwk]);
  const { logger, lines } = capturingLogger();
  const clock = { now: Date.now() };
  const app = await buildApp({
    db, urls: URLS, logger, keys: createPlatformKeys(outbound, () => clock.now), ltikTtlSeconds: opts.ltikTtlSeconds ?? 86400,
    profile: 'default', knobs: [], now: () => clock.now,
  });
  return { db, platform, apiKey: a.apiKey!, otherApiKey: b.apiKey!, key, outbound, lines, clock, app };
}

export const loginForm = (over: Record<string, string> = {}) => new URLSearchParams({
  iss: ISSUER, login_hint: '5', target_link_uri: `${LAUNCH}?resource=seed`, lti_message_hint: '{"cmid":3}', client_id: CLIENT_ID, lti_deployment_id: '1', ...over,
}).toString();

/** Run a login and return state, nonce and the cookie header that the browser would send back. */
export async function doLogin(h: Harness, over: Record<string, string> = {}): Promise<{ state: string; nonce: string; cookie: string }> {
  const res = await h.app.inject({ method: 'POST', url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: loginForm(over) });
  if (res.statusCode !== 302) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  const loc = new URL(res.headers.location as string);
  const setCookie = String(res.headers['set-cookie']);
  return { state: loc.searchParams.get('state')!, nonce: loc.searchParams.get('nonce')!, cookie: setCookie.split(';')[0]! };
}

export async function postLaunch(h: Harness, form: Record<string, string>, cookie?: string) {
  return h.app.inject({
    method: 'POST', url: '/lti/launch/cogniate',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
    payload: new URLSearchParams(form).toString(),
  });
}
