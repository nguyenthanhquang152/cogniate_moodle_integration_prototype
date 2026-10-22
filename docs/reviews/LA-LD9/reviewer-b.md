Verdict: APPROVE
Round: 1

# LD-9 lists LA-IC-12, LA-IC-16, LA-IC-17, Reviewer-B (lens: "Can a human team own it?")

Scope: the QA-owned LD-9 lists in `tests/ltiaas/golden/expected/`, which are `LA-IC-12.json` (LA-E3-04 empty Deep Linking responses), `LA-IC-16.json` (simulator allowlist rule, BD-A1-36) and `LA-IC-17.json` (strict Moodle `PUT …/platform` body, BD-A1-41). I also reviewed the compare rule `sim-hosts-allowlist` in `tests/ltiaas/golden/lib/compare.mjs`, and TEST-STRATEGY §4.7 (rows `:448`, `:452`, `:453`). Plan LD-9: each `LA-IC` lists the exact assertions it changes, and no other assertion may change. I did not open the other reviewer's file. I did not run Docker.

| List | Verdict | Counts |
| --- | --- | --- |
| LA-IC-12 | **APPROVE** | 0 findings |
| LA-IC-16 | **APPROVE** | 2 NIT |
| LA-IC-17 | **APPROVE** | 0 findings |

## How I checked

- Private `/tmp` clone of the integration HEAD with `tests/node_modules` copied (removed after the run). The shared LA worktree did not change.
- `node --test tests/ltiaas/golden/golden.k0.test.mjs`: **11 of 11 passed**.
- My own scans of the frozen suites (`tests/acceptance`, `tests/e2e`, `tests/host`) for each claim (below).
- A probe of `compareCaptures` with the real `LA-IC-16.json`, on a base allowlist and seven candidates (results under LA-IC-16).

## LA-IC-12 — APPROVE

- **Claim:** 0 golden fields, 0 frozen-test changes at the service part (`3344520`); 3 Author unit-test files changed; G4 picker text pending for LA-E3-05.
- **My check:**
  - `grep` for an empty `contentItems` finds only the new LA task suite `tests/ltiaas/tasks-lti/LA-E3-04/deep-linking.k1sim.test.ts`, not a frozen test.
  - The only frozen use of `deepLinkingSettings` is `T3a/1-deep-linking.spec.ts:52`, a property read (`?.acceptTypes`), not a whole-object compare.
  - The three Author test changes match the LA-E3-04 diff I reviewed (`deep-linking.test.ts`, `compat.test.ts` `[]` → `null` in the refusal table, `idtoken.test.ts`).
  - The pending G4 picker text is named, with its reason (`07-sim-scenario.m2.ts:36` clicks the first button). The list is complete and easy to follow.

## LA-IC-16 — APPROVE (2 NIT)

- **Claim:** one golden field, `G1.acceptance.ltiHealth.outbound_allowlist`, compared by the rule: `.sim.test` entries equal the `tests/sim/hosts.json` allowlist union as a set; non-`.sim.test` entries equal G-BASE in order; every other allowlist stays strict. 0 frozen tests touched.
- **The rule cannot hide a non-simulator change.** My probe, with `compareCaptures(base, candidate, [LA-IC-16])`:

  | Candidate change | Result |
  | --- | --- |
  | the manifest's sim hosts | PASS (expected) |
  | add `attacker.test` | FAIL (`acceptance.ltiHealth.outbound_allowlist`) |
  | reorder the non-sim entries | FAIL |
  | add `lms-sim.test` (the control host, not `.sim.test`) | FAIL |
  | add `evil.sim.test` (not in `hosts.json`) | FAIL |
  | a sim host in `default.ltiHealth` | FAIL (`default.ltiHealth.outbound_allowlist[1]`) |
  | a sim host in `acceptance.appHealth` | FAIL (`acceptance.appHealth.outbound_allowlist[2]`) |

  The rule also refuses duplicate `.sim.test` entries and a manifest host that does not end in `.sim.test` (`compare.mjs:62-76`).
- **Frozen tests:** my `grep` for `outbound_allowlist` and allowlist checks in `tests/acceptance`, `tests/e2e`, `tests/host` finds no assertion. The M1 and M2 files use simulator hosts only as targets. So "0 frozen tests touched" holds.

### B-LD9-01 — NIT — The rule applies even when the LA-IC-16 file is not passed

- **File:** `tests/ltiaas/golden/lib/compare.mjs:174-177`.
- **Problem:** `compareCaptures(base, candidate)` with no expected-delta file still explains the allowlist diff and labels it `LA-IC-16` (my probe: `without the LA-IC-16 file: LA-IC-16`; the unit test `resAuto` asserts this on purpose). The check itself is the same, so nothing is hidden. But a reader of a report cannot tell whether the reviewed list was passed, and the `missing` check never fires for this rule.
- **Suggested fix:** Label the implicit case `LA-IC-16 (implicit)` in `report()`, or apply the rule only when the delta file is passed. Then the gate command always names `--expected LA-IC-16`.

### B-LD9-02 — NIT — The LA-IC-16 list has no scan record

- **File:** `tests/ltiaas/golden/expected/LA-IC-16.json` (no `scanChecked` and `scanResult`, unlike LA-IC-12 and LA-IC-17); TEST-STRATEGY `:452`.
- **Problem:** The list says `frozenTestsTouched: []` without the files that the scan read, so a later reviewer cannot repeat the check from the list alone.
- **Suggested fix:** Add `scanChecked` (for example: "no frozen test asserts `outbound_allowlist`; M1 and M2 use simulator hosts only as targets") and a one-line `scanResult`, as in the other two lists.

## LA-IC-17 — APPROVE

- **Claim:** 0 golden fields and 0 frozen-test changes: every Moodle or standard `PUT …/platform` body in the portal, golden capture, and frozen suites sends only the six documented keys.
- **My check:** my `grep` of `PUT …/platform` calls in `tests/acceptance`, `tests/e2e` and `tests/ltiaas/golden` finds the listed six-key bodies:
  - `T4b1/1-connect.spec.ts:130,134` (`{ ...six, jwksUrl: evil }` is still six keys);
  - `T4b1/3-security.spec.ts:116`, `T4b1/4-adoption.spec.ts:54,65,75`;
  - the two M1 Canvas self-platform bodies (`61-canvas-containment.test.ts:156`, `41-canvas-grades.test.ts:89`).

  The other hits are Canvas and Blackboard grant bodies (already strict in M1) or `{}` refusals. No frozen test sends an extra key to a Moodle body and expects `200`. The list is complete.

## Not checked

- The G4 picker text change of LA-E3-05 (pending; a new list round when it lands).
