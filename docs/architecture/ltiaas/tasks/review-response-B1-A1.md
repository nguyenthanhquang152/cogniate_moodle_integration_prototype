# Review response, G-BREAKDOWN round 1 (Part 2): Architect A1

Status: fix round 1 (task LA-B1b, 2026-10-22). Reviewed SHA: `971f1b1`. Reviews: [Reviewer-A](../../../reviews/LA-BREAKDOWN/reviewer-a.md) Part 2 (CHANGES_REQUESTED), [Reviewer-B](../../../reviews/LA-BREAKDOWN/reviewer-b.md) Part 2 (CHANGES_REQUESTED), [QA](../../../reviews/LA-BREAKDOWN/qa.md) Part 2 (FAIL). Plan decisions used: LD-10 to LD-15. A1 changed only its files: `epics.md`, `tasks/README.md`, its specs (E0, E1, E2, E4, E7, E8), `data-model.md` §1 and §5a, and this file. Items that need an A2 spec change are in §3; the Lead has them.

## 1. MAJOR findings

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| B-LAB-10 | MAJOR | fixed | `tasks/README.md` §2 form (g) | A2's exact drill: a fresh QA drill project; `stack:down`; `stack:data-backup -- --out <folder outside the checkout>`; `stack:up`; one marker account through the operator API (form (h)); `stack:down`; `stack:data-restore -- --from <folder>` into the same project; `stack:up`; the project is removed at the end. No `stack:reset` (it deletes `infra/.secrets` and `infra/.data/backups/`; ADR-011 §14), never another project (`project_mismatch`). Restore: none needed. |
| Q-LAB-10 | MAJOR | fixed (with plan LD-13); capacity option open (OI-10) | `epics.md` §1 ("QA days"), §3 (columns "Tests by", "QA days"), §8 (QA-2, QA-3, QA and QA-E2E rows), §9 (capacity model); `tasks/README.md` §2 (QA authors and folders) | Per-task QA cost: write S 0.5, M 1, L 1.5 days (QA-2 for S1 and S2, QA-3 for K, L, L2, R, P); run S 0.25, M or L 0.5, plus 0.5 per R1 run and 0.25 per migration step (QA); 0.25 per Moodle-lane check (QA-E2E). Folders: QA `tests/ltiaas/{baseline,golden,k0,canary,kit,fitness,gates,lib,tasks-qa}/**`; QA-2 `tests/ltiaas/tasks-ops/<task id>/**`; QA-3 `tests/ltiaas/tasks-core/<task id>/**`. With QA capacity the Must path is 66 days if QA runs every suite (LD-13 as written), 58 days if QA-2 and QA-3 run their own task suites (option Q1), 51.5 days with a fourth test author for L and L2 (option Q2); the Lead decides (OI-10). |
| A-LAB-10 | MAJOR | fixed | `LA-E4-01.md` scope and AC-02; `LA-E4-02.md` scope and AC-04 | LA-E4-01 builds a store-contract suite that takes a store as input. LA-E4-02 AC-04 runs it on the app job store after the `014` migration with two runners: no two rows of one key with a lease or `send_started_at` at the same time; a result from another boot id changes no row; recovery leaves a live foreign lease alone and marks own, expired and `NULL` leases uncertain (the copied-row case of the old AC-04 is inside it). A2's LA-E5-19 can run the interval part on the LTI store (§3). |

## 2. Lead decisions applied

| Decision | Where | Note |
| --- | --- | --- |
| LD-10 (S1, S2) | `epics.md` §3, §5 adjustment 8, matrix rows | A2's file split: S1 shared files in every wave; S2 groups `http/operator/{api-keys,signing-keys,key-provider,service-keys}.ts`, `http/key-errors.ts`, `keys/key-config.ts`, the key jobs and key stores; `http/auth.ts` S1 in B1, S2 from B2; B4: S2 owns the LTI store, protocol and route files for LA-E5-23 (adjustment 5). |
| LD-11 (L2) | `epics.md` §3 (lane L2), §5 adjustment 9 and L2 rows, §6 | L2 in B3: LA-E3-03, -05, -08, -10, -13, LA-E5-18, LA-E6-06 with app `tool-pages/launch.ts`, `tool-pages/picker.ts`, `domain/pickers.ts`, `domain/launch.ts`, the `picker_pick` migration and LTI `lti/{login,launch,claims,idtoken,deep-linking,service-keys}.ts`. L2 stays even if every E3 Should is cut (Reviewer-B B-LAB-13). Could tasks of L and L2 (LA-E2-07, LA-E3-12, LA-E6-06) are "deferred" in §3. |
| LD-12 (`016`, OI-7, OI-8) | `data-model.md` §1, §5a; `epics.md` §10 | Two E6 migration files, numbered in landing order. OI-2, OI-7 and OI-8 closed. |
| LD-13 (QA authors) | see Q-LAB-10 | — |
| LD-14 (LA-E5-03, LA-E5-06 to B2) | `epics.md` §3, §5 adjustment 10, §6 | **Confirmed:** the DAG allows it (their dependents LA-E3-02, LA-E5-09, LA-E5-17, LA-E5-18, LA-E6-01 are in B2 or later). In B2, `lti/codes.ts` is L's and `http/auth.ts` is S2's, so LA-E5-03 sends its page code and its `auth_failure` call line by RQ-1 and keeps the limiter in its own module (A2 spec change, §3). LD-14 (b) is form (g). |
| LD-15 (rolling starts) | `tasks/README.md` §1 (start rule, done rule per AC); `epics.md` §1, §6, §9; LA-E8-01, -03, -04 wave "B3–B4" | Waves are ownership windows and regression points. §6 lists the handover tasks that wait for a wave-end gate; every other task starts when its dependencies are done. Dependency chain (Must): 41.5 days (Reviewer-B: about 44.5 with Docs in series). |
| A2 companion tasks and wave moves | `epics.md` §2, §3, §4 (DAG), §5, §8 | LA-E3-14, LA-E3-15, LA-E6-04 to LA-E6-07 with A2's final dependencies; LA-E5-08 and LA-E5-10 in B1 (S2), LA-E5-09 and LA-E5-19 in B2. |

## 3. A2 spec changes needed (sent to the Lead)

| Item | A2 file | Change |
| --- | --- | --- |
| LD-11 | LA-E3-03, -05, -08, -10, -13, LA-E5-18, LA-E6-06; A2-lanes §1 | Owner lane L2 (today L). |
| LD-14 | LA-E5-03, LA-E5-06; A2-lanes §1, §2 | Wave B2 (today B1); LA-E5-03 Files: `lti/codes.ts` (page code) and `http/auth.ts` (`auth_failure` call) become RQ-1 requests to L and S2. |
| OI-11 | LA-E6-02, -03, -05, -06, -07 | Done-order loops: the partner task (LA-E6-02, LA-E6-03) lands first; the companion depends on it; the partner's ACs that need the companion are "pending: <task id>" (tasks README §1). |
| OI-13 | LA-E5-03:50 (`AL-4`), A2-lanes §4 note 6 (`AL-1`–`AL-5`) | Optional: cite form letters; tasks README §2 maps the old ids. |
| A-LAB-10 (follow-up) | LA-E5-19 | Optional: run the interval-lease part of the LA-E4-01 store-contract suite on the LTI job store. |

## 4. MINOR and NIT findings

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| A-LAB-11 | MINOR | fixed | `LA-E4-01.md` design notes, AC-10 | A running runner recovers an expired lease of another instance at its next `due` poll (controlled-clock UNIT AC). |
| A-LAB-12 | MINOR | fixed | `LA-E4-02.md` scope, AC-12 | The D7 "Confirmation" rule for a superseded row with `send_started_at`. |
| A-LAB-13 | MINOR | fixed | `LA-E4-02.md` AC-01 | Column-by-column compare of each backfilled record with its sync row and attempt; the expected `partition_key` per fixture (exclusive, shared with a reservation, released Blackboard). |
| A-LAB-14 = B-LAB-14 | MINOR | fixed | `LA-E4-06.md` AC-01 | An empty bucket of one address does not refuse a second address. |
| A-LAB-15 | MINOR | fixed | `epics.md` §5 adjustment 11 | `store/retention.ts`: S1 in B1–B3, S2 in B4 (A2 removed LA-E3-02's edit). |
| A-LAB-16 | MINOR | fixed | `LA-E2-02.md` AC-03; `LA-E2-04.md` AC-04 | LA-E2-02 keeps the LTI service parts; the DTO part (authority `operatorGrant`, status `pending`) moves to LA-E2-04. |
| A-LAB-17 = Q-LAB-13 | MINOR | fixed | `LA-E1-10.md` AC-02, header, Regression; `LA-E1-11.md` AC-06, Regression | R1 (M1 `sim` phase and M2) for both tasks. |
| A-LAB-18 | NIT | fixed | `LA-E4-07.md` AC-01; `LA-E4-01.md` AC-02 | AC-01 checks the bound address (UNIT); AC-02 names the race. |
| B-LAB-11 | MINOR | fixed (plan LD-15) | `epics.md` §6, §9 | Rolling starts; Docs may start in B3. |
| B-LAB-12 | MINOR | fixed | `LA-E1-08.md` header; `epics.md` §3, §8, §9 | Size L. |
| B-LAB-13 | MINOR | fixed (plan LD-11) | `epics.md` §5 adjustment 9 | LA-E3-03 and LA-E3-05 are L2; L2 stays in B3. |
| B-LAB-15 | MINOR | fixed | `LA-E8-01.md` design notes | `GET /api/platforms` with the admin key, filtered by `profile: standard` and `productFamilyCode`; a platform with no accepted launch has no family and is checked by hand. |
| B-LAB-16 | NIT | fixed | `epics.md` status line, §5, §6; `LA-E8-01.md` | Design SHA `54e8088`; `key-provider.ts` new in B1; §6 and §9 agree; the stray `")` is gone; the reviewer approval is the done rule. |
| Reviewer-B note (runbook) | — | fixed | `LA-E8-04.md` AC-05 | "Stop the worker before you turn the web runner on." |
| Q-LAB-11 | MINOR | fixed | `tasks/README.md` §3 | The LTI profile registry API (`listProfiles`, `findProfile`, `profileDefinition`) is a K0 surface from LA-E1-05. |
| Q-LAB-12 | MINOR | fixed | `tasks/README.md` §2 forms (h), (k), (l); §5 | (h) is direct HTTP from the `e2e` container; (k) scratch probe files in QA's own clone; (l) `stack:restart` of `cogniate-app` or `lti-service`; the 60 s wait is dropped (a rate-limit change applies at once). |
| Q-LAB-14 | MINOR | fixed | `LA-E2-05.md` AC-10 | Full kit for `brightspace`. |
| Q-LAB-15 | MINOR | fixed | `LA-E0-02.md` AC-07; `epics.md` §3 (LA-E0-02 depends on LA-E0-04) | Per-class peaks for T7, the M1 `sim` phase and the legacy groups; peak `auth_failure`; peak open registration sessions; the `LTI_RATE_LIMITS` rule before LA-E5-03. |
| Q-LAB-16 | MINOR | fixed | `tasks/README.md` §1 "Done rule per AC" | "pending: <task id>" does not block the wave exit. |
| Q-LAB-17 | MINOR | fixed | `tasks/README.md` §1 (label `DOC`); LA-E0-01, LA-E1-02, LA-E2-05, LA-E7-04, LA-E7-06, LA-E8-01, -03, -04, -05 | Git, commit-message and document checks are `DOC`; "both reviewers approve" is a done rule. The removed ACs keep their numbers; LA-E8-03, -04 and -05 got one new real AC each, so each spec keeps at least four. |
| Q-LAB-18 | MINOR | fixed | `LA-E7-07.md` AC-05 | The oracle: the reply is ignored, the page posts an empty value after 1.5 s, and the answer is the `STATE_COOKIE_MISSING` page with the storage help text. |

## 5. Consistency pass before round 2 (task LA-B1c)

| Item | Decision | Where | Note |
| --- | --- | --- | --- |
| `lti/codes.ts` note after LD-14 (A2 LA-B2c §4) | fixed | `epics.md` §5 row `lti/codes.ts` (now L in B1–B3, S2 in B4) and adjustment 10 | S1 has no edit of this file in any wave: LA-E5-06 (L, B2) adds the two status page codes itself, and L adds `RATE_LIMITED` for LA-E5-03 by RQ-1. |
| LD-17 (QA option Q2) | applied | `epics.md` §1 (test authors, QA days), §3 ("Tests by": QA-2 for S1 and S2, QA-3 for K, R and P, QA-4 for L and L2, each "writes and runs"; QA days = author write + run / lead QA run), §5 (QA-4 folder row), §7, §8 (one row per test author), §9; `tasks/README.md` §2 (QA-4 and its folder `tests/ltiaas/tasks-lti/<task id>/**`; who runs which suite; suite report to the lead QA) | Estimate with LD-17: about 51.5 days for the Must scope (55.8 with the Should and not-deferred Could tasks); the Must chain stays LA-E0-01 → … → LA-E2-05 → Docs. LD-13 as first written (66) and option Q1 (58.2) stay in §9 for reference. |
| OI-10 to OI-13 | closed | `epics.md` §10 | OI-10 by LD-17; OI-11 by LD-16 and A2 LA-B2c (LA-E6-02 AC-01 to AC-03 pending; the DAG keeps the two dotted arrows to LA-E6-02 and drops the one to LA-E6-03); OI-12 and OI-13 by A2 LA-B2c. |
| Data sync with A2-lanes | fixed | `epics.md` §3, §4 | LA-E5-23 depends on LA-E2-01 and LA-E2-02, as in A2-lanes (the B4 window still waits for the B3 gate). No other lane, wave or dependency differs. |
| Consistency script | run, clean | epics, tasks README, all specs | 48 A1 specs: 4–12 active ACs, labels, numbering, lane and size equal §3; 46 A2 specs: lane and wave equal §3; no broken link; no dependency loop and no dependency on a later wave; 92 DAG nodes, all declared; every matrix cell has one lane per wave (the migration row names one new file per task, RQ-5); the "May edit" lists of all specs give no hot file to a lane that does not own it in the task's wave. |

## 6. Before build (task LA-PRE-A1)

G-DEV approved (LA-H1; LA-H10 = frozen candidate, merge mode `wave-end`). One-line edits from `docs/team/ltiaas/deferred.md` (G-BREAKDOWN table) and one Lead clarification; nothing else changed.

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| A-LAB-19 | MINOR | fixed | `LA-E4-02.md` AC-04 (3) | The P2 step of the LA-ADR-04 D5 migration test is back: a copied row with `send_started_at` and a pending confirmation gets exactly one confirmation send at least 5 s after the first accepted send, inside its original 24 h window. |
| A-LAB-22 | NIT | fixed | `tasks/README.md` §2 form (g), command and restore columns | At the end of the drill, the drill project **and the backup folder** are removed (the folder holds secrets). |
| Q-LAB-21 | MINOR | fixed | `tasks/README.md` §2 "Lanes and stacks" and the forms sentence | Each QA test author uses its own clone and project prefix of TEST-STRATEGY §5.2 v1.4 (QA `qa-la-sim-r`, `qa-la-moodle-r`, `qa-la-st-r`; QA-2 `qa2-la-sim-r`; QA-3 `qa3-la-sim-r`; QA-4 `qa4-la-sim-r`), and every form runs only on the author's own project. §5.2 gives QA-E2E no prefix of its own, so the text names the QA SIM and QA Moodle lanes it runs in. |
| Lead clarification (LA-E0-01 AC-01) | — | fixed | `LA-E0-01.md` AC-01 | The intake diff check excludes `tests/ltiaas/**` (pathspec `':(exclude)tests/ltiaas/**'` and the words "except `tests/ltiaas/**`"), because LA's own test strategy lives there. |

