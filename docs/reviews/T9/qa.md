Verdict: PASS
Round: 2 — final artifact candidate `39c401ae`, 2026-10-19

# T9 QA verification (QA-E2E)

The Lead gave T9 QA to QA-E2E (the first QA works on T8). Scope: AC-T9-01 (Lead-accepted QA run; unfamiliar-human follow-up stays HR-2), AC-T9-02 and AC-T9-03. AC-T9-04 belongs to Reviewer-B.

The current result is in §5. Sections 1–4 preserve the historical `bf22fb7` run and findings. The AC-T9-01 acceptance row below records the later Lead decision explicitly.

| Item | Value |
| --- | --- |
| Docs SHA | `bf22fb7` (Docs T9 round 1 fixes). AC-T9-01 ran on a fresh clone of `bf22fb7`. AC-T9-02 and AC-T9-03 read the committed `bf22fb7` text. |
| Spec | `tasks/T9.md` (AC-T9-01 to -04); charter §1 (document only what QA verified) |
| Isolation | Own project `qa-e2e-t9`, port 8543, subnet 172.31.0.0/16. QA did not touch any other project. After each run: 0 containers, 0 volumes, 0 networks of `qa-e2e-t9`. |
| Evidence root | `T` = `tests/e2e/artifacts/t9/qa-e2e-t9-bf22fb7-20261019T084016/` (git-ignored): `timeline.txt`, one log per step, `pages/` (screenshots, `results.json`). A first attempt at `4182c80` (`…/qa-e2e-t9-4182c80-20261019T083857/`) stopped at the course zips (finding Q-T9-02). |

## 1. Results per acceptance criterion

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T9-01 (command part, QA run) | PASS | QA followed only the root `README.md` "Quick start" and `docs/guides/run-the-stack.md` Procedures 1–3, in a fresh clone, on macOS (Docker 29.8.2, Node 24.21.0), with the images already pulled. **61 s** from the clone to both pages (limit 10 min). Steps: course zips into `docs/raw/data/courses/` (0 s), `npm ci` (3 s; the npm cache was warm), `npm run fixtures:check` (OK), `npm run gen-env` (1 s), optional `npm run stack:doctor` ("all checks OK"), `npm run e2e:reset` (42 s; a fresh clone has no data, so it did not ask for "yes", as the README says: "If it asks, type yes"), `npm run demo:prepare` (10 s), `npm run demo:users`, then the browser. Browser: Google Chrome 155 from `/Applications`, started by Playwright in headless mode with the same flags as `npm run demo:browser` (`--host-resolver-rules` for the four stack names, `--ignore-certificate-errors-spki-list` with the stack key), a throwaway profile. The Moodle login page answered HTTP 200 with the login form; `cg_student` signed in. The portal sign-in page answered HTTP 200 with "Sign in"; `thanh@cogniate.test` signed in (landed on `/integrations`). Passwords were read from `infra/.secrets/seed.json`, as the guide says. | `T/timeline.txt`, `T/*.log`, `T/pages/1-moodle-login.png` … `4-portal-signed-in.png`, `T/pages/results.json` |
| AC-T9-01 acceptance; HR-2 follow-up | PASS for AC-T9-01; HR-2 OPEN | No person who did not build the stack has done the run yet. Round 1 recorded command-part acceptance only. On 2026-10-19, the Lead explicitly accepted the 61-second QA run for AC-T9-01, as the spec permits. Unfamiliar-human usability remains unproven and does not block this AC. | Lead decision `msg_f6dfab32fc12`, reconfirmed in `msg_8f328327ccaa`; §5 below; `docs/human_review/decisions-needed.md` HR-2 |
| AC-T9-02 | PASS | All 177 tags in the 6 guides and the root README point to a QA row: each AC id has a PASS row in its task's `qa.md` (script check of every tag), and the "T7 qa.md §6" links exist. The only tag without a row is AC-T9-01 itself (this file). QA also read every guide for behaviour sentences without a tag: each one is tagged, or marked "[Not verified by QA]" / "pending QA" (T8, allowed). Section 3 lists the "[Not verified by QA]" items that this run and T7 §7 now verify, so Docs can tag them. | Section 3 |
| AC-T9-03 | PASS | `docs/human_review/proven.md` §3 lists all 8 "Not proven" items of `docs/architecture/README.md` §6: Safari Deep Linking (Q16), MoodleCloud (Q5), the player in Firefox and Safari, video playback, a real person closing a real window, mobile browsers, load and scale (Q11), 1EdTech certification (Q1). It adds the human-run items (HR-2, Q17) and the `.mbz` restore in the Moodle pages. `docs/human_review/decisions-needed.md` lists all 17 open questions (Q1–Q17) of `docs/architecture/open-questions.md`, each with a recommendation, who decides and what it blocks, plus the residual risks R1–R5 and the hand-over checks HR-1, HR-2. | `proven.md`, `decisions-needed.md` at `bf22fb7` |
| AC-T9-04 | — | Reviewer-B's check (STE). | `reviewer-b.md` |

## 2. Steps that were unclear, wrong or missing (AC-T9-01)

| Id | Severity | Where | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| Q-T9-02 | MINOR | `README.md` "Quick start" line "The two course zips must be in `docs/raw/data/courses/`"; `run-the-stack.md` "Before you start"; the `fixtures:check` message | A fresh clone has no folder `docs/raw/data/courses/`. A copy into it fails ("Not a directory"). QA's first attempt stopped there. | `tests/e2e/artifacts/t9/qa-e2e-t9-4182c80-20261019T083857/02-copy-zips.log` | Add one step: "Make the folder: `mkdir -p docs/raw/data/courses`. Copy the two zips into it." (Docs; the `fixtures:check` text: Author.) |
| Q-T9-01 | NIT | `run-the-stack.md` (no step), `troubleshooting.md` row "Port 443 … is busy" | On a Mac that already runs another stack, the guides do not say how to give this checkout its own port, project name and subnet. QA set `COMPOSE_PROJECT_NAME`, `PUBLIC_PORT` and `STACK_SUBNET` for `gen-env` (from `infra/README.md`, "Separate checkout"). A new person with one stack does not need this. The port row in troubleshooting works (edit `.env`, run `gen-env`). | `T/05-gen-env.log`, `T/06-stack-doctor.log` | Optional: one NOTE in the run guide that links to `infra/README.md` "Separate checkout". |
| Q-T9-03 | NIT | `run-the-stack.md` Procedure 5 result "the containers stop. The data stays" | `npm run stack:down` removes the containers (not only stops them). The data stays: the three volumes were still there after the command. | `T/11-stack-down.log`, `T/volumes-after-stack-down.txt` (3 volumes), `T/containers-after-stack-down.txt` (0) | "The containers are removed. The data stays." |

Not a problem: the time for `npm ci` (3 s) is with a warm npm cache. On a new Mac the first `npm ci` also downloads the packages; T9.md counts only pulled images.

## 3. "[Not verified by QA]" items that QA now verified

Docs can replace these tags with the evidence below (`T` = section 1 root; T7 §7 = `docs/reviews/T7/qa.md` §7).

| Guide line (`bf22fb7`) | What QA saw | Evidence |
| --- | --- | --- |
| `run-the-stack.md` "Optional: run `npm run stack:doctor`" (and `troubleshooting.md` line 5) | One line per check with `OK`, `FIX` or `INFO`. With the zips missing it printed `FIX` and the fix; with everything ready, "Result: all checks OK." | `T/06-stack-doctor.log`; the `4182c80` attempt `06-stack-doctor.log` |
| Procedure 1 step 7, Procedure 4 step 2: "When the command asks, type `yes`" | With stack data, `npm run e2e:reset` in a terminal printed the WARNING, asked "Type yes to delete the data and go on …", took "yes", and reset the stack (44 s; new `seed.json`, new containers). On a fresh clone it does not ask. | `T/21-e2e-reset-answer-yes.log`, `T/07-e2e-reset.log` |
| The same question, answer "no" (`e2e:reset` and `test:e2e`) | "Stopped. Nothing was deleted.", exit 1, stack unchanged. | T7 §7 |
| Procedure 6 step 2 and NOTE: `test:e2e` asks; with `-- --yes` it does not ask | Asks in a terminal (T7 §7). The QA runner always uses `-- --yes`: no question, the run goes on. | T7 §7, T7 §5 |
| Procedure 2: `npm run demo:users` | Lists the web addresses, the users with the `.env` name of each password, the two courses and the two Cogniate activity URLs. It prints no password. | `T/09-demo-users.log` |
| Procedure 3 steps 3–5 (and the flags of `demo:browser`) | With the same flags as `demo:browser` (Chrome 155, headless): the Moodle login page, sign-in as `cg_student`, the portal sign-in page, sign-in as Thanh. QA did not run the command itself, because it opens a window on the desktop. Step 2 ("A new Chrome window opens") stays not verified. | `T/pages/` |
| Procedure 5: `npm run stack:down` | Exit 0. The containers are removed; the data volumes stay (see Q-T9-03). | `T/11-stack-down.log` |

Still not verified by QA (correctly marked in the guides): the default port 443; the window of `demo:browser`; `npm run demo` as the first command; the badges "Link expired" and "Disconnected" and the "Disconnect" button; the pending-tool clean-up; the native-channel steps in the Moodle pages and Options B and C (T8 pending); the troubleshooting rows marked "No"; Safari, Firefox, MoodleCloud.

## 4. Notes

- `docs/architecture/open-questions.md` R4 says "Chromium and Firefox work". QA tested Chromium only. The pack (`decisions-needed.md` R4) says "Other browsers are not proven", which is correct. The Architect file is outside T9 (NIT for the Architect).
- After `bf22fb7`, Docs committed `5187765` (T9 conformance), and the Architect is editing `docs/architecture/README.md` §6 and `open-questions.md`. If §6 or the open questions change, AC-T9-03 needs a short re-check.

## 5. Replacement QA-E2E final verification — 2026-10-19

**PASS for the named final artifact candidate.** AC-T9-01 uses the Lead-accepted historical QA substitute. AC-T9-02 and AC-T9-03 pass independent QA-E2E verification. AC-T9-04 passes under Reviewer-B's authority. No new product or pack finding remains from this round.

### Provenance and isolation

Dedicated replacement QA-E2E: **Codex GPT-6-Astra, xhigh**, under the [continuation authority](../../team/charter.md#continuation-authority-2026-10-19). This role is independent of Authors, Docs, Architect and reviewers. This is not a cross-model review. No product files, Docs-owned files, commits, pushes or subagents were made by this worker.

| Item | Exact value |
| --- | --- |
| Reviewed final artifact candidate | `39c401ae7247547a6a503414ffa699aaea6fb884` |
| Pack source stamp | `6932539d4b44e017dd54acc8dc37c6bb2ba9fed1`, dated 2026-10-19; verified ancestor of the artifact commit |
| Fresh T7 candidate | `c5683f896330debaea5e9a09f49357dc3e99e92b`; all 15 ACs PASS in [T7 QA §10](../T7/qa.md#10-replacement-qa-e2e-repair-regression--2026-10-19) |
| Repaired product | `d54c607d7fc6ce2d97e039bb108f52a37f2174ee`; product and harness are unchanged between the fresh T7 candidate and this artifact candidate |
| Independent STE authority | Reviewer-B's [final continuation verdict](reviewer-b.md#final-continuation-verdict--2026-10-19), committed in `20c12e24a4a0afda6e6627bf6ad37abd8e00ceda`, reviews the same `39c401ae` artifacts |
| External verification clone | `/Users/quangnguyen/cogniate-qa-runs/qa-e2e-t9-final-39c401ae-20261019`, detached at the artifact candidate; tracked files remain clean |
| Evidence root | `V` = `tests/e2e/artifacts/t9/continuation/final-39c401ae/` in the continuation worktree; local, git-ignored |

Fresh T7 ran first, before Docs built this final pack. Its result was sent promptly to the Lead and committed in `a5633697206831d5a148f872d08e45d803dce4cd`. It used its own project, port and subnet; teardown left zero own resources. The ten baseline containers retained their IDs, start times and running state. Final T9 started no Moodle stack. Its media containers used `--rm`; the final exact-label resource check still returns zero containers, volumes and networks for `qa-e2e-cont-p2`.

Only README and `docs/**` differ from the fresh T7 candidate. The product delta after `dd6dd11` remains migration 010, score-sync domain/worker changes and runtime-path tests, recorded in T7 §10. Architect [conformance §10](architect-conformance.md#10-round-3-p2-late-remote-write) assessed T8 impact: no native-channel, Build Runner or infra change. QA checked that delta independently. T8 retains its dated `8059c31` evidence; no new T8 run is claimed.

### Final acceptance criteria

| Criterion | Result | Verification |
| --- | --- | --- |
| AC-T9-01 | PASS — Lead-accepted QA run | The Lead explicitly accepted the historical `bf22fb7` fresh-clone run, as the spec allows. It reached both login pages in 61 seconds, with images pulled and a warm npm cache; both sign-ins passed. No unfamiliar human performed it. HR-2 remains open. The final guides retain the fixture-folder, separate-checkout and container-removal corrections for Q-T9-01 to Q-T9-03. |
| AC-T9-02 | PASS | Read README and all six guides at the exact candidate. New behavior has a supported PASS AC/report link or an explicit unverified boundary. The structural scan finds 216 explicit AC/LC/C-T8 tags, 78 unique IDs, and no missing report ID. Manual review checks the meaning and scope, including ranges and direct report links; tag presence alone is not proof. |
| AC-T9-03 | PASS | Reconciled architecture README §6 against `proven.md`, its QA notes, and the explainer. All Not Proven and Not Guaranteed boundaries remain. Both decision forms retain all 25 IDs with recommendations: Q1–Q18, R1–R5, HR-1 and HR-2. Recommendations agree with `open-questions.md`; no human decision is invented. |
| AC-T9-04 | PASS — Reviewer-B | [Reviewer-B's confirmed PASS](reviewer-b.md#ac-t9-04--confirmed-pass) covers 14 Markdown files, explainer data and English video text. Procedure/description maxima are 18/25, 18/23 and 7/23 words respectively; paragraph maximum is six sentences. NOTE and data-risk WARNING usage pass. The report discloses its method, exact UI-term exceptions and Vietnamese exclusion. QA-E2E does not replace this authority. |

### Guide evidence and retained boundaries

| Area | Supported proof and explicit limits |
| --- | --- |
| P1 connection feedback | Admin and troubleshooting guides link final T4b1 QA at `a5d9ddcb`: disabled Connect, 15-second wait text, one confirm POST and `MOODLE_TOOL_MAY_EXIST`. Manual Pending-tool cleanup and URL reuse remain unverified. |
| P11 lower retakes | Learner guide's current 75 / best 90 sent example links final T5b QA at `d54c607d`. Sent, pending and failed best-score states passed live. Scoreless and lower-retake conflict states remain unverified live. |
| P2 confirmation | Final T5b evidence records first accepted 90 pending across a real app restart, successful confirmation after 5.623 seconds, and 90 seconds of stable Moodle grade 90. The pack presents this finite observation accurately. T7 is not claimed as the late-write-race test. |
| P2 residual and upgrade | An older remote request can write after accepted confirmation. The five-second gap cannot prove all remote work finished. Guides, review text, explainer and video narration retain the remote-ordering limit. The written pack and explainer also state that migration 010 cannot reconstruct unrecorded sends from before the upgrade. Author synthetic upgrade evidence stays distinct from independent QA. |
| P5 | The pack calls the missing-higher-sync check fixture-assisted. Final T5b QA removed exactly one higher failed sync and verified lower Resend returned `409 SYNC_NOT_RESENDABLE`. It is not presented as pure black-box proof. |
| T8 | AC-T8-02 through -10 and both race checks passed at `8059c31`. Backup API, CLI restore, native SCORM grade, token API, course shell and Publish controls are distinguished from unverified portal backup steps, token form, Moodle-page restore and MoodleCloud. |
| Q18 | Subfolder Moodle is unsupported: dynamic registration is refused, web-service/course links use the wrong path, and manual connect is untested. The pack does not claim support. |
| Run and browser commands | Desktop `demo:browser`, default port 443, first-command `npm run demo`, unverified troubleshooting fixes and unfamiliar-human use remain marked. Fresh T7 supplies current reset, refusal, demo and grade timing evidence. |

The complete architecture Not Proven list is retained: teacher Firefox/Safari paths; MoodleCloud and subfolders; other player browsers and mobile; visible video playback; real window closure; normal pointer use of the HTML menu link; load/scale; and 1EdTech certification. T5/T6 limits include the full live 24-hour retry window, untested P11 states, viewports beyond 1440 pixels, untested card/error states and accessibility beyond the specified checks. T8 limits include the 10-minute timeout, interrupted-build sweep, planted-request rejection and backup-copy checks, plus its UI limits above. P2 remote ordering and pre-upgrade recovery limits remain explicit.

Q4 remains open with no human approval of the P2 limit. HR-1 still needs a Vietnamese team member's wording and voice approval. HR-2 remains an unfamiliar-human follow-up. Accepted deferrals remain separate; A-T9-C01 describes repeated preparation lookup failures at a five-second delay, with no score POST and the 24-hour limit intact. The resolved T8 races are historical findings, not current defects.

### Generated and rendered artifacts

`node docs/human_review/tools/build-md.mjs --check` exits 0 in the isolated clone: `flows.md` is up to date. All seven human-pack Markdown stamps, explainer metadata and script metadata name `6932539`, dated 2026-10-19. Decoded video frames show that source too. All 131 local Markdown links and 63 checked fragments resolve. Evidence: `V/build-md-check.log`, `V/docs/docs-audit.json`, `V/provenance.json`.

The standalone explainer passed offline in a fresh headless Chrome context at 1440×1000. All five tabs, five story steps, five flows with 39 steps, diagram highlights, keyboard navigation and autoplay worked. All four proof filters worked, including the empty pending group. All 25 decisions have recommendations. A temporary name, Q4 answer and note survived reload; export included the answer and source stamp with clipboard access blocked. Clear removed the temporary answers. There were zero HTTP requests and zero page errors. No human decision was submitted. Evidence: `V/offline/offline-results.json`, tab/flow screenshots and four decision-card screenshots.

| Committed video | Duration | Bytes | Result |
| --- | --- | --- | --- |
| English | 182.4 seconds | 2,211,513 | PASS |
| Vietnamese | 212.4 seconds | 2,567,661 | PASS |

Both videos are below 240 seconds and 8,000,000 bytes. Both contain H.264 1280×720 video at 5 fps and mono AAC audio at 44,100 Hz. Full decode of both streams exits 0. Audio ends at 174.531111 seconds and 202.731066 seconds respectively, followed by the final held slide.

QA independently regenerated all 26 narration clips from the committed script, using its named voices and rates. The rebuilt AAC streams match the committed videos byte for byte. QA also regenerated all 26 slide PNGs and compared one decoded midpoint frame per slide. Minimum frame SSIM is 0.991417 for English and 0.982619 for Vietnamese. All slides correspond to the final script. The first audit assertion wrongly equated audio duration with video duration; it was corrected to include the documented final slide hold, then passed. This was a QA assertion issue, not a video defect.

QA visually inspected all 26 decoded slide frames through contact sheets, the full-size P2/decision frames, and the rendered explainer tabs and decision cards. Text and captions fit; source stamps, updated evidence, P2 limits and the Vietnamese machine-translation notice are visible. This artifact check does not approve Vietnamese voice quality or unfamiliar-human usability. Evidence: `V/media/media-results.json`, `V/media/{en,vi}/{frame-*.png,slide-*.png,contact.png}`, and `V/offline/`.

Artifact SHA-256:

- English: `4901730820675e93a8dd6bf644259dc2d7ed39775b8e34724469653324215934`.
- Vietnamese: `26f4cadd96fe5dae039be25059d539d1daba7c74895ad29047d5d778755db4d7`.

### Root validation and final state

After `npm ci`, root `npm run check` exits 0 at the exact final candidate: lint PASS, type checking PASS, **708 tests PASS in 48 files, zero failed and zero skipped**. All five fixture-dependent tests ran: SCORM/HTML inspection, SCORM extraction, and SCORM/HTML upload. The known real fixtures were copied into this isolated clone; their source was read only. SHA-256 values match the T7 copies:

- SCORM: `a685744e5fd9de21c203c3b2f47916ef1079532196ed870df89a00ab8ee76df7`.
- HTML: `9f04d3abd65f85e362b2dca5207cc4b86ffa286e4b1a73923c157b69321f3f6d`.

Evidence: `V/root-check.log`, `V/npm-ci.log`, `V/provenance.json` and `V/cleanup-final.json`. Audit helper scripts are local under `tests/e2e/artifacts/t9/continuation/`. Raw T7 traces and HTML reports remain private because they contain secrets; this report contains none.

Both parts of this dispatched task are complete: fresh T7 passed, then final T9 and artifact verification passed. Remaining human decisions and documented limits remain open as stated. They are not missing QA work under the accepted T9 criteria.
