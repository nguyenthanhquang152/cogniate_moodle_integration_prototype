// POST /api/deeplinking (contract §3.2, security §2.3): check the content items, then sign the Deep Linking response.
// The JWT content_items equal the request items; the only field the service may add is the default ltiResourceLink url.
import type { JWTPayload } from 'jose';
import { escapeHtml, randomToken } from '@cogniate/shared';
import type { PublicUrls } from '@cogniate/shared';
import { ApiError } from '../api-errors.ts';
import type { LaunchRecord } from '../store/launches.ts';
import type { Platform } from '../store/platforms.ts';
import { CLAIM } from './checks.ts';
import { isHttpsUrl } from './platform-rules.ts';
import { isOwnLaunchTarget, launchUri } from './target.ts';

export const DL_CLAIM = {
  contentItems: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  data: 'https://purl.imsglobal.org/spec/lti-dl/claim/data',
  msg: 'https://purl.imsglobal.org/spec/lti-dl/claim/msg',
  log: 'https://purl.imsglobal.org/spec/lti-dl/claim/log',
  errormsg: 'https://purl.imsglobal.org/spec/lti-dl/claim/errormsg',
  errorlog: 'https://purl.imsglobal.org/spec/lti-dl/claim/errorlog',
} as const;

export const CONTENT_ITEM_TYPES = ['ltiResourceLink', 'link', 'file', 'html', 'image'] as const;
export const MAX_CONTENT_ITEMS = 20;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (index: number | null, why: string) => new ApiError('INVALID_CONTENT_ITEM', index === null ? why : `contentItems[${index}]: ${why}`);

export interface DeepLinkingOptions {
  message?: string;
  log?: string;
  errMessage?: string;
  errLog?: string;
}

/**
 * The checked content items (contract §3.2 rules). `settings` = the deep_linking_settings claim of the launch.
 * Rules: 1 to 20 items, exactly 1 if accept_multiple is false; type in accept_types; ltiResourceLink url = our launch
 * URL (set when missing); lineItem.scoreMaximum > 0; custom values are strings.
 */
export function checkContentItems(items: unknown, settings: Obj, urls: PublicUrls, accountId: string): Obj[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_CONTENT_ITEMS) throw bad(null, `send 1 to ${MAX_CONTENT_ITEMS} content items`);
  if (settings.accept_multiple === false && items.length !== 1) throw bad(null, 'the platform accepts exactly one content item (accept_multiple is false)');
  const accepted = Array.isArray(settings.accept_types) ? settings.accept_types.filter((t): t is string => typeof t === 'string') : [...CONTENT_ITEM_TYPES];
  return items.map((item, i) => {
    if (!isObj(item)) throw bad(i, 'must be an object');
    const type = item.type;
    if (typeof type !== 'string' || !CONTENT_ITEM_TYPES.includes(type as (typeof CONTENT_ITEM_TYPES)[number])) throw bad(i, `type must be one of ${CONTENT_ITEM_TYPES.join(', ')}`);
    if (!accepted.includes(type)) throw bad(i, `the platform does not accept type ${type}`);
    if (item.custom !== undefined && (!isObj(item.custom) || !Object.values(item.custom).every((v) => typeof v === 'string'))) {
      throw bad(i, 'custom values must be strings');
    }
    if (item.lineItem !== undefined) {
      const li = item.lineItem;
      if (!isObj(li) || typeof li.scoreMaximum !== 'number' || !Number.isFinite(li.scoreMaximum) || li.scoreMaximum <= 0) {
        throw bad(i, 'lineItem.scoreMaximum must be a number > 0');
      }
    }
    if (type !== 'ltiResourceLink') return { ...item };
    if (item.url === undefined) return { ...item, url: launchUri(urls, accountId) };
    if (!isOwnLaunchTarget(item.url, urls, accountId)) throw bad(i, `url must start with ${launchUri(urls, accountId)}`);
    return { ...item };
  });
}

/**
 * The claims of the Deep Linking response JWT (security §2.3), and the return URL. The caller signs the claims with
 * signToolJwt (iat = now - 30 s, exp = now + 300 s). Not a deep-linking launch -> 403 SERVICE_NOT_AVAILABLE.
 */
export function deepLinkingResponse(
  launch: LaunchRecord,
  platform: Platform,
  body: { contentItems?: unknown; options?: unknown },
  urls: PublicUrls,
): { claims: JWTPayload; target: string } {
  const settings = launch.claims[CLAIM.deepLinkingSettings];
  if (launch.messageType !== 'LtiDeepLinkingRequest' || !isObj(settings) || typeof settings.deep_link_return_url !== 'string') {
    throw new ApiError('SERVICE_NOT_AVAILABLE', 'This launch is not a Deep Linking request.');
  }
  // Check before signing: every alias returns this target, and /form uses it as the form action.
  const target = settings.deep_link_return_url;
  if (!isHttpsUrl(target) || new URL(target).origin !== new URL(platform.issuer).origin) {
    throw new ApiError('INVALID_DEEP_LINK_RETURN_URL');
  }
  const items = checkContentItems(body.contentItems, settings, urls, launch.toolAccountId);
  const options: DeepLinkingOptions = isObj(body.options) ? (body.options as DeepLinkingOptions) : {};
  const text = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v.slice(0, 2000) : undefined);
  const claims: JWTPayload = {
    iss: platform.clientId,
    aud: platform.issuer,
    nonce: randomToken(),
    [CLAIM.deploymentId]: launch.deploymentId,
    [CLAIM.messageType]: 'LtiDeepLinkingResponse',
    [CLAIM.version]: '1.3.0',
    [DL_CLAIM.contentItems]: items,
  };
  if (settings.data !== undefined) claims[DL_CLAIM.data] = settings.data;
  const extras: Array<[string, unknown]> = [[DL_CLAIM.msg, options.message], [DL_CLAIM.log, options.log], [DL_CLAIM.errormsg, options.errMessage], [DL_CLAIM.errorlog, options.errLog]];
  for (const [claim, value] of extras) {
    const t = text(value);
    if (t !== undefined) claims[claim] = t;
  }
  return { claims, target };
}

/** Contract §3.2: all data stays inside escaped attributes; the submit script is fixed. */
export function deepLinkingForm(response: { target: string; message: string }): string {
  return `<form id="lti_dl_submit" style="display:none" action="${escapeHtml(response.target)}" method="POST"><input type="hidden" name="JWT" value="${escapeHtml(response.message)}"/></form><script>document.getElementById("lti_dl_submit").submit()</script>`;
}
