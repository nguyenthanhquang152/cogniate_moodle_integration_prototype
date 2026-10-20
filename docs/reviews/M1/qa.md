Verdict: FAIL — full M1 acceptance is incomplete; execution is on HOLD
Round: execution dispatch 1, repair checkpoint, 2026-10-20

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
