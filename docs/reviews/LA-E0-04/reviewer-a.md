Verdict: CHANGES_REQUESTED
Round: 2

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

## Round 2

Reviewer-A: Codex GPT-6-Astra xhigh. Reviewed QA `445bd87f1b25ce8cd66054587a833c6f90237bb8`, integrated at `953de0d7`, and the exact fenced patch in `docs/reviews/LA-E7-08/ld9-addendum-r5.md` against `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`). The patch changes **8 files, 480 insertions, 48 deletions**. The Round 1 findings close, but the new DOM extractor introduces a timing-dependent rejection of the registered generic card.

**Verdict: CHANGES_REQUESTED. Open findings: 0 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.**

### Round 1 disposition

| Finding | Disposition | Evidence |
| --- | --- | --- |
| A-LA-E0-04-01 — substring membership | CLOSED | Exact channel membership rejects the original Sakai string and a mixed generic/Sakai grid. The actual patched extractor accepts the registered generic card in both Connect and Manage states and extracts `sakai` for the unregistered card. The separate loading-state regression is A-LA-E0-04-03 below. |
| A-LA-E0-04-02 — ledger preservation and approval | CLOSED | Each old ledger must be a non-empty prefix of the new ledger; app migration `012` remains required; exact equality with candidate files remains. The exact runner block rejects a deleted historical entry even when that file is also absent from the candidate, rejects historical reordering, and rejects an unapplied candidate migration in each database. The addendum now calls this an assertion change on `M1-41.common.j-snapshot`. The Lead explicitly approved these three checks in reply to this review and recorded **LD-24**, plan §6.1. |

The previously approved overlay parts and the historical WE-F3/WE-F5 corrections remain as assessed in Round 1. This round does not reopen those corrections.

### A-LA-E0-04-03 — MAJOR — Card membership can fail while the registered generic card is loading

**Location:** proposed `tests/e2e/M2/01-cards.m2.ts:23`–`:31`, used at `:45`; fallback in `tests/acceptance/lib/open-world.mjs:220`–`:223` (and its `tests/ltiaas/lib` copy).

**Problem:** The new extractor depends on a Connect/Manage action to recover the channel id, but `M2-01.cards` can reach the assertion before that action exists, causing a valid registered card to fail exact name membership.

**Evidence:** The portal renders the headings and descriptions while `/connections` is loading, with a loading indicator instead of each action (`apps/portal/src/Integrations.tsx:167`). The generic manifest's card title is `LTI 1.3`, while its public names are `LMS` and `Other LTI 1.3 platform` (`packages/channels/lti-generic/manifest.ts:10`–`:12`). The extracted descriptor is therefore `{channel:null,name:'LTI 1.3',text:'Loading…LTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.'}`; its name is not in `['lti-generic','LMS','Other LTI 1.3 platform']` and the new helper rejects it.

A host-only Chromium probe ran the exact patched extractor and the existing `card()` locator against this loading grid. Both heading checks and all three baseline visibility checks passed: `card()` resolves to the enclosing grid while Kajabi supplies its disabled Connect button (`tests/e2e/M2/lib/m2.ts:115`–`:118`). The old card oracle passed the same text; R5 rejected it. Adding the generic Connect link made R5 pass. The separate Node-side provider request at `:44` does not synchronize the browser's `/connections` request. Thus a slow, eventually successful load can fail this row. All 42 committed K0 probes still pass because they do not exercise this extractor/loading sequence.

**Suggested fix:** Before extracting, wait with a bounded observable condition for the relevant card actions/loading state to settle, or obtain the exact channel identity from a stable card attribute that also exists during loading. Preserve rejection of unknown channel ids; do not restore substring membership or hard-code the generic title. Add a deterministic DOM-level probe with delayed connections and a registered generic card, alongside the mixed unregistered-card negative. A permanently unresolved load must still fail within the test timeout.

### A-LA-E0-04-04 — MINOR — R5 cites the wrong decision and app migration count

**Location:** `docs/reviews/LA-E7-08/ld9-addendum-r5.md:9`, `:26`, `:29`, `:178`, `:697`, `:793`; repeated classification in `tests/ltiaas/GATE-RUN-PLAN.md:207` and `:892`.

**Problem:** The ledger evidence cites `LA-H21` as approval and says the candidate has 14 app migrations, but neither statement matches the source.

**Evidence:** Plan §6.2 defines LA-H21 as the operator-key policy. The explicit ledger approval is now LD-24 in §6.1. Candidate `8fadb828` has **21 LTI and 18 app** migration files, not 21 and 14; the independent runner probe accepts those complete lists. The implementation enumerates the files, so the wrong written count does not weaken the check.

**Suggested fix:** Cite BD-A2-108 and LD-24 consistently in the addendum, helper comments and gate plan; correct the app count to 18.

### Verification and boundary

Used a fresh private `git clone --no-hardlinks` at `/tmp/la-review-a-682458c10f9c`. Extracted the fenced patch from pinned integration `953de0d7`; `git apply --check --verbose`, application and `git diff --check` pass. The eight touched paths are the two helper/declaration pairs, the two K0 probe files, M2 cards and the snapshot runner. The four unfrozen helper/probe files match the integrated versions; the frozen edits remain proposals in the addendum.

- LD-1 host suite: **42/42 pass**; private `npm --prefix tests run typecheck`: **PASS**, using already installed QA dependencies through a private symlink.
- Both helper copies and both declaration copies are byte-identical. Baseline checks remain unchanged.
- Own Round 1 card counterexample now rejects; exact DOM extraction accepts generic Connect/Manage states and rejects mixed generic/Sakai grids.
- Exact snapshot runner block accepts 21/18 candidate ledgers. Six negative checks cover historical deletion with matching candidate-file deletion, historical reordering, and unapplied candidate migration in each database. The old gate-6 runner accepts the historical-deletion counterexample; R5 rejects it.
- The additional real-browser DOM probe reproduces A-LA-E0-04-03 without a server, application stack or network request. Evidence: `reviewer-r2-browser.{mjs,json}`. The JS DOM probes and ledger probes are in `reviewer-r2-probe.{mjs,json,log}` and `reviewer-r2-no-action.{mjs,json}`; the suite log is `reviewer-ld1-r2.log`, all in the private clone.

The shared gate source remains clean at its original tag. No Docker, stack, host stack runner, live product request or commit. Only this review file was edited in integration, and no other reviewer's files or probes were opened. Live gate rows remain pending; this review is not a re-grade of their prior results.
