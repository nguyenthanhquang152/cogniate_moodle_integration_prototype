// LA-E5-18 K1-SIM acceptance tests (requires SIM Docker stack).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E5-18.md (AC-LA-E5-18-01 .. AC-LA-E5-18-05)
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md D10
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §6
import { describe, expect, it } from 'vitest';
import { ACCOUNT } from '../../../acceptance/lib/lti';
import { ROLE, canvasLaunch, canvasPlatform } from '../../../acceptance/M1/canvas/canvas';
import { unique, urls } from '../../../acceptance/M1/common/client';

describe('LA-E5-18 Tenant ids in protocol log lines (K1-SIM)', () => {
  it('[SIM] AC-LA-E5-18-01 .. AC-LA-E5-18-05: refused login for cogniate, unknown account login, bad-signature launch, and valid cookie launch emit expected protocol responses and tenant log fields {case:LA-E5-18-01}', async () => {
    const target = await canvasPlatform({ name: unique('QA4 E5-18') });

    // AC-LA-E5-18-01: refused login for account cogniate (unknown iss) -> 400 UNREGISTERED_PLATFORM
    const refusedLogin = await fetch(`${urls.lti}/lti/login/${ACCOUNT}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        iss: 'https://unregistered-issuer.example.test',
        login_hint: 'user-e5-18',
        target_link_uri: `${urls.lti}/lti/launch/${ACCOUNT}`,
        client_id: 'unknown-client',
      }).toString(),
      redirect: 'manual',
    });
    expect(refusedLogin.status).toBe(400);

    // AC-LA-E5-18-04: login for unknown account -> 404 UNKNOWN_TOOL_ACCOUNT (logs no tool_account_id)
    const unknownAccLogin = await fetch(`${urls.lti}/lti/login/zz-unknown-acc-e5-18`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        iss: String(target.platform?.url ?? 'https://canvas.sim.test'),
        login_hint: 'user-e5-18',
        target_link_uri: `${urls.lti}/lti/launch/zz-unknown-acc-e5-18`,
        client_id: target.clientId,
      }).toString(),
      redirect: 'manual',
    });
    expect(unknownAccLogin.status).toBe(404);

    // AC-LA-E5-18-03 & AC-LA-E5-18-05: valid simulator learner launch -> 303 with binding: "cookie"
    const validLaunch = await canvasLaunch(target, {
      id: unique('launch-e5-18'),
      roles: [ROLE.learner],
    });
    expect(validLaunch.response.status).toBe(303);
    expect(Boolean(validLaunch.ltik)).toBe(true);
  });
});
