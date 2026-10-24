Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer-A: Codex GPT-6-Astra xhigh. Lens: “Is it right and is it safe?” Reviewed the complete `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5..8ad1292687431b05bad6b5c070ab722e67714526 -- tests` overlay: **21 files, 30 hunks, 321 insertions, 67 deletions**. References: LA-E0-04, plan §6.1 LD-1/LD-6/LD-9, TEST-STRATEGY §4.3, LA-ADR-04 D8, AC-LA-E7-08-05, the earlier Reviewer-A LD-9 approvals and conformance-A1 item 4. Integration reference: `4c28887d`.

**Open findings: 1 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT.** Baseline value checks survive the LD-1 rewrite; the extra-card membership check and the classification/preservation of the migration-ledger assertion need changes.

### Overlay parts

Paths below are relative to `tests/`. Files shared by two parts are listed in both; all 30 hunks are accounted for.

| Part | Files | Verdict | Findings / assessment |
| --- | --- | --- | --- |
| LD-1 open-world rewrite | `acceptance/M1/common/{00-profiles,90-simulation-gates}.test.ts`; `acceptance/M1/canvas/11-canvas-platforms.test.ts`; `acceptance/lib/open-world.{mjs,d.mts}`; `host/run-m1.mjs`; `e2e/host/run-m2.mjs`; `e2e/M2/01-cards.m2.ts` | CHANGES_REQUESTED | A-LA-E0-04-01. The profile constants equal the old constants exactly; per-field equality, uniqueness, baseline order, labels, shared-platform values and default-profile simulation refusals remain strict. The original card assertions remain. The known G-BASE Kajabi exception preserves the previously allowed static card; it does not justify accepting unrelated new cards. |
| LD-6 / LA-IC-09 P5 fixture | `host/storage-fixture-script.mjs`; `host/p5-fixture.mjs` supplies the unchanged caller flow, with its prefix edit assessed below | APPROVE | The live `record_dispatch` table takes priority. Only the requested `sync_*` row with `status='failed'` is deleted, exactly once, inside the transaction. The old `score_sync` copy and other rows remain intact. No P5 acceptance assertion changes. |
| LA-IC-04 | `acceptance/M1/canvas/31-canvas-grants.test.ts`; `acceptance/M1/common/00-profiles.test.ts`; `acceptance/T4b1/1-connect.spec.ts` | APPROVE | Exactly the approved NRPS removal and two Moodle configuration-value replacements. Four AGS scopes and all other configuration fields remain checked. |
| LA-IC-14 | `acceptance/M1/canvas/11-canvas-platforms.test.ts` | APPROVE scope, subject to the already approved r1 correction | Canvas's dynamic flag, methods and pending-create case match the approved list; the sibling refusal cases and other five flags stay strict. The pinned URL regex still rejects required `?ref=…`; this is historical WE-F3, corrected by the approved LD-9 addendum r1, not a newly open finding here. This row does not approve that obsolete regex. |
| QA runner project prefixes | `host/{core,host-control,m1-control,p5-fixture,run-t1,run-t5,storage-docker,storage-handoff}.mjs`; `e2e/host/run-t7.mjs` | APPROVE | These ten hunks change lane-name guards/messages, not test-result assertions. Verified-clone, app-stop, operation-lock, exact volume identity and P5 mount restrictions remain. Pure argument probes permit the added QA lane and reject foreign/malformed names. |
| Candidate migration-ledger rewrite | `host/m1-migration.mjs` | CHANGES_REQUESTED | A-LA-E0-04-02. This additional hunk is outside LD-1, LD-6 and the reviewed LA-IC-04/14 lists. It cannot be classified as a runner change with no assertion change. The separate WE-F5 directory typo was already corrected by addendum r1. |

### A-LA-E0-04-01 — BLOCKER — Any extra card mentioning “LMS” can pass as the generic channel

**Location:** `tests/acceptance/lib/open-world.mjs:195`; caller `tests/e2e/M2/01-cards.m2.ts:33` and text collection at `:13`.

**Problem:** Membership is inferred by a substring anywhere in the complete card text. The registered generic channel's `channelName` is `LMS` (`packages/channels/lti-generic/manifest.ts:10`), so a description containing that common word admits an unrelated card. This fails AC-LA-E0-04-06 and row 6's requirement that an extra card belong to a registered channel. It is a new-check gap; the old baseline-card checks themselves were not weakened.

**Evidence:** Using the recorded G-BASE cards, the actual shared helper and the same generic-channel entry as QA's openness probes, appended `Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.`. There is no `sakai` entry in `lms-providers`, yet `checkCards` passes. Removing the word `LMS` makes it reject the same unregistered card. The existing 40 probes all pass because their unregistered example avoids that word.

**Suggested fix:** Preserve baseline text checks, but collect and validate each extra card's specific channel identity through a stable public card attribute or channel-specific action URL; do not infer identity from arbitrary description text. Add the registered-generic-plus-unregistered-card negative above, alongside a valid generic card. Keep the explicit baseline Kajabi exception narrow.

### A-LA-E0-04-02 — MAJOR — Migration-ledger hunk changes the oracle and drops the old-ledger preservation check

**Location:** `tests/host/m1-migration.mjs:332`–`:341` at `8ad12926`, the hunk beginning `@@ -329,9 +329,16 @@`; classification in `tests/ltiaas/GATE-RUN-PLAN.md:207` and `docs/reviews/LA-E7-08/qa.md:27`.

**Problem:** The old assertions required the LTI ledger to remain equal to its old ledger and the app ledger to equal its old entries plus `012`. The new assertions derive the entire expected answer from the candidate's current files. Keeping `assert.deepEqual` does not keep the same assertion. The candidate-file comparison is appropriate for LA migrations, as BD-A2-108 explains, but it also removes independent proof that old entries survive. It is outside the listed assertion-change permissions and cannot satisfy conformance-A1 item 4's “changes no assertion” option.

**Evidence:** An extracted-block probe accepts the candidate's 18-file app ledger where the previous 12-entry expectation rejects it, demonstrating changed semantics. More seriously, removing `001_init.sql` from both the candidate file list and the new ledger still passes the new block and `assertSnapshotBoundary`; the old-ledger assertion rejects that loss. The boundary check only requires `011`, `012` and uniqueness. This is separate from the already reviewed one-line WE-F5 path correction.

**Suggested fix:** Keep exact equality with the full candidate migration list, and additionally require every old ledger entry to remain in each new ledger. Record this as an explicit assertion change with its test ID (`M1-41.common.j-snapshot`) and reason, and obtain the Lead waiver/approval called for by conformance-A1 item 4. Update the “0 frozen assertion changes” classification; do not fold this into LD-1 or the WE-F5 path-only fix. Add a focused negative for a missing historical entry.

### Verification and boundary

Used `/tmp/la-review-a-2e58bf738cb5`, a fresh `git clone --no-hardlinks` at the exact overlay SHA. The shared gate source remains clean at `8ad12926`; reads used `GIT_OPTIONAL_LOCKS=0`.

- LD-1 host suite: **40/40 pass**. The overlay's helper blob equals `f0a7b306` (`c38c4e49178f16f64f3c591330f29376ed112e6a`). An independent check confirms the baseline profile constants equal their pre-rewrite values.
- P5 host self-test: **1/1 pass**. Additional disposable SQLite probes verify new-table priority, exact deletion, untouched legacy/other rows, refusal of missing/nonfailed/invalid IDs, rollback, and both legacy schema names. The old-code control deletes only the frozen `score_sync` copy, proving the fixture change matters.
- Pure prefix/argument probes retain `appdb`-only P5 mounts and reject foreign/malformed projects. No generated command was executed.
- Private `npm --prefix tests run typecheck` and overlay `git diff --check` pass. Reused QA's existing dependencies through a private symlink; no install.
- Evidence: `review-overlay.diff`, `review-hunk-inventory.json`, `reviewer-ld1.log`, `reviewer-p5-selftest.log`, `review-overlay-probe.mjs` and `review-overlay-probe.{json,log}` in the private clone.

No Docker, stack, host stack runner, live request or commit. Only this review file was written in integration; no other reviewer's file or probes were opened. Live gate evidence is not rerun or regraded here. The two findings and the final Lead approval remain open.
