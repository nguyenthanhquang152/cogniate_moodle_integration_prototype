# Deferred findings

Source: commit `6932539`, 2026-10-19.

These review findings are still open. Each one is MINOR ("worth a fix, safe to defer") or NIT (style). The P2/P5 repair passed [full regression](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d). [Fresh T7](../reviews/T7/qa.md#10-replacement-qa-e2e-repair-regression--2026-10-19) also passed. P2 is not an accepted MINOR deferral.

T8 round 1 failed on two races (Q-T8-01, Q-T8-02, MAJOR). Both passed in [round 2 at `8059c31`](../reviews/T8/qa.md). They are resolved, not open deferrals.

This list is for engineers. A product person can skip it.

The [P2 remote-ordering limit](../architecture/adr/ADR-010-grade-and-completion-policy.md#p2-bounded-confirmation-after-uncertain-delivery-2026-10-19) is a documented boundary, not a new accepted MINOR finding. An older request can write after the best score’s accepted confirmation. Migration 010 cannot recover unrecorded sends from before the upgrade. The Author’s synthetic upgrade check is not independent QA. Full repair regression and fresh T7 passed.

Counts: **14 MINOR, 30 NIT** (state 2026-10-19). The T3c QA report has no product findings. Ids are in `docs/reviews/<task>/`.

## Security

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| A-T1-02 (rest) | MINOR | T1 | The QA oracle role in Moodle has full manager rights. The product role keeps `createtoken`. | Use least-privilege roles. Remove `createtoken`. |
| A-T1-03 (rest) | MINOR | T1 | The QA install runs npm lifecycle scripts in the test container. | Use `npm ci --ignore-scripts` for `tests/`. |
| A-T0-16 (rest) | MINOR | T0 | No test covers the rotation of the signing key. Rotation is not built yet. | Add a test when rotation is built. |
| A-T3a-04 | NIT | T3a | A leaked service key and API key together can write grades for every activity of that course. | Architect decides: limit writes to the own line item. |
| A-FX-02 (rest) | NIT | T9 | The app gives up on a slow registration after 15 seconds. If the LTI service makes a platform later, it stays active with no owner. Its launches are refused. | The admin deletes the Pending tool (security §2.6). Later: switch the orphan off. |
| A-T4a-04 | NIT | T4a | Two libraries that upload the same zip share one stored file. A later delete can affect both. | Store per package id, or count references. |

## Operability

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| A-T9-C01 | MINOR | T9 | Repeated line-item lookup failures can retry every 5 seconds, instead of increasing the delay. No score POST occurs; the 24-hour limit stays. | Count preparation retries separately from actual score POSTs. Keep the increasing-backoff policy. |
| B-T8-03 (rest) | NIT | T8 | A forgotten hold file blocks the Build Runner with no time limit. | Stop after 30 minutes and log it. |
| T8 readiness 1+2 | NIT | T8 | `stack:doctor` does not check the expiry of `root.crt`. Its knob fix line names no services. | Check the expiry. Print the service names. |
| T8 readiness 3 | NIT | T8 | `demo:users` never shows passwords, so a person must open the hidden `.env` file. | Add a local option that shows them. |
| A-FX-03 | NIT | T9 | Two Build Runners that start at the same moment can, in theory, both take over a stale lock. | Very unlikely. Make the take-over atomic. |
| B-T3c-02 (rest) | NIT | T3c | When the compatibility image build fails, the script deletes the build log. | Print the last 20 log lines first. |
| Q-T1-04 | NIT | T1 | Moodle shows "Missing capabilities: moodle/user:update" for the product web services token. | Remove unused functions, or add the capability. |

A-T9-C01 is an accepted implementation difference, not conformance to the retry policy. See the [Lead’s disposition](../team/board.md).

## Code and logs

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| B-T1-06 (rest) | MINOR | T1 | The shared package uses the file names `http.ts` and `service.ts`, not the name `server` from ADR-008. | Rename to `server.ts`. |
| A-T5a-04 | NIT | T5a | A player reload starts a new SCORM session. The server counts one session per launch. | Count per page load, or change the contract. |
| A-T3a-03 (rest) | NIT | T3a | A token request that waits logs `cache: "hit"` before it succeeds. | Log `wait`, and only after success. |
| B-T4a-05 (rest) | MINOR | T4a | Two `internal_error` log lines have no `method` and `path` fields. | Add the two fields. |
| B-T2a-05 | NIT | T2a | An unknown tool account gives one error code at login and another at launch. | Use one code, or document the choice. |
| B-T5a-05 | NIT | T5a | The content host writes error codes as plain text. The owner of `AGENTS.md` is not confirmed. | Add a typed code table. The Lead confirms the owner. |
| B-T5b-02 (rest) | NIT | T5b | The package inspector has its own copy of the default pass mark. Some tests cover several ACs. | Import one constant. Write one test per AC. |

## Architect conformance check (T9)

Source: [`docs/reviews/T9/architect-conformance.md`](../reviews/T9/architect-conformance.md) §1 to §3.

| Id | Severity | Finding | Suggested fix |
| --- | --- | --- | --- |
| F1 | MINOR | A 502 or 504 platform error has no trace id in its description. The `X-Trace-Id` header has it. | Add the trace id to the description. |
| F2 | MINOR | Same as B-T4a-05 above (LTI service). Counted once. | — |
| P3 | MINOR | The log event `outcome_changed` is never written. | Write the event, or remove it from the contract. |
| P4 | MINOR | The app API never answers `502 INVALID_LTI_ANSWER`. Every LTI service error becomes `LTI_SERVICE_ERROR`. | Give a bad answer its own code. |
| P6 | MINOR | Same as B-T4a-05 above (Cogniate app), counted once. Also, one warning has the wrong level and no `error` field. | Add the fields. Use level `error`. |
| P7 | MINOR | The code makes a teacher preview for a staff role. ADR-010 makes a preview when there is no Learner role. Moodle 5.2 sends one role only, so nothing differs today. | Accepted deferral (Lead): the spec rule stays. The code follows later. |
| P9 | MINOR | The SCORM runtime accepts more than 250 interactions. The server then refuses later commits, so the score is lost. The Cogniate package writes one interaction only. | Refuse interaction 250 and higher in the runtime. |
| P10 | MINOR | A reload of the player keeps the same session, so the time after a reload is too low. | Accepted deferral (Lead): the spec rule stays. The code follows later. |
| F7 | NIT | `PUT` and `DELETE` on `/lti/launch` give 404, not 405. | Answer 405 for a wrong method. |
| F9 | NIT | A retired tool key stays in the key list for 30 days from its creation, not from its retirement. `revokeServiceKeys` has no caller. | Count from retirement. Use or remove the function. |
| P12 | NIT | A bad Origin on the registration confirm page logs two events, not one. | Log one event. |
| P13 | NIT | Some package reject reasons have no `path`. | Add the manifest path. |

## Tests (QA)

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| B-T1-07 (rest) | MINOR | T1 | A T1 test does not check `knobs: []` on the content host. It reads `seed.json` by shape. | Check `knobs: []`. Read the documented key paths. |
| B-T1-08 (rest) | MINOR | T1 | Some T1 host checks are weak. | Add the listed checks. |
| Q-T0-44 | NIT | T0 | AC-T5-32 depends on AC-T5-31 through a 10-minute window. | Write "run right after AC-T5-31". |
| A-T7-02 (rest) | NIT | T7 | The secret search does not cover the container output. The service JSON logs carry the same events. | Optional: also search `docker compose logs`. |

## Docs and contracts

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| B-T1-09 (rest) | NIT | T1 | `infra/README.md` says that `gen-env` does not write two variables. It writes them. | Correct the text. |
| B-T2a-06 | NIT | T2a | The LTI service has no short "how to read this service" note. | Add a short README. |
| B-T2b-03 (rest) | NIT | T2b | The code logs `login_rejected {code, detail}`. The contract lists only `code`. | Add `detail` to the contract. |

## UI and texts

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| B-T5b-01 (rest) | NIT | T5b | "Refresh from Moodle" does not say which rows Moodle could not read. | Return the failed rows. Show a hint. |
| B-T4b1-02 (rests) | NIT | T4b1 | The registration done page does not mention the "New window" edit step. The failure page has no trace id sentence. | Add both sentences. |
| B-T6-04 (rest) | NIT | T6 | Some wizard steps hold two to four actions. Some reports and tests are in the portal folder. | One action per step. Move the files. |
| B-T6-02 (rest) | NIT | T6 | The portal uses about 94 fixed colour values in place of theme tokens. | Map repeated colours to theme tokens. |
| B-T6-05 (rest) | NIT | T6 | A connected site shows no fact, such as the last launch time. | Show the last launch. Add one test per state. |
| T8 portal 1+2 | NIT | T8 | The portal shows the raw course status word. The last restore step holds two actions. | Use plain sentences. Split the step. |
| Q-T7-03 | NIT | T7 | A decorative layer in the HTML export covers the lesson link. Tests use a DOM click. | The exporter fixes it (decision Q17). |

Resolved and not listed: A-T7-03, A-T7-04, A-T5b-05 (= P5), P1, P11, C-T8-01 to C-T8-03, Q-T7-01 and Q-T7-02. For A-T7-03 (test traces hold raw secrets), `infra/README.md` has a WARNING in "Debug a failed E2E step". QA verified the portal texts of Q-T7-01 and Q-T7-02 ([T7 qa.md §6](../reviews/T7/qa.md#6-suite-changes-after-the-reviews-round-1-addendum)).

Board notes that do not match the review files (for the Lead): the board lists Q-T1-04 as MINOR (qa.md says NIT). For T4b2, the board says the MINOR follow-ups are "in progress". The code has the fixes, but no review file closes them by name.

## Canvas and Blackboard phase (M4)

Draft basis: `82aff91`, 2026-10-22. Candidate under validation: C4 `bf09cda`. Status: **draft**. Final source stamp and approval are pending.

The [phase plan](../team/multi-lms-plan.md) records the accepted deferrals below, including the R4/R5 harness findings. This section records those decisions; it closes no finding.

The Moodle list above stays as it was recorded on 2026-10-19.

### A-M0-10 (D-12): residual race after a release

Severity: MINOR, accepted deferral ([A-M0-10](../reviews/M0/reviewer-a.md), [ADR-011 §4b and D-12](../architecture/adr/ADR-011-multi-lms.md#4b-operator-containment-and-recovery), risk R-M-16). QA case: [SIM M1-39.canvas.residual-race].

- **Race:** a new Canvas or Blackboard binding always needs a grant, but a Moodle manual connect does not. After an operator release, another signed-in library can make a Moodle connection with the freed issuer and client ID before the rightful redemption.
- **Scope:** only `canvas-self-hosted`. Hosted Canvas and Blackboard issuers are reserved, so a Moodle connect with them gets `ISSUER_RESERVED`.
- **Impact:** setup can be blocked: the rightful redemption gets `PLATFORM_IN_USE`. There is no Canvas access, because launch check 14 refuses the Canvas-signed launches before storage.
- **Operator order:** issue the rightful grant, suspend, release, then the rightful library redeems at once. If the race happens, suspend and release the new connection, and repeat the order.
- **Limit:** prompt redemption makes the window short. It does not prevent the race.
- **Needed:** a reserved-identifier or quarantine design, before an enterprise service relies on this workflow (Q21).

The [operator guide](../guides/operator.md#3a-accepted-limit-d-12-self-hosted-canvas-after-a-release) and [troubleshooting](../guides/troubleshooting.md#canvas-and-blackboard) (`PLATFORM_IN_USE` after a release) say the same.

### Engine and tests

| Id | Severity | Finding | Suggested fix |
| --- | --- | --- | --- |
| A-M1-02 | NIT | `writeApproval` deletes an existing approval of **any** disabled connection for the same key. The data model names only the Blackboard move in the same library. Today both rules give the same result. Another library cannot reach phase 2 while the old reservation exists. `release` deletes the old row with the reservation. ([review](../reviews/M1/reviewer-a.md)) | Limit the delete to the same library, or state the broader rule in the data model. Safe to defer. |
| A-M3-05 | NIT (optional) | The Canvas course-shell test case posts for a course without an uploaded version. It gets `courseShell` only because the product checks the capability first. The contract fixes no order between the two checks. ([review](../reviews/M3/reviewer-a.md)) | Upload a version in the Canvas case, as the Blackboard case does. |

### Storage commands (product)

| Id | Severity | Finding | Suggested fix |
| --- | --- | --- | --- |
| A-SFT-08 | MINOR | Backup and quarantine copy each database file, then set mode `0600`. So a copy exists for a short time at the source mode `0644`, inside a `0700` folder. A crash in that time leaves a `0644` copy without a manifest. ([review](../reviews/M1/storage-full-triage-reviewer-a.md)) | Create each copy at `0600` first, then write the bytes. |
| R1-A QA O-1 | MINOR | Quiet A6 release: after a failed Docker listing or an active storage container, the command releases the lock but logs no `storage_lock_released` line. The lock folder is gone, and no data changes. ([QA](../reviews/M1/storage-command-qa.md)) | Log one `storage_lock_released` with the own command for each release. |
| A-QR1-01, B-RR-01 | MINOR | The unit matrix of the lock helper has no R-3 row (not lost, then `INT` or `TERM`). Independent QA ran R-3 and it passed. ([A](../reviews/M1/storage-release-reviewer-a.md), [B](../reviews/M1/storage-release-reviewer-b.md)) | Add the R-3 rows for both option sets and the `run` path. |
| A-SI-04 | NIT | A backup of an identity or journal file that the host user cannot read refuses with `backup_source_not_ok:<state>`, without the path. It still fails closed. ([review](../reviews/M1/storage-reviewer-a.md)) | Give an unreadable file its own result and name the path. |
| B-SI-08 | NIT | If only one of the two volumes is removed in quarantine step 4, the message "The copy and the volumes stay" can be false. The verified copy stays, so no data is lost. The operator inspects each volume before a new quarantine. ([review](../reviews/M1/storage-reviewer-b.md)) | Remove and check the volumes one at a time, and name the volumes that stay. |
| B-RR-02 | NIT | After a lost lock, a command exits 1 with only a JSON `storage_lock_lost` line, and no plain-text sentence on stderr. The operator guide has the note. ([review](../reviews/M1/storage-release-reviewer-b.md)) | Add one stderr sentence in a future, separately authorized helper edit. |
| B-RR-03 | NIT | The release-failure flag lasts for the whole shell, and no comment says so. ([review](../reviews/M1/storage-release-reviewer-b.md)) | Add one comment in a future, separately authorized helper edit. |
| O-A2 | Context | After a release error other than a lost lock, the own lock folder stays until a later command reclaims it. The stderr text then has the raw `EACCES` message with an absolute path. No terminal event is logged. ([review](../reviews/M1/storage-release-reviewer-a.md)) | Recorded for M4 context next to R1-A QA O-1. No new scope. |

### Storage harness (QA tests)

| Id | Severity | Finding | Suggested fix |
| --- | --- | --- | --- |
| B-HR-03 (rest) | MINOR | The published-once extension is missing: no control publishes a scan point zero or two times, or gives a wrong `configDiff` removal count. The required cleanup coverage is closed. ([review](../reviews/M1/storage-harness-reviewer-b.md#r2-closure-of-the-round-1-findings)) | Add the two stub faults. |
| B-HR-04 | MINOR | Accepted coverage limit: mutant M5-4b stays masked and NOT DETECTED. It is not equivalent; only an outside-writer race shows it. The held code stays safe in that race. | Add a race variant, or keep the accepted limit. |
| B-HR-06 | MINOR | A failed or timed-out plant outside `guarded` gets no restore and no phase stop. Later rows can then fail with other causes. | Use the same restore trigger for multi-step and root plants. |
| B-HR-05 | NIT | `a-serialize` can name a lock-order fault when `stack:up` only failed. The FAIL status is right; the cause can mislead. | Check the `stack:up` exit first. |
| B-HR-07 | NIT | Diagnostic details: the hook name `teardown` overstates what it does, and one results file uses the process umask. | Rename the hook. Write the file at `0600`. |
| B-HR-08 | NIT | Some detections are clear only after reading the code (error-based detections). | Name the mutated behaviour in the message. |
| A-SH-07 | NIT | A self-test restores the pinned umask only in two hooks, with no `finally`. ([review](../reviews/M1/storage-harness-reviewer-a.md)) | Restore it in `t.after`. |
| A-SH-08 | NIT | Two read-only checks list a linked folder before an `lstat` guard. They change nothing, and the closure still fails. | Check `lstat` first. |
| A-SH-09 (= B-HR-09) | NIT | A missing scratch folder gets the text "… is kept", but nothing exists. The phase stop is right. | Give the missing case its own text. |
| B-HR-10 | NIT | A cleanup note is dropped when the body error is itself a phase abort. No current path reaches it. | Add the note in both branches. |
| A-SH-10 (= B-HR-11) | MINOR | No committed control distinguishes both app services running from only one. The source uses the correct predicate. ([A](../reviews/M1/storage-harness-reviewer-a.md), [B](../reviews/M1/storage-harness-reviewer-b.md)) | Add a case with one app service stopped and the matching mutant. |
| A-SH-11 | MINOR | `stopCheck` can accept an earlier stop event for the same point. The current command must still exit 3. R5 binds the `g-tamper` target to the current command's own output, so target selection no longer depends on this check. ([review](../reviews/M1/storage-harness-reviewer-a.md)) | Check the current command's output only. |
| A-SH-12 | NIT | The kept-file hash assertion can pass when both observed hashes are null. The folder-order and runtime entry checks still apply. ([review](../reviews/M1/storage-harness-reviewer-a.md)) | Require a non-null, 64-hex kept-file hash. |
| A-SH-13 | NIT | A test name says the target's mode changed, but the case changes another entry's mode. ([review](../reviews/M1/storage-harness-reviewer-a.md)) | Rename the case to name the other entry. |
| B-HR-12 | NIT | A harness-only timeout stays a failure, but its message does not name the timeout. ([review](../reviews/M1/storage-harness-reviewer-b.md)) | Name the timeout in the failure text. |

### Not open deferrals (for clarity)

| Id | State |
| --- | --- |
| Q-R1A-01 | CLOSED. The product repair is at `9f8ac62`. |
| ADR-012 O-1 | CLOSED (revision 3.6 precision of ADR-012 §4). Do not confuse it with the open R1-A QA O-1 above. It is also not the timing observation O-1 of the storage source review. |
| M4-8f | Equivalent mutant, not a finding: `O_CREAT` with `O_EXCL` refuses a final link, also without `O_NOFOLLOW`. |
| A-SI-05, B-SI-09 | Text correction committed at `5a5453c`: coded refusals, text-only stops, output streams and the `container` field. Independent document closure is pending. |
| B-M3-05 | Open NIT. Its reviewer says that it needs no deferral entry. |
| B-M3-06 | An evidence note, dispositioned in the phase plan. The M2 and T7 results stay at their actual `aff4882` SHA; the final M2 run is fresh. |
| A-M0-11, A-M0-12, B-M0-10 | Text corrections applied (board). Not open. |
| Moodle deferrals above | All stay open as recorded on 2026-10-19. |
