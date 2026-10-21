# LA-R5: Test and QA baseline for milestone LA

Researcher R5, milestone LA (Orca run `run_06d07dc77faf`, task `task_b7243b4b089b`). Date: 2026-10-22.
Worktree `ltiaas-milestone`, HEAD `9fcfd72`. Product and test paths at HEAD are equal to candidate C `d3296dd` (product `9f8ac62`, tests `c71912f`): `git diff --stat d3296dd HEAD -- services packages apps infra tests` is empty.

## Summary

1. The inventory has 16 entries. 4 need no Docker, 11 need a Docker stack (all with Moodle), and 1 (the live matrix) needs human-provided LMS sites (§1).
2. `npm run check` passed here in 69 s: 70 files, 1,123 tests passed and 5 skipped; 111 infra tests passed. The 5 skips are course-fixture tests, because the zips are not in this worktree (§3).
3. `npm run check` does not run `tests/**`. The simulator self-tests (10/10, 0.4 s) and the QA typecheck (167 files, about 2 s) pass, but only when you start them by hand (§3).
4. No stack suite has run at HEAD. The service code at HEAD is the same as at `aaa823b`, where the full M1 run gave 438 PASS and 50 FAIL. All 50 failures are in the storage phase, and QA proved no product defect. M2 (64/64) and T7 (3×17) last passed at `aff4882`, which has the same service code but older `infra/` (§1.3).
5. The simulator signs LTI 1.3 launches and Deep Linking requests, has 12 signature and claim faults, and serves token, AGS, NRPS and DL return. It has no Dynamic Registration, no multi-item DL and no NRPS members (§2).
6. A new simulator LMS today means about 8 edits in QA, infra and core files. Two of them are in the core profile registry. A config-only LMS such as Blackboard needs about 0.5–1.5 days (inferred) (§2).
7. M1 and M2 assert closed lists: 6 real profiles, 2 simulation profiles, 6 named capability keys and 3 LMS cards. So the plan goal "M1, M2 and T7 pass with no change to their assertions" conflicts with E1 and E2 (§4c).
8. A minimum E1 regression costs about 1.5 min with no Docker, about 30 min on one SIM lane and about 1.5–2.5 h on one Moodle lane. The multi-LMS full gate was estimated at 6–10 h (§4c).
9. The Docker VM has 7.75 GiB, so 2 stacks at the same time is the safe maximum. The LA charter gives every Author lane its own stack, so the lanes must take turns on Docker (§4d).
10. QA was slow mostly because of the storage harness and serial windows. The storage harness is 8,076 lines, about 1.5 times the M1 acceptance tests. There were 9 full-run attempts, and none completed a round (§5).

Source aliases used below (all paths are relative to the repo root):

| Alias | Path |
| --- | --- |
| P | `docs/team/multi-lms-plan.md` |
| M1Q, M1C, M1P | `docs/reviews/M1/qa.md`, `docs/reviews/M1/qa-canvas.md`, `docs/reviews/M1/qa-plan.md` |
| HQA, SCQ | `docs/reviews/M1/storage-harness-repair-qa.md`, `docs/reviews/M1/storage-command-qa.md` |
| M2Q, M2P | `docs/reviews/M2/qa.md`, `docs/reviews/M2/qa-plan.md` |
| M3Q, M3E, M3L | `docs/reviews/M3/qa.md`, `docs/reviews/M3/qa-e2e.md`, `docs/reviews/M3/live.md` |
| T7Q | `docs/reviews/T7/qa.md` |
| TRI | `docs/architecture/tasks/storage-full-round-triage.md` |
| PRE | `docs/reviews/M0/qa-e2e-preflight.md` |

## 1. Suite inventory

### 1.1 Common run patterns

- **Host runners** (`tests/host/run-*.mjs`, `tests/e2e/host/run-*.mjs`) clone a frozen SHA into `~/cogniate-qa-runs/`. They start their own stack, run the suite in the `e2e` container and remove the stack at the end (`tests/README.md:20-30`; `tests/host/core.mjs:226-245`). The project name must start with `qa-` (`tests/host/core.mjs:73-79`).
- **In-container suites** start with `npm run test:acceptance` or `npm run test:e2e` (`package.json:45-46`). `qa-suite.sh` switches the stack to the `acceptance` profile, runs `npm ci --prefix tests` and the suite in the `e2e` container, and then restores `default` (`infra/scripts/qa-suite.sh:57-78`). It rebuilds the e2e image on each pass (`--build`, `infra/scripts/qa-suite.sh:77`).
- **Selection:** `QA_TASK` (task folders) and `QA_GREP` (title regex). All `QA_*` variables go into the container (`tests/README.md:36-40`; `infra/scripts/lib.sh:235-241`). An empty selection passes, so each runner checks that the expected ids ran (`tests/host/core.mjs:334`).
- **Determinism rules:** `retries: 0`, `workers: 1` (`docs/architecture/tasks/README.md:64`; `tests/playwright.config.ts:18-36`; `tests/e2e/M2/playwright.config.ts:11-30`).
- **Compose profiles** (`infra/compose.yaml`):

| Profile | Adds | Where |
| --- | --- | --- |
| (none) = `default` | proxy, postgres, moodle, lti-service, cogniate-app | `infra/compose.yaml:39-210` |
| `acceptance` | `sink` (`evil.test`), `qa-platform`, `lms-sim`, `lti-gate`; `LTI_PROVIDER_SIMULATION=on`; simulator hosts in the allowlist | `infra/compose.yaml:215-345`; `infra/scripts/lib.sh:80-99` |
| `test` | the `e2e` runner (Playwright 1.56.0, `shm_size: 1gb`) | `infra/compose.yaml:439-450` |
| `storage` | `storage-preflight`, `maintenance` (ADR-012) | `infra/compose.yaml:357-380` |
| `compat` | the Python `ltiaas==0.0.4` SDK client (T3c) | `infra/compose.yaml:407-410`; `tests/compat/run.py:1-29` |

### 1.2 Suite table

"No Docker" means that the suite can run in any lane, also in parallel. Durations are measured values unless they say "est." (estimate).

| # | Suite | What it proves | Exact command | Stack needs | Duration | Last result (SHA) | Known trouble |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Root check | Lint, `tsc` for root and 7 workspaces, 70 Vitest unit files, 4 infra `node --test` files | `npm ci && npm run check` (`package.json:14-18`) | No Docker | 69 s here (§3) | PASS here at HEAD (= C product): 1,123 pass, 5 skip; infra 111 pass. Moodle baseline: 708 tests, 0 skip (`docs/team/board.md:89`) | 5 fixture tests skip without the course zips (`docs/team/board.md:89`). 115 `FSTDEP022` warning lines (§3). |
| 2 | QA typecheck | `tests/**` TypeScript compiles (167 files) | `npm ci --prefix tests && npm --prefix tests run typecheck` (`tests/package.json:14`) | No Docker | about 2 s here | PASS here | Not in `npm run check` (`eslint.config.js:17-18`; `vitest.config.ts:8`). |
| 3 | Simulator self-tests | The simulator fixtures behave as their sources say ("HARNESS ONLY", not product) | `node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs` | No Docker | 0.4 s here | 10/10 PASS here | Not in `npm run check`. |
| 4 | M1 harness gate | QA host harness: 15 `*.selftest.mjs` files, sim tests, M1 oracle self-tests, QA typecheck | `node tests/host/run-m1.mjs --harness-only --provider all` (`tests/host/run-m1.mjs:66-72`). QA form: Docker stub on `PATH`, both umasks (HQA:390-395) | No Docker (stub) | 539 s per umask (P:60, P:77) | 142/142 at umask 022 and 077; 70/70 mutants, report `614baae`, candidate C (P:36-37) | Umask dependence (P:1236-1238). Not run here: some self-tests drive the `docker` binary, and the brief forbids Docker. |
| 5 | M1 full runtime (common QA) | 41 ACs (AC-M1-01..41), 488 rows per round: `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70 (`docs/architecture/tasks/M3.md:85`). Two equal rounds, then legacy (#7). | `COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 STACK_PROFILE=default COURSE_FIXTURES_DIR=<zips> TMPDIR=<run>/tmp node tests/host/run-m1.mjs --sha <40hex> --test-sha <40hex> --source <clone>` at umask 022 (M1P:353-357; M1Q:1779-1789). One phase: `--phase sim --provider all` (`tests/host/run-m1.mjs:33-46`). | Docker, Moodle 5.2.4, `acceptance` + `storage` profiles, course zips. Bound client identities (Docker CLI 29.9.1, Compose 5.6.0) (`docs/architecture/tasks/M1.md:321`). | `sim` phase about 22 min (M1Q:374, M1Q:890). `stack:up` 32 s, seed 3 s (M1Q:566). Round 1 at `aaa823b`: 42 min, storage incomplete (M1Q:1776). Est. 45–60 min per full round (P:77). Est. 6–10 h for the full gate (P:98). | 438 PASS / 50 FAIL at `aaa823b`. `sim`, snapshot and migration phases all PASS; storage 20/70 (M1Q:1821-1825). No product defect proven (M1Q:1852). No complete round on any SHA (P:97). | 9 attempts (§5). Host reboot, engine 29.8.2 → 29.9.1, idle-VM bridge changes, WAL locks on the bind mount (M1Q:481-495, M1Q:616-667). |
| 6 | M1 Canvas rows (Canvas QA) | 233 Canvas rows: 232 SIM (225 API, 7 browser) and 1 snapshot-isolated (M1C:624) | `run-m1.mjs … --provider canvas` (`tests/host/run-m1.mjs:59-63`) | Same as #5 | Inside #5 | 233/233 PASS at `aaa823b` (M1C:1, M1C:624) | Partial evidence only; Canvas QA is at round 13 (M1C:2). |
| 7 | Legacy groups (in the M1 gate) | The Moodle baseline does not regress. Six runners, 12 groups, default profile (`tests/host/run-m1.mjs:200-215`; P:66) | `node tests/host/run-m1.mjs --phase legacy …` or each runner, e.g. `node tests/host/run-t2.mjs --sha <sha> --tasks T2a,T2b,T3a,T3b` | Docker, Moodle, course zips; T3c needs the `compat` image and PyPI (`infra/scripts/compat-run.sh:36-40`) | T4b1+T4b2 about 5 min (`docs/reviews/T4b1/qa.md:74`). T5a+T5b+T6 about 19 min (`docs/reviews/T5a/qa.md:146`). Others not recorded. Est. 60–120 min for all (M1P:381-384). | In the multi-LMS phase, only T2a/T2b/T3a/T3b ran: 58 cases, 0 fail, at `eb43247` (P:2008-2013). The others "did not run" (P:748). | Never reached in a full run (P:748). The T5b P5 fixture writes `cogniate.db` while lti-service runs; ADR-012 §11 conflicts with this (`docs/reviews/M0/storage-qa.md:581-586`). |
| 7a | T2a, T2b | LTI core; negative launch matrix with `qa-platform.test` and the sink | `run-t2.mjs --tasks T2a,T2b`; `QA_TASK=T2a,T2b npm run test:acceptance` | `acceptance` profile | not recorded | PASS 35 tests at `1fa011d` (`docs/reviews/T2b/qa.md:1-26`) | — |
| 7b | T3a, T3b | Service keys, AGS, DL response; Dynamic Registration | `run-t2.mjs --tasks T2a,T2b,T3a,T3b` | Moodle | not recorded | PASS at `6f03a80` (`docs/reviews/T3a/qa.md:1-11`; `docs/reviews/T3b/qa.md:8-18`) | — |
| 7c | T3c | LTIAAS-compatible endpoints with the real SDK | `run-t3c.mjs --sha <sha>` | `compat` profile | not recorded | PASS 7/7 at `8fdfa9e` (`docs/reviews/T3c/qa.md:1-29`) | Needs network for PyPI at image build. |
| 7d | T4a, T4b1, T4b2 | Upload and inspector; connect, publish, picker, launch handoff | `run-t4a.mjs`; `run-t4b.mjs --tasks T4b1,T4b2` | Moodle, zips, Moodle pause | about 5 min (T4b) | PASS at `93884d8` (T4a); `a5d9ddc` (T4b) (`docs/reviews/T4b1/qa.md:68-77`) | — |
| 7e | T5a, T5b, T6 | SCORM and HTML runtime, score sync, outage, Resend; portal UI | `run-t5.mjs --tasks T5a,T5b,T6` | Moodle, zips, host channel | about 19 min | PASS at `d54c607` (`docs/reviews/T5a/qa.md:141-152`) | The P5 fixture conflict above. |
| 7f | T8 | `.mbz` build, Moodle course shell, Build Runner races | `run-t8.mjs` (passes `main,races,hold,fail,runner-race`) | Moodle, Build Runner, zips | not recorded | PASS round 2 at `8059c31` (`docs/reviews/T8/qa.md:48-66`) | Round 1 failed on two audit races (`docs/team/board.md:53`). |
| 8 | T1 (not in legacy) | Skeleton, HTTPS stack, seed, reset hooks | `run-t1.mjs --sha <sha> --replace-tests --only-task-folders T1` (`docs/reviews/T1/qa.md:116`) | Docker, reset | not recorded | PASS round 2 at `b82382b` (`docs/reviews/T1/qa.md:109-119`) | — |
| 9 | M2 (QA-E2E, SIM) | 13 ACs, 64 browser cases: LMS cards, Canvas and Blackboard wizards, detail, disconnect, publish, keyboard and axe, one SIM DL + score flow per LMS (`docs/architecture/tasks/M2.md:111-123`; M2P:16-42) | `COMPOSE_PROJECT_NAME=qa-e2e-sim-rN PUBLIC_PORT=8643 STACK_SUBNET=172.27.0.0/16 COURSE_FIXTURES_DIR=<zips> node tests/e2e/host/run-m2.mjs --sha <40hex> --test-sha <40hex> --workdir <dir>` (`tests/e2e/host/run-m2.mjs:7-9`). No Docker: `--harness-only`. | Docker, `acceptance` profile, Moodle, e2e image with Chromium 141, zips, Build Runner (M2Q:68, M2Q:635-637) | Playwright 113 s; about 4.6 min wall clock at `aff4882` (computed from M2Q:626, M2Q:633, M2Q:714). Est. was 45–75 min (M2P:72). | 64/64, 0 skip, 0 retry at `aff4882` (M2Q:1, M2Q:622) | 5 frozen runs to reach 64/64 (M2Q:54-622). QA harness races (M2Q:436-465). External observer printed env secrets to its log (M2Q:720-724). |
| 10 | T7 (QA-E2E, real Moodle) | 15 ACs, 18 tests in 6 files: Dynamic and manual registration, 2 libraries, 2 learners, isolation, replay refusal, secret grep (`docs/architecture/tasks/T7.md:21-60`; T7Q:282) | `COMPOSE_PROJECT_NAME=qa-e2e-m3-rN PUBLIC_PORT=8543 STACK_SUBNET=172.31.0.0/16 COURSE_FIXTURES_DIR=<zips> node tests/e2e/host/run-t7.mjs --sha <sha> --runs 3 --demo --check-confirm` (`tests/e2e/README.md:27-29`). With a running stack: `npm run test:e2e`. | Docker, `default` profile, Moodle, zips | 172–174 s per run plus about 37 s reset (T7Q:300-302); about 11 min for 3 runs and the demo (T7Q:288, T7Q:336) | PASS 3 × 17 at `aff4882` (T7Q:296-305); cross-team PASS at `3f934ee`, 173 s (`docs/team/board.md:90`) | FAIL at `004568b`: one QA read race made 9 failures per run (T7Q:234-241). |
| 11 | M3 live matrix | Real Canvas and Blackboard behaviour | — | Human-provided sites (B-1..B-3) | — | 32 rows UNVERIFIED (M3L:1-11) | No tenant, account or public JWKS (M3L:11). Local Canvas needs 8 GB alone (M3L:70-80). |

### 1.3 Status at the LA base SHA

- `services/`, `packages/` and `apps/` at HEAD are equal to `aaa823b`. After `aaa823b`, only `infra/scripts/storage-oplock.sh`, its test and one compat hash changed (`git diff --stat aaa823b HEAD -- services packages apps infra`; commits `01ce5bc`, `9f8ac62`). So the 418 non-storage rows of round 1 at `aaa823b` ran on the current service code.
- From `aff4882` (the last M2 and T7 PASS) to HEAD, the only change in `services/`, `packages/` and `apps/` is one test file (`services/lti-service/src/cli/stack-data.test.ts`). But 19 `infra/` files changed (+3,988 lines), among them `infra/compose.yaml`, `infra/scripts/lib.sh` and `infra/scripts/stack-up.sh` (ADR-012 storage). So the M2 and T7 results cover the current app code on an older stack.
- The board says: "all stack gates must rerun after repair" (`docs/team/board.md:15`). G-BASE needs this rerun (`docs/team/ltiaas/charter-LA.md:51`).
- There is no CI service in the repo: there is no `.github/` folder or other CI file. "CI" today means a person or agent runs `npm run check` (inferred from the file tree).
- LA has no tests yet. `tests/ltiaas/` does not exist. The QA strategy (`docs/team/ltiaas/briefs/LA-QS.md`) uses this report as an input.

## 2. Simulator (`tests/sim`)

### 2.1 What it is

- One Node HTTPS server, 6 source files and 569 lines (`tests/sim/**/*.mjs`, without tests). QA owns it. The `acceptance` profile mounts it read-only as the `lms-sim` service (`infra/compose.yaml:276-317`).
- It loads provider modules from a fixed list: `['blackboard', 'canvas']` (`tests/sim/server.mjs:8-21`). A missing module stops the start (`tests/sim/server.mjs:45-46`).
- It answers only on known host names. Other hosts get 421 (`tests/sim/server.mjs:47-53`). The request limit is 1 MiB (`tests/sim/server.mjs:57`).
- It fetches the tool JWKS only from `{PUBLIC_LTI_URL}/lti/keys/cogniate` (`tests/sim/server.mjs:28-42`).
- The control host `lms-sim.test` has `/__sim/ready`, `/__sim/scenarios`, `/__sim/records`, `/__sim/secrets` and `/__sim/reset` (`tests/sim/core/runtime.mjs:72-93`). Health is plain HTTP on port 8080 (`tests/sim/server.mjs:77-82`).
- The `lti-gate` service is a separate transport fault gate between the app and the LTI service. The Author owns its code, and QA owns its scenarios (`infra/compose.yaml:319-338`; `docs/architecture/tasks/README.md:56`).

### 2.2 What it signs and serves today

| Area | Capability | Evidence |
| --- | --- | --- |
| Keys | One RSA-2048 signer and one "stranger" signer per process, public JWK only. No key rotation. | `tests/sim/core/crypto.mjs:5-26`; `tests/sim/core/runtime.mjs:30` |
| OIDC login | Checks client id, message hint, redirect URI, `response_type`, `scope`, nonce and state. Returns an auto-post form. | `tests/sim/core/provider.mjs:59-74` |
| Message types | `LtiResourceLinkRequest` and `LtiDeepLinkingRequest` only | `tests/sim/core/runtime.mjs:58`; `tests/sim/core/provider.mjs:37-44` |
| Claims | iss, aud, sub, nonce, version, deployment, target link, roles, context, resource link, tool platform family, launch presentation, AGS endpoint, NRPS endpoint. Each scenario can override or omit any claim. | `tests/sim/core/provider.mjs:24-46` |
| Signature and claim faults | `wrong-issuer`, `wrong-audience`, `multi-aud-no-azp`, `multi-aud-wrong-azp`, `expired`, `future-iat`, `wrong-nonce`, `unknown-key`, `unknown-kid`, `none`, `hs256`, `altered-signature` | `tests/sim/core/provider.mjs:47-55, 68`; `tests/sim/core/crypto.mjs:13-23` |
| Token endpoint | `client_credentials` with a JWT client assertion. Checks the tool signature, `aud` as a string or an array, jti replay and scopes. Issues a bearer token bound to a host. | `tests/sim/core/provider.mjs:76-96` |
| AGS | Line items: list, get, create, put, delete. Scores: checks content type, user, numbers and progress; it can answer with scripted status codes per POST. Results: read. | `tests/sim/core/provider.mjs:108-162` |
| NRPS | Returns an empty member list | `tests/sim/core/provider.mjs:110-115` |
| DL return | Verifies the tool JWT. Data in the claim or in the query; `sub` rule; replay check. Accepts exactly 1 `ltiResourceLink` item with `scoreMaximum` 100, a `pub_` URL and `_blank` window. | `tests/sim/core/provider.mjs:164-187` |
| LMS page | `/__frame` puts the tool in an iframe on a page host | `tests/sim/core/provider.mjs:203-208` |
| Evidence | Ordered records with a cursor, a hash reference for each token, and raw secrets for the leak scan (never in logs) | `tests/sim/core/runtime.mjs:37-43, 79-91` |
| Profiles | `blackboard-sim` (shared, array `aud`, DL `sub`, claim data). `canvas-sim-cloud` and `canvas-sim-self` (iframe, query data, string `aud`, required OIDC parameters). Canvas facts are pinned to `instructure/canvas-lms@1c9f0bb`. | `tests/sim/blackboard/index.mjs:5-21`; `tests/sim/canvas/index.mjs:4-89`; `tests/fixtures/multi-lms/provider-sources.json:1-26` |

What it cannot do today (the LA epics need it):

| Gap | Needed by | Note |
| --- | --- | --- |
| No Dynamic Registration (no OpenID configuration document, no registration endpoint) | E2 (DR where supported), E3 D-1 | Moodle DR is tested only against real Moodle (T3b, T7). |
| DL accepts exactly 1 graded `ltiResourceLink` with fixed values | E3 D-11 | The product output is hard-coded in the protocol core (`tests/sim/core/provider.mjs:178-181`). It is not a scenario option. |
| NRPS has no members | E3 D-8 | `tests/sim/core/provider.mjs:113` |
| No platform key rotation, no LTI platform storage (postMessage) | E3 D-4, E5 | One signer per process (`tests/sim/core/runtime.mjs:30`). |
| No generic or "standard" sim provider | E2 generic channel | The generic path uses `standard`, and `standard` is tested only on real Moodle and `qa-platform.test` (T2b). |

### 2.3 How you add a new LMS profile today

You must change 8 places in QA files, infra files and core product files. Thus the simulator is not "add a folder only".

| # | Change | File (owner) |
| --- | --- | --- |
| 1 | New module `tests/sim/<lms>/index.mjs` with one config object (id, issuer, family, auth, jwks, token, sites, page hosts, DL data mode, DL `sub`, document target). Blackboard needs 22 lines; Canvas needs 89 lines with its OIDC rule. | `tests/sim/**` (QA) |
| 2 | Self-test `tests/sim/<lms>/protocol.test.mjs` (Blackboard 88 lines, Canvas 151 lines) | `tests/sim/**` (QA) |
| 3 | Add the name to the fixed module list | `tests/sim/server.mjs:8, 11` (QA) |
| 4 | Network aliases for every new host | `infra/compose.yaml:300-311` (Author) |
| 5 | Hosts in `SIM_LTI_HOSTS` / `SIM_ALIASES`. These drive the LTI allowlist and the QA certificate SANs. | `infra/scripts/lib.sh:82-84` (Author); `infra/scripts/gen-certs.sh:24, 125-126` uses them |
| 6 | A product simulation copy of the profile (`simulation: true`) | `services/lti-service/src/profiles/<lms>.ts`, as in `blackboard.ts:23-30` and `canvas.ts:48-52` (Author, core) |
| 7 | Register it in the profile list in a fixed order | `services/lti-service/src/profiles/index.ts:5-7, 28-30` (Author, core) |
| 8 | Update the closed-list assertions: `simulation_profiles`, the profile constants, "six real profiles" | `tests/acceptance/M1/common/00-profiles.test.ts:40-49`; `tests/host/run-m1.mjs:296`; `tests/e2e/host/run-m2.mjs:124` (QA) |

The certificate updates itself: `gen-certs.sh` makes a new QA leaf when the SAN list changes (`infra/scripts/gen-certs.sh:83-92, 126`). The stack must restart.

### 2.4 Effort estimate (inferred)

| Work | Size | Estimate |
| --- | --- | --- |
| A config-only LMS like Blackboard (facts known, no new protocol feature) | Rows 1–8 above, plus 1 stack run | 0.5–1.5 days in total for QA-E2E and the Author, plus 1 Docker window |
| Same, after E7 makes the simulator data-driven (rows 3–5 and 7–8 come from one manifest) | Rows 1, 2 and 6 only | 0.5 day; meets plan measure 5, "less than one day" (`docs/team/ltiaas/plan.md:53`) |
| Dynamic Registration in the simulator | New routes, registration token, tool configuration checks | 1.5–3 days |
| Multi-item and ungraded DL as scenario options | Move the checks at `provider.mjs:178-181` into scenario data | 0.5 day |
| NRPS with members and paging | `provider.mjs:110-115` | 0.5 day |

## 3. Check run in this worktree (no Docker)

All commands ran at HEAD `9fcfd72` on 2026-10-22, macOS arm64, Node 24.21.0, npm 11.19.0. No tracked file changed: `git status --short` is empty after the runs.

| Command | Exit | Duration | Result |
| --- | --- | --- | --- |
| `npm ci` (root) | 0 | 2 s (warm npm cache) | 288 packages added, 0 vulnerabilities. A warning says that `fsevents` install scripts are not approved; this has no effect. |
| `npm run check` | 0 | **69 s** | PASS. Steps: `eslint .` about 1 s; `typecheck` about 5 s; `vitest run` 38.8 s; `test:infra` 23.6 s. |
| → `vitest run` | 0 | 38.79 s | **70 files passed; 1,123 tests passed, 5 skipped (1,128)** |
| → `node --test 'infra/scripts/*.test.mjs'` | 0 | 23.6 s | **111 tests, 14 suites: 111 pass, 0 fail, 0 skipped** |
| `node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs` | 0 | 0.4 s | 10/10 pass |
| `npm ci --prefix tests` | 0 | 1 s | OK |
| `npm --prefix tests run typecheck` | 0 | about 1–2 s | PASS (167 files) |

Notes:

- The 5 skipped tests are the course-fixture tests: `services/cogniate-app/src/app/app.test.ts` (2) and `packages/package-inspector/src/inspect.test.ts` (3). The zips are git-ignored and not in this worktree (`.gitignore`, the `docs/raw/data/courses/*.zip` rule). This matches "703 + 5" in `docs/team/board.md:89`.
- The log has 115 `FSTDEP022` Fastify deprecation warning lines. They are noise and not failures. They make the failures harder to find (inferred).
- The infra count is 111 here. P:835 records 84 infra tests at `aaa823b`. After `aaa823b`, `infra/scripts/storage-oplock.test.mjs` grew by 91 lines and lost 10 (commits `01ce5bc`, `9f8ac62`), which probably explains the difference (inferred; UNVERIFIED).
- Growth: the unit tests grew from 708 (Moodle baseline) to 1,128 (+59%). `npm run check` stays under 70 s, so it stays a cheap per-commit gate.
- Not run: the host self-tests (#4) and every stack suite. The brief forbids Docker, and some self-tests drive the `docker` binary unless QA puts a stub first on `PATH` (HQA:390-395).

## 4. LA test strategy inputs

### 4a. Conformance kit shape

Goal: one shared contract suite per port. Every channel adapter must pass it on the simulator. A new channel adds data and a simulator module, not tests.

**Ports to cover.** These come from the current code. E1 can rename them.

| Port | Current seam | Kit cases (per channel) |
| --- | --- | --- |
| K-PROFILE: trust profile | `ProviderProfile` (`services/lti-service/src/profiles/types.ts:24-51`) | Fixed hosts, template fill, site rules 1–6, flags, the reserved issuer, `simulation` gate (as in `services/lti-service/src/profiles/registry.test.ts:4-46`) |
| K-ADAPTER: app adapter | `ProviderAdapter` (`services/cogniate-app/src/providers/types.ts:136-160`) | Tool configuration rows, strict platform body (accept and refuse table), binding target, staged create, labels; adapters stay pure (no DB, no LTI call; `types.ts:1-4`) |
| K-CAP: capability guards | `Capabilities` (`types.ts:19-26`); guard table ADR-011 §11 (`docs/architecture/adr/ADR-011-multi-lms.md:323-334`) | For each capability set to false, the exact refusal (`409`/`422 CAPABILITY_NOT_SUPPORTED`) and no outbound call |
| K-LAUNCH: OIDC and launch | `tests/sim/core/provider.mjs:59-74` | One valid launch; the 12 faults of §2.2; family check; claim minimisation where the flag is set |
| K-DL: Deep Linking | `provider.mjs:164-187` | Return JWT shape, data mode, `sub` rule, replay refusal; later multi-item and ungraded (D-11) |
| K-AGS: grades | `provider.mjs:76-162` | Token assertion `aud` shape, scopes, line item, score, the mapping of scripted 400/422/5xx answers |
| K-NRPS | `provider.mjs:110-115` | Only if D-8 keeps NRPS |
| K-REG: registration | manual today; DR on Moodle only | Manual setup for each channel; DR when the manifest declares it |
| K-UI: portal manifest | M2 cards and wizards (`tests/e2e/M2/01-cards.m2.ts`, `02-canvas-wizard.m2.ts`) | Optional: the card and wizard steps render from the manifest |

**Levels.**

| Level | Runs in | Stack | Content |
| --- | --- | --- | --- |
| K0 | `npm run check` (Vitest) | No Docker | K-PROFILE, K-ADAPTER, K-CAP as `describe.each(<every registered channel>)`; manifest schema; the §4b fitness checks |
| K1 | QA SIM lane | 1 `acceptance` stack | K-LAUNCH, K-DL, K-AGS, K-NRPS, K-REG per channel, driven from the channel manifest and the simulator module config |
| K2 | QA-E2E SIM lane | 1 `acceptance` stack and Chromium | K-UI plus one SIM DL and score flow per channel (like M2-12, `docs/architecture/tasks/M2.md:122`) |

**Channel inputs.** Each channel gives exactly 3 things: (1) its channel manifest (capabilities and quirk flags); (2) a simulator module with the same config shape as `tests/sim/blackboard/index.mjs:5-21`; (3) a small expected-values fixture (tool configuration rows, labels). The kit reads all three. It contains no channel name.

**Pass rule (proposal).** A channel is conformant at level K1 when all three of these are true:

- Every applicable case of every port passes once on a fresh lane, with `retries: 0`.
- Every non-applicable case comes from a manifest capability that is false. That capability's guard case passes. Nothing skips silently.
- The secret scan of the records and logs finds 0 hits. This is the existing `/__sim/secrets` pattern (`tests/sim/core/runtime.mjs:83-86`).

**Why this saves work.** Today each LMS has its own copy of the same areas, for example protocol (`blackboard/20-protocol.test.ts` 152 lines, `canvas/21-canvas-protocol.test.ts` 276 lines) and grants (192 and 497 lines). These two LMSs already have 374 manifest rows (`tests/acceptance/M1/{canvas,blackboard}/manifest.json`, 233 + 141). A shared suite keeps these rows for the old channels and adds a new channel at almost no test cost (inferred).

### 4b. CI fitness checks

There is no CI service (§1.3). So add both checks to `npm run check`. They then run on every Author lane and at every gate in under a second (inferred).

**Check 1: "No LMS name in core."**

| Item | Proposal |
| --- | --- |
| Scope | One data file (owned by A1) lists the core globs and the adapter roots, for example `services/*/src/channels/<id>/**`, `apps/portal/src/channels/<id>/**`, `tests/sim/<id>/**`. Everything else under `services/`, `packages/` and `apps/` is core. |
| Banned words | All registered channel ids and display names, taken from the channel registry, plus a fixed list of known LMS names. A new channel then bans its own name in core with no extra edit. |
| Mechanism | ESLint `no-restricted-syntax` on `Identifier`, `Literal` and `TemplateElement` nodes, applied to the core globs only (code tokens, not comments). Add a small scan for non-TS core files (CSS, HTML, JSON). |
| False positives | Comments: warn, do not fail. `canvas` is also an HTML element and a Web API name. Today the only `<Canvas…>` matches are portal components (`apps/portal/src/connect/canvas/CanvasWizard.tsx:24-28`), but use an explicit exception list for such names (inferred). |
| Ratchet | A checked-in baseline with a count per file that can only go down. E1 is done when the core count is 0. |
| Baseline today | `git ls-files` gives 202 non-test product source files. 110 contain `moodle\|canvas\|blackboard` (case-insensitive, comments included), and 85 have it on a non-comment line. Hits: moodle 442, canvas 333, blackboard 252. Plan v0 says 28 files outside the adapters (`docs/team/ltiaas/plan.md:18`). The gap is the scope question: Moodle-only features (T8 `.mbz`, Moodle web services, Dynamic Registration) must move into the Moodle channel or be named generically. R3 owns the exact audit. |

**Check 2: "A new LTI LMS changes 0 core files."**

| Item | Proposal |
| --- | --- |
| Branch-diff gate | `git diff --name-only $(git merge-base <base> HEAD)...HEAD` filtered by the core globs. It must be empty for a change of the kind "add channel". Run it on the E2 branch against the E1-done SHA. That diff is the real proof of plan measure 1 (`docs/team/ltiaas/plan.md:49`). |
| Continuous canary | A test-only canary channel (a manifest, a sim module and a fixture under a test path) that K0 discovers and passes. If K0 needs a core edit to see the canary, the build fails. This proves the property on every commit, not only once at E2 (inferred). |
| Infra and simulator | Today the simulator needs edits in `tests/sim/server.mjs`, `infra/compose.yaml` and `infra/scripts/lib.sh` (§2.3). Count these as "shared infra". E7 must make them come from one simulator host manifest, else measure 1 fails for every new LMS. |
| Tests | Closed-list assertions are the test version of the same problem (§4c). Keep them out of the kit. |

### 4c. Minimum "no behaviour change" regression for E1

**First, a conflict.** Plan measure 3 says: "M1, M2 and T7 pass with no change to their assertions after the refactor" (`docs/team/ltiaas/plan.md:51`). But M1 and M2 assert closed lists and LMS-named keys:

| Assertion | Evidence | Breaks when |
| --- | --- | --- |
| The exact list and order of all profiles | `tests/acceptance/M1/common/00-profiles.test.ts:3, 40-45` | E2 adds a profile |
| `simulation_profiles` equals `['blackboard-sim','canvas-sim-cloud']` | `00-profiles.test.ts:49`; `tests/e2e/host/run-m2.mjs:124` | E2 adds a simulation profile |
| "six real profiles" | `tests/host/run-m1.mjs:296, 301` | E2 adds a real profile |
| The exact capability object with 6 named keys | `00-profiles.test.ts:110-111, 135-136` | E1 makes capabilities generic |
| `details.capability === 'webServices'` / `'courseShell'` | `tests/acceptance/M1/canvas/31-canvas-grants.test.ts:300, 307` | E1 renames capabilities |
| "three LMS cards" | `tests/e2e/M2/01-cards.m2.ts:1, 11-15` | E2 adds a card |

So the plan must choose, before G-DESIGN, one of two options:

- **Option A:** E1 keeps every public wire value (API JSON, error details, health) the same, and E2 changes only additive lists.
- **Option B:** QA rewrites the closed-list assertions to "baseline set ⊆ actual, and the extras obey the manifest rule", once, before E1 starts. QA proves the rewrite on the G-BASE SHA, and both reviewers review the list of changed assertions.

Option B is cheaper and keeps the evidence honest (inferred).

**Golden outputs (cheap, strong).** At the G-BASE SHA, record the JSON of `GET /api/providers`, `GET /app-api/lms-providers`, the tool-configuration rows for each LMS, `/healthz`, and the simulator records (claims, token `aud`, DL items) for each M1 scenario. After each E1 task, compare them field by field. Most of this can be a K0 snapshot test with no Docker (inferred).

**Regression tiers for E1.**

| Tier | When | Content | Stack | Time |
| --- | --- | --- | --- | --- |
| R0 | Every commit, every lane | `npm run check` with K0 and the fitness checks; sim self-tests; QA typecheck | No Docker | about 1.5 min (69 s + 0.4 s + 2 s measured, plus est. < 30 s for K0) |
| R1 | Each E1 task before QA PASS | M1 `--phase sim --provider all` (394 rows), then M2 (64 cases) | 1 `acceptance` lane | about 30 min: stack up and seed about 1 min (M1Q:566), `sim` about 22 min (M1Q:374, M1Q:890), M2 about 5 min (M2Q:626-714) |
| R2 | End of E1, and the final SHA | T7 (3 runs and the demo); legacy T2a/T2b/T3a/T3b, T3c, T4b, T5a/T5b/T6, T8. T8 is in because E1 will probably move the Moodle-only `webServices` and `courseShell` capabilities (inferred). | 1 `default` lane with Moodle | about 1.5–2.5 h: T7 about 11 min (T7Q:288-336); T4b about 5 min; T5 group about 19 min; the rest not measured (est. 60–120 min for all legacy, M1P:381-384) |
| Not for E1 | Only if E1 or E5 changes the database schema or the storage scripts | M1 `snapshot-isolated` (6), `snapshot-upgrade` (6), `migration` (12), `storage` (70) | Storage lane | Est. 45–60 min per round (P:77) |

Rule for the plan: make "E1 changes no schema and no storage command" a design constraint. Then the 94 snapshot, migration and storage rows stay out of the E1 regression set. They come back at the milestone end only if E4 or E5 touches storage. As a result, the E1 regression costs about 2–3 h on 2 lanes, against the 6–10 h estimate for the multi-LMS full gate (P:98).

### 4d. Parallel lanes and machine limits

**Machine.** The host is macOS 27 arm64 with 12 CPUs and 32 GiB RAM. The Docker VM has 12 CPUs and **7.75 GiB** (8,319,238,144 bytes) (PRE:22-23; M2Q:631). One idle QA stack used about 683 MiB across its five containers (P:1997). `stack:doctor` asks for 6 GB of Docker memory or more (`docs/architecture/local-stack.md:120`). The old rule was "Run at most two stacks at once" (P:3585).

**Isolation that works today.** Each stack has its own `COMPOSE_PROJECT_NAME`, `PUBLIC_PORT` and `STACK_SUBNET` (`infra/scripts/lib.sh:16, 34-37`). Volume and image names use the project name (`infra/compose.yaml:5, 443`). All other state is inside the checkout: `.env`, `infra/.certs`, `.secrets`, `.logs`, `.data` and `.tmp` (`infra/compose.yaml:6`). So **one lane = one clone or worktree, plus one project, port and subnet**. The host runners already clone for this reason (`tests/host/core.mjs:226-245`).

**What blocked parallel lanes before.** M2's preservation check compared all other Docker resources over the whole run. Another lane's teardown would break that comparison. So the Lead allowed one stack window at a time (P:2002-2004). The boundary checks also failed on foreign containers and volumes (P:1077-1079). LA must scope all preservation checks to resources that carry the lane's own project label. Then parallel lanes become possible.

**What can run in parallel.**

| Work | Docker | Parallel? |
| --- | --- | --- |
| R0, K0, fitness checks, sim self-tests, QA typecheck, M1 `--harness-only`, M2 `--harness-only` | No | Yes, any number of lanes |
| M1 `sim` phase and K1 kit (acceptance profile) | 1 stack | 1 lane |
| M2 and K2 (acceptance, Chromium) | 1 stack | Same SIM lane, after K1 (in sequence) |
| T7 and legacy (default profile, Moodle) | 1 stack | 1 lane, in parallel with the SIM lane |
| Storage and migration phases | 1 stack with the storage profile | Alone; it uses resets, lock waits and about 30 starts (M1Q:784) |
| Local Canvas (live row L-C13) | Canvas alone needs at least 8 GB | Not on this machine with other stacks (M3L:72-80; PRE:127) |

**Proposed LA lanes.** These are a proposal. `stack:doctor` must confirm that the port and subnet are free before each run (`docs/architecture/local-stack.md:120`). They keep away from the old lanes (P:3578-3583) and the default `172.28.0.0/16`, while the Blackboard and Canvas run may still use Docker. They stay inside RFC 1918 172.16.0.0/12 ([RFC 1918](https://www.rfc-editor.org/rfc/rfc1918)).

| Lane | Project prefix | Port | Subnet |
| --- | --- | --- | --- |
| LA QA SIM (K1, M1 sim, M2) | `qa-la-sim-r` | 9443 | `172.20.0.0/16` |
| LA QA Moodle (T7, legacy) | `qa-la-moodle-r` | 9543 | `172.21.0.0/16` |
| LA QA storage (only if needed) | `qa-la-st-r` | 9643 | `172.22.0.0/16` |
| LA Author smoke (booked slot) | `la-author-<lane>` | 9743 | `172.23.0.0/16` |

**Limit.** Run at most 2 stacks at once. Keep about 2.5–3 GiB for each active test stack: the five base containers, the acceptance helpers and Chromium with `shm_size: 1gb` (`infra/compose.yaml:450`) (inferred; only the 683 MiB idle figure is measured). This conflicts with charter-LA §3, which gives every Author lane its own local stack (`docs/team/ltiaas/charter-LA.md:60`). Proposal: Authors work in R0/K0 by default and book a Docker slot on the board. QA keeps the two stack slots during P5.

## 5. Lessons from the Blackboard and Canvas phase

| # | Fact | Evidence | LA should |
| --- | --- | --- | --- |
| L1 | No full M1 round completed in 9 attempts. Most stops came from QA oracle or harness defects, not product defects. | M1Q:199-201, M1Q:397-419, M1Q:921-931, M1Q:1842-1852; P:97 | Prove each harness part on the no-Docker path before a stack window. Do not discover harness defects one at a time in full runs. |
| L2 | A run stops at the first failed phase, and the `sim` phase comes first. So each attempt paid about 22 min before it reached the next unknown defect, and the attempts started about 1 h apart. | M1Q:1791; `tests/host/run-m1.mjs:143-145`; M1Q:374, M1Q:890, M1Q:1035-1776 | Let a short targeted phase or `QA_GREP` run prove a repair first. Run the full gate once, at the end. |
| L3 | The storage harness grew larger than the tests it served: 22 files and 8,076 lines (4,135 runtime, 3,941 self-tests) against 5,221 lines of M1 acceptance `.ts`. `storage-rows.mjs` has 1,655 lines and its self-test has 1,813. | `wc -l tests/host/storage-*.mjs`; `wc -l tests/acceptance/M1/*/*.ts` | Follow charter-LA §5: "Do not build test harnesses for test harnesses unless an acceptance criterion needs it" (`docs/team/ltiaas/charter-LA.md:78`). |
| L4 | Harness-of-harness work: the self-tests grew from 48 to 105 to 142 and ran about 9 min per umask. The mutation campaigns had 135 and then 70 mutants. A neutrality comparator reached v4. The mock lane "is QA's model of the product". | HQA:24-25, HQA:357, HQA:398-405, HQA:561-572; P:77 | Use mutation and neutrality campaigns only when a criterion needs them. |
| L5 | Records grew large too: 33 of the 43 M1 review files have a storage, backup, reset, content or host-control name (7,677 lines). The other 10 have 4,665 lines. Lead evidence manifests had 3,367–15,517 entries. | `ls docs/reviews/M1`; P:188, P:261, P:342, P:519, P:42 | Use one focused test per criterion and one short qa.md per task. MINOR and NIT findings go to `deferred.md` (`docs/team/ltiaas/charter-LA.md:76-80`). |
| L6 | Umask and file-mode rules caused failures and reruns: a blanket umask 077 broke a fixture; private copies at 0644 led to the P-3 rule; QA hygiene generation 1 had 2,091 entries that were too broad. | P:1236-1238, P:661, P:724-727; SCQ:402-406 | Fix one evidence-mode rule in the QA strategy at the start. Keep raw secrets out of evidence by design (redaction at capture), not by later scans. |
| L7 | The Docker environment drifted during the phase: a host reboot, engine 29.8.2 → 29.9.1, idle-VM cache answers with a clock 36 min behind, new default bridges, foreign `fgw-*` containers, WAL locks that failed on the bind mount. | M3Q:320-348; P:2523-2530, P:2625-2629; M1Q:616-667, M1Q:1057; P:1077-1079 | Pin and record the engine at G-BASE. Wake the VM before each window (the W1 step). Compare only own-label resources. |
| L8 | Serial windows: one QA worker at a time owned Docker. M2 and T7 had to wait for common QA, so M3 e2e rounds 6–10 ran nothing. | P:2002-2004; M3E:119-152 | Use the 2-lane plan in §4d with own-label checks. |
| L9 | Each repair needed a Lead commit, a new frozen SHA, two source reviews and a new window. One "sole remediation session" owned every fix. | M1Q:1009, M1Q:1958; P:49, P:57 | Keep this rigor for the final gate only. Within a task, run QA on the Author lane SHA, up to 3 rounds (`docs/team/ltiaas/charter-LA.md:79`). |
| L10 | Estimates were far off in both directions: M2 was estimated at 45–75 min and took about 4.6 min. The Canvas rows were estimated at "60–100 min more". The full gate stayed "6–10 h" with no measured complete round. | M2P:72; M2Q:626-714; M1C:104; P:97-98 | Plan from the measured values in §1.2 and §4c. |
| L11 | Real races in harness code (one-shot reads in `portal.ts`, Tab before render) gave cascades of failures; the fix was 3 lines. The rule "no sleep, retry or skip" held. | T7Q:234-241, T7Q:273; M2Q:436-465 | Keep `retries: 0`. Share one tested page helper library between M2, T7 and K2. |
| L12 | An external observer tool printed container env secrets into its own log. | M2Q:720-724 | Allow no ad hoc observer tools. Use the runners' own redacted capture only. |
| L13 | The owner asked for speed: batch the edits before a full suite, overlap the reviews with QA, and defer optional refinements. The gates did not change. | P:95-96 | Put this in the LA plan from the start. |

## 6. Recommendations for the LA plan

1. **E0.** Record the regression baseline at the accepted G-BASE SHA. It contains: `npm run check` (expect 1,123 + 5 skip unit and 111 infra here), the 394 M1 `sim` rows, M2 64/64 and T7 3 × 17. Also record the golden outputs of §4c and the Docker engine and VM size. No stack suite has run at HEAD yet (§1.3).
2. **E0.** Decide the conflict in §4c before G-DESIGN. Preferred: QA rewrites the 6 closed-list assertions to an open-world form once, proves the rewrite on the G-BASE SHA, and both reviewers review the list. Then plan measure 3 reads "no change except this reviewed list".
3. **E1.** Make "no schema change, no storage-command change" an E1 design constraint. Then the E1 regression set is R0 + R1 + R2 of §4c (about 2–3 h on 2 lanes), without the 94 snapshot, migration and storage rows.
4. **E1, E7.** Add both fitness checks of §4b to `npm run check`. Use ESLint `no-restricted-syntax` on code tokens in the core globs, a banned-word list from the channel registry, and a per-file ratchet from today's baseline (110 files, 85 non-comment). Add the branch-diff gate for "add channel" changes.
5. **E7.** Build the conformance kit as K0 (Vitest, no Docker, every registered channel), K1 (simulator protocol per port) and K2 (optional browser). Use the manifest-driven pass rule of §4a: N/A must come from a false capability whose guard passes; nothing skips.
6. **E7.** Make the simulator data-driven: modules found from a list or folder scan. One host manifest generates the compose aliases, `SIM_LTI_HOSTS` and the certificate SANs. Simulation profiles come from data, not from a core file. Then a new simulator LMS is rows 1, 2 and 6 of §2.3 only (about 0.5 day, inferred), and plan measure 5 becomes testable.
7. **E7, E3.** Move the product-specific DL checks (`tests/sim/core/provider.mjs:178-181`) into scenario data. Add multi-item and ungraded DL (D-11), NRPS members (D-8 if kept) and, in the Should scope, Dynamic Registration (D-1) and key rotation (E5). Estimates are in §2.4.
8. **E2.** Add a "generic LTI 1.3" simulator provider that uses the `standard` profile path. Today `standard` is tested only on real Moodle and `qa-platform.test`. Prove the new named LMS (LA-H6) with the branch-diff gate against the E1-done SHA.
9. **E0, E7 (process).** Use 2 Docker lanes at most (SIM and Moodle; §4d table) with own-label preservation checks only. Change the charter-LA §3 text "each Author lane has its own local stack" to "Docker by booked slot". Authors work in R0/K0 by default.
10. **E7 (QA process).** Prove each harness part on the no-Docker path before a stack window. Use targeted phases or `QA_GREP` for repairs, and run one full gate at the end (L1, L2). Build no mutation, neutrality or mock-lane campaign unless an AC needs it (L3, L4).
11. **E8.** Write the "Add a new LTI channel" guide from the §2.3 change list after E7. Measure it once with a person or agent new to the repo (plan measure 5), and record the time.
12. **E5 / LG.** Storage changes (Postgres or ADR-012 paths) bring back the 70-row storage phase and the migration phase. If LA-H5 puts Postgres in LG, keep E5 off storage, so that LA does not pay for the storage harness again (L3, L4).
13. **LB–LF.** Make the kit structure work for other port families from the start. Each future port (catalog pull, xAPI out, SSO launch, package export, vendor connectors) gets the same shape: a K0 contract per port, a simulator or fake per vendor, and a manifest-driven pass rule. LA builds only the LTI ports.
