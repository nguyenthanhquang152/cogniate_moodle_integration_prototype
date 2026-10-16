// QA-controlled LTI platform on qa-platform.test (hook H6, local-stack §3, acceptance profile).
// QA makes a key pair at run time, writes the public JWKS into tests/fixtures/qa-platform/ (served as static files;
// URL path = file path, Q-T0-42), registers the platform with POST /api/platforms, and signs its own id_tokens.
// No private key is written to disk. All calls are plain HTTPS from the test process (no browser).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { httpsRequest } from './https';
import { ACCOUNT, auth, LAUNCH_URL, LOGIN_URL, LTI_CLAIM, ltiApi, recordSecret } from './lti';
import { TESTS_DIR } from './paths';

export const QA_ISSUER = (process.env.QA_PLATFORM_URL ?? 'https://qa-platform.test').replace(/\/+$/, '');
export const QA_FIXTURE_DIR = path.join(TESTS_DIR, 'fixtures', 'qa-platform');
export const QA_DEPLOYMENT = 'qa-deployment-1';

type Key = CryptoKey;

export interface QaPlatform {
  clientId: string;
  platformId: string;
  kid: string;
  privateKey: Key;
  publicJwk: Record<string, unknown>;
  jwksUrl: string;
  jwksFile: string;
  /** A second key pair whose kid is NOT in the JWKS (AC-T2-21). */
  strangerKid: string;
  strangerKey: Key;
}

export async function setupQaPlatform(apiKey: string, label: string): Promise<QaPlatform> {
  const id = `${label}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const kid = `qa-${id}`;
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  fs.mkdirSync(QA_FIXTURE_DIR, { recursive: true });
  const jwksFile = `jwks-${id}.json`;
  fs.writeFileSync(path.join(QA_FIXTURE_DIR, jwksFile), JSON.stringify({ keys: [publicJwk] }));
  const stranger = await generateKeyPair('RS256');
  const clientId = `qa-client-${id}`;
  const jwksUrl = `${QA_ISSUER}/${jwksFile}`;
  const res = await ltiApi<{ id?: string }>('POST', '/api/platforms', {
    authorization: auth.bearer(apiKey),
    body: {
      url: QA_ISSUER,
      clientId,
      name: `QA platform ${id}`,
      authenticationEndpoint: `${QA_ISSUER}/auth`,
      accesstokenEndpoint: `${QA_ISSUER}/token`,
      authConfig: { method: 'JWK_SET', key: jwksUrl },
      deploymentIds: [QA_DEPLOYMENT],
    },
  });
  if (res.status !== 201 || !res.json?.id) throw new Error(`QA platform registration failed: HTTP ${res.status} ${res.body.slice(0, 300)}`);
  return {
    clientId,
    platformId: res.json.id,
    kid,
    privateKey,
    publicJwk,
    jwksUrl,
    jwksFile,
    strangerKid: `qa-stranger-${id}`,
    strangerKey: stranger.privateKey,
  };
}

export interface QaLogin {
  status: number;
  location: string;
  state: string;
  nonce: string;
  /** "name=value" of the state cookie, for the Cookie header. */
  cookie: string;
  targetLinkUri: string;
  traceId: string;
  body: string;
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

/** OIDC login initiation as the QA platform (security §2.1). */
export async function qaLogin(p: Pick<QaPlatform, 'clientId'>, targetLinkUri = `${LAUNCH_URL}?resource=qa`, iss = QA_ISSUER): Promise<QaLogin> {
  const body = form({ iss, login_hint: 'qa-user-1', target_link_uri: targetLinkUri, client_id: p.clientId, lti_deployment_id: QA_DEPLOYMENT, lti_message_hint: 'qa-hint' });
  const res = await httpsRequest(LOGIN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) },
    body,
  });
  const location = String(res.headers.location ?? '');
  let state = '';
  let nonce = '';
  try {
    const u = new URL(location);
    state = u.searchParams.get('state') ?? '';
    nonce = u.searchParams.get('nonce') ?? '';
  } catch {
    // no redirect
  }
  const setCookie = [res.headers['set-cookie'] ?? []].flat();
  const cookie = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('__Host-lti_state_')) ?? '';
  recordSecret('state', state);
  recordSecret('nonce', nonce);
  return { status: res.status, location, state, nonce, cookie, targetLinkUri, traceId: String(res.headers['x-trace-id'] ?? ''), body: res.body };
}

/** Valid resource-link claims for a QA launch (LTI 1.3 Core). Tests change one claim at a time. */
export function resourceLinkClaims(p: Pick<QaPlatform, 'clientId'>, login: QaLogin): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: QA_ISSUER,
    aud: p.clientId,
    sub: 'qa-user-1',
    iat: now,
    exp: now + 60,
    nonce: login.nonce,
    [`${LTI_CLAIM}message_type`]: 'LtiResourceLinkRequest',
    [`${LTI_CLAIM}version`]: '1.3.0',
    [`${LTI_CLAIM}deployment_id`]: QA_DEPLOYMENT,
    [`${LTI_CLAIM}target_link_uri`]: login.targetLinkUri,
    [`${LTI_CLAIM}resource_link`]: { id: 'qa-rl-1', title: 'QA resource link' },
    [`${LTI_CLAIM}roles`]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    [`${LTI_CLAIM}context`]: { id: 'qa-ctx-1', label: 'QA', title: 'QA context' },
  };
}

export async function signRs256(claims: Record<string, unknown>, key: Key, kid: string): Promise<string> {
  const token = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' }).sign(key);
  recordSecret('id_token', token);
  return token;
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** alg=none token (check 4). */
export function unsignedToken(claims: Record<string, unknown>, kid: string): string {
  return `${b64({ alg: 'none', kid, typ: 'JWT' })}.${b64(claims)}.`;
}

/** HS256 token with the JWKS `n` (decoded) as the HMAC key: the classic key-confusion attack (check 4). */
export async function hs256WithModulus(claims: Record<string, unknown>, p: QaPlatform): Promise<string> {
  const secret = new Uint8Array(Buffer.from(String(p.publicJwk.n), 'base64url'));
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256', kid: p.kid, typ: 'JWT' }).sign(secret);
}

export interface LaunchPost {
  status: number;
  location: string;
  body: string;
  traceId: string;
  headers: Record<string, string | string[] | undefined>;
}

/** POST /lti/launch/{account} with plain HTTPS. `cookie` = the state cookie ("name=value"), if any. */
export async function postLaunch(fields: Record<string, string>, cookie?: string, account = ACCOUNT): Promise<LaunchPost> {
  const body = form(fields);
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) };
  if (cookie) headers.cookie = cookie;
  const url = account === ACCOUNT ? LAUNCH_URL : LAUNCH_URL.replace(/\/[^/]+$/, `/${account}`);
  const res = await httpsRequest(url, { method: 'POST', headers, body });
  return { status: res.status, location: String(res.headers.location ?? ''), body: res.body, traceId: String(res.headers['x-trace-id'] ?? ''), headers: res.headers };
}
