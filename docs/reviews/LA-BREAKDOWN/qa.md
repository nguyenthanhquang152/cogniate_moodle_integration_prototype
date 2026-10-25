Verdict: PASS
Round: 2

# LA breakdown: QA testability review (G-BREAKDOWN)

Reviewer: QA (dedicated, independent; Part 1: task LA-QT-B1, dispatch `ctx_4863f5e1efa7`; Part 2: task LA-QT-B2, dispatch `ctx_4aad0d389f44`; Round 2: task LA-QT-B3, dispatch `ctx_f9d220273492`). Date: 2026-10-22. Checklist: [TEST-STRATEGY §7.2](../../../tests/ltiaas/TEST-STRATEGY.md) (TB-01 to TB-12) and the TD rules of §7.1, plan LD-2, LD-4, LD-5, LD-9, and the spec rules of `docs/team/ltiaas/briefs/_common-P3.md`. Severity: base charter §5 and TEST-STRATEGY §7 (a Must AC that QA cannot run is MAJOR; a Should or Could gap is MINOR). The G-BREAKDOWN pass rule (charter-LA §2) needs every acceptance criterion to be testable.

Independence: QA did not open `reviewer-a.md` or `reviewer-b.md`. QA read only messages addressed to its own handle. The shared worktree holds A1's uncommitted Part 2 files (`tasks/LA-E0-*`, `LA-E1-*`, …, `tasks/README.md`). QA read the Part 1 specs from a snapshot of `ec1afc5` and did not open the Part 2 files. Round 2: QA read the full breakdown from a snapshot of `936f707` (`git show`), not from the worktree. QA did not open `reviewer-a.md` or `reviewer-b.md` (both have uncommitted changes in the worktree). QA did not read product code or Author notes.

## Round 2

Scope: bounded re-check of the full breakdown at `936f707318218e3188b9d6593568982f225d6085` (A1 and A2 parts): the round-1 findings Q-LAB-01 to Q-LAB-18, the answers in `tasks/review-response-B1-A1.md` and `tasks/review-response-B1-A2.md`, new BLOCKER or MAJOR in the diff since `971f1b1` and `ec1afc5` (plus cheap MINOR), and plan LD-10 to LD-17 in the QA lens. This is not a full review.

### R2.0 Summary

**PASS.** Open: **BLOCKER 0, MAJOR 0, MINOR 3, NIT 1.**

- All 18 round-1 findings are closed: 17 fixed in the specs, Q-LAB-08 accepted as a QA-owned item (§R2.1). The two round-1 MAJORs are closed: Q-LAB-01 (QA command forms (d) to (g) cited by the Must ACs) and Q-LAB-10 (QA capacity: plan LD-17, option Q2, OI-10 closed).
- QA found no new BLOCKER or MAJOR in the diff. The new companion tasks (LA-E3-14, LA-E3-15, LA-E6-04 to LA-E6-07), forms (f) to (l), LA-E5-24 and the moved B2 tasks have testable ACs with one outcome and a valid label.
- New items: Q-LAB-19 (MINOR, A2), Q-LAB-20 (MINOR, Lead), Q-LAB-21 (MINOR, A1; QA part fixed in this round), Q-LAB-22 (NIT, A2). None blocks the gate. They go to `docs/team/ltiaas/deferred.md` or to the next spec edit, as the Lead decides.
- QA-owned change in this round: TEST-STRATEGY v1.4, §5.2 (lanes of QA-2, QA-3, QA-4; Q-LAB-21). Uncommitted, in the worktree.

### R2.1 Re-check of the round-1 findings at `936f707`

| ID | Round 1 | Answer | Status | Evidence at `936f707` |
| --- | --- | --- | --- | --- |
| Q-LAB-01 | MAJOR | fixed | **closed** | `LA-E5-05.md:46` and AC-03, AC-04, AC-05 cite tasks README form (d) (`lti:bootstrap` with its write flags, fresh account); AC-07 cites form (e). `LA-E5-21` AC-01 cites form (f). `LA-E5-24` header and scope cite form (g) (fresh drill project, no `stack:reset`, restore into the same project). The forms are in `tasks/README.md` §2. |
| Q-LAB-02 | MINOR | fixed | **closed** | `LA-E5-04` AC-01 (`account.create`), AC-09 (`platform.create_shared`); `LA-E6-01` AC-10 (`platform.check`). |
| Q-LAB-03 | MINOR | fixed | **closed** | `LA-E5-04` AC-08 is the status gate on a fresh account; `LA-E5-07` AC-11 owns `revokedAt` after the close; the `LA-E5-03` header depends on `LA-E5-04`. A new gap in the AC-08 oracle is Q-LAB-19. |
| Q-LAB-04 | MINOR | fixed | **closed** | `LA-E5-03` design notes give the restore rule; AC-01 and AC-12 use fresh accounts. Fresh accounts also in `LA-E5-04` AC-02, AC-07, AC-08, AC-09; `LA-E5-06` AC-01; `LA-E5-15` AC-05; `LA-E3-10` AC-01 (the `cogniate` change is the LA-IC-08 step). |
| Q-LAB-05 | MINOR | fixed | **closed** | `LA-E5-02` AC-10 and `LA-E5-06` AC-08 run the F5 check in check-one-text mode with a probe text, with no product file. Label nit: Q-LAB-22. |
| Q-LAB-06 | MINOR | fixed | **closed** | `LA-E6-01` AC-06: `limits: "shared-application"` on the LTI route of the shared Blackboard platform. |
| Q-LAB-07 | MINOR | fixed | **closed** | `LA-E3-01` AC-06 writes the escapes out. |
| Q-LAB-08 | MINOR | no change (QA owns) | **closed (accepted)** | `LA-E5-13` is a QA task (tasks README §2, lead QA row). QA names the route list in `tests/ltiaas/tasks-qa/LA-E5-13/` at build time. QA accepts this answer. |
| Q-LAB-09 | MINOR | fixed | **closed** | `LA-E5-08` AC-08 meets AP-06-26 alone when LA-E5-17 is cut. |
| Q-LAB-10 | MAJOR | fixed; capacity option open (OI-10) | **closed** | Plan LD-17 (option Q2) closes OI-10 (`epics.md:692`). `epics.md:16` gives the QA cost model (write S 0.5, M 1, L 1.5; run S 0.25, M or L 0.5). `epics.md:653-657` give the QA rows (Must days: QA-2 18.5, QA-3 27.25, QA-4 17, QA 29.25, QA-E2E 17.25). `epics.md:669` gives a 51.5-day Must estimate with LD-17. `tasks/README.md:23-33` give the QA authors, folders (`tasks-ops/`, `tasks-core/`, `tasks-lti/`, `tasks-qa/`) and the suite report format. The "open" part of the answer is now closed, so QA accepts it. |
| Q-LAB-11 | MINOR | fixed | **closed** | `tasks/README.md:75`: the profile registry API (`listProfiles`, `findProfile`, `profileDefinition`) is a K0 surface from LA-E1-05. |
| Q-LAB-12 | MINOR | fixed | **closed** | `tasks/README.md` §2 form (h) direct HTTP from the `e2e` container (`:48`), form (k) scratch probes in QA's own clone (`:51`), form (l) `stack:restart` (`:52`); §5 "applies at once" (`:102`). |
| Q-LAB-13 | MINOR | fixed | **closed** | `LA-E1-10` AC-02 and `LA-E1-11` AC-06 name R1 (M1 `sim` phase and M2). |
| Q-LAB-14 | MINOR | fixed | **closed** | `LA-E2-05` AC-10: full kit for `brightspace`. |
| Q-LAB-15 | MINOR | fixed | **closed** | `LA-E0-02` AC-07 records the per-class peaks, peak `auth_failure` and peak open registration sessions; `epics.md` §3: LA-E0-02 depends on LA-E0-01 and LA-E0-04. |
| Q-LAB-16 | MINOR | fixed | **closed** | `tasks/README.md:17` "Done rule per AC": "pending: <task id>" does not block the wave exit; a task is done when every AC is PASS or pending. |
| Q-LAB-17 | MINOR | fixed | **closed** | `tasks/README.md` §1 adds the label `DOC`; the reviewer approvals are a done rule, not an AC. |
| Q-LAB-18 | MINOR | fixed | **closed** | `LA-E7-07` AC-05: the reply is ignored, the page posts an empty value after 1.5 s, and the answer is the `STATE_COOKIE_MISSING` page with the storage help text. |

Deferred answers: none of the QA findings got a "deferred" answer. Two answers were not "fixed": Q-LAB-08 ("no change, QA owns"; accepted) and the OI-10 part of Q-LAB-10 (closed by LD-17).

### R2.2 New findings

#### Q-LAB-19 — MINOR — LA-E5-04 AC-08 has no valid key for its fresh account in B1

- Where: `LA-E5-04.md:63` (AC-08, Must, wave B1), with `LA-E5-04.md:67` (AC-12) and `contracts/lti-service-api-delta.md:194`, `:200`.
- Problem: the Q-LAB-03 fix moved AC-08 to a fresh account. The oracle is "the account's bootstrap API key gives `401`" after the close. An account made with `POST /operator/v1/accounts` answers `201 Account` with no key. AC-12 says that no API key passes for a new account until LA-E5-07 (wave B2) issues one. So in B1 every key of a fresh account gives `401` before and after the close. A test with no positive control also passes on a tree with no status gate. Form (d) can give a fresh account a known key, but tasks README §2 allows a form only in an AC that names it, and AC-08 does not name it.
- Why MINOR: the oracle is achievable. Under the done rule (`tasks/README.md:17`), QA can mark AC-08 "pending: LA-E5-07" and close it in B2 with a key from `POST …/api-keys`. The Must point stays covered, but its proof comes one wave later.
- Fix (A2, one of these): (a) AC-08 names form (d) with `--rotate-api-key` on a fresh account id, and the key gives `200` before the close and `401` after it. (b) AC-08 says "pending: LA-E5-07", with the same before and after check.

#### Q-LAB-20 — MINOR — Plan LD-13 and charter-LA §1 do not match LD-17

- Where: `docs/team/ltiaas/plan.md:208` (LD-13), `:212` (LD-17); `docs/team/ltiaas/charter-LA.md:22-23`.
- Problem: LD-13 still says "QA-2 and QA-3 hand their suites to QA, who runs them". LD-17 says that QA-2, QA-3 and QA-4 each write **and run** their suites. `epics.md:670` calls the first text "LD-13 as first written", but LD-13 itself has no "replaced by LD-17" note. Charter-LA §1 gives QA all of `tests/ltiaas/**`. This overlaps the disjoint folders of QA-2, QA-3 and QA-4 (`tasks/README.md:27-30`). The QA-2, QA-3, QA-4 row does not repeat "Read Author notes before it writes tests". `tasks/README.md:21` and `:23` cover that rule, so the gap is in the text only.
- Fix (Lead): in LD-13, mark the run sentence as replaced by LD-17. In charter-LA §1, give QA "`tests/ltiaas/**` except the folders of QA-2, QA-3 and QA-4 (tasks README §2)", and add the Author-notes rule to the QA-2, QA-3, QA-4 row.

#### Q-LAB-21 — MINOR — Lanes and command forms name only QA's own projects

- Where: `tasks/README.md:35` ("QA uses only its own clones and compose projects of TEST-STRATEGY §5.2") and `:37` ("Each one runs only on QA's own compose project"); TEST-STRATEGY §5.2 before v1.4.
- Problem: with LD-17, QA-2, QA-3 and QA-4 run K1-SIM suites and use the command forms. Neither text gives them a clone or a compose project prefix. If they share QA's prefix, the own-label cleanup of TEST-STRATEGY §5.4 can remove another author's stack. If the Lead adds the third SIM-only slot (LD-17), two SIM stacks would use the same port and subnet.
- QA part, fixed in this round: TEST-STRATEGY v1.4 §5.2 gives each author a clone and a prefix (`qa2-la-sim-r`, `qa3-la-sim-r`, `qa4-la-sim-r`). It shares the SIM slot's port and subnet one stack at a time, and it gives port 9843 and subnet `172.24.0.0/16` to the optional third slot. These do not overlap the LA lanes, the Blackboard and Canvas lanes or the default subnet.
- Fix (A1): in `tasks/README.md:35` and `:37`, change "QA" to "each QA test author" and "QA's own compose project" to "the author's own compose project (TEST-STRATEGY §5.2)".

#### Q-LAB-22 — NIT — Three evidence labels do not match the AC text

- `LA-E5-02.md:61` (AC-10) and `LA-E5-06.md:57` (AC-08) are QA probes in check-one-text mode (`tasks/README.md:77`: "check-one-text mode for QA probes"), but their label is `UNIT`. The label should be `K0`. Both labels give a runnable test, so the only effect is the test owner.
- `LA-E6-07.md:34` (AC-04, Could): the text says "K2 browser case (QA-E2E)" and the header (`:11`) books the SIM slot for one K2 browser case, but the label is `K1-SIM`. The label should be `K2`.

### R2.3 Plan LD-10 to LD-17 in the QA lens

| Decision | QA check | Result |
| --- | --- | --- |
| LD-10 (lanes S1, S2) | QA-2 covers both lanes in one folder (`tasks-ops/`); the per-endpoint file split does not change any oracle. | No problem. |
| LD-11 (L in B3; L2 lane; Could deferred) | QA-4 covers L and L2 (`tasks-lti/`). The L2 tasks have testable ACs. Deferred Could tasks are cut candidates, and no Must task depends on one. | No problem. |
| LD-12 (two `016` app migrations; OI-7; OI-8) | The Lead numbers the files in landing order, so QA tests and U1 runs must not hard-code a file name before the landing. OI-8 keeps the `notBuilt` kit rule. | No problem. QA uses the landed name in U1 and in the LD-9 lists. |
| LD-13 (QA authors) | Replaced in part by LD-17 (run duty). | Text conflict: Q-LAB-20. |
| LD-14 (LA-E5-03 and LA-E5-06 to B2; form (g) drill) | The B2 moves keep every dependency before its user. Form (g) uses a fresh drill project and restores into the same project. A failure from the open ADR-012 runtime gates is not an LA defect, and then the Lead cuts LA-E5-24 (Should). | No problem. |
| LD-15 (rolling starts) | The wave-end regressions (M1, M2, T7) stay. R1 before S3, S4, S5, S6, S8 and E4 steps stays per task (TEST-STRATEGY §4.4). A task starts only after QA PASS on all its dependencies. | No problem. |
| LD-16 (done-order loops) | The partner's ACs that need the companion are "pending: <task id>". Each companion is in the same cut group as its partner (for example LA-E6-05 and LA-E6-06 with LA-E6-02), so a pending AC never stays open after a cut. | No problem. |
| LD-17 (option Q2) | Each test author writes and runs its suites and gives a suite report (task SHA, one row per AC, test id, command, artifact path, run time). The lead QA writes qa.md from it and keeps the slot schedule. The shared helpers stay with QA (no copies). Docker stays at 2 slots. | No problem in the oracle or the evidence. Lane prefixes: Q-LAB-21. |

Note (not a finding): `epics.md` §9 models each test lane as parallel work. The SIM slot is one slot that QA-2, QA-3, QA-4, the lead QA (R1, migration runs, wave-end runs) and QA-E2E (K2) share by booking (`epics.md` §7). The model does not include waits for the slot. The run cost per task (0.25 or 0.5 days) is small next to the write cost, so the risk is local waits near the wave ends. The lead QA orders the bookings, and the E0 memory record decides the optional third slot.

### R2.4 QA-owned changes in this round

- `tests/ltiaas/TEST-STRATEGY.md` v1.4: §5.2 has two new rows (task suites of QA-2, QA-3 and QA-4; the optional third SIM-only slot) and one paragraph on per-author clones, prefixes, command forms and cleanup (Q-LAB-21). The status line now says v1.4. Before this round it said v1.2 but listed v1.3.
- No other QA file changed.

## Combined verdict (Round 1: Part 1 and Part 2)

**FAIL.** Open: **BLOCKER 0, MAJOR 2, MINOR 16, NIT 0.**

- Part 1 (A2 specs at `ec1afc5`), as left in Part 1: MAJOR 1 (Q-LAB-01), MINOR 8 (Q-LAB-02 to Q-LAB-09). The tasks README at `971f1b1` now has the forms (d) and (e) that Q-LAB-01 asks for. Q-LAB-01 closes when A2's LA-E5-05 cites them (A2's uncommitted fix round; next check).
- Part 2 (A1 specs, `epics.md`, `tasks/README.md` at `971f1b1`): MAJOR 1 (Q-LAB-10), MINOR 8 (Q-LAB-11 to Q-LAB-18).

## Part 1 (A2 specs at ec1afc5927ea34f55bd3f433f550df624e40f111)

Scope: `docs/architecture/ltiaas/tasks/A2-lanes.md` and the 40 specs `LA-E3-01` to `LA-E3-13`, `LA-E5-01` to `LA-E5-24`, `LA-E6-01` to `LA-E6-03`. Design base: the specs cite `88909be`. The A2 design files did not change between `88909be` and the final design `54e8088` (`git diff --stat 88909be 54e8088` touches only A1 files), so the base is current.

### P1.0 Summary

The A2 specs are close to ready:

- Every Must acceptance point of LA-ADR-05 and LA-ADR-06 maps to at least one AC (§P1.3). LA-ADR-07's Must points map to A2 tasks or, by A2-lanes note 6, to A1's Part 2 tasks.
- Each AC has one outcome and an evidence label from the common set.
- The test owners follow LD-5: internals are UNIT with a controlled clock or a temporary database, running-service points are K1-SIM for QA, the browser cases are K2 for QA-E2E, and the registry values are K0.
- Every intended change ships with its LD-9 test-change list at the task that ships it.
- The Should and Could tasks are separate cut candidates, and no Must task depends on one.
- Within each lane the file tables are exclusive per wave, and the sizes are plausible.

The verdict for Part 1 is FAIL because of one MAJOR:

- **Q-LAB-01 (MAJOR):** five ACs of the Must task LA-E5-05 need QA commands that the QA rules do not allow, and the spec names no allowance.

Open for Part 1: **BLOCKER 0, MAJOR 1, MINOR 8, NIT 0.**

### P1.1 Findings

#### Q-LAB-01 — MAJOR — LA-E5-05 needs QA commands that no allowance covers

- **Where:** `docs/architecture/ltiaas/tasks/LA-E5-05.md` AC-LA-E5-05-03, -04, -05 (`lti:bootstrap` with no flags, `--rotate-api-key`, `--rotate-signing-key`) and -07 (the operator key file removed); `docs/architecture/ltiaas/README.md:353` (OC-7 lists three QA command forms only); `docs/architecture/tasks/README.md:52`, `:59` (QA may run only the listed M1 commands: `lti:shared-platform`, `app:grant`, `app:binding`, `stack:restart` with knobs).
- **Problem:**
  - These ACs need `npm run lti:bootstrap -- …` with its write flags in QA's clone. This is a state-changing command that the tasks README §2 does not allow.
  - AC-07 needs QA to remove (or rename) `infra/.secrets/lti-operator-key` in its own clone, a change of a secret file that no rule allows.
  - The other A2 tasks that need commands name their form and OC-7: LA-E5-01 (OC-7 c), LA-E5-09 (OC-7 a), LA-E5-12 (OC-7 b). LA-E5-05 names none, and OC-7 has no form for it.
  - So QA cannot run five ACs of a Must task (F5.3, plan E5 Must 3), and the task cannot reach QA PASS at P5.
- **Evidence:** the G-BREAKDOWN pass rule ("Every acceptance criterion is testable", charter-LA §2); TEST-STRATEGY §7.1 TD-07, §7.2 TB-11; `services/lti-service/package.json:10` (`lti:bootstrap` = `bash ../../infra/scripts/lti-bootstrap.sh`, a host script).
- **Fix (A2 in the spec; Lead and A1 in the Part 2 tasks README):**
  - LA-E5-05 names two more command forms, and README OC-7 lists them for the tasks README §2, each only on QA's own compose project:
    - (d) `npm run lti:bootstrap -w services/lti-service -- --account <id> --name <n> [--rotate-api-key] [--rotate-signing-key]`;
    - (e) rename `infra/.secrets/lti-operator-key` for one CLI run, then restore it in the test's clean-up.
  - The same applies to two Should tasks:
    - LA-E5-21 AC-01 needs one LTI service process started with `STACK_PROFILE=production` and an active knob (one command form);
    - LA-E5-24 needs `stack:data-backup` and `stack:data-restore` into a scratch compose project, which today is allowed only for the AC-M1-23 and AC-M1-30 sequences.

#### MINOR findings (grouped; for `docs/team/ltiaas/deferred.md` or a quick fix)

| Id | Where | Problem | Fix |
| --- | --- | --- | --- |
| Q-LAB-02 | `LA-E5-04.md` AC-01, AC-09; `LA-E6-01.md` | AP-06-14 (Must) asks for one audit event for **each** route of contract delta §5. `account.create` (`POST /operator/v1/accounts`) and `platform.create_shared` have no audit-event AC; `platform.check` (Could) neither. The other routes have one (LA-E5-02, -03, -04 AC-06, -07, -09, -10, LA-E3-06). | Add "and one `account.create` event" to AC-LA-E5-04-01, "and one `platform.create_shared` event" to AC-LA-E5-04-09, and one event AC to LA-E6-01. |
| Q-LAB-03 | `LA-E5-04.md` AC-08, header; `LA-E5-03.md` header | AC-LA-E5-04-08 (close revokes every API key) needs LA-E5-07 (wave B2), but LA-E5-04 is a B1 task, so its P5 cannot finish in B1. LA-E5-03's header lacks the LA-E5-04 dependency that A2-lanes lists (for AC-LA-E5-03-01). | Move AC-08 into LA-E5-07 (its scope already has the close rule), or mark it "after LA-E5-07" in the AC. Add LA-E5-04 to LA-E5-03's "Depends on". |
| Q-LAB-04 | `LA-E5-03.md` AC-01, -02, -03, -05, -07; `LA-E5-04.md` AC-02, -07, -08; `LA-E5-15.md` AC-05; `LA-E3-10.md` AC-01 | These ACs change shared state in the one SIM lane: global or account limits, `qa-second` tool URLs, a claim policy, an account close, the write scope, the `cogniate` claim policy. Most name no fresh account and no restore (TB-11). AC-LA-E5-04-08 closes "the account": a close is final, so on `qa-second` it would break every later `qa-second` row. | Name a fresh account (`POST /operator/v1/accounts`) for the close, the claim policy and the write scope. State the restore for the limit changes (`PATCH … {classes: {<class>: null}}`) and for `qa-second`. Run AC-LA-E3-10-01 on a fresh account, or as the LA-IC-08 operator step at its run-order point. |
| Q-LAB-05 | `LA-E5-02.md` AC-10; `LA-E5-06.md` AC-08 | "A probe file in product code … fails `npm run check`". QA may not write product files. QA verifies fitness rules through the check-one-text mode (TEST-STRATEGY §3.2 "Mechanism", §3.5, §3.6). | Write: "the F5 check, given a probe text at a product path, fails". |
| Q-LAB-06 | `LA-E6-01.md` AC-05, AC-06 (Could) | AC-06 checks a Blackboard-simulator connection through the app route. But only `canvas` and `lti-generic` get `setup.connectionCheck` (LA-ADR-08 D6, `:149`), so the app route answers `409 CAPABILITY_NOT_SUPPORTED` (AC-05), and AC-06 cannot pass. | Check `limits: "shared-application"` on the LTI route `POST /api/platforms/:id/check` of the shared Blackboard platform. |
| Q-LAB-07 | `LA-E3-01.md` AC-06 | The text lost its escapes ("has `<`, `>`, ` ` escapes"), so the expected output is not readable. | Write `<`, `>`, `&`, ` `, ` ` (LA-ADR-05 D1 rule 3). |
| Q-LAB-08 | `LA-E5-13.md` AC-01 (QA task) | "each new app route of LA that exists at this task": the case list is open (TB-02). | QA names the list at build time (picker cancel; the app API delta §3 and §5 routes; the LA-ADR-08 routes when built). QA owns this fix. |
| Q-LAB-09 | `LA-E5-08.md` AC-08; `LA-E5-17.md` AC-04 | AP-06-26 (Must) has two parts. The provider part (`ready()` fails, `key_provider_not_ready`) is in the Must task LA-E5-08. The `/readyz` `503` part is in the Should task LA-E5-17. If the Lead cuts LA-E5-17, nothing says how AP-06-26 counts. | State in LA-E5-08: "AP-06-26 is met by AC-08 alone when LA-E5-17 is cut". |

### P1.2 Notes for Part 2 (not findings against A2)

- **Tasks README §2:** it must list the OC-7 forms (a)–(c) and the forms of Q-LAB-01, or the ACs that need them cannot run.
- **Simulator work (the QA-E2E task of E7) must cover the options that A2's K1-SIM ACs need:**
  - LA-E5-14: a score `429` with and without `Retry-After`; a token-endpoint `429`; a memberships `429`; a `403` whose body contains `Rate Limit Exceeded`;
  - LA-E3-12: an extra `aud` value;
  - LA-E6-01: `invalid_client` at the token endpoint;
  - LA-E6-03: an institution administrator role;
  - LA-E3-09: Canvas DR with an opaque token;
  - LA-E3-08: the `cogniate_placement=ungraded` target;
  - LA-E3-02: the platform storage frame and `lti_storage_target`;
  - LA-E3-04, LA-E3-05: the Deep Linking settings options.

  TEST-STRATEGY §2.8 lists most of these, but not the LA-E5-14 and LA-E3-12 options.
- **Evidence labels:** A2 writes the K2 browser cases as "K1-SIM (K2 U4, QA-E2E)", because the common label set has no K2. K2 U1–U4 are Must (README F7.7), so Part 2 may add `K2` to the label set.
- **AP-07-03, AP-07-07, AP-07-08, AP-07-10 and AP-07-11 (I-SELF negative case):** A2-lanes note 6 routes them to A1's E1 and E2-K tasks. QA checks them in Part 2.

### P1.3 Must coverage (LA-ADR-05 to LA-ADR-08)

| Design points | Tasks and ACs | Status |
| --- | --- | --- |
| AP-05-01 to AP-05-07, AP-05-32 (F3.1, platform storage) | LA-E3-01 AC-01, -02, -10; LA-E3-02 AC-01 to AC-10 (K2 U4 = AC-08, AC-09) | mapped |
| AP-05-08 to AP-05-11 (F3.2, no context) | LA-E3-03 AC-01 to AC-06 | mapped |
| AP-05-12 to AP-05-18 (F3.3, Deep Linking) | LA-E3-04 AC-01 to AC-05; LA-E3-05 AC-01 to AC-08, AC-11 | mapped |
| AP-05-19 to AP-05-22 (F3.4, NRPS) | LA-E3-06 AC-01, -02, -06; LA-E3-07 AC-02, -03, -05, -06 | mapped |
| AP-06-01 to AP-06-06, AP-06-34, AP-06-35 (F5.1) | LA-E5-03 AC-01 to AC-08; LA-E5-06 AC-05, AC-06 | mapped |
| AP-06-07 to AP-06-10 (F5.2) | LA-E5-04 AC-02, -03, -05, -08; LA-E5-06 AC-01 to AC-04 | mapped (Q-LAB-03, Q-LAB-04) |
| AP-06-11 to AP-06-13 (F5.3) | LA-E5-01 AC-01 to AC-07; LA-E5-05 AC-01, AC-02 | mapped; LA-E5-05 not runnable (Q-LAB-01) |
| AP-06-14 to AP-06-17 (F5.4) | LA-E5-02 AC-01 to AC-09; per-route events in LA-E5-03, -04, -07, -09, -10, LA-E3-06 | mapped, two routes open (Q-LAB-02) |
| AP-06-18 to AP-06-22 (F5.5) | LA-E5-07 AC-01 to AC-07 (AP-06-21: SIM `400` part and UNIT clock part) | mapped |
| AP-06-23 to AP-06-26 (F5.6) | LA-E5-08 AC-01, -02, -05, -08; LA-E5-09 AC-02 to AC-04; LA-E5-17 AC-04 (Should) | mapped (Q-LAB-09) |
| AP-06-27 to AP-06-31 (F5.7) | LA-E5-10 AC-01 to AC-09 | mapped |
| AP-06-32, AP-06-33 (Must jobs) | LA-E5-19 AC-01 to AC-06; LA-E5-09 AC-05 | mapped |
| AP-07-01, AP-07-02 (F5.8 isolation) | LA-E5-13 AC-01 to AC-06 | mapped (Q-LAB-08) |
| AP-07-04 to AP-07-06, AP-07-09 (F5.8 operator role, evidence) | LA-E5-11 AC-02 to AC-05 (UNIT policy); LA-E5-12 AC-01 to AC-07 (K1-SIM) | mapped |
| AP-07-03, -07, -08, -10, -11 | A1 tasks (A2-lanes note 6) | Part 2 |
| F5.9 connection secrets port | shape only, no task (A2-lanes note 6) | accepted (no runtime behaviour) |
| AP-08-01 to AP-08-10 (all Could) | LA-E6-01 to LA-E6-03 | mapped (Q-LAB-06) |

### P1.4 Checklist result (TEST-STRATEGY §7.2) for Part 1

| Id | Result | Note |
| --- | --- | --- |
| TB-01 | met | One outcome per AC, oracle, evidence label; asynchronous outcomes name their deadline or a controlled clock. |
| TB-02 | met, with Q-LAB-08 | Lists are named except LA-E5-13 AC-01. |
| TB-03 | met | `AC-LA-<epic>-<nn>-<mm>`, unique. |
| TB-04 | met | Each task lists its regression subset by TEST-STRATEGY §4.4 area and its migration (U1 for LA-E5-08, LA-E5-22). |
| TB-05 | met | Regression ACs point to the frozen suites (for example LA-E5-13 AC-06). |
| TB-06 | met | No Must AC needs a live LMS. The MOODLE-LIVE rows use the local Moodle on the Moodle lane (LA-E3-05, LA-E3-07, LA-E3-10). |
| TB-07 | met | Each spec has a May edit / Must not edit table; wave-sliced files in A2-lanes §2; "Needs from other lanes" names the one line or value each needs. |
| TB-08 | met | Simulator needs go to QA-E2E (§P1.2). |
| TB-09 | met | Every Must epic item of E3 and E5 maps to ACs (§P1.3). |
| TB-10 | met | Each `LA-IC` ships with its LD-9 test-change list at the shipping task. |
| TB-11 | partial | Q-LAB-01 (commands without allowance); Q-LAB-04 (no restore or fresh account). |
| TB-12 | n/a in Part 1 | The kit fixtures come with the E7 tasks (Part 2). |

LD-2 (Docker): A2-lanes lists the slot need per task. Authors need no Docker. LA-E5-24 needs a scratch project that the Lead books, and the Moodle-lane rows are LA-E3-05, LA-E3-07 and LA-E3-10. LD-4: QA found no gold-plating. The UNIT ACs cover internals once, and the K1-SIM ACs cover each design point once.

## Part 2 (A1 specs at 971f1b17c52c38d7825ef563f10905a3281852d5)

Scope: `docs/architecture/ltiaas/epics.md` (task list, DAG, ownership matrix §5, waves §6, Docker needs §7, sizes §8, critical path §9, open items §10), `docs/architecture/ltiaas/tasks/README.md` (spec rules, QA forms (a)–(j), RQ-1 to RQ-6, settings), and the 48 specs `LA-E0-01..04`, `LA-E1-01..12`, `LA-E2-01..07`, `LA-E4-01..08`, `LA-E7-01..12`, `LA-E8-01..05`. Also the three post-gate design edits and plan LD-10 to LD-12. Task LA-QT-B2, dispatch `ctx_4aad0d389f44`. QA read the files from a snapshot of `971f1b1`. A2's uncommitted fixes for Part 1 and its new companion tasks (LA-E3-14, LA-E3-15, LA-E6-04 to LA-E6-07) are not in this check; the next round re-checks them.

### P2.0 Summary

A1's breakdown is testable:

- **E0:** LA-E0-02 records the per-test-id baseline. LA-E0-03 builds the golden tool with determinism, normalization, a negative control and the LD-9 expected-delta files. LA-E0-04 does the LD-1 rewrite with rows 1–8, the wider E0 scan, and the strictness and openness probes.
- **E7:** the kit, simulator, fitness-probe, gate and CI tasks follow TEST-STRATEGY §2–§4. LA-E7-05 now covers every simulator option that A2's K1-SIM ACs need (my Part 1 note §P1.2).
- **Regression tiers** follow LA-ADR-04 D6 and LD-8: R1 before the PASS of S3, S4, S5, S6, S8 and E4; R2-lite after S3, S5, S6 and S7; U1 and the migration phases at S4 and E4.
- **Evidence labels:** the label set now has `K2` (F7.7 Must) and puts the static probes under `K0`.
- **LD-5:** internals are UNIT with a controlled clock or a temporary database; the registry, adapter and fitness checks are K0; running-service points are K1-SIM.
- **Tasks README:** the QA rules have forms (a)–(j), the "one client address" rule and the `notBuilt` rule.

The three post-gate design edits are sound for testing:

- App API delta §5a uses "the same address after `Retry-After`" (LA-E4-06 AC-04).
- `job_instance.role` (OI-6) is proven by Author unit tests (LA-E4-05 AC-03), so QA needs no production-profile command for the app.
- README OC-7 and OC-11 are closed: forms (a)–(c) are in the tasks README, and QA aligned the strategy in v1.2.

Q-LAB-01 (Part 1) is half closed: forms (d) and (e) are now in the tasks README §2. It closes when A2's LA-E5-05 names them (A2's fix round, next check).

Part 2 has one MAJOR (Q-LAB-10: QA's per-task test work is not in the lane plan) and eight MINOR findings.

### P2.1 Findings

#### Q-LAB-10 — MAJOR — The lane plan has no time for QA's test work on the Author tasks

- **Where:** `docs/architecture/ltiaas/epics.md` §8 (QA row: B1 8.5, B2 5.5, B3 2.5, B4 1 days, plus 10 days of gates) and §9 ("Durations are Author days; QA rounds and the gates add elapsed time").
- **Problem:** The QA row counts only QA's own tasks (E0, E7). But under LD-5, QA also writes and runs the K1-SIM and K0 ACs of every Author task. It writes them test-first while the Author builds (charter-LA §3; tasks README §2 "Test-first"), and it runs R1 before each runtime step's PASS.

  | Wave | Author tasks | K1-SIM and K0 ACs QA must write and run | Wave length (§9, Must) | QA days planned (§8) |
  | --- | --- | --- | --- | --- |
  | B1 | 17 | about 100 (64 K1-SIM + 37 K0), plus R1 for S3 and S4 and the baseline | 17.5 | 8.5 (own tasks only) |
  | B2 | 20 | about 90 (71 K1-SIM + 17 K0 + 2 K2), plus R1 for S5, S6, S8 and E4 and the E1-end gate | 12.5 | 5.5 (own tasks only) |
  | B3 | 28 (8 Must) | about 130 (117 K1-SIM + 13 K0) | 15 | 2.5 |

  The counts come from a count of the evidence column in the specs at `971f1b1` (A2's specs at `ec1afc5`). With one QA instance (charter-LA §1), the QA lane is longer than the Author lanes in B1 and B2. The §9 critical path (55 days for the Must scope) is then not reachable: an Author task waits for its QA PASS.
- **Fix (A1 with the Lead):**
  - Add a per-task QA cost to §8 and §9 (QA proposes 0.5 day per S task, 1 day per M task, 1.5 days per L task, for the K1-SIM and K0 ACs, plus the measured R1 time), and show the QA and QA-E2E lanes per wave next to the Author lanes.
  - If the QA lane is then longer than the wave, the Lead chooses:
    - (a) a second QA test author for B1–B3, under the same independence rules, with files under `tests/ltiaas/<task>/` only;
    - (b) Should and Could tasks wait until QA has room;
    - (c) a QA PASS of a B1 task may come in the first days of B2. The wave exit rule of §6 then names this.

#### MINOR findings (grouped; for `docs/team/ltiaas/deferred.md` or a quick fix)

| Id | Where | Problem | Fix |
| --- | --- | --- | --- |
| Q-LAB-11 | `tasks/README.md` §3; `LA-E1-05.md` AC-02, `LA-E2-01.md` AC-01, `LA-E2-03.md` AC-11 (K0) | These K0 ACs check profile traits "through the profile registry API" (and simulation profiles only with simulations on). But §3 lists only the kernel entry points and `kernel/ports.ts`, and §2 forbids a test that imports other product code. TEST-STRATEGY §1.2 and LA-ADR-01 D6 name the LTI profile registry (`services/lti-service/src/profiles/index.ts`: `listProfiles`, `findProfile`, `profileDefinition`) as a public loader API. | Add that API to §3 (from LA-E1-05), or write the ACs against `loadChannelFolders(roots, 'lti')` and keep the simulation part as UNIT. |
| Q-LAB-12 | `tasks/README.md` §2 forms, §5 | (1) Some ACs need QA to add scratch files under product paths in its own clone, never committed: LA-E1-03 AC-01, -02, -05 (`packages/channels/zz-probe/`), LA-E1-04 AC-04, AC-10 (`packages/channels/zz-lms/`, `infra/scripts/fitness/rules/`), LA-E1-12 AC-05, LA-E7-01 AC-02. No form allows this. (2) LA-E4-03 AC-05 restarts the app with `npm run stack:restart -- cogniate-app`; the base allowance names it only "during M1 race and gate tests". (3) Form (h) says "through `docker compose exec`", but the `acceptance` profile serves the operator listener on the stack network, and AC-LA-E5-01-01 calls `http://lti-service:4110` directly. (4) §5 says "wait up to the 60 s apply time" for a rate-limit change; LA-ADR-06 D1 says a change applies at once. | Add form (k): scratch probe files under `packages/channels/zz-*/` and `infra/scripts/fitness/rules/` in QA's own clone, never committed, removed in clean-up. Add form (l): `npm run stack:restart -- cogniate-app` and `-- lti-service` for the LA ACs that name it. Write (h) as direct HTTP from the `e2e` container. Drop the 60 s wait. |
| Q-LAB-13 | `LA-E1-10.md` Regression; `LA-E1-11.md` Regression | LA-E1-10 is the B2 half of runtime step S3: it changes the admin-value create plan in `http/routes/platforms.ts` and the DR and error pages. It names "R0 + golden + the M1 profile rows; R2-lite" but no R1, against LA-ADR-04 D6 (R1 before the PASS of S3). LA-E1-11 (S8) calls "R1" only M2 and T6, without the M1 `sim` phase. | Give LA-E1-10 R1 (M1 `sim` and M2). For LA-E1-11, write "R1 = M2 and the portal area; the M1 `sim` phase is not affected" if the Lead accepts that reduction. |
| Q-LAB-14 | `LA-E2-05.md`; `LA-E7-06.md` Scope "Out" | LA-E7-06 says the `brightspace` kit run is an LA-E2-05 AC, but LA-E2-05 has no full-kit AC (LA-E2-04 AC-08 has one for `lti-generic`). Plan measure 4 needs both channels to pass the kit. Today only the B3 wave-end gate (LA-E7-08 AC-02) proves it for `brightspace`. | Add to LA-E2-05: "Full kit for `brightspace` on the D2L simulator provider passes under the pass rule (TEST-STRATEGY §2.6)", K1-SIM. |
| Q-LAB-15 | `LA-E0-02.md` AC-07, header | AC-07 records the LTI per-class rates of one T7 run only. LA-ADR-06 §5 (LA-IC-10 row "Rate limits") also needs: the peak rate per class of the M1 `sim` phase and the legacy suites, the peak `auth_failure` rate, and the peak number of open registration sessions per (address, tool account). The spec's "Depends on" names LA-E0-04, but `epics.md` §3 shows only LA-E0-01. | Extend AC-07 with these records (and the rule "a value above a default names the suite; the Lead sets `LTI_RATE_LIMITS` for the `acceptance` profile before LA-E5-03 lands"). Align the dependency. |
| Q-LAB-16 | `LA-E7-01.md` (K-ADAPTER after LA-E1-07, B2); `LA-E7-04.md` AC-05 (F5 probes up to the E5 rules); `LA-E7-06.md` (new-channel fixtures in B3) | These QA tasks have ACs whose entry point lands in a later wave. Neither the specs nor §6 "Wave exit" say how such a task records its PASS, so a wave exit could wait for them. (The same pattern as Part 1 Q-LAB-03.) | State in the tasks README: a QA task records PASS per AC; an AC whose entry point lands later is "pending: <task id>" and does not block the wave exit. |
| Q-LAB-17 | `LA-E0-01.md` AC-01, -02, -05; `LA-E8-01.md` AC-01, -03 to -05; `LA-E8-03.md` AC-02 to -04; `LA-E8-04.md` AC-02 to -04; `LA-E8-05.md` AC-01 to -04 | `K0` is used for git and commit-message checks, document reading checks and "both reviewers approve". The tasks README §1 defines K0 as the QA contract suite and static probes. A reviewer approval is a done rule (base charter §4), not an observable outcome of the task. | Add a label `DOC` (QA reads the document or the git record). Move "both reviewers approve" to a "Done rule" line, as LA-E0-04 does. |
| Q-LAB-18 | `LA-E7-07.md` AC-05 | "The launch ends with the documented refusal": the oracle is not named. | Name it: the page ignores the reply, posts an empty value after 1.5 s, and the answer is the `STATE_COOKIE_MISSING` page with the storage help text (A2 AC-LA-E3-02-05, -09). |

### P2.2 Checks (TEST-STRATEGY §7.2) for Part 2

| Id | Result | Note |
| --- | --- | --- |
| TB-01 | met, with Q-LAB-18 | One outcome per AC; deadlines or controlled clocks for asynchronous rules. |
| TB-02 | met | Lists are named (for example LA-E0-04 rows 1–8, LA-E7-04 rule list). |
| TB-03 | met | Ids unique; the "never reused" rule is in tasks README §1. |
| TB-04 | met, with Q-LAB-13 | Each spec names its tier and area groups; migration tasks name U1 (LA-E1-06, LA-E4-02, LA-E2-01). |
| TB-05 | met | Gate ACs point to the frozen suites. |
| TB-06 | met | No Must AC needs a live LMS; LIVE is never Must (tasks README §1). |
| TB-07 | met | May edit and Must not edit equal the ownership matrix; RQ-1 to RQ-6 cover shared files. |
| TB-08 | met | Harness work is named: the golden tool (LA-E0-03), the kit (LA-E7-06), the simulator (LA-E7-02, LA-E7-05). |
| TB-09 | met | Every Must feature of E0, E1, E2, E4, E7, E8 maps to tasks (`epics.md` §2). |
| TB-10 | met | Frozen assertions change only by LD-1 (LA-E0-04) or an LD-9 list at the shipping task; LA-E7-08 AC-05 checks the diff. |
| TB-11 | partial | Q-LAB-12 (commands and probe files without a form). |
| TB-12 | met | LA-E7-06 AC-07: every fixture value names its design source. |

LD-2 and Docker (`epics.md` §7): one SIM and one Moodle slot per wave suffice for the task list. The booking rule of thumb gives R1 about 40 min and R2-lite about 10–25 min. The B2 Moodle slot carries R2-lite four times, T5a and T5b for LA-E4-02 and LA-E4-03, and the E1-end R2 gate (about 2.5 h). This fits, but only if QA has the time to run it (Q-LAB-10).

Must coverage of the A2 design points that Part 1 routed to A1: AP-07-03 (LA-E1-03 AC-03), AP-07-07, AP-07-08, AP-07-10 (LA-E1-02 AC-11, UNIT), AP-07-11 (LA-E2-02 AC-03, K1-SIM, oracle `PLATFORM_NOT_ACTIVE`). All are mapped.
