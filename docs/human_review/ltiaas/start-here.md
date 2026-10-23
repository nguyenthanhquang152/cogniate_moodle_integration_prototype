# LTI as a Service v1 (milestone LA): start here

Draft, 2026-10-24. Wave-end product SHA `8fadb828`. Read time: about 5 minutes. The same content with diagrams is in [index.html](index.html). Open it from disk; it makes no network request.

Parts that wait on the wave-end gate say **pending: wave-end gate**. They change when QA records the gate results.

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
| Guides | [Operator runbook](../../guides/ltiaas/operator-runbook.md); [LTI 1.3 admin](../../guides/ltiaas/lti-generic-admin.md); [D2L Brightspace admin](../../guides/ltiaas/brightspace-admin.md); [LA changes for Moodle, Canvas and Blackboard](../../guides/ltiaas/baseline-admin-changes.md); [Add a channel](../../guides/ltiaas/add-a-channel.md); [Spec deviations and LA-IC status](../../guides/ltiaas/spec-deviations.md). |

## 3. What QA proved

Read the label of each result. **SIM** means a QA stack with a simulated LMS. A SIM result is not a result on a real LMS site.

| Result | Label | Evidence |
| --- | --- | --- |
| Baseline regression: M1 393 of 394 rows, M2 64 of 64 browser cases. The one open row (`M1-08.canvas.login-redirect`) has an approved test change; its rerun (slot 3D) is pending: wave-end gate. | SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §6 |
| API, log and page outputs of the baseline channels equal the frozen golden outputs, except the listed intended changes (G1–G4 EQUAL). | SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §6 |
| Upgrade from the earlier build keeps the data (snapshot upgrade 6 of 6). | SIM, U1 | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md); [LA-E5-08 qa](../../reviews/LA-E5-08/qa.md) |
| 12 of 12 browser flows on the simulator (portal, wizards, LTI 1.3 and D2L Brightspace flows, framed launch without the cookie). | K2 (on SIM) | [LA-E7-07 qa](../../reviews/LA-E7-07/qa.md) round 3 |
| D2L Brightspace changed 0 core files (F2 `core = 0`). | UNIT | [LA-E2-05 qa](../../reviews/LA-E2-05/qa.md) AC-LA-E2-05-01 |
| The LTI 1.3 and D2L Brightspace channels pass the channel kit checks on their simulators. | SIM | [LA-E2-04 qa](../../reviews/LA-E2-04/qa.md) AC-08; [LA-E2-05 qa](../../reviews/LA-E2-05/qa.md) AC-10 |
| Service controls (rate limits, tool accounts, operator API, audit, key rotation, key rings, revoke, retries, metrics). | SIM, UNIT | the LA-E5 QA files, for example [LA-E5-03](../../reviews/LA-E5-03/qa.md), [LA-E5-09](../../reviews/LA-E5-09/qa.md), [LA-E5-10](../../reviews/LA-E5-10/qa.md) |
| Backup and restore drill; QA recorded the restore time and the backup age. | SIM | [LA-E5-24 qa](../../reviews/LA-E5-24/qa.md) |
| One tool account cannot read or change the data of another one on the new routes. | SIM | [LA-E5-13 qa](../../reviews/LA-E5-13/qa.md) |
| Moodle baseline before LA on the local Moodle 5.2 site (T7, 3 runs of 17 checks). This is the intake build, not the LA build. | MOODLE-LIVE | [LA-E0-02 qa](../../reviews/LA-E0-02/qa.md) |
| The LA build on the local Moodle 5.2 site. | pending: wave-end gate (slot 8) | [LA-E7-09 qa](../../reviews/LA-E7-09/qa.md) |

Labels: **UNIT** host tests, no stack. **SIM** a QA stack with simulated LMS platforms. **K2** a browser on that stack. **MOODLE-LIVE** a real Moodle 5.2 site in Docker on the QA host. **LIVE** a real school LMS site: none in LA.

## 4. What is not proven

- **No real Canvas, Blackboard, D2L Brightspace or other LTI 1.3 site took part.** Every result for these LMSs is a simulator result. Some menu names and field names come from vendor documentation.
- **The LA build on the local Moodle site:** pending: wave-end gate (slot 8).
- **Canvas Dynamic Registration for Instructure-hosted Canvas:** refused on purpose until a live Canvas check. Hosted Canvas uses the developer key.
- **The channel kit and the add-a-channel walkthrough:** the kit task (LA-E7-06) used its three fix rounds with open findings. The timed walkthrough (LA-E8-02) waits for it. Decision: LA-H25.
- **A production host:** the strict production start rules pass their tests, but the LA Docker stack cannot run in production mode. A production host setup is milestone LG.
- **Load, scale, high availability and 1EdTech certification:** not in LA (certification: LA-H9).
- **Not built, waiting for a decision:** ungraded items (LA-H22), a claim policy per tool account (LA-H4), the verified admin launch (LA-H24).

## 5. Your decisions

Details and options: [decisions.md](decisions.md).

| Id | Question | Lead recommendation |
| --- | --- | --- |
| LA-H25 | How do we finish the channel kit (LA-E7-06)? | (a) one extra fix round by a fresh QA session, then a fifth review round |
| LA-H22 | Do we offer ungraded items? | Yes for Canvas `link_selection` and LTI 1.3; no for Moodle |
| LA-H4 | Privacy: claims per channel, retention, learner erase | Pseudonymous default; claim policy per tool account |
| LA-H24 | Do we build the verified admin launch? | Only if there is capacity |
| LA-H9 | 1EdTech membership; which product to certify | Certify the service with a reference tool |
| E2 open-source channel | Listed by the Lead as open; its question is not yet in plan §6.2 | — |
| LA-H2, LA-H3, LA-H21, LA-H23 | Claim wording, real test sites, operator key policy, Moodle manual connect authority | see [decisions.md](decisions.md) |
