# LTI as a Service v1 (milestone LA): start here

2026-10-24. The SHA of the first final runs: `a8bbac53`. The new final product SHA: `4f10c5fd` (LA plus the Blackboard and Canvas final result, LA-H27). Read time: about 5 minutes. The same content with diagrams is in [index.html](index.html). Open it from disk; it makes no network request.

Status: the results on `a8bbac53` are final for that SHA. The full gate runs again on `4f10c5fd`, so every gate and final-SHA claim says **pending: re-gate on 4f10c5fd (LD-29)**.

## 1. What LA is

LA turns the Cogniate LTI service into an "LTI as a service" product.

- Each LMS is one **channel**: one folder of data and settings under `packages/channels/<id>/`. The core code has no LMS name.
- A new LTI 1.3 LMS is one more folder. The core does not change.
- LA adds the controls that a paid service needs: rate limits, tool accounts, an operator API, an audit log, key rotation and backups.

LA keeps Moodle, Canvas and Blackboard as they were. LA adds two channels: a generic **LTI 1.3** channel (for any LMS of the same kind) and **D2L Brightspace**.

## 2. What LA built

| Area | What is in the product |
| --- | --- |
| Channels | One folder per LMS, found by discovery. Moodle, Canvas and Blackboard moved in with no behaviour change. New: LTI 1.3 (generic) and D2L Brightspace. |
| LTI Advantage | Framed launch without third-party cookies (platform storage); launch without a course context; Deep Linking with Cancel and several items; no NRPS scope in any channel; Canvas Dynamic Registration with an approval code; score extras; trusted extra audiences. |
| Grades and records | Placements and learning records; one send queue with leases; fair waiting when an LMS throttles; an optional separate worker process. |
| Operations and security | Rate limits; tool accounts; an operator API with its own keys; an audit log; API key and signing key rotation; key rings; service key revoke; safe retries; metrics and readiness checks; strict production start rules. |
| Onboarding (Could) | "Check connection" for Canvas and LTI 1.3; a connection health view. The record of launch refusals (LA-E6-06) is deferred. |
| Tests and gates | Contract suite (K0); a simulator with six LMS providers; a channel kit (K1); browser checks (K2); lint rules that keep LMS names out of the core; the add-a-channel gate (F2). |
| Guides | [Operator runbook](../../guides/ltiaas/operator-runbook.md); [LTI 1.3 admin](../../guides/ltiaas/lti-generic-admin.md); [D2L Brightspace admin](../../guides/ltiaas/brightspace-admin.md); [LA changes for Moodle, Canvas and Blackboard](../../guides/ltiaas/baseline-admin-changes.md); [Add a channel](../../guides/ltiaas/add-a-channel.md) (walkthrough fix, integration `77f58f62`; round 5: A and B APPROVE); [Spec deviations, LA-IC status, gate results](../../guides/ltiaas/spec-deviations.md). |

## 3. What QA proved

Read the label of each result. **SIM** means a QA stack with a simulated LMS. A SIM result is not a result on a real LMS site. The wave-end build is `8fadb828`; `a8bbac53`, the SHA of the first final runs, adds one portal attribute to it.

| Result | Label | Evidence |
| --- | --- | --- |
| Frozen regression suites: M1 394 of 394 rows and M2 64 of 64 browser cases, on the wave-end build and again on `a8bbac53`, the SHA of the first final runs, in both milestone-end runs. | SIM; pending: re-gate on 4f10c5fd (LD-29) | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §8, §12, §13; [run D2](../../reviews/LA-E7-08/run-D2.md) |
| API, log and page outputs of the baseline channels equal the frozen golden outputs, except the 13 approved intended changes (G1–G4 EQUAL on `a8bbac53`, the SHA of the first final runs). | SIM; pending: re-gate on 4f10c5fd (LD-29) | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §12 |
| Upgrade from the intake build keeps the data: migration 12 of 12 (a real Moodle score before and after), snapshot upgrade 6 of 6 (on `a8bbac53`, the SHA of the first final runs), upgrade route U1 37 of 37. | MOODLE-LIVE, SIM; pending: re-gate on 4f10c5fd (LD-29) | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §12.4; [LA-E5-08 qa](../../reviews/LA-E5-08/qa.md) |
| Full Moodle scenario test (T7): 3 runs of 17 checks on the wave-end build, and on `a8bbac53`, the SHA of the first final runs (1 run in slot 3F, 3 runs in each milestone-end run); the demo check is skipped, as in the baseline. | MOODLE-LIVE; pending: re-gate on 4f10c5fd (LD-29) | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §11, §12; [LA-E7-09 qa](../../reviews/LA-E7-09/qa.md) |
| Legacy Moodle test groups T2a–T8 give the baseline result per test id. | MOODLE-LIVE; pending: re-gate on 4f10c5fd (LD-29) | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §7–§10 |
| Two milestone-end full runs (D1 and D2) on `a8bbac53`, the SHA of the first final runs, SIM and Moodle lanes: M1, M2, golden outputs, T7 and T2a–T8 all PASS in each run. Three recorded findings failed first and passed on their rerun: a test race in T8 (WE-F13, fixed in the test) and two load flakes in run D2. | SIM, MOODLE-LIVE; pending: re-gate on 4f10c5fd (LD-29) | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §13; [run D2](../../reviews/LA-E7-08/run-D2.md) |
| 12 of 12 browser flows on the simulator, on `a8bbac53`, the SHA of the first final runs (portal, wizards, LTI 1.3 and D2L Brightspace flows, framed launch without the cookie). | K2 (on SIM); pending: re-gate on 4f10c5fd (LD-29) | [LA-E7-07 qa](../../reviews/LA-E7-07/qa.md) round 5 |
| D2L Brightspace changed 0 core files (F2 `core = 0`). | UNIT | [LA-E2-05 qa](../../reviews/LA-E2-05/qa.md) AC-LA-E2-05-01 |
| The LTI 1.3 and D2L Brightspace channels pass their task checks on their simulators. The full kit run also passed (last row). | SIM | [LA-E2-04 qa](../../reviews/LA-E2-04/qa.md) AC-08; [LA-E2-05 qa](../../reviews/LA-E2-05/qa.md) AC-10 |
| Service controls: rate limits, tool accounts, operator API, audit log, key lifecycle (API keys, key rings and re-wrap, signing keys), revoke, safe retries, metrics and readiness, production start rules, backup and restore. | SIM, UNIT | [proof map](service-controls.md): each claim with its QA report (LA-E5-01 to LA-E5-24) and the label of each check |
| Backup and restore drill; QA recorded the restore time and the backup age. | SIM | [LA-E5-24 qa](../../reviews/LA-E5-24/qa.md) |
| One tool account cannot read or change the data of another one on the new routes. | SIM | [LA-E5-13 qa](../../reviews/LA-E5-13/qa.md) |
| A walker who was new to the repository added the simulator LMS `acme-lms` as a new channel in 8 min 49 s (plan §4 measure 5). The F2 gate, K0, `npm run check` and the simulator checks pass. | UNIT | [LA-E8-02 qa](../../reviews/LA-E8-02/qa.md) (AC-01, -02, -04, -05) |
| The `acme-lms` kit K1 run on the simulator (LA-E8-02 AC-03): 39 of 39 expected cases PASS under its pass rule. LA-E8-02 is QA PASS with 5 of 5 ACs; its reviews are in progress. The same run found a kit defect (F-LA-E7-06-WALK-02): with the extra channel, the kit expected a wrong answer from `brightspace` (a false FAIL). The kit fix is in progress (LD-30). | SIM | [LA-E8-02 qa](../../reviews/LA-E8-02/qa.md) round 2 |
| The channel kit run for every channel (AC-LA-E7-08-02): the live run r8 on `a8bbac53`, the SHA of the first final runs gave 195 of 195 expected cases PASS on all 5 channels. The round 8 reviews APPROVE, with 0 open findings. | SIM; pending: re-gate on 4f10c5fd (LD-29) | [LA-E7-06 qa](../../reviews/LA-E7-06/qa.md) round 8; [spec-deviations §4](../../guides/ltiaas/spec-deviations.md#4-wave-end-gate-and-milestone-end-results) |

Labels: **UNIT** host tests, no stack. **SIM** a QA stack with simulated LMS platforms. **K2** a browser on that stack. **MOODLE-LIVE** a real Moodle 5.2 site in Docker on the QA host. **LIVE** a real school LMS site: none in LA.

Environment note: Docker Desktop updated itself on the QA host during run D1. A new storage-lock diagnostic (G-1) passed on the new version before the runs went on ([spec-deviations §4](../../guides/ltiaas/spec-deviations.md#4-wave-end-gate-and-milestone-end-results)).

## 4. Wave-end gate and milestone-end runs

The gate ran the frozen suites on the wave-end build and again on `a8bbac53`, the SHA of the first final runs. Then two milestone-end full runs (D1 and D2) ran on `a8bbac53`. All 11 gate checks pass on `a8bbac53`.

LA-H27 merges the Blackboard and Canvas final result into LA. So the full gate runs again on the new final product SHA `4f10c5fd`: pending: re-gate on 4f10c5fd (LD-29). The `a8bbac53` results stay true for that SHA. The E0 close-out evidence (LA-E0-02: the legacy baseline and the rate peaks; LA-E0-03: the Moodle golden segment) is in progress (LD-29), on a re-captured baseline.

QA found 13 differences (WE-F1 to WE-F13) and two load flakes, and each one has a recorded decision:

- 2 product fixes: a higher default rate limit for `admin` API calls (WE-F1), and a faster stop of open HTTP requests at shutdown (WE-F4).
- The product is right and the frozen test changes, with two reviewer approvals: WE-F2, -F3, -F6, -F7, -F8.
- A test or harness problem, not an LA difference: WE-F5, -F9, -F10, -F11, -F13.
- Two load flakes in run D2 (T7 under two Moodle stacks, one M2 keyboard case): each rerun passed. A flaky run never counts as PASS.
- One flake stays open: WE-F12. One grade test fails sometimes, on the intake build too. Test hardening comes after LA.
- One kit defect is being fixed: F-LA-E7-06-WALK-02, a false FAIL in the kit when a new channel is added (LD-30). It is not a product defect.

Details: [spec-deviations §5](../../guides/ltiaas/spec-deviations.md#5-wave-end-and-milestone-end-findings-we-f1-to-we-f13-and-the-d2-flakes).

## 5. What is not proven

- **No real Canvas, Blackboard, D2L Brightspace or other LTI 1.3 site took part.** Every result for these LMSs is a simulator result. Some menu names and field names come from vendor documentation. A live proof on an open-source LMS is decision LA-H26 (after LA).
- **The re-gate on the new final product SHA `4f10c5fd`:** pending: re-gate on 4f10c5fd (LD-29). Every suite of the milestone-end double run and the kit K1 runs again on it. Until then, the gate results are results on `a8bbac53` only.
- **Known limit (BD-A1-121):** a Dynamic Registration of a `desire2learn` site on a Moodle or LTI 1.3 connection is refused with the page `REGISTRATION_FAILED`, not with the page that names D2L Brightspace. Nothing is sent and nothing is stored. The fix is in LG ([spec-deviations §7](../../guides/ltiaas/spec-deviations.md#7-recorded-product-deviation-known-limit)).
- **Canvas Dynamic Registration for Instructure-hosted Canvas:** refused on purpose until a live Canvas check. Hosted Canvas uses the developer key.
- **A production host:** the strict production start rules pass their tests, but the LA Docker stack cannot run in production mode. A production host setup is milestone LG.
- **Load, scale, high availability and 1EdTech certification:** not in LA (certification: LA-H9).
- **Not built:** the tenant reads `GET /api/audit` and `GET /api/account` (Should; no task had them); ungraded items (LA-H22); a claim policy per tool account (LA-H4); the verified admin launch (LA-H24); the record of launch refusals (LA-E6-06, deferred); the app-edge limit on the handoff pages (LA-E4-06) and other browser checks (LA-E7-12), both cut to LG (LD-28).

## 6. Your decisions

Details and options: [decisions.md](decisions.md).

| Id | Question | Lead recommendation |
| --- | --- | --- |
| LA-H25 | How do we finish the channel kit (LA-E7-06)? | **Decided (product owner, 2026-10-24): (a)**, then a narrow fix, then a live fix-and-rerun window for the kit (LD-27). Done: the kit passed on `a8bbac53` |
| LA-H27 | The Blackboard and Canvas final result was never merged into LA. When do we merge it? | **Decided (product owner, 2026-10-24): (a)**, merge now and repeat the full gate on the new final SHA `4f10c5fd` (LD-29) |
| LA-H26 | Which real open-source LMS gives the first live proof of the new-channel path? | Open edX first, Sakai as fallback; after LA (LG) |
| LA-H22 | Do we offer ungraded items? | Yes for Canvas `link_selection` and LTI 1.3; no for Moodle |
| LA-H4 | Privacy: claims per channel, retention, learner erase | Pseudonymous default; claim policy per tool account |
| LA-H24 | Do we build the verified admin launch? | Only if there is capacity |
| LA-H9 | 1EdTech membership; which product to certify | Certify the service with a reference tool |
