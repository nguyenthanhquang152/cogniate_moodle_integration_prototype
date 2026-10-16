// T2a knob test: ltik expiry. Source: tasks/T2a.md AC-T2-07; tasks README §3 (LTIK_TTL_SECONDS = 20).
// The host runner restarts lti-service with the knob, runs only this test (QA_GREP, H14), then restores the default.
// The knob guard (lib/knobs.ts) skips this test when the knob is not active, and skips all other tests when it is.
import { ACCOUNT, apiKey, auth, errorCode, ltiApi, ltiSeed } from '../lib/lti';
import { launchActivity, newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const TTL_S = 20;

test('AC-T2-07 [knob LTIK_TTL_SECONDS=20] a ltik works < 10 s after the redirect and gives 401 at TTL + 3 s', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await newStackContext(browser);
  try {
    const cap = await launchActivity(context, seed().users.cg_student, ltiSeed().cmids['COGNIATE-DEV-101']);
    const issuedAt = cap.launchAt ?? Date.now();
    const key = apiKey(ACCOUNT);

    const early = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(key, cap.ltik!) });
    const earlyMs = Date.now() - issuedAt;
    expect(earlyMs, 'first call is less than 10 s after the redirect').toBeLessThan(10_000);
    expect(early.status, early.body).toBe(200);

    const waitMs = issuedAt + (TTL_S + 3) * 1000 - Date.now();
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    const late = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(key, cap.ltik!) });
    expect(late.status).toBe(401);
    expect(errorCode(late)).toBe('INVALID_LTIK_AUTH_AUTHORIZATION_HEADER');
    test.info().annotations.push({ type: 'timing', description: `first call ${earlyMs} ms after the 303; second call ${Date.now() - issuedAt} ms after it` });
  } finally {
    await context.close();
  }
});
