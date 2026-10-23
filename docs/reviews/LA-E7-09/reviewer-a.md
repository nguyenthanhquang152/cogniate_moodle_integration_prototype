Verdict: CHANGES_REQUESTED
Round: 1

# LA-E7-09 Reviewer A (lens: is it right and is it safe?)

Reviewer: Reviewer-A (Claude Opus 5.5 xhigh), 2026-10-23 (UTC). This is the first Reviewer-A file for LA-E7-09.

## Round 1 (slot 8 live checks)

Scope: `git show b5f68c4b` (la-qa 0ebbd1ee). The files are `tests/e2e/ltiaas/05-moodle-live-slot8.moodle.ts`, `playwright.moodle-live.config.ts`, `run-slot8-moodle.mjs` and the slot 8 round in `docs/reviews/LA-E7-09/qa.md`. I compared them with the AC texts of LA-E7-09, LA-E3-05 (AC-04, AC-11), LA-E4-03 (AC-09) and LA-E5-22 (AC-06), and with `tests/ltiaas/GATE-RUN-PLAN.md` §5. I read the evidence read-only: the 10 run folders `la-qa/tests/host/artifacts/qa-e2e-la-s8-*`, and `SLOT8-QA-E2E/{clone-r2-run,boundary,logs}`. I did not open `reviewer-b.md`. I did not start Docker or a stack.

### Summary

The functional live checks prove what they claim for this run, and the files that ran equal the committed spec. But the committed runner's secret-scan step throws on every run. Because of this, the "0 hits for 35 secrets" result comes from a check outside the run. That check also missed a capability token that is in the artifacts. Counts: 0 BLOCKER, 1 MAJOR, 2 MINOR and 1 NIT.

### What I checked

| Area | Result | Evidence |
| --- | --- | --- |
| Committed files equal what ran | Yes for the spec, no for the runner | `--replace-tests` copied the la-qa tree into `clone-r2-run` at 23:14:56Z, which is the start of the primary run. In that copy, `05-moodle-live-slot8.moodle.ts`, `playwright.moodle-live.config.ts` and `lib/k2.ts` have the same sha256 as the blobs at b5f68c4b. `run-slot8-moodle.mjs` differs only at the scan lines (369-370 in the copy; 369-371 in the commit). The artifacts record no hashes, so I compared the clone copy with the blobs myself. |
| K2 U1 (S8-01) | Proves it | The cards come from the product registry (`loadProductChannelRegistry`). The test checks title, description, icon or mark, and the Connect route for each channel. It checks the DOM order against `card.order` and the `/app-api/lms-providers` order. A missing card or a wrong order fails the test. |
| K2 U2 (S8-02) | Proves it | `createFields`, `bindingFields` with their defaults, the artifact buttons, the tool rows (Moodle row 13 `nrps` = "Do not use this service") and every `adminSteps` text come from the manifest. A Rule 1 path is refused, and the connection count stays the same (spec:337). See A-LA-E7-09-04 for a loose text match. |
| LA-E3-05 AC-04 (S8-04) | Picker part proved | The test decodes `accept_multiple: true` from the captured DL `id_token`. It expects 3 radios and 0 checkboxes. After the two picks, each publication has `stats.activities` = 1 (spec:716-717), so a product that sends more than one item fails the test. The AC's "T7 passes unchanged" part is not in this run (see A-LA-E7-09-03). |
| LA-E3-05 AC-11 (S8-04) | Proved for this run | Cancel gives a 200 response with a signed JWT, `content_items: []` and the message "No course was added.". The oracle shows 0 LTI modules in course 101 after the form is left. `stats.activities` stays 0, and the replay GET gives 410. The evidence records `modalClosedAutomatically: true`. See A-LA-E7-09-04: the test does not assert closed-or-message. |
| LA-E4-03 AC-09 (S8-05, S8-06) | Browser part proved | For SCORM 1.2 and HTML: the Moodle oracle grade is `100.00`, the portal row shows Passed 100 and Sent, and the API row has `scoreGiven` 100 with a `sent` sync. The AC's T5a, T5b and T7 × 1 parts are the Lead QA part of slot 8 (GATE-RUN-PLAN row LA-E4-03). The qa.md row says "browser part", which is correct. |
| LA-E5-22 AC-06 (S8-03, U1-PREP, RESTART, S8-06) | Proves it | The staged blob is AES-256-GCM `iv(12)‖tag(16)‖ct` under the raw 32-byte `APP_MASTER_KEY` with no AAD. This is the same construction as the product's legacy `encrypt` (`packages/shared/src/crypto.ts:23-29` at 8fadb828; `key-provider.ts:8-9` "a blob without the magic is a legacy blob"). The course-shell call runs before the re-seal (spec:817 before :835), after both restarts. The oracle then finds exactly one hidden course with the expected `idnumber`. A product that cannot open the legacy blob gives no `created` status, so the test would fail. |
| U1/U2 continuity (S8-06) | Proves it | The test opens the pre-restart picker session (GET 200 and POST cancel 200 with a JWT). It does a new pick in course 102 (activities = 2). On the pre-restart activity, `cg_student2` gets `100.00` and `sent`. `/healthz` shows `default` with `knobs: []` on 3 origins, and `infra/.logs` has 0 `test_knob_active` events. |
| Own project only | Yes | Every command uses the clone's `.env` (`COMPOSE_PROJECT_NAME=qa-e2e-la-s8-r2`) or `STACK_ENV`: `e2e:reset` runs after `composeNameGuard`, then `stack:restart -- <service>`, `docker compose -f infra/compose.yaml --env-file .env exec`, and `dc … run --rm --name "$PROJECT-qa-s8-…"`. The boundary records show 0 owned resources left and a 0-line diff on the 32 protected volumes. The two `sto-it-*` containers came from another worker's storage tests. TEARDOWN lists them as information only. |
| Secrets in logs and artifacts | 1 leak class (A-LA-E7-09-02) | I ran my own scan (counts only) with 55 values from `clone-r2-run`: `.env`, `infra/.secrets` including the `seed.json` leaves, `tests/e2e` and `tests/acceptance` captured files, `m1-secrets.raw.jsonl`, and the `state.json` replay values. It found 0 hits in `boundary/` (34 files, 40.9 MB, including the `ps` watcher log, so the `-e QA_WS_TOKEN=` argument was not caught), in `logs/` and in the committed `qa.md`. It found 1 hit in the primary run folder. A pattern scan of all 10 run folders found no JWTs, no `ltio_`/`ltis_` keys and no PEM keys, but it found one raw registration `ref` in 5 folders. |

### Findings

**A-LA-E7-09-01 (MAJOR): The committed secret-scan step still throws, so the scan has never finished in a run.**
- File: `tests/e2e/ltiaas/run-slot8-moodle.mjs:370` and `:377`; `tests/host/lib.mjs:40-53` (`Redactor`).
- Problem: The "fix" for the run's `ERROR` row uses `[...r.redact.values]` and `r.redact.values.size`. But `Redactor` keeps its values in the private field `#values` and has only `add`, `size` and `apply`. The step therefore throws again, so the next run of the committed runner will also end with `ERROR`, and row `M3-07-S8` will never be written. The primary run (23:14:54Z) and the run before it (23:10:32Z) also end with `ERROR`. The qa.md result `{"secretCount":35,…,"hits":[]}` comes from a check outside the run. qa.md does not record its command or an output file. Also, the step runs only when both Playwright phases pass (`:384`, `:389`), so the 8 failed runs had no scan at all.
- Evidence: In my private clone at b5f68c4b, a probe with `tests/host/lib.mjs` gives `typeof values = undefined`. The line 370 expression throws `TypeError: r.values is not iterable`, and the line 377 expression throws `TypeError: Cannot read properties of undefined (reading 'size')`.
- Suggested fix: In the runner, keep one `Set` of every value that you give to `r.redact.add`, and scan with that set (or agree a `values` getter in the shared `tests/host/lib.mjs` with its owner). Run the redaction and the scan on every path (in a `finally`), and after the docker and service logs are collected. At the moment, core's `collectLogs` runs after `steps()`, so the in-run scan cannot see `docker-logs/`. Add a host test that runs the scan on a temporary artifacts folder with one planted secret. Write the scan command and its result into the artifacts.
- Re-run: The functional rows need no re-run, because the spec that ran equals the commit. The secret-hygiene row needs one green run of the fixed runner, or a Lead decision to accept a recorded, repeatable check outside the run.

**A-LA-E7-09-02 (MINOR): The suite's own private values are not redacted or scanned, and the registration `ref` is in the artifacts.**
- File: `tests/e2e/ltiaas/run-slot8-moodle.mjs:343-362`; the writer is `tests/acceptance/M1/canvas/browser.ts:48-52` (`rememberPrivate`, "Secrets for the private leak scan only (runner: m1-secrets.raw.jsonl …)"), which the spec calls at `:356`, `:470` and `:508`.
- Problem: The runner loads `tests/e2e/artifacts/captured-secrets.jsonl` and `tests/acceptance/artifacts/captured-secrets.txt`. It never loads `tests/acceptance/artifacts/m1-secrets.raw.jsonl`, where the spec stores the Dynamic Registration `ref` and the WS token. The Moodle access log records `startltiadvregistration.php?url=…ref%3D<value>`, and core copies that log into the artifacts without redaction.
- Evidence: For the primary run, my value scan matched one 43-character entry of `m1-secrets.raw.jsonl` in `docker-logs/moodle-88b1a9d5.log`. The pattern scan finds one raw `ref` in the Moodle log of each run that reached S8-03 (22-58-50, 23-01-23, 23-05-03, 23-10-32 and 23-14-54). Each value is dead, because the registration is complete and the stack is removed. The folders are gitignored (`tests/.gitignore:4`). The same logs also hold Moodle `sesskey` values (session-bound, dead), for information only.
- Suggested fix: Load `m1-secrets.raw.jsonl` into `r.redact` as soon as pass 1 ends, before core collects the logs, and include it in the scan set from A-LA-E7-09-01. Then run the scan over the collected `docker-logs/` too.

**A-LA-E7-09-03 (MINOR): The qa.md slot 8 round overstates or misnames some facts.**
- File: `docs/reviews/LA-E7-09/qa.md` (Round 2 slot 8 section and its cross-lane rows).
- Problem and evidence:
  1. The list of earlier runs names `22-41-37-989Z` and `22-46-47-189Z`, but no artifact folder has these ids. It leaves out two folders that exist: `qa-e2e-la-s8-r1-…-22-48-18-037Z` (`SLOT8-PASS1` FAIL) and `qa-e2e-la-s8-r2-…-22-49-50-271Z` (`ERROR`). There are 10 run folders in total.
  2. The cross-lane row for AC-LA-E3-05-04 says "PASS". But the AC also needs "T7 passes unchanged (AP-05-16)", and that comes from the Lead QA T7 × 1 run, not from S8-04. The row for AC-LA-E4-03-09 correctly says "browser part". Write "picker part" for AC-04 in the same way.
  3. The S8-01 row gives the order `moodle, canvas, brightspace, blackboard, lti-generic`. The test asserts `moodle, canvas, blackboard, lti-generic, brightspace` (spec:231).
  4. S8-06 and the AC-06 row say that `PUT /web-services` "re-seals … with cgk1". The test checks only status 200 (spec:840), and `app:keys status` counts sealed values but does not show the header of that row.
- Suggested fix: Correct the 4 items. Copy the AC-04 row to `docs/reviews/LA-E3-05/qa.md` only together with the Lead QA T7 × 1 result.

**A-LA-E7-09-04 (NIT): Two assertions are looser than their names.**
- File: `05-moodle-live-slot8.moodle.ts:634-652` (AC-11) and `:332` (Rule 1).
- Problem: (1) AC-11 asks for "Moodle closes the dialog or shows a message". The test records `modalClosedAutomatically` and `returnFrameText` but does not assert either one. So a Moodle that does neither would still pass. This run's evidence shows that the dialog closed. (2) The Rule 1 match `.or(page.getByText(/…|origin/i))` accepts any text that contains "origin". The connection-count check at `:337` still catches a wrong product.
- Suggested fix: Add `expect(!modalVisibleAfterCancel || returnFrameText.length > 0).toBe(true)`, and remove `|origin` from the regex.

### Notes (no finding)

- `SLOT8-QA-E2E/logs/run-slot8-r2-run.log` is 0644, and the clone's `tests/e2e/artifacts/captured-secrets.jsonl` is 0644 (written by the existing e2e helper). Both are inside 0700 folders.
- The task file allows only "runner glue" in `tests/e2e/ltiaas/**`. The new 903-line spec is a test, not glue. This is an ownership question for Lens B and the Lead.
