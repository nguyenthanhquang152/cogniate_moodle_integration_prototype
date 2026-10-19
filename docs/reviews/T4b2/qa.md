Verdict: PASS
Round: 1

# T4b2 QA verification

| Item | Value |
| --- | --- |
| SHA | `716a72c9edf7a5205d705adff8ad5598bdc6bb3d` (T4b2 `4c6a04d`, T4b1 round 2 `0fc5e33`, QA tests) |
| Spec | `tasks/T4b2.md` (ACs as of `2254792`), contract `cogniate-app-api.md` §5, §6, §12 at `61bef65` (page codes `INVALID_LTIK`, `PICKER_NOT_FOUND`, `PICKER_USED`, `PICKER_EXPIRED`, `PLAY_NOT_FOUND`, `LTI_SERVICE_ERROR`; `deep_link_rejected {reason: unknown_platform}`; `scoreSync.status: null` before a sync) |
| Run | The same T4b run as T4b1 (`run-t4b.mjs --tasks T3b,T4b1,T4b2 --replace-tests`): pass 1, the `PICKER_TTL_SECONDS=20` knob pass, `npm run seed:lti-activity` on the host, then pass 2 (AC-T4-18, -21, -32). Then a focused run (`--only AC-T4-28,AC-T4-29`) after one QA test fix. |
| Tests used | See `docs/reviews/T4b1/qa.md` (same tests). The Lead can commit `tests/**`. |
| Evidence roots | `E` = `tests/host/artifacts/qa-t4b-r1-716a72c9-2026-10-18T06-13-44-984Z/` (full run). `F` = `tests/host/artifacts/qa-t4b-r1-716a72c9-2026-10-18T06-18-20-591Z/` (focused run: the setup chain plus AC-T4-28 and AC-T4-29). |

## 1. Results per acceptance criterion

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T4-15 | PASS | `cg_teacher` → Select content: the picker lists exactly Thanh's available publications, as radios with the badges "SCORM 1.2" and "HTML". Picking the SCORM course fills the form. After save, the grade item has maximum 100, the connection is `connected`, and `stats.activities = 1`. | `E/container-pass1` |
| AC-T4-16 | PASS | Through "Cogniate (QA Library B)" in `COGNIATE-DEV-102`, the picker shows only library B's publication. | same |
| AC-T4-17 | PASS | `cg_student`: a new window ends at `/play/<id>` with no `ltik`. The `/tool/launch` 303 has `Referrer-Policy: no-referrer`. The shell shows the title and "Back to Moodle". Status: `not_started`, `preview=false`. `stats.learners = 1`. | same |
| AC-T4-19 | PASS | `cg_teacher` launch → `preview=true`. | same |
| AC-T4-20 | PASS | The unused ltik of a student resource launch (QA reads it from the 303 Location, so the app never sees it at `/tool/launch`) → `/tool/deep-link` gives a 403 page and `deep_link_rejected {reason: "not_deep_linking"}`. A POST to a used picker → 410 page. Knob pass (`PICKER_TTL_SECONDS=20`): a POST at TTL + 3 s → 410 page. | `E/container-pass1`, `E/container-knob-PICKER_TTL_SECONDS` |
| AC-T4-22 | PASS | `POST /tool/picker/<id>` with `Origin: https://evil.test`, `Origin: null` and no `Origin` → 403 and `csrf_rejected`. The picker is not used, and there is no deep-linking call. **Run on the real stack, no waiver** (Reviewer-A). | `E/container-pass1` |
| AC-T4-23 | PASS | QA intercepts the 303 to `/tool/launch` (it sends Moodle's id_token POST itself and reads the Location), changes `resource` to the HTML publication id, and opens that URL. The player still opens the **SCORM** course (from the signed target). **Run on the real stack, no waiver** (Reviewer-A). | same |
| AC-T4-24 | PASS | The captured `/tool/launch?…&ltik=` URL opened again in a new context → 409 page `HANDOFF_USED`, `handoff_rejected {code: HANDOFF_USED}` with the page's trace id, and no `launch_accepted` for that trace id. | same |
| AC-T4-25 | PASS | `cg_teacher` re-selects the HTML course for the SCORM activity. The next `cg_student` launch opens the HTML course (the shell shows its title), and `resource_link_rebound` is logged (from the SCORM to the HTML publication). | same |
| AC-T4-26 | PASS | A real picker POST with library B's publication id, and one with a withdrawn publication → 400 page `PUBLICATION_NOT_AVAILABLE`, with no deep-linking call for that trace id. | same |
| AC-T4-27 | PASS | Withdrawn publication → 410 page "This course is no longer available" (`PUBLICATION_WITHDRAWN`), no player. | same |
| AC-T4-28 | PASS | The picker and the player shell show `<b>x</b>` and the manifest title as text. No `<b>x</b>` or `<i>y</i>` element exists, and `window.__xss` is undefined in every frame. Moodle stores the activity name `<i>y</i>` as `y` (see section 2). | `F/container-focus` |
| AC-T4-29 | PASS | Status of an unknown `playId` → 404. Library B gets 404 for Thanh's publication after the launches (no stats leak). | `F/container-focus` |
| AC-T4-31 | PASS | With Thanh's tool on "Embed, without blocks": the Moodle iframe shows `/play/<id>/embedded` with "Open in a new window", and the button opens a working `/play/<id>`. With "Existing window", the player opens directly. Then QA set "New window" again. | `E/container-pass1` |
| AC-T4-18 | PASS | Pass 2, after `npm run seed:lti-activity` ("QA foreign" under Thanh's tool, pointing at library B's publication): `cg_student`'s launch → 404 page "This course is not available" (`PUBLICATION_NOT_IN_CONNECTION`), `launch_rejected {reason: publication_not_in_connection}`, no player. | `E/container-pass2` |
| AC-T4-21 | PASS | Pass 2: the CSP of the picker GET, the picker POST result, `/play/<id>`, `/play/<id>/embedded` and the error pages is as security §5 says. `Referrer-Policy: same-origin`, a nonce `script-src` where there are scripts, no `X-Frame-Options` on framed pages, no `Set-Cookie`. | `E/container-pass2` |
| AC-T4-32 | PASS | Pass 2: every tool error page of the run shows its code and trace id in the text, has `data-error-code`, `data-trace-id` and one non-empty `data-error-action`, and has no form. Each trace id is in the matching event: `launch_rejected` (AC-T4-18, -27), `handoff_rejected` (AC-T4-24), `picker_rejected` (AC-T4-20, -26), `deep_link_rejected {reason: not_deep_linking}` (the 403 page of AC-T4-20). | `E/container-pass2` |

## 2. Findings

Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.

### Q-T4b2-01 — NIT — Moodle cleans activity names, so AC-T4-28's `<i>y</i>` arrives as `y` (owner: Architect)

- **Location:** `tasks/T4b2.md` AC-T4-28 ("a Moodle activity named `<i>y</i>`").
- **Observation:** Moodle 5.2.4 stores the activity name with `PARAM_TEXT`, which strips tags. The activity is saved as "y", and the launch carries "y", so the activity-name case cannot carry markup into the player. The course and manifest title cases still test escaping, and they pass.
- **Suggested fix:** Use a name that survives `PARAM_TEXT`, for example `x < y & "z"`, or remove the activity-name case.

## 3. QA-side changes in this round

1. **AC-T4-28 lookup** (`T4b2/5-negative.spec.ts`): the test now finds the activity by the name that Moodle stored ("y"). In the full run it stopped at "activity not found" before its checks, and AC-T4-29 was skipped after it. The focused run then passed both.
2. The helper fixes for the tool settings save and the runner options are in `docs/reviews/T4b1/qa.md` section 3.

## 4. Not covered

- The new page codes `PICKER_NOT_FOUND`, `PLAY_NOT_FOUND`, `INVALID_LTIK`, `LTI_SERVICE_ERROR` and `deep_link_rejected {reason: unknown_platform}` have no T4b2 AC. QA saw only the codes that the ACs reach.
- `scoreSync.status: null` before a sync: the status check of AC-T4-17 reads `outcome` and `preview` only.


## Replacement QA final regression — 2026-10-19

Verdict: PASS

Replacement QA: Codex GPT-6-Astra, xhigh, under the continuation authority in `docs/team/charter.md`. This is independent replacement QA, not a cross-model review. Historical rounds above remain intact.

- Tested SHA: `a5d9ddcbc95cfb61968f70372334790386f2bb4b`. Product code remains `dd6dd1188833653cb92c63cc09e3c438ac3cb7b4`; later changes are docs and QA harness only.
- Fresh external clone: `/Users/quangnguyen/cogniate-qa-runs/qa-cont-t4b-a5d9ddcb-2026-10-19T10-05-11-656Z`. No `--checkout` or `--replace-tests`.
- Run: 2026-10-19, 10:05:11–10:10:18 UTC. Project `qa-cont-t4b`, port `8643`, subnet `172.29.0.0/16`.
- Full evidence root: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/moodle-lti-continuation/tests/host/artifacts/qa-cont-t4b-a5d9ddcb-2026-10-19T10-05-11-656Z`. `summary.json`, `images.json`, `cmd/`, `container-*/playwright-results.json`, traces, screenshots and service logs are retained there.
- Command: `COMPOSE_PROJECT_NAME=qa-cont-t4b PUBLIC_PORT=8643 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses node tests/host/run-t4b.mjs --sha a5d9ddcbc95cfb61968f70372334790386f2bb4b --tasks T3b,T4b1,T4b2`.
- Runner exit: `0`. Pass 1: 35 passed; two TTL tests deferred to their dedicated passes. Both TTL passes: 1 passed each. Final security pass: 3 passed. No required AC was skipped at completion.
- Cleanup: `TEARDOWN PASS`; zero project containers, volumes and networks. All ten other containers retained their start times. Every Moodle pause was undone.

Image content IDs are in `images.json`: Moodle `sha256:3a310197e51ff34c6e8e8adbb92703fe598f71cbcf9eb974055c27f07f4cb23d`; app/LTI Node `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f`; Postgres `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`; Caddy `sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f`.

### Final coverage

Evidence paths below are relative to the full evidence root. Each row maps to the named test in its Playwright JSON report.

| Criterion | Result | Evidence pass | Verified check |
| --- | --- | --- | --- |
| AC-T4-15 | PASS | `pass1` | the picker lists exactly Thanh's publications (radios, badges); picking the SCORM course makes an activity with a grade item of 100 |
| AC-T4-16 | PASS | `pass1` | through "Cogniate (QA Library B)" in COGNIATE-DEV-102 the picker shows only library B's publication |
| AC-T4-17 | PASS | `pass1` | cg_student opens the activity: a new window ends at /play/<id> without ltik; the 303 has no-referrer; status not_started or in_progress |
| AC-T4-18 | PASS | `pass2` | an activity under Thanh's tool that points at library B's publication → 404 "This course is not available"; no attempt |
| AC-T4-19 | PASS | `pass1` | cg_teacher opens the activity → play status preview=true |
| AC-T4-20 | PASS | `pass1, knob-PICKER_TTL_SECONDS` | /tool/deep-link with an unused student resource ltik → 403 page, deep_link_rejected {reason: not_deep_linking}; a POST to a used picker → 410 |
| AC-T4-21 | PASS | `pass2` | headers of the picker, the picker POST result, /play, /play/…/embedded and the error pages |
| AC-T4-22 | PASS | `pass1` | POST /tool/picker/<id> with Origin evil.test, null or none → 403, csrf_rejected; the picker is not used; no deep-linking call |
| AC-T4-23 | PASS | `pass1` | changing resource= in the handoff URL to the HTML publication still opens the SCORM course (signed target) |
| AC-T4-24 | PASS | `pass1` | the captured /tool/launch?…&ltik= URL opened again in a new context → 409 HANDOFF_USED; handoff_rejected; no launch_accepted |
| AC-T4-25 | PASS | `pass1` | the teacher picks the HTML course for the SCORM activity: the next cg_student launch opens the HTML course; resource_link_rebound |
| AC-T4-26 | PASS | `pass1` | a real picker POST with library B's publication id, and with a withdrawn one → 400 PUBLICATION_NOT_AVAILABLE; no deep-linking call |
| AC-T4-27 | PASS | `pass1` | a withdrawn publication: the launch shows 410 "This course is no longer available" |
| AC-T4-28 | PASS | `pass1` | the course title <b>x</b>, manifest title <img …> and activity name x < y & "z" stay safe; window.__xss stays undefined |
| AC-T4-29 | PASS | `pass1` | an unknown playId → 404; library B gets 404 for Thanh's publication after the launches (no stats leak) |
| AC-T4-31 | PASS | `pass1` | "Embed, without blocks" shows /play/<id>/embedded with "Open in a new window"; "Existing window" opens the player directly |
| AC-T4-32 | PASS | `pass2` | every tool page error shows its code, trace id and one action line (data-error-code, data-trace-id, data-error-action), has no form, and its trace id is in the matching log event |

### Prior failures and QA ownership

The `519b8aae` run had a stale AC-T4-17 expectation; the current spec permits the initial runtime commit to set `in_progress`. The corrected test passed in both later runs.

The `cf506285` run (`tests/host/artifacts/qa-cont-t4b-cf506285-2026-10-19T10-00-05-662Z`) failed before AC-T4-28 launch checks and skipped AC-T4-29. QA changed the old `<i>y</i>` activity fixture to the current spec text `x < y & "z"`, but compared that literal name to the HTML-escaped value from Moodle's course-contents API. The trace proves that Moodle displayed the literal name correctly. The repaired test reads the visible activity link and its module id. It keeps the title and `window.__xss` checks. Full rerun: AC-T4-28 and AC-T4-29 both PASS.

All failed-run evidence is retained. Both failed-run stacks were removed before a fresh clone was started; no other project was restarted. See the T4b1 replacement section for the original AC-T4-10 fixture cascade.

No product defect was found in the final T4b run. Limits: Chromium and local Moodle 5.2.4 only. AC-T4-28 proves the literal course title, the surviving activity name in Moodle, and no XSS execution in the tested frames. This report does not expand that result to every possible input or browser.
