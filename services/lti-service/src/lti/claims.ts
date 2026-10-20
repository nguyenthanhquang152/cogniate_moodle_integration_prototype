// The claim allowlist (ADR-011 §9, LTI contract §9.8): for profiles with `minimizeClaims`, only these claims and
// members are stored. It runs after every launch check (also check 14) and before the launch is stored.
import type { Claims } from './checks.ts';
import { CLAIM } from './checks.ts';

const TOP_LEVEL = ['iss', 'sub', 'aud', 'azp', 'exp', 'iat', 'nonce'];

/** Kept LTI claims: `null` = keep the value as it is; a list = keep only these members of the object. */
const KEPT: ReadonlyMap<string, readonly string[] | null | 'all'> = new Map<string, readonly string[] | null | 'all'>([
  [CLAIM.messageType, null],
  [CLAIM.version, null],
  [CLAIM.deploymentId, null],
  [CLAIM.targetLinkUri, null],
  [CLAIM.roles, null],
  [CLAIM.context, ['id', 'label', 'title', 'type']],
  [CLAIM.resourceLink, ['id', 'title', 'description']],
  [CLAIM.toolPlatform, ['guid', 'name', 'description', 'url', 'product_family_code', 'version']],
  [CLAIM.launchPresentation, ['document_target', 'return_url', 'locale', 'width', 'height']],
  [CLAIM.deepLinkingSettings, 'all'],
  [CLAIM.ags, ['lineitems', 'lineitem', 'scope']],
  [CLAIM.nrps, ['context_memberships_url', 'service_versions']],
]);

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The allowlisted claims and the sorted names of what was removed: a top-level claim name, or `<claim>#<member>` for a
 * removed member of a kept claim. No values are returned for the log.
 */
export function minimizeClaims(claims: Claims): { kept: Claims; removed: string[] } {
  const kept: Claims = {};
  const removed: string[] = [];
  for (const [name, value] of Object.entries(claims)) {
    if (TOP_LEVEL.includes(name)) { kept[name] = value; continue; }
    const rule = KEPT.get(name);
    if (rule === undefined) { removed.push(name); continue; }
    if (rule === null || rule === 'all') { kept[name] = value; continue; }
    // A member-filtered claim must be an object; any other value is dropped as a whole.
    if (!isObj(value)) { removed.push(name); continue; }
    const members: Record<string, unknown> = {};
    for (const [member, v] of Object.entries(value)) {
      if (rule.includes(member)) members[member] = v;
      else removed.push(`${name}#${member}`);
    }
    kept[name] = members;
  }
  return { kept, removed: removed.sort() };
}
