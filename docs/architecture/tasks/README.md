# Tasks, QA rules and test knobs

Status: T0 round 2. Task DAG: [`../README.md`](../README.md) §7.

## 1. Task list

Order for one Author: T1 → T5-spike → T2 → T3a → T3b → T4a → T4b → T5a → T5b → T6 → T7 → T3c → T8. T9 (Docs) starts after T7.

| Task | Title | Reviewed | AC ids |
| --- | --- | --- | --- |
| [T1](T1.md) | Monorepo skeleton and local HTTPS stack (in build) | yes | AC-T1-01 to AC-T1-13 |
| [T5-spike](T5-spike.md) | Player spike: real package in the real frames, API object choice | no (like T1-spike) | — (exit questions S1 to S7) |
| [T2](T2.md) | LTI service core: platforms, keys, OIDC launch, ltik, ID token | yes | AC-T2-01 to AC-T2-31 |
| [T3a](T3a.md) | LTI services that the app needs: service keys, token client, Deep Linking response, scores, line item reads | yes | AC-T3-06 to -08, -10 to -14, -16 to -18, -22 to -24 |
| [T3b](T3b.md) | Dynamic registration, incl. "update existing tool" | yes | AC-T3-01 to -05, -25, -26 |
| [T4a](T4a.md) | Mock session, courses, upload, package inspector | yes | AC-T4-01 to -06 |
| [T4b](T4b.md) | Connections, publications, picker, launch handoff, tool page security | yes | AC-T4-07 to -10, -12, -14 to -21, -22 to -32 |
| [T5a](T5a.md) | Content host, SCORM 1.2 runtime, tracking, score sync, results | yes | AC-T5-01 to -08, -12, -13, -15 to -17, -20 to -24 |
| [T5b](T5b.md) | HTML runtime, retry and conflict, Resend, results refresh | yes | AC-T5-09 to -11, -14, -18, -19, -27 to -32 |
| [T6](T6.md) | Portal UI | yes | AC-T6-01 to AC-T6-14 |
| [T7](T7.md) | Full E2E in real Moodle | yes | AC-T7-01 to AC-T7-15 |
| [T3c](T3c.md) | Compatibility-only endpoints and the independent-client test | yes | AC-T3-09, -15, -19 to -21, -27 |
| [T8](T8.md) | Stretch: native channel and course shell | yes | AC-T8-02 to AC-T8-10 |
| [T9](T9.md) | Docs and human review pack (Docs role) | yes | AC-T9-01 to AC-T9-04 |

AC id rule: an AC keeps the number of the task where it was first written (for example AC-T3-12 is in T3a). New ACs continue the number sequence. Removed numbers are not reused. The mapping is in [`../review-response-T0.md`](../review-response-T0.md).

## 2. QA rules

QA writes tests from the task specs and contracts only (charter §1). It does not read the Author's notes or code before it writes the tests.

| Allowed | Not allowed |
| --- | --- |
| Playwright 1.56.0 (Chromium) and HTTP calls from the `e2e` container | Reading service source code |
| `docker compose exec` for the read-only commands that an AC names, `docker compose logs`, `stop`, `start`, `port`, `ps`, `network inspect` | Reading or changing SQLite files or the package store, except where an AC allows it |
| Moodle web services: the product service (as a client of the product) and the QA-only `cogniate_qa_oracle` service | Changing Moodle data with CLI, except the steps that an AC names |
| Moodle CLI read-only (`admin/cli/cfg.php` without `--set`), and `admin/cli/cron.php` (`npm run moodle:cron`) | Test knobs in T7 |
| `infra/.secrets/seed.json`, `infra/.logs/*.jsonl` (read-only mount in `e2e`) | Copying code from the `ltiaas` SDK or from LTIAAS docs |
| `npm run stack:restart -- <service> --env K=V` for the knobs below | |

Determinism rules:

- `retries: 0`, `workers: 1`. Unique names per run (for example `QA DL <runId>`).
- Block every host that is not `*.test` in all browser contexts and record the blocked URLs (the packages load S3 images and Google fonts).
- Poll with the deadlines in the ACs. Fixed waits only for the 11 s dwell and the TTL tests.
- Use the visible labels of Moodle 5.2.4. Record every difference from the task text.
- Do not use the package helper `window.CogniateSCORM.markLessonComplete` in an AC path.
- Network negatives use three oracles together: the error code, zero hits on the `evil.test` sink, and no `outbound_request` or `outbound_blocked` event for that host.

## 3. Test knobs

Mechanism (T1): `npm run stack:restart -- <service> --env KNOB=value` restarts one service with the knob. `npm run stack:restart -- <service>` restores the defaults. The service logs `test_knob_active {name, value}` at start, and `GET /healthz` lists the knobs (`"knobs": []` by default).

| Knob | Service | Default | Test value | Used by | Procedure |
| --- | --- | --- | --- | --- | --- |
| `LTIK_TTL_SECONDS` | lti-service | 86400 | 20 | AC-T2-07 | First API call < 10 s after the redirect works. A call at TTL + 3 s gives 401. |
| `REF_TTL_SECONDS` | cogniate-app | 86400 | 20 | AC-T4-09 | Open the registration URL from Moodle at TTL + 3 s → `REF_EXPIRED`. |
| `PICKER_TTL_SECONDS` | cogniate-app | 3600 | 20 | AC-T4-20 | POST the picker at TTL + 3 s → 410. |
| `PLAY_TTL_SECONDS` | cogniate-app | 86400 | 20 | AC-T5-15 | Commit at TTL + 3 s → `410 RUNTIME_EXPIRED`. |
| `BUILD_RUNNER_HOLD` | cogniate-app | 0 | 1 | AC-T8-03 | The build pauses before teardown until the flag file is removed. |
| `BUILD_RUNNER_FAIL_AT` | cogniate-app | "" | `backup` | AC-T8-07 | The build fails at that step. |

No other knob exists. T7 checks that every `/healthz` shows `"knobs": []` (AC-T7-13).

## 4. Profiles and helper hosts

| Profile | Adds | From |
| --- | --- | --- |
| `test` | `e2e` container | T1 |
| `acceptance` | `evil.test` sink (logs `sink_hit` to `infra/.logs/sink.jsonl`) and `qa-platform.test` static host (files from `tests/fixtures/qa-platform/`, QA-owned), second leaf certificate, allowlist entries | T2 |

`npm run test:acceptance` starts the stack with the `acceptance` profile. `npm run test:e2e` does not.

## 5. Fixtures

The two course zips are not in git (Q15). `COURSE_FIXTURES_DIR` (default `docs/raw/data/courses`) points to them. `npm run fixtures:check` compares them with `infra/fixtures/courses.sha256` and prints how to get missing files. Tests copy each zip to a new temp folder before use (untrusted data).

## 6. Evidence

Each `docs/reviews/<task>/qa.md`: commit SHA, image digests, run date and times, one row per AC (PASS or FAIL, test id, command, artifact path), Playwright traces, screenshots at Moodle and portal assertions, log snapshot, and the grep result for each captured secret. Secrets in evidence show only the first 6 characters and the length.
