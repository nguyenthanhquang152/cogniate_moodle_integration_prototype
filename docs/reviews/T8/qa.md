Verdict: PASS
Round: 2

# T8 QA verification

| Item | Value |
| --- | --- |
| SHA | `63de503e86684d2a71ed43b8aac3a88029423a01` (Lead: the same product code as `8fdfa9e` plus the Author's T7 script polish). Run 1 used `8fdfa9ec4c86343c58a8019df1e3131817fe8047`. |
| Spec | `tasks/T8.md` (AC-T8-02 to -10; AC-T8-05 checks the restored course **shortname**), app contract §11 (MbzBuild, limits, Build Runner rules and log events, course shell), security §10a, tasks README §3 (knobs `BUILD_RUNNER_HOLD`, `BUILD_RUNNER_FAIL_AT`). Audit items C-T8-01 and C-T8-02 (Lead): checks against the contract §11 rules. |
| Scope | AC-T8-02 to AC-T8-10 (AC-T8-10 is the portal part of Codex's round) and the two audit items. |
| Tests used | New QA suite `tests/acceptance/T8/` and runner `tests/host/run-t8.mjs` (section 4), with `--replace-tests`. The Lead can commit `tests/**`. |
| Runner | `COMPOSE_PROJECT_NAME=qa-t8-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-t8.mjs --sha 63de503…`: `npm run stack:doctor` first, then `npm run build`, `stack:up`, `seed`; main pass (`SETUP-T5a` gives Thanh's connection and the SCORM course); knob pass `BUILD_RUNNER_HOLD=1` (AC-T8-03); knob pass `BUILD_RUNNER_FAIL_AT=backup` (AC-T8-07); passes `races` (C-T8-01) and `runner-race` (C-T8-02, last). Host actions (only for this project; build items found by the label `org.cogniate.stack=qa-t8-r1`): `build-inspect`, `build-release`, `build-leftovers`, `moodle-restore`, `runner-stop`, `runner-race`. |
| Isolation | Each run used a new stack, removed with its volumes and networks. During AC-T8-07, another stack's build project (`cogniate-build-ef7258…`) was on the host; QA did not touch it, and this stack's clean-up did not remove it. The runners that QA started for C-T8-02 were stopped before the teardown. |
| Evidence roots | `S1` = `tests/host/artifacts/qa-t8-r1-8fdfa9ec-2026-10-19T03-03-26-192Z/` (run 1: three QA defects), `S2` = `…/qa-t8-r1-63de503e-2026-10-19T08-33-02-836Z/` (run 2: every AC), `S3` = `…/qa-t8-r1-63de503e-2026-10-19T08-40-42-602Z/` (audit items). |

## 1. Results per acceptance criterion (`S2`)

| AC | Result | What QA saw |
| --- | --- | --- |
| Doctor | PASS | `npm run stack:doctor` before the start: every line OK (packages, `.env` and URLs, certificates, port 8443, subnet, base images, the Build Runner image `cogniate-build-moodle:v5.2.4`). |
| AC-T8-02 | PASS | `POST …/mbz` → `202 queued`; `ready` after 42 s; `downloadUrl` set. `GET …/download?kind=mbz` → `200 application/vnd.moodle.backup`, 23,171,375 B (> 12 MB), equal to `bytes`. |
| AC-T8-03 | PASS | Knob `BUILD_RUNNER_HOLD=1` (in `/healthz`). The held build (`build_hold` event with the hold file): its network `cogniate-build-<id>_build` has `Internal: true`; its two containers (Moodle, Postgres) are on that network only; inside the build Moodle, `moodle.test` and `example.com` do not resolve. After QA removes the hold file, the build ends `ready`, and `docker ps -a`, `docker volume ls` and `docker network ls` show no `cogniate-build-*` item of this stack. |
| AC-T8-04 | PASS | The `.mbz` is a gzip tar with 76 entries. `moodle_backup.xml`: `moodle_release` "5.2.4 (Build: 20261005)", root setting `users` = 0, activities `forum` (Announcements) and exactly one `scorm`. |
| AC-T8-05 | PASS | Host: `docker cp` of the `.mbz` into the stack Moodle, then `admin/cli/restore_backup.php --file=<mbz> --categoryid=1` → exit 0, "Restored course ID: 4". Oracle: one course with shortname `cogniate:<courseId>:default:en`, `visible` 0, modules `forum` and one `scorm` (idnumber empty, as the AC expects for a restore from another site). |
| AC-T8-06 | PASS | Oracle `core_course_update_courses` (visible), product WS `enrol_manual_enrol_users` (cg_student). `cg_student` opens the activity in Moodle's own SCORM player (Enter), menu page, lesson page ≥ 11 s and scroll, correct option. Gradebook: 100.00. The SCORM user report (admin) shows the SCO with status "Passed", score 100. |
| AC-T8-07 | PASS | Knob `BUILD_RUNNER_FAIL_AT=backup`: the build ends `failed`, step `backup`, reason "Test knob BUILD_RUNNER_FAIL_AT=backup: the build stopped at step backup.". The course page in the portal shows the build as failed with that reason. No `cogniate-build-*` container, volume or network of this stack remains. |
| AC-T8-08 | PASS | `PUT …/web-services` with a random 32-hex token → `422 WS_TOKEN_INVALID`; with the product WS token → `200`, release "5.2.4 (Build: 20261005)", 9 functions including the three the app needs. `GET` of the connection shows `webServices.release`; the token is not in the answer. |
| AC-T8-09 | PASS | `POST /app-api/publications` with `createMoodleCourse: {}` → `shellStatus: created`, `moodleCourse.idnumber` `cogniate:<courseId>:default:en`; oracle: one course with that idnumber, `visible` 0, the same id. A second publish → `shellStatus: exists`; still one course. |
| AC-T8-10 | PASS | Without a token, the Publish dialog (with Thanh's connection chosen) has no "Also create an empty Moodle course" checkbox. With the token, it has the checkbox; after "Publish", the page links to `…/course/view.php?id=<id>` of the one new hidden course with idnumber `cogniate:<courseId>:default:en`. |

## 2. Audit items (Lead): C-T8-01 and C-T8-02 (`S3`, expected to fail at this SHA)

| Item | Result | What QA saw |
| --- | --- | --- |
| C-T8-01 (one version) | FAIL | Two parallel `POST …/mbz` for one version (newest build `ready` or none) → both `202 queued`, but with two build ids (`bld_4eb8…`, `bld_ed19…`). Contract §11: a build that waits or runs is returned, "no new build". |
| C-T8-01 (limit) | FAIL | Three parallel `POST …/mbz` for three versions of one library (no active build before) → three `202`. Contract §11: at most 2 active builds per library, else `409 MBZ_BUILD_LIMIT`. |
| C-T8-02 | FAIL | QA stops the stack's runner, queues a build, then starts two `build-runner.sh watch` at the same moment. Both log `runner_started` (both took the lock). Runner a then stops with an uncaught `ENOENT` on `rename status/runner.json.tmp → runner.json` (the two runners write the same heartbeat temp file) and exits 1; it logs no `runner_refused`. Runner b runs the queued build once (`ready`). Contract §11: a second runner is refused (`runner_refused`) and exits 1. |

## 3. Findings

| Id | Severity | Finding |
| --- | --- | --- |
| Q-T8-01 | MAJOR (known: C-T8-01, fix in progress) | Parallel `POST …/mbz`: one version gets two builds, and one library gets more than 2 active builds (no `409 MBZ_BUILD_LIMIT`). Black-box reproduction: `T8/5-races.spec.ts`. |
| Q-T8-02 | MAJOR (known: C-T8-02, fix in progress) | Two Build Runners started together both take the lock; the loser crashes on the shared heartbeat temp file instead of `runner_refused`. Black-box reproduction: `T8/6-runner-race.spec.ts`. |

Round 2: QA re-runs the passes `races` and `runner-race`, and AC-T8-02, -03, -07 (build and runner paths), on the fix SHA (`--passes`).

## Round 2 (`8059c31…`, the combined fix SHA)

| Item | Value |
| --- | --- |
| SHA | `8059c316…` (Lead: C-T8-01 `4c83901`, C-T8-02 atomic runner lock and C-T8-03 in `8059c31`; P1, P2/P5, P11 app fixes). The Lead's last delta `dd6dd11` has no T8 or infra change, so T8 round 2 stays on this SHA. |
| Tests used | The suite of round 1 with the round 1 fixes, copied into the clone with `--replace-tests` (the Lead commits `tests/**` from the main checkout). |
| Runner | `run-t8.mjs --sha 8059c31…` with every pass: main, races, hold (AC-T8-03), fail (AC-T8-07), runner-race (C-T8-02, last). |
| Evidence root | `R2` = `tests/host/artifacts/qa-t8-r1-8059c316-2026-10-19T09-04-05-507Z/` |

| Item | Result | What QA saw |
| --- | --- | --- |
| `stack:doctor`, AC-T8-02, -04, -05, -06, -08, -09, -10 | PASS | As in round 1 (`.mbz` 23,171,352 B, ready after 42 s; restore → course 4 with `forum` and one `scorm`; gradebook 100.00 and "Passed" in Moodle's player; shell course `exists` on the second publish; the checkbox only with a token). |
| AC-T8-03 | PASS | Held build: network `Internal: true`, each container on that network only, `moodle.test` and `example.com` unresolved; after release `ready` and no `cogniate-build-*` item of this stack. |
| AC-T8-07 | PASS | `failed` at `backup` with the knob reason; the portal shows it; no leftovers. |
| C-T8-01 (one version) | PASS (was FAIL) | Two parallel `POST …/mbz` → both `202 queued` with the same build id `bld_da96…`; that build ends `ready`. |
| C-T8-01 (limit) | PASS (was FAIL) | Three parallel `POST …/mbz` for three versions → `202`, `409 MBZ_BUILD_LIMIT`, `202`. |
| C-T8-02 | PASS (was FAIL) | Two runners started together: runner a runs (`runner_started`, then the queued build `build_started` … `build_ready`, once); runner b logs `runner_refused` and exits 1. The queued build is `ready`; the lock file names runner a. |

Findings Q-T8-01 and Q-T8-02 are fixed. No new findings.

## 4. QA-side changes (tests only)

1. New: `tests/acceptance/T8/` (setup, `.mbz` chain, course shell, two knob specs, two audit specs), `tests/acceptance/lib/t8.ts` (MbzBuild API, tar.gz reader, `moodle_backup.xml`, Moodle's SCORM player), `tests/host/run-t8.mjs`. Host ID pattern also maps `C-T<n>-<n>` titles.
2. Run 1 (`S1`) QA defects: (a) `build-release` resolved the relative `hold_file` of the `build_hold` event against the runner's folder, not the stack clone, so the hold was never released and AC-T8-07 got the same held build back (the contract answer for a running build); (b) AC-T8-10 did not choose a connection in the Publish dialog (it starts at "Choose a connection"), so the checkbox could not show. Both fixed; AC-T8-02, -04, -05, -06, -08, -09 passed already in `S1`.
3. The audit passes use `QA_GREP` `(?<!A)C-T8-0n` (the plain id also matched "AC-T8-02" in `S3`; that extra AC-T8-02 run passed).

## 5. Not covered

- The MoodleCloud restore itself (QA restores in the stack Moodle with the CLI, as AC-T8-05 says).
- The 10 min build time-out, the start-up sweep of interrupted builds, `request_rejected` for planted files, and the `.mbz` copy checks (security §10a, A-T8-01): no AC; not tested black-box.
- "Moodle web services (optional)" form in the portal (QA used the API for AC-T8-08).

## 6. Writing

This file uses Simplified Technical English where practical: short sentences, active voice, one instruction per sentence. Moodle labels, AC ids and error codes are kept as they are.
