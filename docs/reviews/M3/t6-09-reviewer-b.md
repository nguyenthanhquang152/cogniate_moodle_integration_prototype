Verdict: APPROVE
Round: 1

# M3 R3 keyboard-focus repair (AC-T6-09), C8 and v4 launchers: Reviewer-B (lens B: can a human team own it?)

Reviewer: independent Claude Opus 5.5 xhigh Reviewer-B. Task `task_ca18cab27865`, dispatch `ctx_1ee4a4300f70` (retry of the stopped dispatch `ctx_46e72195723f`), run `run_ebe671ad72a9`.
Date: 2026-10-22, about 16:06–16:29 UTC.
Scope: the held R3 plan, the committed C8 test delta, the held v4 launchers and the eligibility of the proposed bounded evidence route.

The verdict APPROVE covers plan, source, launcher and eligibility review only. It is NOT runtime acceptance.
The C6/C7 legacy attempt stays FAILED. E-T5R stays VOID. No runtime row passed on C6/C8.
The accidental legacy start at 15:58:56 UTC is UNAUTHORIZED/STOPPED and VOID. I accept none of its files as runtime evidence.
The bounded route is eligible on its three proof conditions (§6). Only the Lead can renew it. All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.
Findings: 0 BLOCKER, 0 MAJOR, 6 MINOR, 5 NIT.

## 0. Independence and method

- I did not read Reviewer-A's report, findings or preliminary feedback for this task. The stopped Reviewer-B attempt left no file, so this file has no earlier round.
- I read the charter, the plan, the C7→C8 diff, the C6 portal source that the plan cites, the test libraries, QA report §14, the QA R3 v2 evidence root, the v3 and v4 tool folders, the v4 prep pack and the stopped-run closure ledger.
- I checked the recovered failure trace read-only. I parsed its action log with a private script. I redacted the dev password values and deleted my extracted copies after use. The original `trace.zip` is unchanged.
- I ran one offline typecheck: `tests/node_modules/.bin/tsc --noEmit -p tsconfig.json` on this worktree (tests tree = C8 `65eaefab…`). Exit 0, empty log, both changed files in `--listFiles`.
- I ran no Docker, browser, Playwright, launcher, npm or network command. I changed no product, test, architecture, team or guide file. I did not touch `pnpm-workspace.yaml`.
- Private evidence: `/Users/quangnguyen/cogniate-review-runs/t6-09-reviewer-b-task_ca18cab27865-20261022T1607Z` (folders 0700, files 0600, script 0700).

## 1. Identities (verified by me)

| Item | Value |
| --- | --- |
| C4 | `bf09cdad91ca548e1ecbc14428b55180d35d5360`, tests tree `8283d90d…` |
| C6 product | `4008afb92fe983d52db33442e060210b929966c8` |
| C7 tests | `620c03d0697c72b80649d2e77a52594ad0d282f3`, tests tree `3e9368bb61d02c2cc6c3838b4aaeaedd28fffd71` |
| C8 | `5561e8f72a83de36a68877c6b26ffc8288ade735`, root tree `1c61dbf285e5c6d6505c28059d8c2f8e313be613`, tests tree `65eaefab31ec6800fca06aee50e5e25c95713f8a` |
| `tests/acceptance/T6/5-xss-a11y.spec.ts` at C8 | 7,832 B, `5701ce97e99166adca51e1e26aef9f73abe946981066d42e47d9e08f1522f17b` |
| `tests/e2e/M2/06-keyboard-axe.m2.ts` at C8 | 9,927 B, `c15b15a9bfb3b3fff005e23bea5f31e0231ae8b93da89337f0e31e41e645da3c` |
| C7→C8 `tests` patch | 9,582 B, `e1374382…2723`; byte-equal to QA `r3-test-repair-v2-20261022T1544Z/diffs/c7-to-r3v2-tests.patch` |
| QA R3 v2 root | `MANIFEST.sha256` `01f46f98…7b47`; I verified 7/7 entries (bytes and SHA-256) |
| Plan | `docs/reviews/M3/t6-09-failure-plan.md`, 13,356 B, `ece4248b…ff0` |
| v3 launchers | legacy 12,017 B `7e161c4283e7…80e8`; SIM 12,159 B `2e545b8bf108…600b` |
| v4 legacy launcher | `tools/launch-legacy-c6-v4.sh`, 12,455 B, 0700, `9d03a98ec2569bd86a20dc366268716a20aba1f32b7e964f7683b3db8d6ef9e7` |
| v4 SIM launcher | `tools/launch-canvas-sim-c6-v4.sh`, 12,597 B, 0700, `d812874703f2224fe891a67ea104c2a2af39b6c41b19d5316c31485a6220f7b9` |
| v4 index | `evidence-index-v4-prep.tsv`, 11,197 B, `dd1b040f…0aa37`; I verified 90/90 entries (bytes, SHA-256, mode) |
| v4 clean source | `V4/c8-clean-src/source`: HEAD C8, root tree `1c61dbf2…`, tests tree `65eaefab…`, clean, no `.env`, no `tests/host/artifacts`, push URL `DISABLED-no-push` |
| Stopped-run ledger | `V4/unauthorized-stopped-guard-escape-20261022T1558Z/public/CLOSURE-LEDGER-UNAUTHORIZED-STOPPED.json`, 9,426 B, `1081d6d6…cdf3` |
| Common QA binding | `task_0b7729855fc5` / `ctx_72afbef88d8c` / `term_7b4cc382-f802-483a-b07e-ef8412293cb9` |
| Messages | Common QA `msg_3c16d20a1d2b` (to this dispatch); Lead `msg_c9a4003ebc70`, `msg_ad135c1720fb`, `msg_0ac76a186648` |

Git facts:

- C8 equals C6 outside `docs/**` and `tests/**` (empty diff).
- C7→C8 under `tests/**`: exactly the two R3 files, 33 added lines, 0 deleted lines.
- C4→C8 under `tests/**`: exactly `T6/3-courses.spec.ts`, `T6/5-xss-a11y.spec.ts`, `T8/2-shell.spec.ts`, `e2e/M2/06-keyboard-axe.m2.ts`. C4→C8 outside `docs/**` and `tests/**`: exactly the four R1 and README paths.
- `HEAD` (`da7b451`) equals C8 outside `docs/**`.

## 2. Plan review (`t6-09-failure-plan.md`, `ece4248b`)

Result: no BLOCKER and no MAJOR. A human team can own this plan. It names one owner (QA), two files, add-only limits, forbidden tools and a validation table with an owner for each check.

- **Settle rule.** I checked it against `apps/portal/src/App.tsx:243-273` at C6. The observer and the `requestAnimationFrame` callback are registered in one synchronous block (`:263-268`). So when the route heading has focus, the pending callback is already queued or has run. A later test callback runs after it, because callbacks run in the order of registration. After that, the Frame moves focus again only on the next route change.
- **Named headings.** `Connect Canvas` → `Manage Canvas` and `Connect Blackboard` → `Manage Blackboard` have different names. So a stale focus from the earlier route cannot satisfy the wait. The names match `Connect.tsx:44-46` and `lms.ts` (`Moodle`, `Canvas`, `Blackboard`).
- **No deadlock.** No Canvas or Blackboard form uses `autoFocus` or calls `focus()` on mount (`git grep` at C6). So nothing takes focus from the heading after the data load, and each wait can succeed.
- **Course page.** The plan's correction in §4 is right: the course heading and the opener mount after the course data, so a late focus move can come after `tabTo(opener)`.
- Plan text issues are MINOR or NIT: `B-M3-T609-08` (C8 already fixed it) and `B-M3-T609-10`.

## 3. Recovered failure evidence (independent check)

- The three files exist at the path that the Lead gave. Bytes and SHA-256 match: `trace.zip` 9,290,291 B `5b655b00…`, `test-failed-1.png` 203,557 B `ec8611fd…`, `error-context.md` 4,880 B `db20ba6d…`. Their mtimes are 15:06:34–15:06:37 UTC, just after the test end (15:06:35.613Z).
- The trace context `wallTime` is 15:06:15.177Z. The course part and the wizard part follow the spec lines in order.
- `error-context.md` (the page at the failure): the name field holds the full `QA keyboard mvjobraz`. The `Moodle site URL` field is **empty** and **[active]**. "Automatic (recommended)" is checked.
- Trace actions: one `Tab` reached the URL field (15:06:19.235), then `keyboard.type` sent 24 characters (15:06:19.238, 12 ms). Then `tabTo(name)` needed **one** forward `Tab`. One forward `Tab` reaches the name field only from the heading area. From the URL field, it goes to the radios.
- Conclusion: focus left the URL field after `tabTo` saw it there and before the first URL key. All URL keys went elsewhere. Enter then met native validation, so no POST was sent. This agrees with QA §14.1(3). Which callback moved focus (observer or animation frame) stays an inference.
- Limit: this shows a real keyboard-input loss in a short window after a route render. I do not claim that a human can never hit it (see `B-M3-T609-06`).

## 4. C8 diff review

### 4.1 Exactness and limits

- Add-only: 33 lines, 0 deletions. No C7 line changed. The `:117` registration assertion keeps `{ timeout: 15_000 }`.
- My scan of the 33 added lines found no `test(`, `m2Case(`, `describe`, `.only`, `.skip`, `.fixme`, `.slow`, `setTimeout`, `waitForTimeout`, `retries`, `timeout`, `.fill(`, `.click(`, `.focus(`, `.press(` or `.type(`.
- Titles cannot change, because no added line declares a test. QA's T6 (18) and M2 (64) inventories (`44ec3a04…`, `4fc54d6e…`) agree. I did not run `--list` myself.
- Both configs keep `retries: 0` and `expect.timeout` 15 s (`tests/playwright.config.ts:19,22`; `tests/e2e/M2/playwright.config.ts:13,16`).
- Two changes go beyond the plan, and both improve it. (1) Each settle wait and value check has a readable message. (2) The three approval-code checks use a boolean `expect.poll`, so a failure does not print the one-time code. This keeps the AC-M3-07 hygiene that `tests/e2e/M2/playwright.config.ts:23-26` relies on (trace and screenshot off).

### 4.2 Every keyboard route transition in the two files (C8 lines)

| File | Route change | Keyboard input after it | Settle | Value check |
| --- | --- | --- | --- | --- |
| T6 | `goto` course `:90` | Tab to opener, Enter `:93-94` | `:91` (any `h1`) | — |
| T6 | Enter → `/publish` route | Escape `:96` | Not needed. The Frame focus returns early while `dialog[open]` exists (`App.tsx:246-250`). The dialog effect (`ui/dialog.tsx:19-22`) runs before the parent Frame effect. | — |
| T6 | Escape → course route, `state.focus = publish-opener` (`CourseDetail.tsx:90-94`) | None. `:98` `toBeFocused` retries. | — | — |
| T6 | `goto` Moodle connect `:102` | `:104-116` | `:103` `Connect Moodle` | `:106`, `:109` |
| M2 | `goto` Canvas connect `:54` | `:57-63` | `:56` `Connect Canvas` | `:58`, `:60` |
| M2 | Enter → `/integrations/canvas/{id}` (`Connect.tsx:63`, state has no `focus`, so target = `main h1`) | `:67-76` | `:65` `Manage Canvas` | `:68`, `:70`, `:75` |
| M2 | `goto` Blackboard connect `:83` | `:86-90` | `:85` `Connect Blackboard` | `:87`, `:89` |
| M2 | Enter → `/integrations/blackboard/{id}` | `:94-101` | `:92` `Manage Blackboard` | `:95`, `:100` |
| M2 | `goto` Canvas detail (add deployment) `:108` | `:111-115` | `:110` `Manage Canvas` | `:112`, `:114` |

- The failed saves (`:71`, `:96`) do not change the route. The binding forms contain no `navigate` call, so the Frame effect does not run again.
- The other key presses follow a click and a dialog wait, not a keyboard-only claim: Escape at T6 `:47` and `:83`. A modal dialog closes on Escape where focus is in the page. The M2 axe cases use helpers with no keyboard input (`tests/e2e/M2/lib/m2.ts` has no `keyboard.` call).
- All typed fields keep the raw value. The create forms are uncontrolled, and the bindings store `event.target.value` (`CanvasBinding.tsx:51-59`, `BlackboardBinding.tsx:43-47`). All `maxLength` limits are 100 or more.

### 4.3 Test strength

- Stronger: a focus loss now fails at the exact line with a clear message (for example "the typed site URL stays in the focused field"). The Playwright call log names the focused element. Before R3, the failure came about 15 s later at `:117` with "element(s) not found".
- This is most useful in M2: M2 keeps no trace or screenshot, so the message is the only failure evidence.
- No hidden timing change: each settle point waits for an event plus one frame. A passing run gets about one frame longer. A failing settle point fails after the default 15 s, inside the test timeouts (T6 240 s by `test.setTimeout`; M2 240 s by the `m2Case` default).
- What the tests no longer show: they now wait for the portal's focus move. So no test can detect the product race any more. This is correct test design, but the product issue must stay visible (`B-M3-T609-06`).

## 5. v4 launchers

- `diff -u` v3→v4 (both launchers), done by me: only (1) the header and usage text, (2) `FROM/TASK/DISPATCH` → the current Common QA binding, (3) test SHA C8 and tests tree `65eaefab…`, (4) the guard set and messages, (5) the C6/C8 labels in the gate message and logs.
- New guards: C7→C8 is exactly the two R3 paths. C5→C8, C6→C8 and C4→C8 are exactly the four-path union. C4→C5 (three D-T6L paths) stays. The product, README and C4→C6 guards are unchanged.
- Legacy v4 against SIM v4: only the `CMD` line (`--phase legacy` against `--phase sim --provider canvas`) and labels differ. This matches the v3 pair.
- `V4/tools`: the 35 v3 files are byte-identical. The only additions are the two v4 launchers. So the observer, live-boundary (W1–W4), strict compare, clone-guard, secret-scan and cleanup tools are the qualified v3 bytes. The baseline path `ORIG` is unchanged.
- The held commands use `umask 077 && test ! -e <fresh root> &&`, the clean source and C6/C8. The three fresh roots (`legacy-c6`, `canvas-sim-c6-r1`, `canvas-sim-c6-r2`) were absent at 16:18:30 UTC. Retries: none (single invocation, `retries: 0`).
- Stopped-run account: the root cause was QA's helper (`args.length === 3` appended a fourth argument), not a launcher defect. `ROOT="${4:?run root}"` with `set -u` rejects a missing fourth argument. The original `run-1` folder and its V4 mirror are byte-equal (`diff -rq` exit 0). I read its W4 strict compare (`problems: []`) and secret scan (`problems: []`) summaries. The ledger records that the 32 full volume records match the earlier W3/W4 records. The Lead accepted that cleanup. It ended during setup and seed, before any test (no result file in the preserved artifacts). So it adds no new test failure. Gaps in the record: `B-M3-T609-03` and `B-M3-T609-04`.

## 6. Bounded-route eligibility (proof conditions only; the Lead decides)

| Condition | Result | Evidence |
| --- | --- | --- |
| (a) C8 = C6 outside `docs/**`, `tests/**` | PROVEN | Empty `git diff`. Launcher guard `C8 product/non-doc paths differ from C6`. |
| (b) Changed tests are not read by the M1 row phases | PROVEN for `--phase sim/full` rows, with one wording correction (`B-M3-T609-02`) | Vitest includes only `acceptance/M1/<owner>/**/*.test.ts` (`tests/acceptance/M1/vitest.config.mts:25-26`). Under `QA_TASK=M1`, Playwright matches only `M1/**/*.spec.ts` (`tests/playwright.config.ts:9,15`; `run-api.mjs:2-7`). No M1, lib or host file imports from `T6/` or `e2e/`. Only `tests/e2e/M2/manifest.json` names the M2 file. |
| (c) V1/V2 reach evidence and full2 mapping unchanged | PROVEN at the record level | Product C6..C8 unchanged. `tracker-repair-qa.md` is append-only: each of its four earlier committed versions (`2242495`, `b60a8ee`, `9b93a35`, `23667bd`) is a byte prefix of the C8 version. §6, §9 and §10 are unchanged. I did not re-audit the private V1/V2 raw roots. |

- The counts are consistent: 258 = 251 non-browser + 7 browser = 26 common + 232 Canvas. 488 − 258 = 230 carried C4 rows at most. 233 = 232 Canvas + 1 carried snapshot.
- The C4→C8 test delta has no M1 file. So the carried M1 rows ran the same M1 test code.
- The stopped run gives no failure that voids a renewal. It is still not evidence.

## 7. Findings

| Id | Severity | File:line | Problem | Evidence | Minimal correction |
| --- | --- | --- | --- | --- | --- |
| B-M3-T609-01 | MINOR | `docs/reviews/M3/tracker-repair-qa.md:603-604` | The tracked QA record binds the first R3 version, not the committed C8 files. | §14.2 gives 7,745 B `b7d97326…` and 9,031 B `a149c994…`. C8 has 7,832 B `5701ce97…` and 9,927 B `c15b15a9…`. The v2 proof exists only in a private root and Lead messages. | QA appends a disclosed section that binds C8 to the v2 hashes, patch `e1374382…` and v2 manifest `01f46f98…`. Do this before the runtime QA report. Do not rewrite §14. |
| B-M3-T609-02 | MINOR | `tests/host/run-m1.mjs:201-217`, `:228-241` | The route condition "no M1 runner reads the changed files" is false as worded. | `--phase legacy` runs `run-t5.mjs --tasks T5a,T5b,T6`, so it reads `5-xss-a11y.spec.ts`. `installTests` archives the whole tests tree, so both files are present but not loaded. The Lead acknowledged this in `msg_ad135c1720fb`. | The renewal text says: "no M1 sim/full row phase loads them; the legacy phase runs T6 and is fully fresh". Cite the lines of §6(b). |
| B-M3-T609-03 | MINOR | `V4/unauthorized-stopped-guard-escape-20261022T1558Z/public/CLOSURE-LEDGER-UNAUTHORIZED-STOPPED.json`; same root `public/launcher.log:8-14`, `public/full-run-exit.json` | The closure record does not name the VOID gate message. It also does not mark which lines QA wrote. | The run sent `msg_2f257a8675cf`, "Pre-launch gates PASS; starting C6/C8 legacy run", with the live task and dispatch IDs. The ledger, READY and index do not name it (grep count 0). Log lines 8, 10 and 14 are not launcher formats. The `status` field in `full-run-exit.json` is not a launcher field. | QA appends a disclosed note to the stopped-run record: `msg_2f257a8675cf` is VOID, and these lines and fields are QA-written. The Lead binds an authorized run only by the gate message in its fresh root `public/gate-message.txt`. |
| B-M3-T609-04 | MINOR | `V4/tools/launch-legacy-c6-v4.sh:12-43` with `:68-101` (also the SIM launcher) | The guard checks and the real start live in one script with no dry-run. So a guard probe with valid inputs starts real runtime. | This happened at 15:58:56 UTC: W1–W3 ran, the gate message was sent, and Docker was used. | Do not change the launcher for v4. Record one rule in READY: guard controls are static-only, or they run a copy where `CMD` and the gate message are stubbed. Never run the real launcher in a guard probe. |
| B-M3-T609-05 | MINOR | `tests/host/core.mjs:340-352`; `tests/playwright.config.ts:17`; `tests/host/run-t5.mjs:260-265`; Playwright `lib/runner/tasks.js:101-103,194-211` | The v4 pack does not tell a human where browser failure files are, or which ones survive. | Under the legacy guard, traces stay in the private clone by design. Only `.json/.log/.txt` files are shared, so `container-T6/playwright/` held only `.last-run.json`, and the trace was first reported as lost. Playwright also clears `outputDir` at each run start (no `--preserve-output`). So in `run-t5`, only the last pass (T6) keeps its traces. T5a, T5b, knob and P1 failure traces are deleted by the next pass. | Add one line to the READY or runbook: "failure trace, screenshot and `error-context.md` are at `<owned clone>/tests/acceptance/artifacts/playwright/<test>/`; keep them private (they hold dev credentials); in `run-t5` only the final pass keeps them". Defer a per-pass `outputDir` to a later test change. |
| B-M3-T609-06 | MINOR | `apps/portal/src/App.tsx:243-273`; `apps/portal/src/connect/CreateConnection.tsx:73` | AR-M3-T609-01/02 are not style issues. Keys typed during the short window go to the heading and are lost without a message. After R3, no test detects this. | §3: all URL keys were lost. The field that `autoFocus` focuses loses focus one frame later. | No product change now. Classify both as MINOR. Through the Lead and Docs, list them in `docs/human_review/deferred.md` with the user impact. |
| B-M3-T609-07 | NIT | `tests/acceptance/T6/5-xss-a11y.spec.ts:120-125`; `tests/e2e/M2/06-keyboard-axe.m2.ts:32-37` | The same helper is in two files. | Identical bodies. | Accept. A shared helper in `tests/acceptance/lib/**` would be a file that M1 reads, and it would break condition (b). |
| B-M3-T609-08 | NIT | `tests/e2e/M2/06-keyboard-axe.m2.ts:75,100,114`; plan §6.3 | The approval-code checks have no comment that explains the boolean poll. The plan's text (`toHaveValue(grant.code)`) would print one-time codes in failure output. | A later "make them the same" edit could leak codes into `playwright-results.json`. C8 already uses the safe form. | At the next edit of the file, add one comment line. The Architect can append a note to the plan. |
| B-M3-T609-09 | NIT | `tests/acceptance/T6/5-xss-a11y.spec.ts:91,124`; `tests/e2e/M2/06-keyboard-axe.m2.ts:36` | The settle wait on the course page accepts any single `h1`. The frame wait has no limit of its own. | It is safe now: each route has one `h1`, and `goto` makes a new document. If the page were hidden, the frame wait would stop until the 240 s test timeout, with a general message. | Accept. The product focus has the same dependency. |
| B-M3-T609-10 | NIT | `docs/reviews/M3/t6-09-failure-plan.md` §2, §3, §4 | Some plan text is out of date or not exact. | The trace was recovered (§2 "lost"). The loss came before the first URL key, not "before the 9th" (§4). At runtime, `urls.moodle` came from `PUBLIC_MOODLE_URL` (24 characters), not the default (§3). QA §14.1(3) and the Lead's 15:55 checkpoint already record the recovery. | The Architect may append a short note. Do not rewrite the held plan. |
| B-M3-T609-11 | NIT | `docs/team/remaining-work-2026-10-22.md:15` | The Lead checkpoint names the stopped Reviewer-B dispatch. | It says `ctx_46e72195723f`. The current dispatch is `ctx_1ee4a4300f70`. | Lead: update at the next checkpoint. |

No finding blocks the gate. `B-M3-T609-01`, `-03` and `-05` are best closed before the next runtime report. `B-M3-T609-02` is needed in the renewal text, if the Lead renews the route.

## 8. Limits

- I did not run the tests. Only the fresh V4 legacy run (AC-T6-09) and V6 (the three M2-11 cases) can show that the repair works, with no skip, retry or flaky result.
- I did not run `playwright --list`. Title equality rests on the add-only proof and QA's inventories.
- I did not re-audit the private V1/V2 reach roots, the full2 asset mapping or earlier launcher controls. I relied on their unchanged records (scope rule).
- The callback that moved focus stays an inference. The loss of URL keystrokes is observed fact (§3).
- The route decision, the runtime grant and the exclusive host window belong to the Lead.

## 9. Private evidence files

Root: `/Users/quangnguyen/cogniate-review-runs/t6-09-reviewer-b-task_ca18cab27865-20261022T1607Z`

- `trace-actions-151619-151635.txt`: action timeline from the recovered trace, with passwords redacted.
- `error-context.md`: a copy of the failure page snapshot (`db20ba6d…`).
- `tsc-c8.exit`, `tsc-c8.log`: the offline typecheck (exit 0).
- `v3-tools.sha256`, `v4-tools.sha256`, `v4-checks.txt`: tool hashes, the 90/90 index check, fresh-root absence and the mirror check.
- `msgs/`: the orchestration messages as received.
- `scripts/actions.py`: the trace parser.
- `MANIFEST.sha256`: a list of the files above (it does not list itself).
