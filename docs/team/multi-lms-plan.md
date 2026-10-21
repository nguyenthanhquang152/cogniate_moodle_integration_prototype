# Blackboard and Canvas integration phase

Date: 2026-10-20. Base: `9e24137`. Owner: Lead.

## Authority and goal

The product owner requested Blackboard and Canvas support as the next step toward an enterprise LTI service.
The owner requested both Claude Code Opus 5.5 and Codex GPT-6-Astra, each at xhigh effort.
The existing Codex coordinator remains Lead for this phase.
The role ownership and independent review gates in the charter still apply.
The earlier push request covered the completed Moodle release. This phase has no push authorization.

Work branch: `nguyenthanhquang152/lti-multi-lms`.
Orca run: `run_ebe671ad72a9`.

### Current checkpoint — 2026-10-21, 08:18 UTC

The bounded Docker diagnosis is complete. The Author settled successfully in `msg_a7738432accd` and was released.
The Lead checked the report, trial hash, result summary, cleanup record and W4 summaries.
A new child under a deleted and recreated parent failed to bind in 20/20 trials, including retries beyond five seconds.
A recreated child under an unchanged parent passed 20/20. New folders passed 20/20, and renamed-away children gave ENOENT 20/20.
The observed topology matches the failed import. Docker's internal mechanism and the delay's upper bound remain unknown.
The five-second retry proposal is withdrawn. No product source changed during diagnosis.
W4 strict comparison passed with zero problems; zero owned containers remain. The Docker window was returned at 08:13:33 UTC.
Evidence: `/Users/quangnguyen/cogniate-author-diagnostics/m1-41-content-missing-9cdd768-20261021T0746Z/diagnosis.md`.
Report SHA-256: `5ebbdc4564b6c224550c3724587e73455a525d7c48d371757ea95c51e38798e2`.

Architect task `task_0de615829d29`, dispatch `ctx_a3ac0d2eb594`, assesses a bounded reset repair.
It may clarify ADR-012 and write `docs/architecture/tasks/storage-reset-parent-repair.md`; product and tests are read-only.
Its requested and effective settings match Claude Code Opus 5.5 xhigh; acknowledgment is `msg_d1635c8cda4c`.
The candidate approach preserves the content parent directory while deleting all contents. Data erasure and path safety must remain intact.
No Docker window or product edit is authorized for the Architect.
Both independent reviews of QA repair `0e83e3c` are APPROVE, with no BLOCKER or MAJOR.
Reviewer-A report commit: `b1e79ef`; Reviewer-B report commit: `7b66c1a`. Both workers settled successfully and were released.
A-SOR-01 and B-SOR-01 are one pre-existing MINOR: two State OK assertions can pass without check folder lines.
Current product output supplies those lines; no current false PASS is shown. The Lead accepts deferral to the M4 human-review list.
A-SOR-02/03 and B-SOR-02/03/04 are optional NITs. No action is required for this bounded repair.
The earlier B-BM-01 coverage deferral also remains on the M4 list. Neither source approval nor diagnosis grants runtime acceptance.

### Prior checkpoint — 2026-10-21, 08:11 UTC

The full `9cdd768` attempt failed in round 1 storage at 07:40:46 UTC. All 488 row records are present: 419 PASS and 69 FAIL.
SIM passed 394 cases, snapshot isolation six, snapshot upgrade six, and migration twelve. Storage passed one and failed 69.
The repaired h4 replay case passed. All 33 upgrade-stage requests had one acknowledgment each, with no rewritten acknowledgments.
Canvas independently reports 233/233 PASS and sink checks PASS for round 1. This cannot approve the failed full round.
Round 2, legacy, fresh M2 and T7 did not run. Prior failed attempts remain unchanged.

Both QA workers independently found two harness defects: the probe self-test folder was not created, and the preflight oracle selected the wrong summary.
The oracle selected the post-start `mark-started` record. The actual check-mode pass preceded service-container creation.
A separate import check received a Docker bind-source error for a newly recreated content folder, instead of `content_missing`.
Its cause remains unproven. Product source remains frozen; no runtime rerun is authorized yet.
Backend Author task `task_dc3b05bb34ef`, dispatch `ctx_798816f87982`, investigates that mount error read-only.
Requested and effective settings match Claude Code Opus 5.5 xhigh. It may not edit repository files.
Its diagnosis shows that the product creates the content folder before the Docker call. Host-share visibility remains an unproven hypothesis.
The Lead granted bounded scratch-bind trials in `msg_b8bf1684b127`, conditional on fresh G1 and W1–W3 checks.
The diagnostic window belongs only to `ctx_798816f87982`. Full W4 identity comparisons and scoped cleanup remain required.

W4 live end and strict W3 comparison both passed. The Lead checked their summaries and the runner exit record.
QA confirms zero owned resources, unchanged protected and anonymous volumes, and unchanged baseline networks.
The secret scan found zero hits in 45 raw logs and 1,096 public files. Raw browser traces remain private.
Common returned its full-suite Docker window in `msg_7db50c6c9ae1`. No full-suite rerun is authorized.
Both QA workers settled with outcome failed, and their sessions were released.
Canvas reports are committed in `ef550a2`; Common reports are committed in `cee6258`.
Fresh QA task `task_d0bbcedfb6d3`, dispatch `ctx_499b214ba557`, owns the two confirmed harness repairs.
Its requested and effective settings match Claude Code Opus 5.5 xhigh; its starting acknowledgment is `msg_1b4b3acb009e`.
Its scope is the storage rows and oracle files, their self-tests, and a new QA repair report.
The repair is committed in `0e83e3cb740f004a357449ebdcda2be14998339d`; tests tree `4c7e067feedc644f955afee37806f06e7273dd04`.
Focused checks pass 18/18, full harness checks pass 77/77, and typechecking passes. The 488/233 inventory is unchanged.
New tests fail on the old source and detect all 12 focused mutants. The real probe passes with the repaired command on the host.
The worker settled successfully in `msg_0336187471d1` and was released. This gives no runtime acceptance credit.
Independent Reviewer-A `ctx_5a53cec57452` and Reviewer-B `ctx_f734e56b84e5` now review the exact candidate.
Both requested and effective settings match Claude Code Opus 5.5 xhigh. Neither reviewer has a Docker window.
Backend scratch trials passed fresh G1/W1–W3 in `msg_e33236a584e9`; the Lead checked the baseline summaries and hash.
The backend worker reports reproduction in the delete-and-recreate trials; final counts, cleanup and W4 remain pending.
Final conformance and guides remain queued. All 32 real-LMS rows remain UNVERIFIED. No push or main merge is authorized.

### Prior checkpoint — 2026-10-21, 07:23 UTC

Source candidate `9cdd768` is approved by both independent reviewers. Fresh host-only preparation also passed.
Common QA has resumed with a conditional runtime grant. Canvas QA has resumed as the independent host-only judge.
Fresh W1–W3 checks passed. The full runner started at 07:09:21 UTC; round 1 SIM is in progress.
The Lead withdrew its user-confirmation hold after checking AC-M3-06. The contract requires measured isolation, not a separate user promise.
The quiet-window question remains unanswered. Fresh W1–W4 checks and the strict environment comparison remain required.

The full attempt at `51a80b51de2c7491466a21a678418ff8178d247d` failed at 05:57:35 UTC.
SIM passed 394 cases and snapshot isolation passed six. The snapshot-upgrade phase recorded three passes and one failure.
There are 404 distinct row records: 403 PASS and one FAIL. Another 84 row records are absent.
The h1 seed and repaired backup oracle passed, but the phase stopped before it published the h1 row.
Migration, storage, round 2, legacy, fresh M2 and T7 did not run.
Canvas QA independently confirms all 233 Canvas rows and sink checks PASS across the completed phases. This remains partial evidence.

Both QA workers independently traced h4 to a host-control replay defect.
The new controller for the upgrade stage replayed seven completed seed requests from the shared control folder.
A repeated grant command revoked the old grant that h4 needed. The product then followed its documented revocation rule.
No product defect is shown. The source repair belongs to QA; the grant and committed-event assertions remain required.

W4 also failed its strict comparison because a new unrelated anonymous volume appeared during the run.
The sampler observed six unrelated `fgw-*` containers, which were gone at the final check. Their origin is not established.
Both unrelated volumes remain untouched. The seven protected volumes and baseline networks, engine and settings are unchanged.
The Lead checked the exit record, row records, W4 summaries and secret-scan summary.
The scan found no captured values in 33 raw logs or 879 public files. Raw browser traces remain private.
Common QA reports zero remaining lane resources. Both runtime workers settled with outcome failed; their sessions were released.
The Common reports are committed in `ce09703`; the Canvas reports are committed in `0596431`.
At that checkpoint, no worker had a Docker window. The owner was asked to arrange a quiet window for the next full run.

Task `task_3a4500f57586`, dispatch `ctx_65780150196a`, owned the focused host-only repair.
Requested and effective settings match Claude Code Opus 5.5 xhigh.
Its files are `tests/host/m1-control.mjs`, its self-test and `docs/reviews/M1/host-control-replay-qa.md`.
It settled successfully and its session was released. The repair is committed in `9cdd7687b91169a262648018ec6945efa31217dc`.
Its tests tree is `eccd4b50aa9c0ef6a25ce7d95fd383c0f3ad817e`.
The controller skips acknowledged requests and requires the request id to match its file name.
QA reproduces the seven-command replay on the old source. The fixed sequential-restart controls pass and preserve the old action records.
Focused tests pass 5/5; full harness checks pass 73/73. Typechecking passes, and the 488/233 inventory is unchanged.
Unacknowledged requests can run again after a crash. The repair does not promise exactly-once execution after process failure.
Reviewer-A `ctx_c0efa63d7f79` APPROVES this exact candidate; its report is committed in `42a6728`.
Reviewer-B `ctx_394aae19ddba` also APPROVES; its report is committed in `0b29d63`.
Neither review has a BLOCKER, MAJOR or MINOR. A-HCR-01 and B-HCR-01/02 are optional NITs; no action is required for this repair.
Both reviewers settled successfully and their sessions were released. These reviews give no runtime credit.
Common retry `ctx_686fb4062feb` completed host-only preparation under `msg_e517b9b463d1`.
All three requested and effective settings match Claude Code Opus 5.5 xhigh.
Its clean detached source is `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-9cdd768-20261021T0622Z/source`.
Preparation passed 73/73 harness checks, typechecking and the 488-row inventory. The Lead verified source and tool hashes.
Only expected session identifiers, comments and paths changed in the copied tools. No Docker daemon command ran.
The worker saved its handoff at `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-9cdd768-20261021T0622Z/prep/handoff.md`.
Its SHA-256 is `168c94ddf659c7a43ea0a5ee08d7b17e04ebe2b087523bffbd502d354d6b97d7`; the Lead checked the file and hash.
Message `msg_8ffe2eb31001` settles the retry with outcome failed because runtime is NOT RUN. Preparation succeeded and remains available.
The Lead accepted that outcome, released the session and acknowledged the delivery. At 06:44 UTC, all 144 worker records had no active or reclaimable resources.
That preparation attempt gives no runtime credit.
The seven protected volumes and both unrelated anonymous volumes must remain untouched; fresh W1–W4 checks are still required.

Canvas retry `ctx_374ca3cec6a5` prepared its independent tools for the same candidate, under `msg_320a8f66e700`.
Requested and effective settings match Claude Code Opus 5.5 xhigh; acknowledgment is `msg_091d57fe3d03`.
Its preparation passed: six tool self-tests, 73 harness checks, typechecking, 488/233 inventory and six M2 harness checks.
The Lead verified the clean source, handoff hash and all 22 R4 plus four sink-manifest entries against predecessor bytes.
Root: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-9cdd768-mVjZIekp`.
Handoff SHA-256: `4a0a1b5eac174e220f67d205bacdeae0fdee5e21ce9bf9ea92d485f48cbce3e4`.
Message `msg_a867b85d536b` continues this attempt as the independent Canvas judge; acknowledgment is `msg_7f51ff4169fc`.
It has no Docker window. M2 and T7 need a later transfer after Common returns the window.

Common retry `ctx_9e877dcb4b10` replaces the settled preparation attempt, using the same prepared source and qualified tools.
Requested and effective settings match Claude Code Opus 5.5 xhigh; acknowledgment is `msg_98035bce3c98`.
Authority `msg_4b7f865b8a34` and reply `msg_cfe2bdc2fdf9` grant the sole window for full M1 and legacy after fresh preflight checks pass.
Lane: `qa-multi-r1`, storage `qa-multi-r1-st`, port 8443, subnet `172.29.0.0/16`.
An unrelated change still fails the environment check. No unrelated resource may be changed or removed.
Both complete 488-row rounds, legacy, independent Canvas checks, fresh M2 and T7 remain required.
Start evidence is in `msg_b661d2e8a9df` and `msg_47b04be4d0e4`.
Root: `/Users/quangnguyen/cogniate-qa-runs/m1-full-9cdd768-20261021T0709Z`.
W3 SHA-256: `e879790c64d84d5c5250e99cb7e0fe7cece6985c36b43ebb0e02d34a91424ca7`.
The Lead checked all three preflight summaries, the W3 hash and the 16 tool hashes.
The only launcher changes are session and dispatch identifiers plus authority comments. Their previous ledger remains intact.
W3 records zero containers and nine volumes: the seven unchanged protected records plus both preserved anonymous volumes.
The wake step refreshed the idle engine before the formal baseline. W3 records live Docker time and the new bridge identity.
The first phase clone changed from 0755 to 0700 after creation; it was not private from creation.
QA confirms that seeding passed. The acceptance child is active; its command log is written only after it exits.
Product code remains unchanged from `a784522`. Final conformance and guides remain queued.
B-BM-01 remains an accepted M4 test-coverage deferral. All 32 real-LMS rows remain UNVERIFIED.
No push or main merge is authorized for this phase.

### Prior checkpoint — 2026-10-21, 05:36 UTC

The frozen product/test candidate is `51a80b51de2c7491466a21a678418ff8178d247d`.
Its tests tree is `a47b34cd56bb3d85e4c3ef1cafef0a2b0c3210c0`. Product code still equals `a784522`.
The repair changes only the common backup oracle and its self-test, plus its QA report.
The oracle now validates migration names for each database in the format that the product emits.
QA reproduces the old failure through real host emitters. The repaired oracle and corruption controls pass.
Harness checks pass 71/71; typechecking and the 488-row inventory, including 233 Canvas cases, are unchanged.

Both independent source reviews APPROVE, with no BLOCKER or MAJOR.
Reviewer-A's report is committed in `a259398`; Reviewer-B's report is committed in `92f0d09`.
Both reproduce the original failure and test the repaired oracle independently. Their source approvals give no runtime credit.
The repair worker and both review workers settled successfully; their owned sessions were released.

The Lead accepts B-BM-01 as a MINOR deferral under charter section 5.
The self-test lacks an equal-count exchange of migration names between databases. The actual oracle correctly rejects that exchange.
Both reviewers checked the actual comparison; Reviewer-B demonstrated the missing regression case with a weakened comparison.
Docs must add this test-coverage deferral to `docs/human_review/deferred.md` in M4. No source change is required for this candidate.
A-BKP-01 and B-BM-02 are the same optional assertion-message formatting NIT. No action is required for this repair.

Common retry `ctx_dee91bc7a4bc` started with host-only preparation under `msg_82c5f9134671`.
After both reviews passed, `msg_9506a89ce2ca` granted it the sole Docker window for full M1 and legacy.
Fresh W1–W3 checks passed before the documented full entry, which started at 05:30:48 UTC.
W3 records live time `2026-10-21T05:30:45.826Z` and `runStartSecond=1792560645`.
Its SHA-256 is `295585caf6e25ad3830716f607336333f9ae4ad5ad9489ff80f3e0d67137b2e1`.
Evidence root: `/Users/quangnguyen/cogniate-qa-runs/m1-full-51a80b5-20261021T0530Z`.
Round 1 SIM uses `qa-multi-r1-51a80b51-2026-10-21T05-30-48-841Z`. The monitors and clone guard are armed.
The phase clone was created with mode 0755, then changed to 0700. It was not private from creation.
The Docker baseline includes an unattributed anonymous volume created before W1. It remains untouched and must match at W4.
Two complete matching rounds remain required. No completed phase verdict is available yet.
Canvas retry `ctx_f8cca0cc95be` is host-only under `msg_3fc90776b450`; its independent artifact tools passed preparation checks.
It checks completed captures only, using the unchanged primary oracle and sink checks.
Requested and effective settings match Claude Code Opus 5.5 xhigh for both new workers.
The permission split is explicit: private outer roots and observers use umask 077; runtime children and fixture-sensitive checks use 022.
The approved narrow clone guard and normal container-readable inner modes remain required. No new tool design is requested.

The `82e2dab` attempt remains FAIL with 400 recorded PASS rows and 88 absent row records.
New full runtime evidence is pending. Final conformance, guides and fresh M2/T7 checks remain queued.
All 32 real-LMS rows remain UNVERIFIED. No push or main merge is authorized for this phase.

### Prior checkpoint — 2026-10-21, 05:02 UTC

The full attempt at `82e2dab` failed after the snapshot-upgrade seed stage.
SIM passed 394 cases and snapshot isolation passed six. All 400 recorded rows use the same product and test SHA.
The repaired h1 seed stage passed, but the phase stopped before it published that case row.
The common host oracle rejected the existing backup manifest because migration names are grouped by database.
Its collector expected a flat array. No product defect is shown.
The remaining 88 row records are absent. Round 2, legacy, fresh M2 and T7 did not run.
Canvas QA independently confirms its 233 cases and sink checks PASS across the two completed phases. These are partial results.

The Lead checked the exit record, row summary, W4 end and comparison summaries, and public scan summary.
The strict environment comparison passed. QA reports zero owned resources and seven unchanged protected volume records.
The scan found no captured values in 33 raw logs or 841 public files. Raw traces remain private.
Common QA settled `ctx_b36c97b882dd` with outcome failed; its owned session was released.
Its reports are committed in `1c2a61a`.
Canvas QA settled `ctx_33862fcfa6d1` with outcome failed; its reports are committed in `c1a90a6` and its session was released.
No worker currently owns a Docker window.

Task `task_c535a6bc68c8`, dispatch `ctx_f082183d3eb8`, owned the bounded backup-oracle repair.
Requested and effective settings match Claude Code Opus 5.5 xhigh.
Its scope is `tests/host/m1-migration.mjs`, its self-test and `docs/reviews/M1/backup-manifest-qa.md`.
Both independent reviews and a new frozen candidate are required before the full runtime retry.
Product code remains unchanged from `a784522`. Final conformance and guides remain queued.
All 32 real-LMS rows remain UNVERIFIED. No push or main merge is authorized for this phase.

### Prior checkpoint — 2026-10-21, 04:30 UTC

The frozen product/test candidate is `82e2dab6d26915c90070a4aae8ac0c4472706c2d`; both focused source reviews approve it.
Product code is unchanged from `a784522`. Both storage source reviews approve that product code.
The earlier clean-clone check passed 1,111 unit and 76 infrastructure tests, with no skips.
Candidate `55c33a3` repaired the oracle for `M1-17.canvas.repeat`. Both independent source reviews approve that earlier repair.
The reports are committed in `28b2fd4` and `bea9f0e`. They give no runtime acceptance credit.

The completed attempt at `a784522` remains FAIL: SIM has 393 PASS and one FAIL from 394 rows.
The remaining 94 round-1 rows, round 2 and legacy did not run.
Canvas QA traced the failure to an inclusive timestamp that counted the first redemption again.
The captured repeat shows no extra redemption or remote call. No product defect was shown.
The case took about 365 milliseconds, not 365 seconds. Reports preserve the correction in `fa17d51`.
Cleanup left no owned containers, volumes or networks. All seven protected volume records were unchanged.
The outer network comparison failed because its initial Docker view was cached. That raw failure remains recorded.

The attempt at `55c33a3` stopped with exit 1 at 03:51 UTC. Common QA now owns the sole Docker window for the new retry.
Both runtime workers settled with outcome failed; their reports are committed in `a928064` and `fda7ec6`.
Their owned sessions were released. M2 and T7 wait for the accepted candidate.
The focused QA repair settled successfully under `task_e3b78fb1a605` / `ctx_56fe09e67789`; its session was released.
Reviewer-A (`ctx_95f5cc04ec0f`) and Reviewer-B (`ctx_b79580197a2f`) both settled successfully; their report commits are `dee08f4` and `c9b6852`.
Release checks found no owned terminal resources for these reused review sessions.
Fresh Common retry `ctx_b36c97b882dd` runs full M1 and legacy under authority `msg_9c661cdcd106`.
Fresh Canvas retry `ctx_33862fcfa6d1` has completed host-only preparation under authority `msg_40eca66674cd`.
Requested and effective settings match Claude Code Opus 5.5 xhigh for both workers. They cannot claim predecessor evidence as their own.
Common sent fresh W1–W3 live boundary evidence before launch; all three gates pass with zero problems.
The Lead checked their summaries and W3 hash `1550b0158c8fad8d38b87528aee67ffec06a63978092a086edef0e1b1696c7c4`.
The full runner started at 04:29:22 UTC. First phase: `qa-multi-r1-82e2dab6-2026-10-21T04-29-22-551Z`.
Its source is `~/cogniate-qa-runs/m3-frozen-82e2dab-20261021T0418Z/source`.
Outer evidence is `~/cogniate-qa-runs/m1-full-82e2dab-20261021T0428Z`. Monitoring is armed.
Canvas waits for completed phase artifacts and an explicit later Docker window transfer.

The blanket umask 077 instruction changed a fixture's requested mode and caused one harness self-check failure.
The normal umask 022 passes all 70 checks. Both preparation results remain recorded; neither gives runtime credit.
Lead disposition `msg_54ccb0b5da19` keeps private outer directories while the frozen runner child uses umask 022.
A bounded guard sets only newly owned phase clone roots and captured-secret files private, preserving container-required inner modes.
QA reports 25 guard controls and 30 existing boundary controls passing. This changes external tools only.
The first phase root was observed at 0755, then set to 0700 after about 137 milliseconds, within the verified home boundary.
It is not claimed to have been 0700 from creation.
Canvas's later runtime checkout will sit under its verified private `R/t7-clone` parent, with normal inner modes (`msg_9ee0ecb9d2e6`).
The Lead verified all 22 wrapper files and four sink-gate files match the previously approved relative paths and hashes.

The full runner started at 03:25:14 UTC after W1–W3 passed. Round 1 SIM passed all 394 cases; snapshot isolation passed all six.
The Lead checked the 394 PASS rows and their single product/test SHA. `M1-17.canvas.repeat` now passes in the runtime run.
Canvas QA independently confirms all 233 Canvas rows and the sink evidence PASS, including the isolated row.
Snapshot upgrade failed on `M1-38.common.h1` during the pinned 011 seed stage.
The test compares service keys from Canvas launches with different resource links; the contract makes that identity part of the key.
Commit `82e2dab` sets the same explicit resource link for both launches. No product defect is shown.
It changes two lines in the common probe and adds `docs/reviews/M1/snapshot-key-qa.md`.
QA's host controls reproduce the old failure, pass the repaired h1–h5 path, and reject same-tuple key changes.
The harness passes 70 checks and typechecking. The 488-row inventory and 233 Canvas rows are unchanged.
Both reviewers reproduced the diagnosis independently and approve the exact committed repair, with no blocking findings.
Their controls preserve the positive same-tuple comparison and reject unexpected key changes. No runtime acceptance is implied.
The remaining 87 round-1 rows, all 488 round-2 rows and legacy did not run. This attempt remains FAIL.
The fresh source clone is `~/cogniate-qa-runs/m3-frozen-55c33a3-20261021T0315Z/source`.
Outer evidence is `~/cogniate-qa-runs/m1-full-55c33a3-20261021T0324Z`.
The Lead checked all three gate summaries and the exact W3 evidence hash reported in `msg_ecc8aad1e9a9`.
The formal boundary follows Docker wake and uses live SystemTime 03:25:12.190 UTC. All seven protected records match the original baseline.

Round 1 SIM evidence is `qa-multi-r1-55c33a3e-2026-10-21T03-25-15-066Z` under the source clone's `tests/host/artifacts/`.
Common report: `msg_1681eae62d2a`; independent Canvas report: `msg_b0028890055b`.
Case-results SHA-256: `744936ffffb9a66395a7fbd05ef9591d4f642a6b09411a2a32aea23791a0a00c`.
Final phase health is default for both services, with no knobs or simulation profiles. The phase isolation and teardown checks pass.

Failure report: `msg_294eb3092b5d`. The Lead checked 394 PASS, six PASS and one FAIL in the three phase result files.
The Lead also checked the W4 end and strict comparison summaries: both pass with no problems.
QA reports zero remaining containers or lane resources, unchanged built-in networks, and all seven protected volume records unchanged.
The public byte scan reports no captured-value hits in 826 public files or 32 raw logs.
Raw browser traces remain private. Common QA corrected the clone permissions and the earlier inaccurate claim in `a928064`.
The Lead verified all three clone roots and artifact directories are 0700, and all 526 raw or captured-secret files are 0600.

Two complete 488-row rounds, legacy suites, fresh M2 and three T7 runs are still required at one accepted candidate.
Final conformance and guides remain queued behind runtime acceptance.
All 32 real-LMS rows remain UNVERIFIED. No push or main merge is authorized for this phase.
Older role tables and run results below are history; current handoffs and this checkpoint govern active work.

### Failed attempt, oracle repair and external wrapper review — 2026-10-21

Common QA settled `task_ed3b08aa45ea` / `ctx_75f7ef7a9240` as failed in `msg_65539ccb5e72`.
The run is `qa-multi-r1-a784522a-2026-10-21T02-21-14-202Z`.
Its reports are committed in `84ea118`; the duration correction is committed in `fa17d51`.
Both report tasks settled. Their reused dispatches own no new terminal resource.
The next runtime attempt must retry the original task after review; it must not substitute a new acceptance task.

Canvas diagnosis `msg_6245a961f22b` identifies a test-oracle defect, not a product repair.
The Lead authorized only the repeat case in `msg_415316b9ae64`.
QA held that repair and its report in `msg_30af63f1a0fe`; the Lead committed them as `55c33a3`.
The test counts completed redemption lines for the connection before and after the repeat.
It preserves the status, platform identity and no-remote-call assertions, and requires exactly one initial redemption.
QA reports 10 focused controls and two 70-check harness runs passing. These are not runtime acceptance.
The Canvas inventory remains 233 rows; the full inventory remains 488 per round.
Independent review tasks are `task_6f727569298d` and `task_2c91a45a4577`.
Both settled with APPROVE. They independently reproduced the old failure and tested the real repaired case with log helpers.
Reviewer-A's optional count/truncation NIT and Reviewer-B's diagnostic NIT do not block this repair.
The R3.7 one-process logging-order limit is met by the product source; runtime file-sharing behavior is not yet measured.
Reviewer-A also identified a separate possible false-PASS path in other timestamp-based absence checks.
Task `task_622f866b9127` must identify exact affected claims and any existing independent checks before the runtime gate opens.
It authorizes no edits and no broad audit. Missing-log evidence and host/container clock differences are in scope.

That bounded task settled in `msg_f530a72b8fbd`; its full matrix is in `msg_ad8e732498e3`.
Reviewer-A withdrew the host/container skew premise. The suite and services all use the Docker VM clock.
Other listed absence claims have positive capture reads, audit barriers, gate cursors or simulator records.
One MINOR evidence gap remains: missing sink capture can silently give zero for four AC-M1-12 cases.
The Lead requires a complete sink lifetime covering all four cases, with zero hits, in each round's independent judgement.
This proves the existing criterion without changing repository tests or the candidate SHA.
Canvas QA's external extension is held in `msg_15937bcbfea1`; it reports 17 focused controls.
The older failed run stays FAIL even though its complete sink capture passes this narrower check.
The extension must receive independent review before acceptance. R3 wrapper files remain unchanged.

Reviewer-A approved the exact sink extension in `msg_f6a952ddcee2` and settled `task_12029808ebcb` in `msg_b2e50994d208`.
Manifest SHA-256: `1af4609e1cecf0e7b08c454a884929836faac61efd306e73e84ac14844afc1d2` (four files).
The Lead verified all entries. Reviewer-A reproduced 17 controls and added nine controls.
The new judge requires the unchanged 233-row judge to PASS and a complete sink lifetime to cover all four case files.
Vitest file start and end times bound those cases. Missing, malformed, duplicate or incomplete evidence cannot PASS.
The old failed attempt still gives overall FAIL. No runtime acceptance is implied.
Limits remain: a silent mid-life sink append failure is not directly observed; large clock steps can cause a false BLOCK.
An unrelated earlier lifetime may contain hits; the report shows its total separately. Nested artifact layouts fail closed.

Common QA's proper retry is `task_ed3b08aa45ea` / `ctx_4446d0034a39`, replacing failed `ctx_75f7ef7a9240`.
Orca verified requested and effective Claude Code Opus 5.5 xhigh settings for the new independent session.
The Lead granted the sole window in `msg_405608b347b5` and confirmed it in `msg_c415524f364c`.
The worker must pass W1–W4 and send exact pre-launch evidence before starting the documented full entry.
Two complete rounds and legacy remain required. Any failure needs capture, safe cleanup and a returned window before retry.

Reviewer-A's external wrapper review settled `task_0a7286893be2` with CHANGES_REQUESTED.
Messages `msg_e55c6aa0054c` and `msg_a0944540c23e` contain the findings.
The held R2 manifest has SHA-256 `0b2a39e37a20696dcd5318db9c294e331bd271c91567ff1042e68d54ef3bfd77`.
The Lead checked all 13 entries. The older manifest is retained as history and does not describe R2.

| Finding | Severity | Required disposition |
| --- | --- | --- |
| A-TW-01 | MAJOR | Prove `--keep` from the command and summary; reject runner cleanup. Require runner success, wrapper PASS and scan PASS. |
| A-TW-02 | MINOR | Treat unknown or failed BuildRunner counts as failure. Write a failure summary after counter errors. |
| A-TW-03 | MINOR | Decode streamed UTF-8 correctly, preserve signal status and record exact safe arguments. |
| A-TW-04 | NIT | Identify lane networks by labels. Do not exclude unrelated networks by name prefix. |
| A-TW-05 | NIT | Keep raw Docker error output private; do not copy it into public ownership records. |
| A-TW-06 | NIT | Use a fresh exact checkout before READY. Reject delayed prefix binding as proof. |
| A-TW-07 | NIT | Use fresh temporary directories or refuse nonempty scratch directories. |
| A-TW-08 | MINOR | Wake Docker and prove a live baseline before any lane command. Compare that baseline strictly at the end. |

The Lead authorized these external-tool repairs in `msg_c2d16837f83e`. No runtime window was granted.
QA must retain R2, hold R3 hashes and controls, and obtain independent re-review.
QA held R3 in `msg_550f81690f27`. The Lead verified all 22 entries in its absolute manifest.
Manifest SHA-256: `3f7b18016d0c51ba40e16d4ad17e19a16cb6c53aa5a575c4146f9da7a93fba24`.
QA reports lane controls 30/30, stream controls 7/7 and T7 tool controls 5/5. These are synthetic checks only.
Reviewer-B owns independent R3 re-review task `task_b6b7426391a6`; Reviewer-A handles the separate absence-check assessment.

Reviewer-B settled R3 with APPROVE in `msg_98883f1a2466`. All A-TW-01 through A-TW-08 are closed for source and synthetic evidence.
It independently ran lane 30/30, stream 7/7, T7 tools 5/5 and scanner 7/7 controls, plus its own failure controls.
Three NITs have explicit Lead dispositions in `msg_d0f9be329d3a`:

- B-TW-01: repair the external guard so any record ever marked `madeByRun=false` also prevents `stack:down` and retains all lane resources.
- B-TW-02: each accepted run needs an evidence record binding SHA, project, clone, summary paths and hashes, and secret-scan coverage. A gate PASS alone is insufficient.
- B-TW-03: use only a fresh prepared clone. Before READY, record empty status including ignored files and absence of the knob file and infrastructure data.

QA held R4 in `msg_f57821acd0c8`; the Lead verified its 22-entry manifest and the unchanged four-file sink extension.
R4 manifest SHA-256: `0f5b1e9c794a25e71318a7d9dd3533c9e7327d4f4a6c76b8b622722eecb57017`.
R4 changes only the cleanup guard, its self-test and output, and the setup plan. QA reports 32 lane controls passing.
R3 files are preserved under `tools/superseded/r3/`; its old absolute-path manifest no longer describes the live R4 files.
Reviewer-B task `task_a340dc6a6be7` owns the bounded R4 recheck. These tool reviews give no T7 runtime credit.
That task settled with APPROVE in `msg_bbf18de88920`. B-TW-01 is closed; B-TW-02/03 remain mandatory run procedures.
Reviewer-B reproduced 32 controls and independently checked positive cleanup and three ownership-doubt cases.
The Lead accepted exact R4 and sink-v2 bytes for runtime use in `msg_89998cbe1554`.
No further optional tooling changes are required. Reviewer tasks are settled; Common QA's runtime and Canvas QA's verification remain active.
Existing sticky ownership failures and event-watcher failures remain mandatory.
The runner must use a fresh detached exact-SHA checkout with `--checkout`, three runs, demo, confirmation and `--keep`.
Record clean HEAD, no `.env` and no `node_modules` before READY. Bind the final summary to the same checkout, SHA and project.
Only request wrapper cleanup after the runner exits. Product reset deletions still need observed absence and reappearance.

Architect task `task_dfe70ffe2864` settled in `msg_6a8f681e8f6e` with this existing-contract interpretation:

1. Wake Docker with one pinned, cached QA container: `--pull never`, `--rm`, `--network none` and label `org.cogniate.qa=wake`.
2. Prove that the wake container is gone. Require Docker time within five seconds of host UTC, with bounded retries.
3. Before any lane command, record the live clock, fresh lane, identities, seven protected FULL records, all networks and non-lane container IDs.
4. Require a live end boundary. Compare strictly, including built-in network IDs, settings and all protected records. Any difference fails.

A baseline first taken at a lane-create event is too late. It does not prove the required pre-start absence.
The cached-to-live bridge change from the failed attempt remains separate evidence; it does not relabel the raw comparison as PASS.
Common QA may assemble a separate transition record only if all Architect conditions T1–T5 are proven.
They require cached-time proof, only the allowed bridge transition, creation ordering, unchanged live-to-end resources and every lane birth after boot.
Missing evidence fails that separate isolation claim. The complete runtime attempt remains FAIL in every case.

## Sources and scope

- [DataCamp Blackboard case](https://support.datacamp.com/en-us/articles/17598773-blackboard-lti-integration)
- [DataCamp Canvas case](https://support.datacamp.com/en-us/articles/17598821-canvas-lti-integration)
- Current official Blackboard, Canvas, and 1EdTech documentation.

Use the cases to understand administrator, teacher, and learner flows.
Implement the open standards independently.
Do not copy DataCamp credentials, client IDs, private endpoints, prose, or product policies.
Keep Cogniate's current privacy and grade policies unless a reviewed design requires a change.

The phase covers provider setup, registration, Deep Linking, learner launch, and grade return for both LMSs.
Keep the existing Moodle flow and its native-only features.
Separate the LMS site URL, issuer, registration endpoints, and service origins where the standards require it.
Do not weaken SSRF checks or tenant isolation to accept a new provider.
Treat a provider profile as configuration, not proof of live interoperability.

The Architect will define precise acceptance criteria and file ownership before implementation.
Enterprise operations such as billing, high availability, and certification require a separate scope decision.
They are not implied by adding these two LMS integrations.

## Roles and gates

### Current owner direction: two LMS teams, one engine

The owner clarified this structure after the M0 gate passed:

| Team | Implementation | Independent QA |
| --- | --- | --- |
| Team 1: Blackboard | Existing Author, Claude Code Opus 5.5 xhigh | Existing QA, Codex GPT-6-Astra xhigh |
| Team 2: Canvas | Existing Author-2, Codex GPT-6-Astra xhigh | Existing QA-E2E, Claude Code Opus 5.5 xhigh |

Only these two models and xhigh effort are authorized.
Moodle, Blackboard and Canvas share one LTI engine.
The teams own provider-specific adapters, setup flows and tests around that engine.
Shared engine and portal files each have one named implementer; two workers never edit the same file concurrently.
Both existing reviewers remain separate from the authors and QA, and review both teams.
The Architect and Docs remain shared roles. The Lead integrates the work.
At most two implementers and one QA or reviewer run beside the Lead.

The horizontal M1/M2 implementation and test-preparation tasks were never dispatched.
They are now marked blocked as superseded; their old ownership is not authority to start work.
Read-only Architect task `task_f8c34ad605f6`, dispatch `ctx_e9dd8cd62b35`, completed the file and interface map.
The [two-team brief](multi-lms-team-brief.md) is the current ownership authority.
It names the shared backend owner, shared portal owner, provider files, test paths and foundation handoffs.
This changes execution ownership, not the approved protocol, criteria or review gate.

The first provider-team wave was dispatched from `294114092b643766b5f552150038b812513da1d0`:

| Work | Task | Dispatch |
| --- | --- | --- |
| Blackboard and shared backend | `task_9522839fff91` | `ctx_bed3b61aefb9` |
| Canvas and shared portal | `task_11fc3a40e7a0` | `ctx_303ff8d6037c` |
| Common and Blackboard test preparation | `task_33fd8359458d` | `ctx_45f64a5defb9` |
| Canvas and M2 browser test preparation | `task_b8c969c16053` | Queued for the next free slot and simulator interface |

The first three reuse the same dedicated instances and the recorded model/effort settings.
All three workers confirmed activity.
The Lead will commit and transfer the backend and wizard interfaces at explicit checkpoints.
Canvas's first wizard/DTO checkpoint passed its portal typecheck.
It was committed on the Canvas branch as `1f8ebc5` and merged into integration as `c0b35ab`.
This is WIP interface evidence, not product acceptance.
The Blackboard owner received the typed wizard interface in `msg_b274eddbc535`.
The provider-aware player text request is `msg_808ad19bf8c6`.
The next Canvas slice was committed as `51f685a` and merged as `4876253`.
It adds the Canvas setup wizard, configuration export UI, approval forms and shared portal helpers.
Author checks passed: portal typecheck, targeted lint and 34 unit tests.
The Blackboard owner can now use the shared tool rows, error notices, form lifetime hook and copy fallback.
These are author checks, not independent feature acceptance.

The portal and player slice followed as `b3544ca`, merged as `42055ff`.
It adds provider routes, connection details, capability guards, publishing and results labels, and learner text.
Author checks passed: portal and player typechecks, targeted lint and 136 tests in 11 files.
The Blackboard wizard mount remains pending.
Canvas backend implementation started after the foundation transfer below.

The shared backend foundation is committed as `2aa9263`.
It contains the provider types, registries, shared origin and role helpers, route interfaces and five Canvas stubs.
The backend owner had frozen those five stubs in `msg_2eb8c5b7802a`.
The Lead captured the 26 named files with matching content hashes and tested an isolated clone.
The Canvas branch advanced to this commit without changing its ongoing portal edits.
Exclusive ownership of the five Canvas modules transferred in `msg_f0102e0ecabc`.
Canvas accepted in `msg_ed519996cc5c`; the backend owner received `msg_a57aa8f39711`.
The common connection fields (`lms`, `profile`, `serviceUrl`) were deferred to the second backend checkpoint below.

The first isolated root check at `2aa9263` passed lint, typechecks and 789 of 790 tests.
One Canvas test read a teacher heading before its separate request completed.
The author retained the assertion and waited for that heading.
The follow-up also fixes older polls replacing a successful write and preserves registered teacher guidance.
It is committed as `a8736b2`, merged as `410e0eb`.
The Lead's isolated root check at `410e0eb` passes lint, all typechecks and 791 tests in 55 files, with zero skips.
The command used the real course fixtures through `COURSE_FIXTURES_DIR`.
Local check logs are `/tmp/cogniate-lead-foundation.bzkF2F.check.log` and `/tmp/cogniate-lead-foundation.bzkF2F.followup-check.log`.
This is a checked WIP foundation and portal snapshot. Canvas and Blackboard backend behavior is still incomplete.
Author screenshots in `apps/portal/evidence/M2/author-self-check/` use mocked API responses and make no SIM or live claim.

Canvas's pure backend slice is committed as `8af7914`, merged as `096aa89`.
It implements five Canvas profiles, the adapter and the embedded continuation helper.
The author reports root lint, typechecks and 798 tests passing for this slice.
The six source and unit-test files were held for the commit, then released.
The backend owner received the implemented profiles in `msg_bb1f19617691`.
Canvas configuration and deployment routes use the typed connection handoff recorded below.
No provider-readiness or independent QA claim follows from this checkpoint.

The shared backend's second checkpoint is committed as `6742cd9`.
The Lead committed the 57 named, held paths from `msg_148c594af91e`.
The author check passed lint, typechecks and 821 tests in 59 files; log: `/tmp/au-check-cp2.log`.
It adds the provider-aware LTI paths, migrations 004 and 011, typed connections, app routes and grant-engine implementation.
The app redemption and cleanup modules compile, but their focused unit tests are still in progress.
The Canvas branch advanced to this commit with its route edits preserved.
Canvas received the typed connection, DTO and real redemption interfaces in `msg_18ea5d4b5b6e`.
The backend hold was released in `msg_12634eff2ca7`; Canvas-owned modules remain exclusive to Canvas.
Both implementation tasks continue. This checkpoint is not independent QA or full feature acceptance.

Canvas's final two backend routes are committed as `d01eb5e`, merged as `003e2e4`.
The author reports 11 focused route tests and a full root check of 832 tests in 61 files passing.
The four source and unit-test paths were held for the commit, then released.
All five Canvas backend modules are now implemented.
Canvas still owns the Blackboard wizard mount and final shared portal checks once that module is delivered.
The Lead requested this small Blackboard checkpoint in `msg_13c6f24fa767`.
The current evidence remains author self-checks; no independent SIM or live result exists yet.

The Blackboard wizard is committed as `6bbee71`.
Its five held files were released after the commit, and the Canvas branch advanced with its smoke-script edit preserved.
Canvas received the exact exports for the shared registry mount in `msg_8467740fcceb`.
The backend author's checkpoint check passed 866 tests in 66 files (`/tmp/au-check-cp5.log`).
That check includes uncommitted backend work and remains author evidence.
The backend owner also received two narrowly scoped tracking files for AC-M1-33's HTTP 422 mapping.
The [team brief](multi-lms-team-brief.md) records this ownership correction from `msg_495acdccb262`.

The final shared backend slice is committed as `ea36bd8` from 45 held paths.
It adds the shared learner wiring, operator commands, recovery tests and acceptance infrastructure.
The author's check passed 873 tests in 66 files (`/tmp/au-check-cp6.log`).
The path hold was released in `msg_7c05dd903e1f`.
That message authorizes a short default-profile smoke in the isolated author lane.
Acceptance startup waits for the Canvas simulator; the author must not replace it with a stub.

Canvas's final ten portal paths are committed as `3872e49`, merged as `4156ad9`.
Its implementation task completed in `msg_aaf5bc7d16b9`; the same instance remains retained.
The checked source was `6bbee71` plus that final slice: 838 tests in 62 files, portal build and 11 mocked browser stages pass.
The Lead inspected the Blackboard setup and teacher screenshots.
They are author evidence from mocked API responses, not SIM or live evidence.
The Blackboard owner has a minor duplicate instruction correction in `msg_58d0d35222b3`.
The final independent browser run must use the corrected candidate.

Common and Blackboard QA preparation completed in `msg_7dc06a3b7ea3` and is committed as `6733e57`.
Its 37 files include 144 API cases, 12 host checks and strict case accounting.
All 16 harness self-checks pass; this task made no product calls or stack runs.
The same QA instance remains retained for frozen-candidate verification.
The retained Claude QA-E2E instance started Canvas and M2 preparation in `ctx_2289f5d57f67`.
Its authoritative handoff is `msg_c851b8cb47a8`, with the committed simulator interface and explicit audience correction.
Both implementation teams and QA keep the original path ownership.

The Blackboard duplicate instruction correction is committed as `92f9f12`.
The author reported the three files complete, with 15 focused checks and portal typecheck passing.
The Lead checked the scoped diff and confirmed that indexed content matched the worktree before committing.
No hold remains on those files; the backend owner received `msg_6f6a81330d49`.
The isolated Lead check at `92f9f12` passes root lint, all typechecks and 874 tests in 66 files, with zero skips.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.integration-check.log`.
This is the combined implementation check, not independent acceptance.

The backend implementation task completed in `msg_9dce99140564`; the same author instance remains retained.
Its default-profile smoke passed migrations, health, operator approval and containment, Moodle compatibility, and backup/restore checks.
The smoke found missing CLI audit logs when the process exited before the stream flushed.
The six-file correction is committed as `1e2c81f`.
The author reran the CLI checks and reports the expected audit events in the log.
Evidence: `/tmp/au-smoke/EVIDENCE.md` and `/tmp/au-smoke/logs/`.
The Lead confirmed no running containers and all seven baseline volumes after author cleanup.
The isolated combined check at `1e2c81f` passes root lint, typechecks and 876 tests in 66 files.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.final-implementation-check.log`.
Both author tasks are complete. M1 and M2 still need independent acceptance and both reviews.

A narrow author infrastructure task, `task_0ea1b07b3397`, is queued for acceptance-profile startup.
It starts only after the Canvas simulator checkpoint is committed and the Lead supplies an exact revision and lane.
It checks simulator/gate startup and transport controls; it does not replace independent acceptance.
The Canvas QA checkpoint request is `msg_1fe8a7abb13e`.

The teams agreed on the player interface in `msg_a05ac85fc3b8` and `msg_7df7bdfe2bcc`.
The backend emits `data-lms-name` on the play page element and the content-origin runtime body.
Its value is `Moodle`, `Canvas` or `Blackboard`, derived from the stored connection.
The player accepts only these values and defaults to Moodle.
`playStatusText(status, lmsName)` also defaults to Moodle and preserves its existing text.

QA's simulator interface is committed in `7738dc3`, in `docs/reviews/M1/qa-plan.md`.
Canvas QA uses that interface when a worker slot becomes free.
The token assertion audience is a scalar for Canvas and an array for Blackboard.
The queued Canvas task's earlier shorthand about an audience array does not change this contract.

Both code review tasks depend on the two completed implementation tasks.
Reviewer-A: `task_def3c0e1323e`. Reviewer-B: `task_8b9947e26455`.
Each has separate reports for M1, M2 and relevant M3 infrastructure.
Reviewer-A started in `ctx_8abc3ceb148c`, with handoff `msg_6bb1694b881f`.
It reviews frozen implementation `1e2c81f` in a clean clone while Canvas QA prepares the remaining tests.
Its scope remains open until it also reviews the complete harness at a later exact revision supplied by the Lead.
The review must record both revisions and cannot approve missing tests.
Initially, Reviewer-B remained queued while one slot was reserved for the short acceptance-profile infrastructure smoke.
This parallel review start changes scheduling only; every acceptance and review gate still applies.

Reviewer-A's checkpoint `msg_fedfa10e31a0` covers static review at `1e2c81f`.
It reports no BLOCKER or MAJOR and one MINOR, A-M1-01.
The app accepts `LTI_API_URL` outside the acceptance profile; the startup scripts alone restrict it.
The retained backend author received the config guard and focused tests in `task_a15209c95b03`, dispatch `ctx_998a94e37e40`.
The authoritative handoff is `msg_3baae96cac7c`.
This bounded fix uses the reserved worker slot before the acceptance-profile startup smoke.
Reviewer-A remains active until it checks the committed fix and full harness supplement.
The checkpoint is not a final approval or independent product acceptance.

The author completed A-M1-01 in `msg_bac4c859dd20`; its two held paths are committed as `76b03c7`.
All 13 config cases and the full root check pass: 889 tests in 67 files, `/tmp/au-check-am101.log`.
The Lead's isolated check at `76b03c7` also passes lint, all typechecks and 889 tests with zero skips.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.config-guard-check.log`.
Removing the guard made the four refusal cases fail; the author restored the guard before handoff.
Reviewer-A checked the exact delta and closed A-M1-01 by code reading in `msg_284bd54bb2aa`.
The author remains retained for the queued infrastructure smoke. No stack ran for this fix.
Final review still waits for the complete Canvas/M2 harness.

With the guard fix complete and Canvas preparation still active, Reviewer-B started in `ctx_055ee059f6df`.
Handoff `msg_7da9e4f23266` supplies frozen candidate `76b03c7` and the isolated 889-test check.
It reuses the retained GPT-6-Astra xhigh session and reviews independently of Reviewer-A.
Like Reviewer-A, it must inspect the complete committed harness supplement before final reports and settlement.
At that checkpoint, both reviewers and Canvas QA occupied the three worker slots.
The author infrastructure smoke waits for the checked Canvas module and the next free slot.
This avoids an idle review slot while keeping every verification gate.

Canvas/M2 QA preparation completed in `msg_008313464d19`; the same instance remains retained.
Its 31 paths are committed in `9964e6f`.
The inventory has 222 Canvas M1 rows (215 API, seven browser) and 64 M2 browser rows for both providers.
Full M1 discovery accounts for 359 API cases and 19 host/browser rows; 21 harness self-checks and typecheck pass.
M2's two harness self-checks, typecheck and 64-row accounting pass; the T7 selection remains 18.
No stack or product call ran in this preparation task.
Reviewer-A checked this supplement in `msg_478694142449` and reports no new finding from its lens.

Reviewer-B reproduced two product MAJORs in `msg_fe92ec471501`:

- B-M1-01: stale batch state permits a new grade POST after a connection is disabled, including during line-item lookup.
- B-M1-02: failed Docker or compose state checks permit backup/restore instead of refusing unknown service state.

The retained backend author is fixing them in `task_3ad990ed7771`, dispatch `ctx_02a94eea74ad`.
Handoff `msg_779d98e9768c` includes four independent probes and requires regression tests and a full root check.
Its additional MINOR B-M2-01 is the missing final Blackboard Submit instruction, routed in `msg_67647d0b44a3`.
That supplemental ownership is limited to the author's Blackboard steps and existing unit-test file.

Reviewer-B also found two harness MAJORs in `msg_f28b7dbcbfaa`.
B-M3-01 covers an invented wizard transition, the wrong connection-list location and incomplete baseline/label checks.
B-M3-02 covers full-page navigation that destroys the stale-state observer or resets the form under test.
The corrections must preserve every behavior assertion and use real client-side navigation.
They are mandatory in the final QA alignment task below.

Both reviewers now finish round-1 reports on `9964e6f`, with product code at `76b03c7`.
Messages `msg_b111ba3ce99a` and `msg_79c736363acc` replace the earlier instruction to wait for author repairs.
They will be retained for fresh round-2 reviews of all committed fixes.
A completed review task does not mean a passing verdict or a completed product gate.
This frees worker slots for the proper repair owners.

| Pre-verification follow-up | Task | Gate |
| --- | --- | --- |
| Architect: clarify Canvas domain, pending endpoint precondition and initial-grant check order (C-1 to C-3) | `task_52f5846266a5` | Accepted contract clarification, no silent design change |
| QA-E2E: exact oracles, B-M3-01/B-M3-02 and approved selectors | `task_ef66f1c5c7ed` | Architect clarification and author repair; then checked, committed harness |

For H-3, QA may read the accepted pre-M2 baseline `9e24137` and assert the exact Moodle disconnect text.
For H-6, the Lead approves only the M2 label-table changes in `tests/e2e/lib/portal.ts`, with affected test IDs recorded.
For H-1, QA may now read final portal structure to align selectors; all behavior assertions remain.
For H-7, retain the existing M2 host runner and infra helper interface; do not add a second selection path.
C-4's optional rotation host action is not added; its live matrix row stays unverified.
The two product-verification tasks are explicitly blocked on these internal gates and the acceptance startup smoke.
The Lead reopens them only after the exact product/test revisions and lanes are ready.

### Round-1 settlement and repairs

Reviewer-A completed its reports in `msg_b41420268b51`, committed as `17aa295`.
Its static code verdicts approve the reviewed scope, with A-M1-02 NIT open.
Reviewer-B completed in `msg_f1eb667c395a`, committed as `689e424`.
It requests changes for five MAJOR findings and the Blackboard instruction MINOR.
Both reviewed product `76b03c7` and harness `9964e6f`; neither report is product acceptance.
Both dedicated reviewer instances remain retained for fresh round-2 tasks.

The author completed B-M1-01 and B-M1-02 in `msg_ad700ad680a8`.
The seven held paths are committed as `9aeeddc`.
The repair also makes the maintenance entry point work through macOS path symlinks.
Meaningful tests cover disable during batch processing and lookup, failed Docker observation, and actual backup/restore entry.
The author reports mutation failures on the old code and a passing root check.
The Lead's isolated check at `9aeeddc` passes lint, all typechecks and 912 tests in 68 files, with zero skips.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.bm1-repair-check.log`.
The path hold is released; no stack ran for this repair.

Reviewer-B's additional B-M1-03 proves provider lookup occurs before local grant or lease refusal.
The retained author received it with the outstanding B-M2-01 in `task_11e90efd0070`, dispatch `ctx_bbcf90c431bb`.
Handoff `msg_3842ee823d6e` requires local ordered validation and lease acquisition before any outbound LTI call.
Authoritative Blackboard readiness, target history, remote guards and strict repeats must remain.
Endpoint tests must prove invalid-code and live-lease refusals make zero outbound calls.

The Architect completed C-1 to C-3 in `msg_95b35b2fd6b0`, committed as `ca14de6`.
The [response](../architecture/review-response-M1.md) clarifies existing rules without changing the design.
Canvas domain uses the URL host with a non-default port.
Pending add-deployment refuses before grant lookup; a redeemed initial grant has the exact audit reason `redeemed`.

QA alignment started in `ctx_3d09691e1edf`, handoff `msg_707e7e5c3724`.
It uses the committed portal and clarified contract at `689e424`.
Its test-only corrections run alongside the backend grant repair because their files and preparation checks are independent.
This scheduling refinement replaces waiting for the final backend revision solely to prepare selectors and oracles.
It does not allow product execution, reading uncommitted implementation, weakening assertions, or skipping cases.
The final product and test revisions, startup smoke, both round-2 reviews and all independent acceptance gates remain required.

The author completed the separate Blackboard instruction repair in `msg_1b3d231b3f20`, committed as `9f96f7b`.
Six focused tests, portal typecheck and lint pass; the new ordering test fails with the old steps.
QA received the committed supplement in `msg_320bcbe9119c`.
The live Learn workflow remains unverified.

The same checkpoint identifies a real data dependency for B-M1-03.
Current target construction reads provider data before local grant checks because the app has no local shared-platform id or Canvas issuer source.
The operator's grant issuance also reads providers despite the contract's no-LTI-call wording.
The Lead did not authorize the proposed exception that would allow provider reads before lease acquisition.
Reply `msg_3f5dd027395d` holds the engine repair for an explicit Architect decision.
Architect task `task_82c1af131e8a` must preserve local refusal, saved targets and authoritative remote checks, or submit a precise amendment for independent review.

Reviewer-B started the bounded repair recheck in `task_f13911a45527`, dispatch `ctx_e01f09f551e3`.
Handoff `msg_3a08c5b1220e` supplies `9aeeddc`; `msg_b9d86bd1e03e` narrows this dispatch to B-M1-01 and B-M1-02.
It will submit a checkpoint and settle to free the Architect slot.
Remaining round-2 work needs a fresh dispatch and exact later commits; this checkpoint cannot approve M1, M2 or M3 as a whole.

Reviewer-B completed that checkpoint in `msg_c5c310c6e0ff`, committed as `86adfbf`.
B-M1-01 and B-M1-02 are closed at `9aeeddc`.
Independent evidence includes 77 unit tests, 16 score-fence combinations, two refusal probes and six real/symlink backup-restore probes.
The same reviewer remains retained; overall CHANGES_REQUESTED still applies.
The Architect then started target-data resolution in `ctx_d4db78b27fef`, handoff `msg_31aa2ffc73ce`.
The author prepared six expected-failing endpoint tests in its held `redemption.test.ts`; these are not part of a passing commit.
No engine repair is authorized before the explicit design handoff.

QA completed alignment in `msg_02644efb0adc`; its twelve held paths are committed as `0008bde`.
The full harness checks pass: 21 M1 self-tests, two M2 self-tests, typechecks and unchanged case inventories.
The T7 selection remains 18 tests in six files.
This preparation used no stack or product calls.
The same QA-E2E instance is retained for final verification.
Reviewer-B started a separate bounded check of this supplement and the Learn instruction in `task_41cfdcc25616`, dispatch `ctx_17d6e7cf12b1`.
Handoff `msg_535e68ea63aa` supplies exact `0008bde` and requires meaningful oracle checks, not just successful discovery.
That review can close only the changes it actually checks; B-M1-03 and all product acceptance gates remain separate.

Reviewer-B completed the harness supplement in `msg_e830b4a0c281`, committed as `f89262c`.
It closes B-M2-01 and B-M3-01/02 for the reviewed source corrections.
MINOR B-M3-03 requires an observation of attempt creation; a later successful redemption proves only that no live lease remains.
QA follow-up `task_480510c15247` is queued for the retained Canvas QA instance.
The Lead approves a scoped audit comparison using the existing `grant_attempt_started` event and a positive control.
It must not add database access or weaken the no-attempt claim.
The event's stable semantics and rollback limits are also input to the design gate below.

The Architect completed proposal D in `msg_ade9630a3ca4`, committed as `a4bc3a4`.
It is **not accepted**. The [proposal](../architecture/review-response-M1.md) saves a trusted provider snapshot when the connection is created.
It adds migration `012`, a Blackboard readiness read after the local transaction, and a pinned Canvas issuer in S1.
The original B-M1-03 repair attempt settled **failed** in `msg_667a74777b06` because this design is not yet accepted.
Its separate B-M2-01 work is complete; the six expected-failing regressions remain held and uncommitted.
The same author remains retained for a fresh accepted-design implementation task.
This settlement does not close B-M1-03 or open any product gate.

The full independent design-review wave started on exact `a4bc3a4`:

| Work | Task | Dispatch |
| --- | --- | --- |
| Reviewer-A: correctness and security | `task_f01adc29325b` | `ctx_49f6050fff8e` |
| Reviewer-B: operability and test quality | `task_63f744cb3a1a` | `ctx_34758f845593` |
| Codex QA: design testability | `task_42cf75647102` | `ctx_8e6d60f0de88` |

Each writes its own target-snapshot report under `docs/reviews/M1/` before reading the other reports.
They inspect the applied issue-read clarification as well as the proposed schema and behavior changes.
Any BLOCKER or MAJOR keeps the design gate closed.
After approval, the Architect must apply the exact amendments before the author receives the implementation handoff.
Proposal D8 does not transfer Canvas module ownership by itself; the Lead must make that assignment explicit.

All three independent design reports request changes.
Reviewer-A's report is committed as `5a08512`; Reviewer-B and QA reports are committed as `c447dd3`.
The reports require local validation on all three redemption paths and consistent behavior for existing registered Canvas connections after migration.
They also require exact readiness and cancellation outcomes, post-commit audit semantics, prior-attempt cleanup, and a complete test inventory.
These are design findings. No product acceptance result follows from them.
The same Architect is correcting proposal D in `task_1d0ecd7020a8`, dispatch `ctx_fc5241ad834d`.
The Lead forwarded the final B and QA reports in `msg_0028acd06c91`.
The Architect owns only `review-response-M1.md` for this revision.
All three reviewing instances remain retained for independent rechecks of the frozen revision.
The engine repair and QA audit follow-up wait for the accepted contract.

The Architect completed revision 2 in `msg_5f5c25b3616a`, committed as `caa3541`.
It replaces D1–D8 with R0–R9 and preserves the original proposal as review history.
No accepted contract, data model, ADR, or task specification changed.
The independent recheck wave uses exact `caa35412887aa7c4b762a2c82be5fd12a984db9c`:

| Work | Task | Dispatch |
| --- | --- | --- |
| Reviewer-A | `task_c17cd1135dca` | `ctx_d1e7f2d9e3f0` |
| Reviewer-B | `task_06b884338b8a` | `ctx_1fd3ff3518ef` |
| Codex QA testability | `task_2184b58e02fa` | `ctx_db5eb5c61bc7` |

Handoffs are `msg_f49fa5cc459b`, `msg_d77e73ef389d`, and `msg_b014cce0238f`.
The Architect remains retained. Review completion alone will not open the implementation gate; the verdicts must approve the design.

QA's revision-2 report is committed as `9eb5da3`; Reviewer-B's report is committed as `6222358`.
They close the original readiness, registered Canvas lifecycle, prior-history cleanup, and bounded audit gaps.
Two MAJOR findings remain: a wrong registered-nonrepeat migration oracle, and incomplete recovery steps for old pending connections.
The intended fixes preserve grant-first validation and use the accepted suspend, fence, and release procedure.
Minor corrections cover target-construction wording, stable fresh-migration case IDs, and audit scope after restart.
The Architect started bounded revision 3 in `task_68130407ba89`, dispatch `ctx_ebe383641cd8`, handoff `msg_3672b92b92d2`.
It must incorporate Reviewer-A's final revision-2 report before settlement.
The same file ownership and implementation gate remain in force.

Reviewer-A completed revision 2 in `msg_f6406ec30b4a`, committed as `979aecc`.
Its verdict is APPROVE, with A-D-01 through A-D-05 closed.
A-D-06 requires neutral readiness guidance for both providers; A-D-07 overlaps the pending recovery correction.
A-D-08 lists six wording corrections.
The Lead forwarded the final report in `msg_d3456c44427d`.
Use the complete accepted recovery order and one neutral readiness message; no new public cause field is needed solely for that message.
The Architect now has all three final reports.
The final bounded recheck tasks are `task_1fe8ae6741d8`, `task_081f83c4db74`, and `task_03dd4c0d94cd`.
They wait for a frozen revision 3 and remain separate from product acceptance.

The Architect delivered revision 3 in `msg_c4f4e0386f02`.
Before committing it, the Lead found a fixture mismatch: the Blackboard seed fails before S1, so cleanup must observe an absent remote record.
Narrow task `task_8fbbd0427488`, dispatch `ctx_d6339580ea3c`, corrects that oracle and the conditional recovery text.
Handoff: `msg_0188520c6b03`. This is part of the uncommitted revision 3; the independent third review has not started.

The Architect completed that correction in `msg_390347962e0a`.
Revision 3 is frozen at **`78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`**.
The Blackboard reservation-only fixture now expects absent records and a fresh deployment; the Canvas orphan fixture still requires fencing and deletion.
The final bounded design recheck wave is active on that exact commit:

| Work | Task | Dispatch |
| --- | --- | --- |
| Reviewer-A | `task_1fe8ae6741d8` | `ctx_752eba91c7de` |
| Reviewer-B | `task_081f83c4db74` | `ctx_d851263c7966` |
| Codex QA testability | `task_03dd4c0d94cd` | `ctx_f5b1c375220f` |

Handoffs: `msg_fa58502aaa35`, `msg_bf1c0892b181`, and `msg_a0afb45d9d38`.
The Architect is retained. Implementation still waits for approval and application of the accepted contract amendments.

All three final design rechecks passed on `78bc34a`; the reports are committed together as **`b6e8f739e6de752cb287929c9836734d2494e444`**.
Reviewer-A APPROVE: `msg_826bd7afdaea`. Reviewer-B APPROVE: `msg_3a6cd089d556`. QA design PASS: `msg_776a4a57d078`.
No design BLOCKER, MAJOR, or MINOR remains. Product B-M1-03 remains open.
The Lead accepts optional A-D-09 precision for the contract application: include the create-handler error override, use a null pre-create connection id in the log, prefer the replacement cause over inactivity, and retain cancellation-first outcome wording.
Architect application task `task_cf7e2e942594`, dispatch `ctx_50ca8c5ba951`, started with explicit approval in `msg_2a5205155c10`.
It owns the eight named architecture files only. Product ownership stays with the existing two teams.

The next implementation and preparation tasks wait for the frozen applied contracts:

| Work | Task | Owner |
| --- | --- | --- |
| Shared engine, snapshot migration, Blackboard and server errors | `task_de758fb0e31a` | Existing Claude Author |
| Canvas S1 issuer pin and shared portal error text | `task_65cded3fc783` | Existing Codex Author-2 |
| Common/Blackboard cases, inventory and populated upgrade route | `task_7f4a69ad0b33` | Existing Codex QA |

No Canvas file ownership is transferred. The Canvas worktree has only its existing untracked setup artifact; the Lead will advance it before launch.
In parallel, the narrow B-M3-03 task `task_480510c15247` now runs as `ctx_974f279ececc`.
Handoff `msg_68891aec5a82` supplies the accepted R3.7 audit semantics and permits preparation in its two existing owned paths.
It uses a same-process request-completion control and a positive attempt control; it makes no durable crash or database claim.
This does not authorize product acceptance runs or the broader Canvas snapshot test work.

The Architect completed the eight-file application in `msg_8acb2b069133`.
The Lead inspected the changes and committed them at **`ccdd9ef67cdd2be4c6af374136777fda4e081943`**.
This is the applied-contract baseline for implementation and test preparation.
The Architect remains retained; no product finding is closed by that application.
The Canvas worktree advanced to this commit with tracked files clean and its untracked setup artifact preserved.

The implementation and preparation wave is now active:

| Work | Task | Dispatch | Handoff |
| --- | --- | --- | --- |
| Shared backend and Blackboard | `task_de758fb0e31a` | `ctx_610c9d2ca767` | `msg_7ed661f0cc4a` |
| Canvas adapter and shared error text | `task_65cded3fc783` | `ctx_7ea6a7979f6e` | `msg_f33acba30b52` |
| Common/Blackboard acceptance preparation and populated upgrade route | `task_7f4a69ad0b33` | `ctx_365b9228372d` | `msg_61ddda53baef` |

All reuse the same dedicated instances. This fills the three worker slots.
Each owner must hold exact completed paths for a Lead commit. No stack runs in this wave.
The six previously failing backend regression tests remain with their author until the repair passes.

Canvas QA completed the narrow B-M3-03 repair in `msg_e2c3b7e40181`.
Its two held paths are committed at **`3b160f7bc22ca43f18bc16c94ecfc336b0fe80d6`**.
The helper checks cover each refused request's own completion line and a separate positive attempt control.
Typecheck, 21 harness self-tests, unchanged inventory, and six synthetic oracle checks pass.
These are harness checks only. B-M3-03 awaits independent recheck.
The same Canvas QA instance remains retained for `task_1276def76f95`, the broader Canvas snapshot and readiness test preparation.
That task depends on the applied contracts and the committed narrow repair, and waits for a free worker slot.
Codex QA owns the complete manifest and mixed-provider `011→012` host route; Canvas QA supplies its assigned cases and fixture interfaces.

The QA case split is confirmed in `msg_dfe8dcfa0ded`: provider variants of AC-M1-37 (v12) and AC-M1-38 (i4) have separate rows.
Common QA supplies shared audit helpers without imports from test modules.
Canvas QA preserves the existing public Canvas fixture helpers or coordinates a change through the Lead.
The backend interface handoff `msg_41dc8a263951` assigns the typed staged-create URL field to the backend Author.
Canvas Author-2 owns `url: target.issuer` in the adapter and the missing committed-platform guard before parsing in its deployment route.
This applies the accepted contract; it transfers no file ownership.

Final combined code and harness review tasks are queued:
Reviewer-A `task_74de10f72cf9` and Reviewer-B `task_08461c360614`.
Both depend on the two implementation tasks and both test-preparation tasks.
The Lead must supply one committed candidate with a passing root check before dispatch.
They append independent reports and recheck the full candidate; earlier bounded findings and design approvals do not replace this gate.

At 11:38:20 UTC the Claude backend transcript ended with a session-limit notice (reset 20:20 Asia/Saigon), without `worker_done`.
The Lead followed the transcript cursor to its end; this is positive evidence of a stopped agent turn, not a timeout inference.
Dispatch `ctx_610c9d2ca767` is abandoned to fence its authority; its session remains retained and no process or file was removed.
The same task `task_de758fb0e31a` is failed for quota recovery, with a retry assigned to a dedicated Codex GPT-6-Astra xhigh replacement under the owner's earlier replacement authorization.
The eight partial backend paths are preserved in `/var/folders/_h/pjt6zzrj46sctnb18tsmbzgw0000gn/T/cogniate-bm1-03-claude-partial-taeekbh7`, with a SHA-256 manifest.
They remain uncommitted and are not a passed checkpoint. The replacement must check and complete them.
The [team brief](multi-lms-team-brief.md#backend-quota-replacement-2026-10-20) records the narrow role exception and prevents overlapping editors.
The retry started through `worker-start --retry-of` as **`ctx_1cb6714a155b`**, with effective `gpt-6-astra` / `xhigh`.
Its dedicated handle is `structworker_ead1fb5e-7672-4a9f-9e28-fe7e2943ed8d`.
Handoff `msg_0881270e976b` supplies the applied-contract SHA, partial-file backup and priority interface checkpoint.
Canvas received the recovery notice in `msg_6e4870bb8d15`; the active worker count stays three.
The replacement supplied the held two-file interface in `msg_a3a8a37dfea8`.
It is committed at `d64832b5b2ebf82f267cb6f21208eee792a4ff30`: a typed optional create URL and a local profile view.
An isolated app TypeScript check passed with exactly those two files; this does not verify the unfinished engine.
The Canvas branch advanced to that commit with its six modified paths and setup artifact byte-identical.
Canvas received `msg_07b1edd4332f`; the backend hold was released in `msg_1697d5d06e38`.

Canvas completed its repair in `msg_208b3e00ecb8`; its seven held paths are committed and integrated at **`4cf1e91c5c56b49630e57f9b428c73777a38af3d`**.
The final author check passes 926 tests in 68 files and 46 focused tests, plus lint and typechecks.
This includes the API-created connection fixture needed by the snapshot guard.
The backend owner received the integration in `msg_50801fa7b224`; its full engine check and independent verification are still pending.
Author-2 remains retained.

Canvas QA preparation started in `ctx_fb3dd983143d`, handoff `msg_c709d138e690`, with the common QA helper and case interfaces.
The quoted common-owner paragraph was clarified immediately in `msg_56190c6754af`: this worker owns only Canvas cases.
Its transcript then ended with two Claude session-limit notices, before task edits or `worker_done`.
The Lead fenced that dispatch and marked the same task `task_1276def76f95` failed for a quota retry.
The [Canvas QA replacement rule](multi-lms-team-brief.md#canvas-qa-quota-replacement-2026-10-20) assigns a distinct Codex GPT-6-Astra xhigh QA instance under the owner's existing fallback authorization.
No author or common QA instance takes that independent role.
The Canvas QA retry is `ctx_8d09d8d0f137`, effective `gpt-6-astra` / `xhigh`, handle `structworker_e1fb48fe-f341-43c3-b5b7-2aa59d1e3107`.
Its start question received the full criteria-only handoff in `msg_dc95bbc99004`; the old Claude session received the closure notice `msg_aa550af7901f`.
The backend's old Claude session received the equivalent closure in `msg_97a98268e4d8`.

Common/Blackboard QA completed in `msg_edd4d15e4ef0` and is retained for clean execution.
Its 21 held paths are committed at **`3fef85f51ea798ac6bf3245dba632131f4e38dda`**.
The preparation adds 27 mandatory rows and four disjoint full-run phases, including the populated `011→012` host route.
Its selection discovers 166 API cases and 17 host rows; 27 self-checks, typecheck and syntax checks pass.
Full inventory correctly fails until the 11 required Canvas rows exist. No product or stack run occurred.
The Canvas QA retry received the frozen common interface and inventory in `msg_6962666ea78b`.

The backend replacement completed `task_de758fb0e31a` in `msg_204ddcfa7578`.
Its 12 held paths are committed at **`a8580ddea51db354a743ba469d8ad0e53878c030`**.
The Lead checked every file against the report's SHA-256 values before committing.
The final author check passes lint, typechecks and 996 tests in 69 files, with real course fixtures and zero skips.
Log: `/tmp/cogniate-backend-snapshot-final-check.log`; report: `/tmp/cogniate-backend-snapshot-report.md`.
This completes implementation of the accepted snapshot repair. B-M1-03 still needs independent review and acceptance.
The same replacement is retained for the separate author startup smoke, `task_0ea1b07b3397`, at this exact product revision.
The [team brief](multi-lms-team-brief.md) extends the instance exception to that task and preserves its original scope.
Canvas QA preparation remains active; both combined reviews wait for its committed harness.

Canvas QA completed in `msg_1a68d2c8fea3` and remains retained.
Its 17 held files are committed at **`eb43247d02df622d5da72dafac41d919f65a91fe`**.
This adds all 11 required Canvas snapshot rows and exact readiness assertions within existing M2 cases.
Full M1 inventory is 392 API cases and 24 host/browser checks: common 42, Blackboard 141, Canvas 233.
The four phases account for all 416 rows. Both complete acceptance rounds remain required.
M1 preparation passes 27 harness checks plus three Canvas oracle checks; M2 passes two checks and retains all 64 case IDs.
The Lead's clean checkout at `eb43247` passes lint, all typechecks and 996 tests in 69 files, with zero skips.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.snapshot-candidate-check.log`.
These checks establish a review candidate, not independent product acceptance.

The final combined review wave now uses this exact candidate:
Reviewer-A `ctx_b1fbdd75524c`, handoff `msg_2815e3ab70d5`; Reviewer-B `ctx_67d2f3361829`, handoff `msg_2b50d40ab55c`.
Each reuses its retained instance and reviews independently.
The same backend replacement runs the separate startup smoke in `ctx_49f1b1647236`, handoff `msg_7e38a28b13c6`.
Its isolated source is `a8580dd`, which has the same product and simulator runtime as `eb43247`.
These three tasks fill the worker slots. No independent acceptance stack has started.

Reviewer-A's new turn ended at 12:12:12 UTC with the Claude session-limit notice, before any new review edit or `worker_done`.
The Lead followed the transcript to its end, fenced `ctx_b1fbdd75524c`, and marked the same task failed for quota recovery.
The [team brief](multi-lms-team-brief.md#reviewer-a-quota-replacement-2026-10-20) assigns a separate Codex GPT-6-Astra xhigh Reviewer-A retry under the owner's existing fallback authorization.
The reviewed candidate stays `eb43247`; no product, harness or review gate changes.
The retry is `ctx_3604d1e6a48e`, effective `gpt-6-astra` / `xhigh`, handle `structworker_6dd41299-6d1a-4212-b8eb-5877a29ed6bc`.
Handoff `msg_270a933f6402` gives its exact candidate, evidence, report scope and independence rules.
The old Claude session received closure notice `msg_296d8bb69bf3`.

The author startup smoke completed with PASS in `msg_01e5f0382738`, with no repository changes.
Report: `/Users/quangnguyen/cogniate-author-runs/startup-smoke-20261020T120716Z/evidence/report.md`.
It verifies the nine acceptance services, TLS, actual simulators, transport controls, and restoration of the five default services.
The Lead confirmed identical product and simulator runtime bytes between its `a8580dd` source and candidate `eb43247`.
Cleanup leaves no containers and preserves all seven baseline volumes.
Background host-runner persistence after a tool session remains unverified; a foreground heartbeat and image readiness passed.
QA must keep a persistent runner session and check its heartbeat before course builds.
This limitation does not turn the startup smoke into course-build or product acceptance evidence.

With the smoke complete, common/Blackboard acceptance may run beside the two independent reviews.
This follows the charter's parallel verification stage and uses the newly free third worker slot.
The candidate remains `eb43247` for every product and harness check.
All review, acceptance, migration, Moodle and documentation gates remain required.
A discovered blocking defect must be routed to its owner; no mixed-revision evidence may pass a gate.
The Canvas/M2 verification task waits for the next worker slot and an assigned lane.
Common/Blackboard QA `task_ed3b08aa45ea` is active in `ctx_8d51e8033a8a`, handoff `msg_a90c92ad2da1`.
It reuses the original independent Codex QA instance and owns the `qa-multi-rN` lane, port 8443, subnet `172.29.0.0/16`.
It must run the complete M1 inventory twice at `eb43247`, then the required legacy suites, with exact revision and case accounting.

Reviewer-B's checkpoint `msg_9fac9a00748f` reports that B-M1-03 and B-M3-03 can close on `eb43247`.
Its final reports are still pending; Reviewer-A has not submitted its new verdict.
The checkpoint adds MINOR B-M3-04: Canvas v4/v6 must capture their scoped attempt event before killing the old process.
The Lead queued the two-file correction as `task_efed48b0e53a` for the retained independent Canvas QA replacement.
Full M1 rounds are held by `msg_f7c9fd485238` until the correction is committed and a revised candidate is supplied.
Common QA acknowledged this before any acceptance round or stack startup in `msg_30c2b4836507`.
It may execute unchanged legacy suites on the separate, exact `eb43247` record while it waits.
The first T2a/T2b/T3a/T3b legacy run started in the assigned lane in `msg_54797a8ff3fd`.
Final evidence must prove unchanged relevant paths before carrying a legacy result to the corrected candidate.
Both complete M1 rounds must use the same final product and test revision.

Reviewer-B withdrew preliminary B-M3-04 in `msg_59b0f18c82eb` after checking the applied normative text.
M1 evidence rule 4 requires the fresh restarted-process cursor and completion control already present in Canvas v4/v6.
The historical proposal also names pre-kill capture; the applied criterion does not repeat that sentence.
The Lead checked both sources and kept their evidence limits: no cross-crash audit claim or storage proof.
Unstarted task `task_efed48b0e53a` is cancelled, recorded as failed with that explicit reason; it created no worker or file change.
Message `msg_23970ae81e88` lifts the full M1 hold and keeps the exact candidate `eb43247`.
QA will finish its current legacy group, then run both full M1 rounds at that same revision.

Reviewer-B completed in `msg_ab1022a430ea`; its three final reports are committed at `9680bb75850b047f844fb05cf128fd254fd9e155`.
All three source/preparation verdicts are APPROVE, with B-M1-03 and B-M3-03 closed and no open Reviewer-B finding.
The Lead confirmed that every byte of each earlier report remains intact.
Reviewer-A and independent acceptance remain separate unfinished gates.

The free worker slot now belongs to Canvas/M2 verification task `task_e28388df4dcc`.
The [team brief](multi-lms-team-brief.md) assigns it to the same independent Canvas QA replacement.
At allocation, the first QA stack used about 683 MiB across its five containers; Docker has 7.75 GiB.
A second isolated QA stack is authorized within the existing maximum of two, after its owner rechecks ports, subnet and current load.
Canvas QA uses port 8643 and subnet `172.27.0.0/16` for SIM, then port 8543 and subnet `172.31.0.0/16` for Moodle.
It must never run both of its lanes together. Neither worker may relax a deadline or remove another worker's resources.

Before a second stack started, the Lead found that M2's preservation check compares all other Docker resources across the run.
Concurrent teardown would invalidate that comparison, even with enough memory.
Message `msg_8408efe92281` therefore supersedes simultaneous stack use: only one QA worker owns the stack window at a time.
This preserves the harness checks without changing them.
Canvas verification is active in `ctx_8ec51c3aa7b5`, handoff `msg_c50d1a8c3922`; its initial work was read-only preparation.

Common QA's T2a/T2b/T3a/T3b group passed at `eb43247` in `msg_3d455fd5d6ba`.
Run: `qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z`.
Evidence: `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/summary.json`.
The Lead read its summary: all aggregate entries pass, including the separate TTL check, reset/seed, default restoration, isolation and teardown.
The main suite reported 58 cases with zero failures; its deferred TTL case passed in the required separate pass.
Cleanup confirms no containers, unchanged metadata for the seven baseline volumes, and no owned networks.

The exclusive stack window transferred to Canvas QA in `msg_cb4eaf43472a`: M2 SIM, then default-profile T7 three runs and demo checks.
Common QA received `msg_c9724f02c615` and holds before its next stack.
After Canvas cleanup, the Lead returns the window for the complete M1 runs and remaining legacy suites.
Canvas QA will assess its 233 M1 cases from common QA's two complete runs, with executor attribution and any necessary targeted recheck.

### Reviewer-A Round 2 corrections

Reviewer-A completed `ctx_3604d1e6a48e` in `msg_558896e7e433`; its three reports are committed at `af5d5f6`.
The replacement instance is retained. M1 and M3 are CHANGES_REQUESTED; M2 source is APPROVE.
The reviewer ran 234 focused unit tests and harness checks, then reproduced the defects with independent supplemental probes.
Those checks are not full acceptance.

| Finding | Severity | Repair owner |
| --- | --- | --- |
| A-M1-03: Canvas S2 fallback has no new S0 and exceeds the call budget | MAJOR | Same shared backend replacement, `task_bfa884e18169` |
| A-M1-04: binding GET transport retries outside S0 and the five-second bound | MAJOR | Same backend task; preserve unrelated transport retries |
| A-M1-05: phase-1 refusal logs use the boot trace | MINOR | Same backend task; retain exact request-trace assertions |
| A-M1-06: success audit precedes phase-2 COMMIT | MINOR | Same backend task; prove failed COMMIT emits no success |
| A-M3-01: snapshot and upgrade cases miss outbound methods in gate capture | MAJOR | Common QA, current `ctx_8d51e8033a8a` |

Common QA accepted the repair in `msg_4d57be697049`.
It will preserve specific fault rules, capture all seven methods, re-arm after resets, and exercise the actual gate boundary.
It may edit only its current common/Blackboard paths and harness glue; Canvas QA keeps its own paths.
The backend owner may edit its shared modules and colocated units. No contract or migration change is authorized.

Canvas QA started M2 at `eb43247` in `msg_5ebcc8f6db24` before the findings arrived.
Run: `qa-e2e-sim-r1-eb43247d-2026-10-20T12-34-50-805Z`.
Message `msg_478c680eab7a` permits that in-flight run and cleanup, then holds T7 and any next stack.
Message `msg_66224538862d` holds common QA's full M1 runs until committed repairs, re-review and a new frozen candidate.
The current M2 run and earlier T2/T3 pass remain evidence only for their exact SHA.
Reviewer-B's approval does not override Reviewer-A's blocking findings.

The backend follow-up is active in `ctx_49162242887c`, handoff `msg_dcede193bb3f`.
The author asked about the Canvas lookup in `msg_c42a7ea76b45`.
The Lead confirmed the existing-contract interpretation in `msg_742788eff0bb`: retain one profile-qualified S2 lookup.
A successful empty result after conflict is not adoptable and returns `409 PLATFORM_IN_USE` after local cancellation and lease checks.
It makes no extra lookup. Network errors, timeouts and GET-by-id `404` keep the specified `502` mapping.
The independent re-review must assess this interpretation and its tests; no normative contract was edited.

Canvas QA completed M2 in `msg_43f19e48bd65`: **35 PASS, 29 FAIL**, zero skips or retries.
Evidence: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-eb43247-21t8wgiv/source/tests/host/artifacts/qa-e2e-sim-r1-eb43247d-2026-10-20T12-34-50-805Z/summary.json`.
The Lead read the summary. Teardown and isolation pass: zero containers remain and all seven baseline volumes are preserved.
The run's secret scan passed with zero hits across 49 files for its one captured value.
QA traces 28 failures to the operator-command working directory in `tests/host/m1-control.mjs`.
The other failure is M2-04.rows: Copy clicks can scroll the page between viewport position measurements.
Messages `msg_22c0e428098e` and `msg_d8dc5181f08c` assign these repairs to their existing owners.
Common QA must prove both app and LTI operator commands on the next frozen stack.
Canvas QA must retain every row value, Copy and clipboard assertion while measuring order before clicks.
No stack window is active. T7 and full M1 remain held until the new freeze and explicit window assignment.

The common capture interface is confirmed in `msg_6717ae0ed480` and reply `msg_0c57ab9062a3`.
`watchAll(action = "pass", faults: Json[] = [])` preserves specific fault precedence and returns its cursor after arming.
It appends capture for all seven methods. Later resets or raw rule replacement require re-arming.
Canvas QA may use this interface in its older race cases and held-S3 windows; common QA owns the helper and its checks.

Two bounded re-review tasks are queued: Reviewer-A `task_e0177b2e9a56` and Reviewer-B `task_485802b55bbd`.
They depend on the backend repair and also require a Lead handoff with committed harness repairs and one frozen SHA.
The same independent reviewers own their existing reports; the team brief extends Reviewer-A's replacement role to this follow-up.
Their new reports remain blind until each submits. The three-worker limit still applies.

### Repaired candidate and partial runtime gate

The Lead committed common QA's eleven held paths as `41ee174ddcd4cd5c925b09d7c57ef9f8ceaa03b9`.
All nine source hashes matched its preparation record; both reports preserve their prior history.
This includes the actual-gate capture checks, the CLI working-directory repair and the exact T2/T3 evidence.
Canvas QA's nine held paths followed as `feb36b112edd4173094e0ba3d38ccfc0a549fb35`.
Its three test files repair race capture and the scrolling assertion. Its reports preserve the failed M2 run.
The new live matrix records all 32 normative rows as UNVERIFIED.

Backend `task_bfa884e18169` completed in `msg_4052d2ce8047`; its dedicated replacement remains retained.
The Lead matched all six file hashes and committed them as `ae130a3501f3a2502c6a34e36319629e3dcdfb09`.
The author's regressions failed on the original defects, then 197 focused tests passed.
Its full check passed lint, typechecks and 1,032 tests in 69 files, with real fixtures and zero skips.
Report: `/tmp/cogniate-m1-round3-backend-report.md`; manifest: `/tmp/cogniate-m1-round3-backend-sha256.json`.
No schema, contract, Canvas-owned product module or infrastructure file changed.

**Product and test freeze: `ae130a3501f3a2502c6a34e36319629e3dcdfb09`.**
The Lead repeated `npm run check` in its clean detached clone with real fixtures: the same 1,032 tests pass.
Lint and all typechecks pass; tracked state stays clean.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.round3-check.log`.
Reviewer-A re-review is active in `ctx_2b5524d3ba70`, handoff `msg_2f4880834051`.
Reviewer-B's task remains queued for the next free worker slot.

Common QA prepared an external command that selects 14 existing cases without changing any acceptance test.
The Lead accepted only that partial scope in `msg_80300bbaa998`, then granted its exclusive window in `msg_6b9fc22e8767`.
The command is `/Users/quangnguyen/cogniate-qa-runs/m3-repair-20261020T1243Z/preflight-smoke.mjs`.
Its hash is `c231c34f084fb010351b28da3d24ed06ad6fd6c6c80cc908c9f10bed5a1f56d8`.
It uses a fresh clone of the frozen SHA on port 8443, subnet `172.29.0.0/16`.
It checks both real operator CLIs, representative refusal/readiness/restart capture paths, health, secrets and cleanup.
Every result is PARTIAL SIM; none fills either complete-run inventory. No standalone upgrade preflight is authorized.
After cleanup, common QA holds the next stack until Lead assigns it.
Canvas QA remains active but held under reply `msg_5cc6a0b12d41`; its next window is separate.

The partial preflight completed in `msg_1171f1c48e06`: all 14 selected cases PASS, no selected skip or retry.
Run: `qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z`; exact candidate `ae130a3`.
Artifacts: `/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z`.
The Lead read its summary: all selected outcomes, isolation and teardown pass.
The 152 unselected observations remain excluded. This is not either complete M1 run.
Real CLI controls pass: app grant has 39 expected zero exits and four expected refusals; LTI has one success and one expected conflict.
QA captured acceptance and default health, ten image identities, and the approved command hash.
Its final scan found no matches for 15 captured values in eight raw service logs and 98 public files.
Cleanup at 12:58:30 UTC preserved all seven baseline volume metadata records and left no containers or owned networks.
The Lead independently confirmed zero containers.

Message `msg_499d8986cf43` now gives Canvas QA the exclusive window for all 64 M2 cases at the same frozen SHA.
This run may proceed in parallel with source re-review; it implies no release approval.
If M2 passes and cleans up, Canvas QA may start the three default-profile T7 runs plus demo/confirmation.
If M2 fails, it must preserve evidence, clean up, and hold T7. Any new review blocker can hold the next stage.
Common QA received `msg_a08a92654c63` and holds its next stack while it records the partial evidence.

Canvas QA started all 64 cases in `qa-e2e-sim-r2-ae130a35-2026-10-20T13-02-19-726Z`.
Its external root is `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-ae130a3-s73h9dlx`.
Fresh guards confirmed zero containers, free assigned ports and subnets, exact course hashes, and seven unchanged baseline volume records.

Reviewer-A status `msg_55731d8888b8` identifies a new MAJOR A-M3-02 in older Blackboard harness paths.
The one-shot hold in `50-races.test.ts` can expire before a zero-call observation; `30-grants.test.ts` omits three HTTP methods.
The 14 selected preflight cases do not cover these gaps.
Lead message `msg_f6e04e3b6c65` assigns common QA a bounded repair and audit of the remaining owned no-call assertions.
This work has no stack authority and does not change the external frozen M2/T7 clones.
Reviewer-A completes its current frozen review before reviewing any later repair.
Full M1 remains held until the repair is committed, independently reviewed, and frozen for both complete runs.

Reviewer-A settled `task_e0177b2e9a56` successfully in `msg_4e9c1935f050`.
Its three reports are committed at `76ac36cf479be7c4b0f79878ca892e2817ef04de`.
M1 and the bounded M2 source corrections are APPROVE; A-M1-03/04/05/06 and the original A-M3-01 locations are closed.
M3 remains CHANGES_REQUESTED for A-M3-02. Its independent checks include 207 focused product tests and 20 grouped engine probes.
The same reviewer stays retained for a later bounded repair review; its current dispatch has settled.

The complete M2 rerun finished in `msg_dde9a4b82cc9`: **61 PASS / 3 FAIL**, zero skips or retries.
Both `M2-12` learner-frame cases time out after reaching the player/content frames.
`M2-13.no-stale-values` sees Canvas values on the Blackboard route during same-document navigation.
QA also found missed runtime capability URLs in failed-frame diagnostics. The earlier zero-hit scan is not complete privacy evidence.
The bundle stays local and restricted until QA sanitizes the missed values and repairs capture; messages and reports must not contain those values.
Cleanup at 13:06:07 UTC confirms zero containers, seven unchanged baseline volume records and no owned runner.
The Lead independently confirmed zero containers. T7 remains HOLD and no new stack window is assigned.

The existing Canvas/shared portal author now owns bounded repair task `task_6082e04b612c`, dispatch `ctx_80cd0ede9eba`.
Its clean tracked portal branch was fast-forwarded to exact `ae130a3`; its original portal/player ownership still applies.
It diagnoses route-state isolation and the learner-frame symptoms, then fixes reproducible owned product defects with regression checks.
Canvas QA independently isolates harness causes and fixes its owned diagnostic redaction paths.
Common QA continues the separate A-M3-02 capture repair without a stack.
These are the three active workers; Reviewer-B stays queued until a slot and the committed repair candidate are ready.
No full acceptance, final conformance, guide completion, push or main merge is implied.

Human review flag under the charter's Round 3 rule: A-M3-02 is a newly found MAJOR in older test paths.
It remains an explicit blocker, not an accepted deferral. Its report and eventual correction must appear in the human review history.
The bounded repair addresses this new finding; it does not erase Round 3 or reopen the closed original locations.

The portal author reproduced a build defect at `ae130a3`: player entry files import a generated shared chunk that the existing asset routes cannot serve.
QA's retained learner-window logs corroborate script 404s and show no runtime state request.
The author fixes the independent-entry build within `apps/player/**`; the existing security routes and course assertions stay unchanged.
The route failure still requires source reproduction: QA observed a history/DOM mismatch but did not prove late response repopulation.

Canvas QA traced the diagnostic gap to direct `doCourse` use without request-time token capture.
It repairs its own browser capture and timeout diagnostics. Lead message `msg_64f4c9d8cff5` assigns common QA the shared recorder type extension for `play_id` and `picker_id`.
Both owners retain one private recorder and hold their disjoint paths for Lead commit. These checks do not start a stack.

The common QA repair is committed at `832f8c8ac437c7fd93425d7152f865a8ffb13eaa`; all six held hashes and evidence hashes matched.
Its 33 harness self-checks pass, and both new caller checks fail against the old callers as expected.
The Canvas diagnostic repair and complete failed-run reports are committed at `7ddff36ccc58ebc9218c7e1bca646f28067c891b`.
All 12 held hashes matched. M2 retains its exact 64 cases, and Canvas grant purpose/order assertions remain unchanged.
Five M2 self-checks and typecheck pass; the full browser privacy gate still needs a new run.

The owner explicitly requested resuming the original Claude sessions after quota.
The Lead confirmed their original launch records: `claude-opus-5-5`, `xhigh`, and the same retained session handles.
Message `msg_02529042bb5a` requests a safe continuation handoff from the Codex Canvas QA replacement.
Its unfinished verification must be transferred through settlement and a new dispatch, with no overlapping editor or stack.
Original Claude backend Author reconciliation is queued as `task_4db65c194479`; its earlier repair is already complete.
Original Claude Reviewer-A will own `task_016398b7ed4e` after the author task and final freeze, as the team brief now records.
The user request restores original Claude roles; it does not invalidate committed Codex results or bypass remaining QA/review gates.

The three original Claude sessions have now responded successfully:

- Backend Author completed read-only reconciliation `task_4db65c194479` / `ctx_357068c33d19` in `msg_eb1a996c3a98`. No quota error remains; no edits were made. It stays retained for future author work.
- Codex Canvas QA settled `ctx_8ec51c3aa7b5` as incomplete for the owner-requested transfer in `msg_89b84214a011`. Its durable handoff is `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-ae130a3-s73h9dlx/continuation-claude-canvas.md`. The same unfinished task was reopened for original Claude under `ctx_4a94125660be`; response `msg_2e87a3eb6709` confirms the handoff and scope.
- Original Claude Reviewer-A resumed `task_016398b7ed4e` / `ctx_7e250abb1487` in `msg_28aec45e66bf`, with blind independent review and only its three report paths.

The portal author settled `task_6082e04b612c` successfully in `msg_cd9911c9481b`.
Lead read the six-path repair and report and matched the source and patch hashes.
Author branch commit `4b3edd54a24c9ca1f793dc1a9976e19ee2841001` is integrated as **`e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63`**.
This is the new frozen product and test SHA, including both committed harness repairs.
The build now ships independent runtime/shell scripts. The portal uses the existing router option to commit route changes without a deferred transition.
Six history/selector/link controls preserve request cancellation. Watch-build checks preserve the other player entry and CSS.
Author checks pass 91 focused tests and the root check; Lead separately ran a clean isolated exact-SHA check.
Lead result: lint, all typechecks, **1,039 tests in 70 files, zero skips**, clean detached clone.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.runtime-check.log`.

Lead message `msg_88bc0ba11c4c` grants original Claude Canvas QA the exclusive all-64 M2 window at `e3cd7db`.
All identity, complete health, browser/image, runner heartbeat, captured-secret scan and cleanup requirements apply.
Only if M2 passes and cleanup completes may the same owner run three default T7 passes plus demo and confirmation at the same SHA.
A failed M2 run or a new source blocker holds the next stage. Common QA has no stack authority yet.
The active workers are common QA, original Claude Canvas QA and original Claude Reviewer-A. Reviewer-B stays queued.

### Third M2 run and bounded readiness repair

Original Claude Canvas QA reports the full `e3cd7db` run in `msg_523fd7d86744`: **60 PASS / 4 FAIL**, zero skips or retries.
Run: `qa-e2e-sim-r3-e3cd7dbc-2026-10-20T13-35-07-428Z`.
The unchanged `M2-13.no-stale-values` observer now passes.
Three failing cases read the publish options before asynchronous loading finishes.
The fourth starts its keyboard Tab sequence before the Blackboard form renders.
Both `M2-12` cases stop before launch, so neither the player repair nor automatic runtime/play capability capture is verified.
QA reports zero captured-secret hits and clean teardown, with all seven complete baseline volume records unchanged.
The Lead independently observed zero containers. The previous stack window is closed; T7 remains HOLD.

Lead reply `msg_3590cf55633f` authorizes a bounded QA repair in four M2 case files.
It adds retrying readiness assertions before option snapshots and before initial keyboard navigation.
All case IDs, positive and negative checks, keyboard-only input and existing assertions must remain.
QA must run harness checks, typecheck and unchanged inventory checks, and demonstrate delayed-render and missing-target controls in private scratch.
It holds exact paths and hashes for Lead commit. No product edits or stack run are authorized by this repair.
The next full run requires a new committed product/test freeze and explicit exclusive window.
Common QA stays held; Reviewer-A continues the exact `e3cd7db` source review with these runtime limits.

### Final harness freeze after restored Claude review

Original Claude Reviewer-A settled `task_016398b7ed4e` in `msg_686ccbdfc290`.
Its three reports are committed at `e07e3cdae57c60589b9fd44f2a384fcf26a4f085`.
M1, M2 and M3 source verdicts are APPROVE at `e3cd7db`; A-M3-02 is independently closed.
The review preserves the failed browser runs and all pending execution gates.
Two new MINOR findings concern evidence: A-M3-03 misses the Deep Linking response JWT in request-time capture; A-M3-04 prints full capability URLs in a legacy timeout.
The Lead routed both to their QA owners before the next freeze.

Common QA's two held paths are committed at `504421b123e7a8265d5453761b1341c69c766c6f`.
The legacy timeout now uses the existing safe URL formatter.
Its exact-function control found 14 synthetic values in the old output and none in the repaired output, with matching and timing controls unchanged.
All 33 M1 harness checks, typecheck and 416-row discovery pass.
The Lead matched both source hashes, three artifact hashes and the shared helper dependency hash.

Canvas QA's nine held paths are committed at **`004568bd4ab8390d64945cb73f16cfdd51d566bf`**.
The four readiness fixes retain all assertions, case IDs and timeouts.
The same private recorder now captures the response form field `JWT` as `id_token`.
QA reports six M2 self-checks, typecheck, all 64 cases and 19 synthetic browser controls, including expected failures for missing options and inaccessible fields.
The old capture module fails the new response-JWT control.
The Lead read the scoped diff and reports, matched all nine file hashes and the patch hash, and checked the patch in reverse.
The tracked tree is clean. Product/build files are identical to the clean-checked `e3cd7db`, so the root check is not repeated.

**The frozen product and test SHA is `004568bd4ab8390d64945cb73f16cfdd51d566bf`.**
Lead message `msg_b6726e8da143` grants original Claude Canvas QA the exclusive full M2 window.
Its response `msg_2fcdbdd4484f` confirms fresh clones, exact harness checks, full baseline checks and the external observer.
The run must privately confirm captured Deep Linking, play and runtime values for each provider and report coverage counts only.
Only an all-64 PASS, complete privacy evidence and clean teardown permit three default T7 runs plus demo and confirmation at the same SHA.
Common QA stays held for full M1 and legacy. No other stack is authorized.

Original Codex Reviewer-B is active in `task_485802b55bbd` / `ctx_900018cdc4f7`.
Its handoff `msg_c61b25991fd2` adds the final seven source paths while keeping it blind to the new A reports.
Original Claude Reviewer-A's bounded final harness review is ready as `task_69b4e5e2f147` for the next free worker slot.
The three-worker limit, independent review, retained failure history and live-provider limits still apply.

### Complete M2 PASS and Claude-only continuation

Original Claude Canvas QA reports **64/64 PASS** at `004568b` in `msg_3835fc45edc0`.
Run: `qa-e2e-sim-r4-004568bd-2026-10-20T13-56-30-961Z`; one result per case, no skips, retries or flaky cases.
Both providers pass the real HTML teacher pick, learner completion and score-sent flow.
The runner scan reports 74 values over 63 files with zero hits; the independent scan reports 68 values over 80 files with zero hits.
Private coverage includes each provider's Deep Linking response JWT, resource-link ID token, play IDs and runtime tokens, plus picker IDs.
The after-check at 14:00:03 UTC reports zero containers, all seven full volume records and baseline networks unchanged, no runner, and unchanged Docker memory/CPU.
These are SIM results, not live LMS proof.
Under the existing conditional authorization, Claude QA started three default T7 runs plus demo and confirmation on the same frozen SHA.

Codex Reviewer-B settled its source review in `msg_dd51db5abaaa` with APPROVE through `004568b`.
Its three held reports are committed at `00f1717eed4ed591a1b48e67bb52eeffb969abdd`.
The review preserves historical failures and claims no runtime gate.
Original Claude Reviewer-A now runs the bounded final harness task `task_69b4e5e2f147` in `ctx_458a1f109271`.
Its handoff includes only attributed QA runtime evidence and keeps it blind to B's new conclusions.

The owner now requires Claude Code Opus 5.5 xhigh for all remaining work.
The [team brief](multi-lms-team-brief.md#owner-requested-claude-only-remaining-work-2026-10-20) supersedes the earlier mixed-model assignments and fallback exceptions.
Reviewer-B had already settled when the transfer request arrived; no further Codex review is assigned.
Lead message `msg_5f746bedb9c8` requests common QA's durable handoff and incomplete-task settlement.
A fresh independent Claude QA session will continue the same unfinished verification after that handoff.
Original Claude Canvas QA keeps its task and stack window without interruption.
All new implementation, QA, review and documentation assignments use Claude; completed Codex work retains its true attribution.

### Claude QA transfer and first T7 result

Original Claude A completed the final seven-file review in `msg_f2265f99ece5`.
Its reports are committed at `601386f05061baef3a09716ab5921052bf5ebda2`.
A-M3-03 and A-M3-04 are closed; source reviews are clear through `004568b`.

Outgoing common QA settled its unfinished task for the owner-requested transfer in `msg_d7ff40f4e6a8`.
The Lead verified its three-file handoff index, 11 owned file hashes and clean prepared source.
The same task now runs in a fresh independent Claude session, dispatch `ctx_8d5f8d3984d0`.
Its launch receipt confirms requested and effective `claude-opus-5-5`, `xhigh`.
The continuation handoff is `/Users/quangnguyen/cogniate-qa-runs/common-blackboard-claude-handoff-20261020T1405Z/continuation.md`.
Lead message `msg_08de99358b99` updates the record with final reviews and the current window.
The new QA acknowledged and confirmed the actual full runner has no `--runs` option; default full runs both inventories and then legacy.

Original Claude Canvas QA reports the first T7 sequence in `msg_019380277074`.
Run: `qa-e2e-m3-r1-004568bd-2026-10-20T14-00-53-214Z`.
Each of three default runs has **8 PASS / 9 FAIL / 1 intentional demo-only SKIP**.
The test helper `publishCourse` reads asynchronously loaded connection options once; the A3 failure blocks dependent scenarios.
The four confirmation/refusal controls and the separate demo pass succeed.
Default health has no knobs or simulation profiles. The independent scan reports zero hits over 103 shared text files.
Cleanup at 14:08:57 UTC reports zero containers, all seven full volume records and baseline networks unchanged, no runner and free ports.
The Lead independently confirmed zero containers. The window is closed.

Lead reply `msg_859204e81d48` authorizes only a bounded readiness wait in `tests/e2e/lib/portal.ts` at `publishCourse`, plus owned QA reports.
The exact Moodle option match, missing-option failure, selection, publication and downstream assertions must remain.
No latent helper change, retry, sleep, skip or timeout increase is authorized.
QA must hold the repair with hashes and meaningful delayed/missing/wrong-option controls for commit.
Two Claude-only source reviews are ready: A `task_ab8f85ebf8b7`, B `task_a5f2e5cfc0c2`.
The next single frozen revision needs a fresh complete M2 run and T7 sequence before common QA receives the clean exclusive window.
The completed M2 PASS at `004568b` remains recorded; full M1 and final-SHA legacy are still NOT RUN.

### T7 helper repair frozen at `aff4882`

The Lead matched the four held file hashes and the patch hash from `msg_de6820a7a075`.
The patch reverse check passed. Exact-path commit `aff48823a4c6206d6314d91a95f5eb0979d3e0e7` is the new frozen product/test SHA.
The only test source delta from `004568b` is three lines in `tests/e2e/lib/portal.ts`.
Product and build sources remain identical to the clean checked `e3cd7db` revision.
QA's six exact-source controls detect the old delayed-option failure, accept the repaired valid option, and reject missing, wrong-host, wrong-name and missing-publication outcomes.
Harness checks, typecheck, the 64-case M2 inventory and the 18-test T7 inventory pass.
These controls are not runtime acceptance.

Fresh independent Claude Reviewer-B now owns `task_a5f2e5cfc0c2`, dispatch `ctx_a7d1b1515df2`.
Its launch receipt confirms requested and effective `claude-opus-5-5`, `xhigh`.
The Lead supplied the exact source and one-file scope in `msg_97bd6afbe05e` and `msg_1df61b8626bb`.
Original Claude A's independent supplement stays queued within the three-worker limit.

Message `msg_cd92688894e5` opens the exclusive Canvas QA window for fresh full M2, then conditional three default T7 runs plus demo and confirmation at `aff4882`.
QA confirmed the exact clean preflight and started `qa-e2e-sim-r5` in `msg_27036d47b24b`.
Evidence root: `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-aff4882-eFk7FU4s`.
Common QA may prepare the new source read-only under `msg_41e9d3df3523`; all its stack actions remain held.
Both source supplements and complete runtime gates are required before the full M1 handback.

### `aff4882` M2 result and observer incident

QA reports all 64 M2 cases PASS, without skips, retries or flaky results, in `msg_4e94792776cf`.
Run: `qa-e2e-sim-r5-aff48823-2026-10-20T14-19-46-505Z`.
Both HTML teacher/learner flows and the per-provider capability capture completed.
The runner scan found zero hits. Cleanup restored the full baseline.

The separate external observer crashed when a container vanished between enumeration and inspection.
Its local stdout log received four occurrences of two disposable stack secrets from a child-process error.
QA moved the original to a private mode-0600 file, sanitized the working copy and rescanned it.
The secrets were not sent, committed or copied to shared artifacts.
This is an observer privacy FAIL/incident with containment, not a pristine privacy PASS.
The final 40 seconds of redundant progress observations are absent; the complete Playwright results remain available.
The Lead accepts the functional M2 result without another product run and preserves the incident as a separate outcome.

Message `msg_987f8e232e3b` requires actual observer controls and a clean baseline before T7.
The old observer leaks the planted test payload; the replacement suppresses it, tolerates the vanished container and records the survivor.
An unexpected parse error also withholds the payload.
The Lead read `observer-control/results.json`; these controls use the exact pinned observer source.
QA confirmed the sanitized log hash, private permissions and clean boundary in `msg_ee28235a411d`.
T7 now runs as `qa-e2e-m3-r2` at the unchanged `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`.
Common QA received the concrete observer failure mode in `msg_e8cce2bcc584` and remains held.

### Both Claude source supplements complete

Fresh Claude B approved the one-file repair in `msg_95fbb6b9dcc9`.
Its held report hash matched, and the Lead committed it at `16dc0f4887c37e97fb7a0dc74d59d8e8ab3043bf`.
B-M3-05 is a nonblocking NIT about a duplicate RegExp escape helper. It does not require a new freeze.
Original Claude A independently approved the same repair in `msg_7f53a1a43e3f`.
Its held report hash matched, and the Lead committed it at `c5513f67977be91e36b894622c16c28f80f5a096`.
Both reviewers stayed blind to the other's new supplement. Both instances are retained for their later roles.
There is no open BLOCKER, MAJOR or MINOR; A-M1-02 remains the earlier accepted NIT.
Source approval does not replace runtime acceptance. The frozen product/test SHA remains `aff4882`.

Common QA also found the same child-process error risk in its external observer before running a stack.
It fixed that evidence tool outside the frozen source and reports eight focused controls PASS in `msg_a31fa13c2266`.
Its prior zero-container observations exposed no values. The full seven-volume baseline comparison is retained.
Message `msg_408fa2b08984` records both completed source gates and continues the common-QA stack HOLD pending T7 and cleanup.

### T7 PASS and full M1 handback

Message `msg_35533422f9a4` records T7 PASS at the unchanged `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`.
Run: `qa-e2e-m3-r2-aff48823-2026-10-20T14-27-17-341Z`.
Each of three default runs has 17 PASS, zero FAIL and the single intentional demo-only skip.
The separate demo and all four confirmation/refusal controls pass. Runner exit is zero.
The pinned observer has no error. All four lifecycle health snapshots show default profile, empty knobs and no simulation profiles or services.
The independent scan covers 153 values and 128 shared files with zero hits.
QA reports exact cleanup at 14:38:28 UTC.
The Lead independently confirmed zero containers, the seven full volume metadata records, baseline networks and unchanged Docker settings.
All three held QA report hashes and the patch reverse check matched; commit `02b62da82526193b752f3da3b3fa2a2a8da2c773` records the results.

Lead message `msg_d26c1a003c73` gives the sole stack window to fresh Claude common QA for the complete M1 entry and all legacy wrappers.
No source, overlay or subset change is allowed. The runner executes both 416-row inventories, all four phases and the required migrations, then legacy.
QA confirmed startup at 14:42:33 UTC in `msg_ac023ab65343`.
Run root: `/Users/quangnguyen/cogniate-qa-runs/m1-full-aff4882-20261020T1442Z`.
Source: `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aff4882-20261020T1420Z/source`.
The actual command, pinned observer hashes and full clean preflight are in the run's `public/` evidence folder.
Canvas QA has no stack authority. It will independently judge all 233 Canvas rows from each complete round.
Its read-only local Canvas feasibility assessment proposes no startup under the current stack and runtime-configuration limits.
All 32 live rows stay UNVERIFIED. No live result is inferred from SIM or Moodle.

### First full M1 attempt: test failures and bounded repair

Common QA reports the first SIM phase failed at `aff4882` in `msg_94ad439dfad6`.
The parent command exited 1 at 15:05:04 UTC after 394 rows: 385 PASS and 9 FAIL.
Common has 24 PASS and 2 FAIL; Blackboard has 132 PASS and 4 FAIL; Canvas has 229 PASS and 3 FAIL.
The SIM selection has 232 Canvas rows. The remaining Canvas row belongs to the isolated phase.
Round 1 isolated, upgrade and migration phases, all of round 2, and all final legacy suites did not run.
This attempt gives no full M1 acceptance credit.

QA identified six common/Blackboard test defects against the unchanged contracts:
two assertions used an app-only error field on an LTI error;
the query escape case had no claim query parameter to change;
the course-shell refusal used a malformed body and an unknown course;
and two profile cases did not pass the documented restart overrides.
The Lead checked the relevant contract clauses and authorized five owned test/harness files in `msg_da9a87e79584`.
Repairs must preserve negative assertions, valid positive controls, no-call checks and publication immutability.
QA will supply harness controls, typecheck, the full 416-row inventory and a held patch before any new freeze.
Canvas QA received its three failures for independent classification in `msg_8383137868da`.
The unexpected repeated-redemption audit event remains unclassified.
No product change or partial product rerun is authorized by these messages.

The sole stack window is closed.
The Lead read the exit, boundary and scan reports in the run root's `public/` folder.
QA reports zero containers or owned leftovers, seven unchanged full volume metadata records, and unchanged VM settings.
The independent scan covers 1,299 captured values, nine raw logs and 669 public files, with zero secret or JWT hits.
The failed evidence remains intact. Final conformance and Docs remain gated on accepted verification.

### M1 test repair frozen at `8138097`

Canvas QA independently classified its three failures in `msg_cd40cdf48b25`.
The query and course-shell cases used invalid test expectations or inputs.
The repeat case counted the first successful redemption because it shared the test cursor's millisecond timestamp.
The two repeats returned 200 without a new attempt, redemption or outbound call.
The Lead authorized two Canvas test files in `msg_f981848032b1`.
The replacement uses connection-scoped log-line counts after same-trace completion barriers.
Synthetic controls detect later redemption and attempt events, including timestamp ties.

Common QA's bounded repair required one extra inert dependency entry in the existing capture self-check.
Lead reply `msg_729bb2941b68` authorized that single-file addition.
Strict dependency rejection and all seven method checks remain unchanged.
Held reports are `msg_88953580aaf0` (Canvas) and `msg_caddad575dc9` (common/Blackboard).
The Lead read both diffs and controls, matched all held hashes, and checked both patches in reverse.
Exact-path commit `8138097889f87359d5055bb1d79766b5ed842f92` contains eight test/harness files and three QA reports.
Product and build files remain unchanged from `aff4882`.

Common QA prepared a clean detached clone at `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-8138097-20261020T1524Z/source`.
The combined harness passes 34 self-checks, typecheck and the unchanged 416-row inventory.
The Lead checked the 15 pinned source hashes, eight observer hashes and harness-log hash.
Source provenance SHA-256: `c51d4a6af55fecf0731aa37fef657642c73636291f0e5e32fdcafd8a690f3162`.
This is preparation only; no new stack window is open.

Both independent source supplements use the same frozen candidate:

| Reviewer | Task | Dispatch |
| --- | --- | --- |
| Original Claude Reviewer-A | `task_2cd49d67d152` | `ctx_d8273aa97f78` |
| Dedicated Claude Reviewer-B | `task_4f1a9a5431eb` | `ctx_eaafeee64212` |

Both remain Claude Opus 5.5 at xhigh effort and keep blind review independence.
The two active QA tasks remain open. The next full run waits for both source verdicts and explicit stack handback.

### Both repair reviews approved; full run handback

Reviewer-A approves `8138097` in `msg_945c9463e27d`; report commit `914071d19ff187733421bb9008512fed68e11679`.
Reviewer-B independently approves in `msg_feaafbe8d45f`; report commit `5f61266fd659c10a636f578f62257ef0682ae5fc`.
Neither report has an open BLOCKER, MAJOR or MINOR. Both dedicated sessions are retained for M4.
The Lead accepts A-M3-05 as an optional NIT: a ready Canvas course version would remove a test dependency on validation order.

B-M3-06 requires an evidence note, not a source change.
The changed `m1HostControl` also reaches the M2 Canvas wizard and the M1 isolated `aa` case.
Reviewer-B ran the old and new handlers through the actual knob writer.
Both give the same effective acceptance/off and restored acceptance/on environments; the new restore removes the leftover override entry.
Its M2 harness passes six controls and the unchanged 64-case inventory. T7 does not use this control.
The Lead carries the M2 and T7 results at their actual `aff4882` SHA with this equivalence note.
They are not relabeled as new `8138097` runtime runs. This records the disposition of B-M3-06.

Before handback, the Lead and QA observed a between-run default bridge recreation.
Its old ID began `2f806bc1`; the new ID begins `0bf596e5`, created at 15:19:06 UTC.
This occurred after the failed run's 15:05 cleanup, during the no-stack hold. The cause is unknown.
Two fresh read-only boundaries confirm a stable new baseline: zero containers, unchanged VM settings and seven original volume records.
Host and none networks are unchanged; the bridge keeps the same driver and `172.17.0.0/16` subnet.
The old evidence stays intact. Each new run compares networks against its own start, and volumes against the original records.
Record: `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-8138097-20261020T1524Z/preflight/new-run-baseline.json`.

Lead `msg_a2aa04484762` opens the sole stack window to common QA at frozen `8138097889f87359d5055bb1d79766b5ed842f92`.
The complete entry must run both 416-row inventories, all four phases and both migration baselines, then every required legacy wrapper.
No source overlays, subsets or ad hoc reruns are permitted.
Canvas QA has no stack authority and will independently judge each complete round's 233 rows.
Final conformance and Docs still wait for accepted verification.

### Attempt 2 interrupted by host shutdown and reboot

Common QA started attempt 2 at 15:45:52 UTC on 2026-10-20 (`msg_587efecb0e7f`).
Run root: `/Users/quangnguyen/cogniate-qa-runs/m1-full-8138097-20261020T1545Z`.
Phase run: `qa-multi-r1-81380978-2026-10-20T15-45-52-377Z`.
All pre-start gates passed. The command used frozen `8138097` without source overlays.
The host later stopped; the last observed QA activity is at 15:57:19 UTC.
QA's 15:55 progress claim was corrected in `msg_b74fa5b0121a`: those two samples were identical.
Later logs did advance before the interruption. The correction and original evidence remain in the record.

After host boot at 20:04:55 UTC, QA reported the interruption in `msg_9dc9ec4e8bb7`.
The Lead independently confirmed the boot time, absent run processes and an unavailable Docker daemon.
There is no Vitest report or case result for this phase: zero rows are evaluated.
No phase completed. This is an interrupted attempt, not a test or product failure, and gives no acceptance credit.
The partial evidence stays intact. The stopped Docker VM's resource state needed inspection after restart.

Lead `msg_b465eb9ef8f0` authorizes recovery only, with no product rerun yet.
The Lead launched Docker Desktop with `open -a Docker`; no setting changed.
Docker became ready with version 29.8.2, 8,319,238,144 bytes and 12 CPUs, unchanged from before.
QA must inspect before cleanup, remove only resources positively labeled `qa-multi-r1`, and preserve all other resources.
It must compare all seven protected volume records to the original baseline and report restart or network differences.
No prune or shared-image removal is authorized. Attempt 3 requires a new clean clone, new run root and explicit handback.

### Recovery accepted; full attempt 3 authorized

Common QA returned the recovery evidence in `msg_331e88082c29`.
Nine owned containers restarted under their existing policies when Docker returned; the suite container did not restart.
QA saved their logs privately, then removed those containers, three owned volumes and one owned network by exact project label.
Post-cleanup and two stable boundaries show zero containers and no owned resources.
The Lead independently compared all seven full protected-volume metadata records to the original baseline; every record matches.
Port 8443 is free, and the subnet has no conflict. No owned runner remains.
The independent secret scan found zero hits in nine raw logs and 232 public files using 696 captured values and 12 stack secrets.

The engine restarted again at about 20:08:57 UTC, before cleanup.
Its version changed from 29.8.2 to 29.9.1. The default bridge was recreated at 20:08:18 and 20:08:57 UTC.
The host and none networks, memory allocation, CPU count, Compose and Node versions are unchanged.
The cause of the host interruption and engine version change is not attributed.
M2 and T7 retain their exact `aff4882` evidence on engine 29.8.2.
No environment-equivalence claim or new runtime credit is attached to them.

Lead `msg_ff5f23202f77` accepts 29.9.1 as the new environment baseline and opens the sole full-M1/legacy window.
Product and test SHA remain `8138097889f87359d5055bb1d79766b5ed842f92`.
New clean source: `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-8138097-a3-20261020T2011Z/source`.
Provenance SHA256: `df7e5f2d93e0eafa0f911f0ce50a67ea1dbcdd9c741950d271062a5c346cea71`.
All 15 recorded source hashes match; the tests tree remains `a6437598df46f49879478f9221b3bc1de885a9fd`.
The unchanged harness evidence and source approvals carry without repetition.
QA must record a fresh preflight and new run root, both complete 416-row rounds, and all legacy groups.
Canvas QA independently judges each complete round's 233 Canvas rows without another stack.
Attempts 1 and 2 remain separate failed and interrupted records. Final conformance and Docs still wait for accepted verification.

### Attempt 3 default-gate failure; bounded backend diagnosis

QA started attempt 3 at 20:15:15 UTC (`msg_12f46e8f1d9e`).
Run root: `/Users/quangnguyen/cogniate-qa-runs/m1-full-8138097-a3-20261020T2014Z`.
The Lead checked the exact command, provenance and pre-start boundary.
Setup and seed passed. The required default-profile `GET /api/providers` returned HTTP 500 before the suite started.
The runner exited 1 at 20:15:58 UTC. Zero suite rows were evaluated; this gives no acceptance credit.
QA reported an unclassified required failure in `msg_c0c19a2f8c70` and closed the window.
The same product and five service images passed this gate in attempt 1.

Docker Desktop's log records a pending update from 4.95.0 to 4.96.0 after the host reboot.
Attempt 3 used engine 29.9.1. The default bridge was recreated at 20:15:16 UTC, inside the window.
These are observed environment changes; they do not prove the cause of the HTTP 500.
Cleanup left zero containers and no owned resources. All seven original full volume metadata records match.
Thirteen stack secrets had zero hits in five raw logs and 42 public files.
No test values were captured, so the secret-scan acceptance gate has no passing result.

Lead `msg_4b16706de8b7` selects backend diagnosis. Both QA workers remain no-stack.
Task `task_b97d185ccfba`, dispatch `ctx_7496cc224976`, reuses the original Claude backend Author at Opus 5.5 xhigh.
It may reproduce the single endpoint in a fresh diagnostic clone of `8138097` and inspect the precise failing operation.
Its sole stack uses `cogniate-multi-author`, port 8743 and subnet `172.26.0.0/16`.
It may instrument only that disposable clone, record the diff and keep raw exceptions private.
It cannot edit tracked integration source, tests or docs, run acceptance suites, or change Docker settings.
Any proposed product repair needs a bounded file scope after the diagnosis.
The diagnostic must return its stack window with protected-volume and cleanup evidence before QA can resume.

### SQLite mount-lock diagnosis; independent confirmation and repair assessment

The backend Author completed `task_b97d185ccfba` in `msg_9842fa54a739` and returned its stack window.
The Lead accepted the diagnostic and retained the original session before acknowledging settlement.
Report: `/Users/quangnguyen/cogniate-author-diag/providers500-8138097-20261020T2022Z/public/AUTHOR-DIAGNOSTIC-report.md`.
SHA256: `f759561126bf17c70914fbcb114850f95662b838ffd1bc185f3a732e0ce075c3`.
This is AUTHOR-DIAGNOSTIC evidence, not independent acceptance.

The fresh default setup reproduced HTTP 500 twice.
The failing call is the bearer-authentication `tool_account` SELECT, which throws `SQLITE_CORRUPT` on the running service connection.
A fresh process reports database integrity `ok`. The on-disk database is intact in this experiment.
The seed's separate bootstrap process deletes the WAL and shared-memory files while the server still has the database open.
The lock probe permits a second writer while the first holds its transaction on both service data bind mounts.
It refuses that writer on the container's Linux writable layer. Both DELETE and WAL journal modes were checked.
The observed bind-mount filesystem is `fakeowner` on Docker Desktop 4.96.0 / engine 29.9.1.
Lock behavior on the earlier Docker version was not measured; the update is not proved causal.
Concurrent CLI and service writes need working storage locks. A restart after seed would not establish that precondition.

Temporary error instrumentation stayed in the disposable clone and was reverted.
No tracked integration file changed. The Author removed only its project resources and returned a clean lane.
The Lead compared both boundaries to all seven original full protected-volume records; every record matches.
Docker settings hashes, memory and CPU allocation are unchanged.
A VM cold boot and default bridge recreation occurred before the diagnostic stack started; their relation to locking is unknown.

Lead `msg_4b9a4e0703c7` opens one bounded independent QA filesystem diagnostic, with no application stack or acceptance credit.
It compares a fresh host bind mount, the container writable layer and a fresh project-labeled named volume.
Each DELETE/WAL probe must synchronize two processes and include a successful write after the first releases its lock.
QA alone owns that disposable container window. Canvas QA stays no-stack.

Architect task `task_a37d8fc8b8e3`, dispatch `ctx_2ff14edc1068`, assesses a small project-level storage repair in parallel.
The same Claude Opus 5.5 xhigh Architect may read only and produce an external proposal.
It must map existing-data preservation, coordinated backup/restore, old-build migrations, rollback and independent acceptance changes.
Named volumes and a fail-fast locking precondition are candidates, pending evidence and the impact map.
No tracked repair, Docker settings change, downgrade or acceptance rerun is authorized yet.

### Independent WAL diagnosis accepted; bounded storage design authorized

QA returned the diagnostic window in `msg_4b9ecd55cdfd` at 20:41 UTC.
The independent oracle found unsafe WAL locking on the bind mount and a lost test row.
Named volumes and the container writable layer enforced both DELETE and WAL locks.
Every held-lock check proved that process A stayed alive and in its transaction.
Every release-positive control then acquired its lock.
The bind-mount DELETE result differs: the Author observed failure, but QA observed correct locking. Its cause remains unknown.
The agreed finding is unsafe WAL locking on this host, not failure of every locking mode.
No evidence proves that the Docker update caused the defect.

Evidence root: `/Users/quangnguyen/cogniate-qa-runs/claude-sqlite-diag-20261020T2035Z`.
The Lead verified these artifact hashes and the raw six-case results:

| Artifact | SHA256 |
| --- | --- |
| `public/QA-SQLITE-LOCK-DIAGNOSTIC.md` | `ada5017363a0e757b3faaccc301c0e854fb95056bd6ec2928ab95c5060c62cb7` |
| `public/docker-oracle.json` | `d2c20c9f1ebdd4899b134c8e9a12de97362aaef9fa42f44418c836bffd26c204` |
| `hostdir/probe/oracle.mjs` | `c79a15f0edbcb9d8c11b92e1170d3159001be2fef9ea97c3339bf2126b37f570` |

QA removed only its labeled diagnostic container and volume. Zero containers remain.
All seven original protected-volume records match in full. Memory and CPU allocation are unchanged.
This evidence earns no acceptance credit. Attempt 3 remains a failed required host assertion, with zero suite rows run.

The default bridge changes now have an explanation from Docker's backend logs.
Docker stops its idle VM and answers read-only calls from its API cache.
The next mutating operation starts the VM and creates a new default bridge.
The recorded VM start times match every observed bridge recreation.
A later QA preflight must wake the VM with an owned, labeled, no-network disposable operation before recording its boundary.
This explains the earlier unknown bridge changes; it does not prove their relation to the storage fault.

The Architect completed its read-only assessment in `msg_fe35e9a47129`.
Proposal: `/Users/quangnguyen/cogniate-architect-diag/storage-recovery-task_a37d8fc8b8e3/STORAGE-RECOVERY-PROPOSAL.md`.
SHA256: `a0e497c2058a29f1c463358daf088cd6ea5370c8ba439d8ed5973d2784e05ff3`.
The Lead selected S1 for formal design: project-scoped volumes for SQLite state, existing content binds, and a fresh WAL lock precondition.
Task `task_f7bf1fb07035`, dispatch `ctx_5a9eec1ff0ab`, reuses the same Claude Architect.
It owns only the named architecture documents. It has no Docker, implementation or commit authority.

The Lead authorizes a bounded storage-only compatibility fixture for old revisions `b0b83a8` and `9f96f7b`.
This is an explicit exception to the earlier no-overlay rule, subject to independent design and implementation reviews.
The old tracked product source must remain unchanged; frozen hashes and effective-configuration comparisons must prove the fixture's narrow scope.
Every old-build result must name its storage fixture. No other overlay or assertion change is authorized.
Rollback must retain safe storage. It must not restore live use of the failing bind mount.
The Lead also authorizes the proposed AC-M1-41 storage criterion, with an honest inventory update after review.
No personal or protected baseline stack will be imported in this phase.

The formal contract must resolve every paired-restore interruption, including partial identity writes and failed rollback.
It must refuse ambiguous legacy state and preserve previous data until both restored targets pass validation.
It must state automatic-restart limits and use portable negative controls without claiming all bind mounts fail.
No implementation or acceptance rerun is open yet.
After the repair, both full M1 rounds, both migration routes, all legacy suites, M2 and three T7 runs must rerun.
Historical results remain at their true SHAs. All 32 live LMS rows remain UNVERIFIED.

Lead messages `msg_3a24ee1a3b97` and `msg_e39da706dc01` request honest closure of the current incomplete verification attempts.
The dedicated QA sessions will be reused for the new storage candidate. No Docker window is currently assigned.

Both current verification attempts are now settled as failed and incomplete, without changing any earlier result.
Canvas QA settled in `msg_80f61df03efb`; common QA settled in `msg_8057e686ca30`.
Both exact Claude sessions were retained before acknowledgment. Their reports are committed through `db20fbf`.
The Lead rechecked the preserved Canvas judge and control hashes.
No worker resource awaits cleanup. The Architect alone has an active task.

Three independent design checks wait for the frozen storage contract:

| Check | Task | Owned report |
| --- | --- | --- |
| Reviewer-A: correctness and data integrity | `task_e3cb869da7e7` | `docs/reviews/M0/storage-reviewer-a.md` |
| Reviewer-B: operability and test claims | `task_fe7b1645e3a0` | `docs/reviews/M0/storage-reviewer-b.md` |
| Common QA: design testability and acceptance map | `task_f86ec03635e4` | `docs/reviews/M0/storage-qa.md` |

They reuse the dedicated Claude Opus 5.5 xhigh sessions and stay blind to each other's new reports until submission.
Only these three workers may run beside the Lead after the Architect settles. None has a Docker window.

The Architect completed the contract in `msg_72ef02268228` and the bounded index and role corrections in `msg_0c50613ff3ba`.
Editorial task `task_01bc269cca8b` also corrected the diagnostic wording: A could not commit; no successful commit of A's row was proved.
The eight architecture files are held and ready for a review freeze. ADR-012 remains Proposed.
The Lead retained the Architect before acknowledgment. The next wave reviews this frozen design, with no implementation authority.

Storage design candidate: `6a5eb6a89b3ee6bb377f93244b00e6488e9e2314`.
The eight held architecture hashes matched before the exact-path commit; product and test files did not change.
All three independent checks started on this candidate:

| Check | Dispatch | Launch message |
| --- | --- | --- |
| Reviewer-A | `ctx_148e1d3f008a` | `msg_11211a21b840` |
| Reviewer-B | `ctx_2646adf72f56` | `msg_bf884f9a23ef` |
| Common QA | `ctx_cccf34f08216` | `msg_09af27bb77a6` |

Their starts are confirmed. Each report is independent; no verdict is available yet.
No author implementation or Docker run is authorized during this review wave.

Reviewer-A submitted `msg_5414a3ab98da`: CHANGES_REQUESTED at `6a5eb6a`.
Its held report is `docs/reviews/M0/storage-reviewer-a.md`, SHA256 `f5ceeebacb98146ffc85ecfcf00ad1d9d47ee5332494d86495d0c4b455150a13`.
The three MAJOR findings concern nested mountpoint ownership, missing recovery states, and backups of an inconsistent database pair.
The Lead accepted this review as completed work and retained the same reviewer before acknowledgment.
This does not approve the design. The other independent reports remain pending; no correction edits have started.

All three first storage-design reports are now submitted at `6a5eb6a`.
Common QA: `msg_c71a10d16a93`, FAIL for design testability, 13 MAJOR findings, six MINOR findings and two NITs.
Reviewer-B: `msg_00b816b96840`, CHANGES_REQUESTED, one BLOCKER, four MAJOR findings, seven MINOR findings and two NITs.
Their report hashes are `a1cba5040d7573e74a9e62fb015452426c3def2ac77ddc1ca4df9b6f0fa88c51` (QA) and `4f95cf7d2b3cebaf583f72edc6a6b30abad14bb5f69521049eaf283c18fecad2` (B).
The Lead checked every report and hash, and retained each exact session before acknowledging its settlement.
No BLOCKER or MAJOR is waived. The following groups define the bounded Architect correction scope:

| Correction | Findings |
| --- | --- |
| Create safe host content folders and volume mountpoints; define maintenance ownership; retain non-recursive handling | A-S-01, B-S-01/05, Q-S-03 |
| Complete and order startup and recovery states, including partial first starts, first journal writes, empty-target rollback and unresolved recovery | A-S-02, B-S-03/04/06/08, Q-S-01/02/10 |
| Refuse inconsistent backup pairs and legacy rollback journals; retain import provenance and define pair compatibility and content checks | A-S-03/07, B-S-09, Q-S-11/12/18 |
| Define safe restart refusal, serialize conflicting operations and make scratch cleanup recoverable | A-S-04, B-S-13, Q-S-13/17 |
| Make old-build procedures runnable; preserve the exact old product and candidate test trees; define temporary rollback limits and full fixture comparisons | A-S-05/06, B-S-02/07/10/14, Q-S-05/06/15/16 |
| Define independent QA volume access and the probe interface; enumerate added rows and phases; distinguish conditional applicability from PASS | Q-S-04/07/08/09/14/20/21 |
| State lane-volume ownership and fresh-lane checks; add the exact P5 storage-access exception with unchanged assertions | B-S-11/12, Q-S-19 |

QA's proposed 45-row addition is provisional, not an approved total. The corrected contract must enumerate the final list.
All existing 416 rows remain mandatory in each full round. Added old-schema import and recovery cases must have explicit outcomes.
The host-dependent negative may be inapplicable only with independent oracle evidence. It must never be counted as a PASS.
Recovery drills must distinguish the previous and restored database pairs, including their identities; identical fixtures cannot prove rollback.
Old `test:acceptance` remains needed by the existing route. Its internal starts need an explicit coverage rule, not removal of existing tests.
The existing P5 fixture keeps its approved app-stop guard; the new access mechanism must not weaken its assertions.

One part of B-S-11 needs factual correction. The installed `docker system prune --help` and [Docker's command reference](https://docs.docker.com/reference/cli/docker/system/prune/) say `--volumes` prunes anonymous volumes.
Do not claim this flag removes the new named volumes. [Docker's volume reference](https://docs.docker.com/reference/cli/docker/volume/prune/) assigns named-volume pruning to `docker volume prune --all`.
No prune command was run; the Lead used CLI help and read the official documentation.
The project-name reuse concern and the need for scoped cleanup remain valid.

The reports and correction scope are committed at `2bb918f550f165f535aa89c4ac4993f9fbac5067`.
Architect correction task `task_05303c6abd7a`, dispatch `ctx_7fe65ac312a1`, reuses the original Claude session.
Launch `msg_f81a5b8e411e` grants only the eight architecture paths and an ID-by-ID response document.
Its start is confirmed in `msg_d3f488ff5f6c`. It has no Docker or implementation authority.

Author diagnostic task `task_b5db7037a739`, dispatch `ctx_f2d87fba253c`, runs in parallel (`msg_218a267dbbdc`).
It alone owns a bounded Docker window for synthetic mount, ownership, fsync and minimal Compose checks.
It uses the existing pinned Node image, no network or ports, at most two fresh diagnostic volumes and one running container.
It may make one labeled disposable wake operation before the fresh boundary to avoid Docker's idle API cache.
It cannot edit tracked files, run a product stack, pull images, change settings or import any existing database.
It must return the window with zero owned resources and seven unchanged original protected-volume records.
The Architect receives measured facts through the Lead; this diagnostic earns no acceptance credit.

The diagnostic completed in `msg_2a11f7b555e8`; the worker is retained and the Docker window is returned.
The report is `/Users/quangnguyen/cogniate-author-diag/storage-feasibility-20261020T2119Z/public/AUTHOR-DIAGNOSTIC-storage-feasibility.md`.
Its SHA-256 is `32a07797786eac79ada89a07c472735f7fffb87cd13da7afc00ff6ccb18226ba`.
Fresh volume roots and covered nested mountpoints were root-owned `0755`; the service user could not write the root.
Exact `501:20` ownership and `0700` preparation worked across a second inspection and start.
File and directory fsync worked; renames within one volume worked. A rename across the bind boundary returned `EXDEV`.
The small Compose fixture passed target replacement, profile gating, one-shot execution and completed-service dependency checks.
These facts apply to the measured Docker Desktop host and synthetic fixture only.
Candidate and old product configurations, Linux hosts and SQLite locks were outside this diagnostic.
The Lead checked all 14 manifest hashes and compared both boundaries with the seven original full volume records.
Both boundaries had zero containers, no owned resources, and unchanged CPU and memory settings.
The Lead forwarded these measured facts to the Architect in `msg_253a2126df4c`.

Three independent Round 2 checks wait for this correction and its frozen commit.
Reviewer-A: `task_b9571fcd7912`; Reviewer-B: `task_5f05dfacb229`; common QA: `task_30e5c7f55481`.
Each returns to its original Claude Opus 5.5 xhigh session and appends to its own storage report.
They must not read another Round 2 report before submitting their own.
No implementation starts until both design reviews and QA testability pass.

The Architect submitted revision 2 in `msg_b724752eea63` and settled `task_05303c6abd7a` successfully.
Its nine held files include `docs/architecture/review-response-storage.md`; the Lead checked every held SHA-256.
The response hash is `78e6f1fb0940544f9b217ee9c7b27ec10df51bb036684862ad4ecfc36bb19188`.
The ADR-012 hash is `77e7167c1fc38ad0d23664916a90ac578ebe08444743e8529791021657951c5d`.
The worker is retained before acknowledgment. This settlement means the design correction is submitted, not independently approved.
Revision 2 proposes narrow folder preparation, ordered start states, complete recovery rules, operation serialization and a quarantine exit.
It defines old-build commands and test-tree provenance, with an ID-by-ID response to all three first reviews.
Its proposed inventory is 479 rows per round: all 416 existing rows plus 63 storage rows.
Only the host-negative storage row can report `NOT_APPLICABLE`, separately from PASS and with independent oracle evidence.
Both reviewers and common QA must recheck this inventory, the normative rules and every original finding.
All source, runtime, legacy, portal and Moodle verification gates remain required after implementation.

Revision 2 is frozen at `7a6374460dd02c3544b6dbf043086b0facefceb2`.
All three independent rechecks started on that commit, using the original Claude Opus 5.5 xhigh sessions.
Reviewer-A: `ctx_de1c69e93c96`, launch `msg_c7c56ac4da9b`, start `msg_e621c2528318`.
Reviewer-B: `ctx_b55641e6fd09`, launch `msg_c10e4c7727bf`, start `msg_ee123da56268`.
Common QA: `ctx_ab90749064c8`, launch `msg_50b5c5aac3c4`, start `msg_10e51644439d`.
Each owns only its storage review report. No Docker window is open.

Reviewer-A returned Round 2 in `msg_ded7d6fa7f90`: CHANGES_REQUESTED.
All eight original findings are closed; A-S-09 is a new MAJOR finding.
A dead host process does not prove that its maintenance container stopped writing.
The next revision must prevent lock reclamation and recovery while that writer remains active.
A-S-10 asks for a rollback order that preserves unknown in-place data; A-S-11 lists five precision fixes.
The held report hash is `1ba1ceb6abec579db1d46b2c115a22ab717fcf507f56bd215db7945dfd48c14a`.
The Lead checked the report and retained the worker before acknowledgment.
Reviewer-B and common QA continue independently; no new correction starts before their findings are combined.

Reviewer-B returned Round 2 in `msg_ec6594b9bb47`: CHANGES_REQUESTED.
All fourteen original findings are closed. Its model of the text passed 44 crash points; this is not runtime evidence.
B-S-15 is a new MAJOR finding: stopped service containers prevent the documented quarantine from removing their database volumes.
B-S-16 covers false-live lock ownership, checkout scope and the missing old-build lock helper.
B-S-17 to B-S-19 cover old-build preparation and privilege precision.
The held report hash is `16b857b032d430fa67fc1db4375cc25a8d8dea109616be1b6e06059f5d84a338`.
The Lead checked this hash and the model artifact hashes, then retained the worker before acknowledgment.
Common QA continues independently. No implementation gate has opened.

Common QA returned Round 2 in `msg_a4f89ac1d6ac`: FAIL for design testability, with five MAJOR and five MINOR findings.
The held report hash is `50b83fbdc6c50645be16c54e7ddf2b8c35e450cadae9e83325c2841c567a2194`.
The Lead checked the hash and unchanged Round 1 prefix, then retained the worker before acknowledgment.
QA confirms the 479-row inventory. Its required corrections concern the recovery oracle, lock scope, import credentials, fixture mounts and deterministic serialization tests.
No original assertion is waived. All three Round 2 reports are complete; no implementation or acceptance run is authorized yet.

### Storage design correction, Round 3

The Architect must resolve these groups together in the existing nine architecture files.
This is the third design review round under the charter; no open MAJOR finding is deferred.

| Group | Required result | Findings |
| --- | --- | --- |
| Operation ownership and scope | A dead host client cannot authorize another writer while its container lives. Define stale-owner identity, cleanup and refusal. Candidate suites lock their individual mutations without deadlocking internal starts or host-control restarts. Old-build wrappers remain available and qualified after checkout. State the one-checkout-per-project limit. | A-S-09, B-S-16, QA R2-02; A-S-11 (4) |
| Quarantine | After a verified copy, handle only the two exact stopped service containers. Refuse other volume users. Prove the documented stopped-container path works and preserves unrelated resources. | B-S-15; A-S-11 (3) |
| Recovery integrity | Move recognized after-files out before restoring before-files. Never overwrite unknown or colliding data. Verify the complete database file sets, including sidecar presence, size and hashes, and logical rows from stopped copies. Fixture generations must differ logically; every sidecar need not differ. | A-S-10, QA R2-01 |
| Import and fixture setup | Carry the full synthetic credential set for the old-schema oracle. Keep lane addresses and certificates distinct. Define narrow probe, scratch-bind and decoy mounts; selftest uses a lock-safe container layer. | QA R2-03, R2-04 |
| Deterministic checks | Give serialization tests an observable fixed order and exact outcomes. Add the live-maintenance-container refusal case, host-control restart coverage and changed counts. Keep all 416 original rows. | A-S-09, QA R2-02, R2-05 |
| Precision | State privilege for every write, restore target refusals, journal-first preparation, ordered legacy refusals, two-round conditional-row accounting and log event fields. Guard old host-control restart/profile actions. State enable-before-checkout and correct the old absolute knobs-path assumption. | A-S-11; B-S-17 to B-S-19; QA R2-06 to R2-10 |

Resolve small MINOR and NIT items in the same bounded correction; do not add optional infrastructure without a stated need.
Update the existing response document by appending Round 3 dispositions, with previous responses preserved.
The same two reviewers and common QA must recheck the next frozen revision.

The Round 2 reports and combined correction scope are committed at `584ab9efdcba1be2b5dfa1d0bc506d043f65ea72`.
The original Architect received correction task `task_5fc787769d03`, dispatch `ctx_b9e134a1565d`, in `msg_45081da0f6e8`.
It owns only the nine architecture files and has no Docker window.
The next recheck tasks depend on this correction: Reviewer-A `task_8e1e6a064266`, Reviewer-B `task_31dd99af646c`, common QA `task_0e99b6e5fb12`.
The Lead will supply the exact frozen candidate after the Architect holds the revised files.

The Architect submitted revision 3 in `msg_6f51306f5898` and settled `task_5fc787769d03` successfully.
The Lead checked all nine held SHA-256 values and retained the worker before acknowledgment.
ADR-012 hash: `e292b4e5b5983d6408fe67086b6d4190c63813941a44eafe2a6e12ec2f810761`.
Response hash: `b3e6b4143eaffaece129cda092fde99d8662e33b102514fd4e058695f4f00272`.
Revision 3 proposes container-aware operation ownership, scoped suite locks, a usable quarantine exit and checked rollback moves.
It specifies full file-set and logical-row recovery checks, credential transfer and exact fixture mounts.
The proposed inventory is 488 rows per round: all 416 original rows and 72 storage rows.
The nine added rows cover lock waiting, stale ownership, scope, reentry, three orphan-writer outcomes, quarantine users and restore targets.
The Lead's scope reminder `msg_f0221cbee8dd` kept recovery bounded; no new link protocol was added.
This is a submitted design correction, not independent approval. The three queued rechecks remain required.

Revision 3 is frozen at `b3bd22e2ada43f45499db5e50cfb4cafc8295fb9`.
All three rechecks were dispatched in parallel to the same Claude Opus 5.5 xhigh sessions.

| Check | Task | Dispatch | Launch |
| --- | --- | --- | --- |
| Reviewer-A | `task_8e1e6a064266` | `ctx_e2d9047f3655` | `msg_58268dcaf209` |
| Reviewer-B | `task_31dd99af646c` | `ctx_9ba10725b220` | `msg_17df01a10f78` |
| Common QA | `task_0e99b6e5fb12` | `ctx_010e8e2ab9d8` | `msg_5ba736d9c2a5` |

A and QA acknowledged starts in `msg_6a74ed8b8396` and `msg_2e1a95cdb02b`.
Reviewer-B submitted `msg_73791f6b7e07`: APPROVE for design, with no open BLOCKER or MAJOR.
Its held report hash is `42dd201aa7fdbe28f3b83681438cc3310a36106fd7daf026565d71eae6205b60`.
B-S-15 through B-S-19 close. Required MINOR B-S-20 pins system-call rename semantics and locale-stable process identity.
NIT B-S-21 corrects the description of `stack:down`: it removes containers and keeps volumes.
Reviewer-A submitted `msg_dd2316ad3550`: APPROVE for design, with no open BLOCKER or MAJOR.
Its held report hash is `f75b916bd8e18b9df47deac5a76600122333243abd55ccc3aab6a138777a5a2b`.
A-S-09 through A-S-11 close. New MINOR A-S-12 covers a surviving Docker client after a parent-only kill.
The Lead selects a bounded correction for A-S-12 and B-S-20, not acceptance of their limits.
The Lead checked both report hashes and preserved history, then retained each worker before acknowledgment.
Reviewer-A then removed two trailing spaces in task `task_2daac32ffd71`, dispatch `ctx_b1a7184e4ebb`.
Its final report hash is `c5bac73f38f3ca4f2d897b090b6195420f22bb2f54aa5993cab9eeed312429b8`; no other byte changed.
Common QA submitted `msg_ffa3c85574b5`: FAIL for design testability, with two MAJOR findings.
Its held report hash is `ee614e70eba8aeae165533109eb36bf8089412c8a62ce42b7cad91b1b0dec1df`.
The Lead checked that hash and all 47,421 previous bytes, then retained QA before acknowledgment.
QA confirms 488 rows per round: all 416 original rows plus 72 storage rows.
Every Round 2 finding closes, but R3-01 and R3-02 block the implementation gate.

### Storage Round 3 escalation and bounded correction

The charter's Round 3 rule requires escalation to the human review list.
These findings remain explicit blockers; the Lead accepts no deferral and records no human approval.
The Docs owner will add the review history and unresolved status to `docs/human_review/decisions-needed.md`.
This is a bounded correction of concrete findings, not a new general design-review round.
The charter requires the escalation record; it does not require permission before these authorized corrections.
No implementation, Docker run or acceptance credit is authorized while the gaps remain.

| Finding | Required correction |
| --- | --- |
| QA R3-01, MAJOR | Copy the package folders referenced by the old app database before the legacy backup. Record the content-check result. Keep the credential, lane and source restrictions. |
| QA R3-02, MAJOR | Name the existing P5 exception: only app database and sidecars, app positively stopped, operation lock held, LTI may run. Allow the exact existing harness stop/start actions without broadening operator starts or changing assertions. |
| A-S-12, MINOR | Cover a surviving Docker client after a parent-only kill, including the time before container creation. Add a self-check. The Architect must specify an operable process-ownership rule. |
| B-S-20, required MINOR | Use rename(2) semantics rather than shell mv. Write and compare process start identities under LC_ALL=C. Add a locale self-check. |
| B-S-21, NIT | Correct both descriptions of stack:down to say it removes containers and keeps volumes. |
| QA R3-03 to R3-06, MINOR | Exclude quarantine's ended copy container by completing its removal first. Observe the acquired event or record. Use one lane for target-state checks. Create a distinct pair before the mismatch check. |
| QA R3-07, NIT | State that demo commands hold no lock of their own. |

The Architect owns the existing nine architecture paths and appends the bounded response without rewriting review history.
After a frozen correction, the same reviewers and QA will check their exact findings in Round 3 addenda.
Any further BLOCKER or MAJOR must be reported in the same escalation; no automatic fourth general round is authorized.
All 488 rows, original assertions, old-build qualifiers, full reruns and 32 UNVERIFIED live rows remain required.

The three Round 3 reports and this synthesis are committed at `7f2c2c5db6f398291106b778f19811ca3dfaa440`.
Architect correction: `task_e7ed35da6e6b`, dispatch `ctx_ee1c2165c28f`, launch `msg_0026550b1e6e`, start `msg_bd21c2cc3e27`.
Docs escalation record: `task_9b5771f76cf8`, dispatch `ctx_0df32f7a15bd`, start `msg_0cbaf22c5564`.
The Docs launch confirms both requested and effective `claude-opus-5-5`, `xhigh`.
It owns only the human review list; the final M4 guides remain gated.
The bounded disposition tasks wait for the Architect and a frozen correction:
Reviewer-A `task_07487a8a99ff`, Reviewer-B `task_95e51fff8e37`, common QA `task_9266d07c15ec`.
Each appends to its own Round 3 report. No Docker window is open.

Docs submitted the required G1 escalation record in `msg_300a8e9a7462`.
Its held hash is `ad82d723cea8860f1287816006ef11651686d80568f94cd8c44e9c6e138e1c28`.
The Lead checked the record and unchanged prior text, then released the worker before acknowledgment.
G1 is UNRESOLVED. It names both MAJOR findings, required corrections and the independent closure gate.
This record does not waive findings, claim human approval or open implementation.

The Architect submitted bounded revision 3.1 in `msg_3b1754e35f60`.
It changed eight architecture files; `local-stack.md` needed no change.
The Lead checked all held hashes and preserved response history, then retained the worker before acknowledgment.
ADR-012 hash: `02e2cff7573f1cac9befb436ef4972ae72a2d0c68cb544b9f58879d727e6c8a6`.
Response hash: `a221d6b642f64b66cb49d145908c54ae7cb36f1b91b6f51178b750b2960635c3`.
Revision 3.1 adds group liveness and keeps Docker clients in the guarded command's group.
The Build Runner gets its own group. Shared caller groups refuse recovery until their remaining processes end.
Lock renames use rename(2); process identity uses LC_ALL=C.
The revision adds the package-copy oracle, app-only P5 container, exact harness actions and the listed precision corrections.
Scratch host probes support only macOS process, locale and rename behavior. They give no acceptance credit.
Docker client group behavior, Linux behavior and the other §17 assumptions still need build-step evidence.
No row is added or removed. The three bounded disposition checks remain required.

Two later source tasks are queued behind those checks and explicit Lead acceptance:
backend Author `task_3b908985fd0b` and independent common QA preparation `task_58a1e33ac60f`.
They may run in parallel after an accepted frozen design. Neither has a Docker window.
Their completion does not replace retries of the failed full verification tasks.

The bounded correction is frozen at `a65a4eec669c4a98aac80ff6b3dc3d1f55813dd0`.
All paths outside `docs/**` still match `8138097`.
The three original Claude sessions received parallel checks of that exact commit:

| Owner | Task | Dispatch | Launch | Start |
| --- | --- | --- | --- | --- |
| Reviewer-A | `task_07487a8a99ff` | `ctx_560fb486e649` | `msg_1beb28379a7b` | `msg_88ad05655d36` |
| Reviewer-B | `task_95e51fff8e37` | `ctx_60080f82e427` | `msg_52f25b64a059` | `msg_62cd8b6bb10e` |
| Common QA | `task_9266d07c15ec` | `ctx_39c390bc5118` | `msg_604d16f42d6d` | `msg_a92522bea197` |

G1 and the implementation gate remain unresolved pending all three verdicts.

All three bounded checks are submitted. The Lead checked each held hash and preserved history, then retained the workers before acknowledgment.
Reviewer-A `msg_3178c8300180`: APPROVE; A-S-12 closes, A-S-09/10 remain closed.
Its report hash is `89955081e57ab49caea679c6cf43dba9dc418a26c55ed161b2a57af8e26889c0`.
New MINOR A-S-13 requires a real Docker client-group measurement before implementation acceptance and a safe result if it fails.
Reviewer-B `msg_65712a6368f7`: APPROVE; B-S-20/21 close and earlier findings stay closed.
Its report hash is `c18278e6db0fa287efbe80bc0bc8ad41d8de41114a80aeebc59b18dc8f10394b`.
New NIT B-S-22 specifies `LC_ALL=C ps -A -o pid= -o pgid=`.
Common QA `msg_383fe712a02f`: FAIL for bounded design testability; R3-01 through R3-07 close.
Its report hash is `5ae7988ddcf37cff10cb336b85bc115abd2d9b23315433378382715a2e3fd12d`.
New MAJOR R3B-01 blocks two fresh-volume fixture rows and reliable cleanup accounting.
After quarantine, mounting absent volume names would create unlabeled, root-owned volumes that QA cannot write.
A label-only boundary check would miss those leftovers. This finding joins G1; it is not waived.

Required bounded correction: QA must not mount absent volumes. Product preflight creates the FIRST_START fixtures under the operation lock.
QA then checks exact volume names, labels, ownership and state independently; partial-state setup removes one identity as the service user.
Fresh-lane and cleanup checks must include exact names and preserve any unproven pre-existing resource.
The Architect must check all fixture setup paths affected by this rule, not only the two named rows.
A-S-13 will be measured in a separate bounded Author diagnostic, with no implementation or acceptance credit.
A false or unmeasured client-group guarantee blocks implementation acceptance; no unreviewed fallback is authorized.
B-S-22 is included in the bounded specification correction.
The two planned source tasks remain held despite their completed orchestration dependencies.

These addenda and the correction scope are frozen at `0928c888543a1171944870125ac2fe2ab5e0067a`.
Architect task `task_aa24785b66a8`, dispatch `ctx_db1896d29904`, launch `msg_2d6ea9a0b678`, start `msg_8dc77f595b0e`, owns the same architecture paths.
Docs task `task_77ca2a4e65c9`, dispatch `ctx_b8d83b29cb9a`, updates only G1 with the new finding and previous closures.
Its fresh launch confirms requested and effective Claude Opus 5.5 xhigh.
Author diagnostic task `task_0b882dfdab3f`, dispatch `ctx_a5879eef31cc`, launch `msg_a40b2df41e69`, start `msg_00d787d45214`, resumed the original Author session.
It alone owns a bounded Docker diagnostic window: two disposable containers at most, no network or named volumes, pinned existing image, no product stack.
A gated health dependency holds the target absent while QA-style process kills are observed.
The Author must compare all seven original protected volume records, remove only its own resources and explicitly return the window.
The diagnostic gives no acceptance credit. The Architect and Docs have no Docker authority.

The next bounded disposition tasks depend on both the correction and diagnostic settlement:
Reviewer-A `task_98eab0aaf4c1`, Reviewer-B `task_278ec21bfdec`, common QA `task_c1ad8c306bab`.
They still need the Lead's exact frozen handoff and verified diagnostic evidence.
Docs submitted the updated G1 history in `msg_d784f00628e8`.
Its held hash is `3fc5ddedb1ae808811a89b51c5f83f419482da699f93bedc8b32e701fb3ab618`.
The Lead checked the scoped history and hash, then released Docs before acknowledgment.
G1 now names R3B-01 as the current MAJOR and preserves the closed original findings.

The Architect submitted revision 3.2 in `msg_c3fcf12a2c55`.
The Lead checked all nine held hashes and preserved response history, then retained the worker before acknowledgment.
ADR-012 hash: `d1d95e5c5432f21afadd895bba9dd8a22e4fd8426d8ad13bd4d1d21dabb494b7`.
Response hash: `f78179767075debd396cf01b3d30993821ab112feb4a5ae99791b677db7e5079`.
The correction covers R3B-01, A-S-13 and B-S-22 only. No finding is closed by the Architect.
Exact volume names and labels govern every QA mount, fresh-lane check and cleanup.
Product preflight creates the fresh fixtures; QA checks their state independently.
The 488-row inventory and original 416 assertions remain unchanged.

The Author submitted the first client-group diagnostic in `msg_c86de0152c40` and returned its Docker window.
Evidence root: `/Users/quangnguyen/cogniate-author-diag/client-group-20261020T2243Z`.
Report SHA-256: `24768ae9a3dbdb18881adbb0ff4131aa3d2ce014556b9aed606688d358b7a9df`.
The Lead verified all 14 manifest hashes and both full boundary comparisons against the seven original volume records.
Cleanup left zero containers and owned leftovers; CPU and memory values were unchanged.
On this macOS host, the real Docker front and Compose plugin stayed in the command's group in four trials.
A parent-only kill left clients that created the target later. A whole-group kill left no client or late target.
That last observation lasted about 2.7 seconds; revision 3.2 gate G-1 requires 30 seconds.
The evidence therefore does not yet satisfy G-1. It gives no acceptance credit.

Narrow follow-up `task_e33f7d22129d`, dispatch `ctx_678350c62620`, launch `msg_0a393a521b79`, start `msg_cbb4eafd83e9`, resumes the same Author.
It alone owns a new bounded Docker window to complete the 30-second observation after opening the dependency gate.
Message `msg_843a2ea23d1d` specifies the owned container name and storage run label required by G-1.
The earlier evidence remains unchanged. All other diagnostic safety and cleanup limits remain.
Reviewer-A receives both reports and their limits before its disposition; no wider host or client claim is authorized.
Reviewer-B and QA can check the frozen text while this measurement completes; neither has Docker authority.
G1 stays unresolved, and both source tasks stay held until all independent design checks pass.

Revision 3.2 is frozen at `d0bdda06cbb7176fcb7d2b66797d81edd95de6fe`.
Reviewer-B: `task_278ec21bfdec`, dispatch `ctx_db35f10495b2`, launch `msg_d533d7ff989e`, start `msg_40173d9872ae`.
Common QA: `task_c1ad8c306bab`, dispatch `ctx_7aed1436bc04`, launch `msg_bbfd773f916f`, start `msg_2a92cde42868`.
Both check only the bounded correction and its direct regressions. Reviewer-A waits for the complete diagnostic evidence.
Reviewer-B submitted APPROVE in `msg_ddc9731a37a8`, closing B-S-22 without reopening earlier findings.
Held report hash: `a09233e7c4562fca7a27aa6a0dee05a311dc2a855eae41822e0d108b1b81b726`.
The Lead checked the hash and preserved report history, then retained the worker before acknowledgment.
New NIT B-S-23 asks for an explicit empty-legacy-file check before the FIRST_START fixture setup.
It does not waive QA's independent fixture disposition or any runtime gate.

The Author's first 30-second trial omitted the exact name and run-label flags from the follow-up message.
That evidence stays supplemental. One corrected trial is authorized within the original window, with no clock reset.
Message `msg_98d105063c85` sets the final cleanup deadline at 22:58:27 UTC and permits no further retry.

The follow-up completed in `msg_daacd205995a`; the Docker window is returned.
Evidence root: `/Users/quangnguyen/cogniate-author-diag/client-group-30s-20261020T2252Z`.
Report SHA-256: `297cdf8c83cbf2876d1e638d579c1c7daa44dbbbad8f7e0106cc1dd2f3ebdc4e`.
The exact named and labeled trial saw no surviving client or late target for more than 30 seconds after gate opening.
A positive control confirmed the exact-name and run-label filters detect a real target.
The first follow-up trial without those flags stays supplemental; both trials remain in the report.
The Lead verified all 26 manifest hashes and the prior 14 unchanged hashes.
All four boundary snapshots have seven unchanged original volume records, zero containers and no owned leftovers.
The final cleanup boundary was 22:57:23.934 UTC, within the original window starting 22:53:29.148 UTC.
CPU and memory stayed unchanged. Other signals, create-API races, command paths, hosts and client versions remain unmeasured.
The Author was retained before acknowledgment. This is diagnostic evidence only.
Reviewer-A `task_98eab0aaf4c1`, dispatch `ctx_2f807ddce9f7`, launch `msg_e87b558008b9`, now has both reports and their limits.
It independently decides A-S-13 and the scoped G-1 disposition. No Docker window is open.

Reviewer-A started in `msg_8e6d632e3693` and submitted APPROVE in `msg_47587678d2c7`.
Held report SHA-256: `318d753fe8962f408eed5b87939a7c6ab729d12d760b8278141b54913e3bc0aa`.
The Lead checked the hash and unchanged prior report bytes, then retained the worker before acknowledgment.
A-S-13 closes as a design build gate; both diagnostics meet scoped G-1 for storage-style Compose run on this measured host.
The exact-name fixture changes do not reopen Reviewer-A's earlier closures.
New MINOR A-S-14 asks to bind the result to the recorded OS version, Docker CLI and Compose plugin versions and binary hashes.
QA must compare those identities at its run boundary; a mismatch requires new G-1 evidence or blocks lock-dependent rows.
The diagnostic limits remain. No implementation or runtime acceptance follows from these approvals.
QA's independent R3B-01 disposition is still pending, so G1 and source implementation remain held.

QA submitted PASS for bounded design testability in `msg_8fab24c0dc58` and closed MAJOR R3B-01.
Held report SHA-256: `561151be1213d70a3779f6aaed511f711f5ef045a3a9c5410c13846130ba9454`.
The Lead verified that hash and the unchanged first 68,830 bytes, then retained QA before acknowledgment.
All R3-01 through R3-07 remain closed. No BLOCKER or MAJOR remains from any of the three checks.
QA recounted 488 rows: 416 original assertions and 72 storage rows, with unchanged phase totals.
New nonblocking MINOR G1-QA-01 requires ownership records for containers and networks as well as volumes.
New nonblocking MINOR G1-QA-02 requires a Docker-clock comparison that accounts for whole-second volume timestamps.
QA records its inbox exposure to Reviewer-A's summary after completing its own fixture tracing.
It read no other addendum file and used no G-1 conclusion from that summary.
QA's reported G-1 limit reflects its earlier handoff; Reviewer-A separately accepted the complete follow-up evidence.

Lead decision: the blocking design findings in escalation G1 are independently closed at revision 3.2.
This accepts the storage design for implementation; it does not accept the implementation or any runtime result.
Architect task `task_1131dea487ca` will state the four nonblocking precision corrections: A-S-14, B-S-23, G1-QA-01 and G1-QA-02.
It changes no product mechanism, protocol, original assertion or row count.
Those items will remain addressed pending implementation checks, not waived or self-closed.
The two queued source tasks can start after that contract is frozen and the Lead supplies the exact handoff.
The human review record must preserve the escalation history and distinguish design closure from all remaining verification gates.

The QA report and Lead design-acceptance decision are frozen at `5f3337a95d07a588767d06ddb26f8b014d2d9671`.
Architect precision: `task_1131dea487ca`, dispatch `ctx_2aeaee00bed0`, launch `msg_cd43c61a8ae0`, start `msg_7519f3a8a6d5`.
The B-S-23 correction must preserve the required h-target-state sequence: its restore/import refusals do not run the legacy scan.
Docs closure record: `task_84864af0379e`, dispatch `ctx_3469514c4537`.
Its launch confirms requested and effective Claude Code Opus 5.5 xhigh; it owns only G1 in the human review list.
Both tasks have no Docker authority. The final M4 guide task remains gated by implementation and verification.

The Architect submitted revision 3.3 in `msg_022bac95a5fc`: eight architecture files, with all four items addressed pending implementation verification.
The Lead checked the eight held hashes and preserved response history. `local-stack.md` is unchanged.
Before freezing, the Lead found a mechanical resource-identity detail: Docker volume metadata has no `Id` field.
The original protected-volume records expose `Name`, `CreatedAt`, `Driver`, `Labels`, `Mountpoint`, `Options` and `Scope`.
Architect follow-up `task_76c3c8865200`, dispatch `ctx_f54503e2deb2`, launch `msg_6e9ab17ddf68`, start `msg_a3c1e92de4db`, clarifies only that wording.
It uses kind-specific recorded identity and preservation checks; it does not invent a volume id or broaden cleanup authority.
The other five held architecture files stay unchanged. No Docker is authorized.

The Architect submitted the corrected resource identity wording in `msg_88c2266e5c8e`.
The Lead checked all eight final held hashes and preserved response history, then retained the worker before acknowledgment.
Final ADR-012 SHA-256: `f586f1d76083297b22eae8981d9347512c313f9a0dd929bcee9f0763c0aed2fe`.
Final response SHA-256: `9f1999769bbcbf3ee4442411d739df23790f23a45f5a2a42097a343ded45234f`.
Containers and networks use Docker Id; volumes use Name and the recorded metadata that Docker supplies.
Teardown re-inspects the latest record and preserves any mismatch or unverifiable resource.
The text states Docker's lack of a unique volume-generation id and makes no stronger identity claim.
Revision 3.3 is ready for the exact source handoff. The four minor precision items remain subject to implementation verification.

The accepted contract is frozen at `89be93cc9e24f74c2b32ce72180ad4c706d000f7`.
The Lead authorized the two source tasks in parallel against that exact commit:

| Owner | Task | Dispatch | Launch |
| --- | --- | --- | --- |
| Original backend Author | `task_3b908985fd0b` | `ctx_f1299da8103d` | `msg_9e844f8be156` |
| Independent common QA preparation | `task_58a1e33ac60f` | `ctx_e583d25c6083` | `msg_96802109f5df` |

Both reuse the same dedicated Claude Code Opus 5.5 xhigh sessions.
The Author started in `msg_1618035ac061`; QA started in `msg_c4bc47b90b42`.
QA writes from the accepted criteria before reading implementation notes.
Their files do not overlap; neither task has a Docker window or acceptance authority.
The Author runs meaningful host/unit checks and the existing root check. QA runs host-only harness and inventory controls.
All original acceptance assertions stay intact, and the full runtime gates follow source reviews and a frozen candidate.

The Author raised a unit-fixture conflict in `msg_dc57a64a7114` before changing `stack-data.test.ts`.
Architect task `task_8d1a19a966c7`, dispatch `ctx_a1b035ce7912`, resolved it read-only in `msg_e79a9023d798`.
The Lead retained the Architect before acknowledgment and accepted Option C in `msg_3b7b585f30b5`.
This clarifies the task brief; it changes no architecture or acceptance criterion.

- Keep every existing unit assertion and its guarantee. Adapt fixtures, fakes and command arguments to the accepted volume layout.
- Remove the old restore primitive that bypasses the journal and database identities. Do not retain an undocumented bind-writing route.
- Count database-program calls separately from the Node lock helper. Rejected operations must still leave database data unchanged.
- Exercise journaled restore through a valid temporary volume layout and the real database program.
- Add controls for identity refusal, unchanged legacy binds, damaged backups, preserved sidecars, generation and restore provenance.
- Map the old and new unit guarantees for both source reviewers. Unit stand-ins do not prove the real container path.

All 416 original acceptance assertions and 72 storage rows remain required. No assertion waiver or Docker window is granted.

Author checkpoint `msg_5e0627470c2d` reports the first storage implementation and passing host probe, lock and recovery controls.
It is not a source freeze or independent verdict. Its shell-entry fixtures still need the approved Option C update.
Architect task `task_ef3a4a661c2f`, dispatch `ctx_00a1865dca19`, answered three output questions read-only in `msg_b00eb2939295`.
The Lead retained the Architect before acknowledgment and sent the binding direction in `msg_f487225f3ac0`.

The required correction preserves this order: complete backup validation, target state, backup source kind, then pair rules.
An invalid target must retain its specified refusal code for either backup source kind.
Report-mode identity metadata is permitted before the final summary, after privilege drop, with no file contents.
The separate event must preserve one `storage_preflight` line per folder and be documented in `infra/README.md`.
The `--rm -T` invocation matches the measured command form, subject to its recorded environment and runtime limits.
These are existing-contract interpretations, not new design or runtime approval. Both source reviews still verify their implementation.

Lead reply `msg_a3bf317bdc69` adds `infra/scripts/storage-compat.test.mjs` to the Author's owned files.
It permits focused host-only wrapper tests; it grants no Docker window or wider file ownership.

QA submitted source preparation in `msg_44d76502b594` for `task_58a1e33ac60f`, dispatch `ctx_e583d25c6083`.
The Lead checked all 28 held hashes and the unchanged earlier M1/M3 report bytes.
Host-only results: 69/69 tests, typecheck and discovery pass; the inventory remains 488 rows with the approved phase counts.
The three original provider manifests are unchanged. This checkpoint has no product or runtime acceptance credit.
QA disclosed that an existing self-test read two infrastructure files from the shared worktree after its tests were written.
The two files are `infra/compose.yaml` and `infra/scripts/stack-restart.sh`; QA opened no Author implementation or notes.
The reports preserve this disclosure and list the assumptions still needing runtime evidence.

QA identified an omitted check for AC-M1-30 step 3: both restore journals must be committed.
The Lead requires this additive check; preserving existing assertions does not prohibit adding the accepted criterion.
Follow-up `task_fbe27ed8164d` returns to the same QA session, with no Docker window.
It owns only `tests/host/m1-migration.mjs`, its adjacent self-test, and an appended M1 QA report correction.
It must inspect both journals independently, preserve every earlier assertion and row, and add positive and negative host controls.
The combined source freeze and both source reviews wait for this follow-up as well as the Author's completed implementation.

The initial QA preparation is frozen at `049da68a8958039fc3b4c22e8fa42d8e410269d2`.
QA started the journal follow-up in `msg_1970b9f510db` and completed it in `msg_742dc7c75ab7`.
Dispatch: `ctx_a97b59838a96`. The Lead checked all three hashes and retained the worker before acknowledgment.
The migration harness keeps every earlier line; its self-test changes only the import line and adds controls.
The M1 report keeps all 61,159 earlier bytes, and every other held QA file is unchanged.
The new check reads both committed journals before any service or old build starts and ties them to the current restore.
Focused host controls pass 12/12, including missing, uncommitted, invalid, mismatched and earlier journals.
Inventory remains 488. This closes the preparation gap; it gives no runtime or independent source-review approval.

Docs started in `msg_ec29e7a52a8a` and submitted G1's current design-closure record in `msg_1405db3332a1`.
Held SHA-256: `84b95ce1992885fe9ca93597bd3dda53052b46900f7400f06d9db4ae1e1b8ae4`.
The Lead checked the scoped diff, hash and preserved earlier sections, then released the worker before acknowledgment.
The record keeps escalation history, both diagnostics, the QA disclosure, four open nonblocking items and every remaining verification gate.

The Author submitted its held implementation in `msg_bb37b8dffffa` for `task_3b908985fd0b`, dispatch `ctx_f1299da8103d`.
The Lead verified all 20 source hashes, all seven evidence files, an empty index and the exact allowed path set.
The Author was retained before acknowledgment. No Docker command, commit or push was run by the Author.
Evidence is held in `.tmp/author-handoff/task_3b908985fd0b/`; its manifest SHA-256 is `c988b541ed2faf5718c669acf1722cd896b5523550708a3e12e19a18d8c22df3`.
The source hash-list SHA-256 is `53f4c79d1bb9a79dad184cdc54b1cad3aaf473350ab5c70b62f95bc07f55c9b3`.
The Author's final root check passes lint, typecheck, 1,086 unit tests and 62 infrastructure tests.
All 24 source mutations fail their targeted tests in a scratch mirror with matching final source bytes.
The separate WAL probe controlled negative is not counted as a source mutation.
The Option C map preserves 30 original assertion lines: 27 unchanged, three adding only the required legacy-source argument.
Reviewers must assess those guarantees, the QA interface assumptions and the unmeasured container behavior independently.
QA's journal follow-up is committed at `8a66a337b0486028cc5af1e265a1d12255cfd2f6`.
All 488 runtime rows and 32 live rows remain unverified. The unrelated `pnpm-workspace.yaml` remains unstaged.

The combined source and test candidate is frozen at `f8a869bc6990d966b669352bedd8ec528adb4c08`.
The Lead's separate clean clone passes `npm ci` and `npm run check`, with the real course fixtures available.
Results: lint, typecheck, 70 unit-test files with 1,086 tests, and 62 infrastructure tests pass; zero skips.
The clone remains clean. Its evidence directory is `/Users/quangnguyen/cogniate-lead-checks/storage-f8a869b-20261021T0038Z`.
The check-log SHA-256 is `37fcac34c40cd284ffc271313d8e990a272a00f3dc434ba2a24fab05d94518ff`.
This host-only check does not grant runtime acceptance.

Both independent source reviews started against this frozen candidate:
Reviewer-A `task_5580d3cb79c5`, Reviewer-B `task_94536ec30f9a`.
Their dispatches are `ctx_94a0f5776563` and `ctx_127f2d72d1b0`; launches are `msg_35646e58c20d` and `msg_30146b33a1a5`.
Both acknowledged their starts in `msg_5c25b8b5b95e` and `msg_8fc636df44bd`.
They received the three contract clarifications, both committed QA preparation steps, and the Author's held evidence.
They own only their separate M1 storage-review reports and remain independent of the authors and QA.
Both approvals and the Author/QA source checks are required before any full verification retry or final conformance starts.
These new source-review gates supplement the original final-stage dependencies; they do not replace failed verification tasks.

Both round-1 implementation reviews request changes at `f8a869bc6990d966b669352bedd8ec528adb4c08`.
Reviewer-A submitted `msg_b0ba7fb261dc`; report SHA-256 `478ef9a871888530417d99c5c630e6c628ad591c3c59ae5bfeba780db078e6e0`.
Reviewer-B submitted `msg_04c5c6ed9605`; report SHA-256 `6ca5e8e53575f5cfe82de8585274d021dd927ed67cae4fd9114cda955f739888`.
The Lead verified both held reports and unchanged product and test bytes, then retained each reviewer before acknowledgment.
Reviewer-B's report is committed at `d2b39eaf9bf9789613a531e1428ae67aa83a042e`.

The consolidated repair keeps the accepted contract and all acceptance assertions unchanged:

| Finding | Required action and owner |
| --- | --- |
| A-SI-01 / B-SI-01 | One shared BLOCKER: Author adds the required JSON refusal codes and meaningful path-family tests. |
| B-SI-02 / B-SI-03 | Author adds the specified injected probe cases and distinguishes wait timeouts from probe errors. |
| A-SI-02 | Author fixes malformed and non-object journals so R6 always changes nothing and exits 2. |
| A-SI-03 / B-SI-04 / B-SI-05 | Author improves bounded failure output without exposing raw subprocess data or changing safety behavior. |
| B-SI-06 | Author completes the infrastructure README's old-build command and cleanup limits. |
| B-SI-07 | Read-only preparation remains an explicit source NIT. Do not skip required privilege or preparation steps without an Architect contract reading. |

The highest severity governs the shared refusal finding. A report's lower count does not narrow the affected path list.
The repair must cover the union, including legacy hot-journal backup and the compatibility wrapper.
Both reviewers require a new exact-source follow-up. Runtime, final conformance and documentation gates remain closed.

The same Claude Author started repair `task_81a4c5dab4dc`, dispatch `ctx_4f87059bdeaf`, in `msg_a08b8124cb10`.
Launch: `msg_d6889239132d`. Its brief permits only 12 named Author paths and host-only checks; no Docker window is open.
Architect `task_1fe6a1c443cf`, dispatch `ctx_863ddd72d0b9`, reads B-SI-07 without editing files.
Launch: `msg_c8a75d0c191a`; start: `msg_167c4a3b0334`.
The Author continues independent fixes while that contract reading is pending.
Round-2 source reviews are queued as `task_34365528ced3` (A) and `task_f8cfe85a1d3a` (B).
They require the repaired frozen candidate, the clarification disposition and final source-check evidence before dispatch.

Architect `msg_4286bb7f2bc0` resolves B-SI-07 as an existing-contract reading, with no file or architecture change.
The Lead retained the Architect before acknowledgment and sent the binding direction in `msg_eefd866c15b1`.
Volume backup and quarantine copy must skip volume preparation and drop privileges before reading volume data.
They keep their read-only mounts. Unprepared but readable metadata is informational; backup uses the report semantics for empty mountpoints.
An entry unreadable by `HOST_UID` still fails closed: no backup manifest, or no quarantine removal.
The existing design does not permit a root copy of unreadable data. Writers keep their required preparation steps.
The Author must add positive read-only and unreadable-entry controls. Both source reviewers check this implementation disposition.
Required operator fields remain present and safely escaped; unrelated raw process output and secrets must not be exposed.

The Author submitted the repaired source in `msg_8e2a41e30573` for `task_81a4c5dab4dc`, dispatch `ctx_4f87059bdeaf`.
The Lead checked all 12 held files, eight evidence files, the unchanged earlier evidence and all 214 prior stack-data assertion lines.
QA and architecture files still match `f8a869b`; the committed review reports are unchanged.
The Author was retained before acknowledgment. Its report names the task's starting HEAD; later commits contain only team records.
Evidence: `.tmp/author-handoff/task_81a4c5dab4dc/`.
Held-list SHA-256: `73a39c77b1f1370635ac3a0fc41c1a1eb0ae3afc06a30be727487dfb67661240`.
Evidence-manifest SHA-256: `e547a151f34fab04ca0d00acf2aae06f9af5693dc1242fb54bced458ecf4098d`.
Author checks pass: 1,111 unit tests in 70 files, 76 infrastructure tests and 21 targeted mutation controls.
The exact error-code mutation from B-SI-02 now fails its test. Six real outputs also pass the frozen QA oracle in a scratch check.
These are host-only Author results. The held repair covers all assigned findings, including B-SI-07; independent closure is still required.
No Docker command, stack, commit or push was run by the Author, and all runtime and live rows remain unverified.

The repaired candidate is frozen at `a784522a3cdd9bb67453b03093092cac24e87402`.
The Lead's clean detached clone passes `npm ci`, lint, typecheck, 1,111 unit tests and 76 infrastructure tests, with no skips.
Real course fixtures were available, and the clone remains clean.
Evidence: `/Users/quangnguyen/cogniate-lead-checks/storage-a784522-r2-20261021/`.
Check-log SHA-256: `7e4744c8bdb1eca3e76ee9c52d0f8c87a1a9fcdc757f1bcc6f7504cb225d7250`.
Both round-2 reviews started against this exact candidate:

| Reviewer | Dispatch | Launch | Start |
| --- | --- | --- | --- |
| A | `ctx_ba60b67fd2af` | `msg_e77146badf40` | `msg_c65d4cd3519b` |
| B | `ctx_9a557d8d1cfc` | `msg_b342ba93765f` | `msg_717e55f98c38` |

They received the held evidence, the B-SI-07 contract reading and the Lead's independent host-check result.
The reports must preserve all earlier bytes. Both source verdicts and the separate runtime gates remain required.

Reviewer-A returned round 2 in `msg_15be071b1690`: APPROVE for source at `a784522`.
Its held report is committed at `a9fe7edf6bf01e87b067c03bf13cd846771f699f`.
Report SHA-256: `e244e5d6b809be360afc067f17643142506d5d19c7fa4fdfaaf30a4b9aabe361`.
The Lead verified the complete hash, the preserved 20,953-byte first round, unchanged source and tests, and the clean diff.
The reviewer was retained before acknowledgment. All assigned required findings close in its source review.
Its independent evidence includes invalid-journal controls, five killed probe mutants, frozen QA-output checks and read-only preservation.
Reviewer-B's round-2 verdict is pending. No Docker window or runtime retry is open.

The Lead records two nonblocking NIT dispositions under charter §5:
- A-SI-04: defer the unreadable-metadata diagnostic improvement to the Author's future maintenance work.
  Backup fails closed with exit 1 and no manifest, but it does not always name the unreadable metadata path.
  Docs must carry this diagnostic limit into the M4 deferred list; runtime failure behavior still needs verification.
- A-SI-05: assign the infrastructure README wording correction to the Author in the M4 documentation wave.
  Task `task_56d87414a1f6` waits for accepted final conformance and has not been dispatched.
  Clarify that coded refusals emit JSON; some safe wrapper stops use text only.
  This is a text correction and grants no runtime acceptance.

Reviewer-B returned round 2 in `msg_bdf59170585a`: APPROVE for source at `a784522`.
Its report is committed at `9bf6100d772567baaa03201b9654521fe5a335ca`.
Report SHA-256: `37dbb6ad8bf1e199cc25b9b51b8475407be60cda7a861a74f34d8a5d9e46cfd0`.
The Lead verified the hash, the unchanged 194-line first round, the source freeze and the clean diff.
The reviewer was retained before acknowledgment. All required source findings now close in both independent reports.
Reviewer-B verified the Author's mutation evidence and traced the test; it did not rerun its scratch mutation command.
Reviewer-A independently killed five probe mutants. These evidence sources remain distinct.

The Lead records the remaining Reviewer-B observations and NIT dispositions:
- B-SI-08: defer the partial-volume-removal message improvement to future Author maintenance.
  The verified copy stays, but a failed two-volume removal can remove only one volume.
  Docs must record this limit in M4. Operators must inspect each volume before another quarantine attempt.
- B-SI-09: add the output stream and field corrections to Author task `task_56d87414a1f6`, alongside A-SI-05.
  Folder refusals use stderr; the container field is `container`. QA reads both output streams.
- O-1: retain current timing controls. The Author owns a wider timing margin if CI shows failures caused by load.
- O-2: include text-only safe stops in the A-SI-05 guide correction; no new refusal code is required.
- O-3: unreadable-entry and preparation controls ran on the non-root host, including the Lead's zero-skip clean-clone check.
  A root CI run skips them and cannot replace that evidence. Docker privilege behavior still needs runtime evidence.

Both source approvals and the Lead's host check now pass at `a784522a3cdd9bb67453b03093092cac24e87402`.
Later commits change only review and team records. The 488-row runtime gate remains unverified.
The original failed QA tasks can now receive proper retries. No final conformance or documentation gate opens yet.
Common QA receives the first exclusive Docker window; Canvas QA starts with host-only preparation and independent evidence review.
Fresh M2 and T7 runs require a later explicit transfer of that sole window.

The Lead opened proper retries of both original failed tasks on 2026-10-21 at 02:14 UTC.
Orca refused retained-chat reuse with `terminal_unsupported_for_agent_session`; the old task still showed failed with failure count zero.
The retry path therefore uses replacement Claude sessions. Earlier sessions and their evidence remain separate historical sources.
Both launch receipts confirm requested and effective `claude-opus-5-5`, effort `xhigh`.

| QA owner | Task | Retry dispatch | Window |
| --- | --- | --- | --- |
| Common and Blackboard | `task_ed3b08aa45ea` | `ctx_75f7ef7a9240`, retry of `ctx_8d5f8d3984d0` | Exclusive Docker window, port 8443, subnet 172.29 |
| Canvas and browsers | `task_e28388df4dcc` | `ctx_f3f20494787a`, retry of `ctx_4a94125660be` | Host-only preparation and independent judging; no Docker yet |

Handoffs `msg_905fc87a48de` and `msg_027a758a8352` bind the retries to `a784522` and supersede stale model and run-count text.
They require two complete matching 488-row rounds, all legacy groups, fresh M2 and three default T7 runs.
They also retain host identity, private evidence, ownership records, secret scans and the seven-volume baseline gates.
Both workers sent heartbeats. No runtime result is accepted yet.

Common QA passed its pre-launch gates in `msg_c6a6335c0fc6` and started the full run at 02:21:14 UTC.
The clean clone is `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-a784522-20261021T0217Z/source`.
Evidence root: `/Users/quangnguyen/cogniate-qa-runs/m1-full-a784522-20261021T0220Z`.
The Lead checked the exact clone HEAD, unchanged tracked files, host hashes and seven identical protected-volume records.
The launch uses the full runner's default two rounds and legacy phase; the runner has no `--runs` option.
Monitoring remains attached to the same process. A completed assistant turn while its event monitor waits does not mean the runtime stopped.

Canvas QA completed host-only preparation in `msg_93314f0f717b`.
Its root is `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-a784522-wgLHNZc0`.
The Canvas judge has positive and negative controls for all 233 Canvas rows in each complete round.
This preparation grants no runtime credit.
QA also found that the older T7 runner uses label-only final cleanup and resets volumes inside each browser run.
The proposed `--keep` plus external ownership wrapper is held; it must protect internal resets as well as final cleanup.
Architect task `task_10f20561b505`, dispatch `ctx_e1453675ba10`, reads that proposal against the existing contract without edits or Docker use.
Launch: `msg_69122673654d`; start: `msg_07081289fd04`.
The Lead answered QA's blocking question in `msg_69df4192f06a`: continue host-only and hold the wrapper decision.
Reserved later lanes are M2 `qa-e2e-sim-r6` on 8643/172.27, then T7 `qa-e2e-m3-r3` on 8543/172.31.
These reservations do not transfer the sole Docker window. No product or test change, freeze waiver or T7 runtime acceptance is granted.

Architect `msg_1d56d5d016b1` permits the external T7 wrapper at the same frozen SHA, subject to three QA repairs and a fixed procedure.
The Lead retained the Architect before acknowledgment and confirmed unchanged product, tests and architecture bytes.
Required wrapper repairs are:
- Fail isolation if any ledger record ever has `madeByRun=false`, even if a later reset removes the resource.
- Fail ownership recording if the Docker event monitor exits or errors before the stop file.
- Require unchanged networks, Docker identity and non-lane container IDs, as well as the seven protected-volume records.

Canvas QA owns these external helper repairs and focused positive and negative controls. It must hold hashes for review before use.
The wrapper must report ready before the unchanged T7 runner starts with its documented `--keep` option.
Its clone path must match the runner's clone. Teardown starts only after the runner exits.
Acceptance combines all runner checks, wrapper isolation and teardown PASS, and an independent shared-evidence secret scan.
The runner's skipped teardown gives no isolation credit. Record helper hashes, frozen source tree IDs and event-to-step timing.
The Architect distinguishes product reset behavior from QA cleanup's record-only rule under ADR-012 §15.
Internal resets stay unchanged; every absence and reappearance still needs actual listing evidence in the ledger.
Raw traces stay private. Reports may name their private paths and hashes, but must not share their contents.
QA-E2E owns a later reviewed replacement for the T7 runner's label-only preflight and teardown.
M4 Docs must record the interim wrapper requirement. Common QA's active run and the sole-window boundary remain unchanged.

Common QA reported a required failure in `msg_6914a5bd4758` during round 1 SIM at `a784522`.
Interim Vitest file totals were 311 tests: 310 pass and one fail in `canvas/31-canvas-grants`.
These are provisional file totals, not accepted row results. The exact case ID was not available at that checkpoint.
The Lead routed independent diagnosis to Canvas QA in `msg_5e4900bc26af`.
Common QA must finish the existing phase report, capture and classify evidence, verify cleanup and return the window.
Direction: `msg_c92104f7887b`. No new phase, blind retry or source change is authorized.
The full 488-row round remains incomplete; no earlier results replace its missing evidence.

The earlier full verification attempts failed after the storage blocker. Both original tasks now have active retries, as recorded above.
Common/Blackboard acceptance and legacy regression: `task_ed3b08aa45ea`.
Canvas acceptance, both portal flows, Moodle browser regression and the live matrix: `task_e28388df4dcc`.
Each retry requires implementation, independent test preparation and both source reviews to pass.
The Lead supplied one frozen candidate and assigned the sole stack window in the retry handoffs.
QA owns the combined M3 report; QA-E2E owns its separate M3 browser report and live matrix.
The Lead added Q19 to Q22 and D-1 to D-12 to `docs/human_review/decisions-needed.md` in `7a9734a`.
These are open human decisions from the approved design, not implementation or live-test evidence.

The final-stage tasks are queued. They do not start until their evidence gates pass.

| Work | Task |
| --- | --- |
| Architect final conformance | `task_f94489087dd6` |
| Docs: guides and offline review page | `task_ba7497546050` |
| Independent guide, STE and offline-page checks | `task_d98e2da881be` |
| M4 Reviewer-A | `task_551efa49283b` |
| M4 Reviewer-B | `task_8c5153cd2cd7` |

The Architect follows accepted implementation reviews and M3 verification.
Docs follows accepted conformance and documents only verified behavior, with separate notes for untested real LMS steps.
The two reviewers and independent QA then check one frozen documentation candidate.
A settled task with a failing verdict does not open the next gate.

### Initial role assignment (history)

| Role | Model | Initial responsibility |
| --- | --- | --- |
| Lead | Existing Codex coordinator | Task briefs, team records, commits, integration, gate tracking |
| Architect | Claude Code Opus 5.5, xhigh | Sources, design, contracts, acceptance criteria, final conformance |
| Author | Claude Code Opus 5.5, xhigh | Backend and shared protocol implementation after design review |
| Author-2 | Codex GPT-6-Astra, xhigh | Portal provider flows in an isolated worktree after design review |
| QA | Dedicated Codex GPT-6-Astra, xhigh | Independent acceptance tests from the approved criteria |
| QA-E2E | Dedicated Claude Code Opus 5.5, xhigh | Moodle regression and available live LMS checks |
| Reviewer-A | Dedicated Claude Code Opus 5.5, xhigh | Correctness, protocol conformance, security |
| Reviewer-B | Dedicated Codex GPT-6-Astra, xhigh | Operability, maintainability, evidence, user flows |
| Docs | Dedicated Claude Code Opus 5.5, xhigh | Setup guides and small human review artifacts |

Both reviewers submit their first findings independently.
No author or Docs worker acts as QA or as a reviewer.
The Lead commits only named paths and marks tasks done only after the charter gates pass.
Record requested and effective worker models from Orca receipts.
Report a model or effort mismatch before relying on that worker's result.

## Validation boundary

Use local signed LTI platform fixtures for deterministic protocol and isolation tests.
These fixtures do not prove behavior on a real Blackboard or Canvas tenant.
Use existing authorized LMS environments when available.
Do not create third-party accounts or expose the local stack publicly without authorization.
Record unavailable live checks as unverified, with exact steps for the team.

Preserve the existing stack and unrelated containers.
Every test stack needs its own ports, network, data, and cleanup.
Do not run a destructive reset against the user's existing environment.

## Task board

| Task | Result | State |
| --- | --- | --- |
| M0 | Source review, architecture, contracts, criteria | Done for design scope; round 3 accepted and nonblocking text corrections applied |
| M0-A2 | Read-only portal and integration audit | Complete; no code or tests changed |
| M0-AU | Read-only backend and deployment impact audit | Complete; no code or tests changed |
| M0-QE | Independent environment and live-LMS validation preflight | Complete; environment inventory, no product verification |
| M1 | Shared backend and provider registration support | Provider-team implementation dispatched |
| M2 | Blackboard and Canvas portal flows | Provider-team implementation dispatched |
| M3 | Independent QA and Moodle regression | Common/Blackboard test preparation started; Canvas preparation queued |
| M4 | Guides, interactive review pack, final conformance | Planned |

## Launch evidence

Orca accepted these workers. Each receipt reports the requested model and effort as effective.

| Role | Dispatch | Effective model | Effort |
| --- | --- | --- | --- |
| Architect | `ctx_c8c00b22d5f1` | `claude-opus-5-5` | `xhigh` |
| Author-2 | `ctx_1eeade383449` | `gpt-6-astra` | `xhigh` |
| QA-E2E preflight | `ctx_3c4961a02f14` | `claude-opus-5-5` | `xhigh` |
| Author impact audit | `ctx_94cbe8647c96` | `claude-opus-5-5` | `xhigh` |
| Reviewer-A source preflight | `ctx_8546daf0903f` | `claude-opus-5-5` | `xhigh` |
| Reviewer-B workflow preflight | `ctx_6964f917fdea` | `gpt-6-astra` | `xhigh` |
| Reviewer-A formal design review (same instance) | `ctx_1d8b93c872ae` | `claude-opus-5-5` | `xhigh` |
| Reviewer-B formal design review (same instance) | `ctx_3c1ba794297e` | `gpt-6-astra` | `xhigh` |
| QA design testability review | `ctx_4d2994dbaa01` | `gpt-6-astra` | `xhigh` |

The initial Docker inventory found no running containers.
The Lead asked which existing LMS test environments are available; the answer is pending.

## M0 checkpoints

The Architect completed the first correction in `ctx_51ca18725d38`.
ADR-011 revision 5 and [the response table](../architecture/review-response-M0.md) address all 23 initial findings.
This is the Architect's resolution record, not independent approval.
The Lead froze the design at `bd9fe36` and reused the same Reviewer-A, Reviewer-B and QA instances for round 2.
The new dispatches are `ctx_e0abb11702aa`, `ctx_adcbc4bedd37` and `ctx_d667c956a9d5`, respectively.
The retained structured sessions use authoritative dispatch preambles sent through Orca messaging.
No new worker process or model replacement was created for this wave.
The gate needs two approvals, a design-testability PASS, and no open BLOCKER or MAJOR.
M1, M2 and test-writing tasks stay blocked until that gate passes.

Round 2 is complete on `bd9fe36`: both reviewers require changes and QA gives FAIL for design testability only.
The reports preserve the first round and identify which findings are closed.
The same Architect completed revision 6 in `task_ca1fae1a7570`, dispatch `ctx_2b04d15a6bc3`, from `706a278`.
The same three independent instances remain retained for the next recheck.
Round 3 tasks are queued: Reviewer-A `task_ed981aeb1a31`, Reviewer-B `task_31e336af4b46`, and QA `task_15510d66f895`.
They depend on the completed correction and will use one frozen commit.
The completion reports all round-2 corrections applied; this is not independent approval.
Revision 6 adds committed deployment approval, inactive staging, ordered attempts, and history-based cleanup.
The criteria now contain 40 M1, 13 M2, 7 M3 and 8 M4 items, including the accepted A-M0-10 deferral record.
M1, M2 and both test-preparation tasks remain blocked.
The Lead froze revision 6 at `158a4d86fb5764f597ff20e3f652ae6d5225f96b`.
Round 3 uses the same retained sessions: Reviewer-A `ctx_61b8795c3642`, Reviewer-B `ctx_3b1d667906b2`, and QA `ctx_e5ddff18c81b`.
All three received their new authoritative preambles and the same frozen handoff.
All three completed the new tasks. Both reviewers APPROVE; QA gives PASS FOR DESIGN TESTABILITY ONLY.
The [implementation handoff](multi-lms-implementation-brief.md) records the full criterion count, ownership and test boundaries.
The Lead accepts the M0 design gate at `158a4d8`: no BLOCKER or MAJOR remains.
This is not product approval or live-LMS evidence.
Architect task `task_ceecd44306c1` applies three nonblocking text corrections before the implementation handoff:
A-M0-11 narrows the accepted race to self-hosted Canvas; A-M0-12 aligns the due-time test bound;
B-M0-10 distinguishes retained approval history from effective authority.
The same contracts already define those behaviors. No protocol redesign or additional deferral is authorized.
The Architect completed these exact clarifications in `ctx_58eb42ecc1de`.
The Lead checked the diff against the accepted contracts; it changes wording only and keeps ADR revision 6.
M1, M2 and both test-preparation tasks are now ready. Product implementation and verification remain separate.

The owner asked to proceed with Canvas and Blackboard in parallel.
Neither provider waits for the other provider's live access or setup work.
Shared LTI, grant and grade code has one backend owner; portal and independent tests run beside it.
Each provider keeps its own setup cases, acceptance results, live matrix and readiness status.
The current resource limit still applies: three active workers beside the Lead, and at most two test stacks.

Author-2 completed the read-only audit in `ctx_1eeade383449`.
Messages `msg_57b462b0aec3`, `msg_c8afa054e00e`, and `msg_b3a206ea8b3f` hold the findings.
The Lead sent the contract questions and source findings to the Architect.
Main gaps include provider identity, endpoint trust, deployment binding, framing, native-feature guards, and provider-specific UI.
These are implementation inputs, not independent QA evidence.

The Author-2 instance remains idle for later implementation.
This preserves the charter's requirement to use the same dedicated author instance across tasks.
The Lead accepted its successful completion and recorded retention before acknowledging the report.

Design review tasks `task_8539cca49e29` and `task_6df3fc0172eb` depend on the Architect's M0 task.
Each reviewer will write its own report before it sees the other review.
Independent QA task `task_8b0eb55ffe6f` will check the design's testability from its acceptance criteria.

The Architect completed the revision 4 proposal in `ctx_c8c00b22d5f1`.
The completion report is `msg_e1108c37cd51`.
It covers ADR-011, both API contracts, migration and security rules, and M1 through M4 criteria.
The Lead accepted the handoff for independent review, not as design approval.
The dedicated Architect remains retained for review corrections and final conformance.
No product implementation has started.

The frozen review proposal is `51e69d1`.
Both reviewers and independent QA confirmed that they started their assigned reviews.
The runtime refused `worker-start --terminal` for retained structured chat sessions.
The Lead reused each exact reviewer session through `dispatch` and sent its returned preamble by orchestration message.
Both sessions confirmed the new dispatch. These two dispatches do not own a new supervised process.
Their original retained resources remain assigned to the same dedicated reviewer roles.

Implementation tasks are queued, but they are not authorized to start before the design gate passes.
Backend task `task_88ef41c0aea3` resumes the dedicated Author.
Portal task `task_3b1e979ab893` resumes Author-2 in its isolated worktree.
Each task depends on both design reviews and the QA testability review.
The Lead must also confirm that all BLOCKER and MAJOR findings are closed.
The portal branch will first advance to the approved design commit.

Independent test preparation is also queued behind the design gate.
QA task `task_7676dddddb02` owns the signed simulator and M1 acceptance tests.
QA-E2E task `task_732732ad5b91` owns M2 browser tests.
Both write tests from approved criteria before reading author code.
Test preparation is not a product PASS; later runs use an exact candidate SHA.

The two dedicated reviewers started read-only preflights while the Architect revised M0.
Tasks `task_5029938ab2e4` and `task_843b9fd4f001` check stable vendor facts and setup workflows.
These tasks are not formal design approval. The reviewers remain independent.
They will reuse the same instances for the formal design review.

Reviewer-B completed its preflight in `ctx_6964f917fdea` without changing files.
The Lead sent B-PF-01 through B-PF-09 to the Architect.
This is not design approval. The same dedicated reviewer is retained for the formal review.

Reviewer-B completed its first formal review of `51e69d1` in `ctx_3c1ba794297e`.
Its verdict is CHANGES_REQUESTED: four MAJOR recovery and upgrade findings, plus two MINOR inconsistencies.
Independent QA completed the design testability review in `ctx_4d2994dbaa01`.
Its verdict is FAIL FOR DESIGN TESTABILITY ONLY, with six MAJOR gaps and three MINOR clarifications.
Their reports are [Reviewer-B](../reviews/M0/reviewer-b.md) and [QA](../reviews/M0/qa.md).
Both dedicated instances remain retained for recheck.

Architect correction task `task_76b235e74210` follows the three first reports.
The recheck tasks are `task_2e2307b7f7fe` (Reviewer-A), `task_f5a737f0a439` (Reviewer-B), and `task_f0190c5eafe4` (QA).
The initial task completions do not open the implementation gate when their verdicts require changes.
The queued M1, M2 and two test-preparation tasks are explicitly blocked in Orca until that gate passes.
The Architect confirmed correction dispatch `ctx_51ca18725d38` in the same dedicated instance.
The first reports and Lead correction directions are committed at `74de92c`.
Local dependencies are installed in both author worktrees. No product check ran as part of that preparation.

Reviewer-A completed its first formal review in `ctx_1d8b93c872ae`.
Its [report](../reviews/M0/reviewer-a.md) requests changes: one BLOCKER, one MAJOR, three MINOR and three NIT findings.
The blocker is self-hosted Canvas entering through the standard Moodle path without approval.
The MAJOR finding requires operator containment and correction of a redeemed binding.
All three first reports are complete. No design approval or product verification is implied.

Reviewer-A completed its source preflight in `ctx_8546daf0903f` without changing files.
The Lead sent A-PRE-01 through A-PRE-06 to the Architect in `msg_9328b2a6abc6`.
The same dedicated reviewer is retained for the formal review.

The Author completed the backend audit in `ctx_94cbe8647c96`.
Messages `msg_7b0385efd7e4`, `msg_a49edfb39d36`, and `msg_f0556212f33f` hold the findings.
The Lead sent them to the Architect and retained the same dedicated Author for implementation.
The findings cover deployment ownership, disconnect effects, stored keys, migration safety, and issuer-versus-site assumptions.
They are implementation inputs, not independent QA evidence.

QA-E2E completed [the environment preflight](../reviews/M0/qa-e2e-preflight.md).
The Lead accepted its report and retained the dedicated QA-E2E instance for the later regression task.
The VM has 7.75 GiB of memory. Seven existing Docker volumes belong to earlier work and must remain intact.

## Test environment decisions

Proceed with signed platform simulations and real Moodle regression first.
Assess local Canvas alone after those checks; do not change Docker Desktop settings.
Local Canvas and hosted Canvas are separate evidence levels.
Hosted Canvas and Blackboard validation still need confirmed access and a reachable tool configuration.

QA owns simulator behavior, signing fixtures, and score oracles under `tests/**`.
The Author owns required infrastructure and test transport plumbing.
Test overrides must stay unavailable in production.
A simulation must not impersonate real vendor hosts through DNS or certificates.

| Test lane | Project prefix | Port | Subnet |
| --- | --- | --- | --- |
| QA acceptance | `qa-multi-r` | 8443 | `172.29.0.0/16` |
| QA-E2E Moodle | `qa-e2e-m3-r` | 8543 | `172.31.0.0/16` |
| QA-E2E provider simulation | `qa-e2e-sim-r` | 8643 | `172.27.0.0/16` |
| Author smoke, when needed | `cogniate-multi-author` | 8743 | `172.26.0.0/16` |

Check availability again before each run. Run at most two stacks at once.
Cleanup of a worker's own temporary stack, clone, secrets, traces, and test image is authorized.
Preserve redacted evidence first. Never remove existing volumes, shared base images, or another worker's resources.

## Design requirements from the Lead

Public issuer, client, and deployment IDs do not prove that a library controls an LMS installation.
New Canvas and Blackboard bindings need a verified approval or proof step before activation.
This includes additional Canvas deployments.
Typing another institution's public deployment ID must not claim its launches.
This protection is in scope. It is not an accepted deferral.

The Lead selected trusted-operator approval for this prototype.
The operator verifies installation authority outside the portal.
The operator issues a one-time expiring grant for the exact library, connection, provider, site, client and deployment.
The app must redeem that grant atomically before it activates the binding.
Normal LTI validation will not gain an exception for unbound deployments in this phase.
The Architect must define the trust boundary, recovery steps and negative tests.

The Architect accepted this direction in `msg_6bf730b0e5a7`.
Canvas uses Paste JSON setup and graded assignment selection in this phase.
Ungraded Canvas module items are deferred; the existing grade policy stays unchanged.
The final design must separate hosted Canvas evidence from local Canvas evidence.
Rollback uses coordinated, verified backups and restores; it must state the lost-write consequences and pass QA.

Canvas will have one configured page origin and one configured service origin, which defaults to the page origin.
The operator grant must bind both. No wildcard or arbitrary alias list is in scope.
Canvas AGS, NRPS and token requests use the service origin; Deep Linking and framing use the page origin.
The Canvas simulator must use its actual `iframe` launch claim, including new-tab launches.
A top-level Canvas embedded page will continue to its player; a framed page keeps the open-in-window step.
The final design must define permanent handling of upstream HTTP 422 and retain the existing policy for HTTP 400.

The acceptance criteria must cover first-claim squatting, cross-library redemption, replay, disconnect, and old stored service keys.
Disconnecting one deployment must not stop another institution or reactivate old authority through a later binding.
Keep existing Moodle IDs and service keys valid across migration.

M1 includes `apps/player/**` for provider-aware learner text, as well as services, packages, and infrastructure.
M2 owns only `apps/portal/**`.
Preserve anonymous identity and the existing grade policy.
Canvas dynamic registration, billing, high availability, public deployment, and certification are outside this phase.

## Direction for the first design correction

Keep the operator-grant model and close the alternative registration path found by Reviewer-A.
The `standard` profile must not let a real self-hosted Canvas launch bypass the required approval and privacy rules.
Preserve legitimate Moodle launches. The Architect must state the exact signed evidence and refusal rule.

Add a bounded operator procedure to recover an incorrectly approved binding.
It must revoke old authority before any corrected binding can activate.
It must not transfer old publications, attempts or grades to another library.
This is an operator recovery path, not general self-service reassignment.

For Q-M0-04, narrow the third-host claim to what the trusted inputs can establish.
Specify Deep Linking return checks, browser frame restrictions and top-level resource launches separately.
Do not add browser Referer checks as ownership proof.

The one-page-origin and one-service-origin rule applies to self-hosted Canvas too.
Its issuer remains the configured page origin. Test a distinct approved service origin explicitly.
Define one canonical URL representation before storing values and comparing approval grants.

QA's internal transport fault barrier is authorized only in the acceptance environment.
The Author owns its infrastructure; QA owns the scenarios and assertions.
Use fixed local transport endpoints and explicit gates. Do not weaken production URL checks.

Split default-profile T7 from legacy acceptance suites that need their existing fixtures and knobs.
Use the new revision's maintenance commands while both old services remain stopped.
Validate the complete backup before replacing either database, including sidecars and backup identity.

## Direction for the second design correction

Resolve these groups together. A passing remote call alone does not prove that an app binding was approved.

| Required correction | Finding ids |
| --- | --- |
| A Canvas deployment has app launch and grade authority only after its own approval commits. Separate a finalized repeat from an active orphan. Retry, cancellation and cleanup must keep the existing approved deployment working. | B-M0-07 (BLOCKER), Q-M0-R2-03 |
| An older or cancelled attempt cannot adopt a newer attempt's ref. Adoption must atomically establish or validate the required active state, including compensation between its read and write. | B-M0-03 |
| Persist each attempt's target and locate unfinalized Canvas platforms through that history. Suspend and release use an owned remote ref even when the connection has no final platform id or ref. Preserve newer and foreign bindings. | A-M0-09, B-M0-08, Q-M0-R2-02 |
| Separate live overlap within the five-second call from a timed-out late write and a dead handler's lease. Define gate request ids, phases and delivery after caller disconnect. Give executable schedules and explicit cleanup owners. | B-M0-09, Q-M0-R2-01 |
| Align encoded-id inputs, fixed-deployment error precedence and the due-time behavior of disabled score rows. | Q-M0-R2-04, Q-M0-R2-05, Q-M0-R2-06 |

The two reviewers differ on whether the current fence is complete.
The concrete schedules in B-M0-03 and B-M0-07 remain required corrections.
The next independent rechecks must trace those schedules explicitly.
Keep the existing production timeout and security checks; do not add a test bypass to make an unreachable schedule pass.

A-M0-10 is an accepted MINOR deferral under charter §5 for this prototype.
After release, an authenticated library can race the rightful Canvas owner by making a new standard-profile record with the same public identifiers.
Signed product-family checks still refuse its Canvas launches before claim storage.
This can block setup; it does not authorize Canvas access.
Correct the false claim that every later binding must use a grant.
Document the operator order and residual race without claiming that prompt redemption prevents it.
Protection against repeated hostile registration needs a later reserved-identifier or quarantine design before an enterprise service relies on this workflow.
The Architect must record this limit in the ADR, response and guide requirements.
Docs must carry it into `docs/human_review/deferred.md` in M4.
This deferral does not waive any BLOCKER, MAJOR or functional recovery check.

The Architect proposed the second correction in `msg_b3037b65604e`.
The Lead directed it to proceed in `msg_c1e60694db20`; this is not independent approval.
The proposed shape uses one attempt lease per connection, changing refs on conditional writes, inactive staging, committed deployment approvals, and saved attempt targets and ref history.
The final contracts must distinguish denied app authority from a remote record that still needs cleanup.
They must also define exact generation changes, replacement-request refusals, discovery of late records, and preservation of another connection's binding.
