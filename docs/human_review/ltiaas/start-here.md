# LTI as a Service v1 (milestone LA): start here

2026-10-24. Final product SHA `a8bbac53`. Read time: about 5 minutes. The same content with diagrams is in [index.html](index.html). Open it from disk; it makes no network request.

Status: **final for LA**. Two gate rows wait: the channel kit run and the final double full run. They say **pending: wave-end gate**.

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
| Guides | [Operator runbook](../../guides/ltiaas/operator-runbook.md); [LTI 1.3 admin](../../guides/ltiaas/lti-generic-admin.md); [D2L Brightspace admin](../../guides/ltiaas/brightspace-admin.md); [LA changes for Moodle, Canvas and Blackboard](../../guides/ltiaas/baseline-admin-changes.md); [Add a channel](../../guides/ltiaas/add-a-channel.md); [Spec deviations, LA-IC status, gate results](../../guides/ltiaas/spec-deviations.md). |

## 3. What QA proved

Read the label of each result. **SIM** means a QA stack with a simulated LMS. A SIM result is not a result on a real LMS site. The wave-end build is `8fadb828`; the final build `a8bbac53` adds one portal attribute to it.

| Result | Label | Evidence |
| --- | --- | --- |
| Frozen regression suites: M1 394 of 394 rows (wave-end build), M2 64 of 64 browser cases (final build). | SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §8, §12 |
| API, log and page outputs of the baseline channels equal the frozen golden outputs, except the 13 approved intended changes (G1–G4 EQUAL, final build). | SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §12 |
| Upgrade from the intake build keeps the data: migration 12 of 12 (a real Moodle score before and after), snapshot upgrade 6 of 6, upgrade route U1 37 of 37. | MOODLE-LIVE, SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §12.4; [LA-E5-08 qa](../../reviews/LA-E5-08/qa.md) |
| Full Moodle scenario test (T7): 3 runs of 17 checks on the wave-end build, 1 run of 17 on the final build (the demo check is skipped, as in the baseline). | MOODLE-LIVE | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §11, §12; [LA-E7-09 qa](../../reviews/LA-E7-09/qa.md) |
| Legacy Moodle test groups T2a–T8 give the baseline result per test id. | MOODLE-LIVE | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §7–§10 |
| 12 of 12 browser flows on the simulator, final build (portal, wizards, LTI 1.3 and D2L Brightspace flows, framed launch without the cookie). | K2 (on SIM) | [LA-E7-07 qa](../../reviews/LA-E7-07/qa.md) round 5 |
| D2L Brightspace changed 0 core files (F2 `core = 0`). | UNIT | [LA-E2-05 qa](../../reviews/LA-E2-05/qa.md) AC-LA-E2-05-01 |
| The LTI 1.3 and D2L Brightspace channels pass their task checks on their simulators. The full kit run is pending (last row). | SIM | [LA-E2-04 qa](../../reviews/LA-E2-04/qa.md) AC-08; [LA-E2-05 qa](../../reviews/LA-E2-05/qa.md) AC-10 |
| Service controls (rate limits, tool accounts, operator API, audit, key rotation, key rings, revoke, retries, metrics). | SIM, UNIT | the LA-E5 QA files, for example [LA-E5-03](../../reviews/LA-E5-03/qa.md), [LA-E5-09](../../reviews/LA-E5-09/qa.md), [LA-E5-10](../../reviews/LA-E5-10/qa.md) |
| Backup and restore drill; QA recorded the restore time and the backup age. | SIM | [LA-E5-24 qa](../../reviews/LA-E5-24/qa.md) |
| One tool account cannot read or change the data of another one on the new routes. | SIM | [LA-E5-13 qa](../../reviews/LA-E5-13/qa.md) |
| The channel kit run for every channel (AC-LA-E7-08-02) and the final double full run (AC-LA-E7-09-05). | pending: wave-end gate | decision LA-H25; [spec-deviations §4](../../guides/ltiaas/spec-deviations.md#4-wave-end-gate-results) |

Labels: **UNIT** host tests, no stack. **SIM** a QA stack with simulated LMS platforms. **K2** a browser on that stack. **MOODLE-LIVE** a real Moodle 5.2 site in Docker on the QA host. **LIVE** a real school LMS site: none in LA.

## 4. Wave-end gate

The gate ran the frozen suites on the wave-end build and again on the final build. 9 of 11 gate checks pass; the two above wait. QA found 12 differences (WE-F1 to WE-F12), and each one has a recorded decision:

- 2 product fixes: a higher default rate limit for `admin` API calls (WE-F1), and a faster stop of open HTTP requests at shutdown (WE-F4).
- The product is right and the frozen test changes, with two reviewer approvals: WE-F2, -F3, -F6, -F7, -F8.
- A test or harness problem, not an LA difference: WE-F5, -F9, -F10, -F11.
- One flake stays open: WE-F12. One grade test fails sometimes, on the intake build too. Test hardening comes after LA.

Details: [spec-deviations §5](../../guides/ltiaas/spec-deviations.md#5-wave-end-findings-we-f1-to-we-f12).

## 5. What is not proven

- **No real Canvas, Blackboard, D2L Brightspace or other LTI 1.3 site took part.** Every result for these LMSs is a simulator result. Some menu names and field names come from vendor documentation. A live proof on an open-source LMS is decision LA-H26 (after LA).
- **The channel kit run for every channel and the final double full run:** pending: wave-end gate. The kit task (LA-E7-06) used its three fix rounds with open findings. Decision: LA-H25. The timed add-a-channel walkthrough (LA-E8-02) waits for the kit.
- **Canvas Dynamic Registration for Instructure-hosted Canvas:** refused on purpose until a live Canvas check. Hosted Canvas uses the developer key.
- **A production host:** the strict production start rules pass their tests, but the LA Docker stack cannot run in production mode. A production host setup is milestone LG.
- **Load, scale, high availability and 1EdTech certification:** not in LA (certification: LA-H9).
- **Not built:** the tenant reads `GET /api/audit` and `GET /api/account` (Should; no task had them); ungraded items (LA-H22); a claim policy per tool account (LA-H4); the verified admin launch (LA-H24); the record of launch refusals (LA-E6-06, deferred).

## 6. Your decisions

Details and options: [decisions.md](decisions.md).

| Id | Question | Lead recommendation |
| --- | --- | --- |
| LA-H25 | How do we finish the channel kit (LA-E7-06)? | (a) one extra fix round by a fresh QA session, then a fifth review round |
| LA-H26 | Which real open-source LMS gives the first live proof of the new-channel path? | Open edX first, Sakai as fallback; after LA (LG) |
| LA-H22 | Do we offer ungraded items? | Yes for Canvas `link_selection` and LTI 1.3; no for Moodle |
| LA-H4 | Privacy: claims per channel, retention, learner erase | Pseudonymous default; claim policy per tool account |
| LA-H24 | Do we build the verified admin launch? | Only if there is capacity |
| LA-H9 | 1EdTech membership; which product to certify | Certify the service with a reference tool |
