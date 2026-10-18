import type { LaunchRecord } from '../store/launches.ts';
import type { Platform } from '../store/platforms.ts';
import type { Claims } from './checks.ts';
import { CLAIM } from './checks.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined);
const s = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Drop undefined values (fields are omitted when the claim is absent). */
function compact<T extends Obj>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * GET /api/idtoken: the LTIAAS-shaped ID token (contract §3.1). `serviceKey` (T3a, contract §3.3) is given by the
 * caller when AGS or NRPS is available.
 */
export function toIdToken(launch: LaunchRecord, platform: Platform, serviceKey?: string): Obj {
  const c: Claims = launch.claims;
  const aud = c.aud;
  const clientId = s(c.azp) ?? (typeof aud === 'string' ? aud : Array.isArray(aud) ? s(aud[0]) : undefined);
  const tp = obj(c[CLAIM.toolPlatform]) ?? {};
  const ctx = obj(c[CLAIM.context]);
  const rl = obj(c[CLAIM.resourceLink]);
  const pres = obj(c[CLAIM.launchPresentation]);
  const dl = obj(c[CLAIM.deepLinkingSettings]);
  const ags = obj(c[CLAIM.ags]);
  const isDeepLinking = launch.messageType === 'LtiDeepLinkingRequest';
  const docTarget = pres ? s(pres.document_target) : undefined;

  return {
    ltiVersion: s(c[CLAIM.version]),
    user: compact({
      id: s(c.sub), roles: Array.isArray(c[CLAIM.roles]) ? c[CLAIM.roles] : [],
      email: s(c.email), name: s(c.name), givenName: s(c.given_name), familyName: s(c.family_name),
    }),
    platform: {
      id: platform.id, url: s(c.iss), clientId, deploymentId: s(c[CLAIM.deploymentId]),
      name: s(tp.name) ?? platform.name, guid: s(tp.guid) ?? '', productFamilyCode: s(tp.product_family_code) ?? platform.productFamilyCode ?? '',
      version: s(tp.version) ?? '', description: s(tp.description) ?? '', contactEmail: s(tp.contact_email) ?? '',
    },
    launch: compact({
      type: launch.messageType,
      target: s(c[CLAIM.targetLinkUri]),
      context: ctx ? compact({ id: s(ctx.id), label: s(ctx.label), title: s(ctx.title), type: Array.isArray(ctx.type) ? ctx.type : undefined }) : undefined,
      resourceLink: isDeepLinking || !rl ? undefined : { id: s(rl.id) ?? '', title: s(rl.title) ?? '', description: s(rl.description) ?? '' },
      presentation: pres ? compact({
        locale: s(pres.locale), documentTarget: docTarget, document_target: docTarget, returnUrl: s(pres.return_url),
        width: typeof pres.width === 'number' ? pres.width : undefined, height: typeof pres.height === 'number' ? pres.height : undefined,
      }) : undefined,
      custom: obj(c[CLAIM.custom]) ?? {},
      deepLinkingSettings: isDeepLinking && dl ? compact({
        acceptTypes: dl.accept_types, acceptMultiple: dl.accept_multiple, acceptPresentationDocumentTargets: dl.accept_presentation_document_targets,
        autoCreate: dl.auto_create, title: dl.title, text: dl.text,
      }) : undefined,
    }),
    services: compact({
      deepLinking: { available: isDeepLinking },
      namesAndRoles: { available: obj(c[CLAIM.nrps]) !== undefined },
      assignmentAndGrades: compact({ available: ags !== undefined, lineItemId: ags ? s(ags.lineitem) : undefined }),
      outcomes: { available: false }, // LTI 1.1 Basic Outcomes is not supported; this is separate from AGS.
      serviceKey,
    }),
  };
}
