# Tasks, QA rules and test knobs

Status: T0 round 2; Blackboard and Canvas phase M1–M4 added in M0 (2026-10-20). Task DAG: [`../README.md`](../README.md) §7.

## 1. Task list

Order for one Author: T1 → T5-spike → T2a → T2b → T3a → T3b → T4a → T4b1 → T4b2 → T5a → T5b → T6 → T7 → T3c → T8. T9 (Docs) starts after T7.

Technical dependencies ("Depends on" in each file) are fewer: T2a and T4a need only T1; T2b needs T2a; T3a needs T2a for its code and T2b for its acceptance tests (`qa-platform.test`, sink); T3b needs T2a and T2b; T4b1 needs T3b and T4a; T4b2 needs T3a and T4b1; T5a needs T4b2 and the T5-spike note.

| Task | Title | Reviewed | AC ids |
| --- | --- | --- | --- |
| [T1](T1.md) | Monorepo skeleton and local HTTPS stack (in build) | yes | AC-T1-01 to AC-T1-13 |
| [T5-spike](T5-spike.md) | Player spike: real package in the real frames, API object choice | no (like T1-spike) | — (exit questions S1 to S7) |
| [T2a](T2a.md) | LTI service core: platforms, keys, OIDC launch (all 12 checks, unit-tested), ltik, ID token | yes | AC-T2-01 to -08, -12 to -16, -18, -19, -29, -31 |
| [T2b](T2b.md) | Negative launch matrix (QA-signed tokens) and the `acceptance` profile | yes | AC-T2-09 to -11, -20 to -28, -30, -32 |
| [T3a](T3a.md) | LTI services that the app needs: service keys, token client, Deep Linking response, scores, line item reads | yes | AC-T3-06 to -08, -10 to -14, -16 to -18, -22 to -24 |
| [T3b](T3b.md) | Dynamic registration, incl. "update existing tool" | yes | AC-T3-01 to -05, -25, -26, -28 to -30 |
| [T4a](T4a.md) | Mock session, courses, upload, package inspector | yes | AC-T4-01 to -06, -35 |
| [T4b1](T4b1.md) | Connections and publications (connect + publish) | yes | AC-T4-07 to -10, -12, -14, -30, -33, -34, -36 |
| [T4b2](T4b2.md) | Picker, launch handoff, player shell, tool page security | yes | AC-T4-15 to -29, -31, -32 |
| [T5a](T5a.md) | Content host, SCORM 1.2 runtime, tracking, score sync, results | yes | AC-T5-01 to -08, -12, -13, -15 to -17, -20 to -24, -34, -35, -37 |
| [T5b](T5b.md) | HTML runtime, retry and conflict, Resend, results refresh | yes | AC-T5-09 to -11, -14, -18, -19, -27 to -33, -36 |
| [T6](T6.md) | Portal UI | yes | AC-T6-01 to AC-T6-14 |
| [T7](T7.md) | Full E2E in real Moodle | yes | AC-T7-01 to AC-T7-15 |
| [T3c](T3c.md) | Compatibility-only endpoints and the independent-client test | yes | AC-T3-09, -15, -19 to -21, -27, -31 |
| [T8](T8.md) | Stretch: native channel and course shell | yes | AC-T8-02 to AC-T8-10 |
| [T9](T9.md) | Docs and human review pack (Docs role) | yes | AC-T9-01 to AC-T9-04 |

### Blackboard and Canvas phase (from 2026-10-20)

Design: [ADR-011](../adr/ADR-011-multi-lms.md); SQLite storage: [ADR-012](../adr/ADR-012-sqlite-volume-storage.md) (proposed, revision 3.1; 72 AC-M1-41 rows, so 488 mandatory rows per full round). Roles: from the owner's 2026-10-20 direction, every remaining task uses Claude Code Opus 5.5 xhigh; the model names below that say Codex record who did the earlier work. Order: M0 review → M1a ∥ M2 (against the contract) ∥ QA simulator → M1b → M2 integration → M3 → M4.

| Task | Title | Owner | Verified by | AC ids |
| --- | --- | --- | --- | --- |
| [M1](M1.md) | Backend: profiles, reserved issuers, signed product family, canonical site and service origins, deployments and generations, two-phase operator grants, operator containment, Canvas and Blackboard registration, guards, backup and restore, SQLite volume storage (ADR-012 revision 3.1, proposed) (M1a LTI service, M1b app) | Author (Claude) | common QA (Codex in earlier rounds; an independent Claude session from 2026-10-20) | AC-M1-01 to AC-M1-41 |
| [M2](M2.md) | Portal: Canvas and Blackboard cards, wizards with approval codes, routes, generic labels | Author-2 (Codex; any further Canvas repair: a dedicated Claude author) | QA-E2E (Claude) | AC-M2-01 to AC-M2-13 |
| [M3](M3.md) | Simulator, independent QA, Moodle regression, live matrix | QA, QA-E2E | — | AC-M3-01 to AC-M3-07 |
| [M4](M4.md) | Guides, review pack, final conformance | Docs, Architect | Reviewers | AC-M4-01 to AC-M4-08 |

File ownership does not overlap: M1 = `services/**`, `apps/player/**`, `packages/**`, `infra/**`; M2 = `apps/portal/**`; M3 = `tests/**` and its review files; M4 = the files in M4.

AC id rule: an AC keeps the number of the task where it was first written (for example AC-T3-12 is in T3a). New ACs continue the number sequence. Removed numbers are not reused. The mapping is in [`../review-response-T0.md`](../review-response-T0.md).

## 2. QA rules

QA writes tests from the task specs and contracts only (charter §1). It does not read the Author's notes or code before it writes the tests.

| Allowed | Not allowed |
| --- | --- |
| Playwright 1.56.0 (Chromium) and HTTP calls from the `e2e` container | Reading service source code |
| `docker compose exec` for the read-only commands that an AC names, `docker compose logs`, `stop`, `start`, `port`, `ps`, `network inspect` | Reading or changing SQLite files or the package store, except where an AC or the P5 fixture exception below allows it |
| [T5b final regression P5](T5b.md#final-regression-p5-bounded-fixture-exception): delete one higher failed sync by exact id in QA's own stack; assert one deletion and check Resend through public APIs | Any wider P5 fixture mutation without a new Lead decision; altering attempts or the lower sync; reporting this check as pure black-box |
| Moodle web services: the product service (as a client of the product) and the QA-only `cogniate_qa_oracle` service | Changing Moodle data with CLI, except the steps that an AC names |
| `docker compose pause moodle` and `docker compose unpause moodle` through the host channel (Lead decision, T9 P1 and P2 fixes): **only on QA's own compose project**, only to make Moodle hang (the P1 register timeout, the P2 in-flight score race). Every pause has an `unpause` in a `finally` block or a shell `trap`, so Moodle never stays paused after the test. | `pause` or `unpause` on another project (the Author's stack, `cogniate-*`, another QA project) or on any other service |
| Moodle CLI read-only (`admin/cli/cfg.php` without `--set`), and `admin/cli/cron.php` (`npm run moodle:cron`) | Test knobs in T7 |
| `infra/.secrets/seed.json`, `infra/.logs/*.jsonl` (read-only mount in `e2e`) | Copying code from the `ltiaas` SDK or from LTIAAS docs |
| `npm run stack:restart -- <service> --env K=V` for the knobs below | |
| M1 (AC-M1-06): `docker compose exec lti-service npm run lti:shared-platform …`; M1 and M2: `docker compose exec cogniate-app npm run app:grant …` and `… app:binding …`; the transport gate control API `https://lti-gate.test/__gate/*` (M3 §3.3); `npm run stack:restart -- cogniate-app` and `-- lti-service` (with `--env` for AC-M1-35) during M1 race and gate tests — on QA's own compose project only | The same commands on another project; any gate or simulation setting outside the `acceptance` profile |
| M1 (AC-M1-23, AC-M1-30): the exact sequences of those ACs in QA's own clone (code switched while both services are stopped; damaged **copies** of the backup for the refusal checks; SHA-256 of the owned database and backup files) | A destructive reset of any other stack; editing a migration ledger or a table |

Determinism rules:

- `retries: 0`, `workers: 1`. Unique names per run (for example `QA DL <runId>`).
- Fresh activity per AC: an AC that needs a learner with no earlier state uses its **own** activity, made by deep-linking the same publication again (a new activity is a new resource link, so attempts and grades start empty). Name: `Cogniate <SCORM|HTML> <AC id>`, for example `Cogniate HTML AC-T5-28`. The AC says when it needs one.
- ACs that share state list a "QA run order" line in their task file.
- Block every host that is not `*.test` in all browser contexts and record the blocked URLs (the packages load S3 images and Google fonts). AC-T5-36 makes them hang instead. Use `waitUntil: 'domcontentloaded'` when hosts hang.
- Requests sent while a page closes are not seen by `page.route()`: check them in the service logs.
- Poll with the deadlines in the ACs. Fixed waits only for the 11 s dwell and the TTL tests.
- Use the visible labels of Moodle 5.2.4. Record every difference from the task text.
- Moodle cleans activity names (`PARAM_TEXT` strips tags): a test that names an activity with markup must expect the cleaned text. Escaping tests use names that survive cleaning, such as `x < y & "z"`.
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
| `BUILD_RUNNER_HOLD` | cogniate-app (number knob, 0–1) | 0 | 1 | AC-T8-03 | The build pauses before teardown until the flag file is removed. |
| `BUILD_RUNNER_FAIL_AT` | cogniate-app (string knob: `""`, `start`, `course`, `scorm`, `backup`, `copy`) | "" | `backup` | AC-T8-07 | The build fails at that step. |

Ownership of the two Build Runner knobs: they are registered for `cogniate-app`; the app reads them from its env and passes them in each build request, and the host Build Runner (`infra/scripts/build-runner.sh`) applies them. No other knob exists. T7 checks that every `/healthz` shows `"knobs": []` and `"profile": "default"` (AC-T7-13).

Knob tests: QA runs `npm run stack:restart -- <service> --env K=V` on the host, then `npm run test:acceptance -- <select the knob test>` (H14 forwards the arguments and the `QA_*` env), then `npm run stack:restart -- <service>`.

## 4. Profiles and helper hosts

| Profile | Adds | From |
| --- | --- | --- |
| `test` | `e2e` container | T1 |
| `acceptance` | `evil.test` sink (`sink_hit` → `infra/.logs/sink.jsonl`) and `qa-platform.test` static host (`tests/fixtures/qa-platform/`, QA-owned; `qa_platform_hit` → `infra/.logs/qa-platform.jsonl`), second leaf certificate, allowlist entries, `profile: "acceptance"` in `/healthz`. Start: `STACK_PROFILE=acceptance npm run stack:up`. | T2b |
| `acceptance` (M1 additions) | `lms-sim` service (QA code in `tests/sim/`, [M3 §3](M3.md#3-signed-platform-simulator-and-transport-gate)) with the `.sim.test` host names, their SANs and LTI service allowlist entries; the `lti-gate` transport gate (`lti-gate.test`, app allowlist; M3 §3.3); `LTI_PROVIDER_SIMULATION=on`, so `/healthz` shows `simulation_profiles`. Not a knob: `knobs` stays `[]`. | M1 |

`npm run test:acceptance` starts the stack with the `acceptance` profile and restores the default at the end (local-stack §3). `npm run test:e2e` does not use it.

## 5. Fixtures

The two course zips are not in git (Q15). `COURSE_FIXTURES_DIR` (default `docs/raw/data/courses`) points to them. `npm run fixtures:check` compares them with `infra/fixtures/courses.sha256` and prints how to get missing files. Tests copy each zip to a new temp folder before use (untrusted data).

## 6. Evidence

Each `docs/reviews/<task>/qa.md`: commit SHA, image digests, run date and times, one row per AC (PASS or FAIL, test id, command, artifact path), Playwright traces, screenshots at Moodle and portal assertions, log snapshot, and the grep result for each captured secret. Secrets in evidence show only the first 6 characters and the length.
