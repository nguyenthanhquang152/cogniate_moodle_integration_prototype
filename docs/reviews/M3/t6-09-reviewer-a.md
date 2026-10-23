# M3 R3 AC-T6-09 test repair: Reviewer-A (lens A, "is it right and is it safe?")

Verdict: APPROVE for the R3 plan, the held C8 test repair and the two held v4 launcher identities. The route facts support a Lead renewal decision only with the A-T609-01 scoping. Runtime is not reviewed: no runtime evidence exists yet.
Round: 1

Reviewer: Claude Opus 5.5 xhigh, Reviewer-A. Task `task_78835a8bce35`, dispatch `ctx_35a3b3040bab`, run `run_ebe671ad72a9`. This attempt replaces `ctx_cea4b49eec71`, which stopped at a session limit without a report.
Date: 2026-10-22. Review work 16:08–16:31 UTC. Interim status (no blocker, v4 pending) sent as `msg_19df3ed635f7` at about 16:21. Final verdict after the held v4 review (§6).
Independence: I did not read the other reviewer's report, notes or feedback. I am not the Architect, the Author or QA.
Scope limits: no Docker, no browser, no launcher, no runtime run, no install, no product/test/architecture/team/guide edit, no commit, no push. My only host check was one tests typecheck (§4.1). All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

## 1. Identities reviewed

| Item | Identity | My check |
| --- | --- | --- |
| R3 plan | `docs/reviews/M3/t6-09-failure-plan.md`, 13,356 B, SHA-256 `ece4248bad58989f34e76bcde65a513e08069d8620b125373b981e393ba68ff0` | Matches. Read in full. |
| Product C6 | `4008afb92fe983d52db33442e060210b929966c8` | C6 → C8 outside `docs/**` and `tests/**`: empty diff. |
| Tests C7 | `620c03d0697c72b80649d2e77a52594ad0d282f3`, tests tree `3e9368bb61d02c2cc6c3838b4aaeaedd28fffd71` | Ancestor of C8. |
| Held C8 | `5561e8f72a83de36a68877c6b26ffc8288ade735`, tests tree `65eaefab31ec6800fca06aee50e5e25c95713f8a` | C7 → C8 under `tests/**`: two files, +33/−0. Other changed paths are `docs/**` only. `HEAD:tests` of this worktree is the same tree. |
| `tests/acceptance/T6/5-xss-a11y.spec.ts` at C8 | 7,832 B, SHA-256 `5701ce97…7b17f` (`5701ce97e99166adca51e1e26aef9f73abe946981066d42e47d9e08f1522f17b`) | Matches the Lead's handoff. +11/−0. |
| `tests/e2e/M2/06-keyboard-axe.m2.ts` at C8 | 9,927 B, SHA-256 `c15b15a9…45da3c` (`c15b15a9bfb3b3fff005e23bea5f31e0231ae8b93da89337f0e31e41e645da3c`) | Matches. +22/−0. |
| QA refinement root | `/Users/quangnguyen/cogniate-canvas-qa-runs/r3-test-repair-v2-20261022T1544Z`, `MANIFEST.sha256` `01f46f98…7b47` | All 7 entries match by size and SHA-256. QA's patch (`e1374382…2723`, 9,582 B) is byte-identical to my `git diff C7 C8 -- tests`. |
| T6 results | `…/qa-common-c6-v3-20261022T1340Z/c7-src/source/tests/host/artifacts/qa-multi-r1-4008afb9-2026-10-22T14-43-55-730Z/container-T6/playwright-results.json`, 47,066 B, `e9056950…7eef` | Matches. AC-T6-09: failed, start 15:06:15.174Z, 20,439 ms, retry 0. Stats 17/1/0/0. |
| Recovered trace | `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-4008afb9-2026-10-22T14-43-55-730Z/tests/acceptance/artifacts/playwright/T6-5-xss-a11y-AC-T6-09-axe-e53e7-focus-returns-to-the-opener/trace.zip`, 9,290,291 B, `5b655b00…9c3c` | Matches. Bound to the current failure (§3.1). |
| Screenshot, error context | `test-failed-1.png` 203,557 B `ec8611fd…fcf`; `error-context.md` 4,880 B `db20ba6d…490e` | Match. Same folder. |
| v4 root | `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v4-20261022T1554Z`; index `evidence-index-v4-prep.tsv` 90 entries, 11,197 B, `dd1b040f…aa37`; `prep/READY-C6-C8-V4.md` 12,542 B, `6a95ca66…62bc` | Match (size, SHA-256, 0600). Common QA `msg_58fe5a74bf5c`; Lead binding `msg_701a5ade835d`. |
| Legacy v4 | `tools/launch-legacy-c6-v4.sh`, 12,455 B, 0700, `9d03a98ec2569bd86a20dc366268716a20aba1f32b7e964f7683b3db8d6ef9e7` | Matches. Diff against v3 in §6. |
| Canvas SIM v4 | `tools/launch-canvas-sim-c6-v4.sh`, 12,597 B, 0700, `d812874703f2224fe891a67ea104c2a2af39b6c41b19d5316c31485a6220f7b9` | Matches. Diff against v3 in §6. |
| v3 predecessors | `launch-legacy-c6-v3.sh` 12,017 B `7e161c42…80e8`; `launch-canvas-sim-c6-v3.sh` 12,159 B `2e545b8b…600b` | Match, in the v3 root and in the v4 copy. |
| Clean C8 source | `V4/c8-clean-src/source` | HEAD C8, root tree `1c61dbf2…`, tests tree `65eaefab…`; 0 status lines; no `.env`; no `tests/host/artifacts`; push URL `DISABLED-no-push`. Checked with `GIT_OPTIONAL_LOCKS=0`. |

## 2. Plan review (`ece4248b`)

The plan is sound. I found no BLOCKER or MAJOR in it. My checks:

- **Frame source (`apps/portal/src/App.tsx:243-273`, C6 = C8).** The effect runs when `location.pathname` or `location.state` changes. It creates one `MutationObserver` on `#main` and one `requestAnimationFrame`. Both call the same `focus()`. A success disconnects the observer. Only the effect cleanup cancels the frame callback. So one effect run makes at most two successful focus calls, and both compute the same target. The plan states this correctly (§3, §6).
- **The settle rule (§6).** It is correct. See the proof in §4.2.
- **Other focus movers.** I listed every `.focus(`, `autoFocus` and `navigate(` in `apps/portal/src` at C6. On the routes that R3 covers, Frame is the only asynchronous focus mover. `CreateConnection.tsx:33` and `ManualSetup.tsx:45` run only on an invalid submit. `ui/dialog.tsx:25,45,48` run only for an open or closing dialog. `ProviderSetup`, `CanvasCreate`, `BlackboardCreate`, `CanvasBinding`, `BlackboardBinding` and `ConnectionSetup` have no `autoFocus`, no `.focus(` and no `navigate(`.
- **Heading names.** `Connect.tsx:44-46` renders `{connectionId ? "Manage" : "Connect"} {lmsNames[lms]}`. `lms.ts` gives "Moodle", "Canvas" and "Blackboard". So the five named settle points match exactly one `h1`. The failure snapshot shows `heading "Connect Moodle" [level=1]`. `CourseDetail.tsx:49` is the only `h1` on the course page. Its loading branch (`:28-34`) has no `h1`.

Plan text corrections (non-blocking, see A-T609-03):

- §3 (`:46`) and §4 (`:50`) say `urls.moodle` is `https://moodle.test`. That is only the default in `tests/acceptance/lib/env.ts:16`. The failed run typed `https://moodle.test:8443` (trace, §3.2). The "9th character" inference is moot: the run lost all 24 characters.
- §2 (`:36`) and §0 (`:15`) say the trace is lost. The recovered trace supersedes this (§3).
- §3 (`:45`) says the pending frame callback "can focus [the course `h1`] again later". This is true only when the course data commits before the first frame after the effect. In the other case, the frame callback runs first, finds no `h1`, and the observer makes the only move. R3 handles both cases.

## 3. Recovered failure evidence

### 3.1 Binding to the current failure

- The results JSON names three attachments for AC-T6-09 under `/repo/tests/acceptance/artifacts/playwright/T6-5-xss-a11y-AC-T6-09-axe-e53e7-focus-returns-to-the-opener/`. The recovered files have exactly those names in that folder, under the run folder `qa-multi-r1-4008afb9-2026-10-22T14-43-55-730Z`. That is the same run id as the results path.
- `test.trace` `context-options` `wallTime` is 1792681575174 ms = 2026-10-22T15:06:15.174Z. This equals the result `startTime` to the millisecond.
- File mtimes are 15:06:34–15:06:37 UTC. The test ended at 15:06:35.613Z.
- The trace shows the expected sequence: `goto` the course page, the dialog steps, `goto /signin`, `goto /integrations/moodle/connect`, then the keyboard steps and the failed `toBeVisible` at `:113` (15,005 ms).

So the trace is the current failure, not a stale trace. I extracted copies only into my private root (§9). The originals are unchanged.

### 3.2 What the trace shows

Browser-side calls (`0-trace.trace`, monotonic ms):

| Call | Step (C7 line) | Result |
| --- | --- | --- |
| `call@6941` 132643.6 | `tabTo(URL)`: `activeElement === siteUrl` (`:120`) | false. Focus was on the name field (its `autoFocus`). |
| `call@6943` 132645.2 | Tab (`:121`) | — |
| `call@6945` 132647.0–132647.8 | `activeElement === siteUrl` | **true** |
| `call@6947` 132648.5–132660.1 | `keyboard.type("https://moodle.test:8443")` (`:103`) | Snapshot after: `siteUrl` value `''`. All 24 characters are lost. |
| `call@6951` / `6953` / `6955` | `tabTo(name)`: false, one Tab, true | A single Tab reached the name field. |
| `call@6957` | `keyboard.type("QA keyboard mvjobraz")` (`:105`) | Snapshot after: name value `QA keyboard mvjobraz`. |
| `call@6985` | Enter on "Continue" (`:112`) | `siteUrl` still `''`. |

`error-context.md` shows the final state: the name field holds `QA keyboard mvjobraz`; "Moodle site URL" is empty and `[active]`. The `required` URL field blocked the native submit, so no `POST /app-api/connections` was sent. This matches the app log.

Conclusion: the focus left the URL field after `tabTo` saw it focused and before the first key arrived. One Tab later the name field had focus. In the tab order, the name field comes right after the `Connect Moodle` heading (`tabIndex -1`). If focus had dropped to `body`, the first Tab would reach "Skip to content". So the trace directly shows the focus loss, and it locates the focus at the heading. The source shows that Frame is the only mover on this page. Which Frame callback made the move is inferred: most likely the frame callback, because the heading exists at the first commit. R3 covers both callbacks.

## 4. Actual C8 diff review

### 4.1 Exact diff

- `git diff --numstat C7 C8 -- tests`: `11 0` T6 spec, `22 0` M2 file. No other `tests/**` path. No removed line.
- T6 adds: the helper `routeFocusSettled` (C8 `:120-125`), one unnamed settle after the course `goto` (`:91`), one `Connect Moodle` settle after the connect `goto` (`:103`), and two `:focus` value checks (`:106`, `:109`).
- M2 adds: the same helper (`:32-37`), five named settle points (`:56`, `:65`, `:85`, `:92`, `:110`), eight `toHaveValue` checks and three boolean approval-code polls (`:75`, `:100`, `:114`). That is one check after each of the eleven `keyboard.type` calls that the plan lists.
- The added lines contain no `fill(`, `click(`, `.focus(`, `waitForTimeout`, timeout argument, retry, `test.slow`, `skip`, `only` or new `test(`/`m2Case(` call.
- Test titles: the `test(`/`m2Case(` title lines hash the same at C7 and C8 in both files. QA's T6 (18) and M2 (64) inventories are equal to C7.
- Typecheck: I ran `tests/node_modules/.bin/tsc --noEmit -p tsconfig.json` in `tests/` on tree `65eaefab`. Exit 0, empty output. I did not use npm, so no registry request was made.
- Configs are unchanged: `tests/playwright.config.ts:19` expect timeout 15 s and `:22` `retries: 0`; `tests/e2e/M2/playwright.config.ts:13` 15 s and `:16` `retries: 0`.

Deviation from the plan text, accepted: the three approval-code checks use `expect.poll(() => :focus.evaluate(el.value === code)).toBe(true)` instead of `toHaveValue(grant.code)`. The strength is the same: a mismatch fails, and a missing focused element fails at the default expect deadline. The failure text does not contain the code. `keyboard.type(grant.code)` already puts the code in a failure trace at C7, so the poll adds no new class of exposure.

### 4.2 Event-order guarantee

Let effect run E (one route) register frame callback F at time tE. The observer O can succeed at most once, and only before F succeeds.

1. The heading gets focus from F. Then F has run, and F's success disconnected O. Nothing is pending.
2. The heading gets focus from O before F runs. F is still pending; it was registered at tE, before O's success. The test sees the focus after O's success, and only then registers its own frame callback T. The browser runs frame callbacks in registration order. A callback that is added during a frame runs in the next frame. So F runs before T, in the same frame or an earlier one. When the `page.evaluate` promise resolves, F has run.
3. Nothing else gives the heading focus on these routes. Tab never lands on a `tabIndex -1` heading. The previous route's F was cancelled by its effect cleanup. A named heading also changes its name in the same commit as the route change.

After the settle, Frame makes no further move until the next path or state change. The two files contain no automatic path or state change after a settle (§4.3). `ConnectionSetup.tsx:27` polls every 5 s, but a poll only re-renders. It makes no focus call and no navigation.

This is synchronization with an event, not a time wait. The helper has no time value.

### 4.3 Every keyboard route transition in the two files

| File (C8 line) | Transition | Keyboard input after it | Covered? |
| --- | --- | --- | --- |
| T6 `:90-91` | `goto` course page | Tab and Enter on the opener (`:93-94`) | Yes, unnamed settle. One `h1` only. |
| T6 `:94-95` | Enter on the opener: path `/publish`. The dialog opens. | Escape (`:96`) | No settle needed. The dialog's child effect calls `showModal()` before Frame's parent effect runs. Frame's `focus()` then sees `dialog[open]` and does nothing. |
| T6 `:96-98` | Escape: `navigate(coursePath, {state:{focus:"publish-opener"}})` (`CourseDetail.tsx:90-95`) | None. Only `toBeFocused(opener)` at `:98`. | Not needed. Dialog cleanup (`dialog.tsx:25`) and Frame both target the opener. The `:98` assertion is unchanged. |
| T6 `:102-103` | `goto` Moodle connect | Tab, type URL and name, ArrowUp/Space, Enter (`:104-116`) | Yes, `Connect Moodle`. The `autoFocus` move comes at commit, before Frame's effect. So the heading is the final focus. |
| T6 `:116` | Enter: create, then `navigate(/integrations/moodle/{id})` | None. Only `:117`. | Not needed. |
| T6 `:79-83` (axe part) | click opens the dialog | Escape (`:83`) | Not needed, for the dialog reason above. Not a keyboard-only claim. |
| M2 `:54-56` | `goto` Canvas connect | Tab, type, End, Shift+Tab, Enter | Yes, `Connect Canvas`. The heading renders at once, and the form later. No `autoFocus` in the form. |
| M2 `:63-65` | Enter on Next: `navigate(/integrations/canvas/{id}, {replace, state:{opener}})` (`Connect.tsx:63`) | Tab, type, Space, Shift+Tab, Enter | Yes, `Manage Canvas`, after `pendingWizard`. `state.opener` is not `state.focus`, so the target is `main h1`. |
| M2 `:71-76` | Save (invalid), then the approval-code Save | — | No route change. `onChanged` → `changed()` only sets data and reloads (`ConnectionSetup.tsx:30-35`). |
| M2 `:83-85`, `:90-92` | Blackboard: the same two transitions | the same | Yes, `Connect Blackboard` and `Manage Blackboard`. |
| M2 `:108-110` | `goto` Canvas detail (add deployment) | Tab, type, Enter | Yes, `Manage Canvas`. |
| M2 `:119-136` (axe cases) | `canvasStep1`, `next`, `goto` | none (they use `fill`/`click` in `lib/m2.ts`) | Out of R3 scope, and not keyboard flows. |

Outside the two files, `page.keyboard` appears only once: `T8/2-shell.spec.ts:63` presses Escape in an open dialog. Frame does not move focus while a dialog is open. So the race does not reach other legacy, M2 or T7 files.

### 4.4 Value checks

The checks compare raw input values. These fields do not change the typed value: `CreateConnection.tsx` and the create forms are uncontrolled, and the bindings store `event.target.value` (`CanvasBinding.tsx:51-59`, `BlackboardBinding.tsx:43-47`). They trim only on submit. All typed values are shorter than the `maxLength` (100 for names, 255 for IDs). The T6 name regex `^QA keyboard [0-9a-z]+$` matches `Date.now().toString(36)`. So a correct run cannot fail on these checks. A lost key fails at the field, with a clear message.

### 4.5 No weakening and no timing workaround

No existing line changed. Every existing assertion, title, label literal and deadline is kept: `:117` 15 s, M2 `:77`/`:102`/`:116` 30 s. Input stays keyboard-only. The only new non-assertion call is one `requestAnimationFrame` round trip, and it is an event sync. The settle is a new, stricter precondition: if the portal stops moving focus to the heading, the test fails (A-T609-04).

### 4.6 Does the synchronization mask a material user-facing defect?

No, within AC-T6-09 (`docs/architecture/tasks/T6.md:218`) and AC-M2-11 (`docs/architecture/tasks/M2.md:121`). Both criteria claim keyboard operability, visible focus, focus return and announced status. They do not bound how soon after a route change a key must be kept.

- On the connect and manage pages, the heading exists at the first commit. So the move comes within one animation frame of the first render. A human cannot see the form, press Tab and type within that frame. The C7 failure needed automation speed: the type call started 0.7 ms after the focus check returned true (§3.2).
- The trace confirms AR-M3-T609-01: the name field's `autoFocus` is overridden by the heading move. A user gets heading focus, which is the intended route-change pattern. Nothing is lost.
- Residual, not masked by R3 (A-T609-02): on the course page the `h1` mounts only after the course data. The observer stays connected until then. On a slow network, a user who tabbed into the sidebar before the data arrived loses that focus to the heading. C7 never tested input before the data either: `tabTo` waits for the opener. So R3 does not hide a behavior that was tested before.

Bounded claim for V4/V6: a pass proves keyboard operability after each route's focus move ends. It does not prove that keys typed during the first frame, or before late route data, are kept.

## 5. Evidence-route eligibility

The route is a proposal. It is not accepted. My facts:

| Condition | Result | Evidence |
| --- | --- | --- |
| (a) C8 = C6 outside `docs/**` and `tests/**` | **Proven.** | `git diff --stat C6 C8 -- . ':!docs' ':!tests'` is empty. C4 → C6 outside them stays the four accepted paths (R1 pair, `README.md`, `infra/README.md`). |
| (b) No producer of a reused row reads a changed file | **Proven for the carried M1 SIM, migration, snapshot and storage rows. False as literally worded** (A-T609-01). | M1 Vitest includes only `acceptance/M1/{owner}/**/*.test.ts` (`tests/acceptance/M1/vitest.config.mts:25-26`). M1 browser cases run Playwright with `QA_TASK=M1`, so `testMatch` is `M1/**/*.spec.ts` (`tests/playwright.config.ts:15`). No file imports either changed file. Only `tests/e2e/M2/manifest.json` names the M2 file, as file names without hashes. But `run-m1.mjs --phase legacy` runs `run-t5.mjs --tasks T5a,T5b,T6` (`tests/host/run-m1.mjs:206`), and `--phase full` calls `--phase legacy` at its end (`:168-170`). So the M1 runner does execute the changed T6 spec, but only in the legacy groups, which the route requires fresh. |
| Docs changed C7 → C8 | **No test input.** | No non-doc file reads `cogniate-app-api.md`, ADR-004 or the review and team files. The two M1 `docs/` hits are comments (`31-canvas-grants.test.ts:34,135`). Test-read docs (`docs/raw/**`, `docs/research/**`, `docs/architecture/tasks/**`) are unchanged C4 → C8. |
| (c) V1/V2 reach proof and full2 asset mapping unchanged | **Inputs unchanged.** | The product is byte-equal C6 = C8. C4 → C8 tests changes are four files: `T6/3-courses.spec.ts`, `T6/5-xss-a11y.spec.ts`, `T8/2-shell.spec.ts`, `e2e/M2/06-keyboard-axe.m2.ts`. All are legacy or M2 files, so they are fresh in any route. I did not re-derive the accepted V1/V2 proof or the mapping. Their inputs did not change. |

Eligibility conclusion: on these facts, the Lead **may** renew a bounded route under a new name, with these limits:

- all 12 legacy groups fresh on C6/C8;
- two fresh `--phase sim --provider canvas` runs (258 = 251 non-browser + 7 browser; 26 common + 232 Canvas);
- at most 230 explicit C4 carry rows, each bound to its C4 run and listed separately;
- every repeated row uses its fresh result;
- an independent 232-row Canvas judgment for each round, with the one carried snapshot row kept separate;
- all 64 M2 cases and three T7 runs (17 each) at actual C8.

A new failure, unequal rounds or any product change voids the renewal. E-T5R stays VOID and must not be revived. The C6/C7 attempt stays FAILED. Its 10 passing groups, T5b 24/24, AC-T5-36 and AC-T6-07 fill no row. The legacy run that Common QA started by mistake at 15:58:56 UTC was stopped by the Lead. Its closure ledger (`V4/unauthorized-stopped-guard-escape-20261022T1558Z/public/CLOSURE-LEDGER-UNAUTHORIZED-STOPPED.json`, 9,426 B, `1081d6d6…cdf3`) says "VOID". It is neither a pass nor a failure of C8. No partial result from it may fill or void any row. Without renewal, the strict route applies: 2 × 488 full rounds, 2 × 233 independent Canvas judgments and per-case equality.

The held v4 pack has commands only for the bounded route (one legacy run and two Canvas SIM runs). The strict route needs a `--phase full` launcher, and none is held. That launcher would need its own identity review.

## 6. v4 launchers

Held at 16:18 UTC (Common QA `msg_58fe5a74bf5c`; Lead verification `msg_701a5ade835d`). I compared the files directly. I did not run any launcher, control or guard script.

### 6.1 Exact diff against v3

I ran `diff -u` v3 → v4 for each launcher. My hunks are byte-identical to QA's `prep/02a-…patch` and `prep/02b-…patch` (same hash after the two header lines; same sizes, 10,005 B and 10,267 B). Both launchers change in the same places, and only there:

| v4 line | Change | Assessment |
| --- | --- | --- |
| 2, 9 | Header and usage text: C7 → C8, `-v3.sh` → `-v4.sh` | Label only. |
| 15 | `TASK=task_6bc986323143; DISPATCH=ctx_c5acede76614` → `TASK=task_0b7729855fc5; DISPATCH=ctx_72afbef88d8c`. `FROM=term_7b4cc382-…` unchanged. | Correct current routing. It matches the Lead binding. |
| 26 | `TEST_SHA` pin `620c03d…` → `5561e8f72a83de36a68877c6b26ffc8288ade735` | Correct C8. |
| 28 | Tests tree pin `3e9368bb…` → `65eaefab31ec6800fca06aee50e5e25c95713f8a` | Correct. The tree pins every test blob, including both R3 files. |
| 25, 27, 29–33 | Unchanged: product pin C6, source HEAD = `TEST_SHA`, clean status, tests = `TEST_SHA`, the C4 → C6 four-path and two-path guards, READMEs = `958ee5c`. | Kept. |
| 34 | Message text "C7 …" → "C8 product/non-doc paths differ from C6". The command is the same. | Label only. |
| 35 (new) | C7 → C8 tests = exactly the two R3 paths | New, stricter guard. |
| 36–37 | C5 → C8 and C6 → C8 tests = the four R2 + R3 paths (they were C5 → C7 and C6 → C7 = two R2 paths) | Correct. The C5 and C6 tests trees are equal. |
| 38 | C4 → C5 = three D-T6L paths | Unchanged. |
| 39 | C4 → C8 tests = four paths (it was C4 → C7 = three) | Correct. |
| 74–75, 92, 100 | Gate message, observer log and exit log text: C6/C7 → C6/C8 | Label only. |

Everything else is unchanged byte for byte: `set -uo pipefail`, `umask 077`, the course hash checks, the tool hash record, the ancestor boundary, W1 wake, W2 liveness, W3 formal start against the frozen 32-record baseline (`ORIG`), the gate-message send and its stop on failure (only its text labels change), the three observers in their own process groups, the `umask 022` runner child only, W4 end capture, the observer stop, the W4 strict compare, the owned-clone list and the secret scan. The runner commands are unchanged: `run-m1.mjs --phase legacy` and `run-m1.mjs --phase sim --provider canvas`, each with `--sha "$SHA" --test-sha "$TEST_SHA" --source "$SOURCE"`. Neither launcher has a retry or a repeat loop. The only loop is the owned-clone listing.

`diff -rq V3/tools V4/tools` reports only the two new v4 launchers. So all inherited tools and controls are byte-identical to the qualified v3 set.

### 6.2 Guard outcome on the held source

With read-only git commands on `V4/c8-clean-src/source`, every v4 guard condition holds: C4 → C6 outside docs/tests = the four paths; READMEs = `958ee5c`; C6 = C8 outside docs/tests; C7 → C8 = the two R3 paths; C5 → C8 = C6 → C8 = C4 → C8 = the four paths; C4 → C5 = the three D-T6L paths; working tests = C8.

### 6.3 Roots and commands

- The three proposed roots `legacy-c6`, `canvas-sim-c6-r1` and `canvas-sim-c6-r2` are absent at 16:27 UTC.
- Each held command starts `umask 077 && test ! -e <root> &&`. It passes C6, C8, the clean source and its own root. The two SIM roots are different.
- The launchers create the root with `mkdir -p` (line 19). So the absent-root rule depends on the held command prefix, as in v3 (B-M3TR-05 option (a)). See A-T609-05.

v4 identity conclusion: the two v4 launchers are the qualified v3 launchers with only the C8 pins, the four-path test guards, the new C7 → C8 guard, the current Common QA routing and labels changed. The identities are correct for the held bounded-route commands.

## 7. Findings

| Id | Severity | File:line | Problem | Evidence | Minimal correction |
| --- | --- | --- | --- | --- | --- |
| A-T609-01 | MINOR (route proof) | `docs/reviews/M3/t6-09-failure-plan.md:122` | Condition (b), "no M1 runner, manifest or spec reads either changed file", is false as literally worded. | `tests/host/run-m1.mjs:206` runs T6 through `run-t5.mjs` in `--phase legacy`. `:168-170` calls `--phase legacy` at the end of `--phase full`. | In the renewal decision, scope (b) to "no producer of a carried row". State that the M1 legacy phase runs the changed T6 spec and stays fully fresh. |
| A-T609-02 | MINOR (product, deferred; no change authorized) | `apps/portal/src/App.tsx:243-273` with `courses/CourseDetail.tsx:28-34` | On data-driven routes, the observer moves focus to the heading when the data arrives. That can be seconds after the user started to tab. | The observer disconnects only on success. The course `h1` mounts only after `/courses/{id}`. | Defer, with AR-M3-T609-01/02. The final Architect and Docs must not claim that keys are safe before a route's focus settles. Future option: limit the observer to the first frame, or skip the move when focus already left `body`/the previous route. |
| A-T609-03 | NIT | `docs/reviews/M3/t6-09-failure-plan.md:15,36,45,46,50` | The plan text says the trace is lost and that `urls.moodle` is `https://moodle.test`. It infers a 9th-character loss. | Recovered trace (§3): `:8443` URL, all 24 characters lost. | No change to the held plan. Cite this report's §3 in the final record. |
| A-T609-04 | NIT (accepted) | `tests/acceptance/T6/5-xss-a11y.spec.ts:120-125`, `tests/e2e/M2/06-keyboard-axe.m2.ts:32-37` | The settle helper also asserts that the portal moves focus to the heading after a route change. The criteria do not require this. | If a later product change keeps the `autoFocus` (AR-M3-T609-01 option), `routeFocusSettled(page, 'Connect Moodle')` fails at 15 s. | None now. Any future product focus change must update these two helpers in the same round. |
| A-T609-05 | MINOR (process; tools stay unchanged) | `V4/tools/launch-legacy-c6-v4.sh:19,68`, `V4/tools/launch-canvas-sim-c6-v4.sh:19,68` | A launcher with four arguments starts real Docker work. It has no grant check, and it does not refuse an existing root. Only the held `test ! -e` prefix and operator care stop it. | The 15:58:56 UTC accidental run passed W1–W3 and the gate message before the Lead stopped it (closure ledger, `escapedControlCause`). This is the same logic as approved v3. | No tool change. Each Lead grant must quote the exact held command with its prefix. QA must not invoke a real launcher path as a negative control. Use the existing qualified v3 control evidence, or a copy with the runner command removed, outside any grant. |

No BLOCKER or MAJOR is open for the plan, C8 or the v4 identities.

## 8. Verdict and limits

History: the interim status at about 16:21 was PENDING, with no BLOCKER or MAJOR for the plan or C8.

**Final verdict: APPROVE.**

| Scope | Result |
| --- | --- |
| R3 plan `ece4248b` | APPROVE. The settle rule matches `App.tsx:243-273`, including the second focus move. Text corrections A-T609-03 only. |
| Held C8 `5561e8f7` (tests tree `65eaefab`) | APPROVE. Exactly the two files, add-only, no weakening, no timing workaround beyond one event sync. All keyboard route transitions are covered. Titles are unchanged, and the typecheck passes. |
| v4 identities `9d03a98e` (legacy) and `d8128747` (Canvas SIM) | APPROVE for the three held commands. Only pins, path guards, routing and labels change from v3. No retry. W1–W4 and the 32-record baseline logic are unchanged. The roots are absent. |
| Route eligibility | The facts support a Lead decision. Condition (a) is proven. Condition (b) is proven only as scoped in A-T609-01. Condition (c) has unchanged inputs. The route stays NOT accepted until the Lead decides. |
| Runtime | Not reviewed. No V4/V6/V7 run exists. No runtime is allowed before both reviews and an explicit Lead grant. |

Open non-blocking items: A-T609-01 (MINOR, apply in the renewal text), A-T609-02 (MINOR, product, deferred), A-T609-05 (MINOR, process), A-T609-03 and A-T609-04 (NIT). Product NITs AR-M3-T609-01/02 stay deferred. All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

Limits: I ran no browser and no launcher, so I did not reproduce the race. The fresh V4 legacy run and the V6 M2 run are the real proof of R3. I did not re-derive the V1/V2 proof bodies or the full2 mapping; I checked only that their inputs are unchanged. I did not review the v3 control evidence again. I read the accidental-run ledger only for its classification and cause; QA and the Lead own its W4 and cleanup closure.

## 9. Private evidence

Root: `/Users/quangnguyen/cogniate-review-runs/t6-09-reviewer-a-20261022-FWDFG6` (0700). Files are 0600. Scripts are 0700.

- `trace-x/` holds copies of the four trace members `test.trace`, `0-trace.trace`, `0-trace.network` and `0-trace.stacks`, extracted from the recovered `trace.zip`. Disclosure: `unzip` restored the archive's 0664 modes. I changed them to 0600 within about two minutes. During that time the parent folder was 0700.
- `trace-actions.txt`, `trace-input-values.txt`: the call list and the resolved input values (§3.2).
- `c7-c8-changed-lines.txt`: all changed lines C7 → C8 (32 non-blank added lines, 0 removed).
- `tests-typecheck.log` (empty), `tests-typecheck.exit` (`tsc_exit=0`).
- `scripts/snap.py`, `scripts/vals.py`: read-only parsers, run with `python3 -I`.
- `v4-legacy-v3-to-v4.diff`, `v4-canvas-sim-v3-to-v4.diff`, `v4-tools-rq.txt`, `v4-clean-src-status-count.txt`: my v4 comparisons (§6).
- `MANIFEST.sha256` (15 entries, SHA-256 `2e2994f5a1bbed554ddc7d73ebeb5430e11e6c32c6438e5610323ef12c1b8ddf`): size and SHA-256 of every file above. It does not list itself.
