# Deferred findings

These review findings are still open. Each one is MINOR ("worth a fix, safe to defer") or NIT (style). No BLOCKER or MAJOR finding is open. This list is for engineers. A product person can skip it.

Counts: **6 MINOR, 25 NIT** (state 2026-10-19). T8 has no QA report yet, so new findings can come for this task. The T3c QA report has no product findings. Ids are in `docs/reviews/<task>/`.

## Fixed after the last QA run (QA pending)

| Id | Severity | Finding | State |
| --- | --- | --- | --- |
| Q-T7-01 | MINOR | The portal showed "Delegate to teacher". The Moodle 5.2.4 option is "As specified in Deep Linking definition or Delegate to teacher". | The portal text is changed (`d4218b2`). The next QA run checks it. |
| Q-T7-02 | MINOR | The portal said "Add an activity". Moodle 5.2.4 has no such label. | T6.md and the portal (`8fdfa9e`) now use the Moodle 5.2.4 path. The next QA run checks it. |

## Security

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| A-T1-02 (rest) | MINOR | T1 | The QA oracle role in Moodle has full manager rights. The product role keeps `createtoken`. | Use least-privilege roles. Remove `createtoken`. |
| A-T1-03 (rest) | MINOR | T1 | The QA install runs npm lifecycle scripts in the test container. | Use `npm ci --ignore-scripts` for `tests/`. |
| A-T0-16 (rest) | MINOR | T0 | No test covers the rotation of the signing key. Rotation is not built yet. | Add a test when rotation is built. |
| A-T3a-04 | NIT | T3a | A leaked service key and API key together can write grades for every activity of that course. | Architect decides: limit writes to the own line item. |
| A-T4a-04 | NIT | T4a | Two libraries that upload the same zip share one stored file. A later delete can affect both. | Store per package id, or count references. |

## Operability

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| B-T8-03 (rest) | NIT | T8 | A forgotten hold file blocks the Build Runner with no time limit. | Stop after 30 minutes and log it. |
| T8 readiness 1+2 | NIT | T8 | `stack:doctor` does not check the expiry of `root.crt`. Its knob fix line names no services. | Check the expiry. Print the service names. |
| T8 readiness 3 | NIT | T8 | `demo:users` never shows passwords, so a person must open the hidden `.env` file. | Add a local option that shows them. |
| B-T3c-02 (rest) | NIT | T3c | When the compatibility image build fails, the script deletes the build log. | Print the last 20 log lines first. |
| Q-T1-04 | NIT | T1 | Moodle shows "Missing capabilities: moodle/user:update" for the product web services token. | Remove unused functions, or add the capability. |

## Code and logs

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| B-T1-06 (rest) | MINOR | T1 | The shared package uses the file names `http.ts` and `service.ts`, not the name `server` from ADR-008. | Rename to `server.ts`. |
| A-T5b-05 | NIT | T5b | The Resend query divides integers, so most scores sort as 0. | Cast to a real number before the division. |
| A-T5a-04 | NIT | T5a | A player reload starts a new SCORM session. The server counts one session per launch. | Count per page load, or change the contract. |
| A-T3a-03 (rest) | NIT | T3a | A token request that waits logs `cache: "hit"` before it succeeds. | Log `wait`, and only after success. |
| B-T4a-05 (rest) | NIT | T4a | Two `internal_error` log lines have no `method` and `path` fields. | Add the two fields. |
| B-T2a-05 | NIT | T2a | An unknown tool account gives one error code at login and another at launch. | Use one code, or document the choice. |
| B-T5a-05 | NIT | T5a | The content host writes error codes as plain text. The owner of `AGENTS.md` is not confirmed. | Add a typed code table. The Lead confirms the owner. |
| B-T5b-02 (rest) | NIT | T5b | The package inspector has its own copy of the default pass mark. Some tests cover several ACs. | Import one constant. Write one test per AC. |

## Tests (QA)

| Id | Severity | Task | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| B-T1-07 (rest) | MINOR | T1 | A T1 test does not check `knobs: []` on the content host. It reads `seed.json` by shape. | Check `knobs: []`. Read the documented key paths. |
| B-T1-08 (rest) | MINOR | T1 | Some T1 host checks are weak. | Add the listed checks. |
| Q-T0-44 | NIT | T0 | AC-T5-32 depends on AC-T5-31 through a 10-minute window. | Write "run right after AC-T5-31". |

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

Board notes that do not match the review files (for the Lead): the board lists Q-T1-04 as MINOR (qa.md says NIT). For T4b2, the board says the MINOR follow-ups are "in progress". The code has the fixes, but no review file closes them by name.
