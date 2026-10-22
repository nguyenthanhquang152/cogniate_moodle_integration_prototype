Verdict: FAIL — no complete M1 round and no final-SHA legacy yet: attempt 1 FAIL at `aff4882`; attempts 2 (INTERRUPTED) and 3 (FAIL: one host-gate assertion, zero suite rows) at `8138097`
Round: Claude continuation `ctx_8d5f8d3984d0`, attempt 3 default-gate failure and storage-lock diagnostic, 2026-10-20

The T2/T3 group below passed at its exact frozen candidate. The later harness
repair is preparation only and does not replace that run or close M3.

## Historical preparation checkpoint

Verdict: PREPARATION ONLY — product and provider verification NOT RUN
Round: target-snapshot accounting, 2026-10-20
Owner: retained independent common/Blackboard QA

This report records the common/Blackboard preparation extension for applied
contract `ccdd9ef67cdd2be4c6af374136777fda4e081943`. It does not close M3.
The [M1 report](../M1/qa.md) contains the prepared files, checks and hold.

| Evidence | Current state |
| --- | --- |
| Harness self-checks | 27 passed; independent oracle checks only |
| Common/Blackboard inventory | 166 API cases plus 17 host rows; discovery/typecheck passed |
| Full new snapshot inventory | Held: Canvas 37 v1/v3/v4/v6/v8/v10/v12/aa and 38 i1/i2/i4 pending |
| `SIM` acceptance | Prepared, not run against a product |
| `MOODLE-LIVE` regression / upgrade / rollback | Existing required routes preserved, not run |
| `CANVAS-LOCAL` | Not attempted; separate feasibility after SIM passes |
| `CANVAS-HOSTED`, `BLACKBOARD-LIVE` | Not run; tenant access unknown |

Both future full rounds must use the same frozen product/test SHAs and
include `sim`, `snapshot-isolated`, `snapshot-upgrade` and `migration`.
Every new criterion is a separate required result. The populated 011→012
route is `SIM`, even though it uses real local databases and a real backup:
its LMS peers are QA simulations. It is distinct from the released-v10
Moodle route labeled `MOODLE-LIVE`. Missing, skipped, blocked, duplicate,
wrong-phase, mixed-SHA or mixed-label rows fail accounting.

No production provider DNS or certificate was spoofed. No SSRF rule was
changed. The extension uses the existing QA domains and simulator, independent
public fixtures, public APIs, CLI and gate controls. No stack, signup, tunnel
or Docker Desktop change was attempted. The execution lane remains held
until the Lead freezes the integrated tests and candidate and dispatches
the clean runs.


## Execution checkpoint 1 — T2/T3 legacy, 2026-10-20

Status: the executed T2/T3 group is PASS; M3 remains incomplete.
Active dispatch: `task_ed3b08aa45ea` / `ctx_8d51e8033a8a`.
Product and test SHA: `eb43247d02df622d5da72dafac41d919f65a91fe`.
Run: `qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z`.
Window: 12:21:21–12:30:03 UTC. Lane: `qa-multi-r1`, port `8443`,
subnet `172.29.0.0/16`.

The exact frozen tree was cloned outside integration. No test, product or
infra correction was made. The fixture hashes match the two required ZIPs.
The retained common/Blackboard QA executed this run. The existing independent
QA tests supply the expected results; author self-checks are not this evidence.

Command (from the external frozen source):

```sh
COMPOSE_PROJECT_NAME=qa-multi-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 \
STACK_PROFILE=default QA_M1_LEGACY_GUARD=1 \
QA_PRODUCT_SHA=eb43247d02df622d5da72dafac41d919f65a91fe \
QA_TEST_SHA=eb43247d02df622d5da72dafac41d919f65a91fe \
COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses \
node tests/host/run-t2.mjs --sha eb43247d02df622d5da72dafac41d919f65a91fe \
  --source /Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source \
  --tasks T2a,T2b,T3a,T3b
```

[Case evidence](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/legacy-case-evidence.json) contains each passed
observation's source file, command, SHA, run, label, phase, time, duration and
redacted report path. The [host summary](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/summary.json) preserves
all main, TTL and reset results. [Image identities](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/legacy-image-identities.json)
include the five services and the E2E image. The [main command log](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/cmd/10-test-acceptance-passA.log),
[TTL log](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/cmd/12-test-acceptance-knob.log) and
[reset-pass log](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/qa-multi-r1-eb43247d-2026-10-20T12-21-21-904Z/cmd/18-test-acceptance-passC.log) record the actual executions.

There are 55 passing criteria and 61 passed test observations. The main pass
had 58 reported cases: 57 passed and the documented TTL case was deferred.
The TTL case passed in its required knob phase; reset then rechecked launch
and seed state. Twelve unselected observations across the three phase reports
remain in the evidence as unselected, never as PASS. Every required criterion
in this group has an executed passing observation. No failing or skipped
required criterion was hidden by aggregation.

All rows below share that exact SHA, command and run. The evidence index gives
the individual times and paths. `SIM` covers synthetic protocol and metadata
checks; `MOODLE-LIVE` covers the real Moodle launch, registration and grade flows.

| Criterion | Result | Label | Passing phase |
| --- | --- | --- | --- |
| AC-T2-01 | PASS | SIM | passA |
| AC-T2-02 | PASS | SIM | passA |
| AC-T2-03 | PASS | MOODLE-LIVE | passA, passC |
| AC-T2-04 | PASS | MOODLE-LIVE | passA |
| AC-T2-05 | PASS | MOODLE-LIVE | passA |
| AC-T2-06 | PASS | MOODLE-LIVE | passA |
| AC-T2-07 | PASS | MOODLE-LIVE | knob |
| AC-T2-08 | PASS | MOODLE-LIVE | passA |
| AC-T2-09 | PASS | MOODLE-LIVE | passA |
| AC-T2-10 | PASS | MOODLE-LIVE | passA |
| AC-T2-11 | PASS | MOODLE-LIVE | passA |
| AC-T2-12 | PASS | SIM | passA |
| AC-T2-13 | PASS | SIM | passA |
| AC-T2-14 | PASS | MOODLE-LIVE | passA |
| AC-T2-15 | PASS | MOODLE-LIVE | passA |
| AC-T2-16 | PASS | MOODLE-LIVE | passA |
| AC-T2-18 | PASS | MOODLE-LIVE | passA |
| AC-T2-19 | PASS | MOODLE-LIVE | passA |
| AC-T2-20 | PASS | SIM | passA |
| AC-T2-21 | PASS | SIM | passA |
| AC-T2-22 | PASS | MOODLE-LIVE | passA |
| AC-T2-23 | PASS | MOODLE-LIVE | passA |
| AC-T2-24 | PASS | SIM | passA |
| AC-T2-25 | PASS | SIM | passA |
| AC-T2-26 | PASS | SIM | passA |
| AC-T2-27 | PASS | SIM | passA |
| AC-T2-28 | PASS | SIM | passA |
| AC-T2-29 | PASS | SIM | passA |
| AC-T2-30 | PASS | SIM | passA |
| AC-T2-31 | PASS | MOODLE-LIVE | passA, passC |
| AC-T2-32 | PASS | SIM | passA |
| AC-T3-01 | PASS | MOODLE-LIVE | passA |
| AC-T3-02 | PASS | MOODLE-LIVE | passA |
| AC-T3-03 | PASS | MOODLE-LIVE | passA |
| AC-T3-04 | PASS | MOODLE-LIVE | passA |
| AC-T3-05 | PASS | SIM | passA |
| AC-T3-06 | PASS | MOODLE-LIVE | passA |
| AC-T3-07 | PASS | MOODLE-LIVE | passA |
| AC-T3-08 | PASS | MOODLE-LIVE | passA |
| AC-T3-10 | PASS | MOODLE-LIVE | passA |
| AC-T3-11 | PASS | MOODLE-LIVE | passA |
| AC-T3-12 | PASS | MOODLE-LIVE | passA |
| AC-T3-13 | PASS | MOODLE-LIVE | passA |
| AC-T3-14 | PASS | MOODLE-LIVE | passA |
| AC-T3-16 | PASS | MOODLE-LIVE | passA |
| AC-T3-17 | PASS | MOODLE-LIVE | passA |
| AC-T3-18 | PASS | MOODLE-LIVE | passA |
| AC-T3-22 | PASS | MOODLE-LIVE | passA |
| AC-T3-23 | PASS | MOODLE-LIVE | passA |
| AC-T3-24 | PASS | MOODLE-LIVE | passA |
| AC-T3-25 | PASS | MOODLE-LIVE | passA |
| AC-T3-26 | PASS | MOODLE-LIVE | passA |
| AC-T3-28 | PASS | MOODLE-LIVE | passA |
| AC-T3-29 | PASS | MOODLE-LIVE | passA |
| AC-T3-30 | PASS | MOODLE-LIVE | passA |

Default restoration passed: both services reported `profile: default` and
`knobs: []`; LTI reported `simulation_profiles: []`. The default health bodies
are retained under `M3-LEGACY-DEFAULT` in the host summary. The build runner
was alive with a fresh heartbeat and `image: ready` during the acceptance
pass. Cleanup removed all owned containers, volumes and networks. An
independent post-cleanup check found zero containers and the same seven
volume metadata records as before startup; the baseline was not mounted or
modified by QA. [Boundary evidence](/Users/quangnguyen/cogniate-qa-runs/m3-frozen-20261020T121939Z/source/tests/host/artifacts/dispatch-baseline/post-t2-boundary.json).

The Lead accepted this checkpoint and gave Canvas QA the next exclusive
stack window. No M1 run or other stack starts until the Lead returns that
window. Both complete M1 rounds, the populated 011→012 route, the separate
released-v10 Moodle migration/rollback, and remaining legacy suites are still
required. M2 and the three T7 runs need Canvas QA's own report; they are not
claimed here. No live Canvas or Blackboard result is claimed.

## Repair checkpoint — 2026-10-20

The Lead then relayed Reviewer-A's blocking A-M3-01 capture finding and
Canvas QA's host CLI working-directory failure. The authorized owned repair
is recorded in [M1 QA](../M1/qa.md#repair-checkpoint--a-m3-01-and-host-cli-2026-10-20).
Specific faults now precede all seven method capture rules; opening and
post-reset windows are armed before their cursors. The actual gate-boundary
checks reproduce the old blind spot. No exact-trace or zero-call assertion
was weakened.

The shared host control now runs app and LTI npm workspace commands from
the mounted `/repo` directory. A local handler check covers both services,
literal arguments, error result propagation and the command whitelist.
Actual app/LTI CLI smoke is the first required check on the next frozen
stack. Harness-only subprocess stubs do not establish that smoke.

`node tests/host/run-m1.mjs --harness-only --provider all` passed 31
self-checks, typecheck and the unchanged 416-row discovery. This was an
uncommitted working tree; it supplies no product result. The [log and source
record](/Users/quangnguyen/cogniate-qa-runs/m3-repair-20261020T1243Z/preparation.json)
are separate from the immutable `eb43247` T2/T3 artifacts.

Canvas QA reported its first M2 run as 35 PASS and 29 FAIL, with no skips or
retries; the Lead relayed that 28 failures stopped at the shared CLI route.
Those counts are Canvas QA's report, not this worker's execution or verdict.
Canvas QA cleaned its stack. No new stack is authorized until repairs are
committed and reviewed, the candidate is frozen again, and the Lead returns
the lane. Both complete M1 rounds, remaining legacy suites and Canvas QA's
M2/T7 results remain required; M3 has no overall PASS.

## Partial preflight checkpoint — 2026-10-20

The authorized 14-case PARTIAL SIM preflight passed at product/test
`ae130a3501f3a2502c6a34e36319629e3dcdfb09` with the approved external wrapper.
All 14 selected cases ran and passed; 152 unselected observations were
excluded, with no selected skip or retry. The
[M1 checkpoint](../M1/qa.md#partial-runtime-preflight--2026-10-20)
records the exact command, all IDs, per-case evidence, timing, real app/LTI
CLI outputs, image identities, health and wrapper hash.

Both services returned to the default profile with no knobs or simulation
profiles. The [final secret scan](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/post-cleanup-secret-scan.json)
found no captured secret in eight raw service logs or public artifacts.
The [independent cleanup check](/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/source/tests/host/artifacts/qa-multi-r1-ae130a35-2026-10-20T12-55-39-735Z/independent-cleanup-boundary.json)
at 12:58:30 UTC confirmed zero containers, no owned network or volume,
and the same seven baseline volume metadata records. This is a separate
`ae130a3` checkpoint; the earlier T2/T3 `eb43247` evidence remains unchanged.

This partial PASS closes neither M1 nor M3 and provides no full-inventory
credit. The Lead now assigned the stack to Canvas QA for M2 and conditional
T7. Our two complete four-phase M1 runs and remaining legacy suites stay on
HOLD until that cleanup boundary and the source-review gates. No optional
upgrade smoke or other stack was started.

## A-M3-02 harness checkpoint — 2026-10-20

The two remaining owned Blackboard gate-capture gaps are repaired. Grant
refusal windows now observe all seven HTTP methods and all paths. Race
windows retain all-method capture after a one-shot fault is consumed, with
the specific fault first and the negative-window cursor read after setup.
No refusal, zero-call, cancellation or recovery assertion was removed.

The [M1 repair record](../M1/qa.md#capture-repair-checkpoint--a-m3-02-2026-10-20)
records the owned audit and two actual-caller checks. The checks use an
in-memory gate and inert product responses; they do not establish product
behavior. Their negative control fails both old callers from `ae130a3`
as expected. The final `node tests/host/run-m1.mjs --harness-only
--provider all` passed 33 self-checks, typecheck and unchanged 416-row
discovery. [Evidence and held hashes](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-02-20261020T1311Z/preparation.json).

At the Lead's request, the single shared secret recorder's accepted kind
union now includes `play_id` and `picker_id`. Its storage and redaction are
unchanged; Canvas QA owns the corresponding browser capture and diagnostics.
No stack or product acceptance was run for this repair. M3 remains
FAIL/incomplete. The two full M1 rounds, remaining legacy suites and
independent M2/T7 evidence remain required after the new source-review,
freeze and stack-handback gates.

## Legacy diagnostic checkpoint — A-M3-04, 2026-10-20

The Lead authorized a bounded repair after Reviewer-A found that the
`waitForFrame` timeout in `tests/acceptance/lib/t5.ts` printed full frame
URLs before successful-frame secret capture could run. The timeout now
uses the existing Canvas-owned `diagnosticUrl` helper. This repair changes
only the import and timeout formatting; frame matching, polling, deadline,
assertions and legacy cases are unchanged. Canvas QA retains ownership of
the helper; the final check records its current source hash.

A private scratch check executed the actual `waitForFrame` function,
extracted as exact TypeScript AST text without rewriting its body. The old
function from `e3cd7dbc11a2c41f9059445b0f011bd1ba5e1e63` exposed all 14
synthetic values in runtime, play and picker paths, queries, fragments and
credentials. The repaired timeout exposed none. An exact expected-message
check retained useful safe route shapes, capability placeholders and
`about:blank`. Old and new controls both received raw URLs for matching,
returned the same frame on success, and used the same 200 ms polling step
and controlled deadline. These are local diagnostic checks with synthetic
inputs, not browser or product runtime evidence.

```sh
node /Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-04-20261020T1349Z/timeout-branch-check.mjs
node tests/host/run-m1.mjs --harness-only --provider all
```

Both commands passed. The second included the full acceptance typecheck,
33 self-checks with no failures or skips, and unchanged discovery of 392 API
plus 24 host/browser rows. [Diagnostic result](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-04-20261020T1349Z/timeout-branch-result.json)
and [held files, hashes and harness log](/Users/quangnguyen/cogniate-qa-runs/m3-repair-A-M3-04-20261020T1349Z/preparation.json)
preserve this working-tree checkpoint. No stack, rebuild or product
acceptance ran. M3 remains FAIL/incomplete, and full verification still
needs a new committed test freeze, review gates and the Lead's handback.

## Claude continuation — full-run attempt 1 at `aff4882`, 2026-10-20

Owner: a fresh, independent common/Blackboard QA session, Claude Code Opus 5.5
at xhigh effort (`task_ed3b08aa45ea`, `ctx_8d5f8d3984d0`). It continues from
the outgoing QA's durable handoff. All earlier sections stay as history. The
`eb43247` T2/T3 result stays old-SHA evidence. It gives no credit at the final
SHA.

The Lead opened the exclusive window in `msg_d26c1a003c73`. The complete M1
entry ran at product = test `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`. It
stopped in round 1, phase `sim`, with 385 PASS and 9 FAIL of 394 rows. The
other three phases, round 2 and all legacy groups did not run. The
[M1 report](../M1/qa.md#claude-continuation--full-run-attempt-1-at-aff4882-2026-10-20)
records the command, identity, each failure, its classification, the
evidence paths and the held repair.

### M3 status after this attempt

| Criterion | Status | Owner of the evidence | Notes |
| --- | --- | --- | --- |
| AC-M3-01 | FAIL | This QA (common, Blackboard); Canvas QA judges the Canvas rows | 9 of 394 `sim` rows failed; no complete 416-row round exists. Six common/Blackboard failures are QA oracle, request or host-control defects. The repair is held. The three Canvas rows belong to Canvas QA. |
| AC-M3-02(a) | PASS, cited | Canvas QA (QA-E2E), not run by this QA | [M3 QA-E2E §8](qa-e2e.md#8-round-5--m2-and-t7-at-aff4882): three consecutive default T7 runs at `aff4882`, 17 PASS / 0 FAIL / 1 demo-only skip each, demo PASS, 4/4 confirm checks. Label `MOODLE-LIVE`. |
| AC-M3-02(b) | NOT RUN | This QA | The legacy groups T2a/T2b/T3a/T3b, T3c, T4a, T4b1/T4b2, T5a/T5b/T6 and T8 run only after both full M1 rounds pass. No legacy test was changed. |
| AC-M3-03 | PASS, cited | Canvas QA | [M2 QA](../M2/qa.md): 64/64 at `aff4882`, label `SIM`. |
| AC-M3-04 | Partial | This QA for the M1 run | In this attempt, 0 of 1,299 captured values appear in the simulator, gate or service logs. The simulator keys stay in memory. The full criterion needs the complete runs. |
| AC-M3-05 | UNVERIFIED, cited | Canvas QA | [Live matrix](live.md): all 32 rows UNVERIFIED; no live run is authorized. |
| AC-M3-06 | PASS for this attempt | This QA | One stack only, lane `qa-multi-r1`/8443/`172.29.0.0/16`. Zero containers after. All seven protected volume records are identical to the original baseline. No Docker setting changed. |
| AC-M3-07 | PASS for this attempt | This QA | Runner scan: 1,299 values, 633 files, 0 hits. Independent scan: 0 hits in 9 raw logs and 669 public files, 0 JWT-shaped strings. Raw values stay in the 0700 private run folder. |

A SIM result means only that the service matched the documented provider
behavior in a signed simulation. It does not prove interoperability with
Canvas or Blackboard.

The external observers added no stack action. Their tools and the 8/8
failure-path controls are pinned in the run provenance. They read only selected
container fields and never print child output or container environment.

M3 stays FAIL. It closes only after the Lead commits the held repairs and
Canvas QA's own repairs, a new reviewed freeze, two complete 416-row rounds
with identical outcomes, all legacy groups with default-profile restoration,
and Canvas QA's separate verdict on its rows.

## Attempt 2 at `8138097`: INTERRUPTED, 2026-10-20

The host stopped during round 1, phase `sim` (last activity 15:57:19Z), and
rebooted at 20:04:55Z. No row was evaluated, so the attempt gives no M3 credit.
The owned stack was removed after the reboot by label. All seven protected
volume records still match the original baseline. The Docker engine changed
from 29.8.2 to 29.9.1 when Docker Desktop restarted. The
[M1 report](../M1/qa.md#claude-continuation--full-run-attempt-2-at-8138097-interrupted-2026-10-20)
has the full record. The status table of attempt 1 is still current:
AC-M3-01, AC-M3-02(b) and AC-M3-04 are not complete. Attempt 3 needs a new
window.

## Attempt 3 at `8138097`: FAIL at the default gate, 2026-10-20

The runner's default-profile gate got HTTP 500 from `GET /api/providers`
before the suite started. One required host-gate assertion ran and failed
(`M1-02.common.default-profile`); zero suite rows ran. The same product and images passed this gate in attempt 1.
Docker Desktop updated itself to 4.96.0 (engine 29.9.1) after the reboot. The
cause is not classified. Cleanup passed, and all seven protected volume
records still match the original baseline. The
[M1 report](../M1/qa.md#claude-continuation--full-run-attempt-3-at-8138097-fail-at-the-default-gate-2026-10-20)
has the record. AC-M3-01, AC-M3-02(b) and AC-M3-04 stay incomplete.

## Storage-lock diagnostic after attempt 3, 2026-10-20

An independent QA oracle confirmed that SQLite WAL locking fails on the
`fakeowner` bind mount in this Docker Desktop (4.96.0, engine 29.9.1). B got
the write lock while A held it, and A's row was lost. DELETE mode was enforced
there, which differs from the author's result, and the cause is unknown. A
named volume and the container layer enforce both modes. No version causality
is claimed. The bridge ID changes come from Docker Desktop's idle VM restarts.
This is diagnostic evidence only. Attempt 3 remains a FAILED required host-gate
assertion, and M3 stays FAIL. Details, paths and hashes:
[M1 report](../M1/qa.md#independent-storage-lock-diagnostic-after-attempt-3-2026-10-20).

## Storage source preparation for M3 gates (ADR-012 revision 3.3), 2026-10-21

Status: **source preparation only** (task `task_58a1e33ac60f`, dispatch `ctx_e583d25c6083`). No Docker command ran. This gives no runtime credit. The verdict line at the top of this file does not change. The details and the file list are in the matching addendum of `docs/reviews/M1/qa.md`.

| M3 gate | What QA prepared (from the accepted contract `89be93c`) |
| --- | --- |
| AC-M3-06 fresh lane | `tests/host/core.mjs` preflight: neither exact name `<lane>_ltidb` nor `<lane>_appdb` (by `docker volume inspect`, with any labels or none), and no container, network or volume with the project label. Else the run is BLOCKED and QA removes nothing. `--clean-project` is refused. |
| AC-M3-06 ownership record | One lane listing after every harness command: containers and networks by Docker `Id`, name, labels and `Created`; volumes by `Name` plus `CreatedAt`, `Driver`, `Labels`, `Mountpoint`, `Options` and `Scope`. A resource is made by the run only when it was absent in the listing before, has the project labels (and the volume key label for the two lane volumes), and has a creation second not earlier than the run's start second on the Docker clock. |
| AC-M3-06 teardown | Removes only recorded resources whose fresh inspect matches the latest record: containers and networks by `Id`, volumes by exact name. A mismatch, a missing record, a failed listing or an unlabeled lane name is kept, reported and fails `TEARDOWN`. After cleanup, neither exact name and no labeled resource may exist. Per ADR-012 §15, a same-name, same-second, same-metadata re-creation inside the run cannot be told apart. |
| AC-M3-06 QA mounts | QA never mounts an absent lane volume; the exact-name gate runs before every QA container mount (`storage-docker.mjs`, `storage-lane.mjs`). |
| AC-M3-01 G-1 identity binding | `core.mjs` records `G1-IDENTITY` for M1 and legacy-guard runs: OS version and architecture, Docker CLI version and binary SHA-256, and Compose plugin version and binary SHA-256, compared with the ADR-012 §17 table. Any difference aborts the run as BLOCKED before any stack command. |
| Legacy runners | They share `core.mjs`. Their assertions and their label-scoped `M3-ISOLATION` record are unchanged; only the boundary, ownership and teardown rules above are added. The T5b P5 fixture now uses the `storage-p5` container under QA's lock, with unchanged assertions. |

Host-only controls:
- `node tests/host/run-m1.mjs --harness-only --provider all` exits 0.
- The ownership-ledger tests in `storage-docker.selftest.mjs` cover: a fresh boundary; a same-second product volume; an unlabeled re-created lane name; a volume replaced without an absent listing; an Id that is not recorded; a resource older than the run start; and removal by Id and by exact name. These test QA's decisions only, not Docker.

Still open:
- the runtime proof under a separate authorization;
- the Author implementation and its final reviews;
- the full QA retry on the exact candidate.

All 32 live rows stay `UNVERIFIED`.

## Storage-candidate retry at `a784522`: FAIL in round 1 `sim`, 2026-10-21

Owner: a new, independent common QA session, Claude Code Opus 5.5 xhigh (task `task_ed3b08aa45ea`, dispatch `ctx_75f7ef7a9240`). The full record is in the matching section of the [M1 report](../M1/qa.md#storage-candidate-retry-at-a784522-fail-in-round-1-phase-sim-2026-10-21). Earlier sections above stay unchanged.

The documented full entry ran once at `a784522a3cdd9bb67453b03093092cac24e87402` (product = test) in the sole Docker window, lane `qa-multi-r1`, port 8443. Round 1 phase `sim` gave **394-row SIM evidence: 393 PASS, 1 FAIL** (`M1-17.canvas.repeat`, Canvas QA owns its diagnosis and verdict). The runner then stopped. The 488-row round is incomplete: 94 round-1 rows did not run, and round 2 and all legacy groups did not start. The window was returned at 02:46Z.

| M3 criterion | Status after this attempt |
| --- | --- |
| AC-M3-01 | FAIL, incomplete. Round 1 has 394 of 488 rows (one FAIL); round 2 did not run. G-1 identities matched (macOS 27.0.1 arm64, CLI 29.9.1, Compose 5.6.0, both binaries by SHA-256). Restart timings: 32 `m1-restart` actions, median 6,066 ms, max 8,597 ms. |
| AC-M3-02 (a) T7 | Not run here. QA-E2E owns the three default-profile T7 runs on this candidate. Historical `aff4882` results are not carried. This report does not claim them. |
| AC-M3-02 (b) legacy | Not run. The runner stops before legacy when a required M1 row fails. |
| AC-M3-03 M2 | Not run here. QA-E2E owns all 64 M2 rows on this candidate in its own later window. |
| AC-M3-04 hygiene | Round 1 `sim` only. No PEM private key in the phase text artifacts, raw logs or `tests/` text files (the only match is a log-check pattern in `99-logs.test.ts`). The 5 git-ignored `tests/fixtures/qa-platform/jwks-*.json` files hold public keys only. `infra/.certs` and `infra/.secrets` hold the stack's generated TLS and service keys, not simulator signing keys; they stay in the private clone. The capability union (1,300 values plus 12 stack values) gave 0 hits in 11 raw service, simulator and gate logs and 680 public files; 0 JWT-shaped strings. |
| AC-M3-05 live | All 32 live rows stay `UNVERIFIED` (`live.md`, QA-E2E). |
| AC-M3-06 isolation | No final verdict (incomplete attempt). The runner's `M3-ISOLATION` and `TEARDOWN` PASS. Fresh lane before the start; teardown removed only recorded resources; 0 lane resources left; all 7 protected volume records identical to the original baseline before, at live start and after; no owned process left. The raw outer boundary comparison exited 1 with one problem, `non-owned network missing: bridge`; it is not a PASS. Explanation, kept apart: the before read was the idle-VM cache (`2ab29a9c…`); the VM start created a new bridge at 02:21:14.816Z (`0a08578a…`), and the live-start and after IDs are equal. |
| AC-M3-07 secrets | PASS for this attempt's evidence (method above). Browser traces and screenshots stay private; Canvas QA owns their redaction. |

Correction: the storage-lock diagnostic section above says "A's row was lost". That is not accurate. B acquired the lock while A held it, and A then could not commit. No successfully committed row of A was lost. The cause of the DELETE-mode discrepancy and any Docker-update cause remain unknown.

M3 stays **FAIL**. Next: Canvas QA's diagnosis, the Lead's disposition, then a new window for two complete 488-row rounds and all legacy groups on one frozen SHA.

Correction (task `task_fa95996d3ee3`): the M1 record of this retry gave the duration of `M1-17.canvas.repeat` as 365 s. The correct value is 364.97 **ms** (Vitest milliseconds). Canvas QA's own diagnosis (`msg_6245a961f22b`, relayed by the Lead) reports an inclusive-timestamp oracle that counted the original redemption in the same millisecond, with no second redemption and no remote call. Only a one-case QA repair is authorized (`msg_415316b9ae64`), with no product repair and no rerun credit. This QA did not perform that diagnosis. The attempt result and all not-run phases are unchanged; M3 stays **FAIL**.

## Retry at `55c33a3`: FAIL in round 1 `snapshot-upgrade`, 2026-10-21

Owner: a new, independent common QA session, Claude Code Opus 5.5 (`claude-opus-5-5`) xhigh, task `task_ed3b08aa45ea`, dispatch `ctx_4446d0034a39`. The full record is in the matching section of the [M1 report](../M1/qa.md#retry-at-55c33a3-fail-in-round-1-phase-snapshot-upgrade-2026-10-21). Earlier sections above stay unchanged. This session did not run the evidence of earlier sessions or of QA-E2E.

The documented full entry ran once at `55c33a3e2d60670b5e759a79144c96bd213fca1f` (product = test) in the sole Docker window, lane `qa-multi-r1`, port 8443, subnet `172.29.0.0/16`, from 03:25:14Z to 03:51:00Z. Round 1 `sim` passed 394 of 394 rows and `snapshot-isolated` passed 6 of 6. In `snapshot-upgrade`, `M1-38.common.h1` failed on a common QA oracle defect: the Canvas launch helper uses a new resource link on each call, but the contract keys `services.serviceKey` per (platform, deployment, context, resource link). The runner then stopped. 87 round-1 rows, round 2 and all legacy groups did not run. The window was returned at 03:51Z (`msg_294eb3092b5d`).

| M3 criterion | Status after this attempt |
| --- | --- |
| AC-M3-01 | FAIL, incomplete. Round 1 has 401 of 488 rows (400 PASS, 1 FAIL: `M1-38.common.h1`); round 2 did not run. G-1 identities matched in the runner and in the live W3 boundary (macOS 27.0.1 arm64, CLI 29.9.1, Compose 5.6.0, both binaries by SHA-256). Restart timings: `sim` 32 `m1-restart` actions, median 6,446 ms, max 8,580 ms; profile actions 5,942–6,468 ms. Canvas's 233 round-1 rows passed in the runner; Canvas QA gives their verdict. |
| AC-M3-02 (a) T7 | Not run here. QA-E2E owns the three default-profile T7 runs in its own later window. This report does not claim them. |
| AC-M3-02 (b) legacy | Not run. The runner stops before legacy when a required M1 row fails. Test-id change record (static, no Docker): no file of the twelve legacy suites (`tests/acceptance/T2a`–`T8`), their setup, Vitest configuration, or the legacy host runners `run-t2/t3c/t4a/t4b/t5/t8.mjs` and `lib.mjs` changed between the Moodle baseline (`d54c607`, `3f934ee`, `56591df`) and `55c33a3`. The shared changes are: `acceptance/lib/lti.ts` records two more secret kinds (`play_id`, `picker_id`; a wider scan); `acceptance/lib/t5.ts` redacts frame URLs in a failure message; `host/core.mjs` adds the ADR-012 §15 ownership ledger, G-1, protected-volume isolation, the legacy evidence transport and the final default-profile check (`QA_M1_LEGACY_GUARD=1`); `host/p5-fixture.mjs` moves the approved T5b P5 write to the ADR-012 §11 `storage-p5` route; `host/run-t1.mjs` adds an information note. No legacy assertion is weaker. |
| AC-M3-03 M2 | Not run here. QA-E2E owns all M2 rows in its own later window. |
| AC-M3-04 hygiene | Round 1, three phases. No PEM private key in public phase artifacts or raw service, simulator and gate logs. In `tests/` text, the only match is the check pattern in `99-logs.test.ts`. The 5 git-ignored `tests/fixtures/qa-platform/jwks-*.json` files hold public keys only (no `d`, `p`, `q` members). The capability union (1,335 values plus 36 stack values) gave 0 hits in 32 raw logs and 826 public files, and 0 JWT-shaped strings. |
| AC-M3-05 live | All 32 live rows stay `UNVERIFIED` (`live.md`, QA-E2E). Local Canvas stays deferred. |
| AC-M3-06 isolation | PASS for this attempt's lane. W1 wake, W2 live clock and W3 formal live start boundary passed before any lane command. The runner's `M3-ISOLATION` and `TEARDOWN` passed in all three phases. The W4 live end boundary and the strict W3-to-end comparison passed with zero problems: the same built-in network Ids (bridge `bd7a597c5ae1`), all 7 protected FULL records identical to W3 and to the original baseline, unchanged memory, CPUs, engine identity and settings, and 0 lane resources. The sampler saw one bridge Id and no clock skew. No owned process is left. The incomplete M1 round still gives no AC-M3-01 credit. |
| AC-M3-07 secrets | PASS for this attempt's evidence (method above). Browser traces and screenshots (110 trace entries, 15 PNG files) stay in the 0700 phase clones; Canvas QA owns their redaction. |

The cached pre-wake Docker view (clock about 36 minutes behind, previous bridge) is recorded separately in `w1-wake.json` and is not boundary evidence.

M3 stays **FAIL**. Next: the Lead's disposition of the proposed one-file common repair (`tests/acceptance/M1/common/snapshot-migration.probe.ts`, stable resource link for the two compared Canvas launches), then a new frozen candidate, review and window for two complete 488-row rounds and all legacy groups on one SHA.

Correction (Lead `msg_f305b4f51323`): my round-1 milestone message called the `sim` phase clone 0700 without a check. Before the correction, the three phase clone roots and their test artifact folders were 0755, and each `captured-secrets.jsonl` was 0644. The `*.raw.*` files and `infra/.logs` were already private. No disclosure is demonstrated: the home folder blocks traversal by other users. I changed modes only: the clone roots and every artifact directory are now 0700, and every raw or captured-secret file is 0600. Content and git state are unchanged. The before and after facts are in `public/permission-before.txt` and `public/permission-after.txt` of the run root. The AC-M3-06 and AC-M3-07 rows above apply after this correction.

## Retry at `82e2dab`: FAIL in round 1 `snapshot-upgrade` (backup oracle), 2026-10-21

Owner: a new, independent common QA session, Claude Code Opus 5.5 (`claude-opus-5-5`) xhigh, task `task_ed3b08aa45ea`, dispatch `ctx_b36c97b882dd`. The full record is in the matching section of the [M1 report](../M1/qa.md#retry-at-82e2dab-fail-in-round-1-phase-snapshot-upgrade-backup-oracle-2026-10-21). Earlier sections above stay unchanged. This session did not run the evidence of earlier sessions, of Canvas QA or of QA-E2E.

The documented full entry ran once at `82e2dab6d26915c90070a4aae8ac0c4472706c2d` (product = test). It ran in the sole Docker window, lane `qa-multi-r1`, port 8443, subnet `172.29.0.0/16`, from 04:29:22Z to 04:55:18Z. Round 1 `sim` passed 394 of 394 rows and `snapshot-isolated` passed 6 of 6.

In `snapshot-upgrade`, the seed stage of `M1-38.common.h1` passed, so the snapshot-key repair works. Then the common host oracle `inspectBackup` (`tests/host/m1-migration.mjs:84`) failed: it reads only flat migration arrays. The product backup manifest groups the migration names by database, and the names are exactly the 14 expected old names. No product defect is shown. The phase stopped before it published any row, so h1 has no row credit. 88 round-1 rows, round 2 and all legacy groups did not run. The window was returned at 04:55Z (`msg_50cf6f48d777`); the Lead accepted the failure in `msg_e2e3244580ee`.

| M3 criterion | Status after this attempt |
| --- | --- |
| AC-M3-01 | FAIL, incomplete. Round 1 has 400 of 488 manifested rows, all PASS (common 26, Blackboard 141, Canvas 233), all `SIM`, one SHA pair. The h1 seed stage passed but has no row record. The remaining 88 rows have no result: `snapshot-upgrade` 6, `migration` 12, `storage` 70. Round 2 did not run. G-1 identities matched in the runner and in the live W3 boundary (macOS 27.0.1 arm64, CLI 29.9.1, Compose 5.6.0, both binaries by SHA-256). Restart timings: `sim` 32 `m1-restart` actions, median 6,285 ms, max 8,628 ms; profile actions 5,949–6,583 ms. Canvas QA gives the verdict for the Canvas rows. |
| AC-M3-02 (a) T7 | Not run here. QA-E2E owns the three default-profile T7 runs in its own later window. This report does not claim them. |
| AC-M3-02 (b) legacy | Not run: the runner stops before legacy when a required M1 phase fails. Test-id change record (static, no Docker): between `55c33a3` and `82e2dab`, only `tests/acceptance/M1/common/snapshot-migration.probe.ts` changed in `tests/`. So the `55c33a3` record above still applies: no legacy suite file, setup, Vitest configuration or legacy host runner changed since the Moodle baseline, and no legacy assertion is weaker. The final default-profile check (`QA_M1_LEGACY_GUARD=1`) did not run. |
| AC-M3-03 M2 | Not run here. QA-E2E owns all M2 rows in its own later window. |
| AC-M3-04 hygiene | Round 1, three phases. The capability union (1,334 values plus 36 stack values) gave 0 hits in 33 raw service, simulator and gate logs and in 841 public files, and 0 JWT-shaped strings. The private backup manifest and databases stay in a 0700 folder outside the checkout (files 0600). |
| AC-M3-05 live | All 32 live rows stay `UNVERIFIED` (`live.md`, QA-E2E). Local Canvas stays deferred. |
| AC-M3-06 isolation | PASS for this attempt's lane. W1 wake, W2 live clock and W3 formal live start boundary passed before any lane command. The runner's `M3-ISOLATION` and `TEARDOWN` passed in all three phases. The W4 live end boundary and the strict W3-to-end comparison passed with zero problems: the same built-in network Ids (bridge `8ab2567c7b8f`), all 7 protected FULL records identical to W3 and to the original baseline, unchanged memory, CPUs, engine identity and settings, and 0 lane resources. The sampler saw one bridge Id and no clock skew. No owned process is left. The incomplete M1 round still gives no AC-M3-01 credit. |
| AC-M3-07 secrets | PASS for this attempt's evidence. Browser traces and screenshots (110 trace entries, 15 PNG files) stay in the phase clones; Canvas QA owns their redaction. |

Bounded environment correction (Lead `msg_54ccb0b5da19`, option A):

- Under umask 077, the harness-only check gave 69 of 70: a self-test fixture is sensitive to the file mode. Under umask 022 it gave 70 of 70. Both are preparation evidence only.
- The Moodle container (uid 65534) mounts files from each phase clone. For this reason, only the frozen runner child ran under umask 022.
- The launcher, observers, scans and evidence roots ran under umask 077 and are 0700.
- A narrow guard set each new owned phase clone root from 0755 to 0700, 137, 64 and 207 ms after its birth.
- At each phase checkpoint, the guard set the one 0644 `captured-secrets.jsonl` file of that phase to 0600. At the end, 0 of 526 raw or captured-secret files are not 0600.
- Inner artifact folders stay 0755 inside the 0700 roots. The home folder (0750; group `staff` has only the owner and `root`) blocks every other account.
- The root modes were not private from creation.

The cached pre-wake Docker view (clock about 31 minutes behind, previous bridge) is recorded separately in `w1-wake.json` and is not boundary evidence.

M3 stays **FAIL**. Next: a separate bounded QA task repairs only the common backup oracle and its self-test. Then both independent reviews, a new frozen candidate and a new window are needed for two complete 488-row rounds and all legacy groups on one SHA.

## Retry at `51a80b5`: FAIL in round 1 `snapshot-upgrade` (`h4`, QA control replay) and W4 compare, 2026-10-21

Owner: a new, independent common QA session, Claude Code Opus 5.5 (`claude-opus-5-5`) xhigh, task `task_ed3b08aa45ea`, dispatch `ctx_dee91bc7a4bc`. The full record is in the matching section of the [M1 report](../M1/qa.md#retry-at-51a80b5-fail-in-round-1-phase-snapshot-upgrade-m1-38commonh4-qa-control-replay-2026-10-21). Earlier sections above stay unchanged. This session did not run the evidence of earlier sessions, of Canvas QA or of QA-E2E.

The documented full entry ran once at `51a80b51de2c7491466a21a678418ff8178d247d` (product = test). It ran in the sole Docker window, lane `qa-multi-r1`, port 8443, subnet `172.29.0.0/16`, from 05:30:48Z to 05:57:35Z. Round 1 `sim` passed 394 of 394 rows and `snapshot-isolated` passed 6 of 6. In `snapshot-upgrade`, the h1 seed stage and the repaired backup oracle passed; h2, h3 and h5 passed.

`M1-38.common.h4` failed because of a common QA harness defect. `run-m1.mjs` starts a new host-control server for each stage, and that server re-executed the seven seed-stage requests that were still in the shared control folder. One replay issued a second `add_deployment` grant on the old Canvas connection. The product then refused the seeded grant as `revoked`, so the required attempt event did not occur. No product defect is shown. The Lead accepted the failure (`msg_db04803685a6`); a separate host-only QA repair owner holds the fix.

| M3 criterion | Status after this attempt |
| --- | --- |
| AC-M3-01 | FAIL, incomplete. Round 1 has 404 of 488 manifested rows: 403 PASS and 1 FAIL (`M1-38.common.h4`), all `SIM`, one SHA pair. By owner: common 29 PASS and 1 FAIL, Blackboard 141 PASS, Canvas 233 PASS. 84 rows have no result: `M1-38.common.h1` (seed stage passed, no row record), `j-snapshot`, `migration` 12 and `storage` 70. Round 2 did not run. G-1 identities matched in the runner and in the live W3 boundary (macOS 27.0.1 arm64, CLI 29.9.1, Compose 5.6.0, both binaries by SHA-256). Restart timings: `sim` 32 `m1-restart` actions, median 6,184 ms, max 9,645 ms; profile actions 5,951–6,145 ms. Canvas QA gives the verdict for the Canvas rows. |
| AC-M3-02 (a) T7 | Not run here. QA-E2E owns the three default-profile T7 runs in its own later window. This report does not claim them. |
| AC-M3-02 (b) legacy | Not run: the runner stops before legacy when a required M1 phase fails. Test-id change record (static, no Docker): between `82e2dab` and `51a80b5`, only `tests/host/m1-migration.mjs` and `tests/host/m1-migration.selftest.mjs` changed in `tests/`. So the earlier records above still apply: no legacy suite file, setup, Vitest configuration or legacy host runner changed since the Moodle baseline, and no legacy assertion is weaker. The final default-profile check (`QA_M1_LEGACY_GUARD=1`) did not run. |
| AC-M3-03 M2 | Not run here. QA-E2E owns all M2 rows in its own later window. |
| AC-M3-04 hygiene | Round 1, three phases. The capability union (1,419 values plus 36 stack values) gave 0 hits in 33 raw service, simulator and gate logs and in 879 public files, and 0 JWT-shaped strings. The private backup manifest and databases stay in a 0700 folder outside the checkout. |
| AC-M3-05 live | All 32 live rows stay `UNVERIFIED` (`live.md`, QA-E2E). Local Canvas stays deferred. |
| AC-M3-06 isolation | **FAIL** for this attempt. W1 wake, W2 live clock and W3 formal live start boundary passed before any lane command. The runner's `M3-ISOLATION` and `TEARDOWN` passed in all three phases, and 0 lane resources remain. The W4 live end boundary shows the same built-in network Ids (bridge `9c58df5fc4e1`), all 7 protected FULL records identical to W3 and to the original baseline, and unchanged engine, memory, CPU and settings. The strict comparison found one new unrelated anonymous volume, `d5df35bd…` (CreatedAt 05:32:46Z, no lane or compose label). During the window, the sampler also saw six non-lane containers named `fgw-*` that are not part of this repository. QA did not remove or change the volume; its origin is not proven. The anonymous volume `a17056b8…`, which existed before W1, is unchanged. |
| AC-M3-07 secrets | PASS for this attempt's evidence. Browser traces and screenshots (114 trace entries, 15 PNG files) stay in the phase clones; Canvas QA owns their redaction. |

Permissions (Lead permission contract): the launcher, observers, scans and evidence roots ran under umask 077 and are 0700. Only the frozen runner child ran under umask 022. A narrow guard set each new owned phase clone root from 0755 to 0700, 93, 229 and 28 ms after its birth. At each phase checkpoint it set the one 0644 `captured-secrets.jsonl` file to 0600. At the end, 0 of 551 raw or captured-secret files are not 0600. The root modes were not private from creation.

Harness-only preparation at `51a80b5` (no Docker, umask 022): 71 of 71 self-checks, typecheck PASS, 488 rows per round. This gives no product credit.

M3 stays **FAIL**. Next: the separate host-only QA repair of `tests/host/m1-control.mjs` and its self-test, both independent reviews, a new frozen candidate and a new sole window. The Lead also decides how to handle the unrelated Docker activity before that window. Then two complete 488-row rounds and all legacy groups must run on one SHA.

## Retry at `9cdd768`: FAIL in round 1 `storage` (AC-M1-41), 2026-10-21

Owner: a new, independent common QA session, Claude Code Opus 5.5 (`claude-opus-5-5`) xhigh, task `task_ed3b08aa45ea`, dispatch `ctx_9e877dcb4b10`. The full record is in the matching section of the [M1 report](../M1/qa.md#retry-at-9cdd768-fail-in-round-1-phase-storage-ac-m1-41-2026-10-21). Earlier sections above stay unchanged. This session did not run the evidence of earlier sessions, of Canvas QA or of QA-E2E.

The documented full entry ran once at `9cdd7687b91169a262648018ec6945efa31217dc` (product = test). It ran in the sole Docker window of Lead `msg_4b7f865b8a34`, lane `qa-multi-r1` (storage lane `qa-multi-r1-st`), port 8443, subnet `172.29.0.0/16`, from 07:09:21Z to 07:40:46Z. The owner's quiet-window question is not answered; this report claims no quiet environment. Round 1 `sim` passed 394 of 394 rows, `snapshot-isolated` 6 of 6, `snapshot-upgrade` 6 of 6 (h1–h5 and `j-snapshot`; the host-control repair worked: 33 requests, no replay) and `migration` 12 of 12. In `storage`, 1 row passed and 69 rows failed.

Two storage failures are defects in common QA host files. `c-selftest` does not create the empty folder that the probe selftest needs. The `a-fresh` oracle (`preflightOf()` in `tests/host/storage-oracle.mjs`) compares the post-start `mark-started` summary instead of the `check` pass. The `check` pass (07:40:09.248Z) came before the first service container (07:40:09.390Z). The third failure, the `content_missing` import of `e-old-schema`, ended in a Docker bind-source error just after the product had made the folder again. Its cause is not established. The other 66 rows did not run because their prerequisites failed; each counts as FAIL. No product defect is proven. Canvas QA independently gave the same diagnosis.

| M3 criterion | Status after this attempt |
| --- | --- |
| AC-M3-01 | FAIL. Round 1 has records for all 488 rows: 419 PASS and 69 FAIL, all with one SHA pair; 0 missing, duplicate, unmanifested or wrong-label rows. By owner: common 45 PASS and 69 FAIL (AC-M1-41 storage), Blackboard 141 PASS, Canvas 233 PASS. `c-host-negative` is PASS (fault shown) in round 1 only. Round 2 did not run, so no row meets the two-round rule. G-1 identities matched in every phase and in the live W3 and W4 boundaries (macOS 27.0.1 arm64, CLI 29.9.1, Compose 5.6.0, both binaries by SHA-256). `storage-oplock.sh selftest` passed before the storage phase. Restart timings: `sim` 32 `m1-restart` actions, median 6,487 ms, max 8,627 ms; profile actions 5,932–6,472 ms. Canvas QA gives the verdict for the Canvas rows. |
| AC-M3-02 (a) T7 | Not run here. QA-E2E owns the three default-profile T7 runs in its own later window. This report does not claim them. |
| AC-M3-02 (b) legacy | Not run: the runner stops before legacy when a required M1 phase fails. Test-id change record (static, no Docker): between `51a80b5` and `9cdd768`, only `tests/host/m1-control.mjs` and `tests/host/m1-control.selftest.mjs` changed in `tests/`. So the earlier records above still apply: no legacy suite file, setup, Vitest configuration or legacy host runner changed, and no legacy assertion is weaker. The final default-profile check (`QA_M1_LEGACY_GUARD=1`) did not run. |
| AC-M3-03 M2 | Not run here. QA-E2E owns all M2 rows in its own later window. |
| AC-M3-04 hygiene | Round 1, five phases. The capability union (1,466 values plus 53 stack values) gave 0 hits in 45 raw service, simulator and gate logs and in 1,096 public files, and 0 JWT-shaped strings. The private backup manifests and databases stay in 0700 folders outside the checkout. |
| AC-M3-05 live | All 32 live rows stay `UNVERIFIED` (`live.md`, QA-E2E). Local Canvas stays deferred. |
| AC-M3-06 isolation | PASS for this attempt. W1 wake, W2 live clock and W3 formal live start boundary passed before any lane command; the wake recreated the bridge before W3. The runner's `M3-ISOLATION` and `TEARDOWN` passed in all five phases, and 0 lane resources remain. The W4 live end boundary shows the same built-in network Ids (bridge `bfc49733cfc8`), all 7 protected FULL records identical to W3 and to the original baseline, and the unrelated anonymous volumes `a17056b8…` and `d5df35bd…` unchanged. The strict W3-to-W4 comparison has 0 problems. The sampler saw no non-lane container except QA's own oracle. |
| AC-M3-07 secrets | PASS for this attempt's evidence. Browser traces and screenshots (114 trace entries, 15 PNG files) stay in the phase clones; Canvas QA owns their redaction. |

Permissions (Lead permission contract): the launcher, observers, scans and evidence roots ran under umask 077 and are 0700. Only the frozen runner child ran under umask 022. A narrow guard set each new owned phase clone root from 0755 to 0700, 20 to 235 ms after its birth. At each phase checkpoint it set the one 0644 `captured-secrets.jsonl` file to 0600. The root modes were not private from creation.

M3 stays **FAIL**. Next: the Lead decides on the two common harness repairs (`c-selftest` folder, `a-fresh` summary selection) and on the diagnosis of the import bind-source failure. Then a new frozen candidate, independent reviews and a new sole window are needed. Two complete 488-row rounds and all legacy groups must then run on one SHA.

## Retry at `aaa823b`: FAIL in round 1 `storage` (AC-M1-41), 2026-10-21

Owner: a new, independent common QA session, Claude Code Opus 5.5 (`claude-opus-5-5`) xhigh, no subworkers; task `task_ed3b08aa45ea`, dispatch `ctx_b4253986bb55`. The full record is in the matching section of the [M1 report](../M1/qa.md#retry-at-aaa823b-fail-in-round-1-phase-storage-ac-m1-41-2026-10-21). Earlier sections above stay unchanged. This session did not run the evidence of earlier sessions, of Canvas QA or of QA-E2E. Their results below are citations only.

The documented full entry ran once at `aaa823b25306c5e560f7c4050238b374dec4d4e3` (product = test), with no `--runs` option and no phase filter. It ran in the sole Docker window of Lead `msg_a33783fa968c`, lane `qa-multi-r1` (storage lane `qa-multi-r1-st`), port 8443, subnet `172.29.0.0/16`, from 10:54:48Z to 11:36:48Z. The window was returned at 11:37:11Z. Round 1 `sim` passed 394 of 394 rows, `snapshot-isolated` 6 of 6, `snapshot-upgrade` 6 of 6 and `migration` 12 of 12. In `storage`, 20 rows passed and 50 rows failed.

The approved repairs moved the storage phase forward: `c-selftest`, `a-fresh` and 18 other storage rows now pass. The content-refusal repair worked in `e-old-schema`: the `content_missing` import kept the target FRESH, and the later import passed its content check. Read-only diagnosis (`public/diagnosis-storage-round1.md`, `dc167072…`) found these first failures:

- `a-serialize` (1 row): a contract mismatch. All 87 observed `storage_lock_released` events have `command: null`; ADR-012 lists `command` as a lock-event field and does not mark it nullable. The QA oracle selects the backup release by `command`. The surviving order evidence is consistent with serialization.
- `d-mountpoint` (47 rows, including the cascade): a QA harness defect. The row plants root-owned mountpoints, then lists them as the host user before any product command, and does not restore them. `a-first-start-resume` then gets the correct product refusal `source_unreadable`; `@seed` and 38 later rows cannot run.
- `e-old-schema` (2 rows): a QA harness defect. The storage helper `portal()` sends no `Origin`; the app answers 403 with `csrf_rejected`, as `security.md` §6 requires.

No product defect is proven. The `a-serialize` question needs a Lead or Architect decision.

| M3 criterion | Status after this attempt |
| --- | --- |
| AC-M3-01 | FAIL. Round 1 has records for all 488 rows: 438 PASS and 50 FAIL, all with one SHA; 0 missing, duplicate, unmanifested or wrong-label rows. By owner: common 64 PASS and 50 FAIL (AC-M1-41 storage), Blackboard 141 PASS, Canvas 233 PASS. All named variants passed in round 1: Blackboard AC-M1-37 v2, v5, v7, v9, v11, v12, w, x1, x2, y1, y2, z1–z5; AC-M1-29 k1–k3; AC-M1-38 i3, i4; common AC-M1-38 h1–h5 and i5. AC-M1-23 (4) and AC-M1-30 (7) passed as `MOODLE-LIVE`. AC-M1-35 profile off/on routes passed (3). `c-host-negative` is PASS (fault shown) in round 1 only. Round 2 did not run, so no row meets the two-round rule. G-1 identities matched in every phase and in the live W3 and W4 boundaries (macOS 27.0.1 arm64, CLI 29.9.1, Compose 5.6.0, both binaries by SHA-256). `storage-oplock.sh selftest` passed before the storage phase. Restart timings: `sim` 32 `m1-restart` actions, median 6,050 ms, max 8,641 ms; profile actions 5,934–6,503 ms; `storage` 1 restart, 6,100 ms. Canvas QA gives the verdict for the Canvas rows: QA-E2E round 10 reports Canvas round 1 233/233 PASS as partial evidence ([QA-E2E §13](qa-e2e.md#13-round-10--candidate-aaa823b-2026-10-21)). |
| AC-M3-02 (a) T7 | Not run here. QA-E2E round 10 reports NOT RUN (no window). This report does not claim it. |
| AC-M3-02 (b) legacy | Not run: the runner stops before legacy when a required M1 phase fails. The final default-profile check (`QA_M1_LEGACY_GUARD=1`) did not run. Test-id change record (static, no Docker): between `9cdd768` and `aaa823b`, only `tests/host/storage-oracle.mjs`, `tests/host/storage-rows.mjs` and their two self-tests changed in `tests/` (approved harness repair `0e83e3c`). No legacy suite file, setup, Vitest configuration or legacy host runner changed, and no legacy assertion is weaker. The earlier approved change records above still apply. |
| AC-M3-03 M2 | Not run here. QA-E2E round 10 reports NOT RUN at this SHA. |
| AC-M3-04 hygiene | Round 1, five phases. The capability union (1,466 values plus 53 stack values) gave 0 hits in 52 raw service, simulator and gate logs and in 1,313 public files, and 0 JWT-shaped strings. The private backup manifests and databases stay in 0700 folders outside the checkout. |
| AC-M3-05 live | All 32 live rows stay `UNVERIFIED` (`live.md`, QA-E2E). Local Canvas stays deferred. |
| AC-M3-06 isolation | PASS for this attempt. W1 wake, W2 live clock and W3 formal live start boundary passed before any lane command; the wake recreated the bridge before W3. Both lanes were fresh by exact name and label. The runner's `M3-ISOLATION` and `TEARDOWN` passed in all five phases, and 0 lane resources remain. The W4 live end boundary shows the same built-in network Ids (bridge `49b8d9d5b39c`), all 7 protected FULL records identical to W3 and to the original baseline, and the unrelated anonymous volumes `a17056b8…` and `d5df35bd…` unchanged. The strict W3-to-W4 comparison has 0 problems. The sampler saw no non-lane container except QA's own oracle and fixture containers. |
| AC-M3-07 secrets | PASS for this attempt's evidence. Browser traces and screenshots (113 trace entries, 15 PNG files) stay in the phase clones; Canvas QA owns their redaction. |

Permissions (Lead permission contract): the launcher, observers, scans and evidence roots ran under umask 077 and are 0700. Only the frozen runner child ran under umask 022. A narrow guard set each new owned phase clone root from 0755 to 0700, 32 to 232 ms after its birth. At each phase checkpoint it set the one 0644 `captured-secrets.jsonl` file to 0600. The root modes were not private from creation. Inside the 0700 private folders, two QA files in the storage-private folder were 0644 during the run (one QA hold copy of `cogniate.db` and a 2-byte QA file), and 12 subfolders of the private backup folder are 0755. **Deviation:** the private database copy did not meet the secret-0600 rule during the run; the clone guard does not cover that path. Post-run correction (Lead `msg_6b7ada30298a`): only that database copy was set to 0600 at 11:47:11.753Z, with the same inode, size and SHA-256 before and after. Record: `public/permission-correction-hold-db.json` (SHA-256 `f99bdcf000bd789df6f001e1b3264368fd1aa15a6a96444113bdc2df83ca0fd3`). The correction does not make the run compliant after the fact.

M3 stays **FAIL**. Next: the Lead decides on the two QA harness repairs and on the `a-serialize` contract question. Then a new frozen candidate, independent reviews and a new sole window are needed. Two complete 488-row rounds and all legacy groups must then run on one SHA.

## Storage-repair diagnostic at candidate C `d3296dd`: FAIL (zero credit), 2026-10-21

Verdict for this diagnostic: **FAIL**. It gives no acceptance credit. M3 stays **FAIL** (incomplete). Full record: `docs/reviews/M1/qa.md`, section "Storage-repair diagnostic at candidate C `d3296dd`". Owner: fresh independent common/Blackboard runtime QA, Claude Code Opus 5.5 xhigh, task `task_d006a77c4696`, dispatch `ctx_1183f38cf351`. Candidate C `d3296dd6eddbe723364a639d8e2db0adf12ab183`, tests tree `183a72b2fea5ff065fc57c96649199bc720fb6e0`, product equal to `9f8ac62`. Window: Lead grant `msg_c18858e1a424` (diagnostic only), runner 19:11:27Z–19:29:48Z, returned at 19:29:48Z. Lanes `qa-multi-r1` and `qa-multi-r1-st`, port 8443, subnet `172.29.0.0/16`.

| Item | Status | Evidence |
| --- | --- | --- |
| Diagnostic result | FAIL. Migration 12/12 PASS. Storage 33 PASS, 37 FAIL; one first cause: fixture `@backup-B` "New LTI platform: HTTP 502"; every FAIL row is "not run: prerequisite …" behind it. | phase artifacts under `<root>/source/tests/host/artifacts/` |
| AC-M3-01 G-1 identity binding | Both children record `G1-IDENTITY` PASS. W3 also matches the engine 29.9.1 and the image `sha256:44fce696…`. Diagnostic evidence only. | `g1-client-identity.json`, `w3-formal-start.json` `b0d08c98…` |
| AC-M3-02 (a) two full rounds | Not run (diagnostic grant only) | — |
| AC-M3-02 (b) legacy | Not run. Test-id change record (static, no Docker): between `aaa823b` and C, 0 files changed under the twelve legacy suite folders (`tests/acceptance/T2a`–`T8`), `tests/acceptance/lib`, the legacy host runners `run-t2/t3c/t4a/t4b/t5/t8.mjs`, `lib.mjs`, `core.mjs` and `p5-fixture.mjs`/`p5-step.mjs`. The tests diff has 21 files, all in the storage and migration harness. Outside `tests/` and `docs/`, only `infra/scripts/storage-oplock.sh`, its test and `infra/compat/storage-compat.sha256` changed (R1-A). No legacy assertion is weaker. | `git diff --name-only aaa823b d3296dd` |
| AC-M3-06 isolation and cleanup | Both children: `M3-ISOLATION` PASS and `TEARDOWN` PASS (0 containers, 0 volumes, 0 networks left; ownership 0 errors, 0 kept, 0 failed). Strict W3-to-end comparison: 0 problems. The 7 protected FULL records and the anonymous volumes `a17056b8…` and `d5df35bd…` are unchanged; the bridge, host and none Ids are unchanged. | `w4-compare.json` `9e88a2b6…`, `w4-end.json` `6adacbef…` |
| AC-M3-07 privacy | Secret scan 0 problems (38 captured and 17 stack values; 19 raw and 713 public files) | `secret-scan.json` `dd9cf887…` |

Next: the remediation owner diagnoses `@backup-B`; then a new frozen candidate, its reviews and a new diagnostic grant. Two complete 488-row rounds, all 12 legacy groups, fresh M2 and T7 stay required. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.

## Storage-repair diagnostic at candidate C2 `0938ea1`: FAIL (zero credit), 2026-10-21

Verdict for this diagnostic: **FAIL**. It gives no acceptance credit. M3 stays **FAIL** (incomplete). Full record: `docs/reviews/M1/qa.md`, section "Storage-repair diagnostic at candidate C2 `0938ea1`". Owner: fresh independent common/Blackboard runtime QA, Claude Code Opus 5.5 xhigh, task `task_b591bb888e58`, dispatch `ctx_0700abfb3430`. Candidate C2 `0938ea1bd29acd00a67c7fc1cc8d7606edf2802d`, tests tree `290a773f1c9779693153ae77b46cc8ceb7eb83f4`; product and build paths equal `9f8ac62` (README.md is the only non-docs, non-tests difference; Docs-owned). Window: Lead grant `msg_f14739b51207` (diagnostic only), runner 20:14:11Z–20:38:51Z, returned at about 20:39Z (`msg_a07d09c540e3`). Lanes `qa-multi-r1` and `qa-multi-r1-st`, port 8443, subnet `172.29.0.0/16`.

| Item | Status | Evidence |
| --- | --- | --- |
| Diagnostic result | FAIL. Migration 12/12 PASS. Storage 64 PASS, 6 FAIL of 70 rows. Three first causes: `g-prepared-lti` "A verified rolled_back", `g-orphan-stopped` "The maintenance container still runs", `e-import` "legacySources equal the manifest list". Three dependents: `g-recover-idempotent`, `e-kept`, `e-provenance-restore`. `@backup-B` and all three `@post-B` runs PASS. | phase artifacts under `<root>/source/tests/host/artifacts/`; `D/storage-results.json` `80fe2f8a…` |
| AC-M3-01 G-1 identity binding | Both children record `G1-IDENTITY` PASS. W3 matches the bound OS, CLI and Compose hashes, engine 29.9.1 and the image `sha256:44fce696…` (0 differences). Diagnostic evidence only. | `g1-client-identity.json`, `w3-formal-start.json` `954d2c40…` |
| AC-M3-02 (a) two full rounds | Not run (diagnostic grant only) | — |
| AC-M3-02 (b) legacy | Not run. Test-id change record (static, no Docker): between `d3296dd` and C2, 0 files changed under `tests/acceptance`, the legacy host runners `run-t2/t3c/t4a/t4b/t5/t8.mjs`, `lib.mjs` and `core.mjs`. The tests diff has 3 files, all in the storage harness and its runner. | `git diff --name-only d3296dd 0938ea1 -- tests` |
| AC-M3-06 isolation and cleanup | Both children: `M3-ISOLATION` PASS and `TEARDOWN` PASS (0 left; ownership 0 errors, 0 kept, 0 failed). Strict W3-to-end comparison: 0 problems. The 7 protected FULL records and the anonymous volumes `a17056b8…` and `d5df35bd…` are unchanged; the bridge, host and none Ids are unchanged. | `w4-compare.json` `56354999…`, `w4-end.json` `9b73a81f…` |
| AC-M3-07 privacy | Secret scan 0 problems (38 captured and 17 stack values) | `secret-scan.json` `0e01aed7…` |

Next: the remediation owner diagnoses the three first causes in one batch; then a new frozen candidate, its reviews and a new diagnostic grant. Two complete 488-row rounds, all 12 legacy groups, fresh M2 and T7 stay required. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.

## Storage-repair diagnostic at candidate C3 `c4c6d04`: PASS (diagnostic gate only, zero credit), 2026-10-22

Verdict for this diagnostic: **PASS**. It gives no acceptance credit; the Lead verifies it before any full-run grant. M3 stays **FAIL** (incomplete): the two complete rounds and the legacy groups did not run. Full record: `docs/reviews/M1/qa.md`, section "Storage-repair diagnostic at candidate C3 `c4c6d04`". Owner: fresh independent common/Blackboard runtime QA, Claude Code Opus 5.5 xhigh, task `task_8f5644f9910e`, dispatch `ctx_2e9642c8e4be`. Candidate C3 `c4c6d045b3a132f72bf059d77367d278de9222fa`, tests tree `17330479829a6b65e560afc297e2bee6777459dd` (= R4 `cd73139`); product and build paths equal `9f8ac62` (README.md is the only non-docs, non-tests difference; Docs-owned). Window: Lead grant `msg_44c8dfacddab` (diagnostic only, until 04:05:00.000Z), runner 02:03:14Z–02:28:42Z, returned at about 02:32Z (`msg_932c80706f81`). Lanes `qa-multi-r1` and `qa-multi-r1-st`, port 8443, subnet `172.29.0.0/16`.

| Item | Status | Evidence |
| --- | --- | --- |
| Diagnostic result | PASS. Migration 12/12 PASS. Storage 70/70 PASS (0 FAIL, 0 NOT_APPLICABLE); all 11 fixture runs PASS. The C2 first causes `g-prepared-lti`, `g-orphan-stopped`, `e-import` and their dependents `g-recover-idempotent` (11 points), `e-kept`, `e-provenance-restore` ran their own commands and passed. | phase artifacts under `<root>/source/tests/host/artifacts/`; `D/storage-results.json` `e1877822…`; `diag/public/r4-checks.json` `c515d8dc…` |
| AC-M3-01 G-1 identity binding | Both children record `G1-IDENTITY` PASS. W3 and W4 match the bound OS, CLI and Compose hashes, engine 29.9.1 and the image `sha256:44fce696…` (0 differences). Diagnostic evidence only. | `g1-client-identity.json`, `w3-formal-start.json` `06d069f7…` |
| AC-M3-02 (a) two full rounds | Not run (diagnostic grant only) | — |
| AC-M3-02 (b) legacy | Not run. Test-id change record (static, no Docker): between C2 and C3, 0 files changed under `tests/acceptance`, the legacy host runners `run-t2/t3c/t4a/t4b/t5/t8.mjs`, `lib.mjs` and `core.mjs`. The tests diff has 2 files, both in the storage harness. | `git diff --name-only 0938ea1 c4c6d04 -- tests` |
| AC-M3-06 isolation and cleanup | Both children: `M3-ISOLATION` PASS and `TEARDOWN` PASS (0 left; ownership 0 errors, 0 kept, 0 failed). Strict W3-to-end comparison: 0 problems. The 7 protected FULL records and the anonymous volumes `a17056b8…` and `d5df35bd…` are unchanged; the bridge, host and none Ids are unchanged. | `w4-compare.json` `338b1549…`, `w4-end.json` `ba90d88c…` |
| AC-M3-07 privacy | Secret scan 0 problems (38 captured and 17 stack values); clone guard 0 problems | `secret-scan.json` `c5619289…`, `clone-guard.json` `3df44eb0…` |

Next: after Lead verification and a separate grant, two complete 488-row rounds on C3 and all 12 legacy groups. Fresh M2 and T7 stay required under another owner. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.

## Full run at candidate C3 `c4c6d04`: FAIL in round 1 `storage` (`g-tamper`), 2026-10-22

Verdict: **FAIL**. M3 stays **FAIL** (incomplete). Full record: `docs/reviews/M1/qa.md`, section "Full run at candidate C3 `c4c6d04`". Owner: common/Blackboard runtime QA, Claude Code Opus 5.5 xhigh, task `task_8f5644f9910e`, dispatch `ctx_2e9642c8e4be`. Candidate C3 `c4c6d045b3a132f72bf059d77367d278de9222fa`, tests tree `17330479829a6b65e560afc297e2bee6777459dd`. Window: Lead grant `msg_686df6631c9d` (until 07:00:00.000Z); runner 02:40:53Z–03:31:43Z (exit 1); returned at 03:34:25Z (`msg_63ddbf48a5d1`). Lanes `qa-multi-r1` (sim, snapshots, migration) and `qa-multi-r1-st` (storage), port 8443, subnet `172.29.0.0/16`.

| Item | Status | Evidence |
| --- | --- | --- |
| AC-M3-01 G-1 identity binding | Every round-1 phase records `G1-IDENTITY` PASS. W3 and W4 match the bound OS, CLI and Compose hashes, engine 29.9.1 and the image `sha256:44fce696…` (0 differences). | `full/public/w3-formal-start.json` `4c479999…`, `w4-end.json` `71984da0…` |
| AC-M3-02 (a) two full rounds | **FAIL / incomplete.** Round 1: 488 rows, 470 PASS, 18 FAIL (storage: `g-tamper` and 17 dependent rows not run). sim 394/394, snapshot-isolated 6/6, snapshot-upgrade 6/6, migration 12/12 PASS. Round 2 and the equality check did not run. | `full-judge/round-1-bind.json` `e6144cc9…`, `round-1-verify.json` `f09c2b04…` |
| AC-M3-02 (b) legacy | Not run (the runner stopped after round 1) | — |
| AC-M3-06 isolation and cleanup | Every phase: `M3-ISOLATION` PASS and `TEARDOWN` PASS (ownership 0 errors, 0 kept, 0 failed). Strict W3-to-end comparison: 0 problems; the 7 protected FULL records, the anonymous volumes `a17056b8…` and `d5df35bd…` and the bridge, host and none Ids are unchanged. | `w4-compare.json` `bd9135dd…` |
| AC-M3-07 privacy | Secret scan 0 problems; clone guard 0 problems | `secret-scan.json` `103159f1…`, `clone-guard.json` `9c9cfeeb…` |

Next: the remediation owner diagnoses `g-tamper`; then a new frozen candidate, its reviews and new grants. Two complete 488-row rounds, all 12 legacy groups, fresh M2 and T7 stay required. All 32 real-LMS rows stay `UNVERIFIED`; local Canvas stays `DEFERRED`.
