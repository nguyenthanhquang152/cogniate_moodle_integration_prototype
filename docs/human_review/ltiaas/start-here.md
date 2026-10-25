# LTI as a Service v1 (milestone LA): start here

2026-10-25. Final product SHA `4f10c5fd` (LA plus the Blackboard and Canvas final result, LA-H27). The first final runs were on `a8bbac53`. Read time: about 5 minutes. The same content with diagrams is in [index.html](index.html). Open it from disk; it makes no network request.

Status: **final for LA** on `4f10c5fd`. Reviewer-A and Reviewer-B approve the re-gate evidence.

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

Read the label of each result. **SIM** means a QA stack with a simulated LMS. A SIM result is not a result on a real LMS site. The wave-end build is `8fadb828`; `a8bbac53` (the first final runs) adds one portal attribute to it; the final SHA `4f10c5fd` adds the Blackboard and Canvas final result.

| Result | Label | Evidence |
| --- | --- | --- |
| Frozen regression suites: M1 394 of 394 rows and M2 64 of 64 browser cases on the final SHA `4f10c5fd` (re-gate runs D3 and D4). They also passed on `a8bbac53` (the first final runs) and on the wave-end build. | SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §14; [run D4](../../reviews/LA-E7-08/run-D4.md); first final runs: §8, §12, §13, [run D2](../../reviews/LA-E7-08/run-D2.md) |
| The API, log and page outputs on `4f10c5fd` differ from the Blackboard and Canvas final result (baseline-3) in 297 places. Each difference is an approved intended change (LA-IC); 0 are unexplained and 0 are missing. This is an approved change set, not equality. On `a8bbac53`, against the intake build: 280 differences, all approved. | SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §14.4; [per-test-id table](../../reviews/LA-E7-08/per-test-id-D3-D4.md) |
| An upgrade keeps the data: migration 12 of 12 (a real Moodle score before and after) and snapshot upgrade 6 of 6, on each side; one combined SIM upgrade run U1 for both services (43 entries: 37 PASS, 6 INFO; 17 of 17 aggregate IDs PASS); a live Moodle continuity run U1/U2 on `8fadb828` (16 of 16 PASS); the backup and restore drill (10 of 10). These checks ran before the merge and are carried to `4f10c5fd`: the migration, encryption and storage diffs are empty. | MOODLE-LIVE, SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §12.4, [§14.6](../../reviews/LA-E7-08/qa.md#146-carried-checks-and-frozenstorage-audits); [LA-E5-08 qa](../../reviews/LA-E5-08/qa.md) |
| Full Moodle scenario test (T7): 3 runs of 17 checks in each of D3 and D4 on `4f10c5fd`, as on `a8bbac53` and the wave-end build; the demo check is skipped, as in the baseline. | MOODLE-LIVE | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §14; [LA-E7-09 qa](../../reviews/LA-E7-09/qa.md) round 7 |
| Legacy Moodle test groups T2a–T8 are equal per test id to the accepted baseline-3 on `4f10c5fd`. One difference stays visible: the original baseline T8 run failed AC-T8-03 and AC-T8-07 where every candidate run passed (cause not proven); the solo baseline retry passed them. | MOODLE-LIVE | [LA-E7-09 qa](../../reviews/LA-E7-09/qa.md) round 7; [per-test-id table](../../reviews/LA-E7-08/per-test-id-D3-D4.md) |
| The double full run on the final SHA `4f10c5fd` (D3 and D4): M1, M2, golden outputs, T7, T2a–T8 and the kit pass in each run, after the recorded reruns. The first final runs D1 and D2 on `a8bbac53` passed too. | SIM, MOODLE-LIVE | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §13, §14; [run D2](../../reviews/LA-E7-08/run-D2.md); [run D4](../../reviews/LA-E7-08/run-D4.md) |
| 12 of 12 browser flows on the simulator, on `4f10c5fd` (and on `a8bbac53`): portal, wizards, LTI 1.3 and D2L Brightspace flows, framed launch without the cookie. | K2 (on SIM) | [LA-E7-07 qa](../../reviews/LA-E7-07/qa.md) rounds 5 and 6 |
| D2L Brightspace changed 0 core files (F2 `core = 0`). | UNIT | [LA-E2-05 qa](../../reviews/LA-E2-05/qa.md) AC-LA-E2-05-01 |
| The LTI 1.3 and D2L Brightspace channels pass their task checks on their simulators. The full kit run also passed (last row). | SIM | [LA-E2-04 qa](../../reviews/LA-E2-04/qa.md) AC-08; [LA-E2-05 qa](../../reviews/LA-E2-05/qa.md) AC-10 |
| Service controls: rate limits, tool accounts, operator API, audit log, key lifecycle (API keys, key rings and re-wrap, signing keys), revoke, safe retries, metrics and readiness, production start rules, backup and restore. | SIM, UNIT | [proof map](service-controls.md): each claim with its QA report (LA-E5-01 to LA-E5-24) and the label of each check |
| Backup and restore drill; QA recorded the restore time and the backup age. | SIM | [LA-E5-24 qa](../../reviews/LA-E5-24/qa.md) |
| One tool account cannot read or change the data of another one on the new routes. | SIM | [LA-E5-13 qa](../../reviews/LA-E5-13/qa.md) |
| A walker who was new to the repository added the simulator LMS `acme-lms` as a new channel in 8 min 49 s (plan §4 measure 5). The F2 gate, K0, `npm run check` and the simulator checks pass. | UNIT | [LA-E8-02 qa](../../reviews/LA-E8-02/qa.md) (AC-01, -02, -04, -05) |
| The `acme-lms` kit K1 run on the simulator (LA-E8-02 AC-03): 39 of 39 expected cases PASS under its pass rule. That run found a kit defect (F-LA-E7-06-WALK-02). After the kit fix, the 6-channel run of the walk clone passed 234 of 234. LA-E8-02: 5 of 5 ACs PASS; Reviewer-A and Reviewer-B APPROVE. | SIM | [LA-E8-02 qa](../../reviews/LA-E8-02/qa.md) rounds 2 and 3 |
| The channel kit run for every channel (AC-LA-E7-08-02): 195 of 195 expected cases on all 5 channels in D3 and D4 on `4f10c5fd` (the kit runs from integration `99338e52`, with 0 lines of product diff, LD-32). Also r8 195 of 195 on `a8bbac53`. | SIM | [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §14.5; [LA-E7-06 qa](../../reviews/LA-E7-06/qa.md) rounds 8 and 9 |

Labels: **UNIT** host tests, no stack. **SIM** a QA stack with simulated LMS platforms. **K2** a browser on that stack. **MOODLE-LIVE** a real Moodle 5.2 site in Docker on the QA host. **LIVE** a real school LMS site: none in LA.

Environment note: Docker Desktop updated itself on the QA host during run D1. A new storage-lock diagnostic (G-1) passed on the new version before the runs went on ([spec-deviations §4](../../guides/ltiaas/spec-deviations.md#41-the-first-final-runs-on-a8bbac53)).

## 4. Gate and final runs

The final product SHA is `4f10c5fd`. The re-gate (LD-29) ran the double full run D3 and D4 on it: all 11 gate checks PASS. Reviewer-A and Reviewer-B approve this evidence (LA-E7-08 round 2, LA-E7-09 round 7). The first final runs D1 and D2 on `a8bbac53` also passed all 11; those results stay true for that SHA.

Recorded events of the re-gate. None of them counts as PASS:

- An H1 infrastructure abort before any test ran (D3 `qalead-la-136`); the recovery `qalead-la-142` passed.
- An M1 isolation finding under a planned overlap (D4 `qalead-la-151`); the solo rerun `qalead-la-162` passed. M1 now runs alone (LD-31 amendment).
- Environment notes: some host isolation rows name changed `sto-*` resources of another team, not LA resources.
- A kit assembly defect with 0 tests (D3 `qalead-la-141`); the kit then ran from integration `99338e52` (LD-32) and passed in D3 and D4.
- WE-F14, a status race in one T5b test (D4 `qalead-la-158`); the solo rerun `qalead-la-163` passed.
- A T8 difference: the original baseline-3 run failed AC-T8-03 and AC-T8-07 where the candidates passed; the cause is not proven. The solo baseline retry passed them, so the original run is a baseline flake finding. The difference stays visible in the records.
- An evidence limit: no Docker event capture for the first 42 seconds or so of D3.

E0 close-out on baseline-3: LA-E0-01 (the merge) and LA-E0-02 (the legacy baseline and rate peaks; the registration defaults stand, BD-A2-114) are PASS, and both reviewers approve (LA-E0-01 round 2, LA-E0-02 round 7). LA-E0-03 (golden v2 with the Moodle segment) is PASS, and both reviewers approve.

Over the whole gate, QA found 14 differences (WE-F1 to WE-F14) and the flakes above. Each one has a recorded decision:

- 2 product fixes: a higher default rate limit for `admin` API calls (WE-F1), and a faster stop of open HTTP requests at shutdown (WE-F4).
- The product is right and the frozen test changes, with two reviewer approvals: WE-F2, -F3, -F6, -F7, -F8.
- A test or harness problem, not an LA difference: WE-F5, -F9, -F10, -F11, -F13.
- Two flakes stay open: WE-F12 and WE-F14, both in frozen grade tests. Test hardening comes after LA.
- The kit defect F-LA-E7-06-WALK-02 is closed: the kit fix passed its reviews and a 6-channel live run.

Details: [spec-deviations §4](../../guides/ltiaas/spec-deviations.md#4-gate-results-on-the-final-sha-4f10c5fd) and [§5](../../guides/ltiaas/spec-deviations.md#5-wave-end-milestone-end-and-re-gate-findings-we-f1-to-we-f14-and-the-flakes).

## 5. What is not proven

- **No real Canvas, Blackboard, D2L Brightspace or other LTI 1.3 site took part.** Every result for these LMSs is a simulator result. Some menu names and field names come from vendor documentation. A live proof on an open-source LMS is decision LA-H26 (after LA).
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
| LA-H27 | The Blackboard and Canvas final result was never merged into LA. When do we merge it? | **Decided (product owner, 2026-10-24): (a)**, merge now and repeat the full gate on the new final SHA `4f10c5fd` (LD-29). Done: the re-gate passed (A and B APPROVE) |
| LA-H26 | Which real open-source LMS gives the first live proof of the new-channel path? | Open edX first, Sakai as fallback; after LA (LG) |
| LA-H22 | Do we offer ungraded items? | Yes for Canvas `link_selection` and LTI 1.3; no for Moodle |
| LA-H4 | Privacy: claims per channel, retention, learner erase | Pseudonymous default; claim policy per tool account |
| LA-H24 | Do we build the verified admin launch? | Only if there is capacity |
| LA-H9 | 1EdTech membership; which product to certify | Certify the service with a reference tool |
