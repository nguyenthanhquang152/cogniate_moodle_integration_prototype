# LA tasks: spec rules, QA rules and test knobs

Status: v1.2 (A1, task LA-B1c, 2026-10-22; v1.1 = task LA-B1b, G-BREAKDOWN fix round 1; v1 = task LA-B1). Response: [review-response-B1-A1](review-response-B1-A1.md). Design SHA: `54e8088` (G-DESIGN PASS) plus the P3 consistency edits listed in [review-response-R3-A1](../review-response-R3-A1.md). Task list, DAG, waves, ownership matrix and Docker needs: [epics.md](../epics.md). Base rules: [`../../tasks/README.md`](../../tasks/README.md) (M1 state). This file adds the LA rules. Where the two files differ for an LA task, this file wins.

## 1. Task specs

| Item | Rule |
| --- | --- |
| File | One file per task: `LA-<epic>-<nn>.md`. A1 writes E0, E1, E2, E4, E7, E8; A2 writes E3, E5, E6 ([A2-lanes](A2-lanes.md)). |
| Header | Owner lane (K, P, S1, S2, L, L2, R, QA, QA-E2E, Docs; S1 and S2 by Lead decision LD-10, L2 by LD-11), Wave (B1–B4; the wave is the ownership window of the task's files, plan LD-15), Depends on, Design links, Size (S = 1 day, M = 2–3 days, L = 4–5 days), Docker (none, SIM, MOODLE). |
| Files | "May edit" and "Must not edit" must equal the [ownership matrix](../epics.md#5-file-ownership-matrix). A file that is not in "May edit" needs a request to its owner (§4). |
| AC id | `AC-LA-<epic>-<nn>-<mm>`. A number is never reused. A removed AC keeps its number with the text "removed". |
| Evidence label | `UNIT` (Author unit test, no Docker; Reviewer-B checks it), `K0` (QA, no Docker: the K0 contract suite and the static fitness probes, label `STATIC` in TEST-STRATEGY), `K1-SIM` (QA or QA-E2E on the SIM lane: K1, task acceptance, K2, golden capture, U1), `K2` (QA-E2E browser case U1–U5 on the SIM lane with Chromium; README F7.7 makes U1–U4 Must), `MOODLE-LIVE` (the local Moodle 5.2 on the Moodle lane), `DOC` (QA reads a document, a git record or a commit message and checks the stated content; QA Q-LAB-17), `LIVE` (a real LMS site; never Must, LA-H3). A reviewer approval is never an AC: it is the "Done rule" of the spec. |
| Regression | Each task names its tier (R0, R1, R2-lite, R2) and its area groups from TEST-STRATEGY §4.4. A task that adds a migration names U1 (TEST-STRATEGY §4.5). |
| Intended changes | A task that ships an `LA-IC-nn` names it. QA makes the reviewed test-change list at that task (plan LD-9). |
| Start rule (LD-15) | A task starts when every task in its "Depends on" is done (QA PASS and both reviews) and the ownership matrix gives its files to its lane at that time. Waves are ownership windows and regression points (M1, M2 and T7 at each wave end), not start barriers. The Lead keeps the start list in the board. |
| Done rule per AC (QA Q-LAB-16) | QA records PASS per AC. An AC whose entry point or precondition lands in a later task is "pending: <task id>" in qa.md; it does not block the wave exit, and QA closes it when that task lands. A task is done when every AC is PASS or pending, and no pending AC belongs to a task of an earlier wave. |

## 2. QA rules for LA

The rules of the base [§2](../../tasks/README.md#2-qa-rules) apply. QA works from the task specs, contracts and design interfaces, and reads no Author notes or product code before it writes the tests (charter-LA §1).

**QA authors and folders (plan LD-13, LD-17; QA Q-LAB-10).** Four QA test authors and QA-E2E work under the same independence rules (never Authors, Architects or Reviewers). Each owns a disjoint folder, and each test author writes **and runs** its own task suites: K0 with no Docker, K1-SIM on the simulator slot by booking (LD-2).

| Author | Writes the test-first acceptance tests for | Owns |
| --- | --- | --- |
| QA (lead QA) | E0, the kit, the fitness probes, A2's LA-E5-13, LA-E8-02; runs the per-step R1 runs and the migration phases with U1, and the wave-end regressions (M1, M2, T7, with QA-E2E on the Moodle lane); keeps the Moodle slot and the slot schedule; writes `docs/reviews/LA-*/qa.md` from the suite reports | `tests/ltiaas/{baseline,golden,k0,canary,kit,fitness,gates}/**`, `tests/ltiaas/lib/**` (shared helpers), `tests/ltiaas/tsconfig.json`, `tests/ltiaas/*.config.mts`, `tests/ltiaas/tasks-qa/<task id>/**` (its own task ACs, for example LA-E5-13), `docs/reviews/LA-*/qa.md` |
| QA-2 | the K1-SIM and K0 ACs of lanes S1 and S2 (writes and runs) | `tests/ltiaas/tasks-ops/<task id>/**` |
| QA-3 | the K1-SIM and K0 ACs of lanes K, R and P (writes and runs) | `tests/ltiaas/tasks-core/<task id>/**` |
| QA-4 | the K1-SIM and K0 ACs of lanes L and L2 (writes and runs) | `tests/ltiaas/tasks-lti/<task id>/**` |
| QA-E2E | K2, MOODLE-LIVE checks, the simulator | `tests/e2e/ltiaas/**`, `tests/sim/**` (the parts its brief names) |

QA-2, QA-3 and QA-4 import the shared helpers of `tests/ltiaas/lib/` and `kit/lib/`; they never copy them (TEST-STRATEGY L11). A change in a shared helper goes to QA by request. Each runs its task suites on the booked simulator slot and gives QA a suite report (task SHA, one row per AC with PASS, FAIL or pending, test id, command, artifact path, run time); QA writes the qa.md rows from it. Which suite runs where: task K0 and K1-SIM ACs, by the lane's test author; R1, migration phases, U1 and wave-end regressions, by QA; K2 and MOODLE-LIVE checks, by QA-E2E.

**Lanes and stacks.** Each QA test author uses only its own clone and compose projects of TEST-STRATEGY §5.2: QA `qa-la-sim-r…`, `qa-la-moodle-r…`, `qa-la-st-r…`; QA-2 `qa2-la-sim-r…`; QA-3 `qa3-la-sim-r…`; QA-4 `qa4-la-sim-r…`; QA-E2E runs in the QA SIM and QA Moodle lanes (`qa-la-sim-r…`, `qa-la-moodle-r…`), because §5.2 gives it no prefix of its own (QA Q-LAB-21). At most two stacks run at the same time, by a slot that the Lead books (plan LD-2). Every runner checks and cleans only resources with its own project label (TEST-STRATEGY §5.4).

**Allowed commands (LA additions; design README OC-7; QA Q-LAB-01).** Each form has a letter that specs cite (for example "QA form (d)"). Each one runs only on the author's own compose project (TEST-STRATEGY §5.2), and only in the AC that names it. Forms (a)–(c) are OC-7; (d)–(g) come from QA Q-LAB-01, Reviewer-B B-LAB-03 and A2's fix round LA-B2b:

| Form | Command form | Used by | Restore |
| --- | --- | --- | --- |
| (a) | Write `infra/.secrets/lti/keyring.json` in QA's own clone (umask 077, then mode `0600`), then `npm run stack:restart -- lti-service` | A2 AP-06-24 (key ring re-wrap) | put back the original key ring file, restart, and check `GET /healthz` |
| (b) | `docker compose exec -e STACK_PROFILE=production -e OPERATORS=<name> cogniate-app npm run app:grant -- …` | A2 AP-07-04, AP-07-09 (operator name rules of the production profile) | none: the `-e` values live only for that one command |
| (c) | `docker compose exec lti-service npm run lti:operator -- init …` | A2 AP-06-13 (first operator key) | the test uses a fresh stack, or revokes the key that it made |
| (d) | `npm run lti:bootstrap -w services/lti-service -- --account <id> --name <n> [--rotate-api-key] [--rotate-signing-key]` in QA's own clone (QA Q-LAB-01) | A2 LA-E5-05 | the test uses a fresh account id; a rotated key stays valid for that account only |
| (e) | Rename or remove `infra/.secrets/lti-operator-key` in QA's own clone for one CLI run (first a backup copy, made with umask 077), then put it back (QA Q-LAB-01) | A2 LA-E5-05 AC-07 | rename back in `finally` or a shell `trap`, then check one operator call |
| (f) | `docker compose run --rm -e STACK_PROFILE=production [-e <knob>=<value>] lti-service npm start`, expecting exit 1 and `config_refused` (QA Q-LAB-01; A2 LA-B2b) | A2 LA-E5-21 | none: the one-off container ends; the running stack is not touched |
| (g) | The restore drill on a **fresh QA drill project** (own clone and `COMPOSE_PROJECT_NAME`): `stack:down`; `stack:data-backup -- --out <folder outside the checkout>`; `stack:up`; one marker change through the operator API (`POST /operator/v1/accounts` with id `drill-<runId>`, form (h)); `stack:down`; `stack:data-restore -- --from <folder>` into the same project; `stack:up`; at the end the drill project and the backup folder are removed (the folder holds secrets; Reviewer-A A-LAB-22). Never `stack:reset`: it also deletes `infra/.secrets` and `infra/.data/backups/` (`infra/scripts/stack-reset.sh:2-4`; ADR-011 §14). Never another project: the restore refuses it (`project_mismatch`). (Reviewer-B B-LAB-10; A2 LA-B2b; plan LD-14) | A2 LA-E5-24 (Should) | none needed: the fresh drill project and the backup folder are removed at the end |
| (h) | Operator API calls over HTTP from the `e2e` container to the LTI operator listener (`http://lti-service:4110`; the `acceptance` profile binds it on the stack network, A2 LA-ADR-06 D3) and to the app operator listener (`http://cogniate-app:4210`, app delta §8a) (QA Q-LAB-12) | E5 acceptance, LA-E4-07 | a test that changes a setting (for example `PATCH /operator/v1/rate-limits`) restores the old value in its clean-up |
| (i) | `docker compose exec cogniate-app npm run app:audit -- list …` (read-only) | A2 LA-E5-11 | none |
| (j) | The T5b P5 fixture deletes the failed row in `record_dispatch` instead of `score_sync`, with the same exact-id rule and the same assertions (plan LD-6, LA-IC-09). Both reviewers review the fixture diff. | LA-E4-02 regression | as base §2 |
| (k) | Scratch probe files in QA's own clone, never committed and removed in the clean-up: a folder `packages/channels/zz-*/` (a scratch channel) and a rule file in `infra/scripts/fitness/rules/` (QA Q-LAB-12) | LA-E1-03 AC-01, -02, -05; LA-E1-04 AC-04, -10; LA-E1-12 AC-05; LA-E7-01 AC-02 | delete the scratch files; `git status` in the clone is clean |
| (l) | `npm run stack:restart -- cogniate-app` and `npm run stack:restart -- lti-service` (no `--env`) for the LA ACs that name a restart (QA Q-LAB-12) | LA-E4-03 AC-05 and the ACs that cite this form | the restart itself restores the default state |

First-draft ids: `AL-1`, `AL-2`, `AL-3`, `AL-4`, `AL-5`, `AL-6` are forms (a), (b), (c), (h), (i), (j).

Not allowed: the same commands on another project; reading or changing an SQLite file, except through form (j) and the M1 sequences of the base table; a test that imports product code (K0 imports only the public kernel entry points, §3).

**Frozen assertions.** Only two kinds of change are allowed in M1, M2, T7 and the legacy suites: the E0 open-world rewrite (plan LD-1, [LA-E0-04](LA-E0-04.md)), and the reviewed test-change list of an `LA-IC-nn` at the task that ships it (plan LD-9). Any other change needs the Lead, with the test id and the reason (TEST-STRATEGY §4.3).

**Capabilities that are not built yet** (TEST-STRATEGY §9.2 item 11; the breakdown confirms it). A guarded capability whose route only a Should or Could task builds (`content.ungraded`, `setup.connectionCheck`) is `notBuilt` in the kit fixture, with the design reference, until that task lands. The kit leaves its K1-CAP C2 case out of the expected case list. K0 still checks its value on every channel. The task that builds the route removes `notBuilt` and adds the C2 case.

**One client address.** QA sends every browser and HTTP call from the one `e2e` container address. So an AC never needs "another address"; it uses "the same address after `Retry-After`" (TEST-STRATEGY §9.2 item 14).

**Test-first.** QA writes acceptance tests from the task spec while the Author builds. A test may run red until the task lands. A K0 case may run only after the task that creates its entry point lands ([LA-E1-02](LA-E1-02.md) for the registry, [LA-E1-07](LA-E1-07.md) for `kernel/ports.ts`).

**Determinism.** The base rules apply: `retries: 0`, `workers: 1`, unique names per run, fresh activity per AC, poll with the deadline of the AC. A flake is a finding, never a PASS (TEST-STRATEGY §2.6).

**Network negatives.** Three oracles together: the error code, zero hits on the `evil.test` sink, and no `outbound_request` or `outbound_blocked` event for that host. For a token or score call, the simulator records (`/__sim/records`) also show zero requests.

## 3. Public surfaces that QA may use

| Surface | From task | Rule |
| --- | --- | --- |
| `@cogniate/channel-kernel`: manifest schema, capability catalog, legacy projection, `loadChannelFolders`, `buildChannelRegistry`, `ChannelRegistry`, `RegistryError` | [LA-E1-02](LA-E1-02.md) | K0 imports only these (LA-ADR-01 D4) |
| The LTI profile registry API of `services/lti-service/src/profiles/index.ts`: `listProfiles`, `findProfile`, `profileDefinition` (one of the three registry loaders; LA-ADR-01 D6; TEST-STRATEGY §1.2) | [LA-E1-05](LA-E1-05.md) | K0 reads profile traits through it (QA Q-LAB-11); no other LTI service module |
| `services/cogniate-app/src/kernel/ports.ts` | [LA-E1-07](LA-E1-07.md) | types only; no logic in the file (LA-ADR-01 D5) |
| `npm run fitness:lms-names -- --stdin --as <path>` and the F5 rule runner in the same mode | [LA-E1-04](LA-E1-04.md) | check-one-text mode for QA probes (TEST-STRATEGY §3.5) |
| `npm run fitness:channel-diff -- --base <sha> --channel <id> [--paths-from <file>]` | [LA-E1-04](LA-E1-04.md) | F2 report and gate |
| A second loader root for the canary | [LA-E1-02](LA-E1-02.md) | a function argument only; product code passes one root |

## 4. Shared files: request rules

The ownership matrix gives each product path exactly one lane per wave ([epics.md §5](../epics.md#5-file-ownership-matrix)).

| Rule | Text |
| --- | --- |
| RQ-1 (change request) | A lane that needs a change in a file of another lane sends the exact change (file, lines, reason, own task id) to the owner through the Lead. The owner lands it as its own commit that names the requester's task id. The requester's QA round starts after that commit. |
| RQ-2 (one-commit handover) | When the owner lane has no open task on that file in the wave, the Lead may give the file to the requester for one named commit. The Lead records it in the board row of the requester's task. |
| RQ-3 (F1 baseline) | `infra/scripts/fitness/f1-baseline.json` has one count per file. Any lane may **lower** the count of a file that it owns in that wave, in the commit that removes the hits. No lane raises a count. The owner in the matrix keeps the file format. |
| RQ-4 (new modules) | A lane that needs new behaviour inside a hot file delivers it as a new module that it owns, and asks the owner for the call line (RQ-1). |
| RQ-5 (migrations) | A task that adds a migration names it by content (for example "app migration: `placement`, …"). The Lead gives the number at landing, in landing order (data-model §1). Migrations of different lanes do not depend on each other. |
| RQ-6 (wave change) | At a wave end the owner lane lands or hands back every open change. A file changes owner only at a wave end. |

## 5. Test knobs

LA adds **no** test knob. The base [§3](../../tasks/README.md#3-test-knobs) knob table stays, and `/healthz` still shows `"knobs": []` in the default profile (AC-T7-13). The `production` profile refuses a start with any active knob (A2 LA-ADR-06 D12).

Tests control the new LA behaviour through these settings instead. None of them is a knob.

| Setting | Service | Default | How a test uses it | Restore |
| --- | --- | --- | --- | --- |
| Rate-limit classes (`PATCH /operator/v1/rate-limits`) | lti-service | A2 LA-ADR-06 D1 | operator API call (QA form (h)); the change applies at once (A2 LA-ADR-06 D1; QA Q-LAB-12) | the test sets the old value back |
| `APP_RATE_LIMITS` | cogniate-app | 600 per minute, burst 200 per address (app delta §5a) | read at start; only the `acceptance` compose may raise it, and only if the E0 peak record shows a frozen suite above the default ([LA-E0-02](LA-E0-02.md)) | not changed by a test |
| `JOB_INSTANCE_ID`, `APP_JOB_RUNNER` | cogniate-app, lti-service | `app-1`, `lti-1`; runner on in the web process | only Author unit tests change them (LA-ADR-03 D7); QA uses form (l) for the restart ACs | — |
| Transport gate rules (`https://lti-gate.test/__gate/*`) | lti-gate | no rule | as M3 §3.3, for the E4 fairness and hold ACs | the test clears its rules in `finally` |
| Simulator scenario options (`tests/sim/**`) | lms-sim | today's defaults | per request or per provider config ([LA-E7-05](LA-E7-05.md)) | defaults stay unchanged for M1 and M2 |

A time rule that has no black-box control (lease expiry of another instance, heartbeat age, key lead time and retention) is an Author unit test with a controlled clock (TEST-STRATEGY TD-12). QA does not import service internals to control a clock.

## 6. Evidence

One short `docs/reviews/LA-<task>/qa.md` per task and round (TEST-STRATEGY §6, L5): SHA, lane and slot, one row per AC (PASS or FAIL, test id, command, artifact path), the regression tier result, and the measured time of each new suite. Raw secrets stay in the private run folder (umask 077); shared evidence is redacted at capture. MINOR and NIT findings go to `docs/team/ltiaas/deferred.md`.
