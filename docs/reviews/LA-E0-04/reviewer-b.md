Verdict: CHANGES_REQUESTED
Round: 1

# Gate test overlay — Reviewer-B

Reviewed `git diff 80133d6b 8ad1292687431b05bad6b5c070ab722e67714526 -- tests`: **21 files, 30 hunks**. Sources: LA-E0-04, its QA scan and final LD-1 list, TEST-STRATEGY §4.3, plan LD-1/LD-6/LD-9, LA-ADR-04 D8, AC-LA-E7-08-05, and the previously reviewed LD-9 addendum R1. Lens: traceable changes and tests a later team can trust. Blind review; no Reviewer-A file read.

**Open findings: 1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** The LD-1 card membership oracle fails AC-LA-E0-04-06 when a registered channel has a generic name. The remaining parts have the decisions below.

## Decisions by part

Paths in this table are relative to `tests/`. Hunk numbers follow the normal Git diff order in the command above; H03 contains both LD-1 and LA-IC-14 changes.

| Part and hunks | Files | Verdict | Rule, preserved criterion and findings |
| --- | --- | --- | --- |
| LD-1; H03, H05–06, H08–09, H11–16, H23–24 | `acceptance/M1/common/00-profiles.test.ts`, `90-simulation-gates.test.ts`; `acceptance/M1/canvas/11-canvas-platforms.test.ts`; `acceptance/lib/open-world.mjs`, `open-world.d.mts`; `e2e/M2/01-cards.m2.ts`; `host/run-m1.mjs`; `e2e/host/run-m2.mjs` | **CHANGES_REQUESTED** | LA-E0-04 / TEST-STRATEGY §4.3 rows 1, 2, 3, 6, 7, 8. Keeps the baseline profile constants/order, real-only default gate, simulation ids, LMS entries and card texts; permits registered additions and additive fields. Covers `M1-01.common.constants`, `M1-02.common.default-profile`, `M1-35.common.*`, `M1-15.canvas.lms-providers`, `M2-STACK`, `M2-01.cards`. **B-LA-E0-04-01** affects row 6. Other LD-1 rows are approved. |
| LA-IC-04; H04, H07, H10 | `acceptance/M1/canvas/31-canvas-grants.test.ts`; `acceptance/M1/common/00-profiles.test.ts`; `acceptance/T4b1/1-connect.spec.ts` | **APPROVE** | D8 / LA-ADR-05 D4 removes only NRPS from the four AGS scope list and changes Moodle row 13 to “Do not use this service”. Exact Canvas JSON and Moodle row comparisons remain for `M1-19.canvas.json`, `.inline-key`, `M1-19.common.moodle-configuration`, `AC-T4-10`. No unrelated capability guard changes. |
| LA-IC-14; H01–03 | `acceptance/M1/canvas/11-canvas-platforms.test.ts` | **APPROVE change intent; retain R1 correction** | D8 / LA-ADR-05 D6 changes the dynamic capability, method list and dynamic-create expectation. The existing `M1-15.canvas.dynamic-refused` id is retained with a new positive title; DTO and provider assertions stay exact. Its historical URL regex is wrong at `8ad12926`; the already reviewed R1 repair requiring `?ref=` plus 43 base64url characters must remain. See “Historical repairs” below. |
| LD-6 / LA-IC-09; H29 | `host/storage-fixture-script.mjs`; the associated `host/p5-fixture.mjs` H22 is a prefix change below | **APPROVE** | After migration 014, P5 deletes the same requested failed row from `record_dispatch`. Legacy score-sync tables remain supported for baseline runs. The transaction, exact id, failed-status predicate and exactly-one-deletion check remain. The T5b P5 assertions are unchanged; the wrapper retains fresh-clone, verified-project, app-stop and operation-lock guards. |
| QA runner project names; H17–20, H22, H25–28, H30 | `e2e/host/run-t7.mjs`; `host/core.mjs`, `host-control.mjs`, `m1-control.mjs`, `p5-fixture.mjs`, `run-t1.mjs`, `run-t5.mjs`, `storage-docker.mjs`, `storage-handoff.mjs` | **APPROVE** | AC-LA-E7-08-05 runner changes: permit the lead QA's `qalead-la-*` runs through existing name guards; storage helpers also accept the numbered QA lanes already accepted by the common runner. No acceptance assertion changes. Exact resource labels/names, clone checks, verified-project checks, image pinning and storage mount restrictions remain. |
| Candidate migration ledger; H21 | `host/m1-migration.mjs` | **APPROVE rule; retain R1 correction** | AC-LA-E7-08-05 / A2 BD-A2-108 WE-F5: compare the upgraded ledgers exactly with the candidate's SQL migrations, so `M1-38.common.h1..h5` and `M1-41.common.j-snapshot` cover every LA migration. This is a separate runner adaptation, not LD-1 or the P5 change. The historical LTI directory typo is repaired by the already reviewed R1 change. |

This accounts for all 30 hunks. The LD-1 helper files are explicit additions to the final QA list; they keep the new assertion rules in the frozen tree. The recorded Kajabi card is a documented pre-existing non-channel exception, permitted at most once; this does not authorize arbitrary new cards. Lead approval of the final LD-1 list remains a separate done-rule requirement.

## Finding

### B-LA-E0-04-01 — BLOCKER — A registered generic name admits an unregistered LMS card

- **File:** `tests/acceptance/lib/open-world.mjs:195` at `8ad12926`; called by `tests/e2e/M2/01-cards.m2.ts:33`.
- **Problem:** `String(text).includes(name)` checks whether the card mentions a registered name anywhere, not whether the card belongs to that channel. It therefore fails AC-LA-E0-04-06 and TEST-STRATEGY §4.3 row 6.
- **Evidence:** Start with the recorded G-BASE cards and providers, then register `lti-generic` with `channelName: 'LMS'` (the existing K0 fixture's own new-channel name). Add the unregistered card `ConnectSakai LMSPublish Cogniate courses to Sakai with LTI 1.3.`. The actual `checkCards(..., { names: extraChannelNames(providers) })` **passes**. The registered generic card also passes, and a Sakai card without “LMS” fails, isolating the substring defect. The current generic manifest also uses `names.text: 'LMS'`, so this is relevant to the shipped channel set. The 40 existing probes miss it: the row-6 negative at `tests/ltiaas/k0/ld1/open-world.test.mjs:79-81` runs without any extra registered channel, leaving the allowed-name list empty.
- **Suggested fix:** Match each extra card through an unambiguous channel identity or a specific card-name field tied to the public channel catalogue, rather than a substring of all descendant text. Add a negative probe where a legitimate generic channel remains registered while a different card contains “LMS”. Keep the baseline text/order checks and the documented Kajabi exception. Rerun the LD-1 probes and `M2-01.cards` on the corrected test SHA.

## Historical repairs already reviewed

The raw `8ad12926` tree is not suitable for a new standalone gate run: its `11-canvas-platforms.test.ts:247` URL regex omits the required registration ref, and `m1-migration.mjs:332` reads the nonexistent `src/store/migrations` directory. Both are recorded WE-F3/WE-F5 defects with approved corrections in `docs/reviews/LA-E7-08/ld9-addendum-r1.md` and this reviewer's R1 report (Round 3 APPROVE). They are not new open findings here. Keep those corrections when carrying this overlay forward; their required re-gate evidence remains the M1 SIM dynamic-create row and the complete snapshot-upgrade phase, respectively.

## Independent checks and limits

- Used `GIT_OPTIONAL_LOCKS=0` for Git inspection. The supplied gate source stayed clean. All execution used `/tmp/review-b-gate-overlay-ay7cwe5t`, a private `git clone --no-hardlinks` detached at `8ad12926`; its tracked files stayed clean.
- Existing LD-1 K0 probes: **40/40 PASS**. Existing host-only fixture, storage-argument and handoff self-tests: **19/19 PASS**; Docker-facing calls in those tests use recorded answers/stubs.
- Focused probes: **6 PASS, 1 failed required rejection**. The failure is B-LA-E0-04-01. P5 deleted only the requested failed dispatch, retained another failed dispatch, a sent dispatch and the legacy score-sync row, and refused missing, sent and invalid ids.
- Pure prefix/storage-argument probes: **9/9 PASS**, including `qalead-la-12`, prior QA lane names and rejection of unrelated project names. No command produced by these helpers was executed.
- Installed dependencies only in the private clone. `npm --prefix tests run typecheck` and `git diff --check 80133d6b HEAD -- tests` passed.
- Evidence: `/tmp/reviewer-b-gate-overlay.patch`, `/tmp/reviewer-b-gate-overlay-checks.json`, `/tmp/reviewer-b-gate-overlay-ld1.log`, `/tmp/reviewer-b-gate-overlay-storage.log`, `/tmp/reviewer-b-gate-overlay-probes.mjs`, `/tmp/reviewer-b-gate-overlay-probes.json`, `/tmp/reviewer-b-gate-overlay-prefixes.json`, `/tmp/reviewer-b-gate-overlay-typecheck.log`.

No Docker, stack, browser, live acceptance run or commit. Only this review file was written in the integration worktree. Live re-gate evidence must use the final reviewed test SHA after the card-oracle correction.
