// POST /api/deeplinking (contract §3.2, security §2.3): check the content items, then sign the Deep Linking response.
// The service defaults absent/null resource URLs and maps null custom data to an empty object.
import type { JWTPayload } from 'jose';
import { escapeHtml, randomToken } from '@cogniate/shared';
import type { ProtocolUrls } from './target.ts';
import { ApiError } from '../api-errors.ts';
import type { LaunchRecord } from '../store/launches.ts';
import { profileDefinition } from '../profiles/index.ts';
import type { Platform } from '../store/platforms.ts';
import { findDeployment, siteOriginOf } from '../store/platforms.ts';
import { CLAIM } from './checks.ts';
import { isHttpsUrl } from './platform-rules.ts';
import { isOwnLaunchTarget } from './target.ts';

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

/** An https URL (WHATWG parse). The platform opens it as given, so a fragment is valid here. */
const isHttpsItemUrl = (v: unknown): boolean => {
  if (typeof v !== 'string') return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Required fields per item type (Deep Linking 2.0 content item types, LA-ADR-05 D3e): link, file and image need an
 * https url; html needs a string html. The service adds no value to these types.
 */
function checkTypeFields(item: Obj, type: string, i: number): void {
  if (type === 'html') {
    if (typeof item.html !== 'string') throw bad(i, 'type html needs a string html');
    return;
  }
  if (!isHttpsItemUrl(item.url)) throw bad(i, `type ${type} needs an https url`);
}

export interface DeepLinkingOptions {
  message?: string;
  log?: string;
  errMessage?: string;
  errLog?: string;
}

/**
 * The checked content items (contract §3.2 rules). `settings` = the deep_linking_settings claim of the launch.
 * Rules: 0 to 20 items, at most 1 if accept_multiple is false; type in accept_types; ltiResourceLink url = our launch
 * URL (set when missing or null); link, file and image url = https; html item html = string; lineItem.scoreMaximum > 0;
 * custom values are strings.
 */
export function checkContentItems(items: unknown, settings: Obj, urls: Pick<ProtocolUrls, 'launch'>): Obj[] {
  if (!Array.isArray(items) || items.length > MAX_CONTENT_ITEMS) throw bad(null, `send 0 to ${MAX_CONTENT_ITEMS} content items`);
  if (settings.accept_multiple === false && items.length > 1) throw bad(null, 'the platform accepts at most one content item (accept_multiple is false)');
  const accepted = Array.isArray(settings.accept_types) ? settings.accept_types.filter((t): t is string => typeof t === 'string') : [...CONTENT_ITEM_TYPES];
  return items.map((input, i) => {
    if (!isObj(input)) throw bad(i, 'must be an object');
    // ltiaas-0.0.4 tolerance (contract §8 D14): null custom data means an empty object.
    const item = input.custom === null ? { ...input, custom: {} } : input;
    const type = item.type;
    if (typeof type !== 'string' || !CONTENT_ITEM_TYPES.includes(type as (typeof CONTENT_ITEM_TYPES)[number])) throw bad(i, `type must be one of ${CONTENT_ITEM_TYPES.join(', ')}`);
    if (!accepted.includes(type)) throw bad(i, `the platform does not accept type ${type}`);
    if (item.custom !== undefined && (!isObj(item.custom) || !Object.values(item.custom).every((v) => typeof v === 'string'))) {
      throw bad(i, 'custom values must be strings');
    }
    if (item.lineItem !== undefined) {
      if (settings.accept_lineitem === false) throw bad(i, 'the platform does not accept line items');
      const li = item.lineItem;
      if (!isObj(li) || typeof li.scoreMaximum !== 'number' || !Number.isFinite(li.scoreMaximum) || li.scoreMaximum <= 0) {
        throw bad(i, 'lineItem.scoreMaximum must be a number > 0');
      }
    }
    if (type !== 'ltiResourceLink') {
      checkTypeFields(item, type, i);
      return { ...item };
    }
    // ltiaas-0.0.4 tolerance (contract §8 D14): a null resource URL uses the default launch URL.
    if (item.url === undefined || item.url === null) return { ...item, url: urls.launch };
    if (!isOwnLaunchTarget(item.url, urls)) throw bad(i, `url must start with ${urls.launch}`);
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
  urls: Pick<ProtocolUrls, 'launch'>,
): { claims: JWTPayload; target: string } {
  const settings = launch.claims[CLAIM.deepLinkingSettings];
  if (launch.messageType !== 'LtiDeepLinkingRequest' || !isObj(settings) || typeof settings.deep_link_return_url !== 'string') {
    throw new ApiError('SERVICE_NOT_AVAILABLE', 'This launch is not a Deep Linking request.');
  }
  // Check before signing: every alias returns this target, and /form uses it as the form action. M1 (§9.10): on the
  // SITE origin of the launch (for standard the same value as the issuer origin). The target stays exactly as received.
  const target = settings.deep_link_return_url;
  const siteOrigin = launch.siteOrigin ?? siteOriginOf(platform, findDeployment(platform, launch.deploymentId));
  if (!isHttpsUrl(target) || new URL(target).origin !== siteOrigin) {
    throw new ApiError('INVALID_DEEP_LINK_RETURN_URL');
  }
  const items = checkContentItems(body.contentItems, settings, urls);
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
  // Profiles with deepLinkingResponseSub (Blackboard, F-BB-8): sub = client id.
  if (profileDefinition(platform.profile)?.flags.deepLinkingResponseSub) claims.sub = platform.clientId;
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
