Verdict: PASS
Round: 1

# T5a QA verification

| Item | Value |
| --- | --- |
| SHA | `e05aa29ef08f26df102f91758729c5f8109f8191` (T5a code `de6a1bb`, with hashed play and picker ids and the attempts module; QA tests) |
| Spec | `tasks/T5a.md` at `d7a88ec` (run order, own activities), contract `cogniate-app-api.md` §5–§8, §12 at `31a16cb` (`sessionId` → 400, `scorm.cmi.core.total_time`, newest sync in the status API, `/_player/shell.js`) |
| Scope | T5a (all 21 ACs) and a short T4b2 launch/picker regression (AC-T4-15, -17, -20, -24, -29), because T5a changed the launch, picker and play code. Each run used a new stack (`compose.yaml` mounts `apps/` read-only). |
| Tests used | The SHA tests plus the QA-side fixes in section 3. The re-runs used `--replace-tests`. The Lead can commit `tests/**`. |
| Runner | `COMPOSE_PROJECT_NAME=qa-t5a-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-t5.mjs --sha e05aa29… --tasks T5a` (T5a pass and the `PLAY_TTL_SECONDS=20` knob pass). Focused re-runs used `--only <ids>` (the setup chain plus the named ACs), and `run-t4b.mjs --only …` for the T4b2 regression. |
| Isolation | The Author's stack was not touched. After each run: 0 QA containers, 0 volumes, 0 networks. Another team stack (`cogniate-codex`) was on the host; QA did not touch it. |
| Evidence roots | `R1` = `tests/host/artifacts/qa-t5a-r1-e05aa29e-2026-10-18T06-22-07-546Z/` (full T5a run + knob pass). `F1` = `…T06-27-12-159Z/` (AC-T5-05, -15). `F4` = `…T06-33-46-546Z/` (AC-T5-37). `G` = `…T06-35-39-024Z/` and `…T06-40-36-901Z/` (T4b2 regression). |

## 1. Results per acceptance criterion

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T5-01 | PASS | `/pkg/<id>/index.html`: 200 `text/html`, `nosniff`, `frame-ancestors` content + app, no `Set-Cookie`. Five raw paths with `../` and `%2e%2e/` (sent as they are) → 400 or 404, never the target file or `/etc/passwd`. | `R1` |
| AC-T5-02 | PASS | `Range: bytes=0-1023` on `lyra.mp4` → 206 `video/mp4`, `Content-Range: bytes 0-1023/10721508`. | `R1` |
| AC-T5-03 | PASS | `/rt/<token>`: `frame-ancestors` = app only. A random token → 404. The runtime iframe has exactly `sandbox="allow-scripts allow-same-origin"` and `allow="autoplay; fullscreen"`. `document.fullscreenEnabled` in the package frame. The shell sends no `Permissions-Policy`. | `R1` |
| AC-T5-04 | PASS | `window.API` has the eight SCORM 1.2 functions, and `CogniateSCORM.available === true` in the package frame. | `R1` |
| AC-T5-05 | PASS | Blank SCO: 301 before init; `LMSInitialize("")` true/0; `student_id` = Moodle id; `mastery_score` 70; 405, 404, 403, 201 as specified. On a new page load, `LMSInitialize("x")` → 201. After `LMSFinish`, 101. | `F1` |
| AC-T5-06 | PASS | `suspend_data` "qa-resume" and `exit=suspend` are kept: the next launch reads "qa-resume" and `entry` = "resume". | `R1` |
| AC-T5-07 | PASS | The real SCORM course (menu, lesson ≥ 11 s, scroll, correct option). Within 60 s: the shell shows "Completed — score 100 sent to Moodle", Moodle shows 100 with completion done, and the row is `passed`/100 with one `sent` sync. Grader report and course page screenshots are attached. | `R1` |
| AC-T5-08 | PASS | `cg_student2`, wrong option → Moodle 0 with completion done; row `failed`/0, one `sent` sync. | `R1` |
| AC-T5-12 | PASS | After AC-T5-07: a commit failed/0 with `seq = lastSeq + 1` from the runtime frame → 200; no new sync; Moodle still 100. | `R1` |
| AC-T5-13 | PASS | Teacher preview: "Preview — no grade is sent"; the preview row has no syncs; there is no teacher grade in Moodle. | `R1` |
| AC-T5-15 | PASS | Token A reads attempt A only, token B reads B only, a random token → 404. After two valid commits, `seq` = lastSeq and lastSeq − 1 → 409 `STALE_SEQUENCE`. Knob pass: a commit at TTL + 3 s → 410 `RUNTIME_EXPIRED`. | `F1`, `R1/container-knob-PLAY_TTL_SECONDS` |
| AC-T5-16 | PASS | `suspend_data` of 5,000 characters → 400 `INVALID_CMI`, `details.field` `cmi.suspend_data`; `commit_rejected` is logged. | `R1` |
| AC-T5-17 | PASS | From the package frame, `fetch(app/app-api/me)` with credentials does not return the user. `top.location = evil.test` does not change the top window. | `R1` |
| AC-T5-20 | PASS | Relaunch after the pass: the package sends `finish` at once; no new sync; still `passed`; Moodle 100. | `R1` |
| AC-T5-21 | PASS | Blank SCO, a new learner, `LMSInitialize` + `LMSFinish` only → `completed`, Moodle 100. | `R1` |
| AC-T5-22 | PASS | Two sessions of `0000:00:30.00`, each with `LMSFinish` and a window close (with its unload) → `total_time` = `0000:01:00.00` in session 3. | `R1` |
| AC-T5-23 | PASS | After AC-T5-08: relaunch (a new attempt on version 2), commit passed/100 and finish → syncs `sent:0`, `sent:100`; Moodle 100; best `passed`. | `R1` |
| AC-T5-24 | PASS | Version 2 published: `cg_student2` continues on version 1 (RuntimeState and `attempts[].versionId`); `cg_student` gets a new attempt on version 2. | `R1` |
| AC-T5-34 | PASS | After the end, back to the menu page in the same window: no second `finish` and no new `commit` (at most one unload); still `passed`. | `R1` |
| AC-T5-35 | PASS | Close mid-course: exactly one `commit_accepted {commit_event: "unload"}` for the session (read in the log); the attempt is `in_progress`; the next launch has `entry` = "resume". | `R1` |
| AC-T5-37 | PASS | Own activity "Cogniate SCORM rebind". `cg_student2` leaves after the menu page (SCORM attempt `in_progress`). The teacher re-selects the HTML course. The next launch opens the HTML course: RuntimeState `format=html` and a new HTML attempt (`not_started`) under the HTML publication. The SCORM attempt stays `in_progress`, with no sync, under the SCORM publication, on the same resource link. | `F4` |

The Author covered AC-T5-12, -13, -15, -16, -20, -22, -23, -24, -34 and -37 only with unit tests. All ten pass black-box here.

### T4b2 regression

| AC | Result |
| --- | --- |
| AC-T4-15, AC-T4-20, AC-T4-24, AC-T4-29 | PASS |
| AC-T4-17 | Every launch part passes: new window, `/play/<id>` with no ltik, the 303 has `no-referrer`, the shell text. **Only `outcome = not_started` fails**: the status is `in_progress`, because the real SCORM runtime (new in T5a) commits on the package's first page load (data model: the first commit → `in_progress`). This is a spec interaction, not a launch defect (Q-T5a-02). |

### The Author's notes for this round

| Note | QA result |
| --- | --- |
| A real Cogniate SCORM course reaches 100 in Moodle | Agrees (AC-T5-07). |
| `/pkg`: raw-path checks, MIME allowlist, `Range` | Agrees (AC-T5-01, -02). |
| A commit with a wrong `sessionId` → 400 `INVALID_REQUEST` (field `sessionId`) | Not an AC; QA's commits always use the RuntimeState session. |
| RuntimeState has `scorm.cmi.core.total_time` | Agrees (AC-T5-22 reads it through the API). |
| The status API shows the newest sync of the learner and activity | Not separately checked. |

## 2. Findings

Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT.

### Q-T5a-01 — NIT — `seq: 0` gets 400, while AC-T5-15 says `seq ≤ lastSeq` → 409 (owner: Architect)

- **Observation:** With `lastSeq` = 1, a commit with `seq: 0` gives 400 `INVALID_REQUEST` (`details.field = "seq"`), not 409 `STALE_SEQUENCE`. Real stale values (`seq` = lastSeq and lastSeq − 1, both ≥ 1) give 409.
- **Suggested fix:** Say in contract §7 that `seq` is an integer ≥ 1 (else 400), and read AC-T5-15 as "1 ≤ seq ≤ lastSeq → 409".

### Q-T5a-02 — NIT — AC-T4-17 `outcome = not_started` is no longer observable after T5a (owner: Architect)

- **Observation:** The SCORM package sets `incomplete` and commits on its first page load. So `GET /app-api/play/<id>/status` shows `in_progress` about a second after the launch.
- **Suggested fix:** AC-T4-17: "`outcome` is `not_started` or `in_progress`", or check the status before the runtime loads.

## 3. QA-side changes in this round

1. **AC-T5-05 race:** after `location.reload()` of the runtime frame, `waitForLoadState` can still see the old page. The new `reloadRuntime()` sets a marker on the old page and waits until it is gone and `window.API` exists. T5b's AC-T5-30 uses it too.
2. **AC-T5-15 data:** QA had used `seq: 0` as the stale value (Q-T5a-01). It now makes two valid commits, then tests `seq` = lastSeq and lastSeq − 1. The `seq: 0` answer is recorded as an annotation.
3. **AC-T5-37:** it now finds the rows by resource link, not by title. In update mode, `submitPicker` returns before Moodle's content-item return sets the new name, so the activity got the HTML course title. Its first version also waited for an HTML runtime commit, but HTML tracking is T5b scope.
4. **`run-t5.mjs --only`** and **`run-t4b.mjs --only`:** focused re-runs (the setup chain plus the named ACs).
5. **`T4b2/2-launch.spec.ts`:** the group is no longer serial (one failed AC skipped the next ones), and AC-T4-17 saves the handoff URL before its status check, so AC-T4-24 can run.


## Replacement QA regression, 2026-10-19 — candidate a5d9ddc

Independent replacement QA: Codex GPT-6-Astra, xhigh, assigned by the continuation authority. This is a replacement-model run, not a claim of cross-model QA. Acceptance specs and contracts were read before prior QA evidence. No author notes were used to create acceptance criteria. Historical rounds above remain unchanged.

- Tested SHA: `a5d9ddcbc95cfb61968f70372334790386f2bb4b`; product code: `dd6dd1188833653cb92c63cc09e3c438ac3cb7b4`. Product paths have no diff between these commits.
- Run: 2026-10-19 10:10:28–10:29:45 UTC. Fresh external clone: `/Users/quangnguyen/cogniate-qa-runs/qa-cont-t5-a5d9ddcb-2026-10-19T10-10-28-786Z`. No `--checkout` or `--replace-tests`.
- Evidence root `R`: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/moodle-lti-continuation/tests/host/artifacts/qa-cont-t5-a5d9ddcb-2026-10-19T10-10-28-786Z`. The root has `summary.json`, `images.json`, and command logs. Each container folder has its Playwright JSON, traces, screenshots, log snapshots and captured-secret evidence.
- Command: `COMPOSE_PROJECT_NAME=qa-cont-t5 PUBLIC_PORT=8643 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses node tests/host/run-t5.mjs --sha a5d9ddcbc95cfb61968f70372334790386f2bb4b --tasks T5a,T5b,T6`. The fixture source checkout was read only.
- Isolation: preflight and H1 passed; one own stack, free port and subnet, SHA-checked course fixtures. The runner removed the stack and recorded zero own containers, volumes and networks. An independent label-filtered Docker check also returned zero. None of the ten pre-existing containers stopped or restarted. No other stack was paused or changed.

Image IDs from `R/images.json`:

| Service | Image | ID |
| --- | --- | --- |
| moodle | `erseco/alpine-moodle:v5.2.4` | `sha256:3a310197e51ff34c6e8e8adbb92703fe598f71cbcf9eb974055c27f07f4cb23d` |
| cogniate-app | `node:24.22.0-alpine3.24` | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| lti-service | `node:24.22.0-alpine3.24` | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| postgres | `postgres:16-alpine` | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` |
| proxy | `caddy:2.11.7-alpine` | `sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f` |

### Result at this candidate

**PASS — all 21 ACs and the separate runtime-expiry pass.** The combined runner exited 1. This run does not clear the final T5/T6 gate.

Main pass: 22 passed (setup plus 21 AC tests), one intentional TTL skip. The separate `container-knob-PLAY_TTL_SECONDS` pass executed that TTL test and passed; defaults were restored. The table uses the command above and `R/container-T5a/playwright-results.json`; the full test titles below identify the executed tests.

| AC | Result | Executed test / observation |
| --- | --- | --- |
| AC-T5-01 | PASS | /pkg/<packageId>/index.html: 200 text/html, nosniff, frame-ancestors content + app, no Set-Cookie; raw ../ and %2e%2e/ paths → 400 or 404 |
| AC-T5-02 | PASS | a Range request on assets/ask-lyra/lyra.mp4 → 206 video/mp4, Content-Range bytes 0-1023/10721508 |
| AC-T5-03 | PASS | /rt/<token>: frame-ancestors app; random token → 404; runtime iframe sandbox and allow exact; fullscreenEnabled; no Permissions-Policy on the shell |
| AC-T5-04 | PASS | the runtime frame has window.API with the 8 SCORM 1.2 functions; the package frame has CogniateSCORM.available === true |
| AC-T5-05 | PASS | the SCORM 1.2 API answers per contract §8 (301 before init, 405, 404, 403, 201, 201 on a new page load, 101 after LMSFinish) |
| AC-T5-06 | PASS | suspend_data and exit=suspend are kept: the next launch gets suspend_data "qa-resume" and entry "resume" |
| AC-T5-21 | PASS | a new learner attempt with LMSInitialize + LMSFinish only → outcome completed, Moodle shows 100 |
| AC-T5-22 | PASS | two sessions of 30 s (each LMSFinish, then window close) → total_time 0000:01:00.00 in the third session |
| AC-T5-07 | PASS | SCORM pass: within 60 s the shell says "Completed — score 100 sent to Moodle", Moodle shows 100 and completion done, the row is passed/100 with one sync sent |
| AC-T5-08 | PASS | SCORM fail: cg_student2 picks a wrong option and finishes → Moodle 0 and completion done; row failed, 0, one sync sent |
| AC-T5-20 | PASS | cg_student opens "Cogniate SCORM" again (the package calls LMSFinish at once): no new sync, best still passed, Moodle still 100 |
| AC-T5-12 | PASS | after AC-T5-07: a commit failed/0 with seq = lastSeq + 1 from the runtime frame → 200; no new sync; Moodle still 100 |
| AC-T5-23 | PASS | after AC-T5-08: cg_student2 relaunches, commits passed/100 and finish → one new sync sent, Moodle 100, best passed |
| AC-T5-13 | PASS | teacher preview: cg_teacher completes "Cogniate SCORM" → "Preview — no grade is sent"; the row has preview: true and no scoreSyncs; no teacher grade in Moodle |
| AC-T5-24 | PASS | version 2 published: cg_student2 continues version 1 (in progress); cg_student (final attempt) gets a new attempt on version 2 |
| AC-T5-34 | PASS | after the end, back to the menu page in the same window: no second finish, no new commit (at most one unload), outcome stays passed |
| AC-T5-35 | PASS | close mid-course: exactly one commit_accepted {unload} for the session, the attempt is in_progress, the next launch gets entry "resume" |
| AC-T5-37 | PASS | rebind with an in-progress attempt: the next launch opens the HTML course with a new attempt; the SCORM attempt stays in_progress, has no sync, and shows under the SCORM publication |
| AC-T5-15 | PASS | token scope: token A reads attempt A only, token B reads B only, a random token → 404; a commit with 1 ≤ seq ≤ lastSeq → 409 STALE_SEQUENCE; seq 0 or 1.5 → 400 INVALID_REQUEST (field seq) |
| AC-T5-16 | PASS | a commit with 5,000 chars of suspend_data → 400 INVALID_CMI, details.field cmi.suspend_data; commit_rejected logged |
| AC-T5-17 | PASS | from the package frame: fetch of {app}/app-api/me with credentials does not return the user; top.location = evil.test does not change the top window |

### Scope and limits

This run also checks `seq` 0 and 1.5 → 400 `INVALID_REQUEST` with field `seq`, runtime expiry at TTL + 3 seconds → 410, the version-pinning/rebind paths, SCORM pass/fail and preview, no lower grade after a final score, sandbox isolation and the single unload event. It uses Chromium and local Moodle 5.2.4. It does not establish behavior in other browsers or production Moodle sites. T4b1/T4b2 passed separately on the same candidate; see their dated replacement QA sections. No T5a product finding was observed.


## Replacement QA final regression, 2026-10-19 — d54c607d

**PASS — all 21 required ACs and the separate runtime-expiry test.**

Independent replacement QA: **Codex GPT-6-Astra, xhigh**, under the 2026-10-19 continuation authority. Acceptance specs and contracts define this verdict; historical failed and focused runs above remain as evidence. This is replacement-model QA, not a cross-model QA claim.

- Tested committed SHA: `d54c607d7fc6ce2d97e039bb108f52a37f2174ee`. This candidate includes the P2 durable-confirmation repair and the corrected fractional best-attempt comparison.
- Full run: **2026-10-19 10:52:13–11:11:10 UTC**, runner exit **0**. Fresh external clone: `/Users/quangnguyen/cogniate-qa-runs/qa-cont-t5-d54c607d-2026-10-19T10-52-13-189Z`. No test overlay, `--checkout` or `--replace-tests` was used; the clone's HEAD and unchanged tracked test/product paths were checked.
- Evidence root `V`: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/moodle-lti-continuation/tests/host/artifacts/qa-cont-t5-d54c607d-2026-10-19T10-52-13-189Z`. `V/summary.json` has all 63 aggregate IDs PASS and `abort: null`. Per-suite folders contain Playwright JSON, traces, screenshots, log snapshots and host-control acknowledgements.
- Command: `COMPOSE_PROJECT_NAME=qa-cont-t5 PUBLIC_PORT=8643 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses node tests/host/run-t5.mjs --sha d54c607d7fc6ce2d97e039bb108f52a37f2174ee --tasks T5a,T5b,T6`.
- Isolation and cleanup: preflight, H1 and fixture checks passed. The one QA stack was removed with **zero containers, volumes and networks**. A separate exact-label Docker check confirmed zero. The runner found no stop/restart among the ten pre-existing containers. Only own QA services were controlled.
- The original source checkout was read only; SHA-256 checks confirmed that its four recovered unfinished QA files remained unchanged. No real secret is included in this report.

The complete run passed **65 executed tests**: T5a main 22, runtime-expiry pass 1, T5b 24 and T6 18. The one deliberate TTL skip in T5a main ran and passed in its separate pass. There were no failed or flaky tests. All **49 required T5a/T5b/T6 AC IDs** passed.

Image identities from `V/images.json`:

| Service | Image | ID |
| --- | --- | --- |
| moodle | `erseco/alpine-moodle:v5.2.4` | `sha256:3a310197e51ff34c6e8e8adbb92703fe598f71cbcf9eb974055c27f07f4cb23d` |
| lti-service | `node:24.22.0-alpine3.24` | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| cogniate-app | `node:24.22.0-alpine3.24` | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| postgres | `postgres:16-alpine` | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` |
| proxy | `caddy:2.11.7-alpine` | `sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f` |

### T5a AC coverage

Command and evidence root are given above. The table maps the current acceptance spec to executed tests in `V/container-T5a/playwright-results.json`.

| AC | Result | Executed test / observation |
| --- | --- | --- |
| AC-T5-01 | PASS | /pkg/&lt;packageId&gt;/index.html: 200 text/html, nosniff, frame-ancestors content + app, no Set-Cookie; raw ../ and %2e%2e/ paths → 400 or 404 |
| AC-T5-02 | PASS | a Range request on assets/ask-lyra/lyra.mp4 → 206 video/mp4, Content-Range bytes 0-1023/10721508 |
| AC-T5-03 | PASS | /rt/&lt;token&gt;: frame-ancestors app; random token → 404; runtime iframe sandbox and allow exact; fullscreenEnabled; no Permissions-Policy on the shell |
| AC-T5-04 | PASS | the runtime frame has window.API with the 8 SCORM 1.2 functions; the package frame has CogniateSCORM.available === true |
| AC-T5-05 | PASS | the SCORM 1.2 API answers per contract §8 (301 before init, 405, 404, 403, 201, 201 on a new page load, 101 after LMSFinish) |
| AC-T5-06 | PASS | suspend_data and exit=suspend are kept: the next launch gets suspend_data "qa-resume" and entry "resume" |
| AC-T5-21 | PASS | a new learner attempt with LMSInitialize + LMSFinish only → outcome completed, Moodle shows 100 |
| AC-T5-22 | PASS | two sessions of 30 s (each LMSFinish, then window close) → total_time 0000:01:00.00 in the third session |
| AC-T5-07 | PASS | SCORM pass: within 60 s the shell says "Completed — score 100 sent to Moodle", Moodle shows 100 and completion done, the row is passed/100 with one sync sent |
| AC-T5-08 | PASS | SCORM fail: cg_student2 picks a wrong option and finishes → Moodle 0 and completion done; row failed, 0, one sync sent |
| AC-T5-20 | PASS | cg_student opens "Cogniate SCORM" again (the package calls LMSFinish at once): no new sync, best still passed, Moodle still 100 |
| AC-T5-12 | PASS | after AC-T5-07: a commit failed/0 with seq = lastSeq + 1 from the runtime frame → 200; no new sync; Moodle still 100 |
| AC-T5-23 | PASS | after AC-T5-08: cg_student2 relaunches, commits passed/100 and finish → one new sync sent, Moodle 100, best passed |
| AC-T5-13 | PASS | teacher preview: cg_teacher completes "Cogniate SCORM" → "Preview — no grade is sent"; the row has preview: true and no scoreSyncs; no teacher grade in Moodle |
| AC-T5-24 | PASS | version 2 published: cg_student2 continues version 1 (in progress); cg_student (final attempt) gets a new attempt on version 2 |
| AC-T5-34 | PASS | after the end, back to the menu page in the same window: no second finish, no new commit (at most one unload), outcome stays passed |
| AC-T5-35 | PASS | close mid-course: exactly one commit_accepted {unload} for the session, the attempt is in_progress, the next launch gets entry "resume" |
| AC-T5-37 | PASS | rebind with an in-progress attempt: the next launch opens the HTML course with a new attempt; the SCORM attempt stays in_progress, has no sync, and shows under the SCORM publication |
| AC-T5-15 | PASS | token scope: token A reads attempt A only, token B reads B only, a random token → 404; a commit with 1 ≤ seq ≤ lastSeq → 409 STALE_SEQUENCE; seq 0 or 1.5 → 400 INVALID_REQUEST (field seq) |
| AC-T5-16 | PASS | a commit with 5,000 chars of suspend_data → 400 INVALID_CMI, details.field cmi.suspend_data; commit_rejected logged |
| AC-T5-17 | PASS | from the package frame: fetch of {app}/app-api/me with credentials does not return the user; top.location = evil.test does not change the top window |

### Expiry and scope

`V/container-T5a/playwright-results.json` records 22 passed and the one deliberate TTL skip. `V/container-knob-PLAY_TTL_SECONDS/playwright-results.json` records the separate PASS: with `PLAY_TTL_SECONDS=20`, a commit at TTL + 3 seconds returns 410 `RUNTIME_EXPIRED`. The host restored default knobs and checked health before the following suites.

The full T5a pass covers SCORM pass/fail, resume and total time, preview, version pinning and rebind, final-result ordering, token/sequence validation, sandbox isolation and the single unload event. All 21 required ACs passed again after the score-sync product repair. No T5a product finding remains from this run.

This evidence covers Chromium and local Moodle 5.2.4. It does not establish other-browser or production-site behavior. T4b1/T4b2 and P1 passed separately on `a5d9ddcbc95cfb61968f70372334790386f2bb4b`; see their dated reports for that exact SHA and evidence. They were not rerun in this T5/T6 command.
