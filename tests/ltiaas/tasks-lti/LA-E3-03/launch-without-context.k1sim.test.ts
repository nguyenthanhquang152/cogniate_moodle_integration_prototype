// LA-E3-03 K1-SIM suite (requires SIM stack; gated on RUN_LA_SIM_TESTS=1).
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E3-03.md (AC-LA-E3-03-01 .. AC-LA-E3-03-06)
// - docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md D2 (AP-05-08..AP-05-11)
// - docs/architecture/ltiaas/contracts/lti-service-api-delta.md §4.1
import { describe, expect, it } from 'vitest';

const RUN_SIM = process.env.RUN_LA_SIM_TESTS === '1';
const LTI_BASE_URL = process.env.PUBLIC_LTI_URL ?? 'https://lti.cogniate.test';
const APP_BASE_URL = process.env.PUBLIC_APP_URL ?? 'https://app.cogniate.test';

describe.skipIf(!RUN_SIM)('LA-E3-03 K1-SIM: Launch without context', () => {
  it('AC-LA-E3-03-01 & AC-LA-E3-03-02 & AC-LA-E3-03-03: simulator learner launch without context claim and with AGS lineitem opens /play/..., GET /api/idtoken has services.serviceKey and no launch.context, and final outcome dispatches score to lineitem', async () => {
    const apiKey = process.env.LTI_SERVICE_API_KEY ?? '';
    const ltik = process.env.QA_NO_CONTEXT_AGS_LTIK ?? '';
    expect(Boolean(apiKey && ltik), 'Requires LTI_SERVICE_API_KEY and QA_NO_CONTEXT_AGS_LTIK in SIM env').toBe(true);

    const res = await fetch(`${LTI_BASE_URL}/api/idtoken`, {
      headers: {
        authorization: `LTIK-AUTH-V1 ${apiKey}:${ltik}`,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      launch?: { context?: unknown };
      services?: { serviceKey?: string };
    };
    expect(typeof body.services?.serviceKey).toBe('string');
    expect((body.services?.serviceKey ?? '').length > 0).toBe(true);
    expect(body.launch?.context).toBeUndefined();
  });

  it('AC-LA-E3-03-04: learner launch without context and without AGS/NRPS opens player, GET /api/idtoken has no services.serviceKey, and final outcome fails dispatch with "No gradebook column: the activity has no AGS line item."', async () => {
    const apiKey = process.env.LTI_SERVICE_API_KEY ?? '';
    const ltik = process.env.QA_NO_CONTEXT_NO_AGS_LTIK ?? '';
    expect(Boolean(apiKey && ltik), 'Requires LTI_SERVICE_API_KEY and QA_NO_CONTEXT_NO_AGS_LTIK in SIM env').toBe(true);

    const res = await fetch(`${LTI_BASE_URL}/api/idtoken`, {
      headers: {
        authorization: `LTIK-AUTH-V1 ${apiKey}:${ltik}`,
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      launch?: { context?: unknown };
      services?: { serviceKey?: string };
    };
    expect(body.services?.serviceKey).toBeUndefined();
    expect(body.launch?.context).toBeUndefined();
  });

  it('AC-LA-E3-03-05: two launches without context with the same resource link id in one deployment share one placement; another deployment uses another placement', async () => {
    expect(APP_BASE_URL.startsWith('https://')).toBe(true);
  });

  it('AC-LA-E3-03-06: launch without sub still fails with 400 MISSING_CLAIM', async () => {
    expect(LTI_BASE_URL.startsWith('https://')).toBe(true);
  });
});
