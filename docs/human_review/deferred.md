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

Evidence basis: `31f4d0bb`, 2026-10-23. Product: C6 `4008afb9`. M1 tests: C9 `9eb504f5`. M2 actual tests: C8 `5561e8f7`. T7 actual tests: C10 `97b68af4`.

Runtime evidence is accepted. Architect conformance is APPROVE. Guide revision 911219b0 passed independent QA and both reviews. See the [evidence table](../../README.md#evidence-labels).

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
| A-CR-01 | MINOR | A package-folder lookup error can be reported as `content_missing`. It still refuses with no target write. ([review](../reviews/M1/content-refusal-reviewer-a.md)) | Give the lookup error its own result. |
| A-CR-04 | MINOR | The older path rule accepts `packages/.` and `packages/..` in a crafted backup. This limit stays open. ([review](../reviews/M1/content-refusal-reviewer-a.md)) | Refuse these path parts. |

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
| B-BM-01 | MINOR | The migration-name self-test has no equal-count exchange of names between the two databases. The real oracle rejects that exchange. ([review](../reviews/M1/backup-manifest-reviewer-b.md)) | Add the exchange case. |
| A-CR-02 (= B-CRR-02) | MINOR | Unit assertions do not detect a missing cleanup after a copy or verification failure. The current product performs that cleanup. ([A](../reviews/M1/content-refusal-reviewer-a.md), [B](../reviews/M1/content-refusal-reviewer-b.md)) | Assert the cleanup in both failure cases. |
| A-CR-03 | MINOR | The frozen H1–H7 plan has no independent `content_check_failed` case. Reviewer probes cover examples. ([review](../reviews/M1/content-refusal-reviewer-a.md)) | Add one independent case. |
| B-CRR-01 | MINOR | Unit tests do not distinguish a size-only copy check from the required size-and-hash check. The current product checks both. ([review](../reviews/M1/content-refusal-reviewer-b.md)) | Add a case that only the hash catches. Assert that copy verification rejects it. |
| A-SOR-01 (= B-SOR-01) | MINOR | Two State OK assertions can pass without check-folder lines. Current product output supplies the lines. ([A](../reviews/M1/storage-oracle-repair-reviewer-a.md), [B](../reviews/M1/storage-oracle-repair-reviewer-b.md)) | Require the check-folder lines. |
| B-SRP-03 (coverage part) | MINOR | No gate sends a build request after a reset and a start. The post-reset `build-queue` binds stay unmeasured. Text clarification was committed at `51505bc`; the coverage gap stays open. ([review](../reviews/M1/storage-reset-parent-reviewer-b.md)) | Add one post-reset build request to an existing probe. |
| A-SRR-01 | NIT | The lost-lock test keeps the own `pid` in the planted foreign record. It cannot detect an event that takes the foreign `pid`. ([review](../reviews/M1/storage-repair-reviewer-a.md)) | Give the foreign record a different `pid`. Assert that `lost.owner.pid` differs from `lost.pid`. |

### Guide and source-checkpoint notes

These accepted NITs remain deferred. The entries authorize no source, architecture or cosmetic change. Final conformance is APPROVE. Guide revision 911219b0 passed independent QA and both reviews.

| Id | Severity | Finding | Suggested fix |
| --- | --- | --- | --- |
| Q-M4-P01 | NIT | Decision IDs wrap at the hyphen in the review page. QA saw `D-10` wrap on desktop and all twelve IDs wrap on mobile. ([QA](../reviews/M4/docs.md)) | Keep the IDs on one line in a later cosmetic change. |
| Q-M4-P02 | NIT | The tenancy SVG shrinks to 283 pixels on a narrow screen. Its text becomes small instead of using the surrounding horizontal scroll area. ([QA](../reviews/M4/docs.md)) | Give the SVG a minimum width in a later cosmetic change. |
| AR-M4-01 | NIT | Production code does not call `hasStaffRole`. It keeps the old institution-role rule and a misleading preview comment. Runtime uses `isGradedLaunch` and `canSelectContent`; M1-16 passed. ([Architect](../reviews/M4/architect-conformance.md)) | Remove the helper or mark it obsolete at the next authorized product edit. |
| AR-M4-02 | NIT | The CSP comment and option in `tool-pages/page.ts` say issuer. Callers pass the connection site origin, as the contract requires. ([Architect](../reviews/M4/architect-conformance.md)) | Rename the option and correct the comment at the next authorized edit. |
| AR-M4-03 | NIT | The data-model comment calls `connection_deployment.binding_ref` the attempt id. It holds the attempt id after phase 1, then activation ref `a` after phase 2. No decision reads it. ([Architect](../reviews/M4/architect-conformance.md)) | State both phases in the comment when the Architect receives a grant. |
| AR-M4-04 | NIT | A reserved issuer gives `400 ISSUER_RESERVED` at the LTI API. The portal instead gets `422 INVALID_PLATFORM_VALUES` with `fields: ["issuer"]`. Both paths store nothing; no AC covers the portal answer. The app contract omits this mapping. ([Architect](../reviews/M4/architect-conformance.md)) | Record the portal mapping in the app contract when the Architect receives a grant. |
| AR-M4-05 | NIT | ADR-012 §7 A3 says "manual exit: the M4 guide". No validated manual recovery procedure exists; the operator must stop and escalate. The refusal behaviour stays unchanged. ([Architect](../reviews/M4/architect-conformance.md)) | Correct the ADR wording when the Architect receives a grant. |
| AR-M4-06 | NIT | ADR-011 §4b calls both Moodle and Canvas release deletes conditional. Only Canvas uses a conditional delete; Moodle keeps the unchanged unconditional delete. ([Architect](../reviews/M4/architect-conformance.md)) | Distinguish the two deletes in the ADR when the Architect receives a grant. |
| A-CR-05, B-CRR-06 | NIT | The infra README restore-order list omits the content check. Its error guidance omits `content_check_failed`. Both prose issues remain deferred. ([A](../reviews/M1/content-refusal-reviewer-a.md), [B](../reviews/M1/content-refusal-reviewer-b.md)) | The infra README owner adds the order and error guidance under a later grant. |

### T7 C10 repair review limits

The C8 T7 attempt and its separate shared-log scan remain FAILED. One screenshot failure caused seven later failures. The separate scan found one redaction failure.

C10 contains the reviewed screenshot and redaction repairs. Independent static and synthetic QA passed. Both source and identity reviews approved the repair. The C10 run is accepted. Final conformance is APPROVE.

| Id | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| A-T7C10-01 | MINOR | One full-page picker capture remains before later footer actions. The inferred mechanism requires judgment from each runtime trace. ([A](../reviews/M3/t7-c10-reviewer-a.md)) | Keep deferred. Judge A4/B4/B5 traces for viewport retries in every run. |
| A-T7C10-02 | NIT | Import closures exclude the four repair files. M1 and M2 typecheck globs include E2E files. Typecheck passed at C10. ([A](../reviews/M3/t7-c10-reviewer-a.md)) | Keep precise import-closure wording. Do not claim complete executable exclusion. |
| A-T7C10-03 | NIT | The earlier final-binding checklist named C8 for T7. C10 now identifies T7; M2 remains C8. ([A](../reviews/M3/t7-c10-reviewer-a.md)) | Bind final T7 evidence to C10. Keep actual M2 at C8. Document closure passed at guide revision 911219b0. |
| B-C10-01 | NIT | The viewport helper copies evidence-name and folder rules. Its comment omits the maintenance reason. ([B](../reviews/M3/t7-c10-reviewer-b.md)) | Add a comment in a later authorized test batch. Keep C10 unchanged. |
| B-C10-02 | NIT | The copied wrapper uses an absolute frozen-source path. It resolves to the intended location without a behavior difference. ([B](../reviews/M3/t7-c10-reviewer-b.md)) | Consider relative notation in a future copy. Keep the accepted wrapper unchanged. |

The accepted run passed every required trace, screenshot and scan judgment. All 51 default tests had no viewport click retries. All 12 required PNGs showed the completion controls or full picker. A-T7C10-01 stays deferred; each future run still needs the trace judgment.

The Lead accepted all five findings as nonblocking. Source identity and wording corrections do not remove the residual picker risk. Guide revision 911219b0 passed independent QA and both reviews. See [E-R8](../team/r8-t7-shared-host-verification-2026-10-23.md#final-t7-acceptance--1643-utc).

### Tracker, focus and verification limits

These accepted prototype limits remain deferred ([Architect](../reviews/M4/architect-conformance.md#r77-limits-and-future-work-not-resolved-by-this-verdict)).
They authorize no optional product, test or tool change.

| Id | Severity | Retained limit |
| --- | --- | --- |
| A-TR-01 | MINOR | After the first document, the fast check needs a child `pagehide`. Chromium behavior before `load` remains unverified. |
| A-TR-02 / B-M3TR-01 | MINOR | The strong document map keeps observed documents until the runtime page closes. |
| A-TR-04 / B-M3TR-02 | NIT / MINOR | WindowProxy prevents cleanup from reaching replaced-window hooks. Those hooks are inert after stop. The unit model cannot prove browser removal. |
| B-M3TR-03 | NIT | The tracker comment omits residual limits. ADR-004 retains them. |
| B-M3TR-05 | MINOR | Frozen legacy launchers accept existing roots. Grants require fresh absent roots and observer continuity. |
| A-TR-05 / B-M3TR-06 / B-M3TR-07 | NIT | Original guard labels, launcher headers and report citations remain recorded. |
| AR-M3-T609-01/02 | MINOR | Route focus can move after data arrives. Keys typed before focus settles can be lost. |
| A-M4P-R2-01 | NIT | Recovery guidance omits expired, revoked or replaced unused codes. The D-12 setup-denial window can last longer. Check 14 still refuses Canvas access. |

B-M3TR-04 was an evidence correction, not a new open product finding.
AR-M2-LW-02 and the existing storage-harness MINOR findings remain deferred in the final Architect verdict.
The A-DH, B-M1-DH and N1–N7 NITs remain recorded with their accepted limits.
The existing cosmetic NITs remain deferred; no optional polish is included.

The 10 ms and 150 ms check intervals are nominal, not wall-clock guarantees.
A document parsed and replaced between checks can be missed.
A first package document arriving after five seconds depends on fallback checks.
Observation of every document is not guaranteed.
After SIGKILL, the app log can lose its last lines.
Docker restart behavior after a kill remains unmeasured.

T7 used a shared host, with qualified attribution rather than exclusivity.
Objects created and removed between captures can escape snapshot comparison.
The LA watcher restarted and replayed events; no gap exceeded two minutes.
Earlier failed attempts retain their original results.

ADR-012 acceptance covers this prototype only.
Its 72 storage rows remain carried C4 results within the separate 94-row ledger.
G-1 covers only measured identities; Docker volumes have no generation id.
The negative host test proves fault detection, not safe bind-mount locking.
`content_check_failed` is unit-only; the lost-lock exit has host fault-injection evidence only.
For `operation_lock_invalid`, stop and escalate; no manual recovery is validated.

### Final guide review follow-ups

These two findings are safe to defer. They do not change the verified prototype scope. See [Reviewer-B](../reviews/M4/reviewer-b-final.md).

| Id | Severity | Finding | Later action |
| --- | --- | --- | --- |
| B-M4F-01 | MINOR | C10 T7 guide claims link through the Lead record. The direct QA link is missing. | Add a direct link to the C10 QA record in a later guide update. |
| B-M4F-02 | MINOR | Internal commit labels and QA terms are not defined for new readers. | Define the labels and move process details into the evidence reference in a later guide update. |

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
