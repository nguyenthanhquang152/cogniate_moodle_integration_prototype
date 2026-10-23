# P4 dispatch: lead QA (Antigravity): Part A slot 3B record correction (host only), then Part B DOCKER-YES wave-end slot 7

Same terminal session and rules. The Lead committed your slot 3B files (integration b57a6fc8). Do Part A first (no Docker). Start Part B only after Part A is saved.

## Part A: correct the slot 3B record (host only, about 15 min)

The Lead compared docs/reviews/LA-E7-08/qa.md with the summary.json files of qalead-la-10..15. The report leaves out FAIL rows and overstates two phases. A held report changes only by a disclosed append: change line 1 to "Verdict: FAIL (Lead review §5, <UTC time>; was PASS)" and append "## 5. Lead review correction (<UTC time>)". Do not edit the earlier sections. Run `date -u` before you write a time.

§5 must hold:
1. Exact accounting per run, from each summary.json `results` (status counts, then every non-PASS id with its note):
   - qalead-la-10 (G1-G4): 9 PASS.
   - qalead-la-11 (M1 migration): 10 PASS; M3-ISOLATION FAIL ("containers changed: 2; volumes changed: 7246e7fe..., 7269f289...").
   - qalead-la-12 (M1 snapshot-upgrade): M1-38.common.h1..h5 PASS; ERROR FAIL (the LTI ledger assert: actual 001..021, expected 001..004); M1-41.common.j-snapshot did not run; M3-ISOLATION FAIL (volume a25d24d5...). So AC-LA-E7-08-04 is FAIL, not PASS.
   - qalead-la-13 (U1): 37 PASS, 6 INFO.
   - qalead-la-14 (M1 sim): 376 of the 394 manifest rows PASS, 18 FAIL, plus the aggregate ERROR row ("Required case is not PASS: M1-24.common.event-shapes"). Say if any manifest id is missing.
   - qalead-la-15 (M2): 64/64 cases PASS; M3-06-M2 FAIL ("volumes 32 -> 34; containers 0 -> 2").
2. The M3 global-state rows: TEST-STRATEGY §5.4 says "A foreign container or volume is noted, not a FAIL". Record each as an environment note with its cause. The Lead's docker events watcher (/tmp/la/docker-events-watch.txt, read only) shows 288 container creates between 16:56Z and 17:49Z that are not qalead-la-*, all of them sto-* (the Savoy run), each with an anonymous volume. Cite it, and give the 32 protected volume inspect result. Never omit such a row again.
3. Correct the cause of the 9 rate-limit rows: the bucket is class `admin` (17:17:13.114Z rate_limited {class: admin, key_kind: api_key, tool_account_id: cogniate}); the limiter is LA-E5-03 (lane S1), not LA-E5-04.
4. Disclose the amend: at 17:50:58Z, after the stack went down, you amended the frozen gate test commit 8ad12926 into 9e78fe3f (two files edited at 17:50:44Z and 17:50:46Z: 11-canvas-platforms.test.ts:247 regex; tests/host/m1-migration.mjs:332 LTI migration folder store/migrations -> db/migrations). Every slot 3B run used 8ad12926, so the slot evidence stands. "Fixed in 9e78fe3f" is not correct: an unreviewed test change is not a fix. Never amend or rewrite a gate test SHA; a change is a new commit after review.
5. Findings table (id, rows, owner, state): WE-F1 9 rows 429 admin bucket (A2 decides, then lane S1; product fix); WE-F2 M1-24.common.event-shapes `tool_account_id` on launch_claims_minimized (A2 decides); WE-F3 M1-15.canvas.dynamic-refused regex (A2 confirms the value, then both reviewers approve your addendum); WE-F4 7 M1-37 rows at 77.0-77.9 s (pending the slot 7 baseline per test id); WE-F5 snapshot-upgrade ERROR and the missing M1-41.common.j-snapshot (your runner path fix; reviewers).

Also in Part A:
- In your clone src-wave-end (your run folder, not la-qa): `git tag la-gate-test-8ad12926 8ad12926`, `git tag la-proposed-addendum-r1 9e78fe3f`, then `git checkout --detach 8ad12926`, and show `git status --short` is empty. Slot 8 uses 8ad12926 until the Lead names a new test SHA.
- Write the proposed addendum in la-qa: docs/reviews/LA-E7-08/ld9-addendum-r1.md: the exact diff `git diff 8ad12926 9e78fe3f`, and for each hunk the type (LA-IC-14 test-change list item; or runner change with no assertion change, AC-LA-E7-08-05), the reason and the wave-end evidence. Do not apply it anywhere.
- tests/ltiaas/GATE-RUN-PLAN.md slot 7: remove the "in parallel" option. One LA stack at a time: Run 7A, then Run 7B after 7A is fully down. Legacy T1-T8 are not in this window.

## Part B: DOCKER-YES wave-end slot 7 (intake 1b17261: LA-E0-02 baseline + LA-E0-04 LD-1 parity)

DOCKER-YES: window from the end of Part A (not before 18:25Z) to 20:05Z. One stack at a time; only qalead-la-16..20; Run 7A on PUBLIC_PORT 9643, STACK_SUBNET 172.22.0.0/16; Run 7B (T7x3) on 9543, 172.21.0.0/16, after 7A is fully down. Before/after Docker records (umask 077: docker ps -a, networks, the 32 volume records with inspect); owned-only cleanup; a host ps watcher from launch; also start your own `docker events` watcher at launch (read only) so you can name each foreign change. Never touch the sto-* containers; list them apart.
Source: /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-slot7-1b17261 at 357d1799 (1b17261 + the LD-1 files of f0a7b306 + the qalead-la prefix guard; the Lead checked it is clean). Do not change it.
Run the core of slot 7 as GATE-RUN-PLAN §4 says: 7A M1 sim, M2, M1 migration, M1 snapshot-upgrade, rate-peaks.mjs and the docker stats peak; then 7B T7x3. No legacy T1-T8.
For WE-F4, in the 7A M1 sim report: the result and the duration (ms) of each of the 18 slot 3B non-PASS ids on 1b17261 (all 7 M1-37 rows first), the restart wall time if the runner logs it, and the number of sto-* container creates during the M1-37 cases (from your watcher). Do the same exact accounting as Part A item 1 for every run, and the same M3 environment notes.
If a suite fails, finish the slot's other suites, then report; do not change product code or the source.
When done, send "lead QA stack down" with the records at once; then worker_done with docs/reviews/LA-E0-02/qa.md, docs/reviews/LA-E0-04/qa.md, docs/reviews/LA-E7-08/qa.md (§5), docs/reviews/LA-E7-08/ld9-addendum-r1.md and tests/ltiaas/GATE-RUN-PLAN.md. The Lead checks your counts against the summary.json files.
If I send PAUSE DOCKER, finish the running suite, bring your stack down and wait.

## DOCKER BAN (stop-the-line rule)

LA is HOST-ONLY until the Lead sends an explicit Docker window. Another run on this machine has exclusive Docker windows, and two LA overlaps already broke its validation. Do NOT run docker, docker compose, npm run stack:*, any host runner that starts a stack (tests/host/run-*.mjs, run-golden.sh, run-api.mjs against a stack), or any script that calls them. Before any command that might touch Docker, ask the Lead with the preamble ask command. A Docker command before the window is a stop-the-line violation: the Lead stops your session. Work that needs a stack is recorded as "pending: Docker window".

# Common rules for LA build test authors (P4: QA, QA-2, QA-3, QA-4)

Milestone LA. You are an independent QA test author (Claude Code Opus 5.5, effort xhigh). You are never an Author, Architect or Reviewer. The Lead coordinates Orca run run_06d07dc77faf.

Read first: CLAUDE.md; docs/team/charter.md; docs/team/ltiaas/charter-LA.md; docs/team/ltiaas/plan.md §6.1 (LD-1..LD-19; LD-18: you write docs/reviews/LA-<task>/qa.md for your tasks); tests/ltiaas/TEST-STRATEGY.md; docs/architecture/ltiaas/tasks/README.md §2 (your folder, your compose project prefix, the allowed command forms (a)-(k)), §3 (public surfaces), §6 (evidence); the task specs in your brief.

Workspace: the shared QA worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa (branch nguyenthanhquang152/la-qa). Write only in your own folder (tasks README §2 table) and, for each task you verify, docs/reviews/LA-<task id>/qa.md. Do not commit, stash, checkout or reset; the Lead commits by path.

Test-first: write each test from the task spec ACs, the contracts and the design only. Do not read Author notes, Author worker_done bodies, the Authors' lane branches or product source code to write tests (memory rule: QA never greps service source; use contracts, design, tests and infra for facts). If you read product source by mistake, disclose it in qa.md and in your worker_done.

Runs: when the Lead gives you an integration SHA to verify, clone that SHA into a NEW folder outside the repo (for example ~/cogniate-qa-runs/LA/<task>/r<round>/) with `git clone --no-hardlinks`, use only your own compose project prefix (tasks README §2) with its own PUBLIC_PORT and STACK_SUBNET, and run there. Docker: check `docker ps` and free memory first; another run's QA uses Docker on this machine (projects qa-multi-*): never touch, stop or remove containers or volumes you did not create; if memory is short, ask the Lead for a slot. Remove your own stack at the end. Private evidence (secrets) stays in the run folder, born with umask 077.

qa.md (one per task, per round; base charter §6): first lines "Verdict: PASS | FAIL" and "Round: n"; the SHA; one row per AC (PASS, FAIL or pending; test id; command; artifact path); the measured time of each new suite. Keep it short and proportional (charter-LA §5).

Done report (one worker_done, --outcome succeeded even when the verdict is FAIL; the verdict is in qa.md): three sentences: what you wrote or ran, the verdict and counts, what is left. --files-modified, --report-path. Then stop. Next tasks come as new dispatches.

Orca: follow your preamble; heartbeats at its cadence; read only your own messages at each checkpoint. Messages from a shell: body from a file, "$(cat file)". STE (about 80%).
