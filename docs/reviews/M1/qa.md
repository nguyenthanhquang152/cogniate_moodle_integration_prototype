Verdict: FAIL — no complete M1 round yet: attempt 1 FAIL at `aff4882`; attempt 2 INTERRUPTED and attempt 3 FAIL at `8138097` (one required host-gate assertion failed with HTTP 500; zero suite rows ran)
Round: Claude continuation `ctx_8d5f8d3984d0`, attempt 3 default-gate failure, 2026-10-20

The latest checkpoint is at the end of this report. The completed legacy
T2/T3 run remains exact-`eb43247` evidence in the M3 report. It is not an M1
PASS. The latest 14-case preflight is also partial. Full M1 execution still
needs source-review clearance and the Lead's next stack window.

## Historical preparation checkpoint

Verdict: PREPARATION READY — common/Blackboard only; product verification NOT RUN
Round: target-snapshot preparation, 2026-10-20
Owner: retained independent common/Blackboard QA
Dispatch: `task_7f4a69ad0b33` / `ctx_365b9228372d`

The requested test preparation is complete. This is not an acceptance PASS.
The source is the applied contract revision
`ccdd9ef67cdd2be4c6af374136777fda4e081943` and approved proposal D
`78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`. No Author implementation, held
`redemption.test.ts`, Author audit note or reviewer report supplied an oracle.
Existing QA helpers, fixtures and simulator behavior were inspected for reuse.

## Prepared coverage

The extension adds 27 individually mandatory `SIM` rows:

- Blackboard 37: v2, v5, v7, v9, v11, v12, w, x1, x2, y1, y2, z1–z5.
- Blackboard 29: k1–k3.
- Blackboard 38: i3, i4.
- Common 38: h1–h5, i5.

The [acceptance plan](qa-plan.md#target-snapshot-preparation-2026-10-20)
maps these to public oracles and execution phases. Common plus Blackboard
now has 183 manifest rows: 166 API cases and 17 host rows. The h1–h5 host
probes have explicit discovery checks as well as individual result IDs.

`snapshot.ts` is the shared Canvas interface. Its pure oracle module is
independent of production validators. The no-attempt oracle requires a
connection-scoped cursor, one healthy process, and the refused request's
same-trace HTTP completion. Positive controls require exactly one committed
attempt event, including V failures. Gate counts include every received
method and path. Fresh Blackboard controls hold V and require the phase-1
event before delivery. A preflight before phase 1 cannot satisfy that control.
These observations do not replace the Author's injected transaction-rollback
tests.

Each full round requires four disjoint phases at the same candidate/test
SHAs: `sim`, `snapshot-isolated`, `snapshot-upgrade`, `migration`. Shared
platform deletion and replacement run only in the isolated phase. The
populated snapshot upgrade starts at
`9f96f7b24cd0aed702e4dc40373bdda4307aad31`, with 011 and no 012; seeds four
public fixture states; verifies a stopped backup before candidate startup;
and checks that the stopped ledger adds exactly 012. Old Canvas and Blackboard
keys are compared with new signed launches and used throughout recovery.
The original `b0b83a8` Moodle migration/rollback route is still separate and
required in both rounds. No fixture writes SQL or edits a migration ledger.

## Preparation checks

Commands run on the working QA tree, without Docker or product execution:

```sh
node tests/host/run-m1.mjs --harness-only --provider blackboard
npm --prefix tests run typecheck
node --check tests/host/run-m1.mjs
node --check tests/host/m1-migration.mjs
git diff --check -- tests docs/reviews/M1/qa-plan.md docs/reviews/M1/qa.md docs/reviews/M3/qa.md
```

The owned harness check passed: 27 self-checks; type checking; 166 API cases
discovered; 17 host rows accounted for; and both snapshot probe stages
discovered exactly. The self-checks reject hidden GETs and other methods,
an attempt after completion, a restart inside an audit window, a missing
completion control, wrong backup contents, an already-012 baseline,
missing 011, duplicate results, skipped required cases and mixed evidence.

The full preparation command was also used as a negative inventory control:

```sh
node tests/host/run-m1.mjs --harness-only --provider all
```

It exited 1 at `Required canvas race variant missing: M1-37 v1`, after the
self-checks and typecheck passed. This is the expected hold, not a product
failure. Canvas still owes 37 v1/v3/v4/v6/v8/v10/v12/aa and 38 i1/i2/i4.
The common guard requires those exact rows; it cannot report a partial suite
as full readiness. Its v12/i4 must remain distinct from Blackboard's rows.

## Execution hold

No stack, migration, legacy acceptance, root product test or provider tenant
check ran. No product PASS, database migration result or interoperability
claim is made. No commit or push was made. Product/infra files, the held
Author test, `pnpm-workspace.yaml`, Canvas-owned tests and browser files were
left untouched.

The Lead must integrate the Canvas rows, commit tests by path, freeze exact
40-character product and test SHAs, and reserve the one-stack lane before a
new execution dispatch. The full runner rejects dirty or untracked tests
under a frozen test SHA. Suggested lane: `qa-multi-r1`, port `8443`, subnet
`172.29.0.0/16`; one phase at a time within existing Docker limits. The plan
lists exact commands and resource estimates. No Docker Desktop setting
change is required.

Live 5-second schedules, CLI latency, host profile transitions, simulator
state across upgrade and maintenance backup encoding remain execution risks
until the later clean run. A missed deadline or incomplete capture is
`BLOCKED` and fails the gate. Real Canvas/Blackboard access is still unknown.
Metadata profiles and signed local simulations cannot supply live labels.


## Execution dispatch 1 — 2026-10-20

Current status: M1 acceptance has not started. The exact integrated product
and test candidate is `eb43247d02df622d5da72dafac41d919f65a91fe`. All 416 M1
rows are present: 392 API, seven browser and 17 host; common 42, Blackboard
141 and Canvas 233. The external frozen source passed 27 harness checks,
typechecking and complete API/host-probe discovery. This is preparation
evidence only.

The earlier temporary Canvas-control hold was withdrawn by the Lead with
no source change. The first authorized legacy T2/T3 group passed at this
same SHA, including TTL/reset and preservation checks; see the M3 execution
checkpoint. The Lead then serialized the next stack window to Canvas QA.
This worker is holding startup until the Lead returns the window. Both
complete M1 rounds and all four phases remain required. Canvas's 233 rows
will retain Canvas QA authorship and need that owner's separate verdict
against the later run artifacts. No M1 product PASS is implied.

## Repair checkpoint — A-M3-01 and host CLI, 2026-10-20

The Lead authorized this repair in the active execution dispatch
`task_ed3b08aa45ea` / `ctx_8d51e8033a8a`. Tests were written independently
before reading Reviewer-A Round 2. That review now supplies the reported
observation defect; acceptance values and exact-trace assertions are unchanged.
No product or infrastructure file was edited.

`watchAll(action = 'pass', faults = [])` remains compatible with existing
callers. It installs specific faults first, then catch-all rules for GET,
HEAD, POST, PUT, PATCH, DELETE and OPTIONS. The helper takes its cursor only
after installing the complete rule list. `snapshotScope` arms capture after
its opening reset. Owned snapshot and upgrade cases re-arm after later
resets; teardown resets end their observation windows.

The Blackboard fresh/restart, retry, isolated readiness, platform replacement
and cancellation windows now see unexpected writes as well as V. Common
upgrade h4 captures provider reads during both seeded and fresh Canvas adds.
The h5 Canvas conflict path captures its POST/GET pair. Local-refusal tests
keep all-method `fail_before` controls and finish their negative window before
the positive attempt. Required `grant_rejected` request traces, ordering,
zero-call checks, deadlines and remote-state controls were not weakened.

Three new harness checks execute the actual gate handler with in-memory
HTTP, TLS, filesystem and timer edges. They reproduce the narrow-rule blind
spot and reset behavior, then prove specific-fault priority, all seven method
captures, one-shot fallback, re-arming and separate fault-control windows.
They open no sockets, use no certificates and do not copy the gate algorithm.
This is infrastructure/helper evidence, not product acceptance.

The host CLI repair sets `docker compose exec --workdir /repo` for both
operator services. Compose mounts the root package there but starts each
service in `/repo/services/<service>`. The npm workspace selector, operation
arguments, timeout, whitelist and error capture stay intact. A file-control
self-check exercises both app scripts and the LTI script, preserves a
nonzero LTI result and confirms that a rejected script starts no command.
Subprocess execution is stubbed in this check; actual container smoke is
still required.

Command: `node tests/host/run-m1.mjs --harness-only --provider all`.
Result: **31 self-checks PASS, zero skips; typecheck PASS; 392 API plus 24
host/browser rows discovered**, exit 0. The complete inventory remains 416.
[Preparation log](/Users/quangnguyen/cogniate-qa-runs/m3-repair-20261020T1243Z/harness-only.log)
and [source hashes](/Users/quangnguyen/cogniate-qa-runs/m3-repair-20261020T1243Z/preparation.json)
identify uncommitted working-tree preparation, not a frozen product run.

Held QA paths for Lead commit:

- `tests/acceptance/M1/common/gate-capture.mjs`
- `tests/acceptance/M1/common/gate-capture.d.mts`
- `tests/acceptance/M1/common/gate-capture.selftest.mjs`
- `tests/acceptance/M1/common/snapshot.ts`
- `tests/acceptance/M1/common/snapshot-migration.probe.ts`
- `tests/acceptance/M1/blackboard/52-snapshot.test.ts`
- `tests/acceptance/M1/blackboard/02-snapshot-isolated.test.ts`
- `tests/host/m1-control.mjs`
- `tests/host/m1-control.selftest.mjs`
- `docs/reviews/M1/qa.md`
- `docs/reviews/M3/qa.md`

No commit, stack startup or acceptance rerun occurred during this repair.
Product fixes A-M1-03 through A-M1-06, Canvas-owned harness repairs and
review remain the other owners' work. The next frozen run must first show
real app grant issue/list and LTI shared-platform success/conflict through
this host-control route, with command, exit code and sanitized output. The
existing M1-28 and M1-06 fixtures supply these positive and negative controls;
their test-file commands retain the actual runtime identifiers. Both full
M1 rounds and all required legacy evidence remain outstanding.

## Partial runtime preflight — 2026-10-20

Verdict for this checkpoint only: **PASS, PARTIAL SIM — 14/14 selected cases**.
Overall M1 remains incomplete. This run does not count as either complete
inventory, even where it ran the same criterion.

Product and test SHA: `ae130a3501f3a2502c6a34e36319629e3dcdfb09`.
Run: `qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z`. The external source was
clean and detached at that exact SHA. The external command used the
unchanged frozen tests and host-control code. Approved wrapper SHA-256:
`c231c34f084fb010351b28da3d24ed06ad6fd6c6c80cc908c9f10bed5a1f56d8`.

```sh
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default \
node /Users/quangnguyen/cogniate-qa-runs/m3-repair-20261020T1243Z/preflight-smoke.mjs \
  --sha ae130a3501f3a2502c6a34e36319629e3dcdfb09 \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source
```

The host run began at 12:55:39.735 UTC. Its in-container command began at
12:56:23.817 UTC and took 52.286 seconds. Every selected row below passed;
there was no selected skip or retry. The 152 unselected Vitest observations
are excluded, never counted as PASS. No browser, upgrade or full-run result
was inferred from this selection.

| Selected case | Result | Label |
| --- | --- | --- |
| M1-01.common.constants | PASS | SIM |
| M1-37.blackboard.w | PASS | SIM |
| M1-37.blackboard.y2 | PASS | SIM |
| M1-29.blackboard.k1 | PASS | SIM |
| M1-29.blackboard.k2 | PASS | SIM |
| M1-29.blackboard.k3 | PASS | SIM |
| M1-38.common.i5 | PASS | SIM |
| M1-06.blackboard.cli | PASS | SIM |
| M1-28.blackboard.positive | PASS | SIM |
| M1-37.blackboard.v2 | PASS | SIM |
| M1-37.blackboard.x1 | PASS | SIM |
| M1-37.blackboard.z1 | PASS | SIM |
| M1-38.blackboard.i3 | PASS | SIM |
| M1-38.blackboard.i4 | PASS | SIM |

[Exact result identity](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/partial-smoke-identity.json)
contains the selection, full SHAs, command, profile and result rows.
[Case timing and source index](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/partial-smoke-case-times.json)
retains per-case duration, each test-file time window and available snapshot
windows; Vitest did not report an individual wall-clock start for each
assertion. The [host summary](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/summary.json)
includes setup and teardown.

Both real CLI paths worked through `m1HostControl`. App grants had 39
successful commands and four expected refusal commands. LTI shared-platform
had one successful idempotent command and one expected conflicting-client
refusal. [CLI evidence](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/operator-cli-index.json)
records each exact argument array, exit code, duration and sanitized output.
The selected criteria checked those expected errors; no command error was
ignored.

[Acceptance health](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/partial-smoke-acceptance-health.json)
records both services in `acceptance`, no knobs, and the two expected
simulation profiles. [Final health](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/partial-smoke-final-health.json)
records both services restored to `default`, no knobs and no LTI simulation
profiles. [Image identities](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/partial-smoke-full-image-identities.json)
include ten service/container roles, including E2E, simulator and gate, with
five unique image IDs and available repository digests. The
[executed wrapper](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/executed-preflight-wrapper.mjs)
is preserved.

The final scan checked 15 captured values against eight raw service logs
and the public artifacts, with zero hits; see
[scan evidence](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/post-cleanup-secret-scan.json).
The independent 12:58:30 UTC
[cleanup boundary](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/independent-cleanup-boundary.json)
found zero containers, only bridge/host/none networks, and all seven original
volume metadata records exactly unchanged. No claim of hashing volume data
bytes is made. Docker memory remained 8,319,238,144 bytes.

The Lead accepted this result and transferred the exclusive stack window
to Canvas QA for M2 and conditional default-profile T7. No further stack is
started here. Both complete 416-row runs at the frozen `ae130a3` SHA and the
remaining legacy suites are still required after source review and the next
clean handback. The old-011 upgrade, released-v10 Moodle rollback and
real-provider matrix were not exercised by this preflight. No live
Blackboard or Canvas result is claimed.

## Capture repair checkpoint — A-M3-02, 2026-10-20

Verdict for this checkpoint only: **PASS, HARNESS ONLY**. Overall M1 stays
FAIL/incomplete. The Lead authorized this repair after Reviewer-A identified
two older Blackboard callers with incomplete gate capture.

`30-grants.test.ts` now arms all seven method rules on every path before
reading its cursor. The former four-method `/api/` filter could miss HEAD,
PUT, OPTIONS and other paths. Its remote-state, simulator-call and zero-gate-
event assertions remain. `50-races.test.ts` now places each specific fault
before all seven capture rules, including the opening window after reset.
The replacement-under-live-lease case reads its cursor after replacement
issuance. Capture remains active after the one-shot PATCH hold is consumed;
its zero-call, refusal, cancellation and successful recovery checks remain.

The two new checks execute the actual unchanged caller source through
TypeScript transpilation and the actual in-memory gate boundary. Inert
public-response stubs only let the caller reach its observation assertion;
they are not product or binding oracles. A clean no-call control passes.
Fresh gate instances then inject each of GET, HEAD, POST, PUT, PATCH, DELETE
and OPTIONS; each actual zero-call assertion rejects the injection. The
grant caller also rejects a GET outside `/api/`. The race check proves that
the original hold is still active during injection and is cleared on both
success and failure. The clean control completes the caller's cancellation
and recovery continuation.

A disposable negative control used the two old callers from
`ae130a3501f3a2502c6a34e36319629e3dcdfb09` with the new checks. Both new
caller checks failed with `Missing expected rejection`, while the three
existing gate checks passed. This expected exit 1 proves that these checks
detect the old capture gaps; it is not a product failure result.
[Negative-control record](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-02-20261020T1311Z/old-callers-negative-control.json).

The owned common/Blackboard audit covered every gate rule and no-call
assertion. Snapshot opening, reset and retry windows already use the full
capture helper. The remaining narrow rule in `60-containment.test.ts`
checks one held request's upstream result by request ID; it makes no
zero-traffic claim. Other simulator-service and rejected-host log assertions
use different observation boundaries. No further instance of this gate
capture gap was found in the owned files. Canvas callers were not edited.

The Lead also authorized one shared type extension in
`tests/acceptance/lib/lti.ts`: `recordSecret` accepts `play_id` and
`picker_id`. Its one private recorder, storage and redaction behavior are
unchanged. Canvas QA owns and validates the associated capture/diagnostic
changes.

Final local command:

```sh
node tests/host/run-m1.mjs --harness-only --provider all
```

It passed 33 self-checks, typecheck and discovery of 392 API cases plus 24
host/browser rows, with no failed, skipped or cancelled self-check. These
are working-tree checks, not a frozen acceptance run.
[Final log](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-02-20261020T1311Z/harness-only-final.log)
and [held source hashes](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-02-20261020T1311Z/preparation.json)
retain the exact evidence. No stack was started. Both complete 416-row M1
rounds and remaining legacy suites now require a new reviewed freeze and
the Lead's exclusive stack handback; earlier partial and older-SHA evidence
does not satisfy that requirement.

## Claude continuation — full-run attempt 1 at `aff4882`, 2026-10-20

Verdict for this attempt: **FAIL**. The run stopped in round 1, phase `sim`.
Nine required rows failed. No phase after `sim` ran. No M1 criterion gets
full-run credit from this attempt.

Owner: a fresh, independent common/Blackboard QA session, Claude Code Opus 5.5
at xhigh effort. Task `task_ed3b08aa45ea`, dispatch `ctx_8d5f8d3984d0`. This
session did not write the product, and it did not review it. It continues from
the outgoing QA's durable handoff,
`/Users/quangnguyen/cogniate-qa-runs/common-blackboard-claude-handoff-20261020T1405Z/continuation.md`.
It checked the three handoff hashes and the 11 owned file hashes before work.
This is not a cross-model check of Claude-authored code.

### Identity and command

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `aff48823a4c6206d6314d91a95f5eb0979d3e0e7` (tests tree `187afae0`) |
| Behavior and 011 baseline SHAs | `ccdd9ef67cdd2be4c6af374136777fda4e081943`, `9f96f7b24cd0aed702e4dc40373bdda4307aad31` |
| Window | Lead `msg_d26c1a003c73`, exclusive. No other stack ran. |
| Lane | `qa-multi-r1`, port 8443, subnet `172.29.0.0/16` |
| Source | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aff4882-20261020T1420Z/source` (clean, detached, push disabled) |
| Source provenance | `.../m3-frozen-aff4882-20261020T1420Z/provenance.json` |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-aff4882-20261020T1442Z` (`public/` shared, `private/` 0700) |
| Phase run | `qa-multi-r1-aff48823-2026-10-20T14-42-33-520Z` |
| Time | 14:42:33Z start; suite 14:43:11.821Z for 1,303,642 ms; parent exit 1 at 15:05:04Z |
| Tools | Node 24.21.0, Docker 29.8.2, Compose 5.6.0 |

```sh
cd /Users/quangnguyen/cogniate-qa-runs/m3-frozen-aff4882-20261020T1420Z/source
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=/Users/quangnguyen/cogniate-qa-runs/m1-full-aff4882-20261020T1442Z/tmp \
node tests/host/run-m1.mjs --sha aff48823a4c6206d6314d91a95f5eb0979d3e0e7 \
  --test-sha aff48823a4c6206d6314d91a95f5eb0979d3e0e7 \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-aff4882-20261020T1420Z/source
```

This is the Lead's exact command. The runner has no `--runs` option. The
default `full` phase runs all four phases twice, then legacy. The Lead accepted
the `TMPDIR` value: it keeps the accounting and ledger temporary files in the
private run root. A launcher ran external read-only observers before and after
the command. It did not change the suite. Tool hashes and the 8/8 observer
failure-path controls are in `public/run-provenance.json`.

### Result of the `sim` phase, round 1

The phase report has all 394 `sim` rows: **385 PASS, 9 FAIL**, zero skipped
or missing rows in the selection. The five Blackboard and one Canvas isolated
rows are not in this selection by design. The runner then stopped the full
run. That is correct: a failed required child must stop the gate.

| Owner | Rows in this phase | PASS | FAIL |
| --- | ---: | ---: | ---: |
| Common | 26 of 42 | 24 | 2 |
| Blackboard | 136 of 141 | 132 | 4 |
| Canvas | 232 of 233 | 229 | 3 |

Not run: round 1 `snapshot-isolated`, `snapshot-upgrade` and `migration`; all
four phases of round 2; all legacy groups. The 011→012 route and the
released-v10 Moodle route did not start.

| Row | Label | Result | Classification | Evidence |
| --- | --- | --- | --- | --- |
| M1-07.blackboard.alphabet | SIM | FAIL | QA oracle defect | `10-deployments.test.ts:91` reads `details.field` on an LTI service 400. LTI contract §1.3 has only `details.message` and `details.description`, and "`description` names the field". `details.field` is an app contract field. Status 400 and `INVALID_REQUEST` matched. |
| M1-07.blackboard.fencing | SIM | FAIL | QA oracle defect | The same assertion at line 100. Status and code matched. |
| M1-36.blackboard.query | SIM | FAIL | QA oracle defect | The claim `lineitems` URL has no query; the bare claim URL gave 200. §3.4 rule 3 requires only the claim's own parameters. So `…?injected=1` is a valid URL, and 200 is correct. The criterion's "changed claim query parameter" needs a claim URL that has one. |
| M1-21.blackboard.capabilities | SIM | FAIL | QA request defect | Line 163 sent `createMoodleCourse: true`. App contract §11 defines `createMoodleCourse: { categoryId? }`. The answer `400 INVALID_REQUEST` is valid for that body. |
| M1-35.common.default-off | SIM | FAIL | QA host-control defect | `/healthz` still showed `profile: acceptance`. `m1-control.mjs` set `STACK_PROFILE` only in the process environment. `stack:restart` reads the saved profile, and only `stack:up` changes it. The documented route is `--env STACK_PROFILE=…` (`stack-restart.sh` LTI gate variables; AC-M1-35 names `stack:restart -- lti-service --env …`). |
| M1-35.common.default-on | SIM | FAIL | QA host-control defect | Same cause. `acceptance-off` passed because its `--env LTI_PROVIDER_SIMULATION` was applied. |
| M1-36.canvas.query | SIM | FAIL | Canvas QA verdict | Same pattern as the Blackboard row (preliminary view only). |
| M1-21.canvas.course-shell | SIM | FAIL | Canvas QA verdict | Same `createMoodleCourse: true` body (preliminary view only). |
| M1-20.canvas.repeat | SIM | FAIL | Canvas QA verdict | `31-canvas-grants.test.ts:215` found one `grant_redeemed` for the connection after `since`; 0 expected. Not classified here. |

For the six common/Blackboard rows, the observed product answer matches the
approved contract in each case where an answer was observed. No product
defect is identified. The M1-35 product behavior was not observed, because
the host control never applied the requested profile. The Lead sent the three
Canvas rows to Canvas QA (`msg_8383137868da`). Canvas QA owns their verdict.

Evidence, all redacted:

- Classification: `/Users/quangnguyen/cogniate-qa-runs/m1-full-aff4882-20261020T1442Z/public/round1-sim-failure-classification.json`.
- Phase artifacts: `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aff4882-20261020T1420Z/source/tests/host/artifacts/qa-multi-r1-aff48823-2026-10-20T14-42-33-520Z/`: `m1-case-results.json` (394 rows with SHAs, label, command, start, artifact), `evidence/sim/m1-vitest-results.json`, `cmd/acceptance-sim.log`, `summary.json`, `m1-identity.json`, `images.json`, `host-actions/`.
- Health before the suite: the default gate passed (`M1-02.common.default-profile`; six profiles; three simulation profile ids refused). Health after the suite: both services `profile: default`, `knobs: []`; LTI `simulation_profiles: []`.
- Images (sampler digests): `node@sha256:44fce696…` for app, LTI service, `lms-sim`, `lti-gate`, `qa-platform` and `sink`; `erseco/alpine-moodle@sha256:3a310197…`; `postgres@sha256:721873c3…`; `caddy@sha256:d8542f48…`; local `qa-multi-r1-e2e@sha256:4aa7dbea…`. Full values: `public/sampler/lane-containers.json`. The sampler saw at most one Compose project.
- Secrets: the runner's own scan checked 1,299 captured values in 633 redacted files, with 0 hits. The independent scan checked the same 1,299 values plus 12 stack secrets. It found 0 hits in 9 raw service, simulator and gate logs and in 669 public files, and 0 JWT-shaped strings (`public/secret-scan.json`).
- Isolation and cleanup: runner `M3-ISOLATION` and `TEARDOWN` PASS. The independent after-boundary found 0 containers, no owned volume or network, and all seven protected volume records identical to the original baseline (`public/baseline-vs-original-after.json`). Docker memory 8,319,238,144 bytes and 12 CPUs are unchanged. The build runner process was absent before and after.

### Repair checkpoint — held for Lead commit

The Lead authorized repairs (a)–(d) in `msg_da9a87e79584`, and one more file
in its reply to the scope question. No product, infrastructure or Canvas file
changed. No stack ran for the repair. All other assertions are unchanged.

| Repair | File | Change |
| --- | --- | --- |
| (a) | `tests/acceptance/M1/blackboard/10-deployments.test.ts` | M1-07 alphabet and fencing check that `details.description` names `deploymentId` or `bindingRef` (§1.3). Status, code and "nothing stored" checks are unchanged. App-contract `details.field` checks in the same file are unchanged. |
| (b) | `tests/acceptance/M1/blackboard/20-protocol.test.ts` | The M1-36 `query` variant launches with an AGS claim whose `lineitems` URL has `?qa_claim=v7`. The claim URL must give 200. A changed value and a missing parameter must each give 400 on both endpoints (`INVALID_URL_PARAMETER`, `INVALID_LINE_ITEM_ID`). The zero-call check runs after both. The other four variants are unchanged. |
| (c) | `tests/acceptance/M1/blackboard/30-grants.test.ts` | The publication check uses a bound connection and a course with an uploaded version. Both are made before the no-mutation cursor. It sends `createMoodleCourse: {}` and expects `409 CAPABILITY_NOT_SUPPORTED` with `details.capability = "courseShell"`. The publication list must not change, and the remote state, simulator and gate must see no call. The three pending-connection checks are unchanged. |
| (d) | `tests/host/m1-control.mjs` | `m1-profile` passes `--env STACK_PROFILE=<profile> --env LTI_PROVIDER_SIMULATION=<on/off>`. The `acceptance/on` restore restarts with no override. `m1-restart` and the CLI route are unchanged. |
| (d) | `tests/host/m1-control.selftest.mjs` | A new check runs the real handler. It checks all four profile commands, the restore, `m1-restart` and two refusals. It also reads the infra facts it relies on. |
| scope | `tests/acceptance/M1/common/gate-capture.selftest.mjs` | One inert `'../../lib/app': {}` dependency entry. Strict rejection of unknown dependencies, real caller loading, all seven methods and the non-api path are unchanged. |

Checks, all without Docker:

- `node tests/host/run-m1.mjs --harness-only --provider all`, in a scratch clone of `aff4882` with only these six files changed (15:22:47Z): exit 0, 34/34 self-checks (one new), 0 fail or skip, typecheck PASS, 392 API plus 24 host/browser rows (416) discovered. The same check also passed in the shared working tree at 15:19:22Z. Canvas QA was editing its own files in that tree at about the same time, so the scratch result is the evidence for this change set.
- Negative control: the new profile check fails against the old `aff4882` handler at `m1-profile default/off`; the existing CLI check still passes.
- Negative control: the old `aff4882` dependency map rejects the repaired caller with `Unexpected caller dependency: ../../lib/app`; with the entry, all five gate checks pass.
- An independent §3.4 reading confirms the old `query` input was valid, the new claim URL is valid, and the changed and missing parameter inputs are invalid.
- Control evidence: `/Users/quangnguyen/cogniate-qa-runs/m1-full-aff4882-20261020T1442Z/public/repair-controls/`. Exact held patch: `public/held-repair.patch`, SHA-256 `6c6c49bbba7694f2e5b990d7888dac76cba16ef9be9b874880a2d9aea744a0f9`. Full file hashes: `public/held-repair-hashes.json`.

Held file SHA-256 (working tree, against `aff4882`):

| File | Held | At `aff4882` |
| --- | --- | --- |
| `tests/acceptance/M1/blackboard/10-deployments.test.ts` | `7e07e713…3050` | `f6e3ced7…df1c` |
| `tests/acceptance/M1/blackboard/20-protocol.test.ts` | `c5cf2932…af4e` | `6e0ff724…498f` |
| `tests/acceptance/M1/blackboard/30-grants.test.ts` | `e5c1ee90…2f88` | `188bb0d6…b08b` |
| `tests/host/m1-control.mjs` | `575d26a8…111d` | `18829faf…1a4e` |
| `tests/host/m1-control.selftest.mjs` | `61b022d4…d06f` | `aabf27ef…dcee` |
| `tests/acceptance/M1/common/gate-capture.selftest.mjs` | `7bd065e1…82cd` | `0a2dfe47…3673` |

Next gates: the Lead commits these paths and Canvas QA's own repairs. Then
the Lead freezes a new candidate, gets source review, and opens a new
exclusive window. Then both complete rounds and all legacy groups run again
from a fresh clone. This failed attempt, its artifacts and its not-run phases
stay in the record.

## Claude continuation — full-run attempt 2 at `8138097`: INTERRUPTED, 2026-10-20

Result: **INTERRUPTED**. The host stopped during round 1, phase `sim`, and
rebooted later. No phase finished. The suite wrote no Vitest report, so no
row was evaluated. This is not a test or product result. It gives no M1
credit and no Canvas rows to assess.

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `8138097889f87359d5055bb1d79766b5ed842f92` (tests tree `a6437598`); the repairs held after attempt 1 |
| Window | Lead `msg_a2aa04484762`, after both source approvals (A `msg_945c9463e27d`, B `msg_feaafbe8d45f`) |
| Command | The Lead's exact command, from `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-8138097-20261020T1524Z/source`, with `TMPDIR=<run root>/tmp` |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-8138097-20261020T1545Z` |
| Phase run | `qa-multi-r1-81380978-2026-10-20T15-45-52-377Z` |
| Start | 15:45:52Z. All pre-start gates passed, and all seven volume records matched the original baseline. |
| Last activity | 15:57:19.577Z (app log). LTI service and simulator logs 15:57:11Z, gate 15:57:13Z, last sampler flush 15:56:46Z. |
| Host | Boot time 20:04:55Z. `last` has no clean-shutdown record. The power log has no entry between the stop and 20:06:01Z. The cause is not attributed. |

A 15:55Z checkpoint first said "advancing" before the samples were read. The
two 15-second samples were identical. The corrected report went to the Lead
at once. Both messages stay in the record. After that quiet minute, the suite
continued until the stop: gate log 1 → 54 lines, simulator 741 → 757, app
2,460 → 2,563, and 206 host-control requests. A quiet interval alone is not a
failure.

### Recovery (Lead `msg_b465eb9ef8f0`)

The Lead started Docker Desktop with no settings change. The daemon answered
at 20:08:19Z. Then this QA ran a recovery-only cleanup:

1. A read-only boundary before any change (20:08:30Z) found only owned
   resources. Nine `qa-multi-r1` containers had restarted at 20:08:18Z under
   their restart policies; the suite container did not come back. There were 3
   owned volumes and 1 owned network. No other project had a container.
2. The container logs were saved raw to a private 0700 folder.
3. The runner's exact-label lookup (`projectResources`) and its three removal
   commands removed 9 containers, 3 volumes and 1 network. Nothing else was
   removed. No prune ran, and no image was removed.
4. Post-cleanup and 30-second stability boundaries found 0 containers and no
   owned leftovers. All **seven protected volume records are identical to the
   original baseline**. Port 8443 is free, and there is no subnet clash. No
   build runner or owned runner process remains. Docker memory is
   8,319,238,144 bytes with 12 CPUs, unchanged.

Differences caused by the restart, recorded and not attributed:

- The default `bridge` network was recreated twice: at 20:08:18Z and again at
  20:08:57Z. `host` and `none` are unchanged.
- The Docker server version changed from 29.8.2 (pre-cleanup boundary at
  20:08:30Z) to 29.9.1 after the 20:08:57Z engine restart. The Docker Desktop
  4.96.0 app bundle on disk is dated 2026-10-19. Compose (5.6.0) and Node
  (24.21.0) are unchanged. Attempt 1 and the earlier M2/T7 runs used engine
  29.8.2.

Privacy: the independent scan checked 696 values captured before the stop
plus 12 stack secrets. It found 0 hits in 9 raw service, simulator and gate
logs and in 232 public files, and 0 JWT-shaped strings.

Evidence: `public/interruption-record.json`, `public/recovery/`
(`boundary-pre-cleanup.json`, `owned-cleanup.json`,
`boundary-post-cleanup.json`, `boundary-stable-1/2.json`,
`recovery-comparison.json`, `secret-scan.json`). Raw logs and captures:
`private/` (0700). The recovery script
`/Users/quangnguyen/cogniate-qa-runs/claude-common-qa-tools/recover-owned.mjs`
uses the frozen lookup and the same removal commands as the runner teardown.

Next: a new exclusive window for attempt 3 of the same exact entry at
`8138097`, from a new clean clone and a new run root. Attempt 1 (FAIL) and
attempt 2 (INTERRUPTED) stay as separate records.

## Claude continuation — full-run attempt 3 at `8138097`: FAIL at the default gate, 2026-10-20

Result: **FAIL**. The run stopped in round 1, phase `sim`, before the suite
started. One required host-gate assertion ran and failed: the default gate for
`M1-02.common.default-profile`. Zero suite rows (API or browser) ran. No retry
was made. The cause is not classified yet.

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `8138097889f87359d5055bb1d79766b5ed842f92` (tests tree `a6437598`) |
| Window | Lead `msg_ff5f23202f77`. Docker engine 29.9.1 is the accepted environment baseline. Equivalence with 29.8.2 was not assessed. |
| Source | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-8138097-a3-20261020T2011Z/source` (provenance `df7e5f2d…`) |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-8138097-a3-20261020T2014Z` |
| Phase run | `qa-multi-r1-81380978-2026-10-20T20-15-15-670Z` |
| Time | 20:15:15Z start; parent exit 1 at 20:15:58Z |

The pre-start gates passed. Setup passed: clone, root `npm ci`, `gen-env`, the
H1 project guard, `stack:up` (32.4 s) and `seed` (2.8 s, the same output as
attempt 1). Then the runner's default gate (`run-m1.mjs:216`) for the required
row `M1-02.common.default-profile` sent `GET /api/providers` to the
default-profile stack. The answer was **500**, not 200.

Product evidence (redacted copies in the phase artifacts):

- `service_started` at 20:15:25Z with `profile: default`, `knobs: []` and
  `simulation_profiles: []`.
- `internal_error` at 20:15:55.149Z with error `Error`. The product does not
  log the message.
- `http_request GET /api/providers` with status 500 after 1 ms, in the same
  trace.

The same product and images passed this gate in attempt 1 (14:43Z, engine
29.8.2). All five `images.json` entries are identical. The seed output is
identical, and the setup timings are similar (32.4 s and 2.8 s now; 31.9 s and 2.7 s then).

Environment differences, recorded as facts and not as a cause:

- Docker Desktop was 4.95.0 when the Lead launched it after the reboot. Its own
  log shows that it installed a pending update at 20:08:50Z. It now runs
  4.96.0 with engine 29.9.1.
- In this window, the default `bridge` network was recreated at 20:15:16Z. That
  is one second after the before-boundary and before `stack:up`. The VM
  console log rotated at 20:15:15Z. The VM init log shows network policy
  components loading at 20:15:16Z.

Cleanup: the runner teardown passed with 0 containers, volumes and networks
left. The after-boundary found 0 containers and no owned leftovers. All seven
protected volume records are identical to the original baseline. Its only
problem is the bridge recreation above. No owned process remains. Privacy: no
suite ran, so no test value was captured. The 13 stack secrets gave 0 hits in
5 raw logs and 42 public files.

Evidence: `public/attempt3-failure-classification.json`, `public/` boundaries,
and the phase artifacts under
`/Users/quangnguyen/cogniate-qa-runs/m3-frozen-8138097-a3-20261020T2011Z/source/tests/host/artifacts/qa-multi-r1-81380978-2026-10-20T20-15-15-670Z/`
(`summary.json`, `service-logs/lti-service.jsonl`, `docker-logs/`, `cmd/`).

Next: a bounded diagnosis of the 500 before any rerun (escalation
`msg_c0c19a2f8c70`). This QA does not change Docker, downgrade it or edit
source.
