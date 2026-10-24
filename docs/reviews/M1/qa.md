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

## Retry at `55c33a3`: FAIL in round 1, phase `snapshot-upgrade`, 2026-10-21

Verdict for this attempt: **FAIL**. The run stopped in round 1, phase `snapshot-upgrade`, because the common row `M1-38.common.h1` failed. Before that row, `sim` (394 rows) and `snapshot-isolated` (6 rows) passed completely. Round 1 is **incomplete**: 87 of its 488 rows did not run. Round 2 and legacy did not start. No M1 criterion gets full-run credit. The verdict line at the top of this file and all sections above stay as history.

Owner: a new, independent common/Blackboard QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort. Task `task_ed3b08aa45ea`, dispatch `ctx_4446d0034a39` (a retry of `ctx_75f7ef7a9240`). Authority: Lead `msg_405608b347b5` (candidate, sole Docker window, mandatory live boundary). That message supersedes the model, SHA, count and window text of the original task. This session did not write the product, the tests of this candidate, or any review, and it did not read Author code or notes. The evidence of earlier sessions is not claimed here.

### Identity and command

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `55c33a3e2d60670b5e759a79144c96bd213fca1f` (tests tree `778bdb2c`); product code equals `a784522` |
| Source reviews | Storage: Reviewer-A `a9fe7ed`, Reviewer-B `9bf6100`. One-case Canvas repair: Reviewer-A `28b2fd4`, Reviewer-B `bea9f0e` |
| Window | Lead `msg_405608b347b5`: sole fleet-wide Docker window. Returned at 03:51Z in `msg_294eb3092b5d`. |
| Lane | `qa-multi-r1` (storage lane `qa-multi-r1-st` not reached), port 8443, subnet `172.29.0.0/16` |
| Source | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-55c33a3-20261021T0315Z/source`: fresh `git clone --no-hardlinks`, detached at the exact SHA, 0 status lines, no `.env`, push URL disabled. `npm --prefix tests ci` exit 0. Provenance: `provenance.json` beside the source. |
| Clone check (no Docker) | `node tests/host/run-m1.mjs --harness-only --provider all`: 70 of 70 self-checks, typecheck PASS, 488 rows per round (`sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70). Harness only; no product credit. `run-m1.mjs` SHA-256 `bb8d0c2e…` equals the `a784522` runner. |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-55c33a3-20261021T0324Z` (`public/`; `private/` and `tmp/` mode 0700) |
| Phase runs | `sim` `qa-multi-r1-55c33a3e-2026-10-21T03-25-15-066Z`; `snapshot-isolated` `…-03-48-17-759Z`; `snapshot-upgrade` `…-03-49-53-008Z` |
| Time | Runner start 03:25:14Z; `sim` identity 03:48:11.711Z; h1 started 03:50:34.459Z, 2,930 ms; parent exit 1 at 03:51:00Z |
| Tools | Node 24.21.0; Docker CLI and engine 29.9.1; Compose 5.6.0 |

```sh
cd /Users/quangnguyen/cogniate-qa-runs/m3-frozen-55c33a3-20261021T0315Z/source
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=/Users/quangnguyen/cogniate-qa-runs/m1-full-55c33a3-20261021T0324Z/tmp \
node tests/host/run-m1.mjs --sha 55c33a3e2d60670b5e759a79144c96bd213fca1f \
  --test-sha 55c33a3e2d60670b5e759a79144c96bd213fca1f \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-55c33a3-20261021T0315Z/source
```

The runner has no `--runs` option (help checked). The default `full` phase runs five phases twice and then legacy. A new external launcher ran the live boundary, then this command, then the end boundary. It did not change the frozen suite.

### Live boundary before the run (W1–W3, all PASS)

New external tools: `/Users/quangnguyen/cogniate-qa-runs/claude-common-qa-tools-55c33a3` (new ledger; hashes in `public/tool-hashes.txt`). The tools do not edit runner bytes.

| Step | Result | Evidence |
| --- | --- | --- |
| Pre-wake (not boundary evidence) | The cached view had Docker `SystemTime` 02:49:16.608Z, about 36 minutes behind the host, and the bridge `0a08578afbf9` of the last run. | `public/w1-wake.json` (`preWake`) |
| W1 wake | One container on cached image `sha256:44fce696…`, `--pull never --rm --network none`, label `org.cogniate.qa=wake` only, unique `qa-wake-*` name outside the lane prefix. Exit 0 in 1,230 ms. Zero wake containers remain. | `w1-wake.json` SHA-256 `fb72eee1…` |
| W2 liveness | `docker info` answered. Two advancing reads; worst-case skew within 5 s. | `w2-liveness.json` `06ce97ee…` |
| W3 formal start | `runStartSecond` 1792553112 (live `SystemTime` 03:25:12.190Z). Identities match the bound values: macOS 27.0.1 arm64, CLI 29.9.1 `678271…`, Compose 5.6.0 `1ec064…`, image present. Engine 29.9.1, `MemTotal` 8,319,238,144, `NCPU` 12, engine ID `2c7a7bff…`; settings normalized SHA-256 `8d959def…`. Networks: bridge `bd7a597c5ae1` (new after the wake), host `b9266a37c45a`, none `d2863b51ad44`. 0 containers. 7 volumes; all 7 protected FULL records equal the original baseline (file `219da30b…`). Both lanes fresh by exact names and labels; port 8443 free; no subnet clash. | `w3-formal-start.json` `546e6e31…` |
| Gate message | Sent to the Lead before the runner started. | `msg_ecc8aad1e9a9`, `msg_13b3297a351c` |

Focused synthetic controls (Docker stub, no Docker): 30 of 30 PASS. A stale, frozen, failed or 6-second-skewed clock, a missing image, a remaining or failed wake container, an exact lane name, a lane label, a wrong identity hash, a protected record that differs from the original, and a missing protected volume all **block** the start. A stale end clock, a replaced bridge, a changed protected FULL record, changed memory, changed settings, a lane leftover, a new unrelated volume, a changed unrelated container, a sampler with two bridge Ids or skew, and a non-formal start record all **reject** the end. The positive cases pass. These are harness checks only.

### Result of round 1

| Phase | Rows | Result | Run id |
| --- | ---: | --- | --- |
| `sim` | 394 of 394 | 394 PASS (common 26, Blackboard 136, Canvas 232) | `…-03-25-15-066Z` |
| `snapshot-isolated` | 6 of 6 | 6 PASS (Blackboard `M1-37` w, y2; `M1-29` k1–k3; Canvas `M1-37` aa) | `…-03-48-17-759Z` |
| `snapshot-upgrade` | 1 of 6 | `M1-38.common.h1` FAIL | `…-03-49-53-008Z` |
| `migration` | 0 of 12 | not run | – |
| `storage` | 0 of 70 | not run | – |

All 401 recorded rows have one SHA pair and the label `SIM`. There are no duplicate, unmanifested or wrong-label rows. The runner's `sim` aggregate was 400 PASS; `snapshot-isolated` 12 PASS. Canvas rows keep Canvas QA's separate verdict; this QA does not judge them.

| Row | Label | Result | Classification | Evidence |
| --- | --- | --- | --- | --- |
| M1-38.common.h1 | SIM | FAIL | QA oracle defect in a common QA file (no product defect shown) | `tests/acceptance/M1/common/snapshot-migration.probe.ts:32` in `preserve()`: `assert.equal(canvas.token.services.serviceKey, state.canvasKey)` got two different 43-character keys (redacted). Seed stage on the pinned 011 build `9f96f7b`. |

Diagnosis:

- `canvasPlay` (`tests/acceptance/M1/canvas/canvas.ts:106`) launches with `resourceLinkId: unique('rl')` on every call. `openPlay` (`common/course.ts:43`) uses `resourceLinkId: pub.id`.
- The LTI contract (`lti-service-api.md:218` and §9.14) makes `services.serviceKey` stable per (platform, deployment, context, resource link). Two Canvas launches with two resource links must give two keys. The product followed the contract.
- The redacted service log agrees. The second Canvas launch made a new app attempt (`att_c_9O0…`, first was `att_snWv…`). The second Blackboard launch reused `att_crMi5…`. No `deployment_updated` or generation event touched the Canvas platform `plt_5rZC…` between the two launches.
- The Blackboard key check (line 33) and the `preserve()` calls of h2–h5 did not run. The defect is deterministic.

Proposed smallest repair (held for Lead authority; no repository edit was made): in `snapshot-migration.probe.ts`, pass a stable resource link to the two Canvas launches that the key comparison uses: line 53 `canvasPlay(a, canvasPub, { resourceLinkId: canvasPub.id })` and line 31 `canvasPlay(state.a, state.canvasPub, { resourceLinkId: state.canvasPub.id })`. This mirrors `openPlay`. Every assertion, id, title and inventory stays the same, and the check then tests the contracted tuple. It needs a new frozen SHA, independent review and a new window.

**Not run (87 of 488 round-1 rows):** `snapshot-upgrade` 5 (`M1-38.common` h2–h5 and `M1-41.common.j-snapshot`), `migration` 12 (AC-M1-23 4, AC-M1-30 7, `M1-41.common.j-migration`) and `storage` 70 (AC-M1-41). Round 2 (488 rows) and all legacy groups did not start.

Common and Blackboard rows of round 1, by criterion (each needs a second complete round):

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
| M1-29 | – | 21 PASS, including k1–k3 |
| M1-30 | 7 not run (`migration`) | – |
| M1-31 | – | 2 PASS |
| M1-33 | – | 4 PASS |
| M1-34 | – | 14 PASS |
| M1-35 | 3 PASS (profile off/on routes) | – |
| M1-36 | – | 5 PASS |
| M1-37 | – | 32 PASS, including v2, v5, v7, v9, v11, v12, w, x1, x2, y1, y2, z1–z5 |
| M1-38 | i5 PASS; h1 FAIL; h2–h5 not run | 8 PASS, including i3 and i4 |
| M1-39 | 1 PASS | – |
| M1-41 | 72 not run | – |

Per-row records (id, AC, owner, phase, status, label, both SHAs, run id, command, start time, artifact path): `public/round-1-rows.json` (SHA-256 `60a53234…`) and `public/round-1-summary.json` (`2b8cf323…`).

### Health, images and timings

- Health after each phase: app and LTI service `profile: default`, `knobs: []`; LTI `simulation_profiles: []`.
- Images (sampler): `node:24-alpine` `sha256:44fce696…` (app, LTI service, simulation helpers), `erseco/alpine-moodle:v5.2.4` `sha256:3a310197…`, `postgres:16-alpine` `sha256:721873c3…`, `caddy:2-alpine` `sha256:d8542f48…`, local `qa-multi-r1-e2e:1.56.0` (one image remains, created 2026-10-16; not rebuilt; no dangling image). The sampler saw at most one Compose project and no other project.
- Host control: `sim` 32 `m1-restart` 5,925–8,580 ms (median 6,446 ms) and 6 `m1-profile` 5,942–6,468 ms, all exit 0; `snapshot-isolated` 1 restart 6,084 ms and 2 profile actions about 6,037 ms. No common or Blackboard lease or deadline row failed.
- Sink capture (AC-M1-12, for the Canvas judge): `service-logs/sink.jsonl` was complete in each phase: `service_started` and `service_stopping` present, trailing newline, zero `sink_hit`. `sim`: 03:26:03.386Z–03:48:01.274Z, SHA-256 `b05a2e01…`.

### Privacy (AC-M3-07 method)

- The private capability union holds 1,335 captured values and 36 stack values (`private/watch`, 0700).
- 0 hits in 32 raw service, simulator and gate logs. 0 hits and 0 JWT-shaped strings in 826 public files, which include the phase artifacts, observer logs and the 3 binary public files (byte scan). `public/secret-scan.json` SHA-256 `c62c63ba…`.
- Private browser artifacts (153 files: 110 decompressed trace entries and 15 screenshots) stay in the 0700 phase clones. They contain captured values, as expected for raw traces; they are not shared evidence. Canvas QA owns their redaction.

### Isolation and cleanup (AC-M3-06)

- The runner teardown removed only resources from its ownership record in all three phases. `M3-ISOLATION` and `TEARDOWN` PASS.
- W4 live end boundary at 03:51:05.601Z (`w4-end.json` `9c5483db…`) and the strict W3-to-end comparison (`w4-compare.json` `05e2ed79…`) PASS, with zero problems. Bridge `bd7a597c5ae1`, host and none have the same Ids. All 7 protected FULL records equal W3 and the original baseline. Memory, CPUs, engine identity and settings are unchanged. 0 containers and 0 lane resources remain.
- Sampler (103 samples): one bridge Id, zero clock-skew violations, zero failed reads (`sampler/lane-containers.json` `3e3c0127…`).
- No owned process remains. The private phase clones are kept at mode 0700 for review.

### Evidence

- Phase artifacts (redacted): `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-55c33a3-20261021T0315Z/source/tests/host/artifacts/<run id>/`. For h1: `m1-case-results.json` (`f8937f73…`), `summary.json` (`a6bcdc62…`), `evidence/snapshot-seed/m1-vitest-results.json` (`c20d8a25…`), `m1-identity.json` (`7f20ac0a…`), `lane-ownership.json` (`a1cf37df…`), `service-logs/`.
- Run root `public/`: `w1-wake.json`, `w2-liveness.json`, `w3-formal-start.json`, `w4-end.json`, `w4-compare.json`, `sampler/`, `secret-scan.json`, `round-1-rows.json`, `round-1-summary.json`, `command.txt`, `launcher.log`, `full-run-exit.json`.
- The Lead and Canvas QA received the round-1 `sim` artifact identity (`msg_1681eae62d2a`, `msg_4c6ec97cc9bb`) and the failure report (`msg_294eb3092b5d`).

### Next

The Lead decides on the one-file common repair above. A repair needs a new frozen candidate, independent source review and a new window. Then both complete 488-row rounds and all legacy groups must run again from a fresh clone. This attempt and its not-run rows stay in the record. All 32 live rows stay `UNVERIFIED`.

### Correction: private clone permissions (Lead `msg_f305b4f51323`), 2026-10-21

- **The earlier claim was wrong.** My round-1 `sim` milestone message (`msg_1681eae62d2a`) called the `sim` phase clone `(0700)`. I did not check that, and it was not true then. Canvas QA found the discrepancy (`msg_e0a0d3370c7d`).
- **Before (observed):**
  - The three phase clone roots of this run were `drwxr-xr-x` (0755); I saw this at about 03:52Z.
  - In each clone, `tests/acceptance/artifacts`, its `playwright` and `playwright-report` folders, `tests/e2e/artifacts`, `tests/test-results` and `tests/playwright-report` were 0755.
  - `captured-secrets.jsonl` was 0644 (one per clone).
  - All `*.raw.json`/`*.raw.jsonl` files (479, 35 and 9) were already 0600, and `infra/.logs` was already 0700.
  - The `-storage-private` folder was already 0700.
  - The Lead reports that the home folder (0750 with an ACL) blocks traversal by other users, so no disclosure is demonstrated.
- **Change (modes only):**
  - At about 03:52Z, the three clone roots were set to 0700.
  - Under `msg_f305b4f51323`, every directory in the four artifact trees was set to 0700: 17, 7 and 7 directories were not 0700 before.
  - Each `captured-secrets.jsonl` was set to 0600.
  - No content, tracked git byte, unrelated path, shared QA root or other clone changed. In each clone, `git rev-parse HEAD` and the `git status` digest are the same before and after.
- **After (verified):** in all three clones, the root is 0700, zero artifact directories are not 0700, and zero raw or captured-secret files are not 0600 (480, 36 and 10 files are 0600). The owner is the QA user. Files: `public/permission-before.txt` (SHA-256 `5308bea3…`) and `public/permission-after.txt` (`3c3adf3a…`), with paths and modes only.
- The statements above in this section ("kept at mode 0700", "stay in the 0700 phase clones") are true only after this correction.

## Retry at `82e2dab`: FAIL in round 1, phase `snapshot-upgrade` (backup oracle), 2026-10-21

Verdict for this attempt: **FAIL**. Round 1 `sim` (394 rows) and `snapshot-isolated` (6 rows) passed completely. In `snapshot-upgrade`, the seed stage of `M1-38.common.h1` passed, so the `82e2dab` repair works. Then the host oracle `inspectBackup` stopped the phase with `Manifest contains only the old migration names`. This is a defect in a common QA host file; no product defect is shown. Round 1 is **incomplete**: 88 of its 488 rows did not get a result. Round 2 and legacy did not start. No M1 criterion gets full-run credit. All sections above stay as history.

Owner: a new, independent common/Blackboard QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort. Task `task_ed3b08aa45ea`, dispatch `ctx_b36c97b882dd` (a retry of `ctx_4446d0034a39`). The task text calls this role "Codex QA, GPT-6-Astra"; Lead `msg_9c661cdcd106` supersedes that model, SHA, count and window text. Authority: Lead `msg_9c661cdcd106` (candidate, sole Docker window, mandatory live boundary) and `msg_54ccb0b5da19` (bounded permission correction, below). This session did not write the product, the tests of this candidate or any review. It did not read Author code or notes before the run. It does not claim the evidence of earlier sessions.

### Identity and command

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `82e2dab6d26915c90070a4aae8ac0c4472706c2d` (tests tree `51b2e50e`). Product code equals `a784522`. Since `55c33a3`, only `tests/acceptance/M1/common/snapshot-migration.probe.ts` changed in `tests/` (SHA-256 `4b127632…`, as the Lead gave). |
| Source reviews | Snapshot-key repair: Reviewer-A `dee08f4`, Reviewer-B `c9b6852`. Storage and Canvas repeat approvals as in the `55c33a3` section. |
| Window | Lead `msg_9c661cdcd106`: sole fleet-wide Docker window. Returned at 04:55Z in `msg_50cf6f48d777`. |
| Lane | `qa-multi-r1` (storage lane `qa-multi-r1-st` not reached), port 8443, subnet `172.29.0.0/16` |
| Source | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-82e2dab-20261021T0418Z/source`: `git clone --no-hardlinks` under umask 077, then detached at the exact SHA. 0 status lines, no `.env`, push URL disabled. `npm --prefix tests ci` exit 0. Provenance: `provenance.json` beside the source. |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-82e2dab-20261021T0428Z`; the root, `public/`, `private/` and `tmp/` are 0700 (observed with `stat`). |
| Phase runs | `sim` `qa-multi-r1-82e2dab6-2026-10-21T04-29-22-551Z`; `snapshot-isolated` `…-04-52-21-763Z`; `snapshot-upgrade` `…-04-54-03-177Z` |
| Time | Runner start 04:29:22Z; `sim` identity 04:52:15.816Z; `snapshot-isolated` identity 04:53:58.942Z; parent exit 1 at 04:55:18Z |
| Tools | Node 24.21.0; Docker CLI and engine 29.9.1; Compose 5.6.0 |

```sh
cd /Users/quangnguyen/cogniate-qa-runs/m3-frozen-82e2dab-20261021T0418Z/source
umask 022
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=/Users/quangnguyen/cogniate-qa-runs/m1-full-82e2dab-20261021T0428Z/tmp \
node tests/host/run-m1.mjs --sha 82e2dab6d26915c90070a4aae8ac0c4472706c2d \
  --test-sha 82e2dab6d26915c90070a4aae8ac0c4472706c2d \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-82e2dab-20261021T0418Z/source
```

The runner has no `--runs` option (help checked). The default `full` phase runs the five phases twice and then legacy. An external launcher ran the live boundary, this command and the end boundary. It did not change the frozen suite.

### Preparation and the bounded permission correction

- **Harness-only check under umask 077: 69 of 70.** The one failure is `storage-fixture-script.selftest.mjs:103` (`Mode kept`, 384 !== 416). The self-test writes its own fixture with mode 0640, and umask 077 masks it to 0600. Log: `harness-only.log`.
- **The same check under umask 022: 70 of 70**, typecheck PASS, 488 rows per round (`sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70). Log: `harness-only-umask022.log`.
- Both results are preparation evidence only. They give no product credit. The full path does not run these self-checks.
- **Runtime risk found before launch.** The runner clones each phase under `~/cogniate-qa-runs/`. Under umask 077 those trees become 0700/0600. The Moodle container runs as `nobody` (uid 65534; `infra/moodle/SPIKE-NOTES.md:30`). It mounts `infra/moodle/php`, `infra/.data/fixtures` and `infra/.data/backups` from the clone. All earlier validated runs used umask 022.
- **Lead decision (option A, `msg_54ccb0b5da19`):**
  - The launcher, observers, scans, source root, run root and private evidence use umask 077.
  - Only the frozen runner child uses umask 022.
  - A narrow observer (`clone-guard.mjs`) sets each new owned phase clone **root** to 0700. It matches the exact name `qa-multi-r1(-st)-82e2dab6-<ISO time>`, the same owner, a real directory and a birth time after the run start. It changes the mode through an `O_NOFOLLOW` descriptor that must be the same inode.
  - At a safe checkpoint (the phase `summary.json` exists), it sets captured-secret files to 0600.
  - Inner modes stay unchanged. Any mismatch fails closed and leaves the path untouched.
- **Ancestor boundary (checked before the runner):** home folder 0750, `quangnguyen:staff`. Group `staff` has only `quangnguyen` and `root` of 133 accounts. The ACL is only `group:everyone deny delete`. File: `public/ancestor-boundary.json` (SHA-256 `90aa3afb…`).
- **Tools:** `/Users/quangnguyen/cogniate-qa-runs/claude-common-qa-tools-82e2dab`, a new ledger.
  - The tools are byte copies of the validated `55c33a3` set (`ledger/source-hashes-55c33a3.txt`).
  - Changed: `launch-full.sh` `2a7a6827…` (session and dispatch ids, umask split, ancestor gate, guard start), `progress.sh` `a8688706…` and `watch-events.sh` `0f47679a…` (paths, guard alert).
  - New: `clone-guard.mjs` `9ebcc92e…`. Its focused temp-folder controls passed 25 of 25. The existing boundary controls passed 30 of 30 (Docker stub).
  - These are harness checks only.

### Live boundary before the run (W1–W3, all PASS)

| Step | Result | Evidence |
| --- | --- | --- |
| Pre-wake (not boundary evidence) | Host 04:29:07.422Z; cached Docker `SystemTime` 03:58:10.554Z (about 31 minutes behind); bridge `bd7a597c5ae1` of the last run; 0 containers. | `public/w1-wake.json` (`preWake`) |
| W1 wake | `qa-wake-20261021042908-d7b83e11` on cached image `sha256:44fce696…`, `--pull never --rm --network none`, label `org.cogniate.qa=wake` only. Exit 0 in 1,216 ms. Zero wake containers remain. | `w1-wake.json` SHA-256 `e1dfc8a6…` |
| W2 liveness | `docker info` answered. Two advancing reads; worst skews 75 ms and 103 ms. | `w2-liveness.json` `1c30c012…` |
| W3 formal start | `runStartSecond` 1792556959 (live `SystemTime` 04:29:19.676Z). Identities match the bound values: macOS 27.0.1 arm64, CLI 29.9.1 `678271…`, Compose 5.6.0 `1ec064…`, image present. Engine 29.9.1, `MemTotal` 8,319,238,144, `NCPU` 12, engine ID `2c7a7bff…`; settings normalized SHA-256 `8d959def…`. Networks: bridge `8ab2567c7b8f` (new after the wake), host `b9266a37c45a`, none `d2863b51ad44`. 0 containers. 7 volumes; all 7 protected FULL records equal the original baseline (file `219da30b…`). Both lanes fresh by exact names and labels; port 8443 free; no subnet clash; 0 problems. | `w3-formal-start.json` `1550b015…` |
| Gate message | Sent to the Lead before the runner started. | `msg_d2cb3ba7b2a2`, details `msg_97e12666b1e7` |

### Result of round 1

| Phase | Rows | Result | Run id |
| --- | ---: | --- | --- |
| `sim` | 394 of 394 | 394 PASS (common 26, Blackboard 136, Canvas 232) | `…-04-29-22-551Z` |
| `snapshot-isolated` | 6 of 6 | 6 PASS (Blackboard `M1-37` w, y2; `M1-29` k1–k3; Canvas `M1-37` aa) | `…-04-52-21-763Z` |
| `snapshot-upgrade` | 0 of 6 | Stopped by a runner error after the h1 seed stage passed | `…-04-54-03-177Z` |
| `migration` | 0 of 12 | not run | – |
| `storage` | 0 of 70 | not run | – |

- All 400 recorded rows have one SHA pair (`82e2dab…` for product and tests) and the label `SIM`. There are no duplicate, unmanifested or wrong-label rows.
- The runner's `sim` aggregate is 400 PASS (394 rows plus `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION`, `TEARDOWN`). The `snapshot-isolated` aggregate is 12 PASS.
- In `sim`, Vitest ran 21 files: 386 passed, 0 failed. The 6 tests that it did not select are exactly the six `snapshot-isolated` rows; they passed in the next phase. The `sim` phase also has 7 browser rows and 1 host row (`M1-02.common.default-profile`).
- Canvas rows keep Canvas QA's separate verdict. This QA does not judge them.

| Row or step | Label | Result | Classification | Evidence |
| --- | --- | --- | --- | --- |
| M1-38.common.h1 (seed stage on the pinned `9f96f7b` build) | SIM | PASS in the phase summary; **no row credit**, because the phase stopped before it published its rows | – | `summary.json` aggregate; `evidence/snapshot-seed/m1-vitest-results.json` (1 passed, 0 failed) |
| `inspectBackup` after `stack:data-backup` | – | FAIL (runner `ERROR`) | QA oracle defect in a common QA host file; no product defect shown | `tests/host/m1-migration.mjs:84`, called at `:295`; actual `[]`, expected the 14 old migration names |

Diagnosis:

- The backup manifest (private, `qa-m1-snapshot-private-OulCFv/original/manifest.json`, mode 0600, not shared) stores `migrations` as an object keyed by database file: `lti-service/lti.db` with 4 names and `cogniate-app/cogniate.db` with 11 names. The union equals the 14 expected names exactly. No `012` name is present.
- `inspectBackup` (lines 80–82) collects only arrays that sit directly under a key that matches `/migration/i`. An object of arrays therefore gives `[]`.
- Every earlier check of `inspectBackup` passed: the manifest file was found, it names the compose project and a backup id, each backup file has the size and SHA-256 of the stopped-volume snapshot, and the manifest names every old migration.
- The product has written this per-database shape since the pinned old build `9f96f7b` (`infra/scripts/stack-data.mjs`). The candidate still writes it (`stack-data.mjs:145` legacy, `:660` volume). `M1.md:211` requires the old `schema_migration` names in the manifest; it does not fix the JSON shape.
- The QA self-test fixture used a flat array (`m1-migration.selftest.mjs:21`), so the harness-only check could not find the defect. No earlier attempt reached this check.
- The same oracle also runs in the `migration` phase (`m1-migration.mjs:200` and `:211`). AC-M1-23 would fail there in the same way.

Proposed smallest repair (held for Lead authority; no repository edit was made):

- In `inspectBackup`, when a `/migration/i` key holds an object, also read its array values.
- When the object keys equal the ledger keys, also require equal names **for each database**. This is stronger than today's check.
- Keep the union equality and every other assertion.
- Add a per-database fixture and a negative case (one unexpected name under one database) to `m1-migration.selftest.mjs`.
- The repair needs a new frozen SHA, independent review and a new window.

**Not run (88 of 488 round-1 rows):** `snapshot-upgrade` 6 (`M1-38.common` h1–h5 and `M1-41.common.j-snapshot`), `migration` 12 (AC-M1-23 4, AC-M1-30 7, `M1-41.common.j-migration`) and `storage` 70 (AC-M1-41). Round 2 (488 rows) and all legacy groups did not start.

Common and Blackboard rows of round 1, by criterion (each needs a second complete round):

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
| M1-29 | – | 21 PASS, including k1–k3 |
| M1-30 | 7 not run (`migration`) | – |
| M1-31 | – | 2 PASS |
| M1-33 | – | 4 PASS |
| M1-34 | – | 14 PASS |
| M1-35 | 3 PASS (profile off/on routes) | – |
| M1-36 | – | 5 PASS |
| M1-37 | – | 32 PASS, including v2, v5, v7, v9, v11, v12, w, x1, x2, y1, y2, z1–z5 |
| M1-38 | i5 PASS; h1–h5 no row (h1 seed stage passed, then the phase stopped) | 8 PASS, including i3 and i4 |
| M1-39 | 1 PASS | – |
| M1-41 | 72 not run (70 `storage`, `j-snapshot`, `j-migration`) | – |

Per-row records (id, AC, owner, phase, status, label, both SHAs, run id, command, start time, artifact path): `public/round-1-rows.json` (SHA-256 `871a73a4…`) and `public/round-1-summary.json` (`dfb130c3…`).

### Health, images and timings

- Health after `sim` and `snapshot-isolated`: app and LTI service `profile: default`, `knobs: []`; LTI `simulation_profiles: []`. After the `snapshot-upgrade` error the services were already stopped, so its identity file has no health value.
- Images (sampler, repo digests): `node:24-alpine` `sha256:44fce696…`, `erseco/alpine-moodle:v5.2.4` `sha256:3a310197…`, `postgres:16-alpine` `sha256:721873c3…`, `caddy:2-alpine` `sha256:d8542f48…`. The local `qa-multi-r1-e2e:1.56.0` had a different image id in each phase (`fa79781f…`, `0a10ad2b…`, `009b3499…`), all with the creation time 2026-10-16T13:01:12Z. The previous attempt shows the same pattern. Only `009b3499…` remains, and there are 0 dangling images. The sampler saw at most one Compose project and no other project.
- Host control:
  - `sim`: 32 `m1-restart` actions, 5,936–8,628 ms (median 6,285 ms); 6 `m1-profile` actions, 5,949–5,989 ms; 440 CLI calls. All restart and profile actions exit 0.
  - `snapshot-isolated`: 1 restart (6,022 ms) and 2 profile actions (5,984 and 6,583 ms).
  - No common or Blackboard lease or deadline row failed.
- Sink capture (AC-M1-12, for the Canvas judge): `service-logs/sink.jsonl` was complete in each phase, with `service_started` and `service_stopping` present, a trailing newline and zero `sink_hit`.
  - `sim`: 04:30:05.777Z–04:52:05.365Z, SHA-256 `391b31b2…`. Raw Vitest file times: first start 04:30:14.456Z, last end 04:51:48.153Z.
  - `snapshot-isolated`: 04:53:10.692Z–04:53:51.846Z, `c0310110…`. Vitest: 04:53:19.066Z–04:53:49.458Z.
  - The Lead received each identity for Canvas QA in `msg_45d50c48dcd7` and `msg_ee3f6177ce97`.

### Privacy (AC-M3-07 method)

- The private capability union holds 1,334 captured values and 36 stack values (`private/watch`, 0700).
- 0 hits in 33 raw service, simulator and gate logs.
- 0 hits and 0 JWT-shaped strings in 841 public files. They include the phase artifacts, observer logs and 5 binary public files (byte scan). `public/secret-scan.json` SHA-256 `60363f0f…`.
- Private browser artifacts (153 files: 110 decompressed trace entries and 15 screenshots) stay in the phase clones. 26 of them contain captured values, as expected for raw traces. They are not shared evidence; Canvas QA owns their redaction.

### Observed permissions (option A)

| Path | Observed |
| --- | --- |
| Source root, `source/`, run root, `public/`, `private/`, `tmp/` | 0700 from creation (umask 077) and at the end |
| `source/tests/host/artifacts` (runner, umask 022) | 0755, inside the 0700 source root |
| `sim` clone root | Born 04:29:23.014Z at 0755; set to 0700 at 04:29:23.151Z (137 ms) |
| `snapshot-isolated` clone root | Born 04:52:22.170Z at 0755; set to 0700 at 04:52:22.234Z (64 ms) |
| `snapshot-upgrade` clone root | Born 04:54:03.612Z at 0755; set to 0700 at 04:54:03.819Z (207 ms) |
| Captured-secret files | One `captured-secrets.jsonl` per clone was 0644 and was set to 0600 at its checkpoint (04:52:20.225Z, 04:54:03.065Z, 04:55:18.466Z). The other raw files were already 0600 (479, 35 and 9). At the end, 0 of 526 such files are not 0600. |
| Artifact folders inside each clone | Unchanged, as authorized: `tests/acceptance/artifacts` and the browser output folders are 0755 inside the 0700 clone roots. `infra/.logs` is 0700. |
| Runner private folders | `…-storage-private` and `qa-m1-snapshot-private-OulCFv` were 0700 at discovery and at the end (not changed by QA). |
| Temporary test archives `…-tests.tar` | 0644 at discovery (frozen test source only); the runner removed them. |

The guard made mode changes only: no content, owner or executable bit changed, and it refused nothing. Record: `public/clone-guard.json` (SHA-256 `1f380734…`), 0 problems. The root modes were **not** private from creation. They were 0755 for the times above, behind the 0750 home folder.

### Isolation and cleanup (AC-M3-06)

- The runner teardown removed only resources from its ownership record in all three phases. `M3-ISOLATION` and `TEARDOWN` PASS.
- The W4 live end boundary ran at 04:55:26.084Z (`w4-end.json` `056c2fe5…`, live `SystemTime` 04:55:23.576Z). The strict W3-to-end comparison (`w4-compare.json` `caaedb1a…`) passed with zero problems.
  - Bridge `8ab2567c7b8f`, host and none have the same Ids.
  - All 7 protected FULL records equal W3 and the original baseline.
  - Memory, CPUs, engine identity and settings are unchanged.
  - 0 containers and 0 lane resources remain.
- Sampler (103 samples): one bridge Id, zero clock-skew violations, zero failed reads (`sampler/lane-containers.json` `9d24af5b…`).
- No owned process remains. The private phase clones and the private snapshot backup are kept for review.

### Evidence

- Phase artifacts (redacted): `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-82e2dab-20261021T0418Z/source/tests/host/artifacts/<run id>/`.
  - `sim`: `m1-case-results.json` `9ae24368…`, `summary.json` `c946f289…`, `m1-identity.json` `0517b508…`.
  - `snapshot-isolated`: `ce4f5770…`, `2459d57b…`, `6e657d7a…`.
  - `snapshot-upgrade`: `summary.json` `6b0deee7…` (with the runner error), `m1-identity.json` `da087e65…`, `evidence/snapshot-seed/m1-vitest-results.json` `dccb7a46…`, `lane-ownership.json` `e3cff701…`.
- Run root `public/`: `ancestor-boundary.json`, `w1-wake.json`, `w2-liveness.json`, `w3-formal-start.json`, `w4-end.json`, `w4-compare.json`, `sampler/`, `clone-guard.json`, `secret-scan.json`, `round-1-rows.json`, `round-1-summary.json`, `command.txt`, `tool-hashes.txt`, `launcher.log`, `full-run-exit.json`.
- Messages to the Lead: start ACK `msg_c08a2ad08ed4`, preparation `msg_448daaee7ec1`, gates `msg_d2cb3ba7b2a2` and `msg_97e12666b1e7`, phase identities `msg_45d50c48dcd7` and `msg_ee3f6177ce97`, failure and window return `msg_50cf6f48d777`.

### Next

The Lead decides on the one-file common oracle repair above (`tests/host/m1-migration.mjs` and its self-test). It needs a new frozen candidate, independent source review and a new window. Then both complete 488-row rounds and all legacy groups must run again from a fresh clone. This attempt and its not-run rows stay in the record. All 32 live rows stay `UNVERIFIED`.

## Retry at `51a80b5`: FAIL in round 1, phase `snapshot-upgrade` (`M1-38.common.h4`, QA control replay), 2026-10-21

Verdict for this attempt: **FAIL**. Round 1 `sim` (394 rows) and `snapshot-isolated` (6 rows) passed completely. In `snapshot-upgrade`, the h1 seed stage and the repaired backup oracle passed. Then `M1-38.common.h4` failed. The cause is a defect in the common QA host harness: a new host-control server replayed seven seed-stage requests. No product defect is shown. The live end comparison also failed, on one new unrelated anonymous volume. 84 round-1 rows did not get a result. Round 2 and legacy did not start. No M1 criterion gets full-run credit. All sections above stay as history.

Owner: a new, independent common/Blackboard QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort. Task `task_ed3b08aa45ea`, dispatch `ctx_dee91bc7a4bc` (a retry after the failed `ctx_b36c97b882dd`). The task text calls this role "Codex QA, GPT-6-Astra". Lead messages `msg_82c5f9134671`, `msg_9506a89ce2ca` and `msg_441eb836c615` supersede that model, SHA, count, window and permission text. This session did not write the product, the tests of this candidate or any review. It does not claim the evidence of earlier sessions or of Canvas QA.

### Identity and command

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `51a80b51de2c7491466a21a678418ff8178d247d` (tests tree `a47b34cd56bb3d85e4c3ef1cafef0a2b0c3210c0`). Product code equals `a784522`. Since `82e2dab`, only `tests/host/m1-migration.mjs` (SHA-256 `1be7c1c9…`) and its self-test (`20745f2a…`) changed outside `docs/`. |
| Source reviews | Backup-oracle repair: Reviewer-A `a259398`, Reviewer-B `92f0d09`. Both APPROVE. |
| Window | Lead `msg_9506a89ce2ca`, confirmed in `msg_441eb836c615`: sole fleet-wide Docker window. Returned after the failure in `msg_1b76a14fcad1`. |
| Lane | `qa-multi-r1` (storage lane `qa-multi-r1-st` not reached), port 8443, subnet `172.29.0.0/16` |
| Source | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-51a80b5-20261021T0525Z/source`: `git clone --no-hardlinks` under umask 077, then detached at the exact SHA. 0 status lines, no `.env`, no root `node_modules`, push URL disabled. `npm --prefix tests ci --no-audit --no-fund` exit 0. Provenance: `provenance.json` beside the source (SHA-256 `266858f8…`). |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-51a80b5-20261021T0530Z`. The root, `public/`, `private/` and `tmp/` are 0700. |
| Phase runs | `sim` `qa-multi-r1-51a80b51-2026-10-21T05-30-48-841Z`; `snapshot-isolated` `…-05-54-07-197Z`; `snapshot-upgrade` `…-05-55-43-894Z` |
| Time | Runner start 05:30:48Z; identities: `sim` 05:54:01.108Z, `snapshot-isolated` 05:55:39.553Z, `snapshot-upgrade` 05:57:31.436Z; parent exit 1 at 05:57:35Z |
| Tools | Node 24.21.0; Docker CLI and engine 29.9.1; Compose 5.6.0 |

```sh
cd /Users/quangnguyen/cogniate-qa-runs/m3-frozen-51a80b5-20261021T0525Z/source
umask 022
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=/Users/quangnguyen/cogniate-qa-runs/m1-full-51a80b5-20261021T0530Z/tmp \
node tests/host/run-m1.mjs --sha 51a80b51de2c7491466a21a678418ff8178d247d \
  --test-sha 51a80b51de2c7491466a21a678418ff8178d247d \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-51a80b5-20261021T0525Z/source
```

The runner has no `--runs` option (help checked). The default `full` phase runs the five phases twice and then legacy. The external launcher `launch-full.sh` ran the gates, this command and the end boundary. It did not change the frozen suite.

### Preparation (host only, no Docker)

- **Harness-only check under umask 022:** `node tests/host/run-m1.mjs --harness-only --provider all` exit 0. 71 of 71 self-checks, 0 failed, skipped or cancelled; typecheck PASS. 392 API plus 96 host rows (72 AC-M1-41) = 488 rows per round: `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70. The only conditional row is `M1-41.common.c-host-negative`. Original manifests: common 42, Blackboard 141, Canvas 233; hashes unchanged (`cd40fb78…`, `337524ca…`, `c4974629…`). Log: `prep/harness-only-umask022.log`. Preparation evidence only; no product credit.
- **Tools:** `/Users/quangnguyen/cogniate-qa-runs/claude-common-qa-tools-51a80b5`, a new owned ledger.
  - 13 files are byte copies of the validated `82e2dab` set. The source hashes equal that set's own after-edit ledger.
  - Changed: `launch-full.sh` `1d5698f1…` (session and dispatch ids, comments), `progress.sh` `c9977326…` and `watch-events.sh` `68bbfa9e…` (tool path). Diff: `ledger/edit-diff.txt`.
  - On the copies, the live-boundary controls passed 30 of 30 (Docker stub) and the clone-guard controls passed 25 of 25 (temporary folders). These are harness checks only.
- **Binary identities (file hashes, no daemon call):** macOS 27.0.1 arm64; Docker CLI 29.9.1 `678271…`; Compose 5.6.0 `1ec064…`. Both equal the bound values.
- **Ancestor boundary:** home folder 0750, `quangnguyen:staff`. Group `staff` has only `quangnguyen` and `root` of 133 accounts. The ACL is only `group:everyone deny delete`. The shared `cogniate-qa-runs` folder (0755) was not changed.

### Live boundary before the run (W1–W3, all PASS)

| Step | Result | Evidence (`public/`) |
| --- | --- | --- |
| Pre-wake (not boundary evidence) | Host 05:30:33.956Z; Docker already live (clock 05:30:35.194Z); bridge `9c58df5fc4e1`, created 05:22:54Z; 0 containers | `w1-wake.json` (`preWake`) |
| W1 wake | `qa-wake-20261021053035-1c8b7586` on cached image `sha256:44fce696…`, `--pull never --rm --network none`, label `org.cogniate.qa=wake` only. Exit 0 in 103 ms. 0 wake containers remain. | `w1-wake.json` SHA-256 `be2f58f8…` |
| W2 liveness | `docker info` answered. Two advancing reads; worst skews 61 ms and 93 ms. | `w2-liveness.json` `7a918b5f…` |
| W3 formal start | `runStartSecond` 1792560645 (live `SystemTime` 05:30:45.826Z). Identities match the bound values; image present. Engine 29.9.1, ID `2c7a7bff…`, `MemTotal` 8,319,238,144, `NCPU` 12; settings normalized SHA-256 `8d959def…`. Networks: bridge `9c58df5fc4e1`, host `b9266a37c45a`, none `d2863b51ad44`. 0 containers. 8 volumes: the 7 protected FULL records equal the original baseline (file `219da30b…`), plus one anonymous volume `a17056b8…` (CreatedAt 05:26:47Z, no lane or compose label). Both lanes fresh by exact names and labels; port 8443 free; no subnet clash; 0 problems. | `w3-formal-start.json` `295585ca…` |
| Gate message | Sent to the Lead before the runner started. | `msg_56a0d3eb4c50` |

The anonymous volume `a17056b8…` appeared after the `82e2dab` end boundary and before this W1. This session ran no Docker command before W1. The Lead found no worker that used the daemon in that window (`msg_26f5af615bcc`). Its origin stays unknown. It was preserved and compared at W4 (unchanged).

### Result of round 1

| Phase | Rows | Result | Run id |
| --- | ---: | --- | --- |
| `sim` | 394 of 394 | 394 PASS (common 26, Blackboard 136, Canvas 232) | `…-05-30-48-841Z` |
| `snapshot-isolated` | 6 of 6 | 6 PASS (Blackboard `M1-37` w, y2; `M1-29` k1–k3; Canvas `M1-37` aa) | `…-05-54-07-197Z` |
| `snapshot-upgrade` | 4 of 6 | h2, h3, h5 PASS; **h4 FAIL**; h1 seed stage PASS in the aggregate with no row record; `j-snapshot` not run | `…-05-55-43-894Z` |
| `migration` | 0 of 12 | not run | – |
| `storage` | 0 of 70 | not run | – |

- All 404 recorded rows have one SHA pair (`51a80b51…` for product and tests) and the label `SIM`. There are no duplicate, unmanifested or wrong-label rows (`round-report.mjs`).
- `sim`: runner aggregate 400 PASS (394 rows plus `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION`, `TEARDOWN`). Vitest ran 21 files: 386 passed, 0 failed, 6 pending. The 6 pending tests are exactly the six `snapshot-isolated` rows, which passed in the next phase. Health: app and LTI service `profile: default`, `knobs: []`; LTI `simulation_profiles: []`.
- `snapshot-isolated`: aggregate 12 PASS; Vitest 6 passed, 0 failed, 386 pending. Health as in `sim`.
- `snapshot-upgrade`: the seed stage on the pinned `9f96f7b` build passed (`M1-38.common.h1`, 1 passed). `stack:data-backup` exited 0, and the repaired `inspectBackup` accepted the per-database manifest. The candidate build started (`stack:up` exit 0). The upgrade stage ran 4 tests: 3 passed and 1 failed. Aggregate: 10 PASS, 2 FAIL (`M1-38.common.h4` and the runner `ERROR`).
- Canvas rows keep Canvas QA's separate verdict. This QA does not judge them.

**Failure: `M1-38.common.h4`.** The check is "old Canvas adds seeded and freshly approved deployments while its original key survives". It failed in its first (seeded) iteration: `snapshot-oracle.mjs:39` `Scoped committed phase-1 event count`, `0 !== 1`, called from `snapshot-migration.probe.ts:126`.

Diagnosis from this run's own records (paths and ids only; no secret value):

1. The h1 seed stage (old build) sent 7 host-control requests between 05:56:36Z and 05:56:39Z. One of them was `app:grant issue --purpose add_deployment` for the old Canvas connection `con_9nO…`. It issued the seeded add grant `grt_WtW3…` at 05:56:38.232Z.
2. `run-m1.mjs` `suite()` (line 277) starts a new `m1HostControl` for each stage. The seed and upgrade stages share one phase clone and one `tests/acceptance/artifacts/control` folder. The server's `done` set exists only per instance, and it does not skip a request that already has an `ack` file (`m1-control.mjs`, lines 81–88).
3. The upgrade-stage server therefore executed all 7 seed requests again at 05:57:02.396–.406Z, on the candidate stack. The 7 `req-m1-*` files are born 05:56:36–39Z; their `ack` files were rewritten at 05:57:03Z. Those 7 `host-actions/<id>.json` records now hold the replay results; the seed-stage records were overwritten.
4. The replayed `add_deployment` request succeeded and issued a second grant, `grt_wuc3…`, for the same connection and deployment (05:57:03.031Z). The other six replays changed nothing: two `list` calls, and four `issue --purpose initial` calls that exited 1.
5. In h4, `POST /app-api/connections/:id/deployments` with the seeded grant returned 403. The app logged `grant_rejected` with reason `revoked` at 05:57:17.439Z, and logged no `grant_attempt_started` for the connection. The oracle expected exactly one attempt.

Classification: QA harness defect in common host files (`tests/host/m1-control.mjs` with `run-m1.mjs` `suite()`). The product refused a superseded grant. I did not read product code; I found no sign of a product defect. No earlier attempt reached this stage, so the defect was latent. The QA self-tests use one control-server instance only.

Proposed smallest repair (held for Lead authority; no repository edit was made):

- In `m1HostControl`, never execute a request that already has an `ack-<id>.json` file. Alternatively, mark every request file that exists at server start as done.
- Add a self-test: two server instances on one control folder; the second must not run an answered request.
- Check every phase that calls `suite()` more than once on one clone (for example `migration` and `storage`) for the same exposure.
- The repair needs a new frozen SHA, independent review and a new window.

**Not run (84 of 488 round-1 rows):** `M1-38.common.h1` (row record not published), `M1-41.common.j-snapshot`, `migration` 12 (AC-M1-23 4, AC-M1-30 7, `M1-41.common.j-migration`) and `storage` 70 (AC-M1-41). Round 2 (488 rows) and all legacy groups did not start.

Common and Blackboard rows of round 1, by criterion (each needs a second complete round):

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
| M1-29 | – | 21 PASS, including k1–k3 |
| M1-30 | 7 not run (`migration`) | – |
| M1-31 | – | 2 PASS |
| M1-33 | – | 4 PASS |
| M1-34 | – | 14 PASS |
| M1-35 | 3 PASS (profile off/on routes) | – |
| M1-36 | – | 5 PASS |
| M1-37 | – | 32 PASS, including v2, v5, v7, v9, v11, v12, w, x1, x2, y1, y2, z1–z5 |
| M1-38 | i5, h2, h3, h5 PASS; **h4 FAIL**; h1 no row (seed stage passed) | 8 PASS, including i3 and i4 |
| M1-39 | 1 PASS | – |
| M1-41 | 72 not run (70 `storage`, `j-snapshot`, `j-migration`) | – |

Per-row records (id, AC, owner, phase, status, label, both SHAs, run id, command, start time, artifact path): `public/round-1-rows.json` (SHA-256 `8beaa363…`) and `public/round-1-summary.json` (`93b68791…`).

### Health, images and timings

- Images (phase `images.json`): `erseco/alpine-moodle:v5.2.4` `sha256:3a310197…`, `node:24.22.0-alpine3.24` `sha256:44fce696…` (app, LTI service and helpers), `postgres:16-alpine` `sha256:721873c3…`, `caddy:2.11.7-alpine` `sha256:d8542f48…`. One local `qa-multi-r1-e2e:1.56.0` image remains (`1a92373082bd`), as after the earlier attempts; 0 dangling images.
- Host control:
  - `sim`: 32 `m1-restart` actions, 5,915–9,645 ms (median 6,184 ms); 6 `m1-profile` actions, 5,951–6,032 ms; 440 CLI calls. All restart and profile actions exit 0.
  - `snapshot-isolated`: 1 restart (6,093 ms) and 2 profile actions (6,019 and 6,145 ms).
  - `snapshot-upgrade`: 32 CLI calls, 7 of them the replay above.
- Sink capture (AC-M1-12, for the Canvas judge): `service-logs/sink.jsonl` was complete in each phase, with `service_started` and `service_stopping`, a trailing newline and zero `sink_hit`.
  - `sim`: 05:31:33.131Z–05:53:50.616Z, SHA-256 `b3acfbd6…`. Raw Vitest file times: first start 05:31:41.532Z, last end 05:53:33.088Z.
  - `snapshot-isolated`: 05:54:51.682Z–05:55:32.287Z, `2293e623…`. Vitest: 05:55:00.019Z–05:55:29.911Z.
  - `snapshot-upgrade`: 4 lines (two boots, 2 started, 2 stopping), 05:56:28.389Z–05:57:24.261Z, `1842caed…`.
  - The Lead received each identity for Canvas QA in `msg_b028be3eba22` and `msg_3b498c24fa11`.

### Privacy (AC-M3-07 method)

- The private capability union holds 1,419 captured values and 36 stack values (`private/watch`, 0700).
- 0 hits in 33 raw service, simulator and gate logs.
- 0 hits and 0 JWT-shaped strings in 879 public files. They include the phase artifacts, observer logs and 5 binary public files (byte scan). `public/secret-scan.json` SHA-256 `f301ba8e…`.
- Private browser artifacts (157 files: 114 decompressed trace entries and 15 screenshots) stay in the phase clones. 27 of them contain captured values, as expected for raw traces. They are not shared evidence; Canvas QA owns their redaction.

### Observed permissions (Lead permission contract)

| Path | Observed |
| --- | --- |
| Source root, `source/`, run root, `public/`, `private/`, `tmp/`, tool folder | 0700 from creation (umask 077) and at the end |
| `source/tests/host/artifacts` (runner, umask 022) | 0755, inside the 0700 source root |
| `sim` clone root | Born 05:30:49.325Z at 0755; set to 0700 at 05:30:49.418Z (93 ms) |
| `snapshot-isolated` clone root | Born 05:54:07.656Z at 0755; set to 0700 at 05:54:07.885Z (229 ms) |
| `snapshot-upgrade` clone root | Born 05:55:44.368Z at 0755; set to 0700 at 05:55:44.396Z (28 ms) |
| Captured-secret files | One `captured-secrets.jsonl` per clone was 0644; the guard set it to 0600 at its checkpoint (05:54:05.625Z, 05:55:43.893Z, 05:57:35.758Z). At the end, 0 of 551 raw or captured-secret files (480, 36, 35) are not 0600. |
| Artifact folders inside each clone | Unchanged, as authorized: 0755 inside the 0700 clone roots. `infra/.logs` is 0700. |
| Runner private folders | `…-05-55-43-894Z-storage-private` and `qa-m1-snapshot-private-J3meQN` were 0700 at discovery and at the end. The older `qa-m1-snapshot-private-OulCFv` belongs to the `82e2dab` attempt; it was not changed. |
| Temporary test archives `…-tests.tar` | 0644 at discovery (frozen test source only); the runner removed them. |

The guard changed modes only: no content, owner or executable bit changed, and it refused nothing. Record: `public/clone-guard.json` (SHA-256 `3785fdd9…`), 0 problems. The clone root modes were **not** private from creation: each was 0755 for the time above, behind the 0750 home folder.

### Isolation and cleanup (AC-M3-06)

- The runner teardown removed only resources from its ownership record in all three phases. `M3-ISOLATION` and `TEARDOWN` PASS ("left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks").
- W4 live end boundary at 05:57:43.414Z (`w4-end.json` `44c25ae1…`, live `SystemTime` 05:57:40.888Z): identities, engine, memory, CPU and settings unchanged; 0 containers; 0 lane resources; the 7 protected FULL records equal W3 and the original baseline.
- **Strict W3-to-end comparison: FAIL** (`w4-compare.json` `5cfaaea3…`). The only problem is `new unrelated volume: d5df35bda51f…`. All other checks passed: bridge `9c58df5fc4e1`, host and none have the same Ids; the W3 anonymous volume `a17056b8…` is unchanged.
  - The new volume has only the label `com.docker.volume.anonymous`, no lane or compose label, and CreatedAt 05:32:46Z (during `sim`).
  - No lane container was created between 05:32:30Z and 05:32:59Z (sampler).
  - The sampler saw six containers without a compose project during the sole window: `/fgw-pgb-transaction`, `/fgw-pgb-session`, `/fgw-pgb-pg`, `/fgw-gw-session`, `/fgw-gw-txn` and `/fgw-gw-direct`. These names do not occur in this repository. They were gone before W4. The sampler keeps no times for non-lane containers.
  - The origin of the volume is not proven. QA did not remove or change it. The isolation check is FAIL for this attempt.
- Sampler (106 samples): one bridge Id, zero clock-skew violations, zero failed reads, at most one compose project (`sampler/lane-containers.json` `d4398d48…`).
- No owned process remains. The three private phase clones, the `-storage-private` folder and the private snapshot backup `qa-m1-snapshot-private-J3meQN` are kept for review.

### Evidence

- Phase artifacts (redacted): `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-51a80b5-20261021T0525Z/source/tests/host/artifacts/<run id>/`.
  - `sim`: `m1-case-results.json` `1e7fa2fd…`, `summary.json` `82ee8b20…`, `m1-identity.json` `649c2162…`.
  - `snapshot-isolated`: `09a0205f…`, `68bcc4e0…`, `3e03acbb…`.
  - `snapshot-upgrade`: `m1-case-results.json` `fbfc631b…`, `summary.json` `49a3cb64…` (with the runner error), `m1-identity.json` `032fc386…`, `lane-ownership.json` `b0b18c13…`, `evidence/snapshot-seed/m1-vitest-results.json` `94313177…`, `evidence/snapshot-upgrade/m1-vitest-results.json` `481c8e0e…`, `host-actions/`, `cmd/acceptance-snapshot-upgrade.log`.
- Run root `public/`: `ancestor-boundary.json`, `w1-wake.json`, `w2-liveness.json`, `w3-formal-start.json`, `w4-end.json`, `w4-compare.json`, `sampler/`, `clone-guard.json`, `secret-scan.json`, `round-1-rows.json`, `round-1-summary.json`, `command.txt`, `tool-hashes.txt`, `launcher.log` (`d4654673…`), `full-run-exit.json`.
- Messages to the Lead: ACKs `msg_59b359c7c4d6` and `msg_bbe8dca198ff`, preparation `msg_3bfbd0b4e48c`, gates `msg_56a0d3eb4c50` and `msg_58bd32b0f961`, first run id `msg_055e7a76e1be`, progress `msg_2f108d6e9456`, phase identities `msg_b028be3eba22` and `msg_3b498c24fa11`, failure and window return `msg_1b76a14fcad1`.

### Next

The Lead decides on the common host-control repair above. It needs a new frozen candidate, independent source review and a new window. The Lead also decides how to handle the unrelated `fgw-*` Docker activity and the two unattributed anonymous volumes before the next sole window. Then both complete 488-row rounds and all legacy groups must run again from a fresh clone. This attempt and its not-run rows stay in the record. All 32 live rows stay `UNVERIFIED`.

## Retry at `9cdd768`: FAIL in round 1, phase `storage` (AC-M1-41), 2026-10-21

Verdict for this attempt: **FAIL**. Round 1 `sim` (394 rows), `snapshot-isolated` (6), `snapshot-upgrade` (6) and `migration` (12) passed completely. In `storage`, 1 of 70 rows passed (`c-host-negative`) and 69 rows failed. Two of the three root failures are defects in common QA host files. The third failure has no established cause. Round 1 has a record for all 488 rows, but it is not a PASS round. Round 2 and legacy did not start. No M1 criterion gets full-run credit. All sections above stay as history.

Owner: a new, independent common/Blackboard QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort. Task `task_ed3b08aa45ea`, dispatch `ctx_9e877dcb4b10`, session `orca_session_id:39561fd6-8f4b-48e2-8c32-dc2b967c4302`. The task text calls this role "Codex QA, GPT-6-Astra". Lead message `msg_4b7f865b8a34` supersedes that model, instance and candidate text. This session did not write the product, the tests of this candidate or any review. It does not claim the evidence of earlier sessions or of Canvas QA.

### Identity and command

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `9cdd7687b91169a262648018ec6945efa31217dc` (tests tree `eccd4b50aa9c0ef6a25ce7d95fd383c0f3ad817e`). Product files equal `a784522` (0 non-docs, non-tests files differ). Since `51a80b5`, only `tests/host/m1-control.mjs` and `tests/host/m1-control.selftest.mjs` changed outside `docs/`. |
| Source reviews | Host-control replay repair: Reviewer-A `42a6728`, Reviewer-B `0b29d63`. Both APPROVE. |
| Window | Lead `msg_4b7f865b8a34` (sole Docker window, conditional on the W1–W3 gates; W1–W4 authority `msg_6a8f681e8f6e`). The owner's quiet-window question is not answered; the Lead withdrew it as an input gate. This report claims no quiet environment. Window returned in `msg_7db50c6c9ae1` and `msg_4addd386005c`. |
| Lane | `qa-multi-r1` (storage lane `qa-multi-r1-st`), port 8443, subnet `172.29.0.0/16` |
| Source | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-9cdd768-20261021T0622Z/source`, prepared by dispatch `ctx_686fb4062feb`. Re-verified before the run: HEAD and tests tree exact, 0 status lines, no `.env`, no root `node_modules`, push URL disabled, old pins `9f96f7b` and `b0b83a8` present. Handoff SHA-256 `168c94dd…` and provenance `b28c4294…` match the Lead's values. |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-9cdd768-20261021T0709Z`. The root, `public/`, `private/` and `tmp/` are 0700. |
| Phase runs | `sim` `qa-multi-r1-9cdd7687-2026-10-21T07-09-22-264Z`; `snapshot-isolated` `…-07-32-20-230Z`; `snapshot-upgrade` `…-07-33-55-800Z`; `migration` `…-07-35-46-368Z`; `storage` `qa-multi-r1-st-9cdd7687-2026-10-21T07-39-36-550Z` |
| Time | Runner start 07:09:21Z; identities: `sim` 07:32:14.224Z, `snapshot-isolated` 07:33:51.528Z, `snapshot-upgrade` 07:35:42.022Z, `migration` 07:39:32.120Z, `storage` 07:40:46.231Z; parent exit 1 at 07:40:46Z |
| Tools | Node 24.21.0; Docker CLI and engine 29.9.1; Compose 5.6.0. `G1-IDENTITY` PASS in all five phases. |

```sh
cd /Users/quangnguyen/cogniate-qa-runs/m3-frozen-9cdd768-20261021T0622Z/source
umask 022
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=/Users/quangnguyen/cogniate-qa-runs/m1-full-9cdd768-20261021T0709Z/tmp \
node tests/host/run-m1.mjs --sha 9cdd7687b91169a262648018ec6945efa31217dc \
  --test-sha 9cdd7687b91169a262648018ec6945efa31217dc \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-9cdd768-20261021T0622Z/source
```

The runner has no `--runs` option. The default `full` phase runs the five phases twice and then legacy. It stops after a failed required phase. The external launcher `launch-full.sh` ran the gates, this command, the end boundary and the scan. It did not change the frozen suite.

### Preparation (host only, no Docker)

- Earlier dispatch `ctx_686fb4062feb` passed the broad preparation checks: 73 of 73 harness self-checks, typecheck and the 488-row inventory. The Lead accepted them. This session did not repeat them; it verified the unchanged source and tools.
- **Tools:** `/Users/quangnguyen/cogniate-qa-runs/claude-common-qa-tools-9cdd768`. Before the edit, all 16 file hashes equal the predecessor's after-edit ledger. The only change is in `launch-full.sh` (`517b5006…` → `d9424447…`): `FROM`, `DISPATCH` and two comment message ids. New ledger: `ledger/resume-ctx_9e877dcb4b10/` (before, diff, after). The predecessor ledgers are unchanged.

### Live boundary before the run (W1–W3, all PASS)

| Step | Result | Evidence (`public/`) |
| --- | --- | --- |
| Ancestor check | Home 0750 `quangnguyen:staff`; group members `quangnguyen root` of 133 accounts; ACL `group:everyone deny delete` only | `ancestor-boundary.json` `277a946a…` |
| Pre-wake (not boundary evidence) | The idle VM answered with a stale clock (06:08:17Z at host 07:09:06Z); bridge `c24d1573c422`, created 06:03:17Z; 0 containers | `w1-wake.json` (`preWake`) |
| W1 wake | `qa-wake-20261021070907-d159ed00` on cached image `sha256:44fce696…`, `--pull never --rm --network none`, one label. Exit 0; 0 wake containers remain. The wake recreated the bridge (`bfc49733cfc8`, created 07:09:08Z). | `w1-wake.json` `0697ce54…` |
| W2 liveness | Two advancing reads; worst skews 64 ms and 105 ms | `w2-liveness.json` `adcab4d6…` |
| W3 formal start | `runStartSecond` 1792566559 (live `SystemTime` 07:09:19.299Z). Bound identities match; image present. Networks: bridge `bfc49733cfc8`, host `b9266a37c45a`, none `d2863b51ad44`. 0 containers. 9 volumes: the 7 protected FULL records equal the original baseline (file `219da30b…`), plus the anonymous volumes `a17056b8…` (05:26:47Z) and `d5df35bd…` (05:32:46Z). Both lanes fresh; port 8443 free; no subnet clash; 0 problems. | `w3-formal-start.json` `e879790c…` |
| Gate message | Sent to the Lead before the runner started | `msg_b661d2e8a9df`, details `msg_47b04be4d0e4` |

### Result of round 1

| Phase | Rows | Result | Run id |
| --- | ---: | --- | --- |
| `sim` | 394 of 394 | 394 PASS (common 26, Blackboard 136, Canvas 232) | `…-07-09-22-264Z` |
| `snapshot-isolated` | 6 of 6 | 6 PASS (Blackboard `M1-37` w, y2; `M1-29` k1–k3; Canvas `M1-37` aa) | `…-07-32-20-230Z` |
| `snapshot-upgrade` | 6 of 6 | 6 PASS: `M1-38.common` h1–h5, `M1-41.common.j-snapshot` | `…-07-33-55-800Z` |
| `migration` | 12 of 12 | 12 PASS: AC-M1-23 (4) and AC-M1-30 (7) `MOODLE-LIVE`, `M1-41.common.j-migration` `SIM` | `…-07-35-46-368Z` |
| `storage` | 70 of 70 | **1 PASS** (`c-host-negative`), **69 FAIL** | `qa-multi-r1-st-…-07-39-36-550Z` |

- Row record (`round-report.mjs`): 488 rows, 488 distinct, 0 missing, 0 duplicate, 0 unmanifested, 0 label mismatch. All rows have one SHA pair (`9cdd7687…` for product and tests). 419 PASS and 69 FAIL. By owner: common 45 PASS and 69 FAIL, Blackboard 141 PASS, Canvas 233 PASS.
- `sim`: runner aggregate 400 PASS (394 rows plus `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION`, `TEARDOWN`). Vitest 21 files: 386 passed, 0 failed, 6 pending. The 6 pending tests are exactly the six `snapshot-isolated` rows, which passed in the next phase. Health: app and LTI service `profile: default`, `knobs: []`; LTI `simulation_profiles: []`.
- `snapshot-isolated`: aggregate 12 PASS; Vitest 6 passed, 0 failed, 386 pending. Health as in `sim`.
- `snapshot-upgrade`: the seed stage on the pinned `9f96f7b` build passed (1 test, 07:34:47–07:34:50Z). The upgrade stage passed 4 of 4 tests (07:35:22–07:35:33Z). The repaired host control ran 33 requests with 33 acknowledgments and 33 action records; no acknowledgment was written again, so no request was replayed. The phase identity records `health` as null for this two-stage phase; no row depends on it.
- `migration`: aggregate 11 PASS, including `MIGRATION` (upgrade and rollback lifecycle). The private backup stays outside shared evidence.
- `storage`: harness self-checks `HARNESS-LOCK-SELFTEST` (`storage-oplock.sh selftest`, every scenario ok) and `STORAGE-PREPARE` passed. They are not rows. The runner aggregate (9 PASS, 76 FAIL) also counts harness steps and fixtures; it is diagnostic only. The mandatory count is 70 rows: 1 PASS, 69 FAIL.
- Canvas rows keep Canvas QA's separate verdict. This QA does not judge them.

### Storage failures (read-only diagnosis)

All 66 rows that did not run report "not run: prerequisite … did not pass". They are FAIL, never a skip. The diagnosis used file reads only; no Docker command, source edit or rerun. Commands and findings: `public/diagnosis-storage-round1.md` (SHA-256 `5d269e63…`). Canvas QA reached the same three diagnoses on its own (`msg_6fa6869f7c90`); I checked each one myself.

1. **`M1-41.common.c-selftest` FAIL — QA harness defect.** The probe exits 2 with "selftest needs an existing empty folder". `tests/host/storage-rows.mjs` lines 247–249 pass `--folder self=/tmp/qa-selftest-<16 hex>` but do not create that folder. ADR-012 (selftest table, the selftest rule and §11) says that selftest runs in one empty folder and that QA uses a new folder in the container's own writable layer. So QA must create the folder.
2. **`M1-41.common.a-fresh` FAIL — QA harness defect (first failing prerequisite).** The failed check is "Preflight pass is logged before the first service container is created". `tests/host/storage-oracle.mjs` line 42, `preflightOf()`, returns the last summary line. On a first start, `stack:up` logs three summaries: `report` (07:40:08.947Z), `check` pass (07:40:09.248Z) and `mark-started` (07:40:39.035Z, after the services became healthy). The first service container was created at 07:40:09.390Z (`lane-ownership.json`, Docker clock). So the `check` pass comes 142 ms before the first service container, as the criterion requires. The oracle compared the `mark-started` line instead. The same function also seeds `state.runIds` from that line. This failure stopped `@seed` and every row that needs a seeded lane.
3. **`M1-41.common.e-old-schema` FAIL — cause not established.** In the import half (the `content_missing` case of `e-content-missing`), `stack:data-import` exited 1 with the daemon error "bind source path does not exist: …/infra/.data/cogniate-app/packages". The expected result was the refusal `content_missing`. The product script calls `prepare_content_folders` before its maintenance container. The host folders exist: `packages/` was born at 07:40:45.947Z and `uploads/` at 07:40:45.948Z. The import held the lock from 07:40:45.786Z to 07:40:46.136Z. `stack:reset` had removed the same folders at about 07:40:44Z. A possible cause is Docker Desktop file-sharing visibility of a host path that was just made again. A product robustness gap is also possible. This is not shown to be a QA assertion defect. It needs a backend or Lead diagnosis. `e-content-missing` then did not run.
4. **`M1-41.common.c-host-negative` PASS (fault shown).** The QA oracle shows "LOCK NOT ENFORCED (B acquired while A held)" on the `fakeowner` bind folder. The probe reports `lock_not_enforced` and exits 1. Round 2 did not run, so the same-result rule of the two rounds is not met.

Proposed smallest QA repairs (held for Lead authority; no repository edit was made):

- `c-selftest`: create the empty folder inside the probe container before the probe runs, for example `sh -c 'mkdir -m 700 <folder> && exec node /probe/sqlite-lock-probe.mjs selftest …'`, with no bind and no volume for that folder.
- `a-fresh`: select the `check`-mode summary for the ordering check and for the recorded run id. Add a self-test with all three summary lines.
- Check every other use of `preflightOf(…).summary` for the same last-line assumption.
- Item 3 needs a decision before the next window.

**Not run:** round 2 (488 rows) and all twelve legacy groups.

Common and Blackboard rows of round 1, by criterion (each needs a second complete round):

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
| M1-23 | 4 PASS (`MOODLE-LIVE`) | – |
| M1-24 | 2 PASS | – |
| M1-25 | 1 PASS | 1 PASS |
| M1-27 | – | 1 PASS |
| M1-28 | – | 2 PASS |
| M1-29 | – | 21 PASS, including k1–k3 |
| M1-30 | 7 PASS (`MOODLE-LIVE`) | – |
| M1-31 | – | 2 PASS |
| M1-33 | – | 4 PASS |
| M1-34 | – | 14 PASS |
| M1-35 | 3 PASS (profile off/on routes) | – |
| M1-36 | – | 5 PASS |
| M1-37 | – | 32 PASS, including v2, v5, v7, v9, v11, v12, w, x1, x2, y1, y2, z1–z5 |
| M1-38 | 6 PASS: h1–h5, i5 | 8 PASS, including i3 and i4 |
| M1-39 | 1 PASS | – |
| M1-41 | 3 PASS (`j-snapshot`, `j-migration`, `c-host-negative`); **69 FAIL** (storage) | – |

Per-row records (id, AC, owner, phase, status, label, both SHAs, run id, command, start time, artifact path): `public/round-1-rows.json` (SHA-256 `ea0b02dc…`) and `public/round-1-summary.json` (`6bd3cdcb…`).

### Health, images and timings

- Images (phase `images.json`, `1029bdfa…`): `erseco/alpine-moodle:v5.2.4` `sha256:3a310197…`, `node:24.22.0-alpine3.24` `sha256:44fce696…` (app, LTI service and helpers), `postgres:16-alpine` `sha256:721873c3…`, `caddy:2.11.7-alpine` `sha256:d8542f48…`. The storage fixture image is the same Node image; the fixture script SHA-256 is `77e842f5…`.
- Host control:
  - `sim`: 32 `m1-restart` actions, 5,950–8,627 ms (median 6,487 ms); 6 `m1-profile` actions, 5,932–6,472 ms; 440 CLI calls (20 with the expected exit 1). All restart and profile actions exit 0.
  - `snapshot-isolated`: 1 restart (6,489 ms) and 2 profile actions (6,037 and 6,041 ms).
  - `snapshot-upgrade`: 33 CLI calls, no replay.
- Sink capture (AC-M1-12, for the Canvas judge): complete in every SIM-bearing phase, with `service_started` and `service_stopping`, a trailing newline and zero `sink_hit`.
  - `sim`: 07:10:06.118Z–07:32:03.848Z, SHA-256 `07ea7125…`. Raw Vitest file times: first start 07:10:14.592Z, last end 07:31:46.481Z.
  - `snapshot-isolated`: 07:33:03.496Z–07:33:44.431Z, `e46ca9e8…`. Vitest: 07:33:11.756Z–07:33:42.064Z.
  - `snapshot-upgrade`: 4 lines (two boots), 07:34:39.080Z–07:35:34.127Z, `917b86c4…`.
  - `migration`: 14 lines (seven boots), 07:36:29.859Z–07:39:25.280Z, `7125218a…`.
  - `storage`: no sink (no LMS simulation in this phase).
  - Canvas QA received each identity in `msg_9e5152bafe12`, `msg_1760a953edfe`, `msg_ee946d88e28f`, `msg_4509c314b19a` and `msg_d6729b90ce8e`.

### Privacy (AC-M3-07 method)

- The private capability union holds 1,466 captured values and 53 stack values (`private/watch`, 0700).
- 0 hits in 45 raw service, simulator and gate logs.
- 0 hits and 0 JWT-shaped strings in 1,096 public files, including 5 binary public files (byte scan). `public/secret-scan.json` SHA-256 `674605af…`.
- Private browser artifacts (159 files: 114 decompressed trace entries and 15 screenshots) stay in the phase clones. 26 of them contain captured values, as expected for raw traces. They are not shared evidence; Canvas QA owns their redaction.

### Observed permissions (Lead permission contract)

| Path | Observed |
| --- | --- |
| Source root, `source/`, run root, `public/`, `private/`, `tmp/`, tool folder | 0700 (umask 077) |
| Phase clone roots (runner, umask 022) | Each born 0755, then set to 0700 by the guard: `sim` after 68 ms, `snapshot-isolated` 235 ms, `snapshot-upgrade` 211 ms, `migration` 20 ms, `storage` 225 ms. Not private from creation. |
| Captured-secret files | One `captured-secrets.jsonl` per clone was 0644; the guard set it to 0600 at each phase checkpoint (4 files). The storage clone had none. |
| Private folders of this run | `qa-m1-private-backup-YlJV8z`, `qa-m1-snapshot-private-x6B1vI` and the three `-storage-private` folders: 0700 |

The guard changed modes only, at exact names. Record: `public/clone-guard.json` (`e9106231…`), 5 clones, 5 checkpoints, 0 problems.

### Isolation and cleanup (AC-M3-06)

- The runner teardown removed only resources from its ownership record in all five phases. `M3-ISOLATION` and `TEARDOWN` PASS ("left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks").
- W4 live end boundary at 07:40:54.222Z (`w4-end.json` `4ef12f48…`, live `SystemTime` 07:40:51.731Z): identities unchanged; 0 containers; both lanes fresh; the 7 protected FULL records equal W3 and the original baseline; `a17056b8…` and `d5df35bd…` unchanged.
- **Strict W3-to-end comparison: PASS** (`w4-compare.json` `623550f4…`, 0 problems). Bridge `bfc49733cfc8`, host and none have the same Ids.
- Sampler (125 samples): one bridge Id, zero clock-skew violations, zero failed reads, at most one compose project (`sampler/lane-containers.json` `29615356…`). Apart from QA's own oracle container, no non-lane container appeared.
- No owned process remains. The five phase clones, three `-storage-private` folders and two private backups are kept for review.

### Evidence

- Phase artifacts (redacted): `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-9cdd768-20261021T0622Z/source/tests/host/artifacts/<run id>/`. SHA-256 prefixes of `m1-case-results.json`, `summary.json`, `m1-identity.json` and `lane-ownership.json`:
  - `sim`: `cdf59d9c`, `12687712`, `195c0184`, `3a9eb3ec`.
  - `snapshot-isolated`: `94efcd76`, `a4385bfc`, `27bb5ffd`, `59fe78de`.
  - `snapshot-upgrade`: `3d43bd26`, `e6622ead`, `b22db4bb`, `2754ea42`.
  - `migration`: `8f03d6ae`, `b4338f63`, `a477f65c`, `a7c629de`.
  - `storage`: `69a1be8a`, `f50117ee`, `03fdc680`, `183aaff8`; step records `storage/steps/`; commands `cmd/09`–`cmd/16`.
- Run root `public/`: `ancestor-boundary.json`, `w1-wake.json`, `w2-liveness.json`, `w3-formal-start.json`, `w4-end.json`, `w4-compare.json`, `sampler/`, `clone-guard.json`, `secret-scan.json`, `round-1-rows.json`, `round-1-summary.json`, `diagnosis-storage-round1.md`, `command.txt`, `tool-hashes.txt`, `launcher.log` (`5ae3c324…`), `full-run-exit.json`.
- Messages to the Lead: start check (ask, answered with `msg_4b7f865b8a34`), ACK `msg_98035bce3c98`, gates `msg_b661d2e8a9df` and `msg_47b04be4d0e4`, first run id `msg_546231cc0f62`, progress `msg_c72cf0e277e5`, phase results `msg_18f33c554957`, `msg_da7f3eef140a`, `msg_b62db06a5fc2` and `msg_794120585ad8`, failure and window return `msg_7db50c6c9ae1`, confirmation `msg_4addd386005c`.

### Next

The Lead decides on the two common harness repairs above and on the diagnosis of the import failure. A repair needs a new frozen candidate, independent source review and a new window. Then both complete 488-row rounds and all legacy groups must run again from a fresh clone. This attempt and its failed rows stay in the record. All 32 live rows stay `UNVERIFIED`.

## Retry at `aaa823b`: FAIL in round 1, phase `storage` (AC-M1-41), 2026-10-21

Verdict for this attempt: **FAIL**. Round 1 `sim` (394 rows), `snapshot-isolated` (6), `snapshot-upgrade` (6) and `migration` (12) passed completely. In `storage`, 20 of 70 rows passed and 50 rows failed. Round 1 has a record for all 488 rows: 438 PASS and 50 FAIL. Round 2 and legacy did not run. No M1 criterion gets full-run credit. All sections above stay as history.

Owner: a new, independent common/Blackboard QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort, no subworkers. Task `task_ed3b08aa45ea`, dispatch `ctx_b4253986bb55`, session `orca_session_id:207d2a5d-cc4e-4131-9eef-b42ff30da8f1`. The task text calls this role "Codex QA, GPT-6-Astra" and gives an old `--runs` example. Lead message `msg_4d1763091492` supersedes both. This session did not write the product, the tests of this candidate or any review. It does not claim the evidence of earlier sessions or of Canvas QA.

### Identity and command

| Item | Value |
| --- | --- |
| Product SHA = test SHA | `aaa823b25306c5e560f7c4050238b374dec4d4e3` (tests tree `4c7e067feedc644f955afee37806f06e7273dd04`) |
| Changes since `9cdd768` (non-docs) | 9 files, exactly the approved repairs: `0e83e3c` harness (`tests/host/storage-oracle.mjs`, `storage-rows.mjs` and their self-tests); `89fb4b4` reset (`infra/scripts/stack-reset.sh`, its test, `infra/README.md`); `aaa823b` content refusal (`infra/scripts/stack-data.mjs`, `services/lti-service/src/cli/stack-data.test.ts`, `infra/README.md`). All other harness files and the four manifests equal the `9cdd768` provenance. |
| Gates before the run | Host QA PASS `18aa600`; both combined reviews APPROVE (`a4488ac`, `a32fb10`); targeted Q1/Q2 PASS 22/22 (Lead `msg_a33783fa968c`) |
| Window | Lead `msg_a33783fa968c` (sole conditional Docker window). Returned at 11:37:11Z (`msg_866d50ebe5de`); the Lead confirmed in `msg_1ecdfb016045`. |
| Lane | `qa-multi-r1` (storage lane `qa-multi-r1-st`), port 8443, subnet `172.29.0.0/16` |
| Source | `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aaa823b-20261021T1040Z/source`: `git clone --no-hardlinks` under umask 077, born 10:40:34.666Z, detached at the exact SHA. 0 status lines; the only ignored path is `tests/node_modules/`; no `.env`; no root `node_modules`; push URL disabled; pins `9f96f7b` and `b0b83a8` present. Provenance `provenance.json` SHA-256 `f4bf5fc6…`. |
| Run root | `/Users/quangnguyen/cogniate-qa-runs/m1-full-aaa823b-20261021T1054Z`. The root, `public/`, `private/` and `tmp/` are 0700. |
| Phase runs | `sim` `qa-multi-r1-aaa823b2-2026-10-21T10-54-48-482Z`; `snapshot-isolated` `…-11-17-41-577Z`; `snapshot-upgrade` `…-11-19-17-179Z`; `migration` `…-11-21-08-271Z`; `storage` `qa-multi-r1-st-aaa823b2-2026-10-21T11-24-56-069Z` |
| Time | Runner start 10:54:48Z; identities: `sim` 11:17:35.675Z, `snapshot-isolated` 11:19:12.889Z, `snapshot-upgrade` 11:21:03.963Z, `migration` 11:24:51.789Z, `storage` 11:36:43.914Z; parent exit 1 at 11:36:48Z |
| Tools | Node 24.21.0; Docker CLI and engine 29.9.1; Compose 5.6.0. `G1-IDENTITY` PASS in all five phases. |

```sh
cd /Users/quangnguyen/cogniate-qa-runs/m3-frozen-aaa823b-20261021T1040Z/source
umask 022
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=/Users/quangnguyen/cogniate-qa-runs/m1-full-aaa823b-20261021T1054Z/tmp \
node tests/host/run-m1.mjs --sha aaa823b25306c5e560f7c4050238b374dec4d4e3 \
  --test-sha aaa823b25306c5e560f7c4050238b374dec4d4e3 \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-aaa823b-20261021T1040Z/source
```

The runner has no `--runs` option, and this run used no phase filter. The default `full` phase runs the five phases twice and then legacy. It stops after a failed required phase. The external launcher `launch-full.sh` ran the gates, this command, the end boundary and the scan. It did not change the frozen suite.

### Preparation (host only, no Docker)

All preparation ran before the window. No Docker or Compose binary was executed; identities were checked by file hash only. The Lead accepted it in `msg_a33783fa968c`. It gives no product credit.

- `npm --prefix tests ci --no-audit --no-fund` (umask 077): exit 0. npm skipped the esbuild and fsevents install scripts, as in earlier preparations.
- `node tests/host/run-m1.mjs --harness-only --provider all` (umask 022, 10:41:26–10:41:32Z): exit 0. 77 of 77 self-checks (the 73 of `9cdd768` plus 4 from `0e83e3c`), 0 failed, skipped, cancelled or todo. Typecheck PASS. 392 API plus 96 host rows = 488 per round: `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70. The only conditional row is `M1-41.common.c-host-negative`. The `c-selftest` self-test made one `/tmp/qa-selftest-<16 hex>` folder on the host and removed it.
- Old-build overrides: `infra/compat/storage-compat.sha256` (`2eea8dda…`) lists four files; `shasum -c` gives 4 of 4 OK.
- Fixtures: SCORM `a685744e…`, HTML `9f04d3ab…`. Protected baseline file `219da30b…`. Port 8443 had no host listener.
- Old evidence: every recorded hash of the `9cdd768` attempt (round rows, summary, scan, W4, all 20 phase-file prefixes) is unchanged. All earlier attempt roots are present.
- **Tools:** `/Users/quangnguyen/cogniate-qa-runs/claude-common-qa-tools-aaa823b` (0700), copied from `claude-common-qa-tools-9cdd768`. Before the copy, all 16 old hashes equal that folder's own after-edit ledger. 15 of 16 files are byte-identical. Only `launch-full.sh` changed (`d9424447…` → `f68407ee…`): line 16 now has this session's `FROM` and `DISPATCH`; `TASK` is unchanged; 40 bytes differ. The header comments still name `9cdd768` and old message ids, as the Lead required. `progress.sh` and `watch-events.sh` still hard-code the old tool path; the launcher does not call them, and this session did not use them.
- Ledger location: in `prep/prep-hashes.txt`, each `tools-ledger/<file>` entry is the file `claude-common-qa-tools-aaa823b/ledger/ctx_b4253986bb55/<file>`. It is not a subfolder of `prep/`. The accepted files were not rewritten.
- Tool controls on the copies: live-boundary 30 of 30 (Docker stub only), clone-guard 25 of 25 (temporary folders only).

### Live boundary before the run (W1–W3, all PASS)

| Step | Result | Evidence (`public/`) |
| --- | --- | --- |
| Ancestor check | Home 0750 `quangnguyen:staff`; group members `quangnguyen root` of 133 accounts; ACL `group:everyone deny delete` only | `ancestor-boundary.json` `3faf1ff0…` |
| Pre-wake (not boundary evidence) | The idle VM answered with a stale clock (10:46:10Z at host 10:54:33Z); bridge `cf6b8ae191bc`, created 10:37:37Z; 0 containers | `w1-wake.json` (`preWake`) |
| W1 wake | `qa-wake-20261021105433-ed913110` on cached image `sha256:44fce696…`, `--pull never --rm --network none`, one label. Exit 0; 0 wake containers remain. The wake recreated the bridge (`49b8d9d5b39c`, created 10:54:34Z). | `w1-wake.json` `045c00f0…` |
| W2 liveness | Two advancing reads; worst skews 87 ms and 80 ms | `w2-liveness.json` `7c7945bf…` |
| W3 formal start | `runStartSecond` 1792580085 (live `SystemTime` 10:54:45.539Z). Bound identities match; image present. Networks: bridge `49b8d9d5b39c`, host `b9266a37c45a`, none `d2863b51ad44`. 0 containers. 9 volumes: the 7 protected FULL records equal the original baseline, plus the anonymous volumes `a17056b8…` (05:26:47Z) and `d5df35bd…` (05:32:46Z). Both lanes fresh (no exact name, no label); port 8443 free; no subnet clash; 0 problems. | `w3-formal-start.json` `bed6c788…` |
| Gate message | Sent to the Lead before the runner started | `msg_b97f5af29f58` |

### Result of round 1

| Phase | Rows | Result | Run id |
| --- | ---: | --- | --- |
| `sim` | 394 of 394 | 394 PASS (common 26, Blackboard 136, Canvas 232) | `…-10-54-48-482Z` |
| `snapshot-isolated` | 6 of 6 | 6 PASS (Blackboard `M1-37` w, y2; `M1-29` k1–k3; Canvas `M1-37` aa) | `…-11-17-41-577Z` |
| `snapshot-upgrade` | 6 of 6 | 6 PASS: `M1-38.common` h1–h5, `M1-41.common.j-snapshot` | `…-11-19-17-179Z` |
| `migration` | 12 of 12 | 12 PASS: AC-M1-23 (4) and AC-M1-30 (7) `MOODLE-LIVE`, `M1-41.common.j-migration` `SIM` | `…-11-21-08-271Z` |
| `storage` | 70 of 70 | **20 PASS**, **50 FAIL** | `qa-multi-r1-st-…-11-24-56-069Z` |

- Row record (`round-report.mjs`): 488 rows, 488 distinct, 0 missing, 0 duplicate, 0 unmanifested, 0 label mismatch. All rows have one SHA (`aaa823b2…` for product and tests). 438 PASS and 50 FAIL. By owner: common 64 PASS and 50 FAIL, Blackboard 141 PASS, Canvas 233 PASS.
- `sim`: runner aggregate 400 PASS (394 rows plus `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION`, `TEARDOWN`). Vitest 21 files: 386 passed, 0 failed, 6 pending. The 6 pending tests are exactly the six `snapshot-isolated` rows, which passed in the next phase. Health: app and LTI service `profile: default`, `knobs: []`; LTI `simulation_profiles: []`.
- `snapshot-isolated`: aggregate 12 PASS; Vitest 6 passed, 0 failed, 386 pending.
- `snapshot-upgrade`: the seed stage on the pinned `9f96f7b` build passed (1 test). The upgrade stage passed 4 of 4 tests. The host control has 33 requests, 33 outputs and 33 acknowledgments in the phase clone, one of each per request; no request ran twice. The phase identity records `health` as null for this two-stage phase; no row depends on it.
- `migration`: aggregate 11 PASS, including `MIGRATION` (upgrade and rollback lifecycle).
- `storage`: `HARNESS-LOCK-SELFTEST`, `STORAGE-PREPARE`, `HARNESS-MARKER-HOSTCTL` and `STORAGE-OLD-SCHEMA-SETUP` passed; they are not rows. The runner aggregate (30 PASS, 57 FAIL) also counts harness steps and fixtures; it is diagnostic only.
- The storage rows that passed: `a-fresh`, `a-second-start`, `a-restart`, `a-restart-refusal`, `a-lock-reentry`, `a-lock-wait`, `a-lock-stale`, `a-lock-scope`, `b-oracle-lti`, `b-oracle-app`, `b-sequence`, `c-selftest`, `c-host-negative`, `d-clean`, `d-stale`, `d-unknown`, `d-symlink`, `d-owner`, `i-enable-refusal`, `i-candidate-guard`. `c-host-negative` is PASS with the oracle verdict "LOCK NOT ENFORCED (B acquired while A held)". Round 2 did not run, so the same-result rule of the two rounds is not met.
- Canvas rows keep Canvas QA's separate verdict. This QA does not judge them.

### Storage failures (read-only diagnosis)

The diagnosis used file reads of the artifacts, the frozen source and the approved contracts only. No Docker command, rerun, tool, test or product edit, or mode change of evidence was made. Full record: `public/diagnosis-storage-round1.md` (SHA-256 `dc167072…`). It was shared with the Architect triage (`msg_cd6b203f3b09`), which classifies independently.

| Group | First failure | Rows | Classification |
| --- | --- | ---: | --- |
| 1 | `a-serialize`: check "Backup storage_lock_released logged" | 1 | Contract mismatch; product behavior proven |
| 2 | `d-mountpoint`: QA listing `EACCES` on `/v/appdb/packages` | 47 | QA harness defect, proven |
| 3 | `a-first-start-resume`: `stack:data-quarantine` exit 1 | (in group 2) | Cascade of group 2; correct product refusal |
| 4 | `e-old-schema`: portal sign-in HTTP 403 | 2 | QA harness defect, proven |

1. **`a-serialize`.** The QA oracle selects the backup's release event by `command` (`/backup/`). All 87 observed `storage_lock_released` events have `"command": null` (81 in the phase command logs, 6 in the final lane log). Acquire and wait events always name the command. ADR-012 "Lock events" lists `command` as a field and marks only `owner` and `reason` as nullable. The surviving order evidence is consistent with serialization: `stack:up` logged `storage_lock_wait` on the backup at 11:32:14.041Z and acquired the exclusive lock at 11:32:15.044Z (`cmd/59-a-serialize-up.log`, `1c498b3c…`). The backup's own release line was not kept, because the harness did not save the background backup output and later resets replaced the lane log. The backup exit and manifest checks passed; the start-time checks did not run. A decision is needed: release events carry `command` (product), or the oracle matches the backup's `runId` (QA). QA does not choose.
2. **`d-mountpoint` EACCES.** The row first plants `root:root` on `packages` and `uploads` with the root fixture (`cmd/130-fixture-plant.log`, `16207579…`, exit 0). Its own "before" listing then runs as `501:20` and fails with `EACCES` (`cmd/131-fixture-list.log`, `fae55fd7…`). This is before any product command. The row has no `finally` that restores the mountpoints, so the lane keeps them root-owned. `a-fresh` had passed the `HOST_UID:HOST_GID 0700` mountpoint check, so QA's plant made the change. The same `EACCES` failed `d-content-folder`, `f-pairid`, `f-identity-missing`, `f-db-without-identity`, `f-project` and `f-half-pair`. `f-originals-back` did not run.
3. **`a-first-start-resume`.** `stack:data-quarantine` refused `source_unreadable` for `cogniate-app/packages` and changed no target (`cmd/185-a-first-start-partial.log`, `ad4e68cc…`). ADR-012 §4 requires this refusal for an entry that only root can read. The row's own behavior was not exercised. The second `@seed` then exited 1 because `lti-service` was not running (`cmd/186-seed.log`, `7cbf4a4e…`). 38 more rows did not run behind `@seed`, `@backup-B`, `@post-B`, `@legacy-place`, `@legacy-remove` and `@legacy-import-lane`. Group 2 has 7 + 1 + 1 + 38 = 47 rows.
4. **`e-old-schema` 403.** The repaired content check worked: the `content_missing` import refused and kept the target FRESH (`cmd/208-content-import.log`, `069cdaaf…`, checked 3). The import into FRESH passed with `storage_content_check` `pass`, checked 3 = QA count 3 (`cmd/212-old-schema-import.log`, `ddd471d4…`). `stack:up` exit 0, and the v10 platform was listed. Then `POST /app-api/session` returned 403. The app logged `csrf_rejected` at 11:36:43.868Z (`service-logs/cogniate-app.jsonl`, `389ff661…`). `security.md` §6 and the app API contract require `Origin` = `PUBLIC_APP_URL` for portal API writes. The QA helper `portal()` in `tests/host/storage-lane.mjs` sends no `Origin`. `e-content-missing` did not run. Predicted, not observed: `writeMarkers()` in the fixtures `@backup-B` and `@post-B` will get the same 403 after a group-2 repair.

No product defect is proven in groups 2–4. Group 1 needs a contract decision. No acceptance value was changed to fit a result.

**Not run:** round 2 (488 rows) and all twelve legacy groups.

Common and Blackboard rows of round 1, by criterion (each needs a second complete round):

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
| M1-23 | 4 PASS (`MOODLE-LIVE`) | – |
| M1-24 | 2 PASS | – |
| M1-25 | 1 PASS | 1 PASS |
| M1-27 | – | 1 PASS |
| M1-28 | – | 2 PASS |
| M1-29 | – | 21 PASS, including k1–k3 |
| M1-30 | 7 PASS (`MOODLE-LIVE`) | – |
| M1-31 | – | 2 PASS |
| M1-33 | – | 4 PASS |
| M1-34 | – | 14 PASS |
| M1-35 | 3 PASS (profile off/on routes) | – |
| M1-36 | – | 5 PASS |
| M1-37 | – | 32 PASS, including v2, v5, v7, v9, v11, v12, w, x1, x2, y1, y2, z1–z5 |
| M1-38 | 6 PASS: h1–h5, i5 | 8 PASS, including i3 and i4 |
| M1-39 | 1 PASS | – |
| M1-41 | 22 PASS (`j-snapshot`, `j-migration` and the 20 storage rows above); **50 FAIL** (storage) | – |

AC-M1-08, -09, -16, -17, -20, -26, -32 and -40 have no common or Blackboard row; their rows belong to Canvas QA.

Per-row records (id, AC, owner, phase, status, label, both SHAs, run id, command, start time, artifact path): `public/round-1-rows.json` (SHA-256 `134bafe2…`) and `public/round-1-summary.json` (`b5d0d596…`).

### Health, images and timings

- Images (phase `images.json`): `erseco/alpine-moodle:v5.2.4` `sha256:3a310197…`, `node:24.22.0-alpine3.24` `sha256:44fce696…` (app, LTI service and helpers), `postgres:16-alpine` `sha256:721873c3…`, `caddy:2.11.7-alpine` `sha256:d8542f48…`.
- Host control (all actions exit 0):
  - `sim`: 32 `m1-restart` actions, 5,893–8,641 ms (median 6,050 ms); 6 `m1-profile` actions, 5,934–6,503 ms; 440 CLI calls (20 with the expected exit 1).
  - `snapshot-isolated`: 1 restart (6,067 ms) and 2 profile actions (6,017 and 6,048 ms).
  - `snapshot-upgrade`: 33 CLI calls, no replay.
  - `storage`: 1 restart (6,100 ms), from `a-lock-scope`.
- Sink capture (AC-M1-12, for the Canvas judge): complete in every SIM-bearing phase, with `service_started` and `service_stopping`, a trailing newline and zero `sink_hit`.
  - `sim`: 10:55:31.721Z–11:17:25.272Z, SHA-256 `0f1e7674…`.
  - `snapshot-isolated`: 11:18:25.150Z–11:19:05.768Z, `c58307f6…`.
  - `snapshot-upgrade`: 4 lines (two boots), 11:20:00.767Z–11:20:56.157Z, `5bdc974e…`.
  - `migration`: 14 lines (seven boots), 11:21:52.130Z–11:24:45.000Z, `bed7a412…`.
  - `storage`: no sink (no LMS simulation in this phase).
  - Canvas QA received each phase in `msg_79752e648fce`, `msg_3816b95c668e`, `msg_f0a0aaab3d75`, `msg_a4df578931ce` and `msg_295643a96c6e`, and the run end in `msg_e7b3059ffea0`.

### Privacy (AC-M3-07 method)

- The private capability union holds 1,466 captured values and 53 stack values (`private/watch`, 0700).
- 0 hits in 52 raw service, simulator and gate logs.
- 0 hits and 0 JWT-shaped strings in 1,313 public files, including 5 binary public files (byte scan). `public/secret-scan.json` SHA-256 `c07a29f0…`.
- Private browser artifacts (160 files: 113 trace entries and 15 screenshots) stay in the phase clones. 27 of them contain captured values, as expected for raw traces. They are not shared evidence; Canvas QA owns their redaction.

### Observed permissions (Lead permission contract)

| Path | Observed |
| --- | --- |
| Source root, `source/`, run root, `public/`, `private/`, `tmp/`, tool folder | 0700 (umask 077) |
| Phase clone roots (runner, umask 022) | Each born 0755, then set to 0700 by the guard: `sim` after 113 ms, `snapshot-isolated` 208 ms, `snapshot-upgrade` 163 ms, `migration` 232 ms, `storage` 32 ms. Not private from creation. |
| Captured-secret files | One `captured-secrets.jsonl` per clone was 0644; the guard set it to 0600 at each phase checkpoint (4 files). The storage clone had none. |
| Private folders of this run | `qa-m1-private-backup-wxSm26`, `qa-m1-snapshot-private-Vf77Ga` and the three `-storage-private` folders: root 0700. |
| Inside those private folders | All files of the backup and snapshot folders are 0600. 12 subfolders of `qa-m1-private-backup-wxSm26` are 0755. In `qa-multi-r1-st-…-storage-private`, two files were 0644 during and after the run: a QA hold copy `out/hold-f-half-…/cogniate.db` (315,392 bytes) and the 2-byte QA file `out/content-target-…/qa.txt`. Their folders are 0700. **Deviation:** the private database copy did not meet the secret-0600 rule during the run. The clone guard does not cover these paths, and this run was not compliant for that file. |
| Diagnosis file | `public/diagnosis-storage-round1.md` was written after the scan as 0644 and then set to 0600 by this session. It holds no captured value. |

The guard changed modes only, at exact names. Record: `public/clone-guard.json` (`38b7ee36…`), 5 clones, 5 checkpoints, 0 problems.

Post-run correction (Lead `msg_6b7ada30298a`, host only, after the scan and the diagnosis): this session set only the hold copy `qa-multi-r1-st-aaa823b2-2026-10-21T11-24-56-069Z-storage-private/out/hold-f-half-f50d1dc235febf0e/cogniate.db` from 0644 to 0600 at 11:47:11.753Z. Method: open with `O_NOFOLLOW`; check a regular file of the QA user with the same device and inode as `lstat`; `fchmod` on that descriptor only. Before and after: uid 501, gid 20, device 16777233, inode 8714706, 315,392 bytes, one link, SHA-256 `b81ce769570b56eeb8f06129758df82e01898a26c4b2391e540023453cfcb1c0`; only the mode changed. Record: `public/permission-correction-hold-db.json` (SHA-256 `f99bdcf000bd789df6f001e1b3264368fd1aa15a6a96444113bdc2df83ca0fd3`, 0600). `qa.txt`, the backup subfolders, the scan, the guard record, the diagnosis and all logs were not changed. The correction does not make the run compliant after the fact.

### Isolation and cleanup (AC-M3-06)

- The runner teardown removed only resources from its ownership record in all five phases. `M3-ISOLATION` and `TEARDOWN` PASS ("left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks").
- W4 live end boundary at 11:36:55Z (`w4-end.json` `93a5494a…`, live `SystemTime` 11:36:53.199Z): identities unchanged; 0 containers; both lanes fresh; the 7 protected FULL records equal W3 and the original baseline; `a17056b8…` and `d5df35bd…` unchanged.
- **Strict W3-to-end comparison: PASS** (`w4-compare.json` `8e79dea1…`, 0 problems). Bridge `49b8d9d5b39c`, host and none have the same Ids.
- Sampler (167 samples): one bridge Id, zero clock-skew violations, zero failed reads, at most one compose project (`sampler/lane-containers.json` `6ae2dcb1…`). Apart from QA's own oracle and fixture containers, no non-lane container appeared.
- No owned process remains. The five phase clones, three `-storage-private` folders and the two private folders are kept for review.

### Evidence

- Phase artifacts (redacted): `/Users/quangnguyen/cogniate-qa-runs/m3-frozen-aaa823b-20261021T1040Z/source/tests/host/artifacts/<run id>/`. SHA-256 prefixes of `m1-case-results.json`, `summary.json`, `m1-identity.json` and `lane-ownership.json`:
  - `sim`: `53394632`, `fe6755db`, `0959aa80`, `35aa8532`.
  - `snapshot-isolated`: `6ded3fb4`, `a42c0d93`, `4cce238e`, `8cecf693`.
  - `snapshot-upgrade`: `627cd19c`, `9267ce47`, `0d71ce2f`, `dfeb530b`.
  - `migration`: `6d9395e5`, `f00c9bda`, `66fc85fb`, `22b94c47`.
  - `storage`: `e3a4f381`, `81214d35`, `eb70904e`, `2e940a84`; step records `storage/steps/`; commands `cmd/`.
- Run root `public/`: `ancestor-boundary.json`, `w1-wake.json`, `w2-liveness.json`, `w3-formal-start.json`, `w4-end.json`, `w4-compare.json`, `sampler/`, `clone-guard.json`, `secret-scan.json`, `round-1-rows.json`, `round-1-summary.json`, `diagnosis-storage-round1.md`, `permission-correction-hold-db.json`, `command.txt` (`bbebb8c8…`), `tool-hashes.txt` (`20200c5c…`), `launcher.log` (`a5bc4373…`), `full-run-exit.json`.
- Source root `prep/`: preparation logs and `prep-hashes.txt`; `provenance.json`.
- Messages to the Lead: ACK `msg_f582c5c3931e`, readiness `msg_942429d39248`, grant ACK `msg_4fd40d9d2f86`, gate `msg_b97f5af29f58`, `sim` result `msg_26e04f827018`, failure and window return `msg_866d50ebe5de`. Heartbeats every 5 minutes.

### Next

The Lead decides on the two QA harness repairs (`d-mountpoint` listing and restore; `Origin` in `storage-lane.mjs` `portal()` and `app()`) and on the `a-serialize` contract question. A repair needs a new frozen candidate, independent source review and a new window. Then both complete 488-row rounds and all legacy groups must run again from a fresh clone. This attempt and its failed rows stay in the record. All 32 live rows stay `UNVERIFIED`.

## Storage-repair diagnostic at candidate C `d3296dd`: FAIL in `storage` (`@backup-B`), zero credit, 2026-10-21

Verdict for this diagnostic: **FAIL**. It gives no acceptance credit (triage revision 4 §9 step 7). The migration phase passed 12 of 12 rows, and the run-or-stop rule let the storage child start. In `storage`, 33 of 70 rows passed and 37 rows failed. All 37 failures come from one first cause: the fixture `@backup-B` got `HTTP 502` on its first request. Owned cleanup and the strict W4 passed. No full round, legacy group, M2 or T7 ran. All sections above stay as history.

Owner: a fresh, independent common/Blackboard runtime QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort, no subworkers. Task `task_d006a77c4696`, dispatch `ctx_1183f38cf351`, session `orca_session_id:45365243-2a69-428d-a64b-2050a99c4765`, run `run_ebe671ad72a9`. This session did not write the product, the tests, the triage or any review. It does not judge Canvas rows. It proposes no fix: the remediation owner `ctx_898acbaef3a6` owns every repair.

### Identity and command

| Item | Value |
| --- | --- |
| Candidate C | `d3296dd6eddbe723364a639d8e2db0adf12ab183` (tree `fae39031`), tests tree `183a72b2fea5ff065fc57c96649199bc720fb6e0` |
| Product and harness | Product equal to `9f8ac625443931242edd8da301c3d4f0d3e34290` (empty non-docs, non-tests diff). Harness equal to `c71912ff76965f60d92d964ac0bccf5337f59771` (empty non-docs diff). |
| Criteria read | Charter; phase-plan top; triage revision 4 at `2d763fe` (SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`, verified); M1, M3, ADR-012; storage-command conformance; the accepted Round 2 harness QA report (`614baae`) and its A and B approvals (`ba4b124`, `d3296dd`). |
| Window | Lead grant `msg_c18858e1a424`: exclusive, diagnostic only, until `2026-10-21T21:15:00.000Z`. Returned at 19:29:48Z (`msg_ae9f02a8b3a5`). |
| Lanes | Migration `qa-multi-r1`, storage `qa-multi-r1-st`; port 8443; subnet `172.29.0.0/16` |
| Private root | `/Users/quangnguyen/cogniate-qa-runs/qa-common-c-d3296dd-20261021T1842Z` (0700, made under umask 077). `source/` is a `git clone --no-hardlinks` of the worktree, detached at C: 0 status lines (after `npm --prefix tests ci`, the only ignored path is `tests/node_modules/`), no `.env`, no infra state, no git hook and no `core.hooksPath`, push URL disabled, pins `9f96f7b`, `b0b83a8` and `ccdd9ef` present. |
| Tools | `<root>/tools`. 16 files byte-identical to the accepted `claude-common-qa-tools-aaa823b` (equal to its after-edit ledger). New for the diagnostic: `launch-diag.sh` (`f2fa6e06ffd0eee5f13f8d813997debcd9038073613411a60989b1be9966c6ba`, derived from `launch-full.sh`) and the `--w4-command` wrapper `w4-diag.sh` v2 (`860b072cf66208379aba840194b99401c2d643014cfce8e5720ec02fd2aa3e4f`). The Lead read both before the grant. |
| Time (UTC) | Launcher 19:11:10Z; runner start 19:11:27.000Z; `w` 19:11:27.784Z; migration child 19:11:27.997Z–19:15:28.876Z (identity); storage child 19:15:33.177Z–19:29:31.520Z (identity); W4 19:29:35Z–19:29:48Z; runner exit 1 at 19:29:48Z |

Runner child (from `public/command.txt`, `1888c8e4…`), started by `launch-diag.sh` after W1–W3:

```sh
cd /Users/quangnguyen/cogniate-qa-runs/qa-common-c-d3296dd-20261021T1842Z/source
umask 022
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=<root>/diag/tmp \
node tests/host/run-m1.mjs --phase diagnostic --sha d3296dd6eddbe723364a639d8e2db0adf12ab183 \
  --test-sha d3296dd6eddbe723364a639d8e2db0adf12ab183 --source <root>/source \
  --window-end 2026-10-21T21:15:00.000Z --w4-command <root>/tools/w4-diag.sh --diagnostic-root <root>/diag/private
```

The launcher removed every `QA_*`, `npm_*` and `NPM_CONFIG_*` variable before any child started (`public/env-names.txt`: 63 names, 0 of these). So `QA_ORACLE_CREATE_OBSERVE` was absent, and `run-m1.mjs` passes no copy hook. Both children used the core default clone root; no `--checkout` or `--workdir`.

### Preparation (host only, before the grant)

- Inputs: HTML `9f04d3ab…` and SCORM `a685744e…` match; protected baseline file `219da30b…` (7 names); `infra/compat/storage-compat.sha256` 4 of 4 OK; Docker CLI `678271…` and Compose `1ec06408…` by file hash only; macOS 27.0.1 arm64; Node 24.21.0. Inventory by a host read of the frozen manifests: 488 rows; `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70; common 114, Blackboard 141, Canvas 233; the only conditional row is `M1-41.common.c-host-negative`.
- Tool controls (synthetic, host only): live-boundary 30 of 30, clone-guard 25 of 25, W4 wrapper 9 of 9 for v1 and for v2. v2 only treats an unreaped (zombie) sampler as stopped; v1 waited 120 s per synthetic case because the fake sampler was a child of a blocked process. My first control attempt was invalid: my own fail-closed stub was first on `PATH`, so the boundary tool hashed the stub as the CLI. It is kept as evidence.
- Observation O-1 (optional, no credit, Lead `msg_c18858e1a424`: goes to the remediation owner): `run-m1.mjs --harness-only --provider all` exits 1 at C. Its `checked()` call has a 120 s timeout (`tests/host/run-m1.mjs:53`). The concurrent `node --test` run was stopped at 120.0 s while `storage-rows.selftest.mjs` still ran: 145 pass, 0 fail, 1 cancelled, 6 files interrupted, 0 Docker-stub calls. I did not retry it. Its own synthetic scratch (78 entries, listed with SHA-256) was removed with Lead permission. npm (tool state, not QA-authored) wrote two debug logs at 0644 in that run's private HOME (`prep/home-ho/.npm/_logs/`); they stay.
- Observation O-2: an unrelated orphan `node --test tests/host/m1-control.selftest.mjs` (PID 64140, started 06:26 UTC) ran on the host. It is not mine and stayed untouched.

### Window-level boundary (W1–W4) and lane-level core boundaries

Lead clarification (`msg_c18858e1a424`): one W1/W2/W3 binds both lanes to this continuous exclusive window; each child records its own core boundaries; the continuous sampler and one strict W4 bind both lanes through the end.

| Step | Result | Evidence (`<root>/diag/public/`) |
| --- | --- | --- |
| Ancestor check | Home 0750; group members `quangnguyen root` only | `ancestor-boundary.json` `59001418…` |
| W1 wake | Pre-wake idle-VM cache (clock 12:14:57Z at host 19:11:11Z; not boundary evidence). Wake container on cached image `sha256:44fce696…`, `--pull never --rm --network none`; 0 remain. The wake recreated the bridge (`97b5a72ce0be` → `6dad4ee68548`). | `w1-wake.json` `bd95e023…` |
| W2 liveness | PASS (advancing clock) | `w2-liveness.json` `0fd85d29…` |
| W3 formal start | Live `SystemTime` 19:11:24.430Z (`runStartSecond` 1792609884). OS, CLI, Compose, engine 29.9.1 and image match. 0 containers. 9 volumes: the 7 protected FULL records equal the baseline, plus anonymous `a17056b8…` (05:26:47Z) and `d5df35bd…` (05:32:46Z). Both lanes fresh; port free; no subnet clash; 0 problems. | `w3-formal-start.json` `b0d08c98aa512838d4b27a59860267df286c1ec6822b17f9f1a2c0e38dad542c` |
| Lane core boundaries | Each child: `G1-IDENTITY` PASS, `PRE` PASS (fresh lane, Docker clock), protected-volume snapshots, `M3-ISOLATION` PASS, `TEARDOWN` PASS | phase `summary.json` |
| Sampler | 73 samples, 0 failed, one bridge Id, 0 skew violations (max 0 ms), at most one compose project | `sampler/lane-containers.json` `9af929aa…` |
| W4 end and strict compare | End live 19:29:40.959Z; 0 containers; 9 volumes; both lanes fresh. Strict W3-to-end compare: **0 problems**. The 7 protected FULL records, both anonymous volumes and the bridge, host and none Ids are unchanged. | `w4-end.json` `6adacbef…`, `w4-compare.json` `9e88a2b6…` |

### Migration phase (`qa-multi-r1-d3296dd6-2026-10-21T19-11-27-997Z`)

- Child exit 0. 12 of 12 rows PASS: `M1-23.common` baseline, backup, backup-running, upgrade; `M1-30.common` postwrite, reject-bytes, reject-missing, reject-backup-id, reject-project, restore, rollback; `M1-41.common.j-migration`.
- Scan record: complete; 10 points (after the private backup, after each of the 4 damage copies, the phase end, and 4 `configDiff` scratch removals); 0 hits, 0 corrections, 0 refusals, 0 problems.
- `TEARDOWN` PASS; ownership record: 0 ledger errors, 0 kept, 0 failed, 5 removed.
- Run-or-stop rule (a)–(f): all held. The §9.1 handoff check passed. `D` = `<root>/diag/private/qa-m1-diagnostic-c340685a52fff4c6` (new, 0700). `H` = `D/handoff.json` (0600, made by the migration child in the window); `m123Clone` is the migration clone, `m123Backup` is `qa-m1-private-backup-5g2Lij/original`. The storage child got the same `H` and `w`, and `@old-schema-setup` passed its own handoff check.

### Storage phase (`qa-multi-r1-st-d3296dd6-2026-10-21T19-15-33-177Z`)

- Child exit 1. 70 of 70 row ids have one result: **33 PASS, 37 FAIL**, 0 NOT_APPLICABLE. `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION` and `TEARDOWN` PASS (0 left). No phase stop. 82 scan points, all with 0 hits, corrections, refusals and problems. Ownership: 0 errors, 0 kept, 0 failed, 4 removed.
- PASS rows: `c-selftest`, `c-host-negative` (oracle "LOCK NOT ENFORCED (B acquired while A held)"; PASS is one of its two frozen permitted results), `a-fresh`, `a-second-start`, `a-restart`, `d-clean`, `a-restart-refusal`, `b-oracle-lti`, `b-oracle-app`, `a-lock-reentry`, `a-lock-wait`, `a-lock-stale`, `a-serialize`, `a-lock-scope`, `i-enable-refusal`, `i-candidate-guard`, `d-stale`, `d-unknown`, `d-symlink`, `d-owner`, `d-mountpoint`, `d-content-folder`, `f-pairid`, `f-identity-missing`, `f-db-without-identity`, `f-project`, `f-half-pair`, `f-originals-back`, `a-first-start-resume`, `e-not-same-import`, `b-sequence`, `e-old-schema`, `e-content-missing`. Fixtures `@prepare`, `@seed`, `@seed-resume` and `@old-schema-setup` passed.
- Rows and steps: the phase wrote **81 step records** = the **70 rows** + **11 fixture runs** (`@prepare`, `@seed`, `@seed-resume`, `@backup-B`, `@post-B` three times, `@legacy-place`, `@legacy-remove`, `@legacy-import-lane`, `@old-schema-setup`). Fixture runs are not rows (`coverage.mjs` counts row ids only). Of the 11 fixture runs, 4 PASS and 7 FAIL: `@backup-B` with the first cause below, and the other six as "not run: prerequisite …". The row counts above (33 PASS, 37 FAIL) count rows only.

**First cause (one distinct cause).** Fixture `@backup-B` (step 034) FAIL: "New LTI platform: HTTP 502", duration 0 s (`storage/steps/034-fixture-backup-B.json` `12b30271…`). It wrote no command log: `cmd/290-fixture-list.log` is the unchanged-state check of the `e-not-same-import` refusal (`refusal()`, `storage-rows.mjs:241–247`), and the next log, `cmd/291-harness-stop.log`, starts `b-sequence`.

First-cause map of the 37 FAIL rows (each note is "not run: prerequisite … did not pass"):

| Prerequisite named | Rows |
| --- | --- |
| `@backup-B` | 14: `h-volume-manifest`, `g-damaged`, `h-nomanifest`, `g-prepared-lti`, `g-prepared`, `g-staged`, `g-swap-lti-mid`, `g-swapped-lti`, `g-swap-app-mid`, `g-swapped`, `g-identity-lti`, `g-identity-app`, `g-rollback-mid`, `g-committed-lti` |
| `@post-B` (not run behind `@backup-B`) | 3: `g-orphan-refusal`, `g-orphan-stopped`, `g-tamper` |
| `@legacy-place` (not run behind `g-quarantine`) | 3: `h-legacy-manifest`, `e-hot-journal`, `e-old-layout` |
| `@legacy-import-lane` (not run behind `h-pair-mismatch`) | 5: `e-import-recover`, `e-changed-byte`, `e-added-wal`, `e-import-nonfresh`, `h-old-manifest` |
| Earlier rows of this chain | 12: `h-open-journal` (`g-staged`); `g-recover-idempotent` (the eleven `g-*` drill rows); `g-orphan-complete` (`g-orphan-refusal`); `g-quarantine-in-use`, `g-quarantine` (`g-tamper`); `h-target-state` (`g-staged`, `@legacy-place`); `e-fresh-refusal`, `g-fresh-target` (`h-target-state`); `h-pair-mismatch` (`g-fresh-target`, `@legacy-remove`); `e-import` (`e-import-recover`); `e-kept` (`e-import`); `e-provenance-restore` (`e-kept`) |

The runner `ERROR` record is the round check (`coverage.mjs:78`) at the first non-PASS row in manifest order (`e-fresh-refusal`). It is not a second cause.

Observed facts at the first cause (read only; no fix proposed; for the remediation owner):
- The row before, `e-not-same-import`, first runs `stopped()` (`tests/host/storage-rows.mjs:848`), which stops only `cogniate-app` and `lti-service`. Its `stack:up` is refused by design (`cmd/289-e-not-same-import.log` `72651580…`: exit 1, `legacy_conflict`).
- `@backup-B` starts the stack only when no lane container runs (`storage-rows.mjs:864`). `lane.services()` lists every lane compose container (`storage-docker.mjs:330–340`). `proxy`, `postgres` and `moodle` were still running, so no `up` ran. Then `writeMarkers` sent `POST /api/platforms` (`storage-lane.mjs:214–217`) and got `502`.
- The archived service logs before the next reset (`storage/log-archive/01-before-b-sequence-reset-1/`) end with `service_stopping` of `lti-service` and `cogniate-app` at 19:26:45.03Z, with no later start. The proxy container of that moment was replaced by the later `b-sequence` reset, so no proxy log of the `502` exists in owned evidence. The final proxy log has only two later `502` lines (19:29:31Z, `/healthz`, after the teardown stop).
- In the `aaa823b` round, the phase never reached `@backup-B`.

### Runtime checks (host read of the artifacts; `public/v-checks.json` `8584b11f…`, judge script `prep/bin/vchecks.py` `359d7112…`)

| Check | Result | Evidence |
| --- | --- | --- |
| V1-R `a-serialize` | **Met** | Run `X` = `2d5ddd4b96648e86`, spawned `pgid` 27874. The saved backup output has one acquire and one release of `X`; the release is the same event as the one release of `X` in the lock-log archive; `command` = `stack:data-backup` = the acquire command; the `stack:up` wait names owner `X`. Clock `lo` −12.2 ms, `hi` 63.8 ms; release 19:22:44.908Z; `StartedAt` margins over `R.ts + hi`: `lti-service` 2,354.6 ms, `cogniate-app` 2,293.1 ms. |
| V2-R `d-mountpoint` | **Met** | Row PASS. Commands 132–136: listing → root plant → `meta` → `stack:up` → stop, then the listing. 0 `EACCES` and 0 `source_unreadable` in `cmd/*.log`. Both `a-first-start-resume` quarantines (`cmd/268`, `cmd/277`) log `storage_quarantine_copy` and exit 0. No phase stop. |
| V3-R `Origin` | **Not met** | Zero `csrf_rejected` over the whole phase window: 5 segments (`absence.json` PASS) and the final copy. `e-old-schema` PASS; the phase-end app log has `POST /app-api/session 204` and `GET /app-api/connections 200`. But the required `@backup-B` platform 201 and connection 201 were not observed (`502`), and the three `@post-B` runs did not run. |
| V4-R scans | **Met** | Migration: 10 points; storage: 82 points; all 0 hits, corrections, refusals and problems; both records complete. |
| V5-R P-1a | **Met by row assertions** | `a-fresh` PASS (its `ENOENT` precondition makes the row BLOCKED otherwise; no separate `ENOENT` record is published). `d-content-folder` PASS; "unsafe case cleanup: uploads is a new empty 0700 directory (device 16777233, inode 10710173)"; the before-listings of the absent case are empty. |

### Observed permissions

| Path | Observed |
| --- | --- |
| Private root, `source/`, `tools/`, `prep/`, `diag/` and its `public/`, `private/`, `tmp/` | 0700 folders and 0600 files (umask 077) |
| Phase clone roots and their `-storage-private` roots (runner, umask 022) | Born 0755 by the runner, then set 0700 by the clone guard (2 clones, 2 checkpoints, 1 captured-secret file set to 0600, 0 problems). Not private from creation; this is the accepted narrow guard. |
| Lane private roots (migration and storage) | Root and the five entries `bin/`, `out/`, `backups/`, `quarantine/`, `scratch/` are 0700; the only entry with group or other bits is `bin/storage-fixture-script.mjs` at the required 0555. |
| `qa-m1-private-backup-5g2Lij` | 30 entries; 0 with group or other bits |
| `D` | 0700. `handoff.json`, `migration-scans.json` and `diagnostic.json` are 0600. **Observation:** the runner wrote `migration-results.json` and `storage-results.json` at 0644 (child umask 022, `run-m1.mjs:414`). They hold row ids, status and notes only. I did not change them. |
| `diag/tmp` leftovers | Two `qa-tree-*/index` files (0644, git indexes of the public `tests/` tree) and the Node compile cache stayed after the run. Kept. |

### Privacy and cleanup

- Secret scan: 0 problems (`secret-scan.json` `dd9cf887…`); 38 captured values and 17 stack values; 19 raw files and 713 public files checked.
- Owned cleanup: each child's teardown removed only recorded resources; the diagnostic teardown check found zero lane resources for both projects; W4 confirms. No owned process remains. Clones, lane private roots, the backup root and `D` stay for review. No manual removal.

### Evidence

- Manifest: `<root>/diag/public/evidence-manifest.tsv` (41 files with SHA-256, size and mode; SHA-256 `07ba10fc008cc650b179d85fc57ebf6113b0f7878a403dd11e8354ab72e1132e`).
- Phase artifacts (redacted): `<root>/source/tests/host/artifacts/qa-multi-r1-d3296dd6-2026-10-21T19-11-27-997Z/` (`summary.json` `12a5dc39…`, `m1-case-results.json` `673c47a3…`, `lane-ownership.json` `6244932b…`) and `…/qa-multi-r1-st-d3296dd6-2026-10-21T19-15-33-177Z/` (`summary.json` `f97b942f…`, `m1-case-results.json` `a3d5c49d…`, `lane-ownership.json` `b7c3ec0b…`, `storage/storage-scans.json` `561f3008…`).
- `D`: `diagnostic.json` `3c746a83…`, `storage-results.json` `cb6d6e6e…`, `migration-results.json` `540c1b54…`.
- Messages: READY `msg_96e6e9385e24`; gate `msg_7952e9570cd6`; start `msg_3afb3931899f`; failure and window return `msg_ae9f02a8b3a5`. Disclosure: I read four Lead messages (18:45–19:07Z) only after READY; they did not conflict with my actions (`msg_2152383e338d`).

### Measured timings

Diagnostic 18 min 21 s (runner start to exit). Migration child 4.0 min. Storage child 14.0 min with 37 rows not run; a passing storage phase is still not measured. W1–W3 17 s; W4 13 s.

### Next

The remediation owner diagnoses the `@backup-B` first cause; the Lead decides the repair. A repair needs a new frozen candidate, the reviews that triage §9 step 6 requires and a new diagnostic grant. The two complete 488-row rounds and all 12 legacy groups did not run and stay required. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.

## Storage-repair diagnostic at candidate C2 `0938ea1`: FAIL in `storage` (three first causes), zero credit, 2026-10-21

Verdict for this diagnostic: **FAIL**. It gives no acceptance credit (triage revision 4 §9 step 7). Migration passed 12 of 12 rows, and the run-or-stop rule let the storage child start. In `storage`, all 70 rows ran: 64 PASS and 6 FAIL. Three FAIL rows are independent first causes. The other three are "not run: prerequisite …" behind them. The repaired `@backup-B` and all three `@post-B` runs passed. Owned cleanup and the strict W4 passed. No full round, legacy group, M2 or T7 ran. All sections above stay as history; the `d3296dd` diagnostic stays history with zero new credit.

Owner: a fresh, independent common/Blackboard runtime QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort, no subworkers. Task `task_b591bb888e58`, dispatch `ctx_0700abfb3430`, session `orca_session_id:e6784e80-d6ae-4416-8857-6ce9b8a16a75`, run `run_ebe671ad72a9`. This session did not write the product, the tests, the triage or any review. It does not judge Canvas rows. It proposes no fix: the remediation owner `ctx_898acbaef3a6` owns every repair.

### Identity and command

| Item | Value |
| --- | --- |
| Candidate C2 | `0938ea1bd29acd00a67c7fc1cc8d7606edf2802d` (tree `20851464`), tests tree `290a773f1c9779693153ae77b46cc8ceb7eb83f4` (= the reviewed repair `c4de96f`). Lead freeze `msg_ec77cf6a22f6`. |
| Product and harness | Tests delta from C `d3296dd`: exactly `tests/host/run-m1.mjs` (`8e1ef65c…`), `storage-rows.mjs` (`0958cc49…`) and `storage-rows.selftest.mjs` (`9ef56478…`). Non-docs delta from `c4de96f`: none. Outside `docs/` and `tests/`, the only difference from `9f8ac62` is `README.md` (Docs-owned M4 draft `82aff91`; no test reads it, and `infra/compat` does not list it). `infra/compat/storage-compat.sha256` 4 of 4 OK. |
| Criteria read | Charter; phase-plan top; triage revision 4 at `2d763fe` (SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`, verified at C2); M1, M3, ADR-012; storage-command conformance; the accepted host repair report `7f4cc61` (`b6248d0e…`) and Reviewer-B `572fe4e` (`7527cc2a…`) as the Lead named them; the Reviewer-A approval at C2 as named in `msg_ec77cf6a22f6`. |
| Window | Lead grant `msg_f14739b51207`: exclusive, diagnostic only, until `2026-10-21T22:15:00.000Z`. Returned at about 20:39Z (`msg_a07d09c540e3`). |
| Lanes | Migration `qa-multi-r1`, storage `qa-multi-r1-st`; port 8443; subnet `172.29.0.0/16` |
| Private root | `/Users/quangnguyen/cogniate-qa-runs/qa-common-c2-20261021T2006Z` (0700, made under umask 077). `source/` = `git clone --no-hardlinks --no-checkout` of the worktree, then `checkout --detach` C2. Checks: 0 status lines (the only ignored path is `tests/node_modules/`); no `.env`, infra state or `tests/host/artifacts`; no non-sample hook and no `core.hooksPath` in any scope; push URL disabled; pins `9f96f7b`, `b0b83a8` and `ccdd9ef` present (`prep/02-source-checks-C2.txt` `db91f420…`). |
| Dependencies | No npm command ran in the preparation. `tests/package.json` (`685c10cf…`) and `package-lock.json` (`213718dd…`) are equal at C2, at `d3296dd` and in the old evidence source. So I copied that source's `tests/node_modules` (read only; it stayed at `d3296dd` with 0 status lines). The per-file SHA-256 and link-target manifest and the modes are equal (1,928 entries; `452a27f9…`). The lock comparison gives 61 installed, 0 extra and 0 mismatched packages; the 50 absent entries are optional packages for other platforms. |
| Tools | `<root>/tools`: 19 files byte-identical to the qualified `d3296dd` tools (the 16 `aaa823b` files plus `launch-diag.sh` `f2fa6e06…`, `w4-diag.sh` v2 `860b072c…` and its control file). New: `launch-diag-c2.sh` `6b0edb6886142949a827487668472e87d11234a0271b0b423741c9f365060403`. It differs from `launch-diag.sh` only in line 18, the `FROM`/`TASK`/`DISPATCH` literals (diff `767ccd2a…`). The Lead read it before the grant. Tool behavior is unchanged, so I ran no new control. The qualified controls stand: boundary 30/30, clone guard 25/25, W4 v2 9/9. |
| Time (UTC) | Launcher 20:13:55Z; runner 20:14:11Z–20:38:51Z; `w` 20:14:11.663Z; migration child 20:14:11.769Z–20:18:00.358Z (summary); storage child 20:18:00.498Z–20:38:29.970Z (summary); W4 20:38:30Z–20:38:51Z; runner exit 1; launcher done 20:38:52Z |

Runner child (`diag/public/command.txt`, `b7b03e33…`), started by `launch-diag-c2.sh` after W1–W3:

```sh
cd /Users/quangnguyen/cogniate-qa-runs/qa-common-c2-20261021T2006Z/source
umask 022
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=<root>/diag/tmp \
node tests/host/run-m1.mjs --phase diagnostic --sha 0938ea1bd29acd00a67c7fc1cc8d7606edf2802d \
  --test-sha 0938ea1bd29acd00a67c7fc1cc8d7606edf2802d --source <root>/source \
  --window-end 2026-10-21T22:15:00.000Z --w4-command <root>/tools/w4-diag.sh --diagnostic-root <root>/diag/private
```

The launcher removed every `QA_*`, `npm_*` and `NPM_CONFIG_*` variable before any child started (`public/env-names.txt`: 63 names, 0 of these). So `QA_ORACLE_CREATE_OBSERVE` was absent; in C2 it is read only at `storage-fixture-script.mjs:430–431` (opt-in) and in one self-test. Both children used the core default clone root, with no `--checkout` or `--workdir`. The launcher ran in its own process group (`nohup` and `setpgrp`), so no tool timeout could stop it.

### Preparation (host only, before the grant)

- Inputs: HTML `9f04d3ab…` and SCORM `a685744e…` match. The protected baseline file is `219da30b…` (7 names). Docker CLI `678271…` and Compose `1ec06408…` were checked by file hash only. macOS 27.0.1 arm64; Node 24.21.0; port 8443 had no listener. Static inventory (a `git archive` copy of the tests tree): 488 rows, 488 distinct; `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70; common 114, Blackboard 141, Canvas 233; the only conditional row is `M1-41.common.c-host-negative`. These are the same as at `d3296dd`. The V4-9 token counts of the runtime modules equal the triage rule exactly.
- I did not repeat `--harness-only`, the host suites or the tool controls (Lead direction). The Lead accepted the host evidence of the repair.
- Network: the preparation made no npm call. The runner's nested `npm run` commands (`stack:*`, `test:acceptance`) used the real HOME, as in every accepted run (no `~/.npmrc`). I make no runtime no-network claim. R2-D-2 of the repair report stays as recorded.
- Disclosed: my first held-source record had two lines broken by the zsh `:t` modifier; record v2 repeats them correctly, and both files stay. The first READY (held source) is superseded by `prep/READY-C2.md` (`67fcb9e5…`; sent as `msg_e45dd76c9373`).
- Observation: the unrelated orphan `node --test tests/host/m1-control.selftest.mjs` (PID 64140) still runs on the host. It is not mine and stayed untouched.

### Window-level boundary (W1–W4) and lane-level core boundaries

Lead clarification (`msg_c18858e1a424`, repeated in `msg_f14739b51207`): one W1/W2/W3 binds both lanes to this continuous exclusive window. Each child records its own core boundaries. The continuous sampler and one strict W4 bind both lanes through the end. There are not two W1–W4 sequences.

| Step | Result | Evidence (`<root>/diag/public/`) |
| --- | --- | --- |
| Ancestor check | Home 0750; group members `quangnguyen root` only | `ancestor-boundary.json` `5b0cbe4e…` |
| W1 wake | Pre-wake idle-VM cache (clock 19:34:35Z at host 20:13:56Z; this is not boundary evidence). Wake container on the cached image `sha256:44fce696…` with `--pull never --rm --network none`; 0 remain. The wake recreated the bridge (`6dad4ee68548` → `a06a73720d59`). | `w1-wake.json` `96088cab…` |
| W2 liveness | PASS (advancing clock) | `w2-liveness.json` `ab68a71c…` |
| W3 formal start | Live `SystemTime` 20:14:08.856Z (`runStartSecond` 1792613648). OS, CLI, Compose, engine 29.9.1 and image match the bound values (0 differences). 0 containers. 9 volumes: the 7 protected FULL records equal the baseline, plus anonymous `a17056b8…` (05:26:47Z) and `d5df35bd…` (05:32:46Z). Both lanes fresh; port free; no subnet clash; 0 problems. | `w3-formal-start.json` `954d2c40f407300cce9bbcb49fd30ee30d77eeb2c2c2a38cd7bdea6faa86ca5e` |
| Lane core boundaries | Each child: `G1-IDENTITY` PASS, `PRE` PASS (fresh lane, Docker clock), protected-volume snapshots, `M3-ISOLATION` PASS, `TEARDOWN` PASS | phase `summary.json` (migration `df253ac8…`, storage `c912ebd8…`) |
| Sampler | 98 samples, 0 failed, one bridge Id, 0 skew violations (max 0 ms), at most one compose project. The two "other" names are the storage lane's own `docker run` oracle and fixture containers (`qa-multi-r1-st-qa-oracle-…`, `qa-multi-r1-st-qa-fixture-…`). | `sampler/lane-containers.json` `c2c450eb…` |
| W4 end and strict compare | End live 20:38:35.753Z; 0 containers; 9 volumes; both lanes fresh. Strict W3-to-end compare: **0 problems**. The 7 protected FULL records, both anonymous volumes and the bridge, host and none Ids are unchanged. | `w4-end.json` `9b73a81f…`, `w4-compare.json` `5635499933f0039fde2333290e407695435b8fbfaaa3e38bd57deb020394dd36` |

### Migration phase (`qa-multi-r1-0938ea1b-2026-10-21T20-14-11-769Z`)

- Child exit 0. 12 of 12 rows PASS: `M1-23.common` baseline, backup, backup-running, upgrade; `M1-30.common` postwrite, reject-bytes, reject-missing, reject-backup-id, reject-project, restore, rollback; `M1-41.common.j-migration`.
- Scan record: complete; 10 points; 0 hits, 0 corrections, 0 refusals, 0 problems.
- `TEARDOWN` PASS; ownership record: 0 ledger errors, 0 kept, 0 failed, 5 removed.
- Run-or-stop rule (a)–(f): all held (`diagnostic.json`: migration code 0, storage `RUN`, cause none). `D` = `<root>/diag/private/qa-m1-diagnostic-bdf74c14c174066e` (new, 0700). `H` = `D/handoff.json` (0600, written by the migration child in the window). `m123Clone` is the migration clone, and `m123Backup` is `qa-m1-private-backup-JOym38/original` (root 0700, made 20:16:22Z). The storage child got the same `H` and `w`, and `@old-schema-setup` passed its own handoff check.

### Storage phase (`qa-multi-r1-st-0938ea1b-2026-10-21T20-18-00-498Z`)

- Child exit 1. 70 of 70 row ids have one result: **64 PASS, 6 FAIL**, 0 NOT_APPLICABLE (`D/storage-results.json` `80fe2f8a…`). `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION` and `TEARDOWN` PASS (0 left). No phase stop. 92 scan points, all with 0 hits, corrections, refusals and problems. Ownership: 0 errors, 0 kept, 0 failed, 4 removed.
- Rows and steps: 81 step records = the 70 rows + 11 fixture runs. All 11 fixture runs passed: `@prepare`, `@seed`, `@seed-resume`, `@backup-B` (18 s), `@post-B` three times, `@legacy-place`, `@legacy-remove`, `@legacy-import-lane` and `@old-schema-setup`. Fixture runs are not rows. The runner `ERROR` record is the round check at the first non-PASS row; it is not a separate cause.
- `c-host-negative` PASS (oracle probe `lock_not_enforced`; PASS is one of its two frozen permitted results).
- The other rows passed, including the g-drill rows other than `prepared-lti`, `h-open-journal`, `g-orphan-refusal`, `g-orphan-complete` (127 s), `g-tamper`, both quarantine rows, `h-target-state`, `e-fresh-refusal`, `g-fresh-target`, `h-pair-mismatch`, `e-import-recover`, `e-changed-byte`, `e-added-wal`, `e-import-nonfresh`, `h-old-manifest`, `b-sequence`, `e-old-schema` and `e-content-missing`.

**Three first causes (facts from the artifacts; no fix proposed).**

| Id | Row (step) | Failed check | Facts |
| --- | --- | --- | --- |
| FC-1 | `M1-41.common.g-prepared-lti` (038), 4 s | "A verified rolled_back" (`tests/host/storage-rows.mjs:1392`) | `cmd/332` drill `--stop-after prepared-lti` exit 3 with `storage_drill_stop`; `cmd/333` `stack:up` refuses `journal_open`; `cmd/334` `--recover` exit 1, "cancelled at the first journal write; the targets equal the state before (verified)". `cmd/335` file set: the lti journal has state `rolled_back`; the app journal is absent. `journalsAre` (`:332`) needs state `rolled_back` in both the lti and the app journal. ADR-012 §8 drill table: `prepared-lti` = "lti `prepared`, app not yet written". `g-prepared` (039) passed, with both journals `rolled_back` (`cmd/340`). The rest of this drill did not run. |
| FC-2 | `M1-41.common.g-orphan-stopped` (054), 1 s | "The maintenance container still runs" (`orphanStart`, `storage-rows.mjs:1405–1416`) | The orphan restore (run `228ffa368ced145a`) took the lock at 20:34:36.445Z. The archived logs have no `storage_content_check` and no `storage_drill_pause` of that restore. The only earlier `storage_drill_pause` in `infra/.logs` is the `g-orphan-refusal` pause (20:32:25.836Z, op `afa56af2…`, resume 20:34:25.840Z). No reset came between them. `orphanStart` waits for `storage_drill_pause` in the group output or in any line of `lane.allLogLines()`, then sends SIGKILL to the group, then needs exactly one running `<lane>-storage-*` container. No `g-orphan-stopped-kill.json` was written. At 20:34:36.879Z, the next `stack:up` (`cmd/495`, run `e3358090…`) logged `storage_lock_reclaimed` with owner `228ffa368ced145a`. |
| FC-3 | `M1-41.common.e-import` (069), 0 s | "legacySources equal the manifest list" | The identity `legacySources` (lti and app, `cmd/567`) = `lti-service/lti.db` `584617df…` and `cogniate-app/cogniate.db` `57edf5a9…`. The X2 manifest lists the same two names and digests. The check compares `name:sha256` with `path.basename(<manifest name>):sha256` (`lti.db`, `cogniate.db`). ADR-012 §8 restore table: import takes "`legacySources` from the manifest". The checks before it in that row passed. |

Dependent rows (each "not run: prerequisite … did not pass"): `g-recover-idempotent` ← `g-prepared-lti`; `e-kept` ← `e-import`; `e-provenance-restore` ← `e-kept`.

Notification order (disclosed): the Lead read step 038 in my artifacts and wrote first (`msg_5b8bd0a2f4ea`). My first-cause facts followed in `msg_7309dd27c6cc`. The consolidated list is `msg_66679b2e354b`. The frozen driver ran to its end unchanged; I made no retry.

### Runtime checks (host read of the artifacts; `public/v-checks.json` `75bc496f…`, judge `prep/bin/vchecks.py` `359d7112…` = the `d3296dd` judge; V3-R record `public/v3-r-c2.json` `a9607d82…`)

| Check | Result | Evidence |
| --- | --- | --- |
| V1-R `a-serialize` | **Met** | Run `X` = `70e872c5d52c9a5a`, spawned `pgid` 99609. The saved backup output has one acquire and one release of `X`. That release is the same event as the one release of `X` in the lock-log archive. `command` = `stack:data-backup` = the acquire command. The `stack:up` wait names owner `X`. Clock `lo` −7.9 ms, `hi` 59.1 ms; release 20:25:11.789Z. `StartedAt` margins over `R.ts + hi`: `lti-service` 2,328.3 ms, `cogniate-app` 2,395.6 ms. |
| V2-R `d-mountpoint` | **Met** | Row PASS. Commands 132–136: listing → root plant → `meta` → `stack:up` → stop. 0 `EACCES` and 0 `source_unreadable` in `cmd/*.log`. Both `a-first-start-resume` quarantines (`cmd/268`, `cmd/277`) log `storage_quarantine_copy` and exit 0. No phase stop. |
| V3-R `Origin` | **Met** | 0 `csrf_rejected` over the whole phase window: 5 segments (`absence.json` PASS; three before the `b-sequence` resets, one before the old-schema reset, the phase end) and the final copy. `e-old-schema` PASS. Platform 201 and connection 201: `@backup-B` (20:29:21Z, and the write after B at 20:29:30Z) and each `@post-B` (20:32:23Z, 20:34:34Z, 20:34:43Z). The judge printed `CHECK`, because its V3-R branch judged only the `d3296dd` failure case. So I read these facts by hand into `v3-r-c2.json`. Its `segments` field prints empty names; `absence.json` names the five segments. |
| V4-R scans | **Met** | Migration: 10 points; storage: 92 points; all with 0 hits, corrections, refusals and problems; both records complete. |
| V5-R P-1a | **Met by row assertions** | `a-fresh` PASS: the row asserts `ENOENT` and is BLOCKED otherwise; no separate `ENOENT` record is published. `d-content-folder` PASS; "unsafe case cleanup: uploads is a new empty 0700 directory (device 16777233, inode 10984586)"; the before-listings of the absent case are empty. |

### Observed permissions

| Path | Observed |
| --- | --- |
| Private root, `source/`, `tools/`, `prep/`, `diag/` and its `public/`, `private/`, `tmp/` | 0700 folders and 0600 files (umask 077). The copied `tests/node_modules` has 0 entries with group or other bits. |
| Phase clone roots (runner, umask 022) | Born 0755 by the runner, then set to 0700 by the clone guard (2 clones, 2 checkpoints, 1 captured-secret file set to 0600, 0 problems). They were not private from creation; this is the accepted narrow guard. |
| Lane private roots (migration and storage) | The root and its five entries `bin/`, `out/`, `backups/`, `quarantine/` and `scratch/` are 0700. The only entry with group or other bits is `bin/storage-fixture-script.mjs` at the required 0555. |
| `qa-m1-private-backup-JOym38` | 0700; 30 entries; 0 with group or other bits |
| `D` | 0700. `handoff.json`, `migration-scans.json` and `diagnostic.json` are 0600. **Observation (again, as at `d3296dd`):** the runner wrote `migration-results.json` and `storage-results.json` at 0644 (child umask 022). They hold row ids, status and notes only. I did not change them. |
| `diag/tmp` leftovers | Two `qa-tree-*/index` files (0644, git indexes of the public `tests/` tree) and the Node compile cache. Kept. |

### Privacy and cleanup

- Secret scan: 0 problems (`secret-scan.json` `0e01aed7…`); 38 captured values and 17 stack values; 4 clones checked.
- Owned cleanup: each child's teardown removed only recorded resources. The diagnostic teardown check found zero lane resources for both projects, and W4 confirms. No owned process remains (launcher, runner and the three observers ended). Clones, lane private roots, the backup root and `D` stay for review. Nothing was removed by hand.
- Monitoring (read only, file reads only, no Docker call): `prep/bin/monitor-diag.py` (`0eb35ade…`), then v2 (`9e1b9ff8…`), which also reports the `@backup-B` and `@post-B` steps for the milestones that the Lead requested (`msg_6686312ed892`).

### Evidence

- Manifest of `<root>/diag` (built outside it): `<root>/prep/diag-evidence-manifest.tsv`, 949 files with SHA-256, size and mode; SHA-256 `fbe803d277a0c741aa5bd499419fc89ead6099ad49441c7aa828ffe9e78bb4bd`. Its only modes other than 0600/0700 are the four 0644 files named above.
- Phase artifacts (redacted): `<root>/source/tests/host/artifacts/qa-multi-r1-0938ea1b-2026-10-21T20-14-11-769Z/` (`summary.json` `df253ac8…`, `m1-case-results.json` `de9a3646…`, `lane-ownership.json` `20e044a3…`) and `…/qa-multi-r1-st-0938ea1b-2026-10-21T20-18-00-498Z/` (`summary.json` `c912ebd8…`, `m1-case-results.json` `0f354e73…`, `lane-ownership.json` `5a00e596…`, `storage/storage-scans.json` `c69f2cd1…`).
- `D`: `diagnostic.json` `95963ae5…`, `storage-results.json` `80fe2f8a…`, `migration-results.json` `ba22c6cb…`.
- Messages: READY `msg_e45dd76c9373`; grant `msg_f14739b51207`; gate `msg_7ef67e54661a`; migration milestone `msg_4a70c77b65cd`; first failure `msg_7309dd27c6cc`; `@post-B` milestone `msg_5758c01e85e5`; consolidated list `msg_66679b2e354b`; window return `msg_a07d09c540e3`.

### Measured timings

Diagnostic 24 min 40 s (runner start to exit); 24 min 57 s from launcher start. W1–W3 16 s. Migration child 3.8 min. Storage child 20.5 min with all 70 rows run (6 FAIL, 3 of them not run behind a failed prerequisite, so a fully passing storage phase is still not measured). W4 21 s.

### Next

The remediation owner diagnoses FC-1, FC-2 and FC-3 in one batch; the Lead decides the repair. A repair needs a new frozen candidate, the reviews of triage §9 step 6 and a new diagnostic grant. The two complete 488-row rounds and all 12 legacy groups did not run and stay required. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.

## Storage-repair diagnostic at candidate C3 `c4c6d04`: PASS (diagnostic gate only, zero credit), 2026-10-22

Verdict for this diagnostic: **PASS**. It gives no acceptance credit (triage revision 4 §9 step 7); the Lead verifies it before any full-run grant. Migration passed 12 of 12 rows, and the run-or-stop rule let the storage child start. In `storage`, all 70 rows ran and passed: 70 PASS, 0 FAIL, 0 NOT_APPLICABLE. The three C2 first causes and their three dependent rows ran and passed (see "R4 target rows"). Owned cleanup, the scans and the strict W4 passed. No full round, legacy group, M2 or T7 ran. All sections above stay as history; the C and C2 diagnostics keep their FAIL results.

Owner: a fresh, independent common/Blackboard runtime QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort, no subworkers. Task `task_8f5644f9910e`, dispatch `ctx_2e9642c8e4be`, session `orca_session_id:990668d2-196c-48c7-9a6a-9b830a63f48e`, run `run_ebe671ad72a9`. This session did not write the product, the tests, the triage or any review. It does not judge Canvas rows. It proposes no fix: the remediation owner `ctx_898acbaef3a6` owns every repair.

### Identity and command

| Item | Value |
| --- | --- |
| Candidate C3 | `c4c6d045b3a132f72bf059d77367d278de9222fa` (tree `bf2948a1a8e143cc9553db77e01ba3c2a4a03d0c`), tests tree `17330479829a6b65e560afc297e2bee6777459dd` (= R4 source `cd731397`). Lead final handoff in this dispatch. |
| Product and harness | Tests delta from C2 `0938ea1`: exactly `tests/host/storage-rows.mjs` (`a9ef100d…`) and `storage-rows.selftest.mjs` (`4fcd18d5…`); `run-m1.mjs` unchanged (`8e1ef65c…`). Non-docs delta from `cd73139`: none. Outside `docs/` and `tests/`, the only difference from `9f8ac62` is `README.md` (Docs-owned M4 draft `82aff91`). `infra/compat/storage-compat.sha256` 4 of 4 OK. |
| Criteria read (bounded, Lead direction: no broad reread) | Charter; phase-plan checkpoint 2026-10-22 01:34 UTC; triage revision 4 at `2d763fe` (SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`, verified at C3; §7.2 V4-9 rule read again); M1 precision `a60ba4a` (ancestor of C3); M1 AC-M1-41 lines for the six target rows and ADR-012 §6 (L6/L7), §8 (R0/R1, restore and import table) and the drill-point table; the C2 section of this report at `e4d7058`; the R4 sections of the accepted reports: QA `133f93e` (SHA-256 `607c6fdb91201c23a2ce73beffa6e155e12a5fc1682502ea9754c5179edd6ec9`), Reviewer-A `5d7a6ff` (`66afb8b92d51fb60aea17b875171313378ac9d8022055e7fc44a796bdc74b30c`), Reviewer-B `c4c6d04` (`c8d0e9248853249d7727209679afc1a59bb18224e545ed9c6263a884314940b3`); hashes verified from Git. |
| Window | Lead grant `msg_44c8dfacddab`: exclusive, diagnostic only, until `2026-10-22T04:05:00.000Z`. Returned at about 02:32Z (`msg_932c80706f81`). |
| Lanes | Migration `qa-multi-r1`, storage `qa-multi-r1-st`; port 8443; subnet `172.29.0.0/16` |
| Private root | `/Users/quangnguyen/cogniate-qa-runs/qa-common-c3-20261022T0154Z` (0700, made under umask 077). `source/` = `git clone --no-hardlinks --no-checkout` of the worktree, then `checkout --detach` C3 (born 01:59:12Z at 0700; 0 entries with group or other bits, also in `.git`; 0 hard-linked files). Checks: 0 status lines (the only ignored path is `tests/node_modules/`); no `.env`, root `node_modules`, infra state, `tests/host/artifacts` or `pnpm-workspace.yaml`; no non-sample hook and no `core.hooksPath` in any scope; push URL disabled; pins `9f96f7b`, `b0b83a8` and `ccdd9ef` present (`prep/02-source-checks-C3-v2.txt`). |
| Dependencies | No npm command ran in the preparation. `tests/package.json` (`685c10cf…`) and `package-lock.json` (`213718dd…`) are equal at C3, at C2 and in the C2 evidence source. That source's `tests/node_modules` still equals its qualified manifest `452a27f9…`, so I copied it (read only) under umask 077. The new per-file SHA-256 and link-target manifest is equal (1,928 entries: 1,667 files, 11 links, 250 directories), the modes are equal, and 0 entries have group or other bits. Lock check: 61 installed, 0 extra, 0 version or integrity mismatch; the 50 absent entries are optional packages for other platforms. |
| Tools | `<root>/tools`: 21 files byte-identical to the C2 tools (cmp 21/21); the C2 tools still equal their C2 ledger. `w4-diag.sh` v2 `860b072c…` unchanged. New: `launch-diag-c3.sh` `fcc6cf35475cd70e4926fa1115a009d92844d7457c0658402f059c6d18266bfa` and `launch-full-c3.sh` `af40a219cf829093a7ac2035d727f1aaeb2f0649bff3d99a99d8944ab09af537`. Each differs from its C2 file only in the `FROM`/`TASK`/`DISPATCH` line (line 18 and line 16; diffs in `tools/ledger/ctx_2e9642c8e4be/`). The Lead read both diffs before the grant. Behavior is unchanged, so I ran no new control; the qualified controls stand: boundary 30/30, clone guard 25/25, W4 v2 9/9. |
| Time (UTC) | READY record 02:00:35Z (sent as `msg_fafb9dbf11a0`); launcher 02:02:57Z; runner 02:03:14Z–02:28:42Z; `w` 02:03:14.160Z; migration child 02:03:14.229Z–about 02:07:12Z; storage child 02:07:12.250Z–about 02:28:33Z; W4 02:28:34Z–02:28:42Z; runner exit 0; launcher done 02:28:43Z |

Runner child (`diag/public/command.txt`, `70f4f69a…`), started by `launch-diag-c3.sh` after W1–W3:

```sh
cd /Users/quangnguyen/cogniate-qa-runs/qa-common-c3-20261022T0154Z/source
umask 022
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=<root>/diag/tmp \
node tests/host/run-m1.mjs --phase diagnostic --sha c4c6d045b3a132f72bf059d77367d278de9222fa \
  --test-sha c4c6d045b3a132f72bf059d77367d278de9222fa --source <root>/source \
  --window-end 2026-10-22T04:05:00.000Z --w4-command <root>/tools/w4-diag.sh --diagnostic-root <root>/diag/private
```

The launcher removed every `QA_*`, `npm_*` and `NPM_CONFIG_*` variable before any child started (`public/env-names.txt`: 61 names, 0 of these). Both children used the core default clone root, with no `--checkout` or `--workdir`. The launcher ran in its own process group (`nohup` and `setpgrp`, pgid 72853).

### Preparation (host only, before the grant)

- Inputs: HTML `9f04d3ab…` and SCORM `a685744e…` match. The protected baseline file is `219da30b…` (7 names). Docker CLI `678271…` and Compose `1ec06408…` were checked by file hash only before the grant. macOS 27.0.1 arm64; Node 24.21.0; port 8443 had no listener.
- Static inventory (Node read of the clone's tests tree): 488 rows, 488 distinct; `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70; common 114, Blackboard 141, Canvas 233; the only conditional row is `M1-41.common.c-host-negative`. The record is byte-identical to the C2 record. The storage manifest equals C2. The V4-9 token counts of the 12 runtime modules equal the triage rule exactly. The clone had 0 status lines after these reads.
- Just before launch (Lead request): a fresh inventory of all 42 `tests/host` files equals the C3 blobs, with 0 extra files (`prep/08-tests-host-inventory-prelaunch.txt` `6d54043c…`). The post-run R4 record script `prep/bin/r4checks.py` (`1b8ce8e5a0e6059e413284650dde3d92e333b137aad250365cdaa1a258f7edc3`) was frozen at 02:02:18Z. The Lead classed it as supplementary analysis, not an acceptance tool (`msg_c9fc01f073cb`). Its control on the C2 artifacts reports all six rows NOT MET, with the C2 product facts (`prep/r4checks-control/c2-artifacts.json` `3137ac6d…`).
- I did not repeat `--harness-only`, the host suites or the tool controls (Lead direction).
- Network: the preparation made no npm call. The runner's nested `npm run` commands used the real HOME, as in every accepted run (no `~/.npmrc`). I make no runtime no-network claim. R4-D-1 of the repair report stays as recorded.
- Observation: the unrelated orphan `node --test tests/host/m1-control.selftest.mjs` (PID 64140) still runs on the host. It is not mine and stayed untouched.

### Window-level boundary (W1–W4) and lane-level core boundaries

One W1/W2/W3 binds both lanes to this continuous exclusive window. Each child records its own core boundaries. The continuous sampler and one strict W4 bind both lanes through the end. There are not two W1–W4 sequences.

| Step | Result | Evidence (`<root>/diag/public/`) |
| --- | --- | --- |
| Ancestor check | Home 0750; group members `quangnguyen root` only | `ancestor-boundary.json` `0a951157…` |
| W1 wake | Pre-wake idle-VM cache (clock 20:43:30Z at host 02:02:58Z; not boundary evidence). Wake container on the cached image `sha256:44fce696…` with `--pull never --rm --network none`; 0 remain. The wake recreated the bridge (`a06a73720d59` → `938ec8dc0008`). | `w1-wake.json` `3ad56acd…` |
| W2 liveness | PASS (advancing clock) | `w2-liveness.json` `54ae1c2c…` |
| W3 formal start | Live `SystemTime` 02:03:11.205Z (`runStartSecond` 1792634591). OS, CLI, Compose, engine 29.9.1 and image match the bound values (0 differences). 0 containers. 9 volumes: the 7 protected FULL records equal the baseline, plus anonymous `a17056b8…` (05:26:47Z) and `d5df35bd…` (05:32:46Z). Both lanes fresh; port free; no subnet clash; 0 problems. | `w3-formal-start.json` `06d069f7357e90046b3fdce70b1dbd3091ed7db770850b9190ed35fb3520f14e` |
| Lane core boundaries | Each child: `G1-IDENTITY` PASS, `PRE` PASS (fresh lane, Docker clock), protected-volume snapshots, `M3-ISOLATION` PASS, `TEARDOWN` PASS | phase `summary.json` (migration `ba285026…`, storage `d50a51f1…`) |
| Sampler | 101 samples, 0 failed, one bridge Id, 0 skew violations (max 0 ms), at most one compose project. The two "other" names are the storage lane's own `docker run` oracle and fixture containers (`qa-multi-r1-st-qa-oracle-…`, `qa-multi-r1-st-qa-fixture-…`). | `sampler/lane-containers.json` `b1460adf…` |
| W4 end and strict compare | End live 02:28:39.277Z; 0 containers; 9 volumes; both lanes fresh; identity 0 differences. Strict W3-to-end compare: **0 problems**. The 7 protected FULL records, both anonymous volumes and the bridge, host and none Ids are unchanged. | `w4-end.json` `ba90d88c…`, `w4-compare.json` `338b1549fb4b5b5f23c8d7e804563c5d6106fc9ca1606a6656ebf4e98ff15b18` |

### Migration phase (`qa-multi-r1-c4c6d045-2026-10-22T02-03-14-229Z`)

- Child exit 0. 12 of 12 rows PASS: `M1-23.common` baseline, backup, backup-running, upgrade; `M1-30.common` postwrite, reject-bytes, reject-missing, reject-backup-id, reject-project, restore, rollback; `M1-41.common.j-migration`. The 12 ids equal the static migration-phase ids (`D/migration-results.json` `7cba9b29…`).
- Scan record: complete; 10 points; 0 hits, 0 corrections, 0 refusals, 0 problems (`D/migration-scans.json` `b8740a7f…`).
- `TEARDOWN` PASS; ownership record: 23 records, 0 ledger errors, 0 kept, 0 failed, 5 removed (`lane-ownership.json` `53fa5b54…`).
- Run-or-stop rule (a)–(f): all held (`D/diagnostic.json` `eb685608…`: migration code 0, storage `RUN`, cause none; storage child code 0; teardown ok; W4 ok). `D` = `<root>/diag/private/qa-m1-diagnostic-f65467dbbff98d1a` (new, 0700, born 02:03:14Z). `H` = `D/handoff.json` (0600, written 02:07:07Z by the migration child). The storage child got the same `H` and `w`, and `@old-schema-setup` passed its own handoff check.

### Storage phase (`qa-multi-r1-st-c4c6d045-2026-10-22T02-07-12-250Z`)

- Child exit 0. 70 of 70 row ids have one result: **70 PASS**, 0 FAIL, 0 NOT_APPLICABLE (`D/storage-results.json` `e1877822…`). The 70 ids equal the static storage-phase ids. Core records `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION` and `TEARDOWN` PASS (0 left); the summary has 87 PASS and no abort. No phase stop. 92 scan points, all with 0 hits, corrections, refusals and problems (`storage/storage-scans.json` `e29d54b7…`). Ownership: 87 records, 0 errors, 0 kept, 0 failed, 4 removed (`lane-ownership.json` `50bf69d6…`).
- Rows and steps: 81 step records = the 70 rows + 11 fixture runs. All 11 fixture runs passed: `@prepare`, `@seed`, `@seed-resume`, `@backup-B` (18 s), `@post-B` three times, `@legacy-place`, `@legacy-remove`, `@legacy-import-lane` and `@old-schema-setup`. Fixture runs are not rows.
- `c-host-negative` PASS (oracle probe `lock_not_enforced`; PASS is one of its two frozen permitted results).

### R4 target rows: runtime execution evidence

A PASS count alone is not credit (Reviewer-B R4 limits). Each row below ran its own commands. I read the raw command logs and file sets by hand. The supplementary record `diag/public/r4-checks.json` (`c515d8dc…`) gives the same result for each row. Command logs are in `<storage artifacts>/cmd/`.

| Row | Result | Raw evidence |
| --- | --- | --- |
| `g-prepared-lti` | PASS | Before the drill, file set `332`: lti journal absent, app journal absent. `333-drill-prepared-lti` exit 3 with its own `storage_drill_stop` point `prepared-lti`, opId `60d656b15de618908c30f6adc0185912`. `334-drill-up-prepared-lti` exit 1, refuses `journal_open`. `335-recover-prepared-lti` exit 1, "cancelled at the first journal write; the targets equal the state before (verified)". File set `336`: lti journal `rolled_back` with opId `60d656b1…`; app journal still absent (equal to the observation before). This is ADR-012 §8 R1. |
| `g-recover-idempotent` | PASS | 11 second `--recover` commands, one per drill point, in `DRILL_POINTS` order: `341` (prepared-lti), `355`, `373`, `387`, `401`, `415`, `429`, `443`, `457`, `471` and `483` (committed-lti). Each exit 0, "nothing to recover". The step notes list all 11 points in order, each "nothing to recover; nothing changes". In C2, the `prepared-lti` entry was not reached. |
| `g-orphan-stopped` | PASS | `storage/g-orphan-stopped-kill.json` (`3fd34823…`): restore lock record `runId` `a2c3e42426258fe5`, acquired 02:24:12.664Z, `pgid` 26797 = the spawned group. The selected pause is the command's own `storage_drill_pause` point `swapped-lti`, opId `5de401a72738b558c282189b145fda1e`, 02:24:13.172Z. It differs from the `g-orphan-refusal` pause (opId `f6af6f85…`, 02:22:01.747Z), which also stays in the lane log. One running maintenance container `qa-multi-r1-st-storage-fb96855cb018132a`. Then `505` `docker stop` of it, exit 0; `506-orphan-stopped-recover` logs `storage_lock_reclaimed` (owner `a2c3e424…`) and exits 1, "rolled back; the targets equal the state before (verified)"; `511-orphan-stopped-up` exit 0. |
| `e-import` | PASS | `582-e-import-final` exit 0. File set `583`: both identities have the new pair `bcea5182…`, generation 1, kind `import`, journals `committed`, and `legacySources` equal to the X2 manifest `files` as complete entries: `lti-service/lti.db` 122880 `a42b9764…` and `cogniate-app/cogniate.db` 315392 `a956b341…`. |
| `e-kept` | PASS | `584-e-kept-up` (`stack:up`) exit 0 with "legacy files are kept for reference and are not used"; no `legacy_conflict`; the row checks that the legacy files are unchanged. |
| `e-provenance-restore` | PASS | `586-e-prov-backup` exit 0; `588-e-prov-restore` exit 0; lti identity pair `bcea5182…` kept, generation 1 → 2, `legacySources` unchanged; `590-e-prov-up` exit 0 with the "kept" warning and no `legacy_conflict`. |

### Runtime checks (host read of the artifacts; `public/v-checks.json` `d6e61a7b…`, judge `prep/bin/vchecks.py` `359d7112…` = the C2 judge; V3-R record `public/v3-r-c3.json` `843119ee…`)

| Check | Result | Evidence |
| --- | --- | --- |
| V1-R `a-serialize` | **Met** | Run `X` = `968ec254c8c6e16f`, spawned `pgid` 71432. The saved backup output has one acquire and one release of `X`. That release is the same event as the one release of `X` in the lock-log archive. `command` = `stack:data-backup` = the acquire command. The `stack:up` wait names owner `X`. Clock `lo` −10.4 ms, `hi` 73.0 ms; release 02:14:28.906Z. `StartedAt` margins over `R.ts + hi`: `lti-service` 2,411.9 ms, `cogniate-app` 2,356.2 ms. |
| V2-R `d-mountpoint` | **Met** | Row PASS. Commands 132–136: listing → root plant → `meta` → `stack:up` → stop. 0 `EACCES` and 0 `source_unreadable` in `cmd/*.log`. Both quarantines (`cmd/268` `a-first-start-partial`, `cmd/277` `a-first-start-both-pending`) log `storage_quarantine_copy` and exit 0. No phase stop. |
| V3-R `Origin` | **Met** | 0 `csrf_rejected` over the whole phase window: 5 segments (`absence.json` PASS) and the final copy. `e-old-schema` PASS. Platform 201 and connection 201: `@backup-B` (02:18:43Z, and the write after B at 02:18:52Z) and each `@post-B` (02:21:59Z, 02:24:11Z, 02:24:26Z). The judge printed `CHECK`, because its V3-R branch judges only the `d3296dd` failure case. I kept that output and read these facts by hand into `v3-r-c3.json`, as in C2. |
| V4-R scans | **Met** | Migration: 10 points; storage: 92 points; all with 0 hits, corrections, refusals and problems; both records complete. |
| V5-R P-1a | **Met by row assertions** | `a-fresh` PASS: the row asserts `ENOENT` and is BLOCKED otherwise; no separate `ENOENT` record is published. `d-content-folder` PASS; "unsafe case cleanup: uploads is a new empty 0700 directory (device 16777233, inode 11357818)"; the before-listings of the absent case are empty. |

### Observed permissions

| Path | Observed |
| --- | --- |
| Private root, `source/`, `tools/`, `prep/`, `report/`, `diag/` and its `public/`, `private/`, `tmp/` | 0700 folders and 0600 files (umask 077), except the items below. The copied `tests/node_modules` has 0 entries with group or other bits. |
| Phase clone roots (runner, umask 022) | 0700 after the clone guard (2 clones, 2 checkpoints, 1 captured-secret file set to 0600, 0 problems). They were not private from creation; this is the accepted narrow guard. |
| Lane private roots (migration and storage) | The root and its five entries `bin/`, `out/`, `backups/`, `quarantine/` and `scratch/` are 0700. The only entry with group or other bits is `bin/storage-fixture-script.mjs` at the required 0555. |
| `qa-m1-private-backup-jNc6o1` | 0700; 30 entries; 0 with group or other bits |
| `D` | 0700. `handoff.json`, `migration-scans.json` and `diagnostic.json` are 0600. **Observation (again, as at `d3296dd` and C2):** the runner wrote `migration-results.json` and `storage-results.json` at 0644 (child umask 022). They hold row ids, status and notes only. I did not change them. |
| `diag/tmp` leftovers | Two `qa-tree-*/index` files (0644, git indexes of the public `tests/` tree) and the Node compile cache. Kept. |
| Phase artifacts `source/tests/host/artifacts/` | Written by the umask-022 runner: 1,012 files at 0644 and 35 folders at 0755, inside the 0700 `source/` root. Same pattern as the accepted runs; redacted artifacts. |

### Privacy and cleanup

- Secret scan: 0 problems (`secret-scan.json` `c5619289…`); 38 captured values and 17 stack values; 4 clones checked. Clone guard: 0 problems (`clone-guard.json` `3df44eb0…`).
- Owned cleanup: each child's teardown removed only recorded resources. The diagnostic teardown check found zero lane resources for both projects, and W4 confirms. No owned process remains (launcher, runner and the three observers ended). Port 8443 has no listener. Clones, lane private roots, the backup root and `D` stay for review. Nothing was removed by hand.
- Monitoring (read only, file reads only, no Docker call): `prep/bin/monitor-diag-c3.py` (`aa392e0d…`), the C2 monitor v2 with the candidate literal changed and the six target steps added to its report list.

### Evidence

- Evidence index (outside the indexed set): `<root>/evidence-index-v2.tsv`, 2,037 entries (`diag/`, the two phase artifact folders, `prep/`, `tools/`) with SHA-256, size and mode; SHA-256 `1418163cc528b276ddfba8dfd0c30b06e5e5a51ec70d9e454c8e773070bdced7`. Index v1 (`6322a52a…`, 2,035 entries) stays; v2 adds two later preparation files (`prep/bin/phase-ids.mjs`, `prep/09-static-phase-ids.json`).
- Phase artifacts (redacted): `<root>/source/tests/host/artifacts/qa-multi-r1-c4c6d045-2026-10-22T02-03-14-229Z/` (`summary.json` `ba285026…`, `m1-case-results.json` `c3f07c35…`, `lane-ownership.json` `53fa5b54…`) and `…/qa-multi-r1-st-c4c6d045-2026-10-22T02-07-12-250Z/` (`summary.json` `d50a51f1…`, `m1-case-results.json` `4203f2c7…`, `lane-ownership.json` `50bf69d6…`, `storage/storage-scans.json` `e29d54b7…`).
- Messages: READY `msg_fafb9dbf11a0`; checkpoint reply `msg_7ad8cce37dae`; grant `msg_44c8dfacddab`; gate `msg_76897fdec965`; start `msg_1562c8dc5e85`; migration milestone `msg_277f19966306`; closeout checkpoint and window return `msg_932c80706f81`.

### Measured timings

Diagnostic 25 min 28 s (runner start to exit); 25 min 46 s from launcher start. W1–W3 16 s. Migration child about 3 min 58 s. Storage child about 21 min 21 s, with all 70 rows run and passed: the first measured passing storage phase. W4 8 s.

### Disclosures

- D-1: my read-only `git status` in the old C2 clone took Git's optional index lock. Only the old `.git` folder mtime changed (01:54:41Z); no file content changed. Later Git reads on old evidence use `GIT_OPTIONAL_LOCKS=0`.
- D-2: my first C3 clone lacked `--no-hardlinks` (572 hard-linked object files at 0444). I renamed it `source-v1-hardlinked`; it was never launched. I made the clone above with `--no-hardlinks` and repeated all checks (`*-v2` records).
- D-3: my status reply `msg_7ad8cce37dae` said READY was sent "at about 02:02Z". The READY record was written at 02:00:35Z and sent right after.
- `prep/bin/__pycache__/` holds one compiled file of the monitor (0600), made by my syntax check.

### Next

The Lead verifies this diagnostic checkpoint. Only a separate grant starts the two complete 488-row rounds on C3 and the 12 legacy groups; they did not run and stay required. Fresh M2 and T7 follow under another owner. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`. No certification or production claim.

## Full run at candidate C3 `c4c6d04`: FAIL in round 1 `storage` (`g-tamper`), round 2 and legacy not run, 2026-10-22

Verdict for this attempt: **FAIL**. Round 1 ran all 488 rows once: 470 PASS and 18 FAIL, all in `storage`. One row failed on its own check (`g-tamper`); the other 17 rows were "not run: prerequisite … did not pass" behind it. The storage child exited 1, so the runner stopped. Round 2, the per-case equality check and all 12 legacy groups did **not run**. Owned cleanup, the scans and the strict W4 passed. The C3 diagnostic above stays a passing, zero-credit diagnostic. Owner, model and independence: as in the C3 diagnostic section (task `task_8f5644f9910e`, dispatch `ctx_2e9642c8e4be`). I propose no fix; the remediation owner `ctx_898acbaef3a6` owns every repair.

### Grant, source and command

| Item | Value |
| --- | --- |
| Grant | Lead `msg_686df6631c9d`: exclusive full-run window until `2026-10-22T07:00:00.000Z`; diagnostic accepted in the same message. Returned at 03:34:25Z, the creation time of `msg_63ddbf48a5d1` (Lead record; the launcher ended at 03:32:10Z). That message said "~03:40Z"; this was not correct, and the message stays as sent. |
| Source | `<root>/source`, the diagnostic clone (C3, detached, 0 status lines; ignored paths `tests/host/artifacts/` with the two diagnostic folders and `tests/node_modules/`; 42/42 `tests/host` files equal the C3 blobs; `prep/11-full-prelaunch.txt` `465d3e07…`). |
| Crossed messages | My proposal `msg_85b31cfa53ff` (a fresh clone `<root>/full-src/source`, so that diagnostic folders do not mix) and the grant crossed. I launched as the grant said. The Lead's hold `msg_6fedf0bcf92b` and source amendment `msg_da3a8443b972` arrived after the launch. I asked; the Lead chose to continue (`msg_1b0b8d4849c7` and the answer to my question). `<root>/full-src/source` was never launched. Nothing was stopped, restarted or moved. |
| Launcher | `tools/launch-full-c3.sh` `af40a219…` (identity-only diff to `launch-full-c2.sh`), detached in its own process group (pgid 40977). Environment before launch: 0 `QA_*`, `npm_*` or `NPM_CONFIG_*` names. |
| Runner child | `umask 022; COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 STACK_PROFILE=default COURSE_FIXTURES_DIR=<courses> TMPDIR=<root>/full/tmp node tests/host/run-m1.mjs --sha c4c6d045… --test-sha c4c6d045… --source <root>/source` (`full/public/command.txt` `66b3e658…`). Default phase `full`; no filter. |
| Time (UTC) | Launcher 02:40:36Z; runner 02:40:53Z–03:31:43Z (exit 1); W4 end capture 03:31:51Z; strict compare 03:32:05Z; secret scan and done 03:32:10Z |

### Boundary (one W1–W4 sequence for the run)

| Step | Result | Evidence (`<root>/full/public/`) |
| --- | --- | --- |
| Ancestor check | PASS | `ancestor-boundary.json` `0f3ede62…` |
| W1 wake | Pre-wake idle-VM clock 02:33:33Z (not boundary evidence). Wake on the cached image, `--pull never`, 0 left. Bridge recreated `938ec8dc0008` → `243fcebe290a`. | `w1-wake.json` `bb85b4c1…` |
| W2 liveness | PASS | `w2-liveness.json` `c4b29dcd…` |
| W3 formal start | Live 02:40:50.370Z; identity 0 differences (engine 29.9.1, image `sha256:44fce696…`); 0 containers; 9 volumes (7 protected FULL identical + `a17056b8…` + `d5df35bd…`); lanes fresh; port free; 0 problems | `w3-formal-start.json` `4c479999170a5ffa2fde75f5dfae4e80da874f882e83f9138cd7ec66caaa1e40` |
| Sampler | 201 samples, 0 failed, one bridge Id, 0 skew, at most one compose project; the two other names are the storage lane's own oracle and fixture containers | `sampler/lane-containers.json` `8ecebb81…` |
| W4 end and strict compare | End live 03:31:48.554Z; 0 containers; 9 volumes; identity 0 differences; 7 protected identical; both anonymous volumes; bridge, host and none Ids unchanged; lanes fresh. Strict compare: 0 problems. | `w4-end.json` `71984da0…`, `w4-compare.json` `bd9135dd…` |

### Round 1 (bound to exact folders)

Binding method (Lead `msg_1b0b8d4849c7`, `msg_54a95f178c3b`): each phase is the run folder that started after 02:40:53Z, with its identity phase. Its `m1-case-results.json` is parsed-equal to this invocation's accounting file `<root>/full/tmp/qa-m1-accounting-QEFABY/round-1-<phase>.json`. Its id set equals the static phase ids; every row and the identity carry C3 for product and tests; project, port and subnet match; folder start ≤ identity timestamp, in phase order. The two diagnostic folders are excluded by name and time. I did not use the n-th pick of `round-report.mjs`. Records: `<root>/full-judge/round-1-bind.json` (`e6144cc9…`, by `prep/bin/round-bind.py` `a0785333…`) and `round-1-verify.json` (`f09c2b04…`, by `prep/bin/round-verify.py` `340cc5b2…`); the Lead classed both helpers as report-only.

| Phase | Folder (`<root>/source/tests/host/artifacts/`) | Rows | Result | Time (UTC) | `m1-identity` / `m1-case-results` / `summary` / accounting (SHA-256 prefixes) |
| --- | --- | --- | --- | --- | --- |
| sim | `qa-multi-r1-c4c6d045-2026-10-22T02-40-53-303Z` | 394 | 394 PASS | 02:40:53.303Z–03:03:52.620Z | `67668833…` / `736ef8ab…` / `7ad44d19…` / `a520cc26…` |
| snapshot-isolated | `qa-multi-r1-c4c6d045-2026-10-22T03-03-58-641Z` | 6 | 6 PASS | 03:03:58.641Z–03:05:32.041Z | `20c6eef5…` / `5c67fb8d…` / `d079d4eb…` / `98b2323c…` |
| snapshot-upgrade | `qa-multi-r1-c4c6d045-2026-10-22T03-05-36-389Z` | 6 | 6 PASS | 03:05:36.389Z–03:07:26.246Z | `c3df6ec4…` / `e850ffd2…` / `0129bebd…` / `87d85c98…` |
| migration | `qa-multi-r1-c4c6d045-2026-10-22T03-07-30-611Z` | 12 | 12 PASS | 03:07:30.611Z–03:11:24.290Z | `29e23ad3…` / `c3f07c35…` / `dda7c105…` / `7cba9b29…` |
| storage | `qa-multi-r1-st-c4c6d045-2026-10-22T03-11-29-196Z` | 70 | 52 PASS, 18 FAIL, 0 NOT_APPLICABLE | 03:11:29.196Z–03:31:39.300Z | `5773f995…` / `f60f1801…` / `a556ecc5…` / `314387cb…` |

- Total: 488 rows, 488 distinct; 470 PASS, 18 FAIL. `c-host-negative` PASS (probe `lock_not_enforced`).
- Core records of every phase: `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION` and `TEARDOWN` PASS. The storage aggregate also has FAIL for `STORAGE-LEGACY-PLACE`, `STORAGE-LEGACY-REMOVE` and `STORAGE-LEGACY-IMPORT-LANE` (fixtures not run) and `ERROR` (the round check at the first non-PASS row).
- Ownership: 0 ledger errors, 0 kept, 0 failed in every phase (removed: sim 5, isolated 5, upgrade 5, migration 5, storage 4). Storage scans: complete, 92 points, 0 hits, corrections, refusals and problems.
- SIM clone (for Canvas): `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-c4c6d045-2026-10-22T02-40-53-303Z`.

### First cause: `M1-41.common.g-tamper` (facts only)

| Item | Facts (`<storage folder>/cmd/`) |
| --- | --- |
| Failed check | "--recover after the tamper: expected exit 2, got 1" (`storage/steps/055-g-tamper.json` `2b2b88b8…`) |
| Drill | `515-g-tamper-stop` exit 3; `storage_drill_stop` point `swapped`, opId `7011aa7c703074d4650ddad2b299a689` (`ad7cd35a…`) |
| State before the tamper | Listing `516` (`4639edc4…`): in **both** volumes, two previous folders: `.previous-3f350b564a83ec6616cac1abd3db26ff` and `.previous-7011aa7c…` (this drill), plus `.restore-7011aa7c…` and the journal |
| Tamper | `517-fixture-plant` (`9b4f70b0…`) flipped `.previous-3f350b56…/lti.db`: the folder of another operation, not of this drill |
| Recovery | `520-g-tamper-recover` (`e264a760…`) exit 1, "rolled back; the targets equal the state before (verified)". The current operation's previous folder was intact. |
| Harness site | `tests/host/storage-rows.mjs:984` selects `l.lti.entries.find(/^\.previous-[0-9a-f]{32}\/lti\.db$/)`: the first match in listing order, not the folder of the drill's own stop opId |
| Origin of `3f350b56…` | The `g-orphan-refusal` orphan restore (kill record `g-orphan-refusal-kill.json` `20f6aff1…`: lock run `edb4d346d8cd8880`, pause 03:26:23.945Z). The maintenance log shows `storage_drill_resume` of that operation at 03:28:23.948Z; then `g-orphan-complete`'s `--recover` printed "nothing to recover" (03:28:26.621Z). Its previous folder stayed in both volumes. |
| C3 diagnostic | The same two-folder state existed at `g-tamper`: stale `.previous-f6af6f85…` (`g-orphan-refusal`) and current `.previous-035f404e…`. The plant hit the current folder only because `035f…` sorts before `f6af…`; the row passed. So the result depends on the random opId order. |

Whether a `.previous-<op>` folder may stay after an orphan operation resumes and completes (ADR-012) is a question for the remediation owner and the Architect. I claim no product fault.

Dependent rows (each "not run: prerequisite … did not pass"): `g-quarantine-in-use`, `g-quarantine` ← `g-tamper`; `h-legacy-manifest`, `h-target-state`, `e-hot-journal`, `e-old-layout` ← `@legacy-place` ← `g-quarantine`; `e-fresh-refusal`, `g-fresh-target` ← `h-target-state`; `h-pair-mismatch` ← `g-fresh-target`, `@legacy-remove`; `e-import-recover`, `e-changed-byte`, `e-added-wal`, `e-import-nonfresh`, `h-old-manifest` ← `@legacy-import-lane` ← `h-pair-mismatch`; `e-import` ← `e-import-recover`; `e-kept` ← `e-import`; `e-provenance-restore` ← `e-kept`. Fixture runs not run: `@legacy-place`, `@legacy-remove`, `@legacy-import-lane`. Rows after the chain that passed: `b-sequence`, `e-old-schema`, `e-content-missing` (and the `@old-schema-setup` fixture).

Notification: the Lead read the storage step records first (`msg_023d6a14be97`, 03:32:16Z check). My consolidated first-cause and dependent-row message is `msg_63ddbf48a5d1`. The frozen driver ended by itself; I made no retry.

### Not run

Round 2 (all five phases), the two-round per-case equality, and all 12 legacy groups (T2a, T2b, T3a, T3b, T3c, T4a, T4b1, T4b2, T5a, T5b, T6, T8). Runner stderr: `run-m1.mjs:146` "Required child failed" inside `fullRounds` (`storage-diagnostic.mjs:28`).

### Privacy, cleanup and permissions

- Secret scan 0 problems (`secret-scan.json` `103159f1…`; 8 clones). Clone guard 0 problems (`clone-guard.json` `9c9cfeeb…`; 5 clone roots set to 0700, 4 captured-secret files to 0600).
- Owned cleanup by the core teardown only; W4 confirms 0 containers and fresh lanes. No owned process remains (launcher, runner, observers, my monitor). Port 8443 has no listener. PID 64140 untouched. Nothing was removed by hand.
- Modes: QA files 0600 and folders 0700. Runner-written (umask 022): the five accounting result files in `<root>/full/tmp/qa-m1-accounting-QEFABY/` at 0644 (the launcher's private copy is 0600), three `qa-tree-*/index` files at 0644, the Node compile cache at 0755, and the phase artifact trees (0644 files, 0755 folders) inside the 0700 `source/` root.

### Measured timings

Launcher 51 min 34 s; W1–W3 17 s; runner 50 min 50 s. Round 1, from each folder start to the next folder start (storage: to its identity timestamp): sim 23 min 05 s, snapshot-isolated 1 min 38 s, snapshot-upgrade 1 min 54 s, migration about 3 min 59 s, storage 20 min 10 s. W4, compare and scans about 27 s. A complete round is about 51 min on this host; legacy is still not measured.

### Evidence

- Evidence index (outside the indexed set): `<root>/evidence-index-v3.tsv`, 5,327 entries (`diag/`, `full/`, `full-judge/`, all phase artifact folders, `prep/`, `tools/`, `report/`) with SHA-256, size and mode; SHA-256 `72e27fbaf324191a613639560ff91e44228e864972c8b4fd939f83a2e8be6e10`. Indexes v1, v2 and `evidence-index-v2-supplement-1.tsv` (`5158e1dc…`) stay.
- Messages: grant `msg_686df6631c9d`; gate `msg_1dafdc3673dd`; start `msg_f7029e355fbf`; decision `msg_41cf33d2c972`; milestone `msg_e998da47f0bd`; failure and window return `msg_63ddbf48a5d1`.

### Disclosures (continued)

- D-4: to read the committed R4 QA report, I wrote `git show 133f93e:…` to `/tmp/claude-r4qa-view.md` (0644) at about 01:57Z. It is a public committed document with no secret. I removed my own temp copy at 02:35:37Z.
- D-5: the crossed-message sequence above.
- D-6 (Lead disclosure `msg_9ec19d4a89c2`): at 02:49Z the Lead ran a second copy of my read-only monitor, which shared its state file for about 45 s; the Lead stopped only that copy. Monitor state and output are not acceptance evidence.
- D-7: runner-written accounting files at 0644 (see "Privacy, cleanup and permissions").
- D-8: `<root>/full-src/source` was prepared and never launched.

### Next

The remediation owner `ctx_898acbaef3a6` diagnoses `g-tamper` (harness target selection at `storage-rows.mjs:984`, and the question of the stale orphan `.previous-<op>` folder); the Lead decides the repair. A repair needs a new frozen candidate, its reviews and new grants. Two complete 488-row rounds, all 12 legacy groups, fresh M2 and T7 stay required. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`. No certification or production claim.

## Storage-repair diagnostic at candidate C4 `bf09cda`, attempt 1: FAIL (strict W4: non-owned project in the window), zero credit, 2026-10-22

Verdict for this attempt: **FAIL**. The cause is the environment, not a row: a compose project that this session does not own (`qa-la-sim-r1`) started inside the exclusive window, so the strict W3-to-W4 comparison failed and the runner exited 1. All rows passed: migration 12 of 12, storage 70 of 70 (0 FAIL, 0 NOT_APPLICABLE). The diagnostic gives no acceptance credit (triage revision 4 §9 step 7), and this attempt gives none either. The Lead classed it as environment overlap (`msg_567da05009a2`, `msg_468b98e07a1d`): no waiver, no rerun in this window, no full run. No full round, legacy group, M2 or T7 ran. All sections above stay as history.

Owner: a fresh, independent common/Blackboard runtime QA session. Requested and effective settings: Claude Code Opus 5.5 (`claude-opus-5-5`) at xhigh effort, no subworkers. Task `task_ef1d19129419`, dispatch `ctx_e23ced3dd1fa`, session `orca_session_id:731b0935-5f99-4dc7-aa2b-9c072818af67`, run `run_ebe671ad72a9`. This session did not write the product, the tests, the triage or any review. It does not judge Canvas rows (Canvas peer `ctx_745cb25fcb7c`, host-only). It proposes no fix: the remediation owner `ctx_898acbaef3a6` owns every repair.

### Identity and command

| Item | Value |
| --- | --- |
| Candidate C4 | `bf09cdad91ca548e1ecbc14428b55180d35d5360` (tree `749246501c48b6417db884ae91e33f912f97d97d`), tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4` (= R5 source `27e1f61`). Tests delta from C3 `c4c6d04`: exactly `tests/host/storage-rows.mjs` (`fbb99131…`) and `storage-rows.selftest.mjs` (`edc2d97a…`); `run-m1.mjs` unchanged (`8e1ef65c…`). Non-docs delta from `27e1f61`: none. Outside `docs/` and `tests/`, the differences from `9f8ac62` are `README.md` (Docs draft `82aff91`) and `infra/README.md` (documentation only, `5a5453c`, pending final document review). `infra/compat/storage-compat.sha256` 4 of 4 OK. |
| Criteria read | Charter; phase-plan checkpoint 2026-10-22 03:49 UTC; triage revision 4 (SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`, last commit `2d763fe`); M1 precision (`ac444799ae5e93706054a7e352e339bdea509a889328c15365a3535864fb37af`, last commit `a60ba4a`, ancestor of C4); the AC-M1-41 `g-tamper` lines and ADR-012 §8 (retained previous generation); the C3 sections of this report; the R5 delta (`git diff c4c6d04 bf09cda -- tests/host/storage-rows.mjs`). Both values verified in each clone. |
| Window | Lead grant `msg_2bed4f15a8f7`: exclusive, diagnostic only, until `2026-10-22T06:20:00.000Z`. Returned with the closeout message of this section (see "Next"). My last Docker activity was the launcher's W4 and scan at 04:45:11Z. |
| Lanes | Migration `qa-multi-r1`, storage `qa-multi-r1-st`; port 8443; subnet `172.29.0.0/16` |
| Private root | `/Users/quangnguyen/cogniate-qa-runs/qa-common-c4-20261022T0408Z` (`<R>`; 0700, born 04:08:02Z under umask 077). Diagnostic source `<R>/diag-src/source`; a separate full source `<R>/full-src/source` was prepared and not used. Both are `git clone --no-hardlinks --no-checkout` of the worktree, then `checkout --detach` C4, push URL disabled (born 04:08:10Z and 04:08:11Z at 0700; 0 entries with group or other bits, also in `.git`; 0 hard links). 0 status lines (only ignored path `tests/node_modules/`); no `.env`, root `node_modules`, `.tmp`, infra state, `tests/host/artifacts` or `pnpm-workspace.yaml`; no non-sample hook and no `core.hooksPath`; pins `9f96f7b`, `b0b83a8`, `ccdd9ef` present (`prep/03-source-checks-{diag,full}.txt`). |
| Dependencies | No npm command ran in the preparation. `tests/package.json` (`685c10cf…`) and `package-lock.json` (`213718dd…`) are equal at C4, at C3, in the C3 source and in both clones. The C3 source `tests/node_modules` still equals its qualified manifest `452a27f9…` and modes `f2c452dd…`, and the lock check equals the qualified record. I copied it (read only, `cp -R`, umask 077) into both clones: 1,928 entries (1,667 files, 11 links, 250 directories) equal, modes equal, 0 group or other bits, 0 hard links; lock check equal (61 installed, 0 extra, 0 version or integrity mismatch; the 50 absent entries are optional packages for other platforms). |
| Tools | `<R>/tools`: 23 files byte-identical to the C3 tools (cmp 23/23); the C3 tools equal their C3 ledger and the C3 final index v4 (`fdab23ba…`). Imports are Node built-ins and sibling files only. `w4-diag.sh` v2 `860b072c…` unchanged. New: `launch-diag-c4.sh` `9805ab8bcd8e7dd453c4a06ee21c1b0ef3a8cb69e69b113c26137ca56d6fc98f` and `launch-full-c4.sh` `c824abeb70835c61fdac056bdc1a141f8669aed32e96d7fdce2ff62a5ff0412b`. Each differs from its C3 file only in the `FROM`/`TASK`/`DISPATCH` line (diffs in `tools/ledger/ctx_e23ced3dd1fa/`). The Lead read both diffs and accepted the reused qualification (boundary 30/30, clone guard 25/25, W4 v2 9/9); no new tool control ran. |
| Time (UTC) | READY 04:16:30Z (`msg_af43fce7a748`); grant 04:17:44Z; prelaunch inventory 04:18:01Z; launcher 04:18:06Z (PID = PGID 18551); runner 04:18:22Z–04:45:10Z; `w` 04:18:22.814Z; migration child 04:18:22.924Z–04:22:22Z; storage child 04:22:22.634Z–about 04:45:00Z; W4 04:45:01Z–04:45:10Z; runner exit 1; launcher done 04:45:11Z |

Runner child (`diag/public/command.txt`, `12778318…`), started by `launch-diag-c4.sh` after W1–W3:

```sh
cd <R>/diag-src/source
umask 022
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 STACK_PROFILE=default \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
TMPDIR=<R>/diag/tmp \
node tests/host/run-m1.mjs --phase diagnostic --sha bf09cdad91ca548e1ecbc14428b55180d35d5360 \
  --test-sha bf09cdad91ca548e1ecbc14428b55180d35d5360 --source <R>/diag-src/source \
  --window-end 2026-10-22T06:20:00.000Z --w4-command <R>/tools/w4-diag.sh --diagnostic-root <R>/diag/private
```

The launcher removed every `QA_*`, `npm_*` and `NPM_CONFIG_*` variable before any child started (`public/env-names.txt`: 61 names, 0 of these). Both children used the core default clone root, with no `--checkout` or `--workdir`.

### Preparation (host only, before the grant)

- Inputs (`prep/09-inputs.txt`): HTML `9f04d3ab…` and SCORM `a685744e…` match. Protected baseline file `219da30b…` (7 names). Docker CLI `678271…` and Compose `1ec06408…` checked by file hash only. macOS 27.0.1 arm64; Node 24.21.0; port 8443 had no listener; no Docker or Compose process.
- Static inventory (Node read of each clone's tests tree): 488 rows, 488 distinct; `sim` 394, `snapshot-isolated` 6, `snapshot-upgrade` 6, `migration` 12, `storage` 70; common 114, Blackboard 141, Canvas 233; the only conditional row is `M1-41.common.c-host-negative`. The inventory, the per-phase id record and the V4-9 token record are byte-identical to the C3 records.
- Source inventory (`prep/bin/tests-inventory.py` `5b8e75de…`, new; control: a scratch clone with one changed byte and one extra file shows both, and the diagnostic clone against the C3 blobs shows exactly the two R5 files): 250 tests files and 42 `tests/host` files equal the C4 blobs, 0 extra, immediately before the launch (`prep/13-tests-inventory-diag-prelaunch.txt` `b19c3f39…`, 04:18:01.086Z) and after the run (`prep/15-tests-inventory-diag-postrun.txt` `350ceb89…`, 04:47:31.885Z). These two records bracket the run.
- New supplementary helper `prep/bin/r5tamper.py` (`855481961bc3d8ea7c9ec0d71deeb81b6e174605835df785975061103d68769e`), frozen at 04:15:23Z, read only. Bounded controls (`prep/r5-controls/`): C3 diagnostic artifacts MET (two retained generations; the own folder only by chance); C3 full round 1 NOT MET (plant on `.previous-3f35…`, own opId `7011…`; exit 1; dependents not run); a C3-diagnostic subset MET; mutant "another entry changed" NOT MET; mutant "two opIds" NOT MET. The Lead read the helper and the controls; raw evidence stays authoritative.
- I did not repeat `--harness-only`, the host suites or the tool controls. No old monitor ran; `prep/bin/monitor-c4.py` (`f653c816…`) is new and reads files only.
- Network: the preparation made no npm call. The runner's nested `npm run` commands used the real HOME (no `~/.npmrc`), as in every accepted run. I make no runtime no-network claim.
- Observation: the unrelated `node --test tests/host/m1-control.selftest.mjs` (PID 64140) still runs. It is not mine and stayed untouched.

### Window-level boundary (W1–W4) and lane-level core boundaries

| Step | Result | Evidence (`<R>/diag/public/`) |
| --- | --- | --- |
| Ancestor check | Home 0750; group members `quangnguyen root` only | `ancestor-boundary.json` `fce96561…` |
| W1 wake | Pre-wake idle-VM cache (VM clock 04:14:59Z at host 04:18:07Z; bridge `3f4e1451…` created 04:08:59Z VM time; not boundary evidence). Wake on the cached image `sha256:44fce696…` with `--pull never`; 0 remain. | `w1-wake.json` `0a2cfd98…` |
| W2 liveness | PASS (advancing clock) | `w2-liveness.json` `199c1a2c…` |
| W3 formal start | Live `SystemTime` 04:18:19.919Z (`runStartSecond` 1792642699). OS, CLI 29.9.1, Compose 5.6.0, engine 29.9.1 and image match (0 differences). 0 containers. 9 volumes: the 7 protected FULL records equal the baseline, plus anonymous `a17056b8…` and `d5df35bd…`. Both lanes fresh; port free; no subnet clash; 0 problems. Bridge `223a63172249`. | `w3-formal-start.json` `1ca3f7db151cccd6bbed79c200343dcc06b3d538bc139395ba21571f70008f4a` |
| Lane core boundaries | Each child: `G1-IDENTITY` PASS, `PRE` PASS, protected-volume snapshots, `M3-ISOLATION` PASS, `TEARDOWN` PASS | phase `summary.json` |
| Sampler | 106 samples, 0 failed, one bridge Id, 0 skew violations (max 0 ms), at most 2 compose projects at the same time. Other names seen: the storage lane's own oracle container and **`qa-la-sim-r1`**. | `sampler/lane-containers.json` `18d5012c…` |
| W4 end | Capture PASS: end live 04:45:06.836Z (capture 04:45:09.509Z); identity 0 differences; both lanes fresh; port 8443 free; 0 subnet clash; the 7 protected FULL records identical. But 9 containers and 13 volumes exist: the extra items belong to `qa-la-sim-r1`. | `w4-end.json` `f26d781f…` |
| W4 strict compare | **FAIL (exit 1)**: exactly 14 problems, all "new unrelated": network `qa-la-sim-r1_default`; volumes `qa-la-sim-r1_appdb`, `_ltidb`, `_moodledata`, `_pgdata`; containers `qa-la-sim-r1-{cogniate-app,lms-sim,lti-gate,lti-service,moodle,postgres,proxy,qa-platform,sink}-1`. Everything else held: protected records identical at the end, both anonymous volumes present, the bridge, host and none Ids unchanged (bridge `223a6317…` at start and end). | `w4-compare.json` `6f809dff42c54bf53a3a88be17fa829205d459d203e01a83207ada1641329fd8` |

### The non-owned project (facts from the existing records only)

| Item | Facts (`w4-end.json`, `sampler/lane-containers.json`) |
| --- | --- |
| Name and source | Compose project `qa-la-sim-r1`; labels name `config_files` `/Users/quangnguyen/cogniate-qa-runs/LA/E0/explore/infra/compose.yaml`, `environment_file` `…/LA/E0/explore/.env`, `working_dir` `…/LA/E0/explore/infra`; Compose 5.6.0. The LA Lead confirmed ownership (`msg_468b98e07a1d`). |
| First observation | Docker creation times: network 04:42:05.995Z (subnet `172.20.0.0/16`), the four volumes 04:42:05Z, the nine containers 04:42:06.02Z–04:42:06.10Z (proxy started 04:42:06.579Z); all `running` at W4. The sampler records the name but not its first sample time. |
| Our row at that time | The storage lane was in `b-sequence`: `611-b-sequence-reset-1` 04:42:05.801Z–04:42:09.437Z. The rows that ran with the foreign project present: `b-sequence`, the `@old-schema-setup` fixture, `e-old-schema`, `e-content-missing`, then teardown and W4. All passed. `g-tamper` (04:40:34Z–04:40:38Z) and all 17 of its dependents (last command `609-h-old-manifest-import` ended 04:42:04.959Z) finished before. |
| Interference signs | None found in our records: port 8443 stayed free (the foreign proxy did not bind it); no subnet clash; protected records identical; our lanes fresh at W4; all scans clean. I did not touch any `qa-la-sim-r1` resource and made no Docker call for it. |

### Migration phase (`qa-multi-r1-bf09cdad-2026-10-22T04-18-22-924Z`)

- Child exit 0. 12 of 12 rows PASS; the 12 ids equal the static migration-phase ids (`D/migration-results.json` `16511ce6…`). Core `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `MIGRATION`, `M3-ISOLATION`, `TEARDOWN` PASS; abort none.
- Scans: complete; 10 points; 0 hits, corrections, refusals and problems (`D/migration-scans.json` `709d17ed…`).
- Ownership: 23 records, 0 ledger errors, 0 kept, 0 failed, 5 removed (`lane-ownership.json` `00d0fde1…`).
- Run-or-stop rule: migration code 0, storage `RUN`, cause none; storage child code 0; teardown ok; **W4 not ok** (`D/diagnostic.json` `c87538e1…`). `D` = `<R>/diag/private/qa-m1-diagnostic-02bedf6c7268bce8` (new, 0700). `H` = `D/handoff.json` (0600, `30e7b16f…`); the storage child got the same `H` and `w`.

### Storage phase (`qa-multi-r1-st-bf09cdad-2026-10-22T04-22-22-634Z`)

- Child exit 0. 70 of 70 row ids have one result: **70 PASS**, 0 FAIL, 0 NOT_APPLICABLE (`D/storage-results.json` `3ef71249…`); the ids equal the static storage-phase ids. Summary: 87 aggregate entries, all PASS (core `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION`, `TEARDOWN`, the harness self-checks and all 11 fixture records); abort none (`summary.json` `460cc895…`, `m1-case-results.json` `e4ab9a82…`).
- 81 step records (70 rows + 11 fixture runs), 0 non-PASS. Scans: complete, 92 points, all with 0 hits, corrections, refusals and problems (`storage/storage-scans.json` `8fb0d7ef…`). Ownership: 87 records, 0 errors, 0 kept, 0 failed, 4 removed (`lane-ownership.json` `02722db7…`).
- `c-host-negative` PASS (oracle probe `lock_not_enforced`; one of its two frozen permitted results).

### R5 target row `g-tamper`: runtime execution evidence

I read the raw command logs by hand (`<storage folder>/cmd/`). The supplementary record `diag/public/r5-tamper.json` (`4e05e0ce…`) gives MET with 0 failed conditions.

| Check | Raw evidence |
| --- | --- |
| Own drill marker | `515-g-tamper-stop` (`cb1e4308…`): `stack:data-restore --from <B> --stop-after swapped`, exit 3; exactly one `storage_drill_stop`, point `swapped`, opId `78d681ed2b9ef0340d3f12ac95b0f432` (04:40:34.433Z). |
| Retained generation present | Listing `516` (`3242ccf4…`): two previous folders in the lti volume, `.previous-353a96cceecd8be21d9de6233639aa37` and `.previous-78d681ed…`. `353a96cc…` is the `g-orphan-refusal` operation (its kill record pause opId, 04:38:06.334Z). It sorts before `78d681ed…`, so a "first match in listing order" would select the wrong folder: this is the C3 failure order. |
| Exact planted path | `517-fixture-plant` (`03b77344…`) exit 0: `{"op":"plant","results":[{"op":"flip","vol":"lti","path":".previous-78d681ed2b9ef0340d3f12ac95b0f432/lti.db"}]}`. |
| Only the target changed | Listings `516` → `518` (`7f999257…`): the same 22 entry names in both volumes; the target's SHA-256 changed `3fd69a4f…` → `21d4d121…`; every other entry is equal, the retained `353a96cc…` generation included. |
| Recover | `520-g-tamper-recover` (`cdbd1c55…`) exit 2: `storage_restore_unresolved` opId `78d681ed…`, "other bytes: /check/lti-service/.previous-78d681ed…/lti.db"; `storage_recover` code 2, "the rollback did not finish; do not start; keep both volumes; use stack:data-quarantine". |
| Journals and files after | File set `521` (`3295c3e6…`): lti and app journals `rollback_failed`, opId `78d681ed…`, operation `restore`. Listing `522` (`8a493383…`) against `518` under the row's rule: no file deleted or added; only the two root journals changed (state and `updatedAt`). |
| Refusal | `523-g-tamper-up` (`dfd477ee…`) exit 1: preflight `rollback_failed` for both folders, `storage_legacy_scan` L1 `refuse` `rollback_failed`, names `npm run stack:data-quarantine -- --out <folder>`, "stopped before any container start". No output says "no target changed". |
| Row and dependents | `g-tamper` PASS (`storage/steps/055-g-tamper.json` `0e280986…`). All 17 dependent rows ran their own steps and passed (`g-quarantine-in-use`, `g-quarantine`, `h-legacy-manifest`, `h-target-state`, `e-hot-journal`, `e-old-layout`, `e-fresh-refusal`, `g-fresh-target`, `h-pair-mismatch`, `e-import-recover`, `e-changed-byte`, `e-added-wal`, `e-import-nonfresh`, `h-old-manifest`, `e-import`, `e-kept`, `e-provenance-restore`), each with one PASS step record and no "not run" note. The three fixture runs `@legacy-place`, `@legacy-remove`, `@legacy-import-lane` passed. |

### R4 target rows: runtime execution evidence (preserved checks)

Supplementary record `diag/public/r4-checks.json` (`bdeb2321…`, unchanged `r4checks.py` `1b8ce8e5…`): all six MET. Raw facts read by hand:

| Row | Result | Raw evidence |
| --- | --- | --- |
| `g-prepared-lti` | PASS | `333-drill-prepared-lti` exit 3, own `storage_drill_stop` `prepared-lti` opId `7f2253fe94c2ba07fc1f92c29ffec90c`; `334-drill-up-prepared-lti` exit 1, `journal_open`; `335-recover-prepared-lti` exit 1, "cancelled at the first journal write; the targets equal the state before (verified)". After: lti journal `rolled_back` with opId `7f2253fe…`; app journal absent before and after. |
| `g-recover-idempotent` | PASS | 11 `recover-again-<point>` commands in `DRILL_POINTS` order (`341` prepared-lti … `483` committed-lti), each exit 0 "nothing to recover"; the step notes list all 11 points in order. |
| `g-orphan-stopped` | PASS | Kill record (`6a2b93a4…`): restore lock `runId` `0cc697978add843b`, acquired 04:40:18.864Z, `pgid` 41192 = the spawned group; own pause `swapped-lti` opId `58c84c698a2f01c21a470abc80da4492` (04:40:19.374Z), different from the `g-orphan-refusal` pause `353a96cc…`; one running maintenance container. `505` `docker stop` exit 0; `506-orphan-stopped-recover` `storage_lock_reclaimed` (owner `0cc69797…`), exit 1, "rolled back; the targets equal the state before (verified)"; `511-orphan-stopped-up` exit 0. |
| `e-import` | PASS | `582-e-import-final` exit 0; both identities' `legacySources` equal the manifest `files` as complete entries: `lti-service/lti.db` 122880 `24b30a2f…` and `cogniate-app/cogniate.db` 315392 `c6c36fa9…`. |
| `e-kept` | PASS | `584-e-kept-up` exit 0, L6 "legacy files are kept for reference and are not used"; no `legacy_conflict`. |
| `e-provenance-restore` | PASS | `586` backup exit 0, `588` restore exit 0; lti pair `6b84612d…` kept, generation 1 → 2, provenance `restore`, `legacySources` unchanged; `590-e-prov-up` exit 0 with the "kept" warning. |

### Runtime checks (host read; `public/v-checks.json` `89a518f0…`, judge `prep/bin/vchecks.py` `359d7112…`; V3-R record `public/v3-r-c4.json` `51ad330b…`)

| Check | Result | Evidence |
| --- | --- | --- |
| V1-R `a-serialize` | **Met** | Run `X` = `940da913b60f1267`, `pgid` 19751; one acquire and one release in the saved output, the same release event in the archive; `command` `stack:data-backup`; the `stack:up` wait names owner `X`. Clock `lo` −6.7 ms, `hi` 81.3 ms; release 04:29:43.733Z; `StartedAt` margins over `R.ts + hi`: `lti-service` 2,388.8 ms, `cogniate-app` 2,459.5 ms. |
| V2-R `d-mountpoint` | **Met** | Commands 132–136 in order; 0 `EACCES` and 0 `source_unreadable`; both quarantines (`268`, `277`) log `storage_quarantine_copy` and exit 0; no phase stop. |
| V3-R `Origin` | **Met** | 0 `csrf_rejected` in the 5 segments and the final copy; `e-old-schema` PASS; platform 201 and connection 201 at `@backup-B` (04:34:31Z, write after B 04:34:41Z) and each `@post-B` (04:38:04Z, 04:40:17Z, 04:40:32Z). The judge printed `CHECK` (its V3-R branch judges only the `d3296dd` failure case); I kept that output and read these facts by hand into `v3-r-c4.json`. |
| V4-R scans | **Met** | Migration 10 points, storage 92 points; all clean; both records complete. |
| V5-R P-1a | **Met by row assertions** | `a-fresh` PASS; `d-content-folder` PASS ("uploads is a new empty 0700 directory"); the absent-case before-listings are empty. |

### Observed permissions

| Path | Observed |
| --- | --- |
| Private root and `diag-src/`, `full-src/`, `tools/`, `prep/`, `report/`, `scratch/`, `diag/` with `public/`, `private/`, `tmp/` | 0700 folders and 0600 files (umask 077), except the items below. The copied `tests/node_modules` trees have 0 entries with group or other bits. |
| Phase clone roots (runner, umask 022) | Set to 0700 by the clone guard (2 clones, 2 checkpoints, 1 captured-secret file set to 0600, 0 problems). Not private from creation; this is the accepted narrow guard. |
| `D` | 0700. `handoff.json`, `migration-scans.json`, `diagnostic.json` 0600. **Observation (again, as at `d3296dd`, C2 and C3):** the runner wrote `migration-results.json` and `storage-results.json` at 0644 (child umask 022; row ids, status and notes only). Unchanged. |
| `diag/tmp` | Runner-written: two `qa-tree-*/index` files (0644) and the Node compile cache folder (0755). Kept. |
| Phase artifacts | Runner-written (umask 022): 1,012 files at 0644 and 35 folders at 0755, inside the 0700 clone. Same pattern as the accepted runs; redacted artifacts. |

### Privacy and cleanup

- Secret scan: 0 problems (`secret-scan.json` `1193815c…`; 38 captured and 17 stack values; 4 clones). Clone guard: 0 problems (`clone-guard.json` `cc4cc3b6…`).
- Owned cleanup: each child's teardown removed only its recorded resources; the diagnostic teardown check found zero lane resources for both projects, and W4 confirms both lanes fresh. No owned process remains (launcher, runner, three observers, my monitor). Port 8443 has no listener. Clones, lane private roots, the backup root and `D` stay for review. Nothing was removed by hand. The `qa-la-sim-r1` resources are not mine; I did not touch them.

### Evidence

- Evidence index (outside the indexed set): `<R>/evidence-index-v1.tsv`, 2,324 entries (`diag/`, `prep/`, `tools/`, `report/`, both phase artifact folders) with SHA-256, size and mode; SHA-256 `730c8b68f48f6f960c0f4b9d8e5cb4abd342f1d622af001bc77a4d95d0020de0`. Root files: `<R>/evidence-index-v1-root-files.tsv` (`55821368…`, 5 entries). Source and time bindings: `report/bindings-v1.tsv`. The preparation index `evidence-index-prep-v1.tsv` (`2612a47e…`, 354 entries) stays.
- Messages: READY `msg_af43fce7a748`; grant `msg_2bed4f15a8f7`; gate `msg_20843afff988`; launch `msg_b242bd351b4a`; migration milestone `msg_5c40ded33ce9`; first failure `msg_ec81e146a37a`; Lead dispositions `msg_567da05009a2`, `msg_468b98e07a1d`.

### Measured timings

Diagnostic 26 min 48 s (runner start to exit); 27 min 05 s from launcher start. W1–W3 15 s. Migration child about 4 min 00 s. Storage child about 22 min 38 s (folder start to W4 start), all 70 rows run and passed. W4 9 s.

### Disclosures

- D-1: my inbox filter script `/tmp/qa-c4-tools/inbox.py` (0600, in a 0755 folder made before `umask 077`) is outside the private root. It only filters Orca message JSON; it holds no evidence and no secret.
- Unused: the scratch clone `<R>/scratch/inv-control-clone` (control of the inventory helper; two QA mutations) and `<R>/full-src/source`. Neither was launched.

### Next

The LA owner cleans up `qa-la-sim-r1`. The Lead then decides a bounded diagnostic retry on the same C4 with a fresh clone and run root (`diag2`), under a new grant; this attempt stays FAIL. Two complete 488-row rounds, all 12 legacy groups, fresh M2 and T7 stay required. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`. No certification or production claim.

## Storage-repair diagnostic at candidate C4 `bf09cda`, attempt 2 (authorized clean retry): PASS (diagnostic gate only, zero credit), 2026-10-22

Verdict for this diagnostic: **PASS**. It gives no acceptance credit (triage revision 4 §9 step 7); the Lead verifies it before any full-run grant. Migration passed 12 of 12 rows, and the run-or-stop rule let the storage child start. In `storage`, all 70 rows ran and passed: 70 PASS, 0 FAIL, 0 NOT_APPLICABLE. `g-tamper` used its own operation folder, and all 17 of its dependents and the 3 legacy fixtures ran and passed (see "R5 target row"). Owned cleanup, the scans and the strict W4 passed (0 problems). No full round, legacy group, M2 or T7 ran. Attempt 1 above stays FAIL; this section does not change it.

This is the one clean retry that the Lead authorized after the environmental failure of attempt 1 (`msg_468b98e07a1d`, grant `msg_e530684e807f`): same C4, same pinned launcher and W4 wrapper, same lanes and criteria, no source, test, tool or criteria change; only a fresh source clone and run root. Before the grant, the LA Lead confirmed the cleanup of `qa-la-sim-r1` at 04:55:00Z and no LA Docker work until an explicit window handoff (`msg_550873f1a033`, relayed by the Lead). Owner, model and independence: as in attempt 1 (task `task_ef1d19129419`, dispatch `ctx_e23ced3dd1fa`).

### Identity and command

| Item | Value |
| --- | --- |
| Candidate | C4 `bf09cdad91ca548e1ecbc14428b55180d35d5360`, tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`; bindings as in attempt 1. |
| Window | Lead grant `msg_e530684e807f`: exclusive, diagnostic attempt 2 only, until `2026-10-22T06:20:00.000Z`. Returned with the closeout message of this section. My last Docker activity was the launcher's W4 and scan at 05:21:53Z. |
| Lanes | Migration `qa-multi-r1`, storage `qa-multi-r1-st`; port 8443; subnet `172.29.0.0/16` |
| Retry source | `<R>/diag2-src/source`: `git clone --no-hardlinks --no-checkout` of the worktree at 04:52:02Z, `checkout --detach` C4, push URL disabled, born 0700. Its source-check record equals the attempt-1 record line for line except the birth line (`prep/21-source-checks-diag2.txt`). Cache: the C3 source `tests/node_modules` re-checked (manifest `452a27f9…` and modes `f2c452dd…` equal), copied under umask 077: 1,928 entries, modes and lock check equal, 0 group or other bits, 0 hard links (`prep/23-*`). Static inventory and V4-9 records byte-identical. Tools: all 25 files equal the READY ledger; judges unchanged (`prep/26-*`). Preparation record `prep/RETRY-DIAG2.md` (`105e3096…`); preparation index v2 `9ac7cd72…` (374 entries). The Lead verified both before the grant. `<R>/full-src/source` stays unused. |
| Time (UTC) | Grant 04:55:38Z; inbox read and prelaunch inventory 04:55:48Z; launcher 04:55:53Z (PID = PGID 97309); runner 04:56:08Z–05:21:52Z; `w` 04:56:08.620Z; migration child 04:56:08.777Z–05:00:09Z; storage child 05:00:09.935Z–about 05:21:37Z; W4 05:21:37Z–05:21:52Z; runner exit 0; launcher done 05:21:53Z |

Runner child (`diag2/public/command.txt`, `de64adba…`): the attempt-1 command with `--source <R>/diag2-src/source`, `TMPDIR=<R>/diag2/tmp` and `--diagnostic-root <R>/diag2/private`; all other arguments and variables are the same (`--phase diagnostic`, both SHAs C4, `--window-end 2026-10-22T06:20:00.000Z`, `--w4-command <R>/tools/w4-diag.sh`, `COMPOSE_PROJECT_NAME=qa-multi-r1`, `PUBLIC_PORT=8443`, `STACK_SUBNET=172.29.0.0/16`, `STACK_PROFILE=default`, the fixture folder; child umask 022). The launcher removed every `QA_*`, `npm_*` and `NPM_CONFIG_*` variable (`public/env-names.txt`: 61 names, 0 of these). Default clone root; no `--checkout` or `--workdir`.

Source bracketing: `prep/27-tests-inventory-diag2-prelaunch.txt` (`be22f86d…`, 04:55:48.336Z) and `prep/28-tests-inventory-diag2-postrun.txt` (`08a8115a…`, 05:22:14.727Z): 250 tests files and 42 `tests/host` files equal the C4 blobs, 0 extra, both times.

### Window-level boundary (W1–W4) and lane-level core boundaries

| Step | Result | Evidence (`<R>/diag2/public/`) |
| --- | --- | --- |
| Ancestor check | Home 0750; group members `quangnguyen root` only | `ancestor-boundary.json` `a0342c92…` |
| W1 wake | Pre-wake: VM clock 04:55:54.864Z at host 04:55:54.448Z; 0 containers; bridge `223a63172249` (not boundary evidence). Wake on the cached image `sha256:44fce696…`, `--pull never`; 0 remain. The bridge was not recreated. | `w1-wake.json` `2b3c6078…` |
| W2 liveness | PASS (advancing clock) | `w2-liveness.json` `fa1732ce…` |
| W3 formal start | Live `SystemTime` 04:56:05.579Z (`runStartSecond` 1792644965). Identity 0 differences (engine 29.9.1, image `sha256:44fce696…`). **0 containers. Exactly 9 volumes**: the 7 protected FULL records equal the baseline, plus anonymous `a17056b8…` and `d5df35bd…`. No `qa-la-sim-r1` item. Networks: bridge, host and none only. Both lanes fresh; port free; no subnet clash; 0 problems. | `w3-formal-start.json` `638d2ffd8bfe66f43e0fb3babc7ea35dccc773d5e10ea193adc65cf229ce1845` |
| Lane core boundaries | Each child: `G1-IDENTITY` PASS, `PRE` PASS, protected-volume snapshots, `M3-ISOLATION` PASS, `TEARDOWN` PASS | phase `summary.json` |
| Sampler | 102 samples, 0 failed, one bridge Id, 0 skew violations (max 0 ms), **at most 1 compose project**. Other names: only the lanes' own short-lived QA containers (`qa-multi-r1-qa-fixture-…`, `qa-multi-r1-st-qa-oracle-…`, `qa-multi-r1-st-qa-fixture-…`). | `sampler/lane-containers.json` `67ac19e0…` |
| W4 end and strict compare | End live 05:21:42.983Z (capture 05:21:45.462Z); 0 containers; 9 volumes; both lanes fresh; port free; identity 0 differences. Strict W3-to-end compare: **0 problems**. The 7 protected FULL records, both anonymous volumes and the bridge, host and none Ids are unchanged. | `w4-end.json` `e86a63bf…`, `w4-compare.json` `ded8f518f03f60462f0756ffe82a29e2c4ffd3393978e28b01d0047c517b73b0` |

### Migration phase (`qa-multi-r1-bf09cdad-2026-10-22T04-56-08-777Z`)

- Child exit 0. 12 of 12 rows PASS; the ids equal the static migration-phase ids (`D/migration-results.json` `16511ce6…`). Core `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `MIGRATION`, `M3-ISOLATION`, `TEARDOWN` PASS; abort none (`summary.json` `6bd4e7ed…`).
- Scans: complete; 10 points; 0 hits, corrections, refusals and problems (`D/migration-scans.json` `9aff3328…`). Ownership: 23 records, 0 ledger errors, 0 kept, 0 failed, 5 removed (`lane-ownership.json` `4490fac2…`).
- Run-or-stop rule (a)–(f): all held (`D/diagnostic.json` `eea0259e…`: migration code 0, storage `RUN`, cause none; storage child code 0; teardown ok; W4 ok). `D` = `<R>/diag2/private/qa-m1-diagnostic-c764a13c57b62446` (new, 0700). `H` = `D/handoff.json` (0600, `f003fcea…`, written by the migration child); the storage child got the same `H` and `w`.

### Storage phase (`qa-multi-r1-st-bf09cdad-2026-10-22T05-00-09-935Z`)

- Child exit 0. 70 of 70 row ids have one result: **70 PASS**, 0 FAIL, 0 NOT_APPLICABLE (`D/storage-results.json` `5f17d9a7…`); the ids equal the static storage-phase ids. Summary: 87 aggregate entries, all PASS (core `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION`, `TEARDOWN`, the harness self-checks and the 11 fixture records); abort none (`summary.json` `45c53022…`, `m1-case-results.json` `1b1a7265…`).
- 81 step records (70 rows + 11 fixture runs), 0 non-PASS. Scans: complete, 92 points, all clean (`storage/storage-scans.json` `e800fb74…`). Ownership: 87 records, 0 errors, 0 kept, 0 failed, 4 removed (`lane-ownership.json` `a6a38e08…`).
- `c-host-negative` PASS (oracle probe `lock_not_enforced`; one of its two frozen permitted results).

### R5 target row `g-tamper`: runtime execution evidence

Raw command logs read by hand (`<storage folder>/cmd/`); supplementary `diag2/public/r5-tamper.json` (`f9f2ae27…`): MET, 0 failed conditions.

| Check | Raw evidence |
| --- | --- |
| Own drill marker | `515-g-tamper-stop` (`2a884464…`): `--stop-after swapped`, exit 3; exactly one `storage_drill_stop`, point `swapped`, opId `55948196733e2867e18ee47d85756e1a` (05:17:31.844Z). |
| Retained generation present | Listing `516` (`17213d5d…`): `.previous-55948196…` and the retained `.previous-f625533ab86c08167a7c848e86f3b9b0` (the `g-orphan-refusal` operation; kill-record pause 05:15:04.435Z). Here the own folder sorts first; in attempt 1 the retained folder sorted first. The two attempts exercise both listing orders on the repaired selection. |
| Exact planted path | `517-fixture-plant` (`31cc4248…`) exit 0: results exactly `[{"op":"flip","vol":"lti","path":".previous-55948196733e2867e18ee47d85756e1a/lti.db"}]`. |
| Only the target changed | Listings `516` → `518` (`8ddbf5bb…`): the same 22 entry names in both volumes; the target's SHA-256 changed `8e31834f…` → `6fbe3429…`; every other entry is equal, the retained generation included. |
| Recover | `520-g-tamper-recover` (`bdb72ee5…`) exit 2: `storage_restore_unresolved` opId `55948196…`, "other bytes: /check/lti-service/.previous-55948196…/lti.db"; `storage_recover` code 2, "the rollback did not finish; do not start; keep both volumes; use stack:data-quarantine". |
| Journals and files after | File set `521` (`163e9fe6…`): lti and app journals `rollback_failed`, opId `55948196…`, operation `restore`. Listing `522` (`216ccc95…`) against `518` under the row's rule: no file deleted or added; only the two root journals changed. |
| Refusal | `523-g-tamper-up` (`d9a90636…`) exit 1: `rollback_failed`, names `npm run stack:data-quarantine -- --out <folder>`, "stopped before any container start". No output says "no target changed". |
| Row and dependents | `g-tamper` PASS (`055-g-tamper.json`). All 17 dependents (`g-quarantine-in-use`, `g-quarantine`, `h-legacy-manifest`, `h-target-state`, `e-hot-journal`, `e-old-layout`, `e-fresh-refusal`, `g-fresh-target`, `h-pair-mismatch`, `e-import-recover`, `e-changed-byte`, `e-added-wal`, `e-import-nonfresh`, `h-old-manifest`, `e-import`, `e-kept`, `e-provenance-restore`) ran their own steps and passed; the fixtures `@legacy-place`, `@legacy-remove` and `@legacy-import-lane` passed. |

### R4 target rows: runtime execution evidence (preserved checks)

Supplementary `diag2/public/r4-checks.json` (`8ddad8b5…`): all six MET. Raw facts read by hand:

| Row | Result | Raw evidence |
| --- | --- | --- |
| `g-prepared-lti` | PASS | `333` exit 3, own `storage_drill_stop` `prepared-lti` opId `6c47af1f0dcd3da2eda5c47af045cac2`; `334` exit 1 `journal_open`; `335` exit 1, "cancelled at the first journal write; the targets equal the state before (verified)"; lti journal `rolled_back` with opId `6c47af1f…`; app journal absent before and after. |
| `g-recover-idempotent` | PASS | 11 `recover-again-<point>` commands in `DRILL_POINTS` order (`341` … `483`), each exit 0 "nothing to recover"; all 11 step notes in order. |
| `g-orphan-stopped` | PASS | Kill record (`137a788e…`): restore lock `runId` `f8851ba82d985a99`, acquired 05:17:16.580Z, `pgid` 51871 = the spawned group; own pause `swapped-lti` opId `05461078e513e5bedfe39e7f16b0ab06` (05:17:17.064Z), different from the `g-orphan-refusal` pause `f625533a…`; one running maintenance container. `505` `docker stop` exit 0; `506` `storage_lock_reclaimed` (owner `f8851ba8…`), exit 1, "rolled back; the targets equal the state before (verified)"; `511` exit 0. |
| `e-import` | PASS | `582-e-import-final` exit 0; both identities' `legacySources` equal the manifest `files` as complete entries (`lti-service/lti.db` 122880 `d8844a52…`, `cogniate-app/cogniate.db` 315392 `13feb962…`). |
| `e-kept` | PASS | `584-e-kept-up` exit 0 with the L6 "kept" warning; no `legacy_conflict`. |
| `e-provenance-restore` | PASS | `586` and `588` exit 0; lti pair `d2229176…` kept, generation 1 → 2, provenance `restore`, `legacySources` unchanged; `590` exit 0 with the "kept" warning and no `legacy_conflict`. |

### Runtime checks (`diag2/public/v-checks.json` `30322c16…`, unchanged judge `vchecks.py` `359d7112…`; V3-R record `v3-r-c4-diag2.json` `0ab9e1de…`)

| Check | Result | Evidence |
| --- | --- | --- |
| V1-R `a-serialize` | **Met** | Run `X` = `d8b1e3c5e6962d3c`, `pgid` 95234; one acquire and one release in the saved output, the same release in the archive; `command` `stack:data-backup`; the `stack:up` wait names `X`. Clock `lo` −10.7 ms, `hi` 75.8 ms; release 05:07:23.878Z; margins `lti-service` 2,393.7 ms, `cogniate-app` 2,462.8 ms. |
| V2-R `d-mountpoint` | **Met** | Commands 132–136 in order; 0 `EACCES`, 0 `source_unreadable`; both quarantines log `storage_quarantine_copy` and exit 0; no phase stop. |
| V3-R `Origin` | **Met** | 0 `csrf_rejected` (5 segments and the final copy); `e-old-schema` PASS; platform 201 and connection 201 at `@backup-B` (05:11:46Z; write after B 05:11:55Z) and each `@post-B` (05:15:02Z, 05:17:15Z, 05:17:30Z). The judge printed `CHECK` (kept); the facts are in the manual record. |
| V4-R scans | **Met** | Migration 10 and storage 92 points, all clean, both complete. |
| V5-R P-1a | **Met by row assertions** | `a-fresh` PASS; `d-content-folder` PASS ("uploads is a new empty 0700 directory"); the absent-case before-listings are empty. |

### Observed permissions, privacy and cleanup

- QA files 0600 and folders 0700 from creation (umask 077) in `diag2/` and `prep/`. Runner-written (umask 022), the same accepted pattern as attempt 1: `D/migration-results.json` and `D/storage-results.json` at 0644; in `diag2/tmp`, two `qa-tree-*/index` files at 0644 and the compile-cache folder at 0755; phase artifacts 1,012 files at 0644 and 35 folders at 0755 inside the 0700 clone. Phase clone roots set to 0700 by the clone guard.
- Secret scan: 0 problems (`secret-scan.json` `df6ba0b5…`; 38 captured and 17 stack values; 4 clones). Clone guard: 0 problems (`clone-guard.json` `a4171bfc…`; 2 clones, 2 checkpoints, 1 captured-secret file set to 0600; the two attempt-1 phase clones are ignored as born before `--since`).
- Owned cleanup by the core teardown only; W4 confirms 0 containers and both lanes fresh. No owned process remains. Port 8443 has no listener. PID 64140 untouched. Nothing was removed by hand.

### Evidence

- Evidence index v2 (outside the indexed set): `<R>/evidence-index-v2.tsv`, 4,309 entries (`diag/`, `diag2/`, `prep/`, `tools/`, `report/`, the four phase artifact folders) with SHA-256, size and mode; SHA-256 `47034a96441542abb74dbb10ea4ed57a26f0fee2575f07c4ea5b0034ec01af22`. All 2,324 index-v1 entries are unchanged inside v2. Root files: `<R>/evidence-index-v2-root-files.tsv` (`d83a68e2…`, 12 entries). Bindings: `report/bindings-v2.tsv`.
- Messages: retry preparation `msg_e3d7ca749fb1` (accepted `msg_8f0bc6765d2b`); grant `msg_e530684e807f`; gate `msg_44fd512ce07d`; launch `msg_c066c14f19f6`; migration milestone `msg_d57f49e08466`; result `msg_0feb500bf67f`.

### Measured timings

Diagnostic 25 min 44 s (runner start to exit); 26 min 00 s from launcher start. W1–W3 15 s. Migration child about 4 min 01 s. Storage child about 21 min 27 s (folder start to W4 start). W4 15 s.

### Next

The Lead verifies this diagnostic. Only a separate grant starts the two complete 488-row rounds on C4 and the 12 legacy groups, from the unused `<R>/full-src/source`; they did not run and stay required. Fresh M2 and T7 follow under another owner. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`. No certification or production claim.

## Full run at candidate C4 `bf09cda`: FAIL in round 2 `snapshot-isolated` (`M3-ISOLATION`, non-owned project in the window); round 1 488/488 PASS; legacy not run, 2026-10-22

Verdict for this attempt: **FAIL**. Round 1 ran all 488 rows once: **488 PASS**, 0 FAIL, 0 NOT_APPLICABLE. Round 2 ran `sim` (394/394 PASS) and `snapshot-isolated` (6/6 rows PASS). Then the core record `M3-ISOLATION` of round 2 `snapshot-isolated` failed: "containers changed: 1". The changed container is `/qa-la-sim-r2-cogniate-app-1`, which belongs to a compose project that this session does not own (`qa-la-sim-r2`, LA run). The child exited 1, so the runner stopped. Round 2 `snapshot-upgrade`, `migration` and `storage`, the two-round equality check and all 12 legacy groups did **not run**. The strict W4 comparison also failed, with 16 new unrelated `qa-la-sim-r2` items. No row failed on its own check, and no source fault is established. Round 1 alone gives no acceptance credit: two complete equal rounds and the legacy groups stay required. The C4 diagnostic attempts above stay as recorded (attempt 1 FAIL, attempt 2 PASS with zero credit). Owner, model and independence: as in the C4 diagnostic sections (task `task_ef1d19129419`, dispatch `ctx_e23ced3dd1fa`). I propose no fix; the remediation owner `ctx_898acbaef3a6` owns every repair.

### Grant, source and command

| Item | Value |
| --- | --- |
| Grant | Lead `msg_b5a1d0332685`: exclusive full + legacy window until `2026-10-22T09:30:00.000Z`, after acceptance of diagnostic attempt 2. The LA coordinator had agreed to stay host-only until an explicit window return (same message). Returned with the closeout message of this section. My last Docker activity was the launcher's W4 compare and scan at 06:45:24Z. |
| Source | `<R>/full-src/source` (the separate FULL clone, prepared at 04:08:11Z and never used before): C4, detached, 0 status lines (only ignored `tests/node_modules/`), no `tests/host/artifacts`, no state, `.env` or hooks, push disabled. Prelaunch (`prep/30-full-prelaunch.txt` and `prep/30-tests-inventory-full-prelaunch.txt` `05:26:29.183Z`): 250 tests files and 42 `tests/host` files equal the C4 blobs, 0 extra; `tests/node_modules` manifest and modes equal the qualified `452a27f9…` / `f2c452dd…`; package `685c10cf…`, lock `213718dd…`; tools equal the READY ledger; 0 `QA_*`, `npm_*` or `NPM_CONFIG_*` names (this launcher has no removal step); port 8443 free; 0 Docker or Compose processes. Post-run (`prep/32-tests-inventory-full-postrun.txt`, 07:04:04.737Z): 250/250 and 42/42 equal, 0 extra. These two records bracket the run. |
| Launcher | `tools/launch-full-c4.sh` `c824abeb70835c61fdac056bdc1a141f8669aed32e96d7fdce2ff62a5ff0412b` (identity-only diff to `launch-full-c3.sh`) with exactly three arguments (C4, the FULL source, `<R>/full`), detached in its own process group (PID = PGID 49819; runner node PID 52038; sampler 52031, secret watch 52032, clone guard 52033). |
| Runner child | `umask 022; COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 STACK_PROFILE=default COURSE_FIXTURES_DIR=<courses> TMPDIR=<R>/full/tmp node tests/host/run-m1.mjs --sha bf09cda… --test-sha bf09cda… --source <R>/full-src/source` (`full/public/command.txt` `292d0880…`). Default phase `full`; no filter. |
| Time (UTC) | Launcher 05:26:41Z; runner 05:26:57Z–06:44:53Z (exit 1); W4 end capture 06:45:01Z; strict compare 06:45:11Z; secret scan and done 06:45:24Z |

### Boundary (one W1–W4 sequence for the run)

| Step | Result | Evidence (`<R>/full/public/`) |
| --- | --- | --- |
| Ancestor check | PASS | `ancestor-boundary.json` `0e494ec5…` |
| W1 wake | Pre-wake idle-VM cache (VM clock 05:26:37.788Z at host 05:26:42.256Z; not boundary evidence); 0 containers. Wake on the cached image, `--pull never`, 0 left. Bridge recreated `223a63172249` → `9577478bf0a8`. | `w1-wake.json` `4332a597…` |
| W2 liveness | PASS | `w2-liveness.json` `909267f6…` |
| W3 formal start | Live 05:26:54.287Z (`runStartSecond` 1792646814); identity 0 differences (CLI 29.9.1, Compose 5.6.0, engine 29.9.1, image `sha256:44fce696…`); **0 containers; exactly 9 volumes** (7 protected FULL identical + `a17056b8…` + `d5df35bd…`); networks bridge, host and none only; lanes fresh; port free; 0 problems | `w3-formal-start.json` `01241136664905fe8c059e9a7c361d0702448fe0b0e16bcabd61225d6e6f4893` |
| Sampler | 305 samples, 0 failed, one bridge Id, 0 skew. At most 2 compose projects at the same time. Other names seen: the storage lane's own oracle and fixture containers, and three non-owned names: **`qa-la-sim-r1`**, **`/sto-pg18-probe`** and **`qa-la-sim-r2`**. The sampler records the names, not their times. | `sampler/lane-containers.json` `4686e77e…` |
| W4 end | Capture PASS at 06:45:01.797Z (live 06:44:59.171Z): identity 0 differences; our lanes fresh; port free; 0 subnet clash; the 7 protected FULL records identical. But 10 containers and 14 volumes exist: the extra items are `qa-la-sim-r2`. | `w4-end.json` `b5e63143…` |
| W4 strict compare | **FAIL (exit 1)**: 16 problems, all "new unrelated": network `qa-la-sim-r2_default`; volumes `qa-la-sim-r2_{appdb,e2e_tests_node_modules,ltidb,moodledata,pgdata}`; containers `qa-la-sim-r2-{cogniate-app,lms-sim,lti-gate,lti-service,moodle,postgres,proxy,qa-platform,sink}-1` and `qa-la-sim-r2-qa-acceptance-95972`. Protected records identical at the end, both anonymous volumes present, bridge, host and none Ids unchanged. | `w4-compare.json` `25ac8723…` |

### Round 1 (bound to exact folders; COMPLETE, 488/488 PASS)

Binding method (unchanged from C3, Lead direction; no global n-th pick): the FULL source holds only this invocation's folders. Each phase is the run folder with its identity phase, C4 product and test SHA, project, port and subnet. Its `m1-case-results.json` is parsed-equal to this invocation's accounting file `<R>/full/tmp/qa-m1-accounting-XdBX6Z/round-1-<phase>.json`. The time binding holds for every phase: folder start ≤ identity timestamp ≤ accounting mtime < next folder start. The exact `phase<TAB>id` set (`jq`, `sort`, `comm`, `uniq -d`) equals the static ids: 488 = 488, 0 missing, 0 extra, 0 duplicates. Records (`<R>/full-judge/`): `round-1-bind.json` `3da50592…`, `round-1-verify.json` `ae7773b0…` (MET), `round-1-set.txt` `bd25b776…`, `round-1-time.json` `7b2da1be…`; wrapper `prep/bin/round-judge.sh` `81517949…` (runs the unchanged `round-bind.py` `a0785333…` and `round-verify.py` `340cc5b2…`; controls on C3 evidence: the accepted C3 round 1 judgment is reproduced, and an absent round gives 488 missing).

| Phase | Folder (`<R>/full-src/source/tests/host/artifacts/`) | Rows | Result | Time (UTC) | `m1-identity` / `m1-case-results` / `summary` / accounting (SHA-256 prefixes) |
| --- | --- | --- | --- | --- | --- |
| sim | `qa-multi-r1-bf09cdad-2026-10-22T05-26-57-277Z` | 394 | 394 PASS | 05:26:57.277Z–05:49:44.388Z | `d88b66e5…` / `1234836c…` / `2ad4f64a…` / `799d3625…` |
| snapshot-isolated | `qa-multi-r1-bf09cdad-2026-10-22T05-49-50-379Z` | 6 | 6 PASS | 05:49:50.379Z–05:51:20.960Z | `1c465b6c…` / `b278775d…` / `f72b51b8…` / `91c4536a…` |
| snapshot-upgrade | `qa-multi-r1-bf09cdad-2026-10-22T05-51-25-320Z` | 6 | 6 PASS | 05:51:25.320Z–05:53:11.485Z | `88bb8ad7…` / `12e8cacb…` / `06f4dad0…` / `6c22f511…` |
| migration | `qa-multi-r1-bf09cdad-2026-10-22T05-53-15-870Z` | 12 | 12 PASS | 05:53:15.870Z–05:57:04.002Z | `4628c860…` / `4098d6ca…` / `75c3cd2d…` / `16511ce6…` |
| storage | `qa-multi-r1-st-bf09cdad-2026-10-22T05-57-08-327Z` | 70 | 70 PASS | 05:57:08.327Z–06:19:44.633Z | `c60957b7…` / `5f63e334…` / `736fe451…` / `946df49e…` |

- Total: 488 rows, 488 distinct, 488 PASS (common 114, Blackboard 141, Canvas 233). `c-host-negative` PASS (probe `lock_not_enforced`). Runner: "Round 1: 488 rows; PASS 488; NOT_APPLICABLE 0".
- Core records of every round-1 phase: `G1-IDENTITY`, `PRE` (0 other containers on the host), `CLONE`, `H1`, `M3-ISOLATION` (0 containers changed) and `TEARDOWN` PASS; abort none; profiles default, no knobs. Storage: 87 aggregate PASS, 81 step records with 0 non-PASS, 92 scan points clean (`storage-scans.json` `113cfeaf…`). Ownership: 0 ledger errors, 0 kept, 0 failed in every phase (removed: sim 5, isolated 5, upgrade 5, migration 5, storage 4).
- SIM clone (for Canvas): `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T05-26-57-277Z`. Handoff to the Lead: `msg_3492c30536dd`. The Lead accepted the independent Canvas judgment of the 233 Canvas rows as one-round evidence (`msg_efeab9afded9`).

Round 1 `g-tamper` (raw command logs read by hand; `full-judge/round-1-r5-tamper.json` `48395650…` MET): `515-g-tamper-stop` exit 3, one `storage_drill_stop` point `swapped`, opId `288cd9a56f2df56d17068ecebd5421da`; listing `516` holds `.previous-288cd9a5…` and the retained `g-orphan-refusal` generation `.previous-3cc69ff5355f623e7b4244589b4b5349` (pause 06:12:36.760Z); `517-fixture-plant` exit 0 with results exactly `.previous-288cd9a5…/lti.db`; listings `516` → `518`: the same 22 names, only the target's SHA-256 changed (`db1cb152…` → `8bad080d…`); `520-g-tamper-recover` exit 2, `storage_restore_unresolved` "other bytes" on that file; file set `521`: both journals `rollback_failed`, opId `288cd9a5…`; listing `522` against `518`: only the root journals changed; `523-g-tamper-up` exit 1, refuses `rollback_failed` and names `stack:data-quarantine`. All 17 dependents and the 3 legacy fixtures ran and passed.

Round 1 R4 rows (`full-judge/round-1-r4-checks.json` `f359d5f1…`, all MET; raw read): `g-prepared-lti` drill exit 3 with own opId `5af87938eab2d8e9abc822db9123b133`, `334` exit 1 `journal_open`, `335` exit 1 "cancelled at the first journal write; the targets equal the state before (verified)", lti journal `rolled_back` with that opId, app journal absent before and after; `g-recover-idempotent` 11 `recover-again-<point>` commands (`341` … `483`) in order, each exit 0; `g-orphan-stopped` kill record (`89f56650…`): restore lock `7f854da80bf79a0e`, `pgid` 65352 = the spawned group, own pause `swapped-lti` `66ce4e858a8dc469095a341107d65324` (differs from `g-orphan-refusal` `3cc69ff5…`), `505` exit 0, `506` lock reclaimed and exit 1 "rolled back; … (verified)", `511` exit 0; `e-import` exit 0, both identities' `legacySources` = the manifest entries (`dde8454a…` 122880, `dcc1e282…` 315392); `e-kept` `584` exit 0 with the "kept" warning and no `legacy_conflict`; `e-provenance-restore` pair `63dbcd34…` kept, generation 1 → 2, provenance `restore`, `590` exit 0 with the warning.

### Round 2 (INCOMPLETE; bound to exact folders)

`full-judge/round-2-bind.json` `101913a7…`, `round-2-verify.json` `fddc6c80…` (NOT MET), `round-2-set.txt` `18d55cb8…` (actual 400 of 488: 88 missing = the three phases that did not run), `round-2-time.json` `20dd8369…` (ordered for the two run phases).

| Phase | Folder | Rows | Result | Time (UTC) | `m1-identity` / `m1-case-results` / `summary` / accounting |
| --- | --- | --- | --- | --- | --- |
| sim | `qa-multi-r1-bf09cdad-2026-10-22T06-19-49-128Z` | 394 | 394 PASS; core all PASS (`PRE` 0 other containers; `M3-ISOLATION` 0 changed) | 06:19:49.128Z–06:43:06.388Z | `3fd7db85…` / `66ace8c8…` / `4cf56165…` / `ee2de701…` |
| snapshot-isolated | `qa-multi-r1-bf09cdad-2026-10-22T06-43-12-545Z` | 6 | 6 rows PASS; **`M3-ISOLATION` FAIL**; other core PASS | 06:43:12.545Z–06:44:49.730Z | `01808385…` / `8b52268f…` / `c09c1fd6…` / `d5de9441…` |
| snapshot-upgrade, migration, storage | — | — | not run | — | — |

### First cause: round 2 `snapshot-isolated` `M3-ISOLATION` (facts only)

| Item | Facts |
| --- | --- |
| Failed check | Core record `M3-ISOLATION` "Existing non-QA-run containers and volumes remain unchanged": FAIL, "containers changed: 1; volumes changed: none" (`summary.json` `c09c1fd6…`). Runner stdout: `FAIL   M3-ISOLATION`; stderr: `run-m1.mjs:146` "Required child failed" (`ERR_ASSERTION`, actual 1) inside `fullRounds` (`storage-diagnostic.mjs:28`). |
| Changed container | The phase's own `TEARDOWN` (PASS; 0 lane resources left) names "other projects' containers that stopped or restarted: `/qa-la-sim-r2-cogniate-app-1`". In `w4-end.json` that container was created 06:44:29.916Z and started 06:44:32.092Z, inside this phase (06:43:12.545Z–06:44:49.730Z). |
| The non-owned project | Compose project `qa-la-sim-r2`; labels name `working_dir` `/Users/quangnguyen/cogniate-qa-runs/LA/E0/runs/m1-sim-rw-r2/infra` and its `compose.yaml`. Creation times: network 06:30:05.093Z (subnet `172.20.0.0/16`); volumes `appdb` and `ltidb` 06:30:04Z, `moodledata` and `pgdata` 06:30:05Z, `e2e_tests_node_modules` 06:30:58Z; containers `postgres`, `proxy`, `moodle` 06:30:05Z; `lms-sim`, `lti-gate`, `qa-platform`, `sink` 06:30:52Z; `qa-acceptance-95972` 06:30:59Z; `lti-service` 06:39:39.898Z; `cogniate-app` 06:44:29.916Z. All running at W4. |
| When it started | 06:30:04Z, during round 2 `sim` (06:19:49Z–06:43:06Z). That phase's `PRE` saw 0 other containers and its `M3-ISOLATION` passed (no pre-existing container changed). The `snapshot-isolated` `PRE` at 06:43:12Z saw 10 other containers. Every round-1 phase `PRE` saw 0 other containers. |
| Other non-owned names | The sampler also saw `qa-la-sim-r1` and a container `/sto-pg18-probe` at times it does not record. Neither was present at any phase `PRE` (0 other containers through round 2 `sim`, and the 10 at round 2 `snapshot-isolated` are the `qa-la-sim-r2` containers), nor at W4. |
| Interference signs in our rows | None found: every round-1 and round-2 row that ran passed; port 8443 stayed free; no subnet clash; the 7 protected records stayed identical; our lanes fresh at every teardown and at W4. I did not touch any non-owned resource. |

Notification: the Lead read the stderr and the W4 record first (`msg_22503aabd8fd`, 06:46:34Z; `msg_41b494f979c5`, 06:57:49Z) and classified the overlap; I acknowledged at 07:02Z (`msg_6fd362fc7d2f`). This was later than the prompt notice the grant requires: my monitor stream ended with the launcher at 06:45:34Z, and the session usage limit held me until 07:00Z, so I read the messages and the evidence only at 07:02Z (see D-2). The frozen driver ended by itself; I made no retry.

### Not run

Round 2 `snapshot-upgrade`, `migration` and `storage`; the two-round per-case equality; all 12 legacy groups (T2a, T2b, T3a, T3b, T3c, T4a, T4b1, T4b2, T5a, T5b, T6, T8).

### Privacy, cleanup and permissions

- Secret scan 0 problems (`secret-scan.json` `b91544ae…`; 10 clones; 2,776 captured and 77 stack values). Clone guard 0 problems (`clone-guard.json` `22fe4706…`; 7 phase clones set to 0700 at 7 checkpoints, 6 captured-secret files set to 0600; 4 older clones ignored as born before `--since`).
- Owned cleanup by the core teardown only (every phase `TEARDOWN` PASS, 0 lane resources left); W4 confirms our lanes fresh. No owned process remains (launcher, runner, observers, monitors; `prep/33-full-postrun-process.txt`). Port 8443 has no listener. PID 64140 untouched. Nothing was removed by hand. The `qa-la-sim-r2` resources are not mine; I did not touch them.
- Modes: QA files 0600 and folders 0700. Runner-written (umask 022): the seven accounting files in `full/tmp/qa-m1-accounting-XdBX6Z/` at 0644 (the launcher's copy in `full/private/accounting/` is 0600), three `qa-tree-*/index` files at 0644, the compile-cache folder at 0755, and the phase artifact trees (2,620 files at 0644, 89 folders at 0755) inside the 0700 clone.

### Measured timings

Launcher 1 h 18 min 43 s; W1–W3 15 s; runner 1 h 17 min 56 s. Round 1, from each folder start to the next folder start (storage: to its identity timestamp): sim 22 min 53 s, snapshot-isolated 1 min 35 s, snapshot-upgrade 1 min 51 s, migration 3 min 52 s, storage 22 min 36 s; complete round about 52 min 47 s. Round 2: sim 23 min 23 s; snapshot-isolated 1 min 37 s. W4, compare and scans about 31 s. Legacy is still not measured.

### Evidence

- Evidence index v3 (outside the indexed set): `<R>/evidence-index-v3.tsv`, 8,810 entries (`diag/`, `diag2/`, `full/`, `full-judge/`, `prep/`, `tools/`, `report/`, all phase artifact folders of the three source clones) with SHA-256, size and mode; SHA-256 `b894ff80f40bd9dcaf18d2299867d4185914c8a42c87ca4ac32d2f4d40e27e03`. All 4,309 index-v2 entries are unchanged inside v3. Root files: `<R>/evidence-index-v3-root-files.tsv` (`f5b62383…`, 18 entries). Bindings: `report/bindings-v3.tsv`.
- Messages: grant `msg_b5a1d0332685`; gate `msg_9ece72f76533`; launch `msg_bf67e84d25ba`; round 1 closed `msg_3492c30536dd`; Canvas peer accepted `msg_efeab9afded9`; Lead stop and closure requests `msg_22503aabd8fd`, `msg_41b494f979c5`; my acknowledgement `msg_6fd362fc7d2f`.

### Disclosures (continued)

- D-2: I gave the first-failure notice late. The runner failed at 06:44:53Z; the Lead found it from the files at 06:46:34Z. My monitor reported the FAIL lines at 06:45:04Z, but I acted on them only at 07:02Z, because this Claude session had reached its usage limit until 14:00 Asia/Saigon (07:00Z), as its public output showed (Lead `msg_04dc2d0db05c`). The evidence was not changed in between.
- `prep/bin/round-bind.py` prints a Python 3.14 `DeprecationWarning` (`utcfromtimestamp`) on stderr; its output is unaffected. `round-verify.py` key names say "C3"; the SHA is its argument (C4 here).

### Next

The Lead and the LA coordinator resolve the shared Docker window; the Lead decides a new full grant on the same C4. Two complete 488-row rounds with per-case equality, all 12 legacy groups, fresh M2 and T7 stay required. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`. No certification or production claim.

## Full run retry (`full2`) at candidate C4 `bf09cda`: FAIL in legacy `T6` (`AC-T6-07`, `AC-T6-13`, `AC-T6-09`); Rounds 1 and 2 complete (488/488 PASS each, per-case equal); 10 of 12 legacy groups PASS; `T8` not run; W4 strict compare PASS, 2026-10-22

Verdict for this attempt: **FAIL**. Round 1 ran all 488 rows once: **488 PASS**, 0 FAIL, 0 NOT_APPLICABLE. Round 2 ran all 488 rows once: **488 PASS**, 0 FAIL, 0 NOT_APPLICABLE, with exact per-case equality across both rounds (`round-1-actual.tsv` and `round-2-actual.tsv` byte-identical, SHA-256 `97e37fa13352492e73973fa5e1a096b88efb24fc2c823b9f4fa42750b316e9b9`; conditional `M1-41.common.c-host-negative` PASS in both rounds). The runner then entered `--phase legacy` (`QA_M1_LEGACY_GUARD=1`) in the same invocation: `run-t2.mjs` (`T2a, T2b, T3a, T3b`), `run-t3c.mjs` (`T3c`), `run-t4a.mjs` (`T4a`) and `run-t4b.mjs` (`T4b1, T4b2`) all closed PASS, and in `run-t5.mjs --tasks T5a,T5b,T6` groups `T5a` (23/23), `knob-PLAY_TTL_SECONDS` (1/1) and `T5b` (24/24) passed before `T6` failed 3 of 18 Playwright cases (`AC-T6-07`, `AC-T6-13`, `AC-T6-09`; 15 passed). Each of the 3 failed `T6` cases timed out after 15,000 ms waiting for a button or link matching `/Publish to Moodle/` on the portal course detail page, where M2 renamed the opener link and dialog heading to `"Publish to an LMS"`. Because `run-t5.mjs` exited 1 after its `M3-ISOLATION` and `TEARDOWN` checks passed, `run-t8.mjs` (`T8`) did **not run**. The launcher then completed W4 end capture, clone guard, strict 10-volume W4 comparison (`0` problems), and secret scan (`0` problems). Historical C4 attempts above stay preserved (`diag` attempt 1 FAIL, `diag2` PASS with zero credit, first `full` attempt FAIL in round 2 `snapshot-isolated` `M3-ISOLATION`). Owner and model continuation (`docs/team/model-transition-2026-10-22.md`): launched under task `task_ef1d19129419`, dispatch `ctx_e23ced3dd1fa` (Claude Code Opus 5.5 xhigh) and adopted in-flight without restart under dispatch `ctx_77546b08ce17` (Antigravity Gemini 4 Argon High, `gemini-4-argon-high`, effort `high`, Lead grant `msg_e2be5a76f4a4`). I propose no fix; the single remediation owner `ctx_131c9c349fd8` owns every repair.

### Grant, source and command

| Item | Value |
| --- | --- |
| Grant | Lead `msg_6218a54231e9`: exclusive full + legacy window until `2026-10-22T11:30:00.000Z`, transferred in-flight to `ctx_77546b08ce17` by `msg_e2be5a76f4a4`; bounded report grant `msg_4737e898d10a`. Returned to the Lead at `09:42Z` (`msg_ca0849c1157c`) after the launcher's W4 compare and secret scan finished at `09:39:07Z`. |
| Source | `<R>/full2-src/source` (fresh detached `--no-hardlinks` clone at C4 `bf09cdad91ca548e1ecbc14428b55180d35d5360`, tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`, prepared at `07:08:01Z`, mode `0700`, push disabled; `prep/RETRY-FULL2.md`, `prep/41-source-checks-full2.txt`). Prelaunch (`prep/50-full2-prelaunch.txt`, `prep/50-tests-inventory-full2-prelaunch.txt` at `07:14:24Z`): 250 tests files and 42 `tests/host` files equal the C4 blobs, 0 extra; `tests/node_modules` manifest and modes equal the qualified `452a27f9…` / `f2c452dd…`; `package.json` `685c10cf…`, lock `213718dd…`; 0 `QA_*`, `npm_*` or `NPM_CONFIG_*` env vars; port 8443 free; 0 Docker/Compose processes. Post-run (`prep/53-tests-inventory-full2-postrun.txt` at `09:39:42.242Z`): 250/250 and 42/42 equal C4 blobs, 0 extra. These two records bracket the run. |
| Launcher | `tools/launch-full-c4.sh` `c824abeb70835c61fdac056bdc1a141f8669aed32e96d7fdce2ff62a5ff0412b` with three arguments (C4, `<R>/full2-src/source`, `<R>/full2`), detached in its own process group (`PID = PGID 37365`; runner `node` `PID 39819`; observers in own PGIDs: sampler `39812`, secret watch `39813`, clone guard `39814`). |
| Runner child | `umask 022; COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 STACK_PROFILE=default COURSE_FIXTURES_DIR=<courses> TMPDIR=<R>/full2/tmp node tests/host/run-m1.mjs --sha bf09cda… --test-sha bf09cda… --source <R>/full2-src/source` (`full2/public/command.txt` `1238f387…`). Default phase `full`; no filter. |
| Time (UTC) | Launcher `07:14:29Z`–`09:39:07Z`; runner `07:14:45.000Z`–`09:36:39.000Z` (`exit 1`, `full2/public/full-run-exit.json` `1f28d245…`); W4 end capture `09:36:47.055Z`; clone guard and W4 strict compare `09:36:56.769Z`; secret scan and done `09:39:07Z`. |

### Boundary (one W1–W4 sequence for the run)

| Step | Result | Evidence (`<R>/full2/public/`) |
| --- | --- | --- |
| Ancestor check | PASS (`mode 750`, owner `quangnguyen`, group members `quangnguyen root`) | `ancestor-boundary.json` `4f4b51d9…` |
| W1 wake | Pre-wake idle-VM cache (0 containers); wake on cached image, `--pull never`, 0 left | `w1-wake.json` `ef1168df…` |
| W2 liveness | PASS | `w2-liveness.json` `fa7bd1c9…` |
| W3 formal start | Live `07:14:42.595Z` (`runStartSecond` `1792653282`); identity 0 differences (CLI `29.9.1`, Compose `5.6.0`, engine `29.9.1`, image `sha256:44fce696…`); **0 containers; 10 volumes** (the 7 protected FULL records identical + 2 prior anonymous volumes `a17056b8…` and `d5df35bd…` + a 10th non-owned anonymous volume `fe8dff0f445d4278a3434d40a3d7a3a955c5b37a437dee1f69168465751ff793` created `06:57:16Z`); built-in networks only; lanes fresh; port 8443 free; 0 problems. Per Lead decision `msg_1364abcfecfe` (`prep/51-full2-w3-baseline-decision.txt`), the exact-nine precondition deviation is disclosed and all 10 starting volume full records are protected for W4 comparison. | `w3-formal-start.json` `ee6a4afa6d2cbc295c99ca370d7adc6b1122fae79b04698fb8abf684fd6a45ee` |
| Sampler | 556 samples, 0 failed, one bridge Id (`9577478bf0a8…`), 0 skew (`maxSkewMs: 0`), `maxConcurrentComposeProjects: 1`. Other names seen (`otherProjectsSeen`): our storage lane's own oracle, fixture and volume-user containers (`/qa-multi-r1-st-qa-{oracle,fixture,volume-user}-*`) and one transient non-owned container `/sto-rmq-probe` (`rabbitmq:4.1-management`) at `07:32:01Z` during Round 1 `sim` (`prep/52-full2-foreign-activity.txt`; Lead `msg_45267fe96bd4`, `msg_c7816954a0a1`). | `sampler/lane-containers.json` `22f21c88116f4e1e9fcf436172ea667b6991bcf05a96dec9a12d5d10e55ed5ef` |
| W4 end | Capture PASS at `09:36:47.055Z`: identity 0 differences; 0 containers; 10 volumes (all 10 W3 volume full records identical); built-in networks only; our lanes fresh; port 8443 free; 0 problems. | `w4-end.json` `19e6add5d91074fcbc691a50e2ca691603e8da6d7f4a47bbdaffd3a1dc2e2383` |
| W4 strict compare | **PASS (exit 0)**: `problems: []`, `protectedIdenticalAtEnd: true`; all 10 W3 starting volume records identical at end, 0 containers, and bridge (`9577478bf0a8…`), host (`b9266a37c45a…`) and none (`d2863b51ad44…`) network Ids unchanged. | `w4-compare.json` `b25f6409cc9d9012c0465217dfc6e885c50ac1259cfcb1d9b1978795d5c16b87` |

### Round 1 (bound to exact folders; COMPLETE, 488/488 PASS)

Records (`<R>/full2-judge/`): `round-1-bind.json` `94f43eb9f2dfabca99d34ea09ef8b639fa0c20d8b68ad9b6d972e0a5cff0a3cc` (`ok: true`), `round-1-verify.json` `779172283201758638b746ed66cc16ea92715fc017ff11220e6621dbfd47a0bd` (`MET`), `round-1-set.txt` `bd25b776…` (`488 = 488`, 0 missing/extra/dup), `round-1-time.json` `bf89a4dd…` (`ok: true`). Accepted by Lead (`msg_953de777`).

| Phase | Folder (`<R>/full2-src/source/tests/host/artifacts/`) | Rows | Result | Time (UTC) | `m1-identity` / `m1-case-results` / `summary` / accounting (SHA-256 prefixes) |
| --- | --- | --- | --- | --- | --- |
| sim | `qa-multi-r1-bf09cdad-2026-10-22T07-14-45-647Z` | 394 | 394 PASS | 07:14:45.647Z–07:37:47.758Z | `056ff06a…` / `c9331e3a…` / `d37e6035…` / `635dd637…` |
| snapshot-isolated | `qa-multi-r1-bf09cdad-2026-10-22T07-37-53-810Z` | 6 | 6 PASS | 07:37:53.810Z–07:39:25.215Z | `91cfa06b…` / `43cbf82c…` / `dc89ce30…` / `a4a3dc10…` |
| snapshot-upgrade | `qa-multi-r1-bf09cdad-2026-10-22T07-39-29-485Z` | 6 | 6 PASS | 07:39:29.485Z–07:41:15.460Z | `65fbf848…` / `1857504f…` / `3f5c42b7…` / `16d91cae…` |
| migration | `qa-multi-r1-bf09cdad-2026-10-22T07-41-19-810Z` | 12 | 12 PASS | 07:41:19.810Z–07:45:07.000Z | `4d8ab55b…` / `4098d6ca…` / `942bc3a7…` / `16511ce6…` |
| storage | `qa-multi-r1-st-bf09cdad-2026-10-22T07-45-11-499Z` | 70 | 70 PASS | 07:45:11.499Z–08:06:21.854Z | `17ff1b13…` / `fd5dc4a7…` / `c7524e33…` / `1c8395f8…` |

- Core records of every Round 1 phase: `G1-IDENTITY`, `PRE` (0 other containers), `CLONE`, `H1`, `M3-ISOLATION` (0 changed) and `TEARDOWN` PASS (0 leftovers; ownership 0 errors, 0 kept, 0 failed; removed: sim 5, isolated 5, upgrade 5, migration 5, storage 4). Storage: 87 aggregate PASS, 92 scan points complete/clean (`storage-scans.json`). SIM clone: `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T07-14-45-647Z`.
- Round 1 `g-tamper` (`full2-judge/round-1-r5-tamper.json` `099458f0…` MET; raw logs `515..523` verified): own stop `515` exit 3, `opId` `c571f1bab04789752fc33f3f4a21caf5` (`swapped`); listing `516` holds `.previous-0f4863920a9206b791bfa3489f743882` (retained from `g-orphan-refusal`, sorting first) and `.previous-c571f1ba…`; plant `517` exited 0 targeting exact `.previous-c571f1ba…/lti.db` (`9fc24c38…` → `460bc4bd…`, other 21 entries unchanged); recover `520` exit 2 `storage_restore_unresolved` `"other bytes"`; both journals `rollback_failed` `opId` `c571f1ba…`; `523` exit 1 refusal naming `stack:data-quarantine`; all 17 dependents + 3 legacy fixtures executed and PASS.
- Round 1 R4 checks (`full2-judge/round-1-r4-checks.json` `fe9baf9d…` all 6 MET): `g-prepared-lti` own `opId` `307ec0426aa01311a1db8715a563721e`, `lti` `rolled_back`, `app` journal absent; `g-recover-idempotent` all 11 points exit 0; `g-orphan-stopped` `pgid` `91478`, own pause `244793cee8d2fa40c22f2b83748b9f79` (`swapped-lti`, distinct from `g-orphan-refusal` `0f486392…`); `e-import` both identities' `legacySources` match manifest (`a71f749b…` 122880, `873c12ad…` 315392); `e-kept` exit 0; `e-provenance-restore` pair `fb948896…` generation `1 -> 2`, provenance `restore`.

### Round 2 (bound to exact folders; COMPLETE, 488/488 PASS, R1 == R2)

Records (`<R>/full2-judge/`): `round-2-bind.json` `c1e555c73d0d11c89239869656dadd25c240f445ad09b323bc32ebbaf56ee4ee` (`ok: true`), `round-2-verify.json` `09b75cb6bbdd2ee89040b47b5ef51b7a5923a70f0ae8a60d217d910a9fbcf500` (`MET`), `round-2-set.txt` `bd25b776…` (`488 = 488`, 0 missing/extra/dup), `round-2-time.json` `653dfbf54739ae3cd99a57bab98a57c45549bc4cf16f3ff9f502ca1e6beada3c` (`ok: true`). Runner stdout: `Round 2: 488 rows; PASS 488; NOT_APPLICABLE 0 (reported apart, never a PASS).` and `c-host-negative in both rounds: PASS.` Per-case output `round-2-actual.tsv` equals `round-1-actual.tsv` byte-for-byte (`97e37fa13352492e73973fa5e1a096b88efb24fc2c823b9f4fa42750b316e9b9`). Accepted by Lead (`msg_bdb3feab05d2`); Canvas 233/488 round-2 judgment and two-round equality independently accepted (`msg_486a0d5f48c7`).

| Phase | Folder (`<R>/full2-src/source/tests/host/artifacts/`) | Rows | Result | Time (UTC) | `m1-identity` / `m1-case-results` / `summary` / accounting (SHA-256 prefixes) |
| --- | --- | --- | --- | --- | --- |
| sim | `qa-multi-r1-bf09cdad-2026-10-22T08-06-26-068Z` | 394 | 394 PASS | 08:06:26.068Z–08:29:15.922Z | `46ffa9ca…` / `9d13cd39…` / `65af03bd…` / `a80ad848…` |
| snapshot-isolated | `qa-multi-r1-bf09cdad-2026-10-22T08-29-22-193Z` | 6 | 6 PASS | 08:29:22.193Z–08:30:55.482Z | `1e7b3a0e…` / `6c1dbfec…` / `f1a4a851…` / `4c4c5085…` |
| snapshot-upgrade | `qa-multi-r1-bf09cdad-2026-10-22T08-30-59-740Z` | 6 | 6 PASS | 08:30:59.740Z–08:32:47.849Z | `45a5f2af…` / `ed0ab06d…` / `a7cf7ae6…` / `b881c1bc…` |
| migration | `qa-multi-r1-bf09cdad-2026-10-22T08-32-52-124Z` | 12 | 12 PASS | 08:32:52.124Z–08:36:40.031Z | `16be0d63…` / `4098d6ca…` / `c25515b5…` / `16511ce6…` |
| storage | `qa-multi-r1-st-bf09cdad-2026-10-22T08-36-44-622Z` | 70 | 70 PASS | 08:36:44.622Z–08:58:28.138Z | `b2cd6943…` / `b2a72031…` / `16dec837…` / `dd401f17…` |

- Core records of every Round 2 phase: `G1-IDENTITY`, `PRE` (0 other containers), `CLONE`, `H1`, `M3-ISOLATION` (0 changed) and `TEARDOWN` PASS (0 leftovers; ownership 0 errors, 0 kept, 0 failed; removed: sim 5, isolated 5, upgrade 5, migration 5, storage 4). Storage: 87 aggregate PASS, 92 scan points complete/clean (`storage-scans.json`). SIM clone: `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T08-06-26-068Z`.
- Round 2 `g-tamper` (`full2-judge/round-2-r5-tamper.json` `20a743f1d55464a963491485a09325604030e110c12bd88e1ab844d858debca6` MET; raw logs `515..523` verified): own stop `515` exit 3, `opId` `5573b0eb7ca02e98316bea7308675ad1` (`swapped`); listing `516` holds `.previous-5573b0eb…` and retained `g-orphan-refusal` generation `.previous-a6ee3753f30120e093b4bc2fc1519d10`; plant `517` exited 0 targeting exact `.previous-5573b0eb…/lti.db` (`3c2997d7…` → `3d30c0ea…`, other 21 entries unchanged); recover `520` exit 2 `storage_restore_unresolved` `"other bytes: /check/lti-service/.previous-5573b0eb7ca02e98316bea7308675ad1/lti.db"`; both journals `rollback_failed` `opId` `5573b0eb…`; `523` exit 1 refusal naming `stack:data-quarantine`; all 17 dependents + 3 legacy fixtures executed and PASS.
- Round 2 R4 checks (`full2-judge/round-2-r4-checks.json` `4ca571d535ffaeec4eda086265109cf266355db70176d19bb42f2e217851313c` all 6 MET): `g-prepared-lti` own `opId` `9e1d608269ad588f21d62985152cd0d4`, `lti` `rolled_back`, `app` journal absent; `g-recover-idempotent` all 11 points exit 0; `g-orphan-stopped` `pgid` `77887`, own pause `b878a24cb39788522e5948ed5f23af93` (`swapped-lti`, distinct from `g-orphan-refusal` `a6ee3753…`); `e-import` both identities' `legacySources` match manifest (`57566ace…` 122880, `3d565ac1…` 315392); `e-kept` exit 0; `e-provenance-restore` pair `debd4d73b296fe517ec7d56bf91da315` generation `1 -> 2`, provenance `restore`.

### Legacy execution (`--phase legacy`: 10 of 12 groups PASS; `T6` FAIL; `T8` not run)

Static per-case labels from `tools/legacy-labels.mjs` on `<R>/full2-src/source/tests/acceptance` (`full2-judge/legacy-static-labels.json` `62c3afb4b3c70db0d16a82792778fb84e46fa1e1013669debbc3ee252ac43f48`): 184 cases across the 12 suites (`MOODLE-LIVE`: 144, `SIM`: 40).

| Runner (`QA_M1_LEGACY_GUARD=1`) | Groups | Folder (`<R>/full2-src/source/tests/host/artifacts/`) | Time (UTC) & duration | Result | `summary` / `lane-ownership` |
| --- | --- | --- | --- | --- | --- |
| `run-t2.mjs --tasks T2a,T2b,T3a,T3b` | `T2a, T2b, T3a, T3b` (4) | `qa-multi-r1-bf09cdad-2026-10-22T08-58-32-433Z` | 08:58:32.433Z–09:06:53.409Z (8 min 21 s) | 67/67 aggregate PASS (`M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS; 30 records, 5 removed, 0 errors) | `b0a94b62…` / `c79fa832…` |
| `run-t3c.mjs` | `T3c` (+ `T3a` setup) (1) | `qa-multi-r1-bf09cdad-2026-10-22T09-06-53-467Z` | 09:06:53.467Z–09:08:49.825Z (1 min 56 s) | 31/31 aggregate PASS (`M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS; 20 records, 5 removed, 0 errors) | `f8ed4a65…` / `d461dc3f…` |
| `run-t4a.mjs` | `T4a` (1) | `qa-multi-r1-bf09cdad-2026-10-22T09-08-49-869Z` | 09:08:49.869Z–09:10:17.941Z (1 min 28 s) | 18/18 aggregate PASS (`M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS; 15 records, 5 removed, 0 errors) | `5394fc7f…` / `abd3698b…` |
| `run-t4b.mjs --tasks T4b1,T4b2` | `T4b1, T4b2` (2) | `qa-multi-r1-bf09cdad-2026-10-22T09-10-17-972Z` | 09:10:17.972Z–09:15:27.721Z (5 min 10 s) | 43/43 aggregate PASS (`M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS; 30 records, 5 removed, 0 errors) | `cb7faf1f…` / `ed8bbd6e…` |
| `run-t5.mjs --tasks T5a,T5b,T6` | `T5a, T5b, T6` (3) | `qa-multi-r1-bf09cdad-2026-10-22T09-15-27-778Z` | 09:15:27.778Z–09:36:39.074Z (21 min 11 s) | **FAIL in `T6`**: `T5a` 23/23 PASS, `knob-PLAY_TTL_SECONDS` 1/1 PASS, `T5b` 24/24 PASS, **`T6` 15 PASS / 3 FAIL (`AC-T6-07`, `AC-T6-13`, `AC-T6-09`)**; `M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS (36 records, 5 removed, 0 errors) | `2e390f26…` / `9a70ce7f…` |
| `run-t8.mjs` | `T8` (1) | — | — | **not run** (`run-t5.mjs` exited 1) | — |

### First cause: legacy `T6` `AC-T6-07`, `AC-T6-13`, `AC-T6-09` (facts only)

| Item | Facts |
| --- | --- |
| Failed runner & step | `run-t5.mjs --tasks T5a,T5b,T6` (`qa-multi-r1-bf09cdad-2026-10-22T09-15-27-778Z`, `summary.json` `2e390f2627160fabab7d1ac46722d9cfca815eddf3065684e577e20e49e161d2`). Step `T6` (`09:28:12.660Z`–`09:36:25.816Z`): `T6/playwright-results.json` (`94c4c1b7586c1f1a10b3a05403284d95d102a5b69a0d2f0e9a980425c39c3473`) and `T6/playwright.stdout.log` (`be6b16da406fd650cd261ef48b136544bb765985b6a4ccfa19b4c47272e3e9cb`) record 15 passed, 3 failed. Runner stderr: `run-m1.mjs:146` `Required child failed: tests/host/run-t5.mjs --sha ... --tasks T5a,T5b,T6` (`ERR_ASSERTION`, actual `1`, expected `0`). |
| Failed test 1: `AC-T6-07` | `tests/acceptance/T6/3-courses.spec.ts:129` (`AC-T6-07: Publish to Moodle dialog produces dynamic registration URL, 4 parameters, and copy actions`): `TimeoutError: locator.click: Timeout 15000ms exceeded` waiting for `getByRole('button', { name: /Publish to Moodle/ }).or(getByRole('link', { name: /Publish to Moodle/ })).first()` at `3-courses.spec.ts:135`. |
| Failed test 2: `AC-T6-13` | `tests/acceptance/T6/5-xss-a11y.spec.ts:44` (`AC-T6-13: Escape key closes open dialogs and returns focus to opener`): `TimeoutError: locator.click: Timeout 15000ms exceeded` waiting for `getByRole('button', { name: /Publish to Moodle/ }).or(getByRole('link', { name: /Publish to Moodle/ })).first()` at `5-xss-a11y.spec.ts:52`. |
| Failed test 3: `AC-T6-09` | `tests/acceptance/T6/5-xss-a11y.spec.ts:79` (`AC-T6-09: Every primary route passes axe-core WCAG 2.1 AA with zero serious/critical violations`): `TimeoutError: locator.click: Timeout 15000ms exceeded` waiting for `getByRole('button', { name: /Publish to Moodle/ }).or(getByRole('link', { name: /Publish to Moodle/ })).first()` at `5-xss-a11y.spec.ts:91` (with `expect(dialog, 'Publish to Moodle dialog must open before scanning').toBeVisible()` at line 97). |
| Rendered portal DOM (`error-context.md`) | The Playwright page snapshots in `T6/test-results/` show the course detail page rendered `link "Publish to an LMS"` (`href="/libraries/courses/<id>/publish"`). In C4 product code (`apps/portal/src/courses/CourseDetail.tsx:58` and `apps/portal/src/courses/PublishDialog.tsx:76`, implementing `docs/architecture/tasks/M2.md`), the course detail opener link and publish dialog heading were changed from `"Publish to Moodle"` to `"Publish to an LMS"`, whereas the legacy `T6` specs still assert `/Publish to Moodle/`. |

### Not run

Legacy group `T8` (`tests/host/run-t8.mjs`). Fresh M2 and T7 stay required under their separate owner and window.

### Privacy, cleanup and permissions

- Secret scan 0 problems (`secret-scan.json` `40e55695485b6fa3cee8cafd8b25a4d1afbedb5a04c06efb9e31d546eb222e10`; 22 clones; 3,357 captured and 166 stack values, 0 raw/public hits). Clone guard 0 problems (`clone-guard.json` `fdcf6c7ef0c700e83276ba0b738722accac57094eae8a778399a9b2251a0aaad`; 15 phase clones in `owned-clones.txt` `404d6980…` set to `0700` at 15 checkpoints, 12 captured-secret files set to `0600`; 11 older clones ignored as born before `--since`).
- Owned cleanup by the core teardown only (every Round 1, Round 2 and executed legacy phase `TEARDOWN` PASS, 0 lane resources left; ownership 0 errors, 0 kept, 0 failed in all 15 phases); W4 confirms 0 containers and all 10 starting volumes identical (`w4-compare.json` `b25f6409…`). No owned process remains (`prep/54-full2-postrun-process.txt`). Port 8443 has no listener. PID 64140 untouched.
- Modes: QA files `0600` and folders `0700` (`full2/` holds 15 folders at `0700` and 3,246 files at `0600`). Runner-written (`umask 022`): 10 accounting files in `full2/tmp/qa-m1-accounting-pld7ce/` at `0644` (2 handoff files and the launcher's copy in `full2/private/accounting/` are `0600`), 6 `qa-tree-*/index` files at `0644`, 2 `node-compile-cache` folders at `0755`, and the 15 phase artifact trees in `full2-src/source/tests/host/artifacts/` (4,145 files at `0644`, 200 folders at `0755`) inside the `0700` clone.

### Measured timings

Launcher `2 h 24 min 38 s` (`07:14:29Z`–`09:39:07Z`); W1–W3 `16 s`; runner `2 h 21 min 54 s` (`07:14:45Z`–`09:36:39Z`). Round 1 (`51 min 36 s`): `sim` `23 min 02 s`, `snapshot-isolated` `1 min 31 s`, `snapshot-upgrade` `1 min 46 s`, `migration` `3 min 47 s`, `storage` `21 min 10 s`. Round 2 (`52 min 02 s`): `sim` `22 min 50 s`, `snapshot-isolated` `1 min 33 s`, `snapshot-upgrade` `1 min 48 s`, `migration` `3 min 48 s`, `storage` `21 min 44 s`. Legacy `T2a..T6` (`38 min 07 s`): `run-t2.mjs` (`T2a, T2b, T3a, T3b`) `8 min 21 s`, `run-t3c.mjs` `1 min 56 s`, `run-t4a.mjs` `1 min 28 s`, `run-t4b.mjs` (`T4b1, T4b2`) `5 min 10 s`, `run-t5.mjs` (`T5a, T5b, T6`) `21 min 11 s`; `run-t8.mjs` (`T8`) not run. W4 end capture, clone guard, strict compare and secret scan `2 min 28 s`.

### Evidence

- Evidence index v4 (outside the indexed set): `<R>/evidence-index-v4.tsv`, 16,271 entries (`diag/`, `diag2/`, `full/`, `full-judge/`, `full2/`, `full2-judge/`, `prep/`, `tools/`, `report/`, and all phase artifact folders of the four source clones) with SHA-256, size and mode; SHA-256 `6f86f62e2418a996ec51afdcc99315c5a9af75baa960c65e25496a57ebe3f88c`. All 8,810 index-v3 entries are unchanged inside v4. Root files: `<R>/evidence-index-v4-root-files.tsv` (`922847329761bc0781fe0a576af52432b71d73999abf12634582b0ec511c0560`, 27 entries). Bindings: `report/bindings-v4.tsv`.
- Messages: grant `msg_6218a54231e9`; W3 10-volume baseline decision `msg_1364abcfecfe`; foreign activity disclosure `msg_45267fe96bd4` / `msg_c7816954a0a1`; model continuation grant `msg_e2be5a76f4a4`; Round 1 closure `msg_036741e59eb5` (accepted `msg_953de777`); Round 2 closure `msg_a7b7d79497f4` (accepted `msg_bdb3feab05d2`; Canvas peer two-round acceptance `msg_486a0d5f48c7`); report checkpoint grant `msg_4737e898d10a`; legacy timing checkpoint `msg_8492d7ff987a` (accepted `msg_09460f19d891`); first-failure and window return notice `msg_ca0849c1157c`.

### Next

Remediation owner `ctx_131c9c349fd8` and the Lead decide the repair and next verification scope for `T6` (`AC-T6-07`, `AC-T6-13`, `AC-T6-09`) and unrun `T8`. Fresh M2 and T7 stay required under their separate owner and window. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`. No certification or production claim.


## Bounded D-T6L legacy run at product C4 `bf09cda` / tests C5 `e1a057b` (tree `9e57d42`): FAIL in `T5b` (`AC-T5-36`) and `T6` (`AC-T6-07`); `T2a..T5a` (9 of 12 groups) PASS; `AC-T6-13` and `AC-T6-09` PASS; `T8` not run; D-T6L void for further acceptance; W4 32-volume strict compare PASS, 2026-10-22

Verdict for this attempt: **FAIL**. Under the Lead's written D-T6L exception (`docs/team/t6-label-repair-2026-10-22.md`) and Stage 2 runtime grant (`msg_d21ecaf2c08f`, `msg_7def15bf371c`), Common QA (`task_a33056140130` / `ctx_574663dd5b1a`, Antigravity Gemini 4 Argon High) executed `--phase legacy` once against product C4 `bf09cdad91ca548e1ecbc14428b55180d35d5360` with test commit C5 `e1a057be9624a82949007b772e2bdf19bc55638b` (tests tree `9e57d42f9e4cfe82b8058681ba6a81396abd2acc`). Nine of the 12 legacy groups closed PASS (`T2a, T2b, T3a, T3b` 67/67, `T3c` 31/31, `T4a` 18/18, `T4b1, T4b2` 43/43, and `T5a` + `knob-PLAY_TTL_SECONDS` 23/23). In `run-t5.mjs --tasks T5a,T5b,T6`, group `T5b` failed 1 of 24 Playwright cases (`AC-T5-36` at `T5b/1-html.spec.ts:52`, error at `:62:42`: `Moodle grade` expected `100`, received `null`; 23 passed), and group `T6` passed 17 of 18 Playwright cases (including `AC-T6-13` in `1,493 ms` and `AC-T6-09` in `4,414 ms`) and failed 1 case (`AC-T6-07` at `T6/3-courses.spec.ts:125`, error at `:133:57`: `dialog.innerText()` read while `"Loading…"` was rendered before `GET /app-api/connections` populated the connection options). Because `run-t5.mjs` exited `1` after its `M3-LEGACY-DEFAULT`, `M3-ISOLATION` and `TEARDOWN` checks passed, `run-t8.mjs` (`T8`) did **not run**, no independent Canvas QA `T6`/`T8` acceptance occurred, and per D-T6L condition 7 the D-T6L exception is **void for further acceptance**. Earlier `full2` evidence (`<R>/evidence-index-v4.tsv` `6f86f62e…`) remains FAILED at product C4 / tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`.

### Sourced correction to historical `full2` `T6` quotations (`docs/reviews/M1/qa.md:2863-2866`)

The historical `full2` section above is preserved unchanged. In `<R>/full2-src/source/tests/host/artifacts/qa-multi-r1-bf09cdad-2026-10-22T09-15-27-778Z/` (`<R>` = `/Users/quangnguyen/cogniate-qa-runs/qa-common-c4-20261022T0408Z`), the exact artifact paths, SHA-256 hashes, spec titles, spec definition lines and error locations in `container-T6/playwright-results.json` (`c2abdf30a532aafe471f4fc9c112e79e97c7041793f8d00896ad952d2c81f4c5`; command log `cmd/30-test-acceptance-T6.log` `7a1a3d864241a3bf8c21aa80326929a9d3dc6feffe62e0f5d1dd81aec0957e1e`; runner `summary.json` `2e390f2627160fab33e95a7df8e41e7f75a60666dff276a9b284084a097e4f3d`) are:

- `AC-T6-07`: spec at `T6/3-courses.spec.ts:125:7` (`AC-T6-07 the Publish dialog lists only registered or connected connections; after "Publish": "Available in Moodle" and the teacher text`), error at `/repo/tests/acceptance/T6/3-courses.spec.ts:129:133` waiting 15,000 ms for `getByRole('button', { name: /Publish to Moodle/ }).or(getByRole('link', { name: /Publish to Moodle/ })).first()`.
- `AC-T6-13`: spec at `T6/5-xss-a11y.spec.ts:26:5` (``AC-T6-13 `<b>x</b>` and the manifest title show literally in Courses, Publish and Results; window.__xss stays undefined``), error at `/repo/tests/acceptance/T6/5-xss-a11y.spec.ts:44:131` on the same locator.
- `AC-T6-09`: spec at `T6/5-xss-a11y.spec.ts:54:5` (`AC-T6-09 axe: no serious or critical violation on Integrations, wizard, Courses, Publish dialog, Results; wizard and dialog work by keyboard; focus returns to the opener`), error at `/repo/tests/acceptance/T6/5-xss-a11y.spec.ts:79:131` on the same locator (with `await expect(opener, 'focus is back on "Publish to Moodle"').toBeFocused()` at line 97).

### Preparation, reviews, grant and boundary (`<M>` = `/Users/quangnguyen/cogniate-qa-runs/qa-common-c5-maint-20261022T1010Z`)

| Item | Value |
| --- | --- |
| Product & test commits | Product C4 `bf09cdad91ca548e1ecbc14428b55180d35d5360` (C4 tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4`); test commit C5 `e1a057be9624a82949007b772e2bdf19bc55638b` (C5 tests tree `9e57d42f9e4cfe82b8058681ba6a81396abd2acc`). C4→C5 `tests` diff (`<M>/patch/05-git-diff.patch` `da9d096b0c311db7d05332da2f55304306ce9c995814b23d5159d8d62d5efde6`, 13 literal changes on 8 lines across 3 files): `T6/3-courses.spec.ts` `bef3bce4c7b8f0f0a4b2683a8c0ad8053372fc0953857a1d14d12424a8ab97d2`, `T6/5-xss-a11y.spec.ts` `d28884e120eea572bfdeead17f0bd7783921cfca1ea53b655b73c1bfe84f3b0b`, `T8/2-shell.spec.ts` `7222871877967f9380fef79b044821ca2caa80bf5e0e886ac808da9ba696b743`. Host typecheck (`<M>/patch/10-typecheck.txt` `5c2ed944042e280f685a3ca66024e162e4911d3a41bfaa92d914231173b3a805`, 70 bytes): ran at `2026-10-22T10:13:08Z` via `npm --offline --no-audit --no-fund --prefix tests run typecheck` (`tsc -p tsconfig.json --noEmit`) against C5 tests tree `9e57d42f…`, exiting `0` with `0` diagnostics. |
| Source & launcher v2 | Source `<M>/legacy-c5-src/source` (detached `--no-hardlinks` clone at C5 `e1a057be…`, mode `0700`, push disabled; `tests/node_modules` manifest `452a27f9…` and modes `f2c452dd…`). Pre-run (`preflight-v2/05-tests-inventory-c5-preflight.txt` `77600cf8…` at `11:50:10.093Z`) and post-run (`preflight-v2/15-postrun-tests-inventory-c5.txt` `76dd9df4…` at `12:32:42.317Z`) bracket the run: 250/250 `tests` and 42/42 `tests/host` files match C5 blobs, 0 mismatches/missing/extra. Launcher `<M>/tools/launch-legacy-c5-v2.sh` `c53203a2b16e2c47298fea0a6b1c466840689e2ba5352b27f5037937e596ed67` (10,091 bytes, mode `0700`; v1→v2 diff `prep-v2/01-v1-to-v2-diff.patch` `8b09df21…`, focused guard checks `prep-v2/04-focused-guard-checks.txt` `438a6f5b…` recorded at `2026-10-22T11:13:35.588Z`–`11:13:35.680Z`, readiness `prep-v2/READY-C5-LEGACY-V2.md` `5502c5aa…`). Inherited filenames `private/full-run.stdout.log`, `private/full-run.stderr.log` and `public/full-run-exit.json` are kept for `progress.sh` compatibility and record only this `--phase legacy` invocation. |
| Blind reviews & grant | Reviewer-A Round 2 `APPROVE` (`msg_b534cb2b735b`, commit `7f05e1c`, `docs/reviews/M3/reviewer-a-t6-labels.md` `cacc4e82…`) and Reviewer-B Round 2 `APPROVE` (`msg_6108e329152c`, commit `90016bd`, `docs/reviews/M3/reviewer-b-t6-labels.md` `72efcba7…`), accepted by Lead (`msg_d890256d86b8`). Stage 2 grant `msg_d21ecaf2c08f` (`11:48Z`–`13:50Z`) and 32-volume baseline decision `msg_7def15bf371c`; window returned at `12:35Z` (`msg_68336fc1a30f`, accepted `msg_660493066908`). |
| Pre-wake preflight & formal W1–W4 (`<M>/legacy-c5/public/`) | Pre-wake read-only capture (`preflight-v2/02` `edf1dd3d…`, `03` `a2ed0e00…`, clarification `07` `75500539fb1d6c9a71fa7026fcd5a9ca4d819f8161ed80ec21f13925235b74b8`): pre-wake idle-VM `liveness.ok = false` (`104,875 ms` skew before W1 wake), 0 containers, bridge Id `efee1103…`, all 10 `full2` W4 volume full records byte-identical, plus 22 additional pre-existing anonymous volumes (`10:08:59Z`–`11:38:17Z`, without attributing ownership from timestamps alone) for 32 volumes total. Formal launch at `11:53:33.000Z` (`PID = PGID 23517`; runner `PID 26547` under `umask 022`, `command.txt` `978ebd82…`; observers sampler `26540`, watch `26541`, guard `26542`): ancestor check `a87c9aea…` PASS; W1 wake `7e9b0e0d…` (`0` problems, `0` left); W2 liveness `5b399706…` (`ok: true`); W3 formal start `3a949d5447be62e8d81a78e1f70fabb25b18edee3d85d2b7caf8377013583982` at `11:53:49.265Z` (`runStartSecond` `1792670026`, `0` problems, `0` containers, bridge `1d5fd80a80b1…`, `32` volumes: 7/7 original baseline, 10/10 `full2` W4 `19e6add5…`, and 32/32 preflight records identical; `preflight-v2/08-formal-w3-32vol-verify.json` `d92753d0…`, accepted `msg_ae1fc1bf0423`). W4 end `5d2c4b5f19a2ae005bbb94223efa5b0e698b33ae59017a35ce66df505f91e232` at `12:30:13.769Z` and W4 strict compare `75e4050ff7e12c9cc9fe617e4809043847eaab051aff687e6f78a3d71b9eb013`: **PASS (`exit 0`, `problems: []`, `protectedIdenticalAtEnd: true`)**, 0 containers, all 32 W3 starting volume records and all 10 `full2` W4 records byte-identical at end (`preflight-v2/17-w4-32vol-verify.json` `96c6559d…`), built-in network Ids unchanged. |
| Sampler, scans, cleanup & modes | Sampler `sampler/lane-containers.json` `92f7994d47909bc8bcaea3f7d3bb358055a00ffa6dac6b9d6c963a7b436f7cb8`: 144 samples, 0 failed, `otherProjectsSeen: []`, `maxConcurrentComposeProjects: 1`, `maxSkewMs: 0`, one bridge Id (`1d5fd80a80b1…`). Clone guard `clone-guard.json` `70a1c547d22164484d288a519eaa1b71de812f319996c59033771c6ab6b3756e`: 0 problems (5 phase clones in `owned-clones.txt` `a1d9ba23…` set to `0700` at 5 checkpoints, 4 captured-secret files set to `0600`; 26 older clones ignored). Secret scan `secret-scan.json` `86ae5a9ab307d5887ee5b63882f6a8b638324dfd058cb7fbb2c70da4d067c6af`: 0 problems (425 captured and 60 stack values, 0 raw/public hits; private browser traces/screenshots remain inside `0700` phase clones). Post-run (`preflight-v2/16-postrun-process-port.txt` `db501086…`): 0 owned QA or Docker/Compose processes, port 8443 free, PID 64140 untouched. Modes: `<M>/legacy-c5` holds 7 dirs at `0700`, 1,460 files at `0600`, and 2 runner-written (`umask 022`) `node-compile-cache` dirs at `0755`; `<M>/legacy-c5-src/source/tests/host/artifacts/` holds 64 dirs at `0755` and 399 files at `0644` inside the `0700` clone. |

### Per-child legacy execution (product C4 `bf09cda` / tests C5 `e1a057b`, tree `9e57d42`)

Every executed child below verified clone `HEAD` = C4 `bf09cdad91ca548e1ecbc14428b55180d35d5360` and `tests-diff-vs-sha.txt` SHA-256 `8b318ba58771e581dfea8a4b9b9ab08f35ca54a874c57861701a8af6f76d8f9c` (lines 1..70 byte-identical to `<M>/patch/05-git-diff.patch` `da9d096b0c311db7d05332da2f55304306ce9c995814b23d5159d8d62d5efde6` + 3-line footer `# New files (not in the SHA, copied as they are): # none`).

| Runner (`QA_M1_LEGACY_GUARD=1`) | Groups | Folder (`<M>/legacy-c5-src/source/tests/host/artifacts/`) | Time (UTC) & duration | Result | `summary` / `lane-ownership` |
| --- | --- | --- | --- | --- | --- |
| `run-t2.mjs --tasks T2a,T2b,T3a,T3b` | `T2a, T2b, T3a, T3b` (4) | `qa-multi-r1-bf09cdad-2026-10-22T11-53-49-686Z` | 11:53:49.686Z–12:02:09.512Z (8 min 20 s) | 67/67 aggregate PASS (`M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS; 30 records, 5 removed, 0 errors) | `52b3b18f…` / `843380c7…` |
| `run-t3c.mjs` | `T3c` (+ `T3a` setup) (1) | `qa-multi-r1-bf09cdad-2026-10-22T12-02-09-558Z` | 12:02:09.558Z–12:03:58.250Z (1 min 49 s) | 31/31 aggregate PASS (`M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS; 20 records, 5 removed, 0 errors) | `b1179197…` / `d136083d…` |
| `run-t4a.mjs` | `T4a` (1) | `qa-multi-r1-bf09cdad-2026-10-22T12-03-58-295Z` | 12:03:58.295Z–12:05:24.480Z (1 min 26 s) | 18/18 aggregate PASS (`M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS; 15 records, 5 removed, 0 errors) | `f6fa84d8…` / `4ea74154…` |
| `run-t4b.mjs --tasks T4b1,T4b2` | `T4b1, T4b2` (2) | `qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z` | 12:05:24.521Z–12:10:26.090Z (5 min 02 s) | 43/43 aggregate PASS (`M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS; 30 records, 5 removed, 0 errors) | `33f9f1f5…` / `5b0f018b…` |
| `run-t5.mjs --tasks T5a,T5b,T6` | `T5a, T5b, T6` (3) | `qa-multi-r1-bf09cdad-2026-10-22T12-10-26-133Z` | 12:10:26.133Z–12:30:05.000Z (19 min 39 s) | **FAIL (`63 PASS, 3 FAIL`: `SUITE`, `AC-T5-36`, `AC-T6-07`)**: `T5a` 22/22 + `knob-PLAY_TTL_SECONDS` 1/1 (`23/23` PASS, `d821d608…`, `d6e342a3…`); **`T5b` 23 PASS / 1 FAIL (`AC-T5-36`, `cbe8b10d…`)**; **`T6` 17 PASS (`AC-T6-13` and `AC-T6-09` PASS) / 1 FAIL (`AC-T6-07`, `351feb88…`)**; `M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` PASS (36 records, 5 removed, 0 errors) | `5e95a12f…` / `12921c21…` |
| `run-t8.mjs` | `T8` (1) | — | — | **not run** (`run-t5.mjs` exited 1) | — |

### Failure facts (`qa-multi-r1-bf09cdad-2026-10-22T12-10-26-133Z`, `<M>/preflight-v2/18-closeout-facts.json`)

| Failure | Structured evidence & service-log facts (no speculation) |
| --- | --- |
| 1. `T5b` `AC-T5-36` (`T5b/1-html.spec.ts:52`, error at `:62:42`) | `container-T5b/playwright-results.json` (`cbe8b10d6beda73f9ff82c5d12ba507ced8efcc922038d4e6a6cc601856f41a8`; `vitest-results.json` `5628c6cd…`; `cmd/28-test-acceptance-T5b.log` `f48333d0…`): spec `"AC-T5-36 hanging hosts: every non-*.test request hangs; cg_student completes the HTML course → passed and 100 in Moodle within 60 s"` (`startTime` `2026-10-22T12:15:37.482Z`, `duration` `72,495 ms`) failed at `/repo/tests/acceptance/T5b/1-html.spec.ts:62:42`: `expect(moodle.grade, 'Moodle grade').toBe(100)` (`Expected: 100`, `Received: null`). In `container-T5b/service-logs/`: `lti-service.jsonl` (`2aa4d892…`) logs `launch_accepted` at `12:15:38.162Z` and `GET /api/idtoken` `200` at `12:15:38.168Z`, with no `POST /api/lineitems/.../scores` between `12:15:38Z` and `12:16:51Z`; `cogniate-app.jsonl` (`a713221a…`) logs `launch_accepted` at `12:15:38.170Z` (`attempt_id` `att_CslmWvbi0ZUeJ1_ofsb4qQ`, `preview: false`), `GET /play/:playId` `200` at `12:15:38.173Z`, and `GET /app-api/play/:playId/status` `200` every 5 s through `12:16:48.199Z`, with no `score_sync` event; `cogniate-content.jsonl` (`564f0509…`) logs `GET /rt/:token` `200` at `12:15:38.184Z`, `GET /rt/:token/state` `200` at `12:15:38.208Z`, `GET /pkg/:packageId/*` `200` at `12:15:38.262Z..12:15:38.397Z`, `commit_accepted` `session_id` `ses_Wfu2uwydDgYbc7q9ZR2g8g` `seq: 1` (`commit_event: "progress"`) at `12:15:38.704Z` and `seq: 2` (`commit_event: "progress"`) at `12:15:48.572Z`, and no `seq: 3` commit for that session. |
| 2. `T6` `AC-T6-07` (`T6/3-courses.spec.ts:125`, error at `:133:57`) | `container-T6/playwright-results.json` (`351feb88cfaebd26100fe22e694e7d5cfb1735ae35fa1026491aad302cbf020d`; `vitest-results.json` `e54eaa58…`; `cmd/30-test-acceptance-T6.log` `d97668f2…`): 17 of 18 cases passed (including `AC-T6-13` at `T6/5-xss-a11y.spec.ts:26` in `1,493 ms` and `AC-T6-09` at `T6/5-xss-a11y.spec.ts:54` in `4,414 ms`). `AC-T6-07` (`startTime` `2026-10-22T12:29:39.548Z`, `duration` `134 ms`) clicked `/Publish to an LMS/` at line 129, passed `expect(dialog).toBeVisible()` at line 131, and failed at `/repo/tests/acceptance/T6/3-courses.spec.ts:133:57` (`expect(text, 'the registered/connected connection').toContain('Dev Moodle')`) with `Received string: "Publish to an LMS Make this course available in the LMS content picker. QA UI SCORM mvjipofl Loading… LMS connection Choose a connection Version Version 1 · SCORM 1.2 Package: Build Your First Website with AI: The Zero-to-Hero Micro-Sprint Publish Cancel"`. In `container-T6/service-logs/cogniate-app.jsonl` (`24f45443…`), `GET /libraries/courses/:courseId` `200` is logged at `12:29:39.557Z`, `GET /app-api/courses/:courseId` `200` at `12:29:39.584Z`, `GET /app-api/publications` `200` at `12:29:39.592Z`, and `GET /app-api/connections` `200` at `12:29:39.632Z` (`trace_id` `1b202a01e8f5b1fd525bc6b46cd2f331`). |

### Evidence and next steps

- Maintenance evidence indexes (`<M>` = `/Users/quangnguyen/cogniate-qa-runs/qa-common-c5-maint-20261022T1010Z`): `<M>/evidence-index-maint-v1.tsv` (`c95ce099946b2ed76fc0e469ae6b79f672f8538f69dcc41e3b652987b7f3ea3b`, 57 entries), `<M>/evidence-index-maint-v2.tsv` (`d648480b3cef4b55f9722b48e9505865481eef4dd61a9a330f4e08af34455f36`, 64 entries), `<M>/evidence-index-maint-v3.tsv` (`15be627749025dfba48c83755f775f6dad1f121740e1672fdbeb9d506bb4f327`, 297,805 bytes, 1,944 entries; all 57 v1 and 64 v2 entries retained unchanged), and `<M>/evidence-index-maint-v3-root-files.tsv` (`697a2aa7260d835e83376c4e851a69d57b08445ba05280a25eb54d021e30f0f1`, 6 entries).
- Messages: Stage 1 receipt `msg_8a731861cb0f` (accepted `msg_7378cbcdee9e`); source review acceptance `msg_d890256d86b8`; read-only preflight grant `msg_f14a07b0c70c` and report `msg_512cfc23db28`; Stage 2 grant `msg_d21ecaf2c08f` and 32-volume decision `msg_7def15bf371c`; launcher gate `msg_6153105980a4` and W3 confirmation `msg_185dbde17063` (accepted `msg_ae1fc1bf0423`); checkpoints `msg_990ed8145718`, `msg_528e7b99a8e9`, `msg_fddcb78b29f6`, `msg_c54030c6b54c` (`msg_c5b45a2d338b`); first-failure notice `msg_4cd73ea5bffb` (accepted `msg_b047500bf5b5`); window return `msg_68336fc1a30f` (accepted `msg_660493066908`).
- Next: D-T6L is void for further acceptance. Claude planner `ctx_072d87e1a0d9` and the retained Codex executor own the consolidated failure diagnosis and recovery plan under the Lead; any next verification requires a new Lead grant. Fresh M2 and T7 stay required under their separate owner and window. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`. No certification or production claim.

## Closed C6/C8 legacy run (`V4/legacy-c6`): functional PASS (12/12 groups, 304 raw / 251 per-subrun unique IDs); exclusive-host condition FAIL (window NOT exclusive); route E-R3 VOID; P1 PROPOSED, 2026-10-22

Pointer to `docs/reviews/M3/qa.md` (section `"Closed C6/C8 legacy run (V4/legacy-c6)"`), `docs/team/runtime-isolation-2026-10-22.md` (`3,295` B `ba3bfd8e…`), and `docs/reviews/M3/t6-09-failure-plan.md` §10 (`30,770` B `c7fd7da8…`):

- **Disposition:** **Functional PASS** (`exit 0`, `12/12` groups, `304/304` raw, **`251/251` sum of per-subrun unique IDs** = `67+31+18+43+66+26`, correcting `258/258` in `REPORT-LEGACY-C6-C8-PASS.md`; `AC-T5-36` `12,435 ms`, `AC-T6-07` `420 ms`, `AC-T6-09` `4,685 ms` PASS, `0` retries); **`AC-M3-06` endpoint compare PASS** (`w4-compare.json` `8e43950f…` `exit 0`, `32` volume and `3` network records identical at W3 `e1dd3dba…` and W4 `26751ef2…`, `0` containers, port `8443` free) and **`AC-M3-07` secret scan PASS** (`9f511af1…` / `70aafc77…` `exit 0`); **exclusive-host condition FAIL** (window **NOT exclusive** due to Savoy Docker activity `17:20:16Z`–`17:22:57Z` in `msg_be9de4c8842a`); **route `E-R3` VOID**. Local `docker events` empty/timeout observation establishes no general Engine `29.9.1` retention policy.
- **Bundle & derived revision (`<V4>`, `msg_31d5061fa47d`):** 72 non-derived entries unchanged; initial/frozen bindings `evidence-index-legacy-c6.tsv` `10,452` B `7b7f63eb…`, `CLOSURE-LEDGER-LEGACY-C6-C8.json` `28,955` B `12791f35…`, `REPORT-LEGACY-C6-C8-PASS.md` `7,900` B `ee2ba4db…` (intermediate derived revision `66f6f84b…` / `2c6dc310…` / `bb8a05c6…`). Architect **P1 is PROPOSED** pending written confirmations and Lead decision. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.

## C6/C8 Canvas SIM Round 1 (`V4/canvas-sim-c6-r1`, route E-R5): 258/258 functional SIM rows PASS (26 common + 232 Canvas); W4 strict compare & secret scan PASS; window NOT exclusive, 2026-10-22

Pointer to `docs/reviews/M3/qa.md` (section `"C6/C8 Canvas SIM Round 1 (V4/canvas-sim-c6-r1, route E-R5)"`) and `docs/team/r5-evidence-decision-2026-10-22.md` (`f3b9b06c…`):

- **Result & scope (`qa-multi-r1-4008afb9-2026-10-22T18-54-44-439Z`, gate `msg_a4de323a84f4`):** `exit 0`, `264/264` `summary.json` (`78,544` B `c04098da…`) PASS = `6` gate rows + **`258/258` functional SIM rows PASS** (`251` non-browser = `250` Vitest `babcf33a…` + `1` host `M1-02.common.default-profile`, plus `7` Playwright browser `9228d4ea…` = `26` common + `232` Canvas in `m1-case-results.json` `144,679` B `a9060c35…`, `0` failures, `0` retries, `0` skips; not a fresh 488-row run or 233-row judgment). **Window NOT exclusive:** Savoy overlap `19:01:14Z`–`19:01:33Z` (`sto-go-1792695689-77379`, `sto-it-0680bf005a3e`, `msg_7e91e0e4cdd0`) inside conservative `W1`–`W4` `18:52:27.803Z`–`19:11:33.353Z` (formal `W1`–`W4` `18:54:28.404Z`–`19:11:33.353Z`).
- **Boundaries, scans & manifest (`<V4>`):** Disclosed pre-`W3` VM wake replaced bridge `5c871666dd9e…` with `59e09c4120ec…` (`msg_d69d5f48cf41`). Formal `W3` (`73defb33…`) to `W4` (`5af7a192…`) strict compare (`a826a288…`): `exit 0`, all `32` volume records equal `legacy-c6` `W4` (`26751ef2…`), `0` containers, `0` owned processes, port `8443` free; sampler (`76208a97…`, `65` samples, `otherProjectsSeen: []`, `maxSkewMs: 0`), clone guard (`63369bd8…`) and secret scan (`0ef6f89b…` / `a3fc8e30…`) `0` problems. Manifest `<V4>/evidence-index-canvas-sim-c6-r1.tsv` (`67` entries, `9,465` B `4626b76287976982384df48149660693da8720f7f73a19832f1a11b117e49620`), ledger `39d1efd2…` (`24,565` B), report `a0eb1e37…` (`7,303` B). Handed to `ctx_806443ba13cd` for 232-row judgment + §11.6 reconciliation. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.

### C6/C8 Canvas SIM Round 2 (`V4/canvas-sim-c6-r2`) — FAIL (`M1-37.canvas.s-dead`; `E-R5` Invalidated)

- **Run & Phase Roots:** `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v4-20261022T1554Z/canvas-sim-c6-r2` (`PID/PGID 82797`, observers `871`/`872`/`873`); phase artifacts `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v4-20261022T1554Z/c8-clean-src/source/tests/host/artifacts/qa-multi-r1-4008afb9-2026-10-22T19-23-57-487Z`; phase clone `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-4008afb9-2026-10-22T19-23-57-487Z` (`0700`).
- **Outcome & Failed Case:** Runner `exit = 1` (`19:23:57.000Z–19:38:16.000Z`); `summary.json` (`79,626` B, SHA-256 `e5fc12fcaa5edd0dfa096d546bd228a94bd3bd1e2620cfc206b4ab56f29d2259`) and `m1-case-results.json` (`144,638` B, SHA-256 `4839d633cb8f39218f50df30b0e65f1c3041798e731414b28946be46ac497db1`) record `257/258` functional SIM rows `PASS` (`26/26` common `PASS`, `231/232` Canvas `PASS`, `7/7` Playwright browser `PASS` in `playwright-results.json` `13,861` B `b051f201291c0e0a1574796258173824cfbd3e1f55bb646ac2797d6a3bcb01be`) and `1/258` FAIL: `M1-37.canvas.s-dead` (`tests/acceptance/M1/canvas/51-canvas-races.test.ts:303:3`, `Expected HTTP 409; actual 200, code none`, `m1-vitest-results.json` `94,027` B `eb76dfb2bd00b386807b92bb64edc5da5953042051d2c22b1f59ce9e1a8384f9`, `M1-37.canvas.s-dead.json` `126,126` B `c3e14462e41af42e0e75a45606b3911b9a68cec808c49d4b6a8424510b9c75dc`).
- **Root-Cause Trace (`service-logs/cogniate-app.jsonl` `742,608` B `f434ec12060082fa2e3ef772f4cf4c7036d25a27d29487977276531ab1e2ca20`):** First attempt `c97f63633ca8165f535f874f61aec03c` started at `19:34:23.188Z`, S2 `POST` completed at `19:34:23.240Z`, `SIGTERM` from `stack:restart cogniate-app` arrived at `19:34:27.024Z`, and during `closeOnSignal`'s 2,000 ms drain window (`packages/shared/src/http.ts:48-56`), the held S3 `PATCH` timed out at `19:34:28.246Z` (`5,086 ms`), invoking `fail()` (`services/cogniate-app/src/app/redemption.ts:172-177`) which cleared the 60s lease before container exit; the post-restart retry at `19:34:34.833Z` therefore returned `200` (`19:34:34.859Z`) instead of `409 GRANT_IN_USE`.
- **Boundaries & Manifest:** Conservative window `19:21:20.320Z–19:38:24.055Z`, formal window `19:23:42.662Z–19:38:24.055Z`; `W3` `def74e25...` (`19,939` B), `W4` `1b3cc7bf...` (`19,930` B, all 32 full volume records unchanged, `0` containers, `3` built-in networks), `w4-compare.json` `b18a73bf...` (`problems = []`), `secret-scan.json` `1fd48642...` (`0` hits, `problems = []`), `V4/evidence-index-canvas-sim-c6-r2.tsv` (`68` entries, `9,667` B, SHA-256 `4f6e27a14fe9c933d3b7970120e1c963868325baa612124716248c258a536522`). Under `E-R5`, this fresh functional failure invalidates `E-R5` acceptance. All 32 real-LMS rows remain `UNVERIFIED`; local Canvas remains `DEFERRED`.


## Stage A + Stage B Host-Only `AC-M1-37` Dead-Handler Test Repair (`C9`) and `v5` SIM Launcher Preparation (`V5`, Runtime `NOT RUN`), 2026-10-23

- **Scope & Identity (`task_4acf2acaf2b9` / `ctx_b34c29c515f2`, `docs/reviews/M3/t6-09-failure-plan.md` §12 `511622702555c16bfea08510b2f92e91478e4361`):** Repaired the 7 `AC-M1-37` dead-handler test sites (`M1-37.canvas.d`, `M1-37.canvas.s-dead`, `M1-37.canvas.v4`, `M1-37.canvas.v6`, `M1-37.blackboard.d`, `M1-37.blackboard.o`, `M1-37.blackboard.v5`) across the exact 6 paths committed by Lead as `C9 = 9eb504f5bff4be7e291570fde12fdf9919a07fa1` (`tests` tree `667e83a9a6a0187d742eb68a17293e4b7302100f`, product `C6 = 4008afb92fe983d52db33442e060210b929966c8` unchanged):
  1. `tests/host/m1-control.mjs` (`6,722` B, SHA-256 `bba281f63050311e8aad72665770033a74d6344d888349e73fa8d3bb9c552a7b`, pure `+21 / -0` insertion for `action === 'm1-restart' && 'mode' in req`, running `docker compose -f infra/compose.yaml --env-file .env kill -s SIGKILL cogniate-app` then `npm run stack:restart -- cogniate-app` on `kill.code === 0`, prefixing stdout with `kill: exit <code>, <start ISO>–<end ISO>`).
  2. `tests/host/m1-control.selftest.mjs` (`24,574` B, SHA-256 `6e2791ca3995d6bee31dca6565c1e9ac32f9b13a4feb8749b65be0c5070eaddb`, `+94 / -0` append covering kill-then-restart sequence, failed-kill refusal, service/mode refusal, compat-marker refusal, and non-`qa-` refusal).
  3. `tests/acceptance/M1/canvas/51-canvas-races.test.ts` (`24,706` B, SHA-256 `60dd41d016661ffe6a05358dbab5eba616f0e7e8d3a7aae4a191284031ce7c25`, Helper K `killApp()` + Guard G in `d` and `s-dead`).
  4. `tests/acceptance/M1/canvas/52-canvas-snapshot.test.ts` (`10,784` B, SHA-256 `cf65ab92a1f75d73987d839d8df12e1b9a6180af1365914ed535dba086ecdc27`, Helper K `killApp()` + existing Guard G in `v4`/`v6`).
  5. `tests/acceptance/M1/blackboard/50-races.test.ts` (`17,121` B, SHA-256 `5b285e37521483d51a88e441b2e85af8551d98feb4dadedae960222fbea16b9f`, `mode: 'kill'` + Guard G in `d` and `o`).
  6. `tests/acceptance/M1/blackboard/52-snapshot.test.ts` (`13,433` B, SHA-256 `37ae4297f537baf8ed83a7233286cd2ad9741e0e17578e9db80469f604a878ab`, Helper K `killApp()` + Guard G in `v5`).
- **Host-Only Validations (`V5 = /Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v5-20261023T0155Z`, `evidence-index-v5-stage-a.tsv` `1,900` B `369409c020d72fbcd166d0b32bb18069c9342b30190087b31c040f3087607e44`):** `node --test tests/host/m1-control.selftest.mjs` (`6/6` PASS, `exit 0`, `09f30c30...`), `npm --prefix tests run typecheck` (`exit 0`, `5c2ed944...`), and `node tests/host/run-m1.mjs --harness-only` (`184/184` selftests PASS + typecheck + Vitest discovery, `exit 0`, `24,249` B `b9bfc805d0eb5cbec923f891724cca903cc1a60279f205dee18c530387ce886d`; `416` original manifest IDs + `72` `AC-M1-41` = `488` mandatory rows per round; `PHASE_TOTALS` unchanged `{"sim":394,"snapshot-isolated":6,"snapshot-upgrade":6,"migration":12,"storage":70}`; conditional `M1-41.common.c-host-negative` only; 7 repaired titles unchanged; `mode: 'kill'` sent only at the 7 sites).
- **Stage B `v5` Preparation (`V5/evidence-index-v5-prep.tsv` `6,119` B `bb1aa2b28dde76aec955f9784099f8a182021c77da8cb9d3e54877d2efc42be6`, `V5/prep/READY-C6-C9-V5.md` `12,605` B `e150be0911f3e09a3bd97eba24de2a4b8bb8d67411809907dae1b5e21f7a84a5`):**
  - Clean detached `C9` source checkout at `V5/c9-clean-src/source` (`0700` dirs / `0600` files / `0700` scripts, push disabled) with qualified `tests/node_modules` copied via `cp -pR` from `V4/c8-clean-src/source/tests/node_modules` (`diff -rq` exit `0`).
  - Frozen `v5` SIM launcher `V5/tools/launch-sim-c6-v5.sh` (`14,586` B, mode `0700`, SHA-256 `9ea9e58d0e734869d4e5fa2d29c187039fb7a835e8d2dfa2c429a550903d5434`, requiring `QA_M1_FROM`, `QA_M1_TASK`, `QA_M1_DISPATCH` before any Docker action per `msg_07fdcab606c8`) and focused diff `V5/prep/02-v4-to-v5-launcher-diff.patch` (`13,455` B, SHA-256 `4364c0d730f47594fe11370145ca695349af3dcaeaa382f237fd2481c7d2e07a`) against `V4/tools/launch-canvas-sim-c6-v4.sh`, prepared for two separately granted `--phase sim --provider all` invocations at product `C6` / tests `C9` (`394` fresh `sim` rows = `26` common + `136` Blackboard + `232` Canvas = `387` non-browser + `7` browser, plus `94` carried `C4` rows = `6` `snapshot-isolated` + `6` `snapshot-upgrade` + `12` `migration` + `70` `storage`, not `230`; never claiming fresh `488` or fresh `233` Canvas).
  - **Runtime Status:** **`NOT RUN`** (held for two blind Claude reviews and a new Lead `E-R6` grant per invocation). Legacy (`E-R4`, `26797fd`) stays accepted at `C8`; `M2/T7` actual run `C8`, equivalent at `C9` for `M2/T7`, product `C6`. `AC-M4-06` stays `PENDING`; all 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.


## E-R7 Two-Round Fresh `C6`/`C9` SIM Execution (`m1-sim-c6-c9-r1` & `m1-sim-c6-c9-r2`) and 488-Row M1 Ledger Closure (`394` Fresh `C9` `sim` PASS + `94` Carried `C4` `full2` PASS), 2026-10-23

- **Route & Approvals (`E-R7`, `docs/team/r7-m1-verification-2026-10-23.md` at `65f812a`):**
  - Blind Claude reviews of `C9` (`9eb504f5bff4be7e291570fde12fdf9919a07fa1`, `tests` tree `667e83a9a6a0187d742eb68a17293e4b7302100f`, product `C6 = 4008afb92fe983d52db33442e060210b929966c8` unchanged) and `V5` (`V5 = /Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v5-20261023T0155Z`, frozen launcher `V5/tools/launch-sim-c6-v5.sh` `14,586` B `9ea9e58d0e734869d4e5fa2d29c187039fb7a835e8d2dfa2c429a550903d5434`): Reviewer-A (`docs/reviews/M1/dead-handler-reviewer-a.md` at `e81fb2b`) and Reviewer-B (`docs/reviews/M1/dead-handler-reviewer-b.md` at `4b571d9`) both `APPROVE` with `0` blocking findings.
  - Pre-runtime erratum, detached wrappers, and pending 488-row ledger structure (`V5/evidence-index-v5-erratum.tsv` `766` B `48126f0ba2ee59f661deeb6f7493165cc1b0ce40696c69d6557b204c71348370`, `7` entries, accepted by Lead `msg_8e27e9945471`):
    - `V5/prep/detached-launch.py` (`2,161` B, mode `0700`, SHA-256 `4a1f1ed356c13e3f5d57ffee1d61bb45a07071c462b4e461e1f025701fabe6d3`)
    - `V5/prep/invoke-m1-sim-c6-c9-r1.sh` (`598` B, mode `0700`, SHA-256 `850c58304f1a4b4f64617917b535afbfebb3049e4b141553ef76eeb62b70a00a`)
    - `V5/prep/invoke-m1-sim-c6-c9-r2.sh` (`598` B, mode `0700`, SHA-256 `e9453059e9d9a544443bcae7fc269c6788f8e580601799f84fb3bc374a3c58bc`)
    - `V5/prep/ERRATUM-READY-C6-C9-V5.md` (`9,821` B, mode `0600`, SHA-256 `cfa61850fe0551a3c6a80a3f844e9a42def588f75becc5c58af1f2de25641284`)
    - `V5/prep/PENDING-QA-NOTES-FOR-FINAL-DOCS.md` (`9,820` B, mode `0600`, SHA-256 `831430ca4974b127d75c56d34b2a3e5d9edf8287902682ac6ba3acbaa60e4c71`)
    - `V5/prep/m1-488-ledger-structure-pending.json` (`433,417` B, mode `0600`, SHA-256 `daad64f4ebbc4aa3087343d9bb68afd75372f26398c3ee7fda59a3c5dc076849`) and `.tsv` (`80,441` B, mode `0600`, SHA-256 `023cfa44e170dbb65edc95ad4f80c0ec57c62daf86cf4a9ce033d23d574cf18f`)
  - **Active Session & Lifecycle (`task_57fe3129b0f8` / `ctx_45c8bf2cadf6`):** `term_7b4cc382-f802-483a-b07e-ef8412293cb9`, `Antigravity Gemini 4 Argon (High)` (`gemini-4-argon-high`, effort `high`). Independent judge session: `dispatch:ctx_8449a3df3e54`.
  - **Scope Separation & Carry Rules:**
    - **Fresh `C6`/`C9` SIM Scope (`394` rows per round):** `26` common (`25` `api` + `1` `host` `M1-02.common.default-profile`) + `136` Blackboard `api` + `232` Canvas (`225` `api` + `7` `browser`) = `387` non-browser + `7` browser (`400` rows in `summary.json` including `6` gate rows `G1-IDENTITY`, `PRE`, `CLONE`, `H1`, `M3-ISOLATION`, `TEARDOWN`).
    - **Carried `C4` (`bf09cdad91ca548e1ecbc14428b55180d35d5360`) `full2` Scope (`94` rows, kept strictly separate; never claimed as fresh `488` or fresh `233` Canvas):** `6` `snapshot-isolated` (`5` Blackboard `M1-37.blackboard.v7/v9/v11/v12`, `M1-38.blackboard.c` + `1` Canvas `M1-37.canvas.v12`, Round 1 `qa-multi-r1-bf09cdad-2026-10-22T07-37-53-810Z` `43cbf82c...` / Round 2 `qa-multi-r1-bf09cdad-2026-10-22T08-29-22-193Z` `6c1dbfec...`), `6` `snapshot-upgrade` (Round 1 `qa-multi-r1-bf09cdad-2026-10-22T07-39-29-485Z` `1857504f...` / Round 2 `qa-multi-r1-bf09cdad-2026-10-22T08-30-59-740Z` `ed0ab06d...`), `12` `migration` (Round 1 `qa-multi-r1-bf09cdad-2026-10-22T07-41-19-810Z` `4098d6ca...` / Round 2 `qa-multi-r1-bf09cdad-2026-10-22T08-32-52-124Z` `4098d6ca...`), and `70` `storage` (Round 1 `qa-multi-r1-st-bf09cdad-2026-10-22T07-45-11-499Z` `fd5dc4a7...` / Round 2 `qa-multi-r1-st-bf09cdad-2026-10-22T08-36-44-622Z` `b2a72031...`).
    - **Historical `C8` SIM Rounds & Legacy:** `V4/canvas-sim-c6-r1` (`E-R5`, non-exclusive window) and `V4/canvas-sim-c6-r2` (`E-R5` invalidated by `M1-37.canvas.s-dead` `FAIL`) remain preserved as history only. Legacy (`E-R4`, `26797fd`, `V4/legacy-c6-r2`) remains accepted at `C8`.

### 1. Round 1 (`V5/m1-sim-c6-c9-r1`, `qa-multi-r1-4008afb9-2026-10-23T03-12-17-293Z`) — `394/394` Functional SIM PASS (`400/400` Summary PASS), Accepted

- **Grant, Preflight & Reconciled Pre-Formal-`W3` Bridge (`V5/preflight-m1-sim-c6-c9-r1`):**
  - Granted in `msg_01cc4a7ce777` (LA reservation confirmed in `msg_8c651b7c1586`).
  - Preflight against prior operational `W4` (`/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep/m2/window-attempt3/w4-end.json`, `19,913` B `f9ce5dbe...`): `test-not-e-check.txt` (`583` B `a5a72130...`), `w1-wake.json` (`1,667` B `a556b489...`), `w2-liveness.json` (`719` B `95eaaa20...`), `preflight-boundary.json` (`19,941` B `87f869ab126de9e3921c658ad974a741c3be8f550a5a3dd638afeb3eba136a39`), `32-volume-reconciliation.json` (`3,093` B `aef16022848e8bcf5e5b6f3a8b2ae1d60514ac20fd88b96e9e1cbbc16fda0647`, `all32FullVolumeRecordsIdentical = true`, `0` containers, `problems = []`).
  - Pre-formal-`W3` idle-VM bridge replacement (`49c29d1343abf74373cbd5efb8653294c5097e646cf44897f912fbc56b2e237d` -> `f31cdab47aac4c47efcdc5a1ec3e2ae35aed90acb0412796be1a9f75d1c46abf` created `2026-10-23T03:06:43.754539041Z`) was disclosed in `msg_7e4d36ba5058` and reconciled by Lead in `msg_ba80446e8a9e` before launch.
- **Launch, Boundaries & Execution (`V5/m1-sim-c6-c9-r1/public`):**
  - Launched once via `detached-launch.py` + `invoke-m1-sim-c6-c9-r1.sh` at `2026-10-23T03:11:58Z` (`m1-sim-c6-c9-r1.launch-meta.json` `1,127` B `2387024c5080350d96ced32b644211d130f46aa4510688dd3b0cefdb56d80c90`; supervisor `PID/PGID 39600`, `TTY ??`; launcher `PID 39602`; observers `sampler=44039`, `secret-watch=44040`, `clone-guard=44041`; pre-launch gate `msg_d3f6e3d13de5`, verified by Lead `msg_ef0d31136d48`).
  - Runner window: `2026-10-23T03:12:17.000Z` to `2026-10-23T03:36:59.000Z` (`full-run-exit.json` `92` B `61ca37d15f975745ac0cac5fadae3e0fd15dc4562a23805e455c0656ea555252`, `code = 0`; launcher `done` at `03:37:16Z`, `m1-sim-c6-c9-r1.wrapper.exit = 0`, `0` live owned processes remaining).
  - Phase artifacts (`V5/c9-clean-src/source/tests/host/artifacts/qa-multi-r1-4008afb9-2026-10-23T03-12-17-293Z`, phase clone `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-4008afb9-2026-10-23T03-12-17-293Z`):
    - `summary.json` (`116,934` B, SHA-256 `63b28caebcdf8b6abbb5e5558b27b64ee6591d3997f935a23a5c4f08b1987516`): `400 / 400 PASS` (`394` functional + `6` gate rows; `abort = null`).
    - `m1-case-results.json` (`219,554` B, SHA-256 `71ca7f8127244db870d768d8d99ef47e965deefd2b2427680a5130975fc1791b`): `394 / 394 PASS` (`25` `common:api` + `1` `common:host` `M1-02.common.default-profile` + `136` `blackboard:api` + `225` `canvas:api` + `7` `canvas:browser` = `387` non-browser + `7` browser; `0` failed, `0` skipped, `0` retried).
    - `m1-vitest-results.json` (`141,254` B, SHA-256 `7be6c2250a1f4520bf0983a0c10f7c9cbd8cb4a74db4c51d72b1a867e9dff8f6`) and `playwright-results.json` (`13,861` B, SHA-256 `55fc9108c093bce0d4820b1549cecfb9afc1b6483c0b7a6f7ef910e830e98b86`).
  - `W1–W4`, Cleanup & Whole-Window Confirmation:
    - `w1-wake.json` (`1,667` B `813cef2b...`), `w2-liveness.json` (`720` B `7adb8dbe...`), `w3-formal-start.json` (`19,941` B `f991c4a5c5b2c7ac2455aee42d3cb6e5f8c96ba43912bbe9cb8a846685f07244`, `runStartSecond = 1792725133`, `systemTime = 2026-10-23T03:12:13.072Z`, `bridge = f31cdab47aac...`), `w4-end.json` (`19,932` B `6b7e7e846f5349c1ecb0371746c3799af9f4c592f7dc9b5a5c078af3d0a9d55a`), `w4-compare.json` (`1,587` B `41dc4ecfdc0558121cf4b441f553c75cb59e858e9171f43a916e07715243cb25`, `exit 0`, `problems = []`), `32-volume-reconciliation-r1-w4.json` (`16,543` B `e21fe850a5923c0b14832d95aef54d191bf03ef9eb803d9cabe5388fefad81fa`, all 32 full volume records identical across prior operational `W4`, preflight, `W3`, and `W4`; `bridge` unchanged `W3 -> W4`; `0` containers; port `8443` free).
    - `sampler/lane-containers.json` (`27,419` B `db0ceb15...`), `clone-guard.json` (`106,502` B `05350001...`, `problems = []`), `secret-scan.json` (`1,205` B `5807e9c7...`, `exit 0`, `problems = []`).
    - LA whole-window confirmation `msg_503d50563cba` (`2026-10-23T03:39:32Z`, relayed in `msg_675484e2a589`): `0` LA Docker/container starts or mutations from `03:09:14Z` through `03:37:16Z`, `0` LA containers/networks/volumes.
    - Independent judge acceptance: `msg_3f4b264cdb01`. Lead acceptance: `msg_d0ead4f3d22c` / `msg_4ab0b95cd3d4`.
    - Sealed Round 1 bundle (`0600`): `seven-dead-handler-cases-r1.json` (`46,973` B `05a0930a5805ed8c770861f1b2a8cd13e1298a9b3140915f2ab3877559f473da`), `CLOSURE-LEDGER-M1-SIM-C6-C9-R1.json` (`11,191` B `c53c59adf207438f7d1a1c115cff30e50eb630eda3757824c1b488dc3e45636e`), `REPORT-M1-SIM-C6-C9-R1.md` (`4,603` B `7fb1194884a23f30b63aa25d94a15726c7fbeb666e718eb481475d0733a5122f`), and `V5/evidence-index-m1-sim-c6-c9-r1.tsv` (`182,385` B `065520ffc64a245e479e72c1c7a835dff23903bc6fc80e0837b30b9f384133af`, `707` entries).

### 2. Round 2 (`V5/m1-sim-c6-c9-r2`, `qa-multi-r1-4008afb9-2026-10-23T03-55-11-800Z`) — `394/394` Functional SIM PASS (`400/400` Summary PASS, `R1 == R2` Equality PASS), Accepted

- **Grant, Preflight & Reconciled Pre-Formal-`W3` Bridge (`V5/preflight-m1-sim-c6-c9-r2`):**
  - Granted in `msg_d0ead4f3d22c` (window extended to `04:25 UTC` in `msg_abfc77843c9d`; LA exclusive hold extended in `msg_29fd0b045101` and `msg_df3821742ef0` / `msg_1f97e186ee72`).
  - Preflight against accepted Round 1 `W4` (`V5/m1-sim-c6-c9-r1/public/w4-end.json`, `19,932` B `6b7e7e84...`): `test-not-e-check.txt` (`1,201` B `a8abae5c...`), `w1-wake.json` (`1,668` B `16e002ec...`), `w2-liveness.json` (`716` B `c0009e9a...`), `preflight-boundary.json` (`19,940` B `f14f2c7adc8b1a7b4e4302bc07d399c9fa44fb96956649c7653395179c37f99d`), `32-volume-reconciliation.json` (`1,289` B `011969a6d1810295c0d70dfeed6bd10316922351118c0e9c0fdc04e2eb95d241`, `all32FullVolumeRecordsIdentical = true`, `0` containers, `problems = []`).
  - Pre-formal-`W3` idle-VM bridge replacement (`f31cdab47aac4c47efcdc5a1ec3e2ae35aed90acb0412796be1a9f75d1c46abf` created `2026-10-23T03:06:43.754539041Z` -> `ea3da34cd38c03c00cb59d04a93fdae5a30af7e75c64138ce345b62ebcc66a86` created `2026-10-23T03:50:59.69914575Z`) was disclosed in `msg_3458ffe161bd` / `msg_813b23b137d1` and reconciled by Lead in `msg_bd8b9106f0cc` before launch.
- **Launch, Boundaries & Execution (`V5/m1-sim-c6-c9-r2/public`):**
  - Launched once via `detached-launch.py` + `invoke-m1-sim-c6-c9-r2.sh` at `2026-10-23T03:54:56Z` (`m1-sim-c6-c9-r2.launch-meta.json` `1,123` B `437b0de450ddc657cd58ca8170bd342c606231d8944fe97b9b8a683c09297e57`; supervisor `PID/PGID 3178`, `TTY ??`; launcher `PID 3180`; observers `sampler=6306`, `secret-watch=6307`, `clone-guard=6308`; pre-launch gate `msg_dff2be3259d5`, verified by Lead `msg_abfc77843c9d`).
  - Runner window: `2026-10-23T03:55:11.000Z` to `2026-10-23T04:20:06.000Z` (`full-run-exit.json` `92` B `3f2548d6965b2d9b279820c80f1c7566f4f6904a1a71d0a7c3fe33f29a7de0cf`, `code = 0`; launcher `done` at `04:20:35Z`, `m1-sim-c6-c9-r2.wrapper.exit = 0`, `0` live owned processes remaining).
  - Phase artifacts (`V5/c9-clean-src/source/tests/host/artifacts/qa-multi-r1-4008afb9-2026-10-23T03-55-11-800Z`, phase clone `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-4008afb9-2026-10-23T03-55-11-800Z`):
    - `summary.json` (`116,934` B, SHA-256 `d194e24c6ac24cf39e44386d56b32f65e76f175851ed2b697740c31c01726bce`): `400 / 400 PASS` (`394` functional + `6` gate rows; `abort = null`).
    - `m1-case-results.json` (`219,613` B, SHA-256 `fd4109c7bc97ee126e7038f9a921d52cf11a0eabbe5f9fcdba05e992b70833a6`): `394 / 394 PASS` (`25` `common:api` + `1` `common:host` `M1-02.common.default-profile` + `136` `blackboard:api` + `225` `canvas:api` + `7` `canvas:browser` = `387` non-browser + `7` browser; `0` failed, `0` skipped, `0` retried; `100%` case-ID and verdict equality with Round 1).
    - `m1-vitest-results.json` (`141,314` B, SHA-256 `a239675bcf377dbdf047fc057ad56db87c720efbc9549088551cbd273d8055dd`) and `playwright-results.json` (`13,871` B, SHA-256 `960cb00ff798eac8ae0f1b3b5e4be5adc3b26b214df6b15d45a28aae03e8e7f6`).
  - `W1–W4`, Cleanup & Whole-Window Confirmation:
    - `w1-wake.json` (`1,666` B `dc6ea97c...`), `w2-liveness.json` (`718` B `d3fa4403...`), `w3-formal-start.json` (`19,940` B `98f87359112ec95a6896926bd2e916072e37367fbb945c4e70b16c4bd92a0cfe`, `runStartSecond = 1792727708`, `systemTime = 2026-10-23T03:55:08.578Z`, `bridge = ea3da34cd38c...`), `w4-end.json` (`19,931` B `9db85395a43e207f31abd78fb4c6c66f76c28b02f0780103a5a1ecfa009c57be`), `w4-compare.json` (`1,587` B `12c0b3b90839f5f642810aa4e0555fa90b0e705df87fbe0cf2df67d7d04f8c3b`, `exit 0`, `problems = []`), `32-volume-reconciliation-r2-w4.json` (`17,146` B `afb99ecf7530d1fbf00244c6e96f999d3e168a45f0ccfd8b2aea706dab8bbcb9`, all 32 full volume records identical across Round 1 `W4`, Round 2 preflight, Round 2 `W3`, and Round 2 `W4`; `bridge` unchanged `W3 -> W4`; `0` containers; port `8443` free).
    - `sampler/lane-containers.json` (`28,733` B `f5d0893e...`), `clone-guard.json` (`106,258` B `16303266...`, `problems = []`), `secret-scan.json` (`1,206` B `71b7b314...`, `exit 0`, `problems = []`).
    - LA whole-window confirmation `msg_d645ad7dc42d` (relayed in `msg_f7f57565f1df`): `0` LA Docker/container starts or mutations from `03:51:41Z` through `04:20:35Z`, `0` LA containers/networks/volumes.
    - Independent judge acceptance: `msg_ce2003da6f74`. Lead acceptance: `msg_f7f57565f1df`.
    - Sealed Round 2 bundle (`0600`): `seven-dead-handler-cases-r2.json` (`46,976` B `3644d1d41eee6cf6039a704e54f2fe36a172d946d7b1a04482176cdb08c5afb7`), `CLOSURE-LEDGER-M1-SIM-C6-C9-R2.json` (`11,223` B `64d758fb2d5cc0a0dffb65000a30be633ec75dfa743c8f8a74347b0f13ab4f88`), `REPORT-M1-SIM-C6-C9-R2.md` (`4,785` B `16319ca50885d85be62c4e2420f3556bcafb5769f98be569f8b0ef608977896f`), `V5/evidence-index-m1-sim-c6-c9-r2.tsv` (`182,411` B `bf8e126df0c8c716b7e9f5199822280a693f61e8b9000879330da0db89473ebf`, `707` entries), plus LA/metadata addendum `ADDENDUM-LA-AND-RECONCILIATION-R2.json` (`3,776` B `c24a8680aa43af9ca9d83fd7911c7c70418b549ba9a295f328498c4f4d4adb0a`) and `ADDENDUM-LA-AND-RECONCILIATION-R2.md` (`2,861` B `fce58e28356520f151e8886e49ba98cad38f1d66b8b3d54a0a7d78dc0bedf5ec`).

### 3. Seven Repaired `AC-M1-37` Dead-Handler Cases — Primary-Log Evidence (Round 1 & Round 2)

All values below are taken directly from the sealed primary-log JSON artifacts `seven-dead-handler-cases-r1.json` (`05a0930a...`) and `seven-dead-handler-cases-r2.json` (`3644d1d4...`). In all 7 cases across both rounds: (1) the held call started before `SIGKILL`, (2) `docker compose kill -s SIGKILL cogniate-app` exited `0` (`kill: exit 0, <start ISO>–<end ISO>`, host clock), (3) the unchanged guarded `npm run stack:restart -- cogniate-app` exited `0` and logged `service_started`, (4) the post-restart live-lease assertion proved the 60s lease survived `SIGKILL` (`409` in `d`, `s-dead`, `v4`, `v5`, `v6`; `release` exit `1` `"a redemption may still run"` in `o`), and (5) `0` `outbound_blocked` or `http_request` completion records for the killed attempt appeared before the next `service_started` in `service-logs/cogniate-app.jsonl` (container clock, recorded with the async-log-sink limitation `A-DH-03`).

| Round | Order | Case ID | Status & Duration (ms) | Held Call Start (`cogniate-app.jsonl` / `lti-gate.jsonl`) | `host-actions/<id>.json` (`kill: exit 0`, Host Clock) | Guarded Restart `service_started` (`cogniate-app.jsonl`) | Post-Restart Live-Lease Assertion | Old-Trace Completions Before `service_started` |
|---|---:|---|---|---|---:|---|---|---|
| R1 | 1 | `M1-37.blackboard.d` | `PASS` (`62,984.5`) | `L2565` (`03:25:15.346Z`) / `L53` (`03:25:15.353Z`) | `m1-e1c9aa11f4f1.json` (`kill: exit 0, 2026-10-23T03:25:15.379Z–2026-10-23T03:25:15.508Z`) | `L2568` (`03:25:17.355Z`) | `cogniate-app.jsonl:2569` (`03:25:21.821Z`) HTTP `409` `/app-api/connections/:id/platform` | `0` (`L2565..2567`) |
| R1 | 2 | `M1-37.blackboard.o` | `PASS` (`63,483.7`) | `L2827` (`03:26:48.034Z`) / `L363` (`03:26:48.045Z`) | `m1-1bc7e08bd250.json` (`kill: exit 0, 2026-10-23T03:26:48.071Z–2026-10-23T03:26:48.243Z`) | `L2830` (`03:26:50.428Z`) | `host-actions/m1-5aee319cd3b7.json` exit `1` (`a redemption may still run; retry after 53 s`) | `0` (`L2827..2829`) |
| R1 | 3 | `M1-37.canvas.d` | `PASS` (`62,939.8`) | `L2959` (`03:28:04.552Z`) / `L516` (`03:28:04.556Z`) | `m1-0e94ff7452ac.json` (`kill: exit 0, 2026-10-23T03:28:04.584Z–2026-10-23T03:28:04.716Z`) | `L2961` (`03:28:06.298Z`) | `cogniate-app.jsonl:2962` (`03:28:10.798Z`) HTTP `409` `/app-api/connections/:id/platform` | `0` (`L2959..2960`) |
| R1 | 4 | `M1-37.canvas.s-dead` | `PASS` (`63,049.3`) | `L3398` (`03:29:54.445Z`) / `L915` (`03:29:54.452Z`) | `m1-f1be460dc31d.json` (`kill: exit 0, 2026-10-23T03:29:54.495Z–2026-10-23T03:29:54.631Z`) | `L3400` (`03:29:56.141Z`) | `cogniate-app.jsonl:3407` (`03:30:00.821Z`) HTTP `409` `/app-api/connections/:id/deployments` | `0` (`L3398..3399`) |
| R1 | 5 | `M1-37.canvas.v4` | `PASS` (`7,645.8`) | `L3668` (`03:31:16.748Z`) / `L1216` (`03:31:16.752Z`) | `m1-4b4b211dc743.json` (`kill: exit 0, 2026-10-23T03:31:16.791Z–2026-10-23T03:31:16.940Z`) | `L3670` (`03:31:18.533Z`) | `cogniate-app.jsonl:3672` (`03:31:23.175Z`) HTTP `409` `/app-api/connections/:id/platform` | `0` (`L3668..3669`) |
| R1 | 6 | `M1-37.canvas.v6` | `PASS` (`7,916.7`) | `L3694` (`03:31:24.652Z`) / `L1250` (`03:31:24.656Z`) | `m1-eb768dfcc08a.json` (`kill: exit 0, 2026-10-23T03:31:24.712Z–2026-10-23T03:31:24.864Z`) | `L3696` (`03:31:26.306Z`) | `cogniate-app.jsonl:3698` (`03:31:30.977Z`) HTTP `409` `/app-api/connections/:id/deployments` | `0` (`L3694..3695`) |
| R1 | 7 | `M1-37.blackboard.v5` | `PASS` (`7,764.7`) | `L3850` (`03:32:11.974Z`) / `L1394` (`03:32:11.978Z`) | `m1-ba2bc9057fa8.json` (`kill: exit 0, 2026-10-23T03:32:12.028Z–2026-10-23T03:32:12.202Z`) | `L3852` (`03:32:13.523Z`) | `cogniate-app.jsonl:3853` (`03:32:18.616Z`) HTTP `409` `/app-api/connections/:id/platform` | `0` (`L3850..3851`) |
| R2 | 1 | `M1-37.blackboard.d` | `PASS` (`62,876.6`) | `L2573` (`04:07:33.343Z`) / `L53` (`04:07:33.348Z`) | `m1-074d2cf4fa1c.json` (`kill: exit 0, 2026-10-23T04:07:33.388Z–2026-10-23T04:07:33.545Z`) | `L2576` (`04:07:36.584Z`) | `cogniate-app.jsonl:2577` (`04:07:40.158Z`) HTTP `409` `/app-api/connections/:id/platform` | `0` (`L2573..2575`) |
| R2 | 2 | `M1-37.blackboard.o` | `PASS` (`63,628.9`) | `L2835` (`04:08:56.806Z`) / `L363` (`04:08:56.847Z`) | `m1-e02f36709e09.json` (`kill: exit 0, 2026-10-23T04:08:56.894Z–2026-10-23T04:08:57.148Z`) | `L2838` (`04:09:03.270Z`) | `host-actions/m1-14f1ec4a9287.json` exit `1` (`a redemption may still run; retry after 50 s`) | `0` (`L2835..2837`) |
| R2 | 3 | `M1-37.canvas.d` | `PASS` (`63,152.4`) | `L2967` (`04:10:13.170Z`) / `L516` (`04:10:13.175Z`) | `m1-29c43d8d519c.json` (`kill: exit 0, 2026-10-23T04:10:13.209Z–2026-10-23T04:10:13.359Z`) | `L2969` (`04:10:15.069Z`) | `cogniate-app.jsonl:2970` (`04:10:19.637Z`) HTTP `409` `/app-api/connections/:id/platform` | `0` (`L2967..2968`) |
| R2 | 4 | `M1-37.canvas.s-dead` | `PASS` (`64,317.7`) | `L3406` (`04:12:10.176Z`) / `L915` (`04:12:10.196Z`) | `m1-676a90fa02c3.json` (`kill: exit 0, 2026-10-23T04:12:10.218Z–2026-10-23T04:12:10.449Z`) | `L3408` (`04:12:12.517Z`) | `cogniate-app.jsonl:3415` (`04:12:17.056Z`) HTTP `409` `/app-api/connections/:id/deployments` | `0` (`L3406..3407`) |
| R2 | 5 | `M1-37.canvas.v4` | `PASS` (`9,201.8`) | `L3676` (`04:13:34.143Z`) / `L1216` (`04:13:34.150Z`) | `m1-4383f7db64bb.json` (`kill: exit 0, 2026-10-23T04:13:34.194Z–2026-10-23T04:13:34.372Z`) | `L3678` (`04:13:36.501Z`) | `cogniate-app.jsonl:3680` (`04:13:40.953Z`) HTTP `409` `/app-api/connections/:id/platform` | `0` (`L3676..3677`) |
| R2 | 6 | `M1-37.canvas.v6` | `PASS` (`14,898.1`) | `L3702` (`04:13:44.985Z`) / `L1250` (`04:13:45.016Z`) | `m1-7c07ba797658.json` (`kill: exit 0, 2026-10-23T04:13:45.030Z–2026-10-23T04:13:45.246Z`) | `L3704` (`04:13:52.721Z`) | `cogniate-app.jsonl:3706` (`04:13:55.597Z`) HTTP `409` `/app-api/connections/:id/deployments` | `0` (`L3702..3703`) |
| R2 | 7 | `M1-37.blackboard.v5` | `PASS` (`8,369.3`) | `L3858` (`04:14:51.816Z`) / `L1394` (`04:14:51.819Z`) | `m1-0aa55c7c5735.json` (`kill: exit 0, 2026-10-23T04:14:51.859Z–2026-10-23T04:14:52.023Z`) | `L3860` (`04:14:53.724Z`) | `cogniate-app.jsonl:3861` (`04:14:58.747Z`) HTTP `409` `/app-api/connections/:id/platform` | `0` (`L3858..3859`) |

### 4. Populated 488-Row `E-R7` M1 Ledger, Review Deferrals, & Disclosures

- **Populated 488-Row `E-R7` M1 Ledger (`V5/evidence-index-v5-final-addendum.tsv` `805` B `61b061f4c12d7facf9f1cc9f363a19746ad8dcfe50152b552fc838f067ed164c`):**
  - `V5/prep/m1-488-ledger-populated-e-r7.json` (`535,652` B, mode `0600`, SHA-256 `d0306edb0db78e0b8c8e1f494c3112e8e4eb7b5ce8ec3da09b0a7fa32a54b6de`) and `V5/prep/m1-488-ledger-populated-e-r7.tsv` (`116,829` B, mode `0600`, SHA-256 `e6baa999804de786496436d634b3bbf4e72082fcdeb6a8b07b1f7cc4d534835b`) bind all `488` mandatory M1 rows (`94` `CARRIED_C4_FULL2_PASS` rows at `C4 = bf09cdad91ca548e1ecbc14428b55180d35d5360` + `394` `FRESH_C9_SIM_TWO_ROUND_PASS` rows at product `C6 = 4008afb92fe983d52db33442e060210b929966c8` / tests `C9 = 9eb504f5bff4be7e291570fde12fdf9919a07fa1`). The pre-runtime pending ledger files (`m1-488-ledger-structure-pending.json` `daad64f4...` and `.tsv` `023cfa44...`) remain preserved untouched.
- **Reviewer-A (`e81fb2b`) and Reviewer-B (`4b571d9`) Nonblocking Deferrals & Clarifications:**
  1. **`A-DH-01` (Guarded-Path Trace):** In `C9`, `tests/host/m1-control.mjs:38-47` sends `docker compose -f infra/compose.yaml --env-file .env kill -s SIGKILL cogniate-app` followed by the unchanged guarded `npm run stack:restart -- cogniate-app` (`docs/architecture/tasks/M1.md`, `cogniate-app-api.md`, `ADR-012` §7).
  2. **`A-DH-02` & `B-M1-DH-05` (`M2/T7` Static Equivalence):** `M2` uses both `m1-cli` (`tests/acceptance/M1/canvas/browser.ts:65,70` -> `issueGrant`) and `m1-profile` (`tests/e2e/M2/02-canvas-wizard.m2.ts:246,254`), while `T7` does not load `m1-control.mjs`; both `m1-cli` (`tests/host/m1-control.mjs:18-28`) and `m1-profile` (`:60-68`) branches are byte-identical in `C9`. `READY-C6-C9-V5.md` §4 records static equivalence only; actual `M2` and `T7` runtime execution is owned by the independent QA worker under separate Lead grants.
  3. **`A-DH-03` & `B-M1-DH-02` (Async Log Sink Limitation):** `cogniate-app.jsonl` uses an async stream sink (`packages/shared/src/logger.ts:133,144-145`); live-lease assertions (`409` or `release` exit `1`) are the primary proof that the 60s lease survived `SIGKILL`, and old-trace absence before the next `service_started` is recorded as corroboration.
  4. **`A-DH-04`, `B-M1-DH-01`, `A-DH-05`, `B-M1-DH-04`, `A-DH-07`, `B-M1-DH-03`:** Non-kill `m1-restart` / failed-post-kill-restart selftest cases, `QA_M1_*` pattern checks beyond `${VAR:?}`, combined return `timedOut` field, and `killApp()` deduplication into `common/snapshot.ts` remain deferred so `C9` and `tests/acceptance/M1/common/*` stay frozen.
  5. **`A-DH-06` & `B-M1-DH-05` (`V5/tools` File Count Erratum):** `V5/tools` inherits `37` files from `V4/tools` (`27` top-level + `4` in `controls/` + `6` in `ledger/`, all `37` `MATCH` lines in `V5/prep/01-v4-tools-verify.txt` `e542201d...`) plus `1` new `launch-sim-c6-v5.sh` = `38` files total (`V5/prep/ERRATUM-READY-C6-C9-V5.md` `cfa61850...`).
- **Operational & Metadata Disclosures:**
  1. **Round 1 Pre-Freeze Derived Revision Replacement (`msg_4ab0b95cd3d4`):** Prior to Lead freezing the Round 1 closure files, `CLOSURE-LEDGER-M1-SIM-C6-C9-R1.json` (`10,352` B `5e38edce791529482851f86fb8f0f8207d1beef0ae8f1a23f5ae3787e374c1e8` -> `11,191` B `c53c59adf207438f7d1a1c115cff30e50eb630eda3757824c1b488dc3e45636e`), `REPORT-M1-SIM-C6-C9-R1.md` (`4,010` B `ce10b4e055dc47f87cbdd0412e2b8daebcf83e6ee43cecf846fd44af0708ba0d` -> `4,603` B `7fb1194884a23f30b63aa25d94a15726c7fbeb666e718eb481475d0733a5122f`), and `evidence-index-m1-sim-c6-c9-r1.tsv` (`182,385` B `eaff2586d1dc61fa924061df0e675476c42ebb377d6889ee49c361e3f2c95c76` -> `182,385` B `065520ffc64a245e479e72c1c7a835dff23903bc6fc80e0837b30b9f384133af`) were updated once at `03:46Z` to add LA Round 1 whole-window confirmation `msg_503d50563cba` and `0` live owned PIDs (`39600, 39602, 44039, 44040, 44041`). All 707 indexed Round 1 entries are verified at `065520ff...` and remain frozen.
  2. **Round 1 Status Prose Citation Note (`msg_baec14162a3e`):** Status prose in `msg_baec14162a3e` misquoted gate/app line numbers for Round 1 `M1-37.canvas.d` and `M1-37.canvas.s-dead` from an unsorted printout; the table in §3 above and `seven-dead-handler-cases-r1.json` (`05a0930a...`) record the authoritative primary-log values.
  3. **Round 2 Preflight Reconciliation Shape Note (`msg_bd8b9106f0cc`):** The initial `preflight-m1-sim-c6-c9-r2/32-volume-reconciliation.json` (`1,047` B `f9eca4943353cdc93ecc8ea2ba623014f1ebc402a636710be7cbe832a631521c`) queried `n.Name` instead of lowercase `n.name` on the `networks` list and was updated before launch (`1,289` B `011969a6d1810295c0d70dfeed6bd10316922351118c0e9c0fdc04e2eb95d241`) and in `32-volume-reconciliation-r2-w4.json` (`17,146` B `afb99ecf...`).
- **Remaining Gates:** `M2` and `T7` execute under the independent QA worker's separate Lead grants. `AC-M4-06` remains `PENDING`; all 32 real-LMS rows remain `UNVERIFIED`; local Canvas remains `DEFERRED`. No certification or production readiness is claimed.
