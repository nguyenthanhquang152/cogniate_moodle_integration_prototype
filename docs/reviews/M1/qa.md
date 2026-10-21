Verdict: FAIL — no complete M1 round yet: attempt 1 FAIL at `aff4882`; attempt 2 INTERRUPTED and attempt 3 FAIL at `8138097` (one required host-gate assertion failed with HTTP 500; zero suite rows ran)
Round: Claude continuation `ctx_8d5f8d3984d0`, attempt 3 default-gate failure and storage-lock diagnostic, 2026-10-20

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

## Independent storage-lock diagnostic after attempt 3, 2026-10-20

Status: **bounded diagnostic evidence only**. It earns no acceptance credit.
Attempt 3 remains a **FAILED** required host-gate assertion
(`M1-02.common.default-profile`, HTTP 500), with zero suite rows.

Authority: Lead `msg_4b9a4e0703c7`, after the author diagnostic
`task_b97d185ccfba` (report
`/Users/quangnguyen/cogniate-author-diag/providers500-8138097-20261020T2022Z/public/AUTHOR-DIAGNOSTIC-report.md`,
SHA-256 `f759561126bf17c70914fbcb114850f95662b838ffd1bc185f3a732e0ce075c3`). The
author found that the bind-mounted data folder (`fakeowner`) does not enforce
SQLite locks between processes. A seed CLI then removed the WAL under the open
server connection, which caused `SQLITE_CORRUPT` and the 500.

This QA wrote its own oracle and did not reuse the author's probe. It used one
labeled volume and one container with no network, from the pinned image
`sha256:44fce696…` (`node:24.22.0-alpine3.24`). Docker Desktop was 4.96.0 with
engine 29.9.1. No product or test source, app stack, secret or production
data was used.

Method: process A holds `BEGIN EXCLUSIVE` with one inserted row and signals
that it is ready. Process B, with busy timeout 0, tries `BEGIN IMMEDIATE`,
`INSERT` and `COMMIT`. A is checked alive and `inTransaction` before and after
B. Only `SQLITE_BUSY` (errcode 5) counts as a refusal, and B acquiring while A
holds is a failure. After A releases, a new B must acquire (positive control).
A fresh process then reads the rows and runs `integrity_check`. Every wait has
a 20-second deadline. Host self-tests on APFS passed first: both modes
enforced. A `nolock=1` negative control was detected (DELETE "not enforced";
WAL "inconclusive", so a non-lock error never counts as enforcement).

| Location | Filesystem | DELETE | WAL |
| --- | --- | --- | --- |
| Host bind mount | `fakeowner` | Enforced (B refused, errcode 5) | **Not enforced**: B acquired while A held; A could not commit; final rows `[B, B]`, so A's row was lost (integrity ok) |
| Named volume | `ext4` | Enforced | Enforced |
| Container writable layer | `overlay` | Enforced | Enforced |

In all six cases A stayed alive with `inTransaction = true`, and every positive
control acquired.

- Agreement: WAL locking (the product's journal mode) fails on the bind mount.
  The named volume and the container layer enforce locks here.
- **Discrepancy, kept open:** the author saw B acquire on the bind mount in
  DELETE mode. This oracle saw B refused (journal mode `delete`, `-journal`
  file present). The cause is unknown. No extra run was made.
- No version causality is claimed. As existing evidence: attempt 2 (VM cold
  start, Docker Desktop 4.95.0, engine 29.8.2) passed the same fresh default
  gate (`GET /api/providers` 200 at 15:46:31Z, 0 `internal_error` lines). Attempt
  3 and the author's two fresh runs (4.96.0, 29.9.1) got 500. That is a
  correlation, and no downgrade is authorized.

Later finding about the bridge changes: Docker Desktop's backend `idle`
component stops the VM when it is idle and answers read-only API calls from a
cache. The next mutating call logs `idle -> busy`, `starting VM` and `engine
start requested`, and the engine then creates a new default `bridge`. The
"starting VM" times match every recorded bridge creation: 14:19:37, 15:19:05,
15:45:52, 20:15:15, 20:22:50 and 20:39:00 UTC. So these ID changes come from
idle VM restarts, not from QA actions. A boundary read while the VM is idle
shows cached state.

Cleanup: only the labeled container and volume `qa-multi-r1-sqlite-diag` were
removed. Before and after: 0 containers, all seven protected volume records
identical to the original baseline, memory and CPUs unchanged, port 8443 free,
no owned leftovers. The only after-boundary problem is the bridge ID change
explained above.

| Evidence (`/Users/quangnguyen/cogniate-qa-runs/claude-sqlite-diag-20261020T2035Z/`) | SHA-256 |
| --- | --- |
| `public/QA-SQLITE-LOCK-DIAGNOSTIC.md` (summary) | `ada5017363a0e757b3faaccc301c0e854fb95056bd6ec2928ab95c5060c62cb7` |
| `public/docker-oracle.json` (raw result; test rows only) | `d2c20c9f1ebdd4899b134c8e9a12de97362aaef9fa42f44418c836bffd26c204` |
| `hostdir/probe/oracle.mjs` (oracle) | `c79a15f0edbcb9d8c11b92e1170d3159001be2fef9ea97c3339bf2126b37f570` |
| `public/selftest-positive.json` | `4a4cb3395ca0048d4132811c12411582d248286962d8593998ffc5bb347a1e91` |
| `public/selftest-negative.json` | `b283f8cec2f7dd6268a1ff97354c8e48c5eb35537560c9d6718efedfd833506d` |
| `public/boundary-before.json` | `0532ba0f7aca4de1b16b9be80cf949b762793fb6fcc1d92930ab7e881c14f73d` |
| `public/boundary-after.json` | `05eac6e162bd57edf72f9acd1cb27456d3060430ed687d87d8ffbb98b28b1ded` |

## Storage source preparation (ADR-012 revision 3.3), 2026-10-21

Status: **source preparation only.** No Docker command, stack, image pull or build ran. This section gives no runtime, implementation or acceptance credit. The verdict line at the top of this file does not change.

| Item | Value |
| --- | --- |
| Task | `task_58a1e33ac60f`, dispatch `ctx_e583d25c6083` (independent common QA, Claude Code Opus 5.5) |
| Accepted contract | `89be93cc9e24f74c2b32ce72180ad4c706d000f7`: ADR-012 revision 3.3 SHA-256 `f586f1d76083297b22eae8981d9347512c313f9a0dd929bcee9f0763c0aed2fe`; `review-response-storage.md` SHA-256 `9f1999769bbcbf3ee4442411d739df23790f23a45f5a2a42097a343ded45234f` |
| Product and test tree before this work | identical to `8138097889f87359d5055bb1d79766b5ed842f92` (`git diff --quiet` on `services apps packages infra tests` and the root build files) |
| Written from | ADR-012 revision 3.3 (§3–§17), `tasks/M1.md` AC-M1-23, AC-M1-30, AC-M1-38 (h1)–(h5) and AC-M1-41, `tasks/M3.md` AC-M3-01 and AC-M3-06, `local-stack.md`, the charter and the research inputs |
| Not read | any Author implementation, Author note or Author diagnostic. Read for existing interfaces only: committed pre-repair files at `8138097` (`package.json`, `infra/scripts/lib.sh`, `qa-suite.sh`, `seed.sh`, `stack-reset.sh`) and `infra/scripts/lib.sh` of the two old SHAs |
| Ownership | `tests/host/**`; one added import line in the existing `tests/acceptance/M1/common/migration.probe.ts` and one new `storage-lock-scope.probe.ts` there, for the exact a-lock-scope case; this addendum and the M3 addendum |

### What QA prepared

| File | Purpose |
| --- | --- |
| `tests/host/m1-storage-manifest.json`, `storage-inventory.mjs` | The 72 AC-M1-41 rows in their own host manifest (`M1-41.common.<id>`, label `SIM`, kind `host`). The reader checks them against a hand copy of the ADR-012 §13 table and the group counts. `joinInventory` checks 416 + 72 = 488 and the phase totals. |
| `storage-docker.mjs` | §11 container kinds as exact `docker run`/`docker create` arguments (pinned image id, `--network none`, QA labels, `HOST_UID:HOST_GID`, root only for `d-owner` and `d-mountpoint`). It also holds the exact-name volume gate, the Docker-clock seconds of item 6, and the A-S-14 identity binding. The ownership ledger of §15 records containers and networks by `Id`, and volumes by `Name` plus metadata; the teardown plan keeps and reports every unproven resource. |
| `storage-fixture-script.mjs` | QA's own script inside its containers (Node built-ins only). It lists entries (owner, mode, size, SHA-256; links never followed) and reads the §8 file sets. It does logical reads on copies in the container's own layer, the planted changes, copy-out, the P5 write, and QA's two-process WAL lock oracle. |
| `storage-oracle.mjs` | QA's oracles: "refuses" (exit 1 and the code in a JSON line), "nothing changes" with §11 item 5 for absent volumes, pair identities, the recovery oracle (file sets and logical rows), manifest file sets, legacy sets, and lock-record and process-group helpers (`LC_ALL=C ps -A -o pid= -o pgid=`). |
| `storage-lane.mjs` | The lane context. Every lane mount passes the exact-name gate first. Every write-mode fixture runs under `storage-oplock.sh run --` with both services positively stopped, except the two §11 exceptions. |
| `storage-rows.mjs` | The 70 storage-phase rows in one fixed order. Each step has prerequisites: a failed or blocked prerequisite gives the row FAIL or BLOCKED with the reason, and the row does not run. |
| `storage-compat-route.mjs` | §12 for every old-build step: the enable and disable order, copy hashes against `infra/compat/storage-compat.sha256`, the exact tree rule (tests/ tree hash through a temporary index), and C1 − C0 through the old `dc()`, limited to items (a)–(e). Old starts run only through the copied wrapper, with the preflight line, QA's own mount check and the lock pair. It also keeps the forbidden-command log and the decision for `j-migration` and `j-snapshot`. |
| `m1-migration.mjs` | AC-M1-23/30 and AC-M1-38 (h1)–(h5): database reads now go through the read-mode fixture, the stale-sidecar plant through a write-mode fixture under the lock, and old steps through the §12 route. It writes the round handoff for `e-old-schema` (ids and paths only, never `K0`). |
| `p5-fixture.mjs`, `p5-step.mjs` | The approved P5 sequence inside one `storage-oplock.sh run --`: app stop, stopped check, the write in `storage-p5` (`appdb` only), app start. |
| `m1-control.mjs` | Refuses `m1-restart` and `m1-profile` before any command while the knobs file holds `x-cogniate-storage-compat`. |
| `core.mjs` | Fresh-lane boundary by exact names and label, the ownership ledger after every command, and the teardown preserve rule. It also records `G1-IDENTITY` for M1 and legacy runs. `--clean-project` is refused, because QA removes nothing at the boundary. |
| `run-m1.mjs`, `m1-phases.mjs` | New phase `storage` after `migration`, with its own lane `<project>-st`; the round handoff; the conditional rule of §14; old suites through the wrapper; the harness-only discovery of the `storage-lock-scope` stage. |
| `run-t1.mjs` | The information-only note: `**/.data` no longer holds database bytes. |
| `tests/acceptance/M1/common/storage-lock-scope.probe.ts` | The QA storage case of `a-lock-scope`: a host-control `m1-restart` of `lti-service` must exit 0, without `operation_in_progress`; then `/healthz` is 200. |

### Inventory (prepared, not run)

- **488** mandatory rows per full round = **416** original + **72** AC-M1-41. By phase: `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6 (5 + `j-snapshot`), `migration` 12 (11 + `j-migration`), `storage` 70.
- The 72 rows by group: a 10, b 3, c 2, d 7, e 13, f 6, g 20, h 7, i 2, j 2.
- `M1-41.common.c-host-negative` is the only conditional row. It is PASS only with QA's same-round oracle evidence of the fault; NOT_APPLICABLE only with the oracle evidence of enforcement. NOT_APPLICABLE is reported apart and never counted as a PASS, and both rounds must give the same result (`storage-inventory.mjs`, `run-m1.mjs`).
- **The original rows are unchanged.** The three M1 manifests are byte-identical to `89be93c`: common `cd40fb785ac9bb615dba16d2e264522051e6d9279081ecd9eb3c9722007846eb`, Blackboard `337524ca3e69fe313e102383c5e813593138944b99fe3ebb37e2aee13f17b194`, Canvas `c497462955a668f3158c593b5c9c821ee7da093ba7c2396d3233a846ffc9c677`.
- No other existing test file under `tests/acceptance`, `tests/sim`, `tests/e2e`, `tests/compat` or `tests/fixtures` changed, except the one import line in `migration.probe.ts`.
- In `m1-migration.mjs` the recorded row ids are the same 8 forms, and every original assertion message is still present. The three added `assert` calls are the §12 BLOCKED guards of AC-M1-23 step 0. The P5 guards, errors and return value are the same, and the T5b P5 spec did not change.

### Storage-phase order

The full order and its prerequisites are in `storage-rows.mjs` (`SEQUENCE`, `NEEDS`). The decisions that the contract leaves to QA:
- `c-*` run first. `a-fresh` is the lane's first start.
- `a-first-start-resume` runs after two quarantines, before any `e-*` row places legacy files. It runs the B-S-23 legacy check first; QA moves or deletes no legacy file to meet it.
- `g-damaged` and `h-nomanifest` run before the first drill, so "no journal file" holds literally.
- The committing drill `g-committed-lti` runs last, so every other drill rolls back to the post-B state.
- `h-open-journal` and point (1) of `h-target-state` are checked at the `staged` drill.
- `h-target-state` (2) uses a legacy backup X made from QA's own copies of B's database files. No legacy precondition applies there.
- QA removes only legacy copies that it placed and that are unchanged; it never removes another legacy file. QA removes its copies after `g-fresh-target`, so `h-pair-mismatch` can make a fresh pair.
- `e-import` checks its oracles on the final successful import of `e-import-recover`; no start runs in between.
- `e-old-schema` runs in the last block, after QA's `stack:reset`. The import half of `e-content-missing` runs before the package copy. Its restore half reuses the end state of `e-old-schema`, so it is recorded after it.

### Host-only controls (run on 2026-10-21, no Docker)

| Command | Result |
| --- | --- |
| `node tests/host/run-m1.mjs --harness-only --provider all` | exit 0; 69 of 69 node tests pass; `tsc --noEmit` passes. Vitest discovery matches the manifests and both snapshot stages, and the `storage-lock-scope` stage lists exactly `M1-41.common.a-lock-scope`. It prints 488 rows per round with the phase totals above. |
| `node tests/host/run-m1.mjs --harness-only --provider blackboard` | exit 0; 69 of 69; 255 rows (single-provider preparation only; a full round needs both providers) |
| New self-tests (35 tests) | fixture script 7 (listing, file sets, logical copy with `-wal`, planted changes and path refusals, P5, and the lock oracle with its decision-path negative), Docker rules 6, oracles 7, inventory 3 (including 10 negative controls), §12 route 4, storage order and helpers 7, host control +1 |

These tests prove QA's own logic on host files and recorded answers. They do not prove the product or Docker. A test stub never stands for a later runtime check.

**Independence disclosure.** The Author works in this same worktree. At the end of this task, `git status` showed uncommitted Author changes in `infra/**`, `services/**` and `package.json`. I did not open, print or diff those files. The existing self-test `m1-control.selftest.mjs` reads `infra/compose.yaml` and `infra/scripts/stack-restart.sh` from the working tree to confirm two command facts. So the harness-only runs may have read those two files programmatically, possibly with Author changes in them. No assertion of mine was written from them. Nothing else in the controls reads product or infra files.

### Unmeasured until a runtime window (assumptions, not checks)

- Product output forms that the contract names but QA has not seen:
  - `storage_preflight` lines with `ts`, `runId`, `fsType` and `state`;
  - lock events with `owner`, `command` and `ts`;
  - `storage_drill_stop`, `storage_drill_pause` and `storage_content_check` lines;
  - the field names of `quarantine.json`;
  - the manifest's backup id key;
  - refusal codes as JSON values. Text alone is never accepted as a refusal.
- Docker behaviour:
  - the "no such volume" text of `docker volume inspect`;
  - that `docker compose run` labels new volumes (ADR-012 §17 assumption 6);
  - `docker system info` `SystemTime`;
  - the compose plugin path in `docker info` `ClientInfo.Plugins`;
  - read access of the bind-mounted QA script (mode 0555) for `HOST_UID` in QA's container.
- Lane facts:
  - the default profile accepts the QA platform issuer `https://qa-storage.test`;
  - `seed` runs again after a quarantine;
  - the AC-M1-23 app database names its packages in a `package(s).storage_path` column;
  - the orphan checks finish inside the 120 s pause.
- Each of these fails closed when it is wrong: the row is FAIL or BLOCKED, never a false PASS.

### Later runtime instructions (separate authorization needed)

- **Prerequisites:**
  - the Author's implementation is frozen at an exact candidate SHA, and the frozen test SHA includes these files;
  - `node:24.22.0-alpine3.24` is present locally (the harness never pulls);
  - the host shows the A-S-14 bound identities (macOS 27.0.1 arm64, Docker CLI 29.9.1 and Compose 5.6.0 by binary SHA-256); else every lock-dependent result is `BLOCKED`;
  - lanes `qa-multi-r1` and `qa-multi-r1-st` are fresh, on port 8443 and subnet `172.29.0.0/16`, one stack at a time;
  - `COURSE_FIXTURES_DIR` holds the two course zips;
  - the seven protected volumes and the baseline containers are recorded before the run.
- **Command, from the frozen source clone:** `COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=<folder> node tests/host/run-m1.mjs --sha <candidate> --test-sha <frozen tests> --phase full`. It runs two rounds of the five phases (storage on `qa-multi-r1-st`) and then the legacy runners.
- A `--phase storage` run alone needs `QA_M1_HANDOFF_FILE` from the same round's migration phase; without it, `e-old-schema` and `e-content-missing` are BLOCKED.
- **Duration:** expect several hours per round. The storage phase alone has three `stack:reset` cycles with seeds, two 120 s lock waits, two 120 s orphan pauses and about thirty starts.

### Remaining needs and open points

- A separate, authorized Docker window and the later full verification retry (two rounds plus legacy) on the exact candidate. This is not a retry of `task_ed3b08aa45ea`.
- The final source reviews `task_5580d3cb79c5` (A) and `task_94536ec30f9a` (B) remain mandatory.
- **Decision for the Lead:** the AC-M1-30 step 3 text names "both journals committed". The original row `M1-30.common.restore` keeps its original assertions; this clause is not added to it. Adding it would change an original assertion, so it needs approval. The g drills and `e-import` check the journal states.
- **QA-owned notes:**
  - the oracle's controlled negative is a decision-path control (the contender writes a separate file), not a host lock fault;
  - the "INCOMPLETE folder" of `h-nomanifest` is a copy of B without its manifest, plus an `INCOMPLETE` file;
  - `d-stale` plants six files in each volume;
  - a leading "v" of the Compose version is ignored.
- All 32 live rows stay `UNVERIFIED`. M2 and the three T7 runs remain separate.

### Held files for the Lead freeze (SHA-256, uncommitted)

This file (`docs/reviews/M1/qa.md`) is reported in the completion message, because it cannot hold its own hash.

| SHA-256 | Path |
| --- | --- |
| `d69d43f52e63c9729a4b2669719f24d399c0d75e186f02e1a2952622c327a4a1` | `docs/reviews/M3/qa.md` |
| `2429cf047390dde574d0d8a07886ea536a5c5f6363908845ea05a71cdb409fb7` | `tests/acceptance/M1/common/migration.probe.ts` |
| `f8fa0c0c6d93a7752fb78246d983dadd71856990d9833c626326ce3e09b7995e` | `tests/acceptance/M1/common/storage-lock-scope.probe.ts` |
| `48ad2cf0af14f882acc6a95f4ab2322e092dbd5e0db23258f26a73f03df3720e` | `tests/host/core.mjs` |
| `d4a7ee6e35439bde712410dcedeaddb3e2373eab26ed8fdee93eab9839070aa4` | `tests/host/m1-control.mjs` |
| `cca7355e8a66fff0bde42a43bd968de46130c35da20421caf06e8bc6dd61ef8d` | `tests/host/m1-control.selftest.mjs` |
| `a4ca91b983af6cda27cfa0bdeb86df837cbc1e7618b6006d1b1a9b6abba15901` | `tests/host/m1-migration.mjs` |
| `9968d5f76d8fa444742aae43368e4cd44ad655dcad617e933065c0740cced244` | `tests/host/m1-phases.mjs` |
| `e9c8a01133f17bc21fd4a15cb944450be6800bd49f430a56f3e17688d8443d0e` | `tests/host/m1-phases.selftest.mjs` |
| `1f09ecec5586bc358b42c86690e2ea27d3a09d711ed812dc7b222ee5b412f9ee` | `tests/host/m1-storage-manifest.json` |
| `b83e41972db07aaa9270df25bafa06bca17303110f9fb547b206c910e777f0fc` | `tests/host/p5-fixture.mjs` |
| `ec338b5ab81a7f90e8d5d5cf35f5cadb580d287b98992c9e872e454fda12d0b4` | `tests/host/p5-step.mjs` |
| `bb8d0c2e5fa321d2693b0177ca1be3b7c3a30aff7073bd55b2a3770a90c52542` | `tests/host/run-m1.mjs` |
| `eccb4bd4dabfdeb131358ff2d572b86e69fff24c9d9fe764a8ce428c723a6e6f` | `tests/host/run-t1.mjs` |
| `1075773466c2ed2d30ef89f241a0f1506219a973e46309cad0bce3ed9e9ed692` | `tests/host/storage-compat-route.mjs` |
| `67e3bce0b65b71530b4c74c74ff4e577d4ec6cfc2e2d51dc7a450fe6c4230e61` | `tests/host/storage-compat-route.selftest.mjs` |
| `6862cc7b480b6cb4c0828550b32fa8558dee9b0e4ed3c8d2188657fe9a2fec6e` | `tests/host/storage-docker.mjs` |
| `f64b0b7fd319922f47266a8034e6a9e45574953831b6e96230f39307dceceddc` | `tests/host/storage-docker.selftest.mjs` |
| `77e842f5e591fc19b1349480f295c3b7053bf5c29480741c0d6f08d6d1dfb68f` | `tests/host/storage-fixture-script.mjs` |
| `56b04fdd411d1b8cd592af2bf2840578abe49b06ca8b26af21176e52b9940eca` | `tests/host/storage-fixture-script.selftest.mjs` |
| `91981e7f88d899ac8820c931e38d94fbd795e513ef8f2bd2201f3765bd9342e3` | `tests/host/storage-inventory.mjs` |
| `89fb969981082b5d9876b4ccc670727294a27fdad1d268d9c965c775f6480e11` | `tests/host/storage-inventory.selftest.mjs` |
| `b37daf431b8045a9e97b6f16986e9699c924edae1f9f2a435c1a0348e1d178ea` | `tests/host/storage-lane.mjs` |
| `03520081b7cdd2f9613414e78b1f7256c103e626085fef887f216f7a1cbe90b5` | `tests/host/storage-oracle.mjs` |
| `5b123aae4812b527b2b381860c4fb7784082dcd8a0a825fd630ec31e41f94338` | `tests/host/storage-oracle.selftest.mjs` |
| `f5dbe2363c094ff48170ddfbced14720be87aa2a46ba3667191e314ccc8582e1` | `tests/host/storage-rows.mjs` |
| `7c617aafbdc04189e2875fc4c396b0018c922c72bc0cc587af6dc17f8a49eb8b` | `tests/host/storage-rows.selftest.mjs` |

The untracked `pnpm-workspace.yaml` is preserved and not touched. No file outside `tests/**`, `docs/reviews/M1/qa.md` and `docs/reviews/M3/qa.md` was edited by QA.

## Follow-up: AC-M1-30 step 3 journal check (task `task_fbe27ed8164d`), 2026-10-21

Status: **source preparation only**, no Docker and no runtime credit. The verdict line and every section above, including the preparation addendum and its held-file table, are unchanged.

- **The open point is resolved.** The preparation addendum left one decision for the Lead: whether to check the AC-M1-30 step 3 clause "both journals committed". The Lead's scope clarification (dispatch `ctx_a97b59838a96`) decided to implement it as an **added** check inside the existing row `M1-30.common.restore`. It removes or weakens no assertion, message or row.
- **What changed (`tests/host/m1-migration.mjs`, only additions).**
  - Before the valid restore, QA records the opIds of any journal that exists.
  - After `stack:data-restore -- --from <backup>` exits 0, and before any service or old build starts, QA reads both journal records itself, through its read-mode `storage-fixture` container (ADR-012 §11).
  - `assertRestoreJournalsCommitted` then needs, in each volume:
    - the journal is present and parses;
    - `operation: "restore"` and `state: "committed"`;
    - one 32-hex opId, the same for both journals, that is not an earlier operation's opId;
    - a `backupId` that the restored manifest names;
    - one `manifestSha256` for both journals;
    - an `after` list equal to the database files in place, which is the ADR-012 §8 meaning of `committed`.
  - Exit 0 alone, or another row, is not accepted as this evidence.
  - The original exit-0 check, the byte equality with the backup, and the record text of the row are unchanged.
- **Self-test (`tests/host/m1-migration.selftest.mjs`).** One positive case and these negative controls, each failing with its own message:
  - a missing journal;
  - one journal not committed (app `swapped`);
  - an invalid (unparsable) journal;
  - an `import` journal;
  - two different opIds;
  - an earlier opId;
  - another backup id;
  - a manifest without a backup id;
  - a sidecar in place that `after` does not list.
- **Controls (host only):**
  - `node --test tests/host/m1-migration.selftest.mjs tests/host/storage-rows.selftest.mjs tests/host/storage-inventory.selftest.mjs`: 12 of 12 pass. The inventory stays 416 + 72 = 488.
  - `node --check` and an import of `m1-migration.mjs` pass.
  - `git diff --check` is clean.
  - The broad harness was not rerun, because no other dependency changed.
- **Preservation proof against the frozen `049da68`:**
  - `m1-migration.mjs` has 41 lines added and 0 removed. Every frozen line is still present, and the 8 recorded row forms are the same. The `assert` calls go from 49 to 60.
  - The self-test file has 33 lines added; the only changed line is its import line, which now imports two more names.
  - No other held file changed.
- **SHA-256 (uncommitted):** `tests/host/m1-migration.mjs` `9a96656d5027285a1b3769c0da3a4aa5d3feb53911673f55c030af68f39561f6`; `tests/host/m1-migration.selftest.mjs` `80f2fd4b5e0763775edf7e12fa9d2ad0d2f39e3bf96416e21e9bfded4cf0994f`. This report's own hash is in the completion message.
- **Still separate:** the runtime check of this clause (a real restore on the candidate), the source reviews `task_5580d3cb79c5` and `task_94536ec30f9a`, the two-round QA retry, and any Docker authorization. All 32 live rows stay `UNVERIFIED`.

## Storage-candidate retry at `a784522`: FAIL in round 1, phase `sim`, 2026-10-21

Verdict for this attempt: **FAIL**. The run stopped in round 1, phase `sim`, because one required Canvas row failed. The `sim` phase gives **394-row SIM evidence** only. The full round has **488** rows, so this round is **incomplete**: 94 round-1 rows did not run, and round 2 and legacy did not start. No M1 criterion gets full-run credit. The verdict line at the top of this file is unchanged history; this section is the current state.

Owner: a new, independent common/Blackboard QA session, Claude Code Opus 5.5 at xhigh effort. Task `task_ed3b08aa45ea`, dispatch `ctx_75f7ef7a9240`. Authority: Lead `msg_905fc87a48de` (accepted candidate and the sole Docker window) and `msg_89d8e98e00df` (Canvas handoff). This session did not write or review the product, and it did not read Author code or notes. This is not a cross-model check of Claude-authored code. Earlier attempts and their records above stay unchanged.

### Identity and command

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `a784522a3cdd9bb67453b03093092cac24e87402` (tests tree `8a94a7ff`) |
| Source reviews | Reviewer-A `a9fe7ed`, Reviewer-B `9bf6100` (both APPROVE for source) |
| Window | Lead `msg_905fc87a48de`: sole fleet-wide Docker window. Returned at 02:46Z in `msg_8ef31ba2211a`. |
| Lane | `qa-multi-r1` (storage lane `qa-multi-r1-st` not reached), port 8443, subnet `172.29.0.0/16` |
| Source | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-a784522-20261021T0217Z/source` (clean, detached, push disabled; provenance SHA-256 `2354a7eb…`) |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-a784522-20261021T0220Z` (`public/`; `private/` and `tmp/` mode 0700) |
| Phase run | `qa-multi-r1-a784522a-2026-10-21T02-21-14-202Z` |
| Time | Start 02:21:14Z; suite 02:22:00.585Z for 1,328,299 ms; parent exit 1 at 02:44:18Z |
| Tools | Node 24.21.0; Docker CLI and engine 29.9.1; Compose 5.6.0 |

```sh
cd /Users/quangnguyen/cogniate-qa-runs/m3-frozen-a784522-20261021T0217Z/source
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=/Users/quangnguyen/cogniate-qa-runs/m1-full-a784522-20261021T0220Z/tmp \
node tests/host/run-m1.mjs --sha a784522a3cdd9bb67453b03093092cac24e87402 \
  --test-sha a784522a3cdd9bb67453b03093092cac24e87402 \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-a784522-20261021T0217Z/source
```

The runner has no `--runs` option (help checked). The default `full` phase runs five phases twice and then legacy. A launcher (`claude-common-qa-tools-a784522/launch-full.sh`, SHA-256 `0b7f6141…`) ran read-only observers in their own process groups. It did not change the suite. The observer failure-path controls passed 8 of 8.

### Gates before the window (all PASS)

| Gate | Result |
| --- | --- |
| G-1 identities (ADR-012 §17 way) | macOS 27.0.1 arm64; Docker CLI 29.9.1, SHA-256 `678271184175…`; Compose 5.6.0, SHA-256 `1ec06408b809…`. All equal the bound table. The runner's own `G1-IDENTITY` row also passed. |
| QA image | `node:24.22.0-alpine3.24` present as `sha256:44fce696f38b…`. No pull. |
| Boundary | 0 containers; networks `bridge`, `host`, `none`; port 8443 free; no subnet clash; no `qa-multi-r*` resource and no exact lane volume name. |
| Protected volumes | All 7 records identical to the original baseline (file SHA-256 `219da30b…`). |
| Course files | Both ZIP SHA-256 values match. |
| Clone check (no Docker) | `node tests/host/run-m1.mjs --harness-only --provider all`: 70 of 70 self-checks, typecheck PASS, 488 rows per round (`sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70). Harness only; no product credit. |

The Docker VM was idle at the gate, so read-only calls came from its cache (the engine `SystemTime` stayed at 2026-10-20T23:02:24Z). A second read-only boundary ran when the first lane container appeared ("live start").

### Result of the `sim` phase, round 1

All 394 `sim` rows are present: **393 PASS, 1 FAIL**. There are no duplicate, unmanifested or wrong-label rows, and one SHA pair. Vitest: 392 API tests, 385 passed, 1 failed, 6 skipped by the selection (the six rows of the `snapshot-isolated` phase). The phase also has 7 browser rows and the host row `M1-02.common.default-profile` (PASS: six real profiles, three simulation profile ids refused).

| Owner | Rows in this phase | PASS | FAIL |
| --- | ---: | ---: | ---: |
| Common | 26 of 42 | 26 | 0 |
| Blackboard | 136 of 141 | 136 | 0 |
| Canvas | 232 of 233 | 231 | 1 |

| Row | Label | Result | Verdict owner | Evidence |
| --- | --- | --- | --- | --- |
| M1-17.canvas.repeat | SIM | FAIL | Canvas QA (diagnosis and verdict). This QA does not classify it. | `tests/acceptance/M1/canvas/31-canvas-grants.test.ts:95`: strict equal `1 !== 0`; duration 365 s. |

Runner host checks: `PRE`, `CLONE`, `H1`, `G1-IDENTITY`, `M3-ISOLATION` and `TEARDOWN` PASS. `ERROR` is the runner's required-row assertion for the row above. The runner then stopped the full run, which is correct.

**Not run (94 of 488 round-1 rows):** `snapshot-isolated` 6 (Blackboard `M1-37` w, y2 and `M1-29` k1–k3; Canvas `M1-37` aa), `snapshot-upgrade` 6 (`M1-38.common` h1–h5 and `M1-41.common.j-snapshot`), `migration` 12 (AC-M1-23 4, AC-M1-30 7 and `M1-41.common.j-migration`) and `storage` 70 (AC-M1-41). Round 2 (488 rows) and all legacy groups did not start.

Common and Blackboard rows of this phase, by criterion (round 1 `sim` only; each needs a second complete round):

| AC | Common | Blackboard |
| --- | --- | --- |
| M1-01 | 1 PASS | 1 PASS |
| M1-02 | 1 PASS | – |
| M1-03 | 10 PASS | – |
| M1-04 | – | 1 PASS |
| M1-05 | – | 15 PASS |
| M1-06 | – | 2 PASS |
| M1-07 | 1 PASS | 4 PASS |
| M1-10 | – | 1 PASS |
| M1-11 | – | 9 PASS |
| M1-12 | 1 PASS | 4 PASS |
| M1-13 | – | 4 PASS |
| M1-14 | 1 PASS | 2 PASS |
| M1-15 | 1 PASS | 2 PASS |
| M1-18 | – | 2 PASS |
| M1-19 | 1 PASS | 1 PASS |
| M1-21 | 1 PASS | 1 PASS |
| M1-22 | – | 2 PASS |
| M1-23 | 4 not run (`migration`) | – |
| M1-24 | 2 PASS | – |
| M1-25 | 1 PASS | 1 PASS |
| M1-27 | – | 1 PASS |
| M1-28 | – | 2 PASS |
| M1-29 | – | 18 PASS; k1–k3 not run (`snapshot-isolated`) |
| M1-30 | 7 not run (`migration`) | – |
| M1-31 | – | 2 PASS |
| M1-33 | – | 4 PASS |
| M1-34 | – | 14 PASS |
| M1-35 | 3 PASS | – |
| M1-36 | – | 5 PASS |
| M1-37 | – | 30 PASS, including v2, v5, v7, v9, v11, v12, x1, x2, y1, z1–z5; w and y2 not run |
| M1-38 | i5 PASS; h1–h5 not run (`snapshot-upgrade`) | 8 PASS, including i3 and i4 |
| M1-39 | 1 PASS | – |
| M1-41 | 72 not run (`storage` 70, `migration` 1, `snapshot-upgrade` 1) | – |

Per-row records (id, AC, owner, phase, status, label, both SHAs, run id, command, start time, artifact path): `public/round-1-rows.json` (SHA-256 `075603cb…`) and `public/round-1-summary.json` (`7ca487fe…`).

### Health, images and timings

- Health after the suite: app and LTI service `profile: default`, `knobs: []`; LTI `simulation_profiles: []`.
- Images (sampler digests): `node@sha256:44fce696…` for the app, LTI service and the simulation helpers; `erseco/alpine-moodle@sha256:3a310197…`; `postgres@sha256:721873c3…`; `caddy@sha256:d8542f48…`; local `qa-multi-r1-e2e@sha256:49e44f58…` (created 2026-10-16, not rebuilt). The sampler saw one Compose project at most and no other project.
- Setup: `npm ci` 1.3 s, `stack:up` 38.8 s, `seed` 3.4 s.
- Host control: 32 `m1-restart` actions, all exit 0, 5,924–8,597 ms (median 6,066 ms); 6 `m1-profile` actions, 5,936–6,472 ms. These restarts include the storage preflight (76 `storage_preflight` lines with `state: OK`). No common or Blackboard lease or deadline row failed in this phase. This QA does not judge whether the timings affect the Canvas row above.

### Privacy (AC-M3-07 method)

- The capability union holds 1,300 captured values: `id_token` 250, `state` 250, `ltik` 187, `service_key` 117, `nonce` 11, `play_id` 5, `runtime_token` 4, `api_key` 1, `picker_id` 1 and M1 raw 474. It stays private (`private/watch`, 0700). The scan also used 12 stack values.
- The independent scan found 0 hits in 11 raw service, simulator and gate logs and in 680 public files (the phase artifacts and the observer and run-root files). It found 0 JWT-shaped strings. The runner's own scan also found 0 hits (`public/secret-scan.json`, SHA-256 `f9622f23…`).
- The Playwright traces and screenshots of the 7 Canvas browser rows stay in the private phase clone. Canvas QA owns their redaction.

### Isolation and cleanup (AC-M3-06)

- The runner teardown removed only resources from its ownership record. 0 containers, 0 lane volumes and 0 lane networks were left. `M3-ISOLATION` and `TEARDOWN` PASS.
- The independent after-boundary read found 0 containers, no `qa-multi-r*` resource, port 8443 free and no subnet clash. All **7 protected volume records are identical to the original baseline** (7 of 7, before, live start and after). Docker memory (8,319,238,144 bytes) and 12 CPUs are unchanged. No owned process remains.
- The raw outer comparison (`boundary.mjs --compare boundary-before.json`, `public/boundary-after.summary.json`) exited 1 with one problem: `non-owned network missing: bridge`. It is not a PASS. Explanation, recorded apart from that result: the before read came from the idle-VM cache (`bridge` `2ab29a9c…`). The VM started at the first mutating call and created a new bridge at 02:21:14.816Z (`0a08578a…`). The live-start and after reads have the same bridge ID, so the bridge did not change from live start to the end. `host` and `none` are unchanged. The frozen runner's `M3-ISOLATION` PASS is a separate check (containers and volumes only).
- The private phase clone `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-a784522a-2026-10-21T02-21-14-202Z` is kept, mode 0700, for Canvas QA diagnosis.

### Evidence

- Phase artifacts (redacted): `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-a784522-20261021T0217Z/source/tests/host/artifacts/qa-multi-r1-a784522a-2026-10-21T02-21-14-202Z/`: `m1-case-results.json` (`7a9309be…`), `summary.json` (`448217ea…`), `evidence/sim/m1-vitest-results.json` (`6f839e1c…`), `m1-identity.json`, `images.json`, `g1-client-identity.json`, `lane-boundary.json`, `lane-ownership.json`, `protected-volumes-before/after.json`, `cmd/`, `host-actions/`, `service-logs/`, `docker-logs/`.
- Run root `public/`: `host-identity.json` (`c25696d1…`), `boundary-before.json` (`33f0b3db…`), `boundary-live-start.json` (`e7e41537…`), `boundary-after.json` (`a12575ec…`), `baseline-vs-original-before.json` and `-after.json`, `sampler/lane-containers.json` (`af62b713…`), `command.txt` (`732d6277…`), `full-run-exit.json`.
- Canvas QA received the exact paths directly (`msg_7250eafc816e`) and the Lead in `msg_8ef31ba2211a`.

### Correction to the storage-lock diagnostic record above

The diagnostic table above says "A's row was lost". That claim is not accurate. The oracle found that B acquired the lock while A held it, and A then could not commit. No row that A committed successfully was lost. The DELETE-mode discrepancy and any Docker-update cause remain unknown. The earlier text stays as history.

### Next

Canvas QA diagnoses `M1-17.canvas.repeat`. Any repair needs the Lead's disposition, a new frozen candidate or an explicit decision, and a new window. Then both complete 488-row rounds and all legacy groups must run again from a fresh clone. This attempt and its not-run phases stay in the record. All 32 live rows stay `UNVERIFIED`.

### Correction to the retry record at `a784522` (task `task_fa95996d3ee3`), 2026-10-21

- **Duration unit.** The failed-row table above says "duration 365 s" for `M1-17.canvas.repeat`. That is wrong. Vitest reports `duration` in milliseconds. The value in `evidence/sim/m1-vitest-results.json` is `364.96579199999996`, so the duration is about **365 ms**. The Lead checked the same file independently. The text above stays as history.
- **Canvas diagnosis (not performed by this QA).** Canvas QA owns the diagnosis of this row (`msg_6245a961f22b`, as relayed by the Lead). It reports that the test oracle used an inclusive timestamp and counted the original redemption in the same millisecond. It reports no second redemption and no remote call. The Lead authorized only a one-case QA repair (`msg_415316b9ae64`). No product repair is authorized, and the repair gives no runtime rerun credit.
- **Unchanged.** The attempt stays **FAIL**. The row stays FAIL in this run. The 94 not-run round-1 rows, round 2 and all legacy groups still need a new window.
