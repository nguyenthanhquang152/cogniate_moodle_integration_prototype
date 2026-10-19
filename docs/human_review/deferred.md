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
