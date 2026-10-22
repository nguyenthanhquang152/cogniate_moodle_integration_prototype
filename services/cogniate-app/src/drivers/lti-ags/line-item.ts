// ADR-010 rule 1: the AGS line item of an activity. The launch gives it; if it is missing, look it up with
// GET /api/lineitems?resourceLinkId= (SERVICE-AUTH-V1) and keep the answer. One place for the worker and for
// "Refresh from Moodle" (B-T5b-02).
import type { LtiClient } from '../../clients/lti-client.ts';
import type { Db } from '../../domain/db.ts';


export async function resolveLineItem(
  deps: { db: Db; lti: LtiClient },
  target: { resourceLinkId: string; platformResourceLinkId: string; lineItemId: string | null },
  serviceKey: string,
  traceId: string,
): Promise<string | null> {
  if (target.lineItemId !== null) return target.lineItemId;
  const found = (await deps.lti.findLineItems(serviceKey, target.platformResourceLinkId, traceId))[0]?.id ?? null;
  if (found !== null) deps.db.prepare('UPDATE resource_link SET line_item_id = ? WHERE id = ? AND line_item_id IS NULL').run(found, target.resourceLinkId);
  return found;
}
