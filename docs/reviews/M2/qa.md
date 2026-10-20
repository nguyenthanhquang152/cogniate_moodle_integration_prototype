Verdict: PREPARED — harness checks only; product and browser acceptance NOT RUN
Round: 3, preparation task `task_1276def76f95`, dispatch `ctx_8d09d8d0f137`
Owner: independent Codex Canvas QA quota replacement, authorized by Lead for GPT-6-Astra at xhigh

## 1. Inputs and result

Lead authorized this quota replacement at `0b6808e05fe93c5dee9aa0537eae1f470a4be2ab`. The start handoff supplied applied contracts `ccdd9ef67cdd2be4c6af374136777fda4e081943` and narrow QA repair `3b160f7bc22ca43f18bc16c94ecfc336b0fe80d6`. Approved proposal: `78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`; approvals: `b6e8f739e6de752cb287929c9836734d2494e444`. Adopted A-D-09 precision governs.

M2 keeps **64 browser cases and all 13 criteria**. Every existing case ID, title and manifest entry remains unchanged. Exact neutral readiness checks extend the existing Canvas and Blackboard error cases. Expected text comes from applied M2 and app §4.7.3, not product code or author notes.

## 2. Prepared checks

| Existing case | Expected readiness result |
| --- | --- |
| `M2-05.lti-service-error` | The original LTI failure remains. With a previously issued Canvas code and simulation profiles now off, Save shows the neutral title and action. The connection stays pending and the code is cleared. |
| `M2-06.retry-after-error` | The original successful second Save remains. A separate pending connection refuses while its shared platform is inactive, shows the same text, and registers with the same code after reactivation. |

The exact title is `This LMS setup is not ready in Cogniate.`

The exact action is `Ask your Cogniate operator to check the LMS setup for this connection. The operator tells you to try again later, or to make a new connection.`

The Blackboard card guidance remains `Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.` It is still asserted in `M2-02.not-ready`; the two error cases require the separate neutral text above.

The current same-document, live-poll cancellation observation in `08-routes.m2.ts` is unchanged. Moodle still requires `Disconnect Moodle?` and `This stops launches through this connection. The tool stays in Moodle.` The card, route, detail and Moodle files have no diff.

## 3. Preparation evidence

| Check | Result |
| --- | --- |
| `node tests/e2e/host/run-m2.mjs --harness-only` | Two harness self-checks pass; typecheck passes; all 64 M2 rows are discovered and accounted; T7 discovery unchanged. |
| Manifest comparison | All 64 committed entries remain exactly equal. |
| Protected file comparison | `00-blackboard-not-ready.m2.ts`, `01-cards.m2.ts`, `04-detail.m2.ts` and `08-routes.m2.ts` unchanged. |
| `git diff --check` on owned files | Clean. |

These are discovery and harness results only. No browser acceptance, simulated product acceptance, stack, migration, legacy suite, full root check or tenant run occurred. There is no product PASS, screenshot evidence or live LMS claim.

## 4. Held paths and next handoff

- `tests/e2e/M2/02-canvas-wizard.m2.ts`
- `tests/e2e/M2/03-blackboard-wizard.m2.ts`
- `tests/e2e/M2/lib/m2.ts`
- `tests/acceptance/M1/canvas/browser.ts` — expands the action type to the existing host `m1-profile` control
- `docs/reviews/M2/qa-plan.md`
- `docs/reviews/M2/qa.md`

The shared browser helper is also listed once in [the Canvas M1 report](../M1/qa-canvas.md), which records all other Canvas paths and inventories. No M2 manifest, host runner, common QA file or product file changed. No commit or push was made.

Lead must integrate these paths and freeze the product and test SHAs for the separate independent verification task. Full M1 still requires both complete rounds, including the common QA owner's mixed-provider `011→012` route. M2 browser and real Moodle regression evidence remain pending.
