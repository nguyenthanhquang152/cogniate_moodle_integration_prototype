Verdict: PREPARED — M2 browser suite and runner are ready; harness checks only, no product verification
Round: 2 (alignment, task `task_ef66f1c5c7ed`; see §7)
Owner: independent Claude QA-E2E, claude-opus-5-5, xhigh
Behavior baseline: `56591df0e71939d5d62c9042c630c841d01f84e8` (ADR-011 revision 6). Criteria: [M2](../../architecture/tasks/M2.md), [M3 §2–§4](../../architecture/tasks/M3.md).

## 1. Scope and independence

This plan covers all 13 M2 criteria for **both** providers and the shared portal, and the QA-E2E parts of M3.
I wrote the tests from M2, the app contract and the T6/T8 QA tests. I did not read portal or app code, author notes or reviews.
The suite uses the QA simulator for the LMS side. Every result is `SIM`: it never says "works with Canvas" or "works with Blackboard".

## 2. Files

| Path | Content |
| --- | --- |
| `tests/e2e/M2/*.m2.ts` | 64 browser rows, one per named variant. The `.m2.ts` suffix keeps them out of the T7 suite (`**/*.spec.ts`). |
| `tests/e2e/M2/lib/m2.ts` | M2 texts (exact strings of M2), portal steps, approval-code masking, clipboard and storage checks. |
| `tests/e2e/M2/manifest.json` | Machine inventory: `{ id, ac, environment: "SIM", title, kind: "browser", file }`. |
| `tests/e2e/M2/coverage.mjs`, `coverage.selftest.mjs` | Independent inventory (`M2_REQUIRED`); strict result accounting with the common rules (no skip, no retry, no missing row, same SHAs). |
| `tests/e2e/M2/playwright.config.ts` | Chromium, 1440 × 900, one worker, `retries: 0`, traces and videos off (they would hold typed codes). |
| `tests/e2e/host/run-m2.mjs` | Host runner: `--harness-only`, or a product run on a reserved lane. |
| `tests/acceptance/M1/canvas/browser.ts`, `constants.ts` | Shared vitest-free glue (sessions, operator CLI through the M1 host channel, bindings, simulator launches). |

## 3. Criteria and rows

Every row is **PREPARED, NOT RUN**.

| AC | Rows | File | Variants | Oracle |
| --- | --- | --- | --- | --- |
| AC-M2-01 | 3 | 01-cards | `cards`, `isolated-newest`, `moodle-card` | Card texts and initials; with equal names and creation times, "Manage" of each card opens its own LMS's newest connection, and only the Canvas card changes when the newest Canvas connection changes; Moodle card and wizard fields unchanged |
| AC-M2-02 | 2 | 00-blackboard-not-ready (runs first) | `not-ready`, `ready` | Not-ready text and disabled Connect; after the shared platform, Connect works and step 2 shows `qa-bb-app` |
| AC-M2-03 | 19 | 02-canvas-wizard | `profile-labels`, 16 site-rule rows (`rule1-http` … `rule4-service-sso`), `valid-split`, `valid-default-service` | Labels equal `lms-providers`; rule text on the right field with `aria-invalid="true"`; no connection on error; one pending connection with the entered values |
| AC-M2-04 | 6 | 02-canvas-wizard | `rows`, `copy-json`, `download-json`, `inline`, `clipboard-denied`, `download-failure` | Four rows in order with Copy; clipboard and download byte-equal to `GET …/canvas-configuration` (and `?jwk=inline` with the `Key id` text); selectable text box when the clipboard is denied; no success after a failed download |
| AC-M2-05 | 6 | 02-canvas-wizard | `success`, `grant-invalid`, `grant-mismatch`, `platform-in-use`, `invalid-values`, `lti-service-error` | Registered and step 4 teacher steps; each error text; connection stays `pending`; code field empty and absent from URL and web storage |
| AC-M2-06 | 4 | 03-blackboard-wizard | `success`, `deployment-in-use`, `retry-after-error`, `second-deployment` | Registered with Ultra and Original steps; conflict text; second Save after a gate failure registers; mismatch text with the field marked and the reservation kept; no issuer, endpoint or secret field |
| AC-M2-07 | 3 | 04-detail | `badges`, `canvas-detail`, `no-add-elsewhere` | LMS badge per connection; Canvas site, service URL and added deployment listed; no "Add deployment ID" for Moodle and Blackboard |
| AC-M2-08 | 3 | 04-detail | `canvas-no-moodle-features`, `blackboard-no-moodle-features`, `moodle-controls` | No web services section and no "Also create an empty Moodle course"; Moodle keeps its section; `.mbz` label "Moodle backup (.mbz) – Moodle only" |
| AC-M2-09 | 3 | 04-detail | `blackboard-dialog`, `canvas-dialog`, `moodle-dialog` | Exact Blackboard text and `disabled` after confirm; Canvas dialog names Canvas; Moodle dialog stays Moodle (see H-3) |
| AC-M2-10 | 2 | 05-publish-results | `publish-dialog`, `canvas-results` | Title "Publish to an LMS"; options `<name> (<LMS>, <site host>)` for ready connections only; Canvas learner label and Canvas texts on results |
| AC-M2-11 | 6 | 06-keyboard-axe | `canvas-keyboard`, `blackboard-keyboard`, `add-deployment-keyboard`, `axe-canvas`, `axe-blackboard`, `axe-canvas-detail` | Tab, Shift+Tab, Enter, Space only; visible focus on each control; error announced in a status or live region; axe: no serious or critical issue |
| AC-M2-12 | 2 | 07-sim-scenario | `canvas`, `blackboard` | Portal wizard and grant; real HTML course uploaded and published in the portal; framed simulated teacher pick verified by the simulator; learner completes in the real package ("Completed — score 100 sent to <LMS>"); results row "Sent" |
| AC-M2-13 | 5 | 08-routes | `routes-open`, `cross-provider`, `no-stale-values`, `form-state`, `cross-library` | Each route opens its view; cross-LMS and cross-library ids show "not found" without values; no Canvas value appears at any time on the Blackboard detail; typed Canvas values never appear in the Blackboard wizard |

Screenshots: every wizard step of both providers (AC-M3-03), each dialog and each error case. `shot()` masks every `Approval code` input; traces and videos are off.

## 4. M3 rows owned by QA-E2E

| M3 AC | Plan |
| --- | --- |
| AC-M3-02a | T7 three runs, default profile, no simulator (existing `tests/e2e/host/run-t7.mjs --runs 3 --demo --check-confirm`), after the Lead approves the T7 selector changes of H-6. |
| AC-M3-03 | This suite: 64 rows with screenshots, recorded in `docs/reviews/M2/qa.md`. |
| AC-M3-04, -07 | Keys only in simulator memory; the runner reads `/__sim/secrets` inside the simulator container into memory and scans service, simulator and gate logs and the redacted evidence (row `M3-07-M2`, zero hits). |
| AC-M3-05 | Live matrix stays UNVERIFIED until written authorization exists; local Canvas only after SIM passes (preflight `docs/reviews/M0/qa-e2e-preflight.md`). |
| AC-M3-06 | Reserved lane only; the runner records other volumes and containers before and after (row `M3-06-M2`). |

## 5. Commands

Harness only (no Docker, no product call):

```sh
node tests/e2e/host/run-m2.mjs --harness-only
```

Product run (the Lead commits the tests, freezes both SHAs and reserves the lane; at most two stacks on this machine):

```sh
COMPOSE_PROJECT_NAME=qa-e2e-m2-r1 PUBLIC_PORT=8643 STACK_SUBNET=172.27.0.0/16 \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
  node tests/e2e/host/run-m2.mjs --sha "$QA_PRODUCT_SHA" --test-sha "$QA_TEST_SHA"
```

The runner: fresh clone, frozen tests, course zips with SHA-256 check, `STACK_PROFILE=acceptance` stack, seed, health (both simulation profiles, `lms-sim`, `lti-gate`, no knobs), one Playwright pass in the `e2e` container with the M1 host channel (operator CLI only), strict accounting, leak scan, isolation check, label-scoped teardown. Estimate, not a measurement: 45–75 minutes on warm images.

Harness evidence (2026-10-20): `node tests/e2e/host/run-m2.mjs --harness-only` → 2 self-tests pass, typecheck pass, 64 M2 rows discovered and equal to the manifest, T7 selection unchanged (18 tests).

## 6. Open items

Status after round 2 (§7):

| Id | Item | Status |
| --- | --- | --- |
| H-1 | Portal structure that M2 does not name. | Closed: aligned to the committed portal (§7.2). Assertions unchanged. |
| H-2 | Canvas and Blackboard card status labels are not specified; the isolated-status oracle uses "Manage" targets and a differential check. | Kept (no criterion text exists) |
| H-3 | Exact pre-M2 Moodle disconnect text. | Closed: exact baseline from `9e24137` asserted (§7.3). |
| H-4 | Moodle web services with a token (AC-T8 recipes). | Codex QA legacy run (AC-M3-02b), Lead decision |
| H-5 | AC-T6 recipes with the label changes. | Codex QA legacy run (AC-M3-02b), Lead decision |
| H-6 | T7 selectors for the M2 label changes. | Closed: Lead-approved changes applied (§7.4). |
| H-7 | M2 run path. | Closed: Lead chose `tests/e2e/host/run-m2.mjs` with the existing infra helpers; `tests/playwright.config.ts` does not change. |
| H-8 | `DEPLOYMENT_FIXED` text. | Author-2 unit test only (approved criteria) |

No live tenant, public tunnel, account or Docker setting change is part of this plan.

## 7. Round 2 — alignment and review repairs (2026-10-20)

Inputs: the committed portal source (now allowed for H-1 only: `apps/portal/src/connect/**`, `Integrations.tsx`, `ui.tsx`, `ui/dialog.tsx`, `ui/badge.tsx`, `NotFound.tsx`, `courses/PublishDialog.tsx`, `courses/Publications.tsx`, `results/Results.tsx`), the accepted baseline `9e24137` (`DisconnectDialog.tsx` only), Reviewer-B M3 findings B-M3-01 and B-M3-02, and the Lead handoff. The manifest keeps the same 64 case ids; four titles changed.

### 7.1 Review repairs

| Finding | Repair | Affected rows |
| --- | --- | --- |
| B-M3-01 (wizard) | Step 1 `Next` creates the connection and opens `/integrations/<lms>/<id>`; the setup step and the approval step show together. The second `Next` is removed from the shared helpers and from every direct, keyboard and axe path. A new check `pendingWizard()` waits for the connection route, the step 2 heading and the `Approval code` field. Screenshots of every step stay. Axe now analyzes step 1 and the combined steps 2–3 page. | `M2-03.valid-*`, `M2-04.*`, `M2-05.*`, `M2-06.*`, `M2-11.canvas-keyboard`, `M2-11.blackboard-keyboard`, `M2-11.axe-canvas`, `M2-11.axe-blackboard`, `M2-12.*` |
| B-M3-01 (badges) | The case opens each connection's own view (`/integrations/<lms>/<id>`), asserts the LMS badge of the connection overview, and asserts that the connection list (`LMS connection`) names every connection as `<name> (<LMS>, <site host>)`, for all three LMS types. | `M2-07.badges` |
| B-M3-02 | `no-stale-values`: one document load only; a sentinel and a MutationObserver stay installed; Canvas connection answers are held for 3 s and a "Refresh status" request is in flight during the client-side move (the connection list of the overview); after the move the case waits for the held answers and one poll, then asserts the same sentinel, a non-empty late-request list, no Canvas value seen at any time, and none on the final page. `form-state`: one document load; typed Canvas values; client-side move through the `Integrations` link and the Blackboard card link; a sentinel, observer and 25 ms input check stay installed; same sentinel, no typed value in any input or text. Direct-route and library cases keep their separate assertions. | `M2-13.no-stale-values`, `M2-13.form-state` |

### 7.2 Structure aligned (H-1)

| Assumption in round 1 | Committed portal | Change |
| --- | --- | --- |
| Rows found by a `Copy` button | Table rows: label as row header, value cell, button named `Copy <label>` | `M2-04.rows` finds `tr` by its row header and clicks `Copy <label>`; value, order and clipboard checks unchanged |
| A failed download from an aborted API call | The file is built in the browser from the loaded export | `M2-04.download-failure` makes the browser refuse the file (`URL.createObjectURL` throws); it still asserts no download, an error alert and no success text |
| Connection list on the Integrations page | Connection overview of each connection view | `M2-07.badges` (§7.1) |
| "Not found" text, results label `Sent`, dialog and confirm buttons, picker submit | `Page not found`; results status `Sent`; `<dialog>` with `Disconnect`; server picker button | No change needed |
| Blackboard registration text (`9f96f7b`, final Learn `Submit`) | Step data only | No change needed; no case asserts those sentences |

### 7.3 Exact Moodle disconnect baseline (H-3)

`M2-09.moodle-dialog` now asserts the dialog heading `Disconnect Moodle?` and the text `This stops launches through this connection. The tool stays in Moodle.` exactly (from `9e24137` `apps/portal/src/connect/DisconnectDialog.tsx`), and that the dialog names neither Canvas nor Blackboard.

### 7.4 T7 selector changes (H-6, Lead-approved under AC-M3-02 and the M2 label table)

File: `tests/e2e/lib/portal.ts`. No other T7 file and no T7 assertion changed. The Moodle identity, site, availability (`Available in Moodle`, `Selected in Moodle`), grades and results checks stay as before.

| Helper | Old selector | New selector | Reason |
| --- | --- | --- | --- |
| `publishCourse` | link or button `Publish to Moodle` | `Publish to an LMS` | M2 label table: button and dialog title |
| `publishCourse` | select label `Moodle connection` | `LMS connection` | M2 label table |
| `publishCourse` | option text starting with `<name> ·` | option text exactly `<name> (Moodle, <host of PUBLIC_MOODLE_URL>)` | M2 option format; the exact match also proves the selected option is the Moodle connection on the Moodle site |
| `publicationBlockText` | wait for `Moodle publications` | `LMS publications` | M2 label table |

Affected T7 tests: `A3` (`1-scenario-a.spec.ts`, publishes both courses), `A4 AC-T7-03 AC-T7-02` (reads the publication block: "Selected in Moodle"), and `B3` (`2-scenario-b.spec.ts`, publishes the library B course). AC-T7 criteria and their oracles do not change.

### 7.5 Harness evidence (round 2)

`node tests/e2e/host/run-m2.mjs --harness-only`: 2 self-tests pass, typecheck pass, 64 M2 rows discovered and equal to the manifest, and the T7 selection is unchanged. `QA_SUITE=e2e playwright test --list`: 18 tests in 6 files, no M2 file. No stack and no product call.
