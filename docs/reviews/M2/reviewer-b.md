Verdict: CHANGES_REQUESTED
Round: 1

Reviewer: dedicated Reviewer-B, Codex GPT-6-Astra xhigh. Date: 2026-10-20.

Reviewed commit: `9964e6f132e6608216616bff621e3f9ba5667b04`.
Product code: `76b03c7f24c15de2f7e164b836b27a398d45158a` (unchanged by the harness supplement).
Accepted M0 behavior: `56591df0e71939d5d62c9042c630c841d01f84e8`.
Implementation comparison baseline: `294114092b643766b5f552150038b812513da1d0`.

This is an independent implementation and prepared-harness review. It is not a QA acceptance result or live-provider approval. Code was read from a detached external clone at the exact reviewed commit. No stack, tenant, sign-up, database migration on persistent data, or live provider check was run. Only these review reports change the integration checkout. The Lead requested round-1 delivery now; fixes need a separate review at their exact commits.

## Result

One open MINOR product finding needs correction. This report also requests changes because the committed M2 browser harness cannot yet establish its acceptance claims: B-M3-01 and B-M3-02 affect the wizard, connection-list and route checks. No independent M2 product MAJOR was found by source review. The M1 containment and grant-order defects remain dependencies of these flows.

## B-M2-01 — MINOR — Learn setup omits the final Submit

Location: `apps/portal/src/connect/blackboard/blackboard-steps.json:19` through line 22.

The steps submit the Client ID, set user fields and service policies, then tell the administrator to copy the Deployment ID. They omit the final Submit that adds the configured tool to Learn. The first Submit retrieves the application configuration; it does not replace the final save after policies.

Evidence: the current primary [Anthology Set Up LTIs guide](https://help.anthology.com/blackboard/administrator/en/integrations/learning-tools-interoperability/set-up-ltis.html), “Add LTI 1.3/Advantage tools,” separates retrieval after the Client ID from the final Submit after policies (read 2026-10-20). The product's displayed instruction list ends before that final action. This is a documentation-to-product workflow comparison, not a live tenant observation.

Impact: an administrator can return to Cogniate with identifiers before completing the Learn-side registration. A teacher then cannot use the expected tool even if the local approval step succeeds.

Correction: add the final Submit after the policy choices and before returning to Cogniate. Keep `verified: false` until an authorized live workflow proves the exact tenant UI. The operator still validates the admin request and issues the one-time code; the UI must not imply that the code itself completes Learn setup.

## Flow and maintainability assessment

Provider wizard components reuse common connection and error handling. The registry and capability fields keep Moodle web services and course-shell actions out of Canvas and Blackboard flows. Card status selection filters by LMS and orders connections. Route/library changes reset scoped view state and abort stale fetches. Approval codes are cleared on submit and are not stored in the URL or browser storage by the reviewed code.

Canvas exports use the backend configuration body, with the inline public-key alternative and key-id display. The pending wizard shows setup and approval together; that is why the harness assumption of a second Next button is incorrect. Teacher instructions include the Canvas assignment steps and separate Learn Ultra/Original paths. Their `verified` values remain false. A successful simulator journey cannot change that live verification status.

Registered Canvas detail exposes add-deployment approval; the other providers do not. Disconnect wording distinguishes a Blackboard deployment from its shared platform and warns that old links do not become valid after reconnect. Publication choices identify the LMS and host. The reviewed results and player texts use provider labels. No broad UI redesign is needed for this round.

## Criterion coverage

These are independent code/harness review observations. All browser acceptance is NOT RUN here. The full M2 browser harness discovers 64 rows, but discovery does not execute them.

| Criterion | Reviewed implementation and harness | Result / remaining issue |
| --- | --- | --- |
| AC-M2-01 | LMS-filtered cards, newest status and Moodle flow; `01-cards.m2.ts` | No product issue found; final Moodle regression and equal-name/time browser evidence remain. |
| AC-M2-02 | Shared-platform readiness and Blackboard client display; `00-blackboard-not-ready.m2.ts` | Ready/not-ready code paths present; browser evidence remains. |
| AC-M2-03 | Canvas profile labels and origin validation; `02-canvas-wizard.m2.ts` | Sixteen site-rule rows prepared; browser evidence remains. |
| AC-M2-04 | Configuration rows, exact copy/download, inline key and clipboard fallback | Code paths present; B-M3-01 blocks wizard-dependent evidence; domain wording question is in M3. |
| AC-M2-05 | Initial approval, error mapping, clearing code and teacher state | Code paths present; B-M3-01 blocks tests; B-M1-03 affects remote-outage refusal. |
| AC-M2-06 | Blackboard approval/retry, field error and teacher steps | B-M2-01 omits final admin Submit; B-M3-01 blocks browser tests. DEPLOYMENT_FIXED remains a unit-only defensive text case as specified. |
| AC-M2-07 | ConnectionOverview badges; Canvas site/service/add-deployment detail | B-M3-01 navigates the badge test to the wrong page. |
| AC-M2-08 | Capability-hidden web services/course shell and Moodle-only backup label | Code guards and UI selection agree; legacy T8 proof remains. |
| AC-M2-09 | Provider-specific disconnect and unchanged Moodle warning | Product text inspected; QA H-3 needs the exact accepted Moodle baseline, not a contains-Moodle assertion. |
| AC-M2-10 | Publish title/options and Canvas results identity | No product issue found; exact browser evidence remains. |
| AC-M2-11 | Label/focus/status structure and keyboard/axe test recipe | Source structure inspected; B-M3-01 prevents completing planned keyboard/axe setup. No accessibility PASS claimed. |
| AC-M2-12 | Two provider portal-to-simulator journeys and score result | Prepared flows use the simulator; B-M3-01 blocks wizard setup. No end-to-end run occurred. |
| AC-M2-13 | Provider/library mismatch and route-scoped reset | No product leakage found; B-M3-02 destroys the document under observation and cannot prove the transition claim. |

## Independent checks and completion limits

The focused root run passed 151 tests in 14 files; it included portal `multi-lms.test.ts`, `connect/canvas/canvas.test.ts` and `connect/blackboard/blackboard.test.ts`. See the M1 report for the full set. At `9964e6f`, `node tests/e2e/host/run-m2.mjs --harness-only` passed two coverage self-tests, the tests TypeScript check, discovery/accounting of all 64 browser cases, and confirmation that the T7 selector excludes M2 files. It started no browser acceptance run or stack.

Correct the setup instruction and the two M3 harness findings. QA must then run the 1440 px Chromium suite, preserve masked screenshots for every wizard step, and complete the approved Moodle regression label alignment. Live Canvas and Blackboard teacher/learner paths remain UNVERIFIED; the public vendor guide supports the instruction correction only.
